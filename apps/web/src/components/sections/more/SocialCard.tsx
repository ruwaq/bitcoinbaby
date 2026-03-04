"use client";

import { clsx } from "clsx";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { MenuItem } from "./data";

interface SocialCardProps {
  item: MenuItem;
}

export function SocialCard({ item }: SocialCardProps) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "flex flex-col items-center gap-2 p-4",
        `bg-pixel-bg-medium ${pixelBorders.medium}`,
        pixelShadows.md,
        "hover:translate-x-[2px] hover:translate-y-[2px]",
        pixelShadows.smHover,
        "hover:border-pixel-secondary",
        "transition-all",
      )}
    >
      <span className="text-2xl">{item.icon}</span>
      <span className="font-pixel text-[10px] text-pixel-text uppercase">
        {item.label}
      </span>
    </a>
  );
}
