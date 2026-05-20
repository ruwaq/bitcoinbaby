/**
 * Shared animation constants for BitcoinBaby
 *
 * Uses Motion (ex-Framer Motion) for 60fps guaranteed animations.
 * All durations follow pixel-game aesthetic — snappy, not sluggish.
 */

import type { Variants, Transition } from "motion/react";

// =============================================================================
// TIMING
// =============================================================================

/** Snappy entrance — feels like 8-bit UI */
export const DURATION_FAST = 0.15;

/** Standard transition — card reveals, tab switches */
export const DURATION_NORMAL = 0.25;

/** Celebration, empty states */
export const DURATION_SLOW = 0.4;

// =============================================================================
// EASING
// =============================================================================

/** Spring bounce — for celebrations and success states */
export const SPRING_BOUNCE: Transition = { type: "spring", stiffness: 400, damping: 15 };

/** Smooth deceleration — for list reveals */
export const SPRING_SMOOTH: Transition = { type: "spring", stiffness: 300, damping: 25 };

/** Instant but styled — for hover/tap effects */
export const SPRING_TAP: Transition = { type: "spring", stiffness: 500, damping: 30 };

// =============================================================================
// VARIANTS
// =============================================================================

/** Card/list item entrance with stagger support */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: DURATION_NORMAL }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: { duration: DURATION_FAST }
  },
};

/** Scale bounce — for success/celebration */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: SPRING_BOUNCE
  },
};

/** Fade only — for tab transitions, overlays */
export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: DURATION_NORMAL }
  },
  exit: { 
    opacity: 0,
    transition: { duration: DURATION_FAST }
  },
};

// =============================================================================
// STAGGER CHILDREN
// =============================================================================

/** Container for staggered children — grid items, list items */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};
