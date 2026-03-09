//! Genesis Babies NFT Contract (Ultra-Minimal Debug)
//!
//! Testing basic prover functionality - just accepts everything.

use charms_sdk::data::{check, App, Data, Transaction, NFT};

/// Main contract entry point - accepts all NFT operations
pub fn app_contract(app: &App, _tx: &Transaction, x: &Data, _w: &Data) -> bool {
    // Only verify: this is an NFT and public input is empty
    check!(app.tag == NFT);
    check!(x.is_empty());
    true
}
