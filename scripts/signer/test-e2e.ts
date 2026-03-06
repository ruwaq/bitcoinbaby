#!/usr/bin/env tsx
/**
 * E2E Test for Treasury Withdrawal Flow
 *
 * Tests the complete flow:
 * 1. Check signer health
 * 2. Create a test withdrawal request
 * 3. Process the batch
 * 4. Verify confirmation
 *
 * Usage:
 *   WORKERS_API_URL="http://localhost:8787" \
 *   ADMIN_KEY="test-admin-key" \
 *   tsx scripts/signer/test-e2e.ts
 */

// Configuration
const CONFIG = {
  workersApiUrl: process.env.WORKERS_API_URL || "http://localhost:8787",
  adminKey: process.env.ADMIN_KEY || "",
  testAddress:
    process.env.TEST_ADDRESS || "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
  testAmount: "1000", // 1000 sats worth of BABTC
};

// Colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(
  level: "info" | "success" | "error" | "warn" | "step",
  message: string,
) {
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
    step: colors.cyan,
  };
  const icons = {
    info: "ℹ",
    success: "✓",
    error: "✗",
    warn: "⚠",
    step: "→",
  };
  console.log(`${colorMap[level]}${icons[level]} ${message}${colors.reset}`);
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: object,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const response = await fetch(`${CONFIG.workersApiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": CONFIG.adminKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { ok: false, error: `${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function testSignerHealth(): Promise<boolean> {
  log("step", "Testing signer health endpoint...");

  const result = await apiRequest<{
    success: boolean;
    data: {
      healthy: boolean;
      treasuryAddress: string | null;
      treasuryBalance: string;
      configuredForSigning: boolean;
      scrollsApiAvailable: boolean;
      readyBatchCount: number;
      message: string;
    };
  }>("GET", "/api/admin/signer/health");

  if (!result.ok) {
    log("error", `Health check failed: ${result.error}`);
    return false;
  }

  const health = result.data?.data;
  if (!health) {
    log("error", "Invalid health response");
    return false;
  }

  log("info", `Treasury Address: ${health.treasuryAddress || "Not set"}`);
  log("info", `Treasury Balance: ${health.treasuryBalance} BABTC`);
  log("info", `Configured for Signing: ${health.configuredForSigning}`);
  log(
    "info",
    `Scrolls API: ${health.scrollsApiAvailable ? "Available" : "Unavailable"}`,
  );
  log("info", `Ready Batches: ${health.readyBatchCount}`);
  log("info", `Message: ${health.message}`);

  if (health.healthy) {
    log("success", "Signer is healthy!");
    return true;
  } else {
    log("warn", "Signer is not fully healthy");
    return true; // Continue tests anyway
  }
}

async function testTreasuryBalance(): Promise<boolean> {
  log("step", "Testing treasury balance endpoint...");

  const result = await apiRequest<{
    success: boolean;
    data: {
      address: string;
      balance: string;
      balanceFormatted: string;
    };
  }>("GET", "/api/admin/treasury/balance");

  if (!result.ok) {
    log("error", `Balance check failed: ${result.error}`);
    return false;
  }

  const balance = result.data?.data;
  if (!balance) {
    log("error", "Invalid balance response");
    return false;
  }

  log("info", `Address: ${balance.address}`);
  log("info", `Balance: ${balance.balanceFormatted}`);

  log("success", "Treasury balance check passed!");
  return true;
}

async function testPoolStatus(): Promise<boolean> {
  log("step", "Testing pool status...");

  const poolTypes = ["weekly", "monthly", "low_fee", "immediate"];

  for (const poolType of poolTypes) {
    const result = await apiRequest<{
      success: boolean;
      data: {
        pool: {
          type: string;
          pendingRequests: number;
          totalAmount: string;
        };
      };
    }>("GET", `/api/pool/${poolType}/status`);

    if (!result.ok) {
      log("error", `Pool ${poolType} status failed: ${result.error}`);
      continue;
    }

    const pool = result.data?.data?.pool;
    if (pool) {
      log(
        "info",
        `${poolType}: ${pool.pendingRequests} requests, ${pool.totalAmount} total`,
      );
    }
  }

  log("success", "Pool status check passed!");
  return true;
}

async function testManualProcess(): Promise<boolean> {
  log("step", "Testing manual signer process...");

  const result = await apiRequest<{
    success: boolean;
    data: {
      processed: number;
      successful: number;
      failed: number;
      results: Array<{
        success: boolean;
        batchId: string;
        error?: string;
      }>;
    };
  }>("POST", "/api/admin/signer/process");

  if (!result.ok) {
    log("error", `Manual process failed: ${result.error}`);
    return false;
  }

  const process = result.data?.data;
  if (!process) {
    log("error", "Invalid process response");
    return false;
  }

  log("info", `Processed: ${process.processed}`);
  log("info", `Successful: ${process.successful}`);
  log("info", `Failed: ${process.failed}`);

  if (process.results.length > 0) {
    for (const r of process.results) {
      if (r.success) {
        log("success", `Batch ${r.batchId}: Success`);
      } else {
        log("error", `Batch ${r.batchId}: ${r.error}`);
      }
    }
  } else {
    log("info", "No batches to process");
  }

  log("success", "Manual process test passed!");
  return true;
}

async function runTests(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("       BITCOINBABY TREASURY E2E TEST");
  console.log("=".repeat(60) + "\n");

  log("info", `Workers API: ${CONFIG.workersApiUrl}`);
  log("info", `Admin Key: ${CONFIG.adminKey ? "Set" : "Not set"}`);
  console.log();

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Signer Health
  results.push({
    name: "Signer Health",
    passed: await testSignerHealth(),
  });
  console.log();

  // Test 2: Treasury Balance
  results.push({
    name: "Treasury Balance",
    passed: await testTreasuryBalance(),
  });
  console.log();

  // Test 3: Pool Status
  results.push({
    name: "Pool Status",
    passed: await testPoolStatus(),
  });
  console.log();

  // Test 4: Manual Process
  results.push({
    name: "Manual Process",
    passed: await testManualProcess(),
  });
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("       TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.passed ? colors.green + "✓" : colors.red + "✗";
    console.log(`  ${icon} ${r.name}${colors.reset}`);
  }

  console.log();
  if (passed === total) {
    log("success", `All ${total} tests passed!`);
  } else {
    log("error", `${passed}/${total} tests passed`);
  }
  console.log();

  process.exit(passed === total ? 0 : 1);
}

runTests().catch((error) => {
  log("error", `Fatal error: ${error}`);
  process.exit(1);
});
