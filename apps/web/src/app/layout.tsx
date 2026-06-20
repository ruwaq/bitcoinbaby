import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootProvider } from "@/providers";
import { RetroEffects } from "@/components/app/RetroEffects";

export const metadata: Metadata = {
  title: "BitcoinBaby | Mine Bitcoin While Your Baby Evolves",
  description:
    "Raise your AI-powered pixel baby that grows with Bitcoin mining. Built on BitcoinOS with Charms Protocol.",
  keywords: [
    "bitcoin",
    "mining",
    "nft",
    "ai",
    "tamagotchi",
    "pixel art",
    "web3",
  ],
  authors: [{ name: "BitcoinBaby Team" }],
  // PWA configuration
  applicationName: "BitcoinBaby",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BitcoinBaby",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "BitcoinBaby",
    description: "Mine Bitcoin. Raise Your Baby. Watch It Evolve.",
    type: "website",
    siteName: "BitcoinBaby",
  },
  twitter: {
    card: "summary_large_image",
    title: "BitcoinBaby",
    description: "Mine Bitcoin. Raise Your Baby. Watch It Evolve.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f0f1b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400;500;600;700&family=VT323&display=swap" rel="stylesheet" />
        
        {/* PWA Icons */}
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/icons/icon-152x152.svg"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/icon-192x192.svg"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/icons/icon-192x192.svg"
        />
        {/* Apple splash screens would go here */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-pixel-bg-dark text-pixel-text antialiased">
        <RetroEffects />
        <RootProvider>
          {/* Main content with safe areas */}
          <div className="safe-top">{children}</div>
        </RootProvider>
      </body>
    </html>
  );
}
