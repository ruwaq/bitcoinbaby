"use client";

/**
 * RootProvider - Wrapper para hydration de Zustand stores y Capacitor
 *
 * Asegura que los stores de Zustand se hidraten correctamente
 * en el cliente y provee contexto global para la app.
 * También inicializa Capacitor para apps nativas.
 */

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePlatform } from "@/hooks";
import { MiningProvider } from "./MiningProvider";
import { QueryProvider } from "./QueryProvider";
import { AppInitializer } from "./AppInitializer";
import { usePendingTxStore, cleanupStuckTransactions } from "@bitcoinbaby/core";
import { OverlayManager } from "@/components/overlays/OverlayManager";

interface RootProviderProps {
  children: ReactNode;
}

/**
 * RootProvider Component
 *
 * Handles Zustand store hydration, Capacitor initialization,
 * and provides global context.
 */
export function RootProvider({ children }: RootProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCapacitorReady, setIsCapacitorReady] = useState(false);
  const platform = usePlatform();

  // Get pending tx store actions
  const startTracking = usePendingTxStore((s) => s.startTracking);
  const isTracking = usePendingTxStore((s) => s.isTracking);

  // Wait for hydration to complete
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Start transaction tracking after hydration
  // This ensures pending transactions from localStorage are polled for confirmations
  useEffect(() => {
    if (isHydrated && !isTracking) {
      // Cleanup old stuck transactions (> 24 hours)
      const cleaned = cleanupStuckTransactions(24);
      if (cleaned > 0) {
        console.log(`[RootProvider] Cleaned up ${cleaned} stuck transactions`);
      }

      console.log("[RootProvider] Starting transaction tracker");
      startTracking();
    }
  }, [isHydrated, isTracking, startTracking]);

  // Initialize Capacitor (only for native apps)
  useEffect(() => {
    async function initCapacitor() {
      // If not using Capacitor or running in web, skip
      if (!platform.isReady) return;

      if (!platform.isCapacitor || !platform.isNative) {
        setIsCapacitorReady(true);
        return;
      }

      try {
        // Configure StatusBar
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0f0f1b" });

        // Hide SplashScreen after a short delay
        const { SplashScreen } = await import("@capacitor/splash-screen");
        setTimeout(async () => {
          await SplashScreen.hide();
        }, 500);

        setIsCapacitorReady(true);
      } catch {
        // Capacitor plugins not available, continue anyway
        setIsCapacitorReady(true);
      }
    }

    if (platform.isReady) {
      initCapacitor();
    }
  }, [platform.isReady, platform.isCapacitor, platform.isNative]);

  // Determine if we should show loading state
  const isLoading = !isHydrated || (platform.isNative && !isCapacitorReady);

  // Loading state during hydration and Capacitor init
  if (isLoading) {
    return (
      <div className="min-h-screen bg-pixel-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pixel-float">&#128118;</div>
          <div className="font-pixel text-pixel-primary text-xs animate-pulse">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <AppInitializer />
      <MiningProvider>
        {children}
        <OverlayManager />
      </MiningProvider>
    </QueryProvider>
  );
}

/**
 * Hook to check if hydration is complete
 * Useful for components that need to wait for store data
 *
 * Uses useSyncExternalStore for proper hydration detection
 * without triggering cascading renders.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function subscribeToNothing(_callback: () => void): () => void {
  // No external subscription needed for hydration
  return () => {};
}

function getHydrationSnapshot(): boolean {
  return true; // Client always returns true
}

function getHydrationServerSnapshot(): boolean {
  return false; // Server always returns false
}

export function useHydration(): boolean {
  // Use useSyncExternalStore to avoid setState-in-effect issues
  // This properly handles the server/client hydration boundary
  return useSyncExternalStore(
    subscribeToNothing,
    getHydrationSnapshot,
    getHydrationServerSnapshot,
  );
}

export default RootProvider;
