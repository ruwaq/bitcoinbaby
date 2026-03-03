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
 * Used by both SettingsSheet (overlay) and settings page.
 */

import { useState } from "react";
import {
  useSettingsStore,
  useNetworkStore,
  SecureStorage,
  MIN_PASSWORD_LENGTH,
  type MiningDifficulty,
  type MinerTypePreference,
  type AutoLockTimeout,
  AUTO_LOCK_LABELS,
  getMiningManager,
  getSyncManager,
  useNFTStore,
  clearQueue as clearShareQueue,
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

// Recovery phrase modal
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="bg-pixel-bg-dark border-4 border-black p-4 shadow-[8px_8px_0_0_#000] max-w-sm mx-4">
        <h3 className="font-pixel text-pixel-primary text-xs mb-3">
          RECOVERY PHRASE
        </h3>

        {!phrase ? (
          <>
            <p className="font-pixel-body text-xs text-pixel-text mb-3">
              Enter your password to reveal your 12-word recovery phrase.
            </p>

            <div className="bg-pixel-error/20 border-2 border-pixel-error p-2 mb-3">
              <p className="font-pixel text-[7px] text-pixel-error">
                Never share your recovery phrase!
              </p>
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-2 py-1 mb-3 font-pixel text-[10px] bg-pixel-bg-light border-2 border-black text-pixel-text"
            />

            {error && (
              <p className="font-pixel text-[8px] text-pixel-error mb-3">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-bg-light text-pixel-text border-2 border-black"
              >
                CANCEL
              </button>
              <button
                onClick={handleReveal}
                disabled={isLoading || password.length < MIN_PASSWORD_LENGTH}
                className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-primary text-black border-2 border-black disabled:opacity-50"
              >
                {isLoading ? "..." : "REVEAL"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-pixel-error/20 border-2 border-pixel-error p-2 mb-3">
              <p className="font-pixel text-[7px] text-pixel-error">
                NEVER share this phrase! Anyone with these words can steal your
                funds.
              </p>
            </div>

            <div className="bg-pixel-bg-light border-2 border-black p-3 mb-3">
              <div className="grid grid-cols-3 gap-1">
                {phrase.split(" ").map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 bg-pixel-bg-dark px-1 py-0.5 border border-pixel-border"
                  >
                    <span className="font-pixel text-[6px] text-pixel-text-muted">
                      {i + 1}.
                    </span>
                    <span className="font-pixel-mono text-[8px] text-pixel-text">
                      {word}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-bg-light text-pixel-text border-2 border-black"
              >
                {copied ? "COPIED!" : "COPY"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-primary text-black border-2 border-black"
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
        `Current password must be at least ${MIN_PASSWORD_LENGTH} chars`,
      );
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} chars`);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="bg-pixel-bg-dark border-4 border-black p-4 shadow-[8px_8px_0_0_#000] max-w-sm mx-4">
        <h3 className="font-pixel text-pixel-primary text-xs mb-3">
          CHANGE PASSWORD
        </h3>

        <div className="space-y-2 mb-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full px-2 py-1 font-pixel text-[10px] bg-pixel-bg-light border-2 border-black text-pixel-text"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full px-2 py-1 font-pixel text-[10px] bg-pixel-bg-light border-2 border-black text-pixel-text"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-2 py-1 font-pixel text-[10px] bg-pixel-bg-light border-2 border-black text-pixel-text"
          />
        </div>

        {error && (
          <p className="font-pixel text-[8px] text-pixel-error mb-3">{error}</p>
        )}

        {success && (
          <div className="bg-pixel-success/20 border-2 border-pixel-success p-2 mb-3">
            <p className="font-pixel text-[8px] text-pixel-success">
              Password changed successfully!
            </p>
          </div>
        )}

        {!success && (
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-bg-light text-pixel-text border-2 border-black"
            >
              CANCEL
            </button>
            <button
              onClick={handleChange}
              disabled={isLoading}
              className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-success text-black border-2 border-black disabled:opacity-50"
            >
              {isLoading ? "..." : "CHANGE"}
            </button>
          </div>
        )}
      </div>
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

  // Modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Debug state
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  // NFT store reset
  const resetNFTStore = useNFTStore((s) => s.reset);

  // Clear all testnet data
  const handleClearTestnetData = async () => {
    if (
      !confirm(
        "This will clear ALL testnet data:\n\n• Mining stats & progress\n• Pending share queue\n• NFT cache\n\nYour wallet and NFTs on the blockchain are safe.\n\nContinue?",
      )
    ) {
      return;
    }

    setIsClearing(true);
    setClearMessage(null);

    try {
      // 1. Clear mining manager data
      const manager = getMiningManager();
      await manager.resetAllMiningData();

      // 2. Clear share queue
      await clearShareQueue();

      // 3. Reset NFT store
      resetNFTStore();

      // 4. Clear localStorage items (testnet-specific)
      const keysToRemove = [
        "bitcoinbaby-nft-store",
        "bitcoinbaby-pending-tx-store",
        "bitcoinbaby-mining-state",
      ];
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
      });

      setClearMessage("All testnet data cleared! Refresh the page.");
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
            onClick={() => setShowRecoveryModal(true)}
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
            onClick={() => setShowPasswordModal(true)}
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

      {/* Modals */}
      {showRecoveryModal && (
        <RecoveryPhraseModal onClose={() => setShowRecoveryModal(false)} />
      )}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

export default SettingsSection;
