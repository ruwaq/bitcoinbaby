"use client";

/**
 * TabNavigation - Horizontal tab navigation for the app
 *
 * Pixel art styled tabs for navigating between sections
 * without page reloads.
 */

import { clsx } from "clsx";

export type TabType = "token" | "mining" | "nfts" | "wallet" | "more";

interface Tab {
  id: TabType;
  label: string;
  icon: string;
  activeIcon: string;
}

const TABS: Tab[] = [
  { id: "token", label: "$BABTC", icon: "🪙", activeIcon: "💰" },
  { id: "mining", label: "Mining", icon: "⛏️", activeIcon: "⛏️" },
  { id: "nfts", label: "NFTs", icon: "🎨", activeIcon: "🖼️" },
  { id: "wallet", label: "Wallet", icon: "👛", activeIcon: "💵" },
  { id: "more", label: "More", icon: "⚙️", activeIcon: "⚙️" },
];

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  className?: string;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  className,
}: TabNavigationProps) {
  return (
    <nav
      className={clsx(
        "flex border-b-4 border-pixel-border bg-pixel-bg-medium safe-x",
        className,
      )}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "flex-1 flex flex-col items-center gap-1",
              "py-3 px-2 min-h-[52px] sm:min-h-[56px]",
              "font-pixel text-pixel-2xs uppercase transition-all",
              "border-r-2 border-pixel-border last:border-r-0",
              "active:scale-95",
              isActive
                ? "bg-pixel-bg-dark text-pixel-primary border-b-4 border-b-pixel-primary -mb-1"
                : "text-pixel-text-muted hover:text-pixel-text hover:bg-pixel-bg-dark/50",
            )}
          >
            <span className="text-lg sm:text-xl">
              {isActive ? tab.activeIcon : tab.icon}
            </span>
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default TabNavigation;
