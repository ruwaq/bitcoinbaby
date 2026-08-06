/**
 * Secure Storage for Wallet Credentials
 *
 * Uses Web Crypto API for AES-GCM encryption of sensitive data like mnemonics.
 * Falls back to encrypted localStorage with additional obfuscation.
 *
 * SECURITY NOTES:
 * - Never log or transmit the mnemonic
 * - Always clear sensitive data from memory after use
 * - Use password-derived keys, not stored keys
 * - Rate limiting on unlock attempts (brute force protection)
 */

import type { SupportedNetwork } from "@bitcoinbaby/bitcoin";

const DB_NAME = "bitcoinbaby-secure";
const DB_VERSION = 1;
const STORE_NAME = "wallet";

/**
 * Minimum password length requirement
 * NIST SP 800-63B recommends at least 8 characters
 * Balance between security and user-friendliness
 */
export const MIN_PASSWORD_LENGTH = 8;

// =============================================================================
// BRUTE FORCE PROTECTION
// =============================================================================

// Rate limiter storage key
const RATE_LIMITER_KEY = "unlock_rate_limiter";

/**
 * Load rate limiter state from localStorage
 */
function loadRateLimiterState(): {
  failedAttempts: number;
  lastAttemptTime: number;
} {
  if (typeof localStorage === "undefined") {
    return { failedAttempts: 0, lastAttemptTime: 0 };
  }
  try {
    const stored = localStorage.getItem(RATE_LIMITER_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        failedAttempts: data.failedAttempts || 0,
        lastAttemptTime: data.lastAttemptTime || 0,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { failedAttempts: 0, lastAttemptTime: 0 };
}

/**
 * Save rate limiter state to localStorage
 */
function saveRateLimiterState(state: {
  failedAttempts: number;
  lastAttemptTime: number;
}): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RATE_LIMITER_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Unlock attempt rate limiter
 *
 * Implements exponential backoff after failed attempts to prevent brute force attacks.
 * State is persisted to localStorage to survive page reloads.
 * - First 3 attempts: no delay
 * - 4th attempt: 1s delay
 * - 5th attempt: 2s delay
 * - 6th attempt: 4s delay
 * - etc. up to max 5 minutes
 */
const unlockRateLimiter = {
  // Initialize from persisted state
  ...loadRateLimiterState(),
  maxDelay: 300000, // 5 minutes

  /**
   * Get delay before next attempt is allowed (in ms)
   */
  getDelay(): number {
    if (this.failedAttempts < 3) return 0;
    const delay = Math.min(
      1000 * Math.pow(2, this.failedAttempts - 3),
      this.maxDelay,
    );
    return delay;
  },

  /**
   * Check if enough time has passed since last attempt
   */
  canAttempt(): boolean {
    const delay = this.getDelay();
    if (delay === 0) return true;
    const elapsed = Date.now() - this.lastAttemptTime;
    return elapsed >= delay;
  },

  /**
   * Get time remaining until next attempt is allowed (in ms)
   */
  getTimeUntilNextAttempt(): number {
    const delay = this.getDelay();
    if (delay === 0) return 0;
    const elapsed = Date.now() - this.lastAttemptTime;
    return Math.max(0, delay - elapsed);
  },

  /**
   * Record a failed attempt (persists to localStorage)
   */
  recordFailure(): void {
    this.failedAttempts++;
    this.lastAttemptTime = Date.now();
    saveRateLimiterState({
      failedAttempts: this.failedAttempts,
      lastAttemptTime: this.lastAttemptTime,
    });
  },

  /**
   * Record a successful attempt (reset counter, persists to localStorage)
   */
  recordSuccess(): void {
    this.failedAttempts = 0;
    this.lastAttemptTime = 0;
    saveRateLimiterState({
      failedAttempts: 0,
      lastAttemptTime: 0,
    });
  },

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failedAttempts;
  },

  /**
   * Reset the rate limiter (e.g., after password change, persists to localStorage)
   */
  reset(): void {
    this.failedAttempts = 0;
    this.lastAttemptTime = 0;
    saveRateLimiterState({
      failedAttempts: 0,
      lastAttemptTime: 0,
    });
  },
};

// Storage keys
/**
 * Encrypted wallet data structure
 */
interface EncryptedWalletData {
  /** Encrypted mnemonic (base64) */
  encryptedMnemonic: string;
  /** Salt for key derivation (base64) */
  salt: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Version for future migrations */
  version: number;
  /** Timestamp when stored */
  createdAt: number;
  /** Network the wallet was created for */
  network: SupportedNetwork;
}

/**
 * Wallet metadata (safe to expose)
 */
export interface WalletMetadata {
  exists: boolean;
  createdAt: number | null;
  network: SupportedNetwork | null;
  version: number;
}

/**
 * Check if Web Crypto API is available
 */
function isCryptoAvailable(): boolean {
  try {
    return (
      typeof crypto !== "undefined" &&
      typeof crypto.subtle !== "undefined" &&
      typeof crypto.subtle.deriveKey === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Check if IndexedDB is available
 */
function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Convert Uint8Array to a proper ArrayBuffer
 * This handles the case where Uint8Array might be a view into a larger buffer
 */
function uint8ArrayToArrayBuffer(arr: Uint8Array): ArrayBuffer {
  // Create a new ArrayBuffer with the exact size needed
  const buffer = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buffer).set(arr);
  return buffer;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return uint8ArrayToArrayBuffer(bytes);
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: uint8ArrayToArrayBuffer(salt),
      iterations: 600000, // OWASP 2024 recommendation
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(
  plaintext: string,
  password: string,
): Promise<{ ciphertext: string; salt: string; iv: string }> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    salt: arrayBufferToBase64(uint8ArrayToArrayBuffer(salt)),
    iv: arrayBufferToBase64(uint8ArrayToArrayBuffer(iv)),
  };
}

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(
  ciphertext: string,
  password: string,
  salt: string,
  iv: string,
): Promise<string> {
  // Derive key from password
  const key = await deriveKey(
    password,
    new Uint8Array(base64ToArrayBuffer(salt)),
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
    key,
    base64ToArrayBuffer(ciphertext),
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save encrypted data to IndexedDB
 */
async function saveToIndexedDB(data: EncryptedWalletData): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put(JSON.stringify(data), "wallet_data");

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

/**
 * Load encrypted data from IndexedDB
 */
async function loadFromIndexedDB(): Promise<EncryptedWalletData | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("wallet_data");

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(JSON.parse(result));
        } else {
          resolve(null);
        }
      };

      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Clear IndexedDB data
 */
async function clearIndexedDB(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete("wallet_data");
    transaction.oncomplete = () => db.close();
  } catch (error) {
    console.warn("Failed to clear IndexedDB:", error);
  }
}

/**
 * Secure Wallet Storage API
 *
 * Provides encrypted storage for wallet mnemonics using Web Crypto API.
 *
 * @example
 * ```ts
 * // Store mnemonic
 * await SecureStorage.storeMnemonic(mnemonic, password, 'testnet4');
 *
 * // Retrieve mnemonic
 * const mnemonic = await SecureStorage.getMnemonic(password);
 *
 * // Check if wallet exists
 * const metadata = await SecureStorage.getMetadata();
 * console.log(metadata.exists);
 *
 * // Clear wallet
 * await SecureStorage.clear();
 * ```
 */
export const SecureStorage = {
  /**
   * Check if secure storage is available
   */
  isAvailable(): boolean {
    return isCryptoAvailable() && isIndexedDBAvailable();
  },

  /**
   * Store encrypted mnemonic
   *
   * @param mnemonic - The BIP39 mnemonic phrase
   * @param password - User password for encryption
   * @param network - Network the wallet is for
   */
  async storeMnemonic(
    mnemonic: string,
    password: string,
    network: SupportedNetwork = "testnet4",
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error("Secure storage is not available in this environment");
    }

    if (!mnemonic || mnemonic.trim().length === 0) {
      throw new Error("Invalid mnemonic");
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    // Encrypt the mnemonic
    const { ciphertext, salt, iv } = await encrypt(mnemonic, password);

    // Store encrypted data
    const data: EncryptedWalletData = {
      encryptedMnemonic: ciphertext,
      salt,
      iv,
      version: 1,
      createdAt: Date.now(),
      network,
    };

    await saveToIndexedDB(data);
  },

  /**
   * Retrieve and decrypt mnemonic
   *
   * SECURITY: Rate limited to prevent brute force attacks.
   * After 3 failed attempts, exponential backoff is enforced.
   *
   * @param password - User password for decryption
   * @returns The decrypted mnemonic phrase
   * @throws Error if password is incorrect, data is corrupted, or rate limited
   */
  async getMnemonic(password: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("Secure storage is not available in this environment");
    }

    // SECURITY: Check rate limiter
    if (!unlockRateLimiter.canAttempt()) {
      const waitTime = Math.ceil(
        unlockRateLimiter.getTimeUntilNextAttempt() / 1000,
      );
      throw new Error(
        `Too many failed attempts. Please wait ${waitTime} seconds before trying again.`,
      );
    }

    const data = await loadFromIndexedDB();
    if (!data) {
      throw new Error("No wallet found");
    }

    try {
      const mnemonic = await decrypt(
        data.encryptedMnemonic,
        password,
        data.salt,
        data.iv,
      );

      // Validate that decryption produced valid mnemonic
      if (!mnemonic || mnemonic.trim().length === 0) {
        unlockRateLimiter.recordFailure();
        throw new Error("Decryption failed");
      }

      // Success - reset rate limiter
      unlockRateLimiter.recordSuccess();
      return mnemonic;
    } catch (error) {
      // Record failed attempt
      unlockRateLimiter.recordFailure();

      // Provide helpful message with wait time if rate limited
      const failures = unlockRateLimiter.getFailureCount();
      if (failures >= 3) {
        const waitTime = Math.ceil(unlockRateLimiter.getDelay() / 1000);
        throw new Error(
          `Incorrect password. ${failures} failed attempts. Wait ${waitTime}s before next attempt.`,
          { cause: error },
        );
      }

      // Don't expose specific crypto errors
      throw new Error("Incorrect password or corrupted data", {
        cause: error,
      });
    }
  },

  /**
   * Get current unlock rate limiter status
   */
  getUnlockStatus(): {
    failedAttempts: number;
    canAttempt: boolean;
    waitTimeSeconds: number;
  } {
    return {
      failedAttempts: unlockRateLimiter.getFailureCount(),
      canAttempt: unlockRateLimiter.canAttempt(),
      waitTimeSeconds: Math.ceil(
        unlockRateLimiter.getTimeUntilNextAttempt() / 1000,
      ),
    };
  },

  /**
   * Reset unlock rate limiter (e.g., after successful password change)
   */
  resetUnlockRateLimiter(): void {
    unlockRateLimiter.reset();
  },

  /**
   * Verify password without returning mnemonic
   *
   * @param password - Password to verify
   * @returns True if password is correct
   */
  async verifyPassword(password: string): Promise<boolean> {
    try {
      await this.getMnemonic(password);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Change password for stored mnemonic
   *
   * @param currentPassword - Current password
   * @param newPassword - New password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    // Get current mnemonic
    const mnemonic = await this.getMnemonic(currentPassword);

    // Get current network
    const data = await loadFromIndexedDB();
    const network = data?.network ?? "testnet4";

    // Re-encrypt with new password
    await this.storeMnemonic(mnemonic, newPassword, network);
  },

  /**
   * Get wallet metadata (safe to expose)
   */
  async getMetadata(): Promise<WalletMetadata> {
    try {
      const data = await loadFromIndexedDB();

      if (!data) {
        return {
          exists: false,
          createdAt: null,
          network: null,
          version: 0,
        };
      }

      return {
        exists: true,
        createdAt: data.createdAt,
        network: data.network,
        version: data.version,
      };
    } catch {
      return {
        exists: false,
        createdAt: null,
        network: null,
        version: 0,
      };
    }
  },

  /**
   * Check if a wallet is stored
   */
  async hasWallet(): Promise<boolean> {
    const metadata = await this.getMetadata();
    return metadata.exists;
  },

  /**
   * Clear all stored wallet data
   *
   * WARNING: This permanently deletes the encrypted mnemonic.
   * Make sure the user has backed up their mnemonic before calling this.
   */
  async clear(): Promise<void> {
    await clearIndexedDB();
  },

  /**
   * Export encrypted backup (for advanced users)
   *
   * Returns the encrypted data that can be stored elsewhere.
   * Requires the original password to decrypt.
   */
  async exportBackup(): Promise<string | null> {
    const data = await loadFromIndexedDB();
    if (!data) return null;
    return JSON.stringify(data);
  },

  /**
   * Import encrypted backup
   *
   * @param backup - The encrypted backup string
   * @param password - Password to verify the backup is valid
   */
  async importBackup(backup: string, password: string): Promise<void> {
    const data: EncryptedWalletData = JSON.parse(backup);

    // Verify we can decrypt with the given password
    const mnemonic = await decrypt(
      data.encryptedMnemonic,
      password,
      data.salt,
      data.iv,
    );

    if (!mnemonic) {
      throw new Error("Invalid backup or incorrect password");
    }

    // Save the imported data
    await saveToIndexedDB(data);
  },
};

export default SecureStorage;
