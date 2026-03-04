/**
 * Pool Routes
 *
 * Withdrawal pool management for batched withdrawals.
 *
 * Routes:
 * - GET  /api/pool/:poolType/status   - Get pool status
 * - GET  /api/pool/:poolType/requests - Get pending requests
 * - POST /api/pool/:poolType/request  - Create withdrawal request
 * - POST /api/pool/:poolType/cancel   - Cancel withdrawal request
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env, ApiResponse } from "../lib/types";
import {
  getWithdrawPoolStub,
  getVirtualBalanceStub,
  forwardToDO,
  errorResponse,
} from "../lib/helpers";
import { poolLogger } from "../lib/logger";
import {
  validateBody,
  validateParams,
  poolTypeSchema,
  withdrawRequestSchema,
  bitcoinAddressSchema,
} from "../lib/middleware";

export const poolRouter = new Hono<{ Bindings: Env }>();

// Schema for pool type parameter
const poolParamSchema = z.object({
  poolType: poolTypeSchema,
});

// Schema for cancel request
const cancelRequestSchema = z.object({
  requestId: z.string().uuid(),
  fromAddress: bitcoinAddressSchema,
});

/**
 * GET /api/pool/:poolType/status - Get pool status
 */
poolRouter.get(
  "/:poolType/status",
  validateParams(poolParamSchema),
  async (c) => {
    const { poolType } = c.get("validatedParams");
    const stub = getWithdrawPoolStub(c.env, poolType);
    return forwardToDO(stub, `/pool/${poolType}/status`);
  },
);

/**
 * GET /api/pool/:poolType/requests - Get pending requests
 */
poolRouter.get(
  "/:poolType/requests",
  validateParams(poolParamSchema),
  async (c) => {
    const { poolType } = c.get("validatedParams");
    const stub = getWithdrawPoolStub(c.env, poolType);
    return forwardToDO(stub, `/pool/${poolType}/requests`);
  },
);

/**
 * POST /api/pool/:poolType/request - Create withdrawal request
 *
 * Two-phase commit:
 * 1. Reserve balance in VirtualBalance DO
 * 2. Create request in WithdrawPool DO
 * 3. If pool fails, release reservation
 */
poolRouter.post(
  "/:poolType/request",
  validateParams(poolParamSchema),
  validateBody(withdrawRequestSchema),
  async (c) => {
    const { poolType } = c.get("validatedParams");
    const body = c.get("validatedBody");

    const requestId = crypto.randomUUID();

    // Phase 1: Reserve balance
    const balanceStub = getVirtualBalanceStub(c.env, body.fromAddress);
    const reserveResponse = await forwardToDO(
      balanceStub,
      `/balance/${body.fromAddress}/reserve`,
      {
        method: "POST",
        body: { amount: body.amount, requestId },
      },
    );

    if (!reserveResponse.ok) {
      return reserveResponse;
    }

    // Phase 2: Create pool request
    const poolStub = getWithdrawPoolStub(c.env, poolType);
    let poolResponse: Response;

    try {
      poolResponse = await forwardToDO(poolStub, `/pool/${poolType}/request`, {
        method: "POST",
        body: { ...body, requestId },
      });
    } catch (error) {
      // Rollback: Release reservation
      poolLogger.error("Request failed, releasing reservation", error);
      await forwardToDO(
        balanceStub,
        `/balance/${body.fromAddress}/cancel-withdraw`,
        {
          method: "POST",
          body: { amount: body.amount, requestId },
        },
      );
      return errorResponse(
        c,
        "Failed to create withdrawal request. Balance has been released.",
        500,
      );
    }

    // If pool returned error, rollback
    if (!poolResponse.ok) {
      poolLogger.error("Pool error, releasing reservation");
      await forwardToDO(
        balanceStub,
        `/balance/${body.fromAddress}/cancel-withdraw`,
        {
          method: "POST",
          body: { amount: body.amount, requestId },
        },
      );
    }

    return poolResponse;
  },
);

/**
 * POST /api/pool/:poolType/cancel - Cancel withdrawal request
 *
 * Two-phase:
 * 1. Cancel in pool
 * 2. Release reserved balance
 */
poolRouter.post(
  "/:poolType/cancel",
  validateParams(poolParamSchema),
  validateBody(cancelRequestSchema),
  async (c) => {
    const { poolType } = c.get("validatedParams");
    const { requestId, fromAddress } = c.get("validatedBody");

    // Phase 1: Cancel in pool
    const poolStub = getWithdrawPoolStub(c.env, poolType);
    const poolResponse = await forwardToDO(
      poolStub,
      `/pool/${poolType}/cancel`,
      {
        method: "POST",
        body: { requestId },
      },
    );

    if (!poolResponse.ok) {
      return poolResponse;
    }

    // Get amount from pool response for balance release
    const poolResult = (await poolResponse.clone().json()) as ApiResponse<{
      amount: string;
    }>;

    if (!poolResult.success || !poolResult.data?.amount) {
      return poolResponse;
    }

    // Phase 2: Release reserved balance
    const balanceStub = getVirtualBalanceStub(c.env, fromAddress);
    await forwardToDO(balanceStub, `/balance/${fromAddress}/cancel-withdraw`, {
      method: "POST",
      body: {
        amount: poolResult.data.amount,
        requestId,
      },
    });

    return poolResponse;
  },
);
