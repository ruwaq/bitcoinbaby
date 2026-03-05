"use client";

/**
 * TokenHeader - Header del token $BABTC
 *
 * Muestra:
 * - Logo y nombre del token
 * - Network badge (Testnet4)
 * - Links a explorer y contract
 */

import Image from "next/image";
import {
  BABTC_CONFIG,
  BABTC_METADATA,
  BABTC_TESTNET4,
} from "@bitcoinbaby/bitcoin";
import { pixelBorders } from "@bitcoinbaby/ui";

const EXPLORER_LINKS = {
  charms: "https://explorer.charms.dev",
  mempool: "https://mempool.space/testnet4",
  github: "https://github.com/Sobek-lab/bitcoinbaby",
};

export function TokenHeader() {
  const appId = BABTC_TESTNET4.appId;
  const appVk = BABTC_TESTNET4.appVk;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 mb-4`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Logo and Name */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-4 border-pixel-primary bg-pixel-bg-dark flex items-center justify-center">
            {BABTC_METADATA.image ? (
              <Image
                src={BABTC_METADATA.image}
                alt="BABTC Logo"
                fill
                className="object-cover pixelated"
                unoptimized
              />
            ) : (
              <span className="font-pixel text-pixel-lg text-pixel-primary">
                $
              </span>
            )}
          </div>
          <div>
            <h1 className="font-pixel text-pixel-lg sm:text-pixel-xl text-pixel-primary">
              ${BABTC_CONFIG.ticker}
            </h1>
            <p className="font-pixel-body text-pixel-sm text-pixel-text-muted">
              {BABTC_METADATA.name} Token
            </p>
            <div className="flex gap-2 mt-2">
              <span className="font-pixel text-pixel-2xs px-2 py-1 bg-pixel-warning/20 text-pixel-warning border border-pixel-warning">
                TESTNET4
              </span>
              <span className="font-pixel text-pixel-2xs px-2 py-1 bg-pixel-secondary/20 text-pixel-secondary border border-pixel-secondary">
                CHARMS
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`${EXPLORER_LINKS.charms}/token/${appId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-pixel text-pixel-2xs px-3 py-2 bg-pixel-bg-dark ${pixelBorders.thin} hover:border-pixel-primary hover:text-pixel-primary transition-colors`}
          >
            EXPLORER
          </a>
          <a
            href={EXPLORER_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-pixel text-pixel-2xs px-3 py-2 bg-pixel-bg-dark ${pixelBorders.thin} hover:border-pixel-primary hover:text-pixel-primary transition-colors`}
          >
            CONTRACT
          </a>
          <a
            href={EXPLORER_LINKS.mempool}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-pixel text-pixel-2xs px-3 py-2 bg-pixel-bg-dark ${pixelBorders.thin} hover:border-pixel-primary hover:text-pixel-primary transition-colors`}
          >
            MEMPOOL
          </a>
        </div>
      </div>

      {/* Contract IDs (collapsible on mobile) */}
      <div className="mt-4 pt-4 border-t border-pixel-text-muted/20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={() => copyToClipboard(appId)}
            className="flex items-center gap-2 text-left group"
          >
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
              APP ID:
            </span>
            <span className="font-mono text-pixel-2xs text-pixel-text truncate flex-1 group-hover:text-pixel-primary">
              {appId.slice(0, 16)}...{appId.slice(-8)}
            </span>
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted group-hover:text-pixel-primary">
              COPY
            </span>
          </button>
          <button
            onClick={() => copyToClipboard(appVk)}
            className="flex items-center gap-2 text-left group"
          >
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
              APP VK:
            </span>
            <span className="font-mono text-pixel-2xs text-pixel-text truncate flex-1 group-hover:text-pixel-primary">
              {appVk.slice(0, 16)}...{appVk.slice(-8)}
            </span>
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted group-hover:text-pixel-primary">
              COPY
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TokenHeader;
