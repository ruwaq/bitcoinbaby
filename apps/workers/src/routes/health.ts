/**
 * Health & Metrics Routes
 *
 * Provides system status checks and Prometheus metrics endpoints.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getRedis } from "../lib/redis";
import { metrics } from "../lib/metrics";

export const healthRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /health - Check connectivity to KV cache, Redis, and overall API status
 */
healthRouter.get("/", async (c) => {
  const checks: Record<string, "ok" | "error" | "unknown"> = {
    api: "ok",
    redis: "unknown",
    kv: "unknown",
  };

  // Check Redis connectivity
  try {
    const redis = getRedis(c.env);
    if (redis) {
      await redis.ping();
      checks.redis = "ok";
    }
  } catch {
    checks.redis = "error";
  }

  // Check KV availability
  try {
    if (c.env.CACHE) {
      // Simple read test
      await c.env.CACHE.get("health-check-test");
      checks.kv = "ok";
    }
  } catch {
    checks.kv = "error";
  }

  const allHealthy = Object.values(checks).every(
    (v) => v === "ok" || v === "unknown",
  );

  return c.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      environment: c.env.ENVIRONMENT || "development",
      version: "2.0.0",
      checks,
      timestamp: Date.now(),
    },
    allHealthy ? 200 : 503,
  );
});

/**
 * GET /health/metrics - JSON metrics summary
 */
healthRouter.get("/metrics", (c) => {
  return c.json({
    success: true,
    data: metrics.summary(),
    timestamp: Date.now(),
  });
});

/**
 * GET /health/metrics/prometheus - Prometheus-formatted text metrics
 */
healthRouter.get("/metrics/prometheus", (c) => {
  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.text(metrics.toPrometheus());
});
