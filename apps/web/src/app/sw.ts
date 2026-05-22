import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Custom runtime caching that explicitly excludes mining-related requests
// Mining should ALWAYS work online only - never cached
const customRuntimeCaching = [
  // Mining API calls - NEVER cache (must be online)
  {
    matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/mining"),
    handler: new NetworkOnly(),
  },
  // Blockchain/Bitcoin API calls - NEVER cache (must be online)
  {
    matcher: ({ url }: { url: URL }) =>
      url.pathname.startsWith("/api/blockchain") ||
      url.pathname.startsWith("/api/bitcoin"),
    handler: new NetworkOnly(),
  },
  // Worker scripts - network first with short cache
  {
    matcher: ({ url }: { url: URL }) => /worker.*\.js$/i.test(url.pathname),
    handler: new NetworkFirst({
      cacheName: "worker-scripts",
    }),
  },
  // Use default caching for everything else
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
