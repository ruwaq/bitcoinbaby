# Tareas de Implementación

- `[x]` **Fase 1: Corrección de Wallet Lock UX y CSP en Frontend**
  - `[x]` Modificar `apps/web/src/hooks/useWallet.ts` para evitar bloqueo preventivo en hidratación
  - `[x]` Modificar `apps/web/src/proxy.ts` para permitir subdominios de Hugging Face en `connect-src`

- `[/]` **Fase 2: Reporte de Progreso de Inferencia de IA en Tiempo Real**
  - `[x]` Modificar `packages/ai/src/engine.ts` para calcular y reportar progreso global ponderado de descarga en `initialize`
  - `[x]` Modificar `packages/core/src/mining/ai-integration.ts` para propagar el progreso a través de `AIStatus` y `onStatusChange`
  - `[x]` Modificar `packages/core/src/mining/types.ts` para añadir `onAIStatusChange` a la interfaz `MinerEvents`
  - `[x]` Modificar `packages/core/src/mining/orchestrator.ts` para canalizar el progreso a través del orquestador
  - `[x]` Modificar `packages/core/src/mining/mining-singleton.ts` para persistir y actualizar `aiStatus` en el estado global
  - `[ ]` Modificar `packages/core/src/hooks/useGlobalMining.ts` para exponer `aiStatus`
  - `[ ]` Modificar `apps/web/src/hooks/features/useMining.ts` para exponer `aiStatus` en el hook del frontend

- `[ ]` **Fase 3: Visualización de Progreso Retro Pixel-Art y Control de Errores**
  - `[ ]` Modificar `apps/web/src/components/sections/MiningSection.tsx` para pasar `aiStatus` a la visualización
  - `[ ]` Modificar `apps/web/src/components/features/mining/MiningVisualization.tsx` para renderizar la barra pixel-art de progreso y el estado de error/reintento

- `[ ]` **Fase 4: Reemplazo de Transacción Dummy (Hex de 60 Bytes)**
  - `[ ]` Modificar `packages/bitcoin/src/blockchain/mock-mempool.ts` (línea 228)
  - `[ ]` Modificar `apps/workers/src/services/mempool-service.ts` (línea 356)
  - `[ ]` Modificar `apps/workers/src/services/nft-minting-simple.ts` (línea 158)

- `[ ]` **Fase 5: Limpieza de Teoría Obsoleta de SHA-256**
  - `[ ]` Modificar `apps/web/src/components/features/mining/RewardInfoPanel.tsx` para reenfocar en PoUW
  - `[ ]` Modificar `apps/web/src/app/technology/page.tsx` para detallar el flujo PoUW de IA con WebGPU/Gemma

- `[ ]` **Fase 6: Verificación y Pruebas**
  - `[ ]` Ejecutar `pnpm typecheck`
  - `[ ]` Ejecutar `pnpm test`
  - `[ ]` Crear walkthrough.md con los resultados y verificaciones
