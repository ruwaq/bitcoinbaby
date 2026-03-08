/**
 * NFT Minting Security Validations
 *
 * Input validation and security checks for NFT minting operations.
 * All validations are performed before any transaction is created.
 */

import type { UTXO } from "../blockchain/types";
import type { BitcoinNetwork } from "../types";
import { NFT_SALE_CONFIG } from "../charms/nft-sale";

// Import canonical address validation from parent module
import { validateAddress as baseValidateAddress } from "../validation";

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface MintValidationParams {
  buyerAddress: string;
  utxos: UTXO[];
  treasuryAddress: string;
  network: BitcoinNetwork;
  dna?: string;
}

// =============================================================================
// ADDRESS VALIDATION (Delegated to canonical validator)
// =============================================================================

/**
 * Validate a Bitcoin address for the given network
 * @see ../validation.ts for canonical implementation
 */
export function validateAddress(
  address: string,
  network: BitcoinNetwork,
): ValidationResult {
  const result = baseValidateAddress(address, network);
  return {
    valid: result.valid,
    error: result.error,
  };
}

// =============================================================================
// DNA VALIDATION
// =============================================================================

/**
 * Validate NFT DNA string
 */
export function validateDNA(dna: string): ValidationResult {
  if (!dna || typeof dna !== "string") {
    return { valid: false, error: "DNA is required" };
  }

  // Must be 64 hex characters (32 bytes)
  if (dna.length !== 64) {
    return {
      valid: false,
      error: `DNA must be 64 hex characters (got ${dna.length})`,
    };
  }

  // Must be valid hex
  if (!/^[0-9a-fA-F]+$/.test(dna)) {
    return { valid: false, error: "DNA must be valid hexadecimal" };
  }

  return { valid: true };
}

// =============================================================================
// UTXO VALIDATION
// =============================================================================

/**
 * Validate UTXOs for minting
 */
export function validateUTXOs(
  utxos: UTXO[],
  requiredAmount: bigint,
): ValidationResult {
  const warnings: string[] = [];

  // Must have UTXOs
  if (!utxos || !Array.isArray(utxos) || utxos.length === 0) {
    return { valid: false, error: "No UTXOs provided" };
  }

  // Validate each UTXO
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];

    // Check required fields
    if (!utxo.txid || typeof utxo.txid !== "string") {
      return { valid: false, error: `UTXO ${i}: Missing or invalid txid` };
    }

    // Validate txid format (64 hex characters)
    if (!/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
      return { valid: false, error: `UTXO ${i}: Invalid txid format` };
    }

    // Validate vout
    if (typeof utxo.vout !== "number" || utxo.vout < 0) {
      return { valid: false, error: `UTXO ${i}: Invalid vout` };
    }

    // Validate value
    if (typeof utxo.value !== "number" || utxo.value <= 0) {
      return { valid: false, error: `UTXO ${i}: Invalid value` };
    }

    // Check for dust UTXOs
    if (utxo.value < 546) {
      warnings.push(
        `UTXO ${i}: Value below dust threshold (${utxo.value} sats)`,
      );
    }
  }

  // Calculate total
  const total = utxos.reduce((sum, u) => sum + BigInt(u.value), 0n);

  // Check sufficient funds
  if (total < requiredAmount) {
    return {
      valid: false,
      error: `Insufficient funds: have ${total} sats, need ${requiredAmount} sats`,
    };
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// =============================================================================
// TREASURY VALIDATION
// =============================================================================

/**
 * Validate treasury address is configured
 */
export function validateTreasury(
  treasuryAddress: string | undefined,
  network: BitcoinNetwork,
): ValidationResult {
  if (!treasuryAddress) {
    return { valid: false, error: "Treasury address not configured" };
  }

  // Validate the address itself
  return validateAddress(treasuryAddress, network);
}

// =============================================================================
// AMOUNT VALIDATION
// =============================================================================

/**
 * Validate amounts to prevent overflow/underflow
 */
export function validateAmounts(params: {
  price: bigint;
  fee: bigint;
  dustLimit: bigint;
  totalInput: bigint;
}): ValidationResult {
  const { price, fee, dustLimit, totalInput } = params;

  // All amounts must be positive
  if (price < 0n) {
    return { valid: false, error: "Price cannot be negative" };
  }

  if (fee < 0n) {
    return { valid: false, error: "Fee cannot be negative" };
  }

  if (dustLimit < 0n) {
    return { valid: false, error: "Dust limit cannot be negative" };
  }

  if (totalInput <= 0n) {
    return { valid: false, error: "Total input must be positive" };
  }

  // Check for overflow
  const maxSats = 21_000_000n * 100_000_000n; // 21M BTC in sats

  if (price > maxSats) {
    return { valid: false, error: "Price exceeds maximum possible value" };
  }

  if (fee > maxSats) {
    return { valid: false, error: "Fee exceeds maximum possible value" };
  }

  const totalCost = price + fee + dustLimit;
  if (totalCost > maxSats) {
    return { valid: false, error: "Total cost exceeds maximum possible value" };
  }

  // Sanity check on fee (max 1 BTC)
  if (fee > 100_000_000n) {
    return { valid: false, error: "Fee unreasonably high (>1 BTC)" };
  }

  return { valid: true };
}

// =============================================================================
// FULL MINT VALIDATION
// =============================================================================

/**
 * Perform all validations for a mint request
 */
export function validateMintRequest(
  params: MintValidationParams,
): ValidationResult {
  const allWarnings: string[] = [];

  // 1. Validate buyer address
  const buyerResult = validateAddress(params.buyerAddress, params.network);
  if (!buyerResult.valid) {
    return { valid: false, error: `Buyer address: ${buyerResult.error}` };
  }

  // 2. Validate treasury
  const treasuryResult = validateTreasury(
    params.treasuryAddress,
    params.network,
  );
  if (!treasuryResult.valid) {
    return { valid: false, error: `Treasury: ${treasuryResult.error}` };
  }

  // 3. Validate DNA if provided
  if (params.dna) {
    const dnaResult = validateDNA(params.dna);
    if (!dnaResult.valid) {
      return { valid: false, error: `DNA: ${dnaResult.error}` };
    }
  }

  // 4. Calculate required amount
  const price = NFT_SALE_CONFIG.priceSats;
  const estimatedFee = 5000n; // Conservative estimate
  const requiredAmount = price + NFT_SALE_CONFIG.dustLimit + estimatedFee;

  // 5. Validate UTXOs
  const utxoResult = validateUTXOs(params.utxos, requiredAmount);
  if (!utxoResult.valid) {
    return { valid: false, error: utxoResult.error };
  }
  if (utxoResult.warnings) {
    allWarnings.push(...utxoResult.warnings);
  }

  // 6. Validate amounts
  const totalInput = params.utxos.reduce((sum, u) => sum + BigInt(u.value), 0n);
  const amountResult = validateAmounts({
    price,
    fee: estimatedFee,
    dustLimit: NFT_SALE_CONFIG.dustLimit,
    totalInput,
  });
  if (!amountResult.valid) {
    return { valid: false, error: amountResult.error };
  }

  return {
    valid: true,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}

// =============================================================================
// RATE LIMITING (Client-side)
// =============================================================================

const mintTimestamps: Map<string, number[]> = new Map();
const MAX_MINTS_PER_MINUTE = 3;
const RATE_LIMIT_WINDOW = 60_000; // 1 minute

/**
 * Check if an address has exceeded the mint rate limit
 */
export function checkRateLimit(address: string): ValidationResult {
  const now = Date.now();
  const timestamps = mintTimestamps.get(address) || [];

  // Remove old timestamps
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= MAX_MINTS_PER_MINUTE) {
    const oldestTimestamp = recent[0];
    const waitTime = Math.ceil(
      (RATE_LIMIT_WINDOW - (now - oldestTimestamp)) / 1000,
    );
    return {
      valid: false,
      error: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
    };
  }

  return { valid: true };
}

/**
 * Record a mint attempt for rate limiting
 */
export function recordMintAttempt(address: string): void {
  const timestamps = mintTimestamps.get(address) || [];
  timestamps.push(Date.now());

  // Keep only recent timestamps
  const now = Date.now();
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  mintTimestamps.set(address, recent);
}

/**
 * Clear rate limit for testing
 */
export function clearRateLimit(address?: string): void {
  if (address) {
    mintTimestamps.delete(address);
  } else {
    mintTimestamps.clear();
  }
}
