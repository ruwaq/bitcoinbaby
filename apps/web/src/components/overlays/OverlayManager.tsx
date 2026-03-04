/**
 * OverlayManager
 *
 * Centralized manager for all overlay components (sheets, modals).
 * Renders the appropriate overlay based on the overlay store state.
 *
 * Benefits:
 * - Background processes (mining, sync) continue running
 * - No page navigation = no state loss
 * - Consistent UX across the app
 * - Deep linking support via URL params (optional)
 * - Unified modal/sheet system
 */

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet, SheetContent, ModalDialog } from "@bitcoinbaby/ui";
import { useOverlayStore, type OverlayType } from "@bitcoinbaby/core";

// Sheet imports
import { WithdrawSheet } from "./WithdrawSheet";
import { SendSheet } from "./SendSheet";
import { ReceiveSheet } from "./ReceiveSheet";
import { SettingsSheet } from "./SettingsSheet";
import { HistorySheet } from "./HistorySheet";

// Modal imports
import {
  UnlockWalletModal,
  ConfirmActionModal,
  RecoveryPhraseModal,
  ChangePasswordModal,
} from "./modals";

/**
 * OverlayManager Component
 *
 * Place this in your root layout or main app component.
 * It listens to the overlay store and renders the appropriate sheet.
 */
export function OverlayManager() {
  const searchParams = useSearchParams();

  const { activeOverlay, overlayData, closeOverlay, openOverlay } =
    useOverlayStore();

  // Sync URL params with overlay state (for deep linking)
  useEffect(() => {
    const overlayParam = searchParams.get("overlay");
    if (overlayParam && !activeOverlay) {
      // Open overlay from URL param
      const validOverlays = [
        "withdraw",
        "send",
        "receive",
        "settings",
        "history",
      ];
      if (validOverlays.includes(overlayParam)) {
        openOverlay(overlayParam as OverlayType);
      }
    }
  }, [searchParams, activeOverlay, openOverlay]);

  // Update URL when overlay changes (optional - can be disabled)
  useEffect(() => {
    if (activeOverlay) {
      // Add overlay param without navigation
      const url = new URL(window.location.href);
      url.searchParams.set("overlay", activeOverlay);
      window.history.replaceState({}, "", url.toString());
    } else {
      // Remove overlay param
      const url = new URL(window.location.href);
      url.searchParams.delete("overlay");
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeOverlay]);

  // Handle escape key to close overlay
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeOverlay) {
        closeOverlay();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeOverlay, closeOverlay]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (activeOverlay) {
        closeOverlay();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeOverlay, closeOverlay]);

  return (
    <>
      {/* Withdraw Sheet */}
      <Sheet
        open={activeOverlay === "withdraw"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <WithdrawSheet />
        </SheetContent>
      </Sheet>

      {/* Send Sheet */}
      <Sheet
        open={activeOverlay === "send"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SendSheet initialData={overlayData ?? undefined} />
        </SheetContent>
      </Sheet>

      {/* Receive Sheet */}
      <Sheet
        open={activeOverlay === "receive"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <ReceiveSheet />
        </SheetContent>
      </Sheet>

      {/* Settings Sheet */}
      <Sheet
        open={activeOverlay === "settings"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SettingsSheet />
        </SheetContent>
      </Sheet>

      {/* History Sheet */}
      <Sheet
        open={activeOverlay === "history"}
        onOpenChange={(open) => !open && closeOverlay()}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
        >
          <HistorySheet />
        </SheetContent>
      </Sheet>

      {/* ============================================ */}
      {/* MODAL DIALOGS (centered) */}
      {/* ============================================ */}

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

export default OverlayManager;
