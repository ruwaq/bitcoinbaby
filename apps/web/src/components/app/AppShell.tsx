"use client";

/**
 * AppShell - Main application shell
 *
 * Unified dashboard with:
 * - Persistent header with mining status
 * - Tab navigation
 * - Content area that switches without unmounting mining
 */

import {
  useState,
  useCallback,
  useEffect,
  Suspense,
  startTransition,
  useRef,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Reset all app data - clears IndexedDB and localStorage
 */
async function resetAllData() {
  // Clear localStorage keys
  const keysToRemove = [
    "bitcoinbaby-nft-store",
    "bitcoinbaby-mining-store",
    "bitcoinbaby-baby-store",
    "bitcoinbaby-wallet-store",
    "bitcoinbaby-network",
    "bitcoinbaby-settings",
    "bitcoinbaby-leaderboard",
    "bitcoinbaby-tutorial",
    "bitcoinbaby-game",
    "bitcoinbaby_game_state",
  ];
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  // Clear IndexedDB
  if (typeof indexedDB !== "undefined") {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes("bitcoinbaby")) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {
      // Fallback for browsers that don't support databases()
      indexedDB.deleteDatabase("bitcoinbaby");
    }
  }

  // Reload
  window.location.reload();
}
import { AppHeader } from "./AppHeader";
import { TabNavigation, type TabType } from "./TabNavigation";

// Reset confirmation modal component
function ResetConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset input when modal opens (not on close to avoid cascading renders)
  useEffect(() => {
    if (isOpen) {
      // Clear any previous text when opening
      queueMicrotask(() => setConfirmText(""));
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  const canConfirm = confirmText.toLowerCase() === "reset";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-pixel-bg-dark border-4 border-pixel-error p-6 shadow-[8px_8px_0_0_#000] max-w-md mx-4">
        {/* Warning Icon */}
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
          <span className="font-pixel text-2xl text-pixel-error">!</span>
        </div>

        <h3
          id="reset-modal-title"
          className="font-pixel text-pixel-error text-sm text-center mb-4"
        >
          RESET ALL DATA?
        </h3>

        <div className="space-y-3 mb-6">
          <p className="font-pixel-body text-sm text-pixel-text text-center">
            This will permanently delete:
          </p>
          <ul className="space-y-1 font-pixel text-[8px] text-pixel-text-muted">
            <li className="flex items-center gap-2">
              <span className="text-pixel-error">X</span> Your wallet data
            </li>
            <li className="flex items-center gap-2">
              <span className="text-pixel-error">X</span> Mining progress
            </li>
            <li className="flex items-center gap-2">
              <span className="text-pixel-error">X</span> Baby evolution state
            </li>
            <li className="flex items-center gap-2">
              <span className="text-pixel-error">X</span> All local settings
            </li>
          </ul>
          <p className="font-pixel text-[8px] text-pixel-warning text-center mt-4">
            Make sure you have your recovery phrase saved!
          </p>
        </div>

        {/* Confirmation input */}
        <div className="mb-4">
          <label
            htmlFor="reset-confirm-input"
            className="font-pixel text-[8px] text-pixel-text-muted block mb-2"
          >
            Type RESET to confirm:
          </label>
          <input
            ref={inputRef}
            id="reset-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESET"
            className="w-full px-3 py-2 font-pixel text-xs bg-pixel-bg-light border-2 border-pixel-border text-pixel-text uppercase"
            autoComplete="off"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 font-pixel text-[10px] uppercase bg-pixel-bg-light text-pixel-text border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 px-4 py-3 font-pixel text-[10px] uppercase bg-pixel-error text-white border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
}

// Lazy load sections for better performance
import dynamic from "next/dynamic";

const TokenSection = dynamic(
  () => import("../sections/TokenSection").then((m) => m.TokenSection),
  { ssr: false },
);
const MiningSection = dynamic(
  () => import("../sections/MiningSection").then((m) => m.MiningSection),
  { ssr: false },
);
const NFTsSection = dynamic(
  () => import("../sections/NFTsSection").then((m) => m.NFTsSection),
  { ssr: false },
);
const WalletSection = dynamic(
  () => import("../sections/WalletSection").then((m) => m.WalletSection),
  { ssr: false },
);
const MoreSection = dynamic(
  () => import("../sections/MoreSection").then((m) => m.MoreSection),
  { ssr: false },
);

// Loading placeholder
function SectionLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="font-pixel text-xs text-pixel-text-muted animate-pulse">
        Loading...
      </div>
    </div>
  );
}

// Inner component that uses searchParams
function AppShellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get tab from URL or default to "token"
  const urlTab = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(urlTab || "token");

  // Reset confirmation modal state
  const [showResetModal, setShowResetModal] = useState(false);

  const handleResetConfirm = useCallback(() => {
    setShowResetModal(false);
    resetAllData();
  }, []);

  // Sync URL with tab
  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      // Update URL without full navigation
      const url = tab === "token" ? "/" : `/?tab=${tab}`;
      router.push(url, { scroll: false });
    },
    [router],
  );

  // Sync tab from URL changes (back/forward navigation)
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      startTransition(() => setActiveTab(urlTab));
    } else if (!urlTab && activeTab !== "token") {
      startTransition(() => setActiveTab("token"));
    }
  }, [urlTab, activeTab]);

  // Quick navigation handlers
  const goToMining = useCallback(
    () => handleTabChange("mining"),
    [handleTabChange],
  );
  const goToWallet = useCallback(
    () => handleTabChange("wallet"),
    [handleTabChange],
  );

  return (
    <div className="min-h-screen flex flex-col bg-pixel-bg-dark">
      {/* Persistent Header */}
      <AppHeader onMiningClick={goToMining} onWalletClick={goToWallet} />

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Content Area */}
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<SectionLoader />}>
          {activeTab === "token" && <TokenSection />}
          {activeTab === "mining" && <MiningSection />}
          {activeTab === "nfts" && <NFTsSection />}
          {activeTab === "wallet" && <WalletSection />}
          {activeTab === "more" && <MoreSection />}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="px-4 py-3 border-t-2 border-pixel-border bg-pixel-bg-medium">
        <div className="flex items-center justify-between">
          <p className="font-pixel text-[6px] text-pixel-text-muted uppercase">
            BitcoinBaby v0.1.0 - Testnet4
          </p>
          <button
            onClick={() => setShowResetModal(true)}
            className="font-pixel text-[6px] text-pixel-error hover:text-pixel-error/80 uppercase"
          >
            Reset All
          </button>
        </div>
      </footer>

      {/* Reset Confirmation Modal */}
      <ResetConfirmationModal
        isOpen={showResetModal}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}

// Main export with Suspense boundary for searchParams
export function AppShell() {
  return (
    <Suspense fallback={<SectionLoader />}>
      <AppShellInner />
    </Suspense>
  );
}

export default AppShell;
