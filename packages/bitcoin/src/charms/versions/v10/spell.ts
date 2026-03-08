/**
 * Charms V10 Spell Creation
 *
 * Functions to create V10 format spells with Merkle proof validation.
 */

import type {
  SpellV10,
  SpellV10Output,
  MiningMintSpellParams,
  TokenTransferSpellParams,
  BatchTransferParams,
} from "./types";
import {
  createAppReference,
  DUST_LIMIT,
  MIN_SPELL_OUTPUT_SATS,
} from "../shared";

/**
 * Create a token mint spell for mining rewards (V10 format)
 */
export function createMiningMintSpellV10(
  params: MiningMintSpellParams,
): SpellV10 {
  const appRef = createAppReference("t", params.appId, params.appVk);

  return {
    version: 10,
    apps: {
      $01: appRef,
    },
    private_inputs: {
      $01: {
        tx: params.miningTxHex,
        tx_block_proof: params.merkleProofHex,
      },
    },
    ins: [
      {
        utxo_id: `${params.miningUtxo.txid}:${params.miningUtxo.vout}`,
        charms: {}, // No input charms for mint
      },
    ],
    outs: [
      {
        address: params.minerAddress,
        charms: {
          $01: Number(params.mintAmount), // Token amount as number
        },
        sats: MIN_SPELL_OUTPUT_SATS,
      },
    ],
  };
}

/**
 * Create a token transfer spell (V10 format)
 */
export function createTokenTransferSpellV10(
  params: TokenTransferSpellParams,
): SpellV10 {
  const appRef = createAppReference("t", params.appId, params.appVk);
  const changeAmount = params.fromAmount - params.toAmount;

  const outs: SpellV10Output[] = [
    {
      address: params.toAddress,
      charms: {
        $01: Number(params.toAmount),
      },
      sats: DUST_LIMIT,
    },
  ];

  if (changeAmount > 0n) {
    outs.push({
      address: params.changeAddress,
      charms: {
        $01: Number(changeAmount),
      },
      sats: DUST_LIMIT,
    });
  }

  return {
    version: 10,
    apps: {
      $01: appRef,
    },
    ins: [
      {
        utxo_id: `${params.fromUtxo.txid}:${params.fromUtxo.vout}`,
        charms: {
          $01: Number(params.fromAmount),
        },
      },
    ],
    outs,
  };
}

/**
 * Create a batch transfer spell (V10 format)
 * Combines multiple source UTXOs to send to multiple recipients
 */
export function createBatchTransferSpellV10(
  params: BatchTransferParams,
): SpellV10 {
  const appRef = createAppReference("t", params.appId, params.appVk);

  const totalInput = params.sourceUtxos.reduce((sum, u) => sum + u.amount, 0n);
  const totalOutput = params.recipients.reduce((sum, r) => sum + r.amount, 0n);
  const changeAmount = totalInput - totalOutput;

  const ins = params.sourceUtxos.map((utxo) => ({
    utxo_id: `${utxo.txid}:${utxo.vout}`,
    charms: {
      $01: Number(utxo.amount),
    },
  }));

  const outs: SpellV10Output[] = params.recipients.map((recipient) => ({
    address: recipient.address,
    charms: {
      $01: Number(recipient.amount),
    },
    sats: DUST_LIMIT,
  }));

  if (changeAmount > 0n) {
    outs.push({
      address: params.changeAddress,
      charms: {
        $01: Number(changeAmount),
      },
      sats: DUST_LIMIT,
    });
  }

  return {
    version: 10,
    apps: {
      $01: appRef,
    },
    ins,
    outs,
  };
}
