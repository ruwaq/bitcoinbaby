# BitcoinBaby Full Codebase Audit
**Date:** 2025-05-20
**Auditor:** Hermes Agent (automated + manual review)
**Scope:** Next.js 16.2.6 frontend + Cloudflare Workers monorepo, Charms/Bitcoin testnet4 integration, NFT marketplace with PSBT atomic swaps, Faucet with BABTC tokens.
**Focus:** Bitcoin transaction flows, production deployment readiness.
**Commit:** `main@e0100ee`

---

## Executive Summary

| Category | Grade | Blocking?
|---|---|---|
| **Security** | C+ | No critical blockers; moderate Hono CVEs need patch |
| **Code Quality** | B | Good structure, console.log pollution, minor TS debt |
| **Dependencies** | C | Hono 5x moderate CVEs; must upgrade before production |
| **Infra/Config** | B | Properly configured; Vercel frontend shows "building" |
| **Performance** | B | Mining loops intentional; intervals mostly guarded |
| **Bitcoin Flows** | B | PSBT builder + validation present; atomic-swap via txid verify |

**Top 3 Risks:**
1. **Hono <4.12.12** — prototype pollution, cookie bypass, path traversal, middleware bypass (5 moderate advisories).
2. **Vercel frontend stuck on "Deployment is building"** — investigate build failure before launch.
3. **878 console.log statements** in production TS/JS — noisy logs, possible secret leakage in runtime.

---

## Phase 1: Discovery

### Structure
- **Monorepo:** pnpm workspaces with turbo
  - `apps/web` — Next.js 16.2.6 (frontend + Capacitor mobile)
  - `apps/workers` — Cloudflare Workers (Hono API, 66 source files)
  - `packages/bitcoin` — Bitcoin/Charms logic, treasury, PSBT, marketplace
  - `packages/core` — Mining, game engine, retry/rate-limit utilities
  - `packages/shared` — Config (phases, env), types, validation
  - `packages/ai` — AI integration (scaffold ~20%)
  - `packages/ui` — React components

### Git
- **Branches:** `main` active, `harsh-collard` uncommitted stash-like branch, stale night-runs
- **Status:** 43 modified + 20 untracked files. Large uncommitted audit docs in root.
- **Remotes:** github, gitlab, origin (all on `main`)

### Lines of Code
| Language | LOC |
|---|---|
| TypeScript/TSX | ~158,406 |
| JavaScript/JSX | ~1,141,063 (includes lock/bundles) |
| JSON (config) | ~2,485 |
| Markdown | ~15,264 |
| **Tests** | 49 test/spec files |

### Notable Artifacts
- `packages/bitcoin/contracts/babtc-v2/target/` — Rust build artifacts (recently added to `.gitignore` but may persist in history)
- `apps/workers/src/lib/babtc-v2-contract-binary.ts` — massive embedded WASM binary (~335KB inline TS string)
- `apps/workers/src/lib/nft-contract-binary.ts` / `babtc-contract-binary.ts` — more inline WASM binaries

---

## Phase 2: Security Scan

### Secrets & Environment Exposure
- `.env.local`, `apps/web/.env.local`, `apps/workers/.dev.vars` are **correctly gitignored**.
- No hardcoded API keys, bearer tokens, or private keys found in tracked source (regex scan negative).
- **BUT** `BATCH_WALLET_SEED` placeholder in `.dev.vars` warns: *"NEVER commit real seed"*. Good practice.

### Private Keys / Cryptographic Material
- No 64-char private hex strings in production code.
- AppId/AppVk values in `packages/bitcoin/src/config/deployment.ts` and scripts are **Charms public VKs** (not private keys). Acceptable.
- `NFT_TREASURY_TESTNET4` and `BABTC_TREASURY_TESTNET4` addresses are hardcoded in `treasury.ts` with env-var fallbacks for mainnet. Acceptable for testnet; **must set env vars before mainnet**.

### Dangerous Patterns
| File | Line | Issue |
|---|---|---|
| `packages/bitcoin/src/inscription/onchain-renderer.ts:244` | `nft.innerHTML = svg;` | XSS risk if SVG input is tainted |
| `apps/web/src/components/shared/IconBox.tsx:9` | Comment only — uses safe decode |

### CORS / Headers
- Workers CORS configured with explicit origin whitelist (`localhost:3000`, Vercel domains). No wildcard with credentials. Good.
- **Missing:** Content-Security-Policy headers in Workers or Next.js config.
- **Missing:** Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options.

### Auth / Rate Limiting
- Admin routes use **constant-time comparison** (`constantTimeEqual`) — good.
- Rate limiting middleware exists (`rateLimits.claim`, `.miningCredit`, `.general`, `.admin`).
- **Rate limiter uses in-memory `Map`** (`rateLimitMemCache`) — per-instance only. OK for Workers free tier but resets on each isolate. Redis-based fallback not active in all routes.

---

## Phase 3: Code Quality

### TypeScript
- Root `tsc --noEmit` requires explicit project file; not run during this audit due to multiple tsconfigs. CI does run `pnpm typecheck`.
- **10 usages** of `: any` across codebase (very low).
- **1 bare catch** (`catch ()`) in `packages/core/src/mining/webgpu-miner.ts:520` — minor.

### Error Handling
- Custom `AppError` with error codes exists in `packages/core/src/utils/errors.ts`.
- Retry utilities with exponential backoff present.
- **878 `console.log/warn/error/debug/info` calls** in production TS/TSX — excessive. Should migrate to structured logger or strip in production builds.

### Duplication
- Common duplicate filenames (`index.ts`, `config.ts`, `middleware.ts`) — acceptable in monorepo packages.
- No exact duplicate content detected via hash in this scan.

### Tests
- 49 test files across packages.
- Vitest configs present at root and per-package.
- Workers tests include phase-gate and faucet coverage.

---

## Phase 4: Dependencies

### Audit Results (pnpm audit)
| Severity | Package | Issue | Patch |
|---|---|---|---|
| Moderate | `hono` | Prototype pollution via `__proto__` in `parseBody({dot:true})` | >=4.12.7 |
| Moderate | `hono` | Missing cookie name validation on write | >=4.12.12 |
| Moderate | `hono` | Non-breaking space prefix bypass in `getCookie()` | >=4.12.12 |
| Moderate | `hono` | Path traversal in `toSSG()` | >=4.12.12 |
| Moderate | `hono` | Middleware bypass via repeated slashes in `serveStatic` | >=4.12.12 |
| Moderate | `brace-expansion` | Zero-step sequence hang/memory exhaustion | >=5.0.5 |

**Action:** Upgrade `hono` to `^4.12.12` (or latest). Currently on `^4.0.0`.

### Version Anomalies
- `apps/workers` uses **vitest ^4.1.0** while root and other packages use **vitest ^3.0.0**. This can cause lockfile issues or duplicate installs.
- Next.js `16.2.6` is latest stable (confirmed via npm registry) — OK.
- `pnpm overrides` in root already patches `minimatch`, `tar`, `protobufjs`, `rollup`, `undici`, `vite`, `jsonpath` — good supply-chain hygiene.

### Supply Chain Risk
- `apps/workers/src/lib/babtc-v2-contract-binary.ts` embeds a **335KB WASM binary** as a TS string constant. If this binary is compromised, supply-chain vulnerability is high because it is not built from source in CI. Recommend building Rust contract in CI and uploading artifact instead of embedding.

---

## Phase 5: Infrastructure / Config

### CI/CD (GitHub Actions)
- `.github/workflows/ci.yml` — lint, typecheck, test on push/PR to `main`/`develop`
- `.github/workflows/deploy.yml` — deploys to Vercel (web) using `secrets.VERCEL_TOKEN`
- **Missing:** Workers deployment step in CI. Workers deploy is manual (`wrangler deploy`) per `apps/workers/package.json`.
- **Missing:** No build/test for Rust contract in CI.

### Cloudflare Workers
- `wrangler.toml` — `name = "bitcoinbaby-api"`, `compatibility_date = "2025-02-01"`, `account_id` hardcoded (standard).
- KV namespace `CACHE` configured. Durable Objects: `VirtualBalanceDO`, `WithdrawPoolDO`, `GameRoomDO`.
- Cron trigger: `0 */6 * * *` (4x/day) — within free tier.

### Vercel
- Root `vercel.json` and `apps/web/vercel.json` both exist with slightly different `buildCommand`/`installCommand`. Potential conflict.
- `.vercel/project.json` present — tied to `team_UekJPyZWxkq1nDVHR3VFBvnS`.
- **Current status:** `bitcoinbaby-jlpwhdr6y-andelabs-projects.vercel.app` reportedly shows **"Deployment is building"**. This suggests a recent deploy failure or infinite build. Check Vercel dashboard logs.

### Docker
- **No Dockerfile or docker-compose** found. Workers + Vercel are serverless-native.

---

## Phase 6: Performance

### Unbounded Loops
- `while (true)` in 9 script files (`scripts/`, `packages/bitcoin/scripts/`). All are **intentional mining loops** (PoW search). Not deployed in production Workers. Acceptable.

### Polling / setInterval
- Multiple `setInterval` usages in `packages/core`:
  - `tx-tracker.ts` — polling for transaction confirmation (has `stop()` method)
  - `game/engine.ts` — tick + save intervals
  - `mining/persistence.ts` — auto-save interval
  - `mining/tab-coordinator.ts` — heartbeat
  - `hooks/useCosmic.ts`, `hooks/useGlobalMining.ts` — React-side polling
- Most are properly cleared in cleanup. Risk level: **low to moderate** (browser-side).

### N+1 Queries
- No patterns of `for (...) await` or `.map(async ...)` found in Workers routes. Redis operations are mostly atomic (`SETNX`, `GET`, `ZADD`).

### Memory Leaks
- 230 `.push()` / `.concat()` usages across codebase. None flagged as obviously unbounded in this scan, but long-running Workers isolates with Durable Objects should be monitored.

---

## Phase 7: Bitcoin Transaction Flow Deep Dive

### 1. Treasury / Funding Flow
- `packages/bitcoin/src/config/treasury.ts` defines `BABTC_TREASURY_TESTNET4` and `NFT_TREASURY_TESTNET4`.
- Defaults to hardcoded testnet4 addresses, with env-var override for mainnet.
- **Risk:** If env var is empty on mainnet, `getNFTTreasuryAddress("mainnet")` throws. Good fail-safe.

### 2. Claim Flow (Server-Assisted)
```
GET /balance/:address  → returns claimable tokens + UTXO info
POST /execute          → server builds PSBT (PsbtBuilder), returns unsigned PSBT
POST /complete         → user signs PSBT, server broadcasts
```
- `apps/workers/src/routes/claim.ts` validates taproot addresses with regex `^(bc1|tb1)[a-zA-HJ-NP-Z0-9]{25,62}$`.
- Uses `zod` schema validation. Rate-limited (`rateLimits.claim`).
- **Verification:** Mempool service checks UTXOs and fees. `estimateClaimFee` uses configurable fee rate.

### 3. NFT Marketplace (Atomic Swap via PSBT)
```
POST /nft/buy/:tokenId  → buyer provides txid
```
- Server verifies txid exists on-chain via mempool.space API.
- Uses `SETNX` on Redis to atomically claim txid and prevent double-spend/race.
- **Not a true PSBT atomic swap** in the buyer route — it is **txid-verified ownership transfer**. PSBT atomic swap logic lives in `packages/bitcoin/src/marketplace/` and `treasury-signer.ts` but is not exposed through the buy endpoint.
- **Risk:** If mempool reorg happens between verification and ownership update, state could drift. Recommend requiring 1+ confirmation before finalizing NFT transfer.

### 4. Faucet Flow
- `apps/workers/src/routes/faucet.ts` — mints virtual BABTC tokens.
- Phase-gated? Faucet is NOT gated in phase config (always available).
- Rate limit key: `faucet:claim:${address}` via Redis. Good.

### 5. Phase Gates
- `packages/shared/src/config/phases.ts` controls feature visibility.
- Workers routes gated in `apps/workers/src/index.ts`:
  - `/api/claim` → Phase 2+
  - `/api/leaderboard` → Phase 2+
  - `/api/game` → Phase 3+
  - `/api/faucet`, `/api/balance`, `/api/nft` → always open
- `apps/workers/tests/phase-gate.test.ts` validates correct gate behavior.

### 6. Mempool Service
- `apps/workers/src/services/mempool-service.ts` queries mempool.space API with KV caching.
- Cache TTL: fees 2min, UTXOs 30s, pending TX 1min, confirmed TX 10min.
- **Hardcoded endpoint:** `https://mempool.space/testnet4/api` in some scripts; Workers service likely uses same. Should be parameterized via env var for mainnet cutover.

---

## Prioritized Remediation List

| Priority | Item | Risk | Effort |
|---|---|---|---|
| **P0** | Upgrade `hono` to `>=4.12.12` | 5 moderate CVEs in auth/cookie/path traversal | Low |
| **P0** | Fix Vercel "Deployment is building" status | Frontend inaccessible | Low |
| **P1** | Strip or replace 878 console.logs with structured logger | Secret leakage, noise, log exhaustion | Medium |
| **P1** | Add CSP + security headers to Workers and Next.js | XSS / clickjacking | Low |
| **P1** | Set `MEMPOOL_API_URL` env var; remove hardcoded testnet4 URLs from Workers service | Mainnet readiness | Low |
| **P2** | Build Rust WASM contract in CI instead of embedding binary | Supply chain integrity | Medium |
| **P2** | Add Workers `wrangler deploy` step to GitHub Actions deploy.yml | Deployment automation | Low |
| **P2** | Align vitest versions across monorepo | Dependency mismatch | Low |
| **P3** | Require 1+ confirmation before NFT ownership transfer | Reorg / double-spend risk | Low |
| **P3** | Add `brace-expansion` override or upgrade path | DoS via memory exhaustion | Low |

---

## Production Deployment Readiness Checklist

- [ ] Hono upgraded to >=4.12.12
- [ ] Vercel build passes and site is live
- [ ] Workers deployed (`wrangler deploy`) with production secrets
- [ ] `BABTC_TREASURY_MAINNET_ADDRESS` and `NFT_TREASURY_MAINNET_ADDRESS` set
- [ ] `NEXT_PUBLIC_NETWORK` set to `mainnet` (if launching mainnet)
- [ ] KV namespace `CACHE` created in production Workers environment
- [ ] Redis (Upstash) tokens configured in production
- [ ] `ADMIN_KEY` and `CLAIM_SECRET_KEY` rotated for production
- [ ] Console logs stripped or redirected to external logging
- [ ] Security headers (CSP, HSTS, XFO) added
- [ ] Test suite passes (`pnpm test`)
- [ ] NFT marketplace reorg protection (1-confirmation rule) implemented

---

*End of Report*
