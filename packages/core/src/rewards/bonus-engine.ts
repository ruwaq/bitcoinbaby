/**
 * BonusCalculationEngine - Sistema centralizado de multiplicadores
 *
 * Arquitectura modular y extensible para calcular rewards con bonuses.
 * Cada bonus es un "provider" independiente que se registra en el engine.
 *
 * Diseño:
 * - Providers: Cada sistema de bonus implementa IBonusProvider
 * - Engine: Combina todos los providers registrados
 * - Breakdown: Retorna desglose detallado para UI
 *
 * @example
 * ```typescript
 * const engine = new BonusCalculationEngine();
 * engine.register(new StreakBonusProvider());
 * engine.register(new NFTBonusProvider());
 * engine.register(new EngagementBonusProvider());
 * engine.register(new CosmicBonusProvider());
 *
 * const result = engine.calculate(context);
 * // result.totalMultiplier = 2.45
 * // result.breakdown = { streak: 1.5, nft: 1.12, engagement: 1.03, cosmic: 1.05 }
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tipo de combinación de bonus
 * - multiplicative: Se multiplican entre sí (1.2 × 1.1 = 1.32)
 * - additive: Se suman los porcentajes (20% + 10% = 30% → 1.30)
 */
export type BonusCombineMode = "multiplicative" | "additive";

/**
 * Estado de un bonus provider
 */
export type BonusStatus = "active" | "disabled" | "coming_soon" | "error";

/**
 * Contexto para calcular bonuses
 */
export interface BonusCalculationContext {
  // Mining context
  difficulty: number;
  hashrate: number;
  baseReward: bigint;

  // Streak context
  consecutiveShares?: number;
  lastShareTime?: number;

  // NFT context
  nfts?: Array<{
    level: number;
    rarityTier: string;
    boost: number;
  }>;

  // Engagement context
  engagement?: {
    babyHealthScore: number;
    dailyStreak: number;
    playTimeMinutes: number;
  };

  // Cosmic context
  cosmic?: {
    moonPhase: string;
    season: string;
    activeEvents: string[];
    babyType?: string;
    bloodline?: string;
  };

  // User context
  walletAddress?: string;
  userId?: string;
}

/**
 * Resultado de un bonus provider individual
 */
export interface BonusProviderResult {
  /** Nombre del provider */
  name: string;
  /** Multiplicador calculado (1.0 = sin bonus) */
  multiplier: number;
  /** Porcentaje de bonus (0 = sin bonus, 100 = 2x) */
  percentage: number;
  /** Estado del provider */
  status: BonusStatus;
  /** Metadata adicional para UI */
  metadata?: {
    /** Descripción corta */
    label?: string;
    /** Descripción detallada */
    description?: string;
    /** Datos específicos del bonus */
    details?: Record<string, unknown>;
  };
}

/**
 * Resultado final del engine
 */
export interface BonusCalculationResult {
  /** Multiplicador total combinado */
  totalMultiplier: number;
  /** Porcentaje total de bonus */
  totalPercentage: number;
  /** Reward final calculado */
  finalReward: bigint;
  /** Desglose por provider */
  breakdown: Record<string, BonusProviderResult>;
  /** Providers activos */
  activeProviders: string[];
  /** Providers deshabilitados */
  disabledProviders: string[];
  /** Timestamp del cálculo */
  calculatedAt: number;
}

/**
 * Interface que deben implementar todos los bonus providers
 */
export interface IBonusProvider {
  /** Nombre único del provider */
  readonly name: string;
  /** Prioridad de aplicación (menor = primero) */
  readonly priority: number;
  /** Modo de combinación con otros bonuses */
  readonly combineMode: BonusCombineMode;
  /** Multiplicador máximo permitido */
  readonly maxMultiplier: number;
  /** Multiplicador mínimo permitido (para penalizaciones) */
  readonly minMultiplier: number;

  /**
   * Calcula el multiplicador basado en el contexto
   * @returns Resultado con multiplicador y metadata
   */
  calculate(context: BonusCalculationContext): BonusProviderResult;

  /**
   * Verifica si el provider está activo
   */
  isEnabled(): boolean;

  /**
   * Obtiene el estado actual del provider
   */
  getStatus(): BonusStatus;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configuración global del engine
 */
export interface BonusEngineConfig {
  /** Multiplicador máximo total permitido */
  maxTotalMultiplier: number;
  /** Multiplicador mínimo total permitido */
  minTotalMultiplier: number;
  /** Modo de combinación por defecto */
  defaultCombineMode: BonusCombineMode;
  /** Habilitar logging de debug */
  debug: boolean;
}

const DEFAULT_CONFIG: BonusEngineConfig = {
  maxTotalMultiplier: 5.0, // Max 5x total bonus
  minTotalMultiplier: 0.5, // Min 0.5x (50% penalty max)
  defaultCombineMode: "multiplicative",
  debug: false,
};

// =============================================================================
// ENGINE
// =============================================================================

/**
 * Motor centralizado de cálculo de bonuses
 */
export class BonusCalculationEngine {
  private providers: Map<string, IBonusProvider> = new Map();
  private config: BonusEngineConfig;

  constructor(config: Partial<BonusEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registra un nuevo provider de bonus
   */
  register(provider: IBonusProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(
        `[BonusEngine] Provider "${provider.name}" already registered, replacing...`,
      );
    }
    this.providers.set(provider.name, provider);

    if (this.config.debug) {
      console.log(`[BonusEngine] Registered provider: ${provider.name}`);
    }
  }

  /**
   * Elimina un provider registrado
   */
  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Obtiene un provider por nombre
   */
  getProvider(name: string): IBonusProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Lista todos los providers registrados
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Calcula todos los bonuses y retorna el resultado combinado
   */
  calculate(context: BonusCalculationContext): BonusCalculationResult {
    const breakdown: Record<string, BonusProviderResult> = {};
    const activeProviders: string[] = [];
    const disabledProviders: string[] = [];

    // Ordenar providers por prioridad
    const sortedProviders = Array.from(this.providers.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    // Acumuladores por modo de combinación
    let multiplicativeTotal = 1.0;
    let additiveTotal = 0;

    for (const provider of sortedProviders) {
      try {
        const result = provider.calculate(context);
        breakdown[provider.name] = result;

        if (result.status === "active" && provider.isEnabled()) {
          activeProviders.push(provider.name);

          // Aplicar límites del provider
          const clampedMultiplier = Math.max(
            provider.minMultiplier,
            Math.min(provider.maxMultiplier, result.multiplier),
          );

          // Combinar según el modo
          if (provider.combineMode === "multiplicative") {
            multiplicativeTotal *= clampedMultiplier;
          } else {
            additiveTotal += result.percentage;
          }

          if (this.config.debug) {
            console.log(
              `[BonusEngine] ${provider.name}: ${clampedMultiplier.toFixed(3)}x (${result.percentage.toFixed(1)}%)`,
            );
          }
        } else {
          disabledProviders.push(provider.name);
        }
      } catch (error) {
        console.error(
          `[BonusEngine] Error in provider ${provider.name}:`,
          error,
        );
        breakdown[provider.name] = {
          name: provider.name,
          multiplier: 1.0,
          percentage: 0,
          status: "error",
          metadata: {
            label: "Error",
            description:
              error instanceof Error ? error.message : "Unknown error",
          },
        };
        disabledProviders.push(provider.name);
      }
    }

    // Combinar totales
    const additiveMultiplier = 1 + additiveTotal / 100;
    let totalMultiplier = multiplicativeTotal * additiveMultiplier;

    // Aplicar límites globales
    totalMultiplier = Math.max(
      this.config.minTotalMultiplier,
      Math.min(this.config.maxTotalMultiplier, totalMultiplier),
    );

    // Calcular reward final
    const finalReward = BigInt(
      Math.floor(Number(context.baseReward) * totalMultiplier),
    );

    const totalPercentage = (totalMultiplier - 1) * 100;

    if (this.config.debug) {
      console.log(
        `[BonusEngine] Total: ${totalMultiplier.toFixed(3)}x (${totalPercentage.toFixed(1)}%)`,
      );
    }

    return {
      totalMultiplier,
      totalPercentage,
      finalReward,
      breakdown,
      activeProviders,
      disabledProviders,
      calculatedAt: Date.now(),
    };
  }

  /**
   * Obtiene un resumen del estado de todos los providers
   */
  getStatus(): Record<string, BonusStatus> {
    const status: Record<string, BonusStatus> = {};
    for (const [name, provider] of this.providers) {
      status[name] = provider.getStatus();
    }
    return status;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let engineInstance: BonusCalculationEngine | null = null;

/**
 * Obtiene la instancia singleton del engine
 */
export function getBonusEngine(): BonusCalculationEngine {
  if (!engineInstance) {
    engineInstance = new BonusCalculationEngine();
  }
  return engineInstance;
}

/**
 * Resetea la instancia singleton (útil para tests)
 */
export function resetBonusEngine(): void {
  engineInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  BonusCalculationEngine as default,
  DEFAULT_CONFIG as BONUS_ENGINE_DEFAULT_CONFIG,
};
