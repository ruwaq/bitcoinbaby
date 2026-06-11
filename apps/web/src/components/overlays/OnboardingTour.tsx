"use client";

/**
 * OnboardingTour — Interactive step-by-step guide for new users
 *
 * Guides users through:
 * 1. Welcome — what is BitcoinBaby
 * 2. Create Wallet — secure your funds
 * 3. Create Baby — your AI-powered companion
 * 4. Start Mining — earn $BABY tokens
 * 5. Mint NFTs — boost your mining power
 * 6. Explore Stories — AI-generated narratives
 *
 * Only shows once (tracked in localStorage). Can be re-triggered from Help.
 */

import { useState, useCallback, useEffect } from "react";

interface Step {
  id: string;
  title: string;
  icon: string;
  description: string;
  action?: {
    label: string;
    tab?: string;
  };
  image?: string;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Welcome to BitcoinBaby! 👶",
    icon: "👶",
    description:
      "Raise your AI-powered pixel baby while mining Bitcoin. Your baby grows, evolves, and generates unique stories as you mine. Every hash helps train AI models — that's Proof of Useful Work!",
  },
  {
    id: "wallet",
    title: "1. Create Your Wallet",
    icon: "💰",
    description:
      "Create a Bitcoin wallet to receive $BABY tokens. In dev mode, you get 1 BTC free for testing! Your wallet is encrypted and stored locally — only you have access.",
    action: { label: "Go to Wallet", tab: "wallet" },
  },
  {
    id: "baby",
    title: "2. Create Your Baby (FREE!)",
    icon: "👶",
    description:
      "Your first baby is completely FREE — no NFT required! Choose a name and they'll be your AI companion. They grow as you mine, evolving through 21 stages from Hatchling to Cosmic Entity!",
    action: { label: "Go to Baby", tab: "baby" },
  },
  {
    id: "mining",
    title: "3. Start Mining ⛏️",
    icon: "⛏️",
    description:
      "Mining earns you $BABY tokens AND trains AI models. Your computer runs a local Gemma 4 model — every inference helps the Genesis Baby learn. Mining also gives your baby XP to level up!",
    action: { label: "Go to Mining", tab: "mining" },
  },
  {
    id: "nfts",
    title: "4. Mint Genesis Babies NFTs 🎨",
    icon: "🎨",
    description:
      "With $BABY tokens earned from mining, mint Genesis Babies NFTs! These boost your mining rewards. Higher rarity = bigger boost. Trade them on the marketplace!",
    action: { label: "Go to NFTs", tab: "nfts" },
  },
  {
    id: "stories",
    title: "5. Discover AI Stories 📖",
    icon: "📖",
    description:
      "As you mine, the AI generates unique stories about your baby's adventures. Each story is one-of-a-kind, created by the models your mining helps train. Read them in the Mining tab!",
  },
];

const STORAGE_KEY = "bitcoinbaby-onboarding-completed";

export function useOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial state derivation from localStorage
      setHasCompleted(false);
      // Auto-start after a short delay
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setIsOpen(false);
      localStorage.setItem(STORAGE_KEY, "true");
      setHasCompleted(true);
    }
  }, [currentStep]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
    setHasCompleted(true);
  }, []);

  return {
    isOpen,
    currentStep,
    totalSteps: STEPS.length,
    step: STEPS[currentStep],
    hasCompleted,
    start,
    next,
    prev,
    skip,
  };
}

interface OnboardingTourProps {
  isOpen: boolean;
  step: Step;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onNavigate: (tab: string) => void;
}

export function OnboardingTour({
  isOpen,
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onNavigate,
}: OnboardingTourProps) {
  if (!isOpen) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4">
      <div className="bg-pixel-bg-dark border-4 border-pixel-primary shadow-[8px_8px_0_0_#000] max-w-md w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 border-2 border-black ${
                i === currentStep
                  ? "bg-pixel-primary"
                  : i < currentStep
                    ? "bg-pixel-success"
                    : "bg-pixel-bg-light"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          className="text-5xl text-center mb-4"
          dangerouslySetInnerHTML={{ __html: step.icon }}
        />

        {/* Title */}
        <h2 className="font-pixel text-pixel-sm text-pixel-primary text-center mb-3">
          {step.title}
        </h2>

        {/* Description */}
        <p className="font-pixel-body text-body-sm text-pixel-text text-center mb-6 leading-relaxed">
          {step.description}
        </p>

        {/* Action button */}
        {step.action && (
          <button
            onClick={() => {
              onNavigate(step.action!.tab!);
              onNext();
            }}
            className="w-full mb-3 px-4 py-3 font-pixel text-[10px] bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all"
          >
            {step.action.label}
          </button>
        )}

        {/* Navigation */}
        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-bg-light text-pixel-text border-2 border-pixel-border hover:bg-pixel-bg-medium transition-colors"
            >
              ← BACK
            </button>
          )}
          <button
            onClick={onNext}
            className="flex-1 px-3 py-2 font-pixel text-[8px] bg-pixel-primary text-black border-2 border-black hover:bg-pixel-primary/80 transition-colors"
          >
            {isLast ? "🎉 LET'S GO!" : "NEXT →"}
          </button>
        </div>

        {/* Skip */}
        <button
          onClick={onSkip}
          className="w-full mt-2 font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-text transition-colors"
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}
