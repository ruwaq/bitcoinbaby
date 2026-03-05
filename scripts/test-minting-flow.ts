#!/usr/bin/env npx tsx
/**
 * Test Script: BABTC Token Configuration & Reward System
 *
 * This script tests:
 * 1. BRO-style reward calculation (difficulty-based)
 * 2. API connectivity (Scrolls, Prover)
 * 3. Token deployment status
 *
 * Run with: npx tsx scripts/test-minting-flow.ts
 */

import {
  BABTC_CONFIG,
  calculateMiningReward,
  formatTokenAmount,
  getRewardTable,
} from "../packages/bitcoin/src/charms/token";
import { BABTC_TESTNET4 } from "../packages/bitcoin/src/config/deployment";

const SCROLLS_URL = "https://scrolls.charms.dev";
const PROVER_URL = "http://localhost:17784"; // Local prover
const MEMPOOL_URL = "https://mempool.space/testnet4/api";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log("");
  log(
    `═══════════════════════════════════════════════════════════════`,
    colors.cyan,
  );
  log(`  ${title}`, colors.cyan);
  log(
    `═══════════════════════════════════════════════════════════════`,
    colors.cyan,
  );
  console.log("");
}

async function checkEndpoint(
  name: string,
  url: string,
  expectedStatus = 200,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === expectedStatus || response.ok) {
      log(`  ✓ ${name}: OK (${response.status})`, colors.green);
      return true;
    } else {
      log(`  ✗ ${name}: ${response.status} ${response.statusText}`, colors.red);
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log(`  ✗ ${name}: ${message}`, colors.red);
    return false;
  }
}

async function main(): Promise<void> {
  logSection("BABTC Token Configuration");

  log(`  Token: ${BABTC_CONFIG.ticker} (${BABTC_CONFIG.name})`);
  log(
    `  Max Supply: ${Number(BABTC_CONFIG.maxSupply / 100_000_000n).toLocaleString()} ${BABTC_CONFIG.ticker}`,
  );
  log(`  Decimals: ${BABTC_CONFIG.decimals}`);
  console.log("");
  log(`  Reward Model: BRO-style (difficulty-based)`, colors.yellow);
  log(`  Formula: BASE_REWARD × D² ÷ DIFFICULTY_FACTOR`);
  log(
    `  Base Reward: ${formatTokenAmount(BABTC_CONFIG.rewards.baseReward)} ${BABTC_CONFIG.ticker}`,
  );
  log(
    `  Difficulty Range: D${BABTC_CONFIG.rewards.minDifficulty} - D${BABTC_CONFIG.rewards.maxDifficulty}`,
  );
  console.log("");
  log(`  Distribution:`, colors.dim);
  log(`    - Miner: ${BABTC_CONFIG.distribution.miner}%`);
  log(`    - Dev Fund: ${BABTC_CONFIG.distribution.dev}%`);
  log(`    - Staking Pool: ${BABTC_CONFIG.distribution.staking}%`);

  logSection("Deployment Configuration (Testnet4)");

  log(`  Network: ${BABTC_TESTNET4.network}`);
  log(`  App ID: ${BABTC_TESTNET4.appId}`);
  log(`  App VK: ${BABTC_TESTNET4.appVk}`);
  log(`  Genesis UTXO: ${BABTC_TESTNET4.genesisUtxo}`);
  log(
    `  Is Placeholder: ${BABTC_TESTNET4.isPlaceholder ? "Yes" : "No"}`,
    BABTC_TESTNET4.isPlaceholder ? colors.red : colors.green,
  );

  logSection("Reward Table (by Difficulty)");

  const rewardTable = getRewardTable();
  log(`  Difficulty | Miner Reward`, colors.dim);
  log(`  -----------|-------------`, colors.dim);
  for (const { difficulty, minerReward } of rewardTable) {
    const formatted = formatTokenAmount(minerReward);
    log(
      `  D${difficulty.toString().padStart(2, " ")}        | ${formatted.padStart(10, " ")} ${BABTC_CONFIG.ticker}`,
    );
  }

  logSection("Example Reward Calculations");

  const examples = [22, 24, 26, 28, 30, 32];
  for (const diff of examples) {
    const reward = calculateMiningReward(diff);
    log(
      `  D${diff}: ${formatTokenAmount(reward.minerShare)} ${BABTC_CONFIG.ticker} (miner) + ${formatTokenAmount(reward.devShare)} (dev) + ${formatTokenAmount(reward.stakingShare)} (staking)`,
    );
  }

  logSection("API Connectivity Check");

  // Check Mempool API
  await checkEndpoint(
    "Mempool.space (testnet4)",
    `${MEMPOOL_URL}/blocks/tip/height`,
  );

  // Check Scrolls API
  await checkEndpoint("Scrolls API (config)", `${SCROLLS_URL}/config`);

  // Check local Prover API
  log(``, colors.dim);
  log(`  Local Prover (run: charms server):`, colors.dim);
  await checkEndpoint("Prover API (local)", `${PROVER_URL}/health`);

  logSection("Fund Addresses");

  log(`  Dev Fund: ${BABTC_CONFIG.addresses.devFund}`);
  log(`  Staking Pool: ${BABTC_CONFIG.addresses.stakingPool}`);

  logSection("Summary");

  if (!BABTC_TESTNET4.isPlaceholder) {
    log(`  ✓ BABTC token is deployed on testnet4`, colors.green);
  } else {
    log(`  ✗ BABTC token not deployed yet`, colors.red);
  }

  log(`  ✓ Using BRO-style rewards (no halving)`, colors.green);

  console.log("");
  log(`  Minting Flow:`, colors.dim);
  log(
    `  1. Mine PoW (find hash with D${BABTC_CONFIG.rewards.minDifficulty}+ leading zeros)`,
  );
  log(`  2. Create mining TX with OP_RETURN (challenge:nonce:hash)`);
  log(`  3. Broadcast and wait for 1 confirmation`);
  log(`  4. Get Merkle proof of inclusion`);
  log(`  5. Submit to Prover API (local or hosted)`);
  log(`  6. Sign and broadcast commit + spell TXs`);
  log(`  7. Tokens appear in wallet`);
  console.log("");
}

main().catch(console.error);
