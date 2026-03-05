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

import Link from "next/link";
import {
  useSettingsStore,
  useNetworkStore,
  useWalletStore,
  useBabyStore,
  type MiningDifficulty,
  type MinerTypePreference,
  type AutoLockTimeout,
  type ExplorerPreference,
  AUTO_LOCK_LABELS,
  useRecoveryPhraseModal,
  useChangePasswordModal,
} from "@bitcoinbaby/core";
import { NetworkSwitcher, LevelSprite } from "@bitcoinbaby/ui";
import {
  SettingsCard,
  Toggle,
  Select,
  TextInput,
  ActionRow,
  DangerZone,
} from "./components";

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

  // Baby store
  const baby = useBabyStore((s) => s.baby);

  // Overlay modal hooks
  const { open: openRecoveryModal } = useRecoveryPhraseModal();
  const { open: openPasswordModal } = useChangePasswordModal();

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
          <SettingsCard title="MINING">
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
          </SettingsCard>

          {/* Network Settings */}
          <SettingsCard title="NETWORK">
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
          </SettingsCard>

          {/* Display Settings */}
          <SettingsCard title="DISPLAY">
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
          </SettingsCard>

          {/* My Baby Section */}
          {baby && (
            <SettingsCard title="MY BABY">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 flex-shrink-0">
                  <LevelSprite level={baby.level} state="idle" size={64} />
                </div>
                <div className="flex-1">
                  <p className="font-pixel text-sm text-pixel-primary">
                    {baby.name}
                  </p>
                  <p className="font-pixel text-[10px] text-pixel-text-muted mt-1">
                    Level {baby.level} &bull; {baby.experience} XP
                  </p>
                  <p className="font-pixel text-[8px] text-pixel-text-muted mt-1 uppercase">
                    State: {baby.state}
                  </p>
                </div>
                <Link
                  href="/?tab=nfts"
                  className="px-3 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-primary hover:text-black transition-colors"
                >
                  VIEW
                </Link>
              </div>
            </SettingsCard>
          )}

          {/* Security Settings */}
          <SettingsCard title="SECURITY">
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

            <ActionRow
              label="RECOVERY PHRASE"
              description="View your 12-word backup phrase"
              buttonLabel="SHOW"
              onClick={() => openRecoveryModal()}
            />

            <ActionRow
              label="CHANGE PASSWORD"
              description="Update your wallet encryption password"
              buttonLabel="CHANGE"
              onClick={openPasswordModal}
            />
          </SettingsCard>

          {/* About Section */}
          <SettingsCard title="ABOUT">
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
          </SettingsCard>

          {/* Danger Zone */}
          <DangerZone
            walletAddress={walletAddress}
            onResetSettings={resetAllSettings}
          />
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
