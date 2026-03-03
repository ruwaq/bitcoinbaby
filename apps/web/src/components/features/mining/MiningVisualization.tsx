"use client";

/**
 * MiningVisualization - Main mining UI panel
 *
 * Shows:
 * - Animated mining icon
 * - Hashrate display with NFT boost
 * - Miner type indicator
 * - Start/Stop/Pause controls
 */

import { MiningControlButton, HelpTooltip } from "@bitcoinbaby/ui";
import { formatHashrate } from "@bitcoinbaby/core";
import { pixelCard } from "@bitcoinbaby/ui";

interface MiningVisualizationProps {
  // State
  isRunning: boolean;
  isPaused: boolean;
  disabled: boolean;

  // Hashrate
  hashrate: number;
  effectiveHashrate: number;
  nftBoost: number;

  // Miner info
  minerType: "cpu" | "webgpu";
  webgpuAvailable?: boolean;

  // Controls
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function MiningVisualization({
  isRunning,
  isPaused,
  disabled,
  hashrate,
  effectiveHashrate,
  nftBoost,
  minerType,
  webgpuAvailable,
  onStart,
  onStop,
  onPause,
  onResume,
}: MiningVisualizationProps) {
  return (
    <div className={`${pixelCard.primary} p-4 sm:p-6 mb-6`}>
      <div className="flex flex-col items-center">
        {/* Mining Icon */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-4">
          <div
            className={`w-full h-full flex items-center justify-center text-4xl sm:text-5xl ${
              isRunning && !isPaused ? "animate-bounce" : ""
            }`}
          >
            ⛏️
          </div>
          {isRunning && !isPaused && (
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-pixel-success opacity-50" />
          )}
        </div>

        {/* Hashrate Display */}
        <div className="text-center mb-6 w-full">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-pixel text-pixel-xl text-pixel-primary">
              {formatHashrate(effectiveHashrate)}
            </span>
            <HelpTooltip
              content="Hashes per second your device is calculating. Higher hashrate = more chances to find valid shares and earn $BABY."
              title="Hashrate"
              description="With NFT boost applied. Base hashrate depends on your device capabilities."
              size="md"
            />
          </div>
          {nftBoost > 0 && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
                Base: {formatHashrate(hashrate)}
              </span>
              <span className="font-pixel text-pixel-2xs text-pixel-success">
                +{nftBoost}% NFT Boost
              </span>
            </div>
          )}
          <div className="font-pixel text-pixel-2xs text-pixel-text-muted mt-2 uppercase">
            {minerType === "webgpu" ? "WebGPU Mining" : "CPU Mining"}
            {webgpuAvailable && minerType === "cpu" && (
              <span className="text-pixel-secondary ml-2">
                (WebGPU Available)
              </span>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <MiningControlButton
          isRunning={isRunning}
          isPaused={isPaused}
          onStart={onStart}
          onStop={onStop}
          onPause={onPause}
          onResume={onResume}
          disabled={disabled}
          variant="multi-button"
          size="md"
          className="w-full max-w-md"
        />
      </div>
    </div>
  );
}

export default MiningVisualization;
