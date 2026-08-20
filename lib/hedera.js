/**
 * Shared helpers for the voting scripts.
 *
 * deploy.js and call.js are left as the course provided them (apart from the
 * private-key parsing fix); everything new shares the helpers below.
 */

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { keccak256 } from "js-sha3";
import {
  Client,
  PrivateKey,
  AccountId,
  Hbar,
  TransactionRecordQuery,
} from "@hashgraph/sdk";

export const ARTIFACT_PATH = "artifacts/contracts/Voting.sol/Voting.json";

/* ------------------------------------------------------------------ */
/* Keys and accounts                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a private key that is either DER-encoded or a raw hex string.
 *
 * Note: do NOT try fromStringDer() first and fall back when it throws. Given a
 * raw 32-byte hex key it does not throw -- it silently returns an ED25519 key,
 * which for a HEX ECDSA key from the Hedera Portal is the wrong key entirely
 * and makes every transaction fail with INVALID_SIGNATURE.
 */
export function parsePrivateKey(raw) {
  const trimmed = raw.trim();
  const hex = trimmed.replace(/^0x/i, "");

  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return PrivateKey.fromStringECDSA(hex);
  }
  return PrivateKey.fromStringDer(trimmed);
}

/**
 * Load a named account from the environment.
 * "operator" reads HEDERA_OPERATOR_ID/KEY, "voter1" reads VOTER1_ID/KEY, etc.
 */
export function loadAccount(label) {
  const prefix = label === "operator" ? "HEDERA_OPERATOR" : label.toUpperCase();
  const id = process.env[`${prefix}_ID`];
  const key = process.env[`${prefix}_KEY`];

  if (!id || !key) {
    let hint;
    if (label === "operator") {
      hint = "Fill in .env from .env.example.";
    } else if (label === "admin") {
      hint = "Run: node create-accounts.js --prefix ADMIN --count 1";
    } else {
      hint = "Run: node create-accounts.js";
    }
    throw new Error(`Missing ${prefix}_ID / ${prefix}_KEY in .env. ${hint}`);
  }

  const privateKey = parsePrivateKey(key);
  return {
    label,
    accountId: AccountId.fromString(id),
    privateKey,
    // ECDSA accounts created with an alias use this as msg.sender on-chain.
    evmAddress: "0x" + privateKey.publicKey.toEvmAddress(),
  };
}

/** Load every VOTERn_* account present in .env, in order. */
export function loadVoters() {
  const voters = [];
  for (let i = 1; process.env[`VOTER${i}_ID`]; i++) {
    voters.push(loadAccount(`voter${i}`));
  }
  return voters;
}

/** A Testnet client operated by the given account. */
export function makeClient(account) {
  const client = Client.forTestnet();
  client.setOperator(account.accountId, account.privateKey);
  client.setDefaultMaxTransactionFee(new Hbar(20));
  return client;
}

/* ------------------------------------------------------------------ */
/* Custom error decoding                                               */
/* ------------------------------------------------------------------ */

/**
 * Build { selector -> signature } for every custom error in the ABI, so a
 * revert can be reported by name instead of as an opaque failure.
 */
export function loadErrorSelectors(artifactPath = ARTIFACT_PATH) {
  const artifact = JSON.parse(fs.readFileSync(path.resolve(artifactPath), "utf8"));
  const selectors = {};

  for (const entry of artifact.abi) {
    if (entry.type !== "error") continue;
    const signature = `${entry.name}(${entry.inputs.map((i) => i.type).join(",")})`;
    selectors["0x" + keccak256(signature).slice(0, 8)] = signature;
  }
  return selectors;
}

/** Turn raw revert data into a readable cause. */
export function explainRevert(errorMessage, selectors) {
  if (!errorMessage) return "reverted (no revert data returned)";

  const hex = errorMessage.startsWith("0x") ? errorMessage : "0x" + errorMessage;
  const selector = hex.slice(0, 10).toLowerCase();

  if (selectors[selector]) return selectors[selector];

  // Standard require("...") string revert.
  if (selector === "0x08c379a0") {
    try {
      const body = hex.slice(10);
      const length = parseInt(body.slice(64, 128), 16);
      const text = Buffer.from(body.slice(128, 128 + length * 2), "hex").toString("utf8");
      return `Error("${text}")`;
    } catch {
      return "Error(string) (could not decode)";
    }
  }
  return `reverted with unrecognised data ${selector}`;
}

/**
 * Fetch the revert data for a transaction that failed.
 * getReceipt() throws on a revert, so the record has to be re-queried with
 * receipt validation switched off.
 */
export async function fetchRevertReason(client, transactionId, selectors) {
  try {
    const record = await new TransactionRecordQuery()
      .setTransactionId(transactionId)
      .setValidateReceiptStatus(false)
      .execute(client);

    return explainRevert(record.contractFunctionResult?.errorMessage, selectors);
  } catch (err) {
    return `could not read revert reason (${err.message ?? err})`;
  }
}

/* ------------------------------------------------------------------ */
/* .env maintenance                                                    */
/* ------------------------------------------------------------------ */

/** Insert or replace keys in .env, leaving everything else untouched. */
export function updateEnvFile(entries, envPath = ".env") {
  const resolved = path.resolve(envPath);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";

  let lines = existing.split(/\r?\n/);
  for (const key of Object.keys(entries)) {
    lines = lines.filter((line) => !line.trim().startsWith(`${key}=`));
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  lines.push("");
  for (const [key, value] of Object.entries(entries)) {
    lines.push(`${key}=${value}`);
  }
  lines.push("");

  fs.writeFileSync(resolved, lines.join("\n"), "utf8");
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function hashscanContract(contractId) {
  return `https://hashscan.io/testnet/contract/${contractId}`;
}

export function hashscanAccount(accountId) {
  return `https://hashscan.io/testnet/account/${accountId}`;
}

/** Minimal --flag value parser. */
export function flags(argv) {
  const out = {};
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith("--")) continue;
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}
