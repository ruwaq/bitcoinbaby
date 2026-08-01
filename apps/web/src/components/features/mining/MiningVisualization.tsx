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
  aiStatus?: {
    modelState: "idle" | "loading" | "ready" | "error";
    downloadProgress: number;
    modelLoaded?: string;
    downloadDetails?: {
      file?: string;
      loaded?: number;
      total?: number;
    };
  } | null;

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
  aiStatus,
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
          {/* Loading overlay */}
          {aiStatus && aiStatus.modelState === "loading" && (
            <div className="absolute inset-0 bg-amber-950/95 flex flex-col items-center justify-center p-4 z-20 font-pixel">
              <div className="text-pixel-secondary text-pixel-2xs uppercase mb-2 animate-pulse text-center">
                Initializing AI Engine...
              </div>

              {/* Retro pixel progress bar */}
              <div className="w-full max-w-[280px] border-4 border-amber-900/80 bg-black p-1 mb-2">
                <div
                  className="bg-pixel-primary h-4 transition-all duration-300 ease-out"
                  style={{ width: `${aiStatus.downloadProgress || 0}%` }}
                />
              </div>

              {/* Progress details */}
              <div className="flex flex-col items-center text-pixel-text-muted text-pixel-3xs gap-1">
                <span className="text-pixel-primary text-pixel-xs font-bold">
                  {Math.round(aiStatus.downloadProgress || 0)}%
                </span>
                {aiStatus.downloadDetails && (
                  <span className="text-center truncate max-w-[260px] text-amber-100/70">
                    {aiStatus.downloadDetails.file &&
                      `${aiStatus.downloadDetails.file.split("/").pop()}: `}
                    {aiStatus.downloadDetails.loaded
                      ? (
                          aiStatus.downloadDetails.loaded /
                          (1024 * 1024)
                        ).toFixed(1)
                      : 0}
                    MB
                    {aiStatus.downloadDetails.total
                      ? ` / ${(aiStatus.downloadDetails.total / (1024 * 1024)).toFixed(1)}MB`
                      : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error overlay */}
          {aiStatus && aiStatus.modelState === "error" && (
            <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-4 z-20 font-pixel text-center">
              <div className="text-red-500 text-pixel-xs uppercase mb-2 font-bold animate-pulse">
                AI LOAD ERROR!
              </div>
              <div className="text-pixel-text text-pixel-3xs mb-4 max-w-[280px] text-red-200/80">
                Failed to initialize AI engine. Check your connection and
                configured AI provider.
              </div>
              <button
                onClick={onStart}
                className="px-4 py-2 border-4 border-red-700 bg-red-900 hover:bg-red-800 text-white font-pixel text-pixel-2xs uppercase active:translate-y-0.5 active:border-b-2"
              >
                Retry Loading
              </button>
            </div>
          )}
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
                <span
                  className="absolute text-sm animate-float-slow left-4 top-2 opacity-0"
                  style={{ animationDelay: "0s" }}
                >
                  💡
                </span>
                <span
                  className="absolute text-xs animate-float-medium right-6 top-3 opacity-0"
                  style={{ animationDelay: "0.6s" }}
                >
                  ✨
                </span>
                <span
                  className="absolute text-sm animate-float-fast left-8 top-5 opacity-0"
                  style={{ animationDelay: "1.2s" }}
                >
                  🧠
                </span>
                <span
                  className="absolute text-xs animate-float-slow right-8 top-1 opacity-0"
                  style={{ animationDelay: "1.8s" }}
                >
                  💬
                </span>
              </>
            )}

            {/* Baby and desk */}
            <div className="flex flex-col items-center relative z-10">
              {/* Baby state emoji */}
              <div
                className={`text-4xl mb-2 ${isRunning && !isPaused ? "animate-wiggle" : ""}`}
              >
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
              content="AI processing speed. Higher speed = faster AI learning and more $SPARK rewards."
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
            {aiStatus?.modelLoaded || "AI Engine"}
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
