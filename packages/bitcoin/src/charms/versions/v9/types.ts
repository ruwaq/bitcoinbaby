/**
 * Charms Spell V9 Types (CLI 0.11.1)
 *
 * Used for direct PoW validation without Merkle proofs.
 * The contract validates pow_challenge + pow_nonce produces valid hash.
 *
 * NOTE: This format does NOT have a version field in the YAML.
 * The CLI infers the version from the structure.
 */

// =============================================================================
// SPELL V9 FORMAT
// =============================================================================

/**
 * Charms Spell V9 format
 */
export interface SpellV9 {
  apps: Record<string, string>; // "$01" -> "t/<app_id>/<vk>"
  ins: SpellV9Input[];
  outs: SpellV9Output[];
  private_inputs?: Record<string, PoWPrivateInputs>;
}

export interface SpellV9Input {
  utxo_id: string; // "txid:vout"
  charms: Record<string, unknown>; // "$01" -> {} for mint or amount for transfer
}

export interface SpellV9Output {
  address: string;
  charms: Record<string, unknown>;
  sats: number;
}

/**
 * PoW private inputs for BABTC mining (V9)
 * These are passed to the contract for validation
 */
export interface PoWPrivateInputs {
  /** Challenge string format: "timestamp:address" */
  pow_challenge: string;
  /** Hex nonce that produces valid hash */
  pow_nonce: string;
  /** Required leading zero bits */
  pow_difficulty: number;
}

// =============================================================================
// SPELL CREATION PARAMS
// =============================================================================

/**
 * Parameters for creating a PoW mint spell (V9)
 */
export interface PoWMintSpellParams {
  /** App ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** UTXO to consume (can be any available UTXO) */
  inputUtxo: {
    txid: string;
    vout: number;
  };
  /** Recipient address for minted tokens */
  minerAddress: string;
  /** Dev fund address */
  devAddress: string;
  /** Staking pool address */
  stakingAddress: string;
  /** PoW challenge (format: "timestamp:address") */
  challenge: string;
  /** Nonce that produces valid hash (hex) */
  nonce: string;
  /** Difficulty (leading zero bits) */
  difficulty: number;
  /** Miner's share of the reward */
  minerReward: bigint;
  /** Dev fund share */
  devReward: bigint;
  /** Staking pool share */
  stakingReward: bigint;
}
