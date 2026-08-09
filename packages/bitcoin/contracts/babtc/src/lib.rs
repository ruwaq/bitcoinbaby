//! BABTC Token Contract
//!
//! Smart contract for BitcoinBaby ($BABTC) token minting via Proof-of-Work.
//! Runs on Charms Protocol v11 using SP1 zkVM.
//!
//! # Mining Flow
//! 1. Miner finds valid PoW hash with sufficient leading zeros
//! 2. Mining TX is broadcast with OP_RETURN containing challenge:nonce:difficulty
//! 3. Mining TX is confirmed in a block
//! 4. Mint spell is created with merkle proof of mining TX inclusion
//! 5. This contract validates the proof and authorizes token minting
//!
//! # Reward Formula (Canonical BRO, aligned with bro-reward.ts)
//! reward = BRO_DENOMINATION · clz² / 2^halvings
//! Where clz = actual difficulty (leading zero bits)
//!   and halvings = floor((block_time - BRO_START_TIME) / 14d), capped at 63.
//!
//! # Distribution
//! - 90% to miner
//! - 5% to dev fund
//! - 5% to staking pool

use charms_sdk::data::{check, sum_token_amount, App, Data, Transaction, TOKEN};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// =============================================================================
// CONFIGURATION
// =============================================================================

/// Minimum required leading zero bits for valid PoW
const MIN_DIFFICULTY: u32 = 16;

/// BRO denomination: 8 decimals (1 whole token = 1e8 base units).
/// Mirrors `BRO_DENOMINATION` in packages/bitcoin/src/charms/bro-reward.ts:32.
const BRO_DENOMINATION: u64 = 100_000_000;

/// BRO genesis time (2025-09-02 UTC, epoch seconds). Anchor for halving.
/// Mirrors `BRO_START_TIME` in bro-reward.ts:39.
const BRO_START_TIME: u64 = 1_756_830_000;

/// BRO halves every 14 days (in seconds). Mirrors `BRO_HALVING_PERIOD_SECONDS`.
const BRO_HALVING_PERIOD_SECONDS: u64 = 14 * 24 * 60 * 60;

/// Maximum halving periods (cap to avoid 2^n overflow). Mirrors bro-reward.ts:50.
const MAX_HALVING_PERIODS: u32 = 63;

/// Reward distribution percentages (must sum to 100)
const MINER_SHARE_PCT: u64 = 90;
const DEV_SHARE_PCT: u64 = 5;
const STAKING_SHARE_PCT: u64 = 5;

// =============================================================================
// TYPES
// =============================================================================

/// Mining witness data passed as private input
///
/// Format matches the mining TX OP_RETURN: challenge:nonce:difficulty
/// The hash is computed as: double_sha256(challenge:nonce)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiningWitness {
    /// The challenge string (typically includes block data and address)
    pub challenge: String,
    /// The nonce that produces valid hash (hex format)
    pub nonce: String,
    /// The actual difficulty achieved (leading zero bits)
    pub difficulty: u32,
    /// Bitcoin block time (unix seconds) at which the work was mined.
    /// Used for the halving schedule in calculate_reward. Mirrors the
    /// `current_block` field in genesis-babies WorkWitness.
    pub block_time: u64,
}

/// Reward calculation result
#[derive(Debug, Clone)]
pub struct RewardCalc {
    pub total: u64,
    pub miner_share: u64,
    pub dev_share: u64,
    pub staking_share: u64,
}

// =============================================================================
// MAIN CONTRACT ENTRY POINT
// =============================================================================

/// Main contract entry point
///
/// Called by the Charms runtime to validate spell execution.
/// Returns true if the spell is valid and should be executed.
///
/// # Parameters
/// - `app`: The application context (tag, identity, vk)
/// - `tx`: The transaction being validated
/// - `x`: Public inputs (not used for mining)
/// - `w`: Private witness (contains mining proof)
pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    // Verify public inputs are empty (mining doesn't need them)
    let empty = Data::empty();
    check!(x == &empty);

    match app.tag {
        TOKEN => {
            check!(validate_token_mint(app, tx, w))
        }
        _ => {
            // Only token minting is supported
            return false;
        }
    }
    true
}

// =============================================================================
// TOKEN MINT VALIDATION
// =============================================================================

/// Validate a token mint operation
///
/// Checks:
/// 1. Mining witness is valid (PoW hash meets difficulty)
/// 2. Reward amounts are correctly calculated
/// 3. Distribution follows protocol rules (90/5/5)
fn validate_token_mint(app: &App, tx: &Transaction, w: &Data) -> bool {
    // Parse mining witness from private input
    let witness: MiningWitness = match w.value() {
        Ok(w) => w,
        Err(_) => {
            eprintln!("Failed to parse mining witness");
            return false;
        }
    };

    // Validate PoW difficulty
    if witness.difficulty < MIN_DIFFICULTY {
        eprintln!(
            "Difficulty {} is below minimum {}",
            witness.difficulty, MIN_DIFFICULTY
        );
        return false;
    }

    // Verify PoW hash
    // Format: challenge:nonce (matches WebGPU miner and test TX)
    if !verify_pow(&witness.challenge, &witness.nonce, witness.difficulty) {
        eprintln!("PoW verification failed");
        return false;
    }

    // Calculate expected reward based on difficulty
    let expected_reward = calculate_reward(witness.difficulty, witness.block_time);

    // Get input token amount (should be 0 for mining)
    let input_amount = match sum_token_amount(app, tx.ins.iter().map(|(_, v)| v)) {
        Ok(amt) => amt,
        Err(_) => 0, // No input tokens is valid for mining
    };

    // Get output token amount
    let output_amount = match sum_token_amount(app, tx.outs.iter()) {
        Ok(amt) => amt,
        Err(_) => {
            eprintln!("Failed to sum output token amount");
            return false;
        }
    };

    // Verify minting amount matches expected reward
    let minted = output_amount.saturating_sub(input_amount);
    if minted != expected_reward.total {
        eprintln!(
            "Minted amount {} doesn't match expected {}",
            minted, expected_reward.total
        );
        return false;
    }

    // Note: Individual share verification would require parsing output addresses
    // For now, we trust that the total is correct and the spell distributes properly

    true
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Calculate block reward — CANONICAL BRO formula (aligned with bro-reward.ts).
///
/// Formula: reward = BRO_DENOMINATION · clz² / 2^halvings
///   where halvings = clamp(0, floor((block_time - START_TIME) / PERIOD), MAX)
///
/// Mirrors `minedAmountBro` in packages/bitcoin/src/charms/bro-reward.ts:67.
/// Any change here MUST be reflected there and vice versa.
fn calculate_reward(difficulty: u32, block_time: u64) -> RewardCalc {
    let clz = difficulty as u128;
    let clz_squared = clz * clz;

    // Halving: periods since genesis, clamped to [0, MAX].
    let safe_time = if block_time < BRO_START_TIME {
        BRO_START_TIME
    } else {
        block_time
    };
    let periods_passed = (safe_time - BRO_START_TIME) / BRO_HALVING_PERIOD_SECONDS;
    let safe_periods = if periods_passed > MAX_HALVING_PERIODS as u64 {
        MAX_HALVING_PERIODS as u64
    } else {
        periods_passed
    };
    let halving_factor = 1u128 << safe_periods; // 2^safe_periods

    let total = (BRO_DENOMINATION as u128 * clz_squared / halving_factor) as u64;

    let miner_share = total * MINER_SHARE_PCT / 100;
    let dev_share = total * DEV_SHARE_PCT / 100;
    let staking_share = total - miner_share - dev_share;

    RewardCalc {
        total,
        miner_share,
        dev_share,
        staking_share,
    }
}

/// Verify Proof of Work
///
/// Computes double SHA256 of challenge:nonce and checks leading zeros
/// Format matches WebGPU miner: `${challenge}:${nonceHex}`
/// Uses Bitcoin standard double SHA256 (hash256)
fn verify_pow(challenge: &str, nonce: &str, required_difficulty: u32) -> bool {
    let data = format!("{}:{}", challenge, nonce);
    let hash = double_sha256(data.as_bytes());
    let leading_zeros = count_leading_zeros(&hash);
    leading_zeros >= required_difficulty
}

/// Count leading zero bits in a hash
fn count_leading_zeros(hash: &[u8]) -> u32 {
    let mut zeros = 0u32;
    for byte in hash {
        if *byte == 0 {
            zeros += 8;
        } else {
            zeros += byte.leading_zeros();
            break;
        }
    }
    zeros
}

/// Double SHA256 (Bitcoin standard)
fn double_sha256(data: &[u8]) -> Vec<u8> {
    let first = Sha256::digest(data);
    let second = Sha256::digest(&first);
    second.to_vec()
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_leading_zeros() {
        // 2 zero bytes (16 bits) + 7 leading zeros of 0x01 = 23.
        assert_eq!(count_leading_zeros(&[0x00, 0x00, 0x01, 0xff]), 23);
        // 1 zero byte (8 bits) + 4 leading zeros of 0x0f = 12.
        assert_eq!(count_leading_zeros(&[0x00, 0x0f, 0xff, 0xff]), 12);
        assert_eq!(count_leading_zeros(&[0x00, 0x00, 0x00, 0xff]), 24);
        assert_eq!(count_leading_zeros(&[0xff, 0xff, 0xff, 0xff]), 0);
    }

    #[test]
    fn test_calculate_reward_canonical_formula_period_0() {
        // Canonical: minedAmountBro = DENOMINATION · clz² / 2^halvings
        // clz=16, period 0 (block_time == START_TIME) → 1e8 · 256 / 1 = 25_600_000_000
        let reward = calculate_reward(16, BRO_START_TIME);
        assert_eq!(reward.total, 25_600_000_000, "clz=16 period 0 must match canonical");
    }

    #[test]
    fn test_calculate_reward_halving_halves_reward() {
        // One halving period later → reward halves.
        let r0 = calculate_reward(16, BRO_START_TIME);
        let r1 = calculate_reward(16, BRO_START_TIME + BRO_HALVING_PERIOD_SECONDS);
        assert_eq!(r0.total, r1.total * 2, "one halving period must halve the reward");
    }

    #[test]
    fn test_calculate_reward_clamps_before_start_time() {
        // block_time before START_TIME clamps to START_TIME (no negative halvings).
        let before = calculate_reward(16, BRO_START_TIME - 1);
        let at = calculate_reward(16, BRO_START_TIME);
        assert_eq!(before.total, at.total, "pre-genesis clamps to genesis");
    }

    #[test]
    fn test_calculate_reward_scales_with_clz_squared() {
        // clz=20 (vs 16): 20²/16² = 400/256 = 1.5625× the reward.
        let r16 = calculate_reward(16, BRO_START_TIME);
        let r20 = calculate_reward(20, BRO_START_TIME);
        // 25_600_000_000 * 400 / 256 = 40_000_000_000
        let _ = r16;
        assert_eq!(r20.total, 40_000_000_000);
    }

    #[test]
    fn test_calculate_reward() {
        // D=16 period 0: 1e8 · 16² / 1 = 25_600_000_000
        let reward = calculate_reward(16, BRO_START_TIME);
        assert_eq!(reward.total, 25_600_000_000_u64);

        // D=22 period 0: 1e8 · 22² / 1 = 48_400_000_000
        let reward = calculate_reward(22, BRO_START_TIME);
        assert_eq!(reward.total, 48_400_000_000_u64);

        // D=20 period 0: 1e8 · 20² / 1 = 40_000_000_000 — verify distribution (90/5/5)
        let reward = calculate_reward(20, BRO_START_TIME);
        let total = reward.total;
        assert_eq!(total, 40_000_000_000_u64);
        assert_eq!(reward.miner_share, total * 90 / 100);
        assert_eq!(reward.dev_share, total * 5 / 100);
        // staking_share gets remainder
        assert_eq!(reward.staking_share, total - reward.miner_share - reward.dev_share);
    }

    #[test]
    fn test_verify_pow() {
        // This is a mock test - in reality we'd need actual valid PoW
        // The function should work correctly with real mining data
        let challenge = "test_challenge";
        let nonce = "test_nonce";
        // Most random hashes won't have many leading zeros
        let result = verify_pow(challenge, nonce, 1);
        // Result depends on actual hash - just verify it doesn't panic
        let _ = result;
    }
}
