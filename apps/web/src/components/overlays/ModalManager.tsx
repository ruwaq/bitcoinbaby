/**
 * ModalManager
 *
 * Centralized manager for modal dialogs only.
 * Navigation (send, withdraw, history, settings) uses dedicated pages.
 *
 * Modals handled:
 * - Unlock wallet
 * - Confirm action (delete, reset)
 * - Recovery phrase display
 * - Change password
 */

"use client";

import { useEffect } from "react";
import { ModalDialog } from "@bitcoinbaby/ui";
import { useOverlayStore } from "@bitcoinbaby/core";

// Modal imports
import {
  UnlockWalletModal,
  ConfirmActionModal,
  RecoveryPhraseModal,
  ChangePasswordModal,
} from "./modals";

/**
 * ModalManager Component
 *
 * Place this in your root layout or main app component.
 * It listens to the overlay store and renders the appropriate modal.
 */
export function ModalManager() {
  const { activeOverlay, closeOverlay } = useOverlayStore();

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeOverlay) {
        closeOverlay();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeOverlay, closeOverlay]);

  return (
    <>
      {/* Unlock Wallet Modal */}
      <ModalDialog
        open={activeOverlay === "unlock-wallet"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <UnlockWalletModal />
      </ModalDialog>

      {/* Confirm Action Modal (generic + reset + delete) */}
      <ModalDialog
        open={
          activeOverlay === "confirm-action" ||
          activeOverlay === "confirm-reset" ||
          activeOverlay === "delete-wallet"
        }
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <ConfirmActionModal />
      </ModalDialog>

      {/* Recovery Phrase Modal */}
      <ModalDialog
        open={activeOverlay === "recovery-phrase"}
        onOpenChange={(open) => !open && closeOverlay()}
        preventClose
      >
        <RecoveryPhraseModal />
      </ModalDialog>

      {/* Change Password Modal */}
      <ModalDialog
        open={activeOverlay === "change-password"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <ChangePasswordModal />
      </ModalDialog>
    </>
  );
}

export default ModalManager;
