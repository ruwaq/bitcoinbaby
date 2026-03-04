"use client";

/**
 * AchievementPopup - Achievement Notification
 *
 * Animated popup that appears when an achievement is unlocked.
 */

import { type FC, useEffect, useState } from "react";
import { clsx } from "clsx";
import { PixelIcon } from "../sprites";

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward?: number;
}

interface AchievementPopupProps {
  achievement: AchievementData | null;
  onDismiss: () => void;
  duration?: number;
  className?: string;
}

export const AchievementPopup: FC<AchievementPopupProps> = ({
  achievement,
  onDismiss,
  duration = 4000,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      setIsExiting(false);

      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, duration - 300);

      const dismissTimer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, duration);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [achievement, duration, onDismiss]);

  if (!achievement || !isVisible) {
    return null;
  }

  return (
    <div
      className={clsx(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50",
        "transition-all duration-300",
        isExiting ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0",
        className,
      )}
    >
      <div
        className={clsx(
          "bg-pixel-bg-dark border-4 border-pixel-primary",
          "shadow-[4px_4px_0_0_#000]",
          "p-4 min-w-[280px]",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl animate-bounce">{achievement.icon}</div>
          <div>
            <div className="font-pixel text-pixel-primary text-sm">
              LOGRO DESBLOQUEADO!
            </div>
            <div className="font-pixel text-white text-lg">
              {achievement.name}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="font-pixel text-xs text-pixel-text-muted mb-2">
          {achievement.description}
        </p>

        {/* XP Reward */}
        {achievement.xpReward && achievement.xpReward > 0 && (
          <div className="flex items-center justify-center gap-2 bg-pixel-primary/20 p-2">
            <span className="font-pixel text-pixel-primary text-sm">
              +{achievement.xpReward} XP
            </span>
          </div>
        )}

        {/* Sparkle decorations */}
        <PixelIcon
          name="sparkle"
          size={20}
          className="absolute -top-2 -left-2 animate-ping text-pixel-primary"
        />
        <PixelIcon
          name="sparkle"
          size={20}
          className="absolute -top-2 -right-2 animate-ping text-pixel-primary"
          style={{ animationDelay: "100ms" }}
        />
        <PixelIcon
          name="sparkle"
          size={20}
          className="absolute -bottom-2 left-1/2 animate-ping text-pixel-primary"
          style={{ animationDelay: "200ms" }}
        />
      </div>
    </div>
  );
};

export default AchievementPopup;
