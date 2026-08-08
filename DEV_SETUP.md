# Guía de Desarrollo Local y Pruebas (Bitcoin Baby)

Esta guía documenta las herramientas y metodologías disponibles en el monorepo para realizar pruebas eficientes, rápidas y profesionales tanto en un entorno simulado (**Sandbox/Mocks**) como en un entorno local real (**Regtest**).

---

## 1. Modo Sandbox (Mock Blockchain en Memoria) - Recomendado para Desarrollo Diario

El Modo Sandbox utiliza un simulador de blockchain en memoria (`MockMempoolClient`) que reemplaza las conexiones a la red real de Bitcoin. Permite probar toda la interfaz visual y flujos del frontend de manera instantánea y libre de fallos de red.

### Características del Sandbox:

- **Sin Dependencias:** No requiere Docker ni instalar nodos locales de Bitcoin.
- **Auto-Faucet Automático:** Al importar cualquier frase semilla, el simulador asigna automáticamente un balance inicial ficticio de **0.5 BTC** (50,000,000 satoshis) para que puedas realizar transacciones inmediatamente.
- **Confirmación Instantánea:** Los envíos de transacciones, consumos de UTXOs y saldos se actualizan de inmediato en pantalla sin esperar confirmación de bloques.

### Activación:

Para activar el modo Sandbox, agrega o edita la siguiente línea en tu archivo de variables de entorno de la app web:

**Archivo:** `apps/web/.env.local`

```env
NEXT_PUBLIC_USE_MOCK_BLOCKCHAIN=true
```

Reinicia el servidor de desarrollo (`pnpm dev`) y el frontend utilizará automáticamente el simulador en memoria.

---

## 2. Modo Regtest Local (Bitcoin Core Real)

Para pruebas integrales reales (E2E), firma de PSBTs reales e interacciones con el protocolo a nivel de red, debes usar un nodo de Bitcoin Core local corriendo en modo **Regtest**.

El monorepo expone la API de Esplora/Mempool en el puerto **`http://localhost:3000`** (NO el 5000, que en macOS está ocupado por ControlCenter/AirPlay). El proxy `chopsticks` sirve la API en la raíz (sin el prefijo `/api`).

### Opción A: Usando el Docker Compose del Proyecto (Nativo)

Levanta un nodo de Bitcoin Core (`bitcoind`), el indexador de bloques (`electrs`), y el proxy con faucet/minería (`chopsticks` de Nigiri). Las imágenes se publican ahora en GHCR (las antiguas `vulpemventures/bitcoin:26.0` y `vulpemventures/chopsticks` fueron eliminadas de Docker Hub):

- `ghcr.io/getumbrel/docker-bitcoind:v30.0` (Bitcoin Core)
- `ghcr.io/vulpemventures/electrs:latest` (indexador Electrum/Esplora)
- `ghcr.io/vulpemventures/nigiri-chopsticks:latest` (proxy + faucet + minería)

1. **Levantar contenedores:**
   ```bash
   docker compose up -d
   ```
2. **Verificar que están corriendo:**
   ```bash
   docker compose ps
   ```
   `electrs` necesita unos segundos para indexar los bloques iniciales; el primer request puede fallar con connection refused hasta que sincronice.
3. **Apagar contenedores:**
   ```bash
   docker compose down
   ```

### Opción B: Usando Nigiri CLI (Recomendado por la comunidad de Bitcoin)

Nigiri es una herramienta CLI excelente que gestiona este entorno de forma global y te provee de herramientas rápidas.

1. **Instalar Nigiri:**

   ```bash
   curl https://getnigiri.vulpem.com | bash
   ```

   _(Asegúrate de agregar nigiri a tu PATH siguiendo las instrucciones del instalador)_.

2. **Iniciar Entorno:**
   ```bash
   nigiri start
   ```
3. **Detener Entorno:**
   ```bash
   nigiri stop
   ```
4. **Limpiar datos viejos:**
   ```bash
   nigiri stop --delete
   ```

### Interactuar con la Red Regtest Local

Una vez que el entorno local esté activo (Opción A), la API + faucet están en el puerto **3000**:

- **Explorador / API (Esplora):** [http://localhost:3000](http://localhost:3000). La API se sirve en la raíz (sin `/api`), ej. `http://localhost:3000/blocks/tip/height`.
- **Obtener una dirección nueva (de la wallet del faucet):**
  ```bash
  curl -s http://localhost:3000/getnewaddress
  # => {"address":"bcrt1q..."}
  ```
- **Obtener Satoshis (Faucet):** El faucet se llama con un `POST` a `/faucet` indicando `address` y `amount` (en BTC):
  ```bash
  curl -s -X POST http://localhost:3000/faucet \
    -H "Content-Type: application/json" \
    -d '{"address":"bcrt1q...","amount":0.01}'
  # => {"txId":"..."}   (se mina automáticamente en un bloque nuevo)
  ```
  > Si usas Nigiri CLI en su lugar: `nigiri faucet <tu-direccion-bcrt1q...>`.
- **Minar Bloques (Confirmar Transacciones):** Con `chopsticks` la minería es **automática** al.broadcastar (`POST /tx` mina un bloque en cuanto recibe la transacción), así que **no hay un endpoint `/mine` separado**. Para forzar bloques sin broadcastar, usa directamente el RPC de `bitcoind` o `nigiri mine 1` si usas la CLI.
- **Consultar UTXOs / altura:** (electrs debe haber indexado)
  ```bash
  curl -s http://localhost:3000/address/bcrt1q.../utxo
  curl -s http://localhost:3000/blocks/tip/height
  ```

### Configuración en la Web App para Regtest:

1. En `apps/web/.env.local`, asegúrate de desactivar el mock si quieres usar Bitcoin Core real:
   ```env
   NEXT_PUBLIC_USE_MOCK_BLOCKCHAIN=false
   ```
2. En la interfaz web de la aplicación, ve a la sección de configuración/redes y cambia la red activa a **"Bitcoin Regtest (Local)"**. Las llamadas de API apuntarán a `http://localhost:3000` (raíz, sin prefijo `/api`).

---

## 3. Servidor de Charms Local (Workers & Backend)

Para correr el backend local (los Cloudflare Workers que procesan los créditos de minería, recompensas y verificación de pruebas de trabajo):

1. **Iniciar el backend local (Wrangler):**
   ```bash
   pnpm --filter @bitcoinbaby/workers dev
   ```
   El backend se levantará por defecto en el puerto `http://localhost:8787` de acuerdo con las configuraciones del monorepo.

---

## 4. Ejecución de Tests Automatizados

Para garantizar que ningún cambio de red o de transacciones rompa las reglas del monorepo, puedes correr la suite completa de pruebas:

- **Correr todos los tests del monorepo:**
  ```bash
  pnpm test
  ```
- **Verificar solo el comportamiento del simulador Mock:**
  ```bash
  pnpm --filter @bitcoinbaby/bitcoin test --run mock-mempool
  ```
