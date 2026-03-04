/**
 * Help/FAQ Page
 *
 * Comprehensive help documentation for BitcoinBaby.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  pixelShadows,
  pixelBorders,
} from "@bitcoinbaby/ui";
import { useTutorialStore } from "@bitcoinbaby/core";
import { FAQItem, GlossaryItem, SocialLink, SectionNav } from "./components";
import {
  type HelpSection,
  SECTIONS,
  FAQS,
  GLOSSARY,
  SOCIAL_LINKS,
} from "./data";

export default function HelpPage() {
  const [activeSection, setActiveSection] =
    useState<HelpSection>("getting-started");
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());
  const [glossarySearch, setGlossarySearch] = useState("");
  const tutorialStore = useTutorialStore();

  const toggleFAQ = (question: string) => {
    setOpenFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(question)) {
        next.delete(question);
      } else {
        next.add(question);
      }
      return next;
    });
  };

  const handleRestartTutorial = () => {
    tutorialStore.resetTutorial();
    tutorialStore.startTutorial();
    window.location.href = "/";
  };

  const filteredGlossary = useMemo(
    () =>
      GLOSSARY.filter(
        (item) =>
          item.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
          item.definition.toLowerCase().includes(glossarySearch.toLowerCase()),
      ),
    [glossarySearch],
  );

  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-pixel text-xl text-pixel-primary">
              AYUDA & FAQ
            </h1>
            <p className="font-pixel-body text-sm text-pixel-text-muted mt-2">
              Todo lo que necesitas saber sobre BitcoinBaby
            </p>
          </div>
          <Link
            href="/"
            className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
          >
            ← VOLVER
          </Link>
        </header>

        {/* Restart Tutorial Card */}
        <Card className="mb-8 border-pixel-secondary">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎓</span>
              <div>
                <h3 className="font-pixel text-sm text-pixel-secondary">
                  Tutorial Interactivo
                </h3>
                <p className="font-pixel-body text-xs text-pixel-text-muted">
                  Revive el tutorial paso a paso
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestartTutorial}
            >
              VER TUTORIAL
            </Button>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          <SectionNav
            sections={SECTIONS}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          {/* Content Area */}
          <div
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6 ${pixelShadows.lg}`}
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-pixel-border">
              <span className="text-3xl">{currentSection?.icon}</span>
              <h2 className="font-pixel text-lg text-pixel-primary">
                {currentSection?.label.toUpperCase()}
              </h2>
            </div>

            {/* FAQ Content */}
            {activeSection !== "glossary" && (
              <div>
                {FAQS[activeSection].map((item) => (
                  <FAQItem
                    key={item.question}
                    item={item}
                    isOpen={openFAQs.has(item.question)}
                    onToggle={() => toggleFAQ(item.question)}
                  />
                ))}
              </div>
            )}

            {/* Glossary Content */}
            {activeSection === "glossary" && (
              <div>
                <input
                  type="text"
                  value={glossarySearch}
                  onChange={(e) => setGlossarySearch(e.target.value)}
                  placeholder="Buscar termino..."
                  className="w-full px-4 py-3 mb-6 font-pixel-body text-sm bg-pixel-bg-dark border-2 border-pixel-border text-pixel-text placeholder:text-pixel-text-muted focus:border-pixel-primary outline-none"
                />

                <dl className="space-y-0">
                  {filteredGlossary.map((item) => (
                    <GlossaryItem key={item.term} item={item} />
                  ))}
                </dl>

                {filteredGlossary.length === 0 && (
                  <p className="text-center py-8 font-pixel-body text-pixel-text-muted">
                    No se encontraron terminos para &quot;{glossarySearch}&quot;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contact Section */}
        <Card className="mt-8">
          <CardHeader>
            <h3 className="font-pixel text-sm text-pixel-primary">
              NECESITAS MAS AYUDA?
            </h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {SOCIAL_LINKS.map((link) => (
                <SocialLink key={link.label} {...link} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t-2 border-pixel-border text-center">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            BitcoinBaby v0.1.0 - Built on Bitcoin with Charms Protocol
          </p>
        </footer>
      </div>
    </main>
  );
}
