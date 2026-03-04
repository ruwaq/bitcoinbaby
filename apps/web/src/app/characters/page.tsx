"use client";

import { useState } from "react";
import Link from "next/link";
import { pixelBorders } from "@bitcoinbaby/ui";

// Import sprites directly since we're in the web app
// In production, these would come from @bitcoinbaby/ui

// ============================================
// SPRITE COMPONENTS (inline for now)
// ============================================

// Oracle Sprite
function Oracle({
  size = 128,
  state = "idle",
}: {
  size?: number;
  state?: "idle" | "talking" | "thinking";
}) {
  const stateClasses = {
    idle: "",
    talking: "animate-pulse",
    thinking: "animate-[pixel-float_2s_ease-in-out_infinite]",
  };
  return (
    <div className={`relative ${stateClasses[state]}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ imageRendering: "pixelated" }}
      >
        <rect x="4" y="8" width="2" height="20" fill="#8b5cf6" />
        <rect x="3" y="6" width="4" height="3" fill="#f7931a" />
        <rect x="4" y="5" width="2" height="1" fill="#ffc107" />
        <rect x="10" y="16" width="14" height="14" fill="#0f0f1b" />
        <rect x="8" y="18" width="2" height="10" fill="#0f0f1b" />
        <rect x="24" y="18" width="2" height="10" fill="#0f0f1b" />
        <rect x="11" y="18" width="1" height="1" fill="#4ade80" />
        <rect x="14" y="19" width="1" height="1" fill="#4ade80" />
        <rect x="17" y="18" width="1" height="1" fill="#4ade80" />
        <rect x="20" y="20" width="1" height="1" fill="#4ade80" />
        <rect x="12" y="22" width="1" height="1" fill="#4ade80" />
        <rect x="15" y="23" width="1" height="1" fill="#4ade80" />
        <rect x="12" y="6" width="10" height="10" fill="#374151" />
        <rect x="10" y="8" width="2" height="6" fill="#374151" />
        <rect x="22" y="8" width="2" height="6" fill="#374151" />
        <rect x="11" y="5" width="12" height="2" fill="#0f0f1b" />
        <rect x="15" y="7" width="4" height="3" fill="#1f2937" />
        <rect x="16" y="8" width="2" height="1" fill="#ef4444" />
        <rect x="13" y="12" width="1" height="6" fill="#6b7280" />
        <rect x="15" y="13" width="1" height="7" fill="#9ca3af" />
        <rect x="17" y="12" width="1" height="8" fill="#6b7280" />
        <rect x="19" y="13" width="1" height="6" fill="#9ca3af" />
        <rect x="6" y="18" width="4" height="2" fill="#374151" />
      </svg>
      {state === "talking" && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 border-2 border-black animate-bounce" />
      )}
    </div>
  );
}

// SatoBots
function SatoBots({ count = 3, size = 32 }: { count?: number; size?: number }) {
  return (
    <div className="relative flex items-center">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-[pixel-float_2s_ease-in-out_infinite]"
          style={{
            marginLeft: i > 0 ? -size * 0.3 : 0,
            animationDelay: `${i * 200}ms`,
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            style={{ imageRendering: "pixelated" }}
          >
            <rect x="6" y="1" width="4" height="1" fill="#6b7280" />
            <rect x="7" y="2" width="2" height="2" fill="#374151" />
            <rect x="4" y="5" width="8" height="6" fill="#f7931a" />
            <rect x="3" y="6" width="1" height="4" fill="#f7931a" />
            <rect x="12" y="6" width="1" height="4" fill="#f7931a" />
            <rect x="5" y="7" width="2" height="2" fill="#1f2937" />
            <rect x="9" y="7" width="2" height="2" fill="#1f2937" />
            <rect x="5" y="7" width="1" height="1" fill="#4fc3f7" />
            <rect x="9" y="7" width="1" height="1" fill="#4fc3f7" />
            <rect x="7" y="12" width="1" height="1" fill="#ffc107" />
            <rect
              x="6"
              y="14"
              width="1"
              height="1"
              fill="#ffc107"
              opacity="0.5"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

// Code Egg
function CodeEgg({
  size = 128,
  state = "dormant",
}: {
  size?: number;
  state?: "dormant" | "warming" | "hatching";
}) {
  const stateClasses = {
    dormant: "opacity-80",
    warming: "animate-pulse",
    hatching: "animate-[pixel-shake_0.3s_ease-in-out_infinite]",
  };
  const opacity = { dormant: 0.3, warming: 0.7, hatching: 1 };
  return (
    <div className={`relative ${stateClasses[state]}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ imageRendering: "pixelated" }}
      >
        <ellipse cx="16" cy="30" rx="10" ry="2" fill="#000000" opacity="0.3" />
        <rect x="8" y="8" width="16" height="18" fill="#374151" />
        <rect x="6" y="10" width="2" height="14" fill="#374151" />
        <rect x="24" y="10" width="2" height="14" fill="#374151" />
        <rect x="10" y="6" width="12" height="2" fill="#374151" />
        <rect x="10" y="26" width="12" height="2" fill="#374151" />
        <rect x="10" y="10" width="6" height="6" fill="#1a1a2e" />
        <rect x="16" y="10" width="6" height="6" fill="#4b5563" />
        <rect x="10" y="16" width="6" height="6" fill="#4b5563" />
        <rect x="16" y="16" width="6" height="6" fill="#1a1a2e" />
        <g opacity={opacity[state]}>
          <rect x="9" y="12" width="1" height="8" fill="#f7931a" />
          <rect x="22" y="14" width="1" height="6" fill="#f7931a" />
          <rect x="12" y="11" width="4" height="1" fill="#f7931a" />
          <rect x="17" y="15" width="4" height="1" fill="#f7931a" />
          <rect x="15" y="13" width="2" height="2" fill="#ffc107" />
        </g>
        <rect x="14" y="6" width="1" height="3" fill="#000000" />
        <rect x="15" y="8" width="2" height="1" fill="#000000" />
      </svg>
      {state === "hatching" && (
        <>
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-orange-500 animate-ping" />
          <div
            className="absolute top-2 right-1/4 w-2 h-2 bg-cyan-500 animate-ping"
            style={{ animationDelay: "100ms" }}
          />
        </>
      )}
    </div>
  );
}

// Baby Sprite
function BabySprite({
  size = 192,
  state = "idle",
}: {
  size?: number;
  state?: string;
}) {
  const stateClasses: Record<string, string> = {
    idle: "animate-[pixel-float_2s_ease-in-out_infinite]",
    happy: "animate-bounce",
    sleeping: "opacity-70 hue-rotate-[240deg]",
    hungry: "animate-[pixel-shake_0.3s_ease-in-out_infinite]",
    mining: "",
    evolving: "animate-pulse",
  };
  const isSleeping = state === "sleeping";
  const isMining = state === "mining";
  return (
    <div className={`relative ${stateClasses[state] || ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        style={{ imageRendering: "pixelated" }}
      >
        <rect x="7" y="0" width="2" height="2" fill="#4fc3f7" />
        <rect x="8" y="0" width="1" height="1" fill="#81d4fa" />
        <rect x="4" y="2" width="8" height="6" fill="#ffc107" />
        <rect x="3" y="3" width="1" height="4" fill="#ffc107" />
        <rect x="12" y="3" width="1" height="4" fill="#ffc107" />
        <rect x="5" y="3" width="6" height="3" fill="#4fc3f7" opacity="0.6" />
        <rect x="6" y="3" width="2" height="2" fill="#8b5cf6" opacity="0.7" />
        <rect x="8" y="4" width="2" height="2" fill="#8b5cf6" opacity="0.7" />
        {!isSleeping ? (
          <>
            <rect x="5" y="5" width="2" height="2" fill="#1f2937" />
            <rect x="9" y="5" width="2" height="2" fill="#1f2937" />
            <rect x="5" y="5" width="1" height="1" fill="#ffffff" />
            <rect x="9" y="5" width="1" height="1" fill="#ffffff" />
          </>
        ) : (
          <>
            <rect x="5" y="6" width="2" height="1" fill="#1f2937" />
            <rect x="9" y="6" width="2" height="1" fill="#1f2937" />
          </>
        )}
        <rect x="7" y="7" width="2" height="1" fill="#1f2937" />
        <rect x="3" y="5" width="1" height="1" fill="#ff9999" />
        <rect x="12" y="5" width="1" height="1" fill="#ff9999" />
        <rect x="5" y="8" width="6" height="5" fill="#f7931a" />
        <rect x="4" y="9" width="1" height="3" fill="#f7931a" />
        <rect x="11" y="9" width="1" height="3" fill="#f7931a" />
        <rect x="7" y="9" width="2" height="3" fill="#1f2937" />
        <rect x="6" y="10" width="1" height="1" fill="#1f2937" />
        <rect x="9" y="10" width="1" height="1" fill="#1f2937" />
        <rect x="5" y="13" width="2" height="1" fill="#e67e00" />
        <rect x="9" y="13" width="2" height="1" fill="#e67e00" />
      </svg>
      {isMining && (
        <>
          <div className="absolute -top-2 -left-2 w-2 h-2 bg-orange-500 animate-ping" />
          <div
            className="absolute -top-1 -right-3 w-2 h-2 bg-cyan-500 animate-ping"
            style={{ animationDelay: "100ms" }}
          />
          <div
            className="absolute -bottom-2 left-4 w-2 h-2 bg-green-500 animate-ping"
            style={{ animationDelay: "200ms" }}
          />
        </>
      )}
      {isSleeping && (
        <div className="absolute -top-4 right-0 font-pixel text-cyan-400 text-xs animate-[pixel-float_2s_ease-in-out_infinite]">
          Zzz
        </div>
      )}
    </div>
  );
}

// Teen Sprite
function TeenSprite({
  size = 192,
  state = "idle",
}: {
  size?: number;
  state?: string;
}) {
  const stateClasses: Record<string, string> = {
    idle: "",
    hacking: "animate-pulse",
    mining_boost: "",
  };
  const isHacking = state === "hacking";
  return (
    <div className={`relative ${stateClasses[state] || ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ imageRendering: "pixelated" }}
      >
        <ellipse cx="12" cy="23" rx="6" ry="1" fill="#000000" opacity="0.3" />
        <rect x="6" y="2" width="12" height="10" fill="#6366f1" />
        <rect x="5" y="4" width="1" height="6" fill="#6366f1" />
        <rect x="18" y="4" width="1" height="6" fill="#6366f1" />
        <rect x="8" y="1" width="8" height="2" fill="#6366f1" />
        <rect x="7" y="10" width="10" height="1" fill="#4f46e5" />
        <rect x="8" y="4" width="8" height="6" fill="#f7931a" />
        <rect x="7" y="5" width="10" height="4" fill="#1f2937" />
        <rect x="8" y="6" width="3" height="2" fill="#0f0f1b" />
        <rect x="13" y="6" width="3" height="2" fill="#0f0f1b" />
        {isHacking && (
          <>
            <rect
              x="8"
              y="6"
              width="1"
              height="1"
              fill="#4ade80"
              className="animate-pulse"
            />
            <rect
              x="10"
              y="7"
              width="1"
              height="1"
              fill="#4ade80"
              className="animate-pulse"
            />
            <rect
              x="13"
              y="6"
              width="1"
              height="1"
              fill="#4ade80"
              className="animate-pulse"
            />
            <rect
              x="15"
              y="7"
              width="1"
              height="1"
              fill="#4ade80"
              className="animate-pulse"
            />
          </>
        )}
        <rect x="10" y="9" width="4" height="1" fill="#e67e00" />
        <rect x="7" y="11" width="10" height="8" fill="#f7931a" />
        <rect x="6" y="12" width="1" height="5" fill="#f7931a" />
        <rect x="17" y="12" width="1" height="5" fill="#f7931a" />
        <rect x="8" y="13" width="1" height="3" fill="#4fc3f7" />
        <rect x="9" y="14" width="2" height="1" fill="#4fc3f7" />
        <rect x="14" y="12" width="2" height="1" fill="#4fc3f7" />
        <rect x="15" y="13" width="1" height="2" fill="#4fc3f7" />
        <rect x="11" y="13" width="2" height="4" fill="#1f2937" />
        <rect x="4" y="12" width="2" height="4" fill="#e67e00" />
        <rect x="18" y="12" width="2" height="4" fill="#e67e00" />
        <rect x="4" y="16" width="2" height="2" fill="#f7931a" />
        <rect x="18" y="16" width="2" height="2" fill="#f7931a" />
        <rect x="8" y="19" width="3" height="3" fill="#e67e00" />
        <rect x="13" y="19" width="3" height="3" fill="#e67e00" />
        <rect x="7" y="21" width="4" height="1" fill="#1f2937" />
        <rect x="13" y="21" width="4" height="1" fill="#1f2937" />
      </svg>
      {state === "mining_boost" && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle, rgba(247,147,26,0.3) 0%, transparent 60%)",
          }}
        />
      )}
    </div>
  );
}

// ============================================
// SHOWCASE PAGE
// ============================================

export default function CharactersPage() {
  const [babyState, setBabyState] = useState<string>("idle");
  const [eggState, setEggState] = useState<"dormant" | "warming" | "hatching">(
    "dormant",
  );
  const [oracleState, setOracleState] = useState<
    "idle" | "talking" | "thinking"
  >("idle");
  const [teenState, setTeenState] = useState<string>("idle");

  return (
    <main className="min-h-screen p-8 bg-pixel-bg-dark">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="font-pixel text-2xl text-pixel-primary mb-4">
            CHARACTER GALLERY
          </h1>
          <p className="font-pixel-body text-lg text-pixel-text-muted">
            BitcoinBaby Pixel Art Character Ecosystem
          </p>
        </header>

        {/* Evolution Timeline */}
        <section className="mb-16">
          <h2 className="font-pixel text-sm text-pixel-secondary mb-6">
            EVOLUTION STAGES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Egg */}
            <div
              className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6 text-center`}
            >
              <div className="flex justify-center mb-4">
                <CodeEgg size={96} state={eggState} />
              </div>
              <h3 className="font-pixel text-xs text-pixel-text mb-2">
                STAGE 0
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                El Huevo de Codigo
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {(["dormant", "warming", "hatching"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEggState(s)}
                    className={`px-2 py-1 font-pixel text-[8px] border-2 border-black ${eggState === s ? "bg-pixel-primary text-black" : "bg-pixel-bg-dark text-pixel-text"}`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Baby */}
            <div
              className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6 text-center`}
            >
              <div className="flex justify-center mb-4">
                <BabySprite size={96} state={babyState} />
              </div>
              <h3 className="font-pixel text-xs text-pixel-text mb-2">
                STAGE 1
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                El Bebe Nodo
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {["idle", "happy", "sleeping", "mining"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setBabyState(s)}
                    className={`px-2 py-1 font-pixel text-[8px] border-2 border-black ${babyState === s ? "bg-pixel-primary text-black" : "bg-pixel-bg-dark text-pixel-text"}`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Teen */}
            <div
              className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6 text-center`}
            >
              <div className="flex justify-center mb-4">
                <TeenSprite size={96} state={teenState} />
              </div>
              <h3 className="font-pixel text-xs text-pixel-text mb-2">
                STAGE 2
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                El Cypher-Adolescente
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                {["idle", "hacking", "mining_boost"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTeenState(s)}
                    className={`px-2 py-1 font-pixel text-[8px] border-2 border-black ${teenState === s ? "bg-pixel-primary text-black" : "bg-pixel-bg-dark text-pixel-text"}`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Master (Coming Soon) */}
            <div className="bg-pixel-bg-medium border-4 border-dashed border-pixel-border p-6 text-center opacity-50">
              <div className="flex justify-center mb-4 h-24 items-center">
                <span className="font-pixel text-4xl text-pixel-text-muted">
                  ?
                </span>
              </div>
              <h3 className="font-pixel text-xs text-pixel-text mb-2">
                STAGE 3
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted">
                El Maestro Cadena
              </p>
              <p className="font-pixel text-[8px] text-pixel-primary mt-4">
                COMING SOON
              </p>
            </div>
          </div>
        </section>

        {/* NPCs */}
        <section className="mb-16">
          <h2 className="font-pixel text-sm text-pixel-secondary mb-6">
            NPCs & COMPANIONS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Oracle */}
            <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6`}>
              <div className="flex items-center gap-6">
                <Oracle size={128} state={oracleState} />
                <div>
                  <h3 className="font-pixel text-sm text-pixel-text mb-2">
                    EL ORACULO DEL MEMPOOL
                  </h3>
                  <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                    Wise robotic wizard guide. Appears in tutorials and help
                    sections.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(["idle", "talking", "thinking"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setOracleState(s)}
                        className={`px-2 py-1 font-pixel text-[8px] border-2 border-black ${oracleState === s ? "bg-pixel-secondary text-black" : "bg-pixel-bg-dark text-pixel-text"}`}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SatoBots */}
            <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6`}>
              <div className="flex items-center gap-6">
                <SatoBots count={3} size={48} />
                <div>
                  <h3 className="font-pixel text-sm text-pixel-text mb-2">
                    LOS SATO-BOTS
                  </h3>
                  <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                    Tiny helper drones representing satoshis. Appear for rewards
                    and achievements.
                  </p>
                  <div className="flex gap-4 mt-2">
                    <SatoBots count={1} size={32} />
                    <SatoBots count={2} size={32} />
                    <SatoBots count={3} size={32} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section>
          <h2 className="font-pixel text-sm text-pixel-secondary mb-6">
            COLOR PALETTE
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { name: "Bitcoin Orange", color: "#f7931a" },
              { name: "Cyan", color: "#4fc3f7" },
              { name: "Purple", color: "#8b5cf6" },
              { name: "Success", color: "#4ade80" },
              { name: "Error", color: "#ef4444" },
              { name: "Dark", color: "#0f0f1b" },
            ].map(({ name, color }) => (
              <div key={name} className="text-center">
                <div
                  className="w-full h-16 border-4 border-black mb-2"
                  style={{ backgroundColor: color }}
                />
                <p className="font-pixel text-[8px] text-pixel-text">{name}</p>
                <p className="font-pixel-mono text-xs text-pixel-text-muted">
                  {color}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Back Link */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="font-pixel text-xs text-pixel-primary hover:text-pixel-secondary transition-colors"
          >
            ← BACK TO HOME
          </Link>
        </div>
      </div>
    </main>
  );
}
