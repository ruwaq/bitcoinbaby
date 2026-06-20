# BitcoinBaby - Credenciales Testnet4

> **IMPORTANTE:** Este archivo contiene credenciales reales. NO subir a repositorios publicos.
> Ultima actualizacion: 2024-03-06

## Cloudflare (andeanlabs)

| Key | Value |
|-----|-------|
| Account ID | `58f90adc571d31c4b7a860b6edef3406` |
| API Token (read-only) | `zMmSa2x59iRRQEoklmVQKtJRbyKPps43shRmU1Rk` |
| API Token (full-access) | `mCQFo2VTXfVEgj8KWDI9VqFAM41I2F4VLgEp9XcB` |
| Tunnel ID | `5fced6cf-92eb-4167-abd3-d0b9397613cc` |

## Workers Secrets (Production)

Configurar via: `pnpm wrangler secret put <NAME> --env production`

| Secret | Value | Uso |
|--------|-------|-----|
| `ADMIN_KEY` | `bitcoinbaby-admin-2024` | Endpoints admin, reset sistema |
| `UPSTASH_REDIS_REST_URL` | *pendiente* | Redis para leaderboards |
| `UPSTASH_REDIS_REST_TOKEN` | *pendiente* | Redis auth |
| `BATCH_WALLET_SEED` | *pendiente* | Wallet para batch withdrawals |

## BABTC Token (Testnet4)

| Config | Value |
|--------|-------|
| APP_ID | `87b5ecfb4c8e2d5f3a6e9b1c7d4f2a8e5b3c6d9f1a4e7b2c5d8f3a6e9b1c7d4f` |
| APP_VK | `ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6` |
| Genesis | `b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0` |
| Treasury | `tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8` |

## URLs de Produccion

| Servicio | URL |
|----------|-----|
| Workers API (prod) | `https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev` |
| Workers API (dev) | `https://bitcoinbaby-api.andeanlabs-58f.workers.dev` |
| Charms Prover | `https://prover.charms.dev` |
| Scrolls API | `https://scrolls.charms.dev` |
| Mempool (testnet4) | `https://mempool.space/testnet4/api` |

## Comandos Utiles

```bash
# Ver secrets configurados
pnpm wrangler secret list --env production

# Configurar un secret
pnpm wrangler secret put ADMIN_KEY --env production

# Deploy a produccion
pnpm wrangler deploy --env production

# Reset completo del sistema
curl -X DELETE "https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev/api/admin/full-system-reset" \
  -H "X-Admin-Key: bitcoinbaby-admin-2024"
```

## Pendientes por Configurar

- [ ] Upstash Redis (crear cuenta y obtener credenciales)
- [ ] BATCH_WALLET_SEED (generar wallet seguro para treasury)
- [ ] SCROLLS_API_KEY (si se requiere autenticacion)
- [ ] Deploy contrato BABTC V2 y actualizar APP_ID/APP_VK reales
