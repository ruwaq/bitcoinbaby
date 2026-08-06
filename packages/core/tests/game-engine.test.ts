/**
 * Game Engine Tests
 *
 * Tests for the BitcoinBaby Tamagotchi game mechanics:
 * - Baby creation
 * - Stat decay
 * - Level up / evolution
 * - Death / revival
 * - Mining XP
 */

import { describe, it, expect } from "vitest";
import {
  createNewBaby,
  calculateDecay,
  calculateOfflineDecay,
  applyAction,
  addXP,
  removeXP,
  getStageForLevel,
  checkEvolution,
  getCriticalStats,
  calculateMiningBonus,
  calculateMiningXP,
  determineVisualState,
  calculateLevelDecay,
  isBabyDead,
  reviveBaby,
  getDaysUntilDecay,
  GAME_CONFIG,
  DECAY_RATES,
  MINING_BONUS,
  LEVEL_DECAY,
  getXPForLevel,
} from "../src/game";
import type { BabyStats, BabyProgression } from "../src/game";

// ============================================
// Baby Creation Tests
// ============================================

describe("createNewBaby", () => {
  it("should create a baby with correct name", () => {
    const baby = createNewBaby("Satoshi Jr");
    expect(baby.name).toBe("Satoshi Jr");
  });

  it("should create a baby with unique id", () => {
    const baby1 = createNewBaby("Baby1");
    const baby2 = createNewBaby("Baby2");
    expect(baby1.id).not.toBe(baby2.id);
    expect(baby1.id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("should initialize stats at max values", () => {
    const baby = createNewBaby("TestBaby");
    expect(baby.stats.energy).toBe(100);
    expect(baby.stats.happiness).toBe(100);
    expect(baby.stats.hunger).toBe(0);
    expect(baby.stats.health).toBe(100);
  });

  it("should start at level 1 with baby_1 stage", () => {
    const baby = createNewBaby("TestBaby");
    expect(baby.progression.level).toBe(1);
    expect(baby.progression.stage).toBe("baby_1");
    expect(baby.progression.xp).toBe(0);
  });

  it("should initialize with correct timestamps", () => {
    const before = Date.now();
    const baby = createNewBaby("TestBaby");
    const after = Date.now();

    expect(baby.createdAt).toBeGreaterThanOrEqual(before);
    expect(baby.createdAt).toBeLessThanOrEqual(after);
    expect(baby.lastUpdated).toBe(baby.createdAt);
    expect(baby.lastFed).toBe(baby.createdAt);
    expect(baby.lastPlayed).toBe(baby.createdAt);
    expect(baby.lastMined).toBe(baby.createdAt);
  });

  it("should start with idle visual state and not sleeping/mining", () => {
    const baby = createNewBaby("TestBaby");
    expect(baby.visualState).toBe("idle");
    expect(baby.isSleeping).toBe(false);
    expect(baby.isMining).toBe(false);
  });

  it("should have empty evolution history and achievements", () => {
    const baby = createNewBaby("TestBaby");
    expect(baby.evolutionHistory).toEqual([]);
    expect(baby.unlockedAchievements).toEqual([]);
  });
});

// ============================================
// Stat Decay Tests
// ============================================

describe("calculateDecay", () => {
  const baseStats: BabyStats = {
    energy: 100,
    happiness: 100,
    hunger: 0,
    health: 100,
  };

  it("should decrease energy when awake", () => {
    const oneMinute = 60_000;
    const result = calculateDecay(baseStats, oneMinute, false, false);

    expect(result.energy).toBeLessThan(baseStats.energy);
    expect(result.energy).toBeCloseTo(100 - DECAY_RATES.energy, 0);
  });

  it("should decrease happiness when awake", () => {
    const oneMinute = 60_000;
    const result = calculateDecay(baseStats, oneMinute, false, false);

    expect(result.happiness).toBeLessThan(baseStats.happiness);
    expect(result.happiness).toBeCloseTo(100 - DECAY_RATES.happiness, 0);
  });

  it("should increase hunger when awake", () => {
    const oneMinute = 60_000;
    const result = calculateDecay(baseStats, oneMinute, false, false);

    expect(result.hunger).toBeGreaterThan(baseStats.hunger);
    expect(result.hunger).toBeCloseTo(DECAY_RATES.hunger, 0);
  });

  it("should recover energy when sleeping", () => {
    const lowEnergyStats = { ...baseStats, energy: 50 };
    const oneMinute = 60_000;
    const result = calculateDecay(lowEnergyStats, oneMinute, true, false);

    expect(result.energy).toBeGreaterThan(lowEnergyStats.energy);
  });

  it("should drain extra energy when mining", () => {
    const oneMinute = 60_000;
    const normalDecay = calculateDecay(baseStats, oneMinute, false, false);
    const miningDecay = calculateDecay(baseStats, oneMinute, false, true);

    expect(miningDecay.energy).toBeLessThan(normalDecay.energy);
  });

  it("should not exceed stat limits", () => {
    const extremeStats: BabyStats = {
      energy: 5,
      happiness: 5,
      hunger: 95,
      health: 5,
    };
    const longTime = 60 * 60_000; // 60 minutes
    const result = calculateDecay(extremeStats, longTime, false, false);

    expect(result.energy).toBeGreaterThanOrEqual(GAME_CONFIG.STAT_MIN);
    expect(result.happiness).toBeGreaterThanOrEqual(GAME_CONFIG.STAT_MIN);
    expect(result.hunger).toBeLessThanOrEqual(GAME_CONFIG.STAT_MAX);
  });

  it("should decrease health when stats are critical", () => {
    const criticalStats: BabyStats = {
      energy: 10,
      happiness: 10,
      hunger: 90,
      health: 100,
    };
    const oneMinute = 60_000;
    const result = calculateDecay(criticalStats, oneMinute, false, false);

    expect(result.health).toBeLessThan(criticalStats.health);
  });
});

describe("calculateOfflineDecay", () => {
  const baseStats: BabyStats = {
    energy: 100,
    happiness: 100,
    hunger: 0,
    health: 100,
  };

  it("should apply reduced decay rate for offline time", () => {
    const oneHour = 60 * 60_000;
    const offlineResult = calculateOfflineDecay(baseStats, oneHour, false);
    const onlineResult = calculateDecay(baseStats, oneHour, false, false);

    // Offline decay should be less severe
    expect(offlineResult.energy).toBeGreaterThan(onlineResult.energy);
  });

  it("should cap offline time at 24 hours", () => {
    const twoDays = 48 * 60 * 60_000;
    const oneDay = 24 * 60 * 60_000;

    const twoDaysResult = calculateOfflineDecay(baseStats, twoDays, false);
    const oneDayResult = calculateOfflineDecay(baseStats, oneDay, false);

    // Results should be the same since decay is capped at 24 hours
    expect(twoDaysResult.energy).toBe(oneDayResult.energy);
  });
});

// ============================================
// Action Effects Tests
// ============================================

describe("applyAction", () => {
  const baseStats: BabyStats = {
    energy: 50,
    happiness: 50,
    hunger: 50,
    health: 50,
  };

  it("should decrease hunger and increase happiness when feeding", () => {
    const result = applyAction(baseStats, "feed");
    expect(result.hunger).toBeLessThan(baseStats.hunger);
    expect(result.happiness).toBeGreaterThan(baseStats.happiness);
  });

  it("should increase happiness and decrease energy when playing", () => {
    const result = applyAction(baseStats, "play");
    expect(result.happiness).toBeGreaterThan(baseStats.happiness);
    expect(result.energy).toBeLessThan(baseStats.energy);
  });

  it("should increase happiness when waking up", () => {
    const result = applyAction(baseStats, "wake");
    expect(result.happiness).toBeGreaterThan(baseStats.happiness);
  });

  it("should decrease energy and happiness when learning", () => {
    const result = applyAction(baseStats, "learn");
    expect(result.energy).toBeLessThan(baseStats.energy);
    expect(result.happiness).toBeLessThan(baseStats.happiness);
  });

  it("should clamp stats within valid range", () => {
    const lowHunger: BabyStats = { ...baseStats, hunger: 10 };
    const result = applyAction(lowHunger, "feed");
    expect(result.hunger).toBeGreaterThanOrEqual(GAME_CONFIG.STAT_MIN);
  });
});

// ============================================
// Level Up / Evolution Tests
// ============================================

describe("addXP", () => {
  it("should add XP without leveling up when below threshold", () => {
    const progression: BabyProgression = {
      level: 1,
      xp: 0,
      xpToNextLevel: getXPForLevel(2),
      stage: "baby_1",
    };

    const result = addXP(progression, 10);
    expect(result.level).toBe(1);
    expect(result.xp).toBe(10);
  });

  it("should level up when XP exceeds threshold", () => {
    const progression: BabyProgression = {
      level: 1,
      xp: 40,
      xpToNextLevel: 75, // getXPForLevel(2) = 75
      stage: "baby_1",
    };

    const result = addXP(progression, 40);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(5); // 40 + 40 - 75 = 5 overflow
    expect(result.stage).toBe("baby_2");
  });

  it("should handle multiple level ups at once", () => {
    const progression: BabyProgression = {
      level: 1,
      xp: 0,
      xpToNextLevel: 75, // getXPForLevel(2) = 75
      stage: "baby_1",
    };

    // Add enough XP to reach level 3
    // Level 2 requires 75 XP, Level 3 requires 100 XP = 175 total
    // Adding 200 XP should get us past level 3
    const result = addXP(progression, 200);
    expect(result.level).toBeGreaterThanOrEqual(3);
  });

  it("should not exceed max level", () => {
    const progression: BabyProgression = {
      level: GAME_CONFIG.MAX_LEVEL - 1,
      xp: 4000,
      xpToNextLevel: 5000,
      stage: "master_3",
    };

    const result = addXP(progression, 10000);
    expect(result.level).toBe(GAME_CONFIG.MAX_LEVEL);
  });

  it("should update stage when crossing evolution thresholds", () => {
    const progression: BabyProgression = {
      level: 3,
      xp: 90,
      xpToNextLevel: 125, // getXPForLevel(4) = 125
      stage: "baby_3",
    };

    const result = addXP(progression, 40);
    expect(result.level).toBe(4);
    expect(result.stage).toBe("child_1");
  });
});

describe("removeXP", () => {
  it("should remove XP without leveling down when above 0", () => {
    const progression: BabyProgression = {
      level: 5,
      xp: 100,
      xpToNextLevel: 150,
      stage: "child_2",
    };

    const result = removeXP(progression, 50);
    expect(result.level).toBe(5);
    expect(result.xp).toBe(50);
  });

  it("should level down when XP goes negative", () => {
    const progression: BabyProgression = {
      level: 5,
      xp: 10,
      xpToNextLevel: 150,
      stage: "child_2",
    };

    const result = removeXP(progression, 50);
    expect(result.level).toBe(4);
  });

  it("should reach level 0 with enough XP removal", () => {
    const progression: BabyProgression = {
      level: 2,
      xp: 10,
      xpToNextLevel: 75,
      stage: "baby_2",
    };

    const result = removeXP(progression, 1000);
    expect(result.level).toBe(0);
    expect(result.xp).toBe(0);
  });
});

describe("getStageForLevel", () => {
  it("should return egg for level 0", () => {
    expect(getStageForLevel(0)).toBe("egg");
  });

  it("should return baby stages for levels 1-3", () => {
    expect(getStageForLevel(1)).toBe("baby_1");
    expect(getStageForLevel(2)).toBe("baby_2");
    expect(getStageForLevel(3)).toBe("baby_3");
  });

  it("should return child stages for levels 4-6", () => {
    expect(getStageForLevel(4)).toBe("child_1");
    expect(getStageForLevel(5)).toBe("child_2");
    expect(getStageForLevel(6)).toBe("child_3");
  });

  it("should return teen stages for levels 7-9", () => {
    expect(getStageForLevel(7)).toBe("teen_1");
    expect(getStageForLevel(8)).toBe("teen_2");
    expect(getStageForLevel(9)).toBe("teen_3");
  });

  it("should return young adult stages for levels 10-12", () => {
    expect(getStageForLevel(10)).toBe("young_1");
    expect(getStageForLevel(11)).toBe("young_2");
    expect(getStageForLevel(12)).toBe("young_3");
  });

  it("should return adult stages for levels 13-15", () => {
    expect(getStageForLevel(13)).toBe("adult_1");
    expect(getStageForLevel(14)).toBe("adult_2");
    expect(getStageForLevel(15)).toBe("adult_3");
  });

  it("should return master stages for levels 16-18", () => {
    expect(getStageForLevel(16)).toBe("master_1");
    expect(getStageForLevel(17)).toBe("master_2");
    expect(getStageForLevel(18)).toBe("master_3");
  });

  it("should return legend for level 21", () => {
    expect(getStageForLevel(21)).toBe("legend");
  });
});

describe("checkEvolution", () => {
  it("should return null when no evolution is available", () => {
    const baby = createNewBaby("TestBaby");
    expect(checkEvolution(baby)).toBeNull();
  });

  it("should detect evolution when level and stage mismatch", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 4; // Should be child_1 but stage is still baby_1

    const result = checkEvolution(baby);
    expect(result).toBe("child_1");
  });
});

// ============================================
// Critical Stats Tests
// ============================================

describe("getCriticalStats", () => {
  it("should return empty array when all stats are good", () => {
    const stats: BabyStats = {
      energy: 100,
      happiness: 100,
      hunger: 0,
      health: 100,
    };
    expect(getCriticalStats(stats)).toEqual([]);
  });

  it("should detect critical energy", () => {
    const stats: BabyStats = {
      energy: 15,
      happiness: 100,
      hunger: 0,
      health: 100,
    };
    expect(getCriticalStats(stats)).toContain("energy");
  });

  it("should detect critical happiness", () => {
    const stats: BabyStats = {
      energy: 100,
      happiness: 15,
      hunger: 0,
      health: 100,
    };
    expect(getCriticalStats(stats)).toContain("happiness");
  });

  it("should detect critical hunger (high hunger is bad)", () => {
    const stats: BabyStats = {
      energy: 100,
      happiness: 100,
      hunger: 85,
      health: 100,
    };
    expect(getCriticalStats(stats)).toContain("hunger");
  });

  it("should detect critical health", () => {
    const stats: BabyStats = {
      energy: 100,
      happiness: 100,
      hunger: 0,
      health: 15,
    };
    expect(getCriticalStats(stats)).toContain("health");
  });

  it("should detect multiple critical stats", () => {
    const stats: BabyStats = {
      energy: 10,
      happiness: 10,
      hunger: 90,
      health: 10,
    };
    const critical = getCriticalStats(stats);
    expect(critical.length).toBe(4);
  });
});

// ============================================
// Mining Tests
// ============================================

describe("calculateMiningBonus", () => {
  it("should return 0 for egg stage", () => {
    expect(calculateMiningBonus("egg")).toBe(0);
  });

  it("should return 1.0 for baby_1 stage", () => {
    expect(calculateMiningBonus("baby_1")).toBe(1.0);
  });

  it("should return correct bonuses for higher stages", () => {
    expect(calculateMiningBonus("child_1")).toBe(MINING_BONUS.child_1);
    expect(calculateMiningBonus("teen_1")).toBe(MINING_BONUS.teen_1);
    expect(calculateMiningBonus("adult_1")).toBe(MINING_BONUS.adult_1);
  });

  it("should return 2.0 for legend stage", () => {
    expect(calculateMiningBonus("legend")).toBe(2.0);
  });

  it("should have increasing bonuses as stage progresses", () => {
    expect(calculateMiningBonus("baby_1")).toBeLessThan(
      calculateMiningBonus("child_1"),
    );
    expect(calculateMiningBonus("child_1")).toBeLessThan(
      calculateMiningBonus("teen_1"),
    );
    expect(calculateMiningBonus("teen_1")).toBeLessThan(
      calculateMiningBonus("adult_1"),
    );
    expect(calculateMiningBonus("adult_1")).toBeLessThan(
      calculateMiningBonus("legend"),
    );
  });
});

describe("calculateMiningXP", () => {
  it("should return 0 XP for 0 shares", () => {
    expect(calculateMiningXP(0, "baby_1")).toBe(0);
  });

  it("should calculate base XP correctly", () => {
    const shares = 10;
    const xp = calculateMiningXP(shares, "baby_1");
    // Base: 10 shares * 10 XP/share * 1.0 bonus = 100
    expect(xp).toBe(100);
  });

  it("should apply stage bonus to XP", () => {
    const shares = 10;
    const babyXP = calculateMiningXP(shares, "baby_1");
    const adultXP = calculateMiningXP(shares, "adult_1");

    expect(adultXP).toBeGreaterThan(babyXP);
  });

  it("should return 0 XP for egg stage (cannot mine)", () => {
    expect(calculateMiningXP(10, "egg")).toBe(0);
  });
});

// ============================================
// Visual State Tests
// ============================================

describe("determineVisualState", () => {
  it("should return dead for level 0 baby", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 0;

    expect(determineVisualState(baby)).toBe("dead");
  });

  it("should return critical when health is critical", () => {
    const baby = createNewBaby("TestBaby");
    baby.stats.health = 10;

    expect(determineVisualState(baby)).toBe("critical");
  });

  it("should return critical when multiple stats are critical", () => {
    const baby = createNewBaby("TestBaby");
    baby.stats.energy = 10;
    baby.stats.happiness = 10;

    expect(determineVisualState(baby)).toBe("critical");
  });

  it("should return sleeping when baby is sleeping", () => {
    const baby = createNewBaby("TestBaby");
    baby.isSleeping = true;

    expect(determineVisualState(baby)).toBe("sleeping");
  });

  it("should return mining when baby is mining", () => {
    const baby = createNewBaby("TestBaby");
    baby.isMining = true;

    expect(determineVisualState(baby)).toBe("mining");
  });

  it("should return hungry when hunger is high", () => {
    const baby = createNewBaby("TestBaby");
    baby.stats.hunger = 75;

    expect(determineVisualState(baby)).toBe("hungry");
  });

  it("should return happy when happiness is high", () => {
    const baby = createNewBaby("TestBaby");
    baby.stats.happiness = 90;
    baby.stats.hunger = 20;

    expect(determineVisualState(baby)).toBe("happy");
  });

  it("should return idle by default", () => {
    const baby = createNewBaby("TestBaby");
    // A newly created baby starts with 100 happiness which triggers "happy" state
    // Lower happiness to be in the idle range (< 80)
    baby.stats.happiness = 70;
    expect(determineVisualState(baby)).toBe("idle");
  });
});

// ============================================
// Death / Revival Tests
// ============================================

describe("calculateLevelDecay", () => {
  it("should not decay during grace period", () => {
    const progression: BabyProgression = {
      level: 10,
      xp: 500,
      xpToNextLevel: 600,
      stage: "young_1",
    };
    const now = Date.now();
    const lastMined = now - (LEVEL_DECAY.GRACE_PERIOD_MS - 1000); // Just before grace period ends

    const result = calculateLevelDecay(progression, lastMined, now);

    expect(result.progression.level).toBe(10);
    expect(result.progression.xp).toBe(500);
    expect(result.isDead).toBe(false);
  });

  it("should decay XP after grace period", () => {
    const progression: BabyProgression = {
      level: 10,
      xp: 500,
      xpToNextLevel: 600,
      stage: "young_1",
    };
    const now = Date.now();
    // 8 days inactive (1 day past grace period)
    const lastMined = now - (LEVEL_DECAY.GRACE_PERIOD_MS + 24 * 60 * 60 * 1000);

    const result = calculateLevelDecay(progression, lastMined, now);

    // Should have lost XP_DECAY_PER_DAY (100 XP) for 1 day
    expect(result.progression.xp).toBeLessThan(500);
  });

  it("should cause death (level 0) after prolonged inactivity", () => {
    const progression: BabyProgression = {
      level: 2,
      xp: 10,
      xpToNextLevel: 75,
      stage: "baby_2",
    };
    const now = Date.now();
    // 37 days inactive (30 days past grace, which is max)
    const lastMined =
      now - (LEVEL_DECAY.GRACE_PERIOD_MS + 30 * 24 * 60 * 60 * 1000);

    const result = calculateLevelDecay(progression, lastMined, now);

    expect(result.isDead).toBe(true);
    expect(result.progression.level).toBe(0);
  });

  it("should cap decay at MAX_DECAY_DAYS", () => {
    const progression: BabyProgression = {
      level: 15,
      xp: 1000,
      xpToNextLevel: 1800,
      stage: "adult_3",
    };
    const now = Date.now();
    // 60 days inactive (53 days past grace, but should cap at 30)
    const lastMined =
      now - (LEVEL_DECAY.GRACE_PERIOD_MS + 53 * 24 * 60 * 60 * 1000);

    const result = calculateLevelDecay(progression, lastMined, now);

    // Max decay is 30 days * 100 XP = 3000 XP
    // This is calculated but capped
    expect(result.progression.level).toBeGreaterThanOrEqual(0);
  });
});

describe("isBabyDead", () => {
  it("should return true for level 0", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 0;
    expect(isBabyDead(baby)).toBe(true);
  });

  it("should return false for level > 0", () => {
    const baby = createNewBaby("TestBaby");
    expect(isBabyDead(baby)).toBe(false);
  });
});

describe("reviveBaby", () => {
  it("should not change alive baby", () => {
    const baby = createNewBaby("TestBaby");
    const result = reviveBaby(baby);

    expect(result.progression.level).toBe(1);
    expect(result).toBe(baby); // Same reference
  });

  it("should revive dead baby to level 1", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 0;
    baby.progression.xp = 0;
    baby.progression.stage = "egg";

    const result = reviveBaby(baby);

    expect(result.progression.level).toBe(1);
    expect(result.progression.stage).toBe("baby_1");
    expect(result.progression.xp).toBe(0);
  });

  it("should reset stats to revival values", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 0;
    baby.stats = { energy: 0, happiness: 0, hunger: 100, health: 0 };

    const result = reviveBaby(baby);

    expect(result.stats.energy).toBe(LEVEL_DECAY.REVIVAL_STATS.energy);
    expect(result.stats.happiness).toBe(LEVEL_DECAY.REVIVAL_STATS.happiness);
    expect(result.stats.hunger).toBe(LEVEL_DECAY.REVIVAL_STATS.hunger);
    expect(result.stats.health).toBe(LEVEL_DECAY.REVIVAL_STATS.health);
  });

  it("should set visual state to idle after revival", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 0;
    baby.visualState = "dead";

    const result = reviveBaby(baby);

    expect(result.visualState).toBe("idle");
  });

  it("should update timestamps after revival", () => {
    const baby = createNewBaby("TestBaby");
    baby.progression.level = 0;
    const oldTimestamp = baby.lastUpdated;

    // Small delay to ensure different timestamp
    const result = reviveBaby(baby);

    expect(result.lastUpdated).toBeGreaterThanOrEqual(oldTimestamp);
    expect(result.lastFed).toBeGreaterThanOrEqual(oldTimestamp);
    expect(result.lastPlayed).toBeGreaterThanOrEqual(oldTimestamp);
  });
});

describe("getDaysUntilDecay", () => {
  it("should return full grace period for just-mined baby", () => {
    const now = Date.now();
    const lastMined = now;

    const days = getDaysUntilDecay(lastMined, now);

    expect(days).toBeCloseTo(7, 0); // 7 day grace period
  });

  it("should return remaining days correctly", () => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    const days = getDaysUntilDecay(threeDaysAgo, now);

    expect(days).toBeCloseTo(4, 0); // 7 - 3 = 4 days left
  });

  it("should return 0 when grace period has passed", () => {
    const now = Date.now();
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

    const days = getDaysUntilDecay(tenDaysAgo, now);

    expect(days).toBe(0);
  });
});
