"use client";

/**
 * NotificationsPanel - Mining activity notifications
 *
 * Shows recent mining notifications with rewards.
 * Fixed height to prevent layout shifts.
 * Includes animations for new rewards.
 */

import { useEffect, useState, useRef } from "react";

interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  reward?: bigint;
}

interface NotificationsPanelProps {
  notifications: Notification[];
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  // Track new notifications for animation
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  // Track latest notification ID for animation triggering
  const latestId = notifications.length > 0 ? notifications[0].id : null;

  // Animate new notifications — uses a ref synced in-effect to avoid setState-in-effect
  const animatingRef = useRef(animatingIds);

  useEffect(() => {
    // Sync ref with current state at the start of the effect (not during render)
    animatingRef.current = animatingIds;

    if (latestId && !animatingRef.current.has(latestId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- animation trigger is the intended behavior
      setAnimatingIds((prev) => new Set([...prev, latestId]));
      // Remove animation after it completes
      const timeout = setTimeout(() => {
        setAnimatingIds((prev) => {
          const next = new Set(prev);
          next.delete(latestId);
          return next;
        });
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [latestId, animatingIds]);

  return (
    <div className="mb-6 min-h-[80px] overflow-hidden">
      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const isAnimating = animatingIds.has(notification.id);
            const isSuccess = notification.type === "success";

            return (
              <div
                key={notification.id}
                className={`p-3 border-4 transition-all duration-300 ${
                  isSuccess
                    ? "border-pixel-success bg-pixel-success/10"
                    : notification.type === "error"
                      ? "border-pixel-error bg-pixel-error/10"
                      : "border-pixel-border bg-pixel-bg-medium"
                } ${isAnimating && isSuccess ? "animate-pulse scale-[1.02] shadow-[0_0_20px_rgba(74,222,128,0.3)]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-pixel-xs text-pixel-text truncate flex items-center gap-2">
                    {isSuccess && isAnimating && (
                      <span className="text-pixel-success animate-bounce">
                        ✔
                      </span>
                    )}
                    {notification.title}
                  </span>
                  {notification.reward && (
                    <span
                      className={`font-pixel text-pixel-xs text-pixel-success whitespace-nowrap ${isAnimating ? "animate-pulse font-bold" : ""}`}
                    >
                      +{notification.reward.toString()} $BABY
                    </span>
                  )}
                </div>
                <p className="font-pixel-body text-body-xs text-pixel-text-muted mt-1 line-clamp-2">
                  {notification.message}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[80px] flex items-center justify-center">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted text-center">
            Mining activity will appear here
          </span>
        </div>
      )}
    </div>
  );
}

export default NotificationsPanel;
