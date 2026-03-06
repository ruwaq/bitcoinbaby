# BABTC V2 Contract - User-Paid Claims

## Overview

BABTC V2 is the user-paid settlement system for BitcoinBaby. Unlike V1 where the team
pays transaction fees, V2 allows users to claim tokens when they want at their preferred
fee rate.

## Key Differences from V1

| Feature | V1 (PoW Direct) | V2 (Server-Signed Claims) |
|---------|-----------------|---------------------------|
| Fee Payer | Team Treasury | User |
| Validation | Individual PoW hash | Aggregated proof signature |
| On-chain Data | Per-share TX | Aggregated claim TX |
| Cost per Claim | ~10k sats (team) | ~1k sats (user) |
| Sustainability | Limited by Treasury | Unlimited |

## Claim Flow

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Mine Off-Chain │ ──▶  │  Prepare Claim  │ ──▶  │  Create TX      │
│  (Free)         │      │  (Server Signs) │      │  (User Pays)    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                           │
                         ┌─────────────────┐               ▼
                         │  Tokens in      │ ◀── ┌─────────────────┐
                         │  Wallet!        │     │  Broadcast &    │
                         └─────────────────┘     │  Confirm        │
                                                 └─────────────────┘
```

## Work-to-Token Formula

```
tokens = (totalWork × DENOMINATION) / WORK_DIVISOR
tokens = (totalWork × 100,000,000) / 100

Example:
- 100 shares at D16 = 100 × 256 = 25,600 work
- Tokens = 25,600 × 100,000,000 / 100 = 25,600,000,000 (256 BABTC)
```

## Claim Witness Format

The contract validates claims using this witness data:

```rust
pub struct ClaimWitness {
    pub address: String,        // User's Bitcoin address
    pub total_work: u64,        // Sum of D² from all proofs
    pub proof_count: u32,       // Number of aggregated proofs
    pub merkle_root: String,    // Merkle root of proof hashes
    pub token_amount: u64,      // Calculated token amount
    pub timestamp: u64,         // Claim preparation time
    pub nonce: String,          // Unique claim ID (UUID)
    pub server_signature: String, // HMAC-SHA256 from server
}
```

## Server Signature

The server signs claims using HMAC-SHA256:

```
message = address|totalWork|proofCount|merkleRoot|tokenAmount|timestamp|nonce
signature = HMAC-SHA256(SERVER_SECRET, message)
```

## Building

```bash
cd packages/bitcoin/contracts/babtc-v2

# Build contract
cargo build --release --target wasm32-wasip1

# Generate VK
charms app vk ./target/wasm32-wasip1/release/babtc_v2_contract.wasm
```

## Deployment

After building, update:
1. `DEPLOYMENT.md` with new App ID and VK
2. `packages/bitcoin/src/config/deployment.ts`
3. Worker environment variables

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claim/balance/:address` | GET | Get claimable work |
| `/api/claim/prepare` | POST | Prepare and sign claim |
| `/api/claim/confirm` | POST | Confirm TX broadcast |
| `/api/claim/status/:id` | GET | Check claim status |
| `/api/claim/history/:address` | GET | Claim history |

## Security Considerations

1. **Server Signature**: Claims require a valid server signature, preventing unauthorized minting
2. **Nonce**: Each claim has a unique nonce, preventing replay attacks
3. **Expiration**: Claims expire after 24 hours if not submitted
4. **Merkle Root**: Proves all claimed proofs without revealing them on-chain
