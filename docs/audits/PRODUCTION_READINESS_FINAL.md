# BitcoinBaby — Production Readiness: Complete Fix Log

**Date:** 2026-05-19
**Models:** deepseek-v4-pro:cloud (orchestrator + subagents)
**Total time:** ~2.5 hours (parallel subagents)
**Tests:** ✅ All 38 passing | **Typecheck:** ✅ Core, Bitcoin, Shared, AI, UI clean

---

## FASE 1: Seguridad — 5 fixes

| ID | Fix | Archivo |
|----|-----|---------|
| C4 | Private keys movidos a env vars con fallback documentado | `packages/bitcoin/scripts/debug-keys.ts`, `live-mining-test.ts`, `test-mint-babtc.ts` |
| C5 | `new Function()` reemplazado por `import()` con vite-ignore | `packages/core/src/mining/ai-integration.ts:147` |
| C7 | Next.js 16.1.6 → ^16.2.6 (+ eslint-config-next) | `apps/web/package.json` |
| C8 | Vercel OIDC token eliminado de .env.local | `.env.local` |
| H9 | jsonpath >=1.3.0 agregado a pnpm overrides | `package.json` |

## FASE 2: Bitcoin Transaction CRITICAL — 6 fixes

| ID | Fix | Archivo |
|----|-----|---------|
| C1 | Commit-spell atomicity: polling de confirmación con timeout 10min antes de broadcast spell | `apps/web/src/hooks/useMintNFT.ts` |
| C2 | Retry con exponential backoff (2s/4s/8s) + localStorage queue para confirmations fallidas | `apps/web/src/hooks/useMintNFT.ts`, `useEvolution.ts` |
| C3 | `validateListingSighash()` verifica SIGHASH_SINGLE\|ANYONECANPAY post-signing | `packages/bitcoin/src/marketplace/listing-service.ts`, `useMarketplace.ts` |
| C6 | `initMempoolService` return type fix + `as any` eliminado | `apps/workers/src/services/mempool-service.ts`, `routes/claim.ts` |
| C9 | Treasury mainnet addresses via env vars (`BABTC_TREASURY_MAINNET_ADDRESS`) | `packages/bitcoin/src/config/treasury.ts` |
| C10 | Claim status endpoint conectado a VirtualBalanceDO real | `apps/workers/src/routes/claim.ts` |
| C11 | Batch signer auth ya implementado (false positive) ✅ | `withdraw-pool.ts` |

## FASE 3: HIGH fixes + Modularización — 4 cambios

| ID | Fix | Archivo |
|----|-----|---------|
| H1 | Token UTXO selection: sort + smallest-sufficient | `apps/web/src/hooks/useEvolution.ts` |
| H2 | PSBT format detection: hex vs base64 (`isPsbt()`) | `apps/web/src/hooks/useEvolution.ts` |
| H3 | `finalizeAllInputs()` antes de `extractTransaction()` | `apps/web/src/hooks/useEvolution.ts` |
| H4 | Server notification con retry en marketplace | `apps/web/src/hooks/useMarketplace.ts` |
| H7 | nft.ts 2149 líneas → 39 líneas + 7 sub-routers | `routes/nft/` (reserve, confirm, evolve, listing, buy, claim, types, middleware) |
| H10 | `createSeededRandom` extraído a `lib/deterministic-random.ts` | `apps/workers/src/lib/deterministic-random.ts` |

## FASE 4: Phase 1 Implementation (Agents 1-5,7)

| Agent | Feature | Archivos |
|-------|---------|----------|
| 1 | Phase Configuration System | `packages/shared/src/config/phases.ts` (280 líneas) |
| 2 | Navigation con visibleTabs | `TabNavigation.tsx`, `AppShell.tsx` |
| 3 | BABTC Faucet Backend | `routes/faucet.ts` (rate limiting, KV, 5 BABTC/día) |
| 4 | Faucet Frontend | `useFaucet.ts`, `FaucetCard.tsx`, `WalletSection.tsx` |
| 5 | Virtual Evolution | `routes/nft/evolve.ts` (debit virtual), `useEvolution.ts` (phase-based routing) |
| 7 | Route Gating | `middleware.ts` (phaseGate), `index.ts` (claim/leaderboard/game gated) |

## FASE 5: Deploy Config + Tests

| Item | Status |
|------|--------|
| wrangler.toml — PHASE, FAUCET vars (dev + prod) | ✅ |
| .env.local — NEXT_PUBLIC_PHASE=1 | ✅ |
| pnpm install (incluye jsonpath override) | ✅ |
| typecheck — core, bitcoin, shared, ai, ui | ✅ clean |
| typecheck — workers | ⚠️ pre-existing ES target errors only |
| typecheck — web | ⚠️ pre-existing .next/types errors only |
| tests — 38/38 passing | ✅ |

---

## Arquitectura Final

```
bitcoinbaby/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── hooks/
│   │   │   ├── useMintNFT.ts         # [FIXED] commit confirmation + retry
│   │   │   ├── useEvolution.ts       # [FIXED] token UTXO + PSBT + virtual mode
│   │   │   ├── useMarketplace.ts     # [FIXED] SIGHASH verification + retry
│   │   │   └── useFaucet.ts          # [NEW] faucet claim flow
│   │   └── components/
│   │       ├── app/
│   │       │   ├── TabNavigation.tsx  # [FIXED] visibleTabs prop
│   │       │   └── AppShell.tsx      # [FIXED] phase-config driven
│   │       └── features/faucet/
│   │           └── FaucetCard.tsx     # [NEW] faucet UI
│   └── workers/                      # Cloudflare Workers API
│       ├── routes/
│       │   ├── nft.ts                # [SPLIT] 2149→39 lines
│       │   ├── nft/                  # [NEW] modular sub-routers
│       │   │   ├── reserve.ts, confirm.ts, evolve.ts
│       │   │   ├── listing.ts, buy.ts, claim.ts
│       │   │   ├── types.ts, middleware.ts
│       │   ├── faucet.ts             # [NEW] BABTC faucet endpoint
│       │   └── claim.ts              # [FIXED] type safety + status
│       ├── lib/
│       │   ├── deterministic-random.ts  # [NEW] shared seeded RNG
│       │   └── middleware.ts         # [FIXED] phaseGate added
│       └── services/
│           └── mempool-service.ts    # [FIXED] return type
├── packages/
│   ├── shared/src/config/
│   │   └── phases.ts                 # [NEW] Phase Configuration System
│   ├── bitcoin/src/
│   │   ├── marketplace/
│   │   │   └── listing-service.ts    # [FIXED] SIGHASH validation
│   │   └── config/
│   │       └── treasury.ts           # [FIXED] env var support
│   └── core/src/mining/
│       └── ai-integration.ts         # [FIXED] new Function → import
└── wrangler.toml                     # [FIXED] PHASE + FAUCET vars
```

---

## Phase 1 Verification Matrix

| Feature | Status |
|---------|--------|
| NFT Mint (on-chain) | ✅ C1, C2 fixed |
| NFT Collection | ✅ |
| NFT Marketplace (PSBT atomic swap) | ✅ C3, H4 fixed |
| BABTC Faucet (5/día, max 50) | ✅ Agents 3+4 |
| NFT Evolution (virtual) | ✅ Agent 5 |
| Navigation (phase-adaptive) | ✅ Agents 2 |
| Route gating (phaseGate) | ✅ Agent 7 |
| Mining disabled (Phase 1) | ✅ Phase config |
| Game disabled (Phase 1) | ✅ Phase config |
| Leaderboard disabled (Phase 1) | ✅ Phase config |

---

## Lo que queda (fuera del scope inmediato)

- Agent 8: Tests de phase config, faucet, route gating (nuevos tests unitarios)
- Agent 6 completo: UX polish (empty states, loading skeletons, success animations)
- Agents 9-10: Health check endpoint, documentación actualizada
- MEDIUM items: 918 console.log cleanup, 88 non-null assertions, UTXO consolidation
- Mainnet deployment: treasury addresses reales, deploy BABTC contract, fee rate ajustes
