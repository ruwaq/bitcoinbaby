import type { MetadataRoute } from "next";

// Required for static export
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BitcoinSparks — Mine Bitcoin While Your Spark Evolves",
    short_name: "BitcoinSparks",
    description:
      "Raise your AI-powered pixel spark while mining Bitcoin. Proof of Useful Work meets Tamagotchi. Built on Bitcoin with Charms Protocol.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f1b",
    theme_color: "#f7931a",
    orientation: "portrait",
    categories: ["games", "entertainment", "finance"],
    icons: [
      {
        src: "/icons/icon-72x72.svg",
        sizes: "72x72",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-96x96.svg",
        sizes: "96x96",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-128x128.svg",
        sizes: "128x128",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-144x144.svg",
        sizes: "144x144",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-152x152.svg",
        sizes: "152x152",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-384x384.svg",
        sizes: "384x384",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}