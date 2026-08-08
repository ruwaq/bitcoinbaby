/**
 * Bitcoin Cosmic Data Provider
 *
 * Fetches Bitcoin network data for cosmic integration.
 * Uses mempool.space API (no API key required).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface BitcoinCosmicData {
  currentBlock: number;
  nextHalvingBlock: number;
  blocksUntilHalving: number;
  difficulty: number;
  hashrate?: number;
  mempoolSize?: number;
}

interface MempoolBlockResponse {
  height: number;
  difficulty: number;
}

interface MempoolHashrateResponse {
  currentHashrate: number;
}

interface MempoolMempoolResponse {
  count: number;
  vsize: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Bitcoin halving happens every 210,000 blocks
const HALVING_INTERVAL = 210_000;

// Halving epochs: block 0, 210000, 420000, 630000, 840000...
// The 4th halving (to 3.125 BTC) happens at block 840000 (expected April 2024)
// The 5th halving (to 1.5625 BTC) happens at block 1050000 (expected ~2028)
const HALVING_BLOCKS = [
  0, // Genesis
  210_000, // 1st halving (Nov 2012)
  420_000, // 2nd halving (Jul 2016)
  630_000, // 3rd halving (May 2020)
  840_000, // 4th halving (Apr 2024)
  1_050_000, // 5th halving (~2028)
  1_260_000, // 6th halving (~2032)
];

// API endpoints
const MEMPOOL_API = "https://mempool.space/api";
const MEMPOOL_TESTNET_API = "https://mempool.space/testnet/api";

// Cache duration (5 minutes for blocks, longer for static data)
const CACHE_DURATION_MS = 5 * 60 * 1000;

// =============================================================================
// CACHE
// =============================================================================

interface CacheEntry {
  data: BitcoinCosmicData;
  timestamp: number;
}

let cache: CacheEntry | null = null;

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Get the next halving block for a given block height
 */
function getNextHalvingBlock(currentBlock: number): number {
  for (const halvingBlock of HALVING_BLOCKS) {
    if (halvingBlock > currentBlock) {
      return halvingBlock;
    }
  }
  // Calculate next halving if beyond known epochs
  const epoch = Math.floor(currentBlock / HALVING_INTERVAL);
  return (epoch + 1) * HALVING_INTERVAL;
}

/**
 * Fetch Bitcoin data from mempool.space API
 */
async function fetchBitcoinData(
  useTestnet: boolean = false,
): Promise<BitcoinCosmicData> {
  const baseUrl = useTestnet ? MEMPOOL_TESTNET_API : MEMPOOL_API;

  try {
    // Fetch block height and difficulty
    const blockResponse = await fetch(`${baseUrl}/blocks/tip/height`);
    if (!blockResponse.ok) {
      throw new Error(`Failed to fetch block height: ${blockResponse.status}`);
    }
    const currentBlock = parseInt(await blockResponse.text(), 10);

    // Fetch latest block for difficulty
    const latestBlockResponse = await fetch(`${baseUrl}/v1/blocks`);
    if (!latestBlockResponse.ok) {
      throw new Error(
        `Failed to fetch latest block: ${latestBlockResponse.status}`,
      );
    }
    const latestBlocks: MempoolBlockResponse[] =
      await latestBlockResponse.json();
    const difficulty = latestBlocks[0]?.difficulty || 0;

    // Calculate halving data
    const nextHalvingBlock = getNextHalvingBlock(currentBlock);
    const blocksUntilHalving = nextHalvingBlock - currentBlock;

    // Optional: fetch hashrate and mempool size (non-blocking)
    let hashrate: number | undefined;
    let mempoolSize: number | undefined;

    try {
      const hashrateResponse = await fetch(`${baseUrl}/v1/mining/hashrate/1d`);
      if (hashrateResponse.ok) {
        const hashrateData: MempoolHashrateResponse =
          await hashrateResponse.json();
        hashrate = hashrateData.currentHashrate;
      }
    } catch {
      // Ignore hashrate fetch errors
    }

    try {
      const mempoolResponse = await fetch(`${baseUrl}/mempool`);
      if (mempoolResponse.ok) {
        const mempoolData: MempoolMempoolResponse =
          await mempoolResponse.json();
        mempoolSize = mempoolData.count;
      }
    } catch {
      // Ignore mempool fetch errors
    }

    return {
      currentBlock,
      nextHalvingBlock,
      blocksUntilHalving,
      difficulty,
      hashrate,
      mempoolSize,
    };
  } catch (error) {
    // Re-throw with context
    throw new Error(
      `Bitcoin data fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { cause: error },
    );
  }
}

/**
 * Get Bitcoin cosmic data with caching
 * @param forceRefresh - Skip cache and fetch fresh data
 * @param useTestnet - Use testnet API instead of mainnet
 */
export async function getBitcoinCosmicData(
  forceRefresh: boolean = false,
  useTestnet: boolean = false,
): Promise<BitcoinCosmicData | null> {
  const now = Date.now();

  // Return cached data if valid
  if (!forceRefresh && cache && now - cache.timestamp < CACHE_DURATION_MS) {
    return cache.data;
  }

  try {
    const data = await fetchBitcoinData(useTestnet);

    // Update cache
    cache = {
      data,
      timestamp: now,
    };

    return data;
  } catch (error) {
    // If we have stale cache, return it as fallback
    if (cache) {
      console.warn(
        "Bitcoin API failed, using stale cache:",
        error instanceof Error ? error.message : error,
      );
      return cache.data;
    }

    // No cache available, log error and return null
    console.error("Bitcoin cosmic data unavailable:", error);
    return null;
  }
}

/**
 * Calculate estimated time until halving
 * Assumes ~10 minute block time
 */
export function estimateTimeUntilHalving(blocksUntilHalving: number): {
  days: number;
  hours: number;
  minutes: number;
} {
  const minutesUntil = blocksUntilHalving * 10;
  const days = Math.floor(minutesUntil / (60 * 24));
  const hours = Math.floor((minutesUntil % (60 * 24)) / 60);
  const minutes = minutesUntil % 60;

  return { days, hours, minutes };
}

/**
 * Get halving progress percentage
 */
export function getHalvingProgress(
  currentBlock: number,
  nextHalvingBlock: number,
): number {
  const prevHalving = nextHalvingBlock - HALVING_INTERVAL;
  const blocksSinceLastHalving = currentBlock - prevHalving;
  return (blocksSinceLastHalving / HALVING_INTERVAL) * 100;
}

/**
 * Format difficulty for display
 */
export function formatDifficulty(difficulty: number): string {
  if (difficulty >= 1e12) {
    return `${(difficulty / 1e12).toFixed(2)}T`;
  }
  if (difficulty >= 1e9) {
    return `${(difficulty / 1e9).toFixed(2)}B`;
  }
  if (difficulty >= 1e6) {
    return `${(difficulty / 1e6).toFixed(2)}M`;
  }
  return difficulty.toLocaleString();
}

/**
 * Format Bitcoin network hashrate for display (in EH/s or TH/s)
 */
export function formatNetworkHashrate(hashrate: number): string {
  if (hashrate >= 1e18) {
    return `${(hashrate / 1e18).toFixed(2)} EH/s`;
  }
  if (hashrate >= 1e15) {
    return `${(hashrate / 1e15).toFixed(2)} PH/s`;
  }
  if (hashrate >= 1e12) {
    return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  }
  return `${hashrate.toLocaleString()} H/s`;
}

/**
 * Clear the Bitcoin data cache
 */
export function clearBitcoinCache(): void {
  cache = null;
}
