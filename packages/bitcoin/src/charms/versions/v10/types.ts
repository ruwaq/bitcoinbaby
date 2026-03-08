/**
 * Charms Spell V10 Types (With Merkle Proofs)
 *
 * Used when mining TX needs to be proven via Merkle inclusion.
 * For direct PoW validation, use SpellV9 instead.
 *
 * Reference: https://docs.charms.dev/references/spell-json/
 */

// =============================================================================
// SPELL V10 FORMAT
// =============================================================================

/**
 * Charms Spell V10 format
 */
export interface SpellV10 {
  version: 10;
  apps: Record<string, string>; // "$00" -> "n/<app_id>/<vk>" or "t/<app_id>/<vk>"
  private_inputs?: Record<
    string,
    {
      tx?: string; // Mining transaction hex
      tx_block_proof?: string; // Merkle block proof hex
    }
  >;
  ins: SpellV10Input[];
  outs: SpellV10Output[];
}

export interface SpellV10Input {
  utxo_id: string; // "txid:vout"
  charms: Record<string, unknown>; // "$00" -> state object or amount (number)
}

export interface SpellV10Output {
  address: string;
  charms: Record<string, unknown>;
  sats?: number; // Optional, defaults to DUST_LIMIT (546)
}

/**
 * Mining private inputs for token minting (V10 - Merkle proof style)
 * Required to prove the mining transaction was included in a block
 */
export interface MiningPrivateInputs {
  /** Raw hex of the mining transaction */
  tx: string;
  /** Merkle block proof in hex format */
  tx_block_proof: string;
}

// =============================================================================
// SPELL CREATION PARAMS
// =============================================================================

/**
 * Parameters for creating a mining mint spell (V10)
 */
export interface MiningMintSpellParams {
  /** App ID (SHA256 of genesis UTXO) */
  appId: string;
  /** Verification key (SHA256 of WASM binary) */
  appVk: string;
  /** Mining transaction hex */
  miningTxHex: string;
  /** Merkle proof hex */
  merkleProofHex: string;
  /** UTXO from mining transaction to consume */
  miningUtxo: {
    txid: string;
    vout: number;
  };
  /** Recipient address for minted tokens */
  minerAddress: string;
  /** Amount of tokens to mint (in base units) */
  mintAmount: bigint;
}

/**
 * Parameters for creating a token transfer spell (V10)
 */
export interface TokenTransferSpellParams {
  appId: string;
  appVk: string;
  fromUtxo: { txid: string; vout: number };
  fromAmount: bigint;
  toAddress: string;
  toAmount: bigint;
  changeAddress: string;
}

/**
 * Parameters for batch transfer (V10)
 */
export interface BatchTransferParams {
  appId: string;
  appVk: string;
  sourceUtxos: Array<{ txid: string; vout: number; amount: bigint }>;
  recipients: Array<{ address: string; amount: bigint }>;
  changeAddress: string;
}
