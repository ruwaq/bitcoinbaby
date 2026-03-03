import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * StatCard - Tarjeta de estadistica estandarizada
 *
 * Uso:
 * <StatCard
 *   label="Hashrate"
 *   value="125.4"
 *   unit="H/s"
 *   icon="&#9889;"
 *   trend={{ direction: "up", value: "+5%" }}
 * />
 */

interface StatCardProps {
  /** Label de la estadistica */
  label: string;
  /** Valor principal */
  value: string | number;
  /** Unidad opcional (H/s, BTC, etc) */
  unit?: string;
  /** Icono o emoji */
  icon?: ReactNode;
  /** Tendencia (up/down con valor) */
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
  };
  /** Tooltip de ayuda */
  helpTooltip?: ReactNode;
  /** Variante de tamaño */
  size?: "sm" | "md" | "lg";
  /** Si esta cargando */
  loading?: boolean;
  /** Clases adicionales */
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  trend,
  helpTooltip,
  size = "md",
  loading = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={clsx(
        "bg-pixel-bg-medium/50 border-2 border-pixel-border rounded p-3",
        className,
      )}
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-1">
        {icon && (
          <span
            className={clsx(
              "flex-shrink-0",
              size === "sm" && "text-sm",
              size === "md" && "text-base",
              size === "lg" && "text-lg",
            )}
          >
            {icon}
          </span>
        )}
        <span
          className={clsx(
            "font-pixel-body text-pixel-text-muted uppercase tracking-wide truncate",
            size === "sm" && "text-[10px]",
            size === "md" && "text-xs",
            size === "lg" && "text-sm",
          )}
        >
          {label}
        </span>
        {helpTooltip}
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1.5">
        {loading ? (
          <span className="font-pixel-mono text-pixel-text-muted animate-pulse">
            ---
          </span>
        ) : (
          <>
            <span
              className={clsx(
                "font-pixel-mono text-pixel-text font-bold tabular-nums",
                size === "sm" && "text-lg",
                size === "md" && "text-xl",
                size === "lg" && "text-2xl",
              )}
            >
              {value}
            </span>
            {unit && (
              <span
                className={clsx(
                  "font-pixel-body text-pixel-text-muted",
                  size === "sm" && "text-xs",
                  size === "md" && "text-sm",
                  size === "lg" && "text-base",
                )}
              >
                {unit}
              </span>
            )}
          </>
        )}

        {/* Trend indicator */}
        {trend && !loading && (
          <span
            className={clsx(
              "ml-auto font-pixel-body text-xs",
              trend.direction === "up" && "text-pixel-success",
              trend.direction === "down" && "text-pixel-error",
              trend.direction === "neutral" && "text-pixel-text-muted",
            )}
          >
            {trend.direction === "up" && "&#9650;"}
            {trend.direction === "down" && "&#9660;"}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
