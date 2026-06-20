/**
 * Bitcoin Inscription Builder for Genesis Sparks
 *
 * Creates ordinal inscriptions for:
 * 1. Sprite Library (one-time, ~$15-50)
 * 2. On-Chain Renderer (one-time, ~$5-15)
 * 3. Individual NFTs (per mint, ~$0.50-2)
 *
 * Uses Charms protocol for state management.
 */

import * as bitcoin from "bitcoinjs-lib";
import { brotliCompressSync, constants } from "zlib";
import * as cbor from "cbor2";
import {
  generateRendererInscription,
  generateMinimalNFTInscription,
} from "./onchain-renderer";
import {
  generateLibraryInscription,
  GENESIS_SPARKS_LIBRARY,
} from "./sprite-library";

// =============================================================================
// TYPES
// =============================================================================

export interface InscriptionData {
  /** MIME content type */
  contentType: string;
  /** Raw content bytes */
  content: Uint8Array;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Optional content encoding (e.g. "br") */
  contentEncoding?: string;
  /** Optional parent inscription ID (txid:index / txidi0) for Parent-Child provenance */
  parentInscriptionId?: string;
}

export interface InscriptionResult {
  /** Inscription ID (txid:index) */
  inscriptionId: string;
  /** Transaction ID */
  txid: string;
  /** Output index */
  vout: number;
  /** Fee paid in sats */
  fee: number;
  /** Content size in bytes */
  size: number;
}

export interface InscriptionConfig {
  /** Bitcoin network */
  network: bitcoin.Network;
  /** Fee rate in sat/vB */
  feeRate: number;
  /** Destination address for inscription */
  destinationAddress: string;
  /** Funding UTXO */
  fundingUtxo: {
    txid: string;
    vout: number;
    value: number;
    scriptPubKey: string;
  };
}

export interface BatchInscriptionPlan {
  /** All inscriptions to create */
  inscriptions: Array<{
    name: string;
    type: "library" | "renderer" | "nft";
    data: InscriptionData;
    estimatedFee: number;
  }>;
  /** Total estimated fee in sats */
  totalFee: number;
  /** Total content size in bytes */
  totalSize: number;
  /** Estimated USD cost at current rates */
  estimatedCostUSD: number;
}

// =============================================================================
// UTILS & SERIALIZATION
// =============================================================================

/**
 * Serialize an inscription ID (txid:index or txidi0) to little-endian bytes representation
 * used in Tag 3 (Parent).
 */
export function serializeInscriptionId(inscriptionId: string): Buffer {
  const parts = inscriptionId.split("i");
  const txidHex = parts[0];
  const voutStr = parts[1] || "0";
  const vout = parseInt(voutStr, 10);

  const txidBuf = Buffer.from(txidHex, "hex");
  if (txidBuf.length !== 32) {
    throw new Error(`Invalid txid length in inscription ID: ${inscriptionId}`);
  }

  // Reverse txid (little-endian)
  const reversedTxid = Buffer.from(txidBuf).reverse();

  if (vout === 0) {
    return reversedTxid;
  }

  // Serialize vout to little-endian and remove trailing zeros
  const voutBuf = Buffer.alloc(4);
  voutBuf.writeUInt32LE(vout);

  // Find last non-zero byte
  let lastNonZero = 3;
  while (lastNonZero >= 0 && voutBuf[lastNonZero] === 0) {
    lastNonZero--;
  }

  const trimmedVout = voutBuf.slice(0, lastNonZero + 1);
  return Buffer.concat([reversedTxid, trimmedVout]);
}

// =============================================================================
// INSCRIPTION ENVELOPE
// =============================================================================

/**
 * Ordinals inscription envelope
 * Format: OP_FALSE OP_IF "ord" OP_1 <content-type> OP_0 <content> OP_ENDIF
 */
export function createInscriptionEnvelope(data: InscriptionData): Buffer {
  const parts: Buffer[] = [];

  // Protocol tag
  const ordTag = Buffer.from("ord");

  // Content type
  const contentType = Buffer.from(data.contentType);

  // Content (may be chunked for large data)
  const content = Buffer.from(data.content);

  // Build envelope script
  // OP_FALSE (0x00)
  parts.push(Buffer.from([0x00]));

  // OP_IF (0x63)
  parts.push(Buffer.from([0x63]));

  // Push "ord"
  parts.push(Buffer.from([ordTag.length]));
  parts.push(ordTag);

  // OP_1 for content-type field
  parts.push(Buffer.from([0x51]));

  // Push content type
  parts.push(pushData(contentType));

  // OP_9 for content-encoding field if present
  if (data.contentEncoding) {
    const encoding = Buffer.from(data.contentEncoding);
    parts.push(Buffer.from([0x59])); // OP_9
    parts.push(pushData(encoding));
  }

  // OP_3 for parent-inscription field if present
  if (data.parentInscriptionId) {
    const parentBytes = serializeInscriptionId(data.parentInscriptionId);
    parts.push(Buffer.from([0x53])); // OP_3 (0x53)
    parts.push(pushData(parentBytes));
  }

  // OP_5 for metadata if present (CBOR format)
  if (data.metadata) {
    const cborBytes = cbor.encode(data.metadata);
    parts.push(Buffer.from([0x55])); // OP_5 (0x55)
    parts.push(pushData(Buffer.from(cborBytes)));
  }

  // OP_0 for content field
  parts.push(Buffer.from([0x00]));

  // Push content (chunked if > 520 bytes)
  const chunks = chunkBuffer(content, 520);
  for (const chunk of chunks) {
    parts.push(pushData(chunk));
  }

  // OP_ENDIF (0x68)
  parts.push(Buffer.from([0x68]));

  return Buffer.concat(parts);
}

/**
 * Create push data opcode for buffer
 */
function pushData(data: Buffer): Buffer {
  if (data.length <= 75) {
    return Buffer.concat([Buffer.from([data.length]), data]);
  } else if (data.length <= 255) {
    return Buffer.concat([Buffer.from([0x4c, data.length]), data]);
  } else if (data.length <= 65535) {
    const len = Buffer.alloc(2);
    len.writeUInt16LE(data.length);
    return Buffer.concat([Buffer.from([0x4d]), len, data]);
  } else {
    const len = Buffer.alloc(4);
    len.writeUInt32LE(data.length);
    return Buffer.concat([Buffer.from([0x4e]), len, data]);
  }
}

/**
 * Chunk buffer into parts of max size
 */
function chunkBuffer(buffer: Buffer, maxSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < buffer.length; i += maxSize) {
    chunks.push(buffer.slice(i, Math.min(i + maxSize, buffer.length)));
  }
  return chunks;
}

// =============================================================================
// FEE ESTIMATION
// =============================================================================

/**
 * Estimate inscription fee
 */
export function estimateInscriptionFee(
  contentSize: number,
  feeRate: number,
): number {
  // Base transaction overhead (~150 vB)
  const baseTxSize = 150;

  // Witness data size (content + envelope overhead)
  // Envelope adds ~20 bytes overhead
  const witnessSize = contentSize + 20;

  // Witness discount (1/4 weight)
  const witnessWeight = witnessSize / 4;

  // Total virtual size
  const vsize = baseTxSize + witnessWeight;

  // Fee in sats
  return Math.ceil(vsize * feeRate);
}

/**
 * Estimate cost in USD
 */
export function estimateCostUSD(
  feeSats: number,
  btcPriceUSD: number = 100000,
): number {
  return (feeSats / 100_000_000) * btcPriceUSD;
}

// =============================================================================
// GENESIS BABIES INSCRIPTION PLAN
// =============================================================================

/**
 * Compress content using Brotli (quality 11)
 */
export function compressBrotli(content: Uint8Array): Uint8Array {
  return brotliCompressSync(Buffer.from(content), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
    },
  });
}

/**
 * Generate complete inscription plan for Genesis Sparks
 */
export function generateInscriptionPlan(options: {
  feeRate: number;
  btcPriceUSD?: number;
}): BatchInscriptionPlan {
  const { feeRate, btcPriceUSD = 100000 } = options;

  const inscriptions: BatchInscriptionPlan["inscriptions"] = [];
  let totalSize = 0;
  let totalFee = 0;

  // 1. Sprite Library
  const libraryData = generateLibraryInscription(GENESIS_SPARKS_LIBRARY);
  const libraryBytes = new TextEncoder().encode(libraryData.content);
  
  // Try Brotli compression
  const compressedLibrary = compressBrotli(libraryBytes);
  const useCompressedLibrary = compressedLibrary.length < libraryBytes.length;
  const finalLibraryBytes = useCompressedLibrary ? compressedLibrary : libraryBytes;
  const libraryFee = estimateInscriptionFee(finalLibraryBytes.length, feeRate);

  inscriptions.push({
    name: "Genesis Sparks Sprite Library",
    type: "library",
    data: {
      contentType: libraryData.contentType,
      content: finalLibraryBytes,
      contentEncoding: useCompressedLibrary ? "br" : undefined,
    },
    estimatedFee: libraryFee,
  });
  totalSize += finalLibraryBytes.length;
  totalFee += libraryFee;

  // 2. On-Chain Renderer
  const rendererData = generateRendererInscription({
    libraryInscriptionId: "LIBRARY_INSCRIPTION_ID", // Placeholder
    minify: true,
  });
  const rendererBytes = new TextEncoder().encode(rendererData.content);
  
  // Try Brotli compression
  const compressedRenderer = compressBrotli(rendererBytes);
  const useCompressedRenderer = compressedRenderer.length < rendererBytes.length;
  const finalRendererBytes = useCompressedRenderer ? compressedRenderer : rendererBytes;
  const rendererFee = estimateInscriptionFee(finalRendererBytes.length, feeRate);

  inscriptions.push({
    name: "Genesis Sparks Renderer",
    type: "renderer",
    data: {
      contentType: rendererData.contentType,
      content: finalRendererBytes,
      contentEncoding: useCompressedRenderer ? "br" : undefined,
    },
    estimatedFee: rendererFee,
  });
  totalSize += finalRendererBytes.length;
  totalFee += rendererFee;

  return {
    inscriptions,
    totalFee,
    totalSize,
    estimatedCostUSD: estimateCostUSD(totalFee, btcPriceUSD),
  };
}

/**
 * Generate inscription data for a single NFT
 */
export function generateNFTInscriptionData(params: {
  tokenId: number;
  dna: string;
  rendererInscriptionId: string;
}): InscriptionData {
  const nftData = generateMinimalNFTInscription(params);

  return {
    contentType: nftData.contentType,
    content: new TextEncoder().encode(nftData.content),
  };
}

// =============================================================================
// COMMIT-REVEAL TRANSACTION BUILDER
// =============================================================================

/**
 * Build commit transaction for inscription
 * Commits to the inscription content via P2TR
 */
export function buildCommitTransaction(
  config: InscriptionConfig,
  inscriptionData: InscriptionData,
  internalPubkey: Buffer,
): bitcoin.Psbt {
  const { network, fundingUtxo, destinationAddress, feeRate } = config;

  // Create inscription script
  const inscriptionScript = createInscriptionEnvelope(inscriptionData);

  // Create taproot script tree
  const leafScript = bitcoin.script.compile([
    internalPubkey,
    bitcoin.opcodes.OP_CHECKSIG,
    ...inscriptionScript,
  ]);

  // Calculate output amounts
  const inscriptionFee = estimateInscriptionFee(
    inscriptionData.content.length,
    feeRate,
  );
  const dustLimit = 546;
  const commitOutput = dustLimit + inscriptionFee;
  const change =
    fundingUtxo.value - commitOutput - estimateInscriptionFee(100, feeRate);

  // Build PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Add funding input
  psbt.addInput({
    hash: fundingUtxo.txid,
    index: fundingUtxo.vout,
    witnessUtxo: {
      script: Buffer.from(fundingUtxo.scriptPubKey, "hex"),
      value: fundingUtxo.value,
    },
  });

  // Add commit output (P2TR with script)
  // Note: Actual implementation would use proper taproot construction
  psbt.addOutput({
    address: destinationAddress,
    value: commitOutput,
  });

  // Add change output if sufficient
  if (change > dustLimit) {
    psbt.addOutput({
      address: destinationAddress,
      value: change,
    });
  }

  return psbt;
}

/**
 * Build reveal transaction that exposes inscription
 */
export function buildRevealTransaction(
  config: InscriptionConfig,
  commitTxid: string,
  commitVout: number,
  commitValue: number,
  inscriptionData: InscriptionData,
  internalPubkey: Buffer,
): bitcoin.Psbt {
  const { network, destinationAddress, feeRate } = config;

  const revealFee = estimateInscriptionFee(
    inscriptionData.content.length,
    feeRate,
  );
  const dustLimit = 546;

  const psbt = new bitcoin.Psbt({ network });

  // Add commit output as input
  psbt.addInput({
    hash: commitTxid,
    index: commitVout,
    witnessUtxo: {
      script: Buffer.alloc(0), // Would be actual script
      value: commitValue,
    },
    tapLeafScript: [
      {
        leafVersion: 0xc0,
        script: createInscriptionEnvelope(inscriptionData),
        controlBlock: Buffer.alloc(33), // Would be actual control block
      },
    ],
  });

  // Add inscription output
  psbt.addOutput({
    address: destinationAddress,
    value: Math.max(dustLimit, commitValue - revealFee),
  });

  return psbt;
}

// =============================================================================
// BATCH INSCRIPTION HELPER
// =============================================================================

/**
 * Inscription order for Genesis Sparks deployment
 */
export const INSCRIPTION_ORDER = [
  { step: 1, type: "library", description: "Inscribe sprite library (~15KB)" },
  { step: 2, type: "renderer", description: "Inscribe HTML renderer (~5KB)" },
  { step: 3, type: "collection", description: "Create collection inscription" },
  {
    step: 4,
    type: "nfts",
    description: "Inscribe individual NFTs (~50 bytes each)",
  },
] as const;

/**
 * Get deployment summary
 */
export function getDeploymentSummary(feeRate: number = 10): {
  steps: typeof INSCRIPTION_ORDER;
  estimates: {
    libraryFee: number;
    rendererFee: number;
    perNFTFee: number;
    totalInfrastructureFee: number;
    estimatedInfrastructureUSD: number;
    estimatedPerNFTUSD: number;
  };
} {
  // Estimate sizes
  const librarySizeBytes = 15000; // ~15KB
  const rendererSizeBytes = 5000; // ~5KB
  const nftSizeBytes = 100; // ~100 bytes

  const libraryFee = estimateInscriptionFee(librarySizeBytes, feeRate);
  const rendererFee = estimateInscriptionFee(rendererSizeBytes, feeRate);
  const perNFTFee = estimateInscriptionFee(nftSizeBytes, feeRate);
  const totalInfrastructureFee = libraryFee + rendererFee;

  return {
    steps: INSCRIPTION_ORDER,
    estimates: {
      libraryFee,
      rendererFee,
      perNFTFee,
      totalInfrastructureFee,
      estimatedInfrastructureUSD: estimateCostUSD(totalInfrastructureFee),
      estimatedPerNFTUSD: estimateCostUSD(perNFTFee),
    },
  };
}
