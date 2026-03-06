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
    id: "charms",
    label: "Charms Protocol",
    description: "Bitcoin smart contracts",
    icon: "🔮",
    href: "https://charms.dev",
    external: true,
  },
  {
    id: "explorer",
    label: "Charms Explorer",
    description: "View tokens on-chain",
    icon: "🔍",
    href: "https://explorer.charms.dev",
    external: true,
  },
  {
    id: "mempool",
    label: "Mempool",
    description: "Bitcoin testnet4 explorer",
    icon: "📊",
    href: "https://mempool.space/testnet4",
    external: true,
  },
];
