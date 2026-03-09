/**
 * TransactionConfirmModal - Transaction Confirmation Dialog
 *
 * Shows transaction details before signing.
 * User must confirm or cancel.
 */

import { type FC } from "react";
import { clsx } from "clsx";
import { Button } from "../button";
import { PixelIcon } from "../sprites";

export interface TransactionDetails {
  /** Type of transaction */
  type:
    | "mint"
    | "transfer"
    | "evolve"
    | "withdraw"
    | "send"
    | "stake"
    | "claim"
    | "custom";
  /** Title for the modal */
  title: string;
  /** Description of what will happen */
  description: string;
  /** Step-by-step explanation (optional) */
  steps?: string[];
  /** Cost breakdown */
  costs: {
    label: string;
    amount: string;
    sublabel?: string;
  }[];
  /** Total cost in sats */
  totalSats: number;
  /** Formatted total (e.g., "0.0001 BTC") */
  formattedTotal: string;
  /** Network fee estimate */
  feeEstimate?: string;
  /** Recipient address (for transfers) */
  recipient?: string;
  /** Source (for withdrawals) */
  source?: string;
  /** Estimated processing time */
  estimatedTime?: string;
  /** Additional info to display */
  additionalInfo?: string;
  /** Warning message */
  warning?: string;
}

interface TransactionConfirmModalProps {
  isOpen: boolean;
  transaction: TransactionDetails;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export const TransactionConfirmModal: FC<TransactionConfirmModalProps> = ({
  isOpen,
  transaction,
  isLoading = false,
  onConfirm,
  onCancel,
  className,
}) => {
  if (!isOpen) {
    return null;
  }

  const getIcon = () => {
    switch (transaction.type) {
      case "mint":
        return "star";
      case "transfer":
      case "send":
        return "bolt";
      case "evolve":
        return "sparkle";
      case "withdraw":
      case "claim":
        return "coin";
      case "stake":
        return "heart";
      default:
        return "coin";
    }
  };

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50",
        "flex items-center justify-center p-4",
        "bg-black/80",
        className,
      )}
    >
      <div
        className={clsx(
          "w-full max-w-md",
          "bg-pixel-bg-dark border-4 border-pixel-border",
          "shadow-[8px_8px_0_0_#000]",
          "animate-[scale-in_0.2s_ease-out]",
        )}
      >
        {/* Header */}
        <div className="bg-pixel-bg-medium border-b-4 border-pixel-border p-4">
          <div className="flex items-center gap-3">
            <PixelIcon
              name={getIcon()}
              size={24}
              className="text-pixel-primary"
            />
            <div>
              <h3 className="font-pixel text-sm text-pixel-text">
                {transaction.title}
              </h3>
              <p className="font-pixel text-[8px] text-pixel-text-muted uppercase mt-1">
                CONFIRM TRANSACTION
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Description */}
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            {transaction.description}
          </p>

          {/* Steps - What will happen */}
          {transaction.steps && transaction.steps.length > 0 && (
            <div className="bg-pixel-bg-medium/50 border-2 border-pixel-border p-3">
              <span className="font-pixel text-[8px] text-pixel-text-muted uppercase block mb-2">
                What will happen:
              </span>
              <ol className="space-y-1">
                {transaction.steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[10px] text-pixel-text"
                  >
                    <span className="font-pixel text-pixel-success flex-shrink-0">
                      {i + 1}.
                    </span>
                    <span className="font-pixel-body">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="bg-pixel-bg-medium border-2 border-pixel-border p-3 space-y-2">
            {transaction.costs.map((cost, i) => (
              <div key={i} className="flex justify-between items-center">
                <div>
                  <span className="font-pixel text-[9px] text-pixel-text">
                    {cost.label}
                  </span>
                  {cost.sublabel && (
                    <span className="font-pixel text-[7px] text-pixel-text-muted ml-2">
                      ({cost.sublabel})
                    </span>
                  )}
                </div>
                <span className="font-pixel text-[10px] text-pixel-primary">
                  {cost.amount}
                </span>
              </div>
            ))}

            {/* Fee Estimate */}
            {transaction.feeEstimate && (
              <div className="flex justify-between items-center pt-2 border-t border-pixel-border">
                <span className="font-pixel text-[8px] text-pixel-text-muted">
                  Network Fee (est.)
                </span>
                <span className="font-pixel text-[9px] text-pixel-text-muted">
                  ~{transaction.feeEstimate}
                </span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t-2 border-pixel-border">
              <span className="font-pixel text-[10px] text-pixel-text uppercase">
                Total
              </span>
              <span className="font-pixel text-sm text-pixel-success">
                {transaction.formattedTotal}
              </span>
            </div>
          </div>

          {/* Source & Recipient */}
          {(transaction.source || transaction.recipient) && (
            <div className="space-y-2">
              {transaction.source && (
                <div className="bg-pixel-bg-medium border-2 border-pixel-border p-3">
                  <span className="font-pixel text-[8px] text-pixel-text-muted uppercase block mb-1">
                    From
                  </span>
                  <span className="font-pixel-body text-[10px] text-pixel-text break-all">
                    {transaction.source}
                  </span>
                </div>
              )}
              {transaction.source && transaction.recipient && (
                <div className="flex justify-center">
                  <span className="text-lg">⬇️</span>
                </div>
              )}
              {transaction.recipient && (
                <div className="bg-pixel-bg-medium border-2 border-pixel-border p-3">
                  <span className="font-pixel text-[8px] text-pixel-text-muted uppercase block mb-1">
                    To
                  </span>
                  <span className="font-pixel-body text-[10px] text-pixel-text break-all">
                    {transaction.recipient}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Estimated Time */}
          {transaction.estimatedTime && (
            <div className="flex justify-between items-center p-2 bg-pixel-bg-medium/30 rounded">
              <span className="font-pixel text-[8px] text-pixel-text-muted">
                Estimated Time
              </span>
              <span className="font-pixel text-[9px] text-pixel-secondary">
                {transaction.estimatedTime}
              </span>
            </div>
          )}

          {/* Warning */}
          {transaction.warning && (
            <div className="p-3 bg-pixel-error/10 border-2 border-pixel-error">
              <p className="font-pixel text-[8px] text-pixel-error">
                ⚠️ {transaction.warning}
              </p>
            </div>
          )}

          {/* Additional Info */}
          {transaction.additionalInfo && (
            <div className="p-3 bg-pixel-warning/10 border-2 border-pixel-warning">
              <p className="font-pixel text-[8px] text-pixel-warning">
                {transaction.additionalInfo}
              </p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 text-pixel-text-muted">
            <PixelIcon
              name="sparkle"
              size={14}
              className="flex-shrink-0 mt-0.5"
            />
            <p className="font-pixel text-[7px]">
              This transaction will be broadcast to the Bitcoin network. Make
              sure the details are correct before confirming.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t-4 border-pixel-border">
          <Button
            variant="outline"
            size="default"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            CANCEL
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <span className="animate-pulse">SIGNING...</span>
            ) : (
              "CONFIRM"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// HELPER FUNCTIONS TO CREATE TRANSACTION DETAILS
// =============================================================================

/**
 * Create withdrawal transaction details
 */
export function createWithdrawTransaction(params: {
  amount: bigint;
  toAddress: string;
  poolType: string;
  estimatedTime?: string;
}): TransactionDetails {
  const formattedAmount = params.amount.toLocaleString();

  return {
    type: "withdraw",
    title: "Confirm Withdrawal",
    description: "Convert your virtual $BABY tokens to real on-chain tokens",
    steps: [
      "Your virtual balance will be reduced by this amount",
      `Request added to ${params.poolType} withdrawal pool`,
      "When the pool processes, tokens are minted on Bitcoin",
      "Real $BABY tokens will be sent to your wallet",
    ],
    costs: [{ label: "Withdrawal Amount", amount: `${formattedAmount} $BABY` }],
    totalSats: 0,
    formattedTotal: `${formattedAmount} $BABY`,
    source: "Virtual Balance",
    recipient: params.toAddress,
    estimatedTime:
      params.estimatedTime ?? getPoolEstimatedTime(params.poolType),
    additionalInfo: `Pool: ${params.poolType}. Withdrawals are batched to minimize Bitcoin fees.`,
  };
}

/**
 * Get estimated time for pool type
 */
function getPoolEstimatedTime(poolType: string): string {
  switch (poolType.toLowerCase()) {
    case "immediate":
      return "~1 hour";
    case "low_fee":
      return "~24 hours";
    case "weekly":
      return "Up to 7 days";
    case "monthly":
      return "Up to 30 days";
    default:
      return "Varies by pool";
  }
}

/**
 * Create send transaction details
 */
export function createSendTransaction(params: {
  amount: string;
  token: string;
  fromAddress: string;
  toAddress: string;
  networkFee?: string;
}): TransactionDetails {
  return {
    type: "send",
    title: "Confirm Send",
    description: `Send ${params.token} to another address`,
    steps: [
      "Transaction will be signed with your wallet",
      "Broadcast to Bitcoin network",
      "Recipient receives tokens after confirmation (~10-30 min)",
    ],
    costs: [
      { label: "Send Amount", amount: `${params.amount} ${params.token}` },
    ],
    totalSats: 0,
    formattedTotal: `${params.amount} ${params.token}`,
    feeEstimate: params.networkFee,
    source: params.fromAddress,
    recipient: params.toAddress,
    estimatedTime: "~10-30 minutes",
  };
}

/**
 * Create NFT mint transaction details
 */
export function createMintNFTTransaction(params: {
  nftName: string;
  price: number;
  toAddress: string;
  networkFee?: number;
}): TransactionDetails {
  const totalSats = params.price + (params.networkFee ?? 2000);

  return {
    type: "mint",
    title: "Confirm NFT Mint",
    description: `Mint a new ${params.nftName}`,
    steps: [
      "Payment sent to treasury",
      "NFT inscribed on Bitcoin",
      "NFT sent to your wallet",
      "Mining boost activated automatically",
    ],
    costs: [
      { label: "NFT Price", amount: `${params.price.toLocaleString()} sats` },
      {
        label: "Network Fee",
        amount: `~${(params.networkFee ?? 2000).toLocaleString()} sats`,
        sublabel: "estimate",
      },
    ],
    totalSats,
    formattedTotal: `${totalSats.toLocaleString()} sats`,
    recipient: params.toAddress,
    estimatedTime: "~10-30 minutes",
    warning: "NFT mints are final and cannot be reversed",
  };
}

/**
 * Create claim transaction details
 */
export function createClaimTransaction(params: {
  tokenAmount: string;
  netTokens?: string;
  proofCount: number;
  networkFee: number;
  feeRate?: number;
  platformFeePercent?: number;
  platformFeeTokens?: string;
  fromAddress: string;
}): TransactionDetails {
  const netAmount = params.netTokens ?? params.tokenAmount;
  const costs: TransactionDetails["costs"] = [];

  // Show gross amount if there's a platform fee
  if (params.platformFeePercent && params.platformFeePercent > 0) {
    costs.push({
      label: "Gross Tokens",
      amount: `${params.tokenAmount} $BABTC`,
      sublabel: `${params.proofCount} proofs`,
    });
    costs.push({
      label: `Platform Fee (${params.platformFeePercent}%)`,
      amount: `-${params.platformFeeTokens ?? "0"} $BABTC`,
      sublabel: "supports development",
    });
    costs.push({
      label: "You Receive",
      amount: `${netAmount} $BABTC`,
    });
  } else {
    costs.push({
      label: "Tokens to Claim",
      amount: `${netAmount} $BABTC`,
      sublabel: `${params.proofCount} proofs`,
    });
  }

  return {
    type: "claim",
    title: "Claim Mining Rewards",
    description:
      "Convert your mining work into $BABTC tokens. This will create a Bitcoin transaction that mints your tokens.",
    steps: [
      "Build claim transaction with your mining proofs",
      "Sign transaction with your wallet",
      "Broadcast to Bitcoin network",
      "Tokens minted after confirmation (~10-30 min)",
    ],
    costs,
    totalSats: params.networkFee,
    formattedTotal: `${netAmount} $BABTC`,
    feeEstimate: params.feeRate
      ? `${params.networkFee} sats (${params.feeRate} sat/vB)`
      : `${params.networkFee} sats`,
    source: params.fromAddress,
    estimatedTime: "~10-30 minutes",
    additionalInfo:
      "You pay the Bitcoin network fee. This transaction cannot be reversed once broadcast.",
  };
}

export default TransactionConfirmModal;
