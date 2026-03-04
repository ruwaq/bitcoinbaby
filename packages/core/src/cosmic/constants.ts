/**
 * Cosmic System Constants
 * Configuration for types, bloodlines, heritage, and effects
 */

import type {
  BaseType,
  Bloodline,
  BloodlineConfig,
  Heritage,
  HeritageConfig,
  MoonPhase,
  Season,
  TypeMultipliers,
} from "./types";

// =============================================================================
// MOON PHASE EFFECTS BY TYPE
// =============================================================================

// BALANCED: Reduced values for fair gameplay (max ±3% per effect)
export const MOON_PHASE_EFFECTS: Record<MoonPhase, TypeMultipliers> = {
  new: {
    human: 0,
    animal: -0.01,
    robot: 0.005,
    mystic: 0.03, // Mystics love new moon
    alien: 0.01,
  },
  waxing_crescent: {
    human: 0.005,
    animal: 0.01,
    robot: 0,
    mystic: 0.015,
    alien: 0.005,
  },
  first_quarter: {
    human: 0.01,
    animal: 0.015,
    robot: 0,
    mystic: 0.01,
    alien: 0,
  },
  waxing_gibbous: {
    human: 0.01,
    animal: 0.02,
    robot: -0.005,
    mystic: 0.015,
    alien: 0,
  },
  full: {
    human: 0.015,
    animal: 0.03, // Animals love full moon
    robot: -0.01, // Robots struggle
    mystic: 0.03,
    alien: 0.01,
  },
  waning_gibbous: {
    human: 0.005,
    animal: 0.015,
    robot: -0.005,
    mystic: 0.015,
    alien: 0.005,
  },
  last_quarter: {
    human: 0,
    animal: 0.005,
    robot: 0.005,
    mystic: 0.01,
    alien: 0.01,
  },
  waning_crescent: {
    human: -0.005,
    animal: -0.005,
    robot: 0.01,
    mystic: 0.02,
    alien: 0.015,
  },
};

// =============================================================================
// DAY/NIGHT EFFECTS BY TYPE
// =============================================================================

// BALANCED: Day/Night effects (max ±2%)
export const DAY_EFFECTS: TypeMultipliers = {
  human: 0.01, // Humans thrive in daylight
  animal: 0.005,
  robot: 0, // Robots don't care
  mystic: -0.005, // Mystics prefer twilight
  alien: -0.01, // Aliens prefer night
};

export const NIGHT_EFFECTS: TypeMultipliers = {
  human: -0.005,
  animal: 0.005, // Many animals are nocturnal
  robot: 0,
  mystic: 0.01,
  alien: 0.02, // Aliens love starry nights
};

// =============================================================================
// SEASON EFFECTS BY TYPE
// =============================================================================

// BALANCED: Season effects (max ±3%)
export const SEASON_EFFECTS: Record<Season, TypeMultipliers> = {
  spring: {
    human: 0.01,
    animal: 0.02, // Animals love spring (rebirth)
    robot: 0,
    mystic: 0.01,
    alien: 0,
  },
  summer: {
    human: 0.02, // Humans love summer
    animal: 0.01,
    robot: -0.01, // Robots overheat
    mystic: 0,
    alien: -0.015, // Aliens struggle with heat
  },
  autumn: {
    human: 0.005,
    animal: 0.01,
    robot: 0.005,
    mystic: 0.015, // Mystics love the transition
    alien: 0.005,
  },
  winter: {
    human: -0.01,
    animal: -0.015, // Animals hibernate
    robot: 0.02, // Robots efficient in cold
    mystic: 0.01,
    alien: 0.01,
  },
};

// =============================================================================
// SPECIAL EVENT EFFECTS
// =============================================================================

// BALANCED: Special events (max ±5% - rare events get slightly higher bonuses)
export const ECLIPSE_LUNAR_EFFECTS: TypeMultipliers = {
  human: 0.02,
  animal: 0.02,
  robot: -0.02, // Robots struggle
  mystic: 0.05, // Mystics LOVE lunar eclipses
  alien: 0.03,
};

export const ECLIPSE_SOLAR_EFFECTS: TypeMultipliers = {
  human: -0.01,
  animal: -0.02, // Animals confused/scared
  robot: 0.05, // Robots LOVE solar eclipses
  mystic: 0.02,
  alien: 0.05, // Aliens love them too
};

export const METEOR_SHOWER_EFFECTS: TypeMultipliers = {
  human: 0.01,
  animal: 0.01,
  robot: 0.01,
  mystic: 0.02,
  alien: 0.04, // Aliens LOVE meteor showers
};

export const PLANETARY_ALIGNMENT_EFFECTS: TypeMultipliers = {
  human: 0.02,
  animal: 0.02,
  robot: 0.02,
  mystic: 0.03,
  alien: 0.05, // Aliens get bonus (rare event)
};

export const SOLSTICE_SUMMER_EFFECTS: TypeMultipliers = {
  human: 0.03, // Humans LOVE summer solstice
  animal: 0.02,
  robot: -0.015,
  mystic: 0.01,
  alien: -0.01,
};

export const SOLSTICE_WINTER_EFFECTS: TypeMultipliers = {
  human: -0.01,
  animal: -0.01,
  robot: 0.03, // Robots LOVE winter solstice
  mystic: 0.02,
  alien: 0.01,
};

export const EQUINOX_EFFECTS: TypeMultipliers = {
  human: 0.01,
  animal: 0.01,
  robot: 0,
  mystic: 0.02, // Mystics love balance
  alien: 0.01,
};

// =============================================================================
// BLOODLINE CONFIGURATIONS
// =============================================================================

// BALANCED: Bloodline bonuses (small flavor, not power)
export const BLOODLINE_CONFIGS: Record<Bloodline, BloodlineConfig> = {
  royal: {
    name: "Royal",
    bonus: 0.01, // +1% XP
    tradeoff: -0.005, // -0.5% mining
    bonusType: "xp",
    tradeoffType: "mining",
  },
  warrior: {
    name: "Warrior",
    bonus: 0.015, // +1.5% mining
    tradeoff: -0.005, // -0.5% XP
    bonusType: "mining",
    tradeoffType: "xp",
  },
  rogue: {
    name: "Rogue",
    bonus: 0.01, // +1% rare drops
    tradeoff: -0.01, // -1% common drops
    bonusType: "drops_rare",
    tradeoffType: "drops_common",
  },
  mystic: {
    name: "Mystic",
    bonus: 0.02, // +2% cosmic affinity
    tradeoff: -0.1, // Requires 10% more XP
    bonusType: "evolution",
    tradeoffType: "xp_required",
  },
};

// =============================================================================
// HERITAGE CONFIGURATIONS
// =============================================================================

// BALANCED: Heritage bonuses (flavor, +1% each)
export const HERITAGE_CONFIGS: Record<Heritage, HeritageConfig> = {
  americas: {
    name: "Americas",
    spirits: ["Pachamama", "Quetzalcoatl", "Thunderbird"],
    flavor: "Conectado a la tierra",
    bonus: 0.01, // +1% resistance
    bonusType: "resistance",
    favoriteEvent: "solstice",
  },
  africa: {
    name: "Africa",
    spirits: ["Shango", "Oshun", "Anansi"],
    flavor: "Portador del Ache",
    bonus: 0.01, // +1% group XP
    bonusType: "group_xp",
    favoriteEvent: "lunar_phase",
  },
  asia: {
    name: "Asia",
    spirits: ["Ryu", "Kitsune", "Ganesha"],
    flavor: "En armonia",
    bonus: 0.01, // +1% focus
    bonusType: "focus",
    favoriteEvent: "equinox",
  },
  europa: {
    name: "Europa",
    spirits: ["Dryad", "Norns", "Salamandra"],
    flavor: "Guardian elemental",
    bonus: 0.01, // +1% protection
    bonusType: "protection",
    favoriteEvent: "eclipse_lunar",
  },
  oceania: {
    name: "Oceania",
    spirits: ["Maui", "Rainbow Serpent", "Tangaroa"],
    flavor: "Hijo del oceano",
    bonus: 0.01, // +1% adaptability
    bonusType: "adaptability",
    favoriteEvent: "meteor_shower",
  },
};

// =============================================================================
// RARITY MULTIPLIERS (Balanced - prestige not power)
// =============================================================================

// BALANCED: Rarity multipliers for cosmic (prestige, not power)
export const RARITY_MULTIPLIERS = {
  common: 0,
  uncommon: 0.005, // +0.5%
  rare: 0.01, // +1%
  epic: 0.015, // +1.5%
  legendary: 0.02, // +2%
  mythic: 0.025, // +2.5% (cap)
} as const;

export type Rarity = keyof typeof RARITY_MULTIPLIERS;

// =============================================================================
// MOON PHASE EMOJI MAP
// =============================================================================

export const MOON_EMOJI: Record<MoonPhase, string> = {
  new: "🌑",
  waxing_crescent: "🌒",
  first_quarter: "🌓",
  waxing_gibbous: "🌔",
  full: "🌕",
  waning_gibbous: "🌖",
  last_quarter: "🌗",
  waning_crescent: "🌘",
};

// =============================================================================
// SEASON EMOJI MAP
// =============================================================================

export const SEASON_EMOJI: Record<Season, string> = {
  spring: "🌸",
  summer: "☀️",
  autumn: "🍂",
  winter: "❄️",
};

// =============================================================================
// BASE TYPE DESCRIPTIONS
// =============================================================================

export const BASE_TYPE_INFO: Record<
  BaseType,
  { name: string; description: string; strength: string; weakness: string }
> = {
  human: {
    name: "Human",
    description: "Conectados a la energia colectiva humana",
    strength: "+10% a todo (versatil)",
    weakness: "Sin especialidad",
  },
  animal: {
    name: "Animal",
    description: "Nacidos del ruido natural",
    strength: "+20% evolucion",
    weakness: "-10% en eclipses solares",
  },
  robot: {
    name: "Robot",
    description: "Emergieron de codigo legacy",
    strength: "+20% mining",
    weakness: "-10% en lunas llenas",
  },
  mystic: {
    name: "Mystic",
    description: "Manifestaciones de Bitcoin perdidos",
    strength: "+15% en eventos lunares",
    weakness: "-5% constante",
  },
  alien: {
    name: "Alien",
    description: "Llegaron de otras blockchains",
    strength: "+20% en eventos raros",
    weakness: "-15% normalmente",
  },
};
