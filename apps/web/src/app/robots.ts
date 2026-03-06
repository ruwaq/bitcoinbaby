/**
 * robots.txt for SEO
 *
 * Controls how search engines crawl the site.
 * Next.js generates this at build time.
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bitcoinbaby.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", // API routes
          "/wallet/send", // Private wallet pages
          "/settings", // User settings
          "/_next/", // Next.js internals
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
