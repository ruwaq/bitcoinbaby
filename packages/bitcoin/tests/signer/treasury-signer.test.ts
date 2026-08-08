/**
 * Treasury Signer Tests
 *
 * Validates that TreasurySigner.signSpell actually SIGNS the treasury input
 * of the commit and spell transactions returned by the Charms prover.
 *
 * Background: the prover returns UNSIGNED raw transaction hex for security
 * (see psbt-utils.ts header comment). The previous signSpell implementation
 * just forwarded the prover's hex directly to the mempool without signing,
 * which would broadcast invalid transactions. This test guards against that
 * regression.
 *
 * Strategy:
 *   - Use a real BitcoinWallet with the standard 'abandon...about' mnemonic
 *   - Build a real unsigned commitTx and spellTx that spend from the wallet's
 *     Taproot address (so the wallet can sign them)
 *   - Inject a mock prover that returns these unsigned TX hexes
 *   - Inject a mock BlockchainAPI that returns the prevTx hex for psbt-utils
 *   - Call signSpell and assert:
 *       1. The returned hex differs from the input (signature was added)
 *       2. The returned hex parses back as a valid bitcoin Transaction
 *       3. The witness stack on the treasury input is non-empty
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { TreasurySigner } from "../../src/signer/treasury-signer";
import { BitcoinWallet } from "../../src/wallet";
import type { BlockchainAPI } from "../../src/blockchain/types";

bitcoin.initEccLib(ecc);

// =============================================================================
// TEST CONSTANTS
// =============================================================================

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const SIGNER_CONFIG = {
  apiUrl: "http://mock-api.test",
  adminKey: "test-admin-key",
  mnemonic: TEST_MNEMONIC,
  network: "regtest" as const,
  appId: "test-app-id",
  appVk: "test-app-vk",
  pollInterval: 999_999, // never poll during tests
};

// =============================================================================
// HELPERS: build real unsigned TX hex that spends from a given Taproot address
// =============================================================================

interface UnsignedTxPair {
  commitTxHex: string;
  spellTxHex: string;
  fundingTxid: string;
  fundingVout: number;
  fundingValue: number;
  fundingPrevTxHex: string;
}

/**
 * Build a pair of (commit, spell) unsigned TXs that simulate what the Charms
 * prover returns. The commit TX spends a UTXO owned by the wallet's Taproot
 * address; the spell TX spends the commit TX's output.
 *
 * We construct real, parseable transactions so that rawTxToPsbt can convert
 * them to PSBTs and the wallet can sign the treasury input.
 */
async function buildUnsignedTxPair(
  wallet: BitcoinWallet,
): Promise<UnsignedTxPair> {
  const info = wallet.getInfo();
  if (!info) throw new Error("Wallet not initialized");

  // Treasury address (from wallet) — info.address is the Taproot treasury output target
  const compressed = Buffer.from(info.publicKey, "hex");
  const xOnlyInternal = compressed.subarray(1, 33);
  const network = bitcoin.networks.regtest;

  const p2tr = bitcoin.payments.p2tr({
    internalPubkey: xOnlyInternal,
    network,
  });
  if (!p2tr.output) throw new Error("Failed to build p2tr output");

  // === Funding TX (pretend this is the prev tx that funds the treasury UTXO) ===
  // We need a real transaction whose output 0 pays to the treasury address.
  const fundingTx = new bitcoin.Transaction();
  fundingTx.addOutput(p2tr.output, 100_000);
  // Add a fake input (will be invalid but the witness is what matters)
  fundingTx.addInput(Buffer.from("00".repeat(32), "hex"), 0, 0xffffffff);
  const fundingTxHex = fundingTx.toHex();
  const fundingTxid = fundingTx.getId();
  const fundingVout = 0;
  const fundingValue = 100_000;

  // === Commit TX (spends the funding TX's output to treasury) ===
  const commitTx = new bitcoin.Transaction();
  commitTx.addInput(
    Buffer.from(fundingTxid, "hex").reverse(),
    fundingVout,
    0xffffffff,
  );
  // Output: pay to treasury (will be spent by spell TX)
  commitTx.addOutput(p2tr.output, 99_000);
  const commitTxHex = commitTx.toHex();

  // === Spell TX (spends commit TX's output, the treasury needs to sign) ===
  const spellTx = new bitcoin.Transaction();
  spellTx.addInput(
    Buffer.from(commitTx.getId(), "hex").reverse(),
    0,
    0xffffffff,
  );
  spellTx.addOutput(p2tr.output, 98_000);
  const spellTxHex = spellTx.toHex();

  return {
    commitTxHex,
    spellTxHex,
    fundingTxid,
    fundingVout,
    fundingValue,
    fundingPrevTxHex: fundingTxHex,
  };
}

/**
 * Build a mock BlockchainAPI that returns prev tx hexes we control.
 * rawTxToPsbt calls mempoolClient.getTransactionHex(txid).
 */
function buildMockBlockchainAPI(prevTxs: Map<string, string>): BlockchainAPI {
  return {
    network: "regtest",
    getBalance: vi.fn(async () => ({
      address: "",
      confirmed: 0,
      unconfirmed: 0,
      total: 0,
    })),
    getUTXOs: vi.fn(async () => []),
    getTransaction: vi.fn(async () => ({}) as never),
    broadcastTransaction: vi.fn(async () => "a".repeat(64)),
    getFeeEstimates: vi.fn(async () => ({ hourFee: 2 }) as never),
    getBlockHeight: vi.fn(async () => 0),
    getBlock: vi.fn(async () => ({}) as never),
    getBlockTxids: vi.fn(async () => []),
    getTransactionHex: vi.fn(async (txid: string) => {
      const hex = prevTxs.get(txid);
      if (!hex) throw new Error(`mock: no prev tx for ${txid}`);
      return hex;
    }),
    waitForConfirmation: vi.fn(async () => ({}) as never),
    getAddressTransactions: vi.fn(async () => []),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("TreasurySigner.signSpell", () => {
  let wallet: BitcoinWallet;
  let unsignedPair: UnsignedTxPair;
  let mockProver: { prove: ReturnType<typeof vi.fn> };
  let mockBlockchain: BlockchainAPI;

  beforeEach(async () => {
    wallet = new BitcoinWallet({ network: "regtest" });
    await wallet.fromMnemonic(TEST_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });
    unsignedPair = await buildUnsignedTxPair(wallet);

    mockProver = {
      prove: vi.fn(async () => ({
        commitTx: unsignedPair.commitTxHex,
        spellTx: unsignedPair.spellTxHex,
      })),
    };

    // Map both prev txids (funding + commit) so rawTxToPsbt can resolve them
    const prevTxs = new Map<string, string>();
    prevTxs.set(unsignedPair.fundingTxid, unsignedPair.fundingPrevTxHex);
    // For the spell TX, its prev is the commit TX
    const commitTx = bitcoin.Transaction.fromHex(unsignedPair.commitTxHex);
    prevTxs.set(commitTx.getId(), unsignedPair.commitTxHex);

    mockBlockchain = buildMockBlockchainAPI(prevTxs);
  });

  it("returns SIGNED commit and spell TX hexes (not the unsigned input)", async () => {
    const signer = new TreasurySigner(SIGNER_CONFIG, {
      prover: mockProver,
      blockchain: mockBlockchain,
    });
    await signer.initialize();

    const result = await signer.signSpell(
      // Minimal valid spell shape (just enough to pass validate)
      {
        version: 11,
        apps: [],
        ins: [],
        outs: [],
      } as never,
      {
        txid: unsignedPair.fundingTxid,
        vout: unsignedPair.fundingVout,
        value: unsignedPair.fundingValue,
      },
    );

    expect(result).not.toBeNull();
    expect(result!.commitTxHex).not.toBe(unsignedPair.commitTxHex);
    expect(result!.spellTxHex).not.toBe(unsignedPair.spellTxHex);
  });

  it("produces transactions that parse back as valid bitcoin TX", async () => {
    const signer = new TreasurySigner(SIGNER_CONFIG, {
      prover: mockProver,
      blockchain: mockBlockchain,
    });
    await signer.initialize();

    const result = await signer.signSpell(
      {
        version: 11,
        apps: [],
        ins: [],
        outs: [],
      } as never,
      {
        txid: unsignedPair.fundingTxid,
        vout: unsignedPair.fundingVout,
        value: unsignedPair.fundingValue,
      },
    );

    expect(result).not.toBeNull();
    // If the witness were malformed, fromHex would throw
    const signedCommit = bitcoin.Transaction.fromHex(result!.commitTxHex);
    const signedSpell = bitcoin.Transaction.fromHex(result!.spellTxHex);

    expect(signedCommit.ins.length).toBeGreaterThan(0);
    expect(signedSpell.ins.length).toBeGreaterThan(0);
  });

  it("adds a non-empty witness to the treasury input on the commit TX", async () => {
    const signer = new TreasurySigner(SIGNER_CONFIG, {
      prover: mockProver,
      blockchain: mockBlockchain,
    });
    await signer.initialize();

    const result = await signer.signSpell(
      {
        version: 11,
        apps: [],
        ins: [],
        outs: [],
      } as never,
      {
        txid: unsignedPair.fundingTxid,
        vout: unsignedPair.fundingVout,
        value: unsignedPair.fundingValue,
      },
    );

    expect(result).not.toBeNull();
    const signedCommit = bitcoin.Transaction.fromHex(result!.commitTxHex);
    // The treasury input is input 0; it MUST have a witness after signing
    expect(signedCommit.ins[0].witness.length).toBeGreaterThan(0);
  });

  it("returns null with a log message if prover throws", async () => {
    const failingProver = {
      prove: vi.fn(async () => {
        throw new Error("prover down");
      }),
    };
    const signer = new TreasurySigner(SIGNER_CONFIG, {
      prover: failingProver,
      blockchain: mockBlockchain,
    });
    await signer.initialize();

    const result = await signer.signSpell(
      {
        version: 11,
        apps: [],
        ins: [],
        outs: [],
      } as never,
      {
        txid: unsignedPair.fundingTxid,
        vout: unsignedPair.fundingVout,
        value: unsignedPair.fundingValue,
      },
    );

    expect(result).toBeNull();
  });

  it("accepts prover and blockchain via dependency injection (no global.fetch mock needed)", async () => {
    // This test exists to lock in the DI design: callers MUST be able to
    // inject a prover mock without polluting global.fetch. The previous
    // implementation instantiated CharmsProverClient internally, making
    // tests brittle and forcing global.fetch mocking.
    const signer = new TreasurySigner(SIGNER_CONFIG, {
      prover: mockProver,
      blockchain: mockBlockchain,
    });
    expect(signer).toBeInstanceOf(TreasurySigner);
    await signer.initialize();
    // If DI works, we can read the injected prover back via a public method
    // (we don't expose internals; we just exercise signSpell to confirm)
    const result = await signer.signSpell(
      {
        version: 11,
        apps: [],
        ins: [],
        outs: [],
      } as never,
      {
        txid: unsignedPair.fundingTxid,
        vout: unsignedPair.fundingVout,
        value: unsignedPair.fundingValue,
      },
    );
    expect(mockProver.prove).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});
