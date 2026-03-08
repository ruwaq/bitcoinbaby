/**
 * Charms Protocol Types
 *
 * Core types for Charms protocol integration.
 * Based on official Charms documentation and BRO reference implementation.
 *
 * Protocol Version History:
 * - v2: Initial implementation
 * - v7: BRO token launch
 * - v9: PoW Direct (CLI 0.11.1)
 * - v10: Merkle Proofs
 * - v11: Current (CLI v11.0.1)
 *
 * NEW: Version-specific types are now available in ./versions/
 * @see ./versions/v9 - Direct PoW validation
 * @see ./versions/v10 - Merkle proof validation
 * @see ./versions/v11 - Current format
 *
 * This file maintains backwards compatibility. New code should prefer
 * importing from the versioned modules for cleaner organization.
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
// SPELL FORMAT (v9 - CLI 0.11.1)
// =============================================================================

/**
 * Charms Spell v9 format (CLI 0.11.1)
 *
 * Used for direct PoW validation without Merkle proofs.
 * The contract validates pow_challenge + pow_nonce produces valid hash.
 *
 * NOTE: This format does NOT have a version field in the YAML.
 * The CLI infers the version from the structure.
 */
export interface SpellV9 {
  apps: Record<string, string>; // "$01" -> "t/<app_id>/<vk>"
  ins: SpellV9Input[];
  outs: SpellV9Output[];
  private_inputs?: Record<string, PoWPrivateInputs>;
}

export interface SpellV9Input {
  utxo_id: string; // "txid:vout"
  charms: Record<string, unknown>; // "$01" -> {} for mint or amount for transfer
}

export interface SpellV9Output {
  address: string;
  charms: Record<string, unknown>;
  sats: number;
}

/**
 * PoW private inputs for BABTC mining
 * These are passed to the contract for validation
 */
export interface PoWPrivateInputs {
  pow_challenge: string; // Format: "timestamp:address"
  pow_nonce: string; // Hex nonce that produces valid hash
  pow_difficulty: number; // Required leading zero bits
}

// =============================================================================
// SPELL FORMAT (v10 - With Merkle Proofs)
// =============================================================================

/**
 * Charms Spell v10 format (With Merkle Proofs)
 * Reference: https://docs.charms.dev/references/spell-json/
 *
 * Used when mining TX needs to be proven via Merkle inclusion.
 * For direct PoW validation, use SpellV9 instead.
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

// =============================================================================
// SPELL FORMAT (v11 - CLI v11.0.1, Current)
// =============================================================================

/**
 * Charms Spell v11 format (CLI v11.0.1)
 * Reference: https://docs.charms.dev/references/spell-json/
 *
 * Major changes from V9/V10:
 * - version: 11 required
 * - tx field contains ins/outs/refs/coins
 * - app_public_inputs replaces apps
 * - private_inputs passed separately via CLI/API
 */
export interface SpellV11 {
  version: 11;
  tx: SpellV11Transaction;
  app_public_inputs: Record<string, unknown | null>;
  mock?: boolean;
}

export interface SpellV11Transaction {
  /** Input UTXOs in "txid:vout" format */
  ins: string[];
  /** Reference UTXOs (optional) */
  refs?: string[];
  /** Output charms mapped by app index */
  outs: SpellV11Output[];
  /** Beaming destinations (optional) */
  beamed_outs?: Record<string, string>;
  /** Native coin outputs (optional) */
  coins?: SpellV11CoinOutput[];
}

/**
 * V11 output format
 * Keys are app indexes ("0", "1", etc.) from app_public_inputs
 * Values are amounts (number) for tokens or state objects for NFTs
 */
export type SpellV11Output = Record<string, number | Record<string, unknown>>;

export interface SpellV11CoinOutput {
  /** Amount in satoshis */
  amt: number;
  /** Destination hash */
  dest_hash: string;
}

/**
 * V11 PoW private inputs (passed separately from spell)
 * Used with Charms CLI: --private-inputs=./private-inputs.yaml
 * Or via Prover API: app_private_inputs field
 */
export interface PoWPrivateInputsV11 {
  pow_challenge: string; // "timestamp:address"
  pow_nonce: string; // Hex nonce
  pow_difficulty: number; // Leading zero bits
}

/**
 * V11 Prover request format
 * Private inputs are passed separately from the spell
 */
export interface ProverRequestV11 {
  spell: SpellV11;
  app_private_inputs?: Record<string, PoWPrivateInputsV11>;
  funding_utxo?: string; // "txid:vout"
  funding_utxo_value?: number; // In satoshis
  prev_txs?: string[]; // Previous transaction hexes
  change_address?: string;
}

/**
 * Mining private inputs for token minting (Merkle proof style)
 * Required to prove the mining transaction was included in a block
 */
export interface MiningPrivateInputs {
  /** Raw hex of the mining transaction */
  tx: string;
  /** Merkle block proof in hex format */
  tx_block_proof: string;
}

/**
 * Parameters for creating a PoW mint spell (V9)
 */
export interface PoWMintSpellParams {
  /** App ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** UTXO to consume (can be any available UTXO) */
  inputUtxo: {
    txid: string;
    vout: number;
  };
  /** Recipient address for minted tokens */
  minerAddress: string;
  /** Dev fund address */
  devAddress: string;
  /** Staking pool address */
  stakingAddress: string;
  /** PoW challenge (format: "timestamp:address") */
  challenge: string;
  /** Nonce that produces valid hash (hex) */
  nonce: string;
  /** Difficulty (leading zero bits) */
  difficulty: number;
  /** Miner's share of the reward */
  minerReward: bigint;
  /** Dev fund share */
  devReward: bigint;
  /** Staking pool share */
  stakingReward: bigint;
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
 * Current spell type alias
 *
 * SpellV11 is the current format (CLI v11.0.1)
 * SpellV9 and SpellV10 are legacy formats
 */
export type Spell = SpellV9 | SpellV10 | SpellV11;
export type SpellInput = SpellV9Input | SpellV10Input | string; // V11 uses plain strings
export type SpellOutput = SpellV9Output | SpellV10Output | SpellV11Output;

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
// SPELL CREATION HELPERS (v9 - PoW Mining)
// =============================================================================

/**
 * Create a PoW mint spell for mining rewards (v9 format)
 *
 * This format is used with CLI 0.11.1 and directly validates PoW
 * without requiring Merkle proofs. The contract receives:
 * - pow_challenge: The challenge string
 * - pow_nonce: The nonce that produces valid hash
 * - pow_difficulty: Required leading zeros
 */
export function createPoWMintSpellV9(params: PoWMintSpellParams): SpellV9 {
  const appRef = createAppReference("t", params.appId, params.appVk);

  return {
    apps: {
      $01: appRef,
    },
    ins: [
      {
        utxo_id: `${params.inputUtxo.txid}:${params.inputUtxo.vout}`,
        charms: {}, // No input charms for mint
      },
    ],
    outs: [
      {
        address: params.minerAddress,
        charms: {
          $01: Number(params.minerReward),
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
      {
        address: params.devAddress,
        charms: {
          $01: Number(params.devReward),
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
      {
        address: params.stakingAddress,
        charms: {
          $01: Number(params.stakingReward),
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
    ],
    private_inputs: {
      $01: {
        pow_challenge: params.challenge,
        pow_nonce: params.nonce,
        pow_difficulty: params.difficulty,
      },
    },
  };
}

// =============================================================================
// SPELL CREATION HELPERS (v10 - With Merkle Proofs)
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
