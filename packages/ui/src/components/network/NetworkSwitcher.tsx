"use client";

/**
 * NetworkSwitcher - Toggle entre testnet4 y mainnet
 *
 * Componente pixel art para cambiar de red Bitcoin.
 * Incluye proteccion para mainnet (requiere confirmacion).
 */

import { useState } from "react";
import { clsx } from "clsx";

type BitcoinNetwork = "mainnet" | "testnet4";

interface NetworkSwitcherProps {
  /** Current network */
  network: BitcoinNetwork;
  /** Whether mainnet is allowed */
  mainnetAllowed: boolean;
  /** Callback when network changes */
  onNetworkChange: (network: BitcoinNetwork) => void;
  /** Callback to enable mainnet */
  onEnableMainnet?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function NetworkSwitcher({
  network,
  mainnetAllowed,
  onNetworkChange,
  onEnableMainnet,
  className,
}: NetworkSwitcherProps) {
  const [showMainnetWarning, setShowMainnetWarning] = useState(false);

  const isMainnet = network === "mainnet";

  const handleNetworkClick = (targetNetwork: BitcoinNetwork) => {
    if (targetNetwork === "mainnet" && !mainnetAllowed) {
      setShowMainnetWarning(true);
      return;
    }
    onNetworkChange(targetNetwork);
  };

  const handleEnableMainnet = () => {
    onEnableMainnet?.();
    setShowMainnetWarning(false);
    onNetworkChange("mainnet");
  };

  return (
    <div className={clsx("relative", className)}>
      {/* Network Toggle */}
      <div
        className={clsx(
          "flex items-center gap-1",
          "border-2 border-black p-1",
          "bg-pixel-bg-dark",
        )}
      >
        {/* Testnet4 Button */}
        <button
          onClick={() => handleNetworkClick("testnet4")}
          className={clsx(
            "px-3 py-1",
            "font-pixel text-[8px] uppercase",
            "border-2 border-black",
            "transition-all duration-100",
            !isMainnet
              ? "bg-pixel-secondary text-pixel-text-dark shadow-[2px_2px_0_0_#000]"
              : "bg-pixel-bg-light text-pixel-text-muted hover:bg-pixel-bg-dark",
          )}
        >
          Testnet4
        </button>

        {/* Mainnet Button */}
        <button
          onClick={() => handleNetworkClick("mainnet")}
          className={clsx(
            "px-3 py-1",
            "font-pixel text-[8px] uppercase",
            "border-2 border-black",
            "transition-all duration-100",
            isMainnet
              ? "bg-pixel-primary text-pixel-text-dark shadow-[2px_2px_0_0_#000]"
              : "bg-pixel-bg-light text-pixel-text-muted hover:bg-pixel-bg-dark",
            !mainnetAllowed && "opacity-50",
          )}
        >
          Mainnet
        </button>
      </div>

      {/* Network Indicator */}
      <div
        className={clsx(
          "absolute -top-1 -right-1",
          "w-3 h-3 rounded-full",
          "border-2 border-black",
          isMainnet ? "bg-pixel-primary animate-pulse" : "bg-pixel-secondary",
        )}
      />

      {/* Mainnet Warning Modal */}
      {showMainnetWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div
            className={clsx(
              "bg-pixel-bg-dark border-4 border-black p-6",
              "shadow-[8px_8px_0_0_#000]",
              "max-w-md mx-4",
            )}
          >
            <h3 className="font-pixel text-pixel-primary text-sm mb-4">
              ENABLE MAINNET?
            </h3>

            <div className="font-pixel-body text-pixel-text text-xs space-y-2 mb-6">
              <p>You are about to enable Bitcoin Mainnet.</p>
              <p className="text-pixel-error">
                WARNING: Mainnet uses REAL Bitcoin!
              </p>
              <p>Only proceed if you understand the risks.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowMainnetWarning(false)}
                className={clsx(
                  "flex-1 px-4 py-2",
                  "font-pixel text-[10px] uppercase",
                  "bg-pixel-bg-light text-pixel-text",
                  "border-2 border-black",
                  "hover:bg-pixel-bg-dark",
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleEnableMainnet}
                className={clsx(
                  "flex-1 px-4 py-2",
                  "font-pixel text-[10px] uppercase",
                  "bg-pixel-error text-white",
                  "border-2 border-black",
                  "shadow-[4px_4px_0_0_#000]",
                  "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
                )}
              >
                Enable Mainnet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * NetworkBadge - Network indicator badge
 *
 * More prominent styling for mainnet to warn users they're using real BTC.
 */
export function NetworkBadge({
  network,
  className,
  size = "default",
}: {
  network: BitcoinNetwork;
  className?: string;
  /** Badge size - "default" or "prominent" (for mainnet warnings) */
  size?: "default" | "prominent";
}) {
  const isMainnet = network === "mainnet";

  // Auto-prominent for mainnet
  const isProminent = size === "prominent" || isMainnet;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1",
        "font-pixel uppercase",
        "border-2 border-black",
        // Size variants
        isProminent ? "px-3 py-1.5 text-[10px]" : "px-2 py-1 text-[8px]",
        // Color variants
        isMainnet
          ? "bg-pixel-error text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          : "bg-pixel-secondary text-pixel-text-dark",
        className,
      )}
    >
      <span
        className={clsx(
          "rounded-full",
          isProminent ? "w-2.5 h-2.5" : "w-2 h-2",
          isMainnet ? "bg-yellow-400 animate-ping" : "bg-blue-400",
        )}
      />
      <span
        className={clsx(
          "rounded-full absolute",
          isProminent ? "w-2.5 h-2.5" : "w-2 h-2",
          isMainnet ? "bg-yellow-400" : "bg-blue-400",
        )}
        style={{ position: "relative" }}
      />
      {isMainnet ? "MAINNET" : "TESTNET4"}
      {isMainnet && <span className="ml-1 text-yellow-400">!</span>}
    </span>
  );
}
