/**
 * NFTSprite Component
 *
 * Renders a Genesis Spark NFT sprite based on its traits.
 * Combines base type, bloodline accessories, and rarity effects.
 *
 * UPDATED: Now supports both legacy mode and new Genesis Sprite system.
 * Use useGenesisSprites={true} for the new pixel art system.
 */

import { FC, useMemo } from "react";
import type { Bloodline, BaseType, RarityTier, Heritage } from "./types";
import {
  getNFTVisualConfig,
  resolvePaletteColor,
  getDNAColorVariation,
  type SpriteFeature,
  type ColorPalette,
} from "./trait-config";
import {
  GenesisBabySprite,
  type GenesisBabyTraits,
  type GenesisBabyState,
  type GenesisBaseType,
  type GenesisBloodline,
  type GenesisHeritage,
  type GenesisRarity,
} from "../sprites/genesis";

// =============================================================================
// TYPES
// =============================================================================

interface NFTSpriteProps {
  baseType: BaseType;
  bloodline: Bloodline;
  rarityTier: RarityTier;
  heritage?: Heritage;
  dna?: string;
  size?: number;
  className?: string;
  animate?: boolean;
  state?: GenesisBabyState;
  /** Use new Genesis pixel art sprite system */
  useGenesisSprites?: boolean;
  /** Show rarity frame around sprite */
  showFrame?: boolean;
  /** Show rarity badge */
  showBadge?: boolean;
}

// =============================================================================
// TYPE MAPPERS (Legacy → Genesis)
// =============================================================================

const mapBaseType = (baseType: BaseType): GenesisBaseType => {
  const mapping: Record<BaseType, GenesisBaseType> = {
    human: "human",
    animal: "animal",
    robot: "robot",
    mystic: "mystic",
    alien: "alien",
    shaman: "shaman",
    elemental: "elemental",
    dragon: "dragon",
  };
  return mapping[baseType] || "human";
};

const mapBloodline = (bloodline: Bloodline): GenesisBloodline => {
  const mapping: Record<Bloodline, GenesisBloodline> = {
    royal: "royal",
    warrior: "warrior",
    rogue: "rogue",
    mystic: "mystic",
    scholar: "mystic", // Fallback
    merchant: "rogue", // Fallback
  };
  return mapping[bloodline] || "royal";
};

const mapRarity = (rarity: RarityTier): GenesisRarity => {
  const mapping: Record<RarityTier, GenesisRarity> = {
    common: "common",
    uncommon: "uncommon",
    rare: "rare",
    epic: "epic",
    legendary: "legendary",
    mythic: "mythic",
  };
  return mapping[rarity] || "common";
};

const mapHeritage = (heritage?: Heritage): GenesisHeritage => {
  if (!heritage) return "americas";
  const mapping: Record<Heritage, GenesisHeritage> = {
    americas: "americas",
    africa: "africa",
    asia: "asia",
    europa: "europa",
    oceania: "oceania",
  };
  return mapping[heritage] || "americas";
};

// =============================================================================
// FEATURE RENDERER
// =============================================================================

interface FeatureElementProps {
  feature: SpriteFeature;
  palette: ColorPalette;
  dna?: string;
  index: number;
}

const FeatureElement: FC<FeatureElementProps> = ({
  feature,
  palette,
  dna,
  index,
}) => {
  // Resolve color references
  const fill = useMemo(() => {
    const baseColor = resolvePaletteColor(feature.fill, palette);
    // Apply DNA variation if DNA provided
    if (dna && feature.fill !== "none") {
      return getDNAColorVariation(baseColor, dna, index);
    }
    return baseColor;
  }, [feature.fill, palette, dna, index]);

  const stroke = useMemo(() => {
    if (!feature.stroke) return undefined;
    return resolvePaletteColor(feature.stroke, palette);
  }, [feature.stroke, palette]);

  const commonProps = {
    fill,
    stroke,
    strokeWidth: feature.strokeWidth,
    opacity: feature.opacity,
    transform: feature.transform,
  };

  switch (feature.type) {
    case "rect":
      return (
        <rect
          x={feature.x}
          y={feature.y}
          width={feature.width}
          height={feature.height}
          {...commonProps}
        />
      );

    case "circle":
      return (
        <circle
          cx={feature.cx}
          cy={feature.cy}
          r={feature.r}
          {...commonProps}
        />
      );

    case "polygon":
      return <polygon points={feature.points} {...commonProps} />;

    case "path":
      return <path d={feature.d} {...commonProps} />;

    case "ellipse":
      return (
        <ellipse
          cx={feature.cx ?? feature.x}
          cy={feature.cy ?? feature.y}
          rx={feature.rx ?? (feature.width ? feature.width / 2 : 1)}
          ry={feature.ry ?? (feature.height ? feature.height / 2 : 1)}
          {...commonProps}
        />
      );

    default:
      return null;
  }
};

// =============================================================================
// PARTICLES EFFECT
// =============================================================================

interface ParticlesProps {
  color: string;
  count: number;
}

const Particles: FC<ParticlesProps> = ({ color, count }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      cx: 2 + Math.random() * 12,
      cy: 2 + Math.random() * 12,
      r: 0.2 + Math.random() * 0.3,
      delay: i * 0.5,
    }));
  }, [count]);

  return (
    <g className="nft-particles">
      {particles.map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={color}
          opacity={0.7}
          style={{
            animation: `nft-particle-float 2s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </g>
  );
};

// =============================================================================
// AURA EFFECT
// =============================================================================

interface AuraProps {
  color: string;
  intensity: number;
  animate?: boolean;
}

const Aura: FC<AuraProps> = ({ color, intensity, animate }) => {
  return (
    <g className="nft-aura">
      {/* Outer glow */}
      <circle
        cx={8}
        cy={8}
        r={9}
        fill={color}
        opacity={intensity * 0.15}
        style={
          animate
            ? { animation: "nft-aura-pulse 2s ease-in-out infinite" }
            : undefined
        }
      />
      {/* Middle glow */}
      <circle
        cx={8}
        cy={8}
        r={8}
        fill={color}
        opacity={intensity * 0.1}
        style={
          animate
            ? {
                animation: "nft-aura-pulse 2s ease-in-out 0.5s infinite",
              }
            : undefined
        }
      />
    </g>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const NFTSprite: FC<NFTSpriteProps> = ({
  baseType,
  bloodline,
  rarityTier,
  heritage,
  dna,
  size = 96,
  className = "",
  animate = true,
  state = "idle",
  useGenesisSprites = true,
  showFrame = false,
  showBadge = true,
}) => {
  // Use new Genesis Sprite system
  if (useGenesisSprites) {
    const genesisTraits: GenesisBabyTraits = {
      baseType: mapBaseType(baseType),
      bloodline: mapBloodline(bloodline),
      heritage: mapHeritage(heritage),
      rarity: mapRarity(rarityTier),
      dna: dna || "0000000000000000",
    };

    return (
      <GenesisBabySprite
        traits={genesisTraits}
        size={size}
        state={state}
        className={className}
        showFrame={showFrame}
        showBadge={showBadge}
        animated={animate}
      />
    );
  }

  // Legacy sprite system (original implementation)
  const config = useMemo(
    () => getNFTVisualConfig(baseType, bloodline, rarityTier),
    [baseType, bloodline, rarityTier],
  );

  const { baseConfig, bloodlineConfig, combinedEffects } = config;

  // Combined palette (base type primary, modified by bloodline/rarity accents)
  const palette: ColorPalette = useMemo(() => {
    return {
      ...baseConfig.palette,
      accent: bloodlineConfig.palette.accent,
      glow: combinedEffects.auraColor || baseConfig.palette.glow,
    };
  }, [baseConfig.palette, bloodlineConfig.palette, combinedEffects.auraColor]);

  const shouldAnimate = animate && combinedEffects.animate;

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={`nft-sprite ${className}`}
      style={{
        imageRendering: "pixelated",
        filter:
          combinedEffects.glowIntensity > 0
            ? `drop-shadow(0 0 ${combinedEffects.glowIntensity * 4}px ${combinedEffects.auraColor || palette.accent})`
            : undefined,
      }}
    >
      {/* CSS Animations */}
      <style>{`
        @keyframes nft-particle-float {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(-2px); opacity: 1; }
        }
        @keyframes nft-aura-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }
        @keyframes nft-sprite-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-0.5px); }
        }
      `}</style>

      {/* Background */}
      <rect x={0} y={0} width={16} height={16} fill={palette.background} />

      {/* Aura Effect */}
      {combinedEffects.aura && combinedEffects.auraColor && (
        <Aura
          color={combinedEffects.auraColor}
          intensity={combinedEffects.glowIntensity}
          animate={shouldAnimate}
        />
      )}

      {/* Particles Effect */}
      {combinedEffects.particles && combinedEffects.particleColor && (
        <Particles color={combinedEffects.particleColor} count={5} />
      )}

      {/* Main sprite group */}
      <g
        style={
          shouldAnimate
            ? { animation: "nft-sprite-bob 3s ease-in-out infinite" }
            : undefined
        }
      >
        {/* Base Type Features */}
        {baseConfig.features.map((feature, i) => (
          <FeatureElement
            key={`base-${i}`}
            feature={feature}
            palette={palette}
            dna={dna}
            index={i}
          />
        ))}

        {/* Bloodline Accessories */}
        {bloodlineConfig.accessories?.map((feature, i) => (
          <FeatureElement
            key={`bloodline-${i}`}
            feature={feature}
            palette={bloodlineConfig.palette}
            dna={dna}
            index={i + 100}
          />
        ))}
      </g>
    </svg>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default NFTSprite;
