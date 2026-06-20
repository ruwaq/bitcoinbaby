# BitcoinBaby — Launch Readiness Assessment & Action Plan

**Date:** 2026-05-19
**Based on:** 3 auditorías paralelas + verificación vs phased-launch plan
**Audit reports:** BUG_SCAN_20260519.md, AUDIT_REPORT_20260519.md, BITCOIN_FLOW_AUDIT_20260519.md

---

## GAPS vs Phased Launch Plan

El plan `bitcoinbaby-phased-launch.md` define 10 agents para Phase 1. Esto es lo que falta:

| Agent | Descripción | Estado Actual | Gap |
|-------|-------------|---------------|-----|
| Agent 1 | Phase Configuration System | **NO EXISTE** | `packages/shared/src/config/phases.ts` no existe. `NEXT_PUBLIC_PHASE` no está definido. |
| Agent 2 | Navigation Redesign | **NO EXISTE** | Tabs no tienen `visibleTabs` prop. Mining, Token, Game tabs visibles siempre. |
| Agent 3 | BABTC Faucet Backend | **NO EXISTE** | No hay `routes/faucet.ts`. No hay rate limiting de faucet. |
| Agent 4 | Faucet Frontend | **NO EXISTE** | No hay `useFaucet.ts`, `FaucetCard.tsx`. |
| Agent 5 | Virtual Evolution | **NO EXISTE** | `POST /api/nft/evolve` no existe. `useEvolution.ts` solo usa PSBT on-chain. |
| Agent 6 | NFT Collection Polish | **PARCIAL** | Componentes existen (NFTCollectionView, NFTMarketplaceView, etc.) pero bugs listados en plan no están corregidos. |
| Agent 7 | Workers Route Gating | **NO EXISTE** | No hay `phaseGate` middleware. Todas las rutas accesibles. |
| Agent 8 | QA Integration Tests | **NO EXISTEN** | No hay tests de phase config, faucet, route gating. |
| Agent 9 | Deployment Config | **NO EXISTE** | No hay `PHASE=1` en wrangler.toml. Web `.env` no tiene `NEXT_PUBLIC_PHASE`. |
| Agent 10 | Documentation | **NO EXISTE** | Plan existe pero no implementado. |

**Conclusión:** El plan de Phase 1 está escrito pero NO implementado. El proyecto tiene la arquitectura base (web, workers, packages) con flujos Bitcoin funcionales, pero el sistema de fases, faucet, y virtual evolution no se han construido.

---

## Hallazgos Consolidados de las 3 Auditorías

### CRITICAL (11 — bloquean producción)

| # | Fuente | Hallazgo | Ubicación |
|---|--------|----------|-----------|
| C1 | FLOW | Commit-Spell atomicity roto — no wait entre broadcasts | `useMintNFT.ts:463-522` |
| C2 | FLOW | Fire-and-forget confirmations — NFT on-chain pero no indexado | `useMintNFT.ts:557-577`, `useEvolution.ts:267-278` |
| C3 | FLOW | No SIGHASH verification en seller PSBT — atomic swap roto | `listing-service.ts:132`, `useMarketplace.ts:230-234` |
| C4 | BUG | Hardcoded testnet private key en 3 scripts | `packages/bitcoin/scripts/*.ts` |
| C5 | BUG | `new Function()` code injection vector | `packages/core/src/mining/ai-integration.ts:147` |
| C6 | BUG | `mempoolService as any` en claim flow | `apps/workers/src/routes/claim.ts:284,347` |
| C7 | AUDIT | Next.js 16.1.6 con 5 HIGH CVEs | `apps/web/package.json` |
| C8 | AUDIT | Vercel OIDC token en `.env.local` | `.env.local` |
| C9 | AUDIT | Empty mainnet treasury addresses | `treasury.ts:34,74` |
| C10 | AUDIT | Claim status endpoint hardcoded "processing" | `claim.ts:402-415` |
| C11 | AUDIT | No batch signer authentication | `withdraw-pool.ts` |

### HIGH (10)

| # | Fuente | Hallazgo |
|---|--------|----------|
| H1 | FLOW | Token UTXO selection picks first, not best | 
| H2 | FLOW | Hardcoded PSBT Base64 — wallet puede devolver hex |
| H3 | FLOW | Missing `finalizeAllInputs()` en evolution |
| H4 | FLOW | Server post-marketplace notification can fail silently |
| H5 | BUG | 7 fire-and-forget API calls sin retry en useMintNFT |
| H6 | BUG | Floating promise en useEvolution y useMiningShareSubmission |
| H7 | AUDIT | nft.ts 2149 líneas — necesita split |
| H8 | AUDIT | No claim replay protection |
| H9 | AUDIT | jsonpath vulnerability via charms-js |
| H10 | AUDIT | Duplicate `createSeededRandom` en 2 archivos |

### MEDIUM (17+ combinados de las 3 auditorías)

Incluyen: 918 console.log en prod, 88 non-null assertions, 22 TODOs (1 crítico en treasury-signer), UTXO selection sin coin selection proper, hardcoded fee rates muy bajos para mainnet, sin UTXO consolidation, `getUnclaimed()` sin LIMIT, sin health check endpoint, sin monitoreo/alerting.

---

## Plan de Acción Priorizado para Producción

### SEMANA 1: Bloqueantes (CRITICAL fixes) — ~25 horas

```
Día 1-2: Seguridad y dependencias
  [ ] C4: Mover private keys a env vars + pre-commit hook
  [ ] C5: Reemplazar new Function() con dynamic import
  [ ] C7: Upgrade Next.js a >=16.2.6
  [ ] C8: Eliminar Vercel OIDC token de .env.local
  [ ] H9: Agregar jsonpath a pnpm overrides

Día 2-3: Bitcoin transaction fixes
  [ ] C1: Agregar confirmación de commit antes de spell broadcast
  [ ] C3: Verificar SIGHASH_SINGLE|ANYONECANPAY post-signing en marketplace
  [ ] C6: Fix mempoolService as any → proper interface

Día 3-4: Server-side critical
  [ ] C2: Retry + queue para server confirmations (mint y evolution)
  [ ] C10: Implementar claim status endpoint real (conectar al DO)
  [ ] C11: Agregar BATCH_SIGNER_KEY auth a withdraw-pool

Día 4-5: Mainnet readiness
  [ ] C9: Set mainnet treasury addresses via env vars
  [ ] H1-4: Arreglar token UTXO selection, PSBT format, finalizeAllInputs
  [ ] H8: Agregar address verification en claim complete
```

### SEMANA 2: Implementar Phase 1 del plan original — ~30 horas

```
Día 1-2: Phase Configuration (Agents 1, 2, 7)
  [ ] Crear packages/shared/src/config/phases.ts
  [ ] Modificar TabNavigation + AppShell para visibleTabs
  [ ] Implementar phaseGate middleware en workers
  [ ] Agregar NEXT_PUBLIC_PHASE=1 a .env

Día 3: Faucet (Agents 3, 4)
  [ ] Crear apps/workers/src/routes/faucet.ts
  [ ] Crear useFaucet.ts hook + FaucetCard.tsx
  [ ] Integrar en WalletSection
  [ ] Rate limiting 24h + max 50 BABTC

Día 4: Virtual Evolution (Agent 5)
  [ ] Crear POST /api/nft/evolve endpoint
  [ ] Modificar useEvolution.ts para soportar modo virtual
  [ ] Debitar BABTC virtual del VirtualBalanceDO

Día 5: Polish + Tests + Deploy (Agents 6, 8, 9, 10)
  [ ] Corregir bugs de NFT Collection (UTXO consolidation, listing button)
  [ ] Crear tests de phase config, faucet, route gating
  [ ] Configurar wrangler.toml + Vercel para Phase 1
  [ ] Documentación y memoria actualizada
```

### SEMANA 3-4: Hardening pre-lanzamiento — ~40 horas

```
[ ] H5-H6: Retry + error states en todos los fire-and-forget
[ ] H7: Split nft.ts en archivos separados
[ ] H10: Extraer createSeededRandom duplicado
[ ] MEDIUM: Limpiar 918 console.log → structured logger
[ ] MEDIUM: Agregar LIMIT a getUnclaimed()
[ ] MEDIUM: Hacer pruning determinístico en VirtualBalanceDO
[ ] MEDIUM: Agregar PSBT validation layer centralizada
[ ] MEDIUM: Agregar health check endpoint
[ ] MEDIUM: Implementar UTXO consolidation utility
[ ] Agregar gitleaks a CI
[ ] Agregar smoke tests post-deployment
[ ] Agregar monitoreo (Sentry o Cloudflare Analytics)
```

---

## Estado Actual del Flujo de Transacciones

| Flujo | ¿Funciona? | Issues bloqueantes | ¿Listo para prod? |
|-------|-----------|-------------------|-------------------|
| Wallet connect | ✅ Sí | Ninguno | ✅ Sí |
| NFT Mint | ⚠️ Parcial | C1 (commit-spell), C2 (confirmations) | ❌ No |
| NFT Collection view | ✅ Sí | UX polish pendiente | ⚠️ Con polish |
| NFT Marketplace list | ⚠️ Parcial | C3 (SIGHASH verification) | ❌ No |
| NFT Marketplace buy | ⚠️ Parcial | H4 (server notify), H5 (fee estimation) | ❌ No |
| NFT Evolution | ⚠️ Parcial | H1 (token UTXO), H2 (PSBT format), H3 (finalization) | ❌ No |
| BABTC Claim | ⚠️ Parcial | C6 (as any), C10 (status), H8 (replay) | ❌ No |
| Mining | ✅ Sí | Minor issues (floating promises) | ⚠️ Casi |
| Faucet | ❌ No existe | Agent 3 + 4 sin implementar | ❌ No |
| Route gating | ❌ No existe | Agent 7 sin implementar | ❌ No |

---

## Decisión Clave: ¿Phase 1 plan o fixes primero?

El plan original de Phase 1 es sólido, pero necesita ser **precedido por las fixes CRITICAL de transacciones**. Si lanzas con faucet pero las transacciones reales tienen bugs, los usuarios perderán confianza (o peor, fondos).

**Recomendación:** Ejecutar en este orden:
1. **Semana 1:** CRITICAL fixes (seguridad + Bitcoin transaction)
2. **Semana 2:** Phase 1 del plan (faucet + virtual evolution + phase config)
3. **Semana 3-4:** Hardening + tests + deploy a testnet4 con usuarios reales

---

## Próximo Paso Inmediato

Ejecutar los CRITICAL fixes de Semana 1. ¿Quieres que empiece con C1 (commit-spell atomicity) o prefieres empezar con los de seguridad (C4-C8) que son más rápidos de resolver?

---

## Archivos Generados

- `~/dev/bitcoinbaby/BUG_SCAN_20260519.md` — 439 líneas, 1,088 findings, severity-ranked
- `~/dev/bitcoinbaby/AUDIT_REPORT_20260519.md` — 502 líneas, 7 fases, 33 findings
- `~/dev/bitcoinbaby/BITCOIN_FLOW_AUDIT_20260519.md` — 506 líneas, deep trace de 4 flujos Bitcoin
- `~/dev/bitcoinbaby/LAUNCH_READINESS_20260519.md` — Este reporte consolidado
