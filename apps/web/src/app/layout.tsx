import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RootProvider } from "@/providers";
import { RetroEffects } from "@/components/app/RetroEffects";

// Pixel Art Fonts — loaded LOCALLY so they work offline
// Font files are in src/fonts/ (copied from next/font/google cache)
// Press Start 2P — the main pixel display font
const pressStart2P = localFont({
  src: [
    {
      path: "../../src/fonts/dbbdd2d89d2ef0ef-s.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/a06229eb79a83cfc-s.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/c9e224327ce7933e-s.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/d85064eaed4b8683-s.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/db234bd00cda6a96-s.p.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-pixel",
  preload: true,
});

// Pixelify Sans — body text font
const pixelifySans = localFont({
  src: [
    {
      path: "../../src/fonts/aaf0e744731a46d3-s.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/751eccb0decf5e18-s.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/b7bd7951037de757-s.p.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/f6590a0f07a97750-s.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-pixel-body",
  preload: true,
});

// VT323 — monospace terminal font
const vt323 = localFont({
  src: [
    {
      path: "../../src/fonts/c565b14407d34fed-s.p.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../src/fonts/9cb204d1bfdb6539-s.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-vt323",
  preload: true,
});

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
    <html
      lang="en"
      className={`${pressStart2P.variable} ${pixelifySans.variable} ${vt323.variable}`}
    >
      <head>
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
