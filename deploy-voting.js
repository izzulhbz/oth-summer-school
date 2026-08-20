/**
 * Deploy the Voting contract and remember its id.
 *
 * Same job as deploy.js, plus two conveniences for a live demo:
 * it fills in the three topics, and it writes CONTRACT_ID into .env so
 * vote.js / block.js / status.js can find the contract without pasting an
 * id into every command.
 *
 * The constructor also takes the admin address - the only account allowed to
 * change the blocklist. It defaults to the ADMIN_* account in .env.
 *
 * Usage:
 *   node deploy-voting.js
 *   node deploy-voting.js --topics "Pizza,Pasta,Sushi"
 *   node deploy-voting.js --admin voter2        (or a raw 0x address)
 *
 * The equivalent using the template script directly:
 *   node deploy.js ./artifacts/contracts/Voting.sol/Voting.json --gas 1000000 \
 *     --arg-string "Pizza" --arg-string "Pasta" --arg-string "Sushi" \
 *     --arg-address 0xTHE_ADMIN_ADDRESS
 */

import fs from "node:fs";
import path from "node:path";
import { ContractCreateFlow, ContractFunctionParameters } from "@hashgraph/sdk";
import {
  loadAccount,
  makeClient,
  updateEnvFile,
  hashscanContract,
  flags,
  ARTIFACT_PATH,
} from "./lib/hedera.js";

const DEPLOY_GAS = 1_000_000;
const DEFAULT_TOPICS = ["Masala Dosai", "Briyani", "SushPani Puri"];

async function main() {
  const opts = flags(process.argv);

  const topics = opts.topics
    ? String(opts.topics).split(",").map((t) => t.trim())
    : DEFAULT_TOPICS;

  if (topics.length !== 3 || topics.some((t) => t.length === 0)) {
    throw new Error(
      `The contract takes exactly 3 non-empty topics, got ${topics.length}: ${JSON.stringify(topics)}`
    );
  }

  if (!fs.existsSync(path.resolve(ARTIFACT_PATH))) {
    throw new Error(`No compiled artifact at ${ARTIFACT_PATH}. Run: npm run compile`);
  }

  const artifact = JSON.parse(fs.readFileSync(path.resolve(ARTIFACT_PATH), "utf8"));
  const bytecode = artifact.bytecode.replace(/^0x/, "");

  const operator = loadAccount("operator");

  // The admin is a separate account from the owner: it is the only role that can change the blocklist.
  let adminAddress;
  let adminLabel;
  if (opts.admin && String(opts.admin).startsWith("0x")) {
    adminAddress = String(opts.admin);
    adminLabel = "(raw address)";
  } else {
    const label = String(opts.admin ?? "admin");
    try {
      const adminAccount = loadAccount(label);
      adminAddress = adminAccount.evmAddress;
      adminLabel = adminAccount.accountId.toString();
    } catch {
      throw new Error(
        `No ${label.toUpperCase()}_ID / ${label.toUpperCase()}_KEY in .env.\n` +
          "   Create the admin account first:\n" +
          "     node create-accounts.js --prefix ADMIN --count 1"
      );
    }
  }

  const client = makeClient(operator);

  console.log("Deploying Voting to Hedera Testnet");
  console.log(`  owner  : ${operator.accountId.toString()}  ${operator.evmAddress}`);
  console.log(`  admin  : ${adminLabel}  ${adminAddress}`);
  console.log(`  topics : ${topics.map((t, i) => `${i}="${t}"`).join("  ")}`);
  console.log(`  gas    : ${DEPLOY_GAS}\n`);

  const response = await new ContractCreateFlow()
    .setGas(DEPLOY_GAS)
    .setBytecode(bytecode)
    .setContractMemo("OTH Summer School Blockchain - Voting Contract")
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addString(topics[0])
        .addString(topics[1])
        .addString(topics[2])
        .addAddress(adminAddress)
    )
    .execute(client);

  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;
  if (!contractId) {
    throw new Error(`Deployment failed with status: ${receipt.status.toString()}`);
  }

  updateEnvFile({ CONTRACT_ID: contractId.toString() });

  console.log("✅ Contract deployed");
  console.log(`  Contract ID : ${contractId.toString()}`);
  console.log(`  EVM address : 0x${contractId.toSolidityAddress()}`);
  console.log(`  HashScan    : ${hashscanContract(contractId.toString())}`);
  console.log("\n  CONTRACT_ID saved to .env - the other scripts will pick it up.");
  console.log("  Next: node status.js");
  console.log("  Then: node block.js --account voter3     (sent by the admin)");

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Deployment error:", err.message ?? err);
  process.exit(1);
});
