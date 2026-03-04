/**
 * MoreSection Data
 *
 * Menu items and social links configuration.
 */

export interface MenuItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  href: string;
  external?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "technology",
    label: "AI & Technology",
    description: "Proof of Useful Work - Mining that trains AI",
    icon: "🧠",
    href: "/technology",
    highlight: true,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Mining, network, display preferences",
    icon: "⚙️",
    href: "/settings",
  },
  {
    id: "cosmic",
    label: "Cosmic Events",
    description: "Dynamic world events and bonuses",
    icon: "🌌",
    href: "/cosmic",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "Top miners and rankings",
    icon: "🏆",
    href: "/leaderboard",
  },
  {
    id: "characters",
    label: "Characters",
    description: "View all baby sprites and stages",
    icon: "👾",
    href: "/characters",
  },
  {
    id: "help",
    label: "Help & Guide",
    description: "How to play BitcoinBaby",
    icon: "❓",
    href: "/help",
  },
];

export const SOCIAL_LINKS: MenuItem[] = [
  {
    id: "github",
    label: "GitHub",
    description: "View source code",
    icon: "📂",
    href: "https://github.com/bitcoinbaby/bitcoinbaby",
    external: true,
  },
  {
    id: "discord",
    label: "Discord",
    description: "Join our community",
    icon: "💬",
    href: "https://discord.gg/bitcoinbaby",
    external: true,
  },
  {
    id: "docs",
    label: "Documentation",
    description: "Technical docs",
    icon: "📚",
    href: "https://docs.bitcoinbaby.io",
    external: true,
  },
];
