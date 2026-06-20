/**
 * External AI Proxy — forwards requests to OpenAI, Anthropic, and Google
 *
 * API keys are injected server-side. The browser never sees them.
 * Each provider has a different endpoint and request/response format.
 *
 * Endpoint: POST /api/ai/proxy
 * Body: { provider, model, messages, apiKey }
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";

const aiProxyExternal = new Hono<{ Bindings: Env }>();

interface ProxyRequest {
  provider: "openai" | "anthropic" | "google";
  model: string;
  messages: Array<{ role: string; content: string }>;
  apiKey: string;
}

const ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
};

// =============================================================================
// MAIN PROXY ENDPOINT
// =============================================================================

aiProxyExternal.post("/", async (c) => {
  let body: ProxyRequest;
  try {
    body = await c.req.json<ProxyRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { provider, model, messages, apiKey } = body;

  if (!provider || !model || !messages || !apiKey) {
    return c.json(
      { error: "provider, model, messages, and apiKey are required" },
      400
    );
  }

  const endpoint = ENDPOINTS[provider];
  if (!endpoint) {
    return c.json({ error: `Unknown provider: ${provider}` }, 400);
  }

  try {
    let reqBody: string;
    let reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let url: string;

    switch (provider) {
      // =======================================================================
      // OPENAI — /v1/chat/completions
      // =======================================================================
      case "openai": {
        url = endpoint;
        reqHeaders["Authorization"] = `Bearer ${apiKey}`;
        reqBody = JSON.stringify({
          model,
          messages,
          max_tokens: 256,
          temperature: 0.7,
        });
        break;
      }

      // =======================================================================
      // ANTHROPIC — /v1/messages
      // =======================================================================
      case "anthropic": {
        url = endpoint;
        reqHeaders["x-api-key"] = apiKey;
        reqHeaders["anthropic-version"] = "2023-06-01";

        const systemMsg =
          messages.find((m) => m.role === "system")?.content ?? "";
        const userMessages = messages.filter((m) => m.role !== "system");

        reqBody = JSON.stringify({
          model,
          system: systemMsg || undefined,
          messages: userMessages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
          max_tokens: 256,
        });
        break;
      }

      // =======================================================================
      // GOOGLE — generateContent
      // =======================================================================
      case "google": {
        url = `${endpoint}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const systemMsg = messages.find((m) => m.role === "system");
        const contents = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          }));

        const googleBody: Record<string, unknown> = { contents };
        if (systemMsg) {
          googleBody.systemInstruction = {
            parts: [{ text: systemMsg.content }],
          };
        }

        reqBody = JSON.stringify(googleBody);
        break;
      }

      default:
        return c.json({ error: "Unreachable" }, 500);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: reqHeaders,
      body: reqBody,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown");
      return c.json(
        {
          error: `Upstream error: ${res.status}`,
          detail: errText.slice(0, 300),
        },
        res.status === 429 ? 429 : 502
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Normalize response across providers
    let text = "";
    let tokensUsed = 0;

    switch (provider) {
      case "openai": {
        const choices = data.choices as Array<{
          message: { content: string };
        }>;
        text = choices?.[0]?.message?.content ?? "";
        tokensUsed =
          (data.usage as { total_tokens: number })?.total_tokens ?? 0;
        break;
      }
      case "anthropic": {
        const content = data.content as Array<{ text: string }>;
        text = content?.[0]?.text ?? "";
        tokensUsed =
          (data.usage as { output_tokens: number })?.output_tokens ?? 0;
        break;
      }
      case "google": {
        const candidates = data.candidates as Array<{
          content: { parts: Array<{ text: string }> };
        }>;
        text = candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        tokensUsed =
          (data.usageMetadata as { totalTokenCount: number })
            ?.totalTokenCount ?? 0;
        break;
      }
    }

    return c.json({ text, tokensUsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Proxy error: ${msg}` }, 502);
  }
});

export { aiProxyExternal };