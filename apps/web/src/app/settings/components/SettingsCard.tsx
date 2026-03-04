"use client";

import { pixelCard } from "@bitcoinbaby/ui";

interface SettingsCardProps {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}

export function SettingsCard({
  title,
  children,
  variant = "default",
}: SettingsCardProps) {
  return (
    <div
      className={`${pixelCard.primary} p-6 ${variant === "danger" ? "border-pixel-error" : ""}`}
    >
      <h2
        className={`font-pixel text-sm mb-6 pb-2 border-b-2 border-pixel-border ${
          variant === "danger" ? "text-pixel-error" : "text-pixel-primary"
        }`}
      >
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
