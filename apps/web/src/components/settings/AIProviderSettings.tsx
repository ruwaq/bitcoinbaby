"use client";

/**
 * AIProviderSettings — UI for configuring BYO AI provider
 */

import { useState } from "react";
import type { AIProviderId } from "@bitcoinbaby/ai";

const PROVIDERS: Array<{
  id: AIProviderId;
  label: string;
  models: string[];
  needsEndpoint?: boolean;
}> = [
  {
    id: "ollama",
    label: "Ollama (Local)",
    models: ["llama3", "mistral", "phi3"],
    needsEndpoint: true,
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    models: [
      "claude-3-haiku-20240307",
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
    ],
  },
  {
    id: "google",
    label: "Google (Gemini)",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
  },
];

export function AIProviderSettings() {
  const [selectedProvider, setSelectedProvider] = useState<
    AIProviderId | ""
  >("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("http://localhost:11434");
  const [status, setStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const selectedProviderData = PROVIDERS.find(
    (p) => p.id === selectedProvider
  );

  const handleSave = () => {
    if (!selectedProvider || !apiKey) return;
    // TODO: encrypt and save via spark-store or dedicated hook
    localStorage.setItem(
      "bitcoinsparks-ai-provider",
      JSON.stringify({
        provider: selectedProvider,
        apiKey, // will be encrypted in production
        model: model || selectedProviderData?.models[0],
        endpoint,
      })
    );
    setStatus("success");
    setStatusMsg("Provider saved! (API key stored in localStorage — will be encrypted)");
  };

  const handleDisconnect = () => {
    localStorage.removeItem("bitcoinsparks-ai-provider");
    setSelectedProvider("");
    setApiKey("");
    setModel("");
    setStatus("idle");
    setStatusMsg("");
  };

  return (
    <div className="space-y-4">
      {/* Provider Select */}
      <div>
        <label className="block font-pixel text-[10px] text-pixel-text-muted mb-1">
          PROVIDER
        </label>
        <select
          className="w-full p-2 font-pixel text-sm bg-pixel-bg-light text-pixel-text border-4 border-black"
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value as AIProviderId);
            setModel("");
            setStatus("idle");
            setStatusMsg("");
          }}
        >
          <option value="">-- Select provider --</option>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      {selectedProvider && selectedProvider !== "ollama" && (
        <div>
          <label className="block font-pixel text-[10px] text-pixel-text-muted mb-1">
            API KEY
          </label>
          <input
            type="password"
            className="w-full p-2 font-pixel text-sm bg-pixel-bg-light text-pixel-text border-4 border-black"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
      )}

      {/* Ollama Endpoint */}
      {selectedProvider === "ollama" && (
        <div>
          <label className="block font-pixel text-[10px] text-pixel-text-muted mb-1">
            ENDPOINT
          </label>
          <input
            type="text"
            className="w-full p-2 font-pixel text-sm bg-pixel-bg-light text-pixel-text border-4 border-black"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
      )}

      {/* Model Select */}
      {selectedProviderData && (
        <div>
          <label className="block font-pixel text-[10px] text-pixel-text-muted mb-1">
            MODEL
          </label>
          <select
            className="w-full p-2 font-pixel text-sm bg-pixel-bg-light text-pixel-text border-4 border-black"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">-- Select model --</option>
            {selectedProviderData.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 px-4 py-2 font-pixel text-[10px] bg-green-600 text-white border-4 border-black hover:bg-green-500 disabled:opacity-50"
          onClick={handleSave}
          disabled={!selectedProvider}
        >
          SAVE
        </button>
        <button
          className="flex-1 px-4 py-2 font-pixel text-[10px] bg-red-600 text-white border-4 border-black hover:bg-red-500"
          onClick={handleDisconnect}
        >
          DISCONNECT
        </button>
      </div>

      {/* Status */}
      {statusMsg && (
        <p
          className={`font-pixel text-[10px] ${
            status === "success"
              ? "text-green-400"
              : status === "error"
                ? "text-red-400"
                : "text-pixel-text-muted"
          }`}
        >
          {statusMsg}
        </p>
      )}
    </div>
  );
}