"use client";

/**
 * ChangePasswordModal
 *
 * Modal for changing wallet password.
 * Requires current password and new password (with confirmation).
 */

import { useState, useRef, useEffect } from "react";
import { Button, Input } from "@bitcoinbaby/ui";
import { useOverlayStore, SecureStorage } from "@bitcoinbaby/core";

export function ChangePasswordModal() {
  const { closeOverlay } = useOverlayStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus first input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validateForm = (): string | null => {
    if (!currentPassword) return "Current password is required";
    if (!newPassword) return "New password is required";
    if (newPassword.length < 8) return "Password must be at least 8 characters";
    if (newPassword !== confirmPassword) return "Passwords do not match";
    if (currentPassword === newPassword)
      return "New password must be different";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await SecureStorage.changePassword(currentPassword, newPassword);
      closeOverlay();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-sm w-full">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#128272;</div>
        <h2 className="font-pixel text-lg text-pixel-primary">
          CHANGE PASSWORD
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
          Enter your current and new password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-pixel-body text-xs text-pixel-text-muted block mb-1">
            Current Password
          </label>
          <Input
            ref={inputRef}
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setError("");
            }}
            placeholder="Current password"
            className="w-full"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="font-pixel-body text-xs text-pixel-text-muted block mb-1">
            New Password
          </label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError("");
            }}
            placeholder="New password (8+ chars)"
            className="w-full"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="font-pixel-body text-xs text-pixel-text-muted block mb-1">
            Confirm New Password
          </label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            placeholder="Confirm new password"
            className="w-full"
            disabled={isLoading}
          />
        </div>

        {error && (
          <p className="font-pixel-body text-xs text-pixel-error">{error}</p>
        )}

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
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "..." : "CHANGE"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ChangePasswordModal;
