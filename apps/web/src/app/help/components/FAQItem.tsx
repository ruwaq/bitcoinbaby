"use client";

import { clsx } from "clsx";
import type { FAQItem as FAQItemType } from "../data";

interface FAQItemProps {
  item: FAQItemType;
  isOpen: boolean;
  onToggle: () => void;
}

export function FAQItem({ item, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border-2 border-pixel-border mb-3 last:mb-0">
      <button
        onClick={onToggle}
        className={clsx(
          "w-full p-4 text-left flex items-center justify-between",
          "hover:bg-pixel-bg-light transition-colors",
          isOpen && "bg-pixel-bg-light",
        )}
      >
        <span className="font-pixel text-xs text-pixel-text pr-4">
          {item.question}
        </span>
        <span
          className={clsx(
            "font-pixel text-pixel-primary text-lg transition-transform",
            isOpen && "rotate-45",
          )}
        >
          +
        </span>
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t-2 border-pixel-border bg-pixel-bg-dark">
          <p className="font-pixel-body text-sm text-pixel-text-muted whitespace-pre-line leading-relaxed">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}
