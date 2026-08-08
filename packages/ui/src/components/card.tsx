import { clsx } from "clsx";

/**
 * PixelCard - Card estilo Pixel Art 8-bit con sombra NES
 */

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-pixel-bg-medium",
        "border-4 border-pixel-border",
        "p-4",
        "shadow-[8px_8px_0_0_#000,inset_-4px_-4px_0_0_rgba(0,0,0,0.3),inset_4px_4px_0_0_rgba(255,255,255,0.05)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={clsx(
        "font-pixel text-xs text-pixel-text",
        "pb-2 mb-3",
        "border-b-2 border-pixel-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export function CardContent({
  className,
  children,
  ...props
}: CardContentProps) {
  return (
    <div
      className={clsx("font-pixel-body text-pixel-text", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={clsx(
        "pt-3 mt-3",
        "border-t-2 border-pixel-border",
        "flex items-center gap-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Aliases
export { Card as PixelCard };
export { CardHeader as PixelCardHeader };
export { CardContent as PixelCardContent };
export { CardFooter as PixelCardFooter };
