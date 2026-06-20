# Genesis Babies NFT - Guia Tecnica

> Sistema de generacion, evolucion e indexing para los 10,000 Genesis Babies

## 1. Sistema de Generacion (AI + Algoritmica)

### Stack Recomendado

```
┌─────────────────────────────────────────────────────────────┐
│                    GENERACION PIPELINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. LAYER COMPOSITION (HashLips Art Engine)                │
│     └── 150+ traits organizados en capas                   │
│     └── Rarity weights por archivo                         │
│     └── DNA unique check                                    │
│                                                             │
│  2. AI ENHANCEMENT (Retro Diffusion / PixelLab)            │
│     └── Coherencia de estilo pixel art                     │
│     └── Paleta de colores consistente                      │
│     └── Detalles unicos por combinacion                    │
│                                                             │
│  3. UPSCALING (Real-ESRGAN)                                │
│     └── 4x para alta resolucion                            │
│     └── Modelo anime optimizado                            │
│                                                             │
│  4. METADATA + RARITY (OpenRarity)                         │
│     └── JSON estandar OpenSea                              │
│     └── Rarity score calculado                             │
│                                                             │
│  5. STORAGE (Hibrido)                                      │
│     └── Arweave (permanente)                               │
│     └── IPFS (rapido, cache)                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### HashLips Art Engine Setup

```bash
# Clonar el engine
git clone https://github.com/HashLips/hashlips_art_engine.git
cd hashlips_art_engine
npm install
```

**Estructura de capas:**

```
layers/
├── 01_Background/
│   ├── Space#10.png        # 10% rarity (raro)
│   ├── Ocean#25.png        # 25% rarity
│   └── Forest#65.png       # 65% rarity (comun)
├── 02_Body/
│   ├── Human#70.png
│   ├── Robot#15.png
│   ├── Animal#10.png
│   ├── Alien#4.png
│   └── Mystic#1.png        # 1% = ultra raro
├── 03_Eyes/
│   ├── Normal#50.png
│   ├── Sleepy#20.png
│   ├── Laser#5.png
│   └── ... (20 variantes)
├── 04_Mouth/
│   └── ... (15 variantes)
├── 05_Accessories/
│   └── ... (40 variantes)
└── 06_Effects/
    ├── None#70.png
    ├── Sparkle#15.png
    ├── Fire#10.png
    └── Rainbow#5.png
```

**Configuracion (src/config.js):**

```javascript
const layerConfigurations = [
  {
    growEditionSizeTo: 10000,
    layersOrder: [
      { name: "01_Background" },
      { name: "02_Body" },
      { name: "03_Eyes" },
      { name: "04_Mouth" },
      { name: "05_Accessories" },
      { name: "06_Effects", blend: MODE.overlay, opacity: 0.7 },
    ],
  },
];

const format = {
  width: 512,
  height: 512,
  smoothing: false,  // IMPORTANTE: sin anti-aliasing para pixel art
};

const pixelFormat = {
  ratio: 8,  // Cada pixel logico = 8x8 pixeles reales
};

const extraMetadata = {
  external_url: "https://bitcoinbaby.dev",
  seller_fee_basis_points: 250,  // 2.5% royalty
};
```

### AI Enhancement con Retro Diffusion

Para pixel art autentico, usar [Retro Diffusion](https://runware.ai/blog/retro-diffusion-creating-authentic-pixel-art-with-ai-at-scale):

```python
# Pseudocodigo del enhancement
from retro_diffusion import PixelArtEnhancer

enhancer = PixelArtEnhancer(
    model="flux-pixel-art",
    palette_size=32,           # Paleta limitada
    grid_alignment=True,       # Pixeles alineados
    dithering="ordered"        # Dithering retro
)

def enhance_batch(input_dir: str, output_dir: str):
    for img_path in glob(f"{input_dir}/*.png"):
        enhanced = enhancer.process(
            img_path,
            style="8bit_nes",
            coherence=0.9,
            preserve_structure=True
        )
        enhanced.save(f"{output_dir}/{img_path.name}")
```

### Rarity Calculation (OpenRarity)

```typescript
// packages/bitcoin/src/nft/rarity.ts

interface Trait {
  trait_type: string;
  value: string;
}

interface NFTMetadata {
  tokenId: number;
  attributes: Trait[];
}

// Calcular rareza usando formula estandar
export function calculateRarity(
  nft: NFTMetadata,
  collection: NFTMetadata[]
): number {
  const totalSupply = collection.length;
  let rarityScore = 0;

  for (const trait of nft.attributes) {
    // Contar cuantos NFTs tienen este trait
    const traitCount = collection.filter(n =>
      n.attributes.some(
        t => t.trait_type === trait.trait_type && t.value === trait.value
      )
    ).length;

    // Rareza = 1 / frecuencia
    const traitRarity = totalSupply / traitCount;
    rarityScore += traitRarity;
  }

  return rarityScore;
}

// Ranking de toda la coleccion
export function rankCollection(collection: NFTMetadata[]): Map<number, number> {
  const scores = collection.map(nft => ({
    tokenId: nft.tokenId,
    score: calculateRarity(nft, collection)
  }));

  // Ordenar por score descendente
  scores.sort((a, b) => b.score - a.score);

  // Asignar ranking
  const rankings = new Map<number, number>();
  scores.forEach((item, index) => {
    rankings.set(item.tokenId, index + 1);
  });

  return rankings;
}
```

### Storage Hibrido

```typescript
// packages/bitcoin/src/nft/storage.ts

import { create } from '@web3-storage/w3up-client';
import Arweave from 'arweave';

interface StorageResult {
  ipfs_uri: string;
  arweave_uri: string;
}

export class NFTStorage {
  private arweave: Arweave;
  private ipfsClient: any;

  constructor() {
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https'
    });
  }

  async uploadImage(imageBuffer: Buffer, filename: string): Promise<StorageResult> {
    // 1. Upload a IPFS (rapido, cache global)
    const ipfsCid = await this.uploadToIPFS(imageBuffer);

    // 2. Upload a Arweave (permanente, $5-50 por coleccion)
    const arweaveId = await this.uploadToArweave(imageBuffer);

    return {
      ipfs_uri: `ipfs://${ipfsCid}/${filename}`,
      arweave_uri: `ar://${arweaveId}`
    };
  }

  async uploadMetadata(metadata: object): Promise<StorageResult> {
    const jsonBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    return this.uploadImage(jsonBuffer, 'metadata.json');
  }

  private async uploadToIPFS(data: Buffer): Promise<string> {
    // Usar web3.storage o Pinata
    const client = await create();
    const cid = await client.uploadFile(new Blob([data]));
    return cid.toString();
  }

  private async uploadToArweave(data: Buffer): Promise<string> {
    const tx = await this.arweave.createTransaction({ data });
    tx.addTag('Content-Type', 'image/png');
    tx.addTag('App-Name', 'BitcoinBaby');

    await this.arweave.transactions.sign(tx);
    await this.arweave.transactions.post(tx);

    return tx.id;
  }
}
```

---

## 2. Sistema de Evolucion

### Lecciones de Proyectos Anteriores

| Proyecto | Que hicieron bien | Que hicieron mal |
|----------|-------------------|------------------|
| **Wolf Game** | Todo on-chain, staking con riesgo | Bug en contrato, tuvo que migrar |
| **DigiDaigaku** | Sistema de bloodlines, merge NFTs | Complejidad alta |
| **Pixelmon** | Nada | Metadata centralizada, arte fake, rug |
| **CryptoKitties** | Genetica algoritmica, breeding | Colapso de Ethereum por gas |

### Arquitectura de Evolucion para BitcoinBaby

```
┌─────────────────────────────────────────────────────────────┐
│                   EVOLUTION SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ESTADO DEL BABY (en Charm UTXO)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Inmutable (desde genesis):                          │   │
│  │   • dna: "a3f9c2..."  (determina visuals base)     │   │
│  │   • bloodline: "royal" | "warrior" | "rogue"       │   │
│  │   • genesis_block: 840000                          │   │
│  │                                                     │   │
│  │ Mutable (evoluciona):                              │   │
│  │   • level: 1-10                                    │   │
│  │   • xp: 0-999 (reset al subir nivel)              │   │
│  │   • total_xp: acumulado de por vida               │   │
│  │   • work_count: trabajos IA completados           │   │
│  │   • evolution_count: veces evolucionado           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TRANSICIONES DE ESTADO                                    │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  WORK    │───▶│  LEVEL   │───▶│ EVOLVE   │             │
│  │  PROOF   │    │   UP     │    │ VISUAL   │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│       │               │               │                    │
│   +100 XP        XP >= 1000      Level % 2 == 0           │
│   work_count++   level++         new_sprite               │
│                  xp = 0          burn BABTC               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tipos de Evolucion

```typescript
// packages/bitcoin/src/nft/evolution.ts

export interface BabyNFTState {
  // Inmutables
  readonly dna: string;
  readonly bloodline: 'royal' | 'warrior' | 'rogue' | 'mystic';
  readonly genesis_block: number;

  // Mutables
  level: number;
  xp: number;
  total_xp: number;
  work_count: number;
  last_work_block: number;
  evolution_count: number;
  tokens_earned: bigint;
}

// Costos de evolucion (en BABTC)
export const EVOLUTION_COSTS: Record<number, number> = {
  2: 100,      // Level 1 -> 2
  3: 250,      // Level 2 -> 3
  4: 500,      // Level 3 -> 4
  5: 1000,     // Level 4 -> 5
  6: 2500,     // Level 5 -> 6
  7: 5000,     // Level 6 -> 7
  8: 10000,    // Level 7 -> 8
  9: 25000,    // Level 8 -> 9
  10: 50000,   // Level 9 -> 10 (max)
};

// XP requerido por nivel
export const XP_REQUIREMENTS: Record<number, number> = {
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 4000,
  8: 8000,
  9: 16000,
  10: 32000,
};

// Boosts por nivel
export const LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 5,
  3: 10,
  4: 15,
  5: 25,
  6: 35,
  7: 50,
  8: 70,
  9: 90,
  10: 120,  // +120% mining boost al nivel maximo
};
```

### Spell de Evolucion (Charms v2)

```yaml
# spell: baby-level-up
# El Baby sube de nivel cuando tiene suficiente XP
version: 2

apps:
  $00: n/${BABY_NFT_APP_ID}/${BABY_NFT_VK}    # NFT Baby
  $01: t/${BABTC_APP_ID}/${BABTC_VK}          # Token BABTC

ins:
  # Input 1: El Baby actual
  - utxo_id: ${baby_utxo}
    charms:
      $00:
        level: 3
        xp: 520           # >= 500 requerido para nivel 4
        total_xp: 1270
        dna: "a3f9c2..."
        bloodline: "royal"
        work_count: 150

  # Input 2: Tokens BABTC a quemar
  - utxo_id: ${token_utxo}
    charms:
      $01: 500            # 500 BABTC para nivel 4

outs:
  # Output 1: Baby evolucionado
  - address: ${owner_address}
    charms:
      $00:
        level: 4          # Nivel incrementado
        xp: 0             # XP reset
        total_xp: 1270    # Total preservado
        dna: "a3f9c2..."  # DNA inmutable
        bloodline: "royal"
        work_count: 150
        evolution_count: 1
    sats: 546

  # Output 2: Tokens quemados (a OP_RETURN)
  # Los 500 BABTC desaparecen (burn)
```

### Visuales Dinamicos (Recursive Inscriptions)

Los visuals del Baby cambian segun el nivel usando inscripciones recursivas:

```html
<!-- baby_renderer.html (inscripcion base) -->
<!DOCTYPE html>
<html>
<head>
  <script src="/content/traits_library_inscription_id"></script>
</head>
<body>
  <canvas id="baby" width="64" height="64"></canvas>
  <script>
    // Obtener traits del Baby desde la URL o parametros
    const params = new URLSearchParams(window.location.search);
    const level = parseInt(params.get('level') || '1');
    const dna = params.get('dna') || 'default';

    // Renderizar Baby segun nivel y DNA
    const canvas = document.getElementById('baby');
    const ctx = canvas.getContext('2d');

    // Cargar sprites segun nivel
    const baseSprite = TRAITS.bodies[dna.slice(0, 2)];
    const levelSprite = TRAITS.evolutions[level];

    // Componer imagen
    ctx.drawImage(baseSprite, 0, 0);
    ctx.drawImage(levelSprite, 0, 0);
  </script>
</body>
</html>
```

---

## 3. Scrolls e Indexing

### Arquitectura Real de Charms

```
┌─────────────────────────────────────────────────────────────┐
│              CHARMS NO NECESITA INDEXER                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Modelo tradicional (Ordinals, BRC-20, Runes):             │
│                                                             │
│  Bitcoin Node ──▶ Indexer ──▶ Database ──▶ API ──▶ App     │
│                   (escanea                (centralizado)    │
│                    bloques)                                 │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Modelo Charms (client-side validation):                   │
│                                                             │
│  Bitcoin Node ──▶ Tu Wallet ──▶ ZK Proof ──▶ Verificado!   │
│                   (tiene la tx   (embebido                  │
│                    + spell)       en la tx)                 │
│                                                             │
│  NO indexer, NO database central, NO confianza en terceros │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Scrolls: Que Es Realmente

Scrolls es el **servicio de co-firma** de Charms, NO un indexer:

```typescript
// Los UNICOS 3 endpoints de Scrolls
GET  /config                    // Fee configuration
GET  /{network}/address/{nonce} // Derivar address para funding
POST /{network}/sign            // Co-firmar transaccion
```

**Config response:**
```json
{
  "fee_address": {
    "main": "bc1q...",
    "testnet4": "tb1q..."
  },
  "fee_per_input": 64,
  "fee_basis_points": 10,
  "fixed_cost": 895
}
```

### Verificacion de Balances con charms-js

```typescript
// packages/bitcoin/src/charms/balance.ts

import { extractCharmsForWallet, isWasmReady } from '@charms-dev/charms-js';
import { MempoolClient } from '../blockchain/mempool';

export class CharmsBalanceService {
  private mempool: MempoolClient;

  constructor(network: 'mainnet' | 'testnet4') {
    this.mempool = new MempoolClient(network);
  }

  async getTokenBalance(address: string, ticker: string): Promise<bigint> {
    // Esperar WASM
    while (!isWasmReady()) {
      await new Promise(r => setTimeout(r, 100));
    }

    // 1. Obtener UTXOs de la address
    const utxos = await this.mempool.getAddressUTXOs(address);
    const outpoints = utxos.map(u => `${u.txid}:${u.vout}`);

    // 2. Obtener transacciones recientes
    const txHistory = await this.mempool.getAddressTransactions(address);

    let totalBalance = 0n;

    // 3. Para cada tx, extraer charms
    for (const txInfo of txHistory) {
      const txHex = await this.mempool.getRawTransaction(txInfo.txid);

      const charms = await extractCharmsForWallet(
        txHex,
        txInfo.txid,
        outpoints,
        'testnet4'
      );

      // Sumar balance del ticker especifico
      for (const charm of charms) {
        if (charm.ticker === ticker) {
          totalBalance += BigInt(charm.amount);
        }
      }
    }

    return totalBalance;
  }

  async getNFTsOwned(address: string): Promise<BabyNFTState[]> {
    // Similar pero filtrando por app_id de Genesis Babies
    const utxos = await this.mempool.getAddressUTXOs(address);
    const outpoints = utxos.map(u => `${u.txid}:${u.vout}`);

    const txHistory = await this.mempool.getAddressTransactions(address);
    const nfts: BabyNFTState[] = [];

    for (const txInfo of txHistory) {
      const txHex = await this.mempool.getRawTransaction(txInfo.txid);

      const charms = await extractCharmsForWallet(
        txHex,
        txInfo.txid,
        outpoints,
        'testnet4'
      );

      for (const charm of charms) {
        if (charm.appId === GENESIS_BABIES_APP_ID) {
          nfts.push(charm.state as BabyNFTState);
        }
      }
    }

    return nfts;
  }
}
```

### Cache y Performance

```typescript
// packages/bitcoin/src/services/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class DataCache {
  private cache = new Map<string, CacheEntry<any>>();

  private readonly TTL: Record<string, number> = {
    'fee_rates': 30_000,      // 30 segundos
    'btc_balance': 60_000,    // 1 minuto
    'utxos': 30_000,          // 30 segundos
    'scrolls_config': 3600_000, // 1 hora
    'token_balance': 120_000,  // 2 minutos (por bloque)
    'nft_state': 120_000,      // 2 minutos
  };

  get<T>(key: string, type: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = this.TTL[type] || 60_000;
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### WebSocket Real-time (Mempool.space)

```typescript
// packages/bitcoin/src/services/realtime.ts

export class BitcoinRealtimeService {
  private ws: WebSocket | null = null;
  private subscribers = new Map<string, Set<(data: any) => void>>();

  connect(network: 'mainnet' | 'testnet4' = 'testnet4') {
    const baseUrl = network === 'mainnet'
      ? 'wss://mempool.space/api/v1/ws'
      : 'wss://mempool.space/testnet4/api/v1/ws';

    this.ws = new WebSocket(baseUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      // Re-subscribe todas las addresses
      for (const address of this.subscribers.keys()) {
        this.ws!.send(JSON.stringify({
          action: 'track-address',
          data: address
        }));
      }
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Nuevo bloque
      if (msg.block) {
        this.emit('block', msg.block);
      }

      // Transaccion nueva para address
      if (msg['address-transactions']) {
        for (const [address, callbacks] of this.subscribers) {
          const txs = msg['address-transactions'];
          callbacks.forEach(cb => cb({ type: 'tx', address, txs }));
        }
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(() => this.connect(network), 5000);
    };
  }

  subscribeToAddress(address: string, callback: (data: any) => void) {
    if (!this.subscribers.has(address)) {
      this.subscribers.set(address, new Set());

      // Enviar subscribe si ya conectado
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          action: 'track-address',
          data: address
        }));
      }
    }

    this.subscribers.get(address)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(address)?.delete(callback);
    };
  }

  private emit(event: string, data: any) {
    // Broadcast a todos los subscribers
    for (const callbacks of this.subscribers.values()) {
      callbacks.forEach(cb => cb({ type: event, data }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
```

### React Hooks para Datos

```typescript
// packages/core/src/hooks/useCharms.ts

import { useState, useEffect, useCallback } from 'react';
import { CharmsBalanceService } from '@bitcoinbaby/bitcoin';

export function useTokenBalance(address: string | null, ticker: string) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const service = new CharmsBalanceService('testnet4');
      const bal = await service.getTokenBalance(address, ticker);
      setBalance(bal);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [address, ticker]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 120_000); // cada 2 min
    return () => clearInterval(interval);
  }, [refresh]);

  return { balance, loading, error, refresh };
}

export function useOwnedNFTs(address: string | null) {
  const [nfts, setNfts] = useState<BabyNFTState[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    const service = new CharmsBalanceService('testnet4');

    async function load() {
      setLoading(true);
      const owned = await service.getNFTsOwned(address);
      setNfts(owned);
      setLoading(false);
    }

    load();
  }, [address]);

  return { nfts, loading };
}

export function useMiningBoost(address: string | null) {
  const { nfts, loading } = useOwnedNFTs(address);

  const boost = useMemo(() => {
    if (nfts.length === 0) return 0;

    // Retornar el mejor boost de todos los NFTs
    return Math.max(...nfts.map(nft => LEVEL_BOOSTS[nft.level] || 0));
  }, [nfts]);

  return { boost, loading, nftCount: nfts.length };
}
```

---

## 4. Resumen de Mejores Practicas

### Generacion

| Aspecto | Recomendacion | Fuente |
|---------|---------------|--------|
| Engine | HashLips Art Engine 2.0 | [GitHub](https://github.com/HashLips/hashlips_art_engine) |
| Pixel Art AI | Retro Diffusion (FLUX) | [Runware](https://runware.ai/blog/retro-diffusion-creating-authentic-pixel-art-with-ai-at-scale) |
| Upscaling | Real-ESRGAN anime | [GitHub](https://github.com/xinntao/Real-ESRGAN) |
| Rarity | OpenRarity standard | [OpenRarity](https://www.openrarity.dev/) |
| Storage | Arweave + IPFS hibrido | Best practice 2025 |

### Evolucion

| Aspecto | Recomendacion | Por que |
|---------|---------------|---------|
| Estado | On-chain (Charm UTXO) | Verificable, sin confianza |
| Identidad | app_id inmutable | Preserva historia |
| Visuals | Recursive inscriptions | Dinamicos sin re-inscribir |
| Burns | Obligatorios por nivel | Deflacion controlada |
| DNA | Inmutable desde genesis | Rareza preservada |

### Indexing

| Aspecto | Recomendacion | Notas |
|---------|---------------|-------|
| Token balance | charms-js (client-side) | Sin indexer central |
| BTC balance | Mempool.space API | Ya implementado |
| Real-time | Mempool WebSocket | Notificaciones de tx |
| Cache | TTL por tipo de dato | 30s-1h segun volatilidad |

---

## Referencias

- [HashLips Art Engine](https://github.com/HashLips/hashlips_art_engine)
- [HashLips Lab Docs](https://lab.hashlips.io/docs/art-engine)
- [Retro Diffusion](https://runware.ai/blog/retro-diffusion-creating-authentic-pixel-art-with-ai-at-scale)
- [PixelLab AI](https://www.pixellab.ai/)
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
- [OpenRarity](https://www.openrarity.dev/)
- [Charms Protocol](https://docs.charms.dev)
- [charms-js SDK](https://github.com/CharmsDev/charms-js)
- [Dynamic NFTs - Chainlink](https://chain.link/education-hub/dynamic-nft-use-cases)
- [Wolf Game Analysis](https://thedefiant.io/wolf-game-nfts-play-to-earn)
- [Mempool.space API](https://mempool.space/docs/api)
