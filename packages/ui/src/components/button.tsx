import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

/**
 * PixelButton - Boton estilo Pixel Art 8-bit
 *
 * Variantes:
 * - default: Bitcoin gold (primary)
 * - secondary: Baby blue
 * - outline: Borde sin fondo
 * - ghost: Sin borde ni fondo
 * - destructive: Rojo error
 */
const buttonVariants = cva(
  // Base styles - Pixel Art aesthetic
  [
    "inline-flex items-center justify-center",
    "font-pixel text-xs uppercase tracking-wide",
    "border-4 border-black",
    "transition-transform duration-100",
    "disabled:pointer-events-none disabled:opacity-50",
    "cursor-pointer select-none",
    // Pixel rendering
    "[image-rendering:pixelated]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-pixel-primary text-pixel-text-dark",
          "shadow-[4px_4px_0_0_#000,inset_-2px_-2px_0_0_#e67e00,inset_2px_2px_0_0_#ffc107]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ].join(" "),
        secondary: [
          "bg-pixel-secondary text-pixel-text-dark",
          "shadow-[4px_4px_0_0_#000,inset_-2px_-2px_0_0_#29b6f6,inset_2px_2px_0_0_#81d4fa]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ].join(" "),
        outline: [
          "bg-transparent text-pixel-primary border-pixel-primary",
          "shadow-[4px_4px_0_0_#000]",
          "hover:bg-pixel-primary/10 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ].join(" "),
        ghost: [
          "bg-transparent text-pixel-text border-transparent",
          "hover:bg-pixel-bg-light hover:border-pixel-border",
        ].join(" "),
        destructive: [
          "bg-pixel-error text-white",
          "shadow-[4px_4px_0_0_#000,inset_-2px_-2px_0_0_#dc2626,inset_2px_2px_0_0_#f87171]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ].join(" "),
        success: [
          "bg-pixel-success text-pixel-text-dark",
          "shadow-[4px_4px_0_0_#000,inset_-2px_-2px_0_0_#16a34a,inset_2px_2px_0_0_#4ade80]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ].join(" "),
        warning: [
          "bg-pixel-warning text-pixel-text-dark",
          "shadow-[4px_4px_0_0_#000,inset_-2px_-2px_0_0_#d97706,inset_2px_2px_0_0_#fcd34d]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        ].join(" "),
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 px-4 py-1 text-[10px]",
        lg: "h-12 px-8 py-3 text-sm",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// Alias for backward compatibility
export { Button as PixelButton };
