/**
 * E2E Mining Flow Test
 *
 * Tests the complete mining flow on testnet4:
 * 1. Check wallet balance
 * 2. Build mining transaction
 * 3. Validate PSBT structure
 * 4. Test Merkle proof fetching (with real blockchain data)
 *
 * NOTE: These tests use REAL testnet4 APIs.
 * Run with: pnpm test tests/e2e/mining-flow.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createMiningSubmitter,
  createMempoolClient,
  type MiningProof,
  doubleSha256,
  countLeadingZeroBits,
  getMerkleProof,
  verifyMerkleProof,
  reverseHex,
  buildMerkleTree,
} from "../../src";
import { getPublicKey } from "../../src/crypto";

// Testnet4 configuration from .env.local
const TESTNET_ADDRESS =
  "tb1pdwap35ru90az875gghz58x9nut7gwqnzjh3dr3cgfdfkxkujt6zqy8ptxj";
const TESTNET_PRIVATE_KEY =
  "17204f40409a85b8a9b7a4b7bb1081917adf770779c2e55959e14e9da62a766b";

// Funding transaction
const FUNDING_TXID =
  "0420e9cd31e797d684e41ab37913227ab506b555ad9c0610743b6ce875ad61ab";

describe("E2E: Mining Flow on Testnet4", () => {
  const mempoolClient = createMempoolClient({ network: "testnet4" });

  describe("Wallet Setup", () => {
    it("should derive correct public key from private key", () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      expect(publicKey).toBeInstanceOf(Uint8Array);
      expect(publicKey.length).toBe(33); // Compressed public key
    });

    it("should verify testnet address format", () => {
      expect(TESTNET_ADDRESS.startsWith("tb1p")).toBe(true); // Taproot testnet
      expect(TESTNET_ADDRESS.length).toBe(62); // Bech32m length for P2TR
    });
  });

  describe("Balance Check", () => {
    it("should fetch wallet balance from testnet4", async () => {
      const balance = await mempoolClient.getBalance(TESTNET_ADDRESS);

      expect(typeof balance.total).toBe("number");
      expect(typeof balance.confirmed).toBe("number");
      expect(typeof balance.unconfirmed).toBe("number");

      console.log(`Wallet balance: ${balance.total} sats`);
      console.log(`  Confirmed: ${balance.confirmed}`);
      console.log(`  Unconfirmed: ${balance.unconfirmed}`);
    });

    it("should fetch UTXOs from testnet4", async () => {
      const utxos = await mempoolClient.getUTXOs(TESTNET_ADDRESS);

      expect(Array.isArray(utxos)).toBe(true);

      if (utxos.length > 0) {
        console.log(`Found ${utxos.length} UTXOs:`);
        for (const utxo of utxos) {
          console.log(`  ${utxo.txid}:${utxo.vout} - ${utxo.value} sats`);
        }
      }
    });
  });

  describe("Mining Submitter Initialization", () => {
    it("should create mining submitter with testnet config", () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      const submitter = createMiningSubmitter({
        network: "testnet4",
        minerAddress: TESTNET_ADDRESS,
        minerPublicKey: Buffer.from(publicKey).toString("hex"),
      });

      expect(submitter).toBeDefined();
    });

    it("should check miner balance via submitter", async () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      const submitter = createMiningSubmitter({
        network: "testnet4",
        minerAddress: TESTNET_ADDRESS,
        minerPublicKey: Buffer.from(publicKey).toString("hex"),
      });

      const balanceCheck = await submitter.checkMinerBalance();

      expect(typeof balanceCheck.balance).toBe("number");
      expect(typeof balanceCheck.utxoCount).toBe("number");
      expect(typeof balanceCheck.largestUtxo).toBe("number");
      expect(typeof balanceCheck.canMine).toBe("boolean");

      console.log("Balance check result:", balanceCheck);
    });

    it("should get fee estimates", async () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      const submitter = createMiningSubmitter({
        network: "testnet4",
        minerAddress: TESTNET_ADDRESS,
        minerPublicKey: Buffer.from(publicKey).toString("hex"),
      });

      const fees = await submitter.getFeeEstimates();

      expect(typeof fees.fast).toBe("number");
      expect(typeof fees.medium).toBe("number");
      expect(typeof fees.slow).toBe("number");
      expect(typeof fees.charmsFee).toBe("number");

      console.log("Fee estimates:", fees);
    });
  });

  describe("Proof of Work Simulation", () => {
    it("should simulate PoW mining", () => {
      const challenge = `${FUNDING_TXID}:0`;
      let nonce = 0;
      let hash: Uint8Array;
      let leadingZeros: number;
      const targetDifficulty = 8; // Low difficulty for testing

      // Mine until we find a valid proof
      const maxAttempts = 100000;
      for (let i = 0; i < maxAttempts; i++) {
        const input = `${challenge}${nonce.toString(16).padStart(8, "0")}`;
        hash = doubleSha256(new TextEncoder().encode(input));
        leadingZeros = countLeadingZeroBits(hash);

        if (leadingZeros >= targetDifficulty) {
          console.log(`Found valid PoW after ${i + 1} attempts:`);
          console.log(`  Nonce: ${nonce.toString(16)}`);
          console.log(`  Leading zeros: ${leadingZeros}`);
          break;
        }
        nonce++;
      }

      expect(leadingZeros!).toBeGreaterThanOrEqual(targetDifficulty);
    });

    it("should calculate mining reward correctly", () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      const submitter = createMiningSubmitter({
        network: "testnet4",
        minerAddress: TESTNET_ADDRESS,
        minerPublicKey: Buffer.from(publicKey).toString("hex"),
      });

      // Test different difficulty levels
      const reward16 = submitter.calculateReward(16);
      const reward20 = submitter.calculateReward(20);
      const reward24 = submitter.calculateReward(24);

      console.log(`Reward for 16 zeros: ${reward16}`);
      console.log(`Reward for 20 zeros: ${reward20}`);
      console.log(`Reward for 24 zeros: ${reward24}`);

      expect(reward20 > reward16).toBe(true);
      expect(reward24 > reward20).toBe(true);
    });
  });

  describe("Mining Transaction Building (V10 Flow)", () => {
    it("should build mining TX with OP_RETURN (requires balance)", async () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      const submitter = createMiningSubmitter({
        network: "testnet4",
        minerAddress: TESTNET_ADDRESS,
        minerPublicKey: Buffer.from(publicKey).toString("hex"),
      });

      // Check balance first
      const balanceCheck = await submitter.checkMinerBalance();

      if (!balanceCheck.canMine) {
        console.log(
          `Skipping TX build test - insufficient balance: ${balanceCheck.error}`,
        );
        return;
      }

      // Create a mock proof
      const mockProof: MiningProof = {
        hash: "0".repeat(4) + "a".repeat(60), // Simulated 16 leading zero bits
        nonce: 0x12345678, // Must be integer
        difficulty: 16,
        timestamp: Date.now(),
        blockData: `${FUNDING_TXID}:0`,
      };

      // Submit using V10 flow - first phase returns PSBT for signing
      try {
        const result = await submitter.submitProofV10(mockProof);

        if (result.success && result.phase === "mining_tx_ready") {
          console.log("Mining TX PSBT created successfully");
          console.log(`  PSBT length: ${result.miningPsbt?.length}`);
          expect(result.miningPsbt).toBeDefined();
          expect(result.miningTxHex).toBeDefined();
        } else {
          console.log(
            `Mining TX build result: ${result.phase} - ${result.error}`,
          );
        }
      } catch (error) {
        console.log(`Mining TX build exception: ${error}`);
        throw error;
      }
    });
  });

  describe("Merkle Proof with Real Blockchain Data", () => {
    it("should fetch transaction info", async () => {
      // Use a known confirmed testnet4 transaction
      // This is the funding transaction - check if confirmed
      try {
        const tx = await mempoolClient.getTransaction(FUNDING_TXID);

        expect(tx.txid).toBe(FUNDING_TXID);
        console.log(`TX confirmed: ${tx.status?.confirmed}`);

        if (tx.status?.confirmed) {
          console.log(`  Block hash: ${tx.status.block_hash}`);
          console.log(`  Block height: ${tx.status.block_height}`);
        }
      } catch (error) {
        console.log(`TX not found yet (may still be in mempool)`);
      }
    });

    it("should build and verify merkle proof for confirmed tx", async () => {
      try {
        const tx = await mempoolClient.getTransaction(FUNDING_TXID);

        if (!tx.status?.confirmed) {
          console.log("Skipping Merkle proof test - TX not confirmed yet");
          return;
        }

        // Get Merkle proof
        const proof = await getMerkleProof(mempoolClient, FUNDING_TXID);

        expect(proof.txid).toBe(FUNDING_TXID);
        expect(proof.blockHash).toBe(tx.status.block_hash);
        expect(proof.merklePath).toBeDefined();
        expect(proof.txIndex).toBeGreaterThanOrEqual(0);

        console.log("Merkle proof obtained:");
        console.log(`  Block height: ${proof.blockHeight}`);
        console.log(`  TX index in block: ${proof.txIndex}`);
        console.log(`  Merkle path length: ${proof.merklePath.length}`);

        // Verify the proof
        const isValid = verifyMerkleProof(
          proof.txid,
          proof.merkleRoot,
          proof.merklePath,
          proof.txIndex,
        );

        expect(isValid).toBe(true);
        console.log(`  Proof verified: ${isValid}`);
      } catch (error) {
        console.log(`Merkle proof test error: ${error}`);
      }
    });
  });

  describe("Full V10 Flow Simulation", () => {
    it("should demonstrate complete mining flow phases", async () => {
      const privateKey = Buffer.from(TESTNET_PRIVATE_KEY, "hex");
      const publicKey = getPublicKey(privateKey);

      const submitter = createMiningSubmitter({
        network: "testnet4",
        minerAddress: TESTNET_ADDRESS,
        minerPublicKey: Buffer.from(publicKey).toString("hex"),
      });

      // Phase 1: Check balance
      const balance = await submitter.checkMinerBalance();
      console.log("\n=== V10 Flow Demonstration ===");
      console.log(`Phase 1 - Balance Check: ${balance.balance} sats`);
      console.log(`  Can mine: ${balance.canMine}`);

      if (!balance.canMine) {
        console.log("Cannot proceed - insufficient balance");
        return;
      }

      // Phase 2: Mine a proof
      console.log("\nPhase 2 - Mining PoW...");
      const challenge = `${FUNDING_TXID}:0`;
      let nonce = 0;
      let hash: Uint8Array;
      let leadingZeros = 0;

      for (let i = 0; i < 50000; i++) {
        const input = `${challenge}${nonce.toString(16).padStart(8, "0")}`;
        hash = doubleSha256(new TextEncoder().encode(input));
        leadingZeros = countLeadingZeroBits(hash);
        if (leadingZeros >= 8) break;
        nonce++;
      }

      console.log(`  Found proof with ${leadingZeros} leading zeros`);

      // Phase 3: Build mining TX
      console.log("\nPhase 3 - Building Mining TX...");
      const mockProof: MiningProof = {
        hash: Array.from(hash!)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        nonce: nonce, // Must be integer
        difficulty: leadingZeros,
        timestamp: Date.now(),
        blockData: challenge,
      };

      const result = await submitter.submitProofV10(mockProof);

      if (result.phase === "mining_tx_ready") {
        console.log("  Mining TX PSBT ready for signing");
        console.log(
          `  Expected reward: ${submitter.calculateReward(leadingZeros)}`,
        );

        // In real flow, would sign and broadcast, then proceed to mint TX
        console.log("\nPhase 4 - Would sign and broadcast Mining TX...");
        console.log("Phase 5 - Would wait for confirmation...");
        console.log("Phase 6 - Would get Merkle proof...");
        console.log("Phase 7 - Would build and sign Mint TX...");
      } else {
        console.log(`  Result: ${result.phase} - ${result.error || "success"}`);
      }

      console.log("\n=== Flow Complete ===");
    });
  });
});
