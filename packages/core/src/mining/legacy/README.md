# Legacy Miners (Reference Implementations)

This directory contains reference implementations of **BRO-canonical SHA-256d
mining**, kept on purpose. They are NOT deleted because they are good, correct
code.

## What's here

- `cpu-miner.ts` — CPU mining via Web Workers (leading-zeros proof of work).
- `webgpu-miner.ts` — GPU-accelerated mining via WebGPU / WGSL compute shaders.

## Status: NOT instantiated in production

BitcoinBaby's production model is **"Block-Tick"**: the player observes real
Bitcoin blocks and reacts to them; the player does **not** mine. The current
`MiningOrchestrator` only runs the AI Proof-of-Useful-Work loop and does not
spin up either miner here, so `getMinerType()` returns `null`.

These files are retained as a reference for a possible future **"hardcore
mining"** mode. Import them explicitly when you need them:

```ts
import { CPUMiner } from "./legacy/cpu-miner";
import { WebGPUMiner } from "./legacy/webgpu-miner";
```

They are intentionally **not** re-exported from the active
`packages/core/src/mining/index.ts` barrel, so they cannot be pulled in
accidentally from the production code path.
