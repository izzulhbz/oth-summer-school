/**
 * Admin-only: bar an account from voting, or lift the bar.
 *
 * Only the admin account named in the contract's constructor may do this -
 * not even the owner can. Sending as anyone else is rejected with NotAdmin().
 *
 * Usage:
 *   node block.js --account voter3
 *   node block.js --account voter3 --unblock
 *   node block.js --account voter1 --as voter2      (demonstrates NotAdmin)
 *   node block.js --account voter1 --as operator    (owner is not the admin)
 *
 * --account   an account label (voter1, operator, ...) or a raw 0x address
 * --unblock   lift the block instead of applying it
 * --as        who sends the transaction (default: admin)
 * --contract  contract id (default: CONTRACT_ID in .env)
 */

import {
  ContractId,
  ContractExecuteTransaction,
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

const WRITE_GAS = 200_000;

/** Resolve "voter3" or "0xabc..." to an EVM address. */
function resolveAddress(value) {
  if (!value || value === true) {
    throw new Error("Pass an account, e.g. --account voter3");
  }
  if (String(value).startsWith("0x")) return String(value);
  return loadAccount(String(value)).evmAddress;
}

async function main() {
  const opts = flags(process.argv);

  const sender = opts.as ?? "admin";
  const shouldBlock = !opts.unblock;
  const target = resolveAddress(opts.account);
  const contractIdString = opts.contract ?? process.env.CONTRACT_ID;

  if (!contractIdString) {
    throw new Error(
      "No contract id. Pass --contract 0.0.x, or deploy first with: node deploy-voting.js"
    );
  }

  const account = loadAccount(sender);
  const client = makeClient(account);
  const contractId = ContractId.fromString(contractIdString);
  const selectors = loadErrorSelectors();

  console.log(`${shouldBlock ? "Blocking" : "Unblocking"} ${target}`);
  console.log(`  sent by  : ${sender} (${account.accountId.toString()})`);
  console.log(`  contract : ${contractIdString}\n`);

  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(WRITE_GAS)
    .setFunction(
      "setBlocked",
      new ContractFunctionParameters().addAddress(target).addBool(shouldBlock)
    )
    .execute(client);

  try {
    const receipt = await response.getReceipt(client);
    console.log(`✅ ${shouldBlock ? "Blocked" : "Unblocked"} (${receipt.status.toString()})`);
    console.log(`   ${hashscanContract(contractIdString)}`);
  } catch (err) {
    const reason = await fetchRevertReason(client, response.transactionId, selectors);
    console.error(`❌ Rejected by the contract: ${reason}`);
    console.error(`   status: ${err.status?.toString() ?? err.message}`);
    client.close();
    process.exit(1);
  }

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Block error:", err.message ?? err);
  process.exit(1);
});
