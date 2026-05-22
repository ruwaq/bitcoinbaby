"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  pixelBorders,
  GenesisBabySprite,
  generateRandomTraits,
  traitsFromHash,
  getMiningBoost,
  getXpForNextLevel,
  getEvolutionCostDisplay,
  MAX_LEVEL,
  PixelCard,
  PixelButton,
  PixelProgress,
  PixelBadge,
  type GenesisBabyTraits,
  type BabyState,
} from "@bitcoinbaby/ui";

const BASE_TYPES = ["human", "animal", "robot", "mystic", "alien", "shaman", "elemental", "dragon"] as const;
const BLOODLINES = ["royal", "warrior", "rogue", "mystic"] as const;
const HERITAGES = ["americas", "africa", "asia", "europa", "oceania"] as const;
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
const STATES = ["idle", "happy", "sleeping", "hungry", "mining", "learning", "evolving", "thriving", "struggling"] as const;

export default function CharactersPage() {
  // Current traits state
  const [traits, setTraits] = useState<GenesisBabyTraits>({
    baseType: "human",
    bloodline: "royal",
    heritage: "americas",
    rarity: "common",
    dna: "f7931a0000000000",
  });

  // UI customization options
  const [spriteSize, setSpriteSize] = useState<number>(256);
  const [showFrame, setShowFrame] = useState<boolean>(true);
  const [showBadge, setShowBadge] = useState<boolean>(true);
  const [showBloodlineAura, setShowBloodlineAura] = useState<boolean>(true);
  const [animated, setAnimated] = useState<boolean>(true);
  const [babyState, setBabyState] = useState<BabyState>("idle");

  // DNA Input state
  const [dnaInput, setDnaInput] = useState<string>(traits.dna);
  const [dnaError, setDnaError] = useState<string | null>(null);

  // Evolution Simulator state
  const [level, setLevel] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [isEvolving, setIsEvolving] = useState<boolean>(false);
  const [evolutionSuccess, setEvolutionSuccess] = useState<boolean>(false);

  // Track if DNA needs updating when traits change manually
  const [isManualUpdate, setIsManualUpdate] = useState<boolean>(false);

  // Parse DNA input
  const handleParseDna = (hash: string) => {
    if (!hash || hash.trim() === "") {
      setDnaError("El hash de DNA no puede estar vacío");
      return;
    }
    const cleanHash = hash.replace(/^0x/, "").trim();
    if (!/^[0-9a-fA-F]+$/.test(cleanHash)) {
      setDnaError("El DNA debe ser un hash hexadecimal válido");
      return;
    }

    try {
      const parsedTraits = traitsFromHash(cleanHash);
      setTraits(parsedTraits);
      setDnaInput(cleanHash);
      setDnaError(null);
      setIsManualUpdate(false);
    } catch (err) {
      setDnaError("Error al procesar el DNA");
    }
  };

  // Generate random baby
  const handleRandomBaby = () => {
    const randomTraits = generateRandomTraits();
    setTraits(randomTraits);
    setDnaInput(randomTraits.dna);
    setDnaError(null);
    setIsManualUpdate(false);
  };

  // Sync DNA input state when traits change (but only if not manually typed)
  useEffect(() => {
    if (!isManualUpdate) {
      setDnaInput(traits.dna);
    }
  }, [traits.dna, isManualUpdate]);

  // Update specific trait manually
  const updateTrait = <K extends keyof Omit<GenesisBabyTraits, "dna">>(
    key: K,
    value: GenesisBabyTraits[K]
  ) => {
    setIsManualUpdate(true);
    setTraits((prev) => {
      const nextTraits = { ...prev, [key]: value };
      // Try to generate a dummy DNA that matches some aspects, or keep the existing DNA
      return nextTraits;
    });
  };

  // XP requirement for next level
  const reqXp = useMemo(() => {
    return getXpForNextLevel(level);
  }, [level]);

  // Mock production state for NFT helpers
  const mockNftState = useMemo(() => {
    return {
      dna: traits.dna,
      bloodline: traits.bloodline,
      baseType: traits.baseType,
      genesisBlock: 100,
      rarityTier: traits.rarity,
      tokenId: 1,
      level: level,
      xp: xp,
      totalXp: xp,
      workCount: 0,
      lastWorkBlock: 0,
      evolutionCount: level - 1,
      tokensEarned: 0n,
    };
  }, [traits, level, xp]);

  // Calculate boosts
  const currentBoost = useMemo(() => {
    return getMiningBoost(mockNftState);
  }, [mockNftState]);

  const nextBoost = useMemo(() => {
    if (level >= MAX_LEVEL) return currentBoost;
    return getMiningBoost({ ...mockNftState, level: level + 1 });
  }, [mockNftState, level, currentBoost]);

  // Add simulated XP
  const addXp = (amount: number) => {
    if (level >= MAX_LEVEL) return;
    setXp((prev) => Math.min(reqXp, prev + amount));
  };

  // Trigger simulated evolution
  const triggerEvolution = () => {
    if (xp < reqXp || level >= MAX_LEVEL || isEvolving) return;

    setIsEvolving(true);
    setBabyState("evolving");
    setEvolutionSuccess(false);

    // Simulate 1.5s evolution process
    setTimeout(() => {
      setLevel((prev) => prev + 1);
      setXp(0);
      setIsEvolving(false);
      setBabyState("happy");
      setEvolutionSuccess(true);

      // Reset success banner after 3 seconds
      setTimeout(() => {
        setEvolutionSuccess(false);
      }, 3000);
    }, 1500);
  };

  // Reset simulator state
  const resetSimulator = () => {
    setLevel(1);
    setXp(0);
    setBabyState("idle");
    setEvolutionSuccess(false);
  };

  // Rarity color helpers for borders/badges
  const rarityColors = {
    common: { border: "border-gray-500", text: "text-gray-400", bg: "bg-gray-950/80" },
    uncommon: { border: "border-green-500", text: "text-green-400", bg: "bg-green-950/80" },
    rare: { border: "border-blue-500", text: "text-blue-400", bg: "bg-blue-950/80" },
    epic: { border: "border-purple-500", text: "text-purple-400", bg: "bg-purple-950/80" },
    legendary: { border: "border-yellow-500", text: "text-yellow-400", bg: "bg-yellow-950/80" },
    mythic: { border: "border-pink-500", text: "text-pink-400", bg: "bg-pink-950/80" },
  }[traits.rarity];

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark text-pixel-text">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="relative py-6 px-8 bg-pixel-bg-medium border-4 border-black text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="absolute top-2 left-2 w-2 h-2 bg-pixel-primary" />
          <div className="absolute top-2 right-2 w-2 h-2 bg-pixel-primary" />
          <div className="absolute bottom-2 left-2 w-2 h-2 bg-pixel-primary" />
          <div className="absolute bottom-2 right-2 w-2 h-2 bg-pixel-primary" />
          
          <h1 className="font-pixel text-2xl md:text-3xl text-pixel-primary mb-2 tracking-wider">
            GENESIS BABIES DESIGNER
          </h1>
          <p className="font-pixel text-[10px] md:text-xs text-pixel-text-muted uppercase">
            Visualizador de Arte Real On-Chain y Simulador de Evolución
          </p>
        </header>

        {/* Level Up Flash Message */}
        {evolutionSuccess && (
          <div className="animate-bounce border-4 border-pixel-success bg-pixel-bg-medium text-pixel-success p-4 font-pixel text-center text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            ✨ ¡EVOLUCIÓN COMPLETADA CON ÉXITO! EL PODER DE MINADO HA AUMENTADO ✨
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Visualizer & View Settings (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            <PixelCard>
              <div className="font-pixel text-[10px] text-pixel-primary pb-2 mb-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span>VISTA DEL GENESIS BABY</span>
              </div>
              <div className="flex flex-col items-center justify-center p-6 space-y-6">
                {/* Sprite Render Frame */}
                <div 
                  className={`relative flex items-center justify-center bg-pixel-bg-dark border-4 border-black p-4 transition-all duration-300 ${
                    isEvolving ? "animate-[pixel-shake_0.15s_ease-in-out_infinite]" : ""
                  }`}
                  style={{
                    width: `${spriteSize + 32}px`,
                    height: `${spriteSize + 32}px`,
                  }}
                >
                  {/* Outer Rarity Glow / Aura in GPU */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40" />
                  
                  <div className="relative z-10">
                    <GenesisBabySprite
                      traits={traits}
                      size={spriteSize}
                      state={babyState}
                      showFrame={showFrame}
                      showBadge={showBadge}
                      showBloodlineAura={showBloodlineAura}
                      animated={animated}
                    />
                  </div>
                </div>

                {/* Info Badges */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <PixelBadge variant="default" className="text-[9px] uppercase">
                    Level {level}
                  </PixelBadge>
                  <span className={`px-2 py-0.5 border-2 text-[9px] font-pixel uppercase ${rarityColors.border} ${rarityColors.text} ${rarityColors.bg}`}>
                    {traits.rarity}
                  </span>
                  <PixelBadge variant="secondary" className="text-[9px] uppercase">
                    {traits.baseType}
                  </PixelBadge>
                  <PixelBadge variant="idle" className="text-[9px] uppercase">
                    {traits.bloodline}
                  </PixelBadge>
                </div>

                {/* Display Adjustments */}
                <div className="w-full space-y-4 pt-4 border-t-2 border-pixel-border">
                  <h3 className="font-pixel text-[10px] text-pixel-secondary uppercase">
                    Ajustes de Pantalla
                  </h3>

                  {/* Size slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-pixel text-[9px] text-pixel-text-muted">
                      <span>TAMAÑO:</span>
                      <span>{spriteSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="128"
                      max="320"
                      step="32"
                      value={spriteSize}
                      onChange={(e) => setSpriteSize(Number(e.target.value))}
                      className="w-full accent-pixel-primary bg-pixel-bg-dark border-2 border-black h-4 cursor-pointer"
                    />
                  </div>

                  {/* Checkbox settings */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center space-x-2 font-pixel text-[9px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={animated}
                        onChange={(e) => setAnimated(e.target.checked)}
                        className="form-checkbox h-3.5 w-3.5 accent-pixel-primary bg-pixel-bg-dark border-2 border-black"
                      />
                      <span>ANIMACIONES</span>
                    </label>

                    <label className="flex items-center space-x-2 font-pixel text-[9px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFrame}
                        onChange={(e) => setShowFrame(e.target.checked)}
                        className="form-checkbox h-3.5 w-3.5 accent-pixel-primary bg-pixel-bg-dark border-2 border-black"
                      />
                      <span>MARCO RAREZA</span>
                    </label>

                    <label className="flex items-center space-x-2 font-pixel text-[9px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBadge}
                        onChange={(e) => setShowBadge(e.target.checked)}
                        className="form-checkbox h-3.5 w-3.5 accent-pixel-primary bg-pixel-bg-dark border-2 border-black"
                      />
                      <span>BADGE RAREZA</span>
                    </label>

                    <label className="flex items-center space-x-2 font-pixel text-[9px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBloodlineAura}
                        onChange={(e) => setShowBloodlineAura(e.target.checked)}
                        className="form-checkbox h-3.5 w-3.5 accent-pixel-primary bg-pixel-bg-dark border-2 border-black"
                      />
                      <span>AURA LINAJE</span>
                    </label>
                  </div>
                </div>
              </div>
            </PixelCard>

            {/* Traits Details Card */}
            <PixelCard>
              <div className="font-pixel text-[10px] text-pixel-secondary pb-2 mb-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span>ESTADÍSTICAS DEL BEBÉ</span>
              </div>
              <div className="p-4 space-y-3 font-pixel text-[10px]">
                <div className="flex justify-between border-b-2 border-pixel-border pb-1">
                  <span className="text-pixel-text-muted">DNA HASH:</span>
                  <span className="font-mono text-xs select-all text-pixel-primary break-all">{traits.dna}</span>
                </div>
                <div className="flex justify-between border-b-2 border-pixel-border pb-1">
                  <span className="text-pixel-text-muted">TIPO BASE:</span>
                  <span className="text-pixel-text capitalize">{traits.baseType}</span>
                </div>
                <div className="flex justify-between border-b-2 border-pixel-border pb-1">
                  <span className="text-pixel-text-muted">LINAJE (BLOODLINE):</span>
                  <span className="text-pixel-text capitalize">{traits.bloodline}</span>
                </div>
                <div className="flex justify-between border-b-2 border-pixel-border pb-1">
                  <span className="text-pixel-text-muted">HERENCIA (HERITAGE):</span>
                  <span className="text-pixel-text capitalize">{traits.heritage}</span>
                </div>
                <div className="flex justify-between border-b-2 border-pixel-border pb-1">
                  <span className="text-pixel-text-muted">BOOST BASE POR RAREZA:</span>
                  <span className="text-pixel-success">+{getMiningBoost({ ...mockNftState, level: 1 })}%</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-pixel-text-muted">BOOST ACTUAL TOTAL:</span>
                  <span className="text-pixel-primary font-bold">+{currentBoost}%</span>
                </div>
              </div>
            </PixelCard>
          </div>

          {/* RIGHT COLUMN: Customizer & Evolution Simulator (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Customizer Panel */}
            <PixelCard>
              <div className="font-pixel text-[10px] text-pixel-text pb-2 mb-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span>ANALIZADOR DE DNA Y PERSONALIZADOR</span>
              </div>
              <div className="p-6 space-y-6">
                
                {/* DNA Input */}
                <div className="space-y-2">
                  <h3 className="font-pixel text-[10px] text-pixel-secondary uppercase">
                    Generación Determinística por DNA
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={dnaInput}
                      onChange={(e) => {
                        setDnaInput(e.target.value);
                        setIsManualUpdate(true);
                      }}
                      placeholder="Introduce DNA hexadecimal (e.g. 0xef44...)"
                      className="flex-1 px-3 py-2 bg-pixel-bg-dark border-4 border-black font-mono text-xs focus:outline-none focus:border-pixel-primary text-pixel-text placeholder:text-pixel-text-muted"
                    />
                    <PixelButton
                      variant="default"
                      onClick={() => handleParseDna(dnaInput)}
                      className="px-4 py-2 text-[10px]"
                    >
                      ANALIZAR DNA
                    </PixelButton>
                  </div>
                  {dnaError && (
                    <p className="font-pixel text-[8px] text-pixel-error uppercase">{dnaError}</p>
                  )}
                  <div className="flex justify-between gap-2 pt-1">
                    <span className="font-pixel text-[8px] text-pixel-text-muted">
                      El DNA determina de manera exacta y inmutable los rasgos del bebé.
                    </span>
                    <button
                      onClick={handleRandomBaby}
                      className="font-pixel text-[9px] text-pixel-primary hover:underline uppercase"
                    >
                      🎲 BEBÉ ALEATORIO
                    </button>
                  </div>
                </div>

                {/* Dropdowns Customizer */}
                <div className="space-y-4 border-t-2 border-pixel-border pt-4">
                  <h3 className="font-pixel text-[10px] text-pixel-secondary uppercase">
                    Personalizador de Capas Visuales
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Base Type Select */}
                    <div className="space-y-1">
                      <label className="font-pixel text-[9px] text-pixel-text-muted uppercase">
                        Tipo de Personaje
                      </label>
                      <select
                        value={traits.baseType}
                        onChange={(e) => updateTrait("baseType", e.target.value as any)}
                        className="w-full p-2 bg-pixel-bg-dark border-4 border-black font-pixel text-[10px] text-pixel-text focus:outline-none focus:border-pixel-primary"
                      >
                        {BASE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Bloodline Select */}
                    <div className="space-y-1">
                      <label className="font-pixel text-[9px] text-pixel-text-muted uppercase">
                        Linaje (Bloodline)
                      </label>
                      <select
                        value={traits.bloodline}
                        onChange={(e) => updateTrait("bloodline", e.target.value as any)}
                        className="w-full p-2 bg-pixel-bg-dark border-4 border-black font-pixel text-[10px] text-pixel-text focus:outline-none focus:border-pixel-primary"
                      >
                        {BLOODLINES.map((b) => (
                          <option key={b} value={b}>
                            {b.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Heritage Select */}
                    <div className="space-y-1">
                      <label className="font-pixel text-[9px] text-pixel-text-muted uppercase">
                        Herencia (Heritage)
                      </label>
                      <select
                        value={traits.heritage}
                        onChange={(e) => updateTrait("heritage", e.target.value as any)}
                        className="w-full p-2 bg-pixel-bg-dark border-4 border-black font-pixel text-[10px] text-pixel-text focus:outline-none focus:border-pixel-primary"
                      >
                        {HERITAGES.map((h) => (
                          <option key={h} value={h}>
                            {h.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Rarity Select */}
                    <div className="space-y-1">
                      <label className="font-pixel text-[9px] text-pixel-text-muted uppercase">
                        Rareza (Rarity)
                      </label>
                      <select
                        value={traits.rarity}
                        onChange={(e) => updateTrait("rarity", e.target.value as any)}
                        className="w-full p-2 bg-pixel-bg-dark border-4 border-black font-pixel text-[10px] text-pixel-text focus:outline-none focus:border-pixel-primary"
                      >
                        {RARITIES.map((r) => (
                          <option key={r} value={r}>
                            {r.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Character State */}
                  <div className="space-y-1">
                    <label className="font-pixel text-[9px] text-pixel-text-muted uppercase">
                      Pose / Estado del Sprite (Animado)
                    </label>
                    <select
                      value={babyState}
                      onChange={(e) => setBabyState(e.target.value as BabyState)}
                      className="w-full p-2 bg-pixel-bg-dark border-4 border-black font-pixel text-[10px] text-pixel-text focus:outline-none focus:border-pixel-primary"
                    >
                      {STATES.map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </PixelCard>

            {/* Evolution Simulator Panel */}
            <PixelCard>
              <div className="font-pixel text-[10px] text-pixel-legendary pb-2 mb-4 border-b-2 border-pixel-border flex items-center justify-between">
                <span>SIMULADOR DE EVOLUCIÓN E INCREMENTO DE PODER</span>
              </div>
              <div className="p-6 space-y-6">
                
                {/* Level indicators */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-pixel-bg-dark border-4 border-black p-3 text-center">
                    <div className="font-pixel text-[9px] text-pixel-text-muted uppercase">NIVEL ACTUAL</div>
                    <div className="font-pixel text-xl text-pixel-primary mt-1">Lvl {level}</div>
                  </div>

                  <div className="bg-pixel-bg-dark border-4 border-black p-3 text-center">
                    <div className="font-pixel text-[9px] text-pixel-text-muted uppercase">SIGUIENTE NIVEL</div>
                    <div className="font-pixel text-xl text-pixel-success mt-1">
                      {level < MAX_LEVEL ? `Lvl ${level + 1}` : "MAX"}
                    </div>
                  </div>
                </div>

                {/* Progress bars (XP) */}
                <div className="space-y-2">
                  <div className="flex justify-between font-pixel text-[9px]">
                    <span className="text-pixel-text-muted">PUNTOS DE EXPERIENCIA (XP):</span>
                    <span>
                      {level < MAX_LEVEL ? `${xp} / ${reqXp} XP` : "MAX LVL"}
                    </span>
                  </div>
                  <div className="h-6 bg-pixel-bg-dark border-4 border-black overflow-hidden relative">
                    <div
                      className="h-full bg-pixel-secondary transition-all duration-300"
                      style={{ width: `${level < MAX_LEVEL ? (xp / reqXp) * 100 : 100}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center font-pixel text-[8px] text-white mix-blend-difference">
                      {level < MAX_LEVEL ? `${Math.round((xp / reqXp) * 100)}% COMPLETADO` : "MÁXIMA MADUREZ"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PixelButton
                      variant="outline"
                      onClick={() => addXp(25)}
                      disabled={level >= MAX_LEVEL || xp >= reqXp || isEvolving}
                      className="flex-1 py-1 text-[9px]"
                    >
                      +25 XP
                    </PixelButton>
                    <PixelButton
                      variant="outline"
                      onClick={() => addXp(100)}
                      disabled={level >= MAX_LEVEL || xp >= reqXp || isEvolving}
                      className="flex-1 py-1 text-[9px]"
                    >
                      +100 XP
                    </PixelButton>
                  </div>
                </div>

                {/* Stats comparison before/after */}
                <div className="border-t-2 border-pixel-border pt-4 space-y-3 font-pixel text-[10px]">
                  <h4 className="text-pixel-secondary uppercase mb-2">Simulación de Boost de Minado</h4>
                  
                  <div className="flex justify-between">
                    <span className="text-pixel-text-muted">Mining Boost actual:</span>
                    <span className="text-pixel-text">+{currentBoost}%</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-pixel-text-muted">Mining Boost siguiente:</span>
                    <span className="text-pixel-success">
                      {level < MAX_LEVEL ? `+${nextBoost}% (+${nextBoost - currentBoost}%)` : "MÁXIMO"}
                    </span>
                  </div>

                  <div className="flex justify-between border-t-2 border-pixel-border/50 pt-2 font-bold">
                    <span className="text-pixel-text-muted">Costo en tokens $BABY:</span>
                    <span className="text-pixel-primary">
                      {level < MAX_LEVEL ? getEvolutionCostDisplay(level) : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Simulator Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <PixelButton
                    variant="default"
                    onClick={triggerEvolution}
                    disabled={xp < reqXp || level >= MAX_LEVEL || isEvolving}
                    className="flex-1 py-3 text-xs uppercase relative overflow-hidden"
                  >
                    {isEvolving ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin h-3 w-3 border-2 border-black border-t-transparent inline-block" />
                        EVOLUCIONANDO...
                      </span>
                    ) : (
                      "EVOLUCIONAR AHORA"
                    )}
                  </PixelButton>
                  
                  <PixelButton
                    variant="destructive"
                    onClick={resetSimulator}
                    className="py-3 text-xs uppercase sm:px-6"
                  >
                    REINICIAR
                  </PixelButton>
                </div>

              </div>
            </PixelCard>

          </div>

        </div>

        {/* Back Link */}
        <div className="text-center pt-8 border-t-4 border-black">
          <Link
            href="/"
            className="font-pixel text-[10px] text-pixel-primary hover:text-pixel-secondary transition-colors uppercase tracking-wider"
          >
            ← Volver a la Billetera Principal
          </Link>
        </div>
      </div>
    </main>
  );
}
