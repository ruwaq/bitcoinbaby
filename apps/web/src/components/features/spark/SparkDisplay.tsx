"use client";

/**
 * SparkDisplay - Spark sprite card with stats HUD
 *
 * Shows the spark sprite, name, current state, and stats HUD.
 * Used as the main visual component in Section.
 */

import {
  LevelSprite,
  GameHUD,
  ActionButtons,
  type GameAction,
} from "@bitcoinbaby/ui";
import { pixelCard } from "@bitcoinbaby/ui";
import type { SparkVisualState } from "@/hooks/useSparkState";

interface SparkDisplayProps {
  /** Spark name */
  name: string;
  /** Spark visual state (derived from spark stats) */
  sparkState: SparkVisualState | null;
  /** Days until decay (inactivity penalty) */
  daysUntilDecay?: number;
  /** Whether mining is currently running */
  isMining: boolean;
  /** Whether spark is dead */
  isDead: boolean;
  /** Action callback */
  onAction: (action: GameAction) => void;
}

export function SparkDisplay({
  name,
  sparkState,
  daysUntilDecay,
  isMining,
  isDead,
  onAction,
}: SparkDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Spark Card */}
      <div className={`${pixelCard.primary} p-8 w-full max-w-sm`}>
        {/* Name & Stage */}
        <div className="flex justify-between items-center mb-4">
          <span className="font-pixel text-sm text-pixel-primary">{name}</span>
          <span className="font-pixel text-[10px] text-pixel-text-muted">
            {sparkState?.visualState.toUpperCase() || "IDLE"}
          </span>
        </div>

        {/* Spark Sprite */}
        <div className="flex justify-center mb-6">
          <LevelSprite
            level={sparkState?.level || 1}
            state={sparkState?.visualState || "idle"}
            size={192}
          />
        </div>

        {/* Stats HUD */}
        {sparkState && (
          <GameHUD
            stats={{
              energy: sparkState.energy,
              happiness: sparkState.happiness,
              hunger: sparkState.hunger,
              health: sparkState.health,
            }}
            progression={{
              level: sparkState.level,
              xp: sparkState.xp,
              xpToNextLevel: sparkState.xpToNextLevel,
              stageName: sparkState.stageName,
            }}
            isMining={sparkState.isMining}
            miningBonus={sparkState.miningBonus}
            daysUntilDecay={daysUntilDecay}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 w-full max-w-sm">
        <ActionButtons
          onAction={onAction}
          isSleeping={sparkState?.isSleeping}
          isMining={isMining}
          disabled={isDead}
          energy={sparkState?.energy}
        />
      </div>
    </div>
  );
}

export default SparkDisplay;