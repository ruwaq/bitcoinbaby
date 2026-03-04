/**
 * Game Routes
 *
 * Game room and state synchronization endpoints.
 *
 * Routes:
 * - GET  /api/game/:roomId              - WebSocket connection
 * - GET  /api/game/:roomId/state        - Get current game state
 * - GET  /api/game/:roomId/achievements - Get achievements
 * - POST /api/game/:roomId/achievements - Add achievements
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../lib/types";
import { errorResponse } from "../lib/helpers";
import { validateBody, validateParams } from "../lib/middleware";

export const gameRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// SCHEMAS
// =============================================================================

const roomIdParamSchema = z.object({
  roomId: z.string().min(1),
});

const achievementsBodySchema = z.object({
  achievements: z.array(z.string()),
});

// =============================================================================
// HELPER
// =============================================================================

function getGameRoomStub(env: Env, roomId: string) {
  const id = env.GAME_ROOM.idFromName(roomId);
  return env.GAME_ROOM.get(id);
}

// =============================================================================
// GAME ROOM ROUTES
// =============================================================================

/**
 * GET /api/game/:roomId - WebSocket connection for game state sync
 */
gameRouter.get("/:roomId", validateParams(roomIdParamSchema), async (c) => {
  const { roomId } = c.get("validatedParams");
  const upgradeHeader = c.req.header("Upgrade");

  if (upgradeHeader !== "websocket") {
    return errorResponse(c, "Expected WebSocket connection", 400);
  }

  const stub = getGameRoomStub(c.env, roomId);
  return stub.fetch(c.req.raw);
});

/**
 * GET /api/game/:roomId/state - Get current game state (HTTP)
 */
gameRouter.get(
  "/:roomId/state",
  validateParams(roomIdParamSchema),
  async (c) => {
    const { roomId } = c.get("validatedParams");
    const stub = getGameRoomStub(c.env, roomId);

    return stub.fetch(new Request(`http://internal/game/${roomId}/state`));
  },
);

/**
 * GET /api/game/:roomId/achievements - Get achievements for a room
 */
gameRouter.get(
  "/:roomId/achievements",
  validateParams(roomIdParamSchema),
  async (c) => {
    const { roomId } = c.get("validatedParams");
    const stub = getGameRoomStub(c.env, roomId);

    return stub.fetch(
      new Request(`http://internal/game/${roomId}/achievements`),
    );
  },
);

/**
 * POST /api/game/:roomId/achievements - Add achievements to a room
 */
gameRouter.post(
  "/:roomId/achievements",
  validateParams(roomIdParamSchema),
  validateBody(achievementsBodySchema),
  async (c) => {
    const { roomId } = c.get("validatedParams");
    const body = c.get("validatedBody");
    const stub = getGameRoomStub(c.env, roomId);

    return stub.fetch(
      new Request(`http://internal/game/${roomId}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  },
);
