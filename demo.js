/**
 * End-to-end demonstration on the Hedera Testnet.
 *
 * Deploys a fresh Voting contract and then runs the full story:
 *
 *   1. deploy with three topics (operator becomes admin automatically)
 *   2. admin/operator blocks voter3
 *   3. operator, voter1 and voter2 each vote once          -> accepted
 *   4. voter3 votes                                        -> rejected, blocked
 *   5. voter1 votes a second time                          -> rejected, already voted
 *   6. voter2 tries to block voter1                        -> rejected, not admin
 *   7. print the winner and per-topic counts
 *
 * Requires .env with the operator and VOTER1..VOTER3
 * (see create-accounts.js).
 *
 * Usage:
 *   node demo.js
 */

import fs from "node:fs";
import path from "node:path";
import {
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import {
  loadAccount,
  loadVoters,
  makeClient,
  loadErrorSelectors,
  fetchRevertReason,
  updateEnvFile,
  hashscanContract,
  ARTIFACT_PATH,
} from "./lib/hedera.js";

const TOPICS = ["Pizza", "Pasta", "Sushi"];

const DEPLOY_GAS = 1_000_000;
const WRITE_GAS  = 200_000;
const QUERY_GAS  = 150_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let selectors;

/** Run a state-changing call that is expected to SUCCEED. */
async function expectSuccess(client, contractId, label, fn, params) {
  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(WRITE_GAS)
    .setFunction(fn, params)
    .execute(client);

  try {
    const receipt = await response.getReceipt(client);
    console.log(`  ✅ ${label}  ->  ${receipt.status.toString()}`);
    return true;
  } catch (err) {
    const reason = await fetchRevertReason(client, response.transactionId, selectors);
    console.log(`  ❌ ${label}  ->  UNEXPECTED FAILURE: ${reason}`);
    return false;
  }
}

/** Run a state-changing call that is expected to be REJECTED. */
async function expectRejection(client, contractId, label, fn, params, expectedError) {
  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(WRITE_GAS)
    .setFunction(fn, params)
    .execute(client);

  try {
    await response.getReceipt(client);
    console.log(`  ❌ ${label}  ->  WRONGLY ACCEPTED (expected ${expectedError})`);
    return false;
  } catch {
    const reason = await fetchRevertReason(client, response.transactionId, selectors);
    const matched = reason.includes(expectedError);
    console.log(
      `  ${matched ? "✅" : "⚠️ "} ${label}  ->  rejected: ${reason}` +
        (matched ? "" : `  (expected ${expectedError})`)
    );
    return matched;
  }
}

async function read(client, contractId, fn, params) {
  return new ContractCallQuery()
    .setContractId(contractId)
    .setGas(QUERY_GAS)
    .setFunction(fn, params)
    .execute(client);
}

async function readString(client, contractId, fn, params) {
  return (await read(client, contractId, fn, params)).getString(0);
}

async function readUint(client, contractId, fn, params) {
  return (await read(client, contractId, fn, params)).getUint256(0);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  selectors = loadErrorSelectors();

  const operator = loadAccount("operator");
  const voters = loadVoters();

  if (voters.length < 3) {
    throw new Error(
      `Need 3 voter accounts, found ${voters.length}. Run: node create-accounts.js`
    );
  }
  const [voter1, voter2, voter3] = voters;

  // The operator is both deployer and admin — no separate ADMIN account needed.
  const operatorClient = makeClient(operator);

  /* --- 1. deploy ------------------------------------------------- */

  const artifact = JSON.parse(fs.readFileSync(path.resolve(ARTIFACT_PATH), "utf8"));
  const bytecode = artifact.bytecode.replace(/^0x/, "");

  console.log("1. Deploying Voting to Hedera Testnet");
  console.log(`   topics: ${TOPICS.map((t) => `"${t}"`).join(", ")}`);

  const createResponse = await new ContractCreateFlow()
    .setGas(DEPLOY_GAS)
    .setBytecode(bytecode)
    .setContractMemo("OTH Summer School Blockchain - Voting Contract")
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addString(TOPICS[0])
        .addString(TOPICS[1])
        .addString(TOPICS[2])
    )
    .execute(operatorClient);

  const contractId = (await createResponse.getReceipt(operatorClient)).contractId;
  if (!contractId) throw new Error("Deployment produced no contract id");

  console.log(`   ✅ Contract ID : ${contractId.toString()}`);
  console.log(`      HashScan   : ${hashscanContract(contractId.toString())}`);

  updateEnvFile({ CONTRACT_ID: contractId.toString() });

  console.log("\n   Participants");
  console.log(`     admin/operator : ${operator.accountId.toString()}  ${operator.evmAddress}`);
  for (const v of voters.slice(0, 3)) {
    console.log(`     ${v.label.padEnd(14)} : ${v.accountId.toString()}  ${v.evmAddress}`);
  }

  /* --- 2. block voter3 -------------------------------------------- */

  console.log("\n2. The admin (operator) blocks voter3");
  await expectSuccess(
    operatorClient,
    contractId,
    `operator blocks ${voter3.label}`,
    "setBlocked",
    new ContractFunctionParameters().addAddress(voter3.evmAddress).addBool(true)
  );

  /* --- 3. three accepted votes ------------------------------------ */

  console.log("\n3. Three accounts each vote once");
  const voter1Client = makeClient(voter1);
  const voter2Client = makeClient(voter2);
  const voter3Client = makeClient(voter3);

  await expectSuccess(
    operatorClient, contractId, `operator votes "${TOPICS[0]}"`,
    "vote", new ContractFunctionParameters().addUint256(0)
  );
  await expectSuccess(
    voter1Client, contractId, `voter1   votes "${TOPICS[0]}"`,
    "vote", new ContractFunctionParameters().addUint256(0)
  );
  await expectSuccess(
    voter2Client, contractId, `voter2   votes "${TOPICS[1]}"`,
    "vote", new ContractFunctionParameters().addUint256(1)
  );

  /* --- 4-6. three rejections -------------------------------------- */

  console.log("\n4. A blocked account cannot vote");
  await expectRejection(
    voter3Client, contractId, `voter3   votes "${TOPICS[2]}"`,
    "vote", new ContractFunctionParameters().addUint256(2),
    "Account is blocked"
  );

  console.log("\n5. Nobody can vote twice");
  await expectRejection(
    voter1Client, contractId, "voter1   votes again",
    "vote", new ContractFunctionParameters().addUint256(1),
    "Already voted"
  );

  console.log("\n6. Only the admin can change the blocklist");
  await expectRejection(
    voter2Client, contractId, "voter2   blocks voter1",
    "setBlocked",
    new ContractFunctionParameters().addAddress(voter1.evmAddress).addBool(true),
    "Only admin can block"
  );

  /* --- 7. results -------------------------------------------------- */

  console.log("\n7. Final results");

  for (let i = 0; i < 3; i++) {
    const topic = await readString(operatorClient, contractId, "getTopic",
      new ContractFunctionParameters().addUint256(i));
    const votes = await readUint(operatorClient, contractId, "getVotes",
      new ContractFunctionParameters().addUint256(i));
    console.log(`   ${i}  ${topic.padEnd(10)} ${votes.toString()} vote(s)`);
  }

  const winnerName = await readString(operatorClient, contractId, "winner");
  console.log(`\n   Winner: "${winnerName}"`);

  console.log(`\n   Verify every transaction above at:`);
  console.log(`   ${hashscanContract(contractId.toString())}`);

  operatorClient.close();
  voter1Client.close();
  voter2Client.close();
  voter3Client.close();
}

main().catch((err) => {
  console.error("\n❌ Demo error:", err.message ?? err);
  process.exit(1);
});
