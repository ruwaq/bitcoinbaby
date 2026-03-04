"use client";

import { clsx } from "clsx";
import { pixelShadows } from "@bitcoinbaby/ui";
import type { HelpSection, SectionConfig } from "../data";

interface SectionNavProps {
  sections: SectionConfig[];
  activeSection: HelpSection;
  onSectionChange: (section: HelpSection) => void;
}

export function SectionNav({
  sections,
  activeSection,
  onSectionChange,
}: SectionNavProps) {
  return (
    <nav className="space-y-2">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionChange(section.id)}
          className={clsx(
            "w-full p-3 text-left font-pixel text-[10px]",
            "border-2 transition-all",
            activeSection === section.id
              ? `bg-pixel-primary text-pixel-text-dark border-black ${pixelShadows.md}`
              : "bg-pixel-bg-medium text-pixel-text-muted border-pixel-border hover:border-pixel-primary",
          )}
        >
          <span className="mr-2">{section.icon}</span>
          {section.label.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
