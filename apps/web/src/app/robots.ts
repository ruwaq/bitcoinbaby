import type { MetadataRoute } from "next";

/**
 * robots.txt — Allow all crawlers, point to sitemap
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bitcoinsparks.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/~offline"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
