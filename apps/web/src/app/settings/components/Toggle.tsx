"use client";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
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
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`
          relative w-14 h-8 border-4 border-black transition-colors
          ${checked ? "bg-pixel-success" : "bg-pixel-bg-light"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <div
          className={`
            absolute top-0 w-5 h-5 bg-pixel-text border-2 border-black
            transition-transform duration-150
            ${checked ? "translate-x-6" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}
