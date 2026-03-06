/**
 * Sitemap for SEO
 *
 * Lists all public pages for search engine indexing.
 * Next.js generates sitemap.xml at build time.
 */

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bitcoinbaby.app";
  const lastModified = new Date();

  // Public pages that should be indexed
  const publicRoutes = [
    "", // Home/Mining
    "/leaderboard", // Leaderboard
    "/technology", // Technology info
    "/help", // Help/FAQ
    "/cosmic", // Cosmic events
    "/characters", // NFT characters showcase
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "/leaderboard" ? "hourly" : "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
