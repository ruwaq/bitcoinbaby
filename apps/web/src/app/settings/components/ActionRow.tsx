"use client";

interface ActionRowProps {
  label: string;
  description?: string;
  buttonLabel: string;
  onClick: () => void;
}

export function ActionRow({
  label,
  description,
  buttonLabel,
  onClick,
}: ActionRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-pixel text-xs text-pixel-text">{label}</span>
        {description && (
          <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={onClick}
        className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black hover:bg-pixel-bg-dark"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
