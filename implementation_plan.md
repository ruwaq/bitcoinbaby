# Plan de Implementación: Solución de UX de Wallet, CSP, Prover de NFT y Reporte de Progreso de AI PoUW

Este documento describe el plan detallado para resolver los tres problemas reportados en el ecosistema `bitcoinbaby` y agregar las mejoras en la visualización, descarga y flujo del motor de IA PoUW (Gemma 4 E2B), además de limpiar la información obsoleta de minería de hash tradicional.

---

## Análisis de Alternativas: Ollama vs. Transformers.js (WebGPU)

Hemos evaluado el uso de **Ollama** vs. **Transformers.js** para la minería Proof of Useful Work (PoUW) en BitcoinBaby. A continuación se presentan los trade-offs:

1. **Ollama:**
   - *Pros:* Ejecución de inferencia muy rápida con hardware nativo y aceleración de GPU nativa.
   - *Contras:* Requiere que el usuario descargue e instale una aplicación externa independiente y configure de forma manual parámetros del sistema (como variables CORS `OLLAMA_ORIGINS="*"`) para permitir la conexión desde el navegador. Esto genera una alta fricción de onboarding.
   - *Verificabilidad:* Dificulta garantizar que el pipeline sea determinista (requerido para consensus proofs) ya que depende de la versión nativa del software instalado.

2. **Transformers.js con WebGPU:**
   - *Pros:* Cero fricción de instalación (el modelo se descarga automáticamente al caché del navegador/IndexedDB y se ejecuta en sandbox). Garantiza 100% el determinismo mediante Greedy Decoding configurado en el navegador, permitiendo la generación de firmas y pruebas PoUW criptográficas válidas.
   - *Contras:* El modelo cuantizado (~1.5GB) requiere una primera descarga que puede tardar unos minutos.

**Decisión:** Mantendremos **Transformers.js con WebGPU** como tecnología base por su accesibilidad y facilidad de uso. Sin embargo, solucionaremos la falta de información implementando un **reporte de progreso detallado (0-100% con bytes descargados)** en tiempo real durante la inicialización de Gemma, asegurando una UX transparente y profesional.

---

## User Review Required

> [!IMPORTANT]
> **Permisos de CSP para Hugging Face (AI Engine):**
> Se autorizarán los subdominios de Hugging Face en `proxy.ts` para que la directiva `connect-src` permita descargar el modelo ONNX del repositorio de `huggingface.co`.
>
> **Progreso de Carga en Tiempo Real:**
> Integraremos una barra de progreso pixel-art detallada dentro del "Gimnasio Mental" de minería para reportar la descarga acumulada de Gemma, eliminando la incertidumbre de si la IA está activa o descargada.
>
> **Limpieza de Minado Tradicional:**
> Actualizaremos la sección de tecnología y los componentes informativos de recompensas para enfocarlos puramente en el procesamiento y validación de tokens de IA (PoUW) con WebGPU, quitando la información obsoleta de minado de SHA-256 con hashes tradicionales.

---

## Proposed Changes

### Componente: Motor de IA (`packages/ai`)

#### [MODIFY] [engine.ts](file:///Users/munay/dev/bitcoinbaby/packages/ai/src/engine.ts)
- Modificar el método `initialize(onProgress?: (data: any) => void): Promise<void>`.
- Calcular la descarga acumulada de todos los fragmentos ONNX y el tokenizer usando un mapa que rastree los bytes leídos de cada archivo en `progress_callback`.
- Pasar el progreso procesado (porcentaje total y bytes cargados/totales) al callback `onProgress`.

---

### Componente: Core & Integración (`packages/core`)

#### [MODIFY] [ai-integration.ts](file:///Users/munay/dev/bitcoinbaby/packages/core/src/mining/ai-integration.ts)
- Extender el tipo `AIStatus` para incluir:
  - `modelState: "idle" | "loading" | "ready" | "error"`
  - `downloadProgress: number` (0 a 100)
  - `downloadDetails?: { file?: string; loaded?: number; total?: number }`
- Actualizar el constructor de `AIWorkIntegration` para que acepte un callback opcional `onStatusChange?: (status: AIStatus) => void`.
- En `_doInitialize()`, actualizar y reportar en tiempo real el progreso de inicialización llamando a `onStatusChange` en cada evento del callback del `AIEngine`.

#### [MODIFY] [types.ts](file:///Users/munay/dev/bitcoinbaby/packages/core/src/mining/types.ts)
- Añadir el evento opcional `onAIStatusChange?: (status: any) => void` a la interfaz `MinerEvents`.

#### [MODIFY] [orchestrator.ts](file:///Users/munay/dev/bitcoinbaby/packages/core/src/mining/orchestrator.ts)
- Modificar la instanciación de `AIWorkIntegration` para pasar el callback `onStatusChange`, el cual disparará el evento `onAIStatusChange` del orquestador.

#### [MODIFY] [mining-singleton.ts](file:///Users/munay/dev/bitcoinbaby/packages/core/src/mining/mining-singleton.ts)
- Añadir `aiStatus: any | null` al estado global `MiningManagerState`.
- Escuchar el evento `onAIStatusChange` del orquestador en `initialize` y actualizar el estado reactivo (`this.updateState({ aiStatus })`).

#### [MODIFY] [useGlobalMining.ts](file:///Users/munay/dev/bitcoinbaby/packages/core/src/hooks/useGlobalMining.ts)
- Asegurar que `aiStatus` se devuelva en el hook para que sea accesible en los wrappers del frontend.

---

### Componente: Frontend (`apps/web`)

#### [MODIFY] [useMining.ts](file:///Users/munay/dev/bitcoinbaby/apps/web/src/hooks/features/useMining.ts)
- Exponer la propiedad `aiStatus` en el objeto `miner` devuelto por el hook.

#### [MODIFY] [useWallet.ts](file:///Users/munay/dev/bitcoinbaby/apps/web/src/hooks/useWallet.ts)
- Modificar `WalletSingleton` para evitar el bloqueo durante la hidratación de red retrasada de Zustand (mantener sesión activa al navegar en la SPA).

#### [MODIFY] [proxy.ts](file:///Users/munay/dev/bitcoinbaby/apps/web/src/proxy.ts)
- Agregar `https://huggingface.co` y `https://*.huggingface.co` a la CSP de directiva `connect-src`.

#### [MODIFY] [MiningVisualization.tsx](file:///Users/munay/dev/bitcoinbaby/apps/web/src/components/features/mining/MiningVisualization.tsx)
- Recibir la prop opcional `aiStatus` de tipo `any`.
- Si `aiStatus.modelState === "loading"`, renderizar una hermosa barra de carga pixel-art superpuesta dentro del "Gimnasio Mental" que muestre el progreso en porcentaje y bytes.
- Si `aiStatus.modelState === "error"`, renderizar un aviso visual de error de carga de IA con un botón para reintentar (`onStart`).

#### [MODIFY] [MiningSection.tsx](file:///Users/munay/dev/bitcoinbaby/apps/web/src/components/sections/MiningSection.tsx)
- Pasar `aiStatus={miner.aiStatus}` a `<MiningVisualization />`.

#### [MODIFY] [RewardInfoPanel.tsx](file:///Users/munay/dev/bitcoinbaby/apps/web/src/components/features/mining/RewardInfoPanel.tsx)
- Actualizar la redacción para cambiar los conceptos de minería de hash tradicional (ceros a la izquierda) por el nuevo flujo de Proof of Useful Work (PoUW) por tokens procesados del LLM local Gemma 4 E2B.

#### [MODIFY] [page.tsx](file:///Users/munay/dev/bitcoinbaby/apps/web/src/app/technology/page.tsx)
- Quitar referencias obsoletas a "Traditional Mining" como Fase 1.
- Actualizar el "Flujo de minería V10" para explicar el nuevo proceso del PoUW con IA:
  1. Obtención de la tarea JIT (Just-In-Time) desde el pool.
  2. Ejecución local del modelo Gemma 4 E2B vía WebGPU y ONNX Runtime.
  3. Generación de la prueba de inferencia determinista firmada.
  4. Envío de la prueba a la blockchain/workers de Charms.
  5. Obtención de recompensas en tokens y XP.

---

### Componente: Bitcoin Core & Workers (`packages/bitcoin` y `apps/workers`)

#### [MODIFY] [mock-mempool.ts](file:///Users/munay/dev/bitcoinbaby/packages/bitcoin/src/blockchain/mock-mempool.ts)
#### [MODIFY] [mempool-service.ts](file:///Users/munay/dev/bitcoinbaby/apps/workers/src/services/mempool-service.ts)
#### [MODIFY] [nft-minting-simple.ts](file:///Users/munay/dev/bitcoinbaby/apps/workers/src/services/nft-minting-simple.ts)
- Reemplazar el hex corrupto dummy de 54 bytes por el hex de transacción válido de 60 bytes en todos los módulos de pruebas mock para corregir el fallo de deserialización en Rust.

---

## Verification Plan

### Automated Tests
- Validar tipo estático de TypeScript en todo el monorepo:
  ```bash
  pnpm typecheck
  ```
- Validar pruebas unitarias:
  ```bash
  pnpm test
  ```

### Manual Verification
1. Comprobar que al iniciar el minado, el sistema detecta que no tiene el modelo descargado y muestra la hermosa barra de carga en el "Gimnasio Mental" reflejando bytes/progreso real de Hugging Face.
2. Comprobar que al finalizar la descarga, el estado cambia a `"ready"`, se inicia la inferencia local de manera fluida y se procesan los tokens/s de IA.
3. Validar que la navegación entre secciones no bloquea la wallet.
4. Validar que la tecnología de minado tradicional se visualiza reemplazada por la información nueva del motor de IA.
