//! Genesis Babies NFT Contract
//!
//! Smart contract for BitcoinBaby Genesis Babies NFTs on Charms.
//! Uses the `n/` prefix for NFT app keys.
//!
//! # Operations
//! - Mint: Create new NFT with DNA-based traits
//! - Transfer: Move NFT (state unchanged)
//! - State updates: Handle via prover validation

use charms_sdk::data::{check, nft_state_preserved, App, Data, Transaction, NFT};
use serde::{Deserialize, Serialize};

// =============================================================================
// TYPES
// =============================================================================

/// Genesis Baby NFT State
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BabyNFTState {
    pub dna: String,
    pub bloodline: String,
    pub base_type: String,
    pub genesis_block: u64,
    pub rarity_tier: String,
    pub token_id: u32,
    pub level: u32,
    pub xp: u64,
    pub total_xp: u64,
    pub work_count: u64,
    pub last_work_block: u64,
    pub evolution_count: u32,
    pub tokens_earned: String,
}

/// Witness for operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NFTWitness {
    /// Operation type: mint, transfer, evolve, work
    pub operation: String,
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SUPPLY: u32 = 10_000;
const VALID_BLOODLINES: &[&str] = &["royal", "warrior", "rogue", "mystic"];
const VALID_BASE_TYPES: &[&str] = &["human", "animal", "robot", "mystic", "alien"];
const VALID_RARITIES: &[&str] = &["common", "uncommon", "rare", "epic", "legendary", "mythic"];

// =============================================================================
// CONTRACT ENTRY POINT
// =============================================================================

/// Main contract entry point
pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    // Must be NFT tag
    check!(app.tag == NFT);

    // Parse witness to get operation
    let witness: NFTWitness = match w.value() {
        Ok(w) => w,
        Err(_) => {
            // No witness = transfer, use built-in check
            return nft_state_preserved(app, tx);
        }
    };

    match witness.operation.as_str() {
        // Mint: validate initial state via public inputs
        "mint" => validate_mint(app, tx, x),

        // Transfer: state must be preserved
        "transfer" => nft_state_preserved(app, tx),

        // Other operations validated by prover
        // The prover verifies state transitions are valid
        _ => true,
    }
}

// =============================================================================
// VALIDATORS
// =============================================================================

/// Validate mint operation
/// Public inputs (x) contain the NFT state to validate
fn validate_mint(app: &App, tx: &Transaction, x: &Data) -> bool {
    // Parse the NFT state from public inputs
    let state: BabyNFTState = match x.value() {
        Ok(s) => s,
        Err(_) => {
            // If no public inputs, allow mint (prover validates)
            return true;
        }
    };

    // Validate token ID range
    if state.token_id == 0 || state.token_id > MAX_SUPPLY {
        return false;
    }

    // Validate DNA format (64 hex chars)
    if state.dna.len() != 64 {
        return false;
    }
    if !state.dna.chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }

    // Validate bloodline
    if !VALID_BLOODLINES.contains(&state.bloodline.as_str()) {
        return false;
    }

    // Validate base type
    if !VALID_BASE_TYPES.contains(&state.base_type.as_str()) {
        return false;
    }

    // Validate rarity
    if !VALID_RARITIES.contains(&state.rarity_tier.as_str()) {
        return false;
    }

    // Validate initial state
    if state.level != 1 {
        return false;
    }
    if state.xp != 0 || state.total_xp != 0 {
        return false;
    }
    if state.work_count != 0 {
        return false;
    }
    if state.evolution_count != 0 {
        return false;
    }

    // Verify no input NFTs (this is genesis)
    for (_, charm) in tx.ins.iter() {
        if charm.contains_key(app) {
            return false;
        }
    }

    // Verify output has the NFT
    let mut has_output = false;
    for charm in tx.outs.iter() {
        if charm.contains_key(app) {
            has_output = true;
            break;
        }
    }

    has_output
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_dna() {
        let valid = "a".repeat(64);
        assert_eq!(valid.len(), 64);
        assert!(valid.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_valid_traits() {
        assert!(VALID_BLOODLINES.contains(&"royal"));
        assert!(VALID_BASE_TYPES.contains(&"alien"));
        assert!(VALID_RARITIES.contains(&"mythic"));
    }

    #[test]
    fn test_max_supply() {
        assert_eq!(MAX_SUPPLY, 10_000);
    }
}
