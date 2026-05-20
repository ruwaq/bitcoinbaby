# Bitcoin Transaction Flow — Re-Audit (Round 2)
# Date: 2026-05-19
# Scope: Verify CRITICAL/HIGH fixes applied correctly, check for regressions.
# Repository: ~/dev/bitcoinbaby

================================================================================
EXECUTIVE SUMMARY
================================================================================
RESULT: 7/8 checks PASS, 1 MINOR finding (not a regression)

All 3 CRITICAL fixes (C1, C2, C3) are properly implemented and functional.
All 5 HIGH fixes (H1, H2, H3, C6, + regression checks) are properly implemented,
with one minor note on code duplication (non-breaking).

================================================================================
C1 — COMMIT-SPELL ATOMICITY [PASS]
================================================================================
File: apps/web/src/hooks/useMintNFT.ts
Lines: 695–751

  ✅ Commit confirmation polling EXISTS between broadcast and spell broadcast.
  ✅ mempoolClient.getTransaction() call at line 708.
  ✅ Timeout configured: CONFIRMATION_TIMEOUT_MS = 600000ms (10 min) at lines 44–47.
  ✅ Configurable via process.env.CONFIRMATION_TIMEOUT_MS.
  ✅ Exponential backoff polling: starts at 1s delay, adapts to min(max(1000, elapsed/2), 16000).
  ✅ Proper error handling: throws descriptive error including txid + timeout if not confirmed.
  ✅ Logging at every stage (poll start, confirmed, timeout).

VERDICT: Fix is complete and correct. The commit is broadcast, confirmed in the
mempool, and only then the spell is broadcast — preventing the orphan/spend
from non-existent UTXO bug.

================================================================================
C2 — FIRE-AND-FORGET CONFIRMATIONS [PASS]
================================================================================
Files: apps/web/src/hooks/useMintNFT.ts (lines 74–163, 838–855)
       apps/web/src/hooks/useEvolution.ts (lines 73–157, 473–484)

Mint confirmation (useMintNFT.ts):
  ✅ retryConfirmation() with 3 retries + exponential backoff (2s, 4s, 8s).
  ✅ localStorage queue: CONFIRMATION_QUEUE_KEY = "bb_pending_confirmations".
  ✅ loadConfirmationQueue() / saveConfirmationQueue() for persistence.
  ✅ processConfirmationQueue() called on mount via useEffect (lines 381–385).
  ✅ Fire-and-forget pattern: confirmation fires async, success logged, failure
     queued to localStorage for next app load retry.
  ✅ Deduplication: retryCount tracked per item.

Evolution confirmation (useEvolution.ts):
  ✅ confirmEvolutionWithRetry() with 3 retries + exponential backoff (2s, 4s, 8s).
  ✅ localStorage queue: EVOLUTION_CONFIRM_STORAGE_KEY.
  ✅ queueFailedConfirmation() stores to localStorage on total failure.
  ✅ Deduplication by txid: avoids double-queuing (line 147).

VERDICT: Both fixes are complete. Confirmation failures are not silently lost
— they are retried with backoff and persisted across app sessions.

================================================================================
C3 — SIGHASH VERIFICATION [PASS]
================================================================================
Files: packages/bitcoin/src/marketplace/listing-service.ts (lines 397–480)
       apps/web/src/hooks/useMarketplace.ts (lines 237–241)

  ✅ validateListingSighash() function EXISTS in listing-service.ts.
  ✅ Exported from @bitcoinbaby/bitcoin (index.ts line 407, marketplace/index.ts line 39).
  ✅ Called after signPsbt() in useMarketplace.ts (lines 238–241).
  ✅ Two-pronged validation:
       1. Checks input.sighashType === SIGHASH_SINGLE|ANYONECANPAY (0x83).
       2. If sighashType stripped by wallet, checks partialSig[].signature
          last byte for the sighash flag.
  ✅ Throws descriptive error with wallet recommendation before PSBT sent to server.
  ✅ Proper try/catch error handling in the validation function.

VERDICT: Fix is complete. Sellers cannot submit PSBTs signed with the wrong
SIGHASH type, preventing atomic swap breakage from non-compliant wallets.

================================================================================
H1 — TOKEN UTXO SELECTION [PASS]
================================================================================
File: apps/web/src/hooks/useEvolution.ts (lines 386–417)

  ✅ Token charms sorted by amount descending (lines 389–391).
  ✅ "Smallest-sufficient" selection: iterates from smallest upward to find
     first UTXO with amount >= tokenCost (lines 393–399).
  ✅ Fallback: if no single UTXO sufficient, uses largest with a log warning
     suggesting consolidation (lines 402–409).
  ✅ Descriptive logging for selected UTXO (lines 415–417).

VERDICT: Fix is correct. Coin selection minimizes UTXO fragmentation while
ensuring evolution costs are met. Fallback path exists with clear warning.

================================================================================
H2 — PSBT FORMAT DETECTION [PASS]
================================================================================
File: apps/web/src/hooks/useEvolution.ts (lines 439–457)

  ✅ Hex vs base64 detection using PSBT magic bytes:
       - Hex prefix: "70736274ff"
       - Base64 prefix: "cHNidP8"
  ✅ isHexPsbt / isBase64Psbt boolean flags (lines 441–443).
  ✅ Correct deserialization: Psbt.fromHex() for hex, Psbt.fromBase64() for base64.
  ✅ Fallback: if not a PSBT at all, treats as raw tx and broadcasts directly.

NOTE: useMintNFT.ts has a separate isPsbt() helper (lines 254–264) that does the
same detection. This is code duplication but not a bug — both work correctly.
Consider extracting to shared utility in @bitcoinbaby/bitcoin in a follow-up.

VERDICT: Fix is correct. Both hex and base64 PSBTs from different wallet
implementations are handled properly.

================================================================================
H3 — finalizeAllInputs() [PASS - with minor note]
================================================================================
File: apps/web/src/hooks/useEvolution.ts (lines 447–457)

  ✅ finalizeAllInputs() called BEFORE extractTransaction() at lines 451–452.
  ✅ Also present in useMarketplace.ts (lines 385–386) and useWallet.ts (line 251).

MINOR NOTE: useMintNFT.ts has an extractRawTxFromPsbt() helper (lines 271–273)
that does NOT call finalizeAllInputs():

    function extractRawTxFromPsbt(psbtHex: string): string {
      const psbt = Psbt.fromHex(psbtHex);
      return psbt.extractTransaction().toHex();
    }

This is used for commit/spell extraction (lines 683–684, 761–762). It works when
the wallet returns pre-finalized PSBTs (which Leather/Xverse do), but if a wallet
returns a non-finalized signed PSBT, extractTransaction() will fail. This is a
latent risk, NOT a regression — it existed before and wasn't part of the fix.
The evolution and marketplace flows are fully protected.

VERDICT: H3 is satisfied for useEvolution.ts. The mint flow's extractRawTxFromPsbt
should be updated to call finalizeAllInputs() in a follow-up for robustness.

================================================================================
C6 — "as any" REMOVAL FROM CLAIM.TS [PASS]
================================================================================
File: apps/workers/src/routes/claim.ts

  ✅ Zero instances of "as any" in claim.ts.
  ✅ Zero instances of "as any" in apps/workers/src/services/mempool-service.ts.
  ✅ Zero instances of "as any" anywhere in apps/workers/src/routes/.
  ✅ initMempoolService() has proper typed return at line 539.

VERDICT: Clean. All `as any` casts removed from the claim flow.

================================================================================
REGRESSION CHECKS
================================================================================

1. nft.ts SPLIT (packages/bitcoin/src/charms/nft.ts):
   ✅ Charms directory properly split into:
        nft.ts, token.ts, types.ts, balance.ts, evolution.ts,
        prover.ts, minting-manager.ts, client.ts, index.ts
   ✅ All types (Bloodline, RarityTier, BaseType, BabyNFTState) defined in nft.ts.
   ✅ Barrel exports through charms/index.ts and root index.ts.
   ✅ No broken imports — useMintNFT.ts imports from @bitcoinbaby/bitcoin cleanly.

2. TYPE SAFETY:
   ✅ validateListingSighash properly exported and imported.
   ✅ No new unsafe casts introduced.
   ✅ All hook dependencies tracked in useCallback dependency arrays.

3. IMPORT ERRORS:
   ✅ No missing imports detected.
   ✅ @bitcoinbaby/bitcoin exports all needed symbols (validateListingSighash,
      createMempoolClient, Psbt, etc.).

================================================================================
NEW ISSUES FOUND
================================================================================

1. [MINOR] useMintNFT.ts extractRawTxFromPsbt() helper (line 271) does not call
   finalizeAllInputs() before extractTransaction(). This works with Leather/Xverse
   (which return finalized PSBTs) but could fail with non-finalizing wallets.
   Severity: LOW — no regression, but should be hardened.

2. [NOTE] PSBT format detection is duplicated between useMintNFT.ts (isPsbt(),
   lines 254–264) and useEvolution.ts (inline checks, lines 441–443). Both are
   functionally identical. Consider consolidating into @bitcoinbaby/bitcoin.

================================================================================
CHECKLIST SUMMARY
================================================================================

  C1  Commit-spell atomicity              PASS ✅
  C2  Fire-and-forget confirmations       PASS ✅
  C3  SIGHASH verification                PASS ✅
  H1  Token UTXO selection                PASS ✅
  H2  PSBT format detection               PASS ✅
  H3  finalizeAllInputs (useEvolution)    PASS ✅
  C6  as any removal (claim.ts)           PASS ✅
  --  Regression / nft.ts split           PASS ✅
  --  Import errors / type safety         PASS ✅

Total: 8/8 PASS (7 complete, 1 with minor non-blocking note)
       2 LOW-severity recommendations for follow-up.

================================================================================
RECOMMENDATIONS
================================================================================

1. Add finalizeAllInputs() to useMintNFT.ts extractRawTxFromPsbt() for consistency.
2. Extract isPsbt() to shared utility in @bitcoinbaby/bitcoin.
3. Add unit tests for the confirmation retry + localStorage queue logic.
