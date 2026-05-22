import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Detect if building for native (Capacitor)
const isNativeBuild = process.env.BUILD_TARGET === "native";

const withSerwist = withSerwistInit({
  // Service worker source file location
  swSrc: "src/app/sw.ts",
  // Output location for the compiled service worker
  swDest: "public/sw.js",
  // Disable PWA in development AND in native builds (Capacitor handles this)
  disable: process.env.NODE_ENV === "development" || isNativeBuild,
  // Reload page when coming back online (false to prevent data loss)
  reloadOnOnline: false,
  // Enable caching on navigation (next/link)
  cacheOnNavigation: true,
});

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling native server packages
  serverExternalPackages: ["onnxruntime-node", "sharp"],

  // Turbopack only for dev and SSR (not static export)
  ...(isNativeBuild ? {} : { turbopack: {} }),

  // Static export ONLY for Capacitor builds
  ...(isNativeBuild ? { output: "export" } : {}),

  // Images unoptimized for static export
  images: {
    unoptimized: isNativeBuild,
  },

  // PRODUCTION: Disable all development indicators
  devIndicators: false,

  // Trailing slash required for Capacitor file:// routing
  ...(isNativeBuild ? { trailingSlash: true } : {}),

  // Transpile monorepo packages
  transpilePackages: [
    "@bitcoinbaby/ui",
    "@bitcoinbaby/core",
    "@bitcoinbaby/bitcoin",
    "@bitcoinbaby/ai",
  ],

  // Enable WebAssembly support (required for bitcoinjs-lib / tiny-secp256k1)
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp: false,
      "onnxruntime-node": false,
    };
    return config;
  },

  // Security headers handled by middleware.ts for dynamic nonce CSP
  // Only static headers for service worker here
  ...(isNativeBuild
    ? {}
    : {
        async headers() {
          return [
            {
              // Service worker needs specific headers
              source: "/sw.js",
              headers: [
                {
                  key: "Content-Type",
                  value: "application/javascript; charset=utf-8",
                },
                {
                  key: "Cache-Control",
                  value: "no-cache, no-store, must-revalidate",
                },
              ],
            },
          ];
        },
      }),
};

// PWA wrapper only for web builds
export default isNativeBuild ? nextConfig : withSerwist(nextConfig);
