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
      <div className="flex flex-col items-center w-full">
        {/* Custom CSS for El Gimnasio Mental animations */}
        <style>{`
          @keyframes floatUp {
            0% {
              transform: translateY(20px) scale(0.5);
              opacity: 0;
            }
            30% {
              opacity: 0.9;
            }
            100% {
              transform: translateY(-40px) scale(1.2);
              opacity: 0;
            }
          }
          @keyframes wiggle {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
          }
          @keyframes pulseSlow {
            0%, 100% { transform: scale(0.95); opacity: 0.15; }
            50% { transform: scale(1.05); opacity: 0.35; }
          }
          .animate-float-slow {
            animation: floatUp 3s ease-in-out infinite;
          }
          .animate-float-medium {
            animation: floatUp 2.2s ease-in-out infinite;
          }
          .animate-float-fast {
            animation: floatUp 1.5s ease-in-out infinite;
          }
          .animate-wiggle {
            animation: wiggle 1s ease-in-out infinite;
          }
          .animate-pulse-slow {
            animation: pulseSlow 3.5s ease-in-out infinite;
          }
        `}</style>

        {/* El Gimnasio Mental visualizer container */}
        <div className="relative w-full max-w-md h-40 bg-amber-950/20 border-4 border-amber-900/60 rounded-lg p-4 mb-6 overflow-hidden flex items-center justify-between select-none">
          {/* Left Book Shelf */}
          <div className="flex flex-col gap-2 text-xl opacity-80">
            <span>📚</span>
            <span>📂</span>
            <span>📚</span>
          </div>

          {/* Central Baby desk */}
          <div className="relative flex flex-col items-center justify-center flex-1 h-full">
            {/* Floating Knowledge/AI Learning Particles */}
            {isRunning && !isPaused && (
              <>
                <span className="absolute text-sm animate-float-slow left-4 top-2 opacity-0" style={{ animationDelay: '0s' }}>💡</span>
                <span className="absolute text-xs animate-float-medium right-6 top-3 opacity-0" style={{ animationDelay: '0.6s' }}>✨</span>
                <span className="absolute text-sm animate-float-fast left-8 top-5 opacity-0" style={{ animationDelay: '1.2s' }}>🧠</span>
                <span className="absolute text-xs animate-float-slow right-8 top-1 opacity-0" style={{ animationDelay: '1.8s' }}>💬</span>
              </>
            )}

            {/* Baby and desk */}
            <div className="flex flex-col items-center relative z-10">
              {/* Baby state emoji */}
              <div className={`text-4xl mb-2 ${isRunning && !isPaused ? "animate-wiggle" : ""}`}>
                {isRunning ? (isPaused ? "🤔" : "👶") : "😴"}
              </div>

              {/* Book desk status */}
              <div className="flex items-center gap-2">
                <span className="text-xl">🪟</span>
                <span className="text-2xl animate-pulse">
                  {isRunning ? (isPaused ? "📘" : "📖") : "📕"}
                </span>
                <span className="text-xl">✍️</span>
              </div>
            </div>

            {/* Aura of Knowledge */}
            {isRunning && !isPaused && (
              <div className="absolute w-24 h-24 rounded-full bg-pixel-success/10 border-2 border-pixel-success/20 animate-pulse-slow pointer-events-none" />
            )}
          </div>

          {/* Right Book Shelf */}
          <div className="flex flex-col gap-2 text-xl opacity-80">
            <span>📖</span>
            <span>📚</span>
            <span>📂</span>
          </div>

          {/* Library atmosphere shadow overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-amber-900/5 to-transparent pointer-events-none" />
        </div>

        {/* Speed / Tokens/s Display */}
        <div className="text-center mb-6 w-full">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-pixel text-pixel-xl text-pixel-primary">
              {formatHashrate(effectiveHashrate)}
            </span>
            <HelpTooltip
              content="Tokens per second processed by Gemma 4 E2B model. Higher speed = faster AI learning and more $BABY rewards."
              title="Speed"
              description="With NFT boost applied. Speed depends on device capability (WebGPU/CPU)."
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
            {minerType === "webgpu" ? "WebGPU Gemma 4 E2B" : "CPU Gemma 4 E2B"}
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
