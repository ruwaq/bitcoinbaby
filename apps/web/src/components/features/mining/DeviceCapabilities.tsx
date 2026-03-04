"use client";

/**
 * DeviceCapabilities - Device mining capabilities panel
 *
 * Shows:
 * - WebGPU support
 * - Web Workers support
 * - WebGL support
 * - CPU cores
 * - Blockchain submission status
 */

import { HelpTooltip, pixelBorders } from "@bitcoinbaby/ui";

interface DeviceCapabilitiesProps {
  capabilities: {
    webgpu: boolean;
    webgl: boolean;
    workers: boolean;
    cores: number;
  };
  canSubmitToBlockchain: boolean;
}

export function DeviceCapabilities({
  capabilities,
  canSubmitToBlockchain,
}: DeviceCapabilitiesProps) {
  return (
    <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase">
          Device Capabilities
        </h3>
        <HelpTooltip
          content="Your device's mining capabilities. WebGPU provides fastest mining, Web Workers enable parallel processing."
          title="Mining Hardware"
          description="Green checkmarks indicate available features. More features = better mining performance."
          size="sm"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="p-2">
          <div
            className={`font-pixel text-pixel-xs ${capabilities.webgpu ? "text-pixel-success" : "text-pixel-text-muted"}`}
          >
            {capabilities.webgpu ? "✓" : "✗"} WebGPU
          </div>
        </div>
        <div className="p-2">
          <div
            className={`font-pixel text-pixel-xs ${capabilities.workers ? "text-pixel-success" : "text-pixel-text-muted"}`}
          >
            {capabilities.workers ? "✓" : "✗"} Workers
          </div>
        </div>
        <div className="p-2">
          <div
            className={`font-pixel text-pixel-xs ${capabilities.webgl ? "text-pixel-success" : "text-pixel-text-muted"}`}
          >
            {capabilities.webgl ? "✓" : "✗"} WebGL
          </div>
        </div>
        <div className="p-2">
          <div className="font-pixel text-pixel-xs text-pixel-text">
            {capabilities.cores} Cores
          </div>
        </div>
      </div>

      {/* Blockchain Submission Status */}
      <div className="mt-4 pt-4 border-t-2 border-pixel-border">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              canSubmitToBlockchain ? "bg-pixel-success" : "bg-pixel-text-muted"
            }`}
          />
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
            {canSubmitToBlockchain
              ? "Blockchain submission ready (has BTC for fees)"
              : "Virtual-only mode (no BTC for fees)"}
          </span>
          <HelpTooltip
            content={
              canSubmitToBlockchain
                ? "Your mining proofs can be submitted directly to Bitcoin. You have enough BTC to pay for transaction fees."
                : "Mining rewards are stored in your virtual balance. To submit proofs on-chain, you need tBTC for transaction fees."
            }
            title="Submission Mode"
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

export default DeviceCapabilities;
