/**
 * Genesis Baby Sprite - Generador de NFTs combinados
 *
 * Componente principal que combina:
 * - Base Type (Human, Robot, Mystic, Alien, Rune)
 * - Bloodline (Royal, Warrior, Rogue, Mystic)
 * - Heritage (Americas, Africa, Asia, Europa, Oceania)
 * - Rarity (Common → Mythic)
 *
 * El DNA determina las variaciones específicas dentro de cada categoría.
 */

import { type FC, useMemo } from "react";
import {
  type BaseType,
  type Bloodline,
  type Heritage,
  type Rarity,
  type BabyState,
  type ColorPalette,
  getRarityGlowFilter,
} from "./types";
import { HumanSprite } from "./HumanSprite";
import { AnimalSprite } from "./AnimalSprite";
import { RobotSprite } from "./RobotSprite";
import { MysticSprite } from "./MysticSprite";
import { AlienSprite } from "./AlienSprite";
import { ShamanSprite } from "./ShamanSprite";
import { ElementalSprite } from "./ElementalSprite";
import { DragonSprite } from "./DragonSprite";
import { BloodlineOverlay, BloodlineAura } from "./BloodlineOverlay";
import { HeritageOverlay, HeritageBackground } from "./HeritageOverlay";
import { RarityEffects, RarityFrame, RarityBadge } from "./RarityEffects";

export interface GenesisBabyTraits {
  baseType: BaseType;
  bloodline: Bloodline;
  heritage: Heritage;
  rarity: Rarity;
  dna: string;
}

interface GenesisBabySpriteProps {
  traits: GenesisBabyTraits;
  size?: number;
  state?: BabyState;
  colors?: Partial<ColorPalette>;
  className?: string;
  showFrame?: boolean;
  showBadge?: boolean;
  showBloodlineAura?: boolean;
  animated?: boolean;
}

/**
 * Genera traits aleatorios para PREVIEW/DEMO solamente.
 *
 * WARNING: NOT for production minting!
 * Real NFT traits are generated server-side using deterministic
 * randomness based on txid (see apps/workers/src/routes/nft.ts).
 *
 * Use traitsFromHash() for deterministic trait generation from DNA/hash.
 */
export function generateRandomTraits(): GenesisBabyTraits {
  const baseTypes: BaseType[] = [
    "human",
    "animal",
    "robot",
    "mystic",
    "alien",
    "shaman",
    "elemental",
    "dragon",
  ];
  const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
  const heritages: Heritage[] = [
    "americas",
    "africa",
    "asia",
    "europa",
    "oceania",
  ];
  const rarities: Rarity[] = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic",
  ];

  // Rarity weights (más común = más probable)
  const rarityWeights = [40, 25, 18, 10, 5, 2]; // Total: 100
  const rarityRoll = Math.random() * 100;
  let rarityIndex = 0;
  let accumulated = 0;
  for (let i = 0; i < rarityWeights.length; i++) {
    accumulated += rarityWeights[i];
    if (rarityRoll < accumulated) {
      rarityIndex = i;
      break;
    }
  }

  // Generar DNA aleatorio (16 caracteres hex)
  const dna = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

  return {
    baseType: baseTypes[Math.floor(Math.random() * baseTypes.length)],
    bloodline: bloodlines[Math.floor(Math.random() * bloodlines.length)],
    heritage: heritages[Math.floor(Math.random() * heritages.length)],
    rarity: rarities[rarityIndex],
    dna,
  };
}

/**
 * Genera traits desde un hash (determinístico)
 */
export function traitsFromHash(hash: string): GenesisBabyTraits {
  const baseTypes: BaseType[] = [
    "human",
    "animal",
    "robot",
    "mystic",
    "alien",
    "shaman",
    "elemental",
    "dragon",
  ];
  const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
  const heritages: Heritage[] = [
    "americas",
    "africa",
    "asia",
    "europa",
    "oceania",
  ];
  const rarities: Rarity[] = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythic",
  ];

  // Usar diferentes partes del hash para cada trait
  const normalizedHash = hash.replace(/^0x/, "").padEnd(64, "0");

  const baseTypeIndex = parseInt(normalizedHash[0], 16) % baseTypes.length;
  const bloodlineIndex = parseInt(normalizedHash[1], 16) % bloodlines.length;
  const heritageIndex = parseInt(normalizedHash[2], 16) % heritages.length;

  // Rarity basada en el valor del tercer byte
  const rarityValue = parseInt(normalizedHash.slice(3, 5), 16);
  let rarityIndex = 0;
  if (rarityValue < 102) rarityIndex = 0; // 40%
  if (rarityValue >= 102 && rarityValue < 166) rarityIndex = 1; // 25%
  if (rarityValue >= 166 && rarityValue < 212) rarityIndex = 2; // 18%
  if (rarityValue >= 212 && rarityValue < 238) rarityIndex = 3; // 10%
  if (rarityValue >= 238 && rarityValue < 251) rarityIndex = 4; // 5%
  if (rarityValue >= 251) rarityIndex = 5; // 2%

  return {
    baseType: baseTypes[baseTypeIndex],
    bloodline: bloodlines[bloodlineIndex],
    heritage: heritages[heritageIndex],
    rarity: rarities[rarityIndex],
    dna: normalizedHash.slice(5, 21),
  };
}

export const GenesisBabySprite: FC<GenesisBabySpriteProps> = ({
  traits,
  size = 64,
  state = "idle",
  colors,
  className = "",
  showFrame = false,
  showBadge = true,
  showBloodlineAura = true,
  animated = true,
}) => {
  // Memoize sprite component selection
  const SpriteComponent = useMemo(() => {
    switch (traits.baseType) {
      case "human":
        return HumanSprite;
      case "animal":
        return AnimalSprite;
      case "robot":
        return RobotSprite;
      case "mystic":
        return MysticSprite;
      case "alien":
        return AlienSprite;
      case "shaman":
        return ShamanSprite;
      case "elemental":
        return ElementalSprite;
      case "dragon":
        return DragonSprite;
      default:
        return HumanSprite;
    }
  }, [traits.baseType]);

  // Determinar intensidad del aura basada en rareza
  const auraIntensity = useMemo(() => {
    switch (traits.rarity) {
      case "common":
      case "uncommon":
        return "low";
      case "rare":
      case "epic":
        return "medium";
      case "legendary":
      case "mythic":
        return "high";
      default:
        return "medium";
    }
  }, [traits.rarity]);

  // Get glow effect for rarity
  const glowFilter = useMemo(() => {
    if (traits.rarity === "common") return "none";
    return getRarityGlowFilter(traits.rarity);
  }, [traits.rarity]);

  // Animation class for mythic rainbow effect
  const rainbowClass =
    traits.rarity === "mythic" && animated ? "animate-nft-rainbow" : "";

  return (
    <div
      className={`relative inline-block ${rainbowClass} ${className}`}
      style={{
        width: size,
        height: size,
        filter: glowFilter,
      }}
    >
      {/* Layer 0: Heritage background (muy sutil) */}
      <HeritageBackground heritage={traits.heritage} size={size} />

      {/* Layer 1: Rarity effects (fondo) */}
      <RarityEffects rarity={traits.rarity} size={size} animated={animated} />

      {/* Layer 2: Bloodline aura (si está habilitado) */}
      {showBloodlineAura && traits.rarity !== "common" && (
        <BloodlineAura
          bloodline={traits.bloodline}
          size={size}
          intensity={auraIntensity}
        />
      )}

      {/* Layer 3: Base sprite */}
      <SpriteComponent
        size={size}
        state={state}
        dna={traits.dna}
        colors={colors}
      />

      {/* Layer 4: Bloodline overlay */}
      <BloodlineOverlay
        bloodline={traits.bloodline}
        size={size}
        animated={animated}
      />

      {/* Layer 5: Heritage overlay */}
      <HeritageOverlay
        heritage={traits.heritage}
        size={size}
        animated={animated}
      />

      {/* Layer 6: Frame (si está habilitado) */}
      {showFrame && <RarityFrame rarity={traits.rarity} size={size} />}

      {/* Layer 7: Badge (si está habilitado) */}
      {showBadge && <RarityBadge rarity={traits.rarity} size={size} />}
    </div>
  );
};

/**
 * Preview component for showing all variations
 */
interface GenesisBabyPreviewProps {
  baseType?: BaseType;
  bloodline?: Bloodline;
  heritage?: Heritage;
  rarity?: Rarity;
  size?: number;
  state?: BabyState;
}

export const GenesisBabyPreview: FC<GenesisBabyPreviewProps> = ({
  baseType = "human",
  bloodline = "royal",
  heritage = "americas",
  rarity = "rare",
  size = 96,
  state = "idle",
}) => {
  const traits: GenesisBabyTraits = {
    baseType,
    bloodline,
    heritage,
    rarity,
    dna: "0123456789abcdef",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <GenesisBabySprite
        traits={traits}
        size={size}
        state={state}
        showFrame
        showBadge
      />
      <div className="text-xs text-center font-pixel">
        <div className="capitalize">{baseType}</div>
        <div className="text-gray-500 capitalize">
          {bloodline} • {heritage}
        </div>
      </div>
    </div>
  );
};

export default GenesisBabySprite;
