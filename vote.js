/**
 * Cast a single vote as any configured account.
 *
 * Usage:
 *   node vote.js --as voter1 --topic 0
 *   node vote.js --as operator --topic 2
 *   node vote.js --as voter3 --topic 1 --contract 0.0.1234567
 *
 * --as        operator | voter1 | voter2 | voter3   (default: operator)
 * --topic     0, 1 or 2                             (required)
 * --contract  contract id                           (default: CONTRACT_ID in .env)
 *
 * A rejected vote is reported with the exact reason from the contract.
 */

import {
  ContractId,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import {
  loadAccount,
  makeClient,
  loadErrorSelectors,
  fetchRevertReason,
  hashscanContract,
  flags,
} from "./lib/hedera.js";

const VOTE_GAS  = 200_000;
const QUERY_GAS = 120_000;

async function main() {
  const opts = flags(process.argv);

  const who   = opts.as ?? "operator";
  const topic = Number(opts.topic);
  const contractIdString = opts.contract ?? process.env.CONTRACT_ID;

  if (!Number.isInteger(topic) || topic < 0) {
    throw new Error("Pass a topic index, e.g. --topic 0");
  }
  if (!contractIdString) {
    throw new Error(
      "No contract id. Pass --contract 0.0.x, or set CONTRACT_ID in .env by running the demo."
    );
  }

  const account    = loadAccount(who);
  const client     = makeClient(account);
  const contractId = ContractId.fromString(contractIdString);
  const selectors  = loadErrorSelectors();

  // Pre-flight reads: check hasVoted and blocked before sending the transaction.
  const hasVoted = (await new ContractCallQuery()
    .setContractId(contractId).setGas(QUERY_GAS)
    .setFunction("hasVoted", new ContractFunctionParameters().addAddress(account.evmAddress))
    .execute(client)).getBool(0);

  const isBlocked = (await new ContractCallQuery()
    .setContractId(contractId).setGas(QUERY_GAS)
    .setFunction("blocked", new ContractFunctionParameters().addAddress(account.evmAddress))
    .execute(client)).getBool(0);

  const topicName = (await new ContractCallQuery()
    .setContractId(contractId).setGas(QUERY_GAS)
    .setFunction("getTopic", new ContractFunctionParameters().addUint256(topic))
    .execute(client)).getString(0);

  console.log(`Voting as ${who} (${account.accountId.toString()} / ${account.evmAddress})`);
  console.log(`  contract  : ${contractIdString}`);
  console.log(`  topic     : ${topic} "${topicName}"`);
  console.log(`  hasVoted  : ${hasVoted}`);
  console.log(`  blocked   : ${isBlocked}\n`);

  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(VOTE_GAS)
    .setFunction("vote", new ContractFunctionParameters().addUint256(topic))
    .execute(client);

  try {
    const receipt = await response.getReceipt(client);
    console.log(`✅ Vote accepted (${receipt.status.toString()})`);
  } catch (err) {
    const reason = await fetchRevertReason(client, response.transactionId, selectors);
    console.error(`❌ Vote rejected by the contract: ${reason}`);
    console.error(`   status: ${err.status?.toString() ?? err.message}`);
    client.close();
    process.exit(1);
  }

  // Show per-topic counts after a successful vote.
  console.log("\nCurrent tally:");
  for (let i = 0; i < 3; i++) {
    const t = (await new ContractCallQuery()
      .setContractId(contractId).setGas(QUERY_GAS)
      .setFunction("getTopic", new ContractFunctionParameters().addUint256(i))
      .execute(client)).getString(0);
    const v = (await new ContractCallQuery()
      .setContractId(contractId).setGas(QUERY_GAS)
      .setFunction("getVotes", new ContractFunctionParameters().addUint256(i))
      .execute(client)).getUint256(0).toString();
    console.log(`  ${i}  ${t.padEnd(12)} ${v}`);
  }

  const winnerName = (await new ContractCallQuery()
    .setContractId(contractId).setGas(QUERY_GAS)
    .setFunction("winner")
    .execute(client)).getString(0);
  console.log(`\n  Winner so far: "${winnerName}"`);
  console.log(`  HashScan: ${hashscanContract(contractIdString)}`);

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Vote error:", err.message ?? err);
  process.exit(1);
});
