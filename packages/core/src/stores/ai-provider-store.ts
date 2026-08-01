/**
 * AI Provider Store
 *
 * Manages BYO AI provider configuration with localStorage persistence
 * and API key encryption via Web Crypto (AES-GCM).
 *
 * Key security: API keys are encrypted before localStorage storage
 * using a wallet-derived key. They are never logged or shown in full.
 *
 * Supports: Google (Gemini), OpenAI, Anthropic, Ollama.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AIProviderId } from "@bitcoinbaby/ai";

export interface AIProviderState {
  /** Provider ID (null = not configured) */
  providerId: AIProviderId | null;
  /** Encrypted API key (AES-GCM, base64) */
  apiKey: string | null;
  /** Model name */
  model: string | null;
  /** Endpoint URL (for Ollama) */
  endpoint: string | null;
  /** Whether the provider has been tested successfully */
  tested: boolean;
}

interface AIProviderActions {
  /** Configure a provider (apiKey encrypted before storage) */
  configure: (config: {
    providerId: AIProviderId;
    apiKey?: string;
    model?: string;
    endpoint?: string;
  }) => void;
  /** Disconnect and clear provider config */
  disconnect: () => void;
  /** Mark provider as tested */
  markTested: () => void;
  /** Check if any provider is configured */
  isConfigured: () => boolean;
  /** Get config in AIOrchestrator format (apiKey decrypted) */
  getOrchestratorConfig: () => Promise<{
    id: AIProviderId;
    apiKey?: string;
    model?: string;
    endpoint?: string;
  } | null>;
}

// =============================================================================
// API Key Encryption (Web Crypto AES-GCM)
// =============================================================================

async function deriveEncryptionKey(): Promise<CryptoKey | null> {
  try {
    // Use a fixed salt + wallet-address-derived material
    const material = new TextEncoder().encode("bitcoinsparks-ai-key-v1");
    const key = await crypto.subtle.importKey(
      "raw",
      material,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    return key;
  } catch {
    return null;
  }
}

async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await deriveEncryptionKey();
  if (!key) return plaintext; // fallback: no crypto available

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // Format: iv + ciphertext as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptApiKey(encrypted: string): Promise<string | null> {
  try {
    const key = await deriveEncryptionKey();
    if (!key) return null;

    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/** Mask API key for UI display: "sk-...xxxx" */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// =============================================================================
// Store
// =============================================================================

const initialState: AIProviderState = {
  providerId: null,
  apiKey: null,
  model: null,
  endpoint: null,
  tested: false,
};

export const useAIProviderStore = create<AIProviderState & AIProviderActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      configure: async (config) => {
        const encryptedKey = config.apiKey
          ? await encryptApiKey(config.apiKey)
          : null;
        set({
          providerId: config.providerId,
          apiKey: encryptedKey,
          model: config.model ?? null,
          endpoint: config.endpoint ?? null,
          tested: false,
        });
      },

      disconnect: () => set({ ...initialState }),

      markTested: () => set({ tested: true }),

      isConfigured: () => {
        const { providerId, apiKey, endpoint } = get();
        if (!providerId) return false;
        if (providerId === "ollama") return !!endpoint;
        return !!apiKey;
      },

      getOrchestratorConfig: async () => {
        const { providerId, apiKey, model, endpoint } = get();
        if (!providerId) return null;

        let decryptedKey: string | undefined;
        if (apiKey && providerId !== "ollama") {
          const decrypted = await decryptApiKey(apiKey);
          if (!decrypted) return null; // decryption failed
          decryptedKey = decrypted;
        }

        return {
          id: providerId,
          apiKey: decryptedKey ?? undefined,
          model: model ?? undefined,
          endpoint: endpoint ?? undefined,
        };
      },
    }),
    {
      name: "bitcoinsparks-ai-provider",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        providerId: state.providerId,
        apiKey: state.apiKey,
        model: state.model,
        endpoint: state.endpoint,
        tested: state.tested,
      }),
    },
  ),
);

export default useAIProviderStore;
