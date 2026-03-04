"use client";

import { HelpTooltip, pixelBorders } from "@bitcoinbaby/ui";

export function VersionInfo() {
  return (
    <div className="mt-12 text-center">
      <div
        className={`inline-block bg-pixel-bg-medium ${pixelBorders.medium} p-4`}
      >
        <div className="flex items-center justify-center gap-1 mb-2">
          <p className="font-pixel text-[8px] text-pixel-text-muted uppercase">
            BitcoinBaby
          </p>
          <HelpTooltip
            content="A gamified mining experience built on Bitcoin. Mine $BABY tokens, raise your baby, and collect NFTs."
            title="About"
            description="Powered by Charms Protocol for NFTs and tokens on Bitcoin."
            size="sm"
          />
        </div>
        <p className="font-pixel-mono text-sm text-pixel-text">v0.1.0-alpha</p>
        <p className="font-pixel text-[6px] text-pixel-text-muted mt-2">
          Built on Bitcoin with Charms Protocol
        </p>
      </div>
    </div>
  );
}
