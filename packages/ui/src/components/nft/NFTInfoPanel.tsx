"use client";

/**
 * NFTInfoPanel - Information about Genesis Sparks NFTs
 *
 * Shows all NFT types, rarities, and benefits before minting.
 * Helps users understand what they could get and why it's valuable.
 */

// Simple className merge utility
const cn = (...classes: (string | undefined | false)[]) =>
  classes.filter(Boolean).join(" ");

// =============================================================================
// DATA
// =============================================================================

const RARITIES = [
  { name: "Common", chance: "50%", boost: "+10%", color: "text-gray-400" },
  { name: "Uncommon", chance: "25%", boost: "+25%", color: "text-green-400" },
  { name: "Rare", chance: "15%", boost: "+50%", color: "text-blue-400" },
  { name: "Epic", chance: "7%", boost: "+100%", color: "text-purple-400" },
  {
    name: "Legendary",
    chance: "2.5%",
    boost: "+150%",
    color: "text-yellow-400",
  },
  { name: "Mythic", chance: "0.5%", boost: "+220%", color: "text-red-400" },
];

const BLOODLINES = [
  { name: "Royal", emoji: "👑", desc: "Noble heritage, balanced stats" },
  {
    name: "Warrior",
    emoji: "⚔️",
    desc: "Combat focused, extra XP from battles",
  },
  { name: "Rogue", emoji: "🗡️", desc: "Sneaky, bonus luck on rare drops" },
  {
    name: "Mystic",
    emoji: "✨",
    desc: "Magical, enhanced evolution potential",
  },
];

const BASE_TYPES = [
  { name: "Human", chance: "70%", emoji: "👤" },
  { name: "Animal", chance: "15%", emoji: "🐾" },
  { name: "Mystic", chance: "9%", emoji: "🔮" },
  { name: "Robot", chance: "5%", emoji: "🤖" },
  { name: "Alien", chance: "1%", emoji: "👽" },
];

const BENEFITS = [
  {
    title: "Mining Boost",
    desc: "Each NFT increases your mining rewards based on its rarity",
    icon: "⛏️",
  },
  {
    title: "Level Up",
    desc: "Burn $BABY tokens to level up (1-10) and increase boost",
    icon: "📈",
  },
  {
    title: "Evolution",
    desc: "At max level, evolve your Spark into a stronger form",
    icon: "🦋",
  },
  {
    title: "Stacking",
    desc: "Own multiple NFTs to combine their boosts (diminishing returns)",
    icon: "📚",
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

interface NFTInfoPanelProps {
  className?: string;
  compact?: boolean;
}

export function NFTInfoPanel({
  className,
  compact = false,
}: NFTInfoPanelProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "bg-pixel-bg-medium border-4 border-pixel-border p-4",
          className,
        )}
      >
        <h3 className="font-pixel text-[9px] text-pixel-primary uppercase mb-3 text-center">
          What You Could Get
        </h3>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <p className="font-pixel text-[7px] text-pixel-text-muted">
              Rarities
            </p>
            <p className="font-pixel text-[10px] text-pixel-secondary">
              6 Tiers
            </p>
          </div>
          <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <p className="font-pixel text-[7px] text-pixel-text-muted">
              Max Boost
            </p>
            <p className="font-pixel text-[10px] text-pixel-success">+220%</p>
          </div>
          <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <p className="font-pixel text-[7px] text-pixel-text-muted">
              Bloodlines
            </p>
            <p className="font-pixel text-[10px] text-pixel-secondary">
              4 Types
            </p>
          </div>
          <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <p className="font-pixel text-[7px] text-pixel-text-muted">
              Base Types
            </p>
            <p className="font-pixel text-[10px] text-pixel-secondary">
              5 Types
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Header */}
      <div className="text-center">
        <h2 className="font-pixel text-lg text-pixel-primary mb-2">
          GENESIS BABIES
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Mint a random NFT and discover your unique Spark!
        </p>
      </div>

      {/* Benefits Overview */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-success p-4">
        <h3 className="font-pixel text-[9px] text-pixel-success uppercase mb-3 text-center">
          Why Mint a Genesis Spark?
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex gap-2">
              <span className="text-xl">{benefit.icon}</span>
              <div>
                <p className="font-pixel text-[8px] text-pixel-text">
                  {benefit.title}
                </p>
                <p className="font-pixel-body text-[10px] text-pixel-text-muted">
                  {benefit.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rarity Tiers */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
        <h3 className="font-pixel text-[9px] text-pixel-secondary uppercase mb-3">
          Rarity Tiers & Mining Boost
        </h3>
        <div className="space-y-2">
          {RARITIES.map((rarity) => (
            <div
              key={rarity.name}
              className="flex justify-between items-center p-2 bg-pixel-bg-dark border-2 border-pixel-border"
            >
              <span className={cn("font-pixel text-[8px]", rarity.color)}>
                {rarity.name}
              </span>
              <div className="flex gap-4">
                <span className="font-pixel text-[7px] text-pixel-text-muted">
                  {rarity.chance}
                </span>
                <span className="font-pixel text-[8px] text-pixel-success">
                  {rarity.boost}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-pixel text-[7px] text-pixel-text-muted text-center">
          Higher rarity = Higher mining boost on your $BABY rewards
        </p>
      </div>

      {/* Bloodlines */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
        <h3 className="font-pixel text-[9px] text-pixel-secondary uppercase mb-3">
          Bloodlines (25% each)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {BLOODLINES.map((bloodline) => (
            <div
              key={bloodline.name}
              className="p-2 bg-pixel-bg-dark border-2 border-pixel-border"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{bloodline.emoji}</span>
                <span className="font-pixel text-[8px] text-pixel-text">
                  {bloodline.name}
                </span>
              </div>
              <p className="font-pixel-body text-[9px] text-pixel-text-muted">
                {bloodline.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Base Types */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
        <h3 className="font-pixel text-[9px] text-pixel-secondary uppercase mb-3">
          Base Types
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {BASE_TYPES.map((type) => (
            <div
              key={type.name}
              className="flex items-center gap-2 px-3 py-2 bg-pixel-bg-dark border-2 border-pixel-border"
            >
              <span className="text-lg">{type.emoji}</span>
              <div>
                <span className="font-pixel text-[8px] text-pixel-text">
                  {type.name}
                </span>
                <span className="font-pixel text-[7px] text-pixel-text-muted ml-2">
                  ({type.chance})
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-pixel text-[7px] text-pixel-warning text-center">
          Alien is the rarest! Only 1% chance
        </p>
      </div>

      {/* Level System */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
        <h3 className="font-pixel text-[9px] text-pixel-secondary uppercase mb-3">
          Level & Evolution System
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <span className="font-pixel text-[8px] text-pixel-text">
              Starting Level
            </span>
            <span className="font-pixel text-[8px] text-pixel-primary">
              Level 1
            </span>
          </div>
          <div className="flex justify-between p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <span className="font-pixel text-[8px] text-pixel-text">
              Max Level
            </span>
            <span className="font-pixel text-[8px] text-pixel-success">
              Level 10
            </span>
          </div>
          <div className="flex justify-between p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <span className="font-pixel text-[8px] text-pixel-text">
              Level Up Cost
            </span>
            <span className="font-pixel text-[8px] text-pixel-warning">
              Burn $BABY
            </span>
          </div>
          <div className="flex justify-between p-2 bg-pixel-bg-dark border-2 border-pixel-border">
            <span className="font-pixel text-[8px] text-pixel-text">
              Boost per Level
            </span>
            <span className="font-pixel text-[8px] text-pixel-success">
              +10%
            </span>
          </div>
        </div>
        <p className="mt-2 font-pixel text-[7px] text-pixel-text-muted text-center">
          A Level 10 Mythic = 220% base + 100% levels = +320% mining boost!
        </p>
      </div>

      {/* Random Notice */}
      <div className="bg-pixel-warning/10 border-4 border-pixel-warning p-4 text-center">
        <p className="font-pixel text-[9px] text-pixel-warning uppercase mb-2">
          100% Random
        </p>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Your Baby's traits are determined randomly at mint time. No previews,
          no re-rolls - it's a surprise!
        </p>
      </div>
    </div>
  );
}

export default NFTInfoPanel;
