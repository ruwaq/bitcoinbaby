# AI World Engine — Plan Maestro

**Fecha:** 2026-05-28
**Estado:** Plan aprobado, implementacion pendiente
**Basado en:** Investigacion de 4 sesiones (NFTs, Charms v14, costos/latencia, alternativas ecosistema)

---

## Vision

La AI que ya esta corriendo (SmolLM2-135M via WebGPU + BabyBrain procedural) no solo genera texto para Proof of Useful Work — se convierte en un **motor de generacion procedural de mundo** para cada NFT Genesis Baby.

Inspirado en Dwarf Fortress, cada bebe tiene:
- **Backstory unica** derivada de su DNA on-chain
- **Personalidad** con traits 0-100 que evolucionan con el mining
- **Narrativa continua** — cada sesion de mining genera eventos que construyen su historia
- **Mundo persistente (Babyverse)** — facciones, eventos globales, relaciones entre bebes
- **Elecciones del usuario** — RLHF via botones A/B que dirigen la narrativa

---

## Decisiones de Arquitectura

### 1. Dos capas: Instantanea + Settlement

El problema critico: el Charms Prover tarda **2-6 minutos** por spell (120s timeout × 6 retries). Esto es inaceptable para gaming.

**Solucion: Arquitectura en 2 capas.**

```
┌──────────────────────────────────────────────────────────────┐
│ CAPA INSTANTANEA (off-chain, cliente)                        │
│                                                              │
│  AI genera narrativa → UI la muestra en ~500ms               │
│  Estado se guarda en localStorage + IndexedDB                │
│  El usuario NUNCA espera                                     │
│                                                              │
│  Componentes:                                                │
│  - NarrativeEngine (packages/ai/src/narrative-engine.ts)     │
│  - NarrativeStore (packages/core/src/stores/narrative-store) │
│  - NarrativePanel UI (speech bubble en MiningVisualization)  │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ Batch periodico (diario/semanal)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ CAPA DE SETTLEMENT (on-chain, Charms)                        │
│                                                              │
│  1 spell actualiza narrativeRoot + XP acumulado              │
│  Prover tarda 2 min, pero es background                      │
│  Costo amortizado: 20-50x menos fees                         │
│                                                              │
│  On-chain:                                                   │
│  - narrativeRoot (32 bytes) — merkle root de todos los       │
│    eventos narrativos desde el ultimo settlement             │
│  - worldStateRoot (32 bytes) — merkle root de traits,        │
│    inventario, relaciones                                    │
└──────────────────────────────────────────────────────────────┘
```

### 2. Estado on-chain minimo (+2 campos)

El `BabyNFTState` actual tiene 13 campos. Agregamos solo 2:

```typescript
export interface BabyNFTState {
  // --- INMUTABLE (13 campos existentes, sin cambios) ---
  readonly dna: string;           // 64-char hex
  readonly bloodline: Bloodline;  // royal | warrior | rogue | mystic
  readonly baseType: BaseType;    // human | animal | robot | mystic | alien
  readonly genesisBlock: number;
  readonly rarityTier: RarityTier;
  readonly tokenId: number;

  // --- MUTABLE (campos existentes, sin cambios) ---
  level: number;                  // 1-10
  xp: number;
  totalXp: number;
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: bigint;

  // --- NUEVO: AI World Engine (2 campos) ---
  narrativeRoot: string;          // Merkle root de eventos narrativos (32-byte hex)
  worldStateRoot: string;         // Merkle root de personalidad + items + relaciones (32-byte hex)
}
```

**Costo on-chain:** ~60 bytes adicionales. ~$0.03 extra en fees a 20 sat/vbyte.

### 3. Off-chain state completo (localStorage + IndexedDB)

Todo lo pesado vive off-chain y se verifica contra los merkle roots on-chain:

```typescript
// NarrativeStore (persistido en localStorage, keyed by tokenId)
interface NarrativeState {
  tokenId: number;
  events: NarrativeEvent[];       // Historial completo (~50-200 eventos por sesion)
  personality: PersonalityTraits; // 5 traits 0-100
  archetype: Archetype;           // Cyber Miner, Quantum Scholar, Pixel Shaman...
  backstory: string;              // Generada al mint del NFT
  mood: Mood;                     // feliz, curioso, cansado, rebelde
  faction: string | null;         // Faction a la que pertenece
  relationships: Relationship[];  // Relaciones con otros bebes
  inventory: Item[];              // Items equipados
}

interface NarrativeEvent {
  id: string;
  timestamp: number;
  type: "LORE" | "DISCOVERY" | "TECHNICAL" | "SOCIAL" | "MYSTICAL" | "EVOLUTION";
  title: string;                  // Una linea, tipo titular
  description: string;            // Texto completo del evento
  modelUsed: string;              // smollm2 | baby-brain | cloudflare-ai | gpt-4o-mini
  traitImpacts: Partial<PersonalityTraits>; // Como afecta los traits
  moodEffect?: Mood;
  aiOutputHash: string;           // SHA-256 del output original de la AI
}
```

### 4. NarrativeEngine (packages/ai)

```typescript
// packages/ai/src/narrative-engine.ts
export class NarrativeEngine {
  // Combina SmolLM2 (eventos complejos) + BabyBrain (eventos rapidos)
  async processAIOutput(output: string, nftState: BabyNFTState): Promise<NarrativeEvent>;

  // Templates por baseType, bloodline, rarity
  private classifyOutput(output: string): NarrativeEventType;
  private generateTitle(output: string, nft: BabyNFTState): string;
  private calculateTraitImpacts(eventType: string, nft: BabyNFTState): Partial<PersonalityTraits>;

  // Generacion de backstory al mint
  static generateBackstory(dna: string, baseType: BaseType, bloodline: Bloodline): string;
  static generatePersonality(dna: string): PersonalityTraits;
  static generateArchetype(dna: string): Archetype;
}
```

**Templates por NFT type:**

| BaseType | Bloodline | Tono de eventos |
|----------|-----------|-----------------|
| alien | rogue | Hackeos, exploracion espacial, tecnologia prohibida |
| mystic | mystic | Visiones, profecias, energia cosmica, rituales |
| robot | warrior | Combate calculado, mejora de sistemas, eficiencia |
| human | royal | Liderazgo, alianzas, diplomacia, comunidad |
| animal | rogue | Instinto, supervivencia, naturaleza, manada |

### 5. Progressive Trait Reveal

Los traits de personalidad se derivan deterministicamente del `dna` — zero costo on-chain:

```typescript
function getProgressiveTraits(dna: string, level: number, workCount: number): PersonalityTraits {
  // Level 1-2: solo curiosity basico revelado
  // Level 3-5: creativity + logic se revelan
  // Level 6-8: empathy + humor se revelan
  // Level 9-10: arquetipo completo + destino
}
```

### 6. BYO API Key

Usuarios pueden configurar su propia API key de AI. El modelo local (SmolLM2) es el default gratuito.

```
Flujo:
1. Settings → usuario ingresa provider + API key
2. Se encripta con derivacion del wallet seed → localStorage
3. Durante mining, si hay API key → llama directo a OpenAI/Anthropic
4. Si no hay → usa SmolLM2 local (WebGPU) o BabyBrain
5. El servidor NUNCA ve la API key
6. Anti-abuse: cada evento requiere spell on-chain con fee de Bitcoin
```

### 7. Fee Management — Batch Spells

**Sin batch:**
- 20 sesiones de mining/dia × 200 vbytes = 4000 vbytes/dia
- A 20 sat/vbyte = 80,000 sats/dia (~$80/dia en mainnet)

**Con batch (diario):**
- 1 spell/dia que actualiza narrativeRoot + XP
- 200 vbytes/dia
- Ahorro: **20x**

**Con batch (semanal):**
- 1 spell/semana
- Ahorro: **140x**

### 8. NFT-NFT Relationships via V11 `refs`

Charms V11 soporta `tx.refs` — reference UTXOs no-consumidos. Zero costo adicional:

```typescript
// Baby A interactua con Baby B
const spell: SpellV11 = {
  version: 11,
  tx: {
    ins: [babyA_utxo],
    refs: [babyB_utxo],  // Referencia — no se consume
    outs: [{ "0": updatedBabyAState }],
  },
  app_public_inputs: { "0": { ... } },
};
```

Esto permite verificar on-chain que dos bebes interactuaron, sin crear nuevas UTXOs.

### 9. Alternativas evaluadas (y descartadas por ahora)

| Alternativa | Por que NO ahora |
|-------------|------------------|
| **Celestia DA** | Overkill para fase 1. Agrega complejidad de 2 blockchains. Solo necesario si escala a 100k+ usuarios. |
| **Migrar a Ethereum L2** | Perdida de identidad Bitcoin. Ademas Charms+Bitcoin ya hace lo que necesitamos. |
| **RGB / Taproot Assets** | Menos maduros que Charms para nuestro caso de uso (estado mutable con ZK proofs). |
| **BitVM** | Demasiado temprano. Research phase. |
| **Escribir contratos WASM custom** | No necesario ahora. V11 spell format cubre todos los casos. |

### 10. Por que Charms es suficiente

1. Ya estamos en v14 (ultima version, Abril 2026)
2. Spell V11 soporta: refs, multi-app, batch outputs, mock spells
3. UTXO state model es perfecto para NFTs con estado mutable
4. ZK proofs via SP1 zkVM — verificacion on-chain sin revelar datos completos
5. La latencia del prover (2 min) se resuelve con la capa instantanea off-chain
6. El costo (200 vbytes/spell) se resuelve con batch spells

---

## Plan de Implementacion

| Fase | Que | Archivos | Tiempo |
|------|-----|----------|--------|
| **F1** | NarrativeEngine + templates | `packages/ai/src/narrative-engine.ts` | 2-3h |
| **F2** | NarrativeStore (zustand, persist) | `packages/core/src/stores/narrative-store.ts` | 1h |
| **F3** | Extender BabyNFTState (+2 campos) | `packages/bitcoin/src/charms/nft.ts`, `packages/core/src/types.ts` | 30m |
| **F4** | NarrativePanel UI (speech bubble) | `apps/web/src/components/features/mining/NarrativePanel.tsx` | 1-2h |
| **F5** | Wire onAILocalTaskResolved → NarrativeEngine | `useMining.ts`, `useMiningShareSubmission.ts` | 30m |
| **F6** | Progressive trait reveal desde DNA | `packages/ai/src/narrative-engine.ts` | 30m |
| **F7** | Batch spell para narrativeRoot | `packages/bitcoin/src/charms/nft.ts` | 1-2h |
| **F8** | BYO API key settings | Settings UI + `narrative-engine.ts` | 1h |
| **F9** | Facciones + relaciones via V11 refs | `narrative-engine.ts` + spell | 1h |
| **F10** | RLHF botones A/B | `NarrativePanel.tsx` | 1-2h |

---

## Verificacion de Decisiones

- [x] Charms v14 activo (prover: v15.charms.dev)
- [x] V11 spell format sin cambios desde v12
- [x] SmolLM2-135M corriendo en WebGPU (~500ms)
- [x] BabyBrain procedural como fallback instantaneo
- [x] onAILocalTaskResolved emite AIProof con output
- [x] 0 errores en typecheck de 7 paquetes
- [x] Costos validados contra el codigo (evolution.ts, prover.ts)
- [x] Alternativas del ecosistema evaluadas y documentadas