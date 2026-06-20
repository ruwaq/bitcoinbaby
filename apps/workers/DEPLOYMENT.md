# Workers Deployment Guide

## Production Secrets Configuration

Before deploying to mainnet, configure these secrets using Wrangler:

```bash
cd apps/workers

# 1. REQUIRED: Admin authentication key (32+ chars)
wrangler secret put ADMIN_KEY --env production

# 2. REQUIRED: HMAC signing key for claims (32+ chars, separate from ADMIN_KEY)
wrangler secret put CLAIM_SECRET_KEY --env production

# 3. REQUIRED: Scrolls API key (from scrolls.dev)
wrangler secret put SCROLLS_API_KEY --env production

# 4. REQUIRED for withdrawals: Treasury wallet mnemonic (24 words BIP39)
wrangler secret put BATCH_WALLET_SEED --env production
```

### Secret Requirements

| Secret | Purpose | Format |
|--------|---------|--------|
| `ADMIN_KEY` | API authentication for admin endpoints | 32+ alphanumeric chars |
| `CLAIM_SECRET_KEY` | HMAC-SHA256 signing for claim proofs | 32+ alphanumeric chars |
| `SCROLLS_API_KEY` | Scrolls API access for token operations | From scrolls.dev |
| `BATCH_WALLET_SEED` | Treasury wallet for batch withdrawals | 24 word BIP39 mnemonic |

### Environment Variables (wrangler.toml)

These are set in `wrangler.toml` and should be reviewed before production:

```toml
[env.production.vars]
ENVIRONMENT = "production"           # Triggers mainnet mode
PROVER_URL = "https://v15.charms.dev"
# BABTC_APP_ID = "..."               # Set after token deployment
```

### Pre-Launch Checklist

- [ ] All secrets configured via `wrangler secret put`
- [ ] `ENVIRONMENT = "production"` set (enables mainnet)
- [ ] KV namespace `PROOF_STORE` bound and working
- [ ] Treasury address is dedicated mainnet address (not foundation)
- [ ] BABTC token deployed and APP_ID configured
- [ ] Genesis Babies NFT contract deployed
- [ ] Test claim flow on testnet4 first

---

## Current Production Version

| Version ID | Date | Description |
|------------|------|-------------|
| `d4a1964d-ee22-430e-9623-33aa12ef8c87` | 2026-03-04 | Fix API validation schema mismatch |

## Deployment History

| Version ID | Date | Description |
|------------|------|-------------|
| `d4a1964d-ee22-430e-9623-33aa12ef8c87` | 2026-03-04 13:52 UTC | Fix: Remove `{ proof }` wrapper, use timestamp instead of reward |
| `95137d20-aece-4e77-9847-84385d7ea65e` | 2026-03-04 12:55 UTC | Fix: Extended MAX_PROOF_AGE_MS to 2 hours, relaxed VarDiff enforcement |
| `22077ef3-5769-4832-81c8-7084f1b8bc05` | 2026-03-03 19:07 UTC | Previous stable version |

## How to Deploy

```bash
# Production
pnpm run deploy:production

# Check current deployment
pnpm exec wrangler deployments list --env production | tail -20
```

## Rollback

To rollback to a previous version:
```bash
pnpm exec wrangler rollback --env production
```
