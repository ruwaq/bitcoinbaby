"use client";

/**
 * Global Error Boundary
 *
 * Catches errors in the root layout itself.
 * Must include its own <html> and <body> tags since it replaces the root layout.
 *
 * Best Practice: This is the last line of defense against crashes.
 * Users should never see a blank screen.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0f0f1b] text-white min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Critical Error Icon */}
          <div className="mb-6">
            <svg
              width="80"
              height="80"
              viewBox="0 0 16 16"
              className="mx-auto"
              style={{ imageRendering: "pixelated" as const }}
            >
              {/* Warning triangle */}
              <rect x="7" y="2" width="2" height="2" fill="#ef4444" />
              <rect x="6" y="4" width="4" height="2" fill="#ef4444" />
              <rect x="5" y="6" width="6" height="2" fill="#ef4444" />
              <rect x="4" y="8" width="8" height="2" fill="#ef4444" />
              <rect x="3" y="10" width="10" height="2" fill="#ef4444" />
              <rect x="2" y="12" width="12" height="2" fill="#ef4444" />
              {/* Exclamation mark */}
              <rect x="7" y="5" width="2" height="4" fill="#1f2937" />
              <rect x="7" y="10" width="2" height="2" fill="#1f2937" />
            </svg>
          </div>

          {/* Error Badge */}
          <span
            className="inline-block px-3 py-1 text-xs bg-red-600 text-white mb-4"
            style={{ fontFamily: "monospace" }}
          >
            CRITICAL ERROR
          </span>

          {/* Title */}
          <h1
            className="text-xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            APP CRASHED
          </h1>

          {/* Message */}
          <div className="bg-[#1a1a2e] border-2 border-gray-700 p-4 mb-6">
            <p className="text-sm text-gray-400 mb-2">
              The application encountered a critical error and needs to restart.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full px-6 py-3 bg-[#f7931a] text-black font-bold border-4 border-black hover:translate-x-1 hover:translate-y-1 transition-transform"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "10px",
              }}
            >
              RESTART APP
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full px-6 py-3 bg-gray-700 text-white font-bold border-4 border-black hover:translate-x-1 hover:translate-y-1 transition-transform"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "10px",
              }}
            >
              GO TO HOME
            </button>
          </div>

          {/* Help */}
          <p className="mt-6 text-xs text-gray-500">
            If this keeps happening, try clearing your browser data or contact
            support.
          </p>
        </div>
      </body>
    </html>
  );
}
