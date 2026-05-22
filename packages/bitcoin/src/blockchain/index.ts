/**
 * Blockchain Module
 *
 * Clients for interacting with Bitcoin blockchain data providers.
 */

// Types
export type {
  UTXO,
  AddressBalance,
  TransactionInfo,
  FeeEstimates,
  BlockchainAPI,
  BlockInfo,
} from "./types";

// Mempool.space client
export {
  MempoolClient,
  MempoolAPIError,
  createMempoolClient,
  type MempoolClientOptions,
} from "./mempool";

export { MockMempoolClient } from "./mock-mempool";

// Merkle proof utilities
export {
  // Types
  type MerkleProof,
  type BlockHeader,
  type EncodedMerkleProof,
  // Core functions
  doubleSha256,
  reverseHex,
  buildMerkleTree,
  extractMerklePath,
  verifyMerkleProof,
  // Proof fetching
  getMerkleProof,
  encodeMerkleProofHex,
  getEncodedMerkleProof,
  // Mining utilities
  countLeadingZeroBits,
  computeMiningHash,
  calculateMiningReward as calculateMerkleReward,
} from "./merkle";
