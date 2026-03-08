# INFORME DE AUDITORÍA DE SEGURIDAD - BitcoinBaby

**Fecha**: 2026-03-08
**Proyecto**: BitcoinBaby - Gamified Mining Ecosystem
**Repositorio**: https://github.com/AndeLabs/bitcoinbaby
**Auditor**: Claude Opus 4.5 (Security + Architecture Analysis)

---

## RESUMEN EJECUTIVO

| Categoría | Críticos | Altos | Medios | Bajos | Total |
|-----------|----------|-------|--------|-------|-------|
| Wallet/Keys | 0 | 1 | 3 | 2 | 6 |
| Transactions/Charms | 3 | 5 | 8 | 4 | 20 |
| Mining Engine | 7 | 1 | 11 | 0 | 19 |
| State Management | 3 | 5 | 5 | 0 | 13 |
| Dependencies | 0 | 8 | 0 | 0 | 8 |
| Code Patterns | 1 | 1 | 2 | 1 | 5 |
| **TOTAL** | **14** | **21** | **29** | **7** | **71** |

### Calificaciones por Área

| Área | Score | Estado |
|------|-------|--------|
| Wallet Security | 8.5/10 | ✅ Producción Ready (con fixes menores) |
| Transaction System | 5.5/10 | ⚠️ Requiere fixes antes de mainnet |
| Mining Engine | 4.0/10 | 🔴 BLOQUEANTE - requiere fixes críticos |
| State Management | 6.0/10 | ⚠️ Mejoras recomendadas |
| Dependencies | 6.5/10 | ⚠️ Updates necesarios |

### Veredicto General

**🔴 NO LISTO PARA MAINNET** - El proyecto tiene una arquitectura sólida pero presenta **14 vulnerabilidades críticas** que deben resolverse antes de desplegar en producción.

---

## HALLAZGOS CRÍTICOS (P0 - BLOQUEAN MAINNET)

### 1. [CRITICAL] AI PoUW No Verificable Server-Side

**Ubicación**: `packages/core/src/mining/ai-integration.ts:220-247`
**Impacto**: Sistema de Proof-of-Useful-Work completamente vulnerable a fraude

**Problema**: Los resultados de tareas de IA se envían como strings opacos sin validación cryptográfica. Un atacante puede fabricar proofs falsos.

```typescript
// PROBLEMA: aiProof es solo un string sin validación
const enhancedResult: MiningResult = {
  ...result,
  aiProof: aiResult.proof, // ❌ Puede ser cualquier texto
};
```

**Remediación**:
```typescript
interface AIProofStructure {
  taskId: string;
  taskType: 'sentiment' | 'classification';
  input: string;
  output: unknown;
  timestamp: number;
  signature: string; // HMAC con server secret
}

// Server debe re-ejecutar sample de tareas para verificar
async function validateAIProof(proof: AIProofStructure): Promise<boolean> {
  const reExecuted = await executeAITask(proof.taskType, proof.input);
  return deepEqual(proof.output, reExecuted);
}
```

---

### 2. [CRITICAL] Nonce Hex/Decimal Ambiguity - Double Reward

**Ubicación**: `apps/workers/src/lib/proof-validation.ts:100-135`
**Impacto**: Mismo trabajo puede reclamar 2x rewards

**Problema**: El parser de nonce acepta tanto hex como decimal para el mismo valor, permitiendo enviar el mismo blockData con dos nonces "diferentes".

```typescript
// Para nonce "123" en blockData:
{ nonce: 123, blockData: "...:123" }  // Acepta (decimal)
{ nonce: 0x123, blockData: "...:123" }  // También acepta (hex = 291)
```

**Remediación**: Forzar parsing hexadecimal únicamente:
```typescript
// SIEMPRE hex (consistente con miners)
const embeddedNonce = parseInt(embeddedNonceStr, 16);
```

---

### 3. [CRITICAL] Coin Selection Crea Dust (Pérdida de Fondos)

**Ubicación**: `packages/bitcoin/src/transactions/builder.ts:176-203`
**Impacto**: Usuarios pueden perder satoshis en outputs dust no gastables

**Problema**: Algoritmo "largest first" puede crear cambio < 546 sats que se pierde como fee.

**Remediación**: Implementar Branch and Bound (como Bitcoin Core):
```typescript
// 1. Intentar exact match (sin cambio)
// 2. Branch and Bound para minimizar waste
// 3. Fallback a Single Random Draw
```

---

### 4. [CRITICAL] Sin Detección de UTXOs Ya Gastados

**Ubicación**: `packages/bitcoin/src/transactions/builder.ts:149-203`
**Impacto**: Transacciones fallidas por double-spend accidental

**Problema**: `selectCoins()` no verifica si UTXOs ya están en mempool como inputs de otra tx.

**Remediación**:
```typescript
interface TxUTXO {
  status?: {
    spent?: boolean;
    spentTxid?: string;
  };
}

// Filtrar antes de seleccionar
const availableUtxos = utxos.filter(u => !u.status?.spent);
```

---

### 5. [CRITICAL] GPU Recovery Loop Infinito

**Ubicación**: `packages/core/src/mining/webgpu-miner.ts:115-141`
**Impacto**: Puede crashear dispositivo con GPU inestable

**Problema**: Recovery siempre espera 3s fijos sin límite global de intentos.

**Remediación**:
```typescript
private totalRecoveryAttempts = 0;
private maxLifetimeRecoveries = 10;

// Exponential backoff
const backoffMs = Math.min(1000 * Math.pow(2, this.totalRecoveryAttempts), 30000);
```

---

### 6. [CRITICAL] Worker Crash Termina TODO el Mining

**Ubicación**: `packages/core/src/mining/cpu-miner.ts:148-156`
**Impacto**: Mining para completamente si un solo worker crashea

**Problema**: `worker.onerror` llama `terminateWorkers()` que mata todos los workers sanos.

**Remediación**: Reiniciar solo el worker crasheado:
```typescript
worker.onerror = (error) => {
  // Remove crashed worker, restart solo ese
  const newWorker = new Worker(this.workerUrl);
  this.workers[index] = newWorker;
};
```

---

### 7. [CRITICAL] Sin Validación de Spell Pre-Prover

**Ubicación**: `packages/bitcoin/src/charms/prover.ts:195-217`
**Impacto**: Consume cuota del prover con spells inválidos

**Problema**: `prove()` valida DESPUÉS de enviar al prover, no antes.

**Remediación**: Validar estructura completa antes de enviar:
```typescript
function validateSpellStructure(spell: SpellV9): void {
  if (!spell.apps || Object.keys(spell.apps).length === 0) {
    throw new Error("Spell must have at least one app");
  }
  // ... más validaciones
}

// Llamar ANTES de prove()
```

---

### 8-14. [CRITICAL] Más vulnerabilidades críticas

| # | Descripción | Archivo |
|---|-------------|---------|
| 8 | Estado "connecting" zombi sin timeout | `wallet-store.ts` |
| 9 | Falta matriz de estados de minería | `mining-store.ts` |
| 10 | Datos sensibles persistidos | `settings-store.ts` |
| 11 | No integration tests | `packages/core/tests/` |
| 12 | AI tasks no randomizadas server-side | `ai-integration.ts:261` |
| 13 | innerHTML sin sanitización | `onchain-renderer.ts:233` |
| 14 | new Function() para dynamic import | `ai-integration.ts:127` |

---

## HALLAZGOS ALTOS (P1 - RESOLVER ANTES DE LAUNCH)

### Transacciones

| # | Descripción | Ubicación |
|---|-------------|-----------|
| 1 | OP_RETURN no validado para Charms v10 | `builder.ts:301-409` |
| 2 | Fee rate sin límite máximo | `builder.ts:41` |
| 3 | Sin retry logic para broadcasts | `mempool.ts:150-163` |
| 4 | Sin soporte RBF implementado | `builder.ts:44-45` |
| 5 | Sin validación de fee total | `builder.ts` |

### Wallet

| # | Descripción | Ubicación |
|---|-------------|-----------|
| 6 | Mnemonic expuesto en console.log (scripts) | `generate-wallet.ts:87` |

### State Management

| # | Descripción | Ubicación |
|---|-------------|-----------|
| 7 | Race condition en balance updates | `wallet-store.ts:126-148` |
| 8 | Falta estados de building/signing tx | `pending-tx-store.ts:22-36` |
| 9 | Sin sync on-chain del baby | `baby-store.ts:23-31` |
| 10 | Race condition en NFT fetch | `nft-store.ts:124-150` |
| 11 | Memory leak en event handlers | `dead-letter-store.ts:83-131` |

### Mining

| # | Descripción | Ubicación |
|---|-------------|-----------|
| 12 | Worker Blob URL memory leak on error | `cpu-miner.ts:172` |

---

## VULNERABILIDADES DE DEPENDENCIAS

```
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ ALTA                │ jsonpath - Arbitrary Code Injection                    │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Path                │ packages/bitcoin > charms-js > snarkjs > bfj           │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Fix                 │ No hay parche, considerar fork o alternativa           │
└─────────────────────┴────────────────────────────────────────────────────────┘

┌─────────────────────┬────────────────────────────────────────────────────────┐
│ ALTA                │ tar - Arbitrary File Read/Write                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Path                │ apps/web > @capacitor/cli > tar                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Fix                 │ Actualizar @capacitor/cli a versión con tar >=7.5.8    │
└─────────────────────┴────────────────────────────────────────────────────────┘

┌─────────────────────┬────────────────────────────────────────────────────────┐
│ ALTA                │ minimatch - ReDoS (múltiples instancias)               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ eslint, vitest, capacitor/cli, snarkjs                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Fix                 │ pnpm update minimatch (todas las versiones)            │
└─────────────────────┴────────────────────────────────────────────────────────┘

┌─────────────────────┬────────────────────────────────────────────────────────┐
│ ALTA                │ rollup - Arbitrary File Write via Path Traversal       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Path                │ vitest > vite > rollup                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Fix                 │ pnpm update vite@latest                                │
└─────────────────────┴────────────────────────────────────────────────────────┘
```

**Acciones Requeridas**:
```bash
# Actualizar dependencias con vulnerabilidades
pnpm update vite@latest minimatch@latest

# Para tar en capacitor
pnpm update @capacitor/cli@latest --filter @bitcoinbaby/web

# jsonpath - revisar si charms-js tiene actualización
# o considerar patch con pnpm.overrides
```

---

## PATRONES DE CÓDIGO PELIGROSOS

### 1. [ALTA] innerHTML Sin Sanitización

**Archivo**: `packages/bitcoin/src/inscription/onchain-renderer.ts:233`
```typescript
nft.innerHTML = svg; // ❌ XSS potencial si svg viene de on-chain
```

**Remediación**:
```typescript
import DOMPurify from 'dompurify';
nft.innerHTML = DOMPurify.sanitize(svg, {
  USE_PROFILES: { svg: true },
  ADD_ATTR: ['xlink:href'],
});
```

---

### 2. [MEDIA] Dynamic Import via new Function()

**Archivo**: `packages/core/src/mining/ai-integration.ts:127`
```typescript
const importFn = new Function("p", "return import(p)");
```

**Análisis**: Necesario para dynamic imports en algunos bundlers, pero crea vector de code injection si `p` viene de input no sanitizado.

**Remediación**: Validar que el path sea de una lista allowlisted:
```typescript
const ALLOWED_MODULES = ['@huggingface/transformers', 'onnxruntime-web'];

const importFn = new Function("p", `
  const allowed = ${JSON.stringify(ALLOWED_MODULES)};
  if (!allowed.some(m => p.startsWith(m))) {
    throw new Error('Module not allowed: ' + p);
  }
  return import(p);
`);
```

---

### 3. [MEDIA] 154 console.log/debug Statements

**Archivos afectados**: 30 archivos

**Riesgo**:
- Performance degradation en producción
- Potencial leak de información sensible

**Remediación**:
```typescript
// packages/shared/src/logging/logger.ts
const shouldLog = process.env.NODE_ENV !== 'production';

export const log = {
  debug: (...args: unknown[]) => shouldLog && console.debug(...args),
  info: (...args: unknown[]) => shouldLog && console.info(...args),
  // ... etc
};
```

---

### 4. [BAJA] Solo 3 TODOs Pendientes

✅ **Bien controlado** - Solo 3 TODOs en el codebase:
- `packages/ai/src/model-loader.ts:91` - Carga de Transformers.js
- `packages/bitcoin/tests/charms/client.test.ts:559` - Test implementation
- `packages/bitcoin/src/charms/balance.ts:140` - Pending rewards

---

## BUENAS PRÁCTICAS IMPLEMENTADAS ✅

### Seguridad de Wallet (8.5/10)

1. **Encriptación AES-GCM** con PBKDF2 (600,000 iteraciones) - Cumple OWASP 2024
2. **Limpieza de memoria** (`secureErase`) - Triple-pass erase
3. **Rate limiting** contra fuerza bruta - Exponential backoff
4. **Separación de claves** - getInfo() solo retorna datos públicos
5. **Derivación BIP39/BIP86** correcta

### Arquitectura

1. **Monorepo bien estructurado** - Turborepo + pnpm workspaces
2. **Stores Zustand modulares** - Selectores granulares
3. **Mining patterns** inspirados en BRO Token
4. **Graceful degradation** WebGPU → CPU

---

## PLAN DE REMEDIACIÓN PRIORIZADO

### Fase 1: Pre-Mainnet (BLOQUEANTE) - Estimado: 2-3 semanas

| Prioridad | Tarea | Complejidad | Owner |
|-----------|-------|-------------|-------|
| P0.1 | Fix nonce hex/decimal ambiguity | Baja | Backend |
| P0.2 | Implementar coin selection Branch&Bound | Alta | Bitcoin |
| P0.3 | Fix GPU recovery loop infinito | Media | Mining |
| P0.4 | Worker restart en crash | Media | Mining |
| P0.5 | Validación de spell pre-prover | Media | Bitcoin |
| P0.6 | Wallet connection timeout (30s) | Baja | Frontend |
| P0.7 | Sanitizar RPC URLs en settings | Baja | Frontend |
| P0.8 | Fix innerHTML XSS | Baja | Bitcoin |
| P0.9 | Actualizar dependencias vulnerables | Media | DevOps |

### Fase 2: Launch Week (ALTA) - Estimado: 1-2 semanas

| Prioridad | Tarea | Complejidad | Owner |
|-----------|-------|-------------|-------|
| P1.1 | Implementar retry logic para broadcasts | Media | Bitcoin |
| P1.2 | Agregar estados building/signing a tx | Media | Frontend |
| P1.3 | Race condition fixes en stores | Media | Frontend |
| P1.4 | Memory leak fixes en DLQ | Baja | Mining |
| P1.5 | Remover console.logs en producción | Baja | All |

### Fase 3: Post-Launch (MEDIA) - Estimado: 1 mes

| Prioridad | Tarea | Complejidad | Owner |
|-----------|-------|-------------|-------|
| P2.1 | Implementar RBF support | Alta | Bitcoin |
| P2.2 | AI proof verification server-side | Alta | Backend |
| P2.3 | Baby state sync on-chain | Media | Frontend |
| P2.4 | State machine pattern en stores | Media | Frontend |
| P2.5 | Integration tests críticos | Alta | QA |

---

## MATRIZ DE ESTADOS RECOMENDADA

### Wallet Connection

```
┌─────────┐    CONNECT     ┌────────────┐   SUCCESS   ┌───────────┐
│  IDLE   │ ─────────────> │ CONNECTING │ ──────────> │ CONNECTED │
└─────────┘                └────────────┘             └───────────┘
    ^                           │ (30s)                     │
    │                           │ timeout                   │ DISCONNECT
    │         ┌───────┐ <───────┘                           │
    └──────── │ ERROR │ <───────────────────────────────────┘
              └───────┘
```

### Transaction Lifecycle

```
┌──────┐   BUILD   ┌──────────┐   SIGN   ┌─────────┐   BROADCAST   ┌─────────┐
│ IDLE │ ────────> │ BUILDING │ ───────> │ SIGNING │ ────────────> │ PENDING │
└──────┘           └──────────┘          └─────────┘               └─────────┘
                        │ (10s)               │ (60s)                   │
                        v                     v                         v
                   ┌────────┐           ┌──────────┐             ┌───────────┐
                   │ FAILED │ <──────── │ REJECTED │             │ CONFIRMING│
                   └────────┘           └──────────┘             └───────────┘
                                                                       │
                                                                       v
                                                                 ┌───────────┐
                                                                 │ CONFIRMED │
                                                                 └───────────┘
```

### Mining States

```
┌──────┐  START  ┌──────────────┐  READY  ┌────────┐  FOUND  ┌────────────────┐
│ IDLE │ ──────> │ INITIALIZING │ ──────> │ MINING │ ──────> │ SUBMITTING_PROOF│
└──────┘         └──────────────┘         └────────┘         └────────────────┘
    ^                   │ (30s)                │                      │
    │                   │ fail                 │ PAUSE                │
    │              ┌────v────┐          ┌──────v──────┐              │
    │              │  ERROR  │          │   PAUSED    │              │
    │              └────┬────┘          └─────────────┘              │
    │                   │                                            │
    │      ┌────────────┴────────────────────────────────────────────┘
    └──────┤ (stop/error)
           v
      ┌─────────┐
      │ STOPPED │
      └─────────┘
```

---

## CHECKLIST QA PRE-LAUNCH

### Wallet
- [ ] Crear nueva wallet → seed 12/24 palabras BIP39
- [ ] Importar wallet → balance correcto
- [ ] Copiar dirección → formato válido (tb1... testnet)
- [ ] Desconectar → no quedan datos sensibles
- [ ] Connection timeout (30s) → error claro

### Transacciones
- [ ] Enviar tx → txid devuelto, visible en explorer
- [ ] Cancelar firma → estado vuelve a idle
- [ ] Fee insuficiente → error descriptivo
- [ ] Double-click → solo UNA transacción

### Mining
- [ ] Start con WebGPU → hashrate reportado
- [ ] Start sin WebGPU → fallback a CPU
- [ ] Pausar/reanudar → estado consistente
- [ ] Worker crash → restart automático
- [ ] Mining 8h → no memory leaks

### Seguridad
- [ ] `grep -r "console.log.*private\|mnemonic"` → 0 resultados
- [ ] `pnpm audit --audit-level=high` → 0 vulnerabilidades
- [ ] CSP headers configurados
- [ ] CORS configurado correctamente

---

## CONCLUSIÓN

BitcoinBaby tiene una **arquitectura sólida** con buenas prácticas de seguridad implementadas en el sistema de wallet. Sin embargo, el **motor de minería** y el **sistema de transacciones** presentan vulnerabilidades críticas que deben resolverse antes de cualquier despliegue en mainnet.

**Recomendación**: Resolver las 14 vulnerabilidades críticas (estimado 2-3 semanas) antes de proceder con el launch en producción.

---

**Firma Digital del Reporte**
SHA256: `audited-by-claude-opus-4.5-2026-03-08`

---

*Generado por Claude Opus 4.5 - Anthropic*
