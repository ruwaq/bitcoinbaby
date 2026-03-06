"use client";

/**
 * Send Bitcoin Page
 *
 * Complete send flow with:
 * - Recipient address input with validation
 * - Amount input with BTC/sats conversion
 * - Fee selection (slow/medium/fast)
 * - Transaction review step
 * - PSBT creation, signing, and broadcast
 * - Success/error feedback with explorer link
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletConnection, useBalance } from "@/hooks";
import { useNetworkStore } from "@bitcoinbaby/core";
import {
  TransactionBuilder,
  createMempoolClient,
  type TxUTXO,
} from "@bitcoinbaby/bitcoin";

import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import {
  AddressInput,
  AmountInput,
  FeeSelector,
  TransactionReview,
  SendConfirmation,
  getFeeRateForLevel,
  type FeeLevel,
} from "./components";

// Steps in the send flow
type SendStep = "input" | "review" | "result";

// Send state (feeRate is derived from feeLevel + feeEstimates, not stored)
interface SendState {
  recipient: string;
  isRecipientValid: boolean;
  amountBtc: string;
  amountSatoshis: number;
  isAmountValid: boolean;
  feeLevel: FeeLevel;
}

// Default vsize estimate for a simple P2TR transfer (1 input, 2 outputs)
const DEFAULT_VSIZE = 154;

export default function SendPage() {
  const router = useRouter();

  // Network and wallet hooks
  const { network, config } = useNetworkStore();
  const {
    address,
    isLocked,
    isLoading: walletLoading,
    withPrivateKey,
  } = useWalletConnection();

  // Check if wallet exists (address is set when wallet is unlocked)
  const hasStoredWallet = Boolean(address || isLocked);

  // Balance hook
  const {
    balance,
    utxos,
    fees: feeEstimates,
    isLoading: balanceLoading,
    refresh: refreshBalance,
  } = useBalance({
    address: address ?? undefined,
    network,
    autoRefresh: !isLocked,
    refreshInterval: 30000,
  });

  // Current step
  const [step, setStep] = useState<SendStep>("input");

  // Send form state
  const [sendState, setSendState] = useState<SendState>({
    recipient: "",
    isRecipientValid: false,
    amountBtc: "",
    amountSatoshis: 0,
    isAmountValid: false,
    feeLevel: "medium",
  });

  // Derive feeRate from feeLevel and feeEstimates to avoid race conditions
  const currentFeeRate = useMemo(() => {
    return getFeeRateForLevel(sendState.feeLevel, feeEstimates);
  }, [sendState.feeLevel, feeEstimates]);

  // Transaction state
  const [isProcessing, setIsProcessing] = useState(false);
  const [txResult, setTxResult] = useState<{
    success: boolean;
    txid?: string;
    error?: string;
  } | null>(null);

  // Calculate estimated fee based on vsize and fee rate
  const estimatedFee = useMemo(() => {
    return Math.ceil(DEFAULT_VSIZE * currentFeeRate);
  }, [currentFeeRate]);

  // Available balance in satoshis
  const availableBalance = balance?.total ?? 0;

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      sendState.isRecipientValid &&
      sendState.isAmountValid &&
      sendState.amountSatoshis > 0 &&
      sendState.amountSatoshis + estimatedFee <= availableBalance
    );
  }, [sendState, estimatedFee, availableBalance]);

  // Handle address change
  const handleAddressChange = useCallback((value: string, isValid: boolean) => {
    setSendState((prev) => ({
      ...prev,
      recipient: value,
      isRecipientValid: isValid,
    }));
  }, []);

  // Handle amount change
  const handleAmountChange = useCallback(
    (btcValue: string, satoshis: number, isValid: boolean) => {
      setSendState((prev) => ({
        ...prev,
        amountBtc: btcValue,
        amountSatoshis: satoshis,
        isAmountValid: isValid,
      }));
    },
    [],
  );

  // Handle fee selection (feeRate param is ignored, derived from feeLevel)
  const handleFeeSelect = useCallback((level: FeeLevel, _feeRate: number) => {
    setSendState((prev) => ({
      ...prev,
      feeLevel: level,
    }));
  }, []);

  // Proceed to review
  const handleReview = useCallback(() => {
    if (isFormValid) {
      setStep("review");
    }
  }, [isFormValid]);

  // Go back to input
  const handleBack = useCallback(() => {
    setStep("input");
  }, []);

  // Send transaction
  // SECURITY: Uses withPrivateKey which automatically zeros key after use
  const handleSend = useCallback(async () => {
    if (!address || !utxos || isLocked) {
      setTxResult({ success: false, error: "Wallet not available" });
      setStep("result");
      return;
    }

    setIsProcessing(true);

    try {
      // Convert UTXOs to TxUTXO format
      const txUtxos: TxUTXO[] = TransactionBuilder.convertUTXOs(
        utxos,
        address,
        network,
      );

      // Create transaction builder
      const builder = new TransactionBuilder({
        network,
        feeRate: currentFeeRate,
        enableRBF: true,
      });

      // Select coins
      const selection = builder.selectCoins(txUtxos, sendState.amountSatoshis);

      // Build transfer transaction
      const unsignedTx = builder.buildTransfer(
        selection.inputs,
        sendState.recipient,
        sendState.amountSatoshis,
        address, // change back to sender
      );

      // Build PSBT
      const psbt = builder.buildPSBT(unsignedTx);

      // Update inputs with proper witness UTXOs
      for (let i = 0; i < unsignedTx.inputs.length; i++) {
        const input = unsignedTx.inputs[i];
        psbt.updateInput(i, {
          witnessUtxo: {
            script: Buffer.from(input.utxo.witnessUtxo?.script || []),
            value: input.utxo.value,
          },
        });
      }

      // Sign PSBT using unified withPrivateKey (key zeroed automatically)
      const result = await withPrivateKey(async (privateKey) => {
        builder.signPSBT(psbt, privateKey);

        // Finalize and extract transaction
        const signedTx = builder.finalizePSBT(psbt);

        // Broadcast transaction with timeout
        const mempoolClient = createMempoolClient({ network });
        const broadcastPromise = mempoolClient.broadcastTransaction(
          signedTx.hex,
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("BROADCAST_TIMEOUT")),
            30000, // 30 second timeout
          ),
        );

        const txid = await Promise.race([broadcastPromise, timeoutPromise]);
        return { txid };
      });

      if (result?.txid) {
        // Success
        setTxResult({
          success: true,
          txid: result.txid,
        });

        // Refresh balance after broadcast
        setTimeout(() => refreshBalance(), 3000);
      } else {
        throw new Error("Failed to sign or broadcast transaction");
      }
    } catch (error) {
      console.error("Transaction failed:", error);

      // Classify error for better UX with helpful details
      let errorMessage: string;
      if (error instanceof Error) {
        if (error.message === "BROADCAST_TIMEOUT") {
          errorMessage =
            "Network timeout. Transaction may still be pending. Check explorer.";
        } else if (
          error.message.includes("fetch") ||
          error.message.includes("network")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (error.message.includes("insufficient")) {
          // Provide detailed info about the shortfall
          const totalNeeded = sendState.amountSatoshis + estimatedFee;
          const shortfall = totalNeeded - availableBalance;
          errorMessage = `Insufficient funds. Need ${(totalNeeded / 100_000_000).toFixed(8)} BTC (amount + fee), have ${(availableBalance / 100_000_000).toFixed(8)} BTC. Short by ${(shortfall / 100_000_000).toFixed(8)} BTC.`;
        } else if (error.message.includes("dust")) {
          errorMessage =
            "Amount too small. Minimum is 546 satoshis (0.00000546 BTC).";
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = "Unknown error occurred";
      }

      setTxResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsProcessing(false);
      setStep("result");
    }
  }, [
    address,
    utxos,
    isLocked,
    network,
    sendState,
    withPrivateKey,
    refreshBalance,
  ]);

  // Reset form for another send
  const handleSendAnother = useCallback(() => {
    setSendState({
      recipient: "",
      isRecipientValid: false,
      amountBtc: "",
      amountSatoshis: 0,
      isAmountValid: false,
      feeLevel: "medium",
    });
    setTxResult(null);
    setStep("input");
    refreshBalance();
  }, [refreshBalance]);

  // Navigate to wallet
  const handleViewWallet = useCallback(() => {
    router.push("/wallet");
  }, [router]);

  // Redirect if no wallet or locked
  if (!hasStoredWallet) {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
        <div className="max-w-md mx-auto text-center py-12">
          <h1 className="font-pixel text-xl text-pixel-primary mb-4">
            NO WALLET FOUND
          </h1>
          <p className="font-pixel-body text-sm text-pixel-text-muted mb-6">
            Create or import a wallet to send Bitcoin
          </p>
          <a
            href="/wallet"
            className={`inline-block px-8 py-4 font-pixel text-sm ${pixelBorders.thick} ${pixelShadows.md} bg-pixel-primary text-black hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
          >
            GO TO WALLET
          </a>
        </div>
      </main>
    );
  }

  if (isLocked) {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
            <span className="font-pixel text-3xl text-pixel-error">LOCK</span>
          </div>
          <h1 className="font-pixel text-xl text-pixel-primary mb-4">
            WALLET LOCKED
          </h1>
          <p className="font-pixel-body text-sm text-pixel-text-muted mb-6">
            Unlock your wallet to send Bitcoin
          </p>
          <a
            href="/wallet"
            className={`inline-block px-8 py-4 font-pixel text-sm ${pixelBorders.thick} ${pixelShadows.md} bg-pixel-success text-black hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
          >
            UNLOCK WALLET
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="font-pixel text-xl text-pixel-primary">
              SEND BITCOIN
            </h1>
            <a
              href="/wallet"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
            >
              BACK
            </a>
          </div>
          <p className="font-pixel-body text-sm text-pixel-text-muted mt-2">
            {network === "mainnet" ? "Mainnet" : "Testnet4"} - Taproot
          </p>
        </header>

        {/* Loading state */}
        {(walletLoading || balanceLoading) && step === "input" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-pixel-primary border-t-transparent animate-spin" />
            <p className="font-pixel text-sm text-pixel-text-muted">
              LOADING...
            </p>
          </div>
        )}

        {/* Input Step */}
        {step === "input" && !walletLoading && !balanceLoading && (
          <div
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 ${pixelShadows.md} sm:${pixelShadows.lg} space-y-4 sm:space-y-6`}
          >
            {/* Balance display */}
            <div className="bg-pixel-bg-dark p-4 border-2 border-pixel-border">
              <div className="flex items-center justify-between mb-1">
                <label className="font-pixel text-[8px] text-pixel-text-muted">
                  AVAILABLE BALANCE
                </label>
                <button
                  onClick={refreshBalance}
                  disabled={balanceLoading}
                  className="font-pixel text-[6px] text-pixel-text-muted hover:text-pixel-primary disabled:opacity-50"
                >
                  {balanceLoading ? "..." : "REFRESH"}
                </button>
              </div>
              <span className="font-pixel text-xl text-pixel-text">
                {(availableBalance / 100_000_000).toFixed(8)} BTC
              </span>
              <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                {availableBalance.toLocaleString()} satoshis
              </p>
            </div>

            {/* Address input */}
            <AddressInput
              value={sendState.recipient}
              onChange={handleAddressChange}
              network={network}
              disabled={isProcessing}
            />

            {/* Amount input */}
            <AmountInput
              value={sendState.amountBtc}
              onChange={handleAmountChange}
              maxSatoshis={availableBalance}
              estimatedFee={estimatedFee}
              disabled={isProcessing}
            />

            {/* Fee selector */}
            <FeeSelector
              feeEstimates={feeEstimates}
              selectedLevel={sendState.feeLevel}
              onSelect={handleFeeSelect}
              vsize={DEFAULT_VSIZE}
              disabled={isProcessing}
              isLoading={balanceLoading}
            />

            {/* Continue button */}
            <button
              type="button"
              onClick={handleReview}
              disabled={!isFormValid || isProcessing}
              className={`w-full py-4 font-pixel text-sm text-black bg-pixel-primary ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              REVIEW TRANSACTION
            </button>

            {/* Insufficient funds warning */}
            {availableBalance < 1000 && (
              <div className="bg-pixel-error/20 border-2 border-pixel-error p-3">
                <p className="font-pixel text-[8px] text-pixel-error text-center">
                  Insufficient balance to send a transaction
                </p>
                {network === "testnet4" && (
                  <p className="font-pixel text-[6px] text-pixel-text-muted text-center mt-1">
                    Get testnet BTC from a faucet
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Review Step */}
        {step === "review" && address && (
          <div
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 ${pixelShadows.md} sm:${pixelShadows.lg}`}
          >
            <TransactionReview
              recipient={sendState.recipient}
              amountSatoshis={sendState.amountSatoshis}
              feeLevel={sendState.feeLevel}
              feeRate={currentFeeRate}
              feeSatoshis={estimatedFee}
              senderAddress={address}
              network={network}
              onConfirm={handleSend}
              onBack={handleBack}
              isLoading={isProcessing}
              totalBalance={availableBalance}
            />
          </div>
        )}

        {/* Result Step */}
        {step === "result" && txResult && (
          <div
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 ${pixelShadows.md} sm:${pixelShadows.lg}`}
          >
            <SendConfirmation
              status={txResult.success ? "success" : "error"}
              txid={txResult.txid}
              errorMessage={txResult.error}
              explorerUrl={config.explorerUrl}
              amountSatoshis={sendState.amountSatoshis}
              recipient={sendState.recipient}
              onSendAnother={handleSendAnother}
              onViewWallet={handleViewWallet}
            />
          </div>
        )}

        {/* Security info */}
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-pixel-bg-light border-4 border-dashed border-pixel-border">
          <h3 className="font-pixel text-xs text-pixel-secondary mb-3">
            TRANSACTION INFO
          </h3>
          <ul className="space-y-2 font-pixel-body text-sm text-pixel-text-muted">
            <li>
              <span className="text-pixel-success">*</span> Transactions are
              signed locally
            </li>
            <li>
              <span className="text-pixel-success">*</span> Private keys never
              leave your device
            </li>
            <li>
              <span className="text-pixel-primary">*</span> Bitcoin transactions
              are irreversible
            </li>
            <li>
              <span className="text-pixel-primary">*</span> Always verify the
              recipient address
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
