/**
 * Mock Wallet Provider for Testing
 *
 * Simulates Bitcoin wallet extensions (Unisat, Xverse, etc.)
 * for testing wallet connection and signing flows.
 */

import { randomBytes, createHash } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface MockWalletAccount {
  address: string;
  publicKey: string;
  privateKey: Uint8Array;
  network: "mainnet" | "testnet";
}

export interface SignPsbtOptions {
  autoFinalized?: boolean;
  toSignInputs?: Array<{
    index: number;
    address?: string;
    publicKey?: string;
    sighashTypes?: number[];
  }>;
}

export interface MockWalletState {
  connected: boolean;
  accounts: MockWalletAccount[];
  selectedAccount: number;
  network: "mainnet" | "testnet";
}

// =============================================================================
// MOCK WALLET PROVIDER
// =============================================================================

/**
 * Mock wallet provider that simulates Unisat/Xverse wallet APIs
 *
 * Use this in tests to simulate wallet interactions without
 * requiring a real browser extension.
 */
export class MockWalletProvider {
  private state: MockWalletState;
  private signingEnabled: boolean = true;
  private shouldFailConnection: boolean = false;
  private shouldFailSigning: boolean = false;
  private connectionDelay: number = 0;
  private signingDelay: number = 0;

  constructor() {
    this.state = {
      connected: false,
      accounts: [],
      selectedAccount: 0,
      network: "testnet",
    };

    // Generate default test accounts
    this.generateTestAccounts(3);
  }

  // ===========================================================================
  // CONFIGURATION (for test setup)
  // ===========================================================================

  /**
   * Configure the mock to fail connection attempts
   */
  setFailConnection(fail: boolean): void {
    this.shouldFailConnection = fail;
  }

  /**
   * Configure the mock to fail signing attempts
   */
  setFailSigning(fail: boolean): void {
    this.shouldFailSigning = fail;
  }

  /**
   * Set connection delay (simulate slow connection)
   */
  setConnectionDelay(ms: number): void {
    this.connectionDelay = ms;
  }

  /**
   * Set signing delay (simulate slow hardware wallet)
   */
  setSigningDelay(ms: number): void {
    this.signingDelay = ms;
  }

  /**
   * Enable/disable signing capability
   */
  setSigningEnabled(enabled: boolean): void {
    this.signingEnabled = enabled;
  }

  /**
   * Set network
   */
  setNetwork(network: "mainnet" | "testnet"): void {
    this.state.network = network;
    // Update account addresses for new network
    this.generateTestAccounts(this.state.accounts.length);
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = {
      connected: false,
      accounts: [],
      selectedAccount: 0,
      network: "testnet",
    };
    this.signingEnabled = true;
    this.shouldFailConnection = false;
    this.shouldFailSigning = false;
    this.connectionDelay = 0;
    this.signingDelay = 0;
    this.generateTestAccounts(3);
  }

  // ===========================================================================
  // UNISAT-COMPATIBLE API
  // ===========================================================================

  /**
   * Request wallet connection (Unisat API)
   */
  async requestAccounts(): Promise<string[]> {
    if (this.connectionDelay > 0) {
      await this.delay(this.connectionDelay);
    }

    if (this.shouldFailConnection) {
      throw new Error("User rejected connection request");
    }

    this.state.connected = true;
    return this.state.accounts.map((a) => a.address);
  }

  /**
   * Get connected accounts (Unisat API)
   */
  async getAccounts(): Promise<string[]> {
    if (!this.state.connected) {
      return [];
    }
    return this.state.accounts.map((a) => a.address);
  }

  /**
   * Get current public key (Unisat API)
   */
  async getPublicKey(): Promise<string> {
    if (!this.state.connected) {
      throw new Error("Wallet not connected");
    }
    return this.state.accounts[this.state.selectedAccount].publicKey;
  }

  /**
   * Get current network (Unisat API)
   */
  async getNetwork(): Promise<string> {
    return this.state.network === "mainnet" ? "livenet" : "testnet";
  }

  /**
   * Switch network (Unisat API)
   */
  async switchNetwork(network: string): Promise<void> {
    this.state.network = network === "livenet" ? "mainnet" : "testnet";
    this.generateTestAccounts(this.state.accounts.length);
  }

  /**
   * Sign message (Unisat API)
   */
  async signMessage(message: string): Promise<string> {
    if (!this.state.connected) {
      throw new Error("Wallet not connected");
    }

    if (this.signingDelay > 0) {
      await this.delay(this.signingDelay);
    }

    if (this.shouldFailSigning) {
      throw new Error("User rejected signing request");
    }

    if (!this.signingEnabled) {
      throw new Error("Signing is disabled");
    }

    // Generate a mock signature
    const account = this.state.accounts[this.state.selectedAccount];
    const hash = createHash("sha256")
      .update(message)
      .update(Buffer.from(account.privateKey))
      .digest();

    return hash.toString("base64");
  }

  /**
   * Sign PSBT (Unisat API)
   */
  async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    if (!this.state.connected) {
      throw new Error("Wallet not connected");
    }

    if (this.signingDelay > 0) {
      await this.delay(this.signingDelay);
    }

    if (this.shouldFailSigning) {
      throw new Error("User rejected signing request");
    }

    if (!this.signingEnabled) {
      throw new Error("Signing is disabled");
    }

    // For testing, just return a modified PSBT
    // In reality, this would add signatures
    const signedPsbt = psbtHex + "_signed";
    return options?.autoFinalized ? signedPsbt + "_finalized" : signedPsbt;
  }

  /**
   * Sign multiple PSBTs (Unisat API)
   */
  async signPsbts(
    psbtHexs: string[],
    options?: SignPsbtOptions[],
  ): Promise<string[]> {
    return Promise.all(
      psbtHexs.map((psbt, i) => this.signPsbt(psbt, options?.[i])),
    );
  }

  /**
   * Push transaction (Unisat API)
   */
  async pushTx(txHex: string): Promise<string> {
    if (!this.state.connected) {
      throw new Error("Wallet not connected");
    }

    // Generate a mock txid
    const txid = createHash("sha256")
      .update(txHex)
      .update(Date.now().toString())
      .digest("hex");

    return txid;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Generate test accounts
   */
  private generateTestAccounts(count: number): void {
    this.state.accounts = [];
    const prefix = this.state.network === "mainnet" ? "bc1q" : "tb1q";

    for (let i = 0; i < count; i++) {
      const privateKey = randomBytes(32);
      const publicKey = randomBytes(33); // Compressed public key

      // Generate a simple bech32-like address for testing
      const addressSuffix = createHash("sha256")
        .update(publicKey)
        .digest("hex")
        .slice(0, 38);

      this.state.accounts.push({
        address: `${prefix}${addressSuffix}`,
        publicKey: publicKey.toString("hex"),
        privateKey,
        network: this.state.network,
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // TEST HELPERS
  // ===========================================================================

  /**
   * Get current state (for assertions)
   */
  getState(): MockWalletState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Get selected account
   */
  getSelectedAccount(): MockWalletAccount | null {
    if (!this.state.connected || this.state.accounts.length === 0) {
      return null;
    }
    return this.state.accounts[this.state.selectedAccount];
  }

  /**
   * Simulate disconnection
   */
  disconnect(): void {
    this.state.connected = false;
  }

  /**
   * Select a different account
   */
  selectAccount(index: number): void {
    if (index >= 0 && index < this.state.accounts.length) {
      this.state.selectedAccount = index;
    }
  }
}

// =============================================================================
// GLOBAL MOCK INSTALLATION
// =============================================================================

/**
 * Install mock wallet on window object (for browser tests)
 */
export function installMockWallet(
  provider?: MockWalletProvider,
): MockWalletProvider {
  const wallet = provider || new MockWalletProvider();

  // Install as unisat
  (globalThis as unknown as { unisat: MockWalletProvider }).unisat = wallet;

  return wallet;
}

/**
 * Remove mock wallet from window object
 */
export function uninstallMockWallet(): void {
  delete (globalThis as unknown as { unisat?: MockWalletProvider }).unisat;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a new mock wallet provider
 */
export function createMockWallet(): MockWalletProvider {
  return new MockWalletProvider();
}
