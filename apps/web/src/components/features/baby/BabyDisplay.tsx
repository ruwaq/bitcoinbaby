"use client";

/**
 * BabyDisplay - Baby sprite card with stats HUD
 *
 * Shows the baby sprite, name, current state, and stats HUD.
 * Used as the main visual component in BabySection.
 */

import {
  LevelSprite,
  GameHUD,
  ActionButtons,
  type GameAction,
} from "@bitcoinbaby/ui";
import { pixelCard } from "@bitcoinbaby/ui";
import type { BabyVisualState } from "@/hooks/useBabyState";

interface BabyDisplayProps {
  /** Baby name */
  name: string;
  /** Baby visual state (derived from baby stats) */
  babyState: BabyVisualState | null;
  /** Days until decay (inactivity penalty) */
  daysUntilDecay?: number;
  /** Whether mining is currently running */
  isMining: boolean;
  /** Whether baby is dead */
  isDead: boolean;
  /** Action callback */
  onAction: (action: GameAction) => void;
}

export function BabyDisplay({
  name,
  babyState,
  daysUntilDecay,
  isMining,
  isDead,
  onAction,
}: BabyDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Baby Card */}
      <div className={`${pixelCard.primary} p-8 w-full max-w-sm`}>
        {/* Name & Stage */}
        <div className="flex justify-between items-center mb-4">
          <span className="font-pixel text-sm text-pixel-primary">{name}</span>
          <span className="font-pixel text-[10px] text-pixel-text-muted">
            {babyState?.visualState.toUpperCase() || "IDLE"}
          </span>
        </div>

        {/* Baby Sprite */}
        <div className="flex justify-center mb-6">
          <LevelSprite
            level={babyState?.level || 1}
            state={babyState?.visualState || "idle"}
            size={192}
          />
        </div>

        {/* Stats HUD */}
        {babyState && (
          <GameHUD
            stats={{
              energy: babyState.energy,
              happiness: babyState.happiness,
              hunger: babyState.hunger,
              health: babyState.health,
            }}
            progression={{
              level: babyState.level,
              xp: babyState.xp,
              xpToNextLevel: babyState.xpToNextLevel,
              stageName: babyState.stageName,
            }}
            isMining={babyState.isMining}
            miningBonus={babyState.miningBonus}
            daysUntilDecay={daysUntilDecay}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 w-full max-w-sm">
        <ActionButtons
          onAction={onAction}
          isSleeping={babyState?.isSleeping}
          isMining={isMining}
          disabled={isDead}
          energy={babyState?.energy}
        />
      </div>
    </div>
  );
}

export default BabyDisplay;
