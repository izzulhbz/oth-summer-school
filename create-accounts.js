/**
 * Create the voter accounts used to demonstrate one-vote-per-account.
 *
 * Generates ECDSA key pairs and creates a Hedera account for each, funded from
 * the operator. ECDSA keys (not ED25519) are used deliberately: an ECDSA
 * account gets a real derived EVM address, which is what lands in msg.sender
 * when the account calls the contract.
 *
 * The new IDs and keys are written back into .env as VOTER1_*, VOTER2_*, ...
 *
 * Usage:
 *   node create-accounts.js                              -> VOTER1..VOTER3
 *   node create-accounts.js --count 5                    -> VOTER1..VOTER5
 *   node create-accounts.js --prefix ADMIN --count 1     -> ADMIN_ID / ADMIN_KEY
 *   node create-accounts.js --balance 30
 *
 * Existing entries with the same names are replaced; everything else in .env
 * is left alone.
 */

import {
  AccountCreateTransaction,
  AccountBalanceQuery,
  PrivateKey,
  Hbar,
} from "@hashgraph/sdk";
import {
  loadAccount,
  makeClient,
  updateEnvFile,
  hashscanAccount,
  flags,
} from "./lib/hedera.js";

async function main() {
  const opts = flags(process.argv);
  const count = Number(opts.count ?? 3);
  const balance = Number(opts.balance ?? 20);
  const prefix = String(opts.prefix ?? "VOTER").toUpperCase();

  // A single account is written as ADMIN_ID, not ADMIN1_ID.
  const unnumbered = count === 1 && opts.prefix !== undefined;

  const operator = loadAccount("operator");
  const client = makeClient(operator);

  const operatorBalance = await new AccountBalanceQuery()
    .setAccountId(operator.accountId)
    .execute(client);

  console.log(`Operator ${operator.accountId.toString()} holds ${operatorBalance.hbars.toString()}`);
  console.log(`Creating ${count} ECDSA account(s) [${prefix}] with ${balance} HBAR each ...\n`);

  const created = [];
  const envEntries = {};

  for (let i = 1; i <= count; i++) {
    // setECDSAKeyWithAlias sets the account key AND the EVM address alias
    // derived from it, so msg.sender is the familiar 0x... address rather
    // than Hedera's "long zero" form.
    const privateKey = PrivateKey.generateECDSA();

    const tx = await new AccountCreateTransaction()
      .setECDSAKeyWithAlias(privateKey)
      .setInitialBalance(new Hbar(balance))
      .freezeWith(client)
      // The alias must be authorised by the key it is derived from.
      .sign(privateKey);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const accountId = receipt.accountId;

    if (!accountId) {
      throw new Error(`Account ${i} was not created: ${receipt.status.toString()}`);
    }

    const evmAddress = "0x" + privateKey.publicKey.toEvmAddress();
    const name = unnumbered ? prefix : `${prefix}${i}`;
    created.push({ name, accountId, evmAddress });

    envEntries[`${name}_ID`] = accountId.toString();
    envEntries[`${name}_KEY`] = "0x" + privateKey.toStringRaw();

    console.log(`  ${name.toLowerCase()}`);
    console.log(`    Account ID  : ${accountId.toString()}`);
    console.log(`    EVM address : ${evmAddress}`);
    console.log(`    HashScan    : ${hashscanAccount(accountId.toString())}`);
  }

  updateEnvFile(envEntries);

  console.log(`\n✅ Wrote ${created.length} account(s) into .env`);
  console.log("   (.env is gitignored - these keys stay on local machine)");

  const after = await new AccountBalanceQuery()
    .setAccountId(operator.accountId)
    .execute(client);
  console.log(`\nOperator balance now ${after.hbars.toString()}`);

  client.close();
}

main().catch((err) => {
  console.error("\n❌ Account creation error:", err.message ?? err);
  process.exit(1);
});
