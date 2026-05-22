/**
 * Bloodline Overlay Component
 *
 * Agrega elementos visuales de linaje sobre cualquier sprite base.
 * - Royal: Corona elaborada, capa de armiño, cetro con orbe, anillos de sello
 * - Warrior: Cicatrices de batalla, armadura completa, pintura de guerra, armas
 * - Rogue: Capucha profunda, máscara, dagas ocultas, sombras, herramientas
 * - Mystic: Diadema mágica, runas flotantes, tercer ojo, aura, tatuajes místicos
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type Bloodline, BLOODLINE_STYLES } from "./types";

interface BloodlineOverlayProps {
  bloodline: Bloodline;
  size?: number;
  animated?: boolean;
}

// Detailed color palettes for each bloodline
// Note: Each bloodline uses its specific colors but we keep a common subset
// for cross-bloodline effects
const BLOODLINE_COLORS = {
  royal: {
    gold: "#ffd700",
    gold_dark: "#b8860b",
    gold_light: "#fff0a0",
    gold_trim: "#fbbf24",
    ruby: "#dc143c",
    sapphire: "#1e40af",
    emerald: "#059669",
    purple: "#7c3aed",
    velvet: "#581c87",
    ermine: "#fefefe",
    ermine_dots: "#1f2937",
    cape: "#7f1d1d",
    cape_dark: "#450a0a",
    arcane_light: "#c084fc", // For scepter orb glow
  },
  warrior: {
    iron: "#4b5563",
    iron_light: "#9ca3af",
    iron_dark: "#374151",
    steel: "#64748b",
    blood: "#dc2626",
    blood_dark: "#7f1d1d",
    leather: "#78350f",
    leather_light: "#a16207",
    paint: "#1f2937",
    paint_red: "#991b1b",
    gold: "#ffd700",
    gold_dark: "#b8860b",
    gold_light: "#fff0a0",
    gold_trim: "#fbbf24",
    bone: "#fef3c7",
    shadow: "#1f2937", // Dark shadows
    arcane_light: "#c084fc", // Unused but for type consistency
  },
  rogue: {
    shadow: "#1f2937",
    shadow_deep: "#111827",
    shadow_light: "#374151",
    midnight: "#0f172a",
    blade: "#94a3b8",
    blade_edge: "#e2e8f0",
    leather: "#44403c",
    leather_dark: "#292524",
    poison: "#22c55e",
    smoke: "#6b7280",
    eye_glow: "#ef4444",
    gold: "#ffd700",
    gold_dark: "#b8860b",
    gold_light: "#fff0a0",
    gold_trim: "#fbbf24",
    arcane_light: "#c084fc", // Unused but for type consistency
  },
  mystic: {
    arcane: "#8b5cf6",
    arcane_light: "#c084fc",
    arcane_dark: "#6d28d9",
    ethereal: "#a78bfa",
    cosmic: "#e879f9",
    void: "#1e1b4b",
    gold: "#fbbf24",
    gold_dark: "#b8860b",
    gold_light: "#fff0a0",
    gold_trim: "#fbbf24",
    crystal: "#67e8f9",
    rune_glow: "#f0abfc",
    third_eye: "#c084fc",
  },
};

// Type-specific color getters to avoid union type issues
const getRoyalColors = () => BLOODLINE_COLORS.royal;
const getWarriorColors = () => BLOODLINE_COLORS.warrior;
const getRogueColors = () => BLOODLINE_COLORS.rogue;
const getMysticColors = () => BLOODLINE_COLORS.mystic;

export const BloodlineOverlay: FC<BloodlineOverlayProps> = ({
  bloodline,
  size = 64,
  animated = true,
}) => {
  const style = BLOODLINE_STYLES[bloodline];

  // Royal Bloodline - Nobility and power
  const renderRoyal = () => {
    const c = getRoyalColors();
    return (
      <>
        {/* Elaborate Crown - Fixed coordinates to stay within viewBox 0-32 */}
        <rect x="9" y="1" width="14" height="3" fill={c.gold} />
        <rect x="10" y="0" width="12" height="1" fill={c.gold_dark} />
        {/* Crown points - shifted to positive coordinates */}
        <rect x="10" y="0" width="2" height="2" fill={c.gold} />
        <rect x="14" y="0" width="2" height="2" fill={c.gold} />
        <rect x="15" y="0" width="2" height="1" fill={c.gold_light} />
        <rect x="20" y="0" width="2" height="2" fill={c.gold} />
        {/* Crown jewels */}
        <rect x="10" y="1" width="1" height="1" fill={c.ruby} />
        <rect x="11" y="1" width="1" height="1" fill="#ffffff" opacity="0.5" />
        <rect x="15" y="0" width="2" height="1" fill={c.sapphire} />
        <rect x="16" y="0" width="1" height="1" fill="#ffffff" opacity="0.4" />
        <rect x="21" y="1" width="1" height="1" fill={c.ruby} />
        {/* Crown band detail */}
        <rect x="10" y="1" width="12" height="1" fill={c.gold_dark} />
        <rect x="12" y="2" width="1" height="1" fill={c.emerald} />
        <rect x="15" y="2" width="2" height="1" fill={c.ruby} />
        <rect x="19" y="2" width="1" height="1" fill={c.emerald} />
        {/* Crown shimmer */}
        <rect
          x="11"
          y="1"
          width="2"
          height="1"
          fill={c.gold_light}
          opacity="0.6"
        />
        <rect
          x="19"
          y="1"
          width="2"
          height="1"
          fill={c.gold_light}
          opacity="0.6"
        />

        {/* Royal Cape with Ermine */}
        <rect x="5" y="16" width="3" height="14" fill={c.cape} />
        <rect x="24" y="16" width="3" height="14" fill={c.cape} />
        <rect x="4" y="18" width="1" height="12" fill={c.cape_dark} />
        <rect x="27" y="18" width="1" height="12" fill={c.cape_dark} />
        {/* Cape inside - velvet purple */}
        <rect
          x="6"
          y="17"
          width="2"
          height="13"
          fill={c.velvet}
          opacity="0.7"
        />
        <rect
          x="24"
          y="17"
          width="2"
          height="13"
          fill={c.velvet}
          opacity="0.7"
        />
        {/* Ermine collar */}
        <rect x="5" y="15" width="4" height="2" fill={c.ermine} />
        <rect x="23" y="15" width="4" height="2" fill={c.ermine} />
        <rect x="6" y="15" width="1" height="1" fill={c.ermine_dots} />
        <rect x="8" y="16" width="1" height="1" fill={c.ermine_dots} />
        <rect x="23" y="16" width="1" height="1" fill={c.ermine_dots} />
        <rect x="25" y="15" width="1" height="1" fill={c.ermine_dots} />

        {/* Royal Scepter */}
        <rect x="1" y="18" width="1" height="10" fill={c.gold} />
        <rect x="0" y="17" width="3" height="2" fill={c.gold_dark} />
        <rect x="1" y="15" width="1" height="2" fill={c.gold} />
        {/* Scepter orb */}
        <rect x="0" y="13" width="3" height="3" fill={c.purple} />
        <rect x="1" y="12" width="1" height="1" fill={c.arcane_light} />
        <rect x="0" y="14" width="1" height="1" fill="#ffffff" opacity="0.5" />
        {/* Scepter cross */}
        <rect x="0" y="11" width="3" height="1" fill={c.gold} />
        <rect x="1" y="10" width="1" height="3" fill={c.gold} />

        {/* Signet Ring effect (on hand area) */}
        <rect x="28" y="25" width="2" height="2" fill={c.gold} opacity="0.8" />
        <rect x="29" y="26" width="1" height="1" fill={c.ruby} />

        {/* Royal medallion on chest */}
        <rect
          x="14"
          y="18"
          width="4"
          height="4"
          fill={c.gold_dark}
          opacity="0.6"
        />
        <rect
          x="15"
          y="19"
          width="2"
          height="2"
          fill={c.sapphire}
          opacity="0.8"
        />

        {/* Gold trim on clothes */}
        <rect x="10" y="17" width="12" height="1" fill={c.gold} opacity="0.5" />
      </>
    );
  };

  // Warrior Bloodline - Battle-hardened
  const renderWarrior = () => {
    const c = getWarriorColors();
    return (
      <>
        {/* Battle Helm */}
        <rect x="7" y="3" width="18" height="4" fill={c.iron} />
        <rect x="8" y="2" width="16" height="1" fill={c.iron_dark} />
        <rect x="9" y="1" width="14" height="1" fill={c.iron_light} />
        {/* Helm crest */}
        <rect x="14" y="0" width="4" height="2" fill={c.blood} />
        <rect x="15" y="-1" width="2" height="2" fill={c.blood_dark} />
        {/* Helm face guard */}
        <rect x="9" y="7" width="2" height="4" fill={c.iron_dark} />
        <rect x="21" y="7" width="2" height="4" fill={c.iron_dark} />
        <rect x="11" y="8" width="1" height="1" fill={c.shadow} />
        <rect x="20" y="8" width="1" height="1" fill={c.shadow} />
        {/* Helm rivets */}
        <rect x="8" y="4" width="1" height="1" fill={c.gold_trim} />
        <rect x="12" y="3" width="1" height="1" fill={c.gold_trim} />
        <rect x="19" y="3" width="1" height="1" fill={c.gold_trim} />
        <rect x="23" y="4" width="1" height="1" fill={c.gold_trim} />

        {/* Battle Scars */}
        <rect x="10" y="10" width="1" height="4" fill={c.blood} opacity="0.8" />
        <rect
          x="11"
          y="11"
          width="1"
          height="2"
          fill={c.blood_dark}
          opacity="0.6"
        />
        <rect x="9" y="12" width="1" height="1" fill={c.blood} opacity="0.5" />
        {/* Right side scar */}
        <rect x="21" y="9" width="1" height="3" fill={c.blood} opacity="0.7" />
        <rect
          x="22"
          y="10"
          width="1"
          height="1"
          fill={c.blood_dark}
          opacity="0.5"
        />

        {/* War Paint */}
        <rect x="8" y="13" width="2" height="1" fill={c.paint} opacity="0.6" />
        <rect x="9" y="14" width="1" height="1" fill={c.paint} opacity="0.5" />
        <rect x="22" y="13" width="2" height="1" fill={c.paint} opacity="0.6" />
        <rect x="22" y="14" width="1" height="1" fill={c.paint} opacity="0.5" />
        {/* Red war paint stripes */}
        <rect
          x="7"
          y="10"
          width="1"
          height="3"
          fill={c.paint_red}
          opacity="0.5"
        />
        <rect
          x="24"
          y="10"
          width="1"
          height="3"
          fill={c.paint_red}
          opacity="0.5"
        />

        {/* Shoulder Pauldrons */}
        <rect x="2" y="15" width="6" height="5" fill={c.iron} />
        <rect x="24" y="15" width="6" height="5" fill={c.iron} />
        {/* Pauldron layers */}
        <rect x="3" y="16" width="4" height="1" fill={c.iron_light} />
        <rect x="3" y="18" width="4" height="1" fill={c.iron_light} />
        <rect x="25" y="16" width="4" height="1" fill={c.iron_light} />
        <rect x="25" y="18" width="4" height="1" fill={c.iron_light} />
        {/* Pauldron spikes */}
        <rect x="1" y="14" width="2" height="2" fill={c.iron_dark} />
        <rect x="5" y="13" width="2" height="2" fill={c.iron_dark} />
        <rect x="25" y="13" width="2" height="2" fill={c.iron_dark} />
        <rect x="29" y="14" width="2" height="2" fill={c.iron_dark} />
        {/* Pauldron gold trim */}
        <rect
          x="2"
          y="15"
          width="6"
          height="1"
          fill={c.gold_trim}
          opacity="0.7"
        />
        <rect
          x="24"
          y="15"
          width="6"
          height="1"
          fill={c.gold_trim}
          opacity="0.7"
        />

        {/* Arm guards */}
        <rect x="2" y="22" width="3" height="4" fill={c.leather} />
        <rect x="27" y="22" width="3" height="4" fill={c.leather} />
        <rect
          x="3"
          y="23"
          width="1"
          height="2"
          fill={c.leather_light}
          opacity="0.5"
        />
        <rect
          x="28"
          y="23"
          width="1"
          height="2"
          fill={c.leather_light}
          opacity="0.5"
        />

        {/* Battle emblem on chest */}
        <rect
          x="14"
          y="19"
          width="4"
          height="4"
          fill={c.iron_dark}
          opacity="0.5"
        />
        <rect x="15" y="20" width="2" height="2" fill={c.blood} opacity="0.7" />

        {/* Sword hint on back */}
        <rect x="29" y="8" width="1" height="12" fill={c.steel} opacity="0.6" />
        <rect
          x="28"
          y="7"
          width="3"
          height="2"
          fill={c.iron_dark}
          opacity="0.7"
        />
        <rect x="29" y="6" width="1" height="1" fill={c.bone} opacity="0.5" />
      </>
    );
  };

  // Rogue Bloodline - Shadows and stealth
  const renderRogue = () => {
    const c = getRogueColors();
    return (
      <>
        {/* Deep Hood */}
        <rect x="6" y="2" width="20" height="5" fill={c.shadow} />
        <rect x="5" y="4" width="2" height="8" fill={c.shadow} />
        <rect x="25" y="4" width="2" height="8" fill={c.shadow} />
        <rect x="7" y="1" width="18" height="2" fill={c.shadow_deep} />
        {/* Hood inner shadow */}
        <rect
          x="8"
          y="3"
          width="16"
          height="4"
          fill={c.midnight}
          opacity="0.8"
        />
        <rect x="9" y="4" width="14" height="2" fill={c.shadow_deep} />
        {/* Hood edge */}
        <rect x="7" y="7" width="2" height="1" fill={c.shadow_light} />
        <rect x="23" y="7" width="2" height="1" fill={c.shadow_light} />

        {/* Face Mask/Bandana */}
        <rect x="8" y="8" width="16" height="5" fill={c.shadow} />
        <rect x="7" y="9" width="1" height="3" fill={c.shadow_deep} />
        <rect x="24" y="9" width="1" height="3" fill={c.shadow_deep} />
        {/* Eye slits - menacing glow */}
        <rect x="10" y="9" width="4" height="2" fill={c.shadow_deep} />
        <rect x="18" y="9" width="4" height="2" fill={c.shadow_deep} />
        <rect
          x="11"
          y="10"
          width="2"
          height="1"
          fill={c.eye_glow}
          opacity="0.6"
        />
        <rect
          x="19"
          y="10"
          width="2"
          height="1"
          fill={c.eye_glow}
          opacity="0.6"
        />
        {/* Mask detail */}
        <rect
          x="14"
          y="11"
          width="4"
          height="1"
          fill={c.shadow_light}
          opacity="0.4"
        />

        {/* Shadow Cloak */}
        <rect
          x="3"
          y="16"
          width="3"
          height="14"
          fill={c.shadow}
          opacity="0.85"
        />
        <rect
          x="26"
          y="16"
          width="3"
          height="14"
          fill={c.shadow}
          opacity="0.85"
        />
        <rect
          x="2"
          y="20"
          width="1"
          height="10"
          fill={c.shadow_deep}
          opacity="0.7"
        />
        <rect
          x="29"
          y="20"
          width="1"
          height="10"
          fill={c.shadow_deep}
          opacity="0.7"
        />
        {/* Cloak wisps */}
        <rect x="1" y="26" width="2" height="3" fill={c.smoke} opacity="0.3" />
        <rect x="29" y="27" width="2" height="2" fill={c.smoke} opacity="0.3" />
        <rect x="0" y="28" width="1" height="2" fill={c.smoke} opacity="0.2" />
        <rect x="30" y="29" width="1" height="1" fill={c.smoke} opacity="0.2" />

        {/* Hidden Daggers */}
        {/* Left wrist blade */}
        <rect x="0" y="24" width="1" height="5" fill={c.blade} />
        <rect x="0" y="24" width="1" height="1" fill={c.blade_edge} />
        {/* Right wrist blade */}
        <rect x="31" y="23" width="1" height="5" fill={c.blade} />
        <rect x="31" y="23" width="1" height="1" fill={c.blade_edge} />
        {/* Back dagger */}
        <rect x="28" y="18" width="1" height="6" fill={c.blade} opacity="0.7" />
        <rect
          x="27"
          y="17"
          width="3"
          height="2"
          fill={c.leather_dark}
          opacity="0.8"
        />
        <rect
          x="28"
          y="18"
          width="1"
          height="1"
          fill={c.blade_edge}
          opacity="0.6"
        />

        {/* Poison vials (belt) */}
        <rect
          x="10"
          y="24"
          width="1"
          height="2"
          fill={c.poison}
          opacity="0.6"
        />
        <rect
          x="21"
          y="24"
          width="1"
          height="2"
          fill={c.poison}
          opacity="0.6"
        />

        {/* Lockpicks hint */}
        <rect x="4" y="22" width="1" height="3" fill={c.blade} opacity="0.5" />
        <rect x="5" y="23" width="1" height="2" fill={c.blade} opacity="0.4" />

        {/* Smoke particles */}
        {animated && (
          <>
            <rect
              x="2"
              y="14"
              width="1"
              height="1"
              fill={c.smoke}
              opacity="0.3"
              className="animate-nft-drift"
            />
            <rect
              x="28"
              y="12"
              width="1"
              height="1"
              fill={c.smoke}
              opacity="0.2"
              className="animate-nft-drift"
              style={{ animationDelay: "0.5s" }}
            />
            <rect
              x="4"
              y="28"
              width="1"
              height="1"
              fill={c.smoke}
              opacity="0.25"
              className="animate-nft-drift"
              style={{ animationDelay: "1s" }}
            />
          </>
        )}
      </>
    );
  };

  // Mystic Bloodline - Arcane power
  const renderMystic = () => {
    const c = getMysticColors();
    return (
      <>
        {/* Mystical Circlet */}
        <rect x="9" y="3" width="14" height="2" fill={c.arcane} />
        <rect x="8" y="4" width="16" height="1" fill={c.arcane_dark} />
        <rect x="10" y="2" width="12" height="1" fill={c.arcane_light} />
        {/* Central third eye gem */}
        <rect x="14" y="1" width="4" height="3" fill={c.void} />
        <rect x="15" y="0" width="2" height="4" fill={c.third_eye} />
        <rect x="15" y="1" width="2" height="2" fill={c.cosmic} />
        <rect x="15" y="1" width="1" height="1" fill="#ffffff" opacity="0.7" />
        {/* Side gems */}
        <rect
          x="10"
          y="3"
          width="2"
          height="1"
          fill={c.crystal}
          opacity="0.8"
        />
        <rect
          x="20"
          y="3"
          width="2"
          height="1"
          fill={c.crystal}
          opacity="0.8"
        />
        {/* Circlet glow */}
        <rect
          x="9"
          y="2"
          width="1"
          height="1"
          fill={c.rune_glow}
          opacity="0.5"
        />
        <rect
          x="22"
          y="2"
          width="1"
          height="1"
          fill={c.rune_glow}
          opacity="0.5"
        />

        {/* Third Eye effect on forehead */}
        <rect
          x="15"
          y="6"
          width="2"
          height="1"
          fill={c.third_eye}
          opacity="0.9"
        />
        <rect
          x="14"
          y="7"
          width="4"
          height="1"
          fill={c.arcane_light}
          opacity="0.4"
        />

        {/* Floating Runes */}
        {animated ? (
          <>
            {/* Left runes */}
            <rect
              x="2"
              y="10"
              width="2"
              height="2"
              fill={c.arcane}
              opacity="0.7"
              className="animate-nft-rune"
            />
            <rect
              x="3"
              y="11"
              width="1"
              height="1"
              fill={c.rune_glow}
              opacity="0.9"
              className="animate-nft-rune"
            />
            <rect
              x="4"
              y="18"
              width="2"
              height="2"
              fill={c.ethereal}
              opacity="0.6"
              className="animate-nft-rune"
              style={{ animationDelay: "0.3s" }}
            />
            <rect
              x="3"
              y="25"
              width="2"
              height="2"
              fill={c.cosmic}
              opacity="0.5"
              className="animate-nft-rune"
              style={{ animationDelay: "0.6s" }}
            />
            {/* Right runes */}
            <rect
              x="28"
              y="12"
              width="2"
              height="2"
              fill={c.arcane}
              opacity="0.7"
              className="animate-nft-rune"
              style={{ animationDelay: "0.15s" }}
            />
            <rect
              x="28"
              y="13"
              width="1"
              height="1"
              fill={c.rune_glow}
              opacity="0.9"
              className="animate-nft-rune"
              style={{ animationDelay: "0.15s" }}
            />
            <rect
              x="26"
              y="20"
              width="2"
              height="2"
              fill={c.ethereal}
              opacity="0.6"
              className="animate-nft-rune"
              style={{ animationDelay: "0.45s" }}
            />
            <rect
              x="27"
              y="27"
              width="2"
              height="2"
              fill={c.cosmic}
              opacity="0.5"
              className="animate-nft-rune"
              style={{ animationDelay: "0.75s" }}
            />
          </>
        ) : (
          <>
            <rect
              x="2"
              y="10"
              width="2"
              height="2"
              fill={c.arcane}
              opacity="0.7"
            />
            <rect
              x="4"
              y="18"
              width="2"
              height="2"
              fill={c.ethereal}
              opacity="0.6"
            />
            <rect
              x="3"
              y="25"
              width="2"
              height="2"
              fill={c.cosmic}
              opacity="0.5"
            />
            <rect
              x="28"
              y="12"
              width="2"
              height="2"
              fill={c.arcane}
              opacity="0.7"
            />
            <rect
              x="26"
              y="20"
              width="2"
              height="2"
              fill={c.ethereal}
              opacity="0.6"
            />
            <rect
              x="27"
              y="27"
              width="2"
              height="2"
              fill={c.cosmic}
              opacity="0.5"
            />
          </>
        )}

        {/* Mystical Tattoos/Sigils on body */}
        <rect
          x="12"
          y="19"
          width="1"
          height="4"
          fill={c.arcane}
          opacity="0.6"
        />
        <rect
          x="13"
          y="20"
          width="1"
          height="2"
          fill={c.arcane_light}
          opacity="0.5"
        />
        <rect
          x="19"
          y="19"
          width="1"
          height="4"
          fill={c.arcane}
          opacity="0.6"
        />
        <rect
          x="18"
          y="20"
          width="1"
          height="2"
          fill={c.arcane_light}
          opacity="0.5"
        />
        {/* Central sigil */}
        <rect x="14" y="21" width="4" height="3" fill={c.void} opacity="0.4" />
        <rect
          x="15"
          y="22"
          width="2"
          height="1"
          fill={c.arcane_light}
          opacity="0.8"
        />
        <rect
          x="14"
          y="22"
          width="1"
          height="1"
          fill={c.cosmic}
          opacity="0.6"
        />
        <rect
          x="17"
          y="22"
          width="1"
          height="1"
          fill={c.cosmic}
          opacity="0.6"
        />

        {/* Magic Staff (behind) */}
        <rect x="30" y="10" width="1" height="16" fill={c.gold} opacity="0.7" />
        <rect
          x="29"
          y="8"
          width="3"
          height="3"
          fill={c.arcane_dark}
          opacity="0.8"
        />
        <rect x="30" y="7" width="1" height="2" fill={c.cosmic} opacity="0.9" />
        <rect
          x="29"
          y="6"
          width="3"
          height="1"
          fill={c.crystal}
          opacity="0.7"
        />
        {animated && (
          <rect
            x="30"
            y="7"
            width="1"
            height="1"
            fill="#ffffff"
            className="animate-nft-spark"
            opacity="0.6"
          />
        )}

        {/* Arm mystic bands */}
        <rect x="4" y="21" width="3" height="1" fill={c.arcane} opacity="0.6" />
        <rect
          x="4"
          y="23"
          width="3"
          height="1"
          fill={c.ethereal}
          opacity="0.5"
        />
        <rect
          x="25"
          y="21"
          width="3"
          height="1"
          fill={c.arcane}
          opacity="0.6"
        />
        <rect
          x="25"
          y="23"
          width="3"
          height="1"
          fill={c.ethereal}
          opacity="0.5"
        />

        {/* Aura glow particles */}
        {animated && (
          <>
            <rect
              x="6"
              y="8"
              width="1"
              height="1"
              fill={c.rune_glow}
              opacity="0.4"
              className="animate-nft-twinkle"
              style={{ animationDelay: "0.2s" }}
            />
            <rect
              x="25"
              y="6"
              width="1"
              height="1"
              fill={c.rune_glow}
              opacity="0.3"
              className="animate-nft-twinkle"
              style={{ animationDelay: "0.7s" }}
            />
            <rect
              x="8"
              y="28"
              width="1"
              height="1"
              fill={c.cosmic}
              opacity="0.3"
              className="animate-nft-twinkle"
              style={{ animationDelay: "1.2s" }}
            />
            <rect
              x="23"
              y="29"
              width="1"
              height="1"
              fill={c.cosmic}
              opacity="0.35"
              className="animate-nft-twinkle"
              style={{ animationDelay: "0.9s" }}
            />
          </>
        )}
      </>
    );
  };

  // Select renderer based on bloodline
  const renderBloodline = () => {
    switch (bloodline) {
      case "royal":
        return renderRoyal();
      case "warrior":
        return renderWarrior();
      case "rogue":
        return renderRogue();
      case "mystic":
        return renderMystic();
      default:
        return null;
    }
  };

  // ── Glowing-eyes window: punches through hood/helm so rare eyes always show ──
  // Only active for bloodlines that occlude the eye area (rogue hood, warrior helm)
  const isOccludingBloodline = bloodline === "rogue" || bloodline === "warrior";
  // Eye Y positions: canonical pixel-art eye row at y=10
  const EYE_Y = 10;
  const rogueEyeColor = "#ef4444"; // menacing red
  const warriorEyeColor = "#22d3ee"; // steel cyan
  const glowingEyeColor =
    bloodline === "rogue" ? rogueEyeColor : warriorEyeColor;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated" }}
      className="absolute inset-0 pointer-events-none"
    >
      {/* SVG clipPath for eye-window punch-through */}
      {isOccludingBloodline && (
        <defs>
          <clipPath id={`eyeWindow-${bloodline}`}>
            {/* Left eye window */}
            <rect x="10" y={EYE_Y - 1} width="4" height="3" />
            {/* Right eye window */}
            <rect x="18" y={EYE_Y - 1} width="4" height="3" />
          </clipPath>
        </defs>
      )}

      {/* Bloodline overlay (crown, helm, hood, aura, etc.) */}
      {renderBloodline()}

      {/* Glowing eyes rendered OVER the bloodline overlay, clipped to eye windows */}
      {isOccludingBloodline && (
        <g clipPath={`url(#eyeWindow-${bloodline})`}>
          {/* Iris glow — punches through hood/helm */}
          <circle cx="12" cy={EYE_Y} r="1.8" fill={glowingEyeColor} opacity="0.92" />
          <circle cx="20" cy={EYE_Y} r="1.8" fill={glowingEyeColor} opacity="0.92" />
          {/* Specular highlight */}
          <circle cx="11.5" cy={EYE_Y - 0.5} r="0.45" fill="#ffffff" opacity="0.9" />
          <circle cx="19.5" cy={EYE_Y - 0.5} r="0.45" fill="#ffffff" opacity="0.9" />
          {/* Outer glow ring */}
          {animated && (
            <>
              <circle
                cx="12"
                cy={EYE_Y}
                r="2.2"
                fill="none"
                stroke={glowingEyeColor}
                strokeWidth="0.5"
                opacity="0.5"
                className="animate-nft-rune"
              />
              <circle
                cx="20"
                cy={EYE_Y}
                r="2.2"
                fill="none"
                stroke={glowingEyeColor}
                strokeWidth="0.5"
                opacity="0.5"
                className="animate-nft-rune"
                style={{ animationDelay: "0.3s" }}
              />
            </>
          )}
        </g>
      )}
    </svg>
  );
};

/**
 * Bloodline Aura Effect
 * Efecto de aura alrededor del sprite completo
 */
interface BloodlineAuraProps {
  bloodline: Bloodline;
  size?: number;
  intensity?: "low" | "medium" | "high";
}

export const BloodlineAura: FC<BloodlineAuraProps> = ({
  bloodline,
  size = 64,
  intensity = "medium",
}) => {
  // MINIMALIST: Very subtle aura with gentle animation
  const auraColors: Record<Bloodline, string> = {
    royal: "#ffd700",
    warrior: "#dc2626",
    rogue: "#1f2937",
    mystic: "#8b5cf6",
  };

  // Slightly higher opacity for visibility
  const opacityMap = {
    low: 0.08,
    medium: 0.12,
    high: 0.18,
  };

  // Blur radius
  const blurMap = {
    low: size / 12,
    medium: size / 8,
    high: size / 6,
  };

  return (
    <div
      className="absolute inset-0 rounded-full pointer-events-none animate-nft-aura"
      style={{
        boxShadow: `0 0 ${blurMap[intensity]}px ${auraColors[bloodline]}`,
        opacity: opacityMap[intensity],
      }}
    />
  );
};

/**
 * Bloodline Particle Effect
 * Partículas temáticas flotantes para cada linaje
 */
interface BloodlineParticlesProps {
  bloodline: Bloodline;
  size?: number;
}

export const BloodlineParticles: FC<BloodlineParticlesProps> = ({
  bloodline,
  size = 64,
}) => {
  const particleStyles: Record<
    Bloodline,
    { colors: string[]; shapes: string }
  > = {
    royal: {
      colors: ["#ffd700", "#dc143c", "#1e40af"],
      shapes: "sparkle",
    },
    warrior: {
      colors: ["#dc2626", "#4b5563", "#fbbf24"],
      shapes: "ember",
    },
    rogue: {
      colors: ["#1f2937", "#374151", "#22c55e"],
      shapes: "smoke",
    },
    mystic: {
      colors: ["#8b5cf6", "#c084fc", "#e879f9"],
      shapes: "rune",
    },
  };

  const { colors } = particleStyles[bloodline];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated" }}
      className="absolute inset-0 pointer-events-none"
    >
      {/* Floating particles */}
      <rect
        x="3"
        y="5"
        width="1"
        height="1"
        fill={colors[0]}
        opacity="0.5"
        className="animate-nft-float"
      />
      <rect
        x="27"
        y="7"
        width="1"
        height="1"
        fill={colors[1]}
        opacity="0.4"
        className="animate-nft-float"
        style={{ animationDelay: "0.4s" }}
      />
      <rect
        x="5"
        y="25"
        width="1"
        height="1"
        fill={colors[2]}
        opacity="0.45"
        className="animate-nft-float"
        style={{ animationDelay: "0.8s" }}
      />
      <rect
        x="26"
        y="23"
        width="1"
        height="1"
        fill={colors[0]}
        opacity="0.35"
        className="animate-nft-float"
        style={{ animationDelay: "1.2s" }}
      />
    </svg>
  );
};

export default BloodlineOverlay;
