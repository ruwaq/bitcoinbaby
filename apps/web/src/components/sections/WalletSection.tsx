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
 */

import { useCallback } from "react";
import {
  useWallet,
  useBalance,
  useTokenBalance,
  useVirtualBalance,
} from "@/hooks";
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
  useNetworkStore,
  useTokenBalance as useCharmsTokenBalance,
  useMiningBoost,
  useSendOverlay,
  useWithdrawOverlay,
  useHistoryOverlay,
  useUnlockModal,
  useDeleteWalletModal,
} from "@bitcoinbaby/core";
import {
  generateMnemonicFromEntropy,
  validateMnemonic,
  getDeploymentConfig,
} from "@bitcoinbaby/bitcoin";
import {
  LockedWallet,
  BalancesGrid,
  SecurityInfo,
  WalletActions,
} from "@/components/features/wallet";

// Real App IDs from deployment
const { appId: BABTC_APP_ID } = getDeploymentConfig("testnet4");
const NFT_APP_ID = "genesis_babies_testnet4";

export function WalletSection() {
  const { network, switchNetwork, mainnetAllowed, setMainnetAllowed, config } =
    useNetworkStore();

  // Overlay hooks for opening sheets
  const { open: openSend } = useSendOverlay();
  const { open: openWithdraw } = useWithdrawOverlay();
  const { open: openHistory } = useHistoryOverlay();

  // Modal hooks for centralized dialogs
  const { open: openUnlockModal } = useUnlockModal();
  const { open: openDeleteModal } = useDeleteWalletModal();

  const {
    wallet,
    isLocked,
    hasStoredWallet,
    isLoading: walletLoading,
    error: walletError,
    createWallet,
    importWallet,
    unlock,
    lock,
    deleteWallet,
  } = useWallet();

  const {
    btcBalance,
    balance: addressBalance,
    isLoading: balanceLoading,
    refresh: refreshBalance,
    lastUpdated,
  } = useBalance({
    address: wallet?.address,
    network,
    autoRefresh: !isLocked,
    refreshInterval: 30000,
  });

  // Use token balance hook to keep connection alive
  useTokenBalance({ address: wallet?.address });

  // Virtual balance from Workers API
  const {
    virtualBalance,
    totalMined,
    isLoading: virtualBalanceLoading,
  } = useVirtualBalance({
    address: wallet?.address,
  });

  const {
    formatted: babtcFormatted,
    loading: babtcLoading,
    error: babtcError,
  } = useCharmsTokenBalance(wallet?.address ?? null, BABTC_APP_ID, {
    autoRefresh: !isLocked,
    refreshInterval: 60000,
  });

  const {
    boost: miningBoost,
    nftCount,
    loading: boostLoading,
  } = useMiningBoost(wallet?.address ?? null, NFT_APP_ID, {
    autoRefresh: !isLocked,
    refreshInterval: 120000,
  });

  const handleGenerateMnemonic = useCallback((entropy: Uint8Array): string => {
    const entropySlice = entropy.slice(0, 16);
    return generateMnemonicFromEntropy(entropySlice);
  }, []);

  const handleWalletCreated = useCallback(
    async (mnemonic: string, password: string) => {
      await createWallet(password, 12, mnemonic);
    },
    [createWallet],
  );

  const handleWalletImported = useCallback(
    async (mnemonic: string, password: string) => {
      await importWallet(mnemonic, password);
    },
    [importWallet],
  );

  const handleOpenUnlock = useCallback(() => {
    openUnlockModal(async (password: string) => {
      await unlock(password);
    });
  }, [openUnlockModal, unlock]);

  const handleDelete = useCallback(() => {
    openDeleteModal(async () => {
      await deleteWallet();
    });
  }, [openDeleteModal, deleteWallet]);

  return (
    <div className="p-responsive safe-x bg-pixel-bg-dark min-h-screen-safe">
      <div className="max-w-2xl mx-auto">
        {/* Section Header */}
        <SectionHeader
          title="Wallet"
          description={`Bitcoin ${network === "mainnet" ? "Mainnet" : "Testnet4"} - Taproot (P2TR/BIP86)`}
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
              network={network}
              mainnetAllowed={mainnetAllowed}
              onNetworkChange={switchNetwork}
              onEnableMainnet={() => setMainnetAllowed(true)}
            />
          }
        />

        {/* No wallet - Show onboarding */}
        {!hasStoredWallet && (
          <WalletOnboarding
            onWalletCreated={handleWalletCreated}
            onWalletImported={handleWalletImported}
            generateMnemonic={handleGenerateMnemonic}
            validateMnemonic={validateMnemonic}
          />
        )}

        {/* Wallet exists but locked */}
        {hasStoredWallet && isLocked && (
          <LockedWallet
            isLoading={walletLoading}
            onUnlock={handleOpenUnlock}
            onDelete={handleDelete}
          />
        )}

        {/* Wallet unlocked - Show dashboard */}
        {hasStoredWallet && !isLocked && wallet && (
          <div className={`${pixelCard.primary} p-6`}>
            <div className="space-y-6">
              {/* Address Section */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <label className="font-pixel text-pixel-xs text-pixel-text-muted">
                    YOUR ADDRESS
                  </label>
                  <div className="flex items-center gap-2">
                    <NetworkBadge network={network} />
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
                btcBalance={btcBalance}
                btcUnconfirmed={addressBalance?.unconfirmed}
                btcLoading={balanceLoading}
                onRefreshBtc={refreshBalance}
                virtualBalance={virtualBalance}
                totalMined={totalMined}
                virtualLoading={virtualBalanceLoading}
                babtcFormatted={babtcFormatted}
                babtcLoading={babtcLoading}
                babtcError={babtcError}
                miningBoost={miningBoost}
                nftCount={nftCount}
                boostLoading={boostLoading}
              />

              {lastUpdated && (
                <p className="font-pixel text-pixel-2xs text-pixel-text-muted text-center">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </p>
              )}

              {/* Actions */}
              <WalletActions
                onSend={() => openSend()}
                onWithdraw={openWithdraw}
                onHistory={openHistory}
                onLock={lock}
                onDelete={handleDelete}
                showTestnetFaucet={network === "testnet4"}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {walletError && (
          <InfoBanner variant="error" icon="&#9888;" className="mt-4">
            {walletError}
          </InfoBanner>
        )}

        {/* Security Info */}
        <SecurityInfo />

        {/* Explorer link */}
        {wallet && (
          <div className="mt-4 text-center">
            <a
              href={`${config.explorerUrl}/address/${wallet.address}`}
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
