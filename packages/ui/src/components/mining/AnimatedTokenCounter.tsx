"use client";

/**
 * AnimatedTokenCounter
 *
 * Real-time animated token counter with gamified UX.
 * Based on 2025 best practices:
 * - Instant visual feedback
 * - Micro-animations (glow, particles)
 * - Smooth number transitions
 * - Streak/bonus indicators
 *
 * @see https://arounda.agency/blog/gamification-in-product-design-in-2024-ui-ux
 */

import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import clsx from "clsx";

// =============================================================================
// TYPES
// =============================================================================

interface AnimatedTokenCounterProps {
  /** Current balance value */
  value: bigint | number | string;
  /** Previous balance (for animation delta) */
  previousValue?: bigint | number | string;
  /** Token symbol */
  symbol?: string;
  /** Show increment animation */
  animateIncrements?: boolean;
  /** Duration of count animation in ms */
  animationDuration?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Show particle effects on increment */
  showParticles?: boolean;
  /** Show glow effect on increment */
  showGlow?: boolean;
  /** Streak multiplier (shows bonus indicator) */
  streakMultiplier?: number;
  /** Recent reward amount (for popup) */
  recentReward?: bigint | number | string;
  /** Custom class name */
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  char: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  return BigInt(value || "0");
}

function formatToken(value: bigint): string {
  const str = value.toString();
  // Add thousand separators
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// =============================================================================
// PARTICLE COMPONENT
// =============================================================================

const TokenParticle: React.FC<{
  particle: Particle;
  onComplete: () => void;
}> = ({ particle, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <span
      className="absolute pointer-events-none animate-token-float font-pixel text-pixel-primary"
      style={{
        left: `${particle.x}%`,
        top: `${particle.y}%`,
        fontSize: "0.75rem",
      }}
    >
      {particle.char}
    </span>
  );
};

// =============================================================================
// REWARD POPUP
// =============================================================================

const RewardPopup: React.FC<{
  amount: string;
  multiplier?: number;
  onComplete: () => void;
}> = ({ amount, multiplier, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-reward-popup pointer-events-none">
      <span className="text-pixel-primary font-pixel text-sm whitespace-nowrap">
        +{amount}
        {multiplier && multiplier > 1 && (
          <span className="text-yellow-400 ml-1">x{multiplier}</span>
        )}
      </span>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AnimatedTokenCounter({
  value,
  previousValue: _previousValue,
  symbol = "$BABY",
  animateIncrements = true,
  animationDuration = 500,
  size = "md",
  showParticles = true,
  showGlow = true,
  streakMultiplier,
  recentReward,
  className,
}: AnimatedTokenCounterProps) {
  const currentValue = toBigInt(value);

  // Animation state
  const [displayValue, setDisplayValue] = useState(currentValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showReward, setShowReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState("0");
  const animationRef = useRef<number | null>(null);
  const particleIdRef = useRef(0);

  // Size styles
  const sizeStyles = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-3xl",
  };

  // Animate value changes
  useEffect(() => {
    if (!animateIncrements || currentValue === displayValue) return;

    const delta = currentValue - displayValue;
    if (delta <= 0n) {
      setDisplayValue(currentValue);
      return;
    }

    // Show reward popup
    if (recentReward) {
      const rewardBigInt = toBigInt(recentReward);
      setRewardAmount(formatToken(rewardBigInt));
      setShowReward(true);
    }

    // Spawn particles
    if (showParticles) {
      const newParticles: Particle[] = [];
      const particleCount = Math.min(Number(delta / 10n) + 1, 8);
      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: particleIdRef.current++,
          x: 30 + Math.random() * 40,
          y: 20 + Math.random() * 30,
          char: ["+", "*", "o", "."][Math.floor(Math.random() * 4)],
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
    }

    // Animate count
    setIsAnimating(true);
    const startValue = displayValue;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated =
        startValue + BigInt(Math.floor(Number(delta) * eased));

      setDisplayValue(interpolated);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(currentValue);
        setIsAnimating(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    currentValue,
    animateIncrements,
    animationDuration,
    showParticles,
    recentReward,
  ]);

  // Remove particle
  const removeParticle = useCallback((id: number) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Hide reward popup
  const hideReward = useCallback(() => {
    setShowReward(false);
  }, []);

  return (
    <div
      className={clsx(
        "relative inline-flex items-center gap-2 font-pixel",
        sizeStyles[size],
        className,
      )}
    >
      {/* Glow effect */}
      {showGlow && isAnimating && (
        <div className="absolute inset-0 animate-token-glow rounded-lg bg-pixel-primary/20 blur-md" />
      )}

      {/* Main counter */}
      <div
        className={clsx(
          "relative flex items-baseline gap-1 transition-transform",
          isAnimating && "scale-105",
        )}
      >
        <span
          className={clsx(
            "tabular-nums tracking-tight text-pixel-primary",
            isAnimating && "animate-pulse",
          )}
        >
          {formatToken(displayValue)}
        </span>
        <span className="text-pixel-secondary opacity-80 text-[0.7em]">
          {symbol}
        </span>
      </div>

      {/* Streak indicator */}
      {streakMultiplier && streakMultiplier > 1 && (
        <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 text-[0.6em]">
          x{streakMultiplier.toFixed(1)}
        </span>
      )}

      {/* Particles */}
      {particles.map((particle) => (
        <TokenParticle
          key={particle.id}
          particle={particle}
          onComplete={() => removeParticle(particle.id)}
        />
      ))}

      {/* Reward popup */}
      {showReward && (
        <RewardPopup
          amount={rewardAmount}
          multiplier={streakMultiplier}
          onComplete={hideReward}
        />
      )}
    </div>
  );
}

// =============================================================================
// COMPACT VERSION FOR INLINE USE
// =============================================================================

export function TokenCounterBadge({
  value,
  symbol = "$BABY",
  className,
}: {
  value: bigint | number | string;
  symbol?: string;
  className?: string;
}) {
  const formattedValue = formatToken(toBigInt(value));

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5",
        "bg-pixel-bg-dark/80 border border-pixel-primary/30 rounded",
        "font-pixel text-xs text-pixel-primary",
        className,
      )}
    >
      {formattedValue}
      <span className="text-pixel-secondary opacity-70">{symbol}</span>
    </span>
  );
}
