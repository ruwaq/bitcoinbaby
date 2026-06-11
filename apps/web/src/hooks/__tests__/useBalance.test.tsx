/**
 * Tests for useBalance hook — TanStack Query powered
 *
 * Covers: initialization, loading state, error handling, and refresh behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock the bitcoin package
vi.mock("@bitcoinbaby/bitcoin", () => ({
  createMempoolClient: vi.fn(() => ({
    getBalance: vi.fn(),
    getUTXOs: vi.fn(),
    getFeeEstimates: vi.fn(),
  })),
}));

import { useBalance } from "../useBalance";
import { createMempoolClient } from "@bitcoinbaby/bitcoin";

// Wrapper with QueryClientProvider for TanStack Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry in tests
        gcTime: 0, // Don't cache in tests
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useBalance", () => {
  const mockAddress = "tb1qtest123456789address";

  beforeEach(() => {
    vi.clearAllMocks();
    createMempoolClient({ network: "testnet4" });
  });

  it("should initialize with default state", async () => {
    const { result } = renderHook(
      () => useBalance({ address: mockAddress, autoRefresh: false }),
      { wrapper: createWrapper() },
    );

    // Initial state before query resolves
    expect(result.current.balance).toBeNull();
    expect(result.current.utxos).toEqual([]);
    expect(result.current.fees).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should not fetch when no address is provided", () => {
    const { result } = renderHook(() => useBalance({ autoRefresh: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.balance).toBeNull();
    expect(result.current.utxos).toEqual([]);
    expect(result.current.fees).toBeNull();
  });

  it("should expose a refresh function", () => {
    const { result } = renderHook(
      () => useBalance({ address: mockAddress, autoRefresh: false }),
      { wrapper: createWrapper() },
    );

    expect(typeof result.current.refresh).toBe("function");
  });

  it("should handle refresh when address is empty gracefully", async () => {
    const { result } = renderHook(() => useBalance({ autoRefresh: false }), {
      wrapper: createWrapper(),
    });

    // Should not throw when refreshing without address
    const refreshResult = result.current.refresh();
    expect(refreshResult).toBeUndefined();
  });
});