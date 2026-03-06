/**
 * Claim Routes
 *
 * User-paid settlement system for converting virtual balance to on-chain tokens.
 *
 * Flow:
 * 1. GET  /api/claim/balance/:address - Get claimable balance
 * 2. POST /api/claim/prepare          - Prepare claim (get signed data)
 * 3. POST /api/claim/confirm          - Confirm claim TX broadcast
 * 4. GET  /api/claim/status/:claimId  - Get claim status
 *
 * The user pays Bitcoin fees, not the team.
 */

import { Hono } from "hono";
import { z } from "zod";
import type {
  Env,
  ApiResponse,
  ClaimPrepareResponse,
  ClaimConfirmResponse,
} from "../lib/types";
import {
  getVirtualBalanceStub,
  forwardToDO,
  errorResponse,
  successResponse,
} from "../lib/helpers";
import {
  validateBody,
  validateParams,
  bitcoinAddressSchema,
} from "../lib/middleware";
import { claimLogger } from "../lib/logger";
import { estimateClaimFee } from "../services/proof-aggregator";
import { getMempoolService } from "../services/mempool-service";
import { getClaimMintingService } from "../services/claim-minting-service";

export const claimRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// SCHEMAS
// =============================================================================

const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

const prepareClaimSchema = z.object({
  address: bitcoinAddressSchema,
});

const confirmClaimSchema = z.object({
  claimId: z.string().uuid(),
  claimTxid: z.string().regex(/^[a-fA-F0-9]{64}$/, "Invalid txid format"),
  address: bitcoinAddressSchema,
});

const claimIdParamSchema = z.object({
  claimId: z.string().uuid(),
});

// Helper to map status codes to allowed types
function mapStatusCode(
  status: number,
): 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 {
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status === 409) return 409;
  if (status === 429) return 429;
  if (status === 503) return 503;
  if (status >= 500) return 500;
  return 400;
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/claim/balance/:address - Get user's claimable balance
 *
 * Returns:
 * - Unclaimed work (sum of D²)
 * - Unclaimed proof count
 * - Claimable token amount
 * - Estimated fee
 */
claimRouter.get(
  "/balance/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    try {
      // Forward to VirtualBalance DO
      const stub = getVirtualBalanceStub(c.env, address);
      const response = await forwardToDO(stub, `/balance/${address}/claimable`);

      if (!response.ok) {
        const error = await response.text();
        return errorResponse(c, error, mapStatusCode(response.status));
      }

      const data = (await response.json()) as ApiResponse<{
        address: string;
        unclaimedWork: string;
        unclaimedProofs: number;
        claimableTokens: string;
        lastProofAt: number;
        totalClaimed: string;
        claimCount: number;
      }>;

      if (!data.success || !data.data) {
        return errorResponse(c, data.error || "Failed to get balance", 400);
      }

      // Add fee estimates
      const feeRate = 5; // Default conservative fee rate
      const estimatedNetworkFee = estimateClaimFee(feeRate);

      // Platform fee: 20% of claimed tokens go to foundation
      const platformFeePercent = parseInt(
        c.env.PLATFORM_FEE_PERCENT || "20",
        10,
      );
      const claimableTokens = BigInt(data.data.claimableTokens);
      const platformFeeTokens =
        (claimableTokens * BigInt(platformFeePercent)) / 100n;

      return successResponse(c, {
        ...data.data,
        // Network fee in sats (user pays to miners)
        estimatedFee: estimatedNetworkFee,
        feeRate,
        // Platform fee info
        platformFeePercent,
        platformFeeTokens: platformFeeTokens.toString(),
        foundationAddress: c.env.FOUNDATION_ADDRESS || null,
        // Net tokens user will receive after platform fee
        netTokens: (claimableTokens - platformFeeTokens).toString(),
      });
    } catch (error) {
      claimLogger.error("Failed to get claimable balance", error);
      return errorResponse(c, "Failed to get claimable balance", 500);
    }
  },
);

/**
 * POST /api/claim/prepare - Prepare a claim
 *
 * Aggregates all unclaimed proofs and returns signed claim data.
 * User must create a Bitcoin TX with this data and broadcast it.
 */
claimRouter.post("/prepare", validateBody(prepareClaimSchema), async (c) => {
  const { address } = c.get("validatedBody");

  try {
    // Get server secret for signing
    const serverSecret = c.env.ADMIN_KEY;
    if (!serverSecret) {
      return errorResponse(c, "Server not configured for claims", 500);
    }

    // Get unclaimed proofs from DO
    const stub = getVirtualBalanceStub(c.env, address);
    const response = await forwardToDO(
      stub,
      `/balance/${address}/prepare-claim`,
      { method: "POST" },
    );

    if (!response.ok) {
      const errorText = await response.text();
      claimLogger.error("DO prepare-claim failed", { error: errorText });
      return errorResponse(c, errorText, mapStatusCode(response.status));
    }

    const result = (await response.json()) as ApiResponse<ClaimPrepareResponse>;

    if (!result.success || !result.data) {
      return errorResponse(c, result.error || "Failed to prepare claim", 400);
    }

    // Calculate platform fee
    const platformFeePercent = parseInt(c.env.PLATFORM_FEE_PERCENT || "20", 10);
    const tokenAmount = BigInt(result.data.tokenAmount);
    const platformFeeTokens = (tokenAmount * BigInt(platformFeePercent)) / 100n;
    const netTokens = tokenAmount - platformFeeTokens;

    claimLogger.info("Claim prepared", {
      address,
      tokenAmount: result.data.tokenAmount,
      proofCount: result.data.proofCount,
      platformFeePercent,
      platformFeeTokens: platformFeeTokens.toString(),
    });

    return successResponse(c, {
      ...result.data,
      // Platform fee info for transaction building
      platformFeePercent,
      platformFeeTokens: platformFeeTokens.toString(),
      foundationAddress: c.env.FOUNDATION_ADDRESS || null,
      // Net tokens user receives after platform fee
      netTokens: netTokens.toString(),
    });
  } catch (error) {
    claimLogger.error("Failed to prepare claim", error);
    return errorResponse(c, "Failed to prepare claim", 500);
  }
});

/**
 * POST /api/claim/confirm - Confirm claim TX was broadcast
 *
 * After user broadcasts their Bitcoin TX, they call this to:
 * 1. Verify the TX exists in mempool/blockchain
 * 2. Mark proofs as claimed
 * 3. Initiate minting process
 */
claimRouter.post("/confirm", validateBody(confirmClaimSchema), async (c) => {
  const { claimId, claimTxid, address } = c.get("validatedBody");

  try {
    // Forward to VirtualBalance DO
    const stub = getVirtualBalanceStub(c.env, address);
    const response = await forwardToDO(
      stub,
      `/balance/${address}/confirm-claim`,
      {
        method: "POST",
        body: { claimId, claimTxid },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return errorResponse(c, errorText, mapStatusCode(response.status));
    }

    const result = (await response.json()) as ApiResponse<ClaimConfirmResponse>;

    if (!result.success || !result.data) {
      return errorResponse(c, result.error || "Failed to confirm claim", 400);
    }

    claimLogger.info("Claim confirmed", {
      address,
      claimId,
      claimTxid,
      status: result.data.status,
    });

    return successResponse(c, result.data);
  } catch (error) {
    claimLogger.error("Failed to confirm claim", error);
    return errorResponse(c, "Failed to confirm claim", 500);
  }
});

/**
 * GET /api/claim/status/:claimId - Get claim status
 */
claimRouter.get(
  "/status/:claimId",
  validateParams(claimIdParamSchema),
  async (c) => {
    const { claimId } = c.get("validatedParams");

    // We need to find which address this claim belongs to
    // For now, require address as query param
    const address = c.req.query("address");

    if (!address) {
      return errorResponse(c, "Address query parameter required", 400);
    }

    try {
      const stub = getVirtualBalanceStub(c.env, address);
      const response = await forwardToDO(
        stub,
        `/balance/${address}/claim-status/${claimId}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        return errorResponse(c, errorText, mapStatusCode(response.status));
      }

      return response;
    } catch (error) {
      claimLogger.error("Failed to get claim status", error);
      return errorResponse(c, "Failed to get claim status", 500);
    }
  },
);

/**
 * GET /api/claim/history/:address - Get claim history
 */
claimRouter.get(
  "/history/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    try {
      const stub = getVirtualBalanceStub(c.env, address);
      const response = await forwardToDO(
        stub,
        `/balance/${address}/claim-history`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        return errorResponse(c, errorText, mapStatusCode(response.status));
      }

      return response;
    } catch (error) {
      claimLogger.error("Failed to get claim history", error);
      return errorResponse(c, "Failed to get claim history", 500);
    }
  },
);

/**
 * POST /api/claim/mint - Complete minting after TX confirmation
 *
 * Called after the user's claim TX is confirmed on Bitcoin.
 * Submits to Charms prover to mint the tokens.
 *
 * Flow:
 * 1. Verify claim TX is confirmed on-chain
 * 2. Get claim data from VirtualBalance DO
 * 3. Build mint spell with claim data
 * 4. Submit to Charms prover
 * 5. Update claim status
 */
claimRouter.post(
  "/mint",
  validateBody(
    z.object({
      claimId: z.string().uuid(),
      address: bitcoinAddressSchema,
      claimTxid: z.string().regex(/^[a-fA-F0-9]{64}$/),
    }),
  ),
  async (c) => {
    const { claimId, address, claimTxid } = c.get("validatedBody");

    try {
      claimLogger.info("Mint requested", { claimId, address, claimTxid });

      // Step 1: Verify claim TX exists in mempool/blockchain
      const mempool = getMempoolService("testnet4");
      const txVerification = await mempool.verifyTransaction(claimTxid);

      if (!txVerification.exists) {
        return errorResponse(
          c,
          "Claim transaction not found on-chain. Please wait for propagation.",
          400,
        );
      }

      if (!txVerification.confirmed) {
        return successResponse(c, {
          status: "broadcast",
          message: "Transaction in mempool, waiting for confirmation",
          claimId,
          claimTxid,
          confirmations: 0,
        });
      }

      // Step 2: Get claim data from VirtualBalance DO
      const stub = getVirtualBalanceStub(c.env, address);
      const claimResponse = await forwardToDO(
        stub,
        `/balance/${address}/claim-status/${claimId}`,
      );

      if (!claimResponse.ok) {
        return errorResponse(c, "Claim not found", 404);
      }

      const claimData = (await claimResponse.json()) as ApiResponse<{
        id: string;
        status: string;
        amount: string;
        totalWork: string;
        proofCount: number;
        merkleRoot: string | null;
        serverSignature: string | null;
        preparedAt: number;
      }>;

      if (!claimData.success || !claimData.data) {
        return errorResponse(c, "Failed to get claim data", 400);
      }

      // Verify we have the required signature data
      if (!claimData.data.merkleRoot || !claimData.data.serverSignature) {
        return errorResponse(
          c,
          "Claim missing signature data. Please prepare a new claim.",
          400,
        );
      }

      // Check if already minting or completed
      if (claimData.data.status === "completed") {
        return successResponse(c, {
          status: "completed",
          message: "Tokens already minted",
          claimId,
        });
      }

      if (claimData.data.status === "minting") {
        return successResponse(c, {
          status: "minting",
          message: "Minting in progress, please wait",
          claimId,
        });
      }

      // Step 3: Update status to minting
      await forwardToDO(stub, `/balance/${address}/update-claim-status`, {
        method: "POST",
        body: { claimId, status: "minting" },
      });

      // Step 4: Submit to Charms prover
      const appId = c.env.BABTC_APP_ID || "";
      const appVk = c.env.BABTC_APP_VK || "";

      if (!appId || !appVk) {
        claimLogger.error("Missing BABTC app configuration");
        return errorResponse(c, "Server configuration error", 500);
      }

      const mintingService = getClaimMintingService({
        proverUrl: c.env.CHARMS_PROVER_URL,
        appId,
        appVk,
        network: "testnet4",
      });

      const mintResult = await mintingService.processMint({
        claimId,
        address,
        claimTxid,
        tokenAmount: claimData.data.amount,
        totalWork: claimData.data.totalWork,
        proofCount: claimData.data.proofCount,
        merkleRoot: claimData.data.merkleRoot,
        serverSignature: claimData.data.serverSignature,
        nonce: claimId,
        timestamp: claimData.data.preparedAt,
      });

      if (!mintResult.success) {
        // Update status to failed
        await forwardToDO(stub, `/balance/${address}/update-claim-status`, {
          method: "POST",
          body: { claimId, status: "failed", error: mintResult.error },
        });

        return errorResponse(c, mintResult.error || "Minting failed", 500);
      }

      // Step 5: Update status to completed
      await forwardToDO(stub, `/balance/${address}/update-claim-status`, {
        method: "POST",
        body: {
          claimId,
          status: "completed",
          mintTxid: mintResult.mintTxid,
        },
      });

      claimLogger.info("Mint completed", {
        claimId,
        mintTxid: mintResult.mintTxid,
      });

      return successResponse(c, {
        status: "completed",
        message: "Tokens minted successfully",
        claimId,
        mintTxid: mintResult.mintTxid,
        commitTxid: mintResult.commitTxid,
        tokensMinted: claimData.data.amount,
      });
    } catch (error) {
      claimLogger.error("Failed to mint", error);
      return errorResponse(c, "Failed to mint tokens", 500);
    }
  },
);

// =============================================================================
// MAINTENANCE ENDPOINTS (called by scheduled tasks)
// =============================================================================

/**
 * POST /api/claim/cleanup - Expire old prepared claims
 *
 * Called by scheduled task every 6 hours.
 * Marks claims that were never submitted as expired.
 */
claimRouter.post("/cleanup", async (c) => {
  try {
    claimLogger.info("Running claim cleanup");

    // This is a system-wide cleanup that would need to iterate through all DOs
    // For now, we'll rely on individual DO cleanup when users interact
    // In a production system, you'd want to maintain a list of active claims
    // or use a separate database for cross-DO queries

    // Return success - individual DOs handle their own expiration on access
    return successResponse(c, {
      status: "ok",
      message: "Cleanup triggered",
      expiredCount: 0,
    });
  } catch (error) {
    claimLogger.error("Cleanup failed", error);
    return errorResponse(c, "Cleanup failed", 500);
  }
});

/**
 * POST /api/claim/retry-failed - Retry failed mints
 *
 * Called by scheduled task every hour.
 * Attempts to retry claims that failed during minting.
 */
claimRouter.post("/retry-failed", async (c) => {
  try {
    claimLogger.info("Running failed mint retry");

    // Similar to cleanup - this would need cross-DO coordination
    // Individual DOs should expose a "get failed claims" endpoint
    // and we'd iterate and retry each

    // For MVP, return success - users can manually retry via UI
    return successResponse(c, {
      status: "ok",
      message: "Retry triggered",
      retriedCount: 0,
    });
  } catch (error) {
    claimLogger.error("Retry failed", error);
    return errorResponse(c, "Retry failed", 500);
  }
});
