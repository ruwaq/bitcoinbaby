/**
 * Zustand Stores Tests
 *
 * Unit tests for core Zustand stores ensuring state management correctness.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock localStorage for all tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

// Set up localStorage mock globally
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// =============================================================================
// MINING STORE TESTS
// =============================================================================

describe("MiningStore", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    // Reset module cache to get fresh store instance
    vi.resetModules();
  });

  describe("Initial State", () => {
    it("should have correct initial values", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");

      const state = useMiningStore.getState();

      expect(state.stats.hashrate).toBe(0);
      expect(state.stats.totalHashes).toBe(0);
      expect(state.stats.tokensEarned).toBe(0);
      expect(state.stats.isActive).toBe(false);
      expect(state.stats.minerType).toBe("cpu");
      expect(state.effectiveHashrate).toBe(0);
      expect(state.cosmicMultiplier).toBe(1.0);
      expect(state.cosmicStatus).toBe("normal");
    });

    it("should have zeroed persisted stats initially", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");

      const state = useMiningStore.getState();

      expect(state.persistedStats.lifetimeHashes).toBe(0);
      expect(state.persistedStats.lifetimeTokens).toBe(0);
      expect(state.persistedStats.lifetimeUptime).toBe(0);
    });
  });

  describe("Mining Actions", () => {
    it("should start mining correctly", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");

      useMiningStore.getState().startMining();

      const state = useMiningStore.getState();
      expect(state.stats.isActive).toBe(true);
      expect(state.isInitialized).toBe(true);
    });

    it("should stop mining and save lifetime stats", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");
      const store = useMiningStore.getState();

      // Start mining and add some stats
      store.startMining();
      store.updateStats({ totalHashes: 1000, tokensEarned: 50, uptime: 60 });

      // Stop mining
      store.stopMining();

      const state = useMiningStore.getState();
      expect(state.stats.isActive).toBe(false);
      expect(state.stats.hashrate).toBe(0);
      expect(state.persistedStats.lifetimeHashes).toBe(1000);
      expect(state.persistedStats.lifetimeTokens).toBe(50);
      expect(state.persistedStats.lifetimeUptime).toBe(60);
    });

    it("should add hashes correctly", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");

      useMiningStore.getState().addHashes(500);
      expect(useMiningStore.getState().stats.totalHashes).toBe(500);

      useMiningStore.getState().addHashes(300);
      expect(useMiningStore.getState().stats.totalHashes).toBe(800);
    });

    it("should add tokens correctly", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");

      useMiningStore.getState().addTokens(100);
      expect(useMiningStore.getState().stats.tokensEarned).toBe(100);

      useMiningStore.getState().addTokens(50);
      expect(useMiningStore.getState().stats.tokensEarned).toBe(150);
    });
  });

  describe("Cosmic Energy", () => {
    it("should set cosmic energy and update effective hashrate", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");
      const store = useMiningStore.getState();

      // Set base hashrate first
      store.updateStats({ hashrate: 1000 });

      // Set cosmic energy
      store.setCosmicEnergy(1.5, "thriving", ["Solar Boost", "Lunar Power"]);

      const state = useMiningStore.getState();
      expect(state.cosmicMultiplier).toBe(1.5);
      expect(state.cosmicStatus).toBe("thriving");
      expect(state.activeCosmicEffects).toEqual(["Solar Boost", "Lunar Power"]);
      expect(state.effectiveHashrate).toBe(1500); // 1000 * 1.5
    });

    it("should handle critical cosmic status", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");

      useMiningStore.getState().updateStats({ hashrate: 1000 });
      useMiningStore.getState().setCosmicEnergy(0.5, "critical", []);

      const state = useMiningStore.getState();
      expect(state.cosmicMultiplier).toBe(0.5);
      expect(state.cosmicStatus).toBe("critical");
      expect(state.effectiveHashrate).toBe(500); // 1000 * 0.5
    });
  });

  describe("Reset", () => {
    it("should reset session stats but preserve lifetime stats", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");
      const store = useMiningStore.getState();

      // Build up some stats
      store.startMining();
      store.updateStats({ totalHashes: 5000, tokensEarned: 200 });
      store.stopMining();

      // Reset
      store.reset();

      const state = useMiningStore.getState();
      expect(state.stats.totalHashes).toBe(0);
      expect(state.stats.tokensEarned).toBe(0);
      expect(state.stats.isActive).toBe(false);
      expect(state.isInitialized).toBe(false);
      // Lifetime stats should be preserved
      expect(state.persistedStats.lifetimeHashes).toBe(5000);
    });
  });

  describe("NFT Boost Deprecation", () => {
    it("should warn when setNFTBoost is called", async () => {
      const { useMiningStore } = await import("../src/stores/mining-store");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      useMiningStore.getState().setNFTBoost(50);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("deprecated"),
      );

      warnSpy.mockRestore();
    });
  });
});

// =============================================================================
// DEAD LETTER STORE TESTS
// =============================================================================

describe("DeadLetterStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  describe("Initial State", () => {
    it("should have correct initial values", async () => {
      const { useDeadLetterStore } =
        await import("../src/stores/dead-letter-store");

      const state = useDeadLetterStore.getState();

      expect(state.isInitialized).toBe(false);
      expect(state.failedProofs).toEqual([]);
      expect(state.isRetrying).toBe(false);
      expect(state.lastError).toBeNull();
      expect(state.isAutoRetryEnabled).toBe(false);
      expect(state.stats.totalFailed).toBe(0);
      expect(state.stats.pendingRetry).toBe(0);
      expect(state.stats.exhausted).toBe(0);
      expect(state.stats.recovered).toBe(0);
    });
  });

  describe("Selectors", () => {
    it("selectRetryableCount should count pending and retrying proofs", async () => {
      const { selectRetryableCount } =
        await import("../src/stores/dead-letter-store");

      const mockState = {
        isInitialized: true,
        failedProofs: [
          { id: "1", status: "pending" },
          { id: "2", status: "retrying" },
          { id: "3", status: "exhausted" },
          { id: "4", status: "recovered" },
          { id: "5", status: "pending" },
        ],
        stats: {
          totalFailed: 5,
          pendingRetry: 2,
          exhausted: 1,
          recovered: 1,
          estimatedTokensAtRisk: 0,
        },
        isRetrying: false,
        lastError: null,
        isAutoRetryEnabled: false,
      };

      // @ts-expect-error - partial state for testing
      expect(selectRetryableCount(mockState)).toBe(3); // 2 pending + 1 retrying
    });

    it("selectExhaustedProofs should return only exhausted proofs", async () => {
      const { selectExhaustedProofs } =
        await import("../src/stores/dead-letter-store");

      const exhaustedProof = { id: "3", status: "exhausted" as const };
      const mockState = {
        isInitialized: true,
        failedProofs: [
          { id: "1", status: "pending" as const },
          { id: "2", status: "retrying" as const },
          exhaustedProof,
          { id: "4", status: "recovered" as const },
        ],
        stats: {
          totalFailed: 4,
          pendingRetry: 1,
          exhausted: 1,
          recovered: 1,
          estimatedTokensAtRisk: 0,
        },
        isRetrying: false,
        lastError: null,
        isAutoRetryEnabled: false,
      };

      // @ts-expect-error - partial state for testing
      const result = selectExhaustedProofs(mockState);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(exhaustedProof);
    });

    it("selectHasFailedProofs should return true when there are failed proofs", async () => {
      const { selectHasFailedProofs } =
        await import("../src/stores/dead-letter-store");

      const stateWithFailed = {
        stats: {
          totalFailed: 2,
          pendingRetry: 1,
          exhausted: 1,
          recovered: 0,
          estimatedTokensAtRisk: 100,
        },
      };

      const stateWithoutFailed = {
        stats: {
          totalFailed: 1,
          pendingRetry: 0,
          exhausted: 0,
          recovered: 1,
          estimatedTokensAtRisk: 0,
        },
      };

      // @ts-expect-error - partial state for testing
      expect(selectHasFailedProofs(stateWithFailed)).toBe(true);
      // @ts-expect-error - partial state for testing
      expect(selectHasFailedProofs(stateWithoutFailed)).toBe(false);
    });

    it("selectTokensAtRisk should return estimated tokens at risk", async () => {
      const { selectTokensAtRisk } =
        await import("../src/stores/dead-letter-store");

      const mockState = {
        stats: { estimatedTokensAtRisk: 12345 },
      };

      // @ts-expect-error - partial state for testing
      expect(selectTokensAtRisk(mockState)).toBe(12345);
    });
  });
});

// =============================================================================
// SETTINGS STORE TESTS
// =============================================================================

describe("SettingsStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  describe("Initial State", () => {
    it("should have correct default mining settings", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      const state = useSettingsStore.getState();

      expect(state.mining.difficulty).toBe("medium");
      expect(state.mining.minerType).toBe("auto");
    });

    it("should have correct default display settings", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      const state = useSettingsStore.getState();

      expect(state.display.theme).toBe("dark");
      expect(state.display.soundEnabled).toBe(true);
    });

    it("should have correct default security settings", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      const state = useSettingsStore.getState();

      // AutoLockTimeout is a number
      expect(state.security.autoLockTimeout).toBeDefined();
      expect(typeof state.security.autoLockTimeout).toBe("number");
    });
  });

  describe("Mining Settings", () => {
    it("should update mining difficulty", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      useSettingsStore.getState().setMiningDifficulty("hard");

      expect(useSettingsStore.getState().mining.difficulty).toBe("hard");
    });

    it("should update miner type preference", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      useSettingsStore.getState().setMinerType("gpu");

      expect(useSettingsStore.getState().mining.minerType).toBe("gpu");
    });
  });

  describe("Display Settings", () => {
    it("should set theme", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      useSettingsStore.getState().setTheme("light");

      expect(useSettingsStore.getState().display.theme).toBe("light");
    });

    it("should set sound enabled", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      useSettingsStore.getState().setSoundEnabled(false);

      expect(useSettingsStore.getState().display.soundEnabled).toBe(false);
    });
  });

  describe("Security Settings", () => {
    it("should update auto lock timeout", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");

      // Use a valid timeout value in ms
      useSettingsStore.getState().setAutoLockTimeout(900000);

      expect(useSettingsStore.getState().security.autoLockTimeout).toBe(900000);
    });
  });

  describe("Utility Functions", () => {
    it("should get correct difficulty value", async () => {
      const { getDifficultyValue, DIFFICULTY_VALUES } =
        await import("../src/stores/settings-store");

      expect(getDifficultyValue("easy")).toBe(DIFFICULTY_VALUES.easy);
      expect(getDifficultyValue("medium")).toBe(DIFFICULTY_VALUES.medium);
      expect(getDifficultyValue("hard")).toBe(DIFFICULTY_VALUES.hard);
    });
  });

  describe("Reset", () => {
    it("should reset all settings to defaults", async () => {
      const { useSettingsStore } = await import("../src/stores/settings-store");
      const store = useSettingsStore.getState();

      // Change a setting
      store.setMiningDifficulty("hard");
      store.setTheme("light");

      // Reset
      store.resetAllSettings();

      const state = useSettingsStore.getState();
      expect(state.mining.difficulty).toBe("medium");
      expect(state.display.theme).toBe("dark");
    });
  });
});

// =============================================================================
// NFT STORE TESTS
// =============================================================================

describe("NFTStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  describe("Initial State", () => {
    it("should have empty NFT list initially", async () => {
      const { useNFTStore } = await import("../src/stores/nft-store");

      const state = useNFTStore.getState();

      expect(state.ownedNFTs).toEqual([]);
      expect(state.selectedNFT).toBeNull();
      expect(state.bestBoost).toBe(0);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("Selectors", () => {
    it("selectBestBoost should return highest boost from state", async () => {
      const { selectBestBoost } = await import("../src/stores/nft-store");

      const mockState = {
        bestBoost: 25,
      };

      // @ts-expect-error - partial state for testing
      expect(selectBestBoost(mockState)).toBe(25);
    });

    it("selectTotalNFTs should return correct count", async () => {
      const { selectTotalNFTs } = await import("../src/stores/nft-store");

      const mockState = {
        totalNFTs: 3,
      };

      // @ts-expect-error - partial state for testing
      expect(selectTotalNFTs(mockState)).toBe(3);
    });

    it("selectSelectedNFT should return selected NFT", async () => {
      const { selectSelectedNFT } = await import("../src/stores/nft-store");

      const selectedNFT = { tokenId: 2 };
      const mockState = {
        selectedNFT: selectedNFT,
      };

      // @ts-expect-error - partial state for testing
      expect(selectSelectedNFT(mockState)).toEqual(selectedNFT);
    });
  });
});

// =============================================================================
// NETWORK STORE TESTS
// =============================================================================

describe("NetworkStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  describe("Initial State", () => {
    it("should default to testnet4", async () => {
      const { useNetworkStore } = await import("../src/stores/network-store");

      const state = useNetworkStore.getState();

      expect(state.network).toBe("testnet4");
    });
  });

  describe("Network Switching", () => {
    it("should switch to mainnet when allowed", async () => {
      const { useNetworkStore } = await import("../src/stores/network-store");

      // Enable mainnet first (disabled by default for safety)
      useNetworkStore.getState().setMainnetAllowed(true);
      useNetworkStore.getState().switchNetwork("mainnet");

      expect(useNetworkStore.getState().network).toBe("mainnet");
    });

    it("should not switch to mainnet when not allowed", async () => {
      const { useNetworkStore } = await import("../src/stores/network-store");

      // Mainnet is disabled by default
      useNetworkStore.getState().switchNetwork("mainnet");

      // Should remain on testnet4
      expect(useNetworkStore.getState().network).toBe("testnet4");
      expect(useNetworkStore.getState().error).toContain("not enabled");
    });

    it("should switch back to testnet4 when mainnet disabled", async () => {
      const { useNetworkStore } = await import("../src/stores/network-store");

      // Enable, switch to mainnet, then disable
      useNetworkStore.getState().setMainnetAllowed(true);
      useNetworkStore.getState().switchNetwork("mainnet");
      useNetworkStore.getState().setMainnetAllowed(false);

      // Should automatically switch back to testnet4
      expect(useNetworkStore.getState().network).toBe("testnet4");
    });
  });

  describe("Configuration", () => {
    it("should export network configs", async () => {
      const { NETWORK_CONFIGS } = await import("../src/stores/network-store");

      expect(NETWORK_CONFIGS).toBeDefined();
      expect(NETWORK_CONFIGS.testnet4).toBeDefined();
      expect(NETWORK_CONFIGS.mainnet).toBeDefined();
    });

    it("should have coin type in config", async () => {
      const { NETWORK_CONFIGS } = await import("../src/stores/network-store");

      // Testnet uses coin type 1, mainnet uses coin type 0
      expect(NETWORK_CONFIGS.testnet4.coinType).toBe(1);
      expect(NETWORK_CONFIGS.mainnet.coinType).toBe(0);
    });
  });
});

// =============================================================================
// OVERLAY STORE TESTS
// =============================================================================

describe("OverlayStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("Initial State", () => {
    it("should have no active overlays initially", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      const state = useOverlayStore.getState();

      expect(state.activeOverlay).toBeNull();
      expect(state.overlayData).toBeNull();
    });
  });

  describe("Overlay Operations", () => {
    it("should open and close overlays", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore.getState().openOverlay("withdraw");
      expect(useOverlayStore.getState().activeOverlay).toBe("withdraw");

      useOverlayStore.getState().closeOverlay();
      expect(useOverlayStore.getState().activeOverlay).toBeNull();
    });

    it("should handle overlay with data", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore.getState().openOverlay("send", { amount: "1000" });

      const state = useOverlayStore.getState();
      expect(state.activeOverlay).toBe("send");
      expect(state.overlayData).toEqual({ amount: "1000" });
    });

    it("should open modal overlays", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore.getState().openOverlay("unlock-wallet");
      expect(useOverlayStore.getState().activeOverlay).toBe("unlock-wallet");

      useOverlayStore.getState().closeOverlay();
      expect(useOverlayStore.getState().activeOverlay).toBeNull();
    });

    it("should handle modal with data", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore
        .getState()
        .openOverlay("confirm-action", { title: "Confirm Action" });

      const state = useOverlayStore.getState();
      expect(state.activeOverlay).toBe("confirm-action");
      expect(state.overlayData?.title).toBe("Confirm Action");
    });
  });

  describe("Close All", () => {
    it("should close all overlays", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore.getState().openOverlay("withdraw");

      useOverlayStore.getState().closeAllOverlays();

      const state = useOverlayStore.getState();
      expect(state.activeOverlay).toBeNull();
      expect(state.overlayHistory).toEqual([]);
    });
  });

  describe("Overlay History", () => {
    it("should maintain overlay history when switching", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore.getState().openOverlay("withdraw");
      useOverlayStore.getState().openOverlay("send");

      const state = useOverlayStore.getState();
      expect(state.activeOverlay).toBe("send");
      expect(state.overlayHistory).toHaveLength(1);
      expect(state.overlayHistory[0].type).toBe("withdraw");
    });

    it("should go back to previous overlay", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      useOverlayStore.getState().openOverlay("withdraw");
      useOverlayStore.getState().openOverlay("send");
      useOverlayStore.getState().goBack();

      expect(useOverlayStore.getState().activeOverlay).toBe("withdraw");
    });
  });

  describe("isOpen helper", () => {
    it("should correctly report open state", async () => {
      const { useOverlayStore } = await import("../src/stores/overlay-store");

      expect(useOverlayStore.getState().isOpen("withdraw")).toBe(false);

      useOverlayStore.getState().openOverlay("withdraw");

      expect(useOverlayStore.getState().isOpen("withdraw")).toBe(true);
      expect(useOverlayStore.getState().isOpen("send")).toBe(false);
    });
  });

  describe("Hook Utilities", () => {
    it("should provide hook utilities", async () => {
      const {
        useWithdrawOverlay,
        useSendOverlay,
        useReceiveOverlay,
        useSettingsOverlay,
        useHistoryOverlay,
        useUnlockModal,
        useConfirmModal,
      } = await import("../src/stores/overlay-store");

      // Just check these hooks exist
      expect(typeof useWithdrawOverlay).toBe("function");
      expect(typeof useSendOverlay).toBe("function");
      expect(typeof useReceiveOverlay).toBe("function");
      expect(typeof useSettingsOverlay).toBe("function");
      expect(typeof useHistoryOverlay).toBe("function");
      expect(typeof useUnlockModal).toBe("function");
      expect(typeof useConfirmModal).toBe("function");
    });

    it("should get correct overlay mode", async () => {
      const { getOverlayMode } = await import("../src/stores/overlay-store");

      expect(getOverlayMode("withdraw")).toBe("sheet");
      expect(getOverlayMode("send")).toBe("sheet");
      expect(getOverlayMode("unlock-wallet")).toBe("modal");
      expect(getOverlayMode("confirm-action")).toBe("modal");
    });
  });
});
