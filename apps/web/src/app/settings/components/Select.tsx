"use client";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  label: string;
  description?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Select<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}: SelectProps<T>) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="font-pixel text-xs text-pixel-text">{label}</span>
        {description && (
          <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
            {description}
          </p>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={disabled}
        className={`px-3 py-2 font-pixel text-[10px] bg-pixel-bg-dark text-pixel-text border-4 border-black min-w-[120px] ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer appearance-none"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
