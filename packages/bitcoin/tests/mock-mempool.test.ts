import { describe, it, expect } from "vitest";
import { MockMempoolClient } from "../src/blockchain/mock-mempool";
import * as bitcoin from "bitcoinjs-lib";

describe("MockMempoolClient", () => {
  it("should initialize address balance automatically (faucet)", async () => {
    const client = new MockMempoolClient("testnet4");
    const address = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"; // Valid testnet/regtest address format
    
    const balance = await client.getBalance(address);
    expect(balance.confirmed).toBe(50000000); // 0.5 BTC in total (0.2 + 0.3)
    expect(balance.utxoCount).toBe(2);
    
    const utxos = await client.getUTXOs(address);
    expect(utxos.length).toBe(2);
    expect(utxos[0].value).toBe(20000000);
    expect(utxos[1].value).toBe(30000000);
  });

  it("should implement block, height, and confirmation methods", async () => {
    const client = new MockMempoolClient("testnet4");
    const height = await client.getBlockHeight();
    expect(height).toBe(800010);

    const block = await client.getBlock("dummy_block_hash");
    expect(block.height).toBe(800010);
    expect(block.merkle_root).toBe("0000000000000000000000000000000000000000000000000000000000000000");

    const blockTxids = await client.getBlockTxids("dummy_block_hash");
    expect(blockTxids.length).toBeGreaterThan(0);
  });

  it("should broadcast a simulated transaction and update UTXOs", async () => {
    const client = new MockMempoolClient("testnet4");
    const aliceAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
    const bobAddress = "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7"; // Another testnet address

    // Ensure Alice has funds (via auto-faucet)
    const aliceUtxos = await client.getUTXOs(aliceAddress);
    expect(aliceUtxos.length).toBe(2);

    // Create simple transaction from Alice to Bob using bitcoinjs-lib
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    
    // Input: consumes Alice's first UTXO (20M sats)
    const inputTxid = aliceUtxos[0].txid;
    const inputVout = aliceUtxos[0].vout;
    const inputHash = Buffer.from(inputTxid, "hex").reverse();
    tx.addInput(inputHash, inputVout);

    // Outputs: send 15,000,000 sats to Bob, and change back to Alice (4,999,750 sats, with 250 static fee)
    const aliceScript = bitcoin.address.toOutputScript(aliceAddress, bitcoin.networks.testnet);
    const bobScript = bitcoin.address.toOutputScript(bobAddress, bitcoin.networks.testnet);

    tx.addOutput(bobScript, 15000000); // 15M to Bob
    tx.addOutput(aliceScript, 4999750); // Change back to Alice (minus 250 fee)

    const txHex = tx.toHex();
    const txid = await client.broadcastTransaction(txHex);
    expect(txid).toBe(tx.getId());

    // Verify consumed UTXO is removed from Alice, and change is added
    const newAliceUtxos = await client.getUTXOs(aliceAddress);
    // Alice should have the second original UTXO (30M) plus the change output (4,999,750)
    expect(newAliceUtxos.length).toBe(2);
    expect(newAliceUtxos.some(u => u.value === 30000000)).toBe(true);
    expect(newAliceUtxos.some(u => u.value === 4999750)).toBe(true);

    // Verify Bob received his UTXO
    const bobUtxos = await client.getUTXOs(bobAddress);
    expect(bobUtxos.length).toBe(1);
    expect(bobUtxos[0].value).toBe(15000000);
    expect(bobUtxos[0].txid).toBe(txid);

    // Verify getTransaction
    const txInfo = await client.getTransaction(txid);
    expect(txInfo.txid).toBe(txid);
    expect(txInfo.status.confirmed).toBe(true);

    // Verify getTransactionHex
    const hex = await client.getTransactionHex(txid);
    expect(hex).toBe(txHex);

    // Verify getAddressTransactions
    const aliceHistory = await client.getAddressTransactions(aliceAddress);
    expect(aliceHistory.length).toBe(1);
    expect(aliceHistory[0].txid).toBe(txid);
  });
});
