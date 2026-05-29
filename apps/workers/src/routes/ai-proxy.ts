/**
 * Cloudflare Workers AI Proxy
 *
 * Forwards AI inference requests to the Cloudflare Workers AI REST API,
 * injecting the API key server-side so it never reaches the browser.
 *
 * Endpoints:
 *   GET  /api/ai/health     - Proxy health check
 *   POST /api/ai/run        - AI inference
 *
 * Uses the CF_AI_API_TOKEN secret (set via `wrangler secret put CF_AI_API_TOKEN`).
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";

const aiProxy = new Hono<{ Bindings: Env }>();

const CF_AI_BASE = "https://api.cloudflare.com/client/v4/accounts";

// =============================================================================
// HEALTH CHECK
// =============================================================================

aiProxy.get("/health", async (c) => {
  const token = c.env.CF_AI_API_TOKEN;
  const accountId = c.env.CF_ACCOUNT_ID;

  if (!token || !accountId) {
    return c.json(
      {
        status: "unconfigured",
        message: "CF_AI_API_TOKEN or CF_ACCOUNT_ID not set",
      },
      503,
    );
  }

  // Verify the token works with a lightweight request
  try {
    const resp = await fetch(
      `${CF_AI_BASE}/${accountId}/ai/models/@cf/meta/llama-3.2-1b-instruct`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (resp.ok) {
      return c.json({ status: "ok", provider: "cloudflare-workers-ai" });
    }

    return c.json(
      { status: "degraded", message: `Upstream returned ${resp.status}` },
      502,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return c.json({ status: "down", message: msg }, 502);
  }
});

// =============================================================================
// AI RUN — Forward inference request to Cloudflare Workers AI
// =============================================================================

aiProxy.post("/run", async (c) => {
  const token = c.env.CF_AI_API_TOKEN;
  const accountId = c.env.CF_ACCOUNT_ID;

  if (!token || !accountId) {
    return c.json({ error: "AI proxy not configured" }, 503);
  }

  let body: {
    model?: string;
    prompt?: string;
    max_tokens?: number;
    temperature?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.model || !body.prompt) {
    return c.json({ error: "model and prompt are required" }, 400);
  }

  try {
    const cfResp = await fetch(
      `${CF_AI_BASE}/${accountId}/ai/run/${encodeURIComponent(body.model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: body.prompt,
          max_tokens: body.max_tokens ?? 64,
          temperature: body.temperature ?? 0.7,
        }),
      },
    );

    if (!cfResp.ok) {
      const errText = await cfResp.text().catch(() => "Unknown");
      return c.json(
        {
          error: `Upstream error: ${cfResp.status}`,
          detail: errText.slice(0, 300),
        },
        cfResp.status === 429 ? 429 : 502,
      );
    }

    const data = await cfResp.json<{
      result?: { response?: string; text?: string };
    }>();

    return c.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return c.json({ error: `Proxy error: ${msg}` }, 502);
  }
});

export { aiProxy };
