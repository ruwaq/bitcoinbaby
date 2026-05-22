"use client";

/**
 * Send Page Redirection
 *
 * Redirects legacy /wallet/send path to SPA dashboard at /?tab=wallet&view=send
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SendPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?tab=wallet&view=send");
  }, [router]);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-pixel-primary border-t-transparent animate-spin" />
        <p className="font-pixel text-pixel-xs text-pixel-text-muted">
          REDIRECTING TO WALLET...
        </p>
      </div>
    </main>
  );
}
