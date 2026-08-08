/**
 * Heritage Overlay Component
 *
 * Agrega elementos culturales detallados de cada región sobre cualquier sprite base.
 * - Americas: Plumas de quetzal, patrones aztecas/mayas, símbolos jaguar, calendario solar
 * - Africa: Kente patterns, adinkra symbols, máscaras tribales, cowrie shells
 * - Asia: Dragones, cerezo en flor, yin-yang, símbolos zen, koi
 * - Europa: Nudos célticos, runas vikingas, heráldica medieval, coronas
 * - Oceania: Ta moko maorí, tiki, hibisco, estrellas de navegación, olas
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type HeritageSeed } from "./types";

interface HeritageOverlayProps {
  heritage: HeritageSeed;
  size?: number;
  animated?: boolean;
  variant?: number;
}

// Color palettes for each heritage
const HERITAGE_COLORS = {
  americas: {
    gold: "#fbbf24",
    turquoise: "#14b8a6",
    red: "#dc2626",
    green: "#22c55e",
    obsidian: "#1f2937",
    terracotta: "#b45309",
    jade: "#059669",
  },
  africa: {
    kente_gold: "#fbbf24",
    kente_red: "#dc2626",
    kente_green: "#15803d",
    kente_black: "#1f2937",
    earth: "#78350f",
    cowrie: "#fef3c7",
    sunset: "#f97316",
  },
  asia: {
    red: "#dc2626",
    gold: "#fbbf24",
    cherry: "#fda4af",
    ink: "#1f2937",
    jade: "#22c55e",
    water: "#3b82f6",
    ivory: "#fef3c7",
  },
  europa: {
    royal_blue: "#1e40af",
    gold: "#fbbf24",
    celtic_green: "#15803d",
    silver: "#94a3b8",
    iron: "#4b5563",
    burgundy: "#7f1d1d",
    ivory: "#f5f5f4",
  },
  oceania: {
    ocean: "#0891b2",
    turquoise: "#14b8a6",
    coral: "#f472b6",
    hibiscus: "#e11d48",
    palm: "#16a34a",
    sand: "#fef3c7",
    lava: "#dc2626",
    tiki_wood: "#78350f",
  },
};

// Type-specific color getters to avoid union type issues
const getAmericasColors = () => HERITAGE_COLORS.americas;
const getAfricaColors = () => HERITAGE_COLORS.africa;
const getAsiaColors = () => HERITAGE_COLORS.asia;
const getEuropaColors = () => HERITAGE_COLORS.europa;
const getOceaniaColors = () => HERITAGE_COLORS.oceania;

export const HeritageOverlay: FC<HeritageOverlayProps> = ({
  heritage,
  size = 64,
  animated: _animated = true,
  variant: _variant = 0,
}) => {
  // Americas Heritage - Aztec/Maya/Inca elements
  const renderAmericas = () => {
    const c = getAmericasColors();
    return (
      <>
        {/* Grand Quetzal Feather Headdress */}
        <rect x="4" y="1" width="2" height="5" fill={c.green} opacity="0.9" />
        <rect
          x="3"
          y="0"
          width="2"
          height="2"
          fill={c.turquoise}
          opacity="0.8"
        />
        <rect x="6" y="0" width="2" height="6" fill={c.red} opacity="0.9" />
        <rect x="8" y="1" width="2" height="5" fill={c.gold} opacity="0.9" />
        <rect x="10" y="2" width="1" height="3" fill={c.green} opacity="0.8" />
        {/* Right side feathers */}
        <rect x="21" y="2" width="1" height="3" fill={c.green} opacity="0.8" />
        <rect x="22" y="1" width="2" height="5" fill={c.gold} opacity="0.9" />
        <rect x="24" y="0" width="2" height="6" fill={c.red} opacity="0.9" />
        <rect
          x="26"
          y="0"
          width="2"
          height="2"
          fill={c.turquoise}
          opacity="0.8"
        />
        <rect x="26" y="1" width="2" height="5" fill={c.green} opacity="0.9" />
        {/* Feather tips glow */}
        <rect x="3" y="0" width="1" height="1" fill="#ffffff" opacity="0.5" />
        <rect x="27" y="0" width="1" height="1" fill="#ffffff" opacity="0.5" />

        {/* Aztec Sun Calendar on chest */}
        <rect
          x="13"
          y="19"
          width="6"
          height="6"
          fill={c.obsidian}
          opacity="0.7"
        />
        <rect x="14" y="20" width="4" height="4" fill={c.gold} opacity="0.8" />
        <rect x="15" y="21" width="2" height="2" fill={c.red} opacity="0.9" />
        {/* Sun rays */}
        <rect x="12" y="21" width="1" height="2" fill={c.gold} opacity="0.6" />
        <rect x="19" y="21" width="1" height="2" fill={c.gold} opacity="0.6" />
        <rect x="15" y="18" width="2" height="1" fill={c.gold} opacity="0.6" />
        <rect x="15" y="25" width="2" height="1" fill={c.gold} opacity="0.6" />

        {/* Jaguar spots pattern on shoulders */}
        <rect
          x="6"
          y="18"
          width="2"
          height="2"
          fill={c.terracotta}
          opacity="0.6"
        />
        <rect
          x="7"
          y="19"
          width="1"
          height="1"
          fill={c.obsidian}
          opacity="0.8"
        />
        <rect
          x="24"
          y="18"
          width="2"
          height="2"
          fill={c.terracotta}
          opacity="0.6"
        />
        <rect
          x="25"
          y="19"
          width="1"
          height="1"
          fill={c.obsidian}
          opacity="0.8"
        />

        {/* Maya glyphs on arms */}
        <rect x="4" y="22" width="2" height="3" fill={c.jade} opacity="0.5" />
        <rect
          x="5"
          y="23"
          width="1"
          height="1"
          fill={c.obsidian}
          opacity="0.6"
        />
        <rect x="26" y="22" width="2" height="3" fill={c.jade} opacity="0.5" />
        <rect
          x="26"
          y="23"
          width="1"
          height="1"
          fill={c.obsidian}
          opacity="0.6"
        />

        {/* Gold earrings */}
        <rect x="7" y="11" width="1" height="2" fill={c.gold} opacity="0.8" />
        <rect x="24" y="11" width="1" height="2" fill={c.gold} opacity="0.8" />

        {/* Step pyramid pattern at bottom */}
        <rect
          x="11"
          y="28"
          width="1"
          height="1"
          fill={c.terracotta}
          opacity="0.5"
        />
        <rect
          x="12"
          y="29"
          width="2"
          height="1"
          fill={c.terracotta}
          opacity="0.5"
        />
        <rect
          x="18"
          y="29"
          width="2"
          height="1"
          fill={c.terracotta}
          opacity="0.5"
        />
        <rect
          x="20"
          y="28"
          width="1"
          height="1"
          fill={c.terracotta}
          opacity="0.5"
        />

        {/* Turquoise necklace */}
        <rect x="11" y="16" width="1" height="1" fill={c.turquoise} />
        <rect x="13" y="17" width="1" height="1" fill={c.turquoise} />
        <rect x="15" y="17" width="2" height="1" fill={c.gold} />
        <rect x="18" y="17" width="1" height="1" fill={c.turquoise} />
        <rect x="20" y="16" width="1" height="1" fill={c.turquoise} />
      </>
    );
  };

  // Africa Heritage - Kente, Adinkra, Tribal
  const renderAfrica = () => {
    const c = getAfricaColors();
    return (
      <>
        {/* Kente cloth crown/headwrap */}
        <rect
          x="9"
          y="4"
          width="14"
          height="2"
          fill={c.kente_gold}
          opacity="0.9"
        />
        <rect
          x="10"
          y="4"
          width="2"
          height="2"
          fill={c.kente_red}
          opacity="0.9"
        />
        <rect
          x="14"
          y="4"
          width="2"
          height="2"
          fill={c.kente_green}
          opacity="0.9"
        />
        <rect
          x="18"
          y="4"
          width="2"
          height="2"
          fill={c.kente_red}
          opacity="0.9"
        />
        <rect
          x="8"
          y="5"
          width="1"
          height="1"
          fill={c.kente_gold}
          opacity="0.8"
        />
        <rect
          x="23"
          y="5"
          width="1"
          height="1"
          fill={c.kente_gold}
          opacity="0.8"
        />

        {/* Adinkra symbol on forehead - Gye Nyame (supremacy of God) */}
        <rect
          x="14"
          y="7"
          width="4"
          height="1"
          fill={c.kente_black}
          opacity="0.6"
        />
        <rect
          x="15"
          y="8"
          width="2"
          height="1"
          fill={c.kente_gold}
          opacity="0.7"
        />

        {/* Tribal face markings - scarification patterns */}
        <rect x="9" y="10" width="1" height="3" fill={c.earth} opacity="0.5" />
        <rect x="10" y="11" width="1" height="1" fill={c.earth} opacity="0.6" />
        <rect x="22" y="10" width="1" height="3" fill={c.earth} opacity="0.5" />
        <rect x="21" y="11" width="1" height="1" fill={c.earth} opacity="0.6" />
        {/* Chin markings */}
        <rect x="15" y="14" width="1" height="1" fill={c.earth} opacity="0.4" />
        <rect x="16" y="14" width="1" height="1" fill={c.earth} opacity="0.4" />

        {/* Elaborate beaded necklace with cowrie shells */}
        <rect x="9" y="15" width="1" height="1" fill={c.kente_red} />
        <rect x="10" y="16" width="1" height="1" fill={c.cowrie} />
        <rect x="11" y="16" width="1" height="1" fill={c.kente_gold} />
        <rect x="12" y="16" width="1" height="1" fill={c.kente_green} />
        <rect x="13" y="17" width="1" height="1" fill={c.cowrie} />
        <rect x="14" y="17" width="2" height="1" fill={c.kente_red} />
        <rect x="16" y="17" width="1" height="1" fill={c.kente_gold} />
        <rect x="17" y="17" width="1" height="1" fill={c.cowrie} />
        <rect x="18" y="16" width="1" height="1" fill={c.kente_green} />
        <rect x="19" y="16" width="1" height="1" fill={c.kente_gold} />
        <rect x="20" y="16" width="1" height="1" fill={c.cowrie} />
        <rect x="21" y="15" width="1" height="1" fill={c.kente_red} />

        {/* Kente pattern on body */}
        <rect
          x="10"
          y="20"
          width="12"
          height="1"
          fill={c.kente_gold}
          opacity="0.7"
        />
        <rect
          x="11"
          y="21"
          width="2"
          height="2"
          fill={c.kente_red}
          opacity="0.6"
        />
        <rect
          x="14"
          y="21"
          width="2"
          height="2"
          fill={c.kente_green}
          opacity="0.6"
        />
        <rect
          x="17"
          y="21"
          width="2"
          height="2"
          fill={c.kente_red}
          opacity="0.6"
        />
        <rect
          x="10"
          y="23"
          width="12"
          height="1"
          fill={c.kente_gold}
          opacity="0.7"
        />

        {/* Arm bands - multiple */}
        <rect
          x="4"
          y="19"
          width="3"
          height="1"
          fill={c.kente_gold}
          opacity="0.8"
        />
        <rect
          x="4"
          y="21"
          width="3"
          height="1"
          fill={c.kente_red}
          opacity="0.7"
        />
        <rect
          x="4"
          y="23"
          width="3"
          height="1"
          fill={c.kente_gold}
          opacity="0.8"
        />
        <rect
          x="25"
          y="19"
          width="3"
          height="1"
          fill={c.kente_gold}
          opacity="0.8"
        />
        <rect
          x="25"
          y="21"
          width="3"
          height="1"
          fill={c.kente_red}
          opacity="0.7"
        />
        <rect
          x="25"
          y="23"
          width="3"
          height="1"
          fill={c.kente_gold}
          opacity="0.8"
        />

        {/* Large ear decorations */}
        <rect
          x="6"
          y="10"
          width="2"
          height="3"
          fill={c.kente_gold}
          opacity="0.8"
        />
        <rect
          x="7"
          y="11"
          width="1"
          height="1"
          fill={c.kente_red}
          opacity="0.9"
        />
        <rect
          x="24"
          y="10"
          width="2"
          height="3"
          fill={c.kente_gold}
          opacity="0.8"
        />
        <rect
          x="24"
          y="11"
          width="1"
          height="1"
          fill={c.kente_red}
          opacity="0.9"
        />

        {/* Ankh or African symbol at feet */}
        <rect
          x="14"
          y="29"
          width="1"
          height="2"
          fill={c.kente_gold}
          opacity="0.5"
        />
        <rect
          x="13"
          y="29"
          width="3"
          height="1"
          fill={c.kente_gold}
          opacity="0.5"
        />
        <rect
          x="17"
          y="29"
          width="1"
          height="2"
          fill={c.kente_gold}
          opacity="0.5"
        />
      </>
    );
  };

  // Asia Heritage - Chinese/Japanese/Korean elements
  const renderAsia = () => {
    const c = getAsiaColors();
    return (
      <>
        {/* Ornate hairpins with cherry blossoms */}
        <rect x="7" y="3" width="1" height="5" fill={c.red} />
        <rect x="6" y="2" width="3" height="1" fill={c.gold} />
        <rect x="5" y="1" width="2" height="2" fill={c.cherry} opacity="0.9" />
        <rect x="6" y="0" width="1" height="1" fill="#ffffff" opacity="0.6" />
        <rect x="24" y="3" width="1" height="5" fill={c.red} />
        <rect x="23" y="2" width="3" height="1" fill={c.gold} />
        <rect x="25" y="1" width="2" height="2" fill={c.cherry} opacity="0.9" />
        <rect x="26" y="0" width="1" height="1" fill="#ffffff" opacity="0.6" />

        {/* Floating cherry blossoms */}
        <rect x="2" y="7" width="2" height="2" fill={c.cherry} opacity="0.7" />
        <rect x="3" y="6" width="1" height="1" fill={c.cherry} opacity="0.5" />
        <rect x="1" y="8" width="1" height="1" fill="#ffffff" opacity="0.3" />
        <rect x="28" y="9" width="2" height="2" fill={c.cherry} opacity="0.7" />
        <rect x="29" y="8" width="1" height="1" fill={c.cherry} opacity="0.5" />
        <rect x="30" y="10" width="1" height="1" fill="#ffffff" opacity="0.3" />

        {/* Dragon scale pattern on shoulders */}
        <rect x="6" y="17" width="2" height="1" fill={c.red} opacity="0.6" />
        <rect x="7" y="18" width="2" height="1" fill={c.gold} opacity="0.7" />
        <rect x="6" y="19" width="2" height="1" fill={c.red} opacity="0.6" />
        <rect x="24" y="17" width="2" height="1" fill={c.red} opacity="0.6" />
        <rect x="23" y="18" width="2" height="1" fill={c.gold} opacity="0.7" />
        <rect x="24" y="19" width="2" height="1" fill={c.red} opacity="0.6" />

        {/* Yin-Yang symbol on chest */}
        <rect x="13" y="20" width="6" height="5" fill={c.ink} opacity="0.3" />
        <rect x="14" y="21" width="4" height="3" fill="#ffffff" opacity="0.5" />
        <rect x="14" y="21" width="2" height="3" fill={c.ink} opacity="0.6" />
        <rect x="14" y="22" width="1" height="1" fill="#ffffff" opacity="0.7" />
        <rect x="17" y="22" width="1" height="1" fill={c.ink} opacity="0.8" />

        {/* Mandarin collar detail */}
        <rect x="13" y="17" width="1" height="2" fill={c.red} opacity="0.8" />
        <rect x="14" y="17" width="1" height="1" fill={c.gold} opacity="0.9" />
        <rect x="17" y="17" width="1" height="1" fill={c.gold} opacity="0.9" />
        <rect x="18" y="17" width="1" height="2" fill={c.red} opacity="0.8" />

        {/* Koi fish scale hints at bottom */}
        <rect x="10" y="27" width="2" height="1" fill={c.gold} opacity="0.4" />
        <rect x="11" y="28" width="2" height="1" fill={c.red} opacity="0.5" />
        <rect x="19" y="27" width="2" height="1" fill={c.gold} opacity="0.4" />
        <rect x="18" y="28" width="2" height="1" fill={c.red} opacity="0.5" />

        {/* Wave pattern - seigaiha */}
        <rect x="12" y="29" width="1" height="1" fill={c.water} opacity="0.4" />
        <rect x="14" y="30" width="2" height="1" fill={c.water} opacity="0.5" />
        <rect x="16" y="29" width="1" height="1" fill={c.water} opacity="0.4" />
        <rect x="18" y="30" width="2" height="1" fill={c.water} opacity="0.5" />

        {/* Jade pendant */}
        <rect x="15" y="15" width="2" height="2" fill={c.jade} opacity="0.8" />
        <rect x="16" y="14" width="1" height="1" fill={c.gold} opacity="0.6" />
      </>
    );
  };

  // Europa Heritage - Celtic/Viking/Medieval elements
  const renderEuropa = () => {
    const c = getEuropaColors();
    return (
      <>
        {/* Viking/Medieval crown */}
        <rect x="11" y="3" width="10" height="2" fill={c.gold} opacity="0.9" />
        <rect x="13" y="2" width="2" height="2" fill={c.gold} opacity="0.8" />
        <rect x="17" y="2" width="2" height="2" fill={c.gold} opacity="0.8" />
        <rect x="15" y="1" width="2" height="2" fill={c.gold} />
        {/* Crown gems */}
        <rect
          x="12"
          y="3"
          width="1"
          height="1"
          fill={c.burgundy}
          opacity="0.9"
        />
        <rect x="15" y="2" width="2" height="1" fill={c.royal_blue} />
        <rect
          x="19"
          y="3"
          width="1"
          height="1"
          fill={c.burgundy}
          opacity="0.9"
        />

        {/* Viking runes on forehead */}
        <rect x="14" y="6" width="1" height="2" fill={c.silver} opacity="0.5" />
        <rect x="15" y="7" width="2" height="1" fill={c.silver} opacity="0.5" />
        <rect x="17" y="6" width="1" height="2" fill={c.silver} opacity="0.5" />

        {/* Celtic knotwork on shoulders */}
        <rect
          x="5"
          y="18"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        <rect
          x="6"
          y="19"
          width="2"
          height="1"
          fill={c.celtic_green}
          opacity="0.7"
        />
        <rect
          x="5"
          y="20"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        <rect
          x="7"
          y="20"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        <rect
          x="6"
          y="21"
          width="2"
          height="1"
          fill={c.celtic_green}
          opacity="0.7"
        />
        <rect
          x="5"
          y="22"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        {/* Right side knot */}
        <rect
          x="26"
          y="18"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        <rect
          x="24"
          y="19"
          width="2"
          height="1"
          fill={c.celtic_green}
          opacity="0.7"
        />
        <rect
          x="26"
          y="20"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        <rect
          x="24"
          y="20"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />
        <rect
          x="24"
          y="21"
          width="2"
          height="1"
          fill={c.celtic_green}
          opacity="0.7"
        />
        <rect
          x="26"
          y="22"
          width="1"
          height="1"
          fill={c.celtic_green}
          opacity="0.6"
        />

        {/* Heraldic shield on chest */}
        <rect x="13" y="19" width="6" height="7" fill={c.iron} opacity="0.4" />
        <rect
          x="14"
          y="20"
          width="4"
          height="5"
          fill={c.royal_blue}
          opacity="0.7"
        />
        <rect x="15" y="21" width="2" height="3" fill={c.gold} opacity="0.8" />
        {/* Shield cross */}
        <rect x="14" y="22" width="4" height="1" fill={c.ivory} opacity="0.7" />
        <rect x="16" y="20" width="1" height="5" fill={c.ivory} opacity="0.7" />

        {/* Medieval belt with buckle */}
        <rect x="9" y="25" width="14" height="1" fill={c.iron} opacity="0.7" />
        <rect x="14" y="25" width="4" height="1" fill={c.gold} opacity="0.9" />
        <rect x="15" y="25" width="2" height="1" fill={c.silver} />

        {/* Chain mail hints on shoulders */}
        <rect x="8" y="17" width="1" height="1" fill={c.silver} opacity="0.4" />
        <rect x="9" y="18" width="1" height="1" fill={c.silver} opacity="0.3" />
        <rect x="8" y="19" width="1" height="1" fill={c.silver} opacity="0.4" />
        <rect
          x="23"
          y="17"
          width="1"
          height="1"
          fill={c.silver}
          opacity="0.4"
        />
        <rect
          x="22"
          y="18"
          width="1"
          height="1"
          fill={c.silver}
          opacity="0.3"
        />
        <rect
          x="23"
          y="19"
          width="1"
          height="1"
          fill={c.silver}
          opacity="0.4"
        />

        {/* Viking beard braids (if applicable - subtle) */}
        <rect x="13" y="14" width="1" height="2" fill={c.gold} opacity="0.3" />
        <rect x="18" y="14" width="1" height="2" fill={c.gold} opacity="0.3" />

        {/* Iron arm guards */}
        <rect x="4" y="20" width="2" height="3" fill={c.iron} opacity="0.5" />
        <rect x="26" y="20" width="2" height="3" fill={c.iron} opacity="0.5" />
      </>
    );
  };

  // Oceania Heritage - Maori/Polynesian/Hawaiian elements
  const renderOceania = () => {
    const c = getOceaniaColors();
    return (
      <>
        {/* Tropical flowers in hair */}
        <rect
          x="5"
          y="5"
          width="3"
          height="3"
          fill={c.hibiscus}
          opacity="0.9"
        />
        <rect x="6" y="4" width="1" height="1" fill={c.coral} opacity="0.8" />
        <rect x="7" y="6" width="1" height="1" fill={c.sand} opacity="0.9" />
        <rect
          x="24"
          y="5"
          width="3"
          height="3"
          fill={c.hibiscus}
          opacity="0.9"
        />
        <rect x="25" y="4" width="1" height="1" fill={c.coral} opacity="0.8" />
        <rect x="25" y="6" width="1" height="1" fill={c.sand} opacity="0.9" />

        {/* Ta moko - Maori facial tattoo patterns */}
        <rect
          x="9"
          y="9"
          width="3"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="10"
          y="10"
          width="1"
          height="2"
          fill={c.tiki_wood}
          opacity="0.5"
        />
        <rect
          x="11"
          y="11"
          width="1"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="20"
          y="9"
          width="3"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="21"
          y="10"
          width="1"
          height="2"
          fill={c.tiki_wood}
          opacity="0.5"
        />
        <rect
          x="20"
          y="11"
          width="1"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        {/* Chin moko */}
        <rect
          x="14"
          y="14"
          width="4"
          height="1"
          fill={c.tiki_wood}
          opacity="0.4"
        />
        <rect
          x="15"
          y="15"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.5"
        />

        {/* Shell and bone lei necklace */}
        <rect x="10" y="16" width="2" height="1" fill={c.sand} />
        <rect x="12" y="16" width="1" height="1" fill={c.ocean} />
        <rect x="13" y="17" width="1" height="1" fill={c.sand} />
        <rect x="14" y="17" width="1" height="1" fill={c.coral} />
        <rect x="15" y="17" width="2" height="1" fill={c.turquoise} />
        <rect x="17" y="17" width="1" height="1" fill={c.coral} />
        <rect x="18" y="17" width="1" height="1" fill={c.sand} />
        <rect x="19" y="16" width="1" height="1" fill={c.ocean} />
        <rect x="20" y="16" width="2" height="1" fill={c.sand} />

        {/* Tiki symbol on chest */}
        <rect
          x="14"
          y="20"
          width="4"
          height="5"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect x="15" y="21" width="2" height="1" fill={c.sand} opacity="0.8" />
        <rect
          x="15"
          y="22"
          width="1"
          height="1"
          fill={c.tiki_wood}
          opacity="0.9"
        />
        <rect
          x="16"
          y="22"
          width="1"
          height="1"
          fill={c.tiki_wood}
          opacity="0.9"
        />
        <rect x="15" y="23" width="2" height="1" fill={c.lava} opacity="0.7" />

        {/* Polynesian tribal tattoo patterns on arms */}
        <rect
          x="4"
          y="19"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="5"
          y="20"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.5"
        />
        <rect
          x="4"
          y="21"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="5"
          y="22"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.5"
        />
        <rect
          x="4"
          y="23"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="26"
          y="19"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="25"
          y="20"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.5"
        />
        <rect
          x="26"
          y="21"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />
        <rect
          x="25"
          y="22"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.5"
        />
        <rect
          x="26"
          y="23"
          width="2"
          height="1"
          fill={c.tiki_wood}
          opacity="0.6"
        />

        {/* Navigation star pattern */}
        <rect x="8" y="24" width="1" height="1" fill={c.sand} opacity="0.5" />
        <rect x="23" y="24" width="1" height="1" fill={c.sand} opacity="0.5" />

        {/* Ocean wave pattern at bottom */}
        <rect x="10" y="28" width="2" height="1" fill={c.ocean} opacity="0.5" />
        <rect
          x="11"
          y="29"
          width="2"
          height="1"
          fill={c.turquoise}
          opacity="0.6"
        />
        <rect x="14" y="28" width="1" height="1" fill={c.ocean} opacity="0.4" />
        <rect
          x="15"
          y="29"
          width="2"
          height="1"
          fill={c.turquoise}
          opacity="0.5"
        />
        <rect x="17" y="28" width="1" height="1" fill={c.ocean} opacity="0.4" />
        <rect
          x="19"
          y="29"
          width="2"
          height="1"
          fill={c.turquoise}
          opacity="0.6"
        />
        <rect x="20" y="28" width="2" height="1" fill={c.ocean} opacity="0.5" />

        {/* Palm leaf accent */}
        <rect x="2" y="12" width="1" height="3" fill={c.palm} opacity="0.4" />
        <rect x="3" y="11" width="1" height="2" fill={c.palm} opacity="0.3" />
        <rect x="29" y="12" width="1" height="3" fill={c.palm} opacity="0.4" />
        <rect x="28" y="11" width="1" height="2" fill={c.palm} opacity="0.3" />
      </>
    );
  };

  // Select renderer based on heritage
  const renderHeritage = () => {
    switch (heritage) {
      case 0:
        return renderAmericas();
      case 1:
        return renderAfrica();
      case 2:
        return renderAsia();
      case 3:
        return renderEuropa();
      case 4:
        return renderOceania();
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated" }}
      className="absolute inset-0 pointer-events-none"
    >
      {renderHeritage()}
    </svg>
  );
};

/**
 * Heritage Background Effect
 * Patrones culturales minimalistas como fondo sutil.
 *
 * Cada herencia tiene un patrón distintivo pero muy sutil
 * para no distraer del personaje principal.
 */
interface HeritageBackgroundProps {
  heritage: number;
  size?: number;
  intensity?: "subtle" | "medium" | "visible";
}

// Background color palettes - very muted
const BG_COLORS: Record<number, { pattern: string; accent: string }> = {
  0: {
    pattern: "#78350f",
    accent: "#fbbf24",
  },
  1: {
    pattern: "#15803d",
    accent: "#86efac",
  },
  2: {
    pattern: "#1e40af",
    accent: "#fda4af",
  },
  3: {
    pattern: "#78350f",
    accent: "#a78bfa",
  },
  4: {
    pattern: "#0891b2",
    accent: "#14b8a6",
  },
};

export const HeritageBackground: FC<HeritageBackgroundProps> = ({
  heritage,
  size = 64,
  intensity = "subtle",
}) => {
  // Opacity based on intensity
  const opacityMap = {
    subtle: 0.08,
    medium: 0.15,
    visible: 0.25,
  };
  const opacity = opacityMap[intensity];

  const colors = BG_COLORS[heritage];

  // Americas - Aztec step pyramid pattern
  const renderAmericas = () => (
    <>
      {/* Step pyramid silhouette at bottom */}
      <rect
        x="12"
        y="28"
        width="8"
        height="4"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="14"
        y="26"
        width="4"
        height="2"
        fill={colors.pattern}
        opacity={opacity * 0.8}
      />
      <rect
        x="15"
        y="24"
        width="2"
        height="2"
        fill={colors.accent}
        opacity={opacity * 0.6}
      />
      {/* Corner sun rays */}
      <rect
        x="1"
        y="1"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.5}
      />
      <rect
        x="1"
        y="2"
        width="1"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.4}
      />
      <rect
        x="29"
        y="1"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.5}
      />
      <rect
        x="30"
        y="2"
        width="1"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.4}
      />
    </>
  );

  // Africa - Kente cloth weave pattern
  const renderAfrica = () => (
    <>
      {/* Horizontal weave lines */}
      <rect
        x="0"
        y="4"
        width="32"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.6}
      />
      <rect
        x="0"
        y="8"
        width="32"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.4}
      />
      <rect
        x="0"
        y="24"
        width="32"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.6}
      />
      <rect
        x="0"
        y="28"
        width="32"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.4}
      />
      {/* Vertical accent marks */}
      <rect
        x="4"
        y="0"
        width="1"
        height="32"
        fill={colors.accent}
        opacity={opacity * 0.3}
      />
      <rect
        x="27"
        y="0"
        width="1"
        height="32"
        fill={colors.accent}
        opacity={opacity * 0.3}
      />
    </>
  );

  // Asia - Seigaiha wave pattern
  const renderAsia = () => (
    <>
      {/* Stylized wave arcs at bottom */}
      <rect
        x="2"
        y="28"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="3"
        y="29"
        width="2"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.8}
      />
      <rect
        x="8"
        y="27"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.9}
      />
      <rect
        x="9"
        y="28"
        width="2"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.7}
      />
      <rect
        x="14"
        y="28"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="15"
        y="29"
        width="2"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.8}
      />
      <rect
        x="20"
        y="27"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.9}
      />
      <rect
        x="21"
        y="28"
        width="2"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.7}
      />
      <rect
        x="26"
        y="28"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="27"
        y="29"
        width="2"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.8}
      />
      {/* Cherry blossom hint top corner */}
      <rect
        x="28"
        y="2"
        width="2"
        height="2"
        fill={colors.accent}
        opacity={opacity * 0.5}
      />
      <rect
        x="29"
        y="1"
        width="1"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.3}
      />
    </>
  );

  // Europa - Celtic knot corners
  const renderEuropa = () => (
    <>
      {/* Top left knot */}
      <rect
        x="1"
        y="2"
        width="1"
        height="3"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="2"
        y="1"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="2"
        y="3"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.6}
      />
      {/* Top right knot */}
      <rect
        x="30"
        y="2"
        width="1"
        height="3"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="27"
        y="1"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="28"
        y="3"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.6}
      />
      {/* Bottom left knot */}
      <rect
        x="1"
        y="27"
        width="1"
        height="3"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="2"
        y="30"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="2"
        y="28"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.6}
      />
      {/* Bottom right knot */}
      <rect
        x="30"
        y="27"
        width="1"
        height="3"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="27"
        y="30"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="28"
        y="28"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.6}
      />
    </>
  );

  // Oceania - Tribal wave/navigation pattern
  const renderOceania = () => (
    <>
      {/* Bottom ocean waves */}
      <rect
        x="0"
        y="29"
        width="4"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="2"
        y="30"
        width="4"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.8}
      />
      <rect
        x="8"
        y="28"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.9}
      />
      <rect
        x="9"
        y="29"
        width="4"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.7}
      />
      <rect
        x="16"
        y="29"
        width="4"
        height="1"
        fill={colors.pattern}
        opacity={opacity}
      />
      <rect
        x="18"
        y="30"
        width="4"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.8}
      />
      <rect
        x="24"
        y="28"
        width="3"
        height="1"
        fill={colors.pattern}
        opacity={opacity * 0.9}
      />
      <rect
        x="25"
        y="29"
        width="4"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.7}
      />
      {/* Navigation star top */}
      <rect
        x="15"
        y="1"
        width="2"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.5}
      />
      <rect
        x="16"
        y="0"
        width="1"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.4}
      />
      <rect
        x="16"
        y="2"
        width="1"
        height="1"
        fill={colors.accent}
        opacity={opacity * 0.4}
      />
    </>
  );

  // Select renderer based on heritage
  const renderPattern = () => {
    switch (heritage) {
      case 0:
        return renderAmericas();
      case 1:
        return renderAfrica();
      case 2:
        return renderAsia();
      case 3:
        return renderEuropa();
      case 4:
        return renderOceania();
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ imageRendering: "pixelated" }}
      className="absolute inset-0 pointer-events-none"
    >
      {renderPattern()}
    </svg>
  );
};

/**
 * Heritage Particle Effect
 * Partículas temáticas flotantes para cada herencia
 */
interface HeritageParticlesProps {
  heritage: number;
  size?: number;
}

export const HeritageParticles: FC<HeritageParticlesProps> = ({
  heritage,
  size = 64,
}) => {
  const particleColors: Record<number, string[]> = {
    0: ["#fbbf24", "#22c55e", "#dc2626"],
    1: ["#fbbf24", "#dc2626", "#15803d"],
    2: ["#fda4af", "#dc2626", "#fbbf24"],
    3: ["#1e40af", "#fbbf24", "#15803d"],
    4: ["#0891b2", "#f472b6", "#14b8a6"],
  };

  const colors = particleColors[heritage];

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
        x="2"
        y="4"
        width="1"
        height="1"
        fill={colors[0]}
        opacity="0.4"
        className="animate-pulse"
      />
      <rect
        x="28"
        y="6"
        width="1"
        height="1"
        fill={colors[1]}
        opacity="0.3"
        className="animate-pulse"
        style={{ animationDelay: "0.5s" }}
      />
      <rect
        x="4"
        y="26"
        width="1"
        height="1"
        fill={colors[2]}
        opacity="0.4"
        className="animate-pulse"
        style={{ animationDelay: "1s" }}
      />
      <rect
        x="27"
        y="24"
        width="1"
        height="1"
        fill={colors[0]}
        opacity="0.3"
        className="animate-pulse"
        style={{ animationDelay: "1.5s" }}
      />
    </svg>
  );
};

export default HeritageOverlay;
