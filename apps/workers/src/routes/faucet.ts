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
import { getVirtualBalanceStub, forwardToDO, safeDOCall } from "../lib/helpers";
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
faucetRouter.post("/claim", validateBody(faucetClaimSchema), async (c) => {
  const { address } = c.get("validatedBody");

  const faucetAmount = Math.min(
    Number(c.env.FAUCET_AMOUNT || DEFAULT_FAUCET_AMOUNT),
    100, // hard ceiling: max 100 per claim
  );
  const faucetMaxTotal = Number(
    c.env.FAUCET_MAX_TOTAL || DEFAULT_FAUCET_MAX_TOTAL,
  );
  const rateLimitKey = `faucet:claim:${address}`;
  const kv = c.env.CACHE;

  // ---- Credit and validate via VirtualBalanceDO atomically ----
  return safeDOCall(
    c,
    async () => {
      const stub = getVirtualBalanceStub(c.env, address);

      // Forward credit to DO (performs atomic check of cooldown and maxTotal)
      const doResponse = await forwardToDO(stub, `/balance/${address}/faucet`, {
        method: "POST",
        body: {
          amount: String(faucetAmount),
          maxTotal: String(faucetMaxTotal),
          cooldownMs: FAUCET_WINDOW_MS,
        },
      });

      if (!doResponse.ok) {
        let errMsg = "Faucet credit failed. Please try again.";
        try {
          const errJson = (await doResponse.clone().json()) as {
            error?: string;
          };
          if (errJson && errJson.error) {
            errMsg = errJson.error;
          }
        } catch {
          try {
            const text = await doResponse.clone().text();
            if (text) errMsg = text;
          } catch {}
        }
        balanceLogger.error("Faucet DO credit failed", {
          error: errMsg,
          address,
        });
        return c.json(
          {
            success: false,
            error: errMsg,
            timestamp: Date.now(),
          },
          doResponse.status as 200 | 400 | 429 | 500,
        );
      }

      // Only update KV cache after DO succeeds (idempotent cache)
      if (kv) {
        try {
          const doData = (await doResponse.clone().json()) as {
            success: boolean;
            data?: { faucetLastClaimAt: number; faucetTotalClaimed: string };
          };
          if (doData.success && doData.data) {
            await kv.put(
              rateLimitKey,
              JSON.stringify({
                lastClaimAt: doData.data.faucetLastClaimAt,
                totalClaimed: Number(doData.data.faucetTotalClaimed),
              }),
              { expirationTtl: Math.ceil(FAUCET_WINDOW_MS / 1000) + 86400 }, // 24h + 1 day buffer
            );
          }
        } catch (kvError) {
          balanceLogger.warn("KV rate limit write failed", {
            error: kvError,
            address,
          });
          // Non-fatal — the DO balance itself is the source of truth
        }
      }

      return doResponse;
    },
    "Faucet:Claim",
  );
});

export default faucetRouter;
