# BitcoinBaby - Deployment Configuration

> **IMPORTANTE:** Este archivo contiene la configuracion centralizada de todos los deployments.
> Los secretos (mnemonics, API keys) NO deben estar aqui - ver seccion de Secrets.

## Quick Links

| Servicio | URL | Dashboard |
|----------|-----|-----------|
| **Web App** | https://bitcoinbaby.vercel.app | [Vercel](https://vercel.com/andelabs-projects/bitcoinbaby) |
| **Workers API** | https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev | [Cloudflare](https://dash.cloudflare.com) |
| **Charms Explorer** | https://explorer.charms.dev | - |
| **Mempool (testnet4)** | https://mempool.space/testnet4 | - |

---

## 1. Blockchain Configuration (Testnet4)

### BABTC Token Contract

```
App ID:     87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b
App VK:     ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6
Genesis:    b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0
Deployed:   2026-02-18 (Block ~75000)
Network:    Bitcoin Testnet4
```

### Distribution Addresses

| Proposito | Direccion | % Mining |
|-----------|-----------|----------|
| **Dev Fund** | `tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3` | 20% |
| **Staking Pool** | `tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc` | 10% |
| **Miners** | (user wallets) | 70% |

### NFT Sales Treasury

| Proposito | Direccion | Precio |
|-----------|-----------|--------|
| **NFT Treasury** | `tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu` | 50,000 sats/NFT |

---

## 2. Environment Variables

### Vercel (Web App)

```bash
# Network
NEXT_PUBLIC_NETWORK=testnet4

# BABTC Contract
NEXT_PUBLIC_BABTC_APP_ID=87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b
NEXT_PUBLIC_BABTC_APP_VK=ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6

# Distribution Addresses
NEXT_PUBLIC_DEV_FUND_ADDRESS=tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3
NEXT_PUBLIC_STAKING_POOL_ADDRESS=tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc

# Workers API
NEXT_PUBLIC_API_URL=https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev
```

### Cloudflare Workers

```bash
# Set via: wrangler secret put <KEY>
SCROLLS_API_KEY=<from Charms dashboard>
BATCH_WALLET_SEED=<12-word mnemonic for batch transactions>

# Config (in wrangler.toml)
ENVIRONMENT=production
MIN_WITHDRAW_AMOUNT=100
POOL_PERIOD_DAYS=7
MAX_FEE_RATE_SAT_VB=5
```

---

## 3. Secrets Management

### Ubicacion Segura de Secrets

Los siguientes secrets deben guardarse de forma segura (1Password, Bitwarden, etc.):

```
=== DEV_FUND WALLET ===
Mnemonic: [GUARDADO EN PASSWORD MANAGER]
Address: tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3
Path: m/86'/1'/0'/0/0

=== STAKING_POOL WALLET ===
Mnemonic: [GUARDADO EN PASSWORD MANAGER]
Address: tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc
Path: m/86'/1'/0'/0/0

=== NFT_TREASURY WALLET (Genesis Babies Sales) ===
Mnemonic: [GUARDADO EN PASSWORD MANAGER - NUNCA COMMITEAR]
Address: tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu
Path: m/86'/1'/0'/0/0
Purpose: Recibe TODOS los pagos de venta de NFTs (50,000 sats cada uno)
Note: Wallet SEPARADO de fondos operacionales de BitcoinBaby

=== BATCH WALLET (Workers) ===
Mnemonic: [GUARDADO EN PASSWORD MANAGER]
Purpose: Firma transacciones batch de withdrawal
```

### API Keys

| Servicio | Variable | Como Obtener |
|----------|----------|--------------|
| Vercel | `VERCEL_TOKEN` | [Tokens](https://vercel.com/account/tokens) |
| Cloudflare | `CF_API_TOKEN` | [API Tokens](https://dash.cloudflare.com/profile/api-tokens) |
| Charms/Scrolls | `SCROLLS_API_KEY` | [Charms Dashboard](https://charms.dev) |
| GitHub | `GH_TOKEN` | [Personal Access Tokens](https://github.com/settings/tokens) |

---

## 4. Infrastructure IDs

### Vercel

```
Org ID:      team_UekJPyZWxkq1nDVHR3VFBvnS
Project ID:  prj_u9Re0yHckkLCrlFzSjDCAIe3jsy9
Project:     bitcoinbaby
```

### Cloudflare

```
Account ID:  58f90adc571d31c4b7a860b6edef3406
Worker:      bitcoinbaby-api-prod
```

### GitHub

```
Org:         AndeLabs
Repo:        bitcoinbaby
Repo ID:     1004665668
```

---

## 5. Deployment Commands

### Web App (Vercel)

```bash
# Deploy preview
npx vercel

# Deploy production
npx vercel --prod

# Check deployments
npx vercel ls
```

### Workers (Cloudflare)

```bash
# Deploy development
cd apps/workers && npx wrangler deploy

# Deploy production
cd apps/workers && npx wrangler deploy --env production

# View logs
npx wrangler tail --env production
```

### Set Secrets

```bash
# Vercel
npx vercel env add NEXT_PUBLIC_DEV_FUND_ADDRESS

# Cloudflare
cd apps/workers && npx wrangler secret put SCROLLS_API_KEY --env production
```

---

## 6. Checklist Pre-Produccion

### Testnet4 (Current)

- [x] BABTC contract deployed
- [x] Dev Fund address configured
- [x] Staking Pool address configured
- [x] Workers API deployed
- [x] Web app deployed
- [x] CORS configured
- [ ] End-to-end mining test
- [ ] Withdrawal pool test

### Mainnet (Future)

- [ ] Security audit complete
- [ ] New mainnet addresses generated
- [ ] BABTC mainnet contract deployed
- [ ] Update all environment variables
- [ ] Enable mainnet in config
- [ ] Final testing

---

## 7. Network Endpoints

```typescript
const ENDPOINTS = {
  testnet4: {
    mempool: "https://mempool.space/testnet4/api",
    explorer: "https://mempool.space/testnet4",
    scrolls: "https://scrolls.charms.dev",
    charms: "https://explorer.charms.dev",
  },
  mainnet: {
    mempool: "https://mempool.space/api",
    explorer: "https://mempool.space",
    scrolls: "https://scrolls.charms.dev",
    charms: "https://explorer.charms.dev",
  },
};
```

---

## 8. Contactos

- **Charms Support:** https://discord.gg/charms
- **Mempool Issues:** https://github.com/mempool/mempool
- **Vercel Support:** https://vercel.com/support
- **Cloudflare:** https://dash.cloudflare.com

---

*Ultima actualizacion: 2026-02-27*
