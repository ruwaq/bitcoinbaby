"use client";

/**
 * ConfirmActionModal
 *
 * Generic confirmation modal for destructive/important actions.
 * Used by useConfirmModal, useResetModal, useDeleteWalletModal.
 */

import { useState, useEffect, useRef } from "react";
import { Button, Input } from "@bitcoinbaby/ui";
import { useOverlayStore } from "@bitcoinbaby/core";

export function ConfirmActionModal() {
  const { overlayData, closeOverlay, activeOverlay } = useOverlayStore();
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = (overlayData?.title as string) || "Confirm Action";
  const message = (overlayData?.message as string) || "Are you sure?";
  const confirmBtnText = (overlayData?.confirmText as string) || "CONFIRM";
  const cancelBtnText = (overlayData?.cancelText as string) || "CANCEL";
  const destructive = overlayData?.destructive === true;
  const onConfirm = overlayData?.onConfirm as
    | (() => void | Promise<void>)
    | undefined;
  const onCancel = overlayData?.onCancel as (() => void) | undefined;

  // For destructive actions, require typing "DELETE"
  const requiresTyping = destructive;
  const requiredText = "DELETE";

  // Auto-focus input for destructive actions
  useEffect(() => {
    if (requiresTyping) {
      inputRef.current?.focus();
    }
  }, [requiresTyping]);

  const handleConfirm = async () => {
    if (requiresTyping && confirmText !== requiredText) {
      return;
    }

    setIsLoading(true);

    try {
      if (onConfirm) {
        await onConfirm();
      }
      closeOverlay();
    } catch (error) {
      console.error("Confirm action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    closeOverlay();
  };

  // Get icon based on overlay type
  // Using actual Unicode characters instead of HTML entities for security
  const getIcon = () => {
    if (activeOverlay === "confirm-reset") return "💥"; // explosion
    if (activeOverlay === "delete-wallet") return "🚧"; // warning
    if (destructive) return "⚠"; // warning sign
    return "❓"; // question mark
  };

  return (
    <div className="p-6 max-w-sm w-full">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3" aria-hidden="true">
          {getIcon()}
        </div>
        <h2
          className={`font-pixel text-lg ${destructive ? "text-pixel-error" : "text-pixel-primary"}`}
        >
          {title}
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted mt-2">
          {message}
        </p>
      </div>

      {requiresTyping && (
        <div className="mb-4">
          <p className="font-pixel-body text-xs text-pixel-text-muted mb-2">
            Type{" "}
            <span className="text-pixel-error font-bold">{requiredText}</span>{" "}
            to confirm:
          </p>
          <Input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder={requiredText}
            className="w-full text-center font-pixel"
            disabled={isLoading}
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1"
        >
          {cancelBtnText}
        </Button>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          onClick={handleConfirm}
          disabled={
            isLoading || (requiresTyping && confirmText !== requiredText)
          }
          className="flex-1"
        >
          {isLoading ? "..." : confirmBtnText}
        </Button>
      </div>
    </div>
  );
}

export default ConfirmActionModal;
