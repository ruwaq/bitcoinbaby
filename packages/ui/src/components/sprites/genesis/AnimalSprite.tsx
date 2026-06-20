/**
 * Animal Spark Sprite - CUTE CREATURE DESIGN (Pixel Art Edition)
 *
 * Adorable animal babies with big eyes and soft features.
 * Aesthetic: 32x32 strict pixel art grid, cohesive and highly valuable visual asset.
 *
 * Variants:
 * - Kitten: Fluffy cat baby with curious expression
 * - Puppy: Loyal dog baby with floppy ears
 * - Bunny: Soft rabbit with long ears
 * - Fox: Clever fox kit with bushy tail
 * - Bear: Cuddly bear cub with round features
 *
 * Common elements:
 * - Big expressive pixel-art eyes
 * - Soft fur textures
 * - Natural animal features (ears, tails, paws)
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface AnimalSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type AnimalVariant = "kitten" | "puppy" | "bunny" | "fox" | "bear";

// Fur colors - natural animal tones
const FUR_COLORS = [
  { base: "#f5deb3", shadow: "#d4c4a3", highlight: "#fff8e7" }, // Cream
  { base: "#d4a574", shadow: "#b48554", highlight: "#e8c4a0" }, // Golden
  { base: "#8b6443", shadow: "#6b4423", highlight: "#a67c52" }, // Brown
  { base: "#4a4a4a", shadow: "#2a2a2a", highlight: "#6a6a6a" }, // Gray
  { base: "#1a1a1a", shadow: "#0a0a0a", highlight: "#3a3a3a" }, // Black
  { base: "#ff9966", shadow: "#dd7744", highlight: "#ffbb88" }, // Orange
  { base: "#ffffff", shadow: "#e0e0e0", highlight: "#ffffff" }, // White
  { base: "#c4956a", shadow: "#a47550", highlight: "#d4b58a" }, // Tan
];

// Eye colors
const EYE_COLORS = [
  "#1f2937", // Dark
  "#3b82f6", // Blue
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
];

// Nose colors
const NOSE_COLORS = [
  "#1a1a1a", // Black
  "#8b6443", // Brown
  "#ff9999", // Pink
];

interface VariantColors {
  fur: { base: string; shadow: string; highlight: string };
  eyes: string;
  nose: string;
  innerEar: string;
}

const getVariantColors = (dna: string): VariantColors => {
  const furIdx = parseInt(dna[0] || "0", 16) % FUR_COLORS.length;
  const eyeIdx = parseInt(dna[1] || "0", 16) % EYE_COLORS.length;
  const noseIdx = parseInt(dna[2] || "0", 16) % NOSE_COLORS.length;

  return {
    fur: FUR_COLORS[furIdx],
    eyes: EYE_COLORS[eyeIdx],
    nose: NOSE_COLORS[noseIdx],
    innerEar: "#ffcccc", // Soft pink inner ear
  };
};

const getVariant = (dna: string): AnimalVariant => {
  const variants: AnimalVariant[] = ["kitten", "puppy", "bunny", "fox", "bear"];
  return variants[parseInt(dna[3] || "0", 16) % 5];
};

export const AnimalSprite: FC<AnimalSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000000000",
  className = "",
}) => {
  const colors = getVariantColors(dna);
  const variant = getVariant(dna);
  const { fur, eyes, nose, innerEar } = colors;

  const stateClasses: Record<BabyState, string> = {
    idle: "animate-[float_3s_ease-in-out_infinite]",
    happy: "animate-bounce",
    sleeping: "",
    hungry: "animate-[shake_0.5s_ease-in-out_infinite]",
    mining: "animate-pulse",
    learning: "",
    evolving: "animate-spin",
    thriving: "animate-pulse",
    struggling: "animate-[shake_1s_ease-in-out_infinite]",
  };

  // Render Kitten variant in pixel art
  const renderKitten = () => (
    <>
      {/* ===== BODY ===== */}
      {/* Torso */}
      <rect x="10" y="18" width="12" height="9" fill={fur.base} />
      <rect x="9" y="19" width="14" height="7" fill={fur.base} />
      <rect x="12" y="18" width="8" height="7" fill={fur.highlight} opacity="0.3" />
      <rect x="10" y="26" width="12" height="1" fill={fur.shadow} />

      {/* ===== HEAD ===== */}
      <rect x="9" y="6" width="14" height="11" fill={fur.base} />
      <rect x="8" y="8" width="16" height="7" fill={fur.base} />
      <rect x="10" y="5" width="12" height="1" fill={fur.base} />
      <rect x="10" y="7" width="12" height="8" fill={fur.highlight} opacity="0.15" />
      <rect x="9" y="16" width="14" height="1" fill={fur.shadow} />

      {/* ===== EARS (triangular cat ears) ===== */}
      {/* Left Ear */}
      <rect x="7" y="3" width="2" height="3" fill={fur.base} />
      <rect x="6" y="4" width="2" height="3" fill={fur.base} />
      <rect x="8" y="2" width="1" height="2" fill={fur.base} />
      <rect x="7" y="4" width="1" height="2" fill={innerEar} />
      {/* Right Ear */}
      <rect x="23" y="3" width="2" height="3" fill={fur.base} />
      <rect x="24" y="4" width="2" height="3" fill={fur.base} />
      <rect x="23" y="2" width="1" height="2" fill={fur.base} />
      <rect x="24" y="4" width="1" height="2" fill={innerEar} />

      {/* ===== EYES (big cat eyes) ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="10" y="9" width="4" height="3" fill="#ffffff" />
          <rect x="18" y="9" width="4" height="3" fill="#ffffff" />
          <rect x="11" y="9" width="2" height="3" fill={eyes} />
          <rect x="19" y="9" width="2" height="3" fill={eyes} />
          <rect x="11" y="9" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="9" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="10" y="10" width="4" height="1" fill={fur.shadow} />
          <rect x="18" y="10" width="4" height="1" fill={fur.shadow} />
        </>
      )}

      {/* ===== NOSE ===== */}
      <rect x="15" y="12" width="2" height="1" fill={nose} />

      {/* ===== MOUTH ===== */}
      <rect x="14" y="14" width="4" height="1" fill={fur.shadow} />
      <rect x="14" y="13" width="1" height="1" fill={fur.shadow} />
      <rect x="17" y="13" width="1" height="1" fill={fur.shadow} />

      {/* ===== WHISKERS ===== */}
      <rect x="4" y="12" width="3" height="1" fill={fur.shadow} opacity="0.6" />
      <rect x="5" y="14" width="2" height="1" fill={fur.shadow} opacity="0.6" />
      <rect x="25" y="12" width="3" height="1" fill={fur.shadow} opacity="0.6" />
      <rect x="25" y="14" width="2" height="1" fill={fur.shadow} opacity="0.6" />

      {/* ===== PAWS ===== */}
      <rect x="9" y="26" width="3" height="2" fill={fur.shadow} />
      <rect x="20" y="26" width="3" height="2" fill={fur.shadow} />

      {/* ===== TAIL ===== */}
      <rect x="23" y="21" width="3" height="2" fill={fur.base} />
      <rect x="25" y="18" width="2" height="4" fill={fur.base} />
      <rect x="24" y="16" width="2" height="3" fill={fur.base} />
    </>
  );

  // Render Puppy variant in pixel art
  const renderPuppy = () => (
    <>
      {/* ===== BODY ===== */}
      <rect x="10" y="18" width="12" height="9" fill={fur.base} />
      <rect x="9" y="19" width="14" height="7" fill={fur.base} />
      <rect x="10" y="26" width="12" height="1" fill={fur.shadow} />

      {/* ===== HEAD ===== */}
      <rect x="9" y="6" width="14" height="11" fill={fur.base} />
      <rect x="8" y="8" width="16" height="7" fill={fur.base} />
      <rect x="10" y="5" width="12" height="1" fill={fur.base} />

      {/* ===== EARS (floppy dog ears) ===== */}
      {/* Left Ear */}
      <rect x="6" y="8" width="2" height="7" fill={fur.base} />
      <rect x="7" y="14" width="1" height="1" fill={fur.shadow} />
      {/* Right Ear */}
      <rect x="24" y="8" width="2" height="7" fill={fur.base} />
      <rect x="24" y="14" width="1" height="1" fill={fur.shadow} />

      {/* ===== EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="10" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="19" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="11" y="9" width="2" height="3" fill={eyes} />
          <rect x="19" y="9" width="2" height="3" fill={eyes} />
          <rect x="11" y="9" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="9" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="10" y="10" width="3" height="1" fill={fur.shadow} />
          <rect x="19" y="10" width="3" height="1" fill={fur.shadow} />
        </>
      )}

      {/* ===== SNOUT ===== */}
      <rect x="13" y="12" width="6" height="3" fill={fur.highlight} />
      <rect x="15" y="11" width="2" height="2" fill={nose} />

      {/* ===== TONGUE ===== */}
      <rect x="15" y="15" width="2" height="2" fill="#ff9999" />

      {/* ===== PAWS ===== */}
      <rect x="9" y="26" width="3" height="2" fill={fur.shadow} />
      <rect x="20" y="26" width="3" height="2" fill={fur.shadow} />

      {/* ===== TAIL ===== */}
      <rect x="23" y="19" width="2" height="3" fill={fur.base} />
    </>
  );

  // Render Bunny variant in pixel art
  const renderBunny = () => (
    <>
      {/* ===== BODY ===== */}
      <rect x="10" y="18" width="12" height="9" fill={fur.base} />
      <rect x="9" y="19" width="14" height="7" fill={fur.base} />
      <rect x="10" y="26" width="12" height="1" fill={fur.shadow} />

      {/* ===== HEAD ===== */}
      <rect x="9" y="7" width="14" height="10" fill={fur.base} />
      <rect x="8" y="9" width="16" height="6" fill={fur.base} />
      <rect x="10" y="6" width="12" height="1" fill={fur.base} />

      {/* ===== EARS (long rabbit ears) ===== */}
      {/* Left Ear */}
      <rect x="9" y="0" width="3" height="7" fill={fur.base} />
      <rect x="10" y="1" width="1" height="5" fill={innerEar} />
      {/* Right Ear */}
      <rect x="20" y="0" width="3" height="7" fill={fur.base} />
      <rect x="21" y="1" width="1" height="5" fill={innerEar} />

      {/* ===== EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="10" y="10" width="3" height="3" fill="#ffffff" />
          <rect x="19" y="10" width="3" height="3" fill="#ffffff" />
          <rect x="11" y="10" width="2" height="3" fill={eyes} />
          <rect x="19" y="10" width="2" height="3" fill={eyes} />
          <rect x="11" y="10" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="10" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="10" y="11" width="3" height="1" fill={fur.shadow} />
          <rect x="19" y="11" width="3" height="1" fill={fur.shadow} />
        </>
      )}

      {/* ===== NOSE ===== */}
      <rect x="15" y="13" width="2" height="1" fill={nose} />

      {/* ===== CHEEKS ===== */}
      <rect x="8" y="13" width="2" height="1" fill="#ffcccc" opacity="0.6" />
      <rect x="22" y="13" width="2" height="1" fill="#ffcccc" opacity="0.6" />

      {/* ===== FEET ===== */}
      <rect x="9" y="26" width="4" height="2" fill={fur.shadow} />
      <rect x="19" y="26" width="4" height="2" fill={fur.shadow} />

      {/* ===== TAIL (fluffy ball) ===== */}
      <rect x="23" y="22" width="2" height="2" fill={fur.highlight} />
    </>
  );

  // Render Fox variant in pixel art
  const renderFox = () => (
    <>
      {/* ===== BODY ===== */}
      <rect x="10" y="18" width="12" height="9" fill={fur.base} />
      <rect x="9" y="19" width="14" height="7" fill={fur.base} />
      <rect x="12" y="20" width="8" height="5" fill={fur.highlight} />
      <rect x="10" y="26" width="12" height="1" fill={fur.shadow} />

      {/* ===== HEAD ===== */}
      <rect x="9" y="6" width="14" height="11" fill={fur.base} />
      <rect x="8" y="8" width="16" height="7" fill={fur.base} />
      <rect x="10" y="5" width="12" height="1" fill={fur.base} />
      {/* White face marking */}
      <rect x="14" y="9" width="4" height="7" fill={fur.highlight} />
      <rect x="13" y="11" width="6" height="4" fill={fur.highlight} />
      <rect x="12" y="13" width="8" height="2" fill={fur.highlight} />

      {/* ===== EARS (pointed fox ears) ===== */}
      {/* Left Ear */}
      <rect x="7" y="3" width="3" height="4" fill={fur.base} />
      <rect x="6" y="4" width="1" height="3" fill={fur.base} />
      <rect x="8" y="2" width="1" height="2" fill={fur.base} />
      <rect x="8" y="4" width="1" height="2" fill={fur.shadow} />
      {/* Right Ear */}
      <rect x="22" y="3" width="3" height="4" fill={fur.base} />
      <rect x="25" y="4" width="1" height="3" fill={fur.base} />
      <rect x="23" y="2" width="1" height="2" fill={fur.base} />
      <rect x="23" y="4" width="1" height="2" fill={fur.shadow} />

      {/* ===== EYES (sly fox eyes) ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="10" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="19" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="11" y="9" width="2" height="2" fill={eyes} />
          <rect x="19" y="9" width="2" height="2" fill={eyes} />
          <rect x="11" y="9" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="9" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="10" y="10" width="3" height="1" fill={fur.shadow} />
          <rect x="19" y="10" width="3" height="1" fill={fur.shadow} />
        </>
      )}

      {/* ===== NOSE ===== */}
      <rect x="15" y="13" width="2" height="2" fill={nose} />

      {/* ===== PAWS ===== */}
      <rect x="9" y="26" width="3" height="2" fill={fur.shadow} />
      <rect x="20" y="26" width="3" height="2" fill={fur.shadow} />

      {/* ===== TAIL (bushy fox tail) ===== */}
      <rect x="23" y="19" width="4" height="6" fill={fur.base} />
      <rect x="24" y="17" width="3" height="3" fill={fur.highlight} />
      <rect x="25" y="18" width="2" height="2" fill={fur.highlight} />
    </>
  );

  // Render Bear variant in pixel art
  const renderBear = () => (
    <>
      {/* ===== BODY ===== */}
      <rect x="9" y="18" width="14" height="9" fill={fur.base} />
      <rect x="8" y="19" width="16" height="7" fill={fur.base} />
      <rect x="9" y="26" width="14" height="1" fill={fur.shadow} />

      {/* ===== HEAD ===== */}
      <rect x="9" y="6" width="14" height="11" fill={fur.base} />
      <rect x="8" y="8" width="16" height="7" fill={fur.base} />
      <rect x="10" y="5" width="12" height="1" fill={fur.base} />

      {/* ===== EARS (round bear ears) ===== */}
      {/* Left Ear */}
      <rect x="7" y="3" width="3" height="3" fill={fur.base} />
      <rect x="8" y="4" width="1" height="1" fill={fur.shadow} />
      {/* Right Ear */}
      <rect x="22" y="3" width="3" height="3" fill={fur.base} />
      <rect x="23" y="4" width="1" height="1" fill={fur.shadow} />

      {/* ===== SNOUT ===== */}
      <rect x="12" y="12" width="8" height="4" fill={fur.highlight} />
      <rect x="14" y="11" width="4" height="2" fill={nose} />

      {/* ===== EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="10" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="19" y="9" width="3" height="3" fill="#ffffff" />
          <rect x="11" y="9" width="2" height="3" fill={eyes} />
          <rect x="19" y="9" width="2" height="3" fill={eyes} />
          <rect x="11" y="9" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="9" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="10" y="10" width="3" height="1" fill={fur.shadow} />
          <rect x="19" y="10" width="3" height="1" fill={fur.shadow} />
        </>
      )}

      {/* ===== MOUTH ===== */}
      <rect x="14" y="14" width="4" height="1" fill={fur.shadow} />

      {/* ===== PAWS ===== */}
      <rect x="8" y="26" width="4" height="2" fill={fur.shadow} />
      <rect x="20" y="26" width="4" height="2" fill={fur.shadow} />
    </>
  );

  // Render based on variant
  const renderVariant = () => {
    switch (variant) {
      case "kitten":
        return renderKitten();
      case "puppy":
        return renderPuppy();
      case "bunny":
        return renderBunny();
      case "fox":
        return renderFox();
      case "bear":
        return renderBear();
      default:
        return renderKitten();
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={`${stateClasses[state]} ${className}`}
      style={{ imageRendering: "pixelated" }}
    >
      {/* Background */}
      <rect width="32" height="32" fill="transparent" />

      {/* Render variant */}
      {renderVariant()}
    </svg>
  );
};

export default AnimalSprite;
