# BitcoinBaby Phase 1 — Deploy Guide

**Date:** 2026-05-19
**Status:** READY FOR DEPLOY

---

## Pre-flight Checklist

| Check | Status |
|-------|--------|
| Build (pnpm build) | ✅ 12.8s |
| Tests (pnpm test) | ✅ 1,105 passing |
| Typecheck (core, bitcoin, shared, ai, ui) | ✅ clean |
| 0 CRITICAL bugs | ✅ verified (3 rounds) |
| 0 HIGH issues | ✅ verified |
| 0 `as any` in production | ✅ |
| 0 console.log in hooks/components | ✅ |
| 0 hardcoded secrets | ✅ |
| Motion animations integrated | ✅ 4 components |
| Phase config system | ✅ |
| Faucet (backend + frontend) | ✅ |
| Virtual evolution | ✅ |
| Route gating | ✅ |

---

## Deploy Steps

### 1. Workers (Cloudflare)

```bash
cd apps/workers

# Set secrets (do once)
wrangler secret put ADMIN_KEY
wrangler secret put CLAIM_SECRET_KEY
wrangler secret put BATCH_WALLET_SEED

# Deploy
wrangler deploy

# Verify
curl https://bitcoinbaby-api.workers.dev/health
# Expected: { "status": "healthy", "environment": "production", ... }
```

Phase config in wrangler.toml:
```
PHASE = "1"
FAUCET_AMOUNT = "5"
FAUCET_MAX_TOTAL = "50"
```

### 2. Web (Vercel)

```bash
cd ../..

# Set env vars in Vercel dashboard
NEXT_PUBLIC_PHASE=1
NEXT_PUBLIC_WORKERS_API_URL=https://bitcoinbaby-api.workers.dev

# Deploy
vercel --prod
```

### 3. Verify Phase 1 features active

| Feature | URL/Check |
|---------|-----------|
| Health | GET /api/health |
| NFTs tab (default) | / → tab "NFTs" |
| Faucet | Wallet section → "Claim 5 BABTC" |
| NFT Mint | NFTs → Mint tab |
| NFT Marketplace | NFTs → Marketplace tab |
| Mining tab hidden | Should NOT see mining tab |
| Game tab hidden | Should NOT see game tab |
| Claim route gated | GET /api/claim/status/:id → 404 |

---

## Phase 1 → Phase 2 Transition

When ready to activate mining:

1. Set `NEXT_PUBLIC_PHASE=2` in Vercel
2. Set `PHASE="2"` in wrangler.toml, redeploy workers
3. Mining tab becomes visible
4. Claim routes become active
5. Leaderboard becomes active
6. Game still gated (Phase 3)

No code changes needed — just env vars.
