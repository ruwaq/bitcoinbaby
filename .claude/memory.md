# BitcoinSparks — Memoria de Proyecto

**Última actualización:** 2026-06-20 (Sesión de rediseño completo)
**Branch:** `main`
**Estado:** Workers API ✅ | Vercel ❌ Colgado | Charms v15 recién lanzado | Plan 5 fases aprobado

---

## 🔥 LO MÁS IMPORTANTE AHORA

### Charms v15.0.0 salió el 15 Jun 2026
- **v15.charms.dev/ready → 200 OK** (confirmado live)
- v14 será deprecado pronto
- **Migrar YA:** cambiar `v15.charms.dev` → `v15.charms.dev`

### Renombre completo: BitcoinBaby → BitcoinSparks
- Entidad: **Spark** (antes Baby/GameBaby/BabyNFTState)
- Token: **$SPARK** (nuevo deploy, antes $BABTC)
- NFT: **Genesis Sparks** (antes Genesis Babies)
- Store: **spark-store** (unificado de baby-store + nft-store)
- Principio: **1 Spark = 1 NFT. El NFT ES el spark.**

### Plan de 5 Fases (aprobado 2026-06-20)

```
Fase 1: LIMPIAR + v15        → base limpia, prover actualizado
Fase 2: RENOMBRAR + UNIFICAR → Spark, 1 tipo, 1 store, contratos fresh
Fase 3: AI PROVIDER SYSTEM   → BYO keys (Ollama, GPT, Claude, Gemini)
Fase 4: UI HOME/EXPLORE/YOU  → 3 pantallas pixel art
Fase 5: PRODUCCIÓN           → mainnet + app stores
```

**Spec completo:** `docs/superpowers/specs/2026-06-20-bitcoinsparks-redesign.md`

---

## Resumen del Proyecto

BitcoinSparks es una plataforma gamificada de "Proof of Useful Work" sobre Bitcoin. Usuarios poseen un Spark (NFT) que evoluciona minando con AI. La AI genera narrativa procedural estilo Dwarf Fortress.

**Stack:** Next.js 16 + React 19 · Cloudflare Workers + Hono · Charms Protocol v15 · Web Workers + WebGPU · AI BYO (Ollama/OpenAI/Anthropic/Google) · Zustand · Tailwind CSS v4 · Turborepo + pnpm

```
bitcoinsparks/
├── apps/
│   ├── web/          # Next.js 16 (SSR + Capacitor mobile)
│   └── workers/       # Cloudflare Workers (Hono API + Durable Objects)
├── packages/
│   ├── bitcoin/      # Wallet, Charms, NFT, PSBT, marketplace, treasury
│   ├── core/         # Mining engine, game, spark-store (Zustand), rewards
│   ├── shared/       # Types, validation (Zod), HTTP, logging, config
│   ├── ui/           # React components pixel-art (Tailwind v4)
│   ├── ai/           # AIProvider system + NarrativeEngine
│   └── config/       # ESLint, Tailwind, TypeScript
└── docs/             # Documentación + specs + auditorías
```

---

## Plan de Acción (5 Fases)

### Fase 1: LIMPIEZA + MIGRAR v15
- Eliminar ~20 archivos muertos
- Mover auditorías sueltas a docs/audits/
- Migrar prover v14 → v15
- Commit de ~80 archivos modificados
- Fix Vercel deploy

### Fase 2: RENOMBRE COMPLETO + UNIFICAR
- Renombrar Baby → Spark en todo el codebase
- Unificar Baby + GameBaby + BabyNFTState → 1 tipo Spark
- Unificar baby-store + nft-store → spark-store
- Deploy nuevos contratos $SPARK + Genesis Sparks en testnet4
- Actualizar docs y referencias

### Fase 3: AI PROVIDER SYSTEM
- Interfaz AIProvider común
- Implementar Ollama, OpenAI, Anthropic, Google
- Storage cifrado para API keys
- Worker Proxy para APIs externas
- Settings UI para configurar provider
- Tier orchestrator con fallback

### Fase 4: UI REDESIGN
- 3 pantallas: HOME (spark + mining) | EXPLORE (marketplace) | YOU (wallet)
- Eliminar 4 tabs genéricos actuales
- Landing page separada con SEO
- Pixel art consistente NES/SNES

### Fase 5: PRODUCCIÓN
- Auditoría de seguridad final
- Deploy contratos en Bitcoin mainnet
- iOS App Store + Google Play Store
- Landing page final + docs

---

## App IDs (testnet4)

| Contrato | App ID | Estado |
|----------|--------|--------|
| BABTC Token (viejo) | `87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b` | Será reemplazado |
| Genesis Babies NFT (viejo) | `74587afb39bca62d55aeaf4bee91a571de2449495eab3486798d6abf4a939659` | Será reemplazado |
| $SPARK Token (nuevo) | TBD — deploy en Fase 2 | Pendiente |
| Genesis Sparks NFT (nuevo) | TBD — deploy en Fase 2 | Pendiente |

## URLs

| Servicio | URL | Estado |
|----------|-----|--------|
| Prover v15 | `https://v15.charms.dev` | ✅ Live |
| Prover v14 | `https://v15.charms.dev` | ⚠️ Migrar |
| Workers Dev | `bitcoinbaby-api.andeanlabs-58f.workers.dev` | ✅ |
| Vercel | `bitcoinbaby-andelabs-projects.vercel.app` | ❌ Colgado |

---

## Sesiones relacionadas

- `docs/superpowers/specs/2026-06-20-bitcoinsparks-redesign.md` — Spec de rediseño (ESTA SESIÓN)
- `docs/SESSION_2026-06-19.md` — Auditoría completa y plan anterior
- `docs/audits/` — Reports de auditorías (Mayo 2026)
- `docs/AI_WORLD_ENGINE.md` — Plan del motor de narrativa AI
- `docs/ROADMAP.md` — Roadmap de fases F0-F11 (anterior, será actualizado)
- `docs/ARCHITECTURE.md` — Arquitectura del sistema

---

## Comandos rápidos

```bash
pnpm dev                          # Todos los packages
pnpm dev --filter @bitcoinbaby/web
pnpm build && pnpm typecheck && pnpm test
pnpm --filter @bitcoinbaby/workers dev     # Workers local
```