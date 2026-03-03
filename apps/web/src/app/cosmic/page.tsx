"use client";

/**
 * Cosmic Page - Web App
 *
 * Displays current cosmic conditions, how they affect your Baby,
 * and upcoming astronomical events.
 */

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  useCosmicState,
  useCosmicEvents,
  useMiningCosmic,
  useNFTStore,
} from "@bitcoinbaby/core";
import {
  CosmicStatusBar,
  BabyEnergyIndicator,
  CosmicIndicator,
} from "@bitcoinbaby/ui";

// Default baby data for users without NFTs
const DEFAULT_BABY = {
  baseType: "human" as const,
  bloodline: "royal" as const,
  heritage: "americas" as const,
  level: 1,
  rarity: "common" as const,
  energy: 100,
  equippedItemsBonus: 0,
};

/**
 * Format time remaining
 */
function formatTimeRemaining(ms: number): string {
  if (ms < 0) return "Now";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ${hours % 24}h`;
  }

  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} min`;
}

export default function CosmicPage() {
  // Track current time for event countdown (updates every second)
  const [now, setNow] = useState(() => Date.now());
  const { ownedNFTs } = useNFTStore();
  // Baby selector state - defaults to first NFT
  const [selectedBabyIndex, setSelectedBabyIndex] = useState(0);

  // Reset index if it's out of bounds (e.g., NFT was transferred)
  useEffect(() => {
    if (selectedBabyIndex >= ownedNFTs.length && ownedNFTs.length > 0) {
      setSelectedBabyIndex(0);
    }
  }, [ownedNFTs.length, selectedBabyIndex]);

  // Get cosmic state
  const {
    cosmicState,
    isLoading: cosmicLoading,
    error: cosmicError,
    refresh,
  } = useCosmicState({
    updateInterval: 60000, // Update every minute
  });

  // Get cosmic events
  const { currentEvent, upcomingEvents, hasActiveEvent, timeUntilNextEvent } =
    useCosmicEvents();

  // Update current time for countdown display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Get selected baby from NFTs or use default (new user)
  const selectedBaby = useMemo(() => {
    if (ownedNFTs.length > 0 && ownedNFTs[selectedBabyIndex]) {
      const nft = ownedNFTs[selectedBabyIndex];
      return {
        baseType: (nft.baseType || "human") as typeof DEFAULT_BABY.baseType,
        bloodline: (nft.bloodline || "royal") as typeof DEFAULT_BABY.bloodline,
        heritage: "americas" as typeof DEFAULT_BABY.heritage,
        level: nft.level || 1,
        rarity: (nft.rarityTier || "common") as typeof DEFAULT_BABY.rarity,
        energy: 100,
        equippedItemsBonus: 0,
      };
    }
    return DEFAULT_BABY;
  }, [ownedNFTs]);

  // Get mining cosmic integration
  const {
    cosmicEnergy,
    effectiveMultiplier,
    cosmicStatus,
    activeEffects,
    warnings,
    multiplierBreakdown,
    isLoading: miningLoading,
  } = useMiningCosmic(selectedBaby, {
    serverAverageLevel: 25,
  });

  const isLoading = cosmicLoading || miningLoading;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-pixel text-xl text-pixel-primary">
                COSMIC STATUS
              </h1>
              <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
                How the universe affects your Baby
              </p>
              {/* Baby Selector - only shows when user has multiple NFTs */}
              {ownedNFTs.length > 1 && (
                <div className="mt-3">
                  <label className="font-pixel text-[8px] text-pixel-text-muted uppercase block mb-1">
                    Select Baby
                  </label>
                  <select
                    value={selectedBabyIndex}
                    onChange={(e) =>
                      setSelectedBabyIndex(Number(e.target.value))
                    }
                    className="bg-pixel-bg-dark border-2 border-pixel-border text-pixel-text font-pixel text-[10px] px-3 py-2 pr-8 appearance-none cursor-pointer hover:border-pixel-primary transition-colors focus:outline-none focus:border-pixel-primary"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f7931a' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                    }}
                  >
                    {ownedNFTs.map((nft, index) => (
                      <option key={nft.tokenId || index} value={index}>
                        Baby #{index + 1} - {nft.baseType || "Unknown"} (
                        {nft.rarityTier || "common"})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {cosmicState && (
                <CosmicIndicator
                  moonEmoji={cosmicState.moon.emoji}
                  seasonEmoji={cosmicState.season.emoji}
                  hasActiveEvent={hasActiveEvent}
                  eventEmoji={currentEvent?.emoji}
                />
              )}
              <Link
                href="/mine"
                className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
              >
                MINE
              </Link>
            </div>
          </div>
        </header>

        {/* Main Cosmic Display */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Cosmic Status */}
          <CosmicStatusBar
            moon={cosmicState?.moon ?? null}
            season={cosmicState?.season ?? null}
            currentEvent={currentEvent}
            upcomingEvents={upcomingEvents}
            timeUntilNextEvent={timeUntilNextEvent}
            isLoading={isLoading}
            error={cosmicError?.message}
            onRefresh={refresh}
            variant="full"
          />

          {/* Baby Energy */}
          <BabyEnergyIndicator
            energy={cosmicEnergy}
            babyName={
              ownedNFTs.length > 0
                ? `Baby #${selectedBabyIndex + 1}`
                : "Demo Baby"
            }
            showDetails={true}
            showWarnings={true}
            variant="full"
          />
        </div>

        {/* Mining Impact Panel */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 mb-6 shadow-[8px_8px_0_0_#000]">
          <h2 className="font-pixel text-[10px] text-pixel-secondary uppercase mb-4">
            Mining Impact
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* NFT Boost */}
            <div className="bg-pixel-bg-dark border-2 border-black p-4 text-center">
              <div className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-2">
                NFT Boost
              </div>
              <div className="font-pixel text-xl text-pixel-primary">
                x{multiplierBreakdown.nft.toFixed(2)}
              </div>
            </div>

            {/* Cosmic Boost */}
            <div className="bg-pixel-bg-dark border-2 border-black p-4 text-center">
              <div className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-2">
                Cosmic Boost
              </div>
              <div
                className={`font-pixel text-xl ${
                  effectiveMultiplier >= 1.0
                    ? "text-pixel-success"
                    : "text-pixel-error"
                }`}
              >
                x{effectiveMultiplier.toFixed(2)}
              </div>
            </div>

            {/* Total Multiplier */}
            <div className="bg-pixel-primary/20 border-2 border-pixel-primary p-4 text-center">
              <div className="font-pixel text-[8px] text-pixel-primary uppercase mb-2">
                Total Multiplier
              </div>
              <div className="font-pixel text-2xl text-pixel-primary">
                x{multiplierBreakdown.combined.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div
            className={`p-4 border-2 ${
              cosmicStatus === "thriving"
                ? "border-pixel-success bg-pixel-success/10"
                : cosmicStatus === "critical"
                  ? "border-pixel-error bg-pixel-error/10"
                  : cosmicStatus === "struggling"
                    ? "border-pixel-warning bg-pixel-warning/10"
                    : "border-pixel-secondary bg-pixel-secondary/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {cosmicStatus === "thriving" && "🤩"}
                {cosmicStatus === "normal" && "🙂"}
                {cosmicStatus === "struggling" && "😔"}
                {cosmicStatus === "critical" && "🤕"}
              </span>
              <div>
                <div
                  className={`font-pixel text-xs uppercase ${
                    cosmicStatus === "thriving"
                      ? "text-pixel-success"
                      : cosmicStatus === "critical"
                        ? "text-pixel-error"
                        : cosmicStatus === "struggling"
                          ? "text-pixel-warning"
                          : "text-pixel-secondary"
                  }`}
                >
                  {cosmicStatus}
                </div>
                <div className="font-pixel text-[8px] text-pixel-text-muted">
                  {cosmicStatus === "thriving" &&
                    "Excellent time to mine! Your Baby is at peak performance."}
                  {cosmicStatus === "normal" && "Good conditions for mining."}
                  {cosmicStatus === "struggling" &&
                    "Mining efficiency is reduced. Consider waiting for better conditions."}
                  {cosmicStatus === "critical" &&
                    "Very unfavorable conditions. Your Baby is at a significant disadvantage."}
                </div>
              </div>
            </div>
          </div>

          {/* Active Effects */}
          {activeEffects.length > 0 && (
            <div className="mt-4">
              <div className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-2">
                Active Effects
              </div>
              <div className="flex flex-wrap gap-2">
                {activeEffects.map((effect, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-pixel-bg-dark border border-black font-pixel text-[8px] text-pixel-text"
                  >
                    {effect}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className="p-2 bg-pixel-error/20 border border-pixel-error font-pixel text-[8px] text-pixel-error"
                >
                  {warning}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 mb-6">
            <h2 className="font-pixel text-[10px] text-pixel-secondary uppercase mb-4">
              Upcoming Cosmic Events
            </h2>

            <div className="space-y-3">
              {upcomingEvents.slice(0, 5).map((event) => {
                const timeUntil = event.startTime.getTime() - now;

                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 bg-pixel-bg-dark border-2 border-black"
                  >
                    <span className="text-2xl">{event.emoji}</span>
                    <div className="flex-1">
                      <div className="font-pixel text-[10px] text-pixel-text">
                        {event.name}
                      </div>
                      <div className="font-pixel text-[8px] text-pixel-text-muted">
                        {event.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-pixel text-[8px] text-pixel-text-muted uppercase">
                        Starts in
                      </div>
                      <div className="font-pixel text-xs text-pixel-secondary">
                        {formatTimeRemaining(timeUntil)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How Cosmic Energy Works */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6">
          <h2 className="font-pixel text-[10px] text-pixel-secondary uppercase mb-4">
            How Cosmic Energy Works
          </h2>

          <div className="space-y-4 font-pixel-body text-sm text-pixel-text-muted">
            <p>
              Your Baby{"'"}s energy is influenced by real astronomical events.
              Different Baby types respond differently to cosmic conditions:
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { type: "Human", best: "Day", worst: "Eclipse" },
                { type: "Animal", best: "Full Moon", worst: "New Moon" },
                { type: "Robot", best: "New Moon", worst: "Full Moon" },
                { type: "Mystic", best: "Eclipse", worst: "Day" },
                { type: "Alien", best: "Solstice", worst: "Equinox" },
              ].map((info) => (
                <div
                  key={info.type}
                  className="p-2 bg-pixel-bg-dark border border-black"
                >
                  <div className="font-pixel text-[8px] text-pixel-primary mb-1">
                    {info.type}
                  </div>
                  <div className="font-pixel text-[6px] text-pixel-success">
                    Best: {info.best}
                  </div>
                  <div className="font-pixel text-[6px] text-pixel-error">
                    Worst: {info.worst}
                  </div>
                </div>
              ))}
            </div>

            <p>
              Mining during favorable conditions gives up to{" "}
              <span className="text-pixel-success">+100%</span> bonus, while
              unfavorable conditions can reduce efficiency by up to{" "}
              <span className="text-pixel-error">-50%</span>.
            </p>

            <p>
              The balance system ensures fair gameplay with caps and diminishing
              returns. New players also receive a catch-up bonus!
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
            Cosmic data powered by Astronomy Engine
          </p>
          <p className="font-pixel text-[6px] text-pixel-text-muted mt-1">
            Real astronomical calculations - no API required
          </p>
        </footer>
      </div>
    </main>
  );
}
