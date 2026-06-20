# BitcoinSparks — Implementation Plan (5 Fases)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform BitcoinBaby into BitcoinSparks: clean codebase, migrate Charms v15, rename baby→spark with unified types, add BYO AI provider system, redesign UI to 3 screens, and prepare for mainnet production.

**Architecture:** Bottom-up approach. Each phase produces a working, testable state. Phase 1 (clean) → Phase 2 (rename+unify) → Phase 3 (AI BYO) → Phase 4 (UI redesign) → Phase 5 (production).

**Tech Stack:** Next.js 16 + React 19, Cloudflare Workers + Hono, Charms Protocol v15, Zustand, Tailwind CSS v4, TypeScript strict, Turborepo + pnpm.

---

## Fase 1: Limpieza + Migrar Charms v15

### Task 1.1: Commit staged deletions and remove remaining dead files

**Files:**
- Delete: `~` directory, `~/.aider/` directory
- Verify staged: `.aider.chat.history.md`, `.aider.tags.cache.v4/`, `.litellm.pid`, `app-metadata.json`, `DEPLOYMENT.md`, `DEPLOY_PHASE1.md`, `ENV_EXAMPLE.md`, `implementation_plan.md`, `task.md`, `mining_page.png`, `scratch/`, `AUDIT_REPORT_*.md`, `BUG_SCAN_*.md`, `BITCOIN_FLOW_*.md`, `SECURITY_AUDIT_*.md`, `PRODUCTION_READINESS_*.md`, `LAUNCH_READINESS_*.md`, `UI_UX_IMPROVEMENTS_PLAN.md`
- Read: `.gitignore`

- [ ] **Step 1: Verify current git status and list what's staged**

Run: `git -C /Users/munay/dev/bitcoinbaby status --short | head -40`
Check: Files marked `D ` are staged deletions ready to commit.

- [ ] **Step 2: Remove the weird `~` directory if it exists**

Run: `ls -la /Users/munay/dev/bitcoinbaby/~ 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"`

If EXISTS:
```bash
rm -rf /Users/munay/dev/bitcoinbaby/~
rm -rf "/Users/munay/dev/bitcoinbaby/~/.aider" 2>/dev/null
```

- [ ] **Step 3: Remove legacy Charms versions and test script**

```bash
rm -rf /Users/munay/dev/bitcoinbaby/packages/bitcoin/src/charms/versions/v9
rm -rf /Users/munay/dev/bitcoinbaby/packages/bitcoin/src/charms/versions/v10
rm -f /Users/munay/dev/bitcoinbaby/packages/bitcoin/scripts/test-v9-flow.ts
```

- [ ] **Step 4: Remove orphan font files**

```bash
rm -f /Users/munay/dev/bitcoinbaby/apps/web/src/fonts/*.woff2
```

- [ ] **Step 5: Ensure .superpowers is in .gitignore**

Read `.gitignore`. If `.superpowers/` line is missing, append it:
```
.superpowers/
```

- [ ] **Step 6: Stage all deletions and commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "chore: remove dead files, legacy artifacts, and orphan fonts"
```

---

### Task 1.2: Migrate Charms prover v14 → v15

**Files:**
- Modify: all files containing `v14.charms.dev`

- [ ] **Step 1: Find all files referencing v14**

Run: `grep -r "v14.charms.dev" /Users/munay/dev/bitcoinbaby --include="*.ts" --include="*.tsx" --include="*.toml" --include="*.md" --include="*.json" -l | grep -v node_modules | grep -v ".superpowers"`

- [ ] **Step 2: Replace v14 → v15 in all found files**

For each file found, replace `v14.charms.dev` with `v15.charms.dev`:

```bash
FILES=$(grep -r "v14.charms.dev" /Users/munay/dev/bitcoinbaby --include="*.ts" --include="*.tsx" --include="*.toml" --include="*.md" --include="*.json" -l | grep -v node_modules | grep -v ".superpowers")
for f in $FILES; do
  sed -i '' 's/v14\.charms\.dev/v15.charms.dev/g' "$f"
done
```

- [ ] **Step 3: Verify no v14 references remain**

Run: `grep -r "v14.charms.dev" /Users/munay/dev/bitcoinbaby --include="*.ts" --include="*.tsx" --include="*.toml" -l | grep -v node_modules | grep -v ".superpowers"`
Expected: no output (all replaced)

- [ ] **Step 4: Run typecheck to verify nothing broke**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm typecheck`
Expected: PASS (or same errors as before, no new ones)

- [ ] **Step 5: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "chore: migrate Charms prover from v14 to v15"
```

---

### Task 1.3: Fix Vercel deployment

**Files:**
- Read: `apps/web/next.config.ts`
- Modify: `apps/web/next.config.ts` (if needed)

- [ ] **Step 1: Read current next.config.ts**

Read `/Users/munay/dev/bitcoinbaby/apps/web/next.config.ts`. Look for webpack config, WASM settings, experimental flags.

- [ ] **Step 2: Check for known Vercel hang causes**

The most common cause: webpack `new URL` resolver causing infinite loops with WASM files. Check if there's a `webpack` function in next.config.ts that handles WASM. If it's using `experiments: { asyncWebAssembly: true }` without proper exclusions, add exclusion:

If the config has webpack WASM handling and `output: 'standalone'` or static export, ensure:

```typescript
webpack: (config, { isServer }) => {
  // Disable the new URL resolver for WASM files to prevent build hangs
  config.module = config.module || {};
  config.module.parser = config.module.parser || {};
  config.module.parser.javascript = config.module.parser.javascript || {};
  config.module.parser.javascript.url = false;
  
  // WASM support
  config.experiments = { ...config.experiments, asyncWebAssembly: true };
  
  return config;
}
```

- [ ] **Step 3: Verify build works locally**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm build --filter @bitcoinbaby/web`
Expected: build completes without hanging (may take 2-5 minutes)

- [ ] **Step 4: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/web/next.config.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "fix(web): resolve Vercel build hang with WASM webpack config"
```

---

### Task 1.4: Commit remaining unstaged changes (~80 files)

- [ ] **Step 1: Check what's still unstaged**

Run: `git -C /Users/munay/dev/bitcoinbaby status --short | head -50`

- [ ] **Step 2: Group remaining changes into logical commits**

Based on what's left (likely: AI integration files, workers API, stores, hooks, UI components, configs), commit in groups:

```bash
# Core mining + AI changes
git -C /Users/munay/dev/bitcoinbaby add packages/core/src/mining/ packages/ai/src/ packages/core/src/stores/
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(core): AI PoUW integration and mining orchestration"

# Workers API changes
git -C /Users/munay/dev/bitcoinbaby add apps/workers/src/
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(workers): virtual balance, faucet, and AI proxy routes"

# UI + web changes
git -C /Users/munay/dev/bitcoinbaby add apps/web/src/ packages/ui/src/
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(web): mining visualization, hooks, and store integrations"

# Config + remaining
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "chore: config updates, env example, and remaining changes"
```

- [ ] **Step 3: Verify clean working tree**

Run: `git -C /Users/munay/dev/bitcoinbaby status --short`
Expected: empty (clean tree, everything committed)

---

## Fase 2: Renombre Completo + Unificar Tipos

### Task 2.1: Define the unified Spark type

**Files:**
- Create: `packages/core/src/spark-types.ts`
- Read: `packages/core/src/types.ts`, `packages/core/src/game/types.ts`, `packages/bitcoin/src/charms/nft.ts`

- [ ] **Step 1: Read existing types to understand all fields**

Read the three source files to catalog all fields that must be unified.

- [ ] **Step 2: Create the unified Spark type file**

Write `packages/core/src/spark-types.ts`:

```typescript
// Spark — unified entity type for BitcoinSparks
// Replaces: Baby (core/src/types.ts), GameBaby (core/src/game/types.ts),
//           BabyNFTState (bitcoin/src/charms/nft.ts)

export type SparkState = 'idle' | 'mining' | 'evolving' | 'resting';

export type Bloodline = 'ancient' | 'mystic' | 'primal' | 'celestial' | 'void';
export type BaseType = 'fire' | 'water' | 'earth' | 'air' | 'lightning';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface SparkStats {
  strength: number;
  intelligence: number;
  agility: number;
  charm: number;
}

export interface Spark {
  // Identity
  id: string;
  name: string;
  tokenId: string;

  // DNA (on-chain, from BabyNFTState)
  dna: string;
  bloodline: Bloodline;
  baseType: BaseType;
  rarity: Rarity;

  // Game state (from Baby + GameBaby)
  state: SparkState;
  level: number;
  xp: number;
  stats: SparkStats;

  // Volatile (off-chain, from Baby)
  mood: number;
  energy: number;

  // Narrative settlement (on-chain)
  narrativeRoot: string;
  worldStateRoot: string;

  // Metadata
  owner: string;
  createdAt: number;
  lastMinedAt: number;
}

export type { Spark as default };
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/core/src/spark-types.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(core): define unified Spark type replacing Baby/GameBaby/BabyNFTState"
```

---

### Task 2.2: Create unified spark-store

**Files:**
- Create: `packages/core/src/stores/spark-store.ts`
- Read: `packages/core/src/stores/baby-store.ts`, `packages/core/src/stores/nft-store.ts`

- [ ] **Step 1: Read existing stores**

Read `baby-store.ts` and `nft-store.ts` to understand current state shape, actions, and persistence config.

- [ ] **Step 2: Create spark-store.ts**

Write `packages/core/src/stores/spark-store.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Spark, SparkState, SparkStats, Bloodline, BaseType, Rarity } from '../spark-types';

interface SparkStore {
  // State
  sparks: Spark[];
  activeSparkId: string | null;

  // Computed
  activeSpark: () => Spark | null;

  // Actions
  addSpark: (spark: Spark) => void;
  removeSpark: (id: string) => void;
  setActiveSpark: (id: string) => void;
  updateSparkState: (id: string, state: SparkState) => void;
  updateSparkStats: (id: string, stats: Partial<SparkStats>) => void;
  updateSparkMood: (id: string, mood: number) => void;
  updateSparkEnergy: (id: string, energy: number) => void;
  addXp: (id: string, amount: number) => void;
  evolveSpark: (id: string) => void;
  updateNarrativeRoot: (id: string, root: string) => void;
  updateWorldStateRoot: (id: string, root: string) => void;
}

export const useSparkStore = create<SparkStore>()(
  persist(
    (set, get) => ({
      sparks: [],
      activeSparkId: null,

      activeSpark: () => {
        const { sparks, activeSparkId } = get();
        return sparks.find(s => s.id === activeSparkId) ?? null;
      },

      addSpark: (spark) =>
        set((state) => ({ sparks: [...state.sparks, spark] })),

      removeSpark: (id) =>
        set((state) => ({
          sparks: state.sparks.filter((s) => s.id !== id),
          activeSparkId: state.activeSparkId === id ? null : state.activeSparkId,
        })),

      setActiveSpark: (id) => set({ activeSparkId: id }),

      updateSparkState: (id, sparkState) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id ? { ...s, state: sparkState } : s
          ),
        })),

      updateSparkStats: (id, stats) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id
              ? { ...s, stats: { ...s.stats, ...stats } }
              : s
          ),
        })),

      updateSparkMood: (id, mood) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id ? { ...s, mood: Math.max(0, Math.min(100, mood)) } : s
          ),
        })),

      updateSparkEnergy: (id, energy) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id ? { ...s, energy: Math.max(0, Math.min(100, energy)) } : s
          ),
        })),

      addXp: (id, amount) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id ? { ...s, xp: s.xp + amount } : s
          ),
        })),

      evolveSpark: (id) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id && s.level < 21
              ? { ...s, level: s.level + 1, xp: 0 }
              : s
          ),
        })),

      updateNarrativeRoot: (id, root) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id ? { ...s, narrativeRoot: root } : s
          ),
        })),

      updateWorldStateRoot: (id, root) =>
        set((state) => ({
          sparks: state.sparks.map((s) =>
            s.id === id ? { ...s, worldStateRoot: root } : s
          ),
        })),
    }),
    { name: 'spark-store' }
  )
);
```

- [ ] **Step 3: Update packages/core/src/stores/index.ts**

Export the new store:
```typescript
export { useSparkStore } from './spark-store';
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/core/src/stores/spark-store.ts packages/core/src/stores/index.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(core): create unified spark-store replacing baby-store and nft-store"
```

---

### Task 2.3: Rename UI components Baby* → Spark*

**Files:**
- Glob: `packages/ui/src/components/*baby*`, `packages/ui/src/components/*Baby*`
- Modify: all matching files and their imports

- [ ] **Step 1: Find all Baby-named component files**

Run: `find /Users/munay/dev/bitcoinbaby/packages/ui/src -iname "*baby*" -type f`
Run: `find /Users/munay/dev/bitcoinbaby/apps/web/src -iname "*baby*" -type f`

- [ ] **Step 2: For each file, rename and update content**

For each file found, rename file (e.g., `baby-avatar.tsx` → `spark-avatar.tsx`) and replace all internal references:
- Component name: `BabyAvatar` → `SparkAvatar`
- Props types: `BabyAvatarProps` → `SparkAvatarProps`
- Internal mentions of "baby" → "spark"

Example for `baby-avatar.tsx` → `spark-avatar.tsx`:

```typescript
// Before: export function BabyAvatar({ baby, size = 'md' }: BabyAvatarProps)
// After:  export function SparkAvatar({ spark, size = 'md' }: SparkAvatarProps)
```

- [ ] **Step 3: Update all imports in consuming files**

Run: `grep -r "BabyAvatar\|BabySprite\|BabyEnergyIndicator\|BabyDisplay\|from.*baby" /Users/munay/dev/bitcoinbaby/apps/web/src -l | grep -v node_modules`

For each file, update imports:
```typescript
// Before
import { BabyAvatar } from '@bitcoinbaby/ui';
// After
import { SparkAvatar } from '@bitcoinbaby/ui';
```

- [ ] **Step 4: Update barrel exports in packages/ui/src/index.ts**

```typescript
export { SparkAvatar } from './components/spark-avatar';
export { SparkSprite } from './components/spark-sprite';
// ... etc
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "refactor(ui): rename Baby* components to Spark*"
```

---

### Task 2.4: Update all internal references across the codebase

**Files:**
- Glob: all `.ts`, `.tsx` files in `packages/`, `apps/`

- [ ] **Step 1: Replace type imports across all files**

Search and replace across all non-node_modules files:
- `import { Baby }` → `import { Spark }`
- `import { GameBaby }` → `import { Spark }`  
- `import { BabyNFTState }` → `import { Spark }`
- `import { BabyState }` → `import { SparkState }`
- `from './baby-store'` → `from './spark-store'`
- `from '../stores/baby-store'` → `from '../stores/spark-store'`
- `useBabyStore` → `useSparkStore`
- `useNftStore` → `useSparkStore`

- [ ] **Step 2: Replace JSX prop names**

- `baby={...}` → `spark={...}`
- `babyId={...}` → `sparkId={...}`

- [ ] **Step 3: Replace variable names and function references**

- `const baby` → `const spark`
- `const babies` → `const sparks`
- `function getBaby(` → `function getSpark(`
- `activeBaby` → `activeSpark`

- [ ] **Step 4: Update strings and display text in UI**

- `"baby"` → `"spark"` (where it's a label, not a random word)
- `"Genesis Babies"` → `"Genesis Sparks"`
- `"BitcoinBaby"` → `"BitcoinSparks"`

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/munay/dev/bitcoinbaby && pnpm typecheck`
Fix any type errors from the rename.

- [ ] **Step 6: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "refactor: rename all Baby references to Spark across codebase"
```

---

### Task 2.5: Update docs and remove old stores

**Files:**
- Modify: `README.md`, `STATUS.md`, `docs/*.md`
- Delete: `packages/core/src/stores/baby-store.ts`, `packages/core/src/stores/nft-store.ts`
- Modify: `packages/core/src/index.ts` (remove baby/nft store exports)

- [ ] **Step 1: Update README.md**

Replace all "baby" references with "spark". Update project name to BitcoinSparks. Update token name to $SPARK.

- [ ] **Step 2: Update docs/ files**

Run: `grep -r "baby\|Baby\|BABY" /Users/munay/dev/bitcoinbaby/docs -l | grep -v audits | grep -v node_modules`

For each doc, replace references. Note: `docs/audits/` files are historical and can stay as-is.

- [ ] **Step 3: Remove old stores and their exports**

Delete:
```bash
rm /Users/munay/dev/bitcoinbaby/packages/core/src/stores/baby-store.ts
rm /Users/munay/dev/bitcoinbaby/packages/core/src/stores/nft-store.ts
```

Update `packages/core/src/index.ts` to remove old store exports and add new spark-store export.

- [ ] **Step 4: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "docs: update all references from BitcoinBaby to BitcoinSparks"
```

---

## Fase 3: AI Provider System + BYO Keys

### Task 3.1: Define AIProvider interface

**Files:**
- Create: `packages/ai/src/provider-types.ts`

- [ ] **Step 1: Create the provider types file**

Write `packages/ai/src/provider-types.ts`:

```typescript
// AIProvider — unified interface for all AI backends
// Implementations: Ollama, OpenAI, Anthropic, Google, (future: Local, Cloudflare, Procedural)

export type AIProviderId = 'ollama' | 'openai' | 'anthropic' | 'google';

export interface AIProviderConfig {
  id: AIProviderId;
  apiKey?: string;
  model?: string;
  endpoint?: string; // for Ollama localhost
}

export interface AIProviderStatus {
  id: AIProviderId;
  ready: boolean;
  model: string;
  error?: string;
}

export interface AIExecutionResult {
  text: string;
  model: string;
  provider: AIProviderId;
  tokensUsed: number;
  latencyMs: number;
}

export interface AIProvider {
  readonly id: AIProviderId;
  initialize(config: AIProviderConfig): Promise<void>;
  executeTask(prompt: string, systemPrompt?: string): Promise<AIExecutionResult>;
  getStatus(): AIProviderStatus;
  dispose(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/ai/src/provider-types.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ai): define AIProvider interface and types"
```

---

### Task 3.2: Implement Ollama provider

**Files:**
- Create: `packages/ai/src/providers/ollama.ts`

- [ ] **Step 1: Write Ollama provider**

Write `packages/ai/src/providers/ollama.ts`:

```typescript
import type { AIProvider, AIProviderConfig, AIProviderStatus, AIExecutionResult } from '../provider-types';

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const;
  private endpoint = 'http://localhost:11434';
  private model = 'llama3';
  private ready = false;

  async initialize(config: AIProviderConfig): Promise<void> {
    this.endpoint = config.endpoint ?? this.endpoint;
    this.model = config.model ?? this.model;
    
    try {
      const res = await fetch(`${this.endpoint}/api/tags`);
      if (!res.ok) throw new Error(`Ollama not reachable: ${res.status}`);
      this.ready = true;
    } catch (err) {
      this.ready = false;
      throw new Error(`Ollama connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async executeTask(prompt: string, systemPrompt?: string): Promise<AIExecutionResult> {
    const start = Date.now();
    const body: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream: false,
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Ollama generation failed: ${res.status}`);
    const data = await res.json() as { response: string; eval_count?: number };
    
    return {
      text: data.response,
      model: this.model,
      provider: 'ollama',
      tokensUsed: data.eval_count ?? 0,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): AIProviderStatus {
    return { id: 'ollama', ready: this.ready, model: this.model };
  }

  dispose(): void {
    this.ready = false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/ai/src/providers/ollama.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ai): implement Ollama provider"
```

---

### Task 3.3: Implement OpenAI provider

**Files:**
- Create: `packages/ai/src/providers/openai.ts`

- [ ] **Step 1: Write OpenAI provider**

Write `packages/ai/src/providers/openai.ts`:

```typescript
import type { AIProvider, AIProviderConfig, AIProviderStatus, AIExecutionResult } from '../provider-types';

interface OpenAIConfig extends AIProviderConfig {
  proxyUrl: string; // Worker proxy URL (never call OpenAI directly from browser)
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  private apiKey = '';
  private model = 'gpt-4o-mini';
  private proxyUrl = '';
  private ready = false;

  async initialize(config: OpenAIConfig): Promise<void> {
    this.apiKey = config.apiKey ?? '';
    this.model = config.model ?? this.model;
    this.proxyUrl = config.proxyUrl;
    
    if (!this.apiKey) throw new Error('OpenAI API key required');
    this.ready = true;
  }

  async executeTask(prompt: string, systemPrompt?: string): Promise<AIExecutionResult> {
    const start = Date.now();
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(`${this.proxyUrl}/api/ai/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        model: this.model,
        messages,
        apiKey: this.apiKey,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI proxy error: ${res.status}`);
    const data = await res.json() as { text: string; tokensUsed: number };

    return {
      text: data.text,
      model: this.model,
      provider: 'openai',
      tokensUsed: data.tokensUsed,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): AIProviderStatus {
    return { id: 'openai', ready: this.ready, model: this.model };
  }

  dispose(): void { this.ready = false; }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/ai/src/providers/openai.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ai): implement OpenAI provider via Worker proxy"
```

---

### Task 3.4: Implement Anthropic and Google providers

**Files:**
- Create: `packages/ai/src/providers/anthropic.ts`
- Create: `packages/ai/src/providers/google.ts`

- [ ] **Step 1: Write Anthropic provider**

Write `packages/ai/src/providers/anthropic.ts` — same pattern as OpenAI, using `provider: 'anthropic'` in proxy call, default model `claude-3-haiku-20240307`.

- [ ] **Step 2: Write Google provider**

Write `packages/ai/src/providers/google.ts` — same pattern, `provider: 'google'`, default model `gemini-1.5-flash`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/ai/src/providers/anthropic.ts packages/ai/src/providers/google.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ai): implement Anthropic and Google providers"
```

---

### Task 3.5: Create provider registry and orchestrator

**Files:**
- Create: `packages/ai/src/providers/registry.ts`
- Create: `packages/ai/src/orchestrator.ts`

- [ ] **Step 1: Write provider registry**

Write `packages/ai/src/providers/registry.ts`:

```typescript
import type { AIProvider, AIProviderConfig, AIProviderId } from '../provider-types';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';

const providerConstructors: Record<AIProviderId, new () => AIProvider> = {
  ollama: OllamaProvider,
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  google: GoogleProvider,
};

export function createProvider(id: AIProviderId): AIProvider {
  const Ctor = providerConstructors[id];
  if (!Ctor) throw new Error(`Unknown provider: ${id}`);
  return new Ctor();
}

export function getAvailableProviders(): AIProviderId[] {
  return Object.keys(providerConstructors) as AIProviderId[];
}
```

- [ ] **Step 2: Write orchestrator**

Write `packages/ai/src/orchestrator.ts`:

```typescript
import type { AIProvider, AIProviderConfig, AIExecutionResult, AIProviderId } from './provider-types';
import { createProvider } from './providers/registry';

export class AIOrchestrator {
  private providers = new Map<AIProviderId, AIProvider>();
  private activeId: AIProviderId | null = null;

  async configure(config: AIProviderConfig): Promise<void> {
    const provider = createProvider(config.id);
    await provider.initialize(config);
    this.providers.set(config.id, provider);
    if (!this.activeId) this.activeId = config.id;
  }

  setActive(id: AIProviderId): void {
    if (!this.providers.has(id)) throw new Error(`Provider ${id} not configured`);
    this.activeId = id;
  }

  getActive(): AIProviderId | null {
    return this.activeId;
  }

  async execute(prompt: string, systemPrompt?: string): Promise<AIExecutionResult> {
    if (!this.activeId) throw new Error('No AI provider configured. Go to Settings > AI Provider.');
    const provider = this.providers.get(this.activeId);
    if (!provider) throw new Error(`Provider ${this.activeId} not found`);
    return provider.executeTask(prompt, systemPrompt);
  }

  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/ai/src/providers/registry.ts packages/ai/src/orchestrator.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ai): add provider registry and tier orchestrator"
```

---

### Task 3.6: Create Worker AI proxy route for external APIs

**Files:**
- Modify: `apps/workers/src/index.ts`
- Create: `apps/workers/src/routes/ai-proxy-external.ts`

- [ ] **Step 1: Create external AI proxy route**

Write `apps/workers/src/routes/ai-proxy-external.ts`:

```typescript
import { Hono } from 'hono';

const aiProxyExternal = new Hono();

aiProxyExternal.post('/', async (c) => {
  const { provider, model, messages, apiKey } = await c.req.json<{
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    messages: Array<{ role: string; content: string }>;
    apiKey: string;
  }>();

  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    google: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  };

  const url = endpoints[provider];
  if (!url) return c.json({ error: 'Unknown provider' }, 400);

  try {
    let body: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (provider === 'openai') {
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = JSON.stringify({ model, messages, max_tokens: 256 });
    } else if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
      const userMsg = messages.find(m => m.role === 'user')?.content ?? '';
      body = JSON.stringify({
        model,
        system: systemMsg,
        messages: [{ role: 'user', content: userMsg }],
        max_tokens: 256,
      });
    } else {
      // Google
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
      body = JSON.stringify({ contents });
    }

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `Upstream error: ${res.status} ${errText}` }, 502);
    }

    const data = await res.json() as Record<string, unknown>;
    
    // Normalize response
    let text = '';
    let tokensUsed = 0;
    
    if (provider === 'openai') {
      const choices = data.choices as Array<{ message: { content: string } }>;
      text = choices?.[0]?.message?.content ?? '';
      tokensUsed = (data.usage as { total_tokens: number })?.total_tokens ?? 0;
    } else if (provider === 'anthropic') {
      const content = data.content as Array<{ text: string }>;
      text = content?.[0]?.text ?? '';
      tokensUsed = (data.usage as { output_tokens: number })?.output_tokens ?? 0;
    } else {
      const candidates = data.candidates as Array<{ content: { parts: Array<{ text: string }> } }>;
      text = candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      tokensUsed = (data.usageMetadata as { totalTokenCount: number })?.totalTokenCount ?? 0;
    }

    return c.json({ text, tokensUsed });
  } catch (err) {
    return c.json({ error: `Proxy error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});

export default aiProxyExternal;
```

- [ ] **Step 2: Register the proxy route in index.ts**

In `apps/workers/src/index.ts`, add:
```typescript
import aiProxyExternal from './routes/ai-proxy-external';
// ... in route setup:
app.route('/api/ai/proxy', aiProxyExternal);
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/workers/src/routes/ai-proxy-external.ts apps/workers/src/index.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(workers): add AI proxy route for external providers"
```

---

### Task 3.7: Add encrypted API key storage

**Files:**
- Modify: `packages/core/src/stores/spark-store.ts`

- [ ] **Step 1: Add AI settings to spark-store**

Add to spark-store:

```typescript
interface AISettings {
  provider: AIProviderId | null;
  apiKey: string;      // encrypted
  model: string;
  endpoint: string;    // for Ollama
}

// Add to SparkStore interface:
aiSettings: AISettings | null;
setAISettings: (settings: AISettings) => void;
clearAISettings: () => void;

// In create():
aiSettings: null,
setAISettings: (settings) => set({ aiSettings: settings }),
clearAISettings: () => set({ aiSettings: null }),
```

Note: API key encryption/decryption should use the same SecureStorage mechanism used for wallet keys. For now, the store holds the encrypted string. The actual encryption wrapper will be in a separate utility.

- [ ] **Step 2: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/core/src/stores/spark-store.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(core): add encrypted AI settings to spark-store"
```

---

### Task 3.8: Wire NarrativeEngine to AIProvider system

**Files:**
- Modify: `packages/ai/src/narrative-engine.ts`
- Modify: `packages/core/src/mining/ai-integration.ts`

- [ ] **Step 1: Update NarrativeEngine to accept AIOrchestrator**

In `narrative-engine.ts`, add a method that takes an `AIOrchestrator` instance instead of raw AI output:

```typescript
async generateFromOrchestrator(
  orchestrator: AIOrchestrator,
  spark: Spark,
  context: string
): Promise<NarrativeEvent> {
  const systemPrompt = buildSystemPrompt(spark);
  const result = await orchestrator.execute(context, systemPrompt);
  return this.processOutput(result.text, spark, result.model);
}
```

- [ ] **Step 2: Update ai-integration.ts**

Replace hardcoded `AIEngine` with `AIOrchestrator`:

```typescript
// Before: const { AIEngine } = await import("@bitcoinbaby/ai");
// After:  const { AIOrchestrator } = await import("@bitcoinbaby/ai");
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add packages/ai/src/narrative-engine.ts packages/core/src/mining/ai-integration.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ai): wire NarrativeEngine to AIOrchestrator"
```

---

### Task 3.9: Create AI Provider Settings UI

**Files:**
- Create: `apps/web/src/components/settings/AIProviderSettings.tsx`

- [ ] **Step 1: Create the settings component**

Write `apps/web/src/components/settings/AIProviderSettings.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useSparkStore } from '@bitcoinbaby/core';
import type { AIProviderId } from '@bitcoinbaby/ai';

const PROVIDERS: Array<{ id: AIProviderId; label: string; models: string[] }> = [
  { id: 'ollama', label: 'Ollama (Local)', models: ['llama3', 'mistral', 'phi3'] },
  { id: 'openai', label: 'OpenAI (ChatGPT)', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'] },
  { id: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'] },
  { id: 'google', label: 'Google (Gemini)', models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
];

export function AIProviderSettings() {
  const { aiSettings, setAISettings, clearAISettings } = useSparkStore();
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId | ''>(aiSettings?.provider ?? '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(aiSettings?.model ?? '');
  const [endpoint, setEndpoint] = useState(aiSettings?.endpoint ?? 'http://localhost:11434');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const selectedProviderData = PROVIDERS.find(p => p.id === selectedProvider);

  const handleTest = async () => {
    setStatus('testing');
    setStatusMsg('Testing connection...');
    // Test logic will be implemented after orchestrator integration
    setTimeout(() => {
      setStatus('success');
      setStatusMsg('Connection successful!');
    }, 1000);
  };

  const handleSave = () => {
    if (!selectedProvider) return;
    setAISettings({
      provider: selectedProvider,
      apiKey, // Will be encrypted before storage
      model,
      endpoint,
    });
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-bold">AI Provider</h3>
      
      {/* Provider selector */}
      <div>
        <label className="block text-sm mb-1">Provider</label>
        <select
          className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value as AIProviderId);
            setModel('');
          }}
        >
          <option value="">-- Select provider --</option>
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm mb-1">API Key</label>
        <input
          type="password"
          className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      {/* Model selector */}
      {selectedProviderData && (
        <div>
          <label className="block text-sm mb-1">Model</label>
          <select
            className="w-full p-2 rounded bg-gray-800 border border-gray-700"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">-- Select model --</option>
            {selectedProviderData.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Endpoint (Ollama only) */}
      {selectedProvider === 'ollama' && (
        <div>
          <label className="block text-sm mb-1">Ollama Endpoint</label>
          <input
            type="text"
            className="w-full p-2 rounded bg-gray-800 border border-gray-700"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
          onClick={handleTest}
          disabled={!selectedProvider || status === 'testing'}
        >
          {status === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50"
          onClick={handleSave}
          disabled={!selectedProvider || !apiKey}
        >
          Save
        </button>
        {aiSettings?.provider && (
          <button
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-500"
            onClick={clearAISettings}
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Status */}
      {statusMsg && (
        <p className={`text-sm ${status === 'success' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
          {statusMsg}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add component to settings page**

In `apps/web/src/app/settings/page.tsx`, add `<AIProviderSettings />` section.

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/web/src/components/settings/AIProviderSettings.tsx apps/web/src/app/settings/page.tsx
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ui): add AI provider settings panel"
```

---

## Fase 4: UI Redesign — HOME | EXPLORE | YOU

### Task 4.1: Create 3-tab layout

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace 4-tab layout with 3-tab bottom nav**

```typescript
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SparkAvatar } from '@bitcoinbaby/ui';

const TABS = [
  { id: 'home', label: 'HOME', icon: '⚡', path: '/home' },
  { id: 'explore', label: 'EXPLORE', icon: '🔍', path: '/explore' },
  { id: 'you', label: 'YOU', icon: '👤', path: '/you' },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = TABS.find(t => pathname.startsWith(t.path))?.id ?? 'home';

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <nav className="flex border-t border-gray-800 bg-gray-900">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-1
              ${activeTab === tab.id ? 'text-yellow-400' : 'text-gray-500'}`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Delete old route groups and create new pages**

Remove old tabs: `(app)/mine/`, `(app)/baby/`, etc. Create new:
- `apps/web/src/app/(app)/home/page.tsx`
- `apps/web/src/app/(app)/explore/page.tsx`
- `apps/web/src/app/(app)/you/page.tsx`

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ui): implement 3-tab navigation (HOME/EXPLORE/YOU)"
```

---

### Task 4.2: HOME screen — Spark + Mining

**Files:**
- Create: `apps/web/src/app/(app)/home/page.tsx`
- Create: `apps/web/src/components/home/SparkDisplay.tsx`
- Create: `apps/web/src/components/home/MiningBar.tsx`
- Create: `apps/web/src/components/home/NarrativeBubble.tsx`

- [ ] **Step 1: Create SparkDisplay component**

Pixel art centered display of the active spark with animation states (idle, mining, evolving).

- [ ] **Step 2: Create MiningBar component**

Integrated mining progress bar below the spark, showing hashrate and progress.

- [ ] **Step 3: Create NarrativeBubble component**

Speech bubble above the spark showing the latest AI-generated narrative event.

- [ ] **Step 4: Assemble HOME page**

```typescript
'use client';

import { useSparkStore } from '@bitcoinbaby/core';
import { SparkDisplay } from '@/components/home/SparkDisplay';
import { MiningBar } from '@/components/home/MiningBar';
import { NarrativeBubble } from '@/components/home/NarrativeBubble';

export default function HomePage() {
  const spark = useSparkStore(s => s.activeSpark());

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
      {spark ? (
        <>
          <NarrativeBubble spark={spark} />
          <SparkDisplay spark={spark} />
          <MiningBar />
          <div className="text-xs text-gray-500 text-center">
            Level {spark.level} · {spark.bloodline} · {spark.xp} XP
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="text-gray-400 mb-4">No Spark yet</p>
          <button className="px-4 py-2 bg-yellow-600 rounded">
            Mint a Genesis Spark
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/web/src/app/(app)/home/ apps/web/src/components/home/
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ui): HOME screen with Spark display, mining, and narrative"
```

---

### Task 4.3: EXPLORE screen — Marketplace + World

**Files:**
- Create: `apps/web/src/app/(app)/explore/page.tsx`

- [ ] **Step 1: Create EXPLORE page with placeholder sections**

Sections: Marketplace (buy/sell Sparks), Online Sparks grid, Factions/Events, Leaderboard.

- [ ] **Step 2: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/web/src/app/(app)/explore/
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ui): EXPLORE screen with marketplace and world view"
```

---

### Task 4.4: YOU screen — Wallet + Settings

**Files:**
- Create: `apps/web/src/app/(app)/you/page.tsx`

- [ ] **Step 1: Create YOU page**

Sections: Wallet info (balance, address), Spark collection grid, Settings (AI Provider, network, display), Transaction history.

- [ ] **Step 2: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/web/src/app/(app)/you/
git -C /Users/munay/dev/bitcoinbaby commit -m "feat(ui): YOU screen with wallet, collection, and settings"
```

---

## Fase 5: Producción & Mainnet Launch

### Task 5.1: Production configuration and security hardening

**Files:**
- Modify: `apps/workers/wrangler.toml`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Production wrangler.toml**

Add production environment with mainnet Scrolls endpoint, stricter rate limits, and production vars.

- [ ] **Step 2: Production next.config.ts**

Ensure CSP headers include production domains, enable strict mode, configure production build optimizations.

- [ ] **Step 3: Security review checklist**

Verify: CSP nonce-based, security headers, API key encryption, rate limiting, input sanitization.

- [ ] **Step 4: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/workers/wrangler.toml apps/web/next.config.ts
git -C /Users/munay/dev/bitcoinbaby commit -m "chore: production configuration and security hardening"
```

---

### Task 5.2: Deploy contracts to Bitcoin mainnet

**Files:**
- Modify: `packages/bitcoin/src/charms/token.ts`
- Modify: `packages/bitcoin/src/charms/nft.ts`

- [ ] **Step 1: Configure mainnet network**

Update Charms config to use mainnet Scrolls and mempool.space mainnet endpoint.

- [ ] **Step 2: Deploy $SPARK token contract**

Deploy to Bitcoin mainnet. Record new App ID.

- [ ] **Step 3: Deploy Genesis Sparks NFT contract**

Deploy to Bitcoin mainnet. Record new App ID.

- [ ] **Step 4: Update App IDs in codebase and docs**

- [ ] **Step 5: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "feat: deploy SPARK token and Genesis Sparks to Bitcoin mainnet"
```

---

### Task 5.3: App Store submission assets

**Files:**
- Create: `apps/web/ios/App/Assets.xcassets/` (screenshots, icons)
- Create: store listing metadata

- [ ] **Step 1: Prepare iOS assets**

App icon 1024x1024, screenshots for iPhone 6.7" and 6.5" displays.

- [ ] **Step 2: Prepare Android assets**

App icon, feature graphic, screenshots.

- [ ] **Step 3: Write store listings**

App name: BitcoinSparks. Description emphasizing mining, AI narrative, Bitcoin NFTs.

- [ ] **Step 4: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "chore: App Store and Play Store submission assets"
```

---

### Task 5.4: Landing page and user docs

**Files:**
- Modify: `apps/web/src/app/(marketing)/page.tsx`
- Modify: `README.md`

- [ ] **Step 1: Redesign landing page for BitcoinSparks**

SEO-optimized landing explaining: What is BitcoinSparks, how mining works, what are Sparks, how to get started.

- [ ] **Step 2: Update README with new project info**

- [ ] **Step 3: Commit**

```bash
git -C /Users/munay/dev/bitcoinbaby add apps/web/src/app/(marketing)/ README.md
git -C /Users/munay/dev/bitcoinbaby commit -m "docs: landing page and updated README for BitcoinSparks"
```

---

### Task 5.5: Smoke tests and final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/munay/dev/bitcoinbaby && pnpm typecheck && pnpm lint && pnpm test
```
Expected: all pass

- [ ] **Step 2: Build all packages**

```bash
cd /Users/munay/dev/bitcoinbaby && pnpm build
```
Expected: all packages build successfully

- [ ] **Step 3: Verify Workers deploy**

```bash
cd /Users/munay/dev/bitcoinbaby && pnpm --filter @bitcoinbaby/workers deploy
```

- [ ] **Step 4: End-to-end smoke test**

Manual test: wallet create → mint Spark → start mining → AI narrative generated → evolve Spark.

- [ ] **Step 5: Final commit and tag**

```bash
git -C /Users/munay/dev/bitcoinbaby add -A
git -C /Users/munay/dev/bitcoinbaby commit -m "chore: final verification and production readiness"
git -C /Users/munay/dev/bitcoinbaby tag -a v1.0.0 -m "BitcoinSparks v1.0.0 — mainnet launch"
```