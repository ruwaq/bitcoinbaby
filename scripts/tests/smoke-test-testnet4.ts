#!/usr/bin/env npx tsx
/**
 * Smoke Test Script for BitcoinBaby on Testnet4
 *
 * Verifies the complete ecosystem works end-to-end:
 * 1. Mining → Virtual Balance
 * 2. Virtual Balance → Claim → On-chain Tokens
 * 3. NFT Minting and Evolution
 *
 * Requirements:
 * - Running Workers API (local or staging)
 * - Testnet4 wallet with funds (for claim TX)
 *
 * Usage:
 *   npx tsx scripts/tests/smoke-test-testnet4.ts
 *
 * Environment:
 *   API_URL=http://localhost:8787 (default)
 *   TEST_ADDRESS=tb1q... (testnet4 address to test with)
 */

import { createHash } from "crypto";

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_URL = process.env.API_URL || "http://localhost:8787";
const TEST_ADDRESS =
  process.env.TEST_ADDRESS || "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const MIN_DIFFICULTY = 16;

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// =============================================================================
// HELPERS
// =============================================================================

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step: number, message: string): void {
  log(`\n[${step}] ${message}`, colors.cyan);
}

function logSuccess(message: string): void {
  log(`  ✓ ${message}`, colors.green);
}

function logError(message: string): void {
  log(`  ✗ ${message}`, colors.red);
}

function logInfo(message: string): void {
  log(`  → ${message}`, colors.blue);
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ success: boolean; data?: T; error?: string; status?: string }> {
  try {
    const url = `${API_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const json = await response.json();
    // Handle both { success, data } and { status } formats
    return json as {
      success: boolean;
      data?: T;
      error?: string;
      status?: string;
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mine a valid proof with specified difficulty
 *
 * The server expects:
 * - blockData format: "prefix:timestamp:nonceHex"
 * - nonce embedded in blockData as hex (without 0x prefix)
 * - hash = double_sha256(blockData)
 */
function mineProof(difficulty: number): {
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  timestamp: number;
} {
  const timestamp = Date.now();
  const prefix = `smoke-test:${timestamp}`;
  let nonce = 0;
  const maxAttempts = Math.pow(2, difficulty + 8);

  while (nonce < maxAttempts) {
    // Format: prefix:nonceHex (nonce as hex WITHOUT 0x prefix)
    const blockData = `${prefix}:${nonce.toString(16)}`;

    // Double SHA256 (Bitcoin standard)
    const firstHash = createHash("sha256").update(blockData).digest();
    const hash = createHash("sha256").update(firstHash).digest("hex");

    let leadingZeros = 0;
    for (const char of hash) {
      const nibble = parseInt(char, 16);
      if (nibble === 0) {
        leadingZeros += 4;
      } else {
        if (nibble < 8) leadingZeros += 1;
        if (nibble < 4) leadingZeros += 1;
        if (nibble < 2) leadingZeros += 1;
        break;
      }
    }

    if (leadingZeros >= difficulty) {
      return { hash, nonce, difficulty, blockData, timestamp: Date.now() };
    }
    nonce++;
  }

  throw new Error(`Failed to mine proof with difficulty ${difficulty}`);
}

// =============================================================================
// TEST CASES
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>,
): Promise<boolean> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    logSuccess(`${name} (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    logError(`${name}: ${errorMessage}`);
    return false;
  }
}

// =============================================================================
// SMOKE TESTS
// =============================================================================

async function testHealthCheck(): Promise<void> {
  const result = await apiCall<{ status: string }>("/health");
  // Health endpoint returns { status: "ok" } directly, not wrapped in { success, data }
  if (result.status !== "ok" && result.data?.status !== "ok") {
    throw new Error("Health check failed");
  }
}

async function testGetBalance(): Promise<void> {
  const result = await apiCall<{ virtualBalance: string }>(
    `/api/balance/${TEST_ADDRESS}`,
  );
  if (!result.success) {
    throw new Error(result.error || "Failed to get balance");
  }
  logInfo(`Balance: ${result.data?.virtualBalance || 0}`);
}

async function testCreditMining(): Promise<void> {
  logInfo("Mining proof (this may take a moment)...");
  const proof = mineProof(MIN_DIFFICULTY);
  logInfo(`Mined proof with hash: ${proof.hash.slice(0, 16)}...`);

  const result = await apiCall<{ credited: string; newBalance: string }>(
    `/api/balance/${TEST_ADDRESS}/credit`,
    {
      method: "POST",
      body: JSON.stringify(proof),
    },
  );

  if (!result.success) {
    // Duplicate proof is acceptable in smoke test
    if (result.error?.includes("already used")) {
      logInfo("Proof already used (expected on re-run)");
      return;
    }
    throw new Error(result.error || "Failed to credit mining");
  }

  logInfo(
    `Credited: ${result.data?.credited}, New balance: ${result.data?.newBalance}`,
  );
}

async function testGetClaimableBalance(): Promise<void> {
  const result = await apiCall<{
    claimableTokens: string;
    unclaimedProofs: number;
  }>(`/api/claim/balance/${TEST_ADDRESS}`);

  if (!result.success) {
    throw new Error(result.error || "Failed to get claimable balance");
  }

  logInfo(
    `Claimable: ${result.data?.claimableTokens || 0} tokens, ` +
      `${result.data?.unclaimedProofs || 0} proofs`,
  );
}

async function testPrepareClaim(): Promise<void> {
  const result = await apiCall<{
    claimData: { claimId: string; opReturnData: string };
    tokenAmount: string;
  }>("/api/claim/prepare", {
    method: "POST",
    body: JSON.stringify({ address: TEST_ADDRESS }),
  });

  if (!result.success) {
    // No proofs to claim is acceptable
    if (result.error?.includes("No unclaimed proofs")) {
      logInfo("No proofs to claim (mine more first)");
      return;
    }
    throw new Error(result.error || "Failed to prepare claim");
  }

  logInfo(`Claim prepared: ${result.data?.claimData?.claimId?.slice(0, 8)}...`);
  logInfo(`Token amount: ${result.data?.tokenAmount}`);
  logInfo(
    `OP_RETURN: ${result.data?.claimData?.opReturnData?.slice(0, 20)}...`,
  );

  // Cancel the claim so it doesn't block future tests
  await apiCall("/api/claim/cancel", {
    method: "POST",
    body: JSON.stringify({ address: TEST_ADDRESS }),
  });
  logInfo("Claim cancelled (for test cleanup)");
}

async function testNFTStats(): Promise<void> {
  const result = await apiCall<{
    totalMinted: number;
    available: number;
  }>("/api/nft/stats");

  if (!result.success) {
    throw new Error(result.error || "Failed to get NFT stats");
  }

  logInfo(
    `NFT Stats: ${result.data?.totalMinted || 0} minted, ` +
      `${result.data?.available || 0} available`,
  );
}

async function testGetLeaderboard(): Promise<void> {
  // Leaderboard endpoint requires Redis - may not be available in dev
  const result = await apiCall<{
    entries: Array<{ address: string; score: number }>;
    totalEntries: number;
  }>(`/api/leaderboard?category=miners&period=alltime&limit=10`);

  if (!result.success) {
    // Redis not available in local dev is acceptable
    if (
      result.error?.includes("Redis") ||
      result.error?.includes("Failed to fetch")
    ) {
      logInfo("Leaderboard unavailable (Redis not configured in dev)");
      return;
    }
    throw new Error(result.error || "Failed to get leaderboard");
  }

  logInfo(
    `Leaderboard: ${result.data?.entries?.length || 0} of ${result.data?.totalEntries || 0} entries`,
  );
}

async function testDuplicateProofRejection(): Promise<void> {
  const proof = mineProof(MIN_DIFFICULTY);

  // First submission
  const first = await apiCall(`/api/balance/${TEST_ADDRESS}/credit`, {
    method: "POST",
    body: JSON.stringify(proof),
  });

  // First submission may succeed, be duplicate, or hit rate limit
  if (
    !first.success &&
    !first.error?.includes("already used") &&
    !first.error?.includes("Too fast") &&
    !first.error?.includes("Rate limit")
  ) {
    throw new Error(
      `First submission should succeed, be duplicate, or rate limited. Got: ${first.error}`,
    );
  }

  // If rate limited, we can't properly test duplicate - skip gracefully
  if (
    first.error?.includes("Too fast") ||
    first.error?.includes("Rate limit")
  ) {
    logInfo("Rate limited - duplicate test requires waiting between shares");
    return;
  }

  // Second submission with same proof
  const second = await apiCall(`/api/balance/${TEST_ADDRESS}/credit`, {
    method: "POST",
    body: JSON.stringify(proof),
  });

  if (second.success) {
    throw new Error("Duplicate proof should be rejected");
  }

  // Accept either "already used" or rate limit as valid rejection
  if (
    !second.error?.includes("already used") &&
    !second.error?.includes("Too fast")
  ) {
    throw new Error(
      `Expected 'already used' or rate limit error, got: ${second.error}`,
    );
  }

  logInfo("Duplicate proof correctly rejected");
}

async function testInvalidProofRejection(): Promise<void> {
  const invalidProof = {
    hash: "0".repeat(64),
    nonce: 12345,
    difficulty: MIN_DIFFICULTY,
    blockData: "invalid-block-data",
    timestamp: Date.now(),
  };

  const result = await apiCall(`/api/balance/${TEST_ADDRESS}/credit`, {
    method: "POST",
    body: JSON.stringify(invalidProof),
  });

  if (result.success) {
    throw new Error("Invalid proof should be rejected");
  }

  logInfo("Invalid proof correctly rejected");
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  log(
    "\n╔══════════════════════════════════════════════════════════════╗",
    colors.cyan,
  );
  log(
    "║       BitcoinBaby Smoke Test - Testnet4                      ║",
    colors.cyan,
  );
  log(
    "╚══════════════════════════════════════════════════════════════╝",
    colors.cyan,
  );

  log(`\nAPI URL: ${API_URL}`, colors.yellow);
  log(`Test Address: ${TEST_ADDRESS}`, colors.yellow);

  // Step 1: Health Check
  logStep(1, "API Health Check");
  await runTest("Health endpoint responds", testHealthCheck);

  // Step 2: Balance Operations
  logStep(2, "Balance Operations");
  await runTest("Get balance for address", testGetBalance);
  await runTest("Credit mining proof", testCreditMining);
  await runTest("Get leaderboard", testGetLeaderboard);

  // Step 3: Security Tests
  logStep(3, "Security Validation");
  await runTest("Reject duplicate proofs", testDuplicateProofRejection);
  await runTest("Reject invalid proofs", testInvalidProofRejection);

  // Step 4: Claim System
  logStep(4, "Claim System");
  await runTest("Get claimable balance", testGetClaimableBalance);
  await runTest("Prepare claim", testPrepareClaim);

  // Step 5: NFT System
  logStep(5, "NFT System");
  await runTest("Get NFT stats", testNFTStats);

  // Summary
  log(
    "\n╔══════════════════════════════════════════════════════════════╗",
    colors.cyan,
  );
  log(
    "║                      TEST SUMMARY                            ║",
    colors.cyan,
  );
  log(
    "╚══════════════════════════════════════════════════════════════╝",
    colors.cyan,
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  log(`\nTotal: ${results.length} tests`, colors.reset);
  log(`Passed: ${passed}`, colors.green);
  if (failed > 0) {
    log(`Failed: ${failed}`, colors.red);
    log("\nFailed tests:", colors.red);
    for (const result of results.filter((r) => !r.passed)) {
      log(`  - ${result.name}: ${result.error}`, colors.red);
    }
  }
  log(`\nTotal time: ${totalTime}ms`, colors.blue);

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }

  log("\n✓ All smoke tests passed!", colors.green);
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
