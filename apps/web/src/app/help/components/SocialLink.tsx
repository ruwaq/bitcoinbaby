"use client";

import { pixelShadows } from "@bitcoinbaby/ui";
import { clsx } from "clsx";

interface SocialLinkProps {
  href: string;
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

export function SocialLink({
  href,
  label,
  icon,
  bgColor,
  textColor,
}: SocialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "flex items-center gap-2 px-4 py-2 font-pixel text-[10px]",
        "border-2 border-black transition-all",
        "hover:translate-x-[2px] hover:translate-y-[2px]",
        pixelShadows.md,
        pixelShadows.smHover,
        bgColor,
        textColor,
      )}
    >
      <span>{icon}</span> {label}
    </a>
  );
}
