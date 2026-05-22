"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { MenuItem } from "./data";

interface MenuButtonProps {
  item: MenuItem;
}

export function MenuButton({ item }: MenuButtonProps) {
  const isLocked = item.locked;

  const content = (
    <div
      className={clsx(
        "flex items-center gap-4 p-4 transition-all",
        isLocked
          ? `bg-pixel-bg-dark border-4 border-pixel-border opacity-60 cursor-not-allowed`
          : `bg-pixel-bg-medium ${pixelBorders.medium} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} cursor-pointer`,
        !isLocked && item.highlight && "border-pixel-primary",
      )}
    >
      {/* Icon */}
      <div className={clsx(
        "w-12 h-12 flex items-center justify-center border-2 border-black text-2xl bg-pixel-bg-dark",
        isLocked && "opacity-50"
      )}>
        {isLocked ? "🔒" : item.icon}
      </div>

      {/* Text */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3
            className={clsx(
              "font-pixel text-xs uppercase",
              isLocked
                ? "text-pixel-text-muted"
                : item.highlight ? "text-pixel-primary" : "text-pixel-text",
            )}
          >
            {item.label}
          </h3>
          {isLocked && item.lockedLabel && (
            <span className="px-1.5 py-0.5 font-pixel text-[6px] bg-pixel-warning/20 text-pixel-warning border border-pixel-warning uppercase">
              {item.lockedLabel}
            </span>
          )}
        </div>
        <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
          {item.description}
        </p>
      </div>

      {/* Arrow */}
      {!isLocked && <div className="font-pixel text-pixel-text-muted">→</div>}
    </div>
  );

  if (isLocked) {
    return <div className="w-full">{content}</div>;
  }

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
