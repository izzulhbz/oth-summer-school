/**
 * Deploy the Voting contract and remember its id.
 *
 * The deployer (operator) automatically becomes the admin — the only
 * account allowed to block voters. No separate ADMIN account is needed.
 *
 * Usage:
 *   node deploy-voting.js
 *   node deploy-voting.js --topics "Pizza,Pasta,Sushi"
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
const DEFAULT_TOPICS = ["Pizza", "Pasta", "Sushi"];

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

  // The operator deploys the contract and automatically becomes the admin.
  const operator = loadAccount("operator");
  const client = makeClient(operator);

  console.log("Deploying Voting to Hedera Testnet");
  console.log(`  admin/deployer : ${operator.accountId.toString()}  ${operator.evmAddress}`);
  console.log(`  topics         : ${topics.map((t, i) => `${i}="${t}"`).join("  ")}`);
  console.log(`  gas            : ${DEPLOY_GAS}\n`);

  const response = await new ContractCreateFlow()
    .setGas(DEPLOY_GAS)
    .setBytecode(bytecode)
    .setContractMemo("OTH Summer School Blockchain - Voting Contract")
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addString(topics[0])
        .addString(topics[1])
        .addString(topics[2])
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
  console.log("  Then: node block.js --account voter1  (you are the admin)");

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Deployment error:", err.message ?? err);
  process.exit(1);
});
