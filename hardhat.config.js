/**
 * Hardhat config - compile-only setup.
 *
 * This project does NOT use Hardhat to deploy. Deployment goes through the
 * Hedera JS SDK in deploy-voting.js, which reads the artifact JSON that Hardhat
 * writes to ./artifacts/contracts/<File>.sol/<Contract>.json.
 *
 * So there is deliberately no `networks` block here: Hedera speaks gRPC, not
 * the JSON-RPC that Hardhat's network config expects.
 */

/** @type {import("hardhat/config").HardhatUserConfig} */
export default {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        // Keeps bytecode under the 24 KB contract size limit that Hedera
        // enforces just like Ethereum. 200 runs is the usual default.
        enabled: true,
        runs: 200,
      },
      // solc 0.8.28 defaults to "cancun". Hedera's EVM tracks upstream but
      // lags it, so "shanghai" is the safe target: it still gives PUSH0
      // without risking transient storage (TSTORE/TLOAD) or MCOPY opcodes
      // that the network may not have enabled yet.
      evmVersion: "shanghai",
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
  },
};
