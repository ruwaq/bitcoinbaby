"use client";

/**
 * RecoveryPhraseModal
 *
 * Displays the wallet recovery phrase securely.
 * First requires password verification, then shows words in a grid.
 */

import { useState, useRef, useEffect } from "react";
import { Button, Input } from "@bitcoinbaby/ui";
import {
  useOverlayStore,
  SecureStorage,
  MIN_PASSWORD_LENGTH,
} from "@bitcoinbaby/core";

export function RecoveryPhraseModal() {
  const { overlayData, closeOverlay } = useOverlayStore();

  // Check if phrase was passed directly (for backward compatibility)
  const passedPhrase = overlayData?.recoveryPhrase as string | undefined;

  // State
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(passedPhrase || null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!!passedPhrase);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus password input
  useEffect(() => {
    if (!phrase) {
      inputRef.current?.focus();
    }
  }, [phrase]);

  const handleReveal = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const mnemonic = await SecureStorage.getMnemonic(password);
      setPhrase(mnemonic);
      setRevealed(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid password or no wallet found",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (phrase) {
      try {
        await navigator.clipboard.writeText(phrase);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  };

  const words = phrase?.split(" ").filter(Boolean) || [];

  return (
    <div className="p-6 max-w-md w-full">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#128273;</div>
        <h2 className="font-pixel text-lg text-pixel-primary">
          RECOVERY PHRASE
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
          {phrase
            ? "Write these words down and store them safely"
            : "Enter your password to reveal your recovery phrase"}
        </p>
      </div>

      {/* Warning banner */}
      <div className="bg-pixel-error/10 border-2 border-pixel-error/50 p-3 rounded mb-4">
        <p className="font-pixel-body text-xs text-pixel-error">
          &#9888; Never share your recovery phrase. Anyone with these words can
          access your wallet.
        </p>
      </div>

      {!phrase ? (
        // Password verification step
        <>
          <div className="mb-4">
            <label className="font-pixel-body text-xs text-pixel-text-muted block mb-1">
              Password
            </label>
            <Input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleReveal();
              }}
              placeholder="Enter your password"
              className="w-full"
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="font-pixel-body text-xs text-pixel-error mb-4">
              {error}
            </p>
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
              type="button"
              variant="default"
              onClick={handleReveal}
              disabled={isLoading || password.length < MIN_PASSWORD_LENGTH}
              className="flex-1"
            >
              {isLoading ? "..." : "REVEAL"}
            </Button>
          </div>
        </>
      ) : (
        // Show recovery phrase
        <>
          {/* Words grid */}
          <div
            className={`grid grid-cols-3 gap-2 mb-4 ${!revealed ? "blur-sm select-none" : ""}`}
          >
            {words.map((word, index) => (
              <div
                key={index}
                className="bg-pixel-bg-medium border-2 border-pixel-border p-2 rounded text-center"
              >
                <span className="font-pixel-body text-[10px] text-pixel-text-muted">
                  {index + 1}.
                </span>
                <span className="font-pixel-mono text-xs text-pixel-text ml-1">
                  {word}
                </span>
              </div>
            ))}
          </div>

          {/* Reveal toggle (only if passed phrase without password verification) */}
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="w-full py-2 mb-4 font-pixel-body text-sm text-pixel-secondary hover:underline"
            >
              &#128065; Click to reveal words
            </button>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="flex-1"
            >
              {copied ? "COPIED!" : "COPY"}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={closeOverlay}
              className="flex-1"
            >
              DONE
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default RecoveryPhraseModal;
