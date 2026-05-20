/**
 * BABTC Faucet Routes
 *
 * Phase 1 feature: dispenses 5 BABTC/day to users so they can evolve NFTs
 * before mining is active. Virtual balance only — no on-chain transactions.
 *
 * Routes:
 * - POST /api/faucet/claim — Claim daily BABTC faucet
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/types";
import {
  getVirtualBalanceStub,
  forwardToDO,
  safeDOCall,
  errorResponse,
} from "../lib/helpers";
import { validateBody, bitcoinAddressSchema } from "../lib/middleware";
import { balanceLogger } from "../lib/logger";

export const faucetRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Default faucet amount in BABTC (env: FAUCET_AMOUNT) */
const DEFAULT_FAUCET_AMOUNT = 5;

/** Default max total faucet per address (env: FAUCET_MAX_TOTAL) */
const DEFAULT_FAUCET_MAX_TOTAL = 50;

/** Rate limit window: 24 hours in milliseconds */
const FAUCET_WINDOW_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// SCHEMAS
// =============================================================================

const faucetClaimSchema = z.object({
  address: bitcoinAddressSchema,
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/faucet/claim
 *
 * Claims the daily BABTC faucet for the given address.
 * Rate limited to 1 claim per 24 hours per address.
 * Max 50 BABTC total per address (lifetime cap).
 */
faucetRouter.post(
  "/claim",
  validateBody(faucetClaimSchema),
  async (c) => {
    const { address } = c.get("validatedBody");

    const faucetAmount = Math.min(
      Number(c.env.FAUCET_AMOUNT || DEFAULT_FAUCET_AMOUNT),
      100, // hard ceiling: max 100 per claim
    );
    const faucetMaxTotal = Number(c.env.FAUCET_MAX_TOTAL || DEFAULT_FAUCET_MAX_TOTAL);

    // ---- Rate Limit Check (KV-based) ----
    const rateLimitKey = `faucet:claim:${address}`;
    const kv = c.env.CACHE;

    if (kv) {
      try {
        const cached = await kv.get<{ lastClaimAt: number; totalClaimed: number }>(
          rateLimitKey,
          "json",
        );

        const now = Date.now();

        if (cached) {
          // Check cooldown
          const nextClaimAt = cached.lastClaimAt + FAUCET_WINDOW_MS;
          if (now < nextClaimAt) {
            const retryAfterSec = Math.ceil((nextClaimAt - now) / 1000);
            c.header("Retry-After", String(retryAfterSec));
            return c.json(
              {
                success: false,
                error: "Faucet cooldown active. Please wait before claiming again.",
                nextClaimAt,
                retryAfterSeconds: retryAfterSec,
                totalClaimed: cached.totalClaimed,
                timestamp: now,
              },
              429,
            );
          }

          // Check max total
          if (cached.totalClaimed + faucetAmount > faucetMaxTotal) {
            return c.json(
              {
                success: false,
                error: `Maximum faucet total reached (${faucetMaxTotal} BABTC). You have claimed ${cached.totalClaimed}.`,
                totalClaimed: cached.totalClaimed,
                maxTotal: faucetMaxTotal,
                timestamp: now,
              },
              400,
            );
          }
        }
      } catch (kvError) {
        balanceLogger.warn("KV rate limit check failed", { error: kvError, address });
        // Fall through — allow claim if KV is temporarily unavailable
      }
    }

    // ---- Check current balance from VirtualBalanceDO ----
    let currentBalance = 0n;
    try {
      const balanceStub = getVirtualBalanceStub(c.env, address);
      const balanceResponse = await forwardToDO(balanceStub, `/balance/${address}/get`);
      const balanceData = (await balanceResponse.json()) as {
        success: boolean;
        data?: { virtualBalance: string; totalMined: string };
      };

      if (balanceData.success && balanceData.data) {
        currentBalance = BigInt(balanceData.data.totalMined || "0");
      }

      // Enforce max total from on-chain data (in case KV is stale)
      if (currentBalance + BigInt(faucetAmount) > BigInt(faucetMaxTotal)) {
        return errorResponse(
          c,
          `Maximum faucet total reached (${faucetMaxTotal} BABTC). Current: ${currentBalance}.`,
          400,
        );
      }
    } catch (balanceError) {
      balanceLogger.error("Failed to fetch balance for faucet check", balanceError);
      return errorResponse(c, "Unable to verify current balance. Please try again.", 503);
    }

    // ---- Credit via VirtualBalanceDO FIRST (source of truth), then update KV ----
    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);

        // 1. Forward credit to DO FIRST (source of truth)
        const doResponse = await forwardToDO(stub, `/balance/${address}/faucet`, {
          method: "POST",
          body: { amount: String(faucetAmount) },
        });
        if (!doResponse.ok) {
          const err = await doResponse.text();
          balanceLogger.error("Faucet DO credit failed", { err, address });
          return errorResponse(c, "Faucet credit failed. Please try again.", 503);
        }

        // 2. Only update KV after DO succeeds (idempotent cache)
        const now = Date.now();
        if (kv) {
          const cached = await kv.get<{ lastClaimAt: number; totalClaimed: number }>(
            rateLimitKey,
            "json",
          );
          const newTotalClaimed = (cached?.totalClaimed ?? Number(currentBalance)) + faucetAmount;

          try {
            await kv.put(
              rateLimitKey,
              JSON.stringify({
                lastClaimAt: now,
                totalClaimed: newTotalClaimed,
              }),
              { expirationTtl: Math.ceil(FAUCET_WINDOW_MS / 1000) + 86400 }, // 24h + 1 day buffer
            );
          } catch (kvError) {
            balanceLogger.warn("KV rate limit write failed", { error: kvError, address });
            // Non-fatal — the DO balance itself is the source of truth
          }
        }

        return doResponse;
      },
      "Faucet:Claim",
    );
  },
);

export default faucetRouter;
