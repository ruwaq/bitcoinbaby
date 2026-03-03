"use client";

/**
 * CreateBabyForm - Baby creation onboarding flow
 *
 * Two-step flow:
 * 1. Tutorial/Welcome screen explaining the game
 * 2. Name input form to create the baby
 */

import { useState } from "react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  InfoBanner,
} from "@bitcoinbaby/ui";

// Tutorial feature items
const TUTORIAL_FEATURES = [
  {
    icon: "⛏️",
    title: "MINE & TRAIN AI",
    description: "Earn $BABY while contributing to AI training",
  },
  {
    icon: "🍼",
    title: "CARE & EARN MORE",
    description: "Baby care gives you bonus rewards (+50%)",
  },
  {
    icon: "⭐",
    title: "EVOLVE",
    description: "Level up through 21 evolution stages",
  },
];

interface CreateBabyFormProps {
  /** Callback when baby is created */
  onCreate: (name: string, miningSharesBaseline?: number) => void;
  /** Current mining shares for baseline */
  currentMiningShares: number;
  /** Navigate to mining tab */
  onGoToMining: () => void;
}

export function CreateBabyForm({
  onCreate,
  currentMiningShares,
  onGoToMining,
}: CreateBabyFormProps) {
  const [name, setName] = useState("");
  const [showTutorial, setShowTutorial] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), currentMiningShares);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
      {showTutorial ? (
        // Tutorial/Welcome Screen
        <Card className="w-full max-w-md">
          <CardHeader>
            <h2 className="font-pixel text-lg text-pixel-primary text-center">
              WELCOME TO BITCOINBABY!
            </h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">👶</div>
              <p className="font-pixel-body text-sm text-pixel-text">
                Raise your own Baby and earn $BABY tokens!
              </p>
            </div>

            {/* PoUW Banner */}
            <InfoBanner variant="highlight" icon="🧠">
              <p className="font-pixel text-[9px] text-pixel-primary mb-1">
                PROOF OF USEFUL WORK
              </p>
              <p className="font-pixel-body text-[11px] text-pixel-text">
                Your mining trains artificial intelligence. Energy is not wasted
                on meaningless algorithms.
              </p>
            </InfoBanner>

            {/* Feature list */}
            <div className="space-y-4">
              {TUTORIAL_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 p-3 bg-pixel-bg-light border-2 border-pixel-border"
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <p className="font-pixel text-[10px] text-pixel-primary">
                      {feature.title}
                    </p>
                    <p className="font-pixel-body text-xs text-pixel-text-muted">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={() => setShowTutorial(false)} className="w-full">
              CREATE MY BABY
            </Button>

            <button
              onClick={onGoToMining}
              className="w-full font-pixel text-[10px] text-pixel-secondary hover:text-pixel-secondary-light"
            >
              Skip to Mining →
            </button>
          </CardContent>
        </Card>
      ) : (
        // Name Input Form
        <Card className="w-full max-w-sm">
          <CardHeader>
            <h2 className="font-pixel text-lg text-pixel-primary text-center">
              NAME YOUR BABY
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-pixel text-xs text-pixel-text-muted mb-2">
                  NAME
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My BitcoinBaby"
                  maxLength={20}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!name.trim()}>
                CREATE BABY
              </Button>
            </form>
            <button
              onClick={() => setShowTutorial(true)}
              className="w-full mt-4 font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-text"
            >
              ← Back to tutorial
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CreateBabyForm;
