"use client";

/**
 * NotificationsPanel - Mining activity notifications
 *
 * Shows recent mining notifications with rewards.
 * Fixed height to prevent layout shifts.
 */

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
  return (
    <div className="mb-6 min-h-[80px] overflow-hidden">
      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 border-4 transition-opacity duration-300 ${
                notification.type === "success"
                  ? "border-pixel-success bg-pixel-success/10"
                  : notification.type === "error"
                    ? "border-pixel-error bg-pixel-error/10"
                    : "border-pixel-border bg-pixel-bg-medium"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-pixel-xs text-pixel-text truncate">
                  {notification.title}
                </span>
                {notification.reward && (
                  <span className="font-pixel text-pixel-xs text-pixel-success whitespace-nowrap">
                    +{notification.reward.toString()} $BABY
                  </span>
                )}
              </div>
              <p className="font-pixel-body text-body-xs text-pixel-text-muted mt-1 line-clamp-2">
                {notification.message}
              </p>
            </div>
          ))}
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
