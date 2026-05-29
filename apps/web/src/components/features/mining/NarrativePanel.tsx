"use client";

/**
 * NarrativePanel — Speech bubble overlay showing the baby's latest story event.
 *
 * Appears during mining sessions when a new narrative event is generated.
 * 8-bit pixel art aesthetic with typewriter text reveal effect.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useNarrativeStore } from "@bitcoinbaby/core";
import type { NarrativeEvent, NarrativeEventType } from "@bitcoinbaby/ai";

// =============================================================================
// EVENT TYPE ICONS (8-bit ASCII art)
// =============================================================================

const EVENT_ICONS: Record<NarrativeEventType, string> = {
  LORE: "📖",
  DISCOVERY: "💡",
  TECHNICAL: "🔧",
  SOCIAL: "💬",
  MYSTICAL: "✨",
  EVOLUTION: "⚡",
};

const EVENT_COLORS: Record<NarrativeEventType, string> = {
  LORE: "#f7931a",
  DISCOVERY: "#4ade80",
  TECHNICAL: "#4fc3f7",
  SOCIAL: "#ffc107",
  MYSTICAL: "#c084fc",
  EVOLUTION: "#facc15",
};

// =============================================================================
// TYPEWRITER
// =============================================================================

function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    if (!text) return;

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface NarrativePanelProps {
  tokenId: number | null;
  /** Latest event to display (passed from mining hook) */
  latestEvent?: NarrativeEvent | null;
  /** RLHF callback when user votes on narrative direction */
  onVote?: (eventId: string, choice: "A" | "B") => void;
}

export function NarrativePanel({
  tokenId,
  latestEvent,
  onVote,
}: NarrativePanelProps) {
  const [visible, setVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<NarrativeEvent | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track event count for display (read-only, stable primitive)
  const _eventCount =
    tokenId !== null
      ? useNarrativeStore((s) => {
          const st = s.states[tokenId];
          return st ? st.events.length : 0;
        })
      : 0;
  void _eventCount; // used for reactive re-render when new events arrive

  // Show event when latestEvent changes
  const showEvent = useCallback((event: NarrativeEvent) => {
    setCurrentEvent(event);
    setVisible(true);

    // Auto-dismiss after 15 seconds
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setVisible(false);
    }, 15_000);
  }, []);

  useEffect(() => {
    if (latestEvent) {
      showEvent(latestEvent);
    }
  }, [latestEvent, showEvent]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const event = currentEvent;
  const displayedTitle = useTypewriter(event?.title ?? "", 40);
  const displayedDesc = useTypewriter(event?.description ?? "", 25);

  if (!visible || !event) return null;

  const accentColor = EVENT_COLORS[event.type] ?? "#f7931a";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 480,
        margin: "12px auto 0",
        padding: "12px 16px",
        background: "#1a1a2e",
        border: `4px solid ${accentColor}`,
        boxShadow: `4px 4px 0 0 #000`,
        imageRendering: "pixelated",
        fontFamily: "'Pixelify Sans', sans-serif",
        color: "#fff",
        animation: "fadeInUp 0.3s steps(6)",
      }}
      onClick={() => setVisible(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setVisible(false);
      }}
    >
      {/* Dismiss hint */}
      <span
        style={{
          position: "absolute",
          top: 4,
          right: 8,
          fontSize: 10,
          color: "#9ca3af",
          fontFamily: "'Press Start 2P', monospace",
        }}
      >
        [X]
      </span>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>{EVENT_ICONS[event.type]}</span>
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 8,
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {event.type}
        </span>
        <span
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 10,
            color: "#9ca3af",
            marginLeft: "auto",
          }}
        >
          +{Object.values(event.traitImpacts).reduce((a, b) => a + (b ?? 0), 0)}{" "}
          traits
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
          lineHeight: 1.6,
          color: "#fff",
          marginBottom: 6,
          minHeight: 16,
        }}
      >
        {displayedTitle}
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 10,
            background: accentColor,
            marginLeft: 2,
            animation: "blink 1s steps(2) infinite",
          }}
        />
      </div>

      {/* Description */}
      <div
        style={{
          fontFamily: "'Pixelify Sans', sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          color: "#e5e7eb",
          minHeight: 44,
        }}
      >
        {displayedDesc || " "}
      </div>

      {/* RLHF Vote Buttons */}
      {onVote && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            justifyContent: "center",
            borderTop: "2px solid #374151",
            paddingTop: 8,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(event.id, "A");
            }}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              padding: "6px 16px",
              background: "#1a1a2e",
              color: "#4ade80",
              border: "2px solid #4ade80",
              cursor: "pointer",
              imageRendering: "pixelated",
            }}
          >
            [A] LIKE
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(event.id, "B");
            }}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              padding: "6px 16px",
              background: "#1a1a2e",
              color: "#f7931a",
              border: "2px solid #f7931a",
              cursor: "pointer",
              imageRendering: "pixelated",
            }}
          >
            [B] MEH
          </button>
        </div>
      )}

      {/* Footer: model badge */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: 10,
            color: "#6b7280",
            background: "#0f0f1b",
            padding: "2px 6px",
            border: "2px solid #374151",
          }}
        >
          {event.modelUsed}
        </span>
      </div>

      {/* CSS animations injected once */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
