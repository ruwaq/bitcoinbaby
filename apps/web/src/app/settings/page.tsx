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
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  useSettingsStore,
  useNetworkStore,
  useWalletStore,
  getApiClient,
  SecureStorage,
  MIN_PASSWORD_LENGTH,
  type MiningDifficulty,
  type MinerTypePreference,
  type AutoLockTimeout,
  type ExplorerPreference,
  AUTO_LOCK_LABELS,
} from "@bitcoinbaby/core";
import { NetworkSwitcher } from "@bitcoinbaby/ui";

// Section component for consistent styling
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 shadow-[8px_8px_0_0_#000]">
      <h2 className="font-pixel text-sm text-pixel-primary mb-6 pb-2 border-b-2 border-pixel-border">
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

// Password modal for recovery phrase
function RecoveryPhraseModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReveal = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get mnemonic from secure storage using password
      const mnemonic = await SecureStorage.getMnemonic(password);
      setPhrase(mnemonic);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid password or no wallet found",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (phrase) {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-pixel-bg-dark border-4 border-black p-6 shadow-[8px_8px_0_0_#000] max-w-md mx-4">
        <h3 className="font-pixel text-pixel-primary text-sm mb-4">
          RECOVERY PHRASE
        </h3>

        {!phrase ? (
          <>
            <p className="font-pixel-body text-sm text-pixel-text mb-4">
              Enter your password to reveal your 12-word recovery phrase.
            </p>

            <div className="bg-pixel-error/20 border-2 border-pixel-error p-3 mb-4">
              <p className="font-pixel text-[8px] text-pixel-error">
                WARNING: Never share your recovery phrase with anyone!
              </p>
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 mb-4 font-pixel text-xs bg-pixel-bg-light border-4 border-black text-pixel-text"
            />

            {error && (
              <p className="font-pixel text-[10px] text-pixel-error mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
              >
                CANCEL
              </button>
              <button
                onClick={handleReveal}
                disabled={isLoading || password.length < MIN_PASSWORD_LENGTH}
                className="flex-1 px-4 py-2 font-pixel text-[10px] bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50"
              >
                {isLoading ? "..." : "REVEAL"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-pixel-error/20 border-2 border-pixel-error p-3 mb-4">
              <p className="font-pixel text-[8px] text-pixel-error">
                NEVER share this phrase with anyone! Anyone with these words can
                steal your funds.
              </p>
            </div>

            <div className="bg-pixel-bg-light border-4 border-black p-4 mb-4">
              <div className="grid grid-cols-3 gap-2">
                {phrase.split(" ").map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 bg-pixel-bg-dark px-2 py-1 border-2 border-pixel-border"
                  >
                    <span className="font-pixel text-[8px] text-pixel-text-muted">
                      {i + 1}.
                    </span>
                    <span className="font-pixel-mono text-[10px] text-pixel-text">
                      {word}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
              >
                {copied ? "COPIED!" : "COPY"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 font-pixel text-[10px] bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000]"
              >
                CLOSE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Change password modal
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [success, setSuccess] = useState(false);

  const handleChange = async () => {
    if (currentPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Current password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await SecureStorage.changePassword(currentPassword, newPassword);
      setSuccess(true);
      // Close modal after 2 seconds
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-pixel-bg-dark border-4 border-black p-6 shadow-[8px_8px_0_0_#000] max-w-md mx-4">
        <h3 className="font-pixel text-pixel-primary text-sm mb-4">
          CHANGE PASSWORD
        </h3>

        <div className="space-y-3 mb-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full px-3 py-2 font-pixel text-xs bg-pixel-bg-light border-4 border-black text-pixel-text"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full px-3 py-2 font-pixel text-xs bg-pixel-bg-light border-4 border-black text-pixel-text"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 font-pixel text-xs bg-pixel-bg-light border-4 border-black text-pixel-text"
          />
        </div>

        {error && (
          <p className="font-pixel text-[10px] text-pixel-error mb-4">
            {error}
          </p>
        )}

        {success && (
          <div className="bg-pixel-success/20 border-2 border-pixel-success p-3 mb-4">
            <p className="font-pixel text-[10px] text-pixel-success">
              Password changed successfully!
            </p>
          </div>
        )}

        {!success && (
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
            >
              CANCEL
            </button>
            <button
              onClick={handleChange}
              disabled={isLoading}
              className="flex-1 px-4 py-2 font-pixel text-[10px] bg-pixel-success text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] disabled:opacity-50"
            >
              {isLoading ? "..." : "CHANGE"}
            </button>
          </div>
        )}
      </div>
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

  // Modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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

    // 3. Clear IndexedDB databases (including share queue)
    const dbsToDelete = [
      "bitcoinbaby",
      "bitcoinbaby-secure",
      "BitcoinBabyShareQueue", // Mining share queue
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
          <SettingsSection title="MINING">
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
          </SettingsSection>

          {/* Network Settings */}
          <SettingsSection title="NETWORK">
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
          </SettingsSection>

          {/* Display Settings */}
          <SettingsSection title="DISPLAY">
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
          </SettingsSection>

          {/* Security Settings */}
          <SettingsSection title="SECURITY">
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
                onClick={() => setShowRecoveryModal(true)}
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
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
              >
                CHANGE
              </button>
            </div>
          </SettingsSection>

          {/* About Section */}
          <SettingsSection title="ABOUT">
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
          </SettingsSection>

          {/* Reset All Settings */}
          <div className="bg-pixel-bg-medium border-4 border-pixel-error p-6 shadow-[8px_8px_0_0_#000]">
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
                    className="px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black shadow-[4px_4px_0_0_#000]"
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
                    className="px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black shadow-[4px_4px_0_0_#000] animate-pulse"
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

      {/* Modals */}
      {showRecoveryModal && (
        <RecoveryPhraseModal onClose={() => setShowRecoveryModal(false)} />
      )}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </main>
  );
}
