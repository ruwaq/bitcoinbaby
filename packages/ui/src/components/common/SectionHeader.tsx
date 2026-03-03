import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * SectionHeader - Header estandarizado para secciones
 *
 * Uso:
 * <SectionHeader
 *   title="Mining"
 *   description="Mine BABY tokens with your device"
 *   action={<Button>Start</Button>}
 * />
 */

interface SectionHeaderProps {
  /** Titulo principal */
  title: string;
  /** Descripcion opcional */
  description?: string;
  /** Icono o emoji opcional antes del titulo */
  icon?: ReactNode;
  /** Accion opcional a la derecha (boton, toggle, etc) */
  action?: ReactNode;
  /** Tooltip de ayuda */
  helpTooltip?: ReactNode;
  /** Clases adicionales */
  className?: string;
  /** Variante de tamaño */
  size?: "sm" | "md" | "lg";
}

export function SectionHeader({
  title,
  description,
  icon,
  action,
  helpTooltip,
  className,
  size = "md",
}: SectionHeaderProps) {
  return (
    <div className={clsx("mb-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span
              className={clsx(
                size === "sm" && "text-lg",
                size === "md" && "text-xl",
                size === "lg" && "text-2xl",
              )}
            >
              {icon}
            </span>
          )}
          <h2
            className={clsx(
              "font-pixel text-pixel-primary uppercase tracking-wide truncate",
              size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base",
            )}
          >
            {title}
          </h2>
          {helpTooltip}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {description && (
        <p
          className={clsx(
            "font-pixel-body text-pixel-text-muted mt-1",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export default SectionHeader;
