/**
 * Mining Submitter
 *
 * Handles submission of mining proofs to Bitcoin network via Charms protocol.
 *
 * TWO FLOWS SUPPORTED:
 *
 * V9 Flow (PoW Direct - Recommended):
 * 1. Mine PoW → find valid hash
 * 2. Create V9 spell with pow_challenge, pow_nonce, pow_difficulty
 * 3. Submit to prover → get commit + spell TXs
 * 4. Sign and broadcast
 *
 * V10 Flow (With Merkle Proofs - Legacy):
 * 1. Mine PoW → create mining TX with OP_RETURN
 * 2. Broadcast mining TX and wait for confirmation
 * 3. Get Merkle proof of inclusion
 * 4. Create mint spell V10 with private_inputs
 * 5. Cast spell via Charms proving service
 *
 * Updated for Charms Protocol v9/v10 (March 2026)
 */

import { CharmsService, createCharmsService } from "../scrolls";
import {
  MempoolClient,
  createMempoolClient,
  getEncodedMerkleProof,
  type MerkleProof,
} from "../blockchain";
import { TransactionBuilder, createTransactionBuilder } from "../transactions";
import type { ScrollsNetwork } from "../scrolls/types";
import type { BitcoinNetwork } from "../types";
import type { UTXO } from "../blockchain/types";
import type {
  MiningSubmission,
  MiningProof,
  SubmissionResult,
  RewardParams,
} from "./types";
import {
  validateHash,
  validateNonce,
  validateDifficulty,
  validateTimestamp,
  assertValid,
} from "../validation";
import {
  createBABTCMintSpellV9,
  createBABTCMintSpellV10,
  createBABTCMintSpellV11,
  BABTC_CONFIG,
  calculateMiningReward,
  type TokenMintParamsV9,
  type TokenMintParamsV10,
  type TokenMintParamsV11,
} from "../charms/token";
import { CharmsProverClient, createCharmsProverClient } from "../charms/prover";
import type { SpellV9, SpellV11, ProverRequestV11 } from "../charms/types";
import { BABTC_TESTNET4 as BABTC_DEPLOYED } from "../config/deployment";

export interface MiningSubmitterOptions {
  network?: ScrollsNetwork;
  tokenTicker?: string;
  minerAddress: string;
  /**
   * Miner's public key (hex string, 33 bytes compressed or 65 bytes uncompressed)
   * Required for building valid PSBTs with Taproot inputs.
   * The x-only key (32 bytes) will be derived from this.
   */
  minerPublicKey?: string;
  rewardParams?: RewardParams;
  // SECURITY: Private key is no longer stored in the class
  // Pass it directly to submitProof/signAndBroadcast when needed
}

const DEFAULT_REWARD_PARAMS: RewardParams = {
  baseDifficulty: 16,
  baseReward: BigInt(1000),
  difficultyMultiplier: 2,
};

// Minimum UTXO value required for mining (from BRO: 7000 sats)
const MIN_UTXO_VALUE = 7000;

// Maximum reward cap to prevent exponential overflow
// Cap at 10^15 tokens per share (1 quadrillion) - generous but safe
const MAX_REWARD = BigInt("1000000000000000");

// Map ScrollsNetwork to BitcoinNetwork
function scrollsToBitcoinNetwork(network: ScrollsNetwork): BitcoinNetwork {
  return network === "main" ? "mainnet" : "testnet4";
}

/**
 * Mining Submitter Service
 *
 * Connects mining proof-of-work with Charms protocol for token minting.
 * Supports both V9 (PoW direct) and V10 (Merkle proof) flows.
 */
export class MiningSubmitter {
  private charmsService: CharmsService;
  private proverClient: CharmsProverClient;
  private mempoolClient: MempoolClient;
  private txBuilder: TransactionBuilder;
  private minerAddress: string;
  private minerXOnlyPubKey: Uint8Array | undefined;
  private rewardParams: RewardParams;
  private network: ScrollsNetwork;
  private pendingSubmissions: Map<string, MiningSubmission> = new Map();

  constructor(options: MiningSubmitterOptions) {
    this.network = options.network ?? "testnet4";
    const btcNetwork = scrollsToBitcoinNetwork(this.network);

    this.charmsService = createCharmsService({
      network: this.network,
      tokenTicker: options.tokenTicker ?? "BABY",
    });

    this.proverClient = createCharmsProverClient({
      debug: false,
    });

    this.mempoolClient = createMempoolClient({
      network: btcNetwork,
    });

    this.txBuilder = createTransactionBuilder({
      network: btcNetwork,
    });

    this.minerAddress = options.minerAddress;
    this.rewardParams = options.rewardParams ?? DEFAULT_REWARD_PARAMS;

    // Extract x-only public key from compressed/uncompressed public key
    if (options.minerPublicKey) {
      const pubKeyBytes = Buffer.from(options.minerPublicKey, "hex");
      if (pubKeyBytes.length === 33) {
        // Compressed: first byte is 02 or 03, x-only is bytes 1-32
        this.minerXOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));
      } else if (pubKeyBytes.length === 65) {
        // Uncompressed: first byte is 04, x-only is bytes 1-32
        this.minerXOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));
      } else {
        throw new Error(
          `Invalid public key length: ${pubKeyBytes.length}. Expected 33 (compressed) or 65 (uncompressed).`,
        );
      }
    }
  }

  // SECURITY: setPrivateKey and clearPrivateKey removed
  // Private keys should be passed directly to signing methods
  // and zeroed immediately after use by the caller

  /**
   * Calculate reward based on difficulty
   * Formula inspired by BRO: reward = baseReward * multiplier^(difficulty - baseDifficulty)
   *
   * SECURITY: Reward is capped at MAX_REWARD to prevent exponential overflow
   * with high difficulty values (e.g., difficulty=256 would produce 2^240 * 1000)
   */
  calculateReward(difficulty: number): bigint {
    assertValid(
      validateDifficulty(difficulty),
      "difficulty",
      "INVALID_DIFFICULTY",
    );

    const { baseDifficulty, baseReward, difficultyMultiplier } =
      this.rewardParams;

    if (difficulty <= baseDifficulty) {
      return baseReward;
    }

    const extraDifficulty = BigInt(difficulty - baseDifficulty);
    const multiplierBase = BigInt(difficultyMultiplier);

    // Cap extra difficulty to prevent astronomical numbers
    // With multiplier=2, extraDifficulty=50 gives 2^50 * baseReward ≈ 10^15 * baseReward
    // This is already more than MAX_REWARD for baseReward=1000
    const maxSafeExtraDifficulty = BigInt(50);
    const cappedExtraDifficulty =
      extraDifficulty > maxSafeExtraDifficulty
        ? maxSafeExtraDifficulty
        : extraDifficulty;

    const multiplier = multiplierBase ** cappedExtraDifficulty;
    const reward = baseReward * multiplier;

    // Final cap to ensure we never exceed MAX_REWARD
    return reward > MAX_REWARD ? MAX_REWARD : reward;
  }

  /**
   * Check if miner has sufficient balance for mining transaction
   */
  async checkMinerBalance(): Promise<{
    canMine: boolean;
    balance: number;
    utxoCount: number;
    largestUtxo: number;
    error?: string;
  }> {
    try {
      const balance = await this.mempoolClient.getBalance(this.minerAddress);
      const utxos = await this.mempoolClient.getUTXOs(this.minerAddress);

      const largestUtxo = utxos.reduce((max, u) => Math.max(max, u.value), 0);
      const hasValidUtxo = largestUtxo >= MIN_UTXO_VALUE;

      return {
        canMine: hasValidUtxo,
        balance: balance.total,
        utxoCount: utxos.length,
        largestUtxo,
        error: hasValidUtxo
          ? undefined
          : `Need at least one UTXO with ${MIN_UTXO_VALUE} sats. Largest: ${largestUtxo}`,
      };
    } catch (error) {
      return {
        canMine: false,
        balance: 0,
        utxoCount: 0,
        largestUtxo: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get fee estimates from mempool
   */
  async getFeeEstimates(): Promise<{
    fast: number;
    medium: number;
    slow: number;
    charmsFee: number;
  }> {
    const [mempoolFees, charmsConfig] = await Promise.all([
      this.mempoolClient.getFeeEstimates(),
      this.charmsService.getClient().getConfig(),
    ]);

    // Estimate Charms fee for 1 input
    const charmsFee =
      charmsConfig.fixed_cost +
      charmsConfig.fee_per_input +
      Math.floor((charmsConfig.fee_basis_points / 10000) * MIN_UTXO_VALUE);

    return {
      fast: mempoolFees.fastestFee,
      medium: mempoolFees.halfHourFee,
      slow: mempoolFees.economyFee,
      charmsFee,
    };
  }

  /**
   * Submit a mining proof for token minting
   *
   * COMPLETE FLOW:
   * 1. Validate proof
   * 2. Calculate reward
   * 3. Create Charms spell
   * 4. Get UTXOs
   * 5. Build Bitcoin transaction
   * 6. Sign transaction
   * 7. Broadcast to network
   */
  async submitProof(proof: MiningProof): Promise<SubmissionResult> {
    // Validate proof inputs
    assertValid(validateHash(proof.hash), "hash", "INVALID_HASH");
    assertValid(validateNonce(proof.nonce), "nonce", "INVALID_NONCE");
    assertValid(
      validateDifficulty(proof.difficulty),
      "difficulty",
      "INVALID_DIFFICULTY",
    );
    assertValid(
      validateTimestamp(proof.timestamp),
      "timestamp",
      "INVALID_TIMESTAMP",
    );

    const submissionId = `${proof.hash.substring(0, 16)}-${proof.nonce}`;

    // Check if already submitted
    if (this.pendingSubmissions.has(submissionId)) {
      const existing = this.pendingSubmissions.get(submissionId)!;
      return {
        success: existing.status === "confirmed",
        submission: existing,
        txid: existing.txid,
        error: existing.error,
      };
    }

    // Create submission record
    const submission: MiningSubmission = {
      id: submissionId,
      hash: proof.hash,
      nonce: proof.nonce,
      difficulty: proof.difficulty,
      timestamp: proof.timestamp,
      minerAddress: this.minerAddress,
      blockData: proof.blockData,
      status: "pending",
      reward: this.calculateReward(proof.difficulty),
    };

    this.pendingSubmissions.set(submissionId, submission);

    try {
      // Step 1: Get UTXOs
      const utxos = await this.mempoolClient.getUTXOs(this.minerAddress);

      if (utxos.length === 0) {
        throw new Error("No UTXOs available for mining transaction");
      }

      // Filter UTXOs that are large enough
      const validUtxos = utxos.filter((u) => u.value >= MIN_UTXO_VALUE);
      if (validUtxos.length === 0) {
        throw new Error(`No UTXOs with at least ${MIN_UTXO_VALUE} sats`);
      }

      // Step 2: Create mining spell
      const spell = this.charmsService.createMiningSpell(
        this.minerAddress,
        submission.reward!,
        proof.hash,
      );

      // Step 3: Get Charms fee info
      const [feeCalc, feeEstimates] = await Promise.all([
        this.charmsService.calculateFee(1, validUtxos[0].value),
        this.mempoolClient.getFeeEstimates(),
      ]);

      // Set fee rate (use medium fee)
      this.txBuilder.setFeeRate(feeEstimates.halfHourFee);

      // Step 4: Convert UTXOs for transaction builder
      // Note: minerXOnlyPubKey is required for Taproot addresses
      if (!this.minerXOnlyPubKey) {
        throw new Error(
          "minerPublicKey is required for Taproot mining transactions. " +
            "Pass it when creating the MiningSubmitter.",
        );
      }
      const txUtxos = TransactionBuilder.convertUTXOs(
        validUtxos,
        this.minerAddress,
        scrollsToBitcoinNetwork(this.network),
        this.minerXOnlyPubKey,
      );

      // Step 5: Build mining transaction
      const tx = this.txBuilder.buildMiningTx(
        txUtxos,
        this.minerAddress,
        spell,
        feeCalc.feeAddress,
        feeCalc.fee,
      );

      // Step 6: Build PSBT
      const psbt = this.txBuilder.buildPSBT(tx, tx.spellWitness);

      // Update submission status
      submission.status = "submitted";
      submission.submittedAt = Date.now();

      // SECURITY: Auto-broadcast removed. Callers must use signAndBroadcast()
      // with a private key that is zeroed immediately after use.
      // Return PSBT for external signing
      return {
        success: true,
        submission,
        psbt: psbt.toBase64(),
        unsignedTx: tx,
      };
    } catch (error) {
      submission.status = "failed";
      submission.error =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        submission,
        error: submission.error,
      };
    }
  }

  /**
   * Sign and broadcast a pending PSBT
   *
   * SECURITY: The caller MUST zero the privateKey immediately after this call returns.
   * Use a try/finally block: privateKey.fill(0) in finally.
   *
   * @param psbtBase64 - The PSBT in base64 format
   * @param privateKey - The private key for signing (required, will be used but NOT stored)
   */
  async signAndBroadcast(
    psbtBase64: string,
    privateKey: Uint8Array,
  ): Promise<{ success: boolean; txid?: string; error?: string }> {
    if (!privateKey || privateKey.length !== 32) {
      return { success: false, error: "Invalid private key" };
    }

    try {
      // Import PSBT
      const { Psbt } = await import("bitcoinjs-lib");
      const psbt = Psbt.fromBase64(psbtBase64);

      // Sign
      this.txBuilder.signPSBT(psbt, privateKey);
      const signedTx = this.txBuilder.finalizePSBT(psbt);

      // Broadcast
      const txid = await this.mempoolClient.broadcastTransaction(signedTx.hex);

      return { success: true, txid };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
    // NOTE: Caller is responsible for zeroing privateKey in a finally block
  }

  /**
   * Get pending submissions
   */
  getPendingSubmissions(): MiningSubmission[] {
    return Array.from(this.pendingSubmissions.values()).filter(
      (s) => s.status === "pending" || s.status === "submitted",
    );
  }

  /**
   * Get submission by ID
   */
  getSubmission(id: string): MiningSubmission | undefined {
    return this.pendingSubmissions.get(id);
  }

  /**
   * Get total pending rewards
   */
  getTotalPendingRewards(): bigint {
    let total = BigInt(0);
    for (const submission of this.pendingSubmissions.values()) {
      if (
        submission.reward &&
        (submission.status === "pending" || submission.status === "submitted")
      ) {
        total += submission.reward;
      }
    }
    return total;
  }

  /**
   * Get total confirmed rewards
   */
  getTotalConfirmedRewards(): bigint {
    let total = BigInt(0);
    for (const submission of this.pendingSubmissions.values()) {
      if (submission.reward && submission.status === "confirmed") {
        total += submission.reward;
      }
    }
    return total;
  }

  /**
   * Check transaction confirmation status
   */
  async checkConfirmation(txid: string): Promise<{
    confirmed: boolean;
    confirmations: number;
    blockHeight?: number;
  }> {
    try {
      const tx = await this.mempoolClient.getTransaction(txid);
      const confirmed = tx.status?.confirmed ?? false;
      const blockHeight = tx.status?.block_height;

      let confirmations = 0;
      if (confirmed && blockHeight) {
        const currentHeight = await this.mempoolClient.getBlockHeight();
        confirmations = currentHeight - blockHeight + 1;
      }

      return { confirmed, confirmations, blockHeight };
    } catch {
      return { confirmed: false, confirmations: 0 };
    }
  }

  /**
   * Clear old submissions
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [id, submission] of this.pendingSubmissions) {
      if (now - submission.timestamp > maxAge) {
        if (submission.status !== "confirmed") {
          submission.status = "expired";
        }
        if (submission.status === "expired") {
          this.pendingSubmissions.delete(id);
        }
      }
    }
  }

  // ==========================================================================
  // V9 POW DIRECT FLOW (Recommended)
  // ==========================================================================

  /**
   * Submit proof using V9 PoW direct flow (Recommended)
   *
   * SIMPLIFIED FLOW:
   * 1. Mine finds valid PoW (challenge:nonce -> hash with D bits)
   * 2. Create V9 spell with pow_challenge, pow_nonce, pow_difficulty
   * 3. Submit to prover -> get commit + spell TXs
   * 4. Return TXs for signing and broadcast
   *
   * No mining TX or Merkle proofs needed!
   */
  async submitProofV9(
    proof: MiningProof,
    inputUtxo: { txid: string; vout: number },
    options: {
      /** App ID for BABTC token */
      appId?: string;
      /** Verification key */
      appVk?: string;
    } = {},
  ): Promise<SubmissionResultV9> {
    // Validate proof inputs
    assertValid(validateHash(proof.hash), "hash", "INVALID_HASH");
    assertValid(validateNonce(proof.nonce), "nonce", "INVALID_NONCE");
    assertValid(
      validateDifficulty(proof.difficulty),
      "difficulty",
      "INVALID_DIFFICULTY",
    );

    const submissionId = `v9-${proof.hash.substring(0, 16)}-${proof.nonce}`;

    try {
      // Build challenge string from blockData or use default
      const challenge =
        proof.blockData || `${proof.timestamp}:${this.minerAddress}`;

      // Create V9 spell
      const spell = createBABTCMintSpellV9({
        appId: options.appId ?? BABTC_DEPLOYED.appId,
        appVk: options.appVk ?? BABTC_DEPLOYED.appVk,
        minerAddress: this.minerAddress,
        devAddress: BABTC_CONFIG.addresses.devFund,
        stakingAddress: BABTC_CONFIG.addresses.stakingPool,
        challenge,
        nonce: String(proof.nonce),
        difficulty: proof.difficulty,
        inputUtxo,
      });

      // Submit to prover
      const proverResponse = await this.proverClient.provePoW(spell);

      // Calculate reward
      const reward = calculateMiningReward(proof.difficulty);

      return {
        success: true,
        phase: "ready_to_broadcast",
        submissionId,
        spell,
        commitTxHex: proverResponse.commitTx,
        spellTxHex: proverResponse.spellTx,
        reward: reward.minerShare,
        message: "Sign and broadcast commit + spell TXs to claim your reward",
      };
    } catch (error) {
      return {
        success: false,
        phase: "failed",
        submissionId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get available UTXOs for V9 minting
   */
  async getAvailableUtxosForV9(): Promise<
    Array<{ txid: string; vout: number; value: number }>
  > {
    const utxos = await this.mempoolClient.getUTXOs(this.minerAddress);
    return utxos
      .filter((u) => u.value >= 2000) // Min 2000 sats for V9
      .sort((a, b) => b.value - a.value) // Largest first
      .map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
      }));
  }

  // ==========================================================================
  // V11 POW DIRECT FLOW (CLI v11.0.1 - Current)
  // ==========================================================================

  /**
   * Submit proof using V11 PoW direct flow (Current - Recommended)
   *
   * FLOW:
   * 1. Mine finds valid PoW (challenge:nonce -> hash with D bits)
   * 2. Create V11 spell (private_inputs passed separately)
   * 3. Submit to prover -> get commit + spell TXs
   * 4. Return TXs for signing and broadcast
   *
   * This is the current format for CLI v11.0.1+.
   */
  async submitProofV11(
    proof: MiningProof,
    inputUtxo: { txid: string; vout: number },
    options: {
      /** App ID for BABTC token */
      appId?: string;
      /** Verification key */
      appVk?: string;
      /** Funding UTXO for fees (optional, will use inputUtxo if not provided) */
      fundingUtxo?: { txid: string; vout: number; value: number };
      /** Change address (defaults to minerAddress) */
      changeAddress?: string;
    } = {},
  ): Promise<SubmissionResultV11> {
    // Validate proof inputs
    assertValid(validateHash(proof.hash), "hash", "INVALID_HASH");
    assertValid(validateNonce(proof.nonce), "nonce", "INVALID_NONCE");
    assertValid(
      validateDifficulty(proof.difficulty),
      "difficulty",
      "INVALID_DIFFICULTY",
    );

    const submissionId = `v11-${proof.hash.substring(0, 16)}-${proof.nonce}`;

    try {
      // Build challenge string from blockData or use default
      const challenge =
        proof.blockData || `${proof.timestamp}:${this.minerAddress}`;

      // Create V11 spell with separate private_inputs
      const { spell, proverRequest } = createBABTCMintSpellV11({
        appId: options.appId ?? BABTC_DEPLOYED.appId,
        appVk: options.appVk ?? BABTC_DEPLOYED.appVk,
        minerAddress: this.minerAddress,
        devAddress: BABTC_CONFIG.addresses.devFund,
        stakingAddress: BABTC_CONFIG.addresses.stakingPool,
        challenge,
        nonce: String(proof.nonce),
        difficulty: proof.difficulty,
        inputUtxo,
        fundingUtxo: options.fundingUtxo,
        changeAddress: options.changeAddress || this.minerAddress,
      });

      // Submit to prover using V11 format
      const proverResponse = await this.proverClient.proveV11(proverRequest);

      // Calculate reward
      const reward = calculateMiningReward(proof.difficulty);

      return {
        success: true,
        phase: "ready_to_broadcast",
        submissionId,
        spell,
        proverRequest,
        commitTxHex: proverResponse.commitTx,
        spellTxHex: proverResponse.spellTx,
        reward: reward.minerShare,
        message: "Sign and broadcast commit + spell TXs to claim your reward",
      };
    } catch (error) {
      return {
        success: false,
        phase: "failed",
        submissionId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get available UTXOs for V11 minting
   */
  async getAvailableUtxosForV11(): Promise<
    Array<{ txid: string; vout: number; value: number }>
  > {
    const utxos = await this.mempoolClient.getUTXOs(this.minerAddress);
    return utxos
      .filter((u) => u.value >= 2000) // Min 2000 sats
      .sort((a, b) => b.value - a.value) // Largest first
      .map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
      }));
  }

  // ==========================================================================
  // V10 BRO-STYLE MINING FLOW (Legacy - with Merkle proofs)
  // ==========================================================================

  /**
   * Submit proof using V10 BRO-style flow
   *
   * COMPLETE BRO-STYLE FLOW:
   * 1. Build mining TX with OP_RETURN containing challenge + nonce + hash
   * 2. Sign and broadcast mining TX
   * 3. Wait for confirmation (returns PSBT for step 4-5 if not confirmed yet)
   * 4. Get Merkle proof of inclusion
   * 5. Create V10 mint spell with private_inputs
   * 6. Build mint TX (PSBT) for external signing
   *
   * This is a multi-step process. Call this method multiple times:
   * - First call: Returns PSBT for mining TX signing
   * - After mining TX confirmed: Returns PSBT for mint spell TX signing
   */
  async submitProofV10(
    proof: MiningProof,
    options: {
      /** App ID for BABTC token (required for real testnet4 deployment) */
      appId?: string;
      /** Verification key (required for real testnet4 deployment) */
      appVk?: string;
      /** Skip mining TX and use existing confirmed txid */
      existingMiningTxid?: string;
      /** Mining TX hex (if already built) */
      existingMiningTxHex?: string;
    } = {},
  ): Promise<SubmissionResultV10> {
    // Validate proof inputs
    assertValid(validateHash(proof.hash), "hash", "INVALID_HASH");
    assertValid(validateNonce(proof.nonce), "nonce", "INVALID_NONCE");
    assertValid(
      validateDifficulty(proof.difficulty),
      "difficulty",
      "INVALID_DIFFICULTY",
    );

    const submissionId = `v10-${proof.hash.substring(0, 16)}-${proof.nonce}`;

    try {
      // Step 1-3: Mining TX (can be skipped if already confirmed)
      let miningTxid: string;
      let miningTxHex: string;

      if (options.existingMiningTxid && options.existingMiningTxHex) {
        // Use existing confirmed mining TX
        miningTxid = options.existingMiningTxid;
        miningTxHex = options.existingMiningTxHex;
      } else {
        // Build mining TX with OP_RETURN
        const miningTxResult = await this.buildMiningTxWithOpReturn(proof);

        if (!miningTxResult.success) {
          return {
            success: false,
            phase: "mining_tx_build",
            error: miningTxResult.error,
          };
        }

        // Return PSBT for signing
        return {
          success: true,
          phase: "mining_tx_ready",
          miningPsbt: miningTxResult.psbt,
          miningTxHex: miningTxResult.txHex,
          submissionId,
          message:
            "Sign and broadcast the mining TX, then call submitProofV10 again with existingMiningTxid",
        };
      }

      // Step 4: Wait for confirmation and get Merkle proof
      const merkleResult = await this.fetchMerkleProofForMiningTx(miningTxid);

      if (!merkleResult.success) {
        return {
          success: false,
          phase: "merkle_proof",
          error: merkleResult.error,
          miningTxid,
        };
      }

      // Step 5: Create V10 mint spell
      const appId = options.appId ?? BABTC_DEPLOYED.appId;
      const appVk = options.appVk ?? BABTC_DEPLOYED.appVk;

      const reward = this.calculateReward(proof.difficulty);

      const spellParams: TokenMintParamsV10 = {
        appId,
        appVk,
        minerAddress: this.minerAddress,
        devAddress: BABTC_CONFIG.addresses.devFund,
        stakingAddress: BABTC_CONFIG.addresses.stakingPool,
        leadingZeros: proof.difficulty, // BRO-style: difficulty determines reward
        miningTxHex,
        merkleProofHex: merkleResult.merkleProofHex!,
        miningUtxo: {
          txid: miningTxid,
          vout: 0, // First output is the spell input
        },
      };

      const spell = createBABTCMintSpellV10(spellParams);

      // Step 6: Build mint TX PSBT
      const mintTxResult = await this.buildMintTxFromSpellV10(
        spell,
        miningTxid,
      );

      if (!mintTxResult.success) {
        return {
          success: false,
          phase: "mint_tx_build",
          error: mintTxResult.error,
          miningTxid,
        };
      }

      return {
        success: true,
        phase: "mint_tx_ready",
        mintPsbt: mintTxResult.psbt,
        spell,
        miningTxid,
        merkleProof: merkleResult.merkleProof,
        reward,
        submissionId,
        message: "Sign and broadcast the mint TX to claim your reward",
      };
    } catch (error) {
      return {
        success: false,
        phase: "unknown",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wait for mining TX confirmation and complete the mint flow
   *
   * This is a convenience method that:
   * 1. Polls for mining TX confirmation
   * 2. Gets Merkle proof
   * 3. Creates mint spell PSBT
   *
   * @param miningTxid - TXID of the signed and broadcast mining TX
   * @param miningTxHex - Raw hex of the mining TX
   * @param proof - Original mining proof
   * @param options - App ID and VK options
   * @param pollInterval - Polling interval in ms (default 30s)
   * @param maxAttempts - Max polling attempts (default 20 = 10 minutes)
   */
  async waitForMiningTxAndComplete(
    miningTxid: string,
    miningTxHex: string,
    proof: MiningProof,
    options: {
      appId?: string;
      appVk?: string;
      pollInterval?: number;
      maxAttempts?: number;
    } = {},
  ): Promise<SubmissionResultV10> {
    const pollInterval = options.pollInterval ?? 30000;
    const maxAttempts = options.maxAttempts ?? 20;

    // Poll for confirmation
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { confirmed, confirmations } =
        await this.checkConfirmation(miningTxid);

      if (confirmed && confirmations >= 1) {
        // Mining TX confirmed, now complete the flow
        return this.submitProofV10(proof, {
          appId: options.appId,
          appVk: options.appVk,
          existingMiningTxid: miningTxid,
          existingMiningTxHex: miningTxHex,
        });
      }

      // Wait before next attempt
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    return {
      success: false,
      phase: "confirmation_timeout",
      error: `Mining TX not confirmed after ${maxAttempts} attempts`,
      miningTxid,
    };
  }

  /**
   * Build mining TX with OP_RETURN
   *
   * The OP_RETURN contains: challenge (txid:vout) + nonce + hash
   * Output 0: 700 sats for spell input (goes to miner address)
   * Output 1: change
   */
  private async buildMiningTxWithOpReturn(proof: MiningProof): Promise<{
    success: boolean;
    psbt?: string;
    txHex?: string;
    error?: string;
  }> {
    try {
      // Get UTXOs
      const utxos = await this.mempoolClient.getUTXOs(this.minerAddress);
      const validUtxos = utxos.filter((u) => u.value >= MIN_UTXO_VALUE);

      if (validUtxos.length === 0) {
        return {
          success: false,
          error: `No UTXOs with at least ${MIN_UTXO_VALUE} sats`,
        };
      }

      // Check x-only public key
      if (!this.minerXOnlyPubKey) {
        return {
          success: false,
          error: "minerPublicKey is required for Taproot mining transactions",
        };
      }

      // Build OP_RETURN data: challenge:nonce:hash
      const opReturnData = `${proof.blockData || "challenge"}:${proof.nonce}:${proof.hash}`;

      // Convert UTXOs
      const txUtxos = TransactionBuilder.convertUTXOs(
        validUtxos,
        this.minerAddress,
        scrollsToBitcoinNetwork(this.network),
        this.minerXOnlyPubKey,
      );

      // Get fee estimates
      const feeEstimates = await this.mempoolClient.getFeeEstimates();
      this.txBuilder.setFeeRate(feeEstimates.halfHourFee);

      // Build TX with OP_RETURN
      const tx = this.txBuilder.buildMiningTxWithOpReturn(
        txUtxos,
        this.minerAddress,
        opReturnData,
        MIN_SPELL_OUTPUT_SATS, // 700 sats for spell input
      );

      // Build PSBT
      const psbt = this.txBuilder.buildPSBT(tx);

      return {
        success: true,
        psbt: psbt.toBase64(),
        txHex: tx.hex,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch Merkle proof for a confirmed mining TX
   */
  private async fetchMerkleProofForMiningTx(txid: string): Promise<{
    success: boolean;
    merkleProof?: MerkleProof;
    merkleProofHex?: string;
    error?: string;
  }> {
    try {
      // Check if TX is confirmed
      const tx = await this.mempoolClient.getTransaction(txid);

      if (!tx.status?.confirmed) {
        return {
          success: false,
          error: `Mining TX ${txid} not yet confirmed. Wait for confirmation.`,
        };
      }

      // Get encoded Merkle proof (includes block info for proper encoding)
      const { proof: merkleProof, hex: merkleProofHex } =
        await getEncodedMerkleProof(this.mempoolClient, txid);

      return {
        success: true,
        merkleProof,
        merkleProofHex,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Build mint TX from V10 spell
   */
  private async buildMintTxFromSpellV10(
    spell: ReturnType<typeof createBABTCMintSpellV10>,
    miningTxid: string,
  ): Promise<{
    success: boolean;
    psbt?: string;
    error?: string;
  }> {
    try {
      // Get UTXOs (need additional for fees)
      const utxos = await this.mempoolClient.getUTXOs(this.minerAddress);

      if (utxos.length === 0) {
        return {
          success: false,
          error: "No UTXOs available for mint transaction fees",
        };
      }

      // Check x-only public key
      if (!this.minerXOnlyPubKey) {
        return {
          success: false,
          error: "minerPublicKey is required for Taproot transactions",
        };
      }

      // Get fee info
      const [feeCalc, feeEstimates] = await Promise.all([
        this.charmsService.calculateFee(1, utxos[0].value),
        this.mempoolClient.getFeeEstimates(),
      ]);

      this.txBuilder.setFeeRate(feeEstimates.halfHourFee);

      // Convert UTXOs
      const txUtxos = TransactionBuilder.convertUTXOs(
        utxos,
        this.minerAddress,
        scrollsToBitcoinNetwork(this.network),
        this.minerXOnlyPubKey,
      );

      // Build TX with V10 spell
      const tx = this.txBuilder.buildMiningTx(
        txUtxos,
        this.minerAddress,
        spell,
        feeCalc.feeAddress,
        feeCalc.fee,
      );

      // Build PSBT with spell witness
      const psbt = this.txBuilder.buildPSBT(tx, tx.spellWitness);

      return {
        success: true,
        psbt: psbt.toBase64(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wait for mining TX confirmation
   *
   * Polls until confirmed or timeout
   */
  async waitForMiningTxConfirmation(
    txid: string,
    options: {
      timeoutMs?: number;
      pollIntervalMs?: number;
      onProgress?: (status: string) => void;
    } = {},
  ): Promise<{
    confirmed: boolean;
    blockHash?: string;
    blockHeight?: number;
    error?: string;
  }> {
    const { timeoutMs = 600000, pollIntervalMs = 10000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const tx = await this.mempoolClient.getTransaction(txid);

        if (tx.status?.confirmed) {
          return {
            confirmed: true,
            blockHash: tx.status.block_hash,
            blockHeight: tx.status.block_height,
          };
        }

        options.onProgress?.(
          `Waiting for confirmation... (${Math.floor((Date.now() - startTime) / 1000)}s)`,
        );

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } catch (error) {
        // Transaction might not be visible yet, keep polling
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    return {
      confirmed: false,
      error: `Transaction ${txid} not confirmed within ${timeoutMs}ms`,
    };
  }
}

// =============================================================================
// V9 TYPES (PoW Direct)
// =============================================================================

/**
 * Result from V9 submission flow (simplified)
 */
export interface SubmissionResultV9 {
  success: boolean;
  phase: "ready_to_broadcast" | "failed";
  submissionId: string;
  error?: string;
  message?: string;

  /** V9 spell with PoW private_inputs */
  spell?: SpellV9;
  /** Commit TX hex from prover (needs signing) */
  commitTxHex?: string;
  /** Spell TX hex from prover (needs signing) */
  spellTxHex?: string;
  /** Calculated miner reward */
  reward?: bigint;
}

// =============================================================================
// V10 TYPES (With Merkle Proofs)
// =============================================================================

/**
 * Result from V10 submission flow
 */
export interface SubmissionResultV10 {
  success: boolean;
  phase:
    | "mining_tx_build"
    | "mining_tx_ready"
    | "merkle_proof"
    | "mint_tx_build"
    | "mint_tx_ready"
    | "confirmation_timeout"
    | "unknown";
  error?: string;
  message?: string;

  // Mining TX phase
  miningPsbt?: string;
  miningTxHex?: string;
  miningTxid?: string;

  // Mint TX phase
  mintPsbt?: string;
  spell?: ReturnType<typeof createBABTCMintSpellV10>;
  merkleProof?: MerkleProof;
  reward?: bigint;

  submissionId?: string;
}

// =============================================================================
// V11 TYPES (CLI v11.0.1 - Current)
// =============================================================================

/**
 * Result from V11 submission flow
 */
export interface SubmissionResultV11 {
  success: boolean;
  phase: "ready_to_broadcast" | "failed";
  submissionId: string;
  error?: string;
  message?: string;

  /** V11 spell (without private_inputs) */
  spell?: SpellV11;
  /** Full prover request (includes private_inputs) */
  proverRequest?: ProverRequestV11;
  /** Commit TX hex from prover (needs signing) */
  commitTxHex?: string;
  /** Spell TX hex from prover (needs signing) */
  spellTxHex?: string;
  /** Calculated miner reward */
  reward?: bigint;
}

// BABTC deployment config imported from ../config/deployment.ts
// Single source of truth for appId and appVk

// Minimum sats for spell outputs (from Charms protocol)
const MIN_SPELL_OUTPUT_SATS = 700;

/**
 * Create a mining submitter instance
 */
export function createMiningSubmitter(
  options: MiningSubmitterOptions,
): MiningSubmitter {
  return new MiningSubmitter(options);
}
