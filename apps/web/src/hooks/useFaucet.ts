"use client";

/**
 * useFaucet Hook
 *
 * Manages the BABTC faucet claim flow for Phase 1.
 * Users can claim 5 BABTC per day (up to 50 max) to evolve NFTs
 * before mining is active.
 *
 * States: idle → claiming → cooldown/maxed/error → idle
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getWorkersApiUrl, getPhaseConfig, type PhaseFeatures } from "@bitcoinbaby/shared";

// =============================================================================
// TYPES
// =============================================================================

export type FaucetState = "idle" | "claiming" | "cooldown" | "maxed" | "error";

export interface FaucetResult {
  /** Whether the claim succeeded */
  success: boolean;
  /** Amount credited (if successful) */
  amount: number;
  /** Timestamp (ms) when next claim is allowed */
  nextClaimAt: number;
  /** Total BABTC claimed via faucet */
  totalClaimed: number;
}

export interface UseFaucetOptions {
  /** Wallet address */
  address?: string | null;
}

export interface UseFaucetReturn {
  /** Current state of the faucet */
  state: FaucetState;
  /** Whether a claim is in progress */
  isLoading: boolean;
  /** Error message if in error state */
  error: string | null;
  /** Seconds remaining until next claim can be made */
  cooldownSeconds: number;
  /** Timestamp (ms) of when the cooldown ends */
  nextClaimAt: number | null;
  /** Total BABTC claimed via faucet */
  totalClaimed: number;
  /** Amount dispensed per claim */
  claimAmount: number;
  /** Whether the faucet feature is enabled (phase-gated) */
  isEnabled: boolean;
  /** Trigger a claim */
  claim: () => Promise<FaucetResult>;
  /** Reset faucet state (clear error, back to idle) */
  reset: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** localStorage key for persisting claim data */
const STORAGE_KEY = "babtc:faucet";

/** Cooldown window: 24 hours in ms */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Poll interval for cooldown countdown (1 second) */
const COUNTDOWN_INTERVAL_MS = 1000;

// =============================================================================
// PERSISTENCE
// =============================================================================

interface StoredFaucetData {
  lastClaimAt: number;
  totalClaimed: number;
}

function loadStoredData(address: string): StoredFaucetData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${address}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredFaucetData;
  } catch {
    return null;
  }
}

function saveStoredData(address: string, data: StoredFaucetData): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${address}`, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useFaucet(options: UseFaucetOptions = {}): UseFaucetReturn {
  const { address } = options;

  // Phase gating
  const phaseFeatures: PhaseFeatures = getPhaseConfig().features;
  const isEnabled = phaseFeatures.babtcFaucet && !!address;

  // Derive initial state from localStorage
  const getInitialState = useCallback((): {
    state: FaucetState;
    nextClaimAt: number | null;
    totalClaimed: number;
  } => {
    if (!address) {
      return { state: "idle", nextClaimAt: null, totalClaimed: 0 };
    }

    const stored = loadStoredData(address);
    if (!stored) {
      return { state: "idle", nextClaimAt: null, totalClaimed: 0 };
    }

    const now = Date.now();
    const nextClaimAt = stored.lastClaimAt + COOLDOWN_MS;

    if (now < nextClaimAt) {
      return {
        state: "cooldown",
        nextClaimAt,
        totalClaimed: stored.totalClaimed,
      };
    }

    return {
      state: "idle",
      nextClaimAt: null,
      totalClaimed: stored.totalClaimed,
    };
  }, [address]);

  const initial = getInitialState();

  const [state, setState] = useState<FaucetState>(initial.state);
  const [error, setError] = useState<string | null>(null);
  const [nextClaimAt, setNextClaimAt] = useState<number | null>(
    initial.nextClaimAt,
  );
  const [totalClaimed, setTotalClaimed] = useState<number>(
    initial.totalClaimed,
  );
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Ref for the API URL so it doesn't change across renders
  const apiUrlRef = useRef<string>("");
  useEffect(() => {
    apiUrlRef.current = getWorkersApiUrl();
  }, []);

  // Mounted flag
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state when address changes
  useEffect(() => {
    const newInitial = getInitialState();
    setState(newInitial.state);
    setNextClaimAt(newInitial.nextClaimAt);
    setTotalClaimed(newInitial.totalClaimed);
    setError(null);
  }, [address, getInitialState]);

  // Countdown timer for cooldown state
  useEffect(() => {
    if (state !== "cooldown" || !nextClaimAt) {
      setCooldownSeconds(0);
      return;
    }

    const tick = () => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((nextClaimAt - now) / 1000));

      setCooldownSeconds(remaining);

      // Transition back to idle when cooldown expires
      if (remaining <= 0) {
        setState("idle");
        setNextClaimAt(null);
        setCooldownSeconds(0);
      }
    };

    tick(); // Initial tick
    const interval = setInterval(tick, COUNTDOWN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state, nextClaimAt]);

  // ===========================================================================
  // CLAIM ACTION
  // ===========================================================================

  const claim = useCallback(async (): Promise<FaucetResult> => {
    if (!address) {
      return { success: false, amount: 0, nextClaimAt: 0, totalClaimed: 0 };
    }

    setState("claiming");
    setError(null);

    try {
      const apiUrl = apiUrlRef.current;
      const response = await fetch(`${apiUrl}/api/faucet/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Handle specific error cases
        if (
          response.status === 429 ||
          data.error?.includes("cooldown") ||
          data.error?.includes("wait")
        ) {
          // Cooldown active
          const nextAt = data.nextClaimAt || Date.now() + COOLDOWN_MS;
          const claimed = data.totalClaimed || 0;

          if (isMountedRef.current) {
            setState("cooldown");
            setNextClaimAt(nextAt);
            setTotalClaimed(claimed);
          }
          return {
            success: false,
            amount: 0,
            nextClaimAt: nextAt,
            totalClaimed: claimed,
          };
        }

        if (data.error?.includes("max") || data.error?.includes("Maximum")) {
          // Max claims reached
          if (isMountedRef.current) {
            setState("maxed");
            setTotalClaimed(data.totalClaimed || data.maxTotal || 50);
          }
          return {
            success: false,
            amount: 0,
            nextClaimAt: 0,
            totalClaimed: data.totalClaimed || 50,
          };
        }

        // Generic error
        const errorMsg = data.error || `Failed with status ${response.status}`;
        if (isMountedRef.current) {
          setState("error");
          setError(errorMsg);
        }
        return {
          success: false,
          amount: 0,
          nextClaimAt: 0,
          totalClaimed: 0,
        };
      }

      // Success
      const amount = data.data?.credited
        ? Number(data.data.credited)
        : 5;
      const now = Date.now();
      const nextAt = now + COOLDOWN_MS;

      // Persist to localStorage
      saveStoredData(address, {
        lastClaimAt: now,
        totalClaimed: data.data?.totalClaimed
          ? Number(data.data.totalClaimed)
          : totalClaimed + amount,
      });

      if (isMountedRef.current) {
        setState("cooldown");
        setNextClaimAt(nextAt);
        setTotalClaimed(
          data.data?.totalClaimed
            ? Number(data.data.totalClaimed)
            : totalClaimed + amount,
        );
      }

      return {
        success: true,
        amount,
        nextClaimAt: nextAt,
        totalClaimed: data.data?.totalClaimed
          ? Number(data.data.totalClaimed)
          : totalClaimed + amount,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Network error. Please try again.";
      if (isMountedRef.current) {
        setState("error");
        setError(errorMsg);
      }
      return { success: false, amount: 0, nextClaimAt: 0, totalClaimed: 0 };
    }
  }, [address, totalClaimed]);

  // ===========================================================================
  // RESET
  // ===========================================================================

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  return {
    state,
    isLoading: state === "claiming",
    error,
    cooldownSeconds,
    nextClaimAt,
    totalClaimed,
    claimAmount: 5,
    isEnabled,
    claim,
    reset,
  };
}

export default useFaucet;
