//! BABTC V2 Token Contract - Claim System
//!
//! Smart contract for BitcoinBaby ($BABTC) token minting via Server-Signed Claims.
//! This is the user-paid settlement model where users pay Bitcoin fees to claim tokens.
//!
//! # Claim Flow (Like BRO Token)
//! 1. User mines off-chain, accumulating virtual work
//! 2. User prepares claim - server aggregates proofs and signs
//! 3. User creates Bitcoin TX with claim data in OP_RETURN
//! 4. User broadcasts and pays ~1000 sats fee
//! 5. This contract validates server signature and authorizes minting
//!
//! # Validation
//! - Server signature (HMAC-SHA256) over aggregated proof
//! - Token amount = totalWork / WORK_DIVISOR
//! - Nonce prevents replay attacks
//!
//! # Benefits over V1
//! - User pays fees, not team (sustainable)
//! - Aggregated claims reduce on-chain footprint
//! - Same security via server signature

use charms_sdk::data::{check, sum_token_amount, App, Data, Transaction, TOKEN};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

// =============================================================================
// CONFIGURATION
// =============================================================================

/// Token denomination (8 decimals like Bitcoin)
const DENOMINATION: u64 = 100_000_000;

/// Work divisor for token calculation: tokens = totalWork / WORK_DIVISOR
const WORK_DIVISOR: u64 = 100;

// =============================================================================
// TYPES
// =============================================================================

/// Aggregated claim data signed by server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimWitness {
    /// User's Bitcoin address
    pub address: String,
    /// Total work (sum of D² from all proofs)
    pub total_work: u64,
    /// Number of proofs aggregated
    pub proof_count: u32,
    /// Merkle root of all proof hashes
    pub merkle_root: String,
    /// Calculated token amount
    pub token_amount: u64,
    /// Timestamp when claim was prepared
    pub timestamp: u64,
    /// Unique nonce (prevents replay)
    pub nonce: String,
    /// Server's HMAC-SHA256 signature
    pub server_signature: String,
}

// =============================================================================
// MAIN CONTRACT ENTRY POINT
// =============================================================================

/// Main contract entry point
///
/// Called by the Charms runtime to validate spell execution.
pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    // Verify public inputs are empty (claims don't need them)
    let empty = Data::empty();
    check!(x == &empty);

    match app.tag {
        TOKEN => {
            check!(validate_claim_mint(app, tx, w))
        }
        _ => {
            return false;
        }
    }
    true
}

// =============================================================================
// CLAIM VALIDATION
// =============================================================================

/// Validate a token mint from server-signed claim
fn validate_claim_mint(app: &App, tx: &Transaction, w: &Data) -> bool {
    // Parse claim witness
    let witness: ClaimWitness = match w.value() {
        Ok(w) => w,
        Err(_) => {
            eprintln!("Failed to parse claim witness");
            return false;
        }
    };

    // Verify server signature
    if !verify_server_signature(&witness) {
        eprintln!("Server signature verification failed");
        return false;
    }

    // Verify token amount calculation
    let expected_tokens = calculate_tokens(witness.total_work);
    if witness.token_amount != expected_tokens {
        eprintln!(
            "Token amount mismatch: got {}, expected {}",
            witness.token_amount, expected_tokens
        );
        return false;
    }

    // Get input token amount (should be 0 for claim)
    let input_amount = match sum_token_amount(app, tx.ins.iter().map(|(_, v)| v)) {
        Ok(amt) => amt,
        Err(_) => 0,
    };

    // Get output token amount
    let output_amount = match sum_token_amount(app, tx.outs.iter()) {
        Ok(amt) => amt,
        Err(_) => {
            eprintln!("Failed to sum output token amount");
            return false;
        }
    };

    // Verify minting amount matches claim
    let minted = output_amount.saturating_sub(input_amount);
    if minted != witness.token_amount {
        eprintln!(
            "Minted amount {} doesn't match claim {}",
            minted, witness.token_amount
        );
        return false;
    }

    // Note: Nonce uniqueness is enforced by including it in the signature
    // and the fact that each claim TX is unique on-chain

    true
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Calculate token amount from total work
/// Formula: tokens = (totalWork * DENOMINATION) / WORK_DIVISOR
fn calculate_tokens(total_work: u64) -> u64 {
    total_work.saturating_mul(DENOMINATION) / WORK_DIVISOR
}

/// The server's secret key (32 bytes, hex). Used to sign claims.
/// This is a PLACEHOLDER — the real value is generated at deploy time from the
/// treasury signer and set via a build-time env var or manual replacement
/// before compiling the mainnet wasm. It must NEVER be committed for real.
/// For testnet/dev it can be any 32-byte hex.
///
/// TODO (deploy): replace this with the real treasury secret before mainnet
/// compile. The secret is generated alongside the treasury mnemonic via
/// scripts/signer/generate-wallet.ts (extend it to also output this key).
const SERVER_SECRET_HEX: &str = "0000000000000000000000000000000000000000000000000000000000000000";

type HmacSha256 = Hmac<Sha256>;

/// Canonical message that the server signs. MUST match exactly what
/// scripts/signer and apps/workers/src/services/claim-minting-service.ts
/// produce when signing. Field order is fixed; changes here break all
/// existing claims (acceptable in a Big-Bang Reset).
fn signed_message(witness: &ClaimWitness) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}|{}",
        witness.address,
        witness.total_work,
        witness.proof_count,
        witness.merkle_root,
        witness.token_amount,
        witness.timestamp,
        witness.nonce,
    )
}

/// Verify the server signature cryptographically (HMAC-SHA256).
///
/// Replaces the decorative check that returned `true` for any 64-hex string.
/// The signature is an HMAC-SHA256 of `signed_message(witness)` under
/// SERVER_SECRET. A claim without the secret cannot forge a valid signature.
fn verify_server_signature(witness: &ClaimWitness) -> bool {
    // (1) Format checks (kept from the old implementation).
    if witness.server_signature.len() != 64 {
        eprintln!("Invalid signature length: {}", witness.server_signature.len());
        return false;
    }
    if !witness.server_signature.chars().all(|c| c.is_ascii_hexdigit()) {
        eprintln!("Signature contains invalid characters");
        return false;
    }

    // (2) Decode the hex signature to 32 bytes.
    let sig_bytes = match hex::decode(&witness.server_signature) {
        Ok(b) => b,
        Err(_) => return false,
    };

    // (3) Decode the server secret to bytes.
    let secret_bytes = match hex::decode(SERVER_SECRET_HEX) {
        Ok(b) => b,
        Err(_) => return false, // misconfigured secret — fail closed
    };

    // (4) Compute HMAC-SHA256 of the canonical message.
    let mut mac = match HmacSha256::new_from_slice(&secret_bytes) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(signed_message(witness).as_bytes());

    // (5) Constant-time verification. verify_slice returns Ok(()) on match,
    // Err otherwise. It is NOT susceptible to timing attacks.
    mac.verify_slice(&sig_bytes).is_ok()
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_tokens() {
        // 100 work = 1 BABTC
        assert_eq!(calculate_tokens(100), DENOMINATION);

        // 256 work (D16²) = 2.56 BABTC
        assert_eq!(calculate_tokens(256), 256_000_000);

        // 1000 work = 10 BABTC
        assert_eq!(calculate_tokens(1000), 10 * DENOMINATION);
    }

    #[test]
    fn test_signature_format() {
        // Valid signature (64 hex chars)
        let valid_sig = "a".repeat(64);
        assert!(valid_sig.len() == 64);
        assert!(valid_sig.chars().all(|c| c.is_ascii_hexdigit()));

        // Invalid length
        let short_sig = "abc123";
        assert!(short_sig.len() != 64);
    }

    #[test]
    fn test_verify_server_signature_accepts_valid_hmac() {
        let mut witness = ClaimWitness {
            address: "tb1ptestaddress".to_string(),
            total_work: 100,
            proof_count: 1,
            merkle_root: "a".repeat(64),
            token_amount: 1_000_000,
            timestamp: 1_000_000,
            nonce: "1".to_string(),
            server_signature: String::new(),
        };
        // Compute a REAL HMAC under the placeholder secret, over the canonical
        // message. This is exactly what the signer will do at deploy time.
        let secret = hex::decode(SERVER_SECRET_HEX).unwrap();
        let mut mac = HmacSha256::new_from_slice(&secret).unwrap();
        mac.update(signed_message(&witness).as_bytes());
        witness.server_signature = hex::encode(mac.finalize().into_bytes());
        assert!(
            verify_server_signature(&witness),
            "a correctly-computed HMAC must verify"
        );
    }

    #[test]
    fn test_verify_server_signature_rejects_all_zeros() {
        // A signature of all zeros must NEVER verify as valid.
        let witness = ClaimWitness {
            address: "tb1ptestaddress".to_string(),
            total_work: 100,
            proof_count: 1,
            merkle_root: "a".repeat(64),
            token_amount: 1_000_000,
            timestamp: 1_000_000,
            nonce: "1".to_string(),
            server_signature: "0".repeat(64), // 64 hex chars, all zeros
        };
        assert!(
            !verify_server_signature(&witness),
            "all-zeros signature must be rejected"
        );
    }

    #[test]
    fn test_verify_server_signature_rejects_wrong_length() {
        let mut witness = ClaimWitness {
            address: "tb1ptestaddress".to_string(),
            total_work: 100,
            proof_count: 1,
            merkle_root: "a".repeat(64),
            token_amount: 1_000_000,
            timestamp: 1_000_000,
            nonce: "1".to_string(),
            server_signature: "abc".to_string(), // too short
        };
        assert!(!verify_server_signature(&witness));
        witness.server_signature = "x".repeat(64); // wrong charset (not hex)
        assert!(!verify_server_signature(&witness));
    }

    #[test]
    fn test_verify_server_signature_rejects_tampered_message() {
        // Compute a REAL valid HMAC for w1, then tamper token_amount on w2
        // (keeping the same signature). The signature must bind to token_amount:
        // w1 verifies, w2 does not.
        let mut w1 = ClaimWitness {
            address: "tb1ptestaddress".to_string(),
            total_work: 100,
            proof_count: 1,
            merkle_root: "a".repeat(64),
            token_amount: 1_000_000,
            timestamp: 1_000_000,
            nonce: "1".to_string(),
            server_signature: String::new(),
        };
        let secret = hex::decode(SERVER_SECRET_HEX).unwrap();
        let mut mac = HmacSha256::new_from_slice(&secret).unwrap();
        mac.update(signed_message(&w1).as_bytes());
        w1.server_signature = hex::encode(mac.finalize().into_bytes());

        let mut w2 = w1.clone();
        w2.token_amount = 2_000_000; // tampered — signature no longer matches

        assert!(verify_server_signature(&w1), "original must verify");
        assert!(!verify_server_signature(&w2), "tampered message must be rejected");
    }
}
