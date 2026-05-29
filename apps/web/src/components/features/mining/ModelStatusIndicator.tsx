"use client";

/**
 * ModelStatusIndicator - AI model chain visualization
 *
 * Shows each model in the chain with its status:
 *   pending (grey) → loading (yellow, animated) → loaded (green) / failed (red)
 *
 * Also provides a compact model selection popover with download buttons.
 * BabyBrain is the immediate default — other models require explicit download.
 */

import { useState, useRef, useEffect } from "react";
import type { ModelChainEntryStatus } from "@bitcoinbaby/ai";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-pixel-bg-light",
  loading: "bg-pixel-warning animate-pulse",
  loaded: "bg-pixel-success",
  failed: "bg-pixel-error",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting",
  loading: "Loading...",
  loaded: "Active",
  failed: "Failed",
};

const MODEL_DISPLAY: Record<string, string> = {
  smollm2: "SmolLM2 135M",
  distilgpt2: "distilgpt2",
  "baby-brain": "BabyBrain",
};

const MODEL_SIZE_HINTS: Record<string, string> = {
  smollm2: "~80 MB",
  distilgpt2: "~50 MB",
  "baby-brain": "0 MB",
};

interface ModelStatusIndicatorProps {
  modelChainStatus?: ModelChainEntryStatus[];
  engineType?: string;
  isDownloading?: boolean;
  onDownloadModel?: (modelName: string) => void;
}

export function ModelStatusIndicator({
  modelChainStatus,
  engineType,
  isDownloading,
  onDownloadModel,
}: ModelStatusIndicatorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Models available for download (not BabyBrain — it's instant)
  const downloadableModels = [
    { id: "smollm2", name: "SmolLM2 135M", hint: "~80 MB" },
    { id: "distilgpt2", name: "distilgpt2", hint: "~50 MB" },
  ];

  // Close popover on outside click and Escape key
  useEffect(() => {
    if (!popoverOpen) return;
    const clickHandler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [popoverOpen]);

  if (!modelChainStatus || modelChainStatus.length === 0) return null;

  // If no engine is loaded yet and nothing is loading, render a compact "pending" state
  const hasActivity = modelChainStatus.some((m) => m.status !== "pending");
  if (!hasActivity && !engineType) return null;

  // Determine the download state for each model
  const getModelDownloadState = (
    modelName: string,
  ): "not_downloaded" | "downloading" | "active" | "failed" => {
    if (engineType === modelName) return "active";
    const entry = modelChainStatus.find((m) => m.name === modelName);
    if (entry?.status === "loading") return "downloading";
    if (entry?.status === "failed") return "failed";
    return "not_downloaded";
  };

  return (
    <div className="relative w-full max-w-md mx-auto mb-2">
      {/* Chain flow */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {modelChainStatus.map((model, i) => {
          const isActive = model.name === engineType;
          const status = model.status;
          const displayName = MODEL_DISPLAY[model.name] ?? model.name;

          return (
            <div key={model.id} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-pixel-text-muted text-pixel-3xs mx-0.5">
                  →
                </span>
              )}
              <div
                title={`${displayName}: ${STATUS_LABELS[status]}${model.error ? ` — ${model.error.replace(/https?:\/\/\S+/g, "[URL]").slice(0, 80)}` : ""}`}
                className={`flex items-center gap-1.5 px-2 py-1 border-2 ${
                  isActive
                    ? "border-pixel-primary bg-pixel-primary/10"
                    : "border-pixel-border bg-transparent"
                }`}
              >
                <span
                  className={`inline-block w-2 h-2 ${STATUS_COLORS[status]}`}
                />
                <span className="font-pixel text-pixel-3xs text-pixel-text uppercase">
                  {displayName}
                </span>
              </div>
            </div>
          );
        })}

        {/* BabyBrain fallback — always implied, highlight if active */}
        <span className="text-pixel-text-muted text-pixel-3xs mx-0.5">→</span>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 border-2 ${
            engineType === "baby-brain"
              ? "border-pixel-success bg-pixel-success/10"
              : "border-pixel-border bg-transparent"
          }`}
        >
          <span
            className={`inline-block w-2 h-2 ${
              engineType === "baby-brain"
                ? "bg-pixel-success"
                : "bg-pixel-text-muted"
            }`}
          />
          <span
            className={`font-pixel text-pixel-3xs uppercase ${
              engineType === "baby-brain"
                ? "text-pixel-success"
                : "text-pixel-text-muted"
            }`}
          >
            BabyBrain
          </span>
        </div>

        {/* Settings gear — opens model download popover */}
        {onDownloadModel && (
          <button
            onClick={() => setPopoverOpen(!popoverOpen)}
            aria-expanded={popoverOpen}
            aria-controls="model-download-popover"
            className="ml-1 p-1 border-2 border-pixel-border hover:border-pixel-secondary bg-transparent text-pixel-text-muted hover:text-pixel-secondary active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pixel-primary"
            title="Download AI models"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        )}
      </div>

      {/* Popover for model downloads */}
      {popoverOpen && onDownloadModel && (
        <div
          ref={popoverRef}
          id="model-download-popover"
          role="dialog"
          aria-label="Download AI models"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 border-4 border-pixel-border bg-pixel-bg-dark p-3 min-w-[220px]"
          style={{ boxShadow: "4px 4px 0 0 #000" }}
        >
          <div className="font-pixel text-pixel-2xs text-pixel-primary uppercase mb-2 text-center">
            Download Models
          </div>
          <div className="text-pixel-3xs text-pixel-text-muted mb-3 text-center">
            BabyBrain runs instantly. Download a model for better AI quality.
          </div>
          <div className="flex flex-col gap-2">
            {downloadableModels.map((model) => {
              const state = getModelDownloadState(model.id);

              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between gap-2 px-2 py-2 border-2 border-pixel-border"
                >
                  <div className="flex flex-col">
                    <span className="font-pixel text-pixel-3xs text-pixel-text">
                      {model.name}
                    </span>
                    <span className="font-pixel-body text-pixel-3xs text-pixel-text-muted">
                      {model.hint}
                    </span>
                  </div>
                  {state === "active" ? (
                    <span className="font-pixel text-pixel-3xs text-pixel-success uppercase">
                      Active
                    </span>
                  ) : state === "downloading" ? (
                    <span className="font-pixel text-pixel-3xs text-pixel-warning animate-pulse uppercase">
                      Downloading...
                    </span>
                  ) : state === "failed" ? (
                    <button
                      onClick={() => onDownloadModel(model.id)}
                      className="px-2 py-1 border-2 border-pixel-error-dark bg-pixel-error/20 hover:bg-pixel-error/30 text-pixel-error font-pixel text-pixel-3xs uppercase active:translate-y-0.5"
                    >
                      Retry
                    </button>
                  ) : (
                    <button
                      onClick={() => onDownloadModel(model.id)}
                      disabled={isDownloading}
                      className="px-2 py-1 border-2 border-pixel-secondary-dark bg-pixel-secondary/20 hover:bg-pixel-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed text-pixel-secondary font-pixel text-pixel-3xs uppercase active:translate-y-0.5"
                    >
                      Download
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-pixel-3xs text-pixel-text-muted text-center">
            BabyBrain keeps mining while downloading.
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelStatusIndicator;
