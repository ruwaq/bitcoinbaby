# BitcoinSparks — Mainnet Deployment Guide

**Status:** PENDING — Contracts NOT deployed to mainnet yet.

---

## Prerequisites

1. **Bitcoin mainnet funds** — You need BTC to pay for contract deployment transactions
2. **Charms CLI** installed — `cargo install charms-cli`
3. **Mainnet treasury keys** — Generate new, secure keys (never reuse testnet keys)
4. **Environment variables** — All mainnet vars configured in `.env.local`

---

## Step 1: Generate Mainnet Treasury Keys

```bash
# Generate a new mainnet wallet (do NOT reuse testnet keys)
charms wallet create --network mainnet --name spark-treasury-mainnet

# Fund this wallet with enough BTC for:
# - Contract deployment (~50K sats per contract)
# - Initial token mint for SPARK
# - NFT mint operations
```

**Important:** Store the mnemonic phrase securely. Never commit it. Set it as:
```
SPARK_TREASURY_MAINNET_MNEMONIC=<24-word-phrase>
```

---

## Step 2: Deploy SPARK Token Contract

```bash
cd packages/bitcoin/contracts/babtc

# Build the contract
charms app build

# Get the verification key
charms app vk ./target/wasm32-wasip1/release/babtc-contract.wasm
# Output: <64-char hex VK>

# Deploy to mainnet
charms app deploy \
  --network mainnet \
  --app-type t \
  --vk <VK_FROM_ABOVE> \
  --wallet spark-treasury-mainnet

# Save the output:
# - App ID: <64-char hex> (SHA256 of genesis UTXO)
# - Genesis UTXO: <txid:vout>
```

Update `packages/bitcoin/src/config/deployment.ts`:
```typescript
export const SPARK_MAINNET: DeploymentConfig = {
  network: "mainnet",
  appId: "<APP_ID_FROM_DEPLOY>",
  appVk: "<VK_FROM_BUILD>",
  genesisUtxo: "<GENESIS_UTXO_FROM_DEPLOY>",
  deploymentBlock: <BLOCK_HEIGHT>,
  isPlaceholder: false,
};
```

---

## Step 3: Deploy Genesis Sparks NFT Contract

```bash
cd packages/bitcoin/contracts/genesis-babies

# Build
charms app build

# Get VK
charms app vk ./target/wasm32-wasip1/release/genesis-babies-contract.wasm

# Deploy
charms app deploy \
  --network mainnet \
  --app-type n \
  --vk <VK_FROM_ABOVE> \
  --wallet spark-treasury-mainnet
```

Update `packages/bitcoin/src/config/testnet4.ts` (or create `mainnet.ts`):
```typescript
export const GENESIS_SPARKS_MAINNET: NFTDeploymentConfig = {
  network: "mainnet",
  appId: "<APP_ID_FROM_DEPLOY>",
  appVk: "<VK_FROM_BUILD>",
  isPlaceholder: false,
};
```

---

## Step 4: Configure Environment Variables

```bash
# .env.local (NEVER commit this file)

# Network
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_PHASE=2

# SPARK Token
NEXT_PUBLIC_SPARK_MAINNET_APP_ID=<spark-app-id>
NEXT_PUBLIC_SPARK_MAINNET_APP_VK=<spark-app-vk>

# NFT
NEXT_PUBLIC_NFT_MAINNET_APP_ID=<nft-app-id>
NEXT_PUBLIC_NFT_MAINNET_APP_VK=<nft-app-vk>

# Treasury
SPARK_TREASURY_MAINNET_ADDRESS=<treasury-btc-address>
SPARK_TREASURY_MAINNET_MNEMONIC=<24-words>
NFT_TREASURY_MAINNET_ADDRESS=<nft-treasury-address>
DEV_FUND_MAINNET_ADDRESS=<dev-fund-address>
STAKING_POOL_MAINNET_ADDRESS=<staking-address>

# Workers
NEXT_PUBLIC_WORKERS_API_URL=https://bitcoinbaby-api.andeanlabs-58f.workers.dev

# Site
NEXT_PUBLIC_SITE_URL=https://bitcoinsparks.app
```

---

## Step 5: Deploy Workers (Production)

```bash
cd apps/workers

# Update wrangler.toml [env.production.vars]:
# - BABTC_APP_ID → mainnet SPARK app ID
# - BABTC_APP_VK → mainnet SPARK VK
# - TREASURY_ADDRESS → mainnet treasury address
# - Set NFT_APP_ID and NFT_APP_VK

# Set secrets
wrangler secret put CLAIM_SECRET_KEY --env production
wrangler secret put ADMIN_KEY --env production
wrangler secret put BATCH_WALLET_SEED --env production

# Deploy
wrangler deploy --env production
```

---

## Step 6: Deploy Frontend (Vercel)

```bash
# Set env vars in Vercel dashboard:
# NEXT_PUBLIC_NETWORK=mainnet
# NEXT_PUBLIC_SPARK_MAINNET_APP_ID=...
# NEXT_PUBLIC_WORKERS_API_URL=...
# NEXT_PUBLIC_SITE_URL=https://bitcoinsparks.app

# Deploy
git push main  # CI/CD auto-deploys
```

---

## Step 7: Verify

1. Check Workers health endpoint: `GET /api/health`
2. Try minting a Genesis Spark NFT on mainnet
3. Run mining for 1 hour and verify SPARK rewards
4. Test claim flow with minimum amount
5. Test marketplace: list, buy, unlist

---

## Rollback Plan

If anything goes wrong:
1. Set `NEXT_PUBLIC_NETWORK=testnet4` in Vercel
2. Redeploy Workers with testnet4 env vars
3. Mainnet contracts remain unaffected (no state changes)

---

## Security Checklist

- [ ] Treasury mnemonics stored in hardware wallet or HSM
- [ ] No testnet keys reused for mainnet
- [ ] CLAIM_SECRET_KEY is 32+ random chars
- [ ] ADMIN_KEY is strong and unique
- [ ] All secrets set via `wrangler secret put`, never in wrangler.toml
- [ ] Mainnet addresses verified on mempool.space before use
- [ ] Small test transaction done before large amounts
- [ ] Monitoring/alerting active before public launch