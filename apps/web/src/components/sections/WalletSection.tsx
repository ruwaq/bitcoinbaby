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
import { useWalletDashboard } from "@/hooks/features";
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
import { pixelCard } from "@bitcoinbaby/ui";
import {
  generateMnemonicFromEntropy,
  validateMnemonic,
} from "@bitcoinbaby/bitcoin";
import {
  LockedWallet,
  BalancesGrid,
  SecurityInfo,
  WalletActions,
} from "@/components/features/wallet";

export function WalletSection() {
  // Single composite hook replaces 10+ individual hooks
  const { wallet, balances, network, actions, overlays } = useWalletDashboard();

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
          icon="&#128176;"
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

        {/* Wallet unlocked - Show dashboard */}
        {wallet.hasStoredWallet && !wallet.isLocked && wallet.address && (
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

              {balances.btc.lastUpdated && (
                <p className="font-pixel text-pixel-2xs text-pixel-text-muted text-center">
                  Last updated: {balances.btc.lastUpdated.toLocaleTimeString()}
                </p>
              )}

              {/* Actions */}
              <WalletActions
                onSend={() => overlays.openSend()}
                onWithdraw={overlays.openWithdraw}
                onHistory={overlays.openHistory}
                onLock={actions.lock}
                onDelete={overlays.openDelete}
                showTestnetFaucet={network.current === "testnet4"}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {wallet.error && (
          <InfoBanner variant="error" icon="&#9888;" className="mt-4">
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
