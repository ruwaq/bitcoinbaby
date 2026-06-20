# Treasury Setup Guide

Complete guide for setting up the BitcoinBaby Treasury system for production.

## Overview

The Treasury system enables batched token withdrawals:

```
User mines → Virtual Balance → Withdraw Request → Treasury transfers tokens
```

**Components:**
1. **Treasury Wallet** - Holds BABTC tokens for distribution
2. **Workers API** - Manages withdraw pools and batches
3. **External Signer** - Signs and broadcasts transactions

## Current Configuration (Testnet4)

| Item | Value |
|------|-------|
| Treasury Address | `tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8` |
| Network | Bitcoin Testnet4 |
| BABTC App VK | `ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6` |
| BABTC Genesis | `b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0` |

## Step 1: Generate Treasury Wallet

If you need a new wallet:

```bash
pnpm --filter @bitcoinbaby/signer generate-wallet
```

This outputs:
- **Mnemonic** (12 words) - SAVE SECURELY!
- **Address** (Taproot/P2TR)

**Security:**
- Store mnemonic in password manager (1Password, Bitwarden)
- NEVER commit to git
- NEVER share via email/chat

## Step 2: Fund Treasury with BTC

Treasury needs BTC for transaction fees.

**Testnet4 Faucet:**
```bash
# Request testnet BTC
open https://mempool.space/testnet4/faucet
```

**Verify balance:**
```bash
curl https://mempool.space/testnet4/api/address/tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8
```

## Step 3: Mint Initial BABTC Tokens

Treasury needs BABTC tokens to distribute to users.

### Option A: Using Charms CLI

```bash
# Install Charms CLI
cargo install charms

# Create mint spell
cat > mint-treasury.yaml << 'EOF'
version: 11
tx:
  ins:
    - "funding_utxo:0"  # Replace with actual UTXO
  outs:
    - tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8:
        $01: 100000000000  # 1000 BABTC (8 decimals)

app_public_inputs:
  $01: null  # Transfer, no proof needed
EOF

# Submit to prover
charms prove mint-treasury.yaml --output mint-tx.json

# Sign and broadcast
charms spell cast mint-tx.json --broadcast
```

### Option B: Manual via API

```bash
# Build spell JSON
curl -X POST https://prover.charms.dev/prove \
  -H "Content-Type: application/json" \
  -d '{
    "spell": {
      "version": 10,
      "apps": { "$01": "ab70796...@b3deba..." },
      "ins": [{ "utxo_id": "txid:vout", "charms": {} }],
      "outs": [{ "tb1prrj7...": { "$01": 100000000000 } }]
    }
  }'
```

## Step 4: Configure Workers Secrets

### For Cloudflare Workers (if deployed there)

```bash
# Set secrets
wrangler secret put BATCH_WALLET_SEED --env production
# Paste: curtain increase ribbon round...

wrangler secret put ADMIN_KEY --env production
# Enter: your-secure-admin-key

# Deploy
pnpm --filter @bitcoinbaby/workers deploy:production
```

### For Vercel (current production)

Set environment variables in Vercel Dashboard:

| Variable | Value |
|----------|-------|
| `TREASURY_ADDRESS` | `tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8` |
| `BABTC_APP_VK` | `ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6` |
| `BABTC_GENESIS` | `b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0` |
| `ADMIN_KEY` | Your secure admin key |

## Step 5: Run External Signer

The signer runs separately (not in Workers) because it needs Node.js crypto.

### Local Development

```bash
# Set environment
export BATCH_WALLET_SEED="curtain increase ribbon round hockey like edge life inform heavy write flower"
export WORKERS_API_URL="http://localhost:8787"
export ADMIN_KEY="dev-admin-key"

# Run once
pnpm signer:once

# Or continuous
pnpm signer
```

### Production (Cron Job)

Add to crontab on a secure server:

```cron
# Run every 15 minutes
*/15 * * * * cd /path/to/bitcoinbaby && \
  BATCH_WALLET_SEED="..." \
  WORKERS_API_URL="https://api.bitcoinbaby.io" \
  ADMIN_KEY="..." \
  pnpm signer:once >> /var/log/signer.log 2>&1
```

### Production (PM2)

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'treasury-signer',
    script: 'pnpm',
    args: 'signer',
    cwd: '/path/to/bitcoinbaby',
    env: {
      BATCH_WALLET_SEED: '...',
      WORKERS_API_URL: 'https://api.bitcoinbaby.io',
      ADMIN_KEY: '...'
    }
  }]
};

pm2 start ecosystem.config.js
```

## Step 6: Verify Setup

### Check Signer Health

```bash
curl -H "X-Admin-Key: your-key" \
  https://api.bitcoinbaby.io/api/admin/signer/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "treasuryAddress": "tb1prrj7...",
    "treasuryBalance": "100000000000",
    "configuredForSigning": true,
    "scrollsApiAvailable": true,
    "readyBatchCount": 0,
    "message": "Ready to process 0 batches"
  }
}
```

### Check Treasury Balance

```bash
curl -H "X-Admin-Key: your-key" \
  https://api.bitcoinbaby.io/api/admin/treasury/balance
```

### Trigger Manual Processing

```bash
curl -X POST -H "X-Admin-Key: your-key" \
  https://api.bitcoinbaby.io/api/admin/signer/process
```

## Troubleshooting

### "Treasury has no tokens"

1. Mint BABTC tokens to treasury address
2. Wait for confirmation (1-2 blocks)
3. Check balance via Scrolls API

### "Scrolls API unavailable"

1. Check Scrolls service status
2. Verify SCROLLS_API_KEY is set
3. Try alternative endpoint

### "Prover error"

1. Check spell format (V10/V11)
2. Verify UTXO exists
3. Check prover service health

### "Broadcast failed"

1. Ensure Treasury has BTC for fees
2. Check mempool API accessibility
3. Verify transaction format

## Security Checklist

- [ ] Mnemonic stored in password manager
- [ ] Mnemonic NOT in git
- [ ] ADMIN_KEY is strong and unique
- [ ] Signer runs on secure server
- [ ] Logs don't contain sensitive data
- [ ] Alerts configured for failures

## Flow Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    User     │───▶│  Workers    │───▶│   Signer    │
│  (mining)   │    │   (API)     │    │  (Node.js)  │
└─────────────┘    └─────────────┘    └──────┬──────┘
                          │                   │
                          ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │  Withdraw   │    │   Charms    │
                   │    Pool     │    │   Prover    │
                   └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  Bitcoin    │
                                      │  Network    │
                                      └─────────────┘
```
