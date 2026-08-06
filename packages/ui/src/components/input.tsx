import { clsx } from "clsx";
import { forwardRef } from "react";

/**
 * PixelInput - Input estilo Pixel Art
 */

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={clsx(
          "w-full",
          "font-pixel-body text-base",
          "px-4 py-3",
          "bg-pixel-bg-dark text-pixel-text",
          "border-4 border-pixel-border",
          "shadow-[inset_4px_4px_0_0_rgba(0,0,0,0.5)]",
          "outline-none",
          "placeholder:text-pixel-text-muted",
          "focus:border-pixel-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

// Alias
export { Input as PixelInput };
