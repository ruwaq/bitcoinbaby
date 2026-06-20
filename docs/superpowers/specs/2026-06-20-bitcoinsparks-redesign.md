# BitcoinSparks — Spec de Rediseño Completo

**Fecha:** 2026-06-20
**Estado:** Aprobado, pendiente implementación
**Basado en:** Auditoría completa 2026-06-19 + investigación de naming + análisis BRO token

---

## Resumen Ejecutivo

El proyecto actual (BitcoinBaby) sufre de 3 problemas raíz:

1. **Nombre forzado** — "baby" no refleja la mecánica real (minería PoUW + AI narrativa). Crea disonancia con el público crypto y no escala a niveles altos.
2. **3 definiciones duplicadas** — `Baby`, `GameBaby`, `BabyNFTState` con 3 stores separados (`baby-store`, `nft-store`, `narrative-store`).
3. **AI rígida** — solo usa Gemma local (~80MB). No permite que el usuario traiga su propio modelo (Ollama, ChatGPT, Claude, Gemini).

Este spec define el plan para resolver los 3 problemas y llevar el proyecto a producción en Bitcoin mainnet.

---

## Arquitectura Objetivo

```
BitcoinSparks (antes BitcoinBaby)
├── apps/web/          # Next.js 16 + Capacitor
├── apps/workers/      # Cloudflare Workers + Hono
├── packages/
│   ├── ui/            # Componentes pixel-art
│   ├── core/          # Mining engine + spark-store + game loop
│   ├── bitcoin/       # Wallet, Charms, NFT, PSBT
│   ├── ai/            # AIProvider system + NarrativeEngine
│   ├── shared/        # Types, validation, HTTP, logging
│   └── config/        # ESLint, Tailwind, TypeScript
└── docs/              # Documentación + specs + auditorías
```

**Nuevo nombre:** BitcoinSparks
**Entidad canónica:** Spark (tipo unificado)
**Token:** $SPARK (nuevo deploy en testnet4, luego mainnet)
**NFT Collection:** Genesis Sparks

---

## Fase 1: Limpieza + Migrar Charms v15

**Objetivo:** Base limpia. ~80 archivos sin commit, archivos muertos, prover v14 deprecado.

### 1.1 Archivos a eliminar

| Archivo | Acción |
|---------|--------|
| `.aider.*` (4 archivos) | Commitear delete |
| `.litellm.pid` | Commitear delete |
| `app-metadata.json` | Commitear delete |
| `DEPLOYMENT.md`, `DEPLOY_PHASE1.md` (root) | Commitear delete |
| `ENV_EXAMPLE.md` (root) | Commitear delete |
| `implementation_plan.md`, `task.md` | Commitear delete |
| `mining_page.png` | Commitear delete |
| `scratch/` | Commitear delete |
| `~` directorio | Eliminar |
| `~/.aider/` | Eliminar |
| `packages/bitcoin/src/charms/versions/v9/` | Eliminar |
| `packages/bitcoin/src/charms/versions/v10/` | Eliminar |
| `packages/bitcoin/scripts/test-v9-flow.ts` | Eliminar |
| `apps/web/src/fonts/*.woff2` (7 huérfanos) | Eliminar |

### 1.2 Migrar v14 → v15

Buscar y reemplazar `v14.charms.dev` → `v15.charms.dev` en todo el codebase.
Verificar scripts, wrangler.toml, y DEPLOYMENT.md de workers.

### 1.3 Fix Vercel

Revisar `next.config.ts` — posible causa: build colgado por WASM/webpack resolver.
Limpiar cache Vercel y redeploy.

### 1.4 Commits

```
chore: remove dead files, legacy artifacts, and orphan fonts
chore: migrate Charms prover from v14 to v15
fix: resolve Vercel deployment hang
```

---

## Fase 2: Renombre Completo + Unificar Tipos

**Objetivo:** Eliminar "baby" de todo el codebase. Un solo tipo `Spark`, un solo store `spark-store`. Contratos fresh.

### 2.1 Cambio de nombre completo

| Capa | Antes | Ahora |
|------|-------|-------|
| Proyecto | BitcoinBaby | **BitcoinSparks** |
| Token | $BABTC | **$SPARK** (nuevo deploy) |
| NFT | Genesis Babies | **Genesis Sparks** (nuevo deploy) |
| Entidad | Baby / GameBaby / BabyNFTState | **Spark** (tipo unificado) |
| Store | baby-store / nft-store | **spark-store** (unificado) |
| UI | BabyAvatar, BabySprite, etc. | **SparkAvatar**, **SparkSprite**, etc. |

### 2.2 Tipo unificado Spark

```typescript
interface Spark {
  // Identidad
  id: string;
  name: string;
  tokenId: string;

  // DNA on-chain
  dna: string;
  bloodline: Bloodline;
  baseType: BaseType;
  rarity: Rarity;

  // Estado de juego
  state: SparkState;  // idle | mining | evolving | resting
  level: number;      // 1-21
  xp: number;
  stats: SparkStats;  // strength, intelligence, agility, charm

  // Volátil off-chain
  mood: number;       // 0-100
  energy: number;     // 0-100

  // Narrativa on-chain
  narrativeRoot: string;
  worldStateRoot: string;

  // Metadata
  owner: string;
  createdAt: number;
  lastMinedAt: number;
}
```

### 2.3 Store unificado

`spark-store.ts` reemplaza `baby-store.ts` y `nft-store.ts`:
- `sparks: Spark[]` — todos los sparks del usuario
- `activeSpark: Spark | null` — el spark seleccionado
- `mintSpark()`, `evolveSpark()`, `updateStats()`
- `getNarrative()` delega a narrative-store

### 2.4 Contratos fresh en testnet4

- Deploy nuevo token `$SPARK` (nuevo App ID)
- Deploy nueva colección `Genesis Sparks` (nuevo App ID)
- Contratos viejos quedan como historical

### 2.5 Commits

```
refactor: rename Baby → Spark across all types and interfaces
refactor: unify baby-store + nft-store → spark-store
refactor: rename UI components Baby* → Spark*
refactor: update all docs and references to BitcoinSparks
feat: deploy SPARK token and Genesis Sparks NFT on testnet4
```

---

## Fase 3: AI Provider System + BYO Keys

**Objetivo:** El usuario conecta su propio modelo AI (Ollama, ChatGPT, Claude, Gemini). Igual que ZCode/OpenCode.

**Prioridad:** API-first. Modelos locales (Gemma, Cloudflare, procedural) van al futuro.

### 3.1 Arquitectura

```
AIProvider (interfaz común)
├── OllamaProvider      ← HTTP directo a localhost (sin proxy)
├── OpenAIProvider      ← vía Worker Proxy
├── AnthropicProvider   ← vía Worker Proxy
├── GoogleProvider      ← vía Worker Proxy
└── (futuro) LocalProvider, CloudflareProvider, ProceduralProvider

Tier Orchestrator: BYO key → fallback "conecta un provider"
Response Normalizer: unifica formatos de respuesta
Worker Proxy (/api/ai/proxy): inyecta API key server-side, rate limiting
```

### 3.2 Seguridad

- API keys cifradas con seed de wallet (mismo mecanismo que SecureStorage)
- Nunca en localStorage en plaintext
- Worker Proxy forwardea a APIs externas sin exponer keys al cliente
- Rate limiting por usuario en el proxy

### 3.3 Settings UI

Dropdown de provider, campo API key enmascarado, selector de modelo, botón "Test Connection".

### 3.4 Commits

```
feat(ai): define AIProvider interface and provider registry
feat(ai): implement OpenAI, Anthropic, Google, Ollama providers
feat(ai): add encrypted API key storage
feat(workers): add AI proxy route for external providers
feat(ai): implement tier orchestrator with fallback
feat(ui): add AI provider settings panel
feat(ai): wire NarrativeEngine to AIProvider system
```

---

## Fase 4: UI Redesign — HOME | EXPLORE | YOU

**Objetivo:** Reemplazar 4 tabs genéricos por 3 pantallas con propósito claro. Pixel art 8-bit.

### 4.1 Las 3 pantallas

| Pantalla | Contenido |
|----------|-----------|
| **HOME** | Spark full-screen (pixel art animado), mining integrado, narrativa en speech bubble, stats compactos |
| **EXPLORE** | Marketplace de Sparks, otros sparks online, facciones, eventos globales, leaderboard |
| **YOU** | Wallet (balance $SPARK, dirección), colección de sparks, settings (AI, red, seguridad), historial |

### 4.2 Navegación

Bottom tab bar: `[⚡ HOME] [🔍 EXPLORE] [👤 YOU]`

### 4.3 Principio de diseño

- Inspirado en Dwarf Fortress: profundidad de simulación, no complejidad de UI
- Pixel art NES/SNES consistente
- El spark SIEMPRE visible en HOME (es el centro de la experiencia)
- Narrativa procedural visible, no escondida en logs

### 4.4 Commits

```
feat(ui): implement 3-tab navigation (HOME/EXPLORE/YOU)
feat(ui): HOME screen with Spark full-screen + integrated mining
feat(ui): EXPLORE screen with marketplace and world view
feat(ui): YOU screen with wallet, collection, and settings
feat(ui): landing page with SEO for web target
```

---

## Fase 5: Producción & Mainnet Launch

**Objetivo:** Deploy en Bitcoin mainnet, apps en stores, proyecto vivo.

### 5.1 Checklist

| Tarea | Descripción |
|-------|-------------|
| 🔐 Auditoría final | Revisión de seguridad pre-mainnet |
| ⛓️ Deploy mainnet | $SPARK + Genesis Sparks en Bitcoin mainnet |
| ⚡ Workers prod | Configurar mainnet Scrolls, mempool.space |
| 🌐 Vercel prod | Dominio propio, SSL, CDN |
| 📱 App Store | iOS submission |
| 📱 Play Store | Google Play submission |
| 📄 Landing page | SEO, docs de usuario, onboarding |
| 📊 Monitoreo | Logs, errores, analytics |
| 🧪 Smoke tests | Flujo completo: wallet → mint → mine → evolve |

### 5.2 Commits

```
chore: production configuration for mainnet deployment
feat: deploy SPARK token and Genesis Sparks to mainnet
chore: App Store and Play Store submission assets
docs: user documentation and landing page
```

---

## Decisiones Clave

1. **API-first para AI:** Ollama, OpenAI, Anthropic, Google primero. Modelos locales al futuro.
2. **Contratos fresh:** Nuevo deploy en testnet4 con nombres correctos. Viejos quedan historical.
3. **Renombre completo:** Sin medias tintas. "Baby" desaparece de código, tipos, stores, UI, docs.
4. **1 Spark = 1 NFT:** El NFT ES el spark. Sin "spark gratis" separado.
5. **Dwarf Fortress como inspiración:** Profundidad de simulación + narrativa procedural, no complejidad de UI.

---

## Referencias

- [Charms v15 Release](https://github.com/CharmsDev/charms/releases/tag/v15.0.0)
- [BRO Token](https://github.com/CharmsDev/bro) — referencia de mining
- [Charms Docs](https://docs.charms.dev)
- Sesión anterior: `docs/SESSION_2026-06-19.md`
- AI World Engine: `docs/AI_WORLD_ENGINE.md`
- Memoria del proyecto: `.claude/memory.md`