"use client";

/**
 * AppShell - Main application shell
 *
 * Fase 4 Redesign: 3-tab navigation (HOME | EXPLORE | YOU).
 * Persistent header with mining status + bottom nav.
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
  const keysToRemove = [
    "bitcoinsparks-spark-store",
    "bitcoinsparks-mining-store",
    "bitcoinsparks-spark-store",
    "bitcoinsparks-wallet-store",
    "bitcoinsparks-network",
    "bitcoinsparks-settings",
    "bitcoinsparks-leaderboard",
    "bitcoinsparks-tutorial",
    "bitcoinsparks-game",
    "bitcoinsparks_game_state",
  ];
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  if (typeof indexedDB !== "undefined") {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name?.includes("bitcoinsparks")) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {
      indexedDB.deleteDatabase("bitcoinsparks");
    }
  }

  window.location.reload();
}

import { getPhaseConfig, type TabType } from "@bitcoinbaby/shared";
import {
  usePendingTxStore,
  useNarrativeStore,
  useSparkStore,
} from "@bitcoinbaby/core";
import {
  OnboardingTour,
  useOnboarding,
} from "@/components/overlays/OnboardingTour";
import { AppHeader } from "./AppHeader";
import { TestnetBanner } from "./TestnetBanner";
import { BottomNav } from "@/components/navigation/BottomNav";

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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
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
              <span className="text-pixel-error">X</span> Spark evolution state
            </li>
            <li className="flex items-center gap-2">
              <span className="text-pixel-error">X</span> All local settings
            </li>
          </ul>
          <p className="font-pixel text-[8px] text-pixel-warning text-center mt-4">
            Make sure you have your recovery phrase saved!
          </p>
        </div>

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

const HomeSection = dynamic(
  () => import("../sections/HomeSection").then((m) => m.HomeSection),
  { ssr: false },
);
const ExploreSection = dynamic(
  () => import("../sections/ExploreSection").then((m) => m.ExploreSection),
  { ssr: false },
);
const YouSection = dynamic(
  () => import("../sections/YouSection").then((m) => m.YouSection),
  { ssr: false },
);

// Loading placeholder
function SectionLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-pixel-primary animate-pixel-float" />
          <div
            className="w-3 h-3 bg-pixel-secondary animate-pixel-float"
            style={{ animationDelay: "0.15s" }}
          />
          <div
            className="w-3 h-3 bg-pixel-primary animate-pixel-float"
            style={{ animationDelay: "0.3s" }}
          />
        </div>
        <span className="font-pixel text-[10px] text-pixel-text-muted">
          LOADING
        </span>
      </div>
    </div>
  );
}

// Inner component that uses searchParams
function AppShellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const phaseConfig = getPhaseConfig();

  const onboarding = useOnboarding();

  const pendingTxCount = usePendingTxStore(
    (s) => s.transactions.filter((tx) => tx.status === "pending").length,
  );
  const sparkExists = useSparkStore((s) => s.spark !== null);
  const narrativeEventCount = useNarrativeStore((s) => {
    if (!s.activeTokenId) return 0;
    const st = s.states[s.activeTokenId];
    return st ? st.events.length : 0;
  });

  const tabBadges: Partial<Record<TabType, number>> = {
    home: sparkExists ? 0 : 1,
    you: pendingTxCount > 0 ? pendingTxCount : 0,
    explore: narrativeEventCount > 0 ? Math.min(narrativeEventCount, 99) : 0,
  };

  // Get tab from URL or default from phase config
  const urlTab = searchParams.get("tab") as TabType | null;
  const defaultTab = phaseConfig.defaultTab;

  const isValidUrlTab = urlTab && phaseConfig.visibleTabs.includes(urlTab);
  const initialTab = isValidUrlTab ? urlTab : defaultTab;

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [showResetModal, setShowResetModal] = useState(false);

  const handleResetConfirm = useCallback(() => {
    setShowResetModal(false);
    resetAllData();
  }, []);

  // Sync URL with tab
  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const url = tab === defaultTab ? "/" : `/?tab=${tab}`;
      router.push(url, { scroll: false });
    },
    [router, defaultTab],
  );

  // Sync tab from URL changes (back/forward navigation)
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      startTransition(() => setActiveTab(urlTab));
    } else if (!urlTab && activeTab !== defaultTab) {
      startTransition(() => setActiveTab(defaultTab));
    }
  }, [urlTab, activeTab, defaultTab]);

  const goToHome = useCallback(
    () => handleTabChange("home"),
    [handleTabChange],
  );
  const goToYou = useCallback(
    () => handleTabChange("you"),
    [handleTabChange],
  );

  return (
    <div className="min-h-screen flex flex-col bg-pixel-bg-dark">
      {/* Testnet Banner */}
      <TestnetBanner />

      {/* Compact Header */}
      <AppHeader onMiningClick={goToHome} onWalletClick={goToYou} />

      {/* Content Area */}
      <main className="flex-1 overflow-auto pb-20">
        <Suspense fallback={<SectionLoader />}>
          {activeTab === "home" && <HomeSection />}
          {activeTab === "explore" && <ExploreSection />}
          {activeTab === "you" && <YouSection />}
        </Suspense>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Reset Confirmation Modal */}
      <ResetConfirmationModal
        isOpen={showResetModal}
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={onboarding.isOpen}
        step={onboarding.step}
        currentStep={onboarding.currentStep}
        totalSteps={onboarding.totalSteps}
        onNext={onboarding.next}
        onPrev={onboarding.prev}
        onSkip={onboarding.skip}
        onNavigate={(tab) => handleTabChange(tab as TabType)}
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