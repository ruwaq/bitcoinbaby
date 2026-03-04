"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { MenuItem } from "./data";

interface MenuButtonProps {
  item: MenuItem;
}

export function MenuButton({ item }: MenuButtonProps) {
  const content = (
    <div
      className={clsx(
        "flex items-center gap-4 p-4",
        `bg-pixel-bg-medium ${pixelBorders.medium}`,
        pixelShadows.md,
        "hover:translate-x-[2px] hover:translate-y-[2px]",
        pixelShadows.smHover,
        "transition-all cursor-pointer",
        item.highlight && "border-pixel-primary",
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 flex items-center justify-center bg-pixel-bg-dark border-2 border-black text-2xl">
        {item.icon}
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3
          className={clsx(
            "font-pixel text-xs uppercase",
            item.highlight ? "text-pixel-primary" : "text-pixel-text",
          )}
        >
          {item.label}
        </h3>
        <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
          {item.description}
        </p>
      </div>

      {/* Arrow */}
      <div className="font-pixel text-pixel-text-muted">→</div>
    </div>
  );

  if (item.onClick) {
    return (
      <button onClick={item.onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={item.href}>{content}</Link>;
}
