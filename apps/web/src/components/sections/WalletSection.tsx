"use client";

/**
 * WalletSection - Wallet management
 *
 * Complete wallet interface with:
 * - Onboarding (create/import)
 * - Lock/unlock
 * - Balance display
 * - Send/receive
 * - Network switching
 *
 * Uses consolidated useWalletDashboard hook for all state management.
 */

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useWalletDashboard } from "@/hooks/features";
import { FaucetCard } from "@/components/features/faucet/FaucetCard";
import { getPhaseConfig } from "@bitcoinbaby/shared";
import {
  NetworkSwitcher,
  NetworkBadge,
  WalletOnboarding,
  QRCode,
  HelpTooltip,
  SectionHeader,
  InfoBanner,
  CopyButton,
} from "@bitcoinbaby/ui";
import { pixelCard, pixelBorders } from "@bitcoinbaby/ui";
import {
  generateMnemonicFromEntropy,
  validateMnemonic,
} from "@bitcoinbaby/bitcoin";
import {
  LockedWallet,
  BalancesGrid,
  SecurityInfo,
  WalletActions,
  SendView,
  HistoryView,
} from "@/components/features/wallet";

// Dynamic import for ClaimSection to prevent SSR issues
const ClaimSection = dynamic(
  () =>
    import("@/components/claim/ClaimSection").then((mod) => mod.ClaimSection),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse p-8">
        <div className="h-32 bg-pixel-bg-medium rounded mb-4" />
        <div className="h-48 bg-pixel-bg-medium rounded" />
      </div>
    ),
  },
);

export function WalletSection() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Single composite hook replaces 10+ individual hooks
  const { wallet, balances, network, actions, overlays } = useWalletDashboard();

  // Get active view from URL search params
  const activeView = (searchParams.get("view") || "dashboard") as
    | "dashboard"
    | "send"
    | "claim"
    | "history";

  const handleViewChange = useCallback(
    (view: "dashboard" | "send" | "claim" | "history") => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "you");
      if (view === "dashboard") {
        params.delete("view");
      } else {
        params.set("view", view);
      }
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleGenerateMnemonic = useCallback((entropy: Uint8Array): string => {
    const entropySlice = entropy.slice(0, 16);
    return generateMnemonicFromEntropy(entropySlice);
  }, []);

  const handleWalletCreated = useCallback(
    async (mnemonic: string, password: string) => {
      await actions.createWallet(password, 12, mnemonic);
    },
    [actions],
  );

  const handleWalletImported = useCallback(
    async (mnemonic: string, password: string) => {
      await actions.importWallet(mnemonic, password);
    },
    [actions],
  );

  return (
    <div className="p-responsive safe-x bg-pixel-bg-dark min-h-screen-safe">
      <div className="max-w-2xl mx-auto">
        {/* Section Header */}
        <SectionHeader
          title="Wallet"
          description={`Bitcoin ${network.current === "mainnet" ? "Mainnet" : "Testnet4"} - Taproot (P2TR/BIP86)`}
          icon="💰"
          size="lg"
          helpTooltip={
            <HelpTooltip
              content="Your Bitcoin wallet for managing BTC and $BABY tokens. All funds are stored locally and encrypted."
              title="Bitcoin Wallet"
              description="We never have access to your private keys. Make sure to save your recovery phrase!"
              size="md"
            />
          }
          action={
            <NetworkSwitcher
              network={network.current}
              mainnetAllowed={network.mainnetAllowed}
              onNetworkChange={network.switch}
              onEnableMainnet={network.enableMainnet}
            />
          }
        />

        {/* No wallet - Show onboarding */}
        {!wallet.hasStoredWallet && (
          <WalletOnboarding
            onWalletCreated={handleWalletCreated}
            onWalletImported={handleWalletImported}
            generateMnemonic={handleGenerateMnemonic}
            validateMnemonic={validateMnemonic}
          />
        )}

        {/* Wallet exists but locked */}
        {wallet.hasStoredWallet && wallet.isLocked && (
          <LockedWallet
            isLoading={wallet.isLoading}
            onUnlock={overlays.openUnlock}
            onDelete={overlays.openDelete}
          />
        )}

        {/* Wallet unlocked - Show dashboard or dynamic views */}
        {wallet.hasStoredWallet && !wallet.isLocked && wallet.address && (
          <>
            {activeView === "dashboard" && (
              <div className={`${pixelCard.primary} p-6`}>
                <div className="space-y-6">
                  {/* Address Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <label className="font-pixel text-pixel-xs text-pixel-text-muted">
                        YOUR ADDRESS
                      </label>
                      <div className="flex items-center gap-2">
                        <NetworkBadge network={network.current} />
                        <span className="px-2 py-1 font-pixel text-pixel-2xs bg-pixel-bg-light text-pixel-text-muted border border-pixel-border">
                          TAPROOT
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 bg-pixel-bg-dark p-3 border-2 border-pixel-border">
                      <span className="font-pixel-mono text-body-xs text-pixel-text flex-1 truncate-address">
                        {wallet.address}
                      </span>
                      <CopyButton text={wallet.address} label="COPY" />
                    </div>
                  </div>

                  {/* QR Code */}
                  <QRCode data={wallet.address} />

                  {/* Balances */}
                  <BalancesGrid
                    btcBalance={balances.btc.confirmed}
                    btcUnconfirmed={balances.btc.unconfirmed}
                    btcLoading={balances.btc.loading}
                    onRefreshBtc={actions.refreshBalances}
                    virtualBalance={balances.virtual.balance}
                    totalMined={balances.virtual.totalMined}
                    virtualLoading={balances.virtual.loading}
                    babtcFormatted={balances.babtc.formatted}
                    babtcLoading={balances.babtc.loading}
                    babtcError={balances.babtc.error}
                    miningBoost={balances.nftBoost.boost}
                    nftCount={balances.nftBoost.nftCount}
                    boostLoading={balances.nftBoost.loading}
                  />

                  {/* Faucet (Phase 1 — SPARK for NFT evolution) */}
                  {getPhaseConfig().features.babtcFaucet && (
                    <FaucetCard address={wallet.address} />
                  )}

                  {balances.btc.lastUpdated && (
                    <p className="font-pixel text-pixel-2xs text-pixel-text-muted text-center">
                      Last updated:{" "}
                      {balances.btc.lastUpdated.toLocaleTimeString()}
                    </p>
                  )}

                  {/* Actions */}
                  <WalletActions
                    onLock={actions.lock}
                    onDelete={overlays.openDelete}
                    showTestnetFaucet={network.current === "testnet4"}
                    onViewChange={handleViewChange}
                  />
                </div>
              </div>
            )}

            {activeView === "send" && (
              <div className={`${pixelCard.primary} p-6`}>
                <SendView onBack={() => handleViewChange("dashboard")} />
              </div>
            )}

            {activeView === "claim" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-pixel-border">
                  <div>
                    <h2 className="font-pixel text-md text-pixel-primary">
                      CLAIM TOKENS
                    </h2>
                    <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
                      Convert mining work to $SPARK
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewChange("dashboard")}
                    className="font-pixel text-pixel-2xs text-pixel-text-muted hover:text-pixel-primary transition-colors border-2 border-pixel-border px-2 py-1 bg-pixel-bg-medium"
                  >
                    ← BACK
                  </button>
                </div>

                {/* Claim Section */}
                <ClaimSection />

                {/* Help Text */}
                <div
                  className={`p-4 bg-pixel-bg-medium ${pixelBorders.medium}`}
                >
                  <h3 className="font-pixel text-pixel-2xs text-pixel-primary mb-2">
                    HOW CLAIMING WORKS
                  </h3>
                  <ul className="space-y-1.5 text-xs text-pixel-text-muted">
                    <li className="flex items-start gap-2">
                      <span className="text-pixel-success">1.</span>
                      <span>
                        Mine to earn virtual work points (free, unlimited)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pixel-success">2.</span>
                      <span>Prepare your claim (server signs your work)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pixel-success">3.</span>
                      <span>
                        Create and broadcast a Bitcoin transaction (~1000 sats)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pixel-success">4.</span>
                      <span>
                        After confirmation, your $SPARK tokens are minted on
                        Bitcoin
                      </span>
                    </li>
                  </ul>

                  <div className="mt-4 p-3 bg-pixel-bg-dark/50 rounded">
                    <p className="text-xs text-pixel-secondary font-pixel mb-1">
                      WHY PAY FEES?
                    </p>
                    <p className="text-xs text-gray-400">
                      Unlike games where the team pays transaction fees,
                      BitcoinBaby lets you claim when YOU want at YOUR preferred
                      fee rate. This makes the game sustainable and gives you
                      full control over your tokens.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeView === "history" && (
              <div className={`${pixelCard.primary} p-6`}>
                <HistoryView onBack={() => handleViewChange("dashboard")} />
              </div>
            )}
          </>
        )}

        {/* Error display */}
        {wallet.error && (
          <InfoBanner variant="error" icon="⚠️" className="mt-4">
            {wallet.error}
          </InfoBanner>
        )}

        {/* Security Info */}
        <SecurityInfo />

        {/* Explorer link */}
        {wallet.address && (
          <div className="mt-4 text-center">
            <a
              href={`${network.explorerUrl}/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-pixel-xs text-pixel-secondary hover:text-pixel-primary underline py-2 inline-block"
            >
              View on Explorer
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default WalletSection;
