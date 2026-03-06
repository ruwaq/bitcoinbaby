"use client";

/**
 * MoreSection - Menu with additional options
 *
 * Links to: Settings, Help, Leaderboard, Cosmic Events, Characters, About
 * All links navigate to dedicated pages (no overlays).
 */

import { HelpTooltip } from "@bitcoinbaby/ui";
import {
  MenuButton,
  SocialCard,
  VersionInfo,
  MENU_ITEMS,
  SOCIAL_LINKS,
} from "./more";

export function MoreSection() {
  // All menu items navigate to dedicated pages
  const menuItems = MENU_ITEMS;

  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-2xl mx-auto">
        {/* Section Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <h2 className="font-pixel text-xl text-pixel-primary">MORE</h2>
            <HelpTooltip
              content="Access app settings, view leaderboards, explore cosmic events, and connect with the community."
              title="Menu"
              size="md"
            />
          </div>
          <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
            Settings, help, and community
          </p>
        </div>

        {/* Main Menu */}
        <div className="space-y-3 mb-8">
          {menuItems.map((item) => (
            <MenuButton key={item.id} item={item} />
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-1 bg-pixel-border" />
          <span className="font-pixel text-[8px] text-pixel-text-muted uppercase">
            Community
          </span>
          <div className="flex-1 h-1 bg-pixel-border" />
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SOCIAL_LINKS.map((item) => (
            <SocialCard key={item.id} item={item} />
          ))}
        </div>

        {/* Version Info */}
        <VersionInfo />
      </div>
    </div>
  );
}

export default MoreSection;
