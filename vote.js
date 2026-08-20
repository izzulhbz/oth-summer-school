/**
 * Cast a single vote as any configured account.
 *
 * Usage:
 *   node vote.js --as voter1 --topic 0
 *   node vote.js --as operator --topic 2
 *   node vote.js --as voter3 --topic 1 --contract 0.0.1234567
 *
 * --as        operator | voter1 | voter2 | ...   (default: operator)
 * --topic     0, 1 or 2                          (required)
 * --contract  contract id                        (default: CONTRACT_ID in .env)
 *
 * A rejected vote is reported with the exact contract error that caused it,
 * and exits non-zero.
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

const VOTE_GAS = 200_000;
const QUERY_GAS = 120_000;

async function main() {
  const opts = flags(process.argv);

  const who = opts.as ?? "operator";
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

  const account = loadAccount(who);
  const client = makeClient(account);
  const contractId = ContractId.fromString(contractIdString);
  const selectors = loadErrorSelectors();

  // Free read first, so the reason for a rejection is visible up front.
  const canVote = await new ContractCallQuery()
    .setContractId(contractId)
    .setGas(QUERY_GAS)
    .setFunction("canVote", new ContractFunctionParameters().addAddress(account.evmAddress))
    .execute(client);

  const topicName = await new ContractCallQuery()
    .setContractId(contractId)
    .setGas(QUERY_GAS)
    .setFunction("getTopic", new ContractFunctionParameters().addUint256(topic))
    .execute(client);

  console.log(`Voting as ${who} (${account.accountId.toString()} / ${account.evmAddress})`);
  console.log(`  contract  : ${contractIdString}`);
  console.log(`  topic     : ${topic} "${topicName.getString(0)}"`);
  console.log(`  canVote   : ${canVote.getBool(0)}\n`);

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

  const results = await new ContractCallQuery()
    .setContractId(contractId)
    .setGas(QUERY_GAS)
    .setFunction("getResults")
    .execute(client);

  console.log(`\nTally : ${results.getString(0)}`);
  console.log(`HashScan : ${hashscanContract(contractIdString)}`);

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Vote error:", err.message ?? err);
  process.exit(1);
});
