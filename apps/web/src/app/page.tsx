"use client";

/**
 * Main entry point — BitcoinSparks
 *
 * Renders the LandingPage which conditionally shows:
 * - Landing page (when no wallet) — SEO-friendly hero + features
 * - AppShell SPA (when wallet exists) — HOME | EXPLORE | YOU
 */

import { LandingPage } from "@/components/landing/LandingPage";

export default function Home() {
  return <LandingPage />;
}