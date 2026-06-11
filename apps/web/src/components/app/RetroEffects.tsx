"use client";

/**
 * RetroEffects — CRT scanlines and vignette overlay
 *
 * Extracted from RootLayout into a Client Component so the layout
 * can remain a pure Server Component. These effects are purely
 * decorative and don't need to block rendering.
 */

export function RetroEffects() {
  return (
    <>
      {/* CRT scanline effect — subtle overlay for retro feel */}
      <div
        className="pointer-events-none fixed inset-0 z-50 hidden md:block"
        aria-hidden="true"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Subtle vignette for depth */}
      <div
        className="pointer-events-none fixed inset-0 z-40 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)",
        }}
      />
    </>
  );
}
