"use client";

import { useState, useCallback } from "react";
import { clsx } from "clsx";

/**
 * CopyButton - Button to copy text to clipboard
 *
 * Shows feedback when text is copied successfully.
 * Used for copying addresses, transaction IDs, etc.
 */

interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string;
  /** Button label when not copied */
  label?: string;
  /** Label shown after copying */
  copiedLabel?: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

export function CopyButton({
  text,
  label = "COPY",
  copiedLabel = "COPIED!",
  size = "sm",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        "font-pixel border-2 border-black transition-all active:scale-95",
        size === "sm" && "px-3 py-2 min-h-[36px] text-[10px]",
        size === "md" && "px-4 py-2 min-h-[40px] text-xs",
        copied
          ? "bg-pixel-success text-black"
          : "bg-pixel-bg-dark text-pixel-text hover:bg-pixel-primary hover:text-black",
        className,
      )}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

export default CopyButton;
