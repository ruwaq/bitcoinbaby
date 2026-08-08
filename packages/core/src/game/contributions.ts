/**
 * Community Contributions System
 *
 * Inspired by eCash's developer reward model (Coinbase Rule).
 * Rewards community members for contributing to the project.
 */

import { CONTRIBUTION_REWARDS } from "./tokenomics";

/**
 * Contribution types
 */
export type ContributionType =
  | "bug_report_minor"
  | "bug_report_major"
  | "bug_report_critical"
  | "feature_suggestion"
  | "community_content"
  | "referral";

/**
 * Contribution status
 */
export type ContributionStatus =
  | "pending" // Submitted, awaiting review
  | "approved" // Approved, reward pending
  | "rewarded" // Reward distributed
  | "rejected"; // Not eligible for reward

/**
 * A contribution record
 */
export interface Contribution {
  id: string;
  type: ContributionType;
  title: string;
  description: string;
  submittedBy: string; // wallet address
  submittedAt: number;
  status: ContributionStatus;
  reward: bigint;
  reviewedAt?: number;
  reviewedBy?: string;
  txHash?: string; // reward transaction hash
}

/**
 * Referral record
 */
export interface Referral {
  referrerAddress: string;
  referredAddress: string;
  createdAt: number;
  isActive: boolean; // referred user is still playing
  rewardClaimed: boolean;
}

/**
 * Contribution summary for a user
 */
export interface ContributorSummary {
  totalContributions: number;
  approvedContributions: number;
  totalRewardsEarned: bigint;
  pendingRewards: bigint;
  referralCount: number;
  contributorLevel: ContributorLevel;
  badges: ContributorBadge[];
}

/**
 * Contributor levels (based on total contributions)
 */
export type ContributorLevel =
  | "newcomer" // 0 contributions
  | "helper" // 1-4 contributions
  | "contributor" // 5-14 contributions
  | "champion" // 15-29 contributions
  | "legend"; // 30+ contributions

/**
 * Special badges for achievements
 */
export type ContributorBadge =
  | "first_contribution"
  | "bug_hunter" // 5+ bug reports approved
  | "idea_machine" // 3+ feature suggestions approved
  | "content_creator" // 5+ content pieces
  | "referral_master" // 10+ referrals
  | "early_contributor" // Contributed in first month
  | "critical_finder"; // Found a critical bug

/**
 * Get reward amount for contribution type
 */
export function getContributionReward(type: ContributionType): bigint {
  switch (type) {
    case "bug_report_minor":
      return BigInt(CONTRIBUTION_REWARDS.BUG_REPORT.minor);
    case "bug_report_major":
      return BigInt(CONTRIBUTION_REWARDS.BUG_REPORT.major);
    case "bug_report_critical":
      return BigInt(CONTRIBUTION_REWARDS.BUG_REPORT.critical);
    case "feature_suggestion":
      return BigInt(CONTRIBUTION_REWARDS.FEATURE_SUGGESTION);
    case "community_content":
      return BigInt(CONTRIBUTION_REWARDS.COMMUNITY_CONTENT);
    case "referral":
      return BigInt(CONTRIBUTION_REWARDS.REFERRAL_BONUS);
    default:
      return BigInt(0);
  }
}

/**
 * Get contributor level based on approved contributions
 */
export function getContributorLevel(approvedCount: number): ContributorLevel {
  if (approvedCount >= 30) return "legend";
  if (approvedCount >= 15) return "champion";
  if (approvedCount >= 5) return "contributor";
  if (approvedCount >= 1) return "helper";
  return "newcomer";
}

/**
 * Get level display name
 */
export function getLevelDisplayName(level: ContributorLevel): string {
  const names: Record<ContributorLevel, string> = {
    newcomer: "Novato",
    helper: "Ayudante",
    contributor: "Contribuidor",
    champion: "Campeón",
    legend: "Leyenda",
  };
  return names[level];
}

/**
 * Get badge display info
 */
export function getBadgeInfo(badge: ContributorBadge): {
  name: string;
  description: string;
  icon: string;
} {
  const badges: Record<
    ContributorBadge,
    { name: string; description: string; icon: string }
  > = {
    first_contribution: {
      name: "Primera Contribución",
      description: "Hiciste tu primera contribución al proyecto",
      icon: "🌟",
    },
    bug_hunter: {
      name: "Cazador de Bugs",
      description: "Reportaste 5+ bugs que fueron corregidos",
      icon: "🐛",
    },
    idea_machine: {
      name: "Máquina de Ideas",
      description: "3+ de tus sugerencias fueron implementadas",
      icon: "💡",
    },
    content_creator: {
      name: "Creador de Contenido",
      description: "Creaste 5+ piezas de contenido para la comunidad",
      icon: "📝",
    },
    referral_master: {
      name: "Maestro Referidor",
      description: "Trajiste 10+ nuevos jugadores al juego",
      icon: "🤝",
    },
    early_contributor: {
      name: "Contribuidor Temprano",
      description: "Contribuiste durante el primer mes del proyecto",
      icon: "🏆",
    },
    critical_finder: {
      name: "Encontrador Crítico",
      description: "Encontraste un bug crítico de seguridad",
      icon: "🛡️",
    },
  };
  return badges[badge];
}

/**
 * Create a new contribution
 */
export function createContribution(
  type: ContributionType,
  title: string,
  description: string,
  submittedBy: string,
): Contribution {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    description,
    submittedBy,
    submittedAt: Date.now(),
    status: "pending",
    reward: getContributionReward(type),
  };
}

/**
 * Calculate badges for a contributor
 */
export function calculateBadges(
  contributions: Contribution[],
  referralCount: number,
  projectStartDate: number,
): ContributorBadge[] {
  const badges: ContributorBadge[] = [];
  const approved = contributions.filter(
    (c) => c.status === "approved" || c.status === "rewarded",
  );

  // First contribution
  if (approved.length >= 1) {
    badges.push("first_contribution");
  }

  // Bug hunter - 5+ bug reports
  const bugReports = approved.filter((c) => c.type.startsWith("bug_report_"));
  if (bugReports.length >= 5) {
    badges.push("bug_hunter");
  }

  // Critical finder
  const criticalBugs = approved.filter((c) => c.type === "bug_report_critical");
  if (criticalBugs.length >= 1) {
    badges.push("critical_finder");
  }

  // Idea machine - 3+ feature suggestions
  const features = approved.filter((c) => c.type === "feature_suggestion");
  if (features.length >= 3) {
    badges.push("idea_machine");
  }

  // Content creator - 5+ content pieces
  const content = approved.filter((c) => c.type === "community_content");
  if (content.length >= 5) {
    badges.push("content_creator");
  }

  // Referral master - 10+ referrals
  if (referralCount >= 10) {
    badges.push("referral_master");
  }

  // Early contributor - first month
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  const firstContribution = contributions[0];
  if (
    firstContribution &&
    firstContribution.submittedAt - projectStartDate < oneMonth
  ) {
    badges.push("early_contributor");
  }

  return badges;
}

/**
 * Calculate contributor summary
 */
export function calculateContributorSummary(
  contributions: Contribution[],
  referralCount: number,
  projectStartDate: number,
): ContributorSummary {
  const approved = contributions.filter(
    (c) => c.status === "approved" || c.status === "rewarded",
  );

  const totalRewardsEarned = contributions
    .filter((c) => c.status === "rewarded")
    .reduce((sum, c) => sum + c.reward, BigInt(0));

  const pendingRewards = contributions
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + c.reward, BigInt(0));

  return {
    totalContributions: contributions.length,
    approvedContributions: approved.length,
    totalRewardsEarned,
    pendingRewards,
    referralCount,
    contributorLevel: getContributorLevel(approved.length),
    badges: calculateBadges(contributions, referralCount, projectStartDate),
  };
}

/**
 * Validate contribution submission
 */
export function validateContribution(
  type: ContributionType,
  title: string,
  description: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!title || title.trim().length < 5) {
    errors.push("El título debe tener al menos 5 caracteres");
  }

  if (!description || description.trim().length < 20) {
    errors.push("La descripción debe tener al menos 20 caracteres");
  }

  if (title && title.length > 100) {
    errors.push("El título no puede exceder 100 caracteres");
  }

  if (description && description.length > 2000) {
    errors.push("La descripción no puede exceder 2000 caracteres");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
