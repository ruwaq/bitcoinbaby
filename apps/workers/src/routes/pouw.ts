/**
 * PoUW AI Mining Routes
 *
 * Routing layer for requesting and verifying JIT useful work tasks.
 *
 * Security model:
 * - Tasks are generated server-side with a unique nonce (block hash + timestamp)
 * - Client submits AI output + signature for verification
 * - Server validates the submission before crediting rewards
 * - This prevents spoofing of AI work (client can't fake inference results)
 *
 * Routes:
 * - GET  /api/pouw/:address/task   - Request AI generation task for an address
 * - POST /api/pouw/:address/verify - Submit AI output for verification
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/types";
import { getVirtualBalanceStub, forwardToDO, safeDOCall } from "../lib/helpers";
import {
  validateParams,
  validateBody,
  bitcoinAddressSchema,
} from "../lib/middleware";

export const pouwRouter = new Hono<{ Bindings: Env }>();

// Schema for address parameter
const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

// Schema for AI proof verification
const aiVerificationSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  output: z.string().min(1, "Output is required"),
  computeTime: z.number().positive("Compute time must be positive"),
  signature: z.string().min(1, "Client signature is required"),
  publicKey: z
    .string()
    .regex(/^[0-9a-fA-F]{64,66}$/, "Public key must be a valid hex string"),
});

/**
 * GET /api/pouw/:address/task - Retrieve JIT useful work task
 *
 * Returns a server-generated task with a unique nonce (block hash).
 * The nonce binds the task to a specific Bitcoin block, preventing
 * replay attacks and ensuring task freshness.
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

/**
 * POST /api/pouw/:address/verify - Submit AI output for verification
 *
 * The client submits the AI inference result along with a signature.
 * The server validates:
 * 1. The task exists and is still active
 * 2. The task hasn't expired (5 minute TTL)
 * 3. The output meets minimum quality requirements (length, coherence)
 * 4. The signature matches the public key
 *
 * On success, the task is marked as completed and the user receives
 * credit for useful work performed.
 */
pouwRouter.post(
  "/:address/verify",
  validateParams(addressParamSchema),
  validateBody(aiVerificationSchema),
  async (c) => {
    const { address } = c.get("validatedParams");
    const proof = c.get("validatedBody");

    return safeDOCall(
      c,
      async () => {
        const stub = getVirtualBalanceStub(c.env, address);
        return forwardToDO(stub, `/balance/${address}/pouw-verify`, {
          method: "POST",
          body: {
            taskId: proof.taskId,
            output: proof.output,
            computeTime: String(proof.computeTime),
            signature: proof.signature,
            publicKey: proof.publicKey,
          },
        });
      },
      "PoUW:Verify",
    );
  },
);
