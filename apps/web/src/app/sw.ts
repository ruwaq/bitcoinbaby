import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  NetworkOnly,
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * BitcoinBaby Service Worker — Offline-First Caching Strategy
 *
 * Caching tiers:
 * 1. Static assets (fonts, icons, CSS, JS) → CacheFirst (immutable, versioned)
 * 2. App shell (HTML pages) → StaleWhileRevalidate (fast load, background update)
 * 3. API calls (mining, blockchain) → NetworkOnly (never cache)
 * 4. Worker scripts → NetworkFirst (update when possible)
 * 5. External CDN → StaleWhileRevalidate (fonts, images)
 */

const customRuntimeCaching = [
  // ---- Tier 1: Static assets — CacheFirst (immutable, hashed filenames) ----
  {
    matcher: ({ url }: { url: URL }) =>
      url.pathname.match(/\.(js|css|woff2?|svg|png|ico)$/i) &&
      url.origin === self.location.origin,
    handler: new CacheFirst({
      cacheName: "static-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    }),
  },

  // ---- Tier 2: App shell — StaleWhileRevalidate (fast first paint) ----
  {
    matcher: ({ request }: { request: Request; url: URL }) =>
      request.destination === "document" &&
      request.url.startsWith(self.location.origin),
    handler: new StaleWhileRevalidate({
      cacheName: "app-shell",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    }),
  },

  // ---- Tier 3: Mining/Blockchain API — NetworkOnly (never cache) ----
  {
    matcher: ({ url }: { url: URL }) =>
      url.pathname.startsWith("/api/mining") ||
      url.pathname.startsWith("/api/blockchain") ||
      url.pathname.startsWith("/api/bitcoin") ||
      url.pathname.startsWith("/api/balance") ||
      url.pathname.startsWith("/api/claim") ||
      url.pathname.startsWith("/api/pouw"),
    handler: new NetworkOnly(),
  },

  // ---- Tier 4: Worker scripts — NetworkFirst (update when possible) ----
  {
    matcher: ({ url }: { url: URL }) => /worker.*\.js$/i.test(url.pathname),
    handler: new NetworkFirst({
      cacheName: "worker-scripts",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    }),
  },

  // ---- Tier 5: External resources — StaleWhileRevalidate ----
  {
    matcher: ({ url }: { url: URL }) =>
      url.origin !== self.location.origin &&
      (url.pathname.match(/\.(woff2?|png|svg|ico|js)$/i) ||
        url.hostname.includes("mempool.space") ||
        url.hostname.includes("charms.dev")),
    handler: new StaleWhileRevalidate({
      cacheName: "external-resources",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    }),
  },

  // ---- Default: Serwist's built-in strategies for everything else ----
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: customRuntimeCaching,
  precacheOptions: {
    // Ignore all query parameters (like ?tab=mining) to match "/" in precache
    ignoreURLParametersMatching: [/.*/],
  },
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
