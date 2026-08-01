"use client";

/**
 * LandingPage — Welcome screen for new visitors
 *
 * Shown when no wallet is connected. Features:
 * - Hero section with pixel art branding
 * - Feature highlights
 * - CTA to create wallet / enter app
 *
 * Once a wallet exists, the full AppShell SPA is shown instead.
 */

import { useState } from "react";
import { useWalletStore } from "@bitcoinbaby/core";
import { AppShell } from "@/components/app/AppShell";

const LANDING_DISMISSED_KEY = "bitcoinsparks-landing-dismissed";

export function LandingPage() {
  const wallet = useWalletStore((s) => s.wallet);

  // Track if user dismissed the landing page
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LANDING_DISMISSED_KEY) === "true";
    }
    return false;
  });

  const handleGetStarted = () => {
    localStorage.setItem(LANDING_DISMISSED_KEY, "true");
    setDismissed(true);
  };

  // Show SPA if wallet exists OR user dismissed landing
  if (wallet || dismissed) {
    return <AppShell />;
  }

  return (
    <div className="min-h-screen-safe bg-pixel-bg-dark text-pixel-text overflow-hidden">
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(#f7931a 1px, transparent 1px), linear-gradient(90deg, #f7931a 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen-safe flex flex-col items-center justify-center px-4 py-16 text-center">
          {/* Pixel Logo */}
          <div className="mb-8 animate-pixel-float">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-pixel-primary border-4 border-black flex items-center justify-center shadow-[8px_8px_0_0_#000] mx-auto">
              <span className="font-pixel text-3xl sm:text-4xl text-pixel-text-dark">
                ⚡
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-pixel text-pixel-xl sm:text-pixel-2xl text-pixel-primary mb-4">
            BITCOIN
            <span className="text-pixel-secondary">SPARKS</span>
          </h1>

          {/* Tagline */}
          <p className="font-pixel-body text-body-sm sm:text-body-md text-pixel-text-muted max-w-md mb-8">
            Raise your AI-powered pixel spark while mining Bitcoin. Proof of
            Useful Work meets Tamagotchi.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 font-pixel text-pixel-xs bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            >
              GET STARTED
            </button>
            <a
              href="/help"
              className="px-8 py-4 font-pixel text-pixel-xs bg-pixel-bg-medium text-pixel-text border-4 border-pixel-border shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all"
            >
              LEARN MORE
            </a>
          </div>

          {/* Scroll indicator */}
          <div className="mt-16 animate-pixel-blink">
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              ▼ SCROLL ▼
            </span>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-16 max-w-4xl mx-auto">
          <h2 className="font-pixel text-pixel-md text-pixel-primary text-center mb-12">
            HOW IT WORKS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 text-center shadow-[4px_4px_0_0_#000]">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="font-pixel text-sm text-pixel-primary mb-2">
                1. CREATE SPARK
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Mint your Genesis Spark NFT on Bitcoin. Each spark is unique
                with its own DNA, bloodline, and rarity.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 text-center shadow-[4px_4px_0_0_#000]">
              <div className="text-4xl mb-4">⛏️</div>
              <h3 className="font-pixel text-sm text-pixel-secondary mb-2">
                2. MINE BITCOIN
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Your spark mines Bitcoin via Proof of Useful Work. AI
                computation earns real hashrate. Higher level = more rewards.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 text-center shadow-[4px_4px_0_0_#000]">
              <div className="text-4xl mb-4">🧬</div>
              <h3 className="font-pixel text-sm text-pixel-success mb-2">
                3. EVOLVE & EARN
              </h3>
              <p className="font-pixel-body text-xs text-pixel-text-muted">
                Feed, play, and train your spark. Level up through 21 stages —
                from egg to legend. Earn $SPARK tokens as you grow.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-4 py-16 bg-pixel-bg-medium/50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-pixel text-pixel-md text-pixel-primary mb-8">
              THE NETWORK
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4">
                <p className="font-pixel text-pixel-lg text-pixel-primary">
                  1,337
                </p>
                <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                  SPARKS BORN
                </p>
              </div>
              <div className="p-4">
                <p className="font-pixel text-pixel-lg text-pixel-secondary">
                  42.1M
                </p>
                <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                  SHARES MINED
                </p>
              </div>
              <div className="p-4">
                <p className="font-pixel text-pixel-lg text-pixel-success">
                  21
                </p>
                <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                  MAX LEVEL
                </p>
              </div>
              <div className="p-4">
                <p className="font-pixel text-pixel-lg text-pixel-warning">
                  100%
                </p>
                <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                  ON BITCOIN
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="px-4 py-16 text-center">
          <h2 className="font-pixel text-pixel-md text-pixel-primary mb-4">
            READY TO START?
          </h2>
          <p className="font-pixel-body text-body-sm text-pixel-text-muted max-w-md mx-auto mb-8">
            Create your wallet, mint your spark, and join the Bitcoin mining
            revolution — one pixel at a time.
          </p>
          <button
            onClick={handleGetStarted}
            className="px-8 py-4 font-pixel text-pixel-xs bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            GET YOUR SPARK
          </button>
        </section>

        {/* Footer */}
        <footer className="px-4 py-8 border-t-2 border-pixel-border text-center">
          <p className="font-pixel text-[8px] text-pixel-text-muted">
            BitcoinSparks &copy; 2026 — Proof of Useful Work on Bitcoin
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <a
              href="/technology"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
            >
              TECH
            </a>
            <a
              href="/help"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
            >
              HELP
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
