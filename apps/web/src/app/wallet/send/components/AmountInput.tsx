"use client";

/**
 * AmountInput Component
 *
 * Bitcoin amount input with BTC/sats conversion and MAX button.
 */

import { useState, useCallback, useMemo } from "react";
import { DUST_THRESHOLD, btcToSats, satsToBtc } from "@/utils/format";

interface AmountInputProps {
  value: string;
  onChange: (btcValue: string, satoshis: number, isValid: boolean) => void;
  maxSatoshis: number;
  estimatedFee: number;
  disabled?: boolean;
}

export function AmountInput({
  value,
  onChange,
  maxSatoshis,
  estimatedFee,
  disabled = false,
}: AmountInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [displayMode, setDisplayMode] = useState<"btc" | "sats">("btc");
  const [error, setError] = useState<string | null>(null);

  // Calculate available balance (after fee)
  const availableBalance = useMemo(() => {
    return Math.max(0, maxSatoshis - estimatedFee);
  }, [maxSatoshis, estimatedFee]);

  // Validate and handle change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty input
      if (inputValue === "" || inputValue === ".") {
        setError(null);
        onChange("", 0, false);
        return;
      }

      // Validate format (numbers and single decimal point)
      if (!/^\d*\.?\d*$/.test(inputValue)) {
        return;
      }

      // Limit decimal places to 8 for BTC
      const parts = inputValue.split(".");
      if (parts.length > 1 && parts[1].length > 8) {
        return;
      }

      const satoshis = btcToSats(inputValue);

      // Validation checks
      if (satoshis < DUST_THRESHOLD && satoshis > 0) {
        setError(`Minimum amount is ${DUST_THRESHOLD} sats (dust threshold)`);
        onChange(inputValue, satoshis, false);
        return;
      }

      if (satoshis > availableBalance) {
        setError(`Insufficient funds. Max: ${satsToBtc(availableBalance)} BTC`);
        onChange(inputValue, satoshis, false);
        return;
      }

      setError(null);
      onChange(inputValue, satoshis, satoshis >= DUST_THRESHOLD);
    },
    [availableBalance, onChange],
  );

  // Handle MAX button
  const handleMax = useCallback(() => {
    if (availableBalance <= DUST_THRESHOLD) {
      setError("Insufficient funds after fee");
      onChange("", 0, false);
      return;
    }

    const maxBtc = satsToBtc(availableBalance);
    setError(null);
    onChange(maxBtc, availableBalance, true);
  }, [availableBalance, onChange]);

  // Toggle display mode
  const toggleDisplayMode = () => {
    setDisplayMode((prev) => (prev === "btc" ? "sats" : "btc"));
  };

  // Current value in satoshis
  const currentSatoshis = btcToSats(value);

  // Warning threshold for small amounts (expensive to spend later)
  const SMALL_AMOUNT_WARNING = 5000; // 5000 sats
  const isSmallAmount =
    currentSatoshis > DUST_THRESHOLD && currentSatoshis < SMALL_AMOUNT_WARNING;

  // Format display values
  const displaySatoshis = currentSatoshis.toLocaleString();
  const displayMaxBtc = satsToBtc(availableBalance);
  const displayMaxSats = availableBalance.toLocaleString();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-pixel text-[10px] text-pixel-text-muted">
          AMOUNT
        </label>
        <button
          type="button"
          onClick={toggleDisplayMode}
          className="font-pixel text-[8px] text-pixel-secondary hover:text-pixel-primary"
        >
          {displayMode === "btc" ? "Show SATS" : "Show BTC"}
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="0.00000000"
          className={`
            w-full px-4 py-3 pr-24
            font-pixel-body text-xl
            bg-pixel-bg-dark text-pixel-text
            border-4 outline-none
            shadow-[inset_4px_4px_0_0_rgba(0,0,0,0.5)]
            placeholder:text-pixel-text-muted
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              error
                ? "border-pixel-error"
                : isFocused
                  ? "border-pixel-primary"
                  : "border-pixel-border"
            }
          `}
        />

        {/* BTC label and MAX button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="font-pixel text-xs text-pixel-text-muted">BTC</span>
          <button
            type="button"
            onClick={handleMax}
            disabled={disabled || availableBalance <= DUST_THRESHOLD}
            className="px-2 py-1 font-pixel text-[8px] bg-pixel-primary text-black border-2 border-black hover:bg-pixel-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Satoshi conversion */}
      {currentSatoshis > 0 && (
        <p className="font-pixel text-[8px] text-pixel-secondary">
          = {displaySatoshis} satoshis
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="font-pixel text-[8px] text-pixel-error">{error}</p>
      )}

      {/* Small amount warning */}
      {!error && isSmallAmount && (
        <div className="flex items-start gap-2 p-2 bg-pixel-warning/10 border border-pixel-warning/30">
          <span className="font-pixel text-[10px] text-pixel-warning">!</span>
          <p className="font-pixel text-[7px] text-pixel-warning">
            Small amounts may be expensive for the recipient to spend later due
            to network fees.
          </p>
        </div>
      )}

      {/* Available balance */}
      <div className="flex items-center justify-between pt-2 border-t border-pixel-border/50">
        <span className="font-pixel text-[8px] text-pixel-text-muted">
          AVAILABLE:
        </span>
        <span className="font-pixel text-[8px] text-pixel-text">
          {displayMode === "btc"
            ? `${displayMaxBtc} BTC`
            : `${displayMaxSats} sats`}
        </span>
      </div>

      {/* Fee warning */}
      {estimatedFee > 0 && (
        <p className="font-pixel text-[6px] text-pixel-text-muted">
          Estimated fee: {satsToBtc(estimatedFee)} BTC (
          {estimatedFee.toLocaleString()} sats)
        </p>
      )}
    </div>
  );
}
