/**
 * Technology Page
 *
 * Explains the innovative technology stack behind BitcoinBaby:
 * - Charms Protocol (tokens & NFT state)
 * - Scrolls API (signing & verification)
 * - Ordinals (visual NFTs)
 * - Proof of Useful Work
 * - Zero-Knowledge Proofs
 */

"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

interface TechCard {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  features: string[];
  link?: { label: string; url: string };
  highlight?: boolean;
}

const TECH_STACK: TechCard[] = [
  {
    id: "charms",
    title: "Charms Protocol",
    subtitle: "Tokens & Estado en Bitcoin",
    icon: "✨",
    description:
      "Charms es un metaprotocolo de BitcoinOS que permite crear tokens fungibles y NFTs con logica programable directamente en Bitcoin, sin bridges ni custodios.",
    features: [
      "Tokens nativos en Bitcoin (sin otra blockchain)",
      "Estado on-chain para NFTs (nivel, XP, stats)",
      "Verificacion client-side (sin indexador central)",
      "Zero-knowledge proofs para validacion",
      "Compatible con wallets Bitcoin estandar",
    ],
    link: { label: "Documentacion Charms", url: "https://docs.charms.dev" },
    highlight: true,
  },
  {
    id: "scrolls",
    title: "Scrolls API",
    subtitle: "Firma & Verificacion",
    icon: "📜",
    description:
      "Scrolls es el servicio de firma de transacciones para Charms. Permite crear transacciones con 'spells' (hechizos) que son verificados criptograficamente.",
    features: [
      "Co-firma de transacciones Charms",
      "Derivacion de direcciones deterministas",
      "Calculo automatico de fees",
      "Soporte mainnet y testnet4",
    ],
    link: { label: "Scrolls API", url: "https://scrolls.charms.dev" },
  },
  {
    id: "ordinals",
    title: "Ordinals",
    subtitle: "NFTs Visuales",
    icon: "🖼️",
    description:
      "Los Ordinals permiten inscribir datos permanentemente en Bitcoin. BitcoinBaby usa Ordinals para la capa visual de los Genesis Babies NFTs.",
    features: [
      "Imagenes generadas on-chain desde DNA",
      "Sprite library inscrita una sola vez",
      "Renderer HTML auto-contenido",
      "Visible en Magic Eden, Unisat, etc.",
    ],
    link: { label: "Ordinals Explorer", url: "https://ordinals.com" },
  },
  {
    id: "pouw",
    title: "Proof of Useful Work",
    subtitle: "Your Energy Trains AI",
    icon: "🧠",
    description:
      "Mining energy is NOT wasted on meaningless algorithms. BitcoinBaby is building a system where every hash contributes to training collective artificial intelligence. Your computing power has PURPOSE.",
    features: [
      "Mining that trains AI models",
      "Every hash contributes to collective model",
      "Cryptographic verification of work",
      "Fair rewards for real contribution",
      "System scalable to millions of users",
    ],
    link: { label: "AI Roadmap", url: "#ai-roadmap" },
    highlight: true,
  },
  {
    id: "zk",
    title: "Zero-Knowledge Proofs",
    subtitle: "Privacidad & Eficiencia",
    icon: "🔐",
    description:
      "Los ZK proofs permiten verificar transacciones sin revelar datos privados. Charms usa zkVMs para validacion recursiva de spells.",
    features: [
      "Groth16 proofs en witness data",
      "Verificacion local sin servidor",
      "Pruebas recursivas de dependencias",
      "Privacidad de datos de mineria",
    ],
  },
  {
    id: "taproot",
    title: "Bitcoin Taproot",
    subtitle: "Direcciones P2TR",
    icon: "🌳",
    description:
      "Taproot (BIP-341) es la actualizacion de Bitcoin que habilita scripts avanzados y mejor privacidad. BitcoinBaby usa direcciones P2TR exclusivamente.",
    features: [
      "Mejor privacidad en transacciones",
      "Fees mas bajos que legacy",
      "Soporte para scripts complejos",
      "Necesario para Charms/Ordinals",
    ],
  },
];

const ARCHITECTURE_LAYERS = [
  {
    layer: "Visual Layer",
    tech: "Ordinals",
    description: "Imagenes NFT visibles en explorers",
    color: "bg-purple-500",
  },
  {
    layer: "State Layer",
    tech: "Charms",
    description: "Nivel, XP, stats del baby",
    color: "bg-orange-500",
  },
  {
    layer: "Token Layer",
    tech: "Charms",
    description: "$BABTC fungible tokens",
    color: "bg-yellow-500",
  },
  {
    layer: "Signing Layer",
    tech: "Scrolls",
    description: "Co-firma de transacciones",
    color: "bg-blue-500",
  },
  {
    layer: "Base Layer",
    tech: "Bitcoin",
    description: "Seguridad y settlement final",
    color: "bg-green-500",
  },
];

function TechCardComponent({ card }: { card: TechCard }) {
  return (
    <div
      className={clsx(
        "p-6 border-4",
        `bg-pixel-bg-medium ${pixelShadows.lg}`,
        card.highlight ? "border-pixel-primary" : "border-pixel-border",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 flex items-center justify-center bg-pixel-bg-dark border-2 border-black text-3xl">
          {card.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-pixel text-sm text-pixel-primary">
            {card.title}
          </h3>
          <p className="font-pixel text-[8px] text-pixel-text-muted uppercase mt-1">
            {card.subtitle}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="font-pixel-body text-sm text-pixel-text-muted mb-4 leading-relaxed">
        {card.description}
      </p>

      {/* Features */}
      <ul className="space-y-2 mb-4">
        {card.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-pixel-secondary font-pixel text-[8px]">
              ▸
            </span>
            <span className="font-pixel-body text-xs text-pixel-text">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* Link */}
      {card.link && (
        <a
          href={card.link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-pixel-bg-dark border-2 border-pixel-border font-pixel text-[8px] text-pixel-text hover:border-pixel-primary transition-colors"
        >
          {card.link.label} →
        </a>
      )}
    </div>
  );
}

export default function TechnologyPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-pixel text-xl text-pixel-primary">
                TECNOLOGIA
              </h1>
              <p className="font-pixel-body text-sm text-pixel-text-muted mt-2">
                Stack tecnologico innovador de BitcoinBaby
              </p>
            </div>
            <Link
              href="/"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
            >
              ← VOLVER
            </Link>
          </div>
        </header>

        {/* AI Hero Banner */}
        <div
          className={`mb-8 p-8 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-4 border-purple-500 ${pixelShadows.lg}`}
        >
          <div className="text-center">
            <div className="text-5xl mb-4">🧠</div>
            <h2 className="font-pixel text-lg text-purple-400 mb-4">
              MINING THAT TRAINS ARTIFICIAL INTELLIGENCE
            </h2>
            <p className="font-pixel-body text-sm text-pixel-text max-w-2xl mx-auto mb-4">
              BitcoinBaby does not waste energy on meaningless algorithms. We
              are building a system where{" "}
              <span className="text-purple-400 font-semibold">
                your computing power trains a collective AI
              </span>
              . Every hash has purpose.
            </p>
            <div className="flex justify-center gap-4 mb-4">
              <div className="px-4 py-2 bg-pixel-bg-dark border-2 border-purple-500/50 rounded">
                <p className="font-pixel text-[8px] text-purple-400">PHASE 1</p>
                <p className="font-pixel-body text-xs text-pixel-text">
                  Traditional Mining
                </p>
              </div>
              <div className="font-pixel text-pixel-text-muted self-center">
                →
              </div>
              <div className="px-4 py-2 bg-purple-500/20 border-2 border-purple-500 rounded">
                <p className="font-pixel text-[8px] text-purple-400">PHASE 2</p>
                <p className="font-pixel-body text-xs text-pixel-text">
                  AI Training
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bitcoin Native Banner */}
        <div
          className={`mb-12 p-8 bg-gradient-to-r from-pixel-primary/20 to-pixel-secondary/20 ${pixelBorders.accent} ${pixelShadows.lg}`}
        >
          <div className="text-center">
            <h2 className="font-pixel text-lg text-pixel-primary mb-4">
              100% NATIVO EN BITCOIN
            </h2>
            <p className="font-pixel-body text-sm text-pixel-text max-w-2xl mx-auto mb-6">
              BitcoinBaby es el primer juego que combina Ordinals (visual) +
              Charms (estado) + Proof of Useful Work en una experiencia
              unificada. Sin bridges, sin custodios, sin otras blockchains.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a
                href="https://explorer.charms.dev"
                target="_blank"
                rel="noopener noreferrer"
                className={`px-6 py-3 bg-pixel-primary text-pixel-text-dark font-pixel text-xs border-2 border-black ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
              >
                VER EN CHARMS EXPLORER
              </a>
              <a
                href="https://ordinals.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`px-6 py-3 bg-pixel-bg-medium text-pixel-text font-pixel text-xs border-2 border-black ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
              >
                VER EN ORDINALS
              </a>
            </div>
          </div>
        </div>

        {/* Architecture Visualization */}
        <div className="mb-12">
          <h2 className="font-pixel text-sm text-pixel-secondary mb-6">
            ARQUITECTURA DE CAPAS
          </h2>
          <div
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6 ${pixelShadows.lg}`}
          >
            <div className="space-y-3">
              {ARCHITECTURE_LAYERS.map((layer, i) => (
                <div
                  key={layer.layer}
                  className="flex items-center gap-4"
                  style={{ paddingLeft: `${i * 20}px` }}
                >
                  <div
                    className={clsx(
                      "w-4 h-4 border-2 border-black",
                      layer.color,
                    )}
                  />
                  <div className="flex-1 flex items-center gap-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
                    <span className="font-pixel text-[10px] text-pixel-text w-28">
                      {layer.layer}
                    </span>
                    <span className="font-pixel text-[8px] text-pixel-primary w-20">
                      {layer.tech}
                    </span>
                    <span className="font-pixel-body text-xs text-pixel-text-muted flex-1">
                      {layer.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t-2 border-pixel-border text-center">
              <p className="font-pixel text-[8px] text-pixel-text-muted">
                Todo verificable en la blockchain de Bitcoin
              </p>
            </div>
          </div>
        </div>

        {/* Technology Cards */}
        <div className="mb-12">
          <h2 className="font-pixel text-sm text-pixel-secondary mb-6">
            STACK TECNOLOGICO
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TECH_STACK.map((card) => (
              <TechCardComponent key={card.id} card={card} />
            ))}
          </div>
        </div>

        {/* Innovation Section */}
        <div className="mb-12">
          <h2 className="font-pixel text-sm text-pixel-secondary mb-6">
            INNOVACIONES CLAVE
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Dual Layer NFTs */}
            <div
              className={`p-6 bg-pixel-bg-medium ${pixelBorders.medium} ${pixelShadows.lg}`}
            >
              <h3 className="font-pixel text-sm text-pixel-secondary mb-4">
                NFTs DUAL-LAYER
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
                  <span className="text-2xl">🖼️</span>
                  <div>
                    <p className="font-pixel text-[10px] text-pixel-text">
                      Ordinals
                    </p>
                    <p className="font-pixel-body text-xs text-pixel-text-muted">
                      Imagen generada desde DNA (visual)
                    </p>
                  </div>
                </div>
                <div className="text-center font-pixel text-pixel-text-muted">
                  +
                </div>
                <div className="flex items-center gap-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
                  <span className="text-2xl">✨</span>
                  <div>
                    <p className="font-pixel text-[10px] text-pixel-text">
                      Charms
                    </p>
                    <p className="font-pixel-body text-xs text-pixel-text-muted">
                      Estado del juego (nivel, XP, stats)
                    </p>
                  </div>
                </div>
                <div className="text-center font-pixel text-pixel-text-muted">
                  =
                </div>
                <div className="flex items-center gap-4 p-3 bg-pixel-primary/20 border-2 border-pixel-primary">
                  <span className="text-2xl">👶</span>
                  <div>
                    <p className="font-pixel text-[10px] text-pixel-primary">
                      Genesis Baby
                    </p>
                    <p className="font-pixel-body text-xs text-pixel-text">
                      NFT completo con visual + estado
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mining Flow */}
            <div
              className={`p-6 bg-pixel-bg-medium ${pixelBorders.accent} ${pixelShadows.lg}`}
            >
              <h3 className="font-pixel text-sm text-pixel-primary mb-4">
                FLUJO DE MINERIA V10
              </h3>
              <div className="space-y-3">
                {[
                  { step: 1, text: "Miner crea hash SHA-256", icon: "⛏️" },
                  { step: 2, text: "Construye TX con OP_RETURN", icon: "📝" },
                  {
                    step: 3,
                    text: "Broadcast y espera confirmacion",
                    icon: "📡",
                  },
                  {
                    step: 4,
                    text: "Obtiene Merkle proof de inclusion",
                    icon: "🌳",
                  },
                  {
                    step: 5,
                    text: "Crea Spell con private_inputs",
                    icon: "✨",
                  },
                  { step: 6, text: "Scrolls co-firma transaccion", icon: "📜" },
                  { step: 7, text: "Mint de $BABTC tokens", icon: "🪙" },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex items-center gap-3 p-2 bg-pixel-bg-dark border border-pixel-border"
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-pixel-primary text-pixel-text-dark font-pixel text-[8px]">
                      {item.step}
                    </span>
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-pixel-body text-xs text-pixel-text">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* External Links */}
        <div className="grid md:grid-cols-4 gap-4">
          {[
            {
              label: "Charms Docs",
              url: "https://docs.charms.dev",
              icon: "📚",
            },
            {
              label: "Charms Explorer",
              url: "https://explorer.charms.dev",
              icon: "🔍",
            },
            {
              label: "Scrolls API",
              url: "https://scrolls.charms.dev",
              icon: "📜",
            },
            {
              label: "BitcoinOS Blog",
              url: "https://blog.bitcoinos.build",
              icon: "📰",
            },
          ].map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-4 bg-pixel-bg-medium ${pixelBorders.medium} ${pixelShadows.md} hover:border-pixel-primary hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
            >
              <span className="text-2xl">{link.icon}</span>
              <span className="font-pixel text-[10px] text-pixel-text">
                {link.label}
              </span>
            </a>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t-2 border-pixel-border text-center">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            BitcoinBaby - Innovacion nativa en Bitcoin
          </p>
        </footer>
      </div>
    </main>
  );
}
