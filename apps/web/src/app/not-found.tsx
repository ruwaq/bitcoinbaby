import Link from "next/link";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

export default function NotFound() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark flex items-center justify-center">
      <div className="max-w-md w-full">
        {/* 404 Card */}
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.medium} p-8 ${pixelShadows.lg} text-center`}
        >
          {/* Lost Baby Icon - Pixel Art Style */}
          <div className="mb-6">
            <svg
              width="96"
              height="96"
              viewBox="0 0 16 16"
              className="mx-auto"
              style={{ imageRendering: "pixelated" }}
            >
              {/* Baby circle */}
              <rect x="4" y="2" width="8" height="2" fill="#4fc3f7" />
              <rect x="2" y="4" width="2" height="8" fill="#4fc3f7" />
              <rect x="12" y="4" width="2" height="8" fill="#4fc3f7" />
              <rect x="4" y="12" width="8" height="2" fill="#4fc3f7" />
              <rect x="4" y="4" width="8" height="8" fill="#29b6f6" />
              {/* Confused eyes */}
              <rect x="5" y="5" width="2" height="2" fill="#1f2937" />
              <rect x="9" y="5" width="2" height="2" fill="#1f2937" />
              {/* Question mark mouth */}
              <rect x="7" y="8" width="2" height="1" fill="#1f2937" />
              <rect x="8" y="9" width="1" height="1" fill="#1f2937" />
              <rect x="7" y="10" width="2" height="1" fill="#1f2937" />
            </svg>
          </div>

          {/* 404 Badge */}
          <span className="inline-block px-3 py-1 font-pixel text-[10px] bg-pixel-secondary text-black border-2 border-black mb-4">
            404
          </span>

          {/* Title */}
          <h1 className="font-pixel text-lg text-pixel-text mb-4">
            PAGE NOT FOUND
          </h1>

          {/* Message */}
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-4 mb-6">
            <p className="font-pixel-body text-sm text-pixel-text-muted">
              The baby wandered off and got lost. This page does not exist.
            </p>
          </div>

          {/* Action Button */}
          <Link
            href="/"
            className={`inline-block px-6 py-3 font-pixel text-[10px] bg-pixel-primary text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none`}
          >
            GO HOME
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            Check the URL or navigate back to safety.
          </p>
        </div>
      </div>
    </main>
  );
}
