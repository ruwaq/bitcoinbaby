"use client";

/**
 * BottomNav Component
 *
 * Mobile/Native bottom navigation bar.
 * Only visible on mobile devices, PWA, or native apps.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCapacitor, usePlatform } from "@/hooks";

// BottomNav uses the same URL scheme as TabNavigation (/?tab=...)
// This ensures both navigation systems stay in sync
const navItems = [
  {
    href: "/?tab=dashboard",
    label: "Home",
    icon: "\u{1F3E0}",
    activeIcon: "\u{1F3E1}",
  },
  {
    href: "/?tab=nfts",
    label: "NFTs",
    icon: "\u{1F3A8}",
    activeIcon: "\u{1F5BC}\u{FE0F}",
  },
  {
    href: "/?tab=wallet",
    label: "Wallet",
    icon: "\u{1F4B0}",
    activeIcon: "\u{1F4B5}",
  },
  {
    href: "/?tab=more",
    label: "More",
    icon: "\u{2699}\u{FE0F}",
    activeIcon: "\u{2699}\u{FE0F}",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { haptic, isNative } = useCapacitor();
  const { isMobile, isPWA, isReady } = usePlatform();

  // Always show — consistent mobile-game-like navigation on all devices
  const shouldShow = isReady;

  const handlePress = async () => {
    if (isNative) {
      await haptic("light");
    }
  };

  if (!shouldShow) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-pixel-bg-medium border-t-4 border-pixel-border safe-bottom"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          // Match tab parameter in URL for active state detection
          const itemTab = new URLSearchParams(
            item.href.split("?")[1] || "",
          ).get("tab");
          const currentTab = new URLSearchParams(
            pathname.split("?")[1] || "",
          ).get("tab");
          const isActive = itemTab
            ? currentTab === itemTab ||
              (!currentTab && itemTab === "baby" && pathname === "/")
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handlePress}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center w-16 h-full touch-feedback ${
                isActive ? "text-pixel-primary" : "text-pixel-text-muted"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {isActive ? item.activeIcon : item.icon}
              </span>
              <span
                className={`font-pixel text-[8px] mt-1 ${
                  isActive ? "text-pixel-primary" : "text-pixel-text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
