/**
 * Merkle Proof Module
 *
 * Implements Merkle tree proof construction for Bitcoin transactions.
 * Required by Charms protocol to prove transaction inclusion in blocks.
 *
 * Reference: BRO token implementation
 */

import { sha256 } from "@noble/hashes/sha256";
import type { BlockchainAPI } from "./types";
import { minedAmountBro } from "../charms/bro-reward";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Merkle proof for transaction inclusion in a block
 */
export interface MerkleProof {
  /** Transaction ID */
  txid: string;
  /** Block hash containing the transaction */
  blockHash: string;
  /** Block height */
  blockHeight: number;
  /** Merkle root from block header */
  merkleRoot: string;
  /** Merkle path (sibling hashes) */
  merklePath: string[];
  /** Transaction index in block */
  txIndex: number;
}

/**
 * Block header structure
 */
export interface BlockHeader {
  version: number;
  previousBlockHash: string;
  merkleRoot: string;
  time: number;
  bits: string;
  nonce: number;
}

/**
 * Encoded proof for Charms protocol
 */
export interface EncodedMerkleProof {
  /** Raw hex for tx_block_proof field */
  hex: string;
  /** Original proof data */
  proof: MerkleProof;
}

// =============================================================================
// MERKLE TREE UTILITIES
// =============================================================================

/**
 * Double SHA256 hash (Bitcoin standard)
 */
export function doubleSha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reverse byte order (Bitcoin uses little-endian for txids)
 */
function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes).reverse();
}

/**
 * Reverse a hex string (for txid conversion)
 */
export function reverseHex(hex: string): string {
  return bytesToHex(reverseBytes(hexToBytes(hex)));
}

/**
 * Compute Merkle parent hash from two child hashes
 */
function computeMerkleParent(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(64);
  combined.set(left, 0);
  combined.set(right, 32);
  return doubleSha256(combined);
}

/**
 * Build Merkle tree from transaction IDs
 * Returns array of levels (level 0 = leaves, last level = root)
 */
export function buildMerkleTree(txids: string[]): string[][] {
  if (txids.length === 0) {
    throw new Error("Cannot build Merkle tree from empty txids");
  }

  // Convert txids to internal byte order (reversed)
  const leaves = txids.map((txid) => reverseHex(txid));

  const levels: string[][] = [leaves];
  let currentLevel = leaves;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = hexToBytes(currentLevel[i]);
      // If odd number of nodes, duplicate the last one
      const right =
        i + 1 < currentLevel.length
          ? hexToBytes(currentLevel[i + 1])
          : hexToBytes(currentLevel[i]);

      const parent = computeMerkleParent(left, right);
      nextLevel.push(bytesToHex(parent));
    }

    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return levels;
}

/**
 * Extract Merkle proof path for a specific transaction
 */
export function extractMerklePath(
  txids: string[],
  targetTxid: string,
): { path: string[]; index: number } {
  // Find index of target transaction
  const index = txids.findIndex((txid) => txid === targetTxid);
  if (index === -1) {
    throw new Error(`Transaction ${targetTxid} not found in block`);
  }

  const tree = buildMerkleTree(txids);
  const path: string[] = [];

  let currentIndex = index;

  // Traverse from leaves to root
  for (let level = 0; level < tree.length - 1; level++) {
    const levelNodes = tree[level];

    // Determine sibling index
    const siblingIndex =
      currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

    // Add sibling to path (or self if no sibling)
    if (siblingIndex < levelNodes.length) {
      // Convert back to display format (reversed)
      path.push(reverseHex(levelNodes[siblingIndex]));
    } else {
      // Duplicate case - add self
      path.push(reverseHex(levelNodes[currentIndex]));
    }

    // Move to parent index
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { path, index };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(
  txid: string,
  merkleRoot: string,
  path: string[],
  index: number,
): boolean {
  // Start with txid in internal byte order
  let current = hexToBytes(reverseHex(txid));

  for (let i = 0; i < path.length; i++) {
    const sibling = hexToBytes(reverseHex(path[i]));
    const isRight = (index >> i) & 1;

    if (isRight) {
      current = computeMerkleParent(sibling, current);
    } else {
      current = computeMerkleParent(current, sibling);
    }
  }

  // Compare with merkle root (in internal byte order)
  const computedRoot = reverseHex(bytesToHex(current));
  return computedRoot === merkleRoot;
}

// =============================================================================
// PROOF FETCHING
// =============================================================================

/**
 * Fetch Merkle proof for a confirmed transaction
 */
export async function getMerkleProof(
  mempoolClient: BlockchainAPI,
  txid: string,
): Promise<MerkleProof> {
  // Get transaction info to find block
  const txInfo = await mempoolClient.getTransaction(txid);

  if (!txInfo.status.confirmed) {
    throw new Error(`Transaction ${txid} is not confirmed yet`);
  }

  const blockHash = txInfo.status.block_hash;
  const blockHeight = txInfo.status.block_height;

  if (!blockHash || !blockHeight) {
    throw new Error(`Transaction ${txid} missing block information`);
  }

  // Get all txids in the block
  const blockTxids = await mempoolClient.getBlockTxids(blockHash);

  // Extract Merkle path
  const { path, index } = extractMerklePath(blockTxids, txid);

  // Get block header for merkle root
  const blockInfo = await mempoolClient.getBlock(blockHash);

  return {
    txid,
    blockHash,
    blockHeight,
    merkleRoot: blockInfo.merkle_root,
    merklePath: path,
    txIndex: index,
  };
}

/**
 * Encode a varint (Bitcoin compact size encoding)
 */
function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) {
    return new Uint8Array([n]);
  } else if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    return buf;
  } else if (n <= 0xffffffff) {
    const buf = new Uint8Array(5);
    buf[0] = 0xfe;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    buf[3] = (n >> 16) & 0xff;
    buf[4] = (n >> 24) & 0xff;
    return buf;
  } else {
    throw new Error("VarInt too large");
  }
}

/**
 * Write uint32 little-endian
 */
function writeUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = n & 0xff;
  buf[1] = (n >> 8) & 0xff;
  buf[2] = (n >> 16) & 0xff;
  buf[3] = (n >> 24) & 0xff;
  return buf;
}

/**
 * Build partial Merkle tree flags for a single transaction proof
 * Returns the hashes and flags needed for MerkleBlock format
 */
function buildPartialMerkleTree(
  txids: string[],
  targetIndex: number,
): { hashes: string[]; flags: number[] } {
  const n = txids.length;
  const hashes: string[] = [];
  const flags: number[] = [];

  // Build tree height
  let height = 0;
  while (1 << height < n) height++;

  function traverse(level: number, pos: number): string {
    // Calculate if this node is on the path to target
    const levelWidth = 1 << (height - level);
    const startIdx = pos * levelWidth;

    const isOnPath =
      targetIndex >= startIdx && targetIndex < startIdx + levelWidth;

    if (level === height) {
      // Leaf node
      flags.push(isOnPath ? 1 : 0);
      if (isOnPath) {
        // This is the target leaf - include hash
        hashes.push(reverseHex(txids[pos]));
      } else if (pos < n) {
        // Non-target leaf - include hash
        hashes.push(reverseHex(txids[pos]));
      }
      return pos < n ? reverseHex(txids[pos]) : "";
    }

    // Internal node
    const leftChildPos = pos * 2;
    const rightChildPos = pos * 2 + 1;
    const rightChildStart = startIdx + levelWidth / 2;

    if (isOnPath) {
      // Node is on path - we need to descend
      flags.push(1);

      const leftHash = traverse(level + 1, leftChildPos);
      const hasRight = rightChildStart < n;
      const rightHash = hasRight
        ? traverse(level + 1, rightChildPos)
        : leftHash;

      // Compute parent hash
      const combined = new Uint8Array(64);
      combined.set(hexToBytes(leftHash), 0);
      combined.set(hexToBytes(rightHash), 32);
      return bytesToHex(doubleSha256(combined));
    } else {
      // Node not on path - include its hash directly
      flags.push(0);

      // Compute this node's hash
      const leftHash = computeSubtreeHash(
        txids,
        level + 1,
        leftChildPos,
        height,
        n,
      );
      const hasRight = rightChildStart < n;
      const rightHash = hasRight
        ? computeSubtreeHash(txids, level + 1, rightChildPos, height, n)
        : leftHash;

      const combined = new Uint8Array(64);
      combined.set(hexToBytes(leftHash), 0);
      combined.set(hexToBytes(rightHash), 32);
      const hash = bytesToHex(doubleSha256(combined));

      hashes.push(hash);
      return hash;
    }
  }

  function computeSubtreeHash(
    txids: string[],
    level: number,
    pos: number,
    maxHeight: number,
    n: number,
  ): string {
    const levelWidth = 1 << (maxHeight - level);
    const startIdx = pos * levelWidth;

    if (level === maxHeight) {
      return pos < n ? reverseHex(txids[pos]) : "";
    }

    const leftHash = computeSubtreeHash(
      txids,
      level + 1,
      pos * 2,
      maxHeight,
      n,
    );
    const rightStart = startIdx + levelWidth / 2;
    const rightHash =
      rightStart < n
        ? computeSubtreeHash(txids, level + 1, pos * 2 + 1, maxHeight, n)
        : leftHash;

    const combined = new Uint8Array(64);
    combined.set(hexToBytes(leftHash), 0);
    combined.set(hexToBytes(rightHash), 32);
    return bytesToHex(doubleSha256(combined));
  }

  traverse(0, 0);

  return { hashes, flags };
}

/**
 * Encode Merkle proof for Charms tx_block_proof field
 *
 * Format: Bitcoin MerkleBlock (BIP37 style):
 * - Block header (80 bytes)
 * - total_transactions (4 bytes uint32 LE)
 * - hash_count (varint)
 * - hashes (32 bytes each, little-endian)
 * - flag_byte_count (varint)
 * - flags (bit-packed, LSB first)
 */
export function encodeMerkleProofHex(
  proof: MerkleProof,
  blockInfo: {
    version: number;
    previousblockhash: string;
    merkle_root: string;
    timestamp: number;
    bits: number;
    nonce: number;
    tx_count: number;
  },
  txids: string[],
): string {
  const parts: Uint8Array[] = [];

  // 1. Block header (80 bytes)
  // Version (4 bytes LE)
  parts.push(writeUint32LE(blockInfo.version));

  // Previous block hash (32 bytes, internal byte order)
  parts.push(hexToBytes(reverseHex(blockInfo.previousblockhash)));

  // Merkle root (32 bytes, internal byte order)
  parts.push(hexToBytes(reverseHex(blockInfo.merkle_root)));

  // Timestamp (4 bytes LE)
  parts.push(writeUint32LE(blockInfo.timestamp));

  // Bits (4 bytes LE)
  parts.push(writeUint32LE(blockInfo.bits));

  // Nonce (4 bytes LE)
  parts.push(writeUint32LE(blockInfo.nonce));

  // 2. Total transactions in block (4 bytes LE)
  parts.push(writeUint32LE(blockInfo.tx_count));

  // 3. Build partial Merkle tree
  const { hashes, flags } = buildPartialMerkleTree(txids, proof.txIndex);

  // Hash count (varint)
  parts.push(encodeVarInt(hashes.length));

  // Hashes (32 bytes each)
  for (const hash of hashes) {
    parts.push(hexToBytes(hash));
  }

  // 4. Flags
  // Pack flags into bytes (8 flags per byte, LSB first)
  const flagBytes: number[] = [];
  for (let i = 0; i < flags.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < flags.length; j++) {
      byte |= flags[i + j] << j;
    }
    flagBytes.push(byte);
  }

  // Flag byte count (varint)
  parts.push(encodeVarInt(flagBytes.length));

  // Flag bytes
  parts.push(new Uint8Array(flagBytes));

  // Combine all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return bytesToHex(result);
}

/**
 * Get encoded Merkle proof ready for Charms spell
 */
export async function getEncodedMerkleProof(
  mempoolClient: BlockchainAPI,
  txid: string,
): Promise<EncodedMerkleProof> {
  // Get transaction info to find block
  const txInfo = await mempoolClient.getTransaction(txid);

  if (!txInfo.status.confirmed) {
    throw new Error(`Transaction ${txid} is not confirmed yet`);
  }

  const blockHash = txInfo.status.block_hash;
  const blockHeight = txInfo.status.block_height;

  if (!blockHash || !blockHeight) {
    throw new Error(`Transaction ${txid} missing block information`);
  }

  // Get block info and txids
  const [blockInfo, blockTxids] = await Promise.all([
    mempoolClient.getBlock(blockHash),
    mempoolClient.getBlockTxids(blockHash),
  ]);

  // Find tx index and extract Merkle path
  const txIndex = blockTxids.findIndex((t) => t === txid);
  if (txIndex === -1) {
    throw new Error(`Transaction ${txid} not found in block ${blockHash}`);
  }

  const { path } = extractMerklePath(blockTxids, txid);

  const proof: MerkleProof = {
    txid,
    blockHash,
    blockHeight,
    merkleRoot: blockInfo.merkle_root,
    merklePath: path,
    txIndex,
  };

  // Encode as Bitcoin MerkleBlock format
  const hex = encodeMerkleProofHex(proof, blockInfo, blockTxids);

  return {
    hex,
    proof,
  };
}

// =============================================================================
// MINING PROOF UTILITIES
// =============================================================================

/**
 * Count leading zero bits in a hash
 * Used for PoW difficulty verification
 */
export function countLeadingZeroBits(hash: Uint8Array): number {
  for (let i = 0; i < hash.length; i++) {
    if (hash[i] === 0) {
      continue;
    }
    // Found first non-zero byte, count leading zeros in it
    return i * 8 + Math.clz32(hash[i]) - 24;
  }
  return hash.length * 8;
}

/**
 * Compute mining hash (double SHA256 of challenge + nonce)
 */
export function computeMiningHash(
  challengeTxid: string,
  challengeVout: number,
  nonce: string,
): Uint8Array {
  const input = `${challengeTxid}:${challengeVout}${nonce}`;
  return doubleSha256(new TextEncoder().encode(input));
}

/**
 * Calculate mining reward based on leading zeros and block time.
 *
 * Delegates to the canonical BRO formula in `charms/bro-reward.ts`
 * (single source of truth). This thin wrapper is kept for backwards
 * compatibility with the `(leadingZeros, blockTime, startTime, halvingPeriod)`
 * signature and passes `startTime` / `halvingPeriodSeconds` straight through.
 *
 * Based on BRO token formula: DENOMINATION · clz² / 2^halvings.
 */
export function calculateMiningReward(
  leadingZeros: number,
  blockTime: number,
  startTime: number,
  halvingPeriodSeconds: number = 14 * 24 * 3600, // 14 days default
): bigint {
  return minedAmountBro(
    leadingZeros,
    blockTime,
    halvingPeriodSeconds,
    startTime,
  );
}
