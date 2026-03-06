# Treasury Signer

External signing service for BitcoinBaby withdrawal batches.

## Why External?

Cloudflare Workers don't support Node.js crypto libraries needed for Bitcoin
signing. This service runs separately and:

1. Polls Workers API for ready batches
2. Submits spells to Charms Prover
3. Signs transactions with Treasury wallet
4. Broadcasts to Bitcoin network
5. Confirms with Workers API

## Setup

### 1. Install Dependencies

```bash
cd scripts/signer
pnpm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
# REQUIRED
BATCH_WALLET_SEED="your 12 or 24 word mnemonic"
ADMIN_KEY="your-workers-admin-key"

# OPTIONAL (defaults shown)
WORKERS_API_URL="https://bitcoinbaby-api.workers.dev"
CHARMS_PROVER_URL="https://prover.charms.dev"
MEMPOOL_API="https://mempool.space/testnet4/api"
RUN_ONCE="false"
```

### 3. Generate Treasury Wallet (if needed)

```bash
# Using the bitcoin package
npx tsx -e "
const bip39 = require('bip39');
console.log(bip39.generateMnemonic(128));
"
```

Store the mnemonic securely (password manager, 1Password, etc.)

## Usage

### Run Once

```bash
pnpm start:once
# or from repo root:
pnpm signer:once
```

### Continuous Polling

```bash
pnpm start
# or from repo root:
pnpm signer
```

### With Cron (Production)

Add to crontab for periodic execution:

```cron
# Run every 15 minutes
*/15 * * * * cd /path/to/bitcoinbaby && pnpm signer:once >> /var/log/signer.log 2>&1
```

## Security

- **NEVER** commit `.env` or expose the mnemonic
- Store mnemonic in secure vault (1Password, Bitwarden)
- Use environment variables in production
- Run on a secure server with limited access
- Monitor logs for suspicious activity

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Workers API    │────▶│  Treasury       │────▶│  Bitcoin        │
│  (ready batches)│     │  Signer         │     │  Network        │
│                 │◀────│  (this script)  │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       │                       │
        │                       │                       │
        │                       ▼                       │
        │               ┌─────────────────┐             │
        │               │                 │             │
        └───────────────│  Charms Prover  │◀────────────┘
                        │                 │
                        └─────────────────┘
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/signer/health` | GET | Check system health |
| `/api/pool/global/batches/ready` | GET | Get ready batches |
| `/api/pool/global/batches/{id}` | GET | Get batch details with spell |
| `/api/pool/global/batches/{id}/confirm` | POST | Confirm batch processed |

## Troubleshooting

### "Prover error: 4xx"

- Check spell format matches Charms v10/v11
- Verify BABTC app VK and genesis are correct
- Check prover service health

### "Broadcast failed"

- Ensure Treasury has enough BTC for fees
- Check transaction format
- Verify mempool API is accessible

### "Insufficient Treasury balance"

- Fund the Treasury wallet with BABTC tokens
- Use Charms CLI to mint initial tokens to Treasury

## Production Checklist

- [ ] Treasury wallet generated and stored securely
- [ ] Treasury funded with BABTC tokens
- [ ] Treasury funded with BTC for fees
- [ ] Environment variables set
- [ ] Cron job configured
- [ ] Log monitoring set up
- [ ] Alert on failures configured
