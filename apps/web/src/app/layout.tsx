import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootProvider } from "@/providers";
import { RetroEffects } from "@/components/app/RetroEffects";

const SITE_TITLE = "BitcoinSparks";
const SITE_DESCRIPTION =
  "Raise your AI-powered pixel spark while mining Bitcoin. Proof of Useful Work meets Tamagotchi. Built on Bitcoin with Charms Protocol.";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bitcoinsparks.app";

export const metadata: Metadata = {
  title: {
    default: `${SITE_TITLE} | Mine Bitcoin While Your Spark Evolves`,
    template: `%s | ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "bitcoin",
    "mining",
    "nft",
    "ai",
    "tamagotchi",
    "pixel art",
    "web3",
    "bitcoin sparks",
    "proof of useful work",
    "charms protocol",
    "gamefi",
  ],
  authors: [{ name: "BitcoinSparks Team" }],
  creator: "BitcoinSparks",
  publisher: "BitcoinSparks",
  metadataBase: new URL(SITE_URL),

  // PWA configuration
  applicationName: SITE_TITLE,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_TITLE,
  },
  formatDetection: {
    telephone: false,
  },

  // OpenGraph
  openGraph: {
    title: SITE_TITLE,
    description: "Raise your AI-powered pixel spark. Mine Bitcoin. Watch it evolve.",
    type: "website",
    siteName: SITE_TITLE,
    locale: "en_US",
    images: [
      {
        url: "/icons/og-image.png",
        width: 1200,
        height: 630,
        alt: "BitcoinSparks — Raise Your Spark, Mine Bitcoin",
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Raise your AI-powered pixel spark. Mine Bitcoin. Watch it evolve.",
    images: ["/icons/og-image.png"],
  },

  // Icons
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192x192.svg",
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },

  // Verification (add your own tokens)
  // verification: {
  //   google: "your-google-site-verification-token",
  // },
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
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400;500;600;700&family=VT323&display=swap"
          rel="stylesheet"
        />

        {/* Canonical URL */}
        <link rel="canonical" href={SITE_URL} />

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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_TITLE,
              description: SITE_DESCRIPTION,
              applicationCategory: "GameApplication",
              operatingSystem: "Web, iOS, Android",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Organization",
                name: "BitcoinSparks",
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-pixel-bg-dark text-pixel-text antialiased">
        <RetroEffects />
        <RootProvider>
          <div className="safe-top">{children}</div>
        </RootProvider>
      </body>
    </html>
  );
}