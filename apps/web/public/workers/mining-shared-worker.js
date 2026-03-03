/**
 * SharedWorker for Mining
 *
 * This worker persists across page navigations and can be shared
 * between multiple tabs. Mining continues as long as at least
 * one tab is connected.
 *
 * Note: WebGPU is NOT available in workers, so this only supports CPU mining.
 */

// =============================================================================
// STATE
// =============================================================================

const connections = [];
// MIN_DIFFICULTY = 22 (from @bitcoinbaby/core/tokenomics/constants)
// This must match the value in packages/core/src/tokenomics/constants.ts
const MIN_DIFFICULTY = 22;

let miningState = {
  isRunning: false,
  isPaused: false,
  hashrate: 0,
  totalHashes: 0,
  shares: 0,
  difficulty: MIN_DIFFICULTY,
  nonce: 0,
  startTime: null,
  lastHashTime: null,
  throttle: 100, // 0-100 percentage
};

let miningInterval = null;
let hashCount = 0;
let lastReportTime = Date.now();

// =============================================================================
// SHA-256 IMPLEMENTATION (same as cpu-miner)
// =============================================================================

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(data) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const msgLen = bytes.length;
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 9) % 64 === 0 ? 64 : 64 - ((msgLen + 9) % 64)) + 9;
  const padded = new Uint8Array(msgLen + padLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }

    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  resultView.setUint32(0, h0, false);
  resultView.setUint32(4, h1, false);
  resultView.setUint32(8, h2, false);
  resultView.setUint32(12, h3, false);
  resultView.setUint32(16, h4, false);
  resultView.setUint32(20, h5, false);
  resultView.setUint32(24, h6, false);
  resultView.setUint32(28, h7, false);

  return result;
}

function sha256d(data) {
  return sha256(sha256(data));
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function countLeadingZeroBits(bytes) {
  let count = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      count += 8;
    } else {
      count += Math.clz32(byte) - 24;
      break;
    }
  }
  return count;
}

// =============================================================================
// MINING LOGIC
// =============================================================================

function mine() {
  if (!miningState.isRunning || miningState.isPaused) return;

  const batchSize = Math.floor(1000 * (miningState.throttle / 100));
  const startNonce = miningState.nonce;

  for (let i = 0; i < batchSize; i++) {
    const nonce = startNonce + i;
    const input = `bitcoinbaby:${nonce}:${Date.now()}`;
    const hash = sha256d(input);
    const zeroBits = countLeadingZeroBits(hash);

    hashCount++;
    miningState.totalHashes++;

    if (zeroBits >= miningState.difficulty) {
      const hashHex = bytesToHex(hash);
      miningState.shares++;

      // Broadcast share found to all connections
      broadcast({
        type: "share",
        data: {
          hash: hashHex,
          nonce,
          difficulty: miningState.difficulty,
          zeroBits,
        },
      });
    }
  }

  miningState.nonce = startNonce + batchSize;

  // Report hashrate every second
  const now = Date.now();
  if (now - lastReportTime >= 1000) {
    const elapsed = (now - lastReportTime) / 1000;
    miningState.hashrate = Math.floor(hashCount / elapsed);
    hashCount = 0;
    lastReportTime = now;

    // Broadcast stats to all connections
    broadcast({
      type: "stats",
      data: {
        hashrate: miningState.hashrate,
        totalHashes: miningState.totalHashes,
        shares: miningState.shares,
        nonce: miningState.nonce,
        uptime: miningState.startTime
          ? Math.floor((now - miningState.startTime) / 1000)
          : 0,
      },
    });
  }

  // Continue mining
  if (miningState.isRunning && !miningState.isPaused) {
    // Use setTimeout instead of setInterval for better throttle control
    const delay =
      miningState.throttle < 100
        ? Math.floor(10 * (100 / miningState.throttle))
        : 0;
    setTimeout(mine, delay);
  }
}

function validateDifficulty(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (value < 1 || value > 256) return false;
  if (!Number.isFinite(value)) return false;
  return true;
}

function validateThrottle(value) {
  if (typeof value !== "number") return false;
  if (value < 1 || value > 100) return false;
  if (!Number.isFinite(value)) return false;
  return true;
}

function startMining(config = {}) {
  if (miningState.isRunning) {
    console.log("[SharedWorker] Mining already running");
    return;
  }

  const difficulty = config.difficulty;
  miningState.difficulty = validateDifficulty(difficulty)
    ? difficulty
    : MIN_DIFFICULTY;
  miningState.isRunning = true;
  miningState.isPaused = false;
  miningState.startTime = Date.now();
  miningState.nonce = 0;
  hashCount = 0;
  lastReportTime = Date.now();

  console.log(
    "[SharedWorker] Mining started with difficulty:",
    miningState.difficulty,
  );
  broadcast({ type: "status", data: "running" });

  // Start mining loop
  mine();
}

function stopMining() {
  miningState.isRunning = false;
  miningState.isPaused = false;
  miningState.hashrate = 0;
  miningState.startTime = null;

  console.log("[SharedWorker] Mining stopped");
  broadcast({ type: "status", data: "stopped" });
}

function pauseMining() {
  if (!miningState.isRunning) return;
  miningState.isPaused = true;
  console.log("[SharedWorker] Mining paused");
  broadcast({ type: "status", data: "paused" });
}

function resumeMining() {
  if (!miningState.isRunning || !miningState.isPaused) return;
  miningState.isPaused = false;
  console.log("[SharedWorker] Mining resumed");
  broadcast({ type: "status", data: "running" });
  mine();
}

function setThrottle(value) {
  if (!validateThrottle(value)) {
    console.warn("[SharedWorker] Invalid throttle rejected:", value);
    return;
  }
  miningState.throttle = value;
  console.log("[SharedWorker] Throttle set to:", miningState.throttle);
}

function setDifficulty(value) {
  if (!validateDifficulty(value)) {
    console.warn("[SharedWorker] Invalid difficulty rejected:", value);
    return;
  }
  miningState.difficulty = value;
  console.log("[SharedWorker] Difficulty set to:", miningState.difficulty);
}

// =============================================================================
// CONNECTION HANDLING
// =============================================================================

function broadcast(message) {
  const deadConnections = [];

  connections.forEach((port, index) => {
    try {
      port.postMessage(message);
    } catch (e) {
      // Port is closed, mark for cleanup
      deadConnections.push(index);
    }
  });

  // Clean up dead connections (iterate in reverse to maintain indices)
  for (let i = deadConnections.length - 1; i >= 0; i--) {
    connections.splice(deadConnections[i], 1);
  }

  if (deadConnections.length > 0) {
    console.log(
      "[SharedWorker] Cleaned up",
      deadConnections.length,
      "dead connections. Total:",
      connections.length,
    );
  }
}

function handleMessage(event, port) {
  const { type, data } = event.data;

  switch (type) {
    case "start":
      startMining(data);
      break;

    case "stop":
      stopMining();
      break;

    case "pause":
      pauseMining();
      break;

    case "resume":
      resumeMining();
      break;

    case "getState":
      port.postMessage({
        type: "state",
        data: {
          isRunning: miningState.isRunning,
          isPaused: miningState.isPaused,
          hashrate: miningState.hashrate,
          totalHashes: miningState.totalHashes,
          shares: miningState.shares,
          difficulty: miningState.difficulty,
          throttle: miningState.throttle,
          uptime: miningState.startTime
            ? Math.floor((Date.now() - miningState.startTime) / 1000)
            : 0,
        },
      });
      break;

    case "setThrottle":
      setThrottle(data);
      break;

    case "setDifficulty":
      setDifficulty(data);
      break;

    case "ping":
      port.postMessage({ type: "pong" });
      break;

    default:
      console.warn("[SharedWorker] Unknown message type:", type);
  }
}

// =============================================================================
// SHARED WORKER ENTRY POINT
// =============================================================================

self.onconnect = function (e) {
  const port = e.ports[0];
  connections.push(port);

  console.log("[SharedWorker] New connection. Total:", connections.length);

  // Send current state to new connection
  port.postMessage({
    type: "state",
    data: {
      isRunning: miningState.isRunning,
      isPaused: miningState.isPaused,
      hashrate: miningState.hashrate,
      totalHashes: miningState.totalHashes,
      shares: miningState.shares,
      difficulty: miningState.difficulty,
      throttle: miningState.throttle,
      uptime: miningState.startTime
        ? Math.floor((Date.now() - miningState.startTime) / 1000)
        : 0,
    },
  });

  port.onmessage = (event) => handleMessage(event, port);

  port.onmessageerror = () => {
    const idx = connections.indexOf(port);
    if (idx !== -1) {
      connections.splice(idx, 1);
      console.log(
        "[SharedWorker] Connection closed. Total:",
        connections.length,
      );
    }
  };

  port.start();
};

console.log("[SharedWorker] Mining SharedWorker initialized");
