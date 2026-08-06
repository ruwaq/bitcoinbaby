/**
 * Human Spark Sprite - PRIMITIVE TRIBAL DESIGN
 *
 * Humanos primitivos conectados a la tierra y los espíritus.
 * Estética de realismo mágico: chamanes, cazadores, ancianos sabios.
 *
 * Variantes:
 * - Hunter: Cazador con lanza, pieles de animal, pintura de guerra
 * - Shaman: Líder espiritual con tocado de plumas, bastón ritual
 * - Gatherer: Recolector con canasta, conocimiento de plantas
 * - Elder: Anciano sabio con símbolos de cueva, marcas de sabiduría
 * - Child: Joven primitivo, curioso, aprendiendo
 *
 * Elementos comunes:
 * - Pintura corporal tribal
 * - Materiales naturales (huesos, plumas, cuero, pieles)
 * - Conexión con espíritus (brillo sutil)
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface HumanSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type HumanVariant = "hunter" | "shaman" | "gatherer" | "elder" | "child";

// Skin tones - ALL races and ethnicities represented
const SKIN_TONES = [
  { base: "#ffe4c4", shadow: "#dfc4a4", highlight: "#fff5e6" }, // Very light / Fair (European, East Asian)
  { base: "#f5d0a9", shadow: "#d4b089", highlight: "#ffe8c9" }, // Light / Pale (Northern European)
  { base: "#e8c4a0", shadow: "#c8a480", highlight: "#f8e4c8" }, // Light olive (Mediterranean, Middle Eastern)
  { base: "#d4a574", shadow: "#b48554", highlight: "#e8c4a0" }, // Warm tan (Latino, Southeast Asian)
  { base: "#c49c72", shadow: "#a47c52", highlight: "#d4b494" }, // Golden brown (South Asian, Pacific)
  { base: "#a67c52", shadow: "#8a6042", highlight: "#c49c72" }, // Brown (South Asian)
  { base: "#8b6443", shadow: "#6b4423", highlight: "#a67c52" }, // Deep brown (African, South Indian)
  { base: "#6b4423", shadow: "#4a2f18", highlight: "#8b6443" }, // Dark (African)
  { base: "#4a2f18", shadow: "#2a1f10", highlight: "#6b4423" }, // Very dark (West African)
  { base: "#3d2914", shadow: "#1f1508", highlight: "#5a3d20" }, // Deepest (various African)
];

// Tribal paint colors
const PAINT_COLORS = [
  "#dc2626", // Blood red - power
  "#ffffff", // Bone white - spirit
  "#1f2937", // Charcoal black - shadow
  "#ca8a04", // Ochre yellow - sun
  "#0284c7", // River blue - water
];

// Hair colors - natural
const HAIR_COLORS = [
  "#1a1a1a", // Black
  "#2c1810", // Dark brown
  "#4a3728", // Brown
  "#6b4423", // Auburn
  "#8b6443", // Light brown
];

interface VariantColors {
  skin: { base: string; shadow: string; highlight: string };
  hair: string;
  paint: string;
  paintSecondary: string;
  accessory: string;
}

const getVariantColors = (dna: string): VariantColors => {
  const skinIdx = parseInt(dna[0] || "0", 16) % 10; // 10 diverse skin tones
  const hairIdx = parseInt(dna[1] || "0", 16) % 5;
  const paintIdx = parseInt(dna[2] || "0", 16) % 5;
  const paint2Idx = (paintIdx + 2) % 5;

  return {
    skin: SKIN_TONES[skinIdx],
    hair: HAIR_COLORS[hairIdx],
    paint: PAINT_COLORS[paintIdx],
    paintSecondary: PAINT_COLORS[paint2Idx],
    accessory: "#f5deb3", // Bone/leather color
  };
};

const getVariant = (dna: string): HumanVariant => {
  const variants: HumanVariant[] = [
    "hunter",
    "shaman",
    "gatherer",
    "elder",
    "child",
  ];
  return variants[parseInt(dna[3] || "0", 16) % 5];
};

export const HumanSprite: FC<HumanSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000000000",
  className = "",
}) => {
  const colors = getVariantColors(dna);
  const variant = getVariant(dna);
  const { skin, hair, paint, paintSecondary, accessory } = colors;

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

  // Render Hunter variant
  const renderHunter = () => (
    <>
      {/* ===== BODY ===== */}
      {/* Torso - exposed chest with paint */}
      <rect x="11" y="17" width="10" height="8" fill={skin.base} />
      <rect x="10" y="18" width="1" height="6" fill={skin.base} />
      <rect x="21" y="18" width="1" height="6" fill={skin.base} />
      {/* Chest shadow */}
      <rect
        x="15"
        y="18"
        width="2"
        height="3"
        fill={skin.shadow}
        opacity="0.4"
      />
      {/* War paint on chest - diagonal stripes */}
      <rect x="12" y="18" width="2" height="1" fill={paint} />
      <rect x="13" y="19" width="2" height="1" fill={paint} />
      <rect x="14" y="20" width="2" height="1" fill={paint} />
      <rect x="18" y="18" width="2" height="1" fill={paint} />
      <rect x="17" y="19" width="2" height="1" fill={paint} />
      <rect x="16" y="20" width="2" height="1" fill={paint} />

      {/* ===== LOINCLOTH ===== */}
      <rect x="12" y="24" width="8" height="4" fill="#8b6914" />
      <rect x="11" y="25" width="1" height="3" fill="#8b6914" />
      <rect x="20" y="25" width="1" height="3" fill="#8b6914" />
      {/* Leather texture */}
      <rect x="14" y="25" width="4" height="1" fill="#a67c52" opacity="0.5" />

      {/* ===== FUR SHOULDER PIECE ===== */}
      <rect x="8" y="17" width="4" height="3" fill="#6b4423" />
      <rect x="9" y="16" width="2" height="1" fill="#8b6443" />
      {/* Fur texture */}
      <rect x="8" y="17" width="1" height="1" fill="#8b6443" />
      <rect x="10" y="18" width="1" height="1" fill="#8b6443" />

      {/* ===== HEAD ===== */}
      <rect x="11" y="5" width="10" height="10" fill={skin.base} />
      <rect x="10" y="7" width="1" height="6" fill={skin.base} />
      <rect x="21" y="7" width="1" height="6" fill={skin.base} />
      {/* Face shadow */}
      <rect
        x="19"
        y="6"
        width="2"
        height="8"
        fill={skin.shadow}
        opacity="0.3"
      />
      {/* Forehead highlight */}
      <rect
        x="13"
        y="6"
        width="3"
        height="1"
        fill={skin.highlight}
        opacity="0.5"
      />

      {/* ===== WAR PAINT ON FACE ===== */}
      {/* Stripe across eyes */}
      <rect x="10" y="9" width="12" height="2" fill={paint} />
      {/* Dot on forehead */}
      <rect x="15" y="6" width="2" height="1" fill={paintSecondary} />

      {/* ===== HAIR ===== */}
      {/* Wild, messy hair */}
      <rect x="10" y="3" width="12" height="3" fill={hair} />
      <rect x="9" y="4" width="2" height="3" fill={hair} />
      <rect x="21" y="4" width="2" height="3" fill={hair} />
      {/* Spiky top */}
      <rect x="12" y="2" width="2" height="2" fill={hair} />
      <rect x="15" y="1" width="2" height="3" fill={hair} />
      <rect x="18" y="2" width="2" height="2" fill={hair} />

      {/* ===== EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="10" width="3" height="2" fill="#ffffff" />
          <rect x="17" y="10" width="3" height="2" fill="#ffffff" />
          <rect x="13" y="10" width="2" height="2" fill="#4a3728" />
          <rect x="18" y="10" width="2" height="2" fill="#4a3728" />
          <rect
            x="14"
            y="10"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.8"
          />
          <rect
            x="19"
            y="10"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.8"
          />
        </>
      ) : (
        <>
          <rect x="12" y="10" width="3" height="1" fill={hair} />
          <rect x="17" y="10" width="3" height="1" fill={hair} />
        </>
      )}

      {/* ===== NOSE & MOUTH ===== */}
      <rect
        x="15"
        y="11"
        width="2"
        height="2"
        fill={skin.shadow}
        opacity="0.5"
      />
      {state === "happy" ? (
        <rect x="14" y="13" width="4" height="1" fill="#1f2937" />
      ) : (
        <rect x="15" y="13" width="2" height="1" fill="#1f2937" />
      )}

      {/* ===== EARS ===== */}
      <rect x="9" y="9" width="2" height="3" fill={skin.base} />
      <rect x="21" y="9" width="2" height="3" fill={skin.base} />
      {/* Bone earring */}
      <rect x="8" y="10" width="1" height="2" fill={accessory} />

      {/* ===== ARMS ===== */}
      <rect x="7" y="18" width="3" height="6" fill={skin.base} />
      <rect x="22" y="18" width="3" height="6" fill={skin.base} />
      {/* Arm paint */}
      <rect x="7" y="19" width="2" height="1" fill={paint} />
      <rect x="23" y="19" width="2" height="1" fill={paint} />

      {/* ===== HANDS ===== */}
      <rect x="6" y="24" width="3" height="2" fill={skin.base} />
      <rect x="23" y="24" width="3" height="2" fill={skin.base} />

      {/* ===== LEGS ===== */}
      <rect x="12" y="28" width="3" height="3" fill={skin.base} />
      <rect x="17" y="28" width="3" height="3" fill={skin.base} />

      {/* ===== FEET ===== */}
      <rect x="11" y="31" width="4" height="1" fill={skin.shadow} />
      <rect x="17" y="31" width="4" height="1" fill={skin.shadow} />

      {/* ===== SPEAR ===== */}
      <rect x="25" y="8" width="1" height="18" fill="#8b6914" />
      <rect x="24" y="5" width="3" height="4" fill="#6b7280" />
      <rect x="25" y="4" width="1" height="2" fill="#9ca3af" />
      {/* Spear binding */}
      <rect x="24" y="9" width="3" height="1" fill="#a67c52" />
    </>
  );

  // Render Shaman variant
  const renderShaman = () => (
    <>
      {/* ===== BODY ===== */}
      {/* Ritual robe */}
      <rect x="10" y="17" width="12" height="10" fill="#4a3728" />
      <rect x="9" y="18" width="1" height="8" fill="#4a3728" />
      <rect x="22" y="18" width="1" height="8" fill="#4a3728" />
      {/* Robe decorations - spirit symbols */}
      <rect x="12" y="19" width="1" height="1" fill={paint} />
      <rect x="14" y="21" width="1" height="1" fill={paint} />
      <rect x="16" y="19" width="1" height="1" fill={paint} />
      <rect x="18" y="21" width="1" height="1" fill={paint} />
      <rect x="15" y="23" width="2" height="1" fill={paintSecondary} />
      {/* Eye symbol on chest */}
      <rect x="14" y="20" width="4" height="2" fill={paintSecondary} />
      <rect x="15" y="20" width="2" height="1" fill="#1f2937" />

      {/* ===== HEAD ===== */}
      <rect x="11" y="6" width="10" height="9" fill={skin.base} />
      <rect x="10" y="8" width="1" height="5" fill={skin.base} />
      <rect x="21" y="8" width="1" height="5" fill={skin.base} />
      <rect
        x="19"
        y="7"
        width="2"
        height="7"
        fill={skin.shadow}
        opacity="0.3"
      />

      {/* ===== FEATHER HEADDRESS ===== */}
      {/* Central feathers */}
      <rect x="15" y="0" width="2" height="6" fill="#dc2626" />
      <rect x="13" y="1" width="2" height="5" fill="#fbbf24" />
      <rect x="17" y="1" width="2" height="5" fill="#fbbf24" />
      <rect x="11" y="2" width="2" height="4" fill="#22c55e" />
      <rect x="19" y="2" width="2" height="4" fill="#22c55e" />
      {/* Feather tips */}
      <rect x="15" y="0" width="1" height="1" fill="#ffffff" opacity="0.5" />
      <rect x="13" y="1" width="1" height="1" fill="#ffffff" opacity="0.5" />
      <rect x="18" y="1" width="1" height="1" fill="#ffffff" opacity="0.5" />
      {/* Headband */}
      <rect x="10" y="5" width="12" height="2" fill="#8b6914" />
      <rect x="14" y="5" width="4" height="2" fill="#fbbf24" />

      {/* ===== FACE PAINT - SPIRIT MARKS ===== */}
      {/* Third eye */}
      <rect x="15" y="7" width="2" height="1" fill={paintSecondary} />
      {/* Under eye marks */}
      <rect x="11" y="11" width="2" height="2" fill={paint} />
      <rect x="19" y="11" width="2" height="2" fill={paint} />
      {/* Chin mark */}
      <rect x="15" y="13" width="2" height="1" fill={paint} />

      {/* ===== EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="9" width="3" height="2" fill="#ffffff" />
          <rect x="17" y="9" width="3" height="2" fill="#ffffff" />
          {/* Mystical purple eyes */}
          <rect x="13" y="9" width="2" height="2" fill="#8b5cf6" />
          <rect x="18" y="9" width="2" height="2" fill="#8b5cf6" />
          <rect
            x="13"
            y="9"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.7"
          />
          <rect
            x="18"
            y="9"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.7"
          />
        </>
      ) : (
        <>
          <rect x="12" y="10" width="3" height="1" fill="#4a3728" />
          <rect x="17" y="10" width="3" height="1" fill="#4a3728" />
        </>
      )}

      {/* ===== NOSE & MOUTH ===== */}
      <rect
        x="15"
        y="10"
        width="2"
        height="2"
        fill={skin.shadow}
        opacity="0.4"
      />
      <rect x="15" y="12" width="2" height="1" fill="#1f2937" />

      {/* ===== EARS WITH ORNAMENTS ===== */}
      <rect x="9" y="9" width="2" height="3" fill={skin.base} />
      <rect x="21" y="9" width="2" height="3" fill={skin.base} />
      <rect x="8" y="10" width="1" height="2" fill="#fbbf24" />
      <rect x="23" y="10" width="1" height="2" fill="#fbbf24" />

      {/* ===== ARMS ===== */}
      <rect x="7" y="18" width="3" height="5" fill="#4a3728" />
      <rect x="22" y="18" width="3" height="5" fill="#4a3728" />

      {/* ===== HANDS ===== */}
      <rect x="6" y="23" width="3" height="2" fill={skin.base} />
      <rect x="23" y="23" width="3" height="2" fill={skin.base} />

      {/* ===== SPIRIT STAFF ===== */}
      <rect x="3" y="12" width="1" height="16" fill="#6b4423" />
      {/* Skull totem */}
      <rect x="2" y="8" width="3" height="4" fill="#f5f5dc" />
      <rect x="2" y="9" width="1" height="1" fill="#1f2937" />
      <rect x="4" y="9" width="1" height="1" fill="#1f2937" />
      <rect x="3" y="11" width="1" height="1" fill="#1f2937" />
      {/* Feather on staff */}
      <rect x="4" y="13" width="1" height="3" fill="#dc2626" />

      {/* ===== LEGS ===== */}
      <rect x="12" y="27" width="3" height="4" fill="#4a3728" />
      <rect x="17" y="27" width="3" height="4" fill="#4a3728" />

      {/* ===== FEET ===== */}
      <rect x="11" y="31" width="4" height="1" fill="#6b4423" />
      <rect x="17" y="31" width="4" height="1" fill="#6b4423" />

      {/* ===== SPIRIT GLOW (when mining/thriving) ===== */}
      {(state === "mining" || state === "thriving") && (
        <>
          <rect
            x="14"
            y="18"
            width="4"
            height="4"
            fill="#8b5cf6"
            opacity="0.3"
          />
        </>
      )}
    </>
  );

  // Render Gatherer variant
  const renderGatherer = () => (
    <>
      {/* ===== BODY ===== */}
      {/* Simple tunic */}
      <rect x="10" y="17" width="12" height="9" fill="#a67c52" />
      <rect x="9" y="18" width="1" height="7" fill="#a67c52" />
      <rect x="22" y="18" width="1" height="7" fill="#a67c52" />
      {/* Woven pattern */}
      <rect x="12" y="19" width="1" height="1" fill="#8b6914" />
      <rect x="14" y="21" width="1" height="1" fill="#8b6914" />
      <rect x="16" y="19" width="1" height="1" fill="#8b6914" />
      <rect x="18" y="21" width="1" height="1" fill="#8b6914" />
      <rect x="13" y="23" width="1" height="1" fill="#8b6914" />
      <rect x="17" y="23" width="1" height="1" fill="#8b6914" />

      {/* ===== HEAD ===== */}
      <rect x="11" y="5" width="10" height="10" fill={skin.base} />
      <rect x="10" y="7" width="1" height="6" fill={skin.base} />
      <rect x="21" y="7" width="1" height="6" fill={skin.base} />
      <rect
        x="19"
        y="6"
        width="2"
        height="8"
        fill={skin.shadow}
        opacity="0.3"
      />
      <rect
        x="13"
        y="6"
        width="3"
        height="1"
        fill={skin.highlight}
        opacity="0.5"
      />

      {/* ===== HAIR - BRAIDED ===== */}
      <rect x="10" y="3" width="12" height="4" fill={hair} />
      <rect x="9" y="4" width="2" height="4" fill={hair} />
      <rect x="21" y="4" width="2" height="4" fill={hair} />
      {/* Braids */}
      <rect x="8" y="7" width="2" height="6" fill={hair} />
      <rect x="22" y="7" width="2" height="6" fill={hair} />
      {/* Braid ties */}
      <rect x="8" y="12" width="2" height="1" fill={paint} />
      <rect x="22" y="12" width="2" height="1" fill={paint} />
      {/* Flower in hair */}
      <rect x="10" y="3" width="2" height="2" fill="#f472b6" />
      <rect x="11" y="4" width="1" height="1" fill="#fbbf24" />

      {/* ===== FACE PAINT - NATURE MARKS ===== */}
      {/* Leaf symbols on cheeks */}
      <rect x="11" y="11" width="1" height="2" fill="#22c55e" />
      <rect x="20" y="11" width="1" height="2" fill="#22c55e" />

      {/* ===== EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="9" width="3" height="2" fill="#ffffff" />
          <rect x="17" y="9" width="3" height="2" fill="#ffffff" />
          {/* Warm brown eyes */}
          <rect x="13" y="9" width="2" height="2" fill="#22c55e" />
          <rect x="18" y="9" width="2" height="2" fill="#22c55e" />
          <rect
            x="13"
            y="9"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.7"
          />
          <rect
            x="18"
            y="9"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.7"
          />
        </>
      ) : (
        <>
          <rect x="12" y="10" width="3" height="1" fill={hair} />
          <rect x="17" y="10" width="3" height="1" fill={hair} />
        </>
      )}

      {/* ===== NOSE & MOUTH ===== */}
      <rect
        x="15"
        y="10"
        width="2"
        height="2"
        fill={skin.shadow}
        opacity="0.4"
      />
      {state === "happy" ? (
        <>
          <rect x="14" y="12" width="4" height="2" fill="#1f2937" />
          <rect x="15" y="13" width="2" height="1" fill="#dc2626" />
        </>
      ) : (
        <rect x="15" y="12" width="2" height="1" fill="#1f2937" />
      )}

      {/* ===== EARS ===== */}
      <rect x="9" y="9" width="2" height="3" fill={skin.base} />
      <rect x="21" y="9" width="2" height="3" fill={skin.base} />

      {/* ===== ARMS ===== */}
      <rect x="7" y="18" width="3" height="5" fill={skin.base} />
      <rect x="22" y="18" width="3" height="5" fill={skin.base} />

      {/* ===== HANDS ===== */}
      <rect x="6" y="23" width="3" height="2" fill={skin.base} />
      <rect x="23" y="23" width="3" height="2" fill={skin.base} />

      {/* ===== WOVEN BASKET ===== */}
      <rect x="24" y="19" width="5" height="6" fill="#d4a574" />
      <rect x="25" y="20" width="3" height="4" fill="#c49c72" />
      {/* Basket weave pattern */}
      <rect x="25" y="20" width="1" height="1" fill="#a67c52" />
      <rect x="27" y="22" width="1" height="1" fill="#a67c52" />
      {/* Herbs sticking out */}
      <rect x="25" y="18" width="1" height="2" fill="#22c55e" />
      <rect x="27" y="17" width="1" height="3" fill="#22c55e" />
      <rect x="26" y="18" width="1" height="2" fill="#86efac" />

      {/* ===== HERB POUCH ===== */}
      <rect x="19" y="24" width="3" height="2" fill="#8b6914" />
      <rect x="20" y="23" width="1" height="1" fill="#a67c52" />

      {/* ===== LEGS ===== */}
      <rect x="12" y="26" width="3" height="5" fill={skin.base} />
      <rect x="17" y="26" width="3" height="5" fill={skin.base} />

      {/* ===== FEET ===== */}
      <rect x="11" y="31" width="4" height="1" fill="#a67c52" />
      <rect x="17" y="31" width="4" height="1" fill="#a67c52" />
    </>
  );

  // Render Elder variant
  const renderElder = () => (
    <>
      {/* ===== BODY ===== */}
      {/* Elder's cloak */}
      <rect x="9" y="16" width="14" height="12" fill="#4a3728" />
      <rect x="8" y="17" width="1" height="10" fill="#4a3728" />
      <rect x="23" y="17" width="1" height="10" fill="#4a3728" />
      {/* Cave painting symbols on cloak */}
      <rect x="11" y="18" width="2" height="2" fill={paint} />
      <rect x="12" y="20" width="1" height="1" fill={paint} />
      {/* Hand print */}
      <rect x="17" y="19" width="3" height="3" fill={paintSecondary} />
      <rect x="17" y="18" width="1" height="1" fill={paintSecondary} />
      <rect x="19" y="18" width="1" height="1" fill={paintSecondary} />
      {/* Spiral symbol */}
      <rect x="14" y="23" width="4" height="1" fill={paint} />
      <rect x="14" y="24" width="1" height="2" fill={paint} />
      <rect x="15" y="25" width="2" height="1" fill={paint} />

      {/* ===== HEAD ===== */}
      <rect x="11" y="4" width="10" height="10" fill={skin.base} />
      <rect x="10" y="6" width="1" height="6" fill={skin.base} />
      <rect x="21" y="6" width="1" height="6" fill={skin.base} />
      <rect
        x="19"
        y="5"
        width="2"
        height="8"
        fill={skin.shadow}
        opacity="0.3"
      />

      {/* ===== WHITE/GRAY HAIR ===== */}
      <rect x="10" y="2" width="12" height="4" fill="#9ca3af" />
      <rect x="9" y="3" width="2" height="4" fill="#9ca3af" />
      <rect x="21" y="3" width="2" height="4" fill="#9ca3af" />
      {/* Thinning top */}
      <rect x="12" y="1" width="8" height="2" fill="#6b7280" />
      {/* Long beard */}
      <rect x="13" y="13" width="6" height="4" fill="#9ca3af" />
      <rect x="14" y="17" width="4" height="2" fill="#d1d5db" />
      <rect x="15" y="19" width="2" height="1" fill="#d1d5db" />

      {/* ===== WISDOM MARKS ===== */}
      {/* Forehead symbol */}
      <rect x="14" y="5" width="4" height="1" fill={paint} />
      <rect x="15" y="4" width="2" height="1" fill={paint} />
      {/* Wrinkles */}
      <rect
        x="11"
        y="7"
        width="2"
        height="1"
        fill={skin.shadow}
        opacity="0.3"
      />
      <rect
        x="19"
        y="7"
        width="2"
        height="1"
        fill={skin.shadow}
        opacity="0.3"
      />

      {/* ===== EYES - WISE ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="8" width="3" height="2" fill="#ffffff" />
          <rect x="17" y="8" width="3" height="2" fill="#ffffff" />
          {/* Deep amber eyes */}
          <rect x="13" y="8" width="2" height="2" fill="#b45309" />
          <rect x="18" y="8" width="2" height="2" fill="#b45309" />
          <rect
            x="13"
            y="8"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.6"
          />
          <rect
            x="18"
            y="8"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.6"
          />
          {/* Crow's feet wrinkles */}
          <rect
            x="10"
            y="9"
            width="1"
            height="1"
            fill={skin.shadow}
            opacity="0.4"
          />
          <rect
            x="21"
            y="9"
            width="1"
            height="1"
            fill={skin.shadow}
            opacity="0.4"
          />
        </>
      ) : (
        <>
          <rect x="12" y="9" width="3" height="1" fill="#6b7280" />
          <rect x="17" y="9" width="3" height="1" fill="#6b7280" />
        </>
      )}

      {/* ===== NOSE ===== */}
      <rect
        x="15"
        y="9"
        width="2"
        height="3"
        fill={skin.shadow}
        opacity="0.4"
      />

      {/* ===== EARS ===== */}
      <rect x="9" y="8" width="2" height="3" fill={skin.base} />
      <rect x="21" y="8" width="2" height="3" fill={skin.base} />

      {/* ===== WALKING STICK ===== */}
      <rect x="5" y="10" width="1" height="20" fill="#6b4423" />
      <rect x="4" y="8" width="3" height="3" fill="#8b6443" />
      {/* Carved symbols on stick */}
      <rect x="5" y="15" width="1" height="1" fill={paint} />
      <rect x="5" y="20" width="1" height="1" fill={paint} />
      <rect x="5" y="25" width="1" height="1" fill={paint} />

      {/* ===== NECKLACE OF BONES ===== */}
      <rect x="12" y="14" width="8" height="1" fill={accessory} />
      <rect x="14" y="15" width="1" height="2" fill={accessory} />
      <rect x="17" y="15" width="1" height="2" fill={accessory} />

      {/* ===== HANDS ===== */}
      <rect x="5" y="20" width="3" height="2" fill={skin.base} />
      <rect x="22" y="22" width="3" height="2" fill={skin.base} />

      {/* ===== FEET ===== */}
      <rect x="11" y="28" width="4" height="1" fill="#4a3728" />
      <rect x="17" y="28" width="4" height="1" fill="#4a3728" />
    </>
  );

  // Render Child variant
  const renderChild = () => (
    <>
      {/* ===== BODY - SMALLER ===== */}
      {/* Simple cloth */}
      <rect x="12" y="18" width="8" height="7" fill="#d4a574" />
      <rect x="11" y="19" width="1" height="5" fill="#d4a574" />
      <rect x="20" y="19" width="1" height="5" fill="#d4a574" />
      {/* Simple pattern */}
      <rect x="14" y="20" width="4" height="1" fill="#a67c52" />
      <rect x="15" y="22" width="2" height="1" fill="#a67c52" />

      {/* ===== HEAD - BIGGER PROPORTIONALLY ===== */}
      <rect x="10" y="5" width="12" height="11" fill={skin.base} />
      <rect x="9" y="7" width="1" height="7" fill={skin.base} />
      <rect x="22" y="7" width="1" height="7" fill={skin.base} />
      <rect
        x="20"
        y="6"
        width="2"
        height="9"
        fill={skin.shadow}
        opacity="0.25"
      />
      <rect
        x="12"
        y="6"
        width="4"
        height="2"
        fill={skin.highlight}
        opacity="0.4"
      />

      {/* ===== MESSY CHILD HAIR ===== */}
      <rect x="10" y="3" width="12" height="4" fill={hair} />
      <rect x="9" y="4" width="2" height="3" fill={hair} />
      <rect x="21" y="4" width="2" height="3" fill={hair} />
      {/* Tuft sticking up */}
      <rect x="14" y="1" width="4" height="3" fill={hair} />
      <rect x="15" y="0" width="2" height="2" fill={hair} />

      {/* ===== SIMPLE FACE PAINT - LEARNING ===== */}
      {/* Single dot on forehead */}
      <rect x="15" y="6" width="2" height="1" fill={paint} />
      {/* Cheek marks */}
      <rect x="10" y="11" width="1" height="1" fill={paint} opacity="0.7" />
      <rect x="21" y="11" width="1" height="1" fill={paint} opacity="0.7" />

      {/* ===== BIG CURIOUS EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="9" width="4" height="3" fill="#ffffff" />
          <rect x="17" y="9" width="4" height="3" fill="#ffffff" />
          {/* Big pupils */}
          <rect x="12" y="9" width="3" height="3" fill="#4a3728" />
          <rect x="18" y="9" width="3" height="3" fill="#4a3728" />
          {/* Big sparkle */}
          <rect
            x="12"
            y="9"
            width="2"
            height="2"
            fill="#ffffff"
            opacity="0.8"
          />
          <rect
            x="18"
            y="9"
            width="2"
            height="2"
            fill="#ffffff"
            opacity="0.8"
          />
        </>
      ) : (
        <>
          <rect x="12" y="10" width="3" height="1" fill={hair} />
          <rect x="17" y="10" width="3" height="1" fill={hair} />
          {/* Sleep blush */}
          <rect
            x="11"
            y="11"
            width="2"
            height="1"
            fill="#fca5a5"
            opacity="0.4"
          />
          <rect
            x="19"
            y="11"
            width="2"
            height="1"
            fill="#fca5a5"
            opacity="0.4"
          />
        </>
      )}

      {/* ===== SMALL NOSE ===== */}
      <rect
        x="15"
        y="11"
        width="2"
        height="1"
        fill={skin.shadow}
        opacity="0.4"
      />

      {/* ===== MOUTH ===== */}
      {state === "happy" ? (
        <>
          <rect x="14" y="13" width="4" height="2" fill="#1f2937" />
          <rect x="14" y="13" width="1" height="1" fill={skin.base} />
          <rect x="17" y="13" width="1" height="1" fill={skin.base} />
        </>
      ) : state === "hungry" ? (
        <rect x="15" y="13" width="2" height="2" fill="#1f2937" />
      ) : (
        <rect x="15" y="13" width="2" height="1" fill="#1f2937" />
      )}

      {/* ===== CHUBBY CHEEKS ===== */}
      <rect x="10" y="12" width="2" height="2" fill="#fca5a5" opacity="0.3" />
      <rect x="20" y="12" width="2" height="2" fill="#fca5a5" opacity="0.3" />

      {/* ===== EARS ===== */}
      <rect x="8" y="10" width="2" height="3" fill={skin.base} />
      <rect x="22" y="10" width="2" height="3" fill={skin.base} />

      {/* ===== ARMS - SHORT ===== */}
      <rect x="9" y="19" width="3" height="4" fill={skin.base} />
      <rect x="20" y="19" width="3" height="4" fill={skin.base} />

      {/* ===== LITTLE HANDS ===== */}
      <rect x="8" y="23" width="3" height="2" fill={skin.base} />
      <rect x="21" y="23" width="3" height="2" fill={skin.base} />

      {/* ===== TOY - WOODEN FIGURE ===== */}
      <rect x="23" y="21" width="2" height="4" fill="#8b6914" />
      <rect x="22" y="21" width="1" height="2" fill="#8b6914" />
      <rect x="25" y="21" width="1" height="2" fill="#8b6914" />

      {/* ===== SHORT LEGS ===== */}
      <rect x="13" y="25" width="3" height="4" fill={skin.base} />
      <rect x="16" y="25" width="3" height="4" fill={skin.base} />

      {/* ===== LITTLE FEET ===== */}
      <rect x="12" y="29" width="4" height="2" fill="#a67c52" />
      <rect x="16" y="29" width="4" height="2" fill="#a67c52" />
    </>
  );

  // Select renderer based on variant
  const renderVariant = () => {
    switch (variant) {
      case "hunter":
        return renderHunter();
      case "shaman":
        return renderShaman();
      case "gatherer":
        return renderGatherer();
      case "elder":
        return renderElder();
      case "child":
        return renderChild();
      default:
        return renderHunter();
    }
  };

  return (
    <div className={`relative ${stateClasses[state]} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ imageRendering: "pixelated" }}
      >
        {renderVariant()}
      </svg>

      {/* ===== STATE EFFECTS ===== */}
      {state === "mining" && (
        <div
          className="absolute w-1 h-1 bg-amber-400 rounded-full animate-ping"
          style={{ top: "20%", right: "10%" }}
        />
      )}

      {state === "thriving" && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            boxShadow: "0 0 8px #f7931a",
            opacity: 0.3,
          }}
        />
      )}

      {state === "sleeping" && (
        <div
          className="absolute font-pixel text-blue-300 animate-bounce"
          style={{ top: "-10%", right: "10%", fontSize: size / 10 }}
        >
          z
        </div>
      )}

      {state === "learning" && (
        <div
          className="absolute w-1 h-1 bg-purple-400 rounded-full animate-pulse"
          style={{ top: "10%", left: "15%" }}
        />
      )}
    </div>
  );
};

export default HumanSprite;
