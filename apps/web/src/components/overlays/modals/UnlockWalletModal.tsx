"use client";

/**
 * UnlockWalletModal
 *
 * Modal for entering wallet password to unlock.
 * Replaces the inline UnlockModal in WalletSection.
 */

import { useState, useRef, useEffect } from "react";
import { Button, Input } from "@bitcoinbaby/ui";
import { useOverlayStore } from "@bitcoinbaby/core";

export function UnlockWalletModal() {
  const { overlayData, closeOverlay } = useOverlayStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus password input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const onPasswordSubmit = overlayData?.onPasswordSubmit as
        | ((password: string) => void | Promise<void>)
        | undefined;

      if (onPasswordSubmit) {
        await onPasswordSubmit(password);
      }
      closeOverlay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-sm w-full">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#128274;</div>
        <h2 className="font-pixel text-lg text-pixel-primary">UNLOCK WALLET</h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
          Enter your password to unlock
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Enter password"
            className="w-full"
            disabled={isLoading}
          />
          {error && (
            <p className="font-pixel-body text-xs text-pixel-error mt-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={closeOverlay}
            disabled={isLoading}
            className="flex-1"
          >
            CANCEL
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={isLoading || !password}
            className="flex-1"
          >
            {isLoading ? "..." : "UNLOCK"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default UnlockWalletModal;
