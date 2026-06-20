# Bitcoin Transaction Flow Audit Report

**Date:** 2026-05-19
**Project:** BitcoinBaby (Genesis Babies NFT + BABTC Token)
**Auditor:** Hermes Agent (Automated Deep Audit)
**Scope:** Critical Bitcoin transaction flows for production launch readiness

---

## Executive Summary

This audit examined every critical Bitcoin transaction path in the BitcoinBaby codebase: NFT minting, marketplace atomic swaps, evolution/level-up, and UTXO management. The codebase demonstrates **good engineering practices** with centralized validation, proper retry logic, and clear state machines. However, several **HIGH and CRITICAL severity issues** were identified that could result in **real monetary loss** if not addressed before mainnet launch.

### Severity Counts
| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH     | 5 |
| MEDIUM   | 7 |
| LOW      | 4 |
| INFO     | 3 |

---

## 1. NFT Minting Flow Audit

### 1.1 Flow Overview

The minting flow is a **10-step state machine** in `useMintNFT.ts`:

```
idle → checking_prover → reserving → generating_traits → proving →
signing_commit → signing_spell → broadcasting_commit → broadcasting_spell →
confirming → success/error
```

**File:** `apps/web/src/hooks/useMintNFT.ts` (655 lines)

### 1.2 Step-by-Step Trace

#### Step 0: Prover Health Check
- **Code:** Lines 199-222
- Calls `apiClient.checkProverHealth()` with single retry
- **Finding:** Health check failure is non-blocking (line 219-221: `log.warn("Prover health check failed, proceeding anyway")`). This is correct for resilience.
- **No issue.**

#### Step 1: UTXO Acquisition
- **Code:** Lines 227-250
- Calls `mempoolClient.getUTXOs(wallet.address)` - **address validated** via `requireValidAddress()` in mempool client (mempool.ts:141)
- **Hardcoded minimum:** `utxo.value >= 2000` sats (line 241)
- **Finding MEDIUM:** The 2000 sat minimum is hardcoded and may be insufficient during high-fee periods on mainnet. The actual fee required depends on transaction size and network conditions. No dynamic fee check is performed at this stage.
- **Finding MEDIUM:** Uses `utxos.find()` to pick first UTXO >= 2000 sats. No coin selection algorithm — may select a barely-sufficient UTXO that doesn't cover fees.

#### Step 2: ID Reservation
- **Code:** Lines 258-271
- Calls `apiClient.reserveNFT(wallet.address)` with **0 retries** (correct for atomic operations)
- Returns `tokenId` and `attemptId` for state tracking
- **Finding: Good.** Tracked `reservedTokenId` and `attemptId` for cleanup on failure.

#### Step 3: Trait Generation
- **Code:** Lines 275-297
- Uses `crypto.getRandomValues()` for DNA generation — cryptographically secure
- Uses deterministic trait derivation from DNA
- **No issue.**

#### Step 4: Prover Submission
- **Code:** Lines 328-370
- Calls `apiClient.proveNFT()` with 120s timeout, 0 retries (correct for long-running operations)
- Returns `commitTxHex` and `spellTxHex`
- **Finding HIGH (line 368-370):** Only checks `if (!spellTxHex)` but doesn't validate transaction format. An empty or malformed spellTx could pass through and fail later at signing/broadcast with a cryptic error.
- **Finding MEDIUM (line 357):** `proveResult.data.commitTxid` and `proveResult.data.spellTxid` are logged but never validated against the actual transaction content.

#### Step 5: PSBT Detection and Signing
- **Code:** Lines 372-460
- Detects PSBT vs raw TX using `isPsbt()` magic byte check (lines 128-138)
- For PSBTs: signs directly via `signPsbt(hex)`
- For raw TXs: converts via `rawTxToPsbt()` then signs
- **Finding CRITICAL (lines 388-491):** **Commit-Spell ordering issue.** The code broadcasts the commit transaction (Step 6, line 463) and waits for success, then broadcasts the spell transaction (Step 7, line 494). However, there is **no wait for commit transaction confirmation** before broadcasting the spell. This means:
  - If commit fails or is rejected by the mempool, the spell is still broadcast
  - If a reorg occurs between the two broadcasts, the spell references a non-existent commit
  - **No timeout or retry loop** on the commit broadcast confirmation
- **Finding HIGH (lines 404-408):** `signPsbt()` can return `null` if user cancels. This is handled, but if signed PSBT is malformed (e.g., wrong sighash), it won't be detected until broadcast fails.

#### Step 6-7: Broadcasting
- **Code:** Lines 462-540
- Extracts raw TX from signed PSBT via `extractRawTxFromPsbt()` (lines 145-148)
- Broadcasts commit first, then spell
- **Finding HIGH (lines 478-479):** `extractRawTxFromPsbt()` calls `psbt.extractTransaction()` which will **throw if inputs aren't fully finalized**. This error is caught at the outer try/catch, but the commit transaction may have already been broadcast at that point — leaving the user in an **inconsistent state** where commit is on-chain but spell is not.
- **Finding MEDIUM (lines 509-513):** Spell broadcast catches errors but doesn't distinguish between mempool rejection (RPC error, double-spend) and network failure. Mempool rejections are not retryable but network failures are.

#### Step 8: Server Confirmation
- **Code:** Lines 543-581
- Calls `apiClient.confirmNFTMint()` **non-blocking with `.catch()`** (line 565)
- Also updates attempt status non-blocking
- **Finding CRITICAL (lines 557-577):** Both `confirmNFTMint()` and `updateMintAttempt()` are **fire-and-forget** — failures are silently swallowed. If the server doesn't record the mint, the NFT is on-chain but not indexed. No retry mechanism.
- **Finding: Good.** `reservedTokenId = null` on success (line 580) prevents double-release in the error handler.

#### Error Recovery
- **Code:** Lines 593-622
- On error: releases reserved token ID via `apiClient.releaseNFT()`, updates attempt status to "failed"
- **Finding: Good.** Proper cleanup of reserved resources.

### 1.3 PSBT Utilities (`psbt-utils.ts`)

**File:** `packages/bitcoin/src/transactions/psbt-utils.ts` (179 lines)

- **Finding MEDIUM (line 92):** Default network is `bitcoin.networks.testnet` — NOT testnet4. This could cause address derivation issues if network isn't explicitly passed. The caller (`useMintNFT.ts`) doesn't pass network.
- **Finding HIGH (lines 120-134):** Taproot detection is based on prefix match (`tb1p`/`bc1p`). While functional, this doesn't validate the actual script type. An address starting with `bc1p` followed by invalid data would pass the prefix check but fail later.
- **Finding INFO (lines 147-159):** Non-user inputs from the prover get added without `witnessUtxo`, only as raw inputs. This means they can't be signed by the wallet — correct behavior, but relies on the prover providing correct witness data.

### 1.4 Mempool Client

**File:** `packages/bitcoin/src/blockchain/mempool.ts` (296 lines)

- **Finding: Good.** Address validated via `requireValidAddress()` before all API calls
- **Finding: Good.** AbortController timeout on all fetch calls
- **Finding: Good.** Broadcast validates response is 64-char hex txid
- **Finding LOW (line 168):** Broadcast response validation uses regex `/^[a-f0-9]{64}$/`. Mempool.space returns a plain text txid, but if this ever changes to JSON, the regex would fail. No try/catch around the regex test.

---

## 2. Marketplace Atomic Swap Audit

### 2.1 Flow Overview

**File:** `apps/web/src/hooks/useMarketplace.ts` (427 lines)

Two main flows:
1. **Listing:** Create PSBT → Seller signs SIGHASH_SINGLE|ANYONECANPAY → Send to server
2. **Buying:** Get listing → Add buyer inputs → Sign → Broadcast → Notify server

### 2.2 Listing Creation

#### Step 1: NFT UTXO Discovery
- **Code:** Lines 186-212
- Calls `charmsClient.extractCharmsForWallet()` which processes up to 150 transactions
- **Finding MEDIUM:** Charm extraction is expensive (150 tx fetches + charm parsing). No progress indicator or cancellation mechanism.
- **Finding MEDIUM (line 207):** `DUST_VALUE = 546` is hardcoded. For P2TR outputs the actual minimum is lower (~330 sats), but 546 is safe. However, if the NFT is in a different output type (P2WPKH at 294 sats), this overestimates the value.
- **Finding HIGH (lines 191-198):** NFT matching uses `c.state.tokenId === tokenId` but doesn't verify the `appId` matches before accessing `state`. The filter already constrains by `appId` at line 188, but the state cast is unchecked — if charm extraction returns unexpected state format, this could match incorrectly.

#### Step 2: PSBT Creation
- **Code:** Lines 216-222
- Calls `listingService.createListingPSBT()` (see listing-service.ts analysis)
- **Finding: Good.** Price validated via `validateListingPrice()` before PSBT creation.

#### Step 3: Signing
- **Code:** Lines 230-234
- Calls `signPsbt(listingResult.psbt)` — the PSBT has `sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY` set in `createListingPSBT()` (listing-service.ts:132).
- **Finding CRITICAL (listing-service.ts:121-133):** The `createListingPSBT()` function sets SIGHASH on the PSBT input, but **does not verify that the wallet actually signs with this sighash**. Browser wallets (Leather, Xverse, Unisat) may ignore or override PSBT sighash flags. If the wallet signs with SIGHASH_ALL instead, the seller's signature commits to all outputs, preventing the buyer from adding payment inputs — the atomic swap would fail.
- **Finding HIGH:** There is no post-signing validation to verify the seller's signature uses the correct SIGHASH.

### 2.3 Buying Flow

#### Step 1: Get Listing
- **Code:** Lines 328-346
- Falls back to legacy server-based purchase if `sellerPsbt` is missing
- **Finding MEDIUM:** The legacy fallback doesn't use PSBT atomic swaps — it trusts the server to handle the swap. This is a completely different security model.

#### Step 2: UTXO Selection
- **Code:** Lines 349-353
- Gets all UTXOs, passes them to `completePurchasePSBT()`
- **Finding MEDIUM:** No filtering of NFT UTXOs from payment UTXOs. If the buyer's UTXO list includes their own NFT UTXOs, the coin selection algorithm might accidentally spend them.

#### Step 3: PSBT Completion
- **Code:** Lines 356-368
- Calls `listingService.completePurchasePSBT()` with dynamic fee rate
- **Finding MEDIUM (line 356):** `getFeeRate("fast")` returns `halfHourFee` (~30 min confirmation). For high-value NFT purchases, users may want faster confirmation.

#### Step 4: Signing and Broadcasting
- **Code:** Lines 370-384
- Sign → `finalizeAllInputs()` → extract TX → broadcast → notify server
- **Finding HIGH (line 384):** Server notification (`apiClient.buyNFT()`) is awaited **after** broadcast succeeds. If the server notification fails, the NFT is transferred on-chain but the server doesn't know about it. The seller still sees their NFT, the buyer doesn't see their purchase.
- **Finding MEDIUM (lines 377-380):** `psbt.finalizeAllInputs()` may throw if seller's signature is invalid or missing. This is caught, but the error message doesn't distinguish between "not signed" and "invalid signature".

### 2.4 Listing Service (PSBT Logic)

**File:** `packages/bitcoin/src/marketplace/listing-service.ts` (412 lines)

#### PSBT Creation
- **Finding: Good.** Price validated, dust limits checked on outputs
- **Finding: Good.** Change outputs only added if >= DUST_LIMIT (546 sats)

#### Coin Selection
- **Code:** Lines 329-349
- Uses simple greedy algorithm (largest-first)
- **Finding MEDIUM:** `bufferSats = BigInt(VBYTES.P2TR_OUTPUT * 10)` uses a hardcoded fee rate of 10 sat/vB. If the actual fee rate is higher, the buffer underestimates and the selected coins may be insufficient.
- **Finding LOW:** `selectCoins` is `private` — can't be unit tested directly.

#### Fee Calculation
- **Code:** Lines 289-320
- Uses fixed estimates: 2 P2TR inputs + 4 P2TR outputs
- **Finding MEDIUM:** The buyer may have more than 1 payment input (multiple UTXOs needed), but the fee estimation only accounts for 2 inputs (1 NFT + 1 payment). Actual fee could be higher.
- **Finding MEDIUM (line 302):** `estimatedVbytes` calculation doesn't account for the witness data overhead of the seller's signature.

#### PSBT Finalization in `buyNFT`
- **Code (useMarketplace.ts:377-380):**
```
const psbt = Psbt.fromBase64(signedPsbt);
psbt.finalizeAllInputs();
const rawTxHex = psbt.extractTransaction().toHex();
```
- **Finding HIGH:** `finalizeAllInputs()` will throw if any input lacks a signature. This is correct behavior, but there's no pre-check to verify all required inputs are signed before attempting finalization. If the seller's PSBT is malformed, the buyer wastes time selecting coins and signing.

---

## 3. Evolution (Level Up) Flow Audit

### 3.1 Flow Overview

**File:** `apps/web/src/hooks/useEvolution.ts` (321 lines)

```
1. Wallet check → 2. Can-level-up check → 3. Get NFT UTXO from Charms →
4. Get token UTXOs → 5. Create PSBT via useNFTMinting.levelUp →
6. Sign PSBT → 7. Broadcast → 8. Track + notify server
```

### 3.2 Step-by-Step Trace

#### Pre-checks
- **Code:** Lines 151-166
- Wallet connection check, XP check via `checkCanLevelUp()`
- **Finding: Good.** XP validation before any network calls.

#### NFT UTXO Discovery
- **Code:** Lines 173-198
- Uses `charmsClient.extractCharmsForWallet()` — same expensive operation as marketplace
- **Finding MEDIUM (lines 179-186):** NFT matching by `tokenId` without verifying `appId` in the filter. The Charms extraction already filters by `appId` at line 176, but if extraction returns unexpected data, the match could be wrong.

#### Token UTXO Selection
- **Code:** Lines 200-228
- Filters token charms by `appId` and `appType === "t"`
- **Finding HIGH (lines 214-219):** Checks `totalTokens < tokenCost` but the actual level-up only uses `tokenCharms[0]` — the first token UTXO (line 222-225). If the first UTXO has fewer tokens than the cost, the level-up will fail at the spell level even though the user has enough total tokens spread across multiple UTXOs.
- **Finding MEDIUM:** No coin selection for token UTXOs — always picks the first one. Should pick the smallest UTXO that meets the cost to minimize token fragmentation.

#### PSBT Creation
- **Code:** Lines 231-238
- Calls `levelUp()` from `useNFTMinting` hook
- **Finding:** See `useNFTMinting.ts` analysis below.

#### Signing and Broadcasting
- **Code:** Lines 241-255
- Signs PSBT, extracts TX, broadcasts
- **Finding HIGH (line 249):** `Psbt.fromBase64(signedPsbtHex)` — **hardcoded Base64 assumption.** The signing function might return hex or Base64 depending on the wallet. If the wallet returns hex, this will throw with a cryptic error. Compare with `useMintNFT.ts` which uses `isPsbt()` to detect format.
- **Finding HIGH (line 250):** `signedPsbt.extractTransaction().toHex()` — does NOT call `finalizeAllInputs()` first. If the prover's inputs have pre-existing signatures/witness data, this may work. But if any input needs finalization, `extractTransaction()` will throw. The marketplace flow correctly calls `finalizeAllInputs()` first (useMarketplace.ts:378).

#### Server Notification
- **Code:** Lines 267-278
- `confirmEvolution()` is non-blocking with `.catch()` — same fire-and-forget pattern as minting

### 3.3 useNFTMinting Hook

**File:** `packages/core/src/hooks/useNFTMinting.ts` (545 lines)

- **Finding MEDIUM (lines 231-236, 331-335, 421-425):** All three operations (mintGenesis, submitWorkProof, levelUp) filter UTXOs with `u.value >= 5000`. This 5000 sat minimum is hardcoded and may be too low for mainnet fees.
- **Finding MEDIUM (line 241):** `calculateScrollsFee(1, utxos[0].value)` uses the first UTXO's value for fee calculation. But `utxos[0]` may not be the UTXO selected for spending after the `>= 5000` filter. The fee should be calculated based on the actual selected UTXOs.
- **Finding HIGH (lines 248-254):** `buildMiningTx()` creates the spell transaction but the spell is added as witness data. The function doesn't verify that the spell data fits within the witness size limits (max ~520 bytes for standard witness elements).

### 3.4 Evolution Service

**File:** `packages/bitcoin/src/charms/evolution.ts` (326 lines)

- **Finding: Good.** Proper validation before spell creation: canLevelUp check, token amount validation
- **Finding LOW (lines 239, 274):** Fee estimation uses hardcoded vbyte estimates: `feeEstimates.halfHourFee * 200` for work proof, `* 300` for level up. These don't account for actual input types or count.

---

## 4. UTXO Management Audit

### 4.1 Coin Selection

**File:** `packages/bitcoin/src/transactions/builder.ts` (998 lines)

#### Branch & Bound Algorithm
- **Code:** Lines 230-350
- Implements BnB coin selection with DFS, pruning, and 100K iteration limit
- **Finding: Good.** Proper implementation with effective value calculation, waste minimization
- **Finding: Good.** Filters UTXOs with negative effective value (cost more to spend than they're worth)
- **Finding LOW (line 236):** `MAX_ITERATIONS = 100_000` is high but for wallets with 50+ UTXOs, could potentially hit this limit. Falls back to greedy selection gracefully.

#### Greedy Fallback
- **Code:** Lines 356-395
- **Finding: Good.** Proper change handling with dust threshold
- **Finding LOW (line 373):** `required = targetAmount + fee + this.dustThreshold` — the dust threshold buffer is conservative and correct.

#### Dust Handling
- **Code:** Lines 211-213, 392-393
- Change outputs below `dustThreshold` (546 sats) are not created; instead, the amount is added to fees
- **Finding: Good.** Proper dust prevention. Verified in both BnB and greedy paths.
- **Finding: Good.** RBF sequence (`0xfffffffd`) enabled by default (line 47, 139)

#### Consolidation
- **No explicit consolidation function found.** The codebase does not have a UTXO consolidation utility. Over time, users will accumulate many small UTXOs, increasing transaction costs.
- **Finding MEDIUM:** No consolidation mechanism exists. Users with many dust UTXOs will face escalating fees.

### 4.2 Transaction Tracking

**File:** `packages/core/src/stores/pending-tx-store.ts` (291 lines)

- **Finding: Good.** Uses `TxTracker` with 10-second polling
- **Finding: Good.** Persisted to localStorage with cleanup of stuck transactions (24h timeout)
- **Finding LOW (line 144):** `pollInterval: 10000` — 10 second polling. For mainnet, this could be reduced to 30-60 seconds to reduce API load.

### 4.3 Wallet State Management

**File:** `packages/core/src/stores/wallet-store.ts` (284 lines)

- **Finding: Good.** State machine prevents invalid transitions
- **Finding: Good.** Cleanup callbacks on disconnect prevent memory leaks
- **Finding: Good.** Signing functions cleared on lock

**File:** `packages/core/src/utils/wallet-guards.ts` (128 lines)

- **Finding: Good.** Proper guard functions for canRead/canSign/canTransact
- **Finding MEDIUM:** The hooks (`useMintNFT`, `useMarketplace`, `useEvolution`) do NOT use `wallet-guards`. They do their own ad-hoc wallet checks. This creates inconsistent validation patterns.

---

## 5. Cross-Cutting Concerns

### 5.1 Address Validation

**File:** `packages/bitcoin/src/validation.ts` (369 lines)

- **Finding: Good.** Uses `bitcoinjs-lib` for cryptographically correct address validation (checksum, network)
- **Finding: Good.** Pre-check via prefix, then definitive check via `toOutputScript()`
- **Finding: Good.** Proper txid validation (64 hex chars)
- **Finding MEDIUM (line 20):** `testnet4` maps to `bitcoin.networks.testnet` — same as regular testnet. This is correct for address validation (testnet4 uses same bech32m prefix `tb1p`) but could be confusing.
- **Finding: Good.** Maximum Bitcoin supply check in `validateSatoshis()`

### 5.2 Fee Estimation

**File:** `apps/web/src/hooks/useFeeEstimate.ts` (113 lines)

- **Finding: Good.** Uses TanStack Query with 30s stale time, 60s auto-refresh
- **Finding: Good.** Fallback defaults if API fails (`DEFAULT_FEES`)
- **Finding MEDIUM (line 39-45):** Default fees (fastestFee: 20, halfHourFee: 15, etc.) are reasonable for testnet but may be too low for mainnet during high-fee periods.
- **Finding INFO:** The `getFeeRate("fast")` used in marketplace maps to `halfHourFee`. The naming is confusing — "fast" should arguably map to `fastestFee`.

### 5.3 API Client Retry Logic

**File:** `packages/core/src/api/client.ts` (1063 lines)

- **Finding: Good.** Proper retry/backoff for idempotent operations
- **Finding: Good.** No retries for non-idempotent operations (reserveNFT, creditMining, createWithdrawRequest)
- **Finding: Good.** Differentiated timeout: 10s default, 120s for prover calls

### 5.4 Prover Client

**File:** `packages/bitcoin/src/charms/prover.ts` (1122 lines)

- **Finding: Good.** Exponential backoff retry with jitter (6 attempts, 30s max delay)
- **Finding: Good.** No retry on 4xx errors
- **Finding: Good.** Cryptographic PoW validation before sending to prover
- **Finding MEDIUM (line 561):** `fee_rate: request.funding_utxo_value ? 2.0 : 2.0001` — hardcoded fee rates for the prover. On mainnet, 2 sat/vB may be too low.

### 5.5 Network Configuration

**File:** `packages/bitcoin/src/config/deployment.ts` (102 lines)

- **Finding: Good.** Clear placeholder pattern for undeployed networks
- **Finding HIGH:** Mainnet config (`BABTC_MAINNET`) has `appId: "not_deployed"` and `isPlaceholder: true`. Any attempt to use mainnet will throw via `validateDeployment()`. This is correct, but the error message references a BUILD.md file that may not exist. The actual deployment process needs to be documented.

**File:** `packages/bitcoin/src/config/treasury.ts` (89 lines)

- **Finding HIGH (lines 28-31):** BABTC treasury on testnet4 is hardcoded as fallback constant. For mainnet, `BABTC_TREASURY_MAINNET = ""` — empty string. If this isn't set before mainnet launch, all NFT sales and marketplace fees will go to an invalid address (or throw).
- **Finding MEDIUM:** NFT treasury is also hardcoded. No mechanism to verify the treasury address is correct before transactions.

### 5.6 Hardcoded Values Requiring Mainnet Configuration

| Location | Value | Mainnet Impact |
|----------|-------|---------------|
| `useMintNFT.ts:241` | Min UTXO 2000 sats | Too low for mainnet fees |
| `useFeeEstimate.ts:39-45` | Default fees 20/15/10/5 | Too low for mainnet |
| `prover.ts:561` | Fee rate 2.0 sat/vB | Too low for mainnet |
| `treasury.ts:74` | `NFT_TREASURY_MAINNET = ""` | CRITICAL: empty |
| `treasury.ts:34` | `BABTC_TREASURY_MAINNET = ""` | CRITICAL: empty |
| `deployment.ts:63-68` | `BABTC_MAINNET` placeholder | BLOCKING: not deployed |
| `listing-service.ts:341` | Buffer fee rate 10 sat/vB | Underestimates for mainnet |
| `evolution.ts:239,274` | Vbyte estimates 200/300 | May be inaccurate |

---

## 6. Findings Summary

### CRITICAL Severity

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| C1 | **Commit-Spell atomicity broken** — no confirmation wait between commit and spell broadcast | `useMintNFT.ts:463-522` | If commit fails or reorg, spell references non-existent UTXO. Real money loss possible. |
| C2 | **Fire-and-forget server confirmation** — mint/evolution confirmations silently fail | `useMintNFT.ts:557-577`, `useEvolution.ts:267-278` | NFT on-chain but not indexed. User loses access to NFT in app. |
| C3 | **No SIGHASH verification on seller PSBT** — wallet may override SIGHASH_SINGLE\|ANYONECANPAY | `listing-service.ts:132`, `useMarketplace.ts:230-234` | Atomic swap breaks. Buyer can't add payment inputs. Listing stuck forever. |

### HIGH Severity

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| H1 | **Token UTXO selection picks first, not best** — user may have enough tokens but first UTXO is too small | `useEvolution.ts:222-225` | Level-up fails despite sufficient balance. |
| H2 | **Hardcoded PSBT format assumption** — `Psbt.fromBase64()` but wallet may return hex | `useEvolution.ts:249` | Evolution always fails for hex-returning wallets. |
| H3 | **Missing `finalizeAllInputs()` in evolution flow** — extractTransaction may throw | `useEvolution.ts:250` | Evolution broadcast fails. |
| H4 | **Empty mainnet treasury addresses** — no runtime guard | `treasury.ts:34,74` | Funds sent to invalid address on mainnet. |
| H5 | **Server notification after marketplace purchase can fail** — NFT transferred but unindexed | `useMarketplace.ts:384` | Buyer/seller state inconsistency. |

### MEDIUM Severity

| # | Finding |
|---|---------|
| M1 | Hardcoded 2000 sat min UTXO — insufficient for high-fee mainnet periods |
| M2 | UTXO selection in minting uses `.find()` instead of proper coin selection |
| M3 | Charm extraction expensive (150tx) — no cancellation |
| M4 | Fee estimation in marketplace doesn't account for actual buyer input count |
| M5 | No UTXO consolidation mechanism |
| M6 | NFT UTXOs not filtered from payment UTXOs in marketplace buy |
| M7 | Default fee estimates too low for mainnet |

### LOW Severity

| # | Finding |
|---|---------|
| L1 | Broadcast response regex doesn't handle JSON errors |
| L2 | Coin selection `selectCoins` is private, can't unit test |
| L3 | Polling interval 10s for tx tracking could be optimized |
| L4 | BnB iteration limit of 100K could be hit with 50+ UTXOs |

---

## 7. Recommendations

### Immediate (Before Testnet4 Production)

1. **Fix C1 (Commit-Spell atomicity):**
   - After broadcasting commit, poll `mempoolClient.getTransaction(commitTxid)` until confirmed
   - Add configurable timeout (default 10 minutes)
   - Only broadcast spell after commit is in mempool/block
   - If commit fails, do NOT broadcast spell — release token ID and report error

2. **Fix C2 (Server confirmation):**
   - Add retry with exponential backoff for `confirmNFTMint()` and `confirmEvolution()`
   - Queue failed confirmations in localStorage for retry on next app load
   - Show user a warning if confirmation fails: "NFT minted on blockchain but server sync pending"

3. **Fix C3 (SIGHASH verification):**
   - After signing, parse the returned PSBT and verify the seller's input has `sighashType === SIGHASH_SINGLE | ANYONECANPAY`
   - If not, reject the listing with a clear error: "Your wallet does not support SIGHASH_SINGLE|ANYONECANPAY"

4. **Fix H1 (Token UTXO selection):**
   - Sort token UTXOs by amount ascending
   - Select the smallest UTXO that meets the cost to minimize fragmentation
   - If no single UTXO meets cost, combine multiple token UTXOs in the spell

5. **Fix H2 (PSBT format detection):**
   - Add `isPsbt()` check before `Psbt.fromBase64()`
   - Handle both hex and Base64 PSBT formats consistently across all hooks

6. **Fix H3 (Missing finalization):**
   - Add `psbt.finalizeAllInputs()` before `extractTransaction()` in evolution flow
   - Add try/catch with clear error messages

### Before Mainnet Launch

7. **Set all mainnet treasury addresses** in environment variables, never hardcoded
8. **Deploy BABTC contract to mainnet** and update `deployment.ts`
9. **Increase all hardcoded minimums** for mainnet fee environment:
   - Min UTXO: 10000 sats minimum (configurable)
   - Default fees: fetch from mempool.space, never hardcode
   - Prover fee rate: make configurable
10. **Add fee sanity checks**: if calculated fee exceeds 50% of transaction value, warn user
11. **Add mainnet-specific address validation**: ensure `bc1` prefix enforcement

### Long-term Improvements

12. **Implement UTXO consolidation** — background process that merges dust UTXOs during low-fee periods
13. **Add PSBT validation layer** — centralized function that validates PSBT structure before signing/broadcasting
14. **Add transaction simulation** — dry-run transactions against a Bitcoin node to verify validity before broadcast
15. **Implement RBF/CPFP support** — allow users to bump fees on stuck transactions
16. **Add reorg detection** — monitor for block removals and update transaction status accordingly
17. **Use wallet-guards consistently** — replace ad-hoc wallet checks in hooks with centralized guard functions

---

## 8. Positive Findings

The following aspects of the codebase are well-implemented:

1. **Centralized validation** (`validation.ts`) using `bitcoinjs-lib` for cryptographically correct checks
2. **State machine** in wallet store prevents invalid state transitions
3. **Retry logic** with exponential backoff and proper differentiation between retryable and non-retryable operations
4. **RBF enabled by default** on all transactions (builder.ts:47)
5. **Dust threshold** consistently applied to prevent uneconomical outputs
6. **Memory safety** — tweaked private keys zeroed after signing (builder.ts:907-909)
7. **Clean error recovery** — reserved token IDs released on failure
8. **Stuck transaction cleanup** — 24h timeout for pending transactions
9. **Non-blocking state updates** — attempt status updates don't block the main flow
10. **Proper BigInt usage** — no precision loss in satoshi calculations

---

## 9. Conclusion

The BitcoinBaby codebase shows solid engineering foundations with proper validation, retry logic, and state management. However, **three critical issues** (C1, C2, C3) must be resolved before any production use with real Bitcoin, as they can lead to **irreversible monetary loss or permanently stuck assets**.

The **marketplace atomic swap** is the highest-risk area — if the seller's wallet doesn't respect the PSBT sighash flags, listings become un-buyable and sellers can't delist (since delisting would require a different transaction flow that may not exist).

The **minting flow** is robust for the happy path but has inadequate error recovery for the commit-spell sequence. If a network blip occurs between the two broadcasts, the user loses their reserved token and any fees paid for the commit transaction.

**Recommendation: Do not launch to mainnet until C1-C3 and H1-H5 are addressed.**
