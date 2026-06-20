# BitcoinBaby - Decisiones Técnicas

Este documento detalla el fundamento y diseño tecnológico detrás del ecosistema BitcoinBaby. Para evitar confusiones, el documento está dividido en la **Implementación Real (Fase 9)** y las **Propuestas/Diseños Conceptuales Futuros**.

---

## 🏛️ PARTE 1: Implementación Real (Fase 9)

### 1. Bitcoin + BitcoinOS (Smart Contracts en UTXO)
* **El Problema:** Ethereum tiene gas fees variables y vulnerabilidades de puentes multi-firma; Solana carece de la máxima descentralización y seguridad acumulada de Bitcoin.
* **La Solución:** BitcoinOS y el protocolo Charms.
  ```
  SEGURIDAD:     Bitcoin L1 (hash rate masivo)
  ESCALABILIDAD: BitSNARK (ZK verification off-chain)
  PROGRAMACIÓN:  Charms (smart contracts en UTXO)
  ```
* **Decisión:** BitcoinBaby hereda la seguridad de la red de Bitcoin sin requerir bridges centralizados de custodia de terceros. Las operaciones se realizan utilizando contratos inteligentes de Charms que se liquidan directamente on-chain en el modelo UTXO de Bitcoin (redes `testnet4`, `regtest` y `mainnet`).

### 2. Runes (Fácil verificación SPV en móviles)
* **El Problema:** El protocolo BRC-20 utiliza datos de Testigo (Witness Bloat) que requieren indexadores externos complejos fuera de la red para comprobar estados de balance, lo que imposibilita la consulta rápida en dispositivos móviles ligeros.
* **La Solución:** Runes (basado en OP_RETURN).
* **Decisión:** Runes permite la consulta directa mediante clientes SPV (Simple Payment Verification) sobre la estructura nativa de UTXO de Bitcoin. Esto permite que una app en un teléfono verifique saldos de forma descentralizada de manera rápida y eficiente en una sola transacción.

### 3. Next.js 16 + Capacitor (100% Código de UI Compartido)
* **Alternativas Evaluadas:** Swift/Kotlin nativos (dos bases de código lentas de sincronizar), React Native (complejo de integrar con WebGPU y Transformers.js y difícil soporte SEO en web).
* **La Solución:**
  ```
         Front-end unificado (React 19 + Tailwind v4 + Zustand)
              │
              ├────────► Web Target (Vercel: SSR + ISR)
              │
              └────────► Mobile Target (Capacitor: Static Export 'out/')
  ```
* **Decisión:** Next.js 16 (React 19) actuando como base de la app web y empaquetado nativamente con Capacitor.
  * **Unificación Absoluta:** El 100% de la UI y los stores Zustand se comparten.
  * **Compilación:** En producción web se despliega en Vercel (con SSR), y el script `build:native` exporta de forma estática la app en un bundle HTML/JS/CSS embebido para iOS/Android.

### 4. Inferencia Local con Transformers.js & Fallback determinista
* **El Problema:** La inferencia en la nube requiere endpoints centralizados, claves de API, es propensa a fallos de conectividad offline y vulnera la privacidad local del usuario.
* **La Solución:** Inferencia ONNX determinista local (Greedy Search) ejecutándose en Web Workers para no congelar el hilo de renderizado principal de la UI.
* **Modelo Primario:** `onnx-community/gemma-4-E2B-it-ONNX` (cuantizado para la ejecución en navegador).
* **Fallback Automático:** En caso de fallar la descarga del modelo primario (por tamaño, fallos de red o licencias de HuggingFace), el motor de IA realiza un fallback automático a `Xenova/gpt2`. Esto garantiza el funcionamiento de la prueba Proof of Useful Work en cualquier circunstancia.

### 5. Estrategia de Background en WebViews (iOS & Android)
* **La Solución:** Capacitor Background Runner.
* **Decisión:** Las tareas largas de minería o sincronización de IA se delegan al sistema operativo móvil a través del plugin nativo `@capacitor/background-runner`:
  * **iOS (BGProcessingTask):** Se agenda la tarea en el planificador del sistema. El sistema operativo la ejecuta de forma inteligente (cuando el dispositivo carga, está con Wi-Fi y está inactivo).
  * **Android (WorkManager):** Se ejecuta con restricciones estrictas de ahorro energético. En Android 14+, si el usuario inicia la minería de forma explícita, se levanta un servicio en primer plano (Foreground Service) con notificación activa.

### 6. Tokenomics Rationale
* **Suministro:** 21,000,000,000 BABY (21B). Cada Satoshi de Bitcoin equivale a 1,000 BABY conceptualmente, lo que previene problemas de representación visual decimal y mantiene una escala intuitiva de precios unitarios bajos (ej. $0.001 por token).
* **Emisión de Halving Dinámico:**
  $$\text{recompensa} = \frac{\text{BASE\_REWARD}}{1 + \log(\text{total\_mineros})}$$
  Ajusta la dificultad y emisión en base al tamaño de la red de participantes (minería útil) y no puramente al tiempo transcurrido, fomentando la adopción temprana.

---

## 🔮 PARTE 2: Propuestas y Diseños Conceptuales Futuros (Especulativos / Fase 10+)

*Las tecnologías descritas a continuación representan el diseño conceptual del ecosistema final, pero no están integradas en el código ejecutable de la Fase 9 actual.*

### 7. Aceleración NPU Dedicada (WebNN)
* **Objetivo:** Optimizar el rendimiento energético en dispositivos móviles. La inferencia actual en CPU/WebGPU consume entre 3W y 5W de batería. El uso de silicios dedicados (Apple Neural Engine, Snapdragon Hexagon) consumirá menos de 0.5W.
* **Integración Futura:** Migrar el engine de Transformers.js al estándar WebNN (Web Neural Network API) conforme obtenga soporte completo en WebViews móviles nativas.

### 8. Aprendizaje Federado (Federated Learning) con Flower
* **Objetivo:** Permitir el entrenamiento colaborativo del modelo de IA global de BitcoinBaby sin centralizar los datos de los usuarios.
* **Diseño Conceptual:** Flower SDK móvil. Las apps se registran con el servidor agregador de Flower para entrenar mini-lotes locales y transmitir únicamente las actualizaciones de pesos/gradientes.

### 9. Zero-Knowledge Machine Learning (ZKML) con EZKL
* **Objetivo:** Verificar criptográficamente que un minero realmente realizó la inferencia del lote de datos en su dispositivo sin forzar al verificador a re-computar la red neuronal entera.
* **Diseño Conceptual:** Exportación del modelo ONNX a circuitos Halo2 utilizando el compilador de EZKL (Rust/Wasm) para generar pruebas ZK de inferencia válidas y compactas en el teléfono.

### 10. Modelo de Seguridad ZK (Verificación Probabilística)
* **Objetivo:** Evitar que mineros maliciosos envíen gradientes falsos y cobren tokens sin procesar la IA.
* **Diseño Conceptual:** Para evitar el 100% del costo computacional de generar pruebas ZK a cada segundo, se implementará teoría de juegos:
  * El 100% de los usuarios envían un checksum ligero de sus gradientes.
  * Un 5% elegido aleatoriamente en cada ronda por la blockchain debe proveer una prueba ZK completa de EZKL.
  * Si fallan, se aplica slashing a su colateral/stake, lo que desincentiva los ataques y reduce la carga computacional 20x.

### 11. Privacidad Diferencial (Differential Privacy con Opacus / TF Privacy)
* **Objetivo:** Impedir la reconstrucción de los datos privados de un usuario a partir de los gradientes que envía al agregador federado.
* **Diseño Conceptual:** Inyección de ruido matemático calibrado utilizando técnicas de privacidad diferencial local en el dispositivo del usuario antes de transmitir las actualizaciones de pesos.

---

## 🛠️ Matriz de Decisiones Técnicas

| Decisión | Estado | Tecnología | Razón Clave |
|---|---|---|---|
| **Capa de Contratos** | Real | Charms / BitcoinOS | Seguridad heredada de Bitcoin L1. |
| **Formato de Tokens** | Real | Runes (OP_RETURN) | Consulta ultraligera compatible con SPV móvil. |
| **Framework UI** | Real | Next.js 16 / React 19 | Máxima velocidad de desarrollo y 100% reutilización. |
| **Model Loader** | Real | Transformers.js (ONNX Web) | Ejecución directa en navegador/WebView sin APIs de pago. |
| **Aprendizaje Federado** | Conceptual | Flower Framework | Escalabilidad en entrenamiento móvil distribuido. |
| **Verificación ML** | Conceptual | EZKL / Halo2 | Pruebas criptográficas de ejecución honesta de IA. |
| **Privacidad ML** | Conceptual | Opacus / TF Privacy | Anonimato matemático de gradientes locales. |

---

## 🏁 Enlaces de Interés
* [Roadmap de Desarrollo](./ROADMAP.md)
* [Guía de Desarrollo Local y Regtest](../DEV_SETUP.md)
