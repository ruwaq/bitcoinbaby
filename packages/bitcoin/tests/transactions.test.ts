/**
 * Transaction Tests
 *
 * Tests for the BitcoinBaby transaction building system:
 * - Transaction building
 * - Fee estimation
 * - Coin selection
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TransactionBuilder,
  createTransactionBuilder,
  estimateFee,
} from "../src/transactions/builder";
import type { TxUTXO } from "../src/transactions/types";
import type { SpellConfig } from "../src/scrolls/types";

// ============================================
// Test Helpers
// ============================================

/**
 * Create a mock UTXO for testing
 * Includes P2TR scriptPubKey for proper fee calculation
 */
function createMockUTXO(
  value: number,
  txid?: string,
  vout: number = 0,
): TxUTXO {
  // P2TR scriptPubKey format: 5120 + 32-byte x-only pubkey
  const fakePubKey = "0".repeat(64);
  return {
    txid: txid || "a".repeat(64),
    vout,
    value,
    scriptPubKey: `5120${fakePubKey}`, // P2TR format for proper fee estimation
  };
}

/**
 * Create multiple mock UTXOs
 */
function createMockUTXOs(values: number[]): TxUTXO[] {
  return values.map((value, index) =>
    createMockUTXO(
      value,
      `${"a".repeat(62)}${index.toString().padStart(2, "0")}`,
      0,
    ),
  );
}

/**
 * Create a mock spell config
 * Note: Using number instead of BigInt for JSON serialization compatibility
 */
function createMockSpell(): SpellConfig {
  return {
    version: 1,
    app: "baby",
    outputs: [
      {
        type: "mint",
        token: "BABY",
        amount: 1000,
        address: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
      },
    ],
    metadata: {
      miner: "tb1qtest",
      timestamp: Date.now(),
    },
  };
}

// ============================================
// Transaction Builder Creation Tests
// ============================================

describe("createTransactionBuilder", () => {
  it("should create builder with testnet network", () => {
    const builder = createTransactionBuilder({ network: "testnet" });
    expect(builder).toBeInstanceOf(TransactionBuilder);
  });

  it("should create builder with mainnet network", () => {
    const builder = createTransactionBuilder({ network: "mainnet" });
    expect(builder).toBeInstanceOf(TransactionBuilder);
  });

  it("should accept custom fee rate", () => {
    const builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 25,
    });
    expect(builder).toBeInstanceOf(TransactionBuilder);
  });

  it("should accept custom dust threshold", () => {
    const builder = createTransactionBuilder({
      network: "testnet",
      dustThreshold: 1000,
    });
    expect(builder).toBeInstanceOf(TransactionBuilder);
  });

  it("should accept RBF option", () => {
    const builder = createTransactionBuilder({
      network: "testnet",
      enableRBF: false,
    });
    expect(builder).toBeInstanceOf(TransactionBuilder);
  });
});

// ============================================
// Coin Selection Tests
// ============================================

describe("TransactionBuilder - Coin Selection", () => {
  let builder: TransactionBuilder;

  beforeEach(() => {
    builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
    });
  });

  it("should select single UTXO for small amount", () => {
    const utxos = createMockUTXOs([10_000, 20_000, 50_000]);
    const result = builder.selectCoins(utxos, 5_000);

    expect(result.inputs.length).toBe(1);
    expect(result.totalInputValue).toBeGreaterThanOrEqual(5_000 + result.fee);
  });

  it("should select multiple UTXOs for larger amount", () => {
    const utxos = createMockUTXOs([5_000, 6_000, 7_000]);
    const result = builder.selectCoins(utxos, 10_000);

    expect(result.inputs.length).toBeGreaterThan(1);
    expect(result.totalInputValue).toBeGreaterThanOrEqual(10_000 + result.fee);
  });

  it("should prefer larger UTXOs first", () => {
    const utxos = createMockUTXOs([1_000, 50_000, 5_000]);
    const result = builder.selectCoins(utxos, 40_000);

    // Should select the 50_000 UTXO first
    expect(result.inputs[0].value).toBe(50_000);
  });

  it("should throw when insufficient funds", () => {
    const utxos = createMockUTXOs([1_000, 2_000]);

    expect(() => builder.selectCoins(utxos, 100_000)).toThrow(
      "Insufficient funds",
    );
  });

  it("should calculate correct change", () => {
    const utxos = createMockUTXOs([100_000]);
    const result = builder.selectCoins(utxos, 50_000);

    // Change = totalInput - target - fee
    expect(result.change).toBe(result.totalInputValue - 50_000 - result.fee);
  });

  it("should return zero change when below dust threshold", () => {
    // Use larger UTXO where change would naturally be below dust
    const utxos = createMockUTXOs([12_000]);
    // Target amount that leaves change below dust (12000 - 10300 - ~1200 fee = ~500, below 546 dust)
    const result = builder.selectCoins(utxos, 10_300);

    // Change below 546 should be added to fee
    expect(result.change).toBe(0);
    expect(result.fee).toBeGreaterThan(0);
  });

  it("should handle empty UTXO array", () => {
    const utxos: TxUTXO[] = [];

    expect(() => builder.selectCoins(utxos, 1_000)).toThrow(
      "Insufficient funds",
    );
  });

  it("should account for extra outputs in fee calculation", () => {
    const utxos = createMockUTXOs([50_000]);
    const resultWithExtra = builder.selectCoins(utxos, 10_000, 2);
    const resultWithoutExtra = builder.selectCoins(utxos, 10_000, 0);

    // More outputs = higher fee
    expect(resultWithExtra.fee).toBeGreaterThan(resultWithoutExtra.fee);
  });
});

// ============================================
// Transfer Transaction Tests
// ============================================

describe("TransactionBuilder - buildTransfer", () => {
  let builder: TransactionBuilder;
  const testnetAddress =
    "tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";
  const changeAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

  beforeEach(() => {
    builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
    });
  });

  it("should build transfer with single input", () => {
    const inputs = createMockUTXOs([100_000]);
    const result = builder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    expect(result.inputs.length).toBe(1);
    expect(result.outputs.length).toBe(2); // recipient + change
    expect(result.fee).toBeGreaterThan(0);
  });

  it("should set correct recipient output", () => {
    const inputs = createMockUTXOs([100_000]);
    const result = builder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    const recipientOutput = result.outputs.find(
      (o) => o.address === testnetAddress,
    );
    expect(recipientOutput).toBeDefined();
    expect(recipientOutput?.value).toBe(50_000);
  });

  it("should set correct change output", () => {
    const inputs = createMockUTXOs([100_000]);
    const result = builder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    const changeOutput = result.outputs.find(
      (o) => o.address === changeAddress,
    );
    expect(changeOutput).toBeDefined();
    expect(changeOutput?.value).toBeGreaterThan(0);
  });

  it("should omit change output when below dust", () => {
    // Use larger input to ensure we have enough for fee, but change is below dust
    // Fee for 1 input, 2 outputs at 10 sat/vB is ~1540 sats
    // 52_000 - 50_000 - 1540 = 460 sats, which is below 546 dust
    const inputs = createMockUTXOs([52_000]);
    const result = builder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    // Change would be ~460 sats after fee, which is below dust (546)
    expect(result.outputs.length).toBe(1);
    expect(result.outputs[0].address).toBe(testnetAddress);
  });

  it("should throw when inputs insufficient for amount + fee", () => {
    const inputs = createMockUTXOs([50_000]);

    expect(() =>
      builder.buildTransfer(inputs, testnetAddress, 50_000, changeAddress),
    ).toThrow("Insufficient funds");
  });

  it("should set correct network", () => {
    const inputs = createMockUTXOs([100_000]);
    const result = builder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    expect(result.network).toBe("testnet");
  });

  it("should include RBF sequence when enabled", () => {
    const enabledBuilder = createTransactionBuilder({
      network: "testnet",
      enableRBF: true,
    });
    const inputs = createMockUTXOs([100_000]);
    const result = enabledBuilder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    // RBF sequence is 0xfffffffd
    expect(result.inputs[0].sequence).toBe(0xfffffffd);
  });

  it("should use final sequence when RBF disabled", () => {
    const disabledBuilder = createTransactionBuilder({
      network: "testnet",
      enableRBF: false,
    });
    const inputs = createMockUTXOs([100_000]);
    const result = disabledBuilder.buildTransfer(
      inputs,
      testnetAddress,
      50_000,
      changeAddress,
    );

    // Final sequence is 0xffffffff
    expect(result.inputs[0].sequence).toBe(0xffffffff);
  });
});

// ============================================
// Fee Estimation Tests
// ============================================

describe("estimateFee", () => {
  it("should calculate fee for simple transaction", () => {
    const result = estimateFee(1, 2, 10);

    // 1 input (~57.5 vb) + 2 outputs (~86 vb) + base (~10.5 vb) = ~154 vb
    // At 10 sat/vB = ~1540 sats
    expect(result.totalFee).toBeGreaterThan(0);
    expect(result.satPerVB).toBe(10);
  });

  it("should increase fee with more inputs", () => {
    const oneInput = estimateFee(1, 2, 10);
    const threeInputs = estimateFee(3, 2, 10);

    expect(threeInputs.totalFee).toBeGreaterThan(oneInput.totalFee);
  });

  it("should increase fee with more outputs", () => {
    const twoOutputs = estimateFee(1, 2, 10);
    const fiveOutputs = estimateFee(1, 5, 10);

    expect(fiveOutputs.totalFee).toBeGreaterThan(twoOutputs.totalFee);
  });

  it("should scale linearly with fee rate", () => {
    const lowFee = estimateFee(1, 2, 10);
    const highFee = estimateFee(1, 2, 20);

    // Double fee rate should approximately double the fee
    expect(highFee.totalFee).toBeCloseTo(lowFee.totalFee * 2, -1);
  });

  it("should include spell size in calculation", () => {
    const withoutSpell = estimateFee(1, 2, 10, 0);
    const withSpell = estimateFee(1, 2, 10, 200);

    expect(withSpell.totalFee).toBeGreaterThan(withoutSpell.totalFee);
    expect(withSpell.vsize).toBeGreaterThan(withoutSpell.vsize);
  });

  it("should apply witness discount to spell size", () => {
    // Spell size is divided by 4 for witness discount
    const spellSize = 400;
    const result = estimateFee(1, 2, 10, spellSize);

    // Spell adds 100 vbytes (400 / 4)
    const baseResult = estimateFee(1, 2, 10, 0);
    expect(result.vsize - baseResult.vsize).toBe(100);
  });

  it("should return correct vsize", () => {
    const result = estimateFee(2, 3, 10);

    // vsize = ceil(10.5 + 2*57.5 + 3*43) = ceil(254.5) = 255
    expect(result.vsize).toBe(255);
  });

  it("should handle zero inputs and outputs", () => {
    const result = estimateFee(0, 0, 10);

    // Just base size
    expect(result.vsize).toBe(11); // ceil(10.5)
  });
});

// ============================================
// Fee Rate Management Tests
// ============================================

describe("TransactionBuilder - setFeeRate", () => {
  it("should update fee rate for subsequent transactions", () => {
    const builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
    });

    const utxos = createMockUTXOs([100_000]);
    const result1 = builder.selectCoins(utxos, 50_000);

    builder.setFeeRate(20);
    const result2 = builder.selectCoins(utxos, 50_000);

    // Higher fee rate should result in higher fee
    expect(result2.fee).toBeGreaterThan(result1.fee);
  });
});

// ============================================
// UTXO Conversion Tests
// ============================================

describe("TransactionBuilder.convertUTXOs", () => {
  // Use native segwit address (tb1q...) which is more universally supported
  const testSegwitAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

  it("should convert mempool UTXOs to TxUTXOs", () => {
    const mempoolUTXOs = [
      { txid: "a".repeat(64), vout: 0, value: 10_000 },
      { txid: "b".repeat(64), vout: 1, value: 20_000 },
    ];

    const result = TransactionBuilder.convertUTXOs(
      mempoolUTXOs,
      testSegwitAddress,
      "testnet",
    );

    expect(result.length).toBe(2);
    expect(result[0].txid).toBe("a".repeat(64));
    expect(result[0].vout).toBe(0);
    expect(result[0].value).toBe(10_000);
    expect(result[0].witnessUtxo).toBeDefined();
  });

  it("should set correct script for address", () => {
    const mempoolUTXOs = [{ txid: "a".repeat(64), vout: 0, value: 10_000 }];

    const result = TransactionBuilder.convertUTXOs(
      mempoolUTXOs,
      testSegwitAddress,
      "testnet",
    );

    expect(result[0].witnessUtxo?.script).toBeInstanceOf(Uint8Array);
    expect(result[0].witnessUtxo?.script.length).toBeGreaterThan(0);
  });

  it("should preserve value in witnessUtxo", () => {
    const mempoolUTXOs = [{ txid: "a".repeat(64), vout: 0, value: 12345 }];

    const result = TransactionBuilder.convertUTXOs(
      mempoolUTXOs,
      testSegwitAddress,
      "testnet",
    );

    expect(result[0].witnessUtxo?.value).toBe(12345);
  });
});

// ============================================
// Mining Transaction Tests
// ============================================

describe("TransactionBuilder - buildMiningTx", () => {
  let builder: TransactionBuilder;
  // Use native segwit addresses for compatibility
  const minerAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
  const charmsFeeAddress =
    "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7";

  beforeEach(() => {
    builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
    });
  });

  it("should build mining transaction with spell", () => {
    const inputs = createMockUTXOs([100_000]);
    const spell = createMockSpell();

    const result = builder.buildMiningTx(
      inputs,
      minerAddress,
      spell,
      charmsFeeAddress,
      1000, // Charms fee
    );

    expect(result.spell).toBe(spell);
    expect(result.spellWitness).toBeDefined();
    expect(result.spellWitness.length).toBeGreaterThan(0);
  });

  it("should include Charms fee output", () => {
    const inputs = createMockUTXOs([100_000]);
    const spell = createMockSpell();

    const result = builder.buildMiningTx(
      inputs,
      minerAddress,
      spell,
      charmsFeeAddress,
      1000,
    );

    const feeOutput = result.outputs.find(
      (o) => o.address === charmsFeeAddress,
    );
    expect(feeOutput).toBeDefined();
    expect(feeOutput?.value).toBe(1000);
  });

  it("should include miner change output", () => {
    const inputs = createMockUTXOs([100_000]);
    const spell = createMockSpell();

    const result = builder.buildMiningTx(
      inputs,
      minerAddress,
      spell,
      charmsFeeAddress,
      1000,
    );

    const minerOutput = result.outputs.find((o) => o.address === minerAddress);
    expect(minerOutput).toBeDefined();
    expect(minerOutput?.value).toBeGreaterThan(0);
  });

  it("should throw when insufficient for Charms fee", () => {
    const inputs = createMockUTXOs([500]);
    const spell = createMockSpell();

    expect(() =>
      builder.buildMiningTx(
        inputs,
        minerAddress,
        spell,
        charmsFeeAddress,
        1000,
      ),
    ).toThrow("Insufficient funds");
  });

  it("should set changeAddress to miner", () => {
    const inputs = createMockUTXOs([100_000]);
    const spell = createMockSpell();

    const result = builder.buildMiningTx(
      inputs,
      minerAddress,
      spell,
      charmsFeeAddress,
      1000,
    );

    expect(result.changeAddress).toBe(minerAddress);
  });
});

// ============================================
// PSBT Building Tests
// ============================================

describe("TransactionBuilder - buildPSBT", () => {
  let builder: TransactionBuilder;
  // Use native segwit address for compatibility
  const testAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

  beforeEach(() => {
    builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
    });
  });

  it("should build PSBT from unsigned transaction", () => {
    const inputs = createMockUTXOs([100_000]);
    const tx = builder.buildTransfer(inputs, testAddress, 50_000, testAddress);

    const psbt = builder.buildPSBT(tx);

    expect(psbt).toBeDefined();
    expect(psbt.data.inputs.length).toBe(1);
    expect(psbt.data.outputs.length).toBe(2);
  });

  it("should add OP_RETURN for small spell witness", () => {
    const inputs = createMockUTXOs([100_000]);
    const tx = builder.buildTransfer(inputs, testAddress, 50_000, testAddress);

    // Small witness that fits in OP_RETURN (< 80 bytes)
    const smallWitness = new Uint8Array(40);
    const psbt = builder.buildPSBT(tx, smallWitness);

    // Should have recipient + change + OP_RETURN
    expect(psbt.data.outputs.length).toBe(3);
  });

  it("should not add OP_RETURN for large spell witness", () => {
    const inputs = createMockUTXOs([100_000]);
    const tx = builder.buildTransfer(inputs, testAddress, 50_000, testAddress);

    // Large witness that doesn't fit in OP_RETURN
    const largeWitness = new Uint8Array(100);
    const psbt = builder.buildPSBT(tx, largeWitness);

    // Should only have recipient + change
    expect(psbt.data.outputs.length).toBe(2);
  });

  it("should set RBF sequence in unsigned transaction", () => {
    const inputs = createMockUTXOs([100_000]);
    const tx = builder.buildTransfer(inputs, testAddress, 50_000, testAddress);

    // The sequence is set in the UnsignedTx, not in PSBT data
    // RBF sequence is 0xfffffffd
    expect(tx.inputs[0].sequence).toBe(0xfffffffd);
  });
});

// ============================================
// Edge Cases
// ============================================

describe("TransactionBuilder - Edge Cases", () => {
  let builder: TransactionBuilder;

  beforeEach(() => {
    builder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
    });
  });

  it("should handle exact amount with no change", () => {
    // Create UTXO that exactly covers target + fee
    const inputs = createMockUTXOs([51_540]); // ~50000 + ~1540 fee
    const testAddress =
      "tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";

    const result = builder.buildTransfer(
      inputs,
      testAddress,
      50_000,
      testAddress,
    );

    // Change should be below dust or zero
    const changeOutput = result.outputs.filter((o) => o.value !== 50_000);
    expect(changeOutput.length).toBe(0);
  });

  it("should handle very high fee rates", () => {
    const highFeeBuilder = createTransactionBuilder({
      network: "testnet",
      feeRate: 1000, // Very high
    });

    const utxos = createMockUTXOs([1_000_000]);
    const result = highFeeBuilder.selectCoins(utxos, 10_000);

    expect(result.fee).toBeGreaterThan(100_000);
  });

  it("should handle very low fee rates", () => {
    const lowFeeBuilder = createTransactionBuilder({
      network: "testnet",
      feeRate: 1, // Minimum viable
    });

    const utxos = createMockUTXOs([10_000]);
    const result = lowFeeBuilder.selectCoins(utxos, 5_000);

    expect(result.fee).toBeLessThan(500);
  });

  it("should handle custom dust threshold", () => {
    const customBuilder = createTransactionBuilder({
      network: "testnet",
      feeRate: 10,
      dustThreshold: 1000, // Higher than default 546
    });

    const utxos = createMockUTXOs([52_000]);
    const testAddress =
      "tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";

    const result = customBuilder.buildTransfer(
      utxos,
      testAddress,
      50_000,
      testAddress,
    );

    // Change of ~500 sats should be below 1000 dust threshold
    // So it should be folded into fee
    expect(result.outputs.length).toBe(1);
  });

  it("should handle many small UTXOs", () => {
    // Many small UTXOs
    const smallUTXOs = Array(20)
      .fill(null)
      .map((_, i) =>
        createMockUTXO(
          5_000,
          `${"a".repeat(62)}${i.toString().padStart(2, "0")}`,
        ),
      );

    const result = builder.selectCoins(smallUTXOs, 50_000);

    // Should need many inputs
    expect(result.inputs.length).toBeGreaterThan(10);
    // Fee should account for all inputs
    expect(result.fee).toBeGreaterThan(5000);
  });

  it("should handle regtest network", () => {
    const regtestBuilder = createTransactionBuilder({
      network: "regtest",
      feeRate: 1,
    });

    const utxos = createMockUTXOs([100_000]);
    const result = regtestBuilder.selectCoins(utxos, 50_000);

    expect(result.totalInputValue).toBe(100_000);
  });
});
