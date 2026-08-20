/**
 * Show the current state of the voting contract, including the blocklist.
 *
 * Read-only: every call here is a ContractCallQuery, so it changes nothing
 * and can be run as often during a demo.
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

/** Load an optional account, returning null when it is not configured. */
function tryLoadAccount(label) {
  try {
    return loadAccount(label);
  } catch {
    return null;
  }
}

async function main() {
  const opts = flags(process.argv);
  const contractIdString = opts.contract ?? process.env.CONTRACT_ID;

  if (!contractIdString) {
    throw new Error(
      "No contract id. Pass --contract 0.0.x, or deploy first with: node deploy-voting.js"
    );
  }

  const operator = loadAccount("operator");
  const adminAccount = tryLoadAccount("admin");
  const accounts = [operator, ...(adminAccount ? [adminAccount] : []), ...loadVoters()];

  const client = makeClient(operator);
  const contractId = ContractId.fromString(contractIdString);

  const query = (fn, params) =>
    new ContractCallQuery()
      .setContractId(contractId)
      .setGas(QUERY_GAS)
      .setFunction(fn, params)
      .execute(client);

  const owner = "0x" + (await query("owner")).getAddress(0);
  const admin = "0x" + (await query("admin")).getAddress(0);
  const results = (await query("getResults")).getString(0);
  const total = (await query("totalVotes")).getUint256(0).toString();

  /** Map an address back to a friendly label where one is known. */
  const nameOf = (address) => {
    const match = accounts.find(
      (a) => a.evmAddress.toLowerCase() === address.toLowerCase()
    );
    return match ? match.label : "(unknown account)";
  };

  console.log(`Contract ${contractIdString}`);
  console.log(`  owner    : ${owner}  ${nameOf(owner)}`);
  console.log(`  admin    : ${admin}  ${nameOf(admin)}`);
  console.log(`  HashScan : ${hashscanContract(contractIdString)}\n`);

  console.log("Tally");
  for (let i = 0; i < 3; i++) {
    const topic = (await query("getTopic", new ContractFunctionParameters().addUint256(i))).getString(0);
    const votes = (await query("getVotes", new ContractFunctionParameters().addUint256(i))).getUint256(0);
    console.log(`  ${i}  ${topic.padEnd(12)} ${votes.toString().padStart(3)}`);
  }
  console.log(`     ${"total".padEnd(12)} ${total.padStart(3)}`);
  console.log(`\n  printable: "${results}"\n`);

  /* --- the blocklist, read straight from the contract ---------------- */

  const blockedCount = Number((await query("getBlockedCount")).getUint256(0).toString());
  console.log(`Blocklist (${blockedCount} account${blockedCount === 1 ? "" : "s"})`);

  if (blockedCount === 0) {
    console.log("  (empty - nobody is blocked)");
  } else {
    for (let i = 0; i < blockedCount; i++) {
      const address =
        "0x" +
        (await query("getBlockedVoter", new ContractFunctionParameters().addUint256(i))).getAddress(0);
      console.log(`  ${i}  ${address}  ${nameOf(address)}`);
    }
  }

  /* --- per-account view --------------------------------------------- */

  console.log("\nAccounts");
  console.log(
    `  ${"who".padEnd(10)} ${"account".padEnd(13)} ${"evm address".padEnd(44)} voted  blocked  can vote`
  );

  for (const account of accounts) {
    const addressParam = () => new ContractFunctionParameters().addAddress(account.evmAddress);
    const voted = (await query("hasVoted", addressParam())).getBool(0);
    const blocked = (await query("blocked", addressParam())).getBool(0);
    const canVote = !voted && !blocked;

    console.log(
      `  ${account.label.padEnd(10)} ${account.accountId.toString().padEnd(13)} ` +
        `${account.evmAddress.padEnd(44)} ` +
        `${(voted ? "yes" : "no").padEnd(6)} ${(blocked ? "yes" : "no").padEnd(8)} ${canVote ? "yes" : "no"}`
    );
  }

  if (!adminAccount) {
    console.log("\n  (no ADMIN account in .env - run: node create-accounts.js --prefix ADMIN --count 1)");
  }
  if (loadVoters().length === 0) {
    console.log("  (no voter accounts in .env - run: node create-accounts.js)");
  }

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Status error:", err.message ?? err);
  process.exit(1);
});
