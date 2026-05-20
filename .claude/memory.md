# BitcoinBaby — Memoria de Proyecto (Actualizada 2026-05-20)

**Branch:** `main` (commit `a481a30`, 6 commits ahead de origin/main)
**Estado:** Workers API ✅ Deployado | Vercel ❌ Colgado | Phase 1 Plan ✅ Listo para revisión

---

## Resumen del Proyecto

BitcoinBaby es una plataforma gamificada de "Proof of Useful Work" donde usuarios "crían" un bebé digital minando en el navegador. Construido sobre Bitcoin usando Charms Protocol + BitcoinOS.

**Stack:** Next.js 16 + React 19 (frontend) · Cloudflare Workers + Hono (backend API) · Charms Protocol v11 (Bitcoin) · Web Workers + WebGPU (minería) · Zustand (estado) · Capacitor (mobile) · Turborepo + pnpm (monorepo)

```
bitcoinbaby/
├── apps/
│   ├── web/       # Next.js 16 (SSR + Capacitor mobile)
│   └── workers/    # Cloudflare Workers (Hono API)
├── packages/
│   ├── bitcoin/   # Wallet, Charms, NFT, transactions
│   ├── core/      # Mining engine, game, stores, storage
│   ├── shared/    # Types, validation, HTTP, logging
│   ├── ui/        # React components (pixel art style)
│   ├── ai/        # Transformers.js wrapper
│   └── config/    # ESLint, Tailwind, TypeScript configs
└── scripts/       # Minting, signing, E2E test scripts
```

---

## Configuración de Claude Code

### Agents (6 task agents en `.claude/agents/`)
| Agent | Archivo | Se activa con |
|-------|---------|--------------|
| blockchain-expert | blockchain-expert.md | packages/bitcoin, transacciones, wallets, tokens |
| security-auditor | security-auditor.md | Commits, PRs, auth, wallets, claves |
| code-reviewer | code-reviewer.md | Implementaciones significativas, review requests |
| mining-expert | mining-expert.md | packages/core/mining, WebGPU, CPU mining |
| ai-expert | ai-expert.md | packages/ai, Transformers.js, ML |
| pixel-designer | pixel-designer.md | UI components, CSS, diseño visual |

### Skills (6 project skills en `.claude/skills/`)
| Skill | Archivo | Trigger |
|-------|---------|---------|
| /build | build/SKILL.md | "build", "compilar", "deploy", "produccion" |
| /dev | dev/SKILL.md | "dev", "run", "correr", "iniciar", "levantar" |
| /component | component/SKILL.md | "crear componente", "UI component" |
| charms-research | charms-research/SKILL.md | Spells, Runes, BitSNARK, Scrolls, tokens |
| mining-research | mining-research/SKILL.md | WebGPU, hashrate, orchestrator, PoW |
| charms-v11-format | charms-v11-format.md | V11 prover format reference (no trigger) |

### Rules (2 auto-load rules en `.claude/rules/`)
| Rule | Archivo | Se carga en |
|------|---------|------------|
| blockchain.md | packages/bitcoin/**/* | Claves privadas, transacciones, Scrolls API |
| pixel-art.md | packages/ui/**/*, *.tsx, *.css | Paleta NES/SNES, tipografía, CSS obligatorio |

### Configuración global (`~/.claude/settings.json`)
- **Models:** sonnet=kimi-k2.6:cloud, haiku=deepseek-v4-flash:cloud, opus=glm-5.1:cloud, subagent_code=devstral-small-2:24b-cloud
- **Effort level:** high
- **Context:** 1M tokens, auto-compact @ 50%
- **Ollama:** Metal GPU, Flash Attention, q8_0 KV cache, keep_alive=-1

### Skills globales instaladas (`~/.claude/skills/`)
- code-review, commit, debug (custom)
- grill-me (mattpocock/skills)
- reaper (custom)
- skill, skill-creator (anthropics/skills)
- systematic-debugging, test-driven-development, writing-plans (obra/superpowers)
- test (custom)
- Varios firecrawl-* skills

### Planes
- `~/.claude/plans/bitcoinbaby-phased-launch.md` (423 líneas) — Plan de lanzamiento en 3 fases con 10 agents detallados
- 18 planes adicionales de otras sesiones (nombres tipo `groovy-skipping-pony.md`)

---

## Dónde se quedó Hermes (Sesión anterior ~2026-05-19/20)

### Workers API: ✅ Deployado y saludable
- URL: `bitcoinbaby-api.andeanlabs-58f.workers.dev`
- Deploy: `d97205fb`
- Fase configurada: PHASE=1

### Vercel Frontend: ❌ Deploy colgado
- **Problema:** El directorio `apps/web/.vercel/` estaba vinculado al proyecto "web" (incorrecto), mientras que la config de root `.vercel/` apunta a "bitcoinbaby" (project ID: `prj_u9Re0yHckkLCrlFzSjDCAIe3jsy9`)
- **Intento de fix:** `rm -rf apps/web/.vercel/` y `npx vercel --prod --yes`
- **Resultado:** El CLI se queda colgado consistentemente (~300s timeout). Se intentó:
  - `npx vercel --prod --yes` desde root → colgado
  - `npx vercel build --prod --yes && npx vercel --prebuilt --prod --yes` → build OK pero deploy falla
  - `npx vercel --target=production --yes` → colgado
- **Recomendación de Hermes:** `npx vercel logout && npx vercel login` para refrescar el token de auth local
- **Alternativa:** El proyecto está conectado a GitLab (gitlab.com/andelabs/bitcoinbaby). Si Vercel tiene GitLab integration, el deploy podría dispararse automáticamente con push.
- **URL actual:** `bitcoinbaby-jlpwhdr6y-andelabs-projects.vercel.app` devuelve 200 pero muestra "Deployment is building"

### Git
- Push hecho a `github.com/Ande-Labs/bitcoinbaby` (remote: github)
- Push hecho a `gitlab.com/andelabs/bitcoinbaby` (remote: gitlab)
- `origin` apunta a `git@github.com:Ande-Labs/bitcoinbaby.git`
- 6 commits ahead de origin/main

### Fixes CRITICAL aplicados por Hermes (commit e0100ee):
1. ✅ XSS regex SVG sanitizer (onchain-renderer.ts) — reemplazado regex roto
2. ✅ Secure RNG (crypto.getRandomValues) para reserva de NFT ID
3. ✅ Wallet erase seguro
4. ✅ Faucet atomicidad (DO → KV)
5. ✅ Faucet amount ceiling (100 BABTC max)

### Pendientes (lo que Hermes no terminó):
1. ❌ **Marketplace inline fixes:** Replicar `validateListingSighash` con `@noble/secp256k1` en código inline de workers (no se puede usar bitcoinjs-lib porque tiny-secp256k1 es WASM incompatible con Workers)
2. ❌ **Re-deploy Vercel** — una vez fixeado el CLI/auth
3. ❌ **Round 2 audit** post-deploy
4. ❌ **Verificación en vivo** con transacciones reales en testnet4

---

## Auditorías y Bugs (Mayo 2026)

### Resumen de 3 auditorías paralelas (2026-05-19)
| Auditoría | Archivo | Scope |
|-----------|---------|-------|
| Full Codebase | AUDIT_REPORT_LATEST.md | Next.js + Workers + Charms/Bitcoin |
| Bitcoin Flows | BITCOIN_FLOW_AUDIT_LATEST.md | NFTs, claims, marketplace, PSBT |
| Bug Scan | BUG_SCAN_LATEST.md | Regex static analysis + manual verify |

### Issues CRITICAL (11)
| # | Hallazgo | Estado |
|---|----------|--------|
| C1 | Commit-Spell atomicity roto (useMintNFT) | ❌ Pendiente |
| C2 | Fire-and-forget confirmations (useMintNFT, useEvolution) | ❌ Pendiente |
| C3 | No SIGHASH verification en seller PSBT (marketplace) | ❌ Pendiente |
| C4 | Hardcoded testnet private key en scripts | ✅ Fixeado |
| C5 | new Function() code injection (ai-integration.ts) | ❌ Pendiente |
| C6 | mempoolService as any (claim.ts) | ❌ Pendiente |
| C7 | Next.js HIGH CVEs | ✅ Resuelto (16.2.6) |
| C8 | Vercel OIDC token en .env.local | ✅ Fixeado |
| C9 | Empty mainnet treasury addresses | ❌ Pendiente |
| C10 | Claim status hardcoded "processing" | ❌ Pendiente |
| C11 | No batch signer authentication | ❌ Pendiente |

### Issues HIGH (10)
- Hono CVEs (5 moderate) → upgrade a >=4.12.12
- 918 console.log en producción
- WASM binario 335KB embebido como string TS
- UTXO selection naive
- Fire-and-forget API calls sin retry
- nft.ts 2149 líneas → necesita split
- Sin claim replay protection
- jsonpath vulnerability
- Duplicate createSeededRandom

### Bug Scan (BUG_SCAN_LATEST.md - 20 issues)
- **CRITICAL:** 1 (XSS regex roto en onchain-renderer → ✅ Fixeado)
- **HIGH:** 6 (Math.random en NFT reserve → ✅ Fixeado, unsafe-inline CSP, as any wallet erase → ✅ Fixeado, memory leaks, silent promise rejection, faucet TOCTOU → ✅ Fixeado)
- **MEDIUM:** 9 (silent errors, console.error en prod, network mismatches)
- **LOW:** 4 (magic numbers, TODOs, non-null assertions)

---

## Plan Phase 1 (bitcoinbaby-phased-launch.md)

### 3 Fases definidas
| Fase | Nombre | Alcance |
|------|--------|---------|
| 1 | NFTs + Faucet | Mint, Collection, Marketplace, BABTC Faucet |
| 2 | Mining | PoW CPU/WebGPU, Claim, Virtual Balance |
| 3 | Game | Tamagotchi, Evolution on-chain, Leaderboard |

### 10 Agents para Phase 1
| Agent | Descripción | Estado |
|-------|-------------|--------|
| Agent 1 | Phase Configuration System | ❌ No implementado |
| Agent 2 | Navigation Redesign (visibleTabs) | ❌ No implementado |
| Agent 3 | BABTC Faucet Backend | ❌ No implementado |
| Agent 4 | Faucet Frontend (useFaucet, FaucetCard) | ❌ No implementado |
| Agent 5 | Virtual Evolution (POST /api/nft/evolve) | ❌ No implementado |
| Agent 6 | NFT Collection Polish (bug fixes) | ⚠️ Parcial |
| Agent 7 | Workers Route Gating (phaseGate) | ❌ No implementado |
| Agent 8 | QA Integration Tests | ❌ No implementado |
| Agent 9 | Deployment Configuration | ❌ No implementado |
| Agent 10 | Documentation & Session Handoff | ❌ No implementado |

### Estado actual de features
| Feature | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| NFT Mint | ✅ On-chain | ✅ | ✅ |
| NFT Collection | ✅ | ✅ | ✅ |
| NFT Marketplace | ✅ | ✅ | ✅ |
| BABTC Faucet | ❌ No existe | N/A | N/A |
| NFT Evolution | ⚠️ Solo PSBT on-chain | N/A | N/A |
| Mining | ❌ 404 (gated) | N/A | N/A |
| Claim | ❌ 404 (gated) | N/A | N/A |
| Game | ❌ 404 (gated) | ❌ 404 | N/A |

---

## Configuración de Deploy

### Workers (wrangler.toml)
- **Name:** bitcoinbaby-api (prod: bitcoinbaby-api-prod)
- **Durable Objects:** VirtualBalanceDO, WithdrawPoolDO, GameRoomDO
- **KV:** CACHE (id: c1629ef515ec48a0a2c2ef6872ea3ea3)
- **Cron:** 0 */6 * * * (consolidado)
- **Phase:** 1 (development)
- **Prover:** https://v11.charms.dev
- **Scrolls:** https://scrolls.charms.dev
- **BABTC App ID:** 87b5ecfb4c8e2d5f3a6e9b1c7d4f2a8e5b3c6d9f1a4e7b2c5d8f3a6e9b1c7d4f
- **Treasury:** tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8
- **NFT App ID:** 0000...0000 (placeholder — actualizar después de primer mint)
- **NFT App VK:** 04aab369e6cd3210fde734b175e09c599229548eda5c5b283c18630782583a61

### Vercel
- **Project ID:** prj_u9Re0yHckkLCrlFzSjDCAIe3jsy9
- **Name:** bitcoinbaby
- **Framework:** Next.js
- **Root Dir:** apps/web
- **Build:** cd ../.. && pnpm turbo build --filter=@bitcoinbaby/web
- **Install:** cd ../.. && pnpm install --frozen-lockfile
- **Team:** team_UekJPyZWxkq1nDVHR3VFBvnS (Ande Labs)

### Secrets requeridos (Workers)
- UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
- SCROLLS_API_KEY
- BATCH_WALLET_SEED (NUNCA commitear)
- CLAIM_SECRET_KEY
- ADMIN_KEY (opcional)

---

## Comandos rápidos

```bash
# Desarrollo
pnpm dev                          # Todos los packages
pnpm dev --filter @bitcoinbaby/web

# Build & Calidad
pnpm build && pnpm typecheck && pnpm lint

# Tests
pnpm test                         # Unit tests
pnpm --filter @bitcoinbaby/web test:e2e  # E2E (Playwright)

# Workers
pnpm --filter @bitcoinbaby/workers dev     # Workers local
pnpm --filter @bitcoinbaby/workers deploy

# Signer (scripts)
pnpm signer                       # Iniciar signer
pnpm signer:test                  # Test E2E signer
pnpm signer:wallet                # Generar wallet

# Deploy
npx vercel --prod --yes           # Deploy Vercel (si funciona el CLI)
```

---

## Vercel — Guía de Deploy (Actualizada 2026-05-20)

### Tipos de Token
| Prefijo | Tipo | Dónde se usa | Cómo obtenerlo |
|---------|------|-------------|----------------|
| `vca_` | CLI Auth Token | `~/.vercel/auth.json` | `npx vercel login` |
| `vcp_` | Personal Access Token | `--token` flag, `VERCEL_TOKEN` env, REST API | Dashboard → Settings → Tokens |

### Flujo de Deploy Recomendado (Prebuilt)
```bash
# 1. Cargar token
source ~/.config/atlas/tokens/vercel-andelabs.sh

# 2. Build local + deploy prebuilt (bypassea Git)
cd ~/dev/bitcoinbaby
npx vercel build --prod --yes --token $VERCEL_TOKEN
npx vercel deploy --prebuilt --prod --yes --token $VERCEL_TOKEN
```

### Vercel REST API (con vcp_ token)
```bash
# Verificar proyecto
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/{projectId}?teamId={teamId}"

# Ver deployments
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId={projectId}&teamId={teamId}"
```

### Errores Comunes y Soluciones
| Error | Causa | Solución |
|-------|-------|----------|
| `readyState: BLOCKED` | Git repo no accesible o OIDC bloqueado | Usar `--prebuilt` |
| `gitDirty: "1"` | Cambios sin commitear | Commitear todo antes de deploy |
| `spawn sh ENOENT` | Sandbox no permite `sh` | Ejecutar desde terminal real |
| Token `--token` inválido | Token `vca_` usado como `vcp_` | Usar token correcto del dashboard |
| `ARG_MISSING_REQUIRED_LONGARG` | `$VERCEL_TOKEN` vacío | Cargar script de tokens primero |
| GitHub suspendido | Vercel conectado a GitHub | Usar `--prebuilt` o conectar GitLab |

### Configuración del Proyecto Vercel
- **Project ID:** `prj_u9Re0yHckkLCrlFzSjDCAIe3jsy9`
- **Team:** `team_UekJPyZWxkq1nDVHR3VFBvnS`
- **Root Dir:** `apps/web`
- **Build Command:** `cd ../.. && pnpm turbo build --filter=@bitcoinbaby/web`
- **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`
- **Output Dir:** `apps/web/.next`
- **Framework:** Next.js
- **Node:** 24.x
- **URL:** `bitcoinbaby-andelabs-projects.vercel.app`
- **API URL:** `bitcoinbaby-api.andeanlabs-58f.workers.dev`

---

## Próximos pasos (orden de prioridad)

1. **DEPLOY VERCEL**: `source ~/.config/atlas/tokens/vercel-andelabs.sh && cd ~/dev/bitcoinbaby && npx vercel deploy --prebuilt --prod --yes --token $VERCEL_TOKEN`
2. **DEPLOY WORKERS**: `source ~/.config/atlas/tokens/cloudflare.sh && cd apps/workers && npx wrangler deploy --env=""`
3. **CONECTAR VERCEL A GITLAB**: En Vercel Dashboard → Settings → Git → GitLab
4. **PHASE 1**: Implementar Agents 1-10 del plan de lanzamiento
5. **VERIFICACIÓN EN VIVO**: Transacciones reales en testnet4

---

## Referencias
- Repo: github.com/Ande-Labs/bitcoinbaby (también en gitlab.com/andelabs/bitcoinbaby)
- Workers API: bitcoinbaby-api.andeanlabs-58f.workers.dev
- Charms Protocol: charms.dev | docs.charms.dev
- BitcoinOS: bitcoinos.build
- BRO Token reference: github.com/CharmsDev/bro
- Plan Phase 1: ~/.claude/plans/bitcoinbaby-phased-launch.md
- Claude Code config: ~/.claude/settings.json
