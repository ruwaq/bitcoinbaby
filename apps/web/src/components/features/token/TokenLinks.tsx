"use client";

/**
 * TokenLinks - Links y recursos del token
 *
 * Links externos a explorers, documentacion, etc.
 */

import { BABTC_TESTNET4 } from "@bitcoinbaby/bitcoin";
import { pixelBorders } from "@bitcoinbaby/ui";

const LINKS = [
  {
    label: "Charms Explorer",
    url: "https://explorer.charms.dev",
    icon: "🔍",
    description: "View token on Charms Explorer",
  },
  {
    label: "Mempool",
    url: "https://mempool.space/testnet4",
    icon: "📊",
    description: "Bitcoin Testnet4 Explorer",
  },
  {
    label: "Contract Code",
    url: "https://github.com/Sobek-lab/bitcoinbaby/tree/main/packages/bitcoin/contracts/babtc",
    icon: "📝",
    description: "Smart contract source code",
  },
  {
    label: "Documentation",
    url: "https://bitcoinbaby.dev",
    icon: "📚",
    description: "Learn about BitcoinBaby",
  },
];

export function TokenLinks() {
  const appId = BABTC_TESTNET4.appId;

  return (
    <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6`}>
      <h2 className="font-pixel text-pixel-sm text-pixel-primary mb-4">
        LINKS & RESOURCES
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center justify-center p-4 bg-pixel-bg-dark ${pixelBorders.thin} hover:border-pixel-primary hover:bg-pixel-primary/10 transition-all group`}
          >
            <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
              {link.icon}
            </span>
            <span className="font-pixel text-pixel-2xs text-pixel-text group-hover:text-pixel-primary text-center">
              {link.label.toUpperCase()}
            </span>
          </a>
        ))}
      </div>

      {/* Quick Copy Section */}
      <div className="mt-4 pt-4 border-t border-pixel-text-muted/20">
        <div className="flex flex-wrap gap-2">
          <CopyButton label="Copy App ID" value={appId} />
          <CopyButton
            label="Copy Token URL"
            value={`https://explorer.charms.dev/token/${appId}`}
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
  };

  return (
    <button
      onClick={handleCopy}
      className={`font-pixel text-pixel-2xs px-3 py-2 bg-pixel-bg-dark ${pixelBorders.thin} hover:border-pixel-primary hover:text-pixel-primary transition-colors`}
    >
      {label}
    </button>
  );
}

export default TokenLinks;
