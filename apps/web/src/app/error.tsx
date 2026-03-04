"use client";

import { useEffect } from "react";
import Link from "next/link";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark flex items-center justify-center">
      <div className="max-w-md w-full">
        {/* Error Card */}
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.medium} p-8 ${pixelShadows.lg} text-center`}
        >
          {/* Error Icon - Pixel Art Style */}
          <div className="mb-6">
            <svg
              width="96"
              height="96"
              viewBox="0 0 16 16"
              className="mx-auto"
              style={{ imageRendering: "pixelated" }}
            >
              {/* Sad face circle */}
              <rect x="4" y="2" width="8" height="2" fill="#ef4444" />
              <rect x="2" y="4" width="2" height="8" fill="#ef4444" />
              <rect x="12" y="4" width="2" height="8" fill="#ef4444" />
              <rect x="4" y="12" width="8" height="2" fill="#ef4444" />
              <rect x="4" y="4" width="8" height="8" fill="#dc2626" />
              {/* X eyes */}
              <rect x="4" y="5" width="1" height="1" fill="#1f2937" />
              <rect x="6" y="5" width="1" height="1" fill="#1f2937" />
              <rect x="5" y="6" width="1" height="1" fill="#1f2937" />
              <rect x="9" y="5" width="1" height="1" fill="#1f2937" />
              <rect x="11" y="5" width="1" height="1" fill="#1f2937" />
              <rect x="10" y="6" width="1" height="1" fill="#1f2937" />
              {/* Sad mouth */}
              <rect x="6" y="10" width="4" height="1" fill="#1f2937" />
              <rect x="5" y="9" width="1" height="1" fill="#1f2937" />
              <rect x="10" y="9" width="1" height="1" fill="#1f2937" />
            </svg>
          </div>

          {/* Error Badge */}
          <span className="inline-block px-3 py-1 font-pixel text-[10px] bg-pixel-error text-white border-2 border-black mb-4">
            ERROR
          </span>

          {/* Title */}
          <h1 className="font-pixel text-lg text-pixel-text mb-4">
            SOMETHING WENT WRONG
          </h1>

          {/* Error Message */}
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-4 mb-6">
            <p className="font-pixel-mono text-sm text-pixel-text-muted break-words">
              {error.message || "An unexpected error occurred"}
            </p>
            {error.digest && (
              <p className="font-pixel-mono text-[10px] text-pixel-text-muted mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className={`px-6 py-3 font-pixel text-[10px] bg-pixel-primary text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none`}
            >
              TRY AGAIN
            </button>
            <Link
              href="/"
              className={`px-6 py-3 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none text-center`}
            >
              GO HOME
            </Link>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    </main>
  );
}
