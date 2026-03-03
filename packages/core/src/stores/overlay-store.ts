/**
 * Overlay Store
 *
 * Centralized state management for overlay components (sheets, modals, drawers).
 * Allows opening/closing overlays from anywhere in the app without navigation.
 *
 * This keeps background processes (mining, sync) running while overlays are open.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sheet overlays (slide in from side)
 */
export type SheetType =
  | "withdraw"
  | "send"
  | "receive"
  | "settings"
  | "history"
  | "nft-detail"
  | "mint-confirm";

/**
 * Modal overlays (centered dialogs)
 */
export type ModalType =
  | "unlock-wallet"
  | "confirm-reset"
  | "recovery-phrase"
  | "change-password"
  | "confirm-action"
  | "delete-wallet";

/**
 * Available overlay types in the application
 */
export type OverlayType = SheetType | ModalType | null;

/**
 * Overlay display mode
 */
export type OverlayMode = "sheet" | "modal";

/**
 * Get the display mode for an overlay type
 */
export function getOverlayMode(type: OverlayType): OverlayMode {
  if (type === null) return "sheet";
  const modalTypes: ModalType[] = [
    "unlock-wallet",
    "confirm-reset",
    "recovery-phrase",
    "change-password",
    "confirm-action",
    "delete-wallet",
  ];
  return modalTypes.includes(type as ModalType) ? "modal" : "sheet";
}

/**
 * Additional data that can be passed to overlays
 */
export interface OverlayData {
  /** For NFT detail view */
  nftId?: number;
  /** For pre-filled send form */
  recipientAddress?: string;
  /** For pre-filled amount */
  amount?: string;

  // Modal-specific data

  /** Title for confirmation modals */
  title?: string;
  /** Message/description for confirmation modals */
  message?: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Callback when confirmed */
  onConfirm?: () => void | Promise<void>;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** If action is destructive (shows in red) */
  destructive?: boolean;
  /** Password submission callback */
  onPasswordSubmit?: (password: string) => void | Promise<void>;
  /** Recovery phrase to display */
  recoveryPhrase?: string;

  /** Generic metadata */
  [key: string]: unknown;
}

interface OverlayState {
  /** Currently active overlay (null if none) */
  activeOverlay: OverlayType;

  /** Data passed to the active overlay */
  overlayData: OverlayData | null;

  /** History stack for back navigation */
  overlayHistory: Array<{ type: OverlayType; data: OverlayData | null }>;

  /** Open an overlay with optional data */
  openOverlay: (type: OverlayType, data?: OverlayData) => void;

  /** Close the current overlay */
  closeOverlay: () => void;

  /** Close all overlays */
  closeAllOverlays: () => void;

  /** Go back to previous overlay (if any) */
  goBack: () => void;

  /** Check if a specific overlay is open */
  isOpen: (type: OverlayType) => boolean;
}

// =============================================================================
// STORE
// =============================================================================

export const useOverlayStore = create<OverlayState>()(
  devtools(
    (set, get) => ({
      activeOverlay: null,
      overlayData: null,
      overlayHistory: [],

      openOverlay: (type, data) => {
        const current = get().activeOverlay;
        const currentData = get().overlayData;

        set((state) => ({
          activeOverlay: type,
          overlayData: data ?? null,
          // Push current to history if we're switching overlays
          overlayHistory:
            current !== null
              ? [...state.overlayHistory, { type: current, data: currentData }]
              : state.overlayHistory,
        }));
      },

      closeOverlay: () => {
        set({
          activeOverlay: null,
          overlayData: null,
        });
      },

      closeAllOverlays: () => {
        set({
          activeOverlay: null,
          overlayData: null,
          overlayHistory: [],
        });
      },

      goBack: () => {
        const history = get().overlayHistory;
        if (history.length === 0) {
          set({ activeOverlay: null, overlayData: null });
          return;
        }

        const previous = history[history.length - 1];
        set({
          activeOverlay: previous.type,
          overlayData: previous.data,
          overlayHistory: history.slice(0, -1),
        });
      },

      isOpen: (type) => get().activeOverlay === type,
    }),
    { name: "overlay-store" },
  ),
);

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Hook to open the withdraw overlay
 */
export function useWithdrawOverlay() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: () => openOverlay("withdraw"),
    close: closeOverlay,
    isOpen: isOpen("withdraw"),
  };
}

/**
 * Hook to open the send overlay
 */
export function useSendOverlay() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: (data?: { recipientAddress?: string; amount?: string }) =>
      openOverlay("send", data),
    close: closeOverlay,
    isOpen: isOpen("send"),
  };
}

/**
 * Hook to open the receive overlay
 */
export function useReceiveOverlay() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: () => openOverlay("receive"),
    close: closeOverlay,
    isOpen: isOpen("receive"),
  };
}

/**
 * Hook to open the settings overlay
 */
export function useSettingsOverlay() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: () => openOverlay("settings"),
    close: closeOverlay,
    isOpen: isOpen("settings"),
  };
}

/**
 * Hook to open the history overlay
 */
export function useHistoryOverlay() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: () => openOverlay("history"),
    close: closeOverlay,
    isOpen: isOpen("history"),
  };
}

// =============================================================================
// MODAL HOOKS
// =============================================================================

/**
 * Hook to open the unlock wallet modal
 */
export function useUnlockModal() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: (onPasswordSubmit: (password: string) => void | Promise<void>) =>
      openOverlay("unlock-wallet", { onPasswordSubmit }),
    close: closeOverlay,
    isOpen: isOpen("unlock-wallet"),
  };
}

/**
 * Hook to open a generic confirmation modal
 */
export function useConfirmModal() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      onConfirm: () => void | Promise<void>;
      onCancel?: () => void;
    }) => openOverlay("confirm-action", options),
    close: closeOverlay,
    isOpen: isOpen("confirm-action"),
  };
}

/**
 * Hook to open the confirm reset modal
 */
export function useResetModal() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: (onConfirm: () => void | Promise<void>) =>
      openOverlay("confirm-reset", {
        title: "Reset Baby?",
        message:
          "This will delete your current baby and all progress. This action cannot be undone.",
        confirmText: "DELETE",
        destructive: true,
        onConfirm,
      }),
    close: closeOverlay,
    isOpen: isOpen("confirm-reset"),
  };
}

/**
 * Hook to open the recovery phrase modal
 */
export function useRecoveryPhraseModal() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: (recoveryPhrase?: string) =>
      openOverlay("recovery-phrase", recoveryPhrase ? { recoveryPhrase } : {}),
    close: closeOverlay,
    isOpen: isOpen("recovery-phrase"),
  };
}

/**
 * Hook to open the change password modal
 */
export function useChangePasswordModal() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: () => openOverlay("change-password"),
    close: closeOverlay,
    isOpen: isOpen("change-password"),
  };
}

/**
 * Hook to open the delete wallet modal
 */
export function useDeleteWalletModal() {
  const { openOverlay, closeOverlay, isOpen } = useOverlayStore();

  return {
    open: (onConfirm: () => void | Promise<void>) =>
      openOverlay("delete-wallet", {
        title: "Delete Wallet?",
        message:
          "This will permanently delete your wallet. Make sure you have backed up your recovery phrase!",
        confirmText: "DELETE WALLET",
        destructive: true,
        onConfirm,
      }),
    close: closeOverlay,
    isOpen: isOpen("delete-wallet"),
  };
}
