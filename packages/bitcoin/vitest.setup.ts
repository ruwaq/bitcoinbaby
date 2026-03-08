/**
 * Vitest Setup for Bitcoin Package
 *
 * Initializes ECC library before tests run.
 * Required for bitcoinjs-lib address validation of taproot addresses.
 */

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc);
