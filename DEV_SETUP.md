# Guía de Desarrollo Local y Pruebas (Bitcoin Baby)

Esta guía documenta las herramientas y metodologías disponibles en el monorepo para realizar pruebas eficientes, rápidas y profesionales tanto en un entorno simulado (**Sandbox/Mocks**) como en un entorno local real (**Regtest**).

---

## 1. Modo Sandbox (Mock Blockchain en Memoria) - Recomendado para Desarrollo Diario

El Modo Sandbox utiliza un simulador de blockchain en memoria (`MockMempoolClient`) que reemplaza las conexiones a la red real de Bitcoin. Permite probar toda la interfaz visual y flujos del frontend de manera instantánea y libre de fallos de red.

### Características del Sandbox:
* **Sin Dependencias:** No requiere Docker ni instalar nodos locales de Bitcoin.
* **Auto-Faucet Automático:** Al importar cualquier frase semilla, el simulador asigna automáticamente un balance inicial ficticio de **0.5 BTC** (50,000,000 satoshis) para que puedas realizar transacciones inmediatamente.
* **Confirmación Instantánea:** Los envíos de transacciones, consumos de UTXOs y saldos se actualizan de inmediato en pantalla sin esperar confirmación de bloques.

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

El monorepo soporta dos maneras sencillas de levantar esta infraestructura local (las dos exponen la API de Mempool/Esplora en el puerto estándar `http://localhost:5000`):

### Opción A: Usando el Docker Compose del Proyecto (Nativo)

Levanta un nodo de Bitcoin Core (`bitcoind`), el indexador de bloques (`electrs`), y el proxy visual (`chopsticks` de Nigiri).

1. **Levantar contenedores:**
   ```bash
   docker compose up -d
   ```
2. **Apagar contenedores:**
   ```bash
   docker compose down
   ```

### Opción B: Usando Nigiri CLI (Recomendado por la comunidad de Bitcoin)

Nigiri es una herramienta CLI excelente que gestiona este entorno de forma global y te provee de herramientas rápidas.

1. **Instalar Nigiri:**
   ```bash
   curl https://getnigiri.vulpem.com | bash
   ```
   *(Asegúrate de agregar nigiri a tu PATH siguiendo las instrucciones del instalador)*.

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

Una vez que el entorno local esté activo (ya sea por Opción A o B):

* **Explorador Visual:** Abre [http://localhost:5000](http://localhost:5000) en tu navegador para ver el explorador de bloques local.
* **Obtener Satoshis (Faucet):**
  * Si usas Nigiri:
    ```bash
    nigiri faucet <tu-direccion-tb1q...>
    ```
  * O mediante la API HTTP de Nigiri:
    ```bash
    curl -d '{"address":"<tu-direccion>"}' http://localhost:5000/api/faucet
    ```
* **Minar Bloques (Confirmar Transacciones):**
  * Para confirmar las transacciones pendientes en tu pool local, mina bloques manualmente:
    ```bash
    nigiri mine 1
    ```
  * O mediante API HTTP:
    ```bash
    curl -d '{"blocks":1}' http://localhost:5000/api/mine
    ```

### Configuración en la Web App para Regtest:
1. En `apps/web/.env.local`, asegúrate de desactivar el mock si quieres usar Bitcoin Core real:
   ```env
   NEXT_PUBLIC_USE_MOCK_BLOCKCHAIN=false
   ```
2. En la interfaz web de la aplicación, ve a la sección de configuración/redes y cambia la red activa a **"Bitcoin Regtest (Local)"**. Las llamadas de API apuntarán a `http://localhost:5000/api`.

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

* **Correr todos los tests del monorepo:**
  ```bash
  pnpm test
  ```
* **Verificar solo el comportamiento del simulador Mock:**
  ```bash
  pnpm --filter @bitcoinbaby/bitcoin test --run mock-mempool
  ```
