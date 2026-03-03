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
  Button,
  CopyButton,
  BalanceCard,
} from "@bitcoinbaby/ui";
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

// Real App IDs from deployment
const { appId: BABTC_APP_ID } = getDeploymentConfig("testnet4");
const NFT_APP_ID = "genesis_babies_testnet4"; // Genesis Babies NFT collection

export function WalletSection() {
  const { network, switchNetwork, mainnetAllowed, setMainnetAllowed, config } =
    useNetworkStore();

  // Overlay hooks for opening sheets without navigation
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

  // Open unlock modal - the modal handles the unlock flow
  const handleOpenUnlock = useCallback(() => {
    openUnlockModal(async (password: string) => {
      await unlock(password);
    });
  }, [openUnlockModal, unlock]);

  // Open delete confirmation modal
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
          <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 shadow-[8px_8px_0_0_#000]">
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
                <span className="font-pixel text-3xl text-pixel-error">🔒</span>
              </div>
              <h2 className="font-pixel text-lg text-pixel-text mb-2">
                WALLET LOCKED
              </h2>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-6">
                Enter your password to access your wallet
              </p>
              <Button
                onClick={handleOpenUnlock}
                disabled={walletLoading}
                variant="success"
                size="lg"
              >
                UNLOCK WALLET
              </Button>
            </div>

            <div className="border-t-2 border-pixel-border pt-6 mt-6">
              <p className="font-pixel text-pixel-xs text-pixel-text-muted text-center mb-4">
                Forgot password? You can restore using your recovery phrase.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleDelete} variant="destructive" size="sm">
                  DELETE & RESTORE
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Wallet unlocked - Show dashboard */}
        {hasStoredWallet && !isLocked && wallet && (
          <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 shadow-[8px_8px_0_0_#000]">
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
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* BTC Balance */}
                <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-border">
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
                        BTC BALANCE
                      </label>
                      <HelpTooltip
                        content="Your Bitcoin balance on the blockchain. Used for transaction fees and sending."
                        title="Bitcoin"
                        size="sm"
                      />
                    </div>
                    <button
                      onClick={refreshBalance}
                      disabled={balanceLoading}
                      className="font-pixel text-pixel-2xs text-pixel-text-muted hover:text-pixel-primary disabled:opacity-50 p-1"
                    >
                      {balanceLoading ? "..." : "↻"}
                    </button>
                  </div>
                  <span className="font-pixel text-pixel-base text-pixel-text">
                    {btcBalance}
                  </span>
                  {addressBalance && addressBalance.unconfirmed !== 0 && (
                    <p className="font-pixel text-pixel-2xs text-pixel-secondary mt-1 truncate">
                      +{(addressBalance.unconfirmed / 100_000_000).toFixed(8)}{" "}
                      pending
                    </p>
                  )}
                </div>

                {/* $BABY Virtual Balance (Primary) */}
                <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-success">
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
                        $BABY BALANCE
                      </label>
                      <HelpTooltip
                        content="Tokens earned from mining. You can withdraw these to your Bitcoin wallet as Charms tokens."
                        title="Mining Rewards"
                        size="sm"
                      />
                    </div>
                    {virtualBalanceLoading && (
                      <span className="font-pixel text-pixel-2xs text-pixel-text-muted animate-pulse">
                        ...
                      </span>
                    )}
                  </div>
                  <span className="font-pixel text-pixel-base text-pixel-success">
                    {virtualBalanceLoading
                      ? "---"
                      : virtualBalance.toLocaleString()}
                  </span>
                  <p className="font-pixel text-pixel-2xs text-pixel-text-muted mt-1 truncate">
                    Total mined: {totalMined.toLocaleString()}
                  </p>
                </div>

                {/* BABTC Token Balance */}
                <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-border">
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
                        BABTC (CHARMS)
                      </label>
                      <HelpTooltip
                        content="BABTC tokens stored on Bitcoin as Charms. These are $BABY tokens that have been withdrawn to the blockchain."
                        title="On-Chain Tokens"
                        size="sm"
                      />
                    </div>
                    {babtcLoading && (
                      <span className="font-pixel text-pixel-2xs text-pixel-text-muted animate-pulse">
                        ...
                      </span>
                    )}
                  </div>
                  {babtcError ? (
                    <span className="font-pixel text-pixel-sm text-pixel-error">
                      Error
                    </span>
                  ) : (
                    <span className="font-pixel text-pixel-base text-pixel-secondary">
                      {babtcLoading ? "---" : babtcFormatted}
                    </span>
                  )}
                </div>

                {/* Mining Boost */}
                <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-border">
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
                        MINING BOOST
                      </label>
                      <HelpTooltip
                        content="Extra mining rewards from your Genesis Babies NFTs. Higher rarity NFTs provide bigger boosts."
                        title="NFT Boost"
                        size="sm"
                      />
                    </div>
                    {boostLoading && (
                      <span className="font-pixel text-pixel-2xs text-pixel-text-muted animate-pulse">
                        ...
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`font-pixel text-pixel-base ${
                        miningBoost > 0
                          ? "text-pixel-success"
                          : "text-pixel-text"
                      }`}
                    >
                      {boostLoading ? "---" : `+${miningBoost}%`}
                    </span>
                    {nftCount > 0 && (
                      <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
                        ({nftCount} NFT{nftCount !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                  {miningBoost === 0 && !boostLoading && (
                    <p className="font-pixel text-pixel-2xs text-pixel-text-muted mt-1 truncate">
                      Get Genesis Babies for boost
                    </p>
                  )}
                </div>
              </div>

              {lastUpdated && (
                <p className="font-pixel text-pixel-2xs text-pixel-text-muted text-center">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </p>
              )}

              {/* Primary Actions */}
              <div className="flex gap-2 sm:gap-3 pt-4 border-t-2 border-pixel-border">
                <Button
                  onClick={() => openSend()}
                  variant="default"
                  className="flex-1"
                >
                  SEND
                </Button>
                <Button
                  onClick={openWithdraw}
                  variant="success"
                  className="flex-1"
                >
                  WITHDRAW
                </Button>
                <Button
                  onClick={openHistory}
                  variant="outline"
                  className="flex-1"
                >
                  HISTORY
                </Button>
              </div>

              {/* Get Testnet BTC */}
              {network === "testnet4" && (
                <a
                  href="https://mempool.space/testnet4/faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 min-h-[44px] font-pixel text-pixel-xs text-center bg-pixel-secondary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all active:scale-95"
                >
                  GET TESTNET BTC
                </a>
              )}

              {/* Secondary Actions */}
              <div className="flex gap-2 sm:gap-3 pt-3">
                <Button onClick={lock} variant="ghost" className="flex-1">
                  LOCK
                </Button>
                <Button onClick={handleDelete} variant="destructive">
                  DELETE
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {walletError && (
          <InfoBanner variant="error" icon="&#9888;" className="mt-4">
            {walletError}
          </InfoBanner>
        )}

        {/* Info Section */}
        <div className="mt-6 sm:mt-8 p-4 bg-pixel-bg-light border-4 border-dashed border-pixel-border">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-pixel text-pixel-xs text-pixel-secondary">
              SECURITY INFO
            </h3>
            <HelpTooltip
              content="Your wallet uses industry-standard encryption. Private keys never leave your device and are protected with a password."
              title="Security Details"
              description="We follow OWASP 2024 security guidelines for key derivation and encryption."
              size="sm"
            />
          </div>
          <ul className="space-y-2 font-pixel-body text-body-sm text-pixel-text-muted">
            <li>
              <span className="text-pixel-success">●</span> Wallet encrypted
              with AES-256-GCM
            </li>
            <li>
              <span className="text-pixel-success">●</span> 600,000 PBKDF2
              iterations (OWASP 2024)
            </li>
            <li>
              <span className="text-pixel-success">●</span> Stored locally in
              IndexedDB
            </li>
            <li>
              <span className="text-pixel-success">●</span> Never sent to any
              server
            </li>
            <li>
              <span className="text-pixel-primary">●</span> Recovery phrase is
              your only backup!
            </li>
          </ul>
        </div>

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
