/**
 * Charms Spell V11 Types (CLI v11.0.1, Current)
 *
 * Major changes from V9/V10:
 * - version: 11 required
 * - tx field contains ins/outs/refs/coins
 * - app_public_inputs replaces apps
 * - private_inputs passed separately via CLI/API
 *
 * Reference: https://docs.charms.dev/references/spell-json/
 */

// =============================================================================
// SPELL V11 FORMAT
// =============================================================================

/**
 * Charms Spell V11 format
 */
export interface SpellV11 {
  version: 11;
  tx: SpellV11Transaction;
  app_public_inputs: Record<string, unknown | null>;
  mock?: boolean;
}

export interface SpellV11Transaction {
  /** Input UTXOs in "txid:vout" format */
  ins: string[];
  /** Reference UTXOs (optional) */
  refs?: string[];
  /** Output charms mapped by app index */
  outs: SpellV11Output[];
  /** Beaming destinations (optional) */
  beamed_outs?: Record<string, string>;
  /** Native coin outputs (optional) */
  coins?: SpellV11CoinOutput[];
}

/**
 * V11 output format
 * Keys are app indexes ("0", "1", etc.) from app_public_inputs
 * Values are amounts (number) for tokens or state objects for NFTs
 */
export type SpellV11Output = Record<string, number | Record<string, unknown>>;

export interface SpellV11CoinOutput {
  /** Amount in satoshis */
  amt: number;
  /** Destination hash */
  dest_hash: string;
}

// =============================================================================
// PRIVATE INPUTS (V11)
// =============================================================================

/**
 * V11 PoW private inputs (passed separately from spell)
 * Used with Charms CLI: --private-inputs=./private-inputs.yaml
 * Or via Prover API: app_private_inputs field
 */
export interface PoWPrivateInputsV11 {
  /** Challenge string: "timestamp:address" */
  pow_challenge: string;
  /** Hex nonce that produces valid hash */
  pow_nonce: string;
  /** Required leading zero bits */
  pow_difficulty: number;
}

/**
 * V11 Prover request format
 * Private inputs are passed separately from the spell
 */
export interface ProverRequestV11 {
  spell: SpellV11;
  app_private_inputs?: Record<string, PoWPrivateInputsV11>;
  funding_utxo?: string; // "txid:vout"
  funding_utxo_value?: number; // In satoshis
  prev_txs?: string[]; // Previous transaction hexes
  change_address?: string;
}

// =============================================================================
// SPELL CREATION PARAMS (V11)
// =============================================================================

/**
 * Parameters for creating a PoW mint spell (V11)
 */
export interface PoWMintSpellParamsV11 {
  /** App index in app_public_inputs (e.g., "0") */
  appIndex: string;
  /** Input UTXOs in "txid:vout" format */
  inputUtxos: string[];
  /** Output destinations with amounts */
  outputs: Array<{
    appIndex: string;
    amount: number;
  }>;
  /** Optional coin outputs */
  coinOutputs?: SpellV11CoinOutput[];
  /** App public inputs configuration */
  appPublicInputs: Record<string, unknown | null>;
}

/**
 * Parameters for NFT mint (V11)
 */
export interface NFTMintSpellParamsV11 {
  /** App index for NFT */
  appIndex: string;
  /** Input UTXOs */
  inputUtxos: string[];
  /** NFT state to mint */
  nftState: Record<string, unknown>;
  /** Optional reference UTXOs */
  refs?: string[];
  /** App public inputs */
  appPublicInputs: Record<string, unknown | null>;
}
