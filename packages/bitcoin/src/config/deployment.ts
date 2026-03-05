/**
 * BABTC Deployment Configuration
 *
 * This file contains deployment-specific configuration.
 * Update these values after deploying the contract to testnet4.
 *
 * Deployment Steps:
 * 1. Build contract: cd contracts/babtc && charms app build
 * 2. Get VK: charms app vk ./target/wasm32-wasip1/release/babtc-contract.wasm
 * 3. Create genesis UTXO on testnet4
 * 4. Deploy and update this file with the output values
 *
 * Reward Formula (BRO-style):
 * reward = BASE_REWARD × D² ÷ DIFFICULTY_FACTOR
 * Where D = difficulty (leading zero bits), BASE_REWARD = 1 BABTC, FACTOR = 100
 *
 * Distribution: 90% miner, 5% dev, 5% staking
 */

export interface DeploymentConfig {
  /** Network identifier */
  network: "testnet4" | "mainnet";
  /** SHA256 hash of genesis UTXO - identifies the app */
  appId: string;
  /** SHA256 hash of WASM binary - verification key */
  appVk: string;
  /** Block height when contract was deployed */
  deploymentBlock?: number;
  /** Genesis UTXO that created this app */
  genesisUtxo?: string;
  /** Is this a placeholder config? */
  isPlaceholder: boolean;
}

/**
 * Testnet4 Deployment Configuration
 *
 * STATUS: DEPLOYED - Ready for mining (v2 with BRO-style rewards)
 *
 * Genesis UTXO: b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0
 * Deployed: 2026-02-18
 * Updated: 2026-03-05 (BRO-style rewards, Charms SDK 11.0.1)
 *
 * Contract: packages/bitcoin/contracts/babtc
 * VK generated with: charms app vk ./target/wasm32-wasip1/release/babtc-contract.wasm
 */
export const BABTC_TESTNET4: DeploymentConfig = {
  network: "testnet4",
  appId: "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b",
  appVk: "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d",
  deploymentBlock: 75000, // Approximate block height
  genesisUtxo:
    "b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0",
  isPlaceholder: false,
};

/**
 * Mainnet Deployment Configuration
 *
 * STATUS: NOT DEPLOYED
 * WARNING: Deploy to mainnet only after thorough testnet4 testing
 */
export const BABTC_MAINNET: DeploymentConfig = {
  network: "mainnet",
  appId: "not_deployed",
  appVk: "not_deployed",
  isPlaceholder: true,
};

/**
 * Get deployment config for a network
 */
export function getDeploymentConfig(
  network: "testnet4" | "mainnet" = "testnet4",
): DeploymentConfig {
  return network === "mainnet" ? BABTC_MAINNET : BABTC_TESTNET4;
}

/**
 * Check if deployment is ready (not placeholder)
 */
export function isDeploymentReady(
  network: "testnet4" | "mainnet" = "testnet4",
): boolean {
  const config = getDeploymentConfig(network);
  return !config.isPlaceholder;
}

/**
 * Validate that deployment config is set before mining
 */
export function validateDeployment(
  network: "testnet4" | "mainnet" = "testnet4",
): void {
  const config = getDeploymentConfig(network);
  if (config.isPlaceholder) {
    throw new Error(
      `BABTC contract not deployed to ${network}. ` +
        `See packages/bitcoin/contracts/babtc/BUILD.md for deployment instructions.`,
    );
  }
}
