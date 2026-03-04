/**
 * Wallet and transaction errors
 */

import { AppError } from "./base";

/**
 * General wallet error
 */
export class WalletError extends AppError {
  readonly code = "WALLET_ERROR";
  readonly statusCode = 500;
}

/**
 * Wallet not found or not connected
 */
export class WalletNotFoundError extends AppError {
  readonly code = "WALLET_NOT_FOUND";
  readonly statusCode = 404;

  constructor(
    message = "Wallet not found or not connected",
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: false,
      ...options,
    });
  }
}

/**
 * Invalid mnemonic phrase
 */
export class InvalidMnemonicError extends AppError {
  readonly code = "INVALID_MNEMONIC";
  readonly statusCode = 400;

  constructor(
    message = "Invalid mnemonic phrase",
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: false,
      ...options,
    });
  }
}

/**
 * Invalid Bitcoin address
 */
export class InvalidAddressError extends AppError {
  readonly code = "INVALID_ADDRESS";
  readonly statusCode = 400;

  constructor(
    address: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(`Invalid Bitcoin address: ${address.slice(0, 10)}...`, {
      isRetryable: false,
      metadata: { address, ...options?.metadata },
      ...options,
    });
  }
}

/**
 * Transaction error
 */
export class TransactionError extends AppError {
  readonly code = "TRANSACTION_ERROR";
  readonly statusCode = 500;
  readonly txid?: string;

  constructor(
    message: string,
    options?: {
      txid?: string;
      isRetryable?: boolean;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, options);
    this.txid = options?.txid;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      txid: this.txid,
    };
  }
}

/**
 * Insufficient funds error
 */
export class InsufficientFundsError extends AppError {
  readonly code = "INSUFFICIENT_FUNDS";
  readonly statusCode = 400;
  readonly required: bigint;
  readonly available: bigint;

  constructor(
    required: bigint,
    available: bigint,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(
      `Insufficient funds. Required: ${required} sats, Available: ${available} sats`,
      {
        isRetryable: false,
        metadata: {
          required: required.toString(),
          available: available.toString(),
          ...options?.metadata,
        },
        ...options,
      },
    );
    this.required = required;
    this.available = available;
  }
}

/**
 * Transaction signing error
 */
export class SigningError extends AppError {
  readonly code = "SIGNING_ERROR";
  readonly statusCode = 500;

  constructor(
    message = "Failed to sign transaction",
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: false,
      ...options,
    });
  }
}

/**
 * Transaction broadcast error
 */
export class BroadcastError extends AppError {
  readonly code = "BROADCAST_ERROR";
  readonly statusCode = 500;

  constructor(
    message = "Failed to broadcast transaction",
    options?: {
      isRetryable?: boolean;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: options?.isRetryable ?? true,
      ...options,
    });
  }
}
