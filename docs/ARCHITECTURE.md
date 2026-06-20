# BitcoinBaby - Arquitectura del Sistema

## Visión General

BitcoinBaby es un ecosistema de minería basado en **Prueba de Trabajo Útil (PoUW)**
sobre Bitcoin. Los usuarios "crían" una entidad digital realizando tareas de IA
que contribuyen a entrenar un modelo colectivo.

**Filosofía:** Web primero, móvil después. Modular, escalable, profesional.

---

## 1. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BITCOINBABY MONOREPO                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   APPS (Desplegables independientes)                                        │
│   ┌─────────────────────────┐     ┌─────────────────────────┐               │
│   │       apps/web          │     │      apps/workers       │               │
│   │                         │     │                         │               │
│   │  • Next.js 16 (React 19)│     │  • Hono API (Edge)      │               │
│   │  • SSR + static exports │     │  • Durable Objects      │               │
│   │  • Capacitor mobile wrap│     │  • Redis integration    │               │
│   │  • Vercel deployment    │     │  • Cloudflare deploy    │               │
│   │                         │     │                         │               │
│   │  Puerto: 3000           │     │                         │               │
│   └───────────┬─────────────┘     └───────────┬─────────────┘               │
│               │                               │                              │
│               └───────────────┬───────────────┘                              │
│                               │                                              │
│                               ▼                                              │
│   PACKAGES (Código compartido - 95%+)                                       │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                                                                  │       │
│   │   packages/ui          → Componentes React (Tailwind CSS v4)     │       │
│   │   packages/core        → Lógica de negocio (mining, game, etc)  │       │
│   │   packages/bitcoin     → bitcoinjs-lib + Charms SDK             │       │
│   │   packages/ai          → Transformers.js wrapper                │       │
│   │   packages/shared      → Shared types, config, HTTP, validation │       │
│   │   packages/config      → ESLint, Tailwind, TypeScript configs   │       │
│   │                                                                  │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

### Apps

| App | Framework | Rendering | Deploy | Propósito |
|-----|-----------|-----------|--------|-----------|
| `apps/web` | Next.js 16.2.6 + React 19.2.3 | SSR (web) + Static Export (mobile) | Vercel (web) + Capacitor (mobile) | Frontend principal y wrapper móvil nativo |
| `apps/workers` | Hono 4.12.21 | Edge Routing | Cloudflare Workers | APIs del pool, leaderboards y Durable Objects |

### Packages

| Package | Propósito | Tecnologías |
|---------|-----------|-------------|
| `packages/ui` | Componentes UI | React 19, Tailwind CSS v4, shadcn/ui |
| `packages/core` | Lógica de negocio | TypeScript, Zustand |
| `packages/bitcoin` | Blockchain | bitcoinjs-lib, Charms SDK |
| `packages/ai` | IA en browser | Transformers.js (ONNX Runtime Web) |
| `packages/shared` | Utilidades y tipos | Zod, HttpClient, Logger, Env |
| `packages/config` | Configuraciones | ESLint, Tailwind, TSConfig |

### Infraestructura

| Capa | Tecnología |
|------|------------|
| Monorepo | Turborepo + pnpm |
| CI/CD | GitHub Actions (typecheck, lint, test, Vercel build) |
| Deploy Web | Vercel |
| Deploy Backend | Cloudflare Workers (wrangler) |
| Base de Datos | Durable Objects (estado en memoria) + Redis (leaderboard) |

---

## 3. Estructura de Directorios

```
bitcoinbaby/
├── README.md
├── STATUS.md
├── DEV_SETUP.md
├── package.json                    # Root workspace
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
│
├── apps/
│   ├── web/                        # Next.js App + Capacitor
│   │   ├── app/                    # App Router
│   │   │   ├── (marketing)/        # Landing, about, etc.
│   │   │   │   ├── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (app)/              # App principal
│   │   │   │   ├── mine/
│   │   │   │   ├── baby/
│   │   │   │   ├── wallet/
│   │   │   │   └── layout.tsx
│   │   │   ├── api/                # Next.js API Routes
│   │   │   └── layout.tsx
│   │   ├── capacitor.config.ts     # Configuración de Capacitor
│   │   ├── ios/                    # Xcode project
│   │   ├── android/                # Android Studio project
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── workers/                    # Edge Backend APIs
│       ├── src/
│       │   ├── durable-objects/    # Durable Objects
│       │   │   ├── virtual-balance.ts
│       │   │   ├── withdraw-pool.ts
│       │   │   └── game-room.ts
│       │   ├── routes/             # Hono Endpoints
│       │   │   ├── claim.ts
│       │   │   ├── faucet.ts
│       │   │   └── leaderboard.ts
│       │   └── index.ts            # Entrypoint Hono
│       ├── wrangler.toml           # Wrangler settings
│       └── package.json
│
├── packages/
│   ├── ui/                         # Shared UI Components (Tailwind v4)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── baby-avatar.tsx
│   │   │   │   ├── mining-dashboard.tsx
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── core/                       # Business Logic
│   │   ├── src/
│   │   │   ├── mining/
│   │   │   │   ├── orchestrator.ts
│   │   │   │   ├── cpu-miner.ts
│   │   │   │   ├── webgpu-miner.ts
│   │   │   │   └── types.ts
│   │   │   ├── game/
│   │   │   │   ├── baby-state.ts
│   │   │   │   ├── evolution.ts
│   │   │   │   └── rewards.ts
│   │   │   ├── stores/
│   │   │   │   ├── mining-store.ts
│   │   │   │   ├── baby-store.ts
│   │   │   │   └── wallet-store.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── bitcoin/                    # Blockchain Integration
│   │   ├── src/
│   │   │   ├── wallet.ts
│   │   │   ├── transactions.ts
│   │   │   ├── charms.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ai/                         # AI/ML Integration
│   │   ├── src/
│   │   │   ├── engine.ts
│   │   │   ├── engine.test.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── config/                     # Shared Configs
│       ├── eslint/
│       │   └── index.js
│       ├── tailwind/
│       │   └── tailwind.config.ts
│       ├── typescript/
│       │   └── base.json
│       └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md             # Arquitectura del sistema (este archivo)
│   ├── ROADMAP.md                  # Roadmap de fases de desarrollo
│   ├── TECHNICAL_DECISIONS.md      # Justificación de decisiones de diseño y stack
│   └── TECH_COMPARISON.md          # Comparativa técnica con alternativas
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

---

## 4. Flujo de Datos

### Web & Mobile (apps/web)

```
Usuario (Browser/Mobile App)
     │
     ├─► UI Rendering (React 19 + Tailwind v4 + Zustand stores)
     │
     ├─► Local Mining Loop (CPU/WebGPU + Transformers.js on-device)
     │
     └─► API Calls ──► Cloudflare Workers (apps/workers) ──► Redis / Durable Objects
                                    │
                                    ▼
                             Bitcoin Network
```

---

## 5. Diferencias Web vs Native Targets (apps/web targets)

| Feature | Web Target | Native Target (Capacitor) |
|---------|------------|---------------------------|
| **Rendering** | SSR + SSG | Static Export (`out/`) |
| **Edge API Calls** | Direct or Local Routes | Direct calls to workers API |
| **SEO** | ✅ Completo | N/A (App UI) |
| **Background Tasks** | ❌ Limitado por browser | ✅ Nativo (plugins de background) |
| **Push Notifications** | ✅ Web Push | ✅ Nativo (Push Notifications APNS/FCM) |
| **Offline Sync** | ✅ PWA Service Workers | ✅ Capacitor Local Storage + Offline sync |
| **App Stores** | ❌ No | ✅ Sí (App Store / Play Store) |

---

## 6. Código Compartido (packages/)

### Porcentaje de Código Compartido: ~95%

```
┌────────────────────────────────────────────────────────────┐
│                    CÓDIGO TOTAL                            │
│                                                            │
│  ██████████████████████████████████████████░░░░  95%        │
│  │                                        │   │            │
│  │         packages/* (compartido)        │web│            │
│  │                                        │api│            │
│  │                                        │   │            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Compartido (packages/):**
- Componentes UI (`ui/`)
- Lógica de minería y game loop (`core/`)
- Estado global (`core/src/stores`)
- Criptografía y firmas Bitcoin/Charms (`bitcoin/`)
- Inferencia de modelos de IA local (`ai/`)
- Tipos de datos, validación Zod y cliente HTTP (`shared/`)
- Configuraciones compartidas (`config/`)

**Único por target:**
- Rutas del App Router (`apps/web/app`)
- Rutas Edge de Cloudflare (`apps/workers/src/routes`)
- Configuración de compilación móvil de Capacitor (`capacitor.config.ts`, `ios/`, `android/`)

---

## 7. Dependencias Clave

### Root (package.json)
```json
{
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

### apps/web
```json
{
  "dependencies": {
    "next": "^16.2.6",
    "react": "19.2.3",
    "@capacitor/core": "^8.1.0",
    "@capacitor/ios": "^8.1.0",
    "@capacitor/android": "^8.1.0",
    "@bitcoinbaby/ui": "workspace:*",
    "@bitcoinbaby/core": "workspace:*",
    "@bitcoinbaby/bitcoin": "workspace:*",
    "@bitcoinbaby/ai": "workspace:*",
    "@bitcoinbaby/shared": "workspace:*"
  }
}
```

### apps/workers
```json
{
  "dependencies": {
    "hono": "^4.12.21",
    "@bitcoinbaby/shared": "workspace:*"
  }
}
```

### packages/ui
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

---

## 8. Referencias

- [nextjs-native-starter](https://github.com/RobSchilderr/nextjs-native-starter) - Arquitectura de referencia
- [next-forge](https://github.com/vercel/next-forge) - Template profesional Turborepo
- [Turborepo + Next.js](https://turborepo.dev/docs/guides/frameworks/nextjs) - Documentación oficial
- [BRO Token (Charms)](https://github.com/CharmsDev/bro) - Referencia de mining
- [Capacitor + Next.js](https://capacitorjs.com/docs) - Integración mobile
