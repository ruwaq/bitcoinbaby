/**
 * Claim API Routes
 *
 * Server-Assisted claim flow:
 * 1. GET /balance/:address - Get balance with UTXOs and funding status
 * 2. POST /execute - Server builds PSBT, user signs
 * 3. POST /complete - Server broadcasts and queues mint
 *
 * User only sees: tokens, fee, click.
 * No UTXOs, no OP_RETURN, no technical details.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/types";
import { validateBody, validateParams, rateLimits } from "../lib/middleware";
import {
  errorResponse,
  successResponse,
  getVirtualBalanceStub,
  forwardToDO,
} from "../lib/helpers";
import { claimLogger } from "../lib/logger";
import { initMempoolService } from "../services/mempool-service";
import { createPsbtBuilder } from "../services/psbt-builder";
import {
  MIN_CLAIM_UTXO_VALUE,
  RECOMMENDED_CLAIM_UTXO_VALUE,
  estimateClaimFee,
  DEFAULT_FEE_RATE,
} from "../config/bitcoin";
import { validatePlatformFeePercent, MIN_CLAIM_TOKENS } from "../config/claim";

// =============================================================================
// SCHEMAS
// =============================================================================

const addressParamSchema = z.object({
  address: z.string().regex(/^(bc1|tb1)[a-zA-HJ-NP-Z0-9]{25,62}$/),
});

const executeClaimSchema = z.object({
  address: z.string().regex(/^(bc1|tb1)[a-zA-HJ-NP-Z0-9]{25,62}$/),
});

const completeClaimSchema = z.object({
  claimId: z.string().uuid(),
  signedPsbtBase64: z.string().min(100),
});

// =============================================================================
// TYPES
// =============================================================================

interface ClaimBalanceResponse {
  claimableTokens: string;
  unclaimedWork: string;
  unclaimedProofs: number;
  platformFeePercent: number;
  platformFeeTokens: string;
  netTokens: string;
  userFunds: {
    totalBalance: number;
    availableUtxos: number;
    largestUtxo: number;
    estimatedFee: number;
    canClaim: boolean;
    shortfall: number;
  };
  depositInfo: {
    address: string;
    minimumDeposit: number;
    recommendedDeposit: number;
  };
  canProceed: boolean;
  blockingReason?: string;
}

interface ExecuteClaimResponse {
  success: boolean;
  claimId?: string;
  psbtBase64?: string;
  summary?: {
    tokensReceiving: string;
    networkFee: string;
    platformFee: string;
  };
  error?: string;
}

interface CompleteClaimResponse {
  success: boolean;
  txid?: string;
  status?: string;
  estimatedCompletion?: number;
  error?: string;
}

// =============================================================================
// ROUTER
// =============================================================================

export const claimRouter = new Hono<{ Bindings: Env }>();

// Apply rate limiting to all claim routes
claimRouter.use("*", rateLimits.claim);

/**
 * GET /api/claim/balance/:address
 *
 * Get claimable balance WITH user's funding status.
 * Server checks if user has enough to pay fee.
 */
claimRouter.get(
  "/balance/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.req.param();

    try {
      claimLogger.info("Balance request", { address });

      // 1. Get claimable balance from DO
      const stub = getVirtualBalanceStub(c.env, address);
      const balanceResponse = await forwardToDO(
        stub,
        `/balance/${address}/claimable`,
        { method: "GET" },
      );

      if (!balanceResponse.ok) {
        const errorData = await balanceResponse
          .json()
          .catch(() => ({ error: "Unknown error" }));
        const status = [400, 401, 403, 404, 409, 429, 500, 503].includes(
          balanceResponse.status,
        )
          ? (balanceResponse.status as
              | 400
              | 401
              | 403
              | 404
              | 409
              | 429
              | 500
              | 503)
          : 500;
        return errorResponse(
          c,
          (errorData as { error?: string }).error || "Failed to get balance",
          status,
        );
      }

      const balanceData = (await balanceResponse.json()) as {
        unclaimedWork: string;
        unclaimedProofs: number;
        claimableTokens: string;
      };

      // 2. Get user's UTXOs
      const mempoolService = initMempoolService(
        "testnet4",
        c.env.CACHE || null,
      );
      const utxos = await mempoolService.getAddressUtxos(address);
      const feeRates = await mempoolService.getFeeRates();

      // 3. Calculate funding status
      const feeRate = feeRates.hourFee || DEFAULT_FEE_RATE;
      const estimatedFee = estimateClaimFee(feeRate);
      const totalBalance = utxos.reduce((sum, u) => sum + u.value, 0);
      const largestUtxo =
        utxos.length > 0 ? Math.max(...utxos.map((u) => u.value)) : 0;
      const canClaim = largestUtxo >= MIN_CLAIM_UTXO_VALUE;
      const shortfall = canClaim ? 0 : MIN_CLAIM_UTXO_VALUE - largestUtxo;

      // 4. Calculate platform fee
      const feeValidation = validatePlatformFeePercent(
        c.env.PLATFORM_FEE_PERCENT,
      );
      const platformFeePercent = feeValidation.valid ? feeValidation.value : 20;
      const claimableTokens = BigInt(balanceData.claimableTokens || "0");
      const platformFeeTokens =
        (claimableTokens * BigInt(platformFeePercent)) / 100n;
      const netTokens = claimableTokens - platformFeeTokens;

      // 5. Determine if can proceed
      const hasEnoughTokens = netTokens >= MIN_CLAIM_TOKENS;
      const canProceed = canClaim && hasEnoughTokens;

      let blockingReason: string | undefined;
      if (!hasEnoughTokens) {
        blockingReason = `Minimum ${MIN_CLAIM_TOKENS} tokens required. Keep mining!`;
      } else if (!canClaim) {
        blockingReason = `Need at least ${MIN_CLAIM_UTXO_VALUE} sats to pay network fee.`;
      }

      const response: ClaimBalanceResponse = {
        claimableTokens: claimableTokens.toString(),
        unclaimedWork: balanceData.unclaimedWork,
        unclaimedProofs: balanceData.unclaimedProofs,
        platformFeePercent,
        platformFeeTokens: platformFeeTokens.toString(),
        netTokens: netTokens.toString(),
        userFunds: {
          totalBalance,
          availableUtxos: utxos.length,
          largestUtxo,
          estimatedFee,
          canClaim,
          shortfall,
        },
        depositInfo: {
          address,
          minimumDeposit: MIN_CLAIM_UTXO_VALUE,
          recommendedDeposit: RECOMMENDED_CLAIM_UTXO_VALUE,
        },
        canProceed,
        blockingReason,
      };

      return successResponse(c, response);
    } catch (error) {
      claimLogger.error("Balance error", { address, error });
      return errorResponse(c, "Failed to get claim balance", 500);
    }
  },
);

/**
 * POST /api/claim/execute
 *
 * Server prepares claim AND builds PSBT.
 * User just needs to sign.
 */
claimRouter.post("/execute", validateBody(executeClaimSchema), async (c) => {
  const { address } = await c.req.json();

  try {
    claimLogger.info("Execute request", { address });

    // 1. Prepare claim
    const stub = getVirtualBalanceStub(c.env, address);
    const prepareResponse = await forwardToDO(
      stub,
      `/balance/${address}/prepare-claim`,
      {
        method: "POST",
        body: { address, serverSecret: c.env.ADMIN_KEY },
      },
    );

    if (!prepareResponse.ok) {
      const errorData = await prepareResponse
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return c.json(
        {
          success: false,
          error:
            (errorData as { error?: string }).error ||
            "Failed to prepare claim",
        } as ExecuteClaimResponse,
        400,
      );
    }

    const prepareData = (await prepareResponse.json()) as {
      claimData: {
        proof: { nonce: string; tokenAmount: string };
        opReturnData: string;
      };
      tokenAmount: string;
      platformFeePercent: number;
      platformFeeTokens: string;
      netTokens: string;
    };

    // 2. Build PSBT
    const mempoolService = initMempoolService("testnet4", c.env.CACHE || null);
    const psbtBuilder = createPsbtBuilder(mempoolService as any, "testnet4");

    const psbtResult = await psbtBuilder.buildClaimPsbt({
      address,
      opReturnData: prepareData.claimData.opReturnData,
    });

    if (!psbtResult.success || !psbtResult.psbtBase64) {
      // Cancel the prepared claim since we can't build PSBT
      await forwardToDO(stub, `/balance/${address}/cancel-claim`, {
        method: "POST",
        body: { claimId: prepareData.claimData.proof.nonce },
      });

      return c.json(
        {
          success: false,
          error: psbtResult.error || "Failed to build transaction",
        } as ExecuteClaimResponse,
        400,
      );
    }

    // 3. Return PSBT for signing
    const response: ExecuteClaimResponse = {
      success: true,
      claimId: prepareData.claimData.proof.nonce,
      psbtBase64: psbtResult.psbtBase64,
      summary: {
        tokensReceiving: prepareData.netTokens,
        networkFee: `${psbtResult.fee} sats`,
        platformFee: `${prepareData.platformFeeTokens} BABTC (${prepareData.platformFeePercent}%)`,
      },
    };

    return successResponse(c, response);
  } catch (error) {
    claimLogger.error("Execute error", { address, error });
    return c.json(
      {
        success: false,
        error: "Failed to execute claim",
      } as ExecuteClaimResponse,
      500,
    );
  }
});

/**
 * POST /api/claim/complete
 *
 * User sends signed PSBT.
 * Server broadcasts and queues mint.
 */
claimRouter.post("/complete", validateBody(completeClaimSchema), async (c) => {
  const { claimId, signedPsbtBase64 } = await c.req.json();

  try {
    claimLogger.info("Complete request", { claimId });

    // 1. Finalize PSBT and extract TX
    const mempoolService = initMempoolService("testnet4", c.env.CACHE || null);
    const psbtBuilder = createPsbtBuilder(mempoolService as any, "testnet4");

    const finalizeResult = await psbtBuilder.finalizePsbt(signedPsbtBase64);

    if (!finalizeResult.success || !finalizeResult.txHex) {
      return c.json(
        {
          success: false,
          error: finalizeResult.error || "Failed to finalize transaction",
        } as CompleteClaimResponse,
        400,
      );
    }

    // 2. Broadcast TX
    let txid: string;
    try {
      txid = await mempoolService.broadcastTransaction(finalizeResult.txHex);
    } catch (broadcastError) {
      return c.json(
        {
          success: false,
          error: `Broadcast failed: ${broadcastError instanceof Error ? broadcastError.message : "Unknown error"}`,
        } as CompleteClaimResponse,
        500,
      );
    }

    claimLogger.info("Claim broadcast", { claimId, txid });

    const response: CompleteClaimResponse = {
      success: true,
      txid,
      status: "broadcast",
      estimatedCompletion: 180,
    };

    return successResponse(c, response);
  } catch (error) {
    claimLogger.error("Complete error", { claimId, error });
    return c.json(
      {
        success: false,
        error: "Failed to complete claim",
      } as CompleteClaimResponse,
      500,
    );
  }
});

/**
 * GET /api/claim/status/:claimId
 *
 * Poll claim status.
 */
claimRouter.get("/status/:claimId", async (c) => {
  const { claimId } = c.req.param();

  try {
    return successResponse(c, {
      claimId,
      status: "processing",
      message: "Waiting for confirmation...",
    });
  } catch (error) {
    claimLogger.error("Status error", { claimId, error });
    return errorResponse(c, "Failed to get claim status", 500);
  }
});
