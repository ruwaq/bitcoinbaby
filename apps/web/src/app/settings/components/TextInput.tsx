"use client";

interface TextInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  disabled = false,
}: TextInputProps) {
  return (
    <div>
      <label className="block font-pixel text-xs text-pixel-text mb-2">
        {label}
      </label>
      {description && (
        <p className="font-pixel-body text-[10px] text-pixel-text-muted mb-2">
          {description}
        </p>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-3 py-2 font-pixel text-xs bg-pixel-bg-dark text-pixel-text
          border-4 border-black
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      />
    </div>
  );
}
