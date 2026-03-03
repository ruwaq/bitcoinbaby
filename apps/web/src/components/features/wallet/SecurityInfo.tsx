"use client";

/**
 * SecurityInfo - Wallet security information panel
 *
 * Shows encryption and security details.
 */

import { HelpTooltip } from "@bitcoinbaby/ui";

export function SecurityInfo() {
  return (
    <div className="mt-6 sm:mt-8 p-4 bg-pixel-bg-light border-4 border-dashed border-pixel-border">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-pixel text-pixel-xs text-pixel-secondary">
          SECURITY INFO
        </h3>
        <HelpTooltip
          content="Your wallet uses industry-standard encryption. Private keys never leave your device and are protected with a password."
          title="Security Details"
          description="We follow OWASP 2024 security guidelines for key derivation and encryption."
          size="sm"
        />
      </div>
      <ul className="space-y-2 font-pixel-body text-body-sm text-pixel-text-muted">
        <li>
          <span className="text-pixel-success">●</span> Wallet encrypted with
          AES-256-GCM
        </li>
        <li>
          <span className="text-pixel-success">●</span> 600,000 PBKDF2
          iterations (OWASP 2024)
        </li>
        <li>
          <span className="text-pixel-success">●</span> Stored locally in
          IndexedDB
        </li>
        <li>
          <span className="text-pixel-success">●</span> Never sent to any server
        </li>
        <li>
          <span className="text-pixel-primary">●</span> Recovery phrase is your
          only backup!
        </li>
      </ul>
    </div>
  );
}

export default SecurityInfo;
