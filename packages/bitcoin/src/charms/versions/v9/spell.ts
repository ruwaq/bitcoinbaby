/**
 * Charms V9 Spell Creation
 *
 * Functions to create V9 format spells for PoW mining.
 */

import type { SpellV9, PoWMintSpellParams } from "./types";
import { createAppReference, MIN_SPELL_OUTPUT_SATS } from "../shared";

/**
 * Create a PoW mint spell for mining rewards (V9 format)
 *
 * This format is used with CLI 0.11.1 and directly validates PoW
 * without requiring Merkle proofs. The contract receives:
 * - pow_challenge: The challenge string
 * - pow_nonce: The nonce that produces valid hash
 * - pow_difficulty: Required leading zeros
 */
export function createPoWMintSpellV9(params: PoWMintSpellParams): SpellV9 {
  const appRef = createAppReference("t", params.appId, params.appVk);

  return {
    apps: {
      $01: appRef,
    },
    ins: [
      {
        utxo_id: `${params.inputUtxo.txid}:${params.inputUtxo.vout}`,
        charms: {}, // No input charms for mint
      },
    ],
    outs: [
      {
        address: params.minerAddress,
        charms: {
          $01: Number(params.minerReward),
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
      {
        address: params.devAddress,
        charms: {
          $01: Number(params.devReward),
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
      {
        address: params.stakingAddress,
        charms: {
          $01: Number(params.stakingReward),
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
    ],
    private_inputs: {
      $01: {
        pow_challenge: params.challenge,
        pow_nonce: params.nonce,
        pow_difficulty: params.difficulty,
      },
    },
  };
}
