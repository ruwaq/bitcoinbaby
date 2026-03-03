"use client";

/**
 * RecoveryPhraseModal
 *
 * Displays the wallet recovery phrase securely.
 * Shows words in a grid with copy functionality.
 */

import { useState } from "react";
import { Button } from "@bitcoinbaby/ui";
import { useOverlayStore } from "@bitcoinbaby/core";

export function RecoveryPhraseModal() {
  const { overlayData, closeOverlay } = useOverlayStore();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const recoveryPhrase = (overlayData?.recoveryPhrase as string) || "";
  const words = recoveryPhrase.split(" ").filter(Boolean);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="p-6 max-w-md w-full">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#128273;</div>
        <h2 className="font-pixel text-lg text-pixel-primary">
          RECOVERY PHRASE
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
          Write these words down and store them safely
        </p>
      </div>

      {/* Warning banner */}
      <div className="bg-pixel-error/10 border-2 border-pixel-error/50 p-3 rounded mb-4">
        <p className="font-pixel-body text-xs text-pixel-error">
          &#9888; Never share your recovery phrase. Anyone with these words can
          access your wallet.
        </p>
      </div>

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

      {/* Reveal toggle */}
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
    </div>
  );
}

export default RecoveryPhraseModal;
