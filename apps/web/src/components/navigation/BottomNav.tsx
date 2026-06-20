"use client";

/**
 * BottomNav Component
 *
 * Mobile/Native bottom navigation bar — 3 tabs.
 * Fase 4 Redesign: HOME | EXPLORE | YOU
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCapacitor, usePlatform } from "@/hooks";

const navItems = [
  {
    href: "/?tab=home",
    label: "HOME",
    icon: "⚡",
  },
  {
    href: "/?tab=explore",
    label: "EXPLORE",
    icon: "🔍",
  },
  {
    href: "/?tab=you",
    label: "YOU",
    icon: "👤",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { haptic, isNative } = useCapacitor();
  const { isReady } = usePlatform();

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
          const itemTab = new URLSearchParams(
            item.href.split("?")[1] || "",
          ).get("tab");
          const currentTab = new URLSearchParams(
            pathname.split("?")[1] || "",
          ).get("tab");
          const isActive = itemTab
            ? currentTab === itemTab ||
              (!currentTab && itemTab === "home" && pathname === "/")
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
                {item.icon}
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