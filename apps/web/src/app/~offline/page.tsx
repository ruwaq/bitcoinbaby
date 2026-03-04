"use client";

import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-pixel-bg-dark p-4">
      <div
        className={`max-w-md text-center bg-pixel-bg-medium ${pixelBorders.medium} p-8 ${pixelShadows.lg}`}
      >
        {/* Pixel art style offline indicator */}
        <div className="mb-8 text-6xl">
          <span className="font-pixel text-pixel-secondary">{"[  ]"}</span>
        </div>

        <h1 className="font-pixel mb-4 text-lg text-pixel-primary">
          You are Offline
        </h1>

        <p className="font-pixel-body text-sm mb-6 text-pixel-text-muted">
          It looks like you have lost your internet connection. Mining requires
          an active connection to the Bitcoin network.
        </p>

        <div className="space-y-4">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            While offline, you can:
          </p>
          <ul className="font-pixel-body space-y-2 text-left text-sm text-pixel-text-muted">
            <li className="flex items-center gap-2">
              <span className="text-pixel-secondary">{">"}</span>
              View your cached baby stats
            </li>
            <li className="flex items-center gap-2">
              <span className="text-pixel-secondary">{">"}</span>
              Check your mining history
            </li>
            <li className="flex items-center gap-2">
              <span className="text-pixel-secondary">{">"}</span>
              Review your wallet (read-only)
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-8 border-4 border-pixel-primary bg-pixel-primary/10 px-6 py-3 font-pixel text-xs text-pixel-primary transition-colors hover:bg-pixel-primary hover:text-pixel-bg-dark"
          aria-label="Reload page to try reconnecting"
        >
          TRY AGAIN
        </button>
      </div>
    </main>
  );
}
