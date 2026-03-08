---
name: mining-research
description: Investiga patrones de mineria en browser para BitcoinBaby. Usa cuando se pregunte sobre WebGPU mining, Web Workers, CPU hashing, orchestrator pattern, hashrate, proof of work en browser, o se trabaje en packages/core/mining/. Referencia principal es BRO Token.
allowed-tools: Read, Grep, Glob, WebFetch, WebSearch
---

# Mining Research

## Referencia Principal
BRO Token: https://github.com/CharmsDev/bro (`webapp/src/mining/`)

## Patrones Clave

1. **Orchestrator** - Coordina CPU/GPU miners, maneja bateria/visibilidad
2. **Web Workers** - Mining sin bloquear UI thread
3. **WebGPU** - Aceleracion GPU para hashing paralelo
4. **Proof of Work** - SHA-256 con leading zeros

## Estructura BitcoinBaby
```
packages/core/src/mining/
├── orchestrator.ts     # Coordinador
├── cpu-miner.ts        # Web Worker
├── webgpu-miner.ts     # GPU
└── ai-integration.ts   # PoUW
```

## APIs
- WebGPU: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
