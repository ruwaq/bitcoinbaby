/**
 * SPARK Deployment Configuration (multi-network)
 *
 * The actual SPARK_TESTNET4 deployment data lives in `./testnet4.ts`, which is
 * the SINGLE SOURCE OF TRUTH (it also supports overriding appId/appVk via
 * environment variables). This file layers on the multi-network view
 * (testnet4 / regtest / mainnet) plus the helpers consumers expect
 * (`getDeploymentConfig`, `isDeploymentReady`, `validateDeployment`).
 *
 * Placeholder detection is delegated to the shared string-prefix-based
 * `isSPARKConfigured` from `./testnet4.ts` so there is exactly one mechanism
 * for "is this config real?". There is no hand-maintained `isPlaceholder`
 * boolean that can drift from the actual values.
 *
 * Reward Formula (BRO-style):
 * reward = BASE_REWARD × D² ÷ DIFFICULTY_FACTOR
 * Where D = difficulty (leading zero bits), BASE_REWARD = 1 SPARK, FACTOR = 100
 *
 * Distribution: 90% miner, 5% dev, 5% staking
 */

import type { SupportedNetwork } from "../types";
import {
  SPARK_TESTNET4 as TESTNET4_CONFIG,
  isSPARKConfigured,
} from "./testnet4";

export interface DeploymentConfig {
  /** Network identifier */
  network: SupportedNetwork;
  /** SHA256 hash of genesis UTXO - identifies the app */
  appId: string;
  /** SHA256 hash of WASM binary - verification key */
  appVk: string;
  /** Block height when contract was deployed */
  deploymentBlock?: number;
  /** Genesis UTXO that created this app */
  genesisUtxo?: string;
  /**
   * Whether this config is a placeholder (not yet deployed).
   * @deprecated Derived from the appId/appVk via string-prefix detection in
   * {@link isSPARKConfigured}. Do not set manually — rely on the helper.
   */
  readonly isPlaceholder: boolean;
}

/**
 * Re-export of the canonical testnet4 deployment data so existing importers of
 * `SPARK_TESTNET4` from this file keep working. The data is defined once, in
 * `./testnet4.ts`.
 */
export const SPARK_TESTNET4: DeploymentConfig = {
  network: "testnet4",
  appId: TESTNET4_CONFIG.appId,
  appVk: TESTNET4_CONFIG.appVk,
  deploymentBlock: TESTNET4_CONFIG.deploymentBlock,
  genesisUtxo: TESTNET4_CONFIG.genesisUtxo,
  get isPlaceholder(): boolean {
    return !isSPARKConfigured(this);
  },
};

/**
 * Regtest Deployment Configuration
 *
 * STATUS: DEPLOYED locally for development. Mirrors the testnet4 deployment so
 * the same contract can be exercised against a local node.
 */
export const SPARK_REGTEST: DeploymentConfig = {
  network: "regtest",
  appId: TESTNET4_CONFIG.appId,
  appVk: TESTNET4_CONFIG.appVk,
  deploymentBlock: 1,
  genesisUtxo: TESTNET4_CONFIG.genesisUtxo,
  get isPlaceholder(): boolean {
    return !isSPARKConfigured(this);
  },
};

/**
 * Mainnet Deployment Configuration
 *
 * STATUS: NOT DEPLOYED
 * WARNING: Deploy to mainnet only after thorough testnet4 testing
 */
export const SPARK_MAINNET: DeploymentConfig = {
  network: "mainnet",
  appId: "not_deployed",
  appVk: "not_deployed",
  get isPlaceholder(): boolean {
    return !isSPARKConfigured(this);
  },
};

/**
 * Get deployment config for a network
 */
export function getDeploymentConfig(
  network: SupportedNetwork = "testnet4",
): DeploymentConfig {
  if (network === "mainnet") return SPARK_MAINNET;
  if (network === "regtest") return SPARK_REGTEST;
  return SPARK_TESTNET4;
}

/**
 * Check if deployment is ready (not placeholder)
 */
export function isDeploymentReady(
  network: SupportedNetwork = "testnet4",
): boolean {
  const config = getDeploymentConfig(network);
  return isSPARKConfigured(config);
}

/**
 * Validate that deployment config is set before mining
 */
export function validateDeployment(
  network: SupportedNetwork = "testnet4",
): void {
  const config = getDeploymentConfig(network);
  if (!isSPARKConfigured(config)) {
    throw new Error(
      `SPARK contract not deployed to ${network}. ` +
        `See packages/bitcoin/contracts/babtc/BUILD.md for deployment instructions.`,
    );
  }
}
