import { useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalance } from "@/hooks/useBalance";
import { useTokenBalance as useAppTokenBalance } from "@/hooks/useTokenBalance";
import { useVirtualBalance } from "@/hooks/useVirtualBalance";
import {
  useNetworkStore,
  useTokenBalance as useCharmsTokenBalance,
  useMiningBoost,
  useUnlockModal,
  useDeleteWalletModal,
} from "@bitcoinbaby/core";
import { getDeploymentConfig } from "@bitcoinbaby/bitcoin";

/**
 * useWalletDashboard - Unified hook for wallet dashboard
 *
 * Combines:
 * - Wallet state and actions (create/import/lock/unlock)
 * - BTC balance
 * - Virtual $BABY balance
 * - On-chain BABTC token balance
 * - NFT mining boost
 * - Modal actions (unlock/delete)
 *
 * Navigation to send/withdraw/history uses dedicated pages (no overlays).
 *
 * @example
 * const { wallet, balances, actions, overlays, isLoading } = useWalletDashboard();
 */

export interface UseWalletDashboardReturn {
  // Wallet state
  wallet: {
    address: string | null;
    publicKey: string | null;
    isLocked: boolean;
    hasStoredWallet: boolean;
    isLoading: boolean;
    error: string | null;
  };

  // All balances consolidated
  balances: {
    btc: {
      /** Formatted BTC string (e.g., "0.00012345") */
      confirmed: string;
      /** Unconfirmed balance in satoshis */
      unconfirmed: number | undefined;
      loading: boolean;
      lastUpdated: Date | null;
    };
    virtual: {
      balance: bigint;
      totalMined: bigint;
      loading: boolean;
    };
    babtc: {
      formatted: string;
      loading: boolean;
      error: Error | null;
    };
    nftBoost: {
      boost: number;
      nftCount: number;
      loading: boolean;
    };
  };

  // Network
  network: {
    current: "mainnet" | "testnet4";
    mainnetAllowed: boolean;
    explorerUrl: string;
    switch: (network: "mainnet" | "testnet4") => void;
    enableMainnet: () => void;
  };

  // Wallet actions
  actions: {
    createWallet: (
      password: string,
      wordCount?: 12 | 24,
      preGeneratedMnemonic?: string,
    ) => Promise<string>;
    importWallet: (mnemonic: string, password: string) => Promise<void>;
    unlock: (password: string) => Promise<void>;
    lock: () => void;
    deleteWallet: () => Promise<void>;
    refreshBalances: () => Promise<void>;
  };

  // Modal openers (unlock/delete only - navigation uses dedicated pages)
  overlays: {
    openUnlock: () => void;
    openDelete: () => void;
  };
}

export function useWalletDashboard(): UseWalletDashboardReturn {
  const { network, switchNetwork, mainnetAllowed, setMainnetAllowed, config } =
    useNetworkStore();

  // Get deployment config for current network
  const { appId: BABTC_APP_ID } = getDeploymentConfig(network);
  const NFT_APP_ID = `genesis_babies_${network}`;

  // Modal hooks (unlock/delete only)
  const { open: openUnlockModal } = useUnlockModal();
  const { open: openDeleteModal } = useDeleteWalletModal();

  // Core wallet hook
  const {
    wallet: walletInfo,
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

  // BTC balance
  const {
    btcBalance,
    balance: addressBalance,
    isLoading: balanceLoading,
    refresh: refreshBalance,
    lastUpdated,
  } = useBalance({
    address: walletInfo?.address,
    network,
    autoRefresh: !isLocked,
    refreshInterval: 30000,
  });

  // Keep token connection alive
  useAppTokenBalance({ address: walletInfo?.address });

  // Virtual balance from Workers API
  const {
    virtualBalance,
    totalMined,
    isLoading: virtualBalanceLoading,
  } = useVirtualBalance({
    address: walletInfo?.address,
  });

  // Charms BABTC token balance
  const {
    formatted: babtcFormatted,
    loading: babtcLoading,
    error: babtcError,
  } = useCharmsTokenBalance(walletInfo?.address ?? null, BABTC_APP_ID, {
    autoRefresh: !isLocked,
    refreshInterval: 60000,
  });

  // NFT mining boost
  const {
    boost: miningBoost,
    nftCount,
    loading: boostLoading,
  } = useMiningBoost(walletInfo?.address ?? null, NFT_APP_ID, {
    autoRefresh: !isLocked,
    refreshInterval: 120000,
  });

  // Action handlers with overlay integration
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

  const refreshBalances = useCallback(async () => {
    await refreshBalance?.();
  }, [refreshBalance]);

  return {
    wallet: {
      address: walletInfo?.address ?? null,
      publicKey: walletInfo?.publicKey ?? null,
      isLocked,
      hasStoredWallet,
      isLoading: walletLoading,
      error: walletError,
    },

    balances: {
      btc: {
        confirmed: btcBalance,
        unconfirmed: addressBalance?.unconfirmed,
        loading: balanceLoading,
        lastUpdated: lastUpdated ? new Date(lastUpdated) : null,
      },
      virtual: {
        balance: virtualBalance,
        totalMined,
        loading: virtualBalanceLoading,
      },
      babtc: {
        formatted: babtcFormatted,
        loading: babtcLoading,
        error: babtcError,
      },
      nftBoost: {
        boost: miningBoost,
        nftCount,
        loading: boostLoading,
      },
    },

    network: {
      current: network,
      mainnetAllowed,
      explorerUrl: config.explorerUrl,
      switch: switchNetwork,
      enableMainnet: () => setMainnetAllowed(true),
    },

    actions: {
      createWallet,
      importWallet,
      unlock,
      lock,
      deleteWallet,
      refreshBalances,
    },

    overlays: {
      openUnlock: handleOpenUnlock,
      openDelete: handleDelete,
    },
  };
}

export default useWalletDashboard;
