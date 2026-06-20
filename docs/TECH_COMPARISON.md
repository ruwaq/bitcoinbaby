# BitcoinBaby - Comparacion de Tecnologias 2025/2026

## Pregunta Central

> ¿Cual es la mejor arquitectura para web primero, con facil migracion a mobile y backend escalable?

**Respuesta: Next.js + Capacitor (apps/web) + Cloudflare Workers (apps/workers)**

---

## Contexto del Proyecto

BitcoinBaby es un ecosistema de mineria que:
- **Prioriza web** - Dashboard, onboarding, funcionalidad completa
- **Mobile integrado** - Utiliza Capacitor dentro de la misma app web (`apps/web`) para exportación estática a iOS/Android.
- **Backend Edge** - APIs rápidas y Durable Objects en Cloudflare Workers (`apps/workers`).
- **Mineria en browser/app** - WebGPU/CPU mining local (basado en Transformers.js para tareas de IA).
- **95%+ codigo compartido** - Entre frontend, mobile targets y paquetes lógicos compartidos.

---

## Analisis de Opciones

### Opcion 1: Next.js 16 + Capacitor + Cloudflare Workers (Monorepo) - ELEGIDA

```
MONOREPO (Turborepo + pnpm)
├── apps/web          # Next.js 16 (SSR/ISR para web, Static Export para móvil Capacitor)
├── apps/workers      # Cloudflare Workers (Hono API, Faucet, Durable Objects)
└── packages/*        # 95%+ codigo compartido
```

**Ventajas:**
- Una única codebase frontend (`apps/web`) para web y móvil nativo, eliminando duplicación de UI/routes.
- Web tiene SSR completo, ISR y SEO optimizado en Vercel.
- Mobile usa el build compilado estáticamente e integrado con Capacitor.
- Backend en el Edge (`apps/workers`) con Hono, con latencia ultra-baja y Durable Objects para coordinación en tiempo real.
- Turborepo optimiza builds, tests y despliegues con caché remota.

**Desventajas:**
- Mobile corre en WebView (no es UI 100% nativa).
- Requiere configurar scripts y plugins específicos para builds híbridos.

**Ideal para:** Proyectos web-first con presencia móvil fluida y backend altamente escalable.

---

### Opcion 2: Expo (React Native + Web)

```
EXPO SDK 52+
├── iOS App (Nativo)
├── Android App (Nativo)
└── Web App (React DOM)
```

**Ventajas:**
- Una base de codigo para TODO
- Acceso directo a NPU (Neural Engine / Hexagon)
- React Native ExecuTorch para IA on-device
- expo-background-task para mineria en background

**Desventajas:**
- Web es ciudadano de segunda clase
- No hay SSR (solo CSR)
- SEO limitado
- Desarrollo web se siente "mobile-first"

**Ideal para:** Mobile-first con web secundario

---

### Opcion 3: Next.js + Backend Separado

```
apps/app     # Next.js SSR (web + static para mobile)
apps/api     # Express/Fastify backend
```

**Ventajas:**
- Arquitectura simple
- Backend escalable independiente

**Desventajas:**
- Duplicacion de logica entre frontend y backend
- Menos codigo compartido
- Mobile depende de API externa

**Ideal para:** Apps con backend pesado

---

### Opcion 4: Tauri 2.0

```
TAURI 2.0
├── Desktop (macOS, Windows, Linux)
├── iOS (Experimental)
├── Android (Experimental)
└── Web
```

**Ventajas:**
- Apps muy pequenas (3-10MB)
- Rust backend (bueno para crypto/ZK)
- Seguridad excelente

**Desventajas:**
- Mobile todavia experimental
- iOS builds "painful" segun desarrolladores
- Comunidad mas pequena

**Ideal para:** Desktop-first apps

---

## Matriz de Decision

| Requisito BitcoinBaby | Next.js+Capacitor | Expo | Tauri |
|-----------------------|-------------------|------|-------|
| Web-first | **SI** | No | Parcial |
| SSR + SEO | **SI** | No | No |
| Mining en browser | **SI** (WebGPU) | SI | SI |
| Background tasks (mobile) | Capacitor plugin | Nativo | Experimental |
| Codigo compartido 85%+ | **SI** | SI | SI |
| Produccion-ready | **SI** | SI | Parcial |
| Facil migracion web→mobile | **SI** | No aplica | Parcial |

---

## Decision Final: Next.js + Capacitor

### Por que esta arquitectura para BitcoinBaby

1. **Web es prioridad #1**
   - Landing page con SEO
   - Dashboard de mineria completo
   - Onboarding de usuarios

2. **Mobile viene despues**
   - Cuando web este estable
   - Capacitor permite reusar 85%+ del codigo
   - Plugins nativos para background mining

3. **Mining funciona en web**
   - WebGPU para aceleracion GPU
   - Web Workers para no bloquear UI
   - Referencia: [BRO token](https://github.com/CharmsDev/bro) usa esta arquitectura

4. **Patron profesional**
   - Usado por equipos de Vercel
   - Templates como next-forge
   - Turborepo para monorepo eficiente

---

## Arquitectura de Mining

### Web (apps/web)

```typescript
// packages/core/src/mining/orchestrator.ts
export class MiningOrchestrator {
  private cpuMiner: CPUMiner;
  private webgpuMiner: WebGPUMiner | null;

  async start() {
    // Detectar capacidades
    if (await this.hasWebGPU()) {
      this.webgpuMiner = new WebGPUMiner();
      await this.webgpuMiner.start();
    } else {
      this.cpuMiner = new CPUMiner();
      await this.cpuMiner.start();
    }
  }
}
```

### Mobile (apps/web target Capacitor)

```typescript
// Usa el mismo orchestrator de packages/core
// Pero puede agregar background mining via Capacitor Background Runner

import { BackgroundRunner } from '@capacitor/background-runner';

BackgroundRunner.dispatchEvent({
  label: 'com.bitcoinbaby.mining',
  event: 'startMiningTask',
  details: { difficulty: 4 }
});
```

---

## Stack Tecnologico Final

| Capa | Tecnologia | Notas |
|------|------------|-------|
| **Monorepo** | Turborepo + pnpm | Cache inteligente, builds y testing en paralelo |
| **Web/Mobile App** | Next.js 16.2.6 + React 19.2.3 | SSR (web) y Static Export (mobile targets via Capacitor) |
| **Backend Edge** | Cloudflare Workers + Hono 4.12.12 | API centralizada, Durable Objects y Redis integration |
| **UI** | React 19 + Tailwind CSS v4 + shadcn/ui | Componentes compartidos y utilidades |
| **State** | Zustand | Estado global reactivo y ligero en `packages/core` |
| **Mining** | Web Workers + WebGPU | Minería de IA y hashing no bloqueante |
| **Bitcoin** | bitcoinjs-lib + Charms SDK | Transacciones, scripts y tokens Runes |
| **AI** | Transformers.js | Inferencia de modelos on-device local |
| **Deploy Web** | Vercel | Hosting frontend, analíticas y Edge routing |
| **Deploy Backend** | Wrangler / Cloudflare | Despliegue del backend Hono a nivel mundial |

---

## Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [Capacitor + Next.js](https://capacitorjs.com/docs)
- [nextjs-native-starter](https://github.com/RobSchilderr/nextjs-native-starter)
- [next-forge](https://github.com/vercel/next-forge)
- [Turborepo + Next.js](https://turborepo.dev/docs/guides/frameworks/nextjs)
- [BRO Token (Mining Reference)](https://github.com/CharmsDev/bro)
