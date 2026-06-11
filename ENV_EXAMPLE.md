# BitcoinBaby — Environment Variables

> Rename this file to `.env.example` after reviewing.
> Copy to `.env.local` and fill in the values.
> **NEVER commit `.env.local` or real secrets to the repository.**

---

## FRONTEND (apps/web)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_WORKERS_API_URL` | Workers API URL | `http://localhost:8787` |
| `NEXT_PUBLIC_NETWORK` | Bitcoin network | `testnet4` |
| `NEXT_PUBLIC_PHASE` | Feature phase (1-3) | `2` |
| `NEXT_PUBLIC_DEV_FUND_ADDRESS` | Dev fund address (testnet) | — |
| `NEXT_PUBLIC_STAKING_POOL_ADDRESS` | Staking pool address (testnet) | — |

## BACKEND (apps/workers) — Set via `wrangler secret put`

| Secret | Description |
|--------|-------------|
| `UPSTASH_REDIS_REST_URL` | Redis URL for leaderboard cache |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `SCROLLS_API_KEY` | Charms Scrolls API key |
| `BATCH_WALLET_SEED` | Mnemonic for batch tx signing (**NEVER commit!**) |
| `TREASURY_ADDRESS` | Address holding BABTC for batch transfers |
| `FOUNDATION_ADDRESS` | Address receiving 20% platform fee |
| `CLAIM_SECRET_KEY` | HMAC key for claim proofs (32+ chars) |
| `ADMIN_KEY` | Admin API key for protected endpoints |

## CI/CD (GitHub Actions Secrets)

| Secret | Description |
|--------|-------------|
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `VERCEL_TOKEN` | Vercel deploy token |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |