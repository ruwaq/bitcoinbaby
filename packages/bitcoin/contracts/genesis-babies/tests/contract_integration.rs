//! Integration tests for the genesis-babies contract entry point (`app_contract`).
//!
//! These tests exercise the FULL contract path — `app_contract(app, tx, x, w)` — with
//! hand-built `Transaction` values, the same function the Charms runtime invokes when it
//! runs our wasm via `charms spell check` / `spell prove`. They are the strongest local
//! validation of the work_proof and level_up paths (which `charms spell check --mock`
//! cannot reach, because resolving input charm data requires an enchanted prev-tx that
//! only a paid prover can produce).
//!
//! What is covered here (and the complementary `charms spell check` coverage):
//!   - mint           : ALSO covered end-to-end via `scripts/validate-nft-contract.ts`
//!                      (YAML spell -> wasm). The cases below mirror those fixtures.
//!   - work_proof     : covered ONLY here (ins + outs + witness constructed in-process).
//!   - level_up       : covered ONLY here.
//!   - transfer / unknown op : covered ONLY here.
//!
//! See `docs/superpowers/specs/2026-08-08-testnet4-profesional-nft-design.md` and the
//! charms-v15-witness-spike note for the `(app, tx, x, w)` calling convention.

use charms_data::{App, B32, Charms, Data, Transaction, UtxoId, NFT};
use genesis_babies::SparkNFTState;
use std::str::FromStr;

// =============================================================================
// HELPERS
// =============================================================================

/// A fixed app identity / vk so every test uses the same app key. The values are
/// arbitrary dummy bytes (the contract does not hash-check them for our immutable app);
/// what matters is that the SAME `App` is used to key the input/output charm maps and
/// the call. Built from byte arrays (not a 64-char hex literal) so no secret scanner
/// confuses the placeholder for a private key.
fn app() -> App {
    let identity = identity_bytes();
    let vk = vk_bytes();
    App {
        tag: 'n',
        identity: B32(identity),
        vk: B32(vk),
    }
}

/// Dummy 32-byte app identity (a simple ramp; not a real key).
fn identity_bytes() -> [u8; 32] {
    let mut b = [0u8; 32];
    for (i, v) in b.iter_mut().enumerate() {
        *v = (i as u8).wrapping_mul(7);
    }
    b
}

/// Dummy 32-byte app vk (a different ramp; not a real key).
fn vk_bytes() -> [u8; 32] {
    let mut b = [0u8; 32];
    for (i, v) in b.iter_mut().enumerate() {
        *v = (i as u8).wrapping_mul(11).wrapping_add(3);
    }
    b
}

/// A dummy UTXO id (never inspected by the validators — they only look at charm state).
fn utxo() -> UtxoId {
    // 64 hex chars (32 bytes) + ":0".
    UtxoId::from_str(&format!("{}:0", "a".repeat(64))).unwrap_or_default()
}

fn nft_data(s: &SparkNFTState) -> Data {
    Data::from(s)
}

fn charms_with(s: &SparkNFTState) -> Charms {
    let mut m = Charms::new();
    m.insert(app(), nft_data(s));
    m
}

fn empty_charms() -> Charms {
    Charms::new()
}

/// A freshly-minted valid Spark (mirrors `valid_state()` in the contract's own unit tests
/// and the YAML fixture in `scripts/validate-nft-contract.ts`).
fn fresh_mint() -> SparkNFTState {
    SparkNFTState {
        dna: "a".repeat(64),
        bloodline: "royal".into(),
        base_type: "human".into(),
        genesis_block: 100_000,
        rarity_tier: "common".into(),
        token_id: 1,
        level: 1,
        xp: 0,
        total_xp: 0,
        work_count: 0,
        last_work_block: 0,
        evolution_count: 0,
        tokens_earned: "0".into(),
        heritage: 0,
        narrative_root: String::new(),
        last_settle_block: 0,
        settle_count: 0,
    }
}

fn run(app_v: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    genesis_babies::app_contract(app_v, tx, x, w)
}

// =============================================================================
// MINT — accepted
// =============================================================================

#[test]
fn mint_valid_is_accepted() {
    // Genesis: no input charms, exactly one fresh Spark in the outputs.
    let out = fresh_mint();
    let tx = Transaction {
        ins: vec![(utxo(), empty_charms())],
        refs: vec![],
        outs: vec![charms_with(&out)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let x = Data::empty();
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "mint".into(),
    });
    assert!(run(&app(), &tx, &x, &w), "valid mint must be accepted");
}

// =============================================================================
// MINT — rejected (mirrors the invalid YAML fixtures)
// =============================================================================

#[test]
fn mint_token_id_zero_is_rejected() {
    let mut out = fresh_mint();
    out.token_id = 0; // supply cap violation
    let tx = Transaction {
        ins: vec![(utxo(), empty_charms())],
        refs: vec![],
        outs: vec![charms_with(&out)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "mint".into(),
    });
    assert!(!run(&app(), &tx, &Data::empty(), &w), "token_id=0 must reject");
}

#[test]
fn mint_invalid_bloodline_is_rejected() {
    let mut out = fresh_mint();
    out.bloodline = "peasant".into();
    let tx = Transaction {
        ins: vec![(utxo(), empty_charms())],
        refs: vec![],
        outs: vec![charms_with(&out)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "mint".into(),
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "invalid bloodline must reject"
    );
}

#[test]
fn mint_level_not_one_is_rejected() {
    let mut out = fresh_mint();
    out.level = 2; // a fresh mint must start at level 1
    let tx = Transaction {
        ins: vec![(utxo(), empty_charms())],
        refs: vec![],
        outs: vec![charms_with(&out)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "mint".into(),
    });
    assert!(!run(&app(), &tx, &Data::empty(), &w), "level != 1 must reject");
}

#[test]
fn mint_with_existing_input_nft_is_rejected() {
    // Genesis must consume NO input NFT for this app. If an input already carries one,
    // this is not a genesis mint.
    let inp = fresh_mint();
    let out = fresh_mint();
    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&inp))],
        refs: vec![],
        outs: vec![charms_with(&out)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "mint".into(),
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "mint with an input NFT must reject"
    );
}

// =============================================================================
// WORK PROOF — accepted
// =============================================================================

#[test]
fn work_proof_valid_is_accepted() {
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    // one prior work proof already happened
    old.work_count = 1;
    old.last_work_block = 199_999;

    let xp_gain = 25u64;
    let current_block = 200_000u64;
    let mut new = old.clone();
    new.work_count = old.work_count + 1;
    new.total_xp = old.total_xp + xp_gain;
    new.xp = old.xp + xp_gain; // C1a: spendable xp must tick by the same gain
    new.last_work_block = current_block;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::WorkProofWitness {
        operation: "work_proof".into(),
        xp_gain,
        current_block,
    });
    assert!(
        run(&app(), &tx, &Data::empty(), &w),
        "valid work_proof must be accepted"
    );
}

// =============================================================================
// WORK PROOF — rejected
// =============================================================================

#[test]
fn work_proof_without_work_count_increment_is_rejected() {
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;

    let xp_gain = 25u64;
    let current_block = 200_000u64;
    let mut new = old.clone();
    // BUG under test: work_count NOT incremented.
    new.work_count = old.work_count;
    new.total_xp = old.total_xp + xp_gain;
    new.xp = old.xp + xp_gain;
    new.last_work_block = current_block;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::WorkProofWitness {
        operation: "work_proof".into(),
        xp_gain,
        current_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "work_proof without work_count+1 must reject"
    );
}

#[test]
fn work_proof_xp_not_tied_to_gain_is_rejected() {
    // C1a regression: an attacker accrues total_xp but never raises the spendable xp.
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;

    let xp_gain = 25u64;
    let current_block = 200_000u64;
    let mut new = old.clone();
    new.work_count = old.work_count + 1;
    new.total_xp = old.total_xp + xp_gain;
    new.xp = old.xp; // BUG under test: spendable xp not bumped
    new.last_work_block = current_block;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::WorkProofWitness {
        operation: "work_proof".into(),
        xp_gain,
        current_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "work_proof where xp != old.xp + xp_gain must reject (C1a)"
    );
}

#[test]
fn work_proof_mutating_immutable_dna_is_rejected() {
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;

    let xp_gain = 25u64;
    let current_block = 200_000u64;
    let mut new = old.clone();
    new.work_count = old.work_count + 1;
    new.total_xp = old.total_xp + xp_gain;
    new.xp = old.xp + xp_gain;
    new.last_work_block = current_block;
    new.dna = "b".repeat(64); // BUG under test: dna is immutable

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::WorkProofWitness {
        operation: "work_proof".into(),
        xp_gain,
        current_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "work_proof mutating dna must reject"
    );
}

// =============================================================================
// WORK (C3 fix — PoW-verified) — accepted / rejected
//
// These exercise the new `work` operation end-to-end through `app_contract`.
// Unlike the deprecated `work_proof` path, XP is NOT a witness input here:
// `validate_work` re-hashes `challenge:nonce` on-chain and DERIVES the gain via
// `xp_from_difficulty`. The PoW vector is the same one pinned in the contract's
// unit tests: challenge "genesis-spark-test" + nonce "745" (integer 1861, hex
// without 0x prefix) yields a double-SHA256 with exactly 19 leading-zero bits,
// so `xp_from_difficulty(19) == 130`.
// =============================================================================

/// Build a one-in / one-out `Transaction` carrying `old` → `new` Spark state.
/// Same shape every other test constructs inline; factored out to keep the
/// `work` tests focused on the witness + state-transition under test.
fn work_tx(old: &SparkNFTState, new: &SparkNFTState) -> Transaction {
    Transaction {
        ins: vec![(utxo(), charms_with(old))],
        refs: vec![],
        outs: vec![charms_with(new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    }
}

#[test]
fn work_op_valid_pow_is_accepted() {
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;
    old.last_work_block = 199_999;

    // Real mined PoW: "genesis-spark-test:745" hashes with 19 leading-zero bits.
    let challenge = "genesis-spark-test";
    let nonce = "745";
    let difficulty = 19u32;
    let current_block = 200_000u64;

    // The contract DERIVES the gain from the verified difficulty — it must equal
    // `xp_from_difficulty(difficulty)`, which is 130 here.
    let xp_gain = genesis_babies::xp_from_difficulty(difficulty);
    assert_eq!(xp_gain, 130, "test vector sanity: xp_from_difficulty(19)");

    let mut new = old.clone();
    new.work_count = old.work_count + 1;
    new.total_xp = old.total_xp + xp_gain;
    new.xp = old.xp + xp_gain; // C1a: spendable xp ticks by the same derived gain
    new.last_work_block = current_block;

    let tx = work_tx(&old, &new);
    let w = Data::from(&genesis_babies::WorkWitness {
        operation: "work".into(),
        challenge: challenge.into(),
        nonce: nonce.into(),
        difficulty,
        current_block,
    });
    assert!(
        run(&app(), &tx, &Data::empty(), &w),
        "valid work (verified PoW) must be accepted"
    );
}

#[test]
fn work_op_invalid_pow_is_rejected() {
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;

    // Same challenge, but a nonce whose hash does NOT meet difficulty 19.
    // "genesis-spark-test:bad" double-sha256 has 0 leading-zero bits.
    let challenge = "genesis-spark-test";
    let nonce = "bad";
    let difficulty = 19u32;
    let current_block = 200_000u64;

    // The attacker still tries to bump the counters as if the PoW were valid.
    // The contract MUST reject before the counters are even examined, because
    // `verify_pow` fails on-chain.
    let xp_gain = genesis_babies::xp_from_difficulty(difficulty);
    let mut new = old.clone();
    new.work_count = old.work_count + 1;
    new.total_xp = old.total_xp + xp_gain;
    new.xp = old.xp + xp_gain;
    new.last_work_block = current_block;

    let tx = work_tx(&old, &new);
    let w = Data::from(&genesis_babies::WorkWitness {
        operation: "work".into(),
        challenge: challenge.into(),
        nonce: nonce.into(),
        difficulty,
        current_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "work with a nonce that fails verify_pow must reject (C3)"
    );
}

#[test]
fn work_op_rejects_inflated_xp() {
    // Direct test that C3 is closed at the integration level: even with a VALID
    // proof of work, an attacker cannot inject more XP than the on-chain
    // derivation allows. Here `new.total_xp` is bumped by the derived gain PLUS
    // an extra 999_999 (and `xp` likewise), simulating the old `xp_gain`-as-free-
    // input exploit. The contract must reject because the counters no longer
    // match `old + xp_from_difficulty(difficulty)`.
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;

    let challenge = "genesis-spark-test";
    let nonce = "745"; // valid PoW at difficulty 19
    let difficulty = 19u32;
    let current_block = 200_000u64;

    let derived = genesis_babies::xp_from_difficulty(difficulty); // 130
    let inflated = derived + 999_999; // the attacker's injected surplus

    let mut new = old.clone();
    new.work_count = old.work_count + 1;
    new.total_xp = old.total_xp + inflated; // NOT old.total_xp + derived
    new.xp = old.xp + inflated; // spendable xp inflated to match (would bypass level-up thresholds)
    new.last_work_block = current_block;

    let tx = work_tx(&old, &new);
    let w = Data::from(&genesis_babies::WorkWitness {
        operation: "work".into(),
        challenge: challenge.into(),
        nonce: nonce.into(),
        difficulty,
        current_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "work with XP inflated beyond xp_from_difficulty(difficulty) must reject (C3 closed)"
    );
}

// =============================================================================
// SETTLE (Fase 2 — batch narrative settlement) — accepted / rejected
//
// These exercise the new `settle` operation end-to-end through `app_contract`.
// `validate_settle` validates the STATE TRANSITION only (not the full Merkle
// inclusion proof — that is the EZKL layer's job, spec Sección 5). It enforces:
//   (1) narrative_root is well-formed (64 hex chars) and matches the witness,
//   (2) settle_count ticks by exactly 1 (anti-replay on the counter dimension),
//   (3) settle_block moves STRICTLY forward (anti-replay on the block dimension),
//   (4) gameplay counters (level, xp, total_xp, work_count, evolution_count,
//       tokens_earned, last_work_block) are UNCHANGED — settle cannot forge XP.
// =============================================================================

/// Build a one-in / one-out `Transaction` carrying `old` → `new` Spark state.
/// Same shape as `work_tx`; factored out separately so the settle tests read
/// at a glance.
fn settle_tx(old: &SparkNFTState, new: &SparkNFTState) -> Transaction {
    Transaction {
        ins: vec![(utxo(), charms_with(old))],
        refs: vec![],
        outs: vec![charms_with(new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    }
}

/// A fixed, well-formed 64-hex-char narrative root for tests. Built from a
/// repeat pattern (not a literal 64-hex string) so no secret scanner confuses
/// it for a key — it is test data, not a secret.
fn valid_narrative_root() -> String {
    "deadbeef".repeat(8) // 8 * 8 = 64 hex chars
}

#[test]
fn settle_op_valid_transition_is_accepted() {
    // First-ever settle: counter 0 → 1, block 0 → 100, narrative "" → root.
    let old = fresh_mint(); // settle_count=0, narrative_root="", last_settle_block=0

    let settle_block = 100u64;
    let root = valid_narrative_root();
    let mut new = old.clone();
    new.settle_count = old.settle_count + 1; // 1
    new.last_settle_block = settle_block;
    new.narrative_root = root.clone();

    let tx = settle_tx(&old, &new);
    let w = Data::from(&genesis_babies::SettleWitness {
        operation: "settle".into(),
        narrative_root: root,
        settle_block,
    });
    assert!(
        run(&app(), &tx, &Data::empty(), &w),
        "valid settle transition must be accepted"
    );
}

#[test]
fn settle_op_rejects_double_settle_same_block() {
    // Anti-replay on the block dimension: a second settle whose settle_block is
    // NOT strictly greater than old.last_settle_block must be rejected. This
    // prevents anchoring two roots at the same height.
    let mut old = fresh_mint();
    old.settle_count = 1;
    old.last_settle_block = 100;

    // BUG under test: settle_block == old.last_settle_block (not strictly greater).
    let settle_block = 100u64;
    let root = valid_narrative_root();
    let mut new = old.clone();
    new.settle_count = old.settle_count + 1;
    new.last_settle_block = settle_block;
    new.narrative_root = root.clone();

    let tx = settle_tx(&old, &new);
    let w = Data::from(&genesis_babies::SettleWitness {
        operation: "settle".into(),
        narrative_root: root,
        settle_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "settle at a non-advancing block must reject (anti-replay)"
    );
}

#[test]
fn settle_op_rejects_xp_mutation() {
    // Settle must NOT be a path to forge XP / tokens. Here the attacker performs
    // a valid-looking settle AND simultaneously bumps xp + total_xp. The
    // contract must reject because gameplay counters must be unchanged on settle.
    let mut old = fresh_mint();
    old.xp = 50;
    old.total_xp = 50;
    old.work_count = 1;

    let settle_block = 100u64;
    let root = valid_narrative_root();
    let mut new = old.clone();
    new.settle_count = old.settle_count + 1;
    new.last_settle_block = settle_block;
    new.narrative_root = root.clone();
    // BUG under test: attacker also bumps xp and total_xp through the settle op.
    new.xp = old.xp + 999_999;
    new.total_xp = old.total_xp + 999_999;

    let tx = settle_tx(&old, &new);
    let w = Data::from(&genesis_babies::SettleWitness {
        operation: "settle".into(),
        narrative_root: root,
        settle_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "settle that also bumps xp/total_xp must reject (no XP forgery via settle)"
    );
}

#[test]
fn settle_op_rejects_bad_narrative_root() {
    // The committed root must be a well-formed 64-hex-char string. Here it is
    // 63 chars (one short).
    let old = fresh_mint();

    let settle_block = 100u64;
    let bad_root = "a".repeat(63); // 63 chars, not 64
    let mut new = old.clone();
    new.settle_count = old.settle_count + 1;
    new.last_settle_block = settle_block;
    new.narrative_root = bad_root.clone();

    let tx = settle_tx(&old, &new);
    let w = Data::from(&genesis_babies::SettleWitness {
        operation: "settle".into(),
        narrative_root: bad_root,
        settle_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "settle with a 63-char (non-32-byte) narrative root must reject"
    );
}

#[test]
fn settle_op_rejects_counter_skip() {
    // Anti-replay on the counter dimension: settle_count must tick by EXACTLY 1.
    // Skipping (0 → 2) must be rejected so an attacker cannot reserve counter
    // space or desync the settlement log.
    let old = fresh_mint();

    let settle_block = 100u64;
    let root = valid_narrative_root();
    let mut new = old.clone();
    new.settle_count = old.settle_count + 2; // BUG: skips 1
    new.last_settle_block = settle_block;
    new.narrative_root = root.clone();

    let tx = settle_tx(&old, &new);
    let w = Data::from(&genesis_babies::SettleWitness {
        operation: "settle".into(),
        narrative_root: root,
        settle_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "settle that skips the counter (0→2) must reject"
    );
}

#[test]
fn settle_op_rejects_root_mismatch_between_witness_and_state() {
    // The witness attests root A but the published output carries root B. The
    // contract must reject — the published state must be bound to the witness.
    let old = fresh_mint();

    let settle_block = 100u64;
    let witness_root = valid_narrative_root();
    let mut state_root = witness_root.clone();
    // Flip the last char so the published root differs from the attested one.
    let last = state_root.pop().unwrap();
    state_root.push(if last == 'a' { 'b' } else { 'a' });

    let mut new = old.clone();
    new.settle_count = old.settle_count + 1;
    new.last_settle_block = settle_block;
    new.narrative_root = state_root; // differs from the witness's narrative_root

    let tx = settle_tx(&old, &new);
    let w = Data::from(&genesis_babies::SettleWitness {
        operation: "settle".into(),
        narrative_root: witness_root,
        settle_block,
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "settle where the published root != witness root must reject"
    );
}

// =============================================================================
// LEVEL UP — accepted
// =============================================================================

#[test]
fn level_up_valid_is_accepted() {
    let mut old = fresh_mint();
    old.level = 1;
    old.xp = 150; // >= xp_required_to_enter(2) = 100
    old.total_xp = 150;
    old.work_count = 3;

    let mut new = old.clone();
    new.level = old.level + 1; // 2
    new.xp = 0; // resets on level up
    new.evolution_count = old.evolution_count + 1;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "level_up".into(),
    });
    assert!(
        run(&app(), &tx, &Data::empty(), &w),
        "valid level_up must be accepted"
    );
}

// =============================================================================
// LEVEL UP — rejected
// =============================================================================

#[test]
fn level_up_insufficient_xp_is_rejected() {
    let mut old = fresh_mint();
    old.level = 1;
    old.xp = 50; // < xp_required_to_enter(2) = 100
    old.total_xp = 50;

    let mut new = old.clone();
    new.level = old.level + 1;
    new.xp = 0;
    new.evolution_count = old.evolution_count + 1;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "level_up".into(),
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "level_up with insufficient xp must reject"
    );
}

#[test]
fn level_up_at_max_level_is_rejected() {
    let mut old = fresh_mint();
    old.level = genesis_babies::MAX_LEVEL; // 21, the cap
    old.xp = 5_000_000;
    old.total_xp = 5_000_000;

    let mut new = old.clone();
    // Attacker tries to push past the cap.
    new.level = old.level + 1;
    new.xp = 0;
    new.evolution_count = old.evolution_count + 1;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "level_up".into(),
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "level_up at MAX_LEVEL must reject"
    );
}

#[test]
fn level_up_not_resetting_xp_is_rejected() {
    let mut old = fresh_mint();
    old.level = 1;
    old.xp = 150;
    old.total_xp = 150;

    let mut new = old.clone();
    new.level = old.level + 1;
    new.xp = 150; // BUG under test: xp must reset to 0 on level up
    new.evolution_count = old.evolution_count + 1;

    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&old))],
        refs: vec![],
        outs: vec![charms_with(&new)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "level_up".into(),
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "level_up not resetting xp must reject"
    );
}

// =============================================================================
// ROUTING / TRANSFER
// =============================================================================

#[test]
fn transfer_preserving_state_is_accepted() {
    // No private witness -> plain transfer branch -> state must be preserved.
    let s = fresh_mint();
    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&s))],
        refs: vec![],
        outs: vec![charms_with(&s)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    // Empty witness (no `operation`): `w.value::<NFTWitness>()` errors -> transfer branch.
    let w = Data::empty();
    assert!(
        run(&app(), &tx, &Data::empty(), &w),
        "transfer preserving state must be accepted"
    );
}

#[test]
fn transfer_mutating_state_is_rejected() {
    let s = fresh_mint();
    let mut s2 = s.clone();
    s2.level = 5; // state NOT preserved
    let tx = Transaction {
        ins: vec![(utxo(), charms_with(&s))],
        refs: vec![],
        outs: vec![charms_with(&s2)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::empty();
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "transfer mutating state must reject"
    );
}

#[test]
fn unknown_operation_is_rejected() {
    // SECURITY: the contract must NOT default-accept unknown operations.
    let s = fresh_mint();
    let tx = Transaction {
        ins: vec![(utxo(), empty_charms())],
        refs: vec![],
        outs: vec![charms_with(&s)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "burn".into(), // not mint/work_proof/level_up/transfer
    });
    assert!(
        !run(&app(), &tx, &Data::empty(), &w),
        "unknown operation must reject (security hardening)"
    );
}

#[test]
fn wrong_app_tag_is_rejected() {
    // The contract asserts `app.tag == NFT`. A token-tagged app must be rejected.
    let token_app = App {
        tag: 't',
        identity: app().identity.clone(),
        vk: app().vk.clone(),
    };
    let s = fresh_mint();
    let tx = Transaction {
        ins: vec![(utxo(), empty_charms())],
        refs: vec![],
        outs: vec![charms_with(&s)],
        coin_ins: None,
        coin_outs: None,
        prev_txs: Default::default(),
        app_public_inputs: Default::default(),
    };
    let w = Data::from(&genesis_babies::NFTWitness {
        operation: "mint".into(),
    });
    let _ = NFT; // silence unused import warning if any
    // `check!` either panics (release / abort) or returns `false` up the stack (the
    // surrounding `app_contract` returns `bool`). Both are valid rejections — what
    // matters is that it never returns `true`.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        genesis_babies::app_contract(&token_app, &tx, &Data::empty(), &w)
    }));
    let accepted = result.unwrap_or(false);
    assert!(
        !accepted,
        "wrong app tag must reject (panic or return false), not return true"
    );
}
