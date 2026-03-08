/**
 * Engagement Routes
 *
 * API endpoints for tracking user engagement:
 * - Daily login
 * - Baby care actions
 * - Play time tracking
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getRedis } from "../lib/redis";
import {
  getEngagementState,
  updateEngagementState,
  recordDailyLogin,
  calculateEngagementBoost,
} from "../lib/engagement-boost";
import { Logger } from "../lib/logger";

const engagementLogger = new Logger("EngagementRoutes");

// Create Hono app for engagement routes
const engagementRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// GET /api/engagement/:address - Get engagement state
// =============================================================================

engagementRouter.get("/:address", async (c) => {
  const address = c.req.param("address");

  if (!address || address.length < 20) {
    return c.json({ success: false, error: "Invalid address" }, 400);
  }

  try {
    const redis = getRedis(c.env);
    const state = await getEngagementState(redis, address);
    const boostData = calculateEngagementBoost(state);

    return c.json({
      success: true,
      data: {
        state,
        boost: {
          totalPercent: boostData.totalBoostPercent,
          breakdown: boostData.breakdown,
        },
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    engagementLogger.error("Failed to get engagement", error);
    return c.json({ success: false, error: "Failed to get engagement" }, 500);
  }
});

// =============================================================================
// POST /api/engagement/:address/login - Record daily login
// =============================================================================

engagementRouter.post("/:address/login", async (c) => {
  const address = c.req.param("address");

  if (!address || address.length < 20) {
    return c.json({ success: false, error: "Invalid address" }, 400);
  }

  try {
    const redis = getRedis(c.env);
    const result = await recordDailyLogin(redis, address);

    // Get updated state and boost
    const state = await getEngagementState(redis, address);
    const boostData = calculateEngagementBoost(state);

    return c.json({
      success: true,
      data: {
        streakUpdated: result.streakUpdated,
        newStreak: result.newStreak,
        state,
        boost: {
          totalPercent: boostData.totalBoostPercent,
          breakdown: boostData.breakdown,
        },
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    engagementLogger.error("Failed to record login", error);
    return c.json({ success: false, error: "Failed to record login" }, 500);
  }
});

// =============================================================================
// POST /api/engagement/:address/baby-care - Update baby health
// =============================================================================

engagementRouter.post("/:address/baby-care", async (c) => {
  const address = c.req.param("address");

  if (!address || address.length < 20) {
    return c.json({ success: false, error: "Invalid address" }, 400);
  }

  let body: { action: string; healthDelta?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.action) {
    return c.json({ success: false, error: "Action required" }, 400);
  }

  try {
    const redis = getRedis(c.env);
    const currentState = await getEngagementState(redis, address);

    // Calculate health change based on action
    let healthDelta = body.healthDelta ?? 0;

    // Predefined actions
    switch (body.action) {
      case "feed":
        healthDelta = 5;
        break;
      case "play":
        healthDelta = 3;
        break;
      case "clean":
        healthDelta = 4;
        break;
      case "sleep":
        healthDelta = 2;
        break;
      case "neglect":
        healthDelta = -10;
        break;
      // Custom delta passed in body
      default:
        break;
    }

    const newHealth = Math.max(
      0,
      Math.min(100, currentState.babyHealthScore + healthDelta),
    );

    await updateEngagementState(redis, address, {
      babyHealthScore: newHealth,
    });

    // Get updated state and boost
    const state = await getEngagementState(redis, address);
    const boostData = calculateEngagementBoost(state);

    return c.json({
      success: true,
      data: {
        action: body.action,
        healthDelta,
        newHealth,
        state,
        boost: {
          totalPercent: boostData.totalBoostPercent,
          breakdown: boostData.breakdown,
        },
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    engagementLogger.error("Failed to update baby care", error);
    return c.json({ success: false, error: "Failed to update baby care" }, 500);
  }
});

// =============================================================================
// POST /api/engagement/:address/play-time - Add play time
// =============================================================================

engagementRouter.post("/:address/play-time", async (c) => {
  const address = c.req.param("address");

  if (!address || address.length < 20) {
    return c.json({ success: false, error: "Invalid address" }, 400);
  }

  let body: { minutes: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (typeof body.minutes !== "number" || body.minutes < 0) {
    return c.json({ success: false, error: "Valid minutes required" }, 400);
  }

  // Cap at reasonable amount per call (prevent abuse)
  const minutes = Math.min(body.minutes, 60);

  try {
    const redis = getRedis(c.env);

    await updateEngagementState(redis, address, {
      playTimeToday: minutes,
    });

    // Get updated state and boost
    const state = await getEngagementState(redis, address);
    const boostData = calculateEngagementBoost(state);

    return c.json({
      success: true,
      data: {
        minutesAdded: minutes,
        totalPlayTimeToday: state.playTimeToday,
        state,
        boost: {
          totalPercent: boostData.totalBoostPercent,
          breakdown: boostData.breakdown,
        },
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    engagementLogger.error("Failed to update play time", error);
    return c.json({ success: false, error: "Failed to update play time" }, 500);
  }
});

export { engagementRouter };
