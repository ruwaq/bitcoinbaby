//! Genesis Sparks NFT Contract (Charms v15)
//!
//! On-chain validation for Genesis Sparks NFTs. Revives the complete contract from commit
//! `90cee8b` (which was reduced to a 13-line stub in `80ad37e`) and hardens it:
//!   - reads mint state from `tx.outs` via `charm_values` (the published charm output),
//!   - closes the `90cee8b` mint hole that returned `true` when state was absent,
//!   - rejects unknown operations (`_ => false`, was `_ => true`),
//!   - adds `validate_work_proof` and `validate_level_up` (did not exist before),
//!   - adds `app_version!(1)` + edition 2024.
//!
//! See `docs/superpowers/specs/2026-08-08-testnet4-profesional-nft-design.md` Section 2.

use charms_sdk::data::{
    check, charm_values, nft_state_preserved, App, Charms, Data, NFT, Transaction,
};
use serde::{Deserialize, Serialize};

charms_sdk::app_version!(1);

// =============================================================================
// TYPES
// =============================================================================

/// Genesis Spark NFT state (snake_case; mirrors the worker's TS type).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SparkNFTState {
    pub dna: String,           // 64 hex chars
    pub bloodline: String,     // royal|warrior|rogue|mystic
    pub base_type: String,     // human|animal|robot|mystic|alien
    pub genesis_block: u64,
    pub rarity_tier: String,   // common|uncommon|rare|epic|legendary|mythic
    pub token_id: u32,         // 1..=10000
    pub level: u32,            // 1..=21
    pub xp: u64,
    pub total_xp: u64,
    pub work_count: u64,
    pub last_work_block: u64,
    pub evolution_count: u32,
    pub tokens_earned: String,
    pub heritage: u32,         // 0..=4
}

/// Top-level witness carrying only the operation name. Used to route mint / level_up / transfer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NFTWitness {
    pub operation: String,
}

/// Richer witness for the work_proof path: carries `xp_gain` and `current_block` (private data that
/// must not appear in the public input `x`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkProofWitness {
    pub operation: String, // always "work_proof"
    pub xp_gain: u64,
    pub current_block: u64,
}

// =============================================================================
// CONSTANTS
// =============================================================================

pub const MAX_SUPPLY: u32 = 10_000;
pub const MAX_LEVEL: u32 = 21;
pub const VALID_BLOODLINES: &[&str] = &["royal", "warrior", "rogue", "mystic"];
pub const VALID_BASE_TYPES: &[&str] = &["human", "animal", "robot", "mystic", "alien"];
pub const VALID_RARITIES: &[&str] = &["common", "uncommon", "rare", "epic", "legendary", "mythic"];

// =============================================================================
// CONTRACT ENTRY POINT
// =============================================================================

/// Main contract entry point.
///
/// Argument order `(app, tx, x, w)` matches the v15 `main!` macro:
/// `x` is the public input (published in the spell), `w` is the private witness
/// (delivered via `app_private_inputs`, never published).
pub fn app_contract(app: &App, tx: &Transaction, _x: &Data, w: &Data) -> bool {
    check!(app.tag == NFT);

    let witness: NFTWitness = match w.value() {
        Ok(wv) => wv,
        // No private witness for this app = plain transfer; just check state is preserved.
        Err(_) => return nft_state_preserved(app, tx),
    };

    match witness.operation.as_str() {
        "mint" => validate_mint(app, tx),
        "work_proof" => {
            // The work_proof path needs `xp_gain` + `current_block`, which only exist on the
            // richer `WorkProofWitness`. Re-deserialize `w` as that shape.
            let wp: WorkProofWitness = match w.value() {
                Ok(v) => v,
                Err(_) => return false,
            };
            validate_work_proof(app, tx, wp.xp_gain, wp.current_block)
        }
        "level_up" => validate_level_up(app, tx),
        "transfer" => nft_state_preserved(app, tx),
        // SECURITY FIX: `90cee8b` returned `true` here, accepting any unknown op.
        _ => false,
    }
}

// =============================================================================
// PURE VALIDATION HELPERS (unit-tested directly)
// =============================================================================

pub fn is_valid_dna(dna: &str) -> bool {
    dna.len() == 64 && dna.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn is_valid_token_id(id: u32) -> bool {
    (1..=MAX_SUPPLY).contains(&id)
}

pub fn is_valid_bloodline(s: &str) -> bool {
    VALID_BLOODLINES.contains(&s)
}

pub fn is_valid_base_type(s: &str) -> bool {
    VALID_BASE_TYPES.contains(&s)
}

pub fn is_valid_rarity(s: &str) -> bool {
    VALID_RARITIES.contains(&s)
}

/// A freshly minted Spark must start at level 1 with no accumulated XP / work / evolution.
pub fn is_valid_initial_state(s: &SparkNFTState) -> bool {
    s.level == 1
        && s.xp == 0
        && s.total_xp == 0
        && s.work_count == 0
        && s.evolution_count == 0
}

/// Compare the immutable identity traits of two Sparks. Level / xp / work counters / tokens are
/// mutable and intentionally excluded.
pub fn immutable_traits_match(a: &SparkNFTState, b: &SparkNFTState) -> bool {
    a.dna == b.dna
        && a.bloodline == b.bloodline
        && a.base_type == b.base_type
        && a.rarity_tier == b.rarity_tier
        && a.token_id == b.token_id
        && a.genesis_block == b.genesis_block
        && a.heritage == b.heritage
}

// =============================================================================
// STATE HELPERS (need the Charms runtime)
// =============================================================================

/// Collect every `SparkNFTState` published for `app` across the given charms. Works for both
/// `tx.outs.iter()` and `tx.ins.iter().map(|(_, c)| c)` since both yield `&Charms` (= `&BTreeMap<App, Data>`).
fn collect_nft_states<'a, I>(app: &'a App, iter: I) -> Vec<SparkNFTState>
where
    I: Iterator<Item = &'a Charms>,
{
    let mut out = Vec::new();
    for data in charm_values(app, iter) {
        if let Ok(state) = data.value::<SparkNFTState>() {
            out.push(state);
        }
    }
    out
}

/// Exactly one input NFT, returned; otherwise `None`.
fn single_input_state(app: &App, tx: &Transaction) -> Option<SparkNFTState> {
    let mut states = collect_nft_states(app, tx.ins.iter().map(|(_, c)| c));
    if states.len() == 1 {
        states.pop()
    } else {
        None
    }
}

/// Exactly one output NFT, returned; otherwise `None`.
fn single_output_state(app: &App, tx: &Transaction) -> Option<SparkNFTState> {
    let mut states = collect_nft_states(app, tx.outs.iter());
    if states.len() == 1 {
        states.pop()
    } else {
        None
    }
}

// =============================================================================
// OPERATION VALIDATORS
// =============================================================================

/// Mint: validate the freshly-created Spark. Per the spike (Section 6) the state is read from
/// `tx.outs` (the published charm output), NOT from the public input `x`.
fn validate_mint(app: &App, tx: &Transaction) -> bool {
    // Genesis: there must be NO input NFT for this app.
    let in_states = collect_nft_states(app, tx.ins.iter().map(|(_, c)| c));
    if !in_states.is_empty() {
        return false;
    }

    // Exactly one freshly-minted Spark in the outputs.
    let Some(state) = single_output_state(app, tx) else {
        return false;
    };

    // Range / format checks.
    if !is_valid_token_id(state.token_id) {
        return false;
    }
    if !is_valid_dna(&state.dna) {
        return false;
    }
    if !is_valid_bloodline(&state.bloodline) {
        return false;
    }
    if !is_valid_base_type(&state.base_type) {
        return false;
    }
    if !is_valid_rarity(&state.rarity_tier) {
        return false;
    }
    if !is_valid_initial_state(&state) {
        return false;
    }

    true
}

/// Work proof: accrue XP from mining. `xp_gain` and `current_block` come from the private witness
/// (they are not published). Uses checked arithmetic so a malicious (overflowing) gain fails
/// validation instead of panicking the contract under `panic = "abort"`.
fn validate_work_proof(app: &App, tx: &Transaction, xp_gain: u64, current_block: u64) -> bool {
    let Some(old) = single_input_state(app, tx) else {
        return false;
    };
    let Some(new) = single_output_state(app, tx) else {
        return false;
    };

    // Identity is immutable.
    if !immutable_traits_match(&old, &new) {
        return false;
    }
    // Level does not change on a work proof.
    if new.level != old.level {
        return false;
    }

    // Counters move forward exactly by the witness-claimed amounts. `checked_add` defends against
    // overflow panics under the abort profile.
    let Some(expected_work_count) = old.work_count.checked_add(1) else {
        return false;
    };
    let Some(expected_total_xp) = old.total_xp.checked_add(xp_gain) else {
        return false;
    };

    if new.work_count != expected_work_count {
        return false;
    }
    if new.total_xp != expected_total_xp {
        return false;
    }
    if new.last_work_block != current_block {
        return false;
    }
    if new.evolution_count != old.evolution_count {
        return false;
    }

    true
}

/// Level up: convert accumulated XP into a level. Level is capped at `MAX_LEVEL`. Aligned with the
/// economy redesign in `4ad993b` (no token burn).
fn validate_level_up(app: &App, tx: &Transaction) -> bool {
    let Some(old) = single_input_state(app, tx) else {
        return false;
    };
    let Some(new) = single_output_state(app, tx) else {
        return false;
    };

    // Identity is immutable.
    if !immutable_traits_match(&old, &new) {
        return false;
    }

    // Must be below the cap to level up.
    if old.level >= MAX_LEVEL {
        return false;
    }
    // Checked add defends against `u32::MAX` overflow.
    let Some(expected_level) = old.level.checked_add(1) else {
        return false;
    };
    if new.level != expected_level {
        return false;
    }

    // XP resets on level up; the evolution counter ticks forward.
    if new.xp != 0 {
        return false;
    }
    let Some(expected_evo) = old.evolution_count.checked_add(1) else {
        return false;
    };
    if new.evolution_count != expected_evo {
        return false;
    }

    // Lifetime totals and earned tokens do NOT change on a level up.
    if new.total_xp != old.total_xp {
        return false;
    }
    if new.work_count != old.work_count {
        return false;
    }
    if new.tokens_earned != old.tokens_earned {
        return false;
    }
    if new.last_work_block != old.last_work_block {
        return false;
    }

    true
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_state() -> SparkNFTState {
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
        }
    }

    // --- DNA ---------------------------------------------------------------

    #[test]
    fn test_dna_validation() {
        // 64 hex chars pass.
        assert!(is_valid_dna(&"a".repeat(64)));
        assert!(is_valid_dna(
            "0123456789abcdefABCDEF0123456789abcdefABCDEF0123456789abcdefABCD"
        ));
        // Too short.
        assert!(!is_valid_dna("short"));
        // Right length, non-hex chars.
        assert!(!is_valid_dna(&"z".repeat(64)));
        assert!(!is_valid_dna(&"g".repeat(64)));
        // Empty.
        assert!(!is_valid_dna(""));
        // Too long.
        assert!(!is_valid_dna(&"a".repeat(65)));
    }

    // --- Supply cap --------------------------------------------------------

    #[test]
    fn test_supply_cap() {
        assert!(is_valid_token_id(1));
        assert!(is_valid_token_id(10_000));
        assert!(!is_valid_token_id(0));
        assert!(!is_valid_token_id(10_001));
        assert!(!is_valid_token_id(u32::MAX));
    }

    // --- Trait constants ---------------------------------------------------

    #[test]
    fn test_valid_trait_constants() {
        for b in VALID_BLOODLINES {
            assert!(is_valid_bloodline(b), "{b} should be valid");
        }
        assert_eq!(VALID_BLOODLINES.len(), 4);
        assert!(!is_valid_bloodline("peasant"));
        assert!(!is_valid_bloodline(""));

        for t in VALID_BASE_TYPES {
            assert!(is_valid_base_type(t), "{t} should be valid");
        }
        assert_eq!(VALID_BASE_TYPES.len(), 5);
        assert!(!is_valid_base_type("dragon"));

        for r in VALID_RARITIES {
            assert!(is_valid_rarity(r), "{r} should be valid");
        }
        assert_eq!(VALID_RARITIES.len(), 6);
        assert!(!is_valid_rarity("ultra"));
    }

    // --- Initial state -----------------------------------------------------

    #[test]
    fn test_initial_state_validation() {
        // Fresh state passes.
        assert!(is_valid_initial_state(&valid_state()));

        // Each violation fails.
        let mut s = valid_state();
        s.level = 2;
        assert!(!is_valid_initial_state(&s), "level != 1 must fail");

        let mut s = valid_state();
        s.xp = 5;
        assert!(!is_valid_initial_state(&s), "xp != 0 must fail");

        let mut s = valid_state();
        s.total_xp = 5;
        assert!(!is_valid_initial_state(&s), "total_xp != 0 must fail");

        let mut s = valid_state();
        s.work_count = 1;
        assert!(!is_valid_initial_state(&s), "work_count != 0 must fail");

        let mut s = valid_state();
        s.evolution_count = 1;
        assert!(!is_valid_initial_state(&s), "evolution_count != 0 must fail");
    }

    // --- Immutable traits --------------------------------------------------

    #[test]
    fn test_immutable_traits_match() {
        let a = valid_state();
        // A clone matches.
        assert!(immutable_traits_match(&a, &a.clone()));

        // Changing a mutable field (level) still matches.
        let mut b = a.clone();
        b.level = 7;
        b.xp = 999;
        b.work_count = 3;
        b.evolution_count = 2;
        assert!(immutable_traits_match(&a, &b), "mutable fields are excluded");

        // Changing an immutable field (dna) must NOT match.
        let mut c = a.clone();
        c.dna = "b".repeat(64);
        assert!(!immutable_traits_match(&a, &c), "dna is immutable");

        // Changing bloodline.
        let mut c = a.clone();
        c.bloodline = "warrior".into();
        assert!(!immutable_traits_match(&a, &c));

        // Changing token_id.
        let mut c = a.clone();
        c.token_id = 42;
        assert!(!immutable_traits_match(&a, &c));

        // Changing heritage.
        let mut c = a.clone();
        c.heritage = 3;
        assert!(!immutable_traits_match(&a, &c));
    }

    // --- Level cap ---------------------------------------------------------

    #[test]
    fn test_max_level() {
        assert_eq!(MAX_LEVEL, 21);
        assert_eq!(MAX_SUPPLY, 10_000);
    }
}
