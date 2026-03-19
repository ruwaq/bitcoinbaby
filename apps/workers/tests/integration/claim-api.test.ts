/**
 * Claim API Integration Tests
 *
 * Tests the complete claim settlement flow:
 * 1. GET /api/claim/balance/:address - Get claimable balance
 * 2. POST /api/claim/prepare - Prepare claim (aggregate proofs)
 * 3. POST /api/claim/confirm - Confirm TX broadcast
 * 4. POST /api/claim/mint - Complete minting
 * 5. GET /api/claim/status/:claimId - Check claim status
 * 6. GET /api/claim/history/:address - Get claim history
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateValidProof,
  generateClaimData,
  generateTxid,
  TEST_ADDRESSES,
  MIN_DIFFICULTY,
} from "../fixtures";

// =============================================================================
// TYPES
// =============================================================================

type ClaimStatus =
  | "prepared"
  | "broadcast"
  | "confirmed"
  | "minting"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

interface ClaimableBalance {
  address: string;
  unclaimedWork: string;
  unclaimedProofs: number;
  claimableTokens: string;
  estimatedFee: number;
  platformFeePercent: number;
  platformFeeTokens: string;
  netTokens: string;
}

interface PreparedClaim {
  claimData: {
    claimId: string;
    proof: {
      address: string;
      totalWork: string;
      tokenAmount: string;
      merkleRoot: string;
      nonce: string;
    };
    serverSignature: string;
    opReturnData: string;
  };
  totalWork: string;
  proofCount: number;
  tokenAmount: string;
  estimatedFee: number;
  expiresAt: number;
  platformFeePercent: number;
  netTokens: string;
}

interface ClaimRecord {
  id: string;
  address: string;
  amount: bigint;
  proofCount: number;
  totalWork: bigint;
  merkleRoot: string;
  serverSignature: string;
  opReturnData: string;
  claimTxid: string | null;
  mintTxid: string | null;
  status: ClaimStatus;
  error: string | null;
  preparedAt: number;
  confirmedAt: number | null;
  mintedAt: number | null;
  expiresAt: number;
}

// =============================================================================
// MOCK CLAIM API CLIENT
// =============================================================================

class MockClaimApiClient {
  private proofs: Map<
    string,
    Array<{
      id: string;
      hash: string;
      difficulty: number;
      reward: bigint;
      claimed: boolean;
      claimId: string | null;
    }>
  > = new Map();

  private claims: Map<string, ClaimRecord> = new Map();
  private platformFeePercent = 20;
  private claimExpirationMs = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.reset();
  }

  reset(): void {
    this.proofs.clear();
    this.claims.clear();
  }

  /**
   * Simulate mining proofs (needed before claiming)
   */
  addMiningProofs(
    address: string,
    count: number,
    difficulty: number = MIN_DIFFICULTY,
  ): void {
    if (!this.proofs.has(address)) {
      this.proofs.set(address, []);
    }

    const proofList = this.proofs.get(address)!;
    for (let i = 0; i < count; i++) {
      const proof = generateValidProof(difficulty);
      proofList.push({
        id: crypto.randomUUID(),
        hash: proof.hash,
        difficulty,
        reward: BigInt(difficulty * difficulty),
        claimed: false,
        claimId: null,
      });
    }
  }

  /**
   * GET /api/claim/balance/:address
   */
  async getClaimableBalance(
    address: string,
  ): Promise<ApiResponse<ClaimableBalance>> {
    if (!address.startsWith("tb1") && !address.startsWith("bc1")) {
      return {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      };
    }

    const proofList = this.proofs.get(address) || [];
    const unclaimed = proofList.filter((p) => !p.claimed);

    let totalWork = 0n;
    let claimableTokens = 0n;
    for (const proof of unclaimed) {
      totalWork += BigInt(Math.pow(2, proof.difficulty));
      claimableTokens += proof.reward;
    }

    const platformFeeTokens =
      (claimableTokens * BigInt(this.platformFeePercent)) / 100n;
    const netTokens = claimableTokens - platformFeeTokens;

    return {
      success: true,
      data: {
        address,
        unclaimedWork: totalWork.toString(),
        unclaimedProofs: unclaimed.length,
        claimableTokens: claimableTokens.toString(),
        estimatedFee: 500, // sats
        platformFeePercent: this.platformFeePercent,
        platformFeeTokens: platformFeeTokens.toString(),
        netTokens: netTokens.toString(),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * POST /api/claim/prepare
   */
  async prepareClaim(address: string): Promise<ApiResponse<PreparedClaim>> {
    if (!address.startsWith("tb1") && !address.startsWith("bc1")) {
      return {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      };
    }

    // Check for existing prepared claims
    for (const claim of this.claims.values()) {
      if (
        claim.address === address &&
        claim.status === "prepared" &&
        claim.expiresAt > Date.now()
      ) {
        // Auto-cancel existing claim
        claim.status = "cancelled";
        // Release proofs
        const proofList = this.proofs.get(address) || [];
        for (const proof of proofList) {
          if (proof.claimId === claim.id) {
            proof.claimId = null;
          }
        }
      }
    }

    // Check for broadcast claims (can't prepare while broadcast pending)
    for (const claim of this.claims.values()) {
      if (
        claim.address === address &&
        claim.status === "broadcast" &&
        claim.expiresAt > Date.now()
      ) {
        return {
          success: false,
          error: "You have a broadcast claim waiting for confirmation",
          timestamp: Date.now(),
        };
      }
    }

    const proofList = this.proofs.get(address) || [];
    const unclaimed = proofList.filter((p) => !p.claimed && !p.claimId);

    if (unclaimed.length === 0) {
      return {
        success: false,
        error: "No unclaimed proofs to claim",
        timestamp: Date.now(),
      };
    }

    // Calculate totals
    let totalWork = 0n;
    let tokenAmount = 0n;
    for (const proof of unclaimed) {
      totalWork += BigInt(Math.pow(2, proof.difficulty));
      tokenAmount += proof.reward;
    }

    // Create claim record
    const claimId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + this.claimExpirationMs;

    const merkleRoot =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
    const serverSignature =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");

    const claim: ClaimRecord = {
      id: claimId,
      address,
      amount: tokenAmount,
      proofCount: unclaimed.length,
      totalWork,
      merkleRoot,
      serverSignature,
      opReturnData: "BABTC" + claimId.slice(0, 20),
      claimTxid: null,
      mintTxid: null,
      status: "prepared",
      error: null,
      preparedAt: now,
      confirmedAt: null,
      mintedAt: null,
      expiresAt,
    };

    this.claims.set(claimId, claim);

    // Lock proofs to this claim
    for (const proof of unclaimed) {
      proof.claimId = claimId;
    }

    const platformFeeTokens =
      (tokenAmount * BigInt(this.platformFeePercent)) / 100n;
    const netTokens = tokenAmount - platformFeeTokens;

    return {
      success: true,
      data: {
        claimData: {
          claimId,
          proof: {
            address,
            totalWork: totalWork.toString(),
            tokenAmount: tokenAmount.toString(),
            merkleRoot,
            nonce: claimId,
          },
          serverSignature,
          opReturnData: claim.opReturnData,
        },
        totalWork: totalWork.toString(),
        proofCount: unclaimed.length,
        tokenAmount: tokenAmount.toString(),
        estimatedFee: 500,
        expiresAt,
        platformFeePercent: this.platformFeePercent,
        netTokens: netTokens.toString(),
      },
      timestamp: now,
    };
  }

  /**
   * POST /api/claim/confirm
   */
  async confirmClaim(
    claimId: string,
    claimTxid: string,
    address: string,
  ): Promise<ApiResponse<{ status: ClaimStatus; nextStep: string }>> {
    const claim = this.claims.get(claimId);

    if (!claim) {
      return {
        success: false,
        error: "Claim not found",
        timestamp: Date.now(),
      };
    }

    if (claim.address !== address) {
      return {
        success: false,
        error: "Claim not found",
        timestamp: Date.now(),
      };
    }

    if (claim.status !== "prepared") {
      return {
        success: false,
        error: `Claim already in status: ${claim.status}`,
        timestamp: Date.now(),
      };
    }

    if (Date.now() > claim.expiresAt) {
      claim.status = "expired";
      return {
        success: false,
        error: "Claim has expired",
        timestamp: Date.now(),
      };
    }

    // Validate txid format
    if (!/^[a-fA-F0-9]{64}$/.test(claimTxid)) {
      return {
        success: false,
        error: "Invalid txid format",
        timestamp: Date.now(),
      };
    }

    // Update claim
    claim.claimTxid = claimTxid;
    claim.status = "broadcast";
    claim.confirmedAt = Date.now();

    // Mark proofs as claimed
    const proofList = this.proofs.get(address) || [];
    for (const proof of proofList) {
      if (proof.claimId === claimId) {
        proof.claimed = true;
      }
    }

    return {
      success: true,
      data: {
        status: "broadcast",
        nextStep:
          "Wait for TX confirmation (6 blocks), then call /api/claim/mint",
      },
      timestamp: Date.now(),
    };
  }

  /**
   * POST /api/claim/mint
   */
  async mintClaim(
    claimId: string,
    claimTxid: string,
    address: string,
    txConfirmed: boolean = true,
  ): Promise<
    ApiResponse<{
      status: ClaimStatus;
      message: string;
      mintTxid?: string;
      tokensMinted?: string;
    }>
  > {
    const claim = this.claims.get(claimId);

    if (!claim) {
      return {
        success: false,
        error: "Claim not found",
        timestamp: Date.now(),
      };
    }

    if (claim.address !== address) {
      return {
        success: false,
        error: "Claim not found",
        timestamp: Date.now(),
      };
    }

    // Check if already completed
    if (claim.status === "completed") {
      return {
        success: true,
        data: {
          status: "completed",
          message: "Tokens already minted",
          mintTxid: claim.mintTxid || undefined,
        },
        timestamp: Date.now(),
      };
    }

    // Check if minting in progress
    if (claim.status === "minting") {
      return {
        success: true,
        data: {
          status: "minting",
          message: "Minting in progress, please wait",
        },
        timestamp: Date.now(),
      };
    }

    // Verify TX exists and is confirmed
    if (!txConfirmed) {
      return {
        success: true,
        data: {
          status: "broadcast",
          message: "Transaction in mempool, waiting for confirmation",
        },
        timestamp: Date.now(),
      };
    }

    // Update to minting
    claim.status = "minting";

    // Simulate minting (in real implementation, calls Charms prover)
    const mintTxid = generateTxid();

    // Complete
    claim.status = "completed";
    claim.mintTxid = mintTxid;
    claim.mintedAt = Date.now();

    return {
      success: true,
      data: {
        status: "completed",
        message: "Tokens minted successfully",
        mintTxid,
        tokensMinted: claim.amount.toString(),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * POST /api/claim/cancel
   */
  async cancelClaim(
    address: string,
    claimId?: string,
  ): Promise<ApiResponse<{ cancelled: boolean | number; claimId?: string }>> {
    if (!claimId) {
      // Cancel all pending claims for address
      let cancelledCount = 0;
      for (const claim of this.claims.values()) {
        if (claim.address === address && claim.status === "prepared") {
          claim.status = "cancelled";
          // Release proofs
          const proofList = this.proofs.get(address) || [];
          for (const proof of proofList) {
            if (proof.claimId === claim.id) {
              proof.claimId = null;
              proof.claimed = false;
            }
          }
          cancelledCount++;
        }
      }

      if (cancelledCount === 0) {
        return {
          success: false,
          error: "No pending claims to cancel",
          timestamp: Date.now(),
        };
      }

      return {
        success: true,
        data: { cancelled: cancelledCount },
        timestamp: Date.now(),
      };
    }

    // Cancel specific claim
    const claim = this.claims.get(claimId);

    if (!claim || claim.address !== address) {
      return {
        success: false,
        error: "Claim not found",
        timestamp: Date.now(),
      };
    }

    if (claim.status !== "prepared") {
      return {
        success: false,
        error: `Cannot cancel claim in status: ${claim.status}`,
        timestamp: Date.now(),
      };
    }

    claim.status = "cancelled";

    // Release proofs
    const proofList = this.proofs.get(address) || [];
    for (const proof of proofList) {
      if (proof.claimId === claimId) {
        proof.claimId = null;
        proof.claimed = false;
      }
    }

    return {
      success: true,
      data: { cancelled: true, claimId },
      timestamp: Date.now(),
    };
  }

  /**
   * GET /api/claim/status/:claimId
   */
  async getClaimStatus(
    claimId: string,
    address: string,
  ): Promise<
    ApiResponse<{
      id: string;
      status: ClaimStatus;
      amount: string;
      claimTxid: string | null;
      mintTxid: string | null;
    }>
  > {
    const claim = this.claims.get(claimId);

    if (!claim || claim.address !== address) {
      return {
        success: false,
        error: "Claim not found",
        timestamp: Date.now(),
      };
    }

    return {
      success: true,
      data: {
        id: claim.id,
        status: claim.status,
        amount: claim.amount.toString(),
        claimTxid: claim.claimTxid,
        mintTxid: claim.mintTxid,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * GET /api/claim/history/:address
   */
  async getClaimHistory(address: string): Promise<
    ApiResponse<{
      claims: Array<{
        id: string;
        amount: string;
        status: ClaimStatus;
        preparedAt: number;
      }>;
    }>
  > {
    const claims: Array<{
      id: string;
      amount: string;
      status: ClaimStatus;
      preparedAt: number;
    }> = [];

    for (const claim of this.claims.values()) {
      if (claim.address === address) {
        claims.push({
          id: claim.id,
          amount: claim.amount.toString(),
          status: claim.status,
          preparedAt: claim.preparedAt,
        });
      }
    }

    // Sort by preparedAt descending
    claims.sort((a, b) => b.preparedAt - a.preparedAt);

    return {
      success: true,
      data: { claims },
      timestamp: Date.now(),
    };
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe("Claim API Integration", () => {
  let api: MockClaimApiClient;

  beforeEach(() => {
    api = new MockClaimApiClient();
  });

  afterEach(() => {
    api.reset();
  });

  // ===========================================================================
  // GET /api/claim/balance/:address
  // ===========================================================================

  describe("GET /api/claim/balance/:address", () => {
    it("should return zero claimable for new address", async () => {
      const response = await api.getClaimableBalance(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      expect(response.data!.unclaimedProofs).toBe(0);
      expect(response.data!.claimableTokens).toBe("0");
    });

    it("should return claimable balance after mining", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);

      const response = await api.getClaimableBalance(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      expect(response.data!.unclaimedProofs).toBe(5);
      expect(BigInt(response.data!.claimableTokens)).toBeGreaterThan(0n);
    });

    it("should calculate platform fee correctly", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 10, MIN_DIFFICULTY);

      const response = await api.getClaimableBalance(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      const total = BigInt(response.data!.claimableTokens);
      const fee = BigInt(response.data!.platformFeeTokens);
      const net = BigInt(response.data!.netTokens);

      // Fee should be 20% of total
      expect(fee).toBe((total * 20n) / 100n);
      // Net should be total - fee
      expect(net).toBe(total - fee);
    });

    it("should reject invalid address", async () => {
      const response = await api.getClaimableBalance(TEST_ADDRESSES.invalid);

      expect(response.success).toBe(false);
      expect(response.error).toContain("Invalid");
    });
  });

  // ===========================================================================
  // POST /api/claim/prepare
  // ===========================================================================

  describe("POST /api/claim/prepare", () => {
    it("should prepare claim with unclaimed proofs", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);

      const response = await api.prepareClaim(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      expect(response.data!.proofCount).toBe(5);
      expect(response.data!.claimData.claimId).toBeDefined();
      expect(response.data!.claimData.opReturnData).toContain("BABTC");
      expect(response.data!.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should fail if no unclaimed proofs", async () => {
      const response = await api.prepareClaim(TEST_ADDRESSES.miner);

      expect(response.success).toBe(false);
      expect(response.error).toContain("No unclaimed proofs");
    });

    it("should auto-cancel previous prepared claim", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 10, MIN_DIFFICULTY);

      // First prepare
      const first = await api.prepareClaim(TEST_ADDRESSES.miner);
      expect(first.success).toBe(true);
      const firstClaimId = first.data!.claimData.claimId;

      // Second prepare should auto-cancel first
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const second = await api.prepareClaim(TEST_ADDRESSES.miner);
      expect(second.success).toBe(true);

      // First claim should be cancelled
      const status = await api.getClaimStatus(
        firstClaimId,
        TEST_ADDRESSES.miner,
      );
      expect(status.data!.status).toBe("cancelled");
    });

    it("should include server signature", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);

      const response = await api.prepareClaim(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      expect(response.data!.claimData.serverSignature).toBeDefined();
      expect(response.data!.claimData.serverSignature.length).toBeGreaterThan(
        0,
      );
    });
  });

  // ===========================================================================
  // POST /api/claim/confirm
  // ===========================================================================

  describe("POST /api/claim/confirm", () => {
    it("should confirm claim with valid txid", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;
      const claimTxid = generateTxid();

      const response = await api.confirmClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
      );

      expect(response.success).toBe(true);
      expect(response.data!.status).toBe("broadcast");
    });

    it("should reject invalid txid format", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;

      const response = await api.confirmClaim(
        claimId,
        "invalid-txid",
        TEST_ADDRESSES.miner,
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain("Invalid txid");
    });

    it("should reject confirming non-existent claim", async () => {
      const response = await api.confirmClaim(
        crypto.randomUUID(),
        generateTxid(),
        TEST_ADDRESSES.miner,
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain("Claim not found");
    });

    it("should reject confirming already confirmed claim", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;
      const claimTxid = generateTxid();

      // First confirm
      await api.confirmClaim(claimId, claimTxid, TEST_ADDRESSES.miner);

      // Second confirm should fail
      const response = await api.confirmClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain("already in status");
    });
  });

  // ===========================================================================
  // POST /api/claim/mint
  // ===========================================================================

  describe("POST /api/claim/mint", () => {
    it("should mint tokens after TX confirmation", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;
      const claimTxid = generateTxid();

      await api.confirmClaim(claimId, claimTxid, TEST_ADDRESSES.miner);

      const response = await api.mintClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
        true,
      );

      expect(response.success).toBe(true);
      expect(response.data!.status).toBe("completed");
      expect(response.data!.mintTxid).toBeDefined();
      expect(response.data!.tokensMinted).toBeDefined();
    });

    it("should return broadcast status if TX not confirmed", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;
      const claimTxid = generateTxid();

      await api.confirmClaim(claimId, claimTxid, TEST_ADDRESSES.miner);

      const response = await api.mintClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
        false,
      );

      expect(response.success).toBe(true);
      expect(response.data!.status).toBe("broadcast");
      expect(response.data!.message).toContain("waiting for confirmation");
    });

    it("should return completed status for already minted claim", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;
      const claimTxid = generateTxid();

      await api.confirmClaim(claimId, claimTxid, TEST_ADDRESSES.miner);
      await api.mintClaim(claimId, claimTxid, TEST_ADDRESSES.miner, true);

      // Second mint call
      const response = await api.mintClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
        true,
      );

      expect(response.success).toBe(true);
      expect(response.data!.status).toBe("completed");
      expect(response.data!.message).toContain("already minted");
    });
  });

  // ===========================================================================
  // POST /api/claim/cancel
  // ===========================================================================

  describe("POST /api/claim/cancel", () => {
    it("should cancel prepared claim", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;

      const response = await api.cancelClaim(TEST_ADDRESSES.miner, claimId);

      expect(response.success).toBe(true);
      expect(response.data!.cancelled).toBe(true);
    });

    it("should release proofs when cancelled", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;

      await api.cancelClaim(TEST_ADDRESSES.miner, claimId);

      // Should be able to prepare again
      const secondPrepare = await api.prepareClaim(TEST_ADDRESSES.miner);
      expect(secondPrepare.success).toBe(true);
      expect(secondPrepare.data!.proofCount).toBe(5);
    });

    it("should cancel all pending claims if no claimId", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 10, MIN_DIFFICULTY);
      await api.prepareClaim(TEST_ADDRESSES.miner);
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      await api.prepareClaim(TEST_ADDRESSES.miner);

      const response = await api.cancelClaim(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      // Only the last one should be pending (first was auto-cancelled)
      expect(response.data!.cancelled).toBe(1);
    });

    it("should not cancel confirmed claims", async () => {
      api.addMiningProofs(TEST_ADDRESSES.miner, 5, MIN_DIFFICULTY);
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      const claimId = prepared.data!.claimData.claimId;
      const claimTxid = generateTxid();

      await api.confirmClaim(claimId, claimTxid, TEST_ADDRESSES.miner);

      const response = await api.cancelClaim(TEST_ADDRESSES.miner, claimId);

      expect(response.success).toBe(false);
      expect(response.error).toContain("Cannot cancel");
    });
  });

  // ===========================================================================
  // FULL FLOW
  // ===========================================================================

  describe("Complete Claim Flow", () => {
    it("should complete full claim lifecycle", async () => {
      // 1. Mine some proofs
      api.addMiningProofs(TEST_ADDRESSES.miner, 10, MIN_DIFFICULTY);

      // 2. Check claimable balance
      const balance = await api.getClaimableBalance(TEST_ADDRESSES.miner);
      expect(balance.success).toBe(true);
      expect(balance.data!.unclaimedProofs).toBe(10);

      // 3. Prepare claim
      const prepared = await api.prepareClaim(TEST_ADDRESSES.miner);
      expect(prepared.success).toBe(true);
      const claimId = prepared.data!.claimData.claimId;

      // 4. Build and broadcast TX (simulated)
      const claimTxid = generateTxid();

      // 5. Confirm claim
      const confirmed = await api.confirmClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
      );
      expect(confirmed.success).toBe(true);
      expect(confirmed.data!.status).toBe("broadcast");

      // 6. Wait for confirmation and mint
      const minted = await api.mintClaim(
        claimId,
        claimTxid,
        TEST_ADDRESSES.miner,
        true,
      );
      expect(minted.success).toBe(true);
      expect(minted.data!.status).toBe("completed");
      expect(minted.data!.mintTxid).toBeDefined();

      // 7. Verify claim status
      const status = await api.getClaimStatus(claimId, TEST_ADDRESSES.miner);
      expect(status.success).toBe(true);
      expect(status.data!.status).toBe("completed");

      // 8. Check claim appears in history
      const history = await api.getClaimHistory(TEST_ADDRESSES.miner);
      expect(history.success).toBe(true);
      expect(history.data!.claims).toHaveLength(1);
      expect(history.data!.claims[0].status).toBe("completed");

      // 9. No more claimable balance
      const finalBalance = await api.getClaimableBalance(TEST_ADDRESSES.miner);
      expect(finalBalance.data!.unclaimedProofs).toBe(0);
    });
  });
});
