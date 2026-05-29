# BitcoinBaby — Estado del Proyecto

**Ultima actualizacion:** 2026-05-29
**Verificado contra:** Codigo fuente real, tests, build, y auditoria de seguridad.

---

## 🟢 Componentes Verificados y Funcionales

### 1. Inferencia de IA local (PoUW)
- **Motor de IA (`packages/ai`):** Transformers.js sobre ONNX Runtime Web. SmolLM2-135M-Instruct como principal, distilgpt2 como fallback, BabyBrain procedural como ultimo recurso.
- **WebGPU:** Detectado y funcional. Generacion de texto real (~48 tokens, ~500ms).
- **Integracion con Mineria:** Loop AI en `orchestrator.ts` ejecuta tareas, emite `onAILocalTaskResolved` con proof.

### 2. Flujo NFT Mint + Evolucion
- **Reserva de Token:** `useMintNFT.ts` con `attemptId` tracking y polling exponencial.
- **Charms Prover v14:** Flujo commitTx + spellTx con reintentos (6 intentos, backoff 3-30s).
- **Evolucion Virtual (Fase 1):** Debito en VirtualBalanceDO, actualizacion Redis.
- **Evolucion On-chain (Fase 2+):** Seleccion UTXO, PSBT nivelUp, firma, broadcast.

### 3. Faucet + Balance
- **DO-First Pattern:** Durable Object como fuente de verdad, KV/Redis como cache de lectura.
- **Limites:** Rate limit 24h, cap 50 BABTC por direccion, max 100 BABTC por claim.

### 4. Billetera Local
- Generacion BIP39 + derivacion HD Taproot BIP86.
- Cifrado seguro de claves en localStorage con SecureStorage.

### 5. Seguridad
- CSP nonce-based dinamico en proxy.ts con `api.cloudflare.com` en connect-src.
- Security headers aplicados en Workers API (X-Content-Type-Options, X-Frame-Options, HSTS, X-XSS-Protection).
- Firmas Schnorr BIP340 para shares de mining.
- verifyAsync en worker (WebCrypto, no requiere @noble/hashes).
- Admin auth con comparacion constant-time en Workers.
- Rate limiting distribuido (KV + in-memory fallback).
- Sanitizacion de SVG/HTML/URLs en shared package.

### 6. Charms Contracts (testnet4)

| Contrato | App ID |
|----------|--------|
| BABTC Token | `87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b` |
| Genesis Babies NFT | `74587afb39bca62d55aeaf4bee91a571de2449495eab3486798d6abf4a939659` |

### 7. Deployment

| Ambiente | URL | Estado |
|----------|-----|--------|
| Workers Dev | `bitcoinbaby-api.andeanlabs-58f.workers.dev` | Healthy |
| Workers Prod | `bitcoinbaby-api-prod.andeanlabs-58f.workers.dev` | Healthy |
| Prover | `v14.charms.dev/ready` | OK |
| Vercel | `bitcoinbaby-andelabs-projects.vercel.app` | ❌ Deploy colgado |

---

## 🟡 Funcionalidad Parcial

- **Evolucion Virtual No Atomica:** No hay mecanismo de compensacion si Redis falla tras debito en DO
- **UTXO Cache TTL (30s):** Tras broadcast, cache local tarda hasta 30s en invalidarse
- **AI output invisible:** La AI genera texto real pero no se muestra en UI
- **Worker local no corre:** `localhost:8787` da 403 (worker no esta levantado)

---

## 🔴 Pendientes

### Bugs (pre-F10)
1. Levantar worker local o redirigir a prod
2. AI output visible en UI (se resuelve con NarrativePanel de F10.4)
3. Commitear ~80 archivos modificados (separar en commits logicos)

### ✅ Resueltos (2026-05-29 — Auditoria)
1. ~~Fix CSP Cloudflare AI~~ → `api.cloudflare.com` agregado a `connect-src` en `proxy.ts`
2. ~~Actualizar prover URL a `v14.charms.dev`~~ → Todos los archivos actualizados (scripts, wrangler.toml, DEPLOYMENT.md, codigo fuente)
3. ~~Security headers ausentes en Workers API~~ → `securityHeaders` middleware aplicado en `index.ts`
4. ~~Token Vercel OIDC en historial git~~ → Limpiado con `git filter-branch` + `git gc`
5. ~~Error de lint (Mock no usado)~~ → Corregido en `phases.test.ts`
6. ~~`.env.example` inexistente~~ → Creado `env.example` en raiz
7. ~~Tipos faltantes en `Env` (CF_AI_API_TOKEN, CF_ACCOUNT_ID)~~ → Agregados a `types.ts`

### AI World Engine (F10)
Ver [`docs/AI_WORLD_ENGINE.md`](./AI_WORLD_ENGINE.md) para el plan completo.

### Mainnet Launch (F11)
- Auditoria de seguridad final
- Deploy contratos en mainnet
- App Store + Play Store submission

---

## Cambios sin Commit (~80 archivos)

- Integracion AI PoUW (modelos, engine, baby-brain, cloudflare-ai)
- Workers API (balance, faucet, ai-credit DO)
- UI components (MiningVisualization, ModelStatusIndicator, send/receive)
- Hooks (useMining, useMiningShareSubmission, useMiningSubmitter)
- Next.js config (CSP, webpack, PWA)
- Stores (baby, mining, nft, wallet)