/**
 * Charms Prover Client
 *
 * Client for communicating with the Charms Proving Service.
 * Handles spell proof generation for token minting on Bitcoin.
 *
 * Based on BRO token reference implementation.
 * @see https://github.com/CharmsDev/bro
 */

import type {
  SpellV9,
  SpellV10,
  SpellV11,
  PoWPrivateInputs,
  PoWPrivateInputsV11,
  ProverRequestV11,
} from "./types";
import { ApiError } from "../errors";
import { hash256, countLeadingZeroBits } from "@bitcoinbaby/shared";

/** Union type for spells accepted by the prover */
type SpellInput = SpellV9 | SpellV10 | SpellV11;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Prover API response
 */
export interface ProverResponse {
  /** Commit transaction hex (anchors state) */
  commitTx: string;
  /** Spell transaction hex (contains ZK proof) */
  spellTx: string;
}

/**
 * Prover request payload
 * Accepts both SpellV9 (PoW direct) and SpellV10 (Merkle proof)
 */
export interface ProverRequest {
  spell: SpellInput;
}

/**
 * Prover client configuration
 */
export interface CharmsProverClientOptions {
  /** Prover base URL (default: https://v11.charms.dev) */
  proverUrl?: string;
  /** Request timeout in ms (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Max retry attempts (default: 5) */
  maxRetries?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterPercent: number;
}

// =============================================================================
// CONSTANTS (imported from shared config)
// =============================================================================

import {
  PROVER_API,
  getProverUrl as getConfiguredProverUrl,
  HTTP_TIMEOUTS,
  createLogger,
} from "@bitcoinbaby/shared";

const proverLog = createLogger("CharmsProver");

/**
 * Charms Prover API URLs
 *
 * The Charms hosted prover is available at v11.charms.dev (latest).
 * This is the same prover used by BRO token (bro.charms.dev).
 *
 * Options:
 *
 * 1. HOSTED PROVER (recommended for production):
 *    - URL: https://v11.charms.dev/spells/prove
 *    - Used by BRO token: https://bro.charms.dev
 *    - Reliable and maintained by Charms Inc.
 *
 * 2. LOCAL PROVER (for development/testing):
 *    - Install Charms CLI: https://github.com/CharmsDev/charms
 *    - Run: charms server
 *    - Prover will be at: http://localhost:17784
 *
 * 3. CHARMS CLI (for manual testing):
 *    - charms spell prove --spell=spell.yaml
 *    - charms spell cast (proves + signs + broadcasts)
 */

/** Charms hosted prover base URL (latest version) */
const CHARMS_HOSTED_PROVER_BASE = PROVER_API.production;

/** Local prover URL (for development) */
const LOCAL_PROVER_URL = PROVER_API.development;

/** Default Charms Prover API URL - use hosted prover by default */
const DEFAULT_PROVER_URL = CHARMS_HOSTED_PROVER_BASE;

/** Prover URL (configured via environment, falls back to hosted) */
const CONFIGURED_PROVER_URL = getConfiguredProverUrl();

/**
 * Get the prove endpoint for a given base URL
 * - Hosted prover (v11.charms.dev): /spells/prove
 * - Local prover (localhost:17784): /prove
 */
function getProveEndpoint(baseUrl: string): string {
  if (baseUrl.includes("charms.dev")) {
    return `${baseUrl}/spells/prove`;
  }
  // Local prover uses /prove
  return `${baseUrl}/prove`;
}

/** Default request timeout (2 minutes - proof generation can be slow) */
const DEFAULT_TIMEOUT_MS = HTTP_TIMEOUTS.PROVER;

/** Default retry configuration (BRO-style) */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 6,
  baseDelayMs: 3000,
  maxDelayMs: 30000,
  jitterPercent: 10,
};

// =============================================================================
// PRE-PROVER VALIDATION
// =============================================================================

/**
 * Validation result for pre-prover checks
 */
export interface PreProverValidationResult {
  valid: boolean;
  error?: string;
  computedHash?: string;
  computedLeadingZeros?: number;
}

/**
 * Validate PoW proof cryptographically BEFORE sending to prover.
 *
 * This prevents wasting prover resources on invalid proofs and provides
 * immediate feedback to the client.
 *
 * SECURITY: This is a client-side check. The prover also validates server-side.
 *
 * @param challenge - The pow_challenge (format: "timestamp:address")
 * @param nonce - The pow_nonce (hex string)
 * @param difficulty - The pow_difficulty (required leading zero bits)
 * @returns Validation result with computed hash if valid
 */
export async function validatePoWBeforeProver(
  challenge: string,
  nonce: string,
  difficulty: number,
): Promise<PreProverValidationResult> {
  // 1. Validate challenge format (timestamp:address)
  const challengeParts = challenge.split(":");
  if (challengeParts.length < 2) {
    return {
      valid: false,
      error: `Invalid challenge format. Expected "timestamp:address", got "${challenge}"`,
    };
  }

  // 2. Validate nonce is valid hex
  if (!/^[0-9a-fA-F]+$/.test(nonce)) {
    return {
      valid: false,
      error: `Invalid nonce format. Expected hexadecimal, got "${nonce}"`,
    };
  }

  // 3. Validate difficulty is reasonable
  if (difficulty < 16) {
    return {
      valid: false,
      error: `Difficulty too low. Minimum is 16, got ${difficulty}`,
    };
  }

  if (difficulty > 64) {
    return {
      valid: false,
      error: `Difficulty too high. Maximum is 64, got ${difficulty}`,
    };
  }

  // 4. Reconstruct blockData and compute hash
  // Format: challenge:nonce (same as miners use)
  const blockData = `${challenge}:${nonce}`;
  const computedHash = await hash256(blockData);
  const computedLeadingZeros = countLeadingZeroBits(computedHash);

  // 5. Verify hash meets difficulty
  if (computedLeadingZeros < difficulty) {
    return {
      valid: false,
      error: `Hash does not meet difficulty. Required ${difficulty} leading zeros, got ${computedLeadingZeros}`,
      computedHash,
      computedLeadingZeros,
    };
  }

  return {
    valid: true,
    computedHash,
    computedLeadingZeros,
  };
}

// =============================================================================
// PROVER CLIENT
// =============================================================================

/**
 * Charms Prover Client
 *
 * Handles communication with the Charms Proving Service for generating
 * ZK proofs that enable token minting on Bitcoin.
 *
 * @example
 * ```typescript
 * const client = new CharmsProverClient();
 *
 * const spell = createBABTCMintSpellV10({
 *   appId: '87b5ecfb...',
 *   appVk: 'ab70796e...',
 *   minerAddress: 'tb1p...',
 *   miningTxHex: '0200000001...',
 *   merkleProofHex: '...',
 *   miningUtxo: { txid: '...', vout: 0 },
 * });
 *
 * const { commitTx, spellTx } = await client.prove(spell);
 * // Now sign and broadcast both transactions
 * ```
 */
export class CharmsProverClient {
  private readonly proverUrl: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;
  private readonly debug: boolean;

  constructor(options: CharmsProverClientOptions = {}) {
    this.proverUrl = options.proverUrl || CONFIGURED_PROVER_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    this.debug = options.debug || false;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: options.maxRetries || DEFAULT_RETRY_CONFIG.maxAttempts,
    };
  }

  /**
   * Submit spell for proof generation
   *
   * Sends the spell to the Charms Prover API which:
   * 1. Validates the spell structure
   * 2. Verifies PoW or Merkle proof depending on spell type
   * 3. Generates ZK proof using SP1 zkVM
   * 4. Returns commit and spell transactions for signing
   *
   * @param spell - SpellV9 (PoW direct) or SpellV10 (Merkle proof)
   * @returns Commit and spell transaction hexes
   * @throws ProverError on failure
   */
  async prove(spell: SpellInput): Promise<ProverResponse> {
    // Log appropriate field based on spell version
    const logInfo =
      "version" in spell && spell.version === 11
        ? spell.app_public_inputs
        : (spell as SpellV9 | SpellV10).apps;
    this.log("Submitting spell for proof generation...", logInfo);

    // Validate spell has required fields
    this.validateSpell(spell);

    const payload: ProverRequest = { spell };

    // Submit with retry logic
    const response = await this.submitWithRetry(payload);

    this.log("Proof generated successfully", {
      commitTxLength: response.commitTx.length,
      spellTxLength: response.spellTx.length,
    });

    return response;
  }

  /**
   * Submit PoW spell for proof generation (convenience method)
   *
   * Specifically for SpellV9 format with PoW private_inputs.
   * Performs cryptographic validation before sending to prover.
   *
   * @param spell - SpellV9 with pow_challenge, pow_nonce, pow_difficulty
   * @returns Commit and spell transaction hexes
   */
  async provePoW(spell: SpellV9): Promise<ProverResponse> {
    this.log("Submitting PoW spell for proof generation...", {
      apps: spell.apps,
      hasPrivateInputs: !!spell.private_inputs,
    });

    // Validate PoW-specific fields (structure)
    this.validatePoWSpell(spell);

    // SECURITY: Validate PoW cryptographically before sending to prover
    // This prevents wasting prover resources on invalid proofs
    await this.validatePoWCryptographic(spell);

    return this.prove(spell);
  }

  /**
   * Submit V11 spell for proof generation (current format)
   *
   * V11 format separates private_inputs from the spell.
   * This is the recommended method for CLI v11.0.1+.
   * Performs cryptographic validation before sending to prover.
   *
   * @param request - ProverRequestV11 with spell, private_inputs, and funding info
   * @returns Commit and spell transaction hexes
   */
  async proveV11(request: ProverRequestV11): Promise<ProverResponse> {
    this.log("Submitting V11 spell for proof generation...", {
      version: request.spell.version,
      hasPrivateInputs: !!request.app_private_inputs,
      hasFundingUtxo: !!request.funding_utxo,
    });

    // Validate V11-specific fields (structure)
    this.validateSpellV11(request);

    // SECURITY: Validate PoW cryptographically before sending to prover
    await this.validatePoWCryptographicV11(request);

    // Submit with retry logic
    const response = await this.submitWithRetryV11(request);

    this.log("V11 proof generated successfully", {
      commitTxLength: response.commitTx.length,
      spellTxLength: response.spellTx.length,
    });

    return response;
  }

  /**
   * Submit V11 request with exponential backoff retry
   */
  private async submitWithRetryV11(
    request: ProverRequestV11,
  ): Promise<ProverResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.submitOnceV11(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx)
        if (
          error instanceof ProverError &&
          error.statusCode &&
          error.statusCode < 500
        ) {
          throw error;
        }

        // Calculate delay with jitter
        const delay = this.calculateBackoff(attempt);

        this.log(
          `V11 Attempt ${attempt}/${this.retryConfig.maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms...`,
        );

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw new ProverError(
      `Failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`,
      undefined,
      lastError || undefined,
    );
  }

  /**
   * Submit single V11 request to prover
   */
  private async submitOnceV11(
    request: ProverRequestV11,
  ): Promise<ProverResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const proveEndpoint = getProveEndpoint(this.proverUrl);

      // Prover expects spell as hex-encoded JSON string
      const spellJson = JSON.stringify(request.spell);
      const spellHex = this.stringToHex(spellJson);

      const proverPayload = {
        ...request,
        spell: spellHex,
        chain: "bitcoin",
      };

      const response = await fetch(proveEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby/1.0",
        },
        body: JSON.stringify(proverPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new ProverError(
          `Prover API error: ${response.status} - ${errorText}`,
          response.status,
        );
      }

      const data = (await response.json()) as ProverResponse;

      // Validate response
      if (!data.commitTx || !data.spellTx) {
        throw new ProverError("Invalid prover response: missing transactions");
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ProverError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ProverError(`Request timeout after ${this.timeout}ms`);
      }

      throw new ProverError(
        `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate V11 spell has required fields
   */
  private validateSpellV11(request: ProverRequestV11): void {
    const { spell, app_private_inputs } = request;

    // Check version
    if (spell.version !== 11) {
      throw new ProverError(`Expected version 11, got ${spell.version}`);
    }

    // Check for app_public_inputs
    if (
      !spell.app_public_inputs ||
      Object.keys(spell.app_public_inputs).length === 0
    ) {
      throw new ProverError(
        "Spell must have at least one app in app_public_inputs",
      );
    }

    // Check for transaction data
    if (!spell.tx) {
      throw new ProverError("Spell must have tx field");
    }

    // Check for inputs
    if (!spell.tx.ins || spell.tx.ins.length === 0) {
      throw new ProverError("Spell must have at least one input in tx.ins");
    }

    // Check for outputs
    if (!spell.tx.outs || spell.tx.outs.length === 0) {
      throw new ProverError("Spell must have at least one output in tx.outs");
    }

    // Check for private_inputs
    if (!app_private_inputs || Object.keys(app_private_inputs).length === 0) {
      throw new ProverError("Request must have app_private_inputs");
    }

    // Validate PoW private inputs
    for (const [appKey, inputs] of Object.entries(app_private_inputs)) {
      if (!inputs.pow_challenge) {
        throw new ProverError(`Missing pow_challenge for app ${appKey}`);
      }

      if (!inputs.pow_nonce) {
        throw new ProverError(`Missing pow_nonce for app ${appKey}`);
      }

      if (typeof inputs.pow_difficulty !== "number") {
        throw new ProverError(
          `Missing or invalid pow_difficulty for app ${appKey}`,
        );
      }

      if (inputs.pow_difficulty < 16) {
        throw new ProverError(
          `pow_difficulty must be at least 16, got ${inputs.pow_difficulty}`,
        );
      }
    }
  }

  /**
   * Check if prover service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.proverUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get prover service status
   */
  async getStatus(): Promise<{
    healthy: boolean;
    version?: string;
    queue?: number;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.proverUrl}/status`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { healthy: false };
      }

      const data = (await response.json()) as {
        version?: string;
        queue_length?: number;
      };

      return {
        healthy: true,
        version: data.version,
        queue: data.queue_length,
      };
    } catch {
      return { healthy: false };
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Validate spell has required fields for proving
   * Supports SpellV9 (PoW) and SpellV10 (Merkle proof)
   * NOTE: SpellV11 uses validateSpellV11() instead
   */
  private validateSpell(spell: SpellInput): void {
    // V11 spells should use proveV11() with validateSpellV11()
    if ("version" in spell && spell.version === 11) {
      throw new ProverError(
        "SpellV11 should use proveV11() method with ProverRequestV11",
      );
    }

    // Cast to V9/V10 type for validation
    const legacySpell = spell as SpellV9 | SpellV10;

    // Check for apps
    if (!legacySpell.apps || Object.keys(legacySpell.apps).length === 0) {
      throw new ProverError("Spell must have at least one app");
    }

    // Check for outputs
    if (!legacySpell.outs || legacySpell.outs.length === 0) {
      throw new ProverError("Spell must have at least one output");
    }

    // Check for inputs
    if (!legacySpell.ins || legacySpell.ins.length === 0) {
      throw new ProverError("Spell must have at least one input");
    }

    // Check for private_inputs
    if (!legacySpell.private_inputs) {
      throw new ProverError("Spell must have private_inputs");
    }

    // Determine spell type and validate accordingly
    if ("version" in legacySpell && legacySpell.version === 10) {
      // SpellV10 - validate Merkle proof inputs
      const hasValidInputs = Object.values(legacySpell.private_inputs).some(
        (inputs) => {
          const v10Inputs = inputs as { tx?: string; tx_block_proof?: string };
          return v10Inputs.tx && v10Inputs.tx_block_proof;
        },
      );

      if (!hasValidInputs) {
        throw new ProverError(
          "SpellV10 private_inputs must contain tx and tx_block_proof",
        );
      }
    } else {
      // SpellV9 - validate PoW inputs
      const hasValidInputs = Object.values(legacySpell.private_inputs).some(
        (inputs) => {
          const powInputs = inputs as PoWPrivateInputs;
          return (
            powInputs.pow_challenge &&
            powInputs.pow_nonce &&
            typeof powInputs.pow_difficulty === "number"
          );
        },
      );

      if (!hasValidInputs) {
        throw new ProverError(
          "SpellV9 private_inputs must contain pow_challenge, pow_nonce, and pow_difficulty",
        );
      }
    }
  }

  /**
   * Validate PoW spell has required fields
   */
  private validatePoWSpell(spell: SpellV9): void {
    if (!spell.private_inputs) {
      throw new ProverError("PoW spell must have private_inputs");
    }

    for (const [appKey, inputs] of Object.entries(spell.private_inputs)) {
      const powInputs = inputs as PoWPrivateInputs;

      if (!powInputs.pow_challenge) {
        throw new ProverError(`Missing pow_challenge for app ${appKey}`);
      }

      if (!powInputs.pow_nonce) {
        throw new ProverError(`Missing pow_nonce for app ${appKey}`);
      }

      if (typeof powInputs.pow_difficulty !== "number") {
        throw new ProverError(
          `Missing or invalid pow_difficulty for app ${appKey}`,
        );
      }

      if (powInputs.pow_difficulty < 16) {
        throw new ProverError(
          `pow_difficulty must be at least 16, got ${powInputs.pow_difficulty}`,
        );
      }
    }
  }

  /**
   * Cryptographically validate PoW before sending to prover
   *
   * SECURITY: Verifies hash meets difficulty to avoid wasting prover resources
   */
  private async validatePoWCryptographic(spell: SpellV9): Promise<void> {
    if (!spell.private_inputs) return;

    for (const [appKey, inputs] of Object.entries(spell.private_inputs)) {
      const powInputs = inputs as PoWPrivateInputs;

      const result = await validatePoWBeforeProver(
        powInputs.pow_challenge,
        powInputs.pow_nonce,
        powInputs.pow_difficulty,
      );

      if (!result.valid) {
        throw new ProverError(
          `Pre-prover validation failed for ${appKey}: ${result.error}`,
        );
      }

      this.log(`Pre-prover validation passed for ${appKey}`, {
        hash: result.computedHash?.slice(0, 16) + "...",
        leadingZeros: result.computedLeadingZeros,
        difficulty: powInputs.pow_difficulty,
      });
    }
  }

  /**
   * Cryptographically validate PoW for V11 spells before sending to prover
   */
  private async validatePoWCryptographicV11(
    request: ProverRequestV11,
  ): Promise<void> {
    if (!request.app_private_inputs) return;

    for (const [appKey, inputs] of Object.entries(request.app_private_inputs)) {
      const result = await validatePoWBeforeProver(
        inputs.pow_challenge,
        inputs.pow_nonce,
        inputs.pow_difficulty,
      );

      if (!result.valid) {
        throw new ProverError(
          `Pre-prover validation failed for ${appKey}: ${result.error}`,
        );
      }

      this.log(`V11 pre-prover validation passed for ${appKey}`, {
        hash: result.computedHash?.slice(0, 16) + "...",
        leadingZeros: result.computedLeadingZeros,
        difficulty: inputs.pow_difficulty,
      });
    }
  }

  /**
   * Submit request with exponential backoff retry
   */
  private async submitWithRetry(
    payload: ProverRequest,
  ): Promise<ProverResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.submitOnce(payload);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx)
        if (
          error instanceof ProverError &&
          error.statusCode &&
          error.statusCode < 500
        ) {
          throw error;
        }

        // Calculate delay with jitter
        const delay = this.calculateBackoff(attempt);

        this.log(
          `Attempt ${attempt}/${this.retryConfig.maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms...`,
        );

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw new ProverError(
      `Failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`,
      undefined,
      lastError || undefined,
    );
  }

  /**
   * Submit single request to prover
   */
  private async submitOnce(payload: ProverRequest): Promise<ProverResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const proveEndpoint = getProveEndpoint(this.proverUrl);
      const response = await fetch(proveEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new ProverError(
          `Prover API error: ${response.status} - ${errorText}`,
          response.status,
        );
      }

      const data = (await response.json()) as ProverResponse;

      // Validate response
      if (!data.commitTx || !data.spellTx) {
        throw new ProverError("Invalid prover response: missing transactions");
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ProverError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ProverError(`Request timeout after ${this.timeout}ms`);
      }

      throw new ProverError(
        `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Calculate backoff delay with jitter
   */
  private calculateBackoff(attempt: number): number {
    const { baseDelayMs, maxDelayMs, jitterPercent } = this.retryConfig;

    // Exponential backoff: baseDelay * 2^(attempt-1)
    // But capped at index 4 to prevent huge delays
    const exponentialDelay =
      baseDelayMs * Math.pow(2, Math.min(attempt - 1, 4));

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

    // Add jitter (±jitterPercent%)
    const jitter = cappedDelay * (jitterPercent / 100);
    const randomJitter = (Math.random() * 2 - 1) * jitter;

    return Math.round(cappedDelay + randomJitter);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Debug logging (uses centralized logger)
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      proverLog.debug(message, data as Record<string, unknown>);
    }
  }

  /**
   * Convert string to hex
   */
  private stringToHex(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Prover-specific error
 */
export class ProverError extends ApiError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error,
  ) {
    super("prover", statusCode, message);
    this.name = "ProverError";
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a Charms Prover client instance
 */
export function createCharmsProverClient(
  options?: CharmsProverClientOptions,
): CharmsProverClient {
  return new CharmsProverClient(options);
}

/**
 * Get default prover URL for network
 */
export function getProverUrl(
  network: "main" | "testnet4" = "testnet4",
): string {
  // Charms hosted prover works for both mainnet and testnet4
  return CONFIGURED_PROVER_URL;
}

/**
 * Get local prover URL (for development)
 */
export function getLocalProverUrl(): string {
  return LOCAL_PROVER_URL;
}

/**
 * Get Charms hosted prover base URL
 */
export function getHostedProverUrl(): string {
  return CHARMS_HOSTED_PROVER_BASE;
}
