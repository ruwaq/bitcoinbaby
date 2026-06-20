# BitcoinBaby — Roadmap de Desarrollo

**Ultima actualizacion:** 2026-05-28

---

## Arquitectura Objetivo

```
┌─────────────────────────────────────────────────────────────┐
│                    MONOREPO (Turborepo)                      │
├─────────────────────────────────────────────────────────────┤
│  apps/web      │  apps/workers  │  packages/*               │
│  (Next.js SSR  │  (Cloudflare   │  (95% codigo compartido)  │
│  + Capacitor)  │  Hono Workers) │                           │
└─────────────────────────────────────────────────────────────┘
```

---

## FASES COMPLETADAS (F0-F9)

### FASE 0: Monorepo Setup ✓
- [x] pnpm workspaces, Turborepo, TypeScript, ESLint + Prettier
- [x] Git + Husky hooks, CI en GitHub Actions

### FASE 1: Web App Base ✓
- [x] Next.js 16 (React 19), App Router, Tailwind CSS v4
- [x] Landing page, Vercel deployment

### FASE 2: Packages Base ✓
- [x] packages/ui (React, Tailwind, shadcn/ui)
- [x] packages/core (stores, logica de negocio)
- [x] packages/config (ESLint, Tailwind, TypeScript)

### FASE 3: Wallet Integration ✓
- [x] Generacion BIP39 + derivacion HD Taproot BIP86
- [x] SecureStorage cifrado, QR codes, import/export

### FASE 4: Mining Engine ✓
- [x] CPU/WebGPU miners, Web Workers, throttling
- [x] Hashrate display, difficulty auto-ajuste

### FASE 5: Charms Integration ✓
- [x] BABTC token (fungible) + Genesis Babies NFT
- [x] Spell V9 (PoW direct), V10 (Merkle), V11 (current)
- [x] Prover v15.charms.dev, Scrolls API
- [x] Deployed en testnet4

### FASE 6: Tamagotchi Game ✓
- [x] Baby states (sleeping, hungry, happy, learning, evolving)
- [x] Sistema de XP/level
- [x] Pixel art 8-bit (NES/SNES)

### FASE 7: AI Integration (PoUW) ✓
- [x] SmolLM2-135M via Transformers.js (WebGPU)
- [x] BabyBrain procedural fallback (zero-download)
- [x] Cloudflare Workers AI como Tier 2
- [x] Firmas Schnorr BIP340 + verifyAsync en worker

### FASE 8: Native App Setup ✓
- [x] Capacitor iOS + Android
- [x] Build scripts unificados, static export

### FASE 9: Native Features ✓
- [x] Haptics, Preferences plugins
- [x] ONNX determinista con fallback
- [x] Faucet DO-first, virtual balance, rate limits

---

## FASE 10: AI World Engine ✓ COMPLETADO (2026-05-28)

**Objetivo:** La AI genera narrativa procedural tipo Dwarf Fortress atada a cada NFT bebe. El mining construye historias.

### Arquitectura en 2 capas

```
CAPA INSTANTANEA (off-chain)  →  NarrativeEngine + NarrativeStore + UI
CAPA DE SETTLEMENT (on-chain) →  batch spells con narrativeRoot (Charms V11)
```

### Sub-fases (todas completadas)

| Sub-fase | Que | Estado |
|----------|-----|--------|
| F10.1 | NarrativeEngine + templates × baseType × bloodline | ✓ |
| F10.2 | NarrativeStore (zustand, persist, keyed by tokenId) | ✓ |
| F10.3 | Extender BabyNFTState (+narrativeRoot, +worldStateRoot) | ✓ |
| F10.4 | NarrativePanel UI (speech bubble pixel-art) | ✓ |
| F10.5 | Wire onAILocalTaskResolved → NarrativeEngine | ✓ |
| F10.6 | Progressive trait reveal desde DNA | ✓ |
| F10.7 | Batch spells V11 (narrative settlement + faction interaction) | ✓ |
| F10.8 | BYO API key settings (OpenAI/Anthropic) | ✓ |
| F10.9 | Facciones + relaciones via V11 refs | ✓ |
| F10.10 | RLHF botones A/B en NarrativePanel | ✓ |

### Archivos creados: 7 | Modificados: 6 | Tests: 27/27 | Typecheck: limpio

### Documento completo

Ver [`docs/AI_WORLD_ENGINE.md`](./AI_WORLD_ENGINE.md) para arquitectura detallada, decisiones, y plan de implementacion.

---

## FASE 11: Mainnet Launch

**Objetivo:** Produccion en Bitcoin mainnet

### Tareas
- [ ] Auditoria de seguridad final
- [ ] Deploy contratos BABTC + NFT en mainnet
- [ ] Deploy spells finales (V11)
- [ ] Configurar workers de prod con mainnet Scrolls/mempool
- [ ] iOS App Store submission
- [ ] Google Play Store submission
- [ ] Landing page final + docs de usuario

### Entregables
- Web app en Vercel con CSP nonce-based
- Apps nativas en App Store y Play Store
- BABTC y Genesis Babies live en Bitcoin mainnet

---

## Diagrama de Dependencias

```
F0 → F1 → F2 → F3 (Wallet) + F4 (Mining) + F6 (Game) + F7 (AI)
                      │
                      ▼
                 F5 (Charms)
                      │
                      ▼
              F8 (Native Setup)
                      │
                      ▼
              F9 (Native Features)
                      │
                      ▼
              F10 (AI World Engine)  ← ESTAMOS AQUI
                      │
                      ▼
              F11 (Mainnet Launch)
```

---

## Bugs Resueltos (sesion 2026-05-28)

1. **CSP Cloudflare AI** ✓ — `proxy.ts`: agregado `https://api.cloudflare.com` + `https://v15.charms.dev` en `connect-src`
2. **AI output invisible** ✓ — resuelto con NarrativePanel (F10.4) + NarrativeDebugPanel (test harness)
3. **Prover URL** ✓ — todas las referencias `v11.charms.dev` → `v15.charms.dev` (15 archivos)
4. **API key plaintext** ✓ — `partialize` excluye `apiKey` de localStorage

## Pendiente

- **Worker local 403** — worker no esta corriendo: `pnpm dev --filter @bitcoinbaby/workers`
- **~95 archivos sin commit** — separar en commits logicos