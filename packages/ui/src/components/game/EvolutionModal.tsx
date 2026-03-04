"use client";

/**
 * EvolutionModal - Evolution Animation
 *
 * Dramatic modal that shows when baby evolves to a new stage.
 */

import { type FC, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Button } from "../button";
import { PixelIcon } from "../sprites";

interface EvolutionModalProps {
  isOpen: boolean;
  fromStage: string;
  toStage: string;
  newLevel: number;
  stageName: string;
  miningBonus: number;
  onComplete: () => void;
  className?: string;
}

export const EvolutionModal: FC<EvolutionModalProps> = ({
  isOpen,
  fromStage,
  toStage,
  newLevel,
  stageName,
  miningBonus,
  onComplete,
  className,
}) => {
  const [phase, setPhase] = useState<"flash" | "reveal" | "stats" | "done">(
    "flash",
  );

  useEffect(() => {
    if (isOpen) {
      setPhase("flash");

      // Flash phase
      const flashTimer = setTimeout(() => setPhase("reveal"), 1000);
      // Reveal phase
      const revealTimer = setTimeout(() => setPhase("stats"), 2500);
      // Stats phase
      const statsTimer = setTimeout(() => setPhase("done"), 4000);

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(revealTimer);
        clearTimeout(statsTimer);
      };
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50",
        "flex items-center justify-center",
        "bg-black/80",
        className,
      )}
    >
      <div className="relative text-center">
        {/* Flash effect */}
        {phase === "flash" && (
          <div className="animate-pulse">
            <PixelIcon
              name="bolt"
              size={80}
              className="mx-auto mb-4 animate-spin text-pixel-primary"
            />
            <div className="font-pixel text-white text-2xl animate-bounce">
              EVOLUCIONANDO...
            </div>
          </div>
        )}

        {/* Reveal new form */}
        {(phase === "reveal" || phase === "stats" || phase === "done") && (
          <div
            className={clsx(
              "bg-pixel-bg-dark border-4 border-pixel-primary p-8",
              "shadow-[8px_8px_0_0_#000]",
              "animate-[scale-in_0.5s_ease-out]",
            )}
          >
            {/* Celebration */}
            <PixelIcon
              name="star"
              size={48}
              className="mx-auto mb-4 animate-bounce text-pixel-primary"
            />

            {/* Stage transition */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="font-pixel text-pixel-text-muted text-sm">
                {fromStage}
              </div>
              <div className="text-2xl animate-pulse">→</div>
              <div className="font-pixel text-pixel-primary text-lg">
                {toStage}
              </div>
            </div>

            {/* New stage name */}
            <div className="font-pixel text-white text-2xl mb-2">
              {stageName}
            </div>

            <div className="font-pixel text-pixel-primary text-lg mb-6">
              Nivel {newLevel}
            </div>

            {/* Stats reveal */}
            {(phase === "stats" || phase === "done") && (
              <div
                className={clsx(
                  "bg-pixel-bg-light p-4 mb-6",
                  "animate-[fade-in_0.5s_ease-out]",
                )}
              >
                <div className="font-pixel text-xs text-pixel-text-muted mb-2">
                  NUEVO BONUS DE MINADO
                </div>
                <div className="font-pixel text-pixel-success text-xl">
                  +{Math.round((miningBonus - 1) * 100)}%
                </div>
              </div>
            )}

            {/* Continue button */}
            {phase === "done" && (
              <Button
                variant="default"
                size="lg"
                onClick={onComplete}
                className="animate-pulse"
              >
                CONTINUAR
              </Button>
            )}
          </div>
        )}

        {/* Particle effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <PixelIcon
              key={i}
              name="sparkle"
              size={20}
              className="absolute text-pixel-primary"
              style={{
                left: `${10 + ((i * 7) % 80)}%`,
                top: `${10 + ((i * 11) % 80)}%`,
                animation: `float-up ${2 + (i % 3)}s ease-out infinite`,
                animationDelay: `${(i * 0.2) % 2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default EvolutionModal;
