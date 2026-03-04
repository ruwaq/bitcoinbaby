/**
 * Balance Routes
 *
 * Virtual balance management for mining rewards.
 *
 * Routes:
 * - GET  /api/balance/:address          - Get user balance
 * - POST /api/balance/:address/credit   - Credit mining reward
 * - POST /api/balance/:address/set-hashrate - Report hashrate
 * - DELETE /api/balance/:address/reset  - Reset user balance
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/types";
import { getVirtualBalanceStub, forwardToDO, safeDOCall } from "../lib/helpers";
import {
  validateBody,
  validateParams,
  bitcoinAddressSchema,
  miningProofSchema,
} from "../lib/middleware";

export const balanceRouter = new Hono<{ Bindings: Env }>();

// Schema for address parameter
const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

// Schema for hashrate body
const hashrateSchema = z.object({
  hashrate: z.number().positive(),
  minerType: z.enum(["cpu", "gpu"]).optional(),
});

/**
 * GET /api/balance/:address - Get user's virtual balance
 */
balanceRouter.get(
  "/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);
        return forwardToDO(stub, `/balance/${address}/get`);
      },
      "Balance:Get",
    );
  },
);

/**
 * POST /api/balance/:address/credit - Credit mining reward
 */
balanceRouter.post(
  "/:address/credit",
  validateParams(addressParamSchema),
  validateBody(miningProofSchema),
  async (c) => {
    const { address } = c.get("validatedParams");
    const proof = c.get("validatedBody");

    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);
        return forwardToDO(stub, `/balance/${address}/credit`, {
          method: "POST",
          body: proof,
        });
      },
      "Balance:Credit",
    );
  },
);

/**
 * POST /api/balance/:address/set-hashrate - Report hashrate for VarDiff
 */
balanceRouter.post(
  "/:address/set-hashrate",
  validateParams(addressParamSchema),
  validateBody(hashrateSchema),
  async (c) => {
    const { address } = c.get("validatedParams");
    const hashrate = c.get("validatedBody");

    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);
        return forwardToDO(stub, `/balance/${address}/set-hashrate`, {
          method: "POST",
          body: hashrate,
        });
      },
      "Balance:SetHashrate",
    );
  },
);

/**
 * DELETE /api/balance/:address/reset - Reset user balance (testnet only)
 */
balanceRouter.delete(
  "/:address/reset",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);
        return forwardToDO(stub, `/balance/${address}/reset`, {
          method: "DELETE",
        });
      },
      "Balance:Reset",
    );
  },
);
