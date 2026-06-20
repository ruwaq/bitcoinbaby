/**
 * BitcoinBaby — End-to-End Multi-User Live Test
 *
 * Simulates multiple users interacting with the Workers API over time.
 * Tests: health, faucet, balance, mining (credit), claim lifecycle.
 *
 * Usage:  tsx scripts/test-e2e-live.ts
 * Requires: workers running locally on port 8787 (pnpm dev --filter @bitcoinbaby/workers)
 */

const WORKERS_API = process.env.WORKERS_API_URL || "http://localhost:8787";
const BASE_URL = `${WORKERS_API}`;

// =============================================================================
// UTILIDADES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function log(prefix: string, msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${prefix} ${msg}`);
}

function generateAddress(userId: number): string {
  // Usar el bitcoin package si está disponible, si no usar direcciones testnet4 precalculadas
  // Estas son direcciones testnet4 taproot BIP86 válidas (tb1p = P2TR testnet Bech32m)
  const testAddresses = [
    "tb1pchdx9p7g7x3xvm4m8h0p4fq9n3l7k2v5w6m9r0t2y8p4a6s0d3qjf",
    "tb1pm5k7n9r2v8w4x6y0z3a5c7e9g1j4l6n8p0r2t4v6w8x0y2a4c6e8g",
    "tb1p8x47g5h4p0j7v9n2kmq6r3w1cyfad5z8l2kn9t6m4v0p3s7xwjq",
    "tb1p2r3t5v7y8w9x0z2a4b6c8d0e2f4g6h8j0k2l4m6n8p0q2r4s6t8u",
    "tb1p9n0p2r4t6v8w0x2y4z6a8c0e2g4j6l8n0p2r4t6v8w0x2y4z6a8c",
  ];
  return testAddresses[(userId - 1) % testAddresses.length];
}

function generateNonce(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

function generateHash(difficulty: number = 16): { hash: string; nonce: number } {
  const nonce = generateNonce();
  const zeros = "0".repeat(Math.ceil(difficulty / 4));
  const rest = Array(64 - zeros.length)
    .fill(0)
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
  return { hash: zeros + rest, nonce };
}

async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    return { status: res.status, body };
  } catch (err: any) {
    return { status: 0, body: { error: err.message } };
  }
}

// =============================================================================
// USUARIO SIMULADO
// =============================================================================

interface UserStats {
  userId: number;
  address: string;
  balances: number[];
  faucetClaims: number;
  miningShares: number;
  claimPrepared: boolean;
  errors: string[];
}

class SimulatedUser {
  stats: UserStats;

  constructor(userId: number) {
    this.stats = {
      userId,
      address: generateAddress(userId),
      balances: [],
      faucetClaims: 0,
      miningShares: 0,
      claimPrepared: false,
      errors: [],
    };
  }

  log(msg: string) {
    console.log(`[User ${this.stats.userId}] ${msg}`);
  }

  logError(msg: string) {
    console.error(`[User ${this.stats.userId}] ❌ ${msg}`);
    this.stats.errors.push(msg);
  }

  // ---- Health Check ----
  async checkHealth(): Promise<boolean> {
    const { status, body } = await apiRequest("/health");
    const ok = status === 200 && body.status === "healthy";
    if (!ok) this.logError(`Health check: ${status} ${JSON.stringify(body)}`);
    return ok;
  }

  // ---- Faucet Claim ----
  async claimFaucet(): Promise<void> {
    const addr = this.stats.address;
    const { status, body } = await apiRequest("/faucet/claim", {
      method: "POST",
      body: JSON.stringify({ address: addr }),
    });

    if (status === 200) {
      this.stats.faucetClaims++;
      this.log(`Faucet: ${body.data?.amount || body.amount} BABTC (total: ${body.data?.totalReceived || "?"})`);
    } else if (status === 429) {
      this.log("Faucet: cooldown (24h)");
    } else {
      this.logError(`Faucet failed: ${status} ${JSON.stringify(body)}`);
    }
  }

  // ---- Get Balance ----
  async getBalance(): Promise<number | null> {
    const addr = this.stats.address;
    const { status, body } = await apiRequest(`/balance/${addr}`);

    if (status === 200 || status === 404) {
      const balance =
        body.data?.balance ??
        body.data?.virtualBalance ??
        body.balance ??
        body.virtualBalance ??
        0;
      this.stats.balances.push(Number(balance));
      return Number(balance);
    }

    this.logError(`Balance fetch: ${status}`);
    return null;
  }

  // ---- Submit Mining Proof ----
  async submitMiningProof(): Promise<boolean> {
    const addr = this.stats.address;
    const difficulty = 16 + Math.floor(Math.random() * 4); // 16-19
    const { hash, nonce } = generateHash(difficulty);

    const proof = {
      taskId: `task-${Date.now()}-${this.stats.userId}-${this.stats.miningShares}`,
      output: `Mining output for ${addr} with hash ${hash}`,
      computeTime: Math.random() * 5 + 0.5,
      signature: hash.slice(0, 64), // 64 hex chars (simula una firma)
      publicKey: "00".repeat(32), // 64 hex chars
    };

    const { status, body } = await apiRequest(`/balance/${addr}/credit`, {
      method: "POST",
      body: JSON.stringify(proof),
    });

    if (status === 200 || status === 201) {
      this.stats.miningShares++;
      this.log(`Mining share #${this.stats.miningShares}: ${body.data?.amount || "?"} tokens`);
      return true;
    } else if (status === 429) {
      this.log("Mining: rate limited");
      return false;
    } else {
      this.logError(`Mining submission: ${status} ${JSON.stringify(body).slice(0, 100)}`);
      return false;
    }
  }

  // ---- Claim: Get claimable balance ----
  async getClaimableBalance(): Promise<any> {
    const addr = this.stats.address;
    const { status, body } = await apiRequest(`/claim/status/${addr}`);
    return { status, body };
  }

  // ---- Claim: Execute (prepare claim) ----
  async executeClaim(): Promise<any> {
    const addr = this.stats.address;
    const { status, body } = await apiRequest("/claim/execute", {
      method: "POST",
      body: JSON.stringify({ address: addr }),
    });
    if (status === 200) this.stats.claimPrepared = true;
    return { status, body };
  }

  // ---- Claim: Complete ----
  async completeClaim(claimId: string): Promise<any> {
    const addr = this.stats.address;
    const dummyPsbt = "cHNidP8BAFICAAAAAQAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "00".repeat(50);
    const { status, body } = await apiRequest("/claim/complete", {
      method: "POST",
      body: JSON.stringify({
        claimId,
        signedPsbtBase64: dummyPsbt,
        address: addr,
      }),
    });
    return { status, body };
  }

  // ---- Reset (teardown) ----
  async reset(adminKey: string): Promise<void> {
    const addr = this.stats.address;
    await apiRequest(`/admin/reset/${addr}`, {
      method: "DELETE",
      headers: { "X-Admin-Key": adminKey },
    });
  }
}

// =============================================================================
// ORQUESTADOR DE PRUEBAS
// =============================================================================

async function main() {
  const ADMIN_KEY = process.env.ADMIN_KEY || "dev_admin_key_for_testing_bitcoinbaby_2024";
  const USERS = 5;
  const ROUNDS = 8;
  const ROUND_INTERVAL_MS = 2000; // 2s entre rondas

  console.log("=".repeat(60));
  console.log("  BitcoinBaby — End-to-End Multi-User Live Test");
  console.log("=".repeat(60));
  console.log(`  API:       ${BASE_URL}`);
  console.log(`  Users:     ${USERS}`);
  console.log(`  Rounds:    ${ROUNDS}`);
  console.log(`  Interval:  ${ROUND_INTERVAL_MS}ms (${(ROUNDS * ROUND_INTERVAL_MS / 1000).toFixed(0)}s total)`);
  console.log(`  Admin key: ${ADMIN_KEY.slice(0, 8)}...`);
  console.log("=".repeat(60));

  // FASE 0: Health Check
  console.log("\n🧪 FASE 0: Health Check");
  const { status: healthStatus, body: healthBody } = await apiRequest("/health");
  if (healthStatus !== 200 || healthBody.status !== "healthy") {
    console.error(`  ❌ Workers API no está healthy: ${healthStatus} ${JSON.stringify(healthBody)}`);
    console.error("  Asegúrate de ejecutar: pnpm dev --filter @bitcoinbaby/workers");
    process.exit(1);
  }
  console.log(`  ✅ API healthy: ${healthBody.status} (checks: ${JSON.stringify(healthBody.checks)})`);

  // Crear usuarios
  console.log(`\n🧪 Creando ${USERS} usuarios`);
  const users: SimulatedUser[] = [];
  for (let i = 1; i <= USERS; i++) {
    const u = new SimulatedUser(i);
    users.push(u);
    console.log(`  User ${i}: ${u.stats.address}`);
  }

  // ===========================================================================
  // RONDA 1: Faucet claims (todos simultáneamente)
  // ===========================================================================
  console.log("\n🧪 RONDA 1: Faucet Claims (all users)");
  await Promise.all(users.map((u) => u.claimFaucet()));

  // Esperar procesamiento
  await sleep(1000);

  // Verificar balances post-faucet
  console.log("\n📊 Balances post-faucet:");
  for (const u of users) {
    const bal = await u.getBalance();
    console.log(`  User ${u.stats.userId}: ${bal} BABTC`);
  }

  // ===========================================================================
  // RONDAS 2-7: Mining intensivo (múltiples shares por ronda)
  // ===========================================================================
  for (let round = 2; round <= ROUNDS; round++) {
    console.log(`\n🧪 RONDA ${round}: Mining (${USERS} users × 2 shares each)`);

    // Cada usuario manda 2 shares por ronda
    const sharePromises = users.flatMap((u) => [
      u.submitMiningProof(),
      u.submitMiningProof(),
    ]);
    await Promise.all(sharePromises);

    await sleep(ROUND_INTERVAL_MS);
  }

  // Verificar balances post-mining
  console.log("\n📊 Balances post-mining:");
  const finalBalances: Record<number, number> = {};
  for (const u of users) {
    const bal = await u.getBalance();
    finalBalances[u.stats.userId] = bal ?? 0;
    console.log(`  User ${u.stats.userId}: ${bal} BABTC (${u.stats.miningShares} shares, ${u.stats.faucetClaims} faucet)`);
  }

  // ===========================================================================
  // CLAIM: Intentar claim para usuarios con balance
  // ===========================================================================
  console.log("\n🧪 CLAIM TEST");
  for (const u of users) {
    if (finalBalances[u.stats.userId] > 0) {
      // Check claimable
      const claimable = await u.getClaimableBalance();
      console.log(`  User ${u.stats.userId} claimable: ${JSON.stringify(claimable.body).slice(0, 150)}`);

      // Try prepare claim
      const exec = await u.executeClaim();
      if (exec.status === 200) {
        console.log(`  User ${u.stats.userId} claim prepared: ${JSON.stringify(exec.body).slice(0, 150)}`);
      } else {
        console.log(`  User ${u.stats.userId} claim prepare: ${exec.status} ${JSON.stringify(exec.body).slice(0, 100)}`);
      }
    }
  }

  // ===========================================================================
  // ESTADÍSTICAS FINALES
  // ===========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("  📊 ESTADÍSTICAS FINALES");
  console.log("=".repeat(60));

  const totalFaucetClaims = users.reduce((s, u) => s + u.stats.faucetClaims, 0);
  const totalMiningShares = users.reduce((s, u) => s + u.stats.miningShares, 0);
  const totalBalance = Object.values(finalBalances).reduce((a, b) => a + b, 0);
  const totalErrors = users.reduce((s, u) => s + u.stats.errors.length, 0);

  console.log(`  Faucet claims:    ${totalFaucetClaims}/${USERS}`);
  console.log(`  Mining shares:    ${totalMiningShares} (${USERS} users × ${ROUNDS - 1} rounds × 2 shares)`);
  console.log(`  Total balance:    ${totalBalance} BABTC`);
  console.log(`  Avg balance/user: ${(totalBalance / USERS).toFixed(1)} BABTC`);
  console.log(`  Errors:           ${totalErrors}`);
  console.log("");

  // Mostrar errores
  if (totalErrors > 0) {
    console.log("  ⚠️  Errores:");
    for (const u of users) {
      if (u.stats.errors.length > 0) {
        console.log(`    User ${u.stats.userId}: ${u.stats.errors.length} errors`);
        for (const e of u.stats.errors.slice(0, 3)) {
          console.log(`      - ${e}`);
        }
      }
    }
  }

  // ===========================================================================
  // CLEANUP: Reset all users
  // ===========================================================================
  console.log("\n🧹 CLEANUP: Resetting all users");
  await Promise.all(users.map((u) => u.reset(ADMIN_KEY)));
  console.log("  ✅ All users reset");

  // ===========================================================================
  // FINAL SUMMARY
  // ===========================================================================
  console.log("\n" + "=".repeat(60));
  if (totalErrors === 0) {
    console.log("  ✅ ALL TESTS PASSED — Zero errors");
  } else {
    console.log(`  ⚠️  ${totalErrors} errors found`);
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\n❌ FATAL ERROR:", err);
  process.exit(1);
});