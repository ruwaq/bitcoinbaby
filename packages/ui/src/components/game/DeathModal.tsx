"use client";

/**
 * DeathModal - Baby Death / Revival Screen
 *
 * Shown when baby reaches level 0 from inactivity decay.
 * Allows revival with a new start.
 */

import { type FC, useState } from "react";
import { clsx } from "clsx";
import { Button } from "../button";
import { PixelIcon } from "../sprites";

interface DeathModalProps {
  isOpen: boolean;
  babyName: string;
  onRevive: () => void;
  onViewStats?: () => void;
  className?: string;
}

export const DeathModal: FC<DeathModalProps> = ({
  isOpen,
  babyName,
  onRevive,
  onViewStats,
  className,
}) => {
  const [isReviving, setIsReviving] = useState(false);

  const handleRevive = () => {
    setIsReviving(true);
    // Small delay for animation
    setTimeout(() => {
      onRevive();
      setIsReviving(false);
    }, 1500);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50",
        "flex items-center justify-center",
        "bg-black/90",
        className,
      )}
    >
      <div
        className={clsx(
          "bg-pixel-bg-dark border-4 border-pixel-error p-8",
          "shadow-[8px_8px_0_0_#000]",
          "text-center max-w-sm",
        )}
      >
        {isReviving ? (
          // Revival animation
          <div className="animate-pulse">
            <PixelIcon
              name="bolt"
              size={64}
              className="mx-auto mb-4 animate-spin text-pixel-primary"
            />
            <div className="font-pixel text-pixel-primary text-xl">
              REVIVIENDO...
            </div>
          </div>
        ) : (
          <>
            {/* Death icon */}
            <PixelIcon
              name="skull"
              size={64}
              className="mx-auto mb-4 opacity-50 text-pixel-error"
            />

            {/* Message */}
            <div className="font-pixel text-pixel-error text-xl mb-2">
              OH NO!
            </div>
            <div className="font-pixel text-white text-lg mb-4">
              {babyName} ha caído...
            </div>

            {/* Explanation */}
            <p className="font-pixel text-xs text-pixel-text-muted mb-6 leading-relaxed">
              Tu Baby llegó a nivel 0 por falta de minado.
              <br />
              Pero no te preocupes, puedes revivirlo!
            </p>

            {/* Note about tokens */}
            <div className="bg-pixel-success/20 border-2 border-pixel-success p-3 mb-6">
              <p className="font-pixel text-xs text-pixel-success flex items-center justify-center gap-1">
                <PixelIcon name="star" size={12} />
                Tus $BABY tokens estan a salvo
              </p>
              <p className="font-pixel text-[10px] text-pixel-text-muted">
                Los tokens minados nunca se pierden
              </p>
            </div>

            {/* Revival info */}
            <div className="bg-pixel-bg-light p-4 mb-6">
              <div className="font-pixel text-xs text-pixel-text-muted mb-2">
                AL REVIVIR:
              </div>
              <ul className="font-pixel text-xs text-left text-pixel-text space-y-1">
                <li>• Empiezas en Nivel 1</li>
                <li>• Stats reducidos al 50%</li>
                <li>• Conservas tus logros</li>
                <li>• Conservas tus tokens</li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <Button
                variant="default"
                size="lg"
                onClick={handleRevive}
                className="w-full"
              >
                <PixelIcon name="sparkle" size={16} className="mr-2" />
                REVIVIR BABY
              </Button>

              {onViewStats && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewStats}
                  className="w-full"
                >
                  Ver estadísticas
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeathModal;
