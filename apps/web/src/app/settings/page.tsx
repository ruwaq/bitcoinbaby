"use client";

/**
 * Settings Page
 *
 * Comprehensive settings management for BitcoinBaby including:
 * - Mining settings (difficulty, miner type, auto-submit)
 * - Network settings (network switch, RPC, explorer)
 * - Display settings (theme, sound, notifications)
 * - Security settings (auto-lock, recovery phrase, password)
 * - About section (version, links)
 *
 * Uses centralized overlay store for modals.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  useSettingsStore,
  useNetworkStore,
  useWalletStore,
  getApiClient,
  type MiningDifficulty,
  type MinerTypePreference,
  type AutoLockTimeout,
  type ExplorerPreference,
  AUTO_LOCK_LABELS,
  useRecoveryPhraseModal,
  useChangePasswordModal,
} from "@bitcoinbaby/core";
import { NetworkSwitcher, pixelCard, pixelShadows } from "@bitcoinbaby/ui";

// Section component for consistent styling
function SettingsSectionCard({
  title,
  children,
  variant = "default",
}: {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <div
      className={`${pixelCard.primary} p-6 ${variant === "danger" ? "border-pixel-error" : ""}`}
    >
      <h2
        className={`font-pixel text-sm mb-6 pb-2 border-b-2 border-pixel-border ${variant === "danger" ? "text-pixel-error" : "text-pixel-primary"}`}
      >
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

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
        <span className="font-pixel text-xs text-pixel-text">{label}</span>
        {description && (
          <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`
          relative w-14 h-8 border-4 border-black transition-colors
          ${checked ? "bg-pixel-success" : "bg-pixel-bg-light"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <div
          className={`
            absolute top-0 w-5 h-5 bg-pixel-text border-2 border-black
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
        <span className="font-pixel text-xs text-pixel-text">{label}</span>
        {description && (
          <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
            {description}
          </p>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-3 py-2 font-pixel text-[10px] bg-pixel-bg-dark text-pixel-text border-4 border-black cursor-pointer appearance-none min-w-[120px]"
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

// Input component for text/url
function TextInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block font-pixel text-xs text-pixel-text mb-2">
        {label}
      </label>
      {description && (
        <p className="font-pixel-body text-[10px] text-pixel-text-muted mb-2">
          {description}
        </p>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-3 py-2 font-pixel text-xs bg-pixel-bg-dark text-pixel-text
          border-4 border-black
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      />
    </div>
  );
}

export default function SettingsPage() {
  // Settings store
  const {
    mining,
    network: networkSettings,
    display,
    security,
    setMiningDifficulty,
    setMinerType,
    setAutoSubmit,
    setBackgroundMining,
    setCustomRpcUrl,
    setExplorerPreference,
    setCustomExplorerUrl,
    setSoundEnabled,
    setNotificationsEnabled,
    setAutoLockTimeout,
    resetAllSettings,
  } = useSettingsStore();

  // Network store (for network switching)
  const { network, switchNetwork, mainnetAllowed, setMainnetAllowed } =
    useNetworkStore();

  // Wallet store (for backend reset)
  const walletAddress = useWalletStore((s) => s.wallet?.address);

  // Overlay modal hooks
  const { open: openRecoveryModal } = useRecoveryPhraseModal();
  const { open: openPasswordModal } = useChangePasswordModal();

  // Local confirm states (inline confirmations, not modals)
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetDataConfirm, setShowResetDataConfirm] = useState(false);

  // Handle reset all settings
  const handleResetAll = useCallback(() => {
    resetAllSettings();
    setShowResetConfirm(false);
  }, [resetAllSettings]);

  // Handle reset ALL data (full localStorage + IndexedDB + backend)
  const handleResetAllData = useCallback(async () => {
    // 1. Reset backend balance if wallet is connected
    if (walletAddress) {
      try {
        const apiClient = getApiClient();
        await apiClient.resetBalance(walletAddress);
        console.log("[Settings] Backend balance reset successful");
      } catch (err) {
        console.warn("[Settings] Backend reset failed (continuing):", err);
        // Continue with local reset even if backend fails
      }
    }

    // 2. Clear all BitcoinBaby localStorage keys
    const keysToRemove = [
      "bitcoinbaby-nft-store",
      "bitcoinbaby-mining-store",
      "bitcoinbaby-baby-store",
      "bitcoinbaby-wallet-store",
      "bitcoinbaby-network",
      "bitcoinbaby-settings",
      "bitcoinbaby-leaderboard",
      "bitcoinbaby-tutorial",
      "bitcoinbaby-game",
      "bitcoinbaby_game_state", // Game storage fallback
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // 3. Clear ALL IndexedDB databases
    const dbsToDelete = [
      "bitcoinbaby", // Game storage
      "bitcoinbaby-secure", // Wallet/keys storage
      "bitcoinbaby-mining", // Mining persistence (hashes, sessions)
      "BitcoinBabyShareQueue", // Mining share queue (Dexie)
    ];
    for (const dbName of dbsToDelete) {
      try {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(dbName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => {
            console.warn(`IndexedDB ${dbName} blocked, forcing close`);
            resolve();
          };
        });
      } catch (err) {
        console.warn(`Failed to delete IndexedDB ${dbName}:`, err);
      }
    }

    setShowResetDataConfirm(false);
    // Reload to apply changes
    window.location.reload();
  }, [walletAddress]);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="font-pixel text-xl text-pixel-primary">SETTINGS</h1>
            <Link
              href="/"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
            >
              &larr; BACK
            </Link>
          </div>
          <p className="font-pixel-body text-sm text-pixel-text-muted mt-2">
            Configure your BitcoinBaby experience
          </p>
        </header>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Mining Settings */}
          <SettingsSectionCard title="MINING">
            <Select
              label="DIFFICULTY"
              description="Higher difficulty = harder to mine but more rewards"
              value={mining.difficulty}
              options={[
                { value: "easy" as MiningDifficulty, label: "Easy (12 bits)" },
                {
                  value: "medium" as MiningDifficulty,
                  label: "Medium (16 bits)",
                },
                { value: "hard" as MiningDifficulty, label: "Hard (20 bits)" },
              ]}
              onChange={setMiningDifficulty}
            />

            <Select
              label="MINER TYPE"
              description="Auto will choose the best available"
              value={mining.minerType}
              options={[
                { value: "auto" as MinerTypePreference, label: "Auto" },
                { value: "cpu" as MinerTypePreference, label: "CPU Only" },
                { value: "gpu" as MinerTypePreference, label: "GPU (WebGPU)" },
              ]}
              onChange={setMinerType}
            />

            <Toggle
              label="AUTO-SUBMIT"
              description="Automatically submit mining proofs to blockchain"
              checked={mining.autoSubmit}
              onChange={setAutoSubmit}
            />

            <Toggle
              label="BACKGROUND MINING"
              description="Continue mining when tab is inactive (coming soon)"
              checked={mining.backgroundMining}
              onChange={setBackgroundMining}
              disabled={true}
            />
          </SettingsSectionCard>

          {/* Network Settings */}
          <SettingsSectionCard title="NETWORK">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-pixel text-xs text-pixel-text">
                  BITCOIN NETWORK
                </span>
                <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
                  Switch between testnet and mainnet
                </p>
              </div>
              <NetworkSwitcher
                network={network}
                mainnetAllowed={mainnetAllowed}
                onNetworkChange={switchNetwork}
                onEnableMainnet={() => setMainnetAllowed(true)}
              />
            </div>

            <Select
              label="EXPLORER"
              description="Block explorer preference"
              value={networkSettings.explorerPreference}
              options={[
                {
                  value: "mempool" as ExplorerPreference,
                  label: "Mempool.space",
                },
                {
                  value: "blockstream" as ExplorerPreference,
                  label: "Blockstream",
                },
                { value: "custom" as ExplorerPreference, label: "Custom" },
              ]}
              onChange={setExplorerPreference}
            />

            {networkSettings.explorerPreference === "custom" && (
              <TextInput
                label="CUSTOM EXPLORER URL"
                description="Enter your preferred block explorer URL"
                value={networkSettings.customExplorerUrl || ""}
                onChange={setCustomExplorerUrl}
                placeholder="https://..."
              />
            )}

            <TextInput
              label="CUSTOM RPC ENDPOINT"
              description="Advanced: Override the default RPC endpoint"
              value={networkSettings.customRpcUrl || ""}
              onChange={setCustomRpcUrl}
              placeholder="https://..."
            />
          </SettingsSectionCard>

          {/* Display Settings */}
          <SettingsSectionCard title="DISPLAY">
            <Select
              label="THEME"
              description="Visual theme (more coming soon)"
              value={display.theme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light (coming soon)" },
                { value: "system", label: "System (coming soon)" },
              ]}
              onChange={() => {
                // Only dark is supported for now
              }}
            />

            <Toggle
              label="SOUND EFFECTS"
              description="Play sounds for mining events and achievements"
              checked={display.soundEnabled}
              onChange={setSoundEnabled}
            />

            <Toggle
              label="NOTIFICATIONS"
              description="Show browser notifications for important events"
              checked={display.notificationsEnabled}
              onChange={setNotificationsEnabled}
            />
          </SettingsSectionCard>

          {/* Security Settings */}
          <SettingsSectionCard title="SECURITY">
            <Select
              label="AUTO-LOCK TIMEOUT"
              description="Lock wallet after inactivity"
              value={String(security.autoLockTimeout) as `${AutoLockTimeout}`}
              options={[
                { value: "60000", label: AUTO_LOCK_LABELS[60000] },
                { value: "300000", label: AUTO_LOCK_LABELS[300000] },
                { value: "900000", label: AUTO_LOCK_LABELS[900000] },
                { value: "0", label: AUTO_LOCK_LABELS[0] },
              ]}
              onChange={(val) =>
                setAutoLockTimeout(Number(val) as AutoLockTimeout)
              }
            />

            <div className="flex items-center justify-between">
              <div>
                <span className="font-pixel text-xs text-pixel-text">
                  RECOVERY PHRASE
                </span>
                <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
                  View your 12-word backup phrase
                </p>
              </div>
              <button
                onClick={() => openRecoveryModal()}
                className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
              >
                SHOW
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-pixel text-xs text-pixel-text">
                  CHANGE PASSWORD
                </span>
                <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
                  Update your wallet encryption password
                </p>
              </div>
              <button
                onClick={openPasswordModal}
                className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
              >
                CHANGE
              </button>
            </div>
          </SettingsSectionCard>

          {/* About Section */}
          <SettingsSectionCard title="ABOUT">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-pixel text-xs text-pixel-text-muted">
                  VERSION
                </span>
                <span className="font-pixel-mono text-xs text-pixel-text">
                  0.1.0-alpha
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-pixel text-xs text-pixel-text-muted">
                  BUILD
                </span>
                <span className="font-pixel-mono text-xs text-pixel-text">
                  {new Date().toISOString().slice(0, 10)}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t-2 border-pixel-border">
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://github.com/bitcoinbaby/bitcoinbaby"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-primary hover:text-black transition-colors"
                >
                  GITHUB
                </a>
                <a
                  href="https://docs.bitcoinbaby.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-secondary hover:text-black transition-colors"
                >
                  DOCS
                </a>
                <a
                  href="https://discord.gg/bitcoinbaby"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-[#5865F2] hover:text-white transition-colors"
                >
                  DISCORD
                </a>
              </div>
            </div>
          </SettingsSectionCard>

          {/* Reset All Settings */}
          <div
            className={`bg-pixel-bg-medium border-4 border-pixel-error p-6 ${pixelShadows.lg}`}
          >
            <h2 className="font-pixel text-sm text-pixel-error mb-4">
              DANGER ZONE
            </h2>

            {/* Reset Settings */}
            <div className="mb-6 pb-6 border-b-2 border-pixel-border">
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                Reset all settings to their default values. This will not affect
                your wallet or mining progress.
              </p>
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-4 py-2 font-pixel text-[10px] text-pixel-error border-4 border-pixel-error hover:bg-pixel-error hover:text-white transition-colors"
                >
                  RESET SETTINGS
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleResetAll}
                    className={`px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black ${pixelShadows.md}`}
                  >
                    CONFIRM
                  </button>
                </div>
              )}
            </div>

            {/* Reset ALL Data */}
            <div>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-2">
                Delete ALL app data including wallet, NFTs, mining progress, and
                settings. Start completely fresh.
              </p>
              <p className="font-pixel text-[8px] text-pixel-error mb-4">
                WARNING: This cannot be undone! Make sure you have your recovery
                phrase backed up.
              </p>
              {!showResetDataConfirm ? (
                <button
                  onClick={() => setShowResetDataConfirm(true)}
                  className="px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black hover:bg-pixel-error/80 transition-colors"
                >
                  RESET ALL DATA
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetDataConfirm(false)}
                    className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleResetAllData}
                    className={`px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black ${pixelShadows.md} animate-pulse`}
                  >
                    DELETE EVERYTHING
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t-2 border-pixel-border text-center">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            Built with love on Bitcoin
          </p>
        </footer>
      </div>
    </main>
  );
}
