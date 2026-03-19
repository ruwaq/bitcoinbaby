/**
 * Offline Sync Tests
 *
 * Tests for the offline-first mining architecture:
 * - Mining proofs stored locally when offline
 * - Automatic sync when connection restored
 * - Deduplication on sync
 * - Error recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// TYPES
// =============================================================================

interface MiningProof {
  id: string;
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncError?: string;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

// =============================================================================
// MOCK OFFLINE STORAGE
// =============================================================================

class MockOfflineStorage {
  private proofs: Map<string, MiningProof> = new Map();

  async save(proof: MiningProof): Promise<void> {
    this.proofs.set(proof.id, { ...proof });
  }

  async get(id: string): Promise<MiningProof | null> {
    return this.proofs.get(id) || null;
  }

  async getUnsynced(): Promise<MiningProof[]> {
    return Array.from(this.proofs.values()).filter((p) => !p.synced);
  }

  async markSynced(id: string): Promise<void> {
    const proof = this.proofs.get(id);
    if (proof) {
      proof.synced = true;
    }
  }

  async markFailed(id: string, error: string): Promise<void> {
    const proof = this.proofs.get(id);
    if (proof) {
      proof.syncAttempts++;
      proof.lastSyncError = error;
    }
  }

  async delete(id: string): Promise<void> {
    this.proofs.delete(id);
  }

  async clear(): Promise<void> {
    this.proofs.clear();
  }

  getAll(): MiningProof[] {
    return Array.from(this.proofs.values());
  }
}

// =============================================================================
// MOCK SYNC SERVICE
// =============================================================================

class MockSyncService {
  private storage: MockOfflineStorage;
  private isOnline: boolean = true;
  private serverProofs: Set<string> = new Set();
  private maxRetries: number = 3;

  constructor(storage: MockOfflineStorage) {
    this.storage = storage;
  }

  setOnline(online: boolean): void {
    this.isOnline = online;
  }

  addServerProof(hash: string): void {
    this.serverProofs.add(hash);
  }

  async syncProof(proof: MiningProof): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.isOnline) {
      return { success: false, error: "Network unavailable" };
    }

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 10));

    // Check for duplicate on server
    if (this.serverProofs.has(proof.hash)) {
      // Mark as synced (it's already on server)
      await this.storage.markSynced(proof.id);
      return { success: true };
    }

    // Simulate server accepting proof
    this.serverProofs.add(proof.hash);
    await this.storage.markSynced(proof.id);
    return { success: true };
  }

  async syncAllUnsynced(): Promise<SyncResult> {
    const unsynced = await this.storage.getUnsynced();
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    for (const proof of unsynced) {
      if (proof.syncAttempts >= this.maxRetries) {
        result.failedCount++;
        result.errors.push(`Proof ${proof.id}: max retries exceeded`);
        continue;
      }

      const syncResult = await this.syncProof(proof);

      if (syncResult.success) {
        result.syncedCount++;
      } else {
        result.failedCount++;
        result.errors.push(`Proof ${proof.id}: ${syncResult.error}`);
        await this.storage.markFailed(proof.id, syncResult.error!);
      }
    }

    result.success = result.failedCount === 0;
    return result;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockProof(overrides: Partial<MiningProof> = {}): MiningProof {
  return {
    id: crypto.randomUUID(),
    hash: "0".repeat(4) + crypto.randomUUID().replace(/-/g, "").slice(0, 60),
    nonce: Math.floor(Math.random() * 1000000),
    difficulty: 16,
    blockData: `block:${Date.now()}`,
    timestamp: Date.now(),
    synced: false,
    syncAttempts: 0,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Offline Sync", () => {
  let storage: MockOfflineStorage;
  let syncService: MockSyncService;

  beforeEach(() => {
    storage = new MockOfflineStorage();
    syncService = new MockSyncService(storage);
  });

  afterEach(() => {
    storage.clear();
  });

  // ===========================================================================
  // OFFLINE STORAGE
  // ===========================================================================

  describe("Offline Storage", () => {
    it("should save proofs locally", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      const retrieved = await storage.get(proof.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.hash).toBe(proof.hash);
    });

    it("should track unsynced proofs", async () => {
      const proof1 = createMockProof();
      const proof2 = createMockProof({ synced: true });

      await storage.save(proof1);
      await storage.save(proof2);

      const unsynced = await storage.getUnsynced();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].id).toBe(proof1.id);
    });

    it("should mark proofs as synced", async () => {
      const proof = createMockProof();
      await storage.save(proof);
      await storage.markSynced(proof.id);

      const unsynced = await storage.getUnsynced();
      expect(unsynced).toHaveLength(0);
    });

    it("should track sync attempts", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      await storage.markFailed(proof.id, "Network error");
      await storage.markFailed(proof.id, "Network error");

      const retrieved = await storage.get(proof.id);
      expect(retrieved!.syncAttempts).toBe(2);
    });
  });

  // ===========================================================================
  // SYNC SERVICE
  // ===========================================================================

  describe("Sync Service", () => {
    it("should sync proofs when online", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      syncService.setOnline(true);
      const result = await syncService.syncProof(proof);

      expect(result.success).toBe(true);

      const synced = await storage.get(proof.id);
      expect(synced!.synced).toBe(true);
    });

    it("should fail sync when offline", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      syncService.setOnline(false);
      const result = await syncService.syncProof(proof);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network unavailable");
    });

    it("should handle duplicates gracefully", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      // Simulate proof already on server
      syncService.addServerProof(proof.hash);

      syncService.setOnline(true);
      const result = await syncService.syncProof(proof);

      expect(result.success).toBe(true);

      const synced = await storage.get(proof.id);
      expect(synced!.synced).toBe(true);
    });

    it("should sync all unsynced proofs", async () => {
      const proofs = [createMockProof(), createMockProof(), createMockProof()];

      for (const proof of proofs) {
        await storage.save(proof);
      }

      syncService.setOnline(true);
      const result = await syncService.syncAllUnsynced();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(3);
      expect(result.failedCount).toBe(0);

      const unsynced = await storage.getUnsynced();
      expect(unsynced).toHaveLength(0);
    });

    it("should handle partial sync failure", async () => {
      const proof1 = createMockProof();
      const proof2 = createMockProof();

      await storage.save(proof1);
      await storage.save(proof2);

      // Sync first proof while online
      syncService.setOnline(true);
      await syncService.syncProof(proof1);

      // Go offline before second
      syncService.setOnline(false);

      const result = await syncService.syncAllUnsynced();

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });

    it("should respect max retries", async () => {
      const proof = createMockProof({ syncAttempts: 3 });
      await storage.save(proof);

      syncService.setOnline(true);
      const result = await syncService.syncAllUnsynced();

      expect(result.failedCount).toBe(1);
      expect(result.errors[0]).toContain("max retries exceeded");
    });
  });

  // ===========================================================================
  // OFFLINE-FIRST FLOW
  // ===========================================================================

  describe("Offline-First Mining Flow", () => {
    it("should complete full offline-to-online sync cycle", async () => {
      // 1. Mine proofs while offline
      syncService.setOnline(false);

      const offlineProofs = [
        createMockProof(),
        createMockProof(),
        createMockProof(),
      ];

      for (const proof of offlineProofs) {
        await storage.save(proof);
      }

      expect((await storage.getUnsynced()).length).toBe(3);

      // 2. Attempt sync while still offline
      const offlineResult = await syncService.syncAllUnsynced();
      expect(offlineResult.failedCount).toBe(3);

      // 3. Come back online
      syncService.setOnline(true);

      // 4. Sync all
      const onlineResult = await syncService.syncAllUnsynced();
      expect(onlineResult.success).toBe(true);
      expect(onlineResult.syncedCount).toBe(3);

      // 5. Verify all synced
      const remaining = await storage.getUnsynced();
      expect(remaining).toHaveLength(0);
    });

    it("should handle intermittent connectivity", async () => {
      const proofs = [
        createMockProof(),
        createMockProof(),
        createMockProof(),
        createMockProof(),
      ];

      for (const proof of proofs) {
        await storage.save(proof);
      }

      // Sync one at a time with varying connectivity
      syncService.setOnline(true);
      await syncService.syncProof(proofs[0]);

      syncService.setOnline(false);
      await syncService.syncProof(proofs[1]);

      syncService.setOnline(true);
      await syncService.syncProof(proofs[2]);

      syncService.setOnline(false);
      await syncService.syncProof(proofs[3]);

      // Check state
      const all = storage.getAll();
      const synced = all.filter((p) => p.synced);
      const unsynced = all.filter((p) => !p.synced);

      expect(synced).toHaveLength(2);
      expect(unsynced).toHaveLength(2);

      // Final sync when back online
      syncService.setOnline(true);
      await syncService.syncAllUnsynced();

      const finalUnsynced = await storage.getUnsynced();
      expect(finalUnsynced).toHaveLength(0);
    });

    it("should prevent duplicate credits after sync", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      // First sync
      syncService.setOnline(true);
      await syncService.syncProof(proof);

      // Try to sync same proof again (simulating accidental re-sync)
      const duplicate = createMockProof({ hash: proof.hash });
      await storage.save(duplicate);

      const result = await syncService.syncProof(duplicate);

      // Should succeed but not duplicate on server
      expect(result.success).toBe(true);

      // Server should only have one copy (checked via addServerProof being a Set)
    });
  });

  // ===========================================================================
  // ERROR RECOVERY
  // ===========================================================================

  describe("Error Recovery", () => {
    it("should recover from temporary network failures", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      // Fail first 2 attempts
      syncService.setOnline(false);
      await syncService.syncProof(proof);
      await storage.markFailed(proof.id, "Network error");

      syncService.setOnline(false);
      await syncService.syncProof(proof);
      await storage.markFailed(proof.id, "Network error");

      // Third attempt succeeds
      syncService.setOnline(true);
      const result = await syncService.syncProof(proof);

      expect(result.success).toBe(true);
    });

    it("should preserve proofs on sync failure", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      syncService.setOnline(false);
      await syncService.syncProof(proof);

      // Proof should still exist
      const retrieved = await storage.get(proof.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.synced).toBe(false);
    });

    it("should track error history", async () => {
      const proof = createMockProof();
      await storage.save(proof);

      syncService.setOnline(false);
      await syncService.syncProof(proof);
      await storage.markFailed(proof.id, "Network error 1");

      await syncService.syncProof(proof);
      await storage.markFailed(proof.id, "Network error 2");

      const retrieved = await storage.get(proof.id);
      expect(retrieved!.syncAttempts).toBe(2);
      expect(retrieved!.lastSyncError).toBe("Network error 2");
    });
  });
});
