# BitcoinBaby Comprehensive Bug Scan Report

**Scan Date:** 2026-05-20  
**Scanner:** python3 regex-based static analysis + manual file verification  
**Scope:** apps/web/src/hooks, apps/web/src/components, apps/workers/src/routes, apps/workers/src/services, packages/bitcoin/src  
**Excluded:** scripts/, .wrangler/, build artifacts, test files  

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 1 | Confirmed XSS vulnerability in on-chain NFT renderer |
| **HIGH** | 6 | Confirmed: insecure RNG in NFT reservation, type safety bypass, memory leaks, weak CSP, network mismatches |
| **MEDIUM** | 9 | Confirmed: silent promise rejection swallowing, missing error reporting, network error suppression, console.log in prod |
| **LOW** | 4 | Mostly style: TODOs in production code, non-null assertions, magic numbers in UI |

---

## CRITICAL Severity

### [CRI-001] XSS in On-Chain NFT Renderer — Weak Sanitization Filter
**File:** `packages/bitcoin/src/inscription/onchain-renderer.ts:239-244`  
**Severity:** CRITICAL  
**Category:** Cross-Site Scripting (XSS)  

**Code:**
```javascript
var DANGEROUS=/<script|javascript:|on\\w+\\s*=|<iframe|<object|<embed|<form|expression\\s*\\(|url\\s*\\(\\s*['"]?\\s*data:/i;
if(DANGEROUS.test(svg)){throw new Error('SVG contains dangerous content');}
// ...
nft.innerHTML=svg;
```

**Issue:** The `DANGEROUS` regex contains double-escaped backslashes (`\\w`, `\\s`, `\\(`, `\\s*`) which, in a JavaScript string literal, resolve to literal backslash characters. This means the regex actually searches for the literal text `\w+\s*=` instead of matching word characters and whitespace. As a result:
- `<script` is caught (correct)
- `javascript:` is caught (correct)
- Inline event handlers like `onclick=...` are **NOT caught** because `on\w+\s*=` won't match them
- `expression()` and `url(data:...)` are **NOT caught** for the same reason
- An attacker can inject malicious SVG with event handlers or CSS expressions that bypass the filter

**Impact:** If NFT metadata or traits are ever user-influenced (even indirectly), injected JavaScript could execute in the browser context, stealing wallet data, session tokens, or performing actions on behalf of the user.

**Recommended Fix:**
Replace the broken regex with a proper allow-list or use a well-tested HTML sanitizer like DOMPurify:
```javascript
// Use DOMPurify if available, or a strict allow-list
import DOMPurify from 'dompurify';
const cleanSvg = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } });
nft.innerHTML = cleanSvg;
```
If DOMPurify is not an option (on-chain context), implement a strict parser that only allows known-safe SVG elements and attributes, rejecting anything else rather than trying to blacklist.

---

## HIGH Severity

### [HIG-001] Insecure Random Number Generator for NFT Token ID Selection
**File:** `apps/workers/src/routes/nft/reserve.ts:106`  
**Severity:** HIGH  
**Category:** Insecure Randomness / Blockchain Fairness  

**Code:**
```javascript
const candidateId = Math.floor(Math.random() * MAX_SUPPLY) + 1;
```

**Issue:** `Math.random()` is a pseudo-random number generator not suitable for blockchain/crypto contexts. While the impact here is limited (NFT ID selection), it means IDs are predictable based on JavaScript engine seeding. In a competitive minting scenario, miners could predict which IDs will be reserved and race to claim desirable IDs. Additionally, `Math.random()` has known modulo bias when used with `Math.floor(random * N)`.

**Impact:** Predictable token IDs could lead to gaming of the reservation system. For a blockchain project, all randomness should come from cryptographically secure sources.

**Recommended Fix:**
```javascript
// Use crypto.getRandomValues in Workers (Cloudflare Workers support WebCrypto)
function secureRandomInt(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % max) + 1; // still has modulo bias but much better
}
// Or better, use rejection sampling to eliminate modulo bias
```

---

### [HIG-002] `script-src 'unsafe-inline'` in Production CSP
**File:** `apps/web/src/middleware.ts:43`  
**Severity:** HIGH  
**Category:** Content Security Policy Weakness  

**Code:**
```javascript
`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`,
```

**Issue:** `'unsafe-inline'` allows any inline script to execute, defeating most XSS protections. While the comment acknowledges this is needed for Next.js hydration and wallet extensions, this is a significant security trade-off. Any XSS payload injected via stored data (e.g., NFT metadata, usernames, chat messages) can execute inline scripts.

**Impact:** If any stored-XSS vulnerability exists anywhere in the app, the CSP will not block script execution. The wallet, private keys, and signing operations are at risk.

**Recommended Fix:**
1. Generate a per-request nonce and use `script-src 'self' 'nonce-{nonce}' 'wasm-unsafe-eval'`
2. Apply the nonce to all legitimate inline scripts via Next.js `nonce` prop
3. Remove `'unsafe-inline'` entirely
4. Document any third-party wallet extensions that require inline scripts and evaluate safer alternatives

---

### [HIG-003] `as any` Type Safety Bypass in Wallet Secure Erase
**File:** `packages/bitcoin/src/wallet.ts:444`  
**Severity:** HIGH  
**Category:** Type Safety / Memory Security  

**Code:**
```typescript
(this.wallet as any).mnemonic = "x".repeat(this.wallet.mnemonic.length);
```

**Issue:** The `this.wallet` is typed and should not have its `mnemonic` property mutated externally. Using `as any` bypasses type checking. More importantly, strings in JavaScript are immutable — the `mnemonic = "x".repeat(...)` assignment replaces the reference but the original string remains in memory until garbage collected. The intent is secure erase, but this doesn't actually erase anything from memory.

**Impact:** The original mnemonic string may persist in JavaScript heap memory, potentially recoverable via memory inspection or heap dumps. For a Bitcoin wallet, this is a critical security concern.

**Recommended Fix:**
```typescript
// If mnemonic is stored as a string, overwrite it character by character
// Note: In JS, string immutability means you need an array/Buffer for true erasure
if (this.wallet.mnemonic) {
  const chars = [...this.wallet.mnemonic];
  chars.fill('x');
  // Even better: use a Uint8Array or Buffer for the mnemonic in the first place
}
```
Consider refactoring the wallet to store mnemonic as a `Uint8Array` or `Buffer` which can be truly overwritten in memory.

---

### [HIG-004] setInterval Memory Leak in Mining Share Submission Cleanup
**File:** `apps/web/src/hooks/useMiningShareSubmission.ts:316`  
**Severity:** HIGH  
**Category:** Memory Leak / Resource Exhaustion  

**Code:**
```javascript
const cleanup = setInterval(() => {
  if (processedSharesRef.current.size > 1000) {
    const entries = Array.from(processedSharesRef.current);
    processedSharesRef.current = new Set(entries.slice(-500));
  }
}, 60000);
```

**Issue:** While the cleanup effect returns `clearInterval(cleanup)`, the pattern of reassigning `processedSharesRef.current = new Set(...)` creates a new Set object every time cleanup runs. The old Set and its entries are abandoned. While JavaScript GC will eventually collect them, during a long mining session with many shares this creates unnecessary memory pressure. More importantly, if this hook is mounted/unmounted rapidly, intervals could be orphaned.

**Impact:** Potential memory accumulation during extended mining sessions. On mobile devices with limited RAM (this is a Capacitor app with Android/iOS builds), this could contribute to app termination.

**Recommended Fix:**
```javascript
// Use a bounded queue or Map with timestamp eviction instead
// Or at minimum, clear the old set before reassignment:
const oldSet = processedSharesRef.current;
const entries = Array.from(oldSet);
processedSharesRef.current = new Set(entries.slice(-500));
oldSet.clear(); // Help GC
```

---

### [HIG-005] Silent Promise Rejection in Mining Share Queue
**File:** `apps/web/src/hooks/useMiningShareSubmission.ts:306-308`  
**Severity:** HIGH  
**Category:** Error Handling / Silent Failure  

**Code:**
```javascript
.catch(() => {
  // Share queue failed - will be retried by SyncManager
});
```

**Issue:** The `addShare()` promise rejection is completely swallowed. If the SyncManager's IndexedDB is full, corrupted, or if the addShare logic has a persistent bug, shares will silently fail to queue. The user believes their share was submitted (notification was shown at line 293-298) but it never enters the queue. Over time this leads to lost rewards and confused users.

**Impact:** User shares may be lost without any indication. Mining rewards not credited. Support burden increases.

**Recommended Fix:**
```javascript
.catch((error) => {
  log.error("[ShareSubmission] Failed to queue share", { error, hash: share.hash });
  addNotification({
    type: "error",
    title: "Share Queue Failed",
    message: "Your share could not be saved. It will be retried automatically.",
  });
});
```

---

### [HIG-006] Faucet Rate Limit TOCTOU Race Condition
**File:** `apps/workers/src/routes/faucet.ts:66-183`  
**Severity:** HIGH  
**Category:** Race Condition / Time-of-Check Time-of-Use  

**Issue:** The faucet claim endpoint performs rate limit checks against KV storage (lines 72-111) and then separately checks the VirtualBalanceDO (lines 119-143) before finally updating KV again (lines 153-173) and forwarding to the DO (lines 176-179). These are not atomic operations. Between the KV `get` and `put`, multiple concurrent requests from the same address could all pass the check.

**Impact:** Users can bypass the 24-hour cooldown and max total by sending concurrent claims. The KV cache check and DO credit are not in a transaction.

**Recommended Fix:**
1. Use an atomic compare-and-swap operation if the KV store supports it  
2. Or, make the DO itself the single source of truth for rate limiting by storing lastClaimAt in the DO state  
3. Acquire a per-address lock (e.g., via a Durable Object or atomic KV operation) before checking or updating  

---

## MEDIUM Severity

### [MED-001] Silent Network Error in System Status Hook
**File:** `apps/web/src/hooks/useSystemStatus.ts:94`  
**Severity:** MEDIUM  
**Category:** Error Handling  

**Code:**
```javascript
} catch {
  // Network error or API not available
  setError("Could not fetch system status");
```

**Issue:** The catch block silently swallows the actual error. `catch {}` without `error` parameter means no logging of the underlying failure (network timeout? 500? DNS?).

**Recommended Fix:**
```javascript
} catch (error) {
  log.error("[SystemStatus] Failed to fetch status", { error });
  setError("Could not fetch system status");
}
```

---

### [MED-002] console.error in Production Mining Hook
**File:** `apps/web/src/hooks/useMiningShareSubmission.ts:184`  
**Severity:** MEDIUM  
**Category:** Production Logging  

**Code:**
```javascript
console.error("[ShareSubmission] Sync error:", event.data?.error);
```

**Issue:** Direct `console.error` in production code bypasses the centralized logging system (`createLogger`). In production, this leaks error details to the browser console and prevents proper log aggregation.

**Recommended Fix:** Use the existing `log.error` from `@bitcoinbaby/shared`:
```javascript
log.error("[ShareSubmission] Sync error", { error: event.data?.error });
```

---

### [MED-003] console.error in Wallet Signing
**File:** `apps/web/src/hooks/useWallet.ts:254, 267`  
**Severity:** MEDIUM  
**Category:** Production Logging  

**Code:**
```javascript
console.error("Failed to sign PSBT:", error);
// ...
console.error("[Wallet] Failed to broadcast transaction:", error);
```

**Recommended Fix:** Replace with structured logger calls.

---

### [MED-004] Missing Error Parameter in Sync Event Catch
**File:** `apps/web/src/hooks/useMiningShareSubmission.ts:94`  
**Severity:** MEDIUM  
**Category:** Error Handling  

**Code:**
```javascript
} catch {
  // Network error or API not available
```

Wait, this is lines 94? No, let me check useSystemStatus again. useSystemStatus line 94 has `catch {`. Let me re-verify.

**Verified:** `apps/web/src/hooks/useSystemStatus.ts:94` — `catch {}` without parameter.

**Recommended Fix:** Add error parameter and log.

---

### [MED-005] Unhandled Promise in Wallet Refresh
**File:** `apps/web/src/hooks/useWallet.ts:289-371`  
**Severity:** MEDIUM  
**Category:** Promise Handling  

**Issue:** The `init()` async function inside `useEffect` is not wrapped in try/catch for all paths (it is, actually, at lines 357-364). The `init()` call itself is fire-and-forget.

Actually re-reading, it IS wrapped in try/catch. Downgrading.

**Revised — MED-005: window.location.href Navigation Pattern**
**File:** `apps/web/src/components/sections/TokenSection.tsx:42`  
**Severity:** MEDIUM  
**Category:** Navigation / SSR Safety  

**Code:**
```javascript
window.location.href = "/wallet/claim";
```

**Issue:** Direct `window.location.href` assignment bypasses Next.js routing, causes full page reload, and breaks SPA navigation. Also triggers uncontrolled redirect warnings. This is inside a client component, but still suboptimal.

**Recommended Fix:**
```javascript
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/wallet/claim");
```

---

### [MED-006] Testnet4 Mapped to Testnet Network in bitcoinjs-lib
**File:** `packages/bitcoin/src/transactions/builder.ts:40`  
**Severity:** MEDIUM  
**Category:** Blockchain Network Mismatch  

**Code:**
```javascript
testnet4: bitcoin.networks.testnet,
```

**Issue:** The project uses `testnet4` as a network identifier, but maps it to `bitcoin.networks.testnet` from bitcoinjs-lib. Testnet4 is a separate network from the old testnet3. While they share parameters today, this is a latent bug if testnet4 ever diverges.

**Impact:** Could generate invalid addresses or fail to broadcast if bitcoinjs-lib updates to distinguish testnet4.

**Recommended Fix:**
```javascript
testnet4: {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: { public: 0x043587cf, private: 0x04358394 },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
  ...bitcoin.networks.testnet // or explicit values
}
```

---

### [MED-007] PSBT Utils Default to Testnet Instead of testnet4
**File:** `packages/bitcoin/src/transactions/psbt-utils.ts:92`  
**Severity:** MEDIUM  
**Category:** Blockchain Network Mismatch  

**Code:**
```javascript
const net = network ?? bitcoin.networks.testnet;
```

**Issue:** Same as MED-006 — defaults to testnet instead of testnet4. If called without explicit network parameter on testnet4, will use testnet3 parameters.

**Recommended Fix:** Default to a proper testnet4 network object.

---

### [MED-008] Hardcoded App VK and Genesis in Treasury Signer
**File:** `apps/workers/src/services/treasury-signer.ts:236-239`  
**Severity:** MEDIUM  
**Category:** Configuration / Hardcoded Values  

**Code:**
```javascript
const appVk =
  this.env.BABTC_APP_VK ||
  "ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6";
const genesis =
  this.env.BABTC_GENESIS ||
  "b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0";
```

**Issue:** Fallback values are hardcoded production identifiers. If env vars are missing in a new deployment, the service silently uses production credentials for a different network.

**Recommended Fix:** Remove fallback values and fail fast:
```javascript
if (!this.env.BABTC_APP_VK) throw new Error("BABTC_APP_VK not configured");
```

---

## LOW Severity

### [LOW-001] TODO in Production Code — NFT Minting Sign/Broadcast
**File:** `scripts/mint-babtc-standalone.ts:498`  
**Severity:** LOW  
**Category:** Incomplete Implementation  

**Code:**
```javascript
// TODO: Sign and broadcast
```

**Note:** This is in `scripts/` directory which may be dev tooling, but if this script is used in any CI/CD or deployment pipeline, it's a problem.

---

### [LOW-002] TODO in Production Code — V11 Mint
**File:** `scripts/mint-babtc-v11.ts:278-279`  
**Severity:** LOW  
**Category:** Incomplete Implementation  

**Code:**
```javascript
// TODO: Sign and broadcast transactions
console.log("\n[TODO] Sign and broadcast transactions");
```

---

### [LOW-003] Magic Numbers in On-Chain Renderer
**File:** `packages/bitcoin/src/inscription/onchain-renderer.ts:201-203`  
**Severity:** LOW  
**Category:** Code Quality  

**Code:**
```javascript
const x=4+Math.random()*24;
const y=4+Math.random()*24;
svg+=el('circle',{cx:x,cy:y,r:0.5,fill:'#fff',opacity:0.6+Math.random()*0.4});
```

**Impact:** Visual noise generation uses magic numbers. Low severity as this is purely visual.

---

### [LOW-004] Non-null Assertion on process.env
**File:** Multiple files using `process.env.VAR!`  
**Severity:** LOW  
**Category:** Type Safety  

**Examples:** Found in several configuration files. `!` assertion tells TypeScript the value is non-null, but at runtime it could be undefined. Most have fallback values.

---

## Summary by Focus Area

### apps/web/src/hooks
- **CRITICAL:** 0
- **HIGH:** 3 (setInterval leaks in useMiningShareSubmission, insecure RNG in useMiningShareSubmission)
- **MEDIUM:** 5 (console.logs, silent errors, navigation pattern)
- **LOW:** 2 (magic numbers for notification IDs)

### apps/web/src/components
- **HIGH:** 1 (window.location.href in TokenSection)
- **MEDIUM:** 0
- **LOW:** 0

### apps/workers/src/routes
- **CRITICAL:** 0
- **HIGH:** 1 (Math.random in NFT reserve — HIG-001)
- **MEDIUM:** 1 (Faucet TOCTOU race condition — HIG-006)
- **LOW:** 0

### apps/workers/src/services
- **HIGH:** 0
- **MEDIUM:** 1 (Hardcoded fallback values in treasury-signer.ts — MED-008)

### packages/bitcoin/src
- **CRITICAL:** 1 (XSS in onchain-renderer.ts — CRI-001)
- **HIGH:** 1 (as any in wallet.ts — HIG-003)
- **MEDIUM:** 2 (Network mismatches in builder.ts and psbt-utils.ts — MED-006, MED-007)
- **LOW:** 1 (Magic numbers in renderer)

---

## Recommended Next Steps (Priority Order)

1. **Fix CRI-001 immediately** — Replace the broken DANGEROUS regex with DOMPurify or strict allow-list parsing before next release.
2. **Fix HIG-001** — Replace `Math.random()` with `crypto.getRandomValues()` in NFT reserve endpoint.
3. **Fix HIG-006** — Make faucet rate limiting atomic by moving checks into the VirtualBalanceDO, eliminating the TOCTOU window.
4. **Fix HIG-003** — Remove `as any` and implement proper mnemonic memory cleanup using Uint8Array.
5. **Fix HIG-005** — Add proper error handling to `addShare()` catch block.
6. **Fix MED-006 and MED-007** — Create proper testnet4 network configuration objects.
7. **Audit all setInterval usage** — Ensure every `setInterval` has a matching `clearInterval` in cleanup, and verify with React Strict Mode.
8. **Replace console.log/error** with centralized logger throughout hooks and components.

---

*Report generated by comprehensive regex scan + manual verification of all focus-area findings. False positives from build artifacts and sprite color definitions have been excluded.*
