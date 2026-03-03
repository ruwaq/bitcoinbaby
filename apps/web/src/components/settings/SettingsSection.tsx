"use client";

/**
 * SettingsSection - Reusable Settings Interface
 *
 * Comprehensive settings management for BitcoinBaby including:
 * - Mining settings (difficulty, miner type, auto-submit)
 * - Display settings (sound, notifications)
 * - Security settings (auto-lock)
 * - Quick actions (recovery phrase, change password)
 *
 * Uses centralized overlay store for modals.
 */

import { useState } from "react";
import {
  useSettingsStore,
  useNetworkStore,
  useWalletStore,
  type MiningDifficulty,
  type MinerTypePreference,
  type AutoLockTimeout,
  AUTO_LOCK_LABELS,
  getMiningManager,
  useNFTStore,
  clearQueue as clearShareQueue,
  getApiClient,
  useRecoveryPhraseModal,
  useChangePasswordModal,
} from "@bitcoinbaby/core";
import { NetworkSwitcher } from "@bitcoinbaby/ui";

// Toggle switch component
function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-pixel text-[10px] text-pixel-text">{label}</span>
        {description && (
          <p className="font-pixel-body text-[8px] text-pixel-text-muted mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`
          relative w-12 h-6 border-2 border-black transition-colors
          ${checked ? "bg-pixel-success" : "bg-pixel-bg-light"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <div
          className={`
            absolute top-0 w-4 h-4 bg-pixel-text border border-black
            transition-transform duration-150
            ${checked ? "translate-x-6" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}

// Select component
function Select<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="font-pixel text-[10px] text-pixel-text">{label}</span>
        {description && (
          <p className="font-pixel-body text-[8px] text-pixel-text-muted mt-0.5">
            {description}
          </p>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-2 py-1 font-pixel text-[8px] bg-pixel-bg-dark text-pixel-text border-2 border-black cursor-pointer appearance-none min-w-[100px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SettingsSection() {
  // Settings store
  const {
    mining,
    display,
    security,
    setMiningDifficulty,
    setMinerType,
    setAutoSubmit,
    setSoundEnabled,
    setNotificationsEnabled,
    setAutoLockTimeout,
  } = useSettingsStore();

  // Network store
  const { network, switchNetwork, mainnetAllowed, setMainnetAllowed } =
    useNetworkStore();

  // Overlay modal hooks
  const { open: openRecoveryModal } = useRecoveryPhraseModal();
  const { open: openPasswordModal } = useChangePasswordModal();

  // Debug state
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  // NFT store reset
  const resetNFTStore = useNFTStore((s) => s.reset);

  // Get wallet address for backend reset
  const walletAddress = useWalletStore((s) => s.wallet?.address);

  // Clear all testnet data (local + backend)
  const handleClearTestnetData = async () => {
    if (
      !confirm(
        "This will PERMANENTLY DELETE all your testnet data:\n\n• Backend: Virtual balance & mining history\n• Local: Mining stats, share queue, NFT cache\n\nYour wallet seed phrase is safe.\nNFTs on blockchain are safe.\n\nTHIS CANNOT BE UNDONE. Continue?",
      )
    ) {
      return;
    }

    setIsClearing(true);
    setClearMessage(null);

    try {
      const errors: string[] = [];

      // 1. Reset backend balance (most important)
      if (walletAddress) {
        try {
          const client = getApiClient();
          const result = await client.resetBalance(walletAddress);
          if (!result.success) {
            errors.push(`Backend: ${result.error || "Failed to reset"}`);
          }
        } catch (err) {
          errors.push(
            `Backend: ${err instanceof Error ? err.message : "Connection failed"}`,
          );
        }
      }

      // 2. Clear mining manager data
      const manager = getMiningManager();
      await manager.resetAllMiningData();

      // 3. Clear share queue
      await clearShareQueue();

      // 4. Reset NFT store
      resetNFTStore();

      // 5. Clear localStorage items
      const keysToRemove = [
        "bitcoinbaby-nft-store",
        "bitcoinbaby-pending-tx-store",
        "bitcoinbaby-mining-state",
        "bitcoinbaby-mining-store",
      ];
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
      });

      if (errors.length > 0) {
        setClearMessage(
          `Partial reset. Errors:\n${errors.join("\n")}\n\nRefresh the page.`,
        );
      } else {
        setClearMessage(
          "All data reset to zero! Refresh the page to start fresh.",
        );
      }
    } catch (err) {
      setClearMessage(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mining Settings */}
      <div className="space-y-3">
        <h3 className="font-pixel text-[10px] text-pixel-primary border-b border-pixel-border pb-1">
          MINING
        </h3>

        <Select
          label="DIFFICULTY"
          description="Higher = harder but more rewards"
          value={mining.difficulty}
          options={[
            { value: "easy" as MiningDifficulty, label: "Easy" },
            { value: "medium" as MiningDifficulty, label: "Medium" },
            { value: "hard" as MiningDifficulty, label: "Hard" },
          ]}
          onChange={setMiningDifficulty}
        />

        <Select
          label="MINER TYPE"
          description="Auto chooses best available"
          value={mining.minerType}
          options={[
            { value: "auto" as MinerTypePreference, label: "Auto" },
            { value: "cpu" as MinerTypePreference, label: "CPU" },
            { value: "gpu" as MinerTypePreference, label: "GPU" },
          ]}
          onChange={setMinerType}
        />

        <Toggle
          label="AUTO-SUBMIT"
          description="Auto submit mining proofs"
          checked={mining.autoSubmit}
          onChange={setAutoSubmit}
        />
      </div>

      {/* Network Settings */}
      <div className="space-y-3">
        <h3 className="font-pixel text-[10px] text-pixel-primary border-b border-pixel-border pb-1">
          NETWORK
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-pixel text-[10px] text-pixel-text">
              BITCOIN NETWORK
            </span>
            <p className="font-pixel-body text-[8px] text-pixel-text-muted mt-0.5">
              Testnet or Mainnet
            </p>
          </div>
          <NetworkSwitcher
            network={network}
            mainnetAllowed={mainnetAllowed}
            onNetworkChange={switchNetwork}
            onEnableMainnet={() => setMainnetAllowed(true)}
          />
        </div>
      </div>

      {/* Display Settings */}
      <div className="space-y-3">
        <h3 className="font-pixel text-[10px] text-pixel-primary border-b border-pixel-border pb-1">
          DISPLAY
        </h3>

        <Toggle
          label="SOUND EFFECTS"
          description="Mining and achievement sounds"
          checked={display.soundEnabled}
          onChange={setSoundEnabled}
        />

        <Toggle
          label="NOTIFICATIONS"
          description="Browser notifications"
          checked={display.notificationsEnabled}
          onChange={setNotificationsEnabled}
        />
      </div>

      {/* Security Settings */}
      <div className="space-y-3">
        <h3 className="font-pixel text-[10px] text-pixel-primary border-b border-pixel-border pb-1">
          SECURITY
        </h3>

        <Select
          label="AUTO-LOCK"
          description="Lock wallet after inactivity"
          value={String(security.autoLockTimeout) as `${AutoLockTimeout}`}
          options={[
            { value: "60000", label: AUTO_LOCK_LABELS[60000] },
            { value: "300000", label: AUTO_LOCK_LABELS[300000] },
            { value: "900000", label: AUTO_LOCK_LABELS[900000] },
            { value: "0", label: AUTO_LOCK_LABELS[0] },
          ]}
          onChange={(val) => setAutoLockTimeout(Number(val) as AutoLockTimeout)}
        />

        <div className="flex items-center justify-between">
          <div>
            <span className="font-pixel text-[10px] text-pixel-text">
              RECOVERY PHRASE
            </span>
            <p className="font-pixel-body text-[8px] text-pixel-text-muted mt-0.5">
              View your 12-word backup
            </p>
          </div>
          <button
            onClick={() => openRecoveryModal()}
            className="px-3 py-1 font-pixel text-[8px] bg-pixel-bg-light text-pixel-text border-2 border-black hover:bg-pixel-bg-dark"
          >
            SHOW
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-pixel text-[10px] text-pixel-text">
              CHANGE PASSWORD
            </span>
            <p className="font-pixel-body text-[8px] text-pixel-text-muted mt-0.5">
              Update wallet encryption
            </p>
          </div>
          <button
            onClick={openPasswordModal}
            className="px-3 py-1 font-pixel text-[8px] bg-pixel-bg-light text-pixel-text border-2 border-black hover:bg-pixel-bg-dark"
          >
            CHANGE
          </button>
        </div>
      </div>

      {/* Developer / Debug (only on testnet - includes testnet4) */}
      {network.includes("testnet") && (
        <div className="space-y-3">
          <h3 className="font-pixel text-[10px] text-pixel-warning border-b border-pixel-warning pb-1">
            DEVELOPER
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="font-pixel text-[10px] text-pixel-text">
                CLEAR TESTNET DATA
              </span>
              <p className="font-pixel-body text-[8px] text-pixel-text-muted mt-0.5">
                Reset mining stats, queue & cache
              </p>
            </div>
            <button
              onClick={handleClearTestnetData}
              disabled={isClearing}
              className="px-3 py-1 font-pixel text-[8px] bg-pixel-error/20 text-pixel-error border-2 border-pixel-error hover:bg-pixel-error hover:text-white disabled:opacity-50"
            >
              {isClearing ? "CLEARING..." : "CLEAR"}
            </button>
          </div>

          {clearMessage && (
            <p
              className={`font-pixel text-[8px] ${clearMessage.startsWith("Error") ? "text-pixel-error" : "text-pixel-success"}`}
            >
              {clearMessage}
            </p>
          )}
        </div>
      )}

      {/* About */}
      <div className="space-y-2 pt-4 border-t border-pixel-border">
        <div className="flex justify-between items-center">
          <span className="font-pixel text-[8px] text-pixel-text-muted">
            VERSION
          </span>
          <span className="font-pixel-mono text-[8px] text-pixel-text">
            0.1.0-alpha
          </span>
        </div>
        <p className="font-pixel text-[6px] text-pixel-text-muted text-center">
          Built on Bitcoin with Charms Protocol
        </p>
      </div>
    </div>
  );
}

export default SettingsSection;
