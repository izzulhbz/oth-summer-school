/**
 * Show the current state of the voting contract.
 *
 * Read-only: every call here is a ContractCallQuery, so it changes nothing
 * and can be run as often as needed during a demo.
 *
 * Usage:
 *   node status.js
 *   node status.js --contract 0.0.1234567
 */

import {
  ContractId,
  ContractCallQuery,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import {
  loadAccount,
  loadVoters,
  makeClient,
  hashscanContract,
  flags,
} from "./lib/hedera.js";

const QUERY_GAS = 150_000;

async function main() {
  const opts = flags(process.argv);
  const contractIdString = opts.contract ?? process.env.CONTRACT_ID;

  if (!contractIdString) {
    throw new Error(
      "No contract id. Pass --contract 0.0.x, or deploy first with: node deploy-voting.js"
    );
  }

  const operator = loadAccount("operator");
  const accounts = [operator, ...loadVoters()];

  const client = makeClient(operator);
  const contractId = ContractId.fromString(contractIdString);

  const query = (fn, params) =>
    new ContractCallQuery()
      .setContractId(contractId)
      .setGas(QUERY_GAS)
      .setFunction(fn, params)
      .execute(client);

  // The new contract has a single "admin" role — the deployer.
  const admin = "0x" + (await query("admin")).getAddress(0);
  const winner = (await query("winner")).getString(0);

  /** Map an EVM address back to a friendly label where one is known. */
  const nameOf = (address) => {
    const match = accounts.find(
      (a) => a.evmAddress.toLowerCase() === address.toLowerCase()
    );
    return match ? match.label : "(unknown account)";
  };

  console.log(`Contract ${contractIdString}`);
  console.log(`  admin    : ${admin}  ${nameOf(admin)}`);
  console.log(`  HashScan : ${hashscanContract(contractIdString)}\n`);

  console.log("Tally");
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const topic = (await query("getTopic", new ContractFunctionParameters().addUint256(i))).getString(0);
    const votes = Number((await query("getVotes", new ContractFunctionParameters().addUint256(i))).getUint256(0).toString());
    total += votes;
    console.log(`  ${i}  ${topic.padEnd(12)} ${String(votes).padStart(3)}`);
  }
  console.log(`       ${"total".padEnd(12)} ${String(total).padStart(3)}`);
  console.log(`\n  Winner: "${winner || "(no votes yet)"}"\n`);

  /* --- per-account view --------------------------------------------- */

  console.log("Accounts");
  console.log(
    `  ${"who".padEnd(10)} ${"account".padEnd(13)} ${"evm address".padEnd(44)} voted  blocked`
  );

  for (const account of accounts) {
    const addressParam = () => new ContractFunctionParameters().addAddress(account.evmAddress);
    const voted   = (await query("hasVoted", addressParam())).getBool(0);
    const blocked = (await query("blocked",  addressParam())).getBool(0);

    console.log(
      `  ${account.label.padEnd(10)} ${account.accountId.toString().padEnd(13)} ` +
        `${account.evmAddress.padEnd(44)} ` +
        `${(voted   ? "yes" : "no").padEnd(6)} ${blocked ? "yes" : "no"}`
    );
  }

  if (loadVoters().length === 0) {
    console.log("\n  (no voter accounts in .env - run: node create-accounts.js)");
  }

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Status error:", err.message ?? err);
  process.exit(1);
});
