/**
 * Tests for useWallet hook
 *
 * Covers: initial state, wallet existence check, and lock/unlock flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock dependencies
vi.mock("@bitcoinbaby/bitcoin", () => ({
  BitcoinWallet: vi.fn().mockImplementation(() => ({
    generate: vi.fn(),
    importFromMnemonic: vi.fn(),
    getAddress: vi.fn(),
    getBalance: vi.fn(),
  })),
  createMempoolClient: vi.fn(),
}));

vi.mock("@bitcoinbaby/core", () => ({
  SecureStorage: {
    isAvailable: vi.fn(() => true),
    hasWallet: vi.fn(() => Promise.resolve(false)),
    getMetadata: vi.fn(() =>
      Promise.resolve({
        exists: false,
        createdAt: null,
        network: null,
        version: 0,
      }),
    ),
    storeMnemonic: vi.fn(),
    getMnemonic: vi.fn(),
    verifyPassword: vi.fn(),
    changePassword: vi.fn(),
    clear: vi.fn(),
    getUnlockStatus: vi.fn(() => ({
      failedAttempts: 0,
      canAttempt: true,
      waitTimeSeconds: 0,
    })),
  },
  useNetworkStore: vi.fn(() => ({
    network: "testnet4",
    setNetwork: vi.fn(),
  })),
  useWalletStore: vi.fn(() => ({
    wallet: null,
    isConnected: false,
    isLoading: false,
    isLocked: true,
    error: null,
    setWallet: vi.fn(),
    disconnect: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setLocked: vi.fn(),
    updateBalance: vi.fn(),
    setSigningFunctions: vi.fn(),
  })),
}));

vi.mock("@bitcoinbaby/shared", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { useWallet } from "../useWallet";

describe("useWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useWallet());

    expect(result.current.hasStoredWallet).toBe(false);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.address).toBeUndefined();
    expect(result.current.balance).toBeUndefined();
  });

  it("should expose wallet management functions", () => {
    const { result } = renderHook(() => useWallet());

    expect(typeof result.current.createWallet).toBe("function");
    expect(typeof result.current.importWallet).toBe("function");
    expect(typeof result.current.unlock).toBe("function");
    expect(typeof result.current.lock).toBe("function");
    expect(typeof result.current.deleteWallet).toBe("function");
    expect(typeof result.current.changePassword).toBe("function");
  });

  it("should not allow unlock with empty password", async () => {
    const { result } = renderHook(() => useWallet());

    await expect(result.current.unlock("")).rejects.toThrow();
  });

  it("should not allow createWallet with short password", async () => {
    const { result } = renderHook(() => useWallet());

    await expect(result.current.createWallet("short")).rejects.toThrow();
  });
});
