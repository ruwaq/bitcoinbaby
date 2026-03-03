/**
 * Charms Protocol Types (v10)
 *
 * Core types for Charms protocol integration.
 * Based on official Charms documentation and BRO reference implementation.
 *
 * Protocol Version History:
 * - v2: Initial implementation
 * - v7: BRO token launch
 * - v10: Current (January 2026, SP1 v4.0.1)
 */

import {
  type ScrollsNetwork,
  type NetworkEndpoints,
  NETWORK_ENDPOINTS,
} from "../types";

// =============================================================================
// NETWORK & CONFIG (Re-export from shared types)
// =============================================================================

/** @deprecated Use ScrollsNetwork from ../types instead */
export type CharmsNetwork = ScrollsNetwork;

export interface CharmsConfig {
  network: ScrollsNetwork;
  scrollsUrl: string;
  mempoolUrl: string;
}

export interface ScrollsConfigResponse {
  fee_address: {
    main: string;
    testnet4: string;
  };
  fee_per_input: number;
  fee_basis_points: number;
  fixed_cost: number;
}

// =============================================================================
// SPELL FORMAT (v2)
// =============================================================================

/**
 * Charms Spell v2 format
 * Reference: https://docs.charms.dev/references/spell-json/
 */
export interface SpellV2 {
  version: 2;
  apps: Record<string, string>; // "$00" -> "n/<app_id>/<vk>" or "t/<app_id>/<vk>"
  public_inputs?: Record<string, unknown>;
  private_inputs?: Record<string, unknown>;
  ins: SpellV2Input[];
  outs: SpellV2Output[];
}

export interface SpellV2Input {
  utxo_id: string; // "txid:vout"
  charms: Record<string, unknown>; // "$00" -> state object or amount
}

export interface SpellV2Output {
  address: string;
  charms: Record<string, unknown>;
  sats: number;
}

// =============================================================================
// SPELL FORMAT (v10 - Current Protocol Version)
// =============================================================================

/**
 * Charms Spell v10 format (Current - January 2026)
 * Reference: https://docs.charms.dev/references/spell-json/
 *
 * Key changes from v2:
 * - private_inputs for Merkle proofs (tx_block_proof)
 * - SP1 zkVM proof format
 * - Updated app reference format
 */
export interface SpellV10 {
  version: 10;
  apps: Record<string, string>; // "$00" -> "n/<app_id>/<vk>" or "t/<app_id>/<vk>"
  private_inputs?: Record<
    string,
    {
      tx?: string; // Mining transaction hex
      tx_block_proof?: string; // Merkle block proof hex
    }
  >;
  ins: SpellV10Input[];
  outs: SpellV10Output[];
}

export interface SpellV10Input {
  utxo_id: string; // "txid:vout"
  charms: Record<string, unknown>; // "$00" -> state object or amount (number)
}

export interface SpellV10Output {
  address: string;
  charms: Record<string, unknown>;
  sats?: number; // Optional, defaults to DUST_LIMIT (546)
}

/**
 * Mining private inputs for token minting
 * Required to prove the mining transaction was included in a block
 */
export interface MiningPrivateInputs {
  /** Raw hex of the mining transaction */
  tx: string;
  /** Merkle block proof in hex format */
  tx_block_proof: string;
}

/**
 * Parameters for creating a mining mint spell
 */
export interface MiningMintSpellParams {
  /** App ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** Mining transaction hex */
  miningTxHex: string;
  /** Merkle proof hex */
  merkleProofHex: string;
  /** UTXO from mining transaction to consume */
  miningUtxo: {
    txid: string;
    vout: number;
  };
  /** Recipient address for minted tokens */
  minerAddress: string;
  /** Amount of tokens to mint (in base units) */
  mintAmount: bigint;
}

/**
 * Current spell type alias (points to latest version)
 */
export type Spell = SpellV10;
export type SpellInput = SpellV10Input;
export type SpellOutput = SpellV10Output;

/**
 * App type prefix
 * - "n/" = Non-fungible (NFT)
 * - "t/" = Token (fungible)
 */
export type AppType = "n" | "t";

export interface AppReference {
  type: AppType;
  appId: string;
  verificationKey: string;
}

/**
 * Parse app reference from string like "n/<app_id>/<vk>"
 */
export function parseAppReference(ref: string): AppReference {
  const parts = ref.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid app reference: ${ref}`);
  }

  const type = parts[0] as AppType;
  if (type !== "n" && type !== "t") {
    throw new Error(`Invalid app type: ${type}`);
  }

  return {
    type,
    appId: parts[1],
    verificationKey: parts[2],
  };
}

/**
 * Create app reference string
 */
export function createAppReference(
  type: AppType,
  appId: string,
  vk: string,
): string {
  return `${type}/${appId}/${vk}`;
}

// =============================================================================
// CHARM DATA
// =============================================================================

/**
 * Extracted charm from a transaction
 */
export interface ExtractedCharm {
  appId: string;
  appType: AppType;
  amount: bigint;
  txid: string;
  vout: number;
  address: string;
  ticker?: string;
  name?: string;
  state?: Record<string, unknown>;
}

/**
 * Charm balance for an address
 */
export interface CharmBalance {
  ticker: string;
  appId: string;
  appType: AppType;
  balance: bigint;
  utxos: CharmUTXOInfo[];
}

export interface CharmUTXOInfo {
  txid: string;
  vout: number;
  amount: bigint;
  state?: Record<string, unknown>;
}

// =============================================================================
// TRANSACTION BUILDING
// =============================================================================

export interface CharmTransactionParams {
  spell: SpellV2;
  fundingUtxos: FundingUTXO[];
  feeRate: number;
  changeAddress: string;
}

export interface FundingUTXO {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
}

export interface CharmTransaction {
  psbt: string;
  spell: SpellV2;
  estimatedFee: number;
  scrollsFee: number;
}

// =============================================================================
// SIGNING
// =============================================================================

export interface ScrollsSignRequest {
  sign_inputs: ScrollsSignInput[];
  prev_txs: string[];
  tx_to_sign: string;
}

export interface ScrollsSignInput {
  index: number;
  nonce: bigint;
}

export interface SignedCharmTransaction {
  txHex: string;
  txid: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DUST_LIMIT = 546;

/** Current Charms protocol version */
export const CHARMS_PROTOCOL_VERSION = 10;

/** Minimum sats for spell outputs */
export const MIN_SPELL_OUTPUT_SATS = 700;

// =============================================================================
// SPELL CREATION HELPERS (v10)
// =============================================================================

/**
 * Create a token mint spell for mining rewards (v10 format)
 */
export function createMiningMintSpellV10(
  params: MiningMintSpellParams,
): SpellV10 {
  const appRef = createAppReference("t", params.appId, params.appVk);

  return {
    version: 10,
    apps: {
      $01: appRef,
    },
    private_inputs: {
      $01: {
        tx: params.miningTxHex,
        tx_block_proof: params.merkleProofHex,
      },
    },
    ins: [
      {
        utxo_id: `${params.miningUtxo.txid}:${params.miningUtxo.vout}`,
        charms: {}, // No input charms for mint
      },
    ],
    outs: [
      {
        address: params.minerAddress,
        charms: {
          $01: Number(params.mintAmount), // Token amount as number
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
    ],
  };
}

/**
 * Create a token transfer spell (v10 format)
 */
export function createTokenTransferSpellV10(params: {
  appId: string;
  appVk: string;
  fromUtxo: { txid: string; vout: number };
  fromAmount: bigint;
  toAddress: string;
  toAmount: bigint;
  changeAddress: string;
}): SpellV10 {
  const appRef = createAppReference("t", params.appId, params.appVk);
  const changeAmount = params.fromAmount - params.toAmount;

  const outs: SpellV10Output[] = [
    {
      address: params.toAddress,
      charms: {
        $01: Number(params.toAmount),
      },
      sats: DUST_LIMIT,
    },
  ];

  if (changeAmount > 0n) {
    outs.push({
      address: params.changeAddress,
      charms: {
        $01: Number(changeAmount),
      },
      sats: DUST_LIMIT,
    });
  }

  return {
    version: 10,
    apps: {
      $01: appRef,
    },
    ins: [
      {
        utxo_id: `${params.fromUtxo.txid}:${params.fromUtxo.vout}`,
        charms: {
          $01: Number(params.fromAmount),
        },
      },
    ],
    outs,
  };
}

/** @deprecated Use NETWORK_ENDPOINTS from ../types instead */
export const SCROLLS_URLS: Record<ScrollsNetwork, string> = {
  main: NETWORK_ENDPOINTS.mainnet.scrollsApi,
  testnet4: NETWORK_ENDPOINTS.testnet4.scrollsApi,
};

/** @deprecated Use NETWORK_ENDPOINTS from ../types instead */
export const MEMPOOL_URLS: Record<ScrollsNetwork, string> = {
  main: NETWORK_ENDPOINTS.mainnet.mempoolApi,
  testnet4: NETWORK_ENDPOINTS.testnet4.mempoolApi,
};

// =============================================================================
// BATCH TRANSFER (Withdrawal Pool)
// =============================================================================

/**
 * Batch transfer recipient
 */
export interface BatchRecipient {
  address: string;
  amount: bigint;
}

/**
 * Batch transfer parameters for withdrawal pool
 */
export interface BatchTransferParams {
  /** App ID (BABTC token) */
  appId: string;
  /** Verification key */
  appVk: string;
  /** Source UTXOs with tokens */
  sourceUtxos: Array<{
    txid: string;
    vout: number;
    amount: bigint;
  }>;
  /** Recipients and amounts */
  recipients: BatchRecipient[];
  /** Change address for remaining tokens */
  changeAddress: string;
}

/**
 * Create a batch token transfer spell (v10 format)
 *
 * Used by the withdrawal pool to send tokens to multiple recipients
 * in a single transaction, minimizing fees.
 */
export function createBatchTransferSpellV10(
  params: BatchTransferParams,
): SpellV10 {
  const appRef = createAppReference("t", params.appId, params.appVk);

  // Calculate total input amount
  const totalInput = params.sourceUtxos.reduce(
    (sum, utxo) => sum + utxo.amount,
    0n,
  );

  // Calculate total output amount
  const totalOutput = params.recipients.reduce((sum, r) => sum + r.amount, 0n);

  // Validate amounts
  if (totalOutput > totalInput) {
    throw new Error(
      `Insufficient token balance: have ${totalInput}, need ${totalOutput}`,
    );
  }

  const changeAmount = totalInput - totalOutput;

  // Build inputs
  const ins: SpellV10Input[] = params.sourceUtxos.map((utxo) => ({
    utxo_id: `${utxo.txid}:${utxo.vout}`,
    charms: {
      $01: Number(utxo.amount),
    },
  }));

  // Build outputs - one per recipient
  const outs: SpellV10Output[] = params.recipients.map((recipient) => ({
    address: recipient.address,
    charms: {
      $01: Number(recipient.amount),
    },
    sats: DUST_LIMIT,
  }));

  // Add change output if there's any
  if (changeAmount > 0n) {
    outs.push({
      address: params.changeAddress,
      charms: {
        $01: Number(changeAmount),
      },
      sats: DUST_LIMIT,
    });
  }

  return {
    version: 10,
    apps: {
      $01: appRef,
    },
    ins,
    outs,
  };
}
