/**
 * $SPARK Token Configuration
 *
 * Token configuration and types for the BitcoinBaby fungible token.
 * Distributed via Proof-of-Useful-Work mining.
 *
 * REWARD MODEL: BRO-style (difficulty-based, no halving)
 * ======================================================
 * Formula: BASE_REWARD * clz² / DIFFICULTY_FACTOR
 *
 * - clz = count of leading zeros in hash (proof of work)
 * - Higher difficulty = harder work = more reward
 * - No arbitrary halving schedule
 * - Natural reward curve based on actual work done
 *
 * Updated for Charms Protocol v10 (March 2026)
 */

import type {
  SpellV2,
  SpellV9,
  SpellV10,
  SpellV11,
  SpellV11Output,
  PoWPrivateInputsV11,
  ProverRequestV11,
  AppType,
} from "./types";
import {
  createPoWMintSpellV9,
  createMiningMintSpellV10,
  createTokenTransferSpellV10,
  MIN_SPELL_OUTPUT_SATS,
} from "./types";
import * as bitcoin from "bitcoinjs-lib";
import type { BitcoinNetwork } from "../types";
import {
  minedAmountBro,
  SPARK_START_TIME,
  BRO_HALVING_PERIOD_SECONDS,
} from "./bro-reward";

// =============================================================================
// NETWORK UTILITIES
// =============================================================================

/**
 * Network configurations for bitcoinjs-lib
 */
const BITCOIN_NETWORKS: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  testnet4: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

/**
 * Convert a Bitcoin address to its scriptPubKey hex representation
 *
 * For P2TR (Taproot) addresses (bc1p/tb1p):
 * - Returns "5120" + 64 hex chars (32 bytes pubkey)
 * - OP_1 (0x51) + PUSH32 (0x20) + pubkey
 *
 * @param address - Bitcoin address (bech32/bech32m)
 * @param network - Bitcoin network (default: testnet4)
 * @returns scriptPubKey as hex string (e.g., "5120abcd...")
 */
export function addressToScriptPubKeyHex(
  address: string,
  network: BitcoinNetwork = "testnet4",
): string {
  const networkConfig = BITCOIN_NETWORKS[network];
  const script = bitcoin.address.toOutputScript(address, networkConfig);
  return Buffer.from(script).toString("hex");
}

// =============================================================================
// TOKEN CONFIGURATION
// =============================================================================

/**
 * $SPARK Token Configuration
 * These values are IMMUTABLE once deployed
 */
export const SPARK_CONFIG = {
  ticker: "SPARK",
  name: "BitcoinBaby",
  decimals: 8,
  maxSupply: 21_000_000_000n * 100_000_000n, // 21B with 8 decimals
  appType: "t" as AppType,

  // Distribution (per mint)
  distribution: {
    miner: 90, // 90% to miner
    dev: 5, // 5% to dev fund
    staking: 5, // 5% to staking pool
  },

  // BRO-style reward configuration (no halving)
  // Must match contracts/babtc/src/lib.rs constants
  rewards: {
    /** Base reward (1 SPARK in base units) */
    baseReward: 1n * 100_000_000n,
    /** Minimum leading zeros required (D16) */
    minDifficulty: 16,
    /** Maximum leading zeros (D32 cap) */
    maxDifficulty: 32,
    /** Difficulty divisor to control emission rate */
    difficultyFactor: 100n,
  },

  // Addresses - Configured via environment variables
  // WARNING: These addresses receive 5% of mining rewards each.
  // The NEXT_PUBLIC_ prefix means they are exposed to the client bundle.
  // For mainnet deployment, these MUST be replaced with proper server-side
  // configuration (e.g., via environment variables that are NOT NEXT_PUBLIC_)
  // to prevent tampering and ensure correct reward distribution.
  addresses: {
    devFund:
      process.env.NEXT_PUBLIC_DEV_FUND_ADDRESS ||
      process.env.DEV_FUND_ADDRESS ||
      "tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3",

    stakingPool:
      process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS ||
      process.env.STAKING_POOL_ADDRESS ||
      "tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc",
  },
} as const;

/**
 * Runtime check: warn if hardcoded testnet addresses are used on mainnet.
 * Testnet addresses start with "tb1" while mainnet addresses start with "bc1".
 */
if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "production" &&
  process.env.BITCOIN_NETWORK !== "testnet4" &&
  process.env.BITCOIN_NETWORK !== "testnet"
) {
  const { devFund, stakingPool } = SPARK_CONFIG.addresses;
  if (devFund.startsWith("tb1") || stakingPool.startsWith("tb1")) {
    console.warn(
      "[SPARK] WARNING: Testnet addresses detected in production/mainnet environment. " +
        "Replace NEXT_PUBLIC_DEV_FUND_ADDRESS and NEXT_PUBLIC_STAKING_POOL_ADDRESS " +
        "with mainnet addresses before deploying to production.",
    );
  }
}

// =============================================================================
// TOKEN TYPES
// =============================================================================

/**
 * Token metadata for Charms Explorer
 */
export interface SPARKMetadata {
  decimals: number;
  description: string;
  image: string;
  name: string;
  supply_limit: number;
  ticker: string;
  url: string;
}

import { SPARK_LOGO_DATA_URI } from "./logo";

/**
 * Default metadata for $SPARK
 */
export const SPARK_METADATA: SPARKMetadata = {
  decimals: 8,
  description:
    "Proof-of-Useful-Work token. Mine by training AI, raise your BitcoinBaby, earn $SPARK.",
  image: SPARK_LOGO_DATA_URI,
  name: "BitcoinBaby",
  supply_limit: 21_000_000_000,
  ticker: "SPARK",
  url: "https://bitcoinbaby.dev",
};

/**
 * Token balance with formatted values
 */
export interface TokenBalance {
  raw: bigint;
  formatted: string;
  decimals: number;
}

/**
 * Mining reward calculation result (BRO-style)
 */
export interface MiningReward {
  /** Total reward before distribution */
  total: bigint;
  /** Miner's share (90%) */
  minerShare: bigint;
  /** Dev fund share (5%) */
  devShare: bigint;
  /** Staking pool share (5%) */
  stakingShare: bigint;
  /** Leading zeros in hash (difficulty met) */
  leadingZeros: number;
  /** Effective difficulty used */
  difficulty: number;
}

// =============================================================================
// REWARD CALCULATION (BRO-style)
// =============================================================================

/**
 * Calculate mining reward based on difficulty (LEGACY v1-contract formula).
 *
 * @deprecated DEFINITIVE — sub-proyecto C Fase 2.4. The v1 on-chain babtc
 *   contract was realigned to the canonical BRO formula in Fase 2.1
 *   (`calculate_reward` now uses `BRO_DENOMINATION · clz² / 2^halvings` with
 *   halving + START_TIME), and the signer was aligned in Fase 2.2 (delegates
 *   to `minedAmountBro`). This legacy function is retained ONLY for:
 *     (a) backwards-compatible display of the pre-Fase-2 reward values in
 *         `submitter.ts` (lines ~581, ~688 — UI display only, does NOT feed
 *         the witness or on-chain spell), and
 *     (b) historical reference of the pre-alignment formula.
 *   All NEW code MUST use {@link calculateMiningRewardBro} (or `minedAmountBro`
 *   directly from bro-reward.ts). Removal scheduled for sub-proyecto D
 *   (post-mainnet stabilization), once the v1 display path in submitter.ts is
 *   retired.
 *
 *   The CANONICAL BRO formula lives in `./bro-reward.ts` (`minedAmountBro`).
 *   See `docs/superpowers/notes/BRO_ALIGNMENT.md` and
 *   `docs/audits/VK_RECONCILIATION.md` for the full reconciliation history.
 *
 * Legacy formula: BASE_REWARD * D² / DIFFICULTY_FACTOR
 * Where: BASE_REWARD = 1 SPARK, FACTOR = 100
 *
 * Examples (legacy, NO halving, /100):
 * - D16 (min): 1 * 256 / 100 = 2.56 SPARK
 * - D20:       1 * 400 / 100 = 4.00 SPARK
 * - D22:       1 * 484 / 100 = 4.84 SPARK
 * - D24:       1 * 576 / 100 = 5.76 SPARK
 * - D28:       1 * 784 / 100 = 7.84 SPARK
 * - D32 (max): 1 * 1024 / 100 = 10.24 SPARK
 *
 * For comparison, the CANONICAL BRO values at period 0 (genesis) are 100x
 * larger because there is no /100 divisor: D16 = 256 BABTC, D32 = 1024 BABTC,
 * and they halve every 14 days. Use {@link calculateMiningRewardBro}.
 *
 * Harder work = exponentially more reward (D²)
 *
 * @param leadingZeros - Number of leading zero bits in hash
 * @returns Mining reward with distribution breakdown
 */
export function calculateMiningReward(leadingZeros: number): MiningReward {
  const { baseReward, minDifficulty, maxDifficulty, difficultyFactor } =
    SPARK_CONFIG.rewards;
  const { miner, dev, staking } = SPARK_CONFIG.distribution;

  // Clamp difficulty to valid range
  const clampedDifficulty = Math.max(
    minDifficulty,
    Math.min(maxDifficulty, leadingZeros),
  );

  // BRO formula: baseReward * clz² / difficultyFactor
  const clzSquared = BigInt(clampedDifficulty * clampedDifficulty);
  const total = (baseReward * clzSquared) / difficultyFactor;

  return {
    total,
    minerShare: (total * BigInt(miner)) / 100n,
    devShare: (total * BigInt(dev)) / 100n,
    stakingShare: (total * BigInt(staking)) / 100n,
    leadingZeros: clampedDifficulty,
    difficulty: clampedDifficulty,
  };
}

// =============================================================================
// CANONICAL BRO REWARD (delegates to ./bro-reward — single source of truth)
// =============================================================================

/**
 * Mining reward breakdown using the CANONICAL BRO formula.
 *
 * Mirrors the shape of {@link MiningReward} but is computed from
 * `minedAmountBro` (DENOMINATION · clz² / 2^halvings). The legacy
 * {@link MiningReward} type is still produced by the deprecated
 * {@link calculateMiningReward} (v1-contract-locked, /100, no halving).
 */
export interface MiningRewardBro {
  /** Total reward before distribution (canonical BRO base units). */
  total: bigint;
  /** Miner's share (90%). */
  minerShare: bigint;
  /** Dev fund share (5%). */
  devShare: bigint;
  /** Staking pool share (5%). */
  stakingShare: bigint;
  /** Leading zeros in hash (difficulty met). */
  leadingZeros: number;
  /** Effective difficulty used (clamped to SPARK range). */
  difficulty: number;
  /** Block time (unix seconds) used for the halving lookup. */
  blockTime: number;
}

/**
 * Calculate mining reward using the CANONICAL BRO formula.
 *
 * This is the recommended off-chain reward computation. It delegates to
 * {@link minedAmountBro} and applies the same SPARK distribution split
 * (90/5/5) as the legacy function. Difficulty is clamped to the SPARK range
 * (D16..D32) for consistency with {@link calculateMiningReward}.
 *
 * NOTE: this does NOT yet match what the v1 on-chain contract mints, so do
 * NOT use it to build mint spells that the v1 contract must validate — use
 * the legacy {@link calculateMiningReward} for that until sub-proyecto C.
 * Use this for estimation, analytics, dashboards, and forward-looking UI.
 *
 * @param leadingZeros - Number of leading zero bits in hash (clamped D16..D32).
 * @param blockTime - Unix seconds of the block being rewarded (default: now).
 * @returns Mining reward breakdown in canonical BRO base units.
 */
export function calculateMiningRewardBro(
  leadingZeros: number,
  blockTime: number = Math.floor(Date.now() / 1000),
): MiningRewardBro {
  const { minDifficulty, maxDifficulty } = SPARK_CONFIG.rewards;
  const { miner, dev, staking } = SPARK_CONFIG.distribution;

  const difficulty = Math.max(
    minDifficulty,
    Math.min(maxDifficulty, leadingZeros),
  );

  const total = minedAmountBro(
    difficulty,
    blockTime,
    BRO_HALVING_PERIOD_SECONDS,
    SPARK_START_TIME,
  );

  return {
    total,
    minerShare: (total * BigInt(miner)) / 100n,
    devShare: (total * BigInt(dev)) / 100n,
    stakingShare: (total * BigInt(staking)) / 100n,
    leadingZeros: difficulty,
    difficulty,
    blockTime,
  };
}

/**
 * Calculate reward for specific difficulty level
 * Convenience function that returns just the miner's share
 */
export function calculateRewardForDifficulty(difficulty: number): bigint {
  return calculateMiningReward(difficulty).minerShare;
}

/**
 * Get reward table for all difficulty levels
 * Useful for displaying reward tiers in UI
 */
export function getRewardTable(): Array<{
  difficulty: number;
  totalReward: bigint;
  minerReward: bigint;
}> {
  const { minDifficulty, maxDifficulty } = SPARK_CONFIG.rewards;
  const table: Array<{
    difficulty: number;
    totalReward: bigint;
    minerReward: bigint;
  }> = [];

  for (let d = minDifficulty; d <= maxDifficulty; d += 2) {
    const reward = calculateMiningReward(d);
    table.push({
      difficulty: d,
      totalReward: reward.total,
      minerReward: reward.minerShare,
    });
  }

  return table;
}

// =============================================================================
// LEGACY COMPATIBILITY (deprecated - use calculateMiningReward)
// =============================================================================

/**
 * @deprecated Use calculateMiningReward(leadingZeros) instead
 * This function exists only for backwards compatibility
 */
export function getCurrentEpoch(_blockHeight: number): number {
  // No epochs in BRO model - return 0 for compatibility
  return 0;
}

/**
 * @deprecated Use calculateMiningReward(leadingZeros) instead
 * This function exists only for backwards compatibility
 */
export function calculateBlockReward(_blockHeight: number): bigint {
  // Return base reward for compatibility
  // New code should use calculateMiningReward(difficulty) instead
  return SPARK_CONFIG.rewards.baseReward;
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = SPARK_CONFIG.decimals,
): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  const fractionStr = fraction.toString().padStart(decimals, "0");
  // Remove trailing zeros but keep at least 2 decimal places
  const trimmedFraction = fractionStr.replace(/0+$/, "").padEnd(2, "0");

  return `${whole}.${trimmedFraction}`;
}

/**
 * Parse token amount from string
 */
export function parseTokenAmount(
  amount: string,
  decimals: number = SPARK_CONFIG.decimals,
): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Convert a BigInt value to a big-endian Uint8Array of bytes.
 *
 * Use this when a binary protocol requires byte encoding instead of
 * Number(), which loses precision for values exceeding 2^53 - 1.
 * Each byte is extracted via bitwise AND with 0xff, avoiding any
 * intermediate Number conversion that could truncate large values.
 *
 * @param value - Non-negative BigInt value to convert
 * @param byteLength - Optional fixed output length (pads with leading zeros,
 *   throws if value requires more bytes than specified)
 * @returns Uint8Array of the value in big-endian byte order
 */
export function bigIntToBytes(value: bigint, byteLength?: number): Uint8Array {
  if (value < 0n) {
    throw new Error("Cannot convert negative BigInt to bytes");
  }

  if (byteLength !== undefined) {
    const bytes = new Uint8Array(byteLength);
    let v = value;
    for (let i = byteLength - 1; i >= 0; i--) {
      bytes[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    if (v > 0n) {
      throw new Error(
        `BigInt value ${value} requires more than ${byteLength} bytes`,
      );
    }
    return bytes;
  }

  // Auto-detect minimal byte length
  if (value === 0n) return new Uint8Array([0]);

  const byteValues: number[] = [];
  let v = value;
  while (v > 0n) {
    byteValues.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return new Uint8Array(byteValues.reverse());
}

// =============================================================================
// SPELL GENERATION
// =============================================================================

/**
 * Token mint spell parameters
 */
export interface TokenMintParams {
  appId: string;
  appVk: string;
  minerAddress: string;
  devAddress: string;
  stakingAddress: string;
  /** Leading zeros in hash (difficulty) */
  leadingZeros: number;
  workProofHash: string;
}

/**
 * Generate a token mint spell
 * @deprecated Use createSPARKMintSpellV10 for new implementations
 */
export function createTokenMintSpell(params: TokenMintParams): SpellV2 {
  const reward = calculateMiningReward(params.leadingZeros);
  const appRef = `t/${params.appId}/${params.appVk}`;

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    public_inputs: {
      work_proof: params.workProofHash,
      difficulty: params.leadingZeros,
    },
    ins: [],
    outs: [
      {
        address: params.minerAddress,
        charms: { $00: reward.minerShare },
        sats: 546,
      },
      {
        address: params.devAddress,
        charms: { $00: reward.devShare },
        sats: 546,
      },
      {
        address: params.stakingAddress,
        charms: { $00: reward.stakingShare },
        sats: 546,
      },
    ],
  };
}

/**
 * Token transfer spell parameters
 */
export interface TokenTransferParams {
  appId: string;
  appVk: string;
  fromUtxo: { txid: string; vout: number };
  fromAmount: bigint;
  toAddress: string;
  toAmount: bigint;
  changeAddress: string;
}

/**
 * Generate a token transfer spell
 * @deprecated Use createTokenTransferSpellV10 for new implementations
 */
export function createTokenTransferSpell(params: TokenTransferParams): SpellV2 {
  if (params.fromAmount < params.toAmount) {
    throw new Error(
      `Insufficient funds: fromAmount (${params.fromAmount}) < toAmount (${params.toAmount})`,
    );
  }

  const appRef = `t/${params.appId}/${params.appVk}`;
  const changeAmount = params.fromAmount - params.toAmount;

  const outs: SpellV2["outs"] = [
    {
      address: params.toAddress,
      charms: { $00: params.toAmount },
      sats: 546,
    },
  ];

  if (changeAmount > 0n) {
    outs.push({
      address: params.changeAddress,
      charms: { $00: changeAmount },
      sats: 546,
    });
  }

  return {
    version: 2,
    apps: { $00: appRef },
    ins: [
      {
        utxo_id: `${params.fromUtxo.txid}:${params.fromUtxo.vout}`,
        charms: { $00: params.fromAmount },
      },
    ],
    outs,
  };
}

// =============================================================================
// SPELL GENERATION V10 (Current Protocol)
// =============================================================================

/**
 * Token mint spell parameters for V10 (with Merkle proofs)
 *
 * BRO-style mining flow:
 * 1. Mine PoW → create mining TX with OP_RETURN
 * 2. Broadcast and wait for confirmation
 * 3. Get Merkle proof of inclusion
 * 4. Create mint spell with private_inputs
 */
export interface TokenMintParamsV10 {
  /** SPARK app ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** Miner's Bitcoin address (receives 90%) */
  minerAddress: string;
  /** Dev fund address (receives 5%) */
  devAddress: string;
  /** Staking pool address (receives 5%) */
  stakingAddress: string;
  /** Leading zeros in hash (determines reward) */
  leadingZeros: number;
  /** Mining transaction hex (confirmed in block) */
  miningTxHex: string;
  /** Merkle block proof hex */
  merkleProofHex: string;
  /** UTXO from mining transaction to consume */
  miningUtxo: {
    txid: string;
    vout: number;
  };
}

/**
 * Generate a token mint spell (V10 format with Merkle proofs)
 *
 * This is the main entry point for creating mint spells after mining.
 * Uses BRO-style reward calculation based on difficulty.
 */
export function createSPARKMintSpellV10(params: TokenMintParamsV10): SpellV10 {
  const reward = calculateMiningReward(params.leadingZeros);

  // Use the shared V10 spell creator for miner's share
  const baseSpell = createMiningMintSpellV10({
    appId: params.appId,
    appVk: params.appVk,
    miningTxHex: params.miningTxHex,
    merkleProofHex: params.merkleProofHex,
    miningUtxo: params.miningUtxo,
    minerAddress: params.minerAddress,
    mintAmount: reward.minerShare,
  });

  // Extend with dev and staking outputs
  return {
    ...baseSpell,
    outs: [
      // Miner share (90%)
      {
        address: params.minerAddress,
        charms: { $01: reward.minerShare },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
      // Dev fund (5%)
      {
        address: params.devAddress,
        charms: { $01: reward.devShare },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
      // Staking pool (5%)
      {
        address: params.stakingAddress,
        charms: { $01: reward.stakingShare },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
    ],
  };
}

/**
 * Generate a token transfer spell (V10 format)
 */
export function createSPARKTransferSpellV10(
  params: TokenTransferParams,
): SpellV10 {
  return createTokenTransferSpellV10({
    appId: params.appId,
    appVk: params.appVk,
    fromUtxo: params.fromUtxo,
    fromAmount: params.fromAmount,
    toAddress: params.toAddress,
    toAmount: params.toAmount,
    changeAddress: params.changeAddress,
  });
}

/**
 * Validate BigInt amount is safe for spell encoding
 *
 * Spell objects carry BigInt values to preserve precision throughout the
 * creation pipeline. This validation should be called at the JSON
 * serialization boundary to ensure BigInt values can be safely represented
 * as JSON numbers. Throws if the value exceeds Number.MAX_SAFE_INTEGER.
 */
export function validateAmountForSpell(amount: bigint): void {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      `Token amount ${amount} exceeds safe integer range for spell encoding`,
    );
  }
  if (amount < 0n) {
    throw new Error("Token amount must be non-negative");
  }
}

// =============================================================================
// SPELL GENERATION V9 (PoW Direct - CLI 0.11.1)
// =============================================================================

/**
 * PoW mint spell parameters for V9 (direct PoW validation)
 *
 * This is the primary method for SPARK mining:
 * 1. Miner finds valid PoW (challenge:nonce -> hash with D bits)
 * 2. Creates spell with challenge, nonce, difficulty
 * 3. Contract validates the PoW and mints tokens
 */
export interface TokenMintParamsV9 {
  /** SPARK app ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** Miner's Bitcoin address (receives 90%) */
  minerAddress: string;
  /** Dev fund address (receives 5%) */
  devAddress: string;
  /** Staking pool address (receives 5%) */
  stakingAddress: string;
  /** PoW challenge (format: "timestamp:address") */
  challenge: string;
  /** Nonce that produces valid hash (hex string) */
  nonce: string;
  /** Difficulty level (leading zero bits in hash) */
  difficulty: number;
  /** UTXO to consume for the spell */
  inputUtxo: {
    txid: string;
    vout: number;
  };
}

/**
 * Generate a PoW mint spell (V9 format for CLI 0.11.1)
 *
 * This is the primary entry point for creating mint spells after mining.
 * Uses BRO-style reward calculation based on difficulty.
 *
 * @example
 * ```typescript
 * const spell = createSPARKMintSpellV9({
 *   appId: '87b5ecfb...',
 *   appVk: 'acf2ec0b...',
 *   minerAddress: 'tb1p...',
 *   devAddress: 'tb1p...',
 *   stakingAddress: 'tb1p...',
 *   challenge: '1709654321:tb1pxyz...',
 *   nonce: 'abc123',
 *   difficulty: 16,
 *   inputUtxo: { txid: '...', vout: 0 },
 * });
 * ```
 */
export function createSPARKMintSpellV9(params: TokenMintParamsV9): SpellV9 {
  // Calculate reward based on difficulty
  const reward = calculateMiningReward(params.difficulty);

  // Validate amounts are safe for spell encoding
  validateAmountForSpell(reward.minerShare);
  validateAmountForSpell(reward.devShare);
  validateAmountForSpell(reward.stakingShare);

  // Create V9 spell with PoW private_inputs
  return createPoWMintSpellV9({
    appId: params.appId,
    appVk: params.appVk,
    inputUtxo: params.inputUtxo,
    minerAddress: params.minerAddress,
    devAddress: params.devAddress,
    stakingAddress: params.stakingAddress,
    challenge: params.challenge,
    nonce: params.nonce,
    difficulty: params.difficulty,
    minerReward: reward.minerShare,
    devReward: reward.devShare,
    stakingReward: reward.stakingShare,
  });
}

/**
 * Generate a PoW mint spell with custom reward amounts
 *
 * Use this when you need to specify exact reward amounts
 * (e.g., for testing or special cases).
 */
export function createSPARKMintSpellV9WithRewards(
  params: TokenMintParamsV9 & {
    minerReward: bigint;
    devReward: bigint;
    stakingReward: bigint;
  },
): SpellV9 {
  // Validate amounts
  validateAmountForSpell(params.minerReward);
  validateAmountForSpell(params.devReward);
  validateAmountForSpell(params.stakingReward);

  return createPoWMintSpellV9({
    appId: params.appId,
    appVk: params.appVk,
    inputUtxo: params.inputUtxo,
    minerAddress: params.minerAddress,
    devAddress: params.devAddress,
    stakingAddress: params.stakingAddress,
    challenge: params.challenge,
    nonce: params.nonce,
    difficulty: params.difficulty,
    minerReward: params.minerReward,
    devReward: params.devReward,
    stakingReward: params.stakingReward,
  });
}

// =============================================================================
// SPELL GENERATION V11 (CLI v11.0.1 - Current)
// =============================================================================

/**
 * PoW mint spell parameters for V11 (CLI v11.0.1)
 *
 * V11 changes from V9/V10:
 * - version: 11 required
 * - tx field contains ins/outs
 * - app_public_inputs replaces apps
 * - private_inputs passed separately via API
 */
export interface TokenMintParamsV11 {
  /** SPARK app ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** Miner's Bitcoin address (receives 90%) */
  minerAddress: string;
  /** Dev fund address (receives 5%) */
  devAddress: string;
  /** Staking pool address (receives 5%) */
  stakingAddress: string;
  /** PoW challenge (format: "timestamp:address") */
  challenge: string;
  /** Nonce that produces valid hash (hex string) */
  nonce: string;
  /** Difficulty level (leading zero bits in hash) */
  difficulty: number;
  /**
   * Bitcoin block time (unix seconds) at which the work was mined. Forwarded
   * into the witness `block_time` field consumed by the contract's canonical
   * BRO reward formula.
   */
  blockTime: number;
  /** UTXO to consume for the spell */
  inputUtxo: {
    txid: string;
    vout: number;
  };
  /** Funding UTXO for transaction fees */
  fundingUtxo?: {
    txid: string;
    vout: number;
    value: number;
  };
  /** Change address for remaining funds */
  changeAddress?: string;
  /** Previous transactions hex (required by V11 prover) */
  prevTxs?: string[];
  /** Bitcoin network (default: testnet4) */
  network?: BitcoinNetwork;
}

/**
 * Generate a PoW mint spell (V11 format for CLI v11.0.1)
 *
 * This is the current format for creating mint spells.
 * Uses BRO-style reward calculation based on difficulty.
 *
 * NOTE: Private inputs (challenge, nonce, difficulty)
 * are NOT included in the spell - they're passed separately to the prover.
 *
 * @example
 * ```typescript
 * const { spell, privateInputs } = createSPARKMintSpellV11({
 *   appId: '87b5ecfb...',
 *   appVk: 'acf2ec0b...',
 *   minerAddress: 'tb1p...',
 *   devAddress: 'tb1p...',
 *   stakingAddress: 'tb1p...',
 *   challenge: '1709654321:tb1pxyz...',
 *   nonce: 'abc123',
 *   difficulty: 16,
 *   inputUtxo: { txid: '...', vout: 0 },
 * });
 * ```
 */
export function createSPARKMintSpellV11(params: TokenMintParamsV11): {
  spell: SpellV11;
  privateInputs: PoWPrivateInputsV11;
  proverRequest: ProverRequestV11;
} {
  // Calculate reward based on difficulty
  const reward = calculateMiningReward(params.difficulty);

  // Validate amounts are safe for spell encoding
  validateAmountForSpell(reward.minerShare);
  validateAmountForSpell(reward.devShare);
  validateAmountForSpell(reward.stakingShare);

  // App reference key (t = token)
  const appKey = `t/${params.appId}/${params.appVk}`;

  // Convert addresses to scriptPubKey hex (required by V11 format)
  const network = params.network || "testnet4";
  const minerDest = addressToScriptPubKeyHex(params.minerAddress, network);
  const devDest = addressToScriptPubKeyHex(params.devAddress, network);
  const stakingDest = addressToScriptPubKeyHex(params.stakingAddress, network);

  // Create V11 spell (without private_inputs)
  // V11 requires coins field with amount/dest for each output
  const spell: SpellV11 = {
    version: 11,
    tx: {
      ins: [`${params.inputUtxo.txid}:${params.inputUtxo.vout}`],
      outs: [
        // Output 0: Miner share (90%)
        { "0": reward.minerShare } as SpellV11Output,
        // Output 1: Dev fund (5%)
        { "0": reward.devShare } as SpellV11Output,
        // Output 2: Staking pool (5%)
        { "0": reward.stakingShare } as SpellV11Output,
      ],
      // Native satoshi outputs with destinations
      coins: [
        { amount: MIN_SPELL_OUTPUT_SATS, dest: minerDest },
        { amount: MIN_SPELL_OUTPUT_SATS, dest: devDest },
        { amount: MIN_SPELL_OUTPUT_SATS, dest: stakingDest },
      ],
    },
    app_public_inputs: {
      [appKey]: null, // null for simple mints
    },
  };

  // Create private inputs (passed separately to prover)
  // Field names must match MiningWitness struct in contract
  const privateInputs: PoWPrivateInputsV11 = {
    challenge: params.challenge,
    nonce: params.nonce,
    difficulty: params.difficulty,
    block_time: params.blockTime,
  };

  // Create full prover request
  const proverRequest: ProverRequestV11 = {
    spell,
    app_private_inputs: {
      [appKey]: privateInputs,
    },
    funding_utxo: params.fundingUtxo
      ? `${params.fundingUtxo.txid}:${params.fundingUtxo.vout}`
      : undefined,
    funding_utxo_value: params.fundingUtxo?.value,
    change_address: params.changeAddress,
    prev_txs: params.prevTxs,
  };

  return {
    spell,
    privateInputs,
    proverRequest,
  };
}

/**
 * Generate a token transfer spell (V11 format)
 */
export interface TokenTransferParamsV11 {
  appId: string;
  appVk: string;
  fromUtxo: { txid: string; vout: number };
  fromAmount: bigint;
  toAddress: string;
  toAmount: bigint;
  changeAddress?: string;
}

export function createSPARKTransferSpellV11(
  params: TokenTransferParamsV11,
): SpellV11 {
  if (params.fromAmount < params.toAmount) {
    throw new Error(
      `Insufficient funds: fromAmount (${params.fromAmount}) < toAmount (${params.toAmount})`,
    );
  }

  const appKey = `t/${params.appId}/${params.appVk}`;
  const changeAmount = params.fromAmount - params.toAmount;

  const outs: SpellV11Output[] = [
    // Output 0: Transfer to recipient
    { "0": params.toAmount } as SpellV11Output,
  ];

  if (changeAmount > 0n && params.changeAddress) {
    // Output 1: Change back to sender
    outs.push({ "0": changeAmount } as SpellV11Output);
  }

  return {
    version: 11,
    tx: {
      ins: [`${params.fromUtxo.txid}:${params.fromUtxo.vout}`],
      outs,
    },
    app_public_inputs: {
      [appKey]: null,
    },
  };
}
