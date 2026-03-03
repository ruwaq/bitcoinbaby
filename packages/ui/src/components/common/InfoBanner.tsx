import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * InfoBanner - Banner informativo estandarizado
 *
 * Variantes:
 * - info: Informacion general (azul)
 * - success: Exito/completado (verde)
 * - warning: Advertencia (amarillo)
 * - error: Error/peligro (rojo)
 * - highlight: Destacado (gradiente primario)
 */

interface InfoBannerProps {
  /** Contenido del banner */
  children: ReactNode;
  /** Variante de color */
  variant?: "info" | "success" | "warning" | "error" | "highlight";
  /** Icono opcional */
  icon?: ReactNode;
  /** Accion opcional (boton, link) */
  action?: ReactNode;
  /** Si el banner puede cerrarse */
  onDismiss?: () => void;
  /** Clases adicionales */
  className?: string;
}

const variantStyles = {
  info: "bg-pixel-secondary/10 border-pixel-secondary/50 text-pixel-secondary",
  success: "bg-pixel-success/10 border-pixel-success/50 text-pixel-success",
  warning: "bg-pixel-warning/10 border-pixel-warning/50 text-pixel-warning",
  error: "bg-pixel-error/10 border-pixel-error/50 text-pixel-error",
  highlight:
    "bg-gradient-to-r from-pixel-primary/20 to-pixel-secondary/20 border-pixel-primary/50 text-pixel-text",
};

export function InfoBanner({
  children,
  variant = "info",
  icon,
  action,
  onDismiss,
  className,
}: InfoBannerProps) {
  return (
    <div
      className={clsx(
        "p-3 border-2 rounded",
        "font-pixel-body text-sm",
        variantStyles[variant],
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span className="flex-shrink-0 text-lg" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">{children}</div>
        {action && <div className="flex-shrink-0">{action}</div>}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            &#10005;
          </button>
        )}
      </div>
    </div>
  );
}

export default InfoBanner;
