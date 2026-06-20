"use client";

/**
 * YouSection — Wallet, Collection & Settings
 *
 * Fase 4 Redesign: The personal hub.
 * Sub-tabs:
 *   [Wallet] [Collection] [Settings]
 *
 * Composes existing components:
 * - Wallet dashboard (balances, send, receive, history)
 * - NFT Collection view
 * - AI Provider Settings + Network + Security
 */

import { useState, useCallback } from "react";
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
import { NFTCollectionView } from "@/components/features/nft";
import { useNFTsSection } from "../sections/nfts";
import { AIProviderSettings } from "@/components/settings/AIProviderSettings";

// Dynamic import for ClaimSection
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

type YouTab = "wallet" | "collection" | "settings";

const YOU_TABS: { id: YouTab; label: string; icon: string }[] = [
  { id: "wallet", label: "WALLET", icon: "💰" },
  { id: "collection", label: "SPARKS", icon: "👶" },
  { id: "settings", label: "CONFIG", icon: "⚙️" },
];

export function YouSection() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<YouTab>("wallet");
  const { wallet, balances, network, actions, overlays } = useWalletDashboard();

  const {
    collection,
    selectedNFT,
    setSelectedNFT,
    evolvingIds,
    listingIds,
    handleSelectNFT,
    handleEvolve,
    handleListNFT,
    minting,
    pendingTransactions,
    refreshTransactions,
    clearCompletedTransactions,
  } = useNFTsSection();

  // Get active wallet view from URL search params
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
          title="YOU"
          description="Your wallet, sparks, and settings"
          icon="👤"
          size="lg"
          helpTooltip={
            <HelpTooltip
              content="Manage your Bitcoin wallet, view your spark collection, and configure your AI provider and app settings."
              title="Your Profile"
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

        {/* Sub-tab Navigation */}
        <div className="flex gap-2 mb-6 border-b-2 border-pixel-border pb-2">
          {YOU_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-pixel text-[10px] uppercase border-2 transition-all ${
                activeTab === tab.id
                  ? "bg-pixel-primary text-black border-black shadow-[2px_2px_0_0_#000] translate-x-[1px] translate-y-[1px]"
                  : "bg-pixel-bg-medium text-pixel-text-muted border-pixel-border hover:text-pixel-primary"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============================================ */}
        {/* WALLET TAB */}
        {/* ============================================ */}
        {activeTab === "wallet" && (
          <>
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

            {/* Wallet unlocked */}
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

                      {/* Faucet */}
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
                    <ClaimSection />
                    <div className={`p-4 bg-pixel-bg-medium ${pixelBorders.medium}`}>
                      <h3 className="font-pixel text-pixel-2xs text-pixel-primary mb-2">
                        HOW CLAIMING WORKS
                      </h3>
                      <ul className="space-y-1.5 text-xs text-pixel-text-muted">
                        <li className="flex items-start gap-2">
                          <span className="text-pixel-success">1.</span>
                          <span>Mine to earn virtual work points</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-pixel-success">2.</span>
                          <span>Prepare your claim (server signs your work)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-pixel-success">3.</span>
                          <span>Broadcast a Bitcoin transaction (~1000 sats)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-pixel-success">4.</span>
                          <span>Your $SPARK tokens are minted on Bitcoin</span>
                        </li>
                      </ul>
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
          </>
        )}

        {/* ============================================ */}
        {/* COLLECTION TAB */}
        {/* ============================================ */}
        {activeTab === "collection" && (
          <NFTCollectionView
            nfts={collection.nfts}
            isLoading={collection.isLoading}
            error={collection.error}
            selectedNFT={selectedNFT}
            onSelectNFT={handleSelectNFT}
            onClearSelection={() => setSelectedNFT(null)}
            evolvingIds={evolvingIds}
            listingIds={listingIds}
            tokenBalance={balances.virtual.balance}
            onEvolve={handleEvolve}
            onList={handleListNFT}
            onMintClick={() => {}}
            onRetry={collection.refresh}
            formattedPrice={minting.price.formatted}
            pendingTransactions={pendingTransactions}
            onRefreshTransactions={refreshTransactions}
            onClearCompletedTransactions={clearCompletedTransactions}
          />
        )}

        {/* ============================================ */}
        {/* SETTINGS TAB */}
        {/* ============================================ */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* AI Provider Settings */}
            <AIProviderSettings />

            {/* Network Settings */}
            <div className={`${pixelCard.primary} p-6`}>
              <h3 className="font-pixel text-sm text-pixel-primary mb-4">
                NETWORK
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-pixel-body text-xs text-pixel-text">
                    Current Network
                  </span>
                  <NetworkBadge network={network.current} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-pixel-body text-xs text-pixel-text">
                    Mainnet Access
                  </span>
                  <span className="font-pixel text-[10px] text-pixel-text-muted">
                    {network.mainnetAllowed ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className={`${pixelCard.primary} p-6`}>
              <h3 className="font-pixel text-sm text-pixel-primary mb-4">
                LINKS
              </h3>
              <div className="space-y-2">
                <a
                  href="/technology"
                  className="block font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-primary transition-colors py-2 border-b border-pixel-border"
                >
                  ⚙️ AI & Technology
                </a>
                <a
                  href="/help"
                  className="block font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-primary transition-colors py-2"
                >
                  ❓ Help & Guide
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default YouSection;