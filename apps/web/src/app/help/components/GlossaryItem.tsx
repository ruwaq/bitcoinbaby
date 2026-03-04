"use client";

import type { GlossaryItem as GlossaryItemType } from "../data";

interface GlossaryItemProps {
  item: GlossaryItemType;
}

export function GlossaryItem({ item }: GlossaryItemProps) {
  return (
    <div className="p-4 border-2 border-pixel-border mb-3 last:mb-0 hover:border-pixel-primary transition-colors">
      <dt className="font-pixel text-sm text-pixel-primary mb-2">
        {item.term}
      </dt>
      <dd className="font-pixel-body text-sm text-pixel-text-muted">
        {item.definition}
      </dd>
    </div>
  );
}
