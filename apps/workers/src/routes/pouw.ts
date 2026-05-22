/**
 * PoUW AI Mining Routes
 *
 * Routing layer for requesting JIT useful work tasks.
 *
 * Routes:
 * - GET /api/pouw/:address/task - Request AI generation task for an address
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/types";
import {
  getVirtualBalanceStub,
  forwardToDO,
  safeDOCall,
} from "../lib/helpers";
import {
  validateParams,
  bitcoinAddressSchema,
} from "../lib/middleware";

export const pouwRouter = new Hono<{ Bindings: Env }>();

// Schema for address parameter
const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

/**
 * GET /api/pouw/:address/task - Retrieve JIT useful work task
 */
pouwRouter.get(
  "/:address/task",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);
        return forwardToDO(stub, `/balance/${address}/pouw-task`);
      },
      "PoUW:GetTask",
    );
  },
);
