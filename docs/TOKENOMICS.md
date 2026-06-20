# BitcoinBaby ($BABY) Tokenomics

## Overview

| Metric | Value |
|--------|-------|
| **Total Supply** | 21,000,000,000 (21 Billion) |
| **Decimals** | 8 |
| **Mining Period** | ~15-20 years |
| **Halving Interval** | Every 210,000 Bitcoin blocks (~4 years) |
| **Initial Block Reward** | 500 $BABY |

## Emission Schedule

### Bitcoin-Style Halvings

Following Bitcoin's proven model, $BABY uses halvings to create scarcity:

| Epoch | Bitcoin Blocks | Years | Block Reward | % of Supply | Cumulative |
|-------|----------------|-------|--------------|-------------|------------|
| 1 | 0 - 210,000 | 0-4 | 500 BABY | 50% | 50% |
| 2 | 210,001 - 420,000 | 4-8 | 250 BABY | 25% | 75% |
| 3 | 420,001 - 630,000 | 8-12 | 125 BABY | 12.5% | 87.5% |
| 4 | 630,001 - 840,000 | 12-16 | 62.5 BABY | 6.25% | 93.75% |
| 5 | 840,001 - 1,050,000 | 16-20 | 31.25 BABY | 3.125% | 96.875% |

**~97% mined in first 20 years!**

### Reward Distribution Per Block

```
70% -> Miner (direct reward)
20% -> Development Fund (ecosystem growth)
10% -> Staking Pool (future feature)
```

---

## Mining Difficulty & Rewards

### Browser Mining (Natural Emission Control)

Sistema sin limites artificiales. La dificultad controla la emision naturalmente.
**Ganancias: MILES por dia, sin restricciones.**

| Difficulty | Leading Zeros | Base Reward | With Max Streak (2x) |
|------------|---------------|-------------|----------------------|
| 22 bits | 5.5 hex zeros | 100 $BABY | 200 $BABY |
| 23 bits | - | 200 $BABY | 400 $BABY |
| 24 bits | 6 hex zeros | 400 $BABY | 800 $BABY |
| 25 bits | - | 800 $BABY | 1,600 $BABY |
| 26 bits | - | 1,600 $BABY | 3,200 $BABY |

**Formula:** reward = 100 * 2^(difficulty - 22) * streakMultiplier

### Streak Bonus System

Mientras mas minas seguido, MAS ganas (como un combo en videojuegos):

| Shares Consecutivos | Multiplicador | Reward (D22) |
|---------------------|---------------|--------------|
| 0-9 | 1.0x | 100 $BABY |
| 10-49 | 1.2x | 120 $BABY |
| 50-99 | 1.5x | 150 $BABY |
| 100-249 | 1.75x | 175 $BABY |
| 250-499 | 1.9x | 190 $BABY |
| 500+ | 2.0x (MAX) | 200 $BABY |

**Nota:** El streak se resetea si dejas de minar por 30 minutos.

### Hashrate Examples (SIN LIMITES)

| Device | Estimated Hashrate | Shares/Hour (D22) | $BABY/Hora (streak max) |
|--------|-------------------|-------------------|-------------------------|
| Phone (low) | 50-100 H/s | ~0.001 | ~0.2 |
| Phone (mid) | 200-500 H/s | ~0.005 | ~1 |
| Laptop (CPU) | 500-2,000 H/s | ~0.01-0.05 | ~2-10 |
| Desktop (CPU) | 2,000-5,000 H/s | ~0.05-0.1 | ~10-20 |
| WebGPU (GPU) | 50,000-500,000 H/s | ~1-10 | ~200-2,000 |

**Nota:** Si quieres minar 24/7, hazlo! No hay limites.

---

## Projected Mining Rates

### Individual Miner (SIN LIMITES - Natural)

Ganancias en MILES por dia, controladas naturalmente por dificultad D22:

| Scenario | Shares/Day | Daily Reward | Monthly |
|----------|------------|--------------|---------|
| Casual (phone) | ~0.01 | ~1-5 $BABY | ~30-150 |
| Regular (laptop) | ~0.1-0.5 | ~20-100 $BABY | ~600-3K |
| Power (desktop) | ~0.5-2 | ~100-400 $BABY | ~3K-12K |
| GPU (WebGPU) | ~10-80 | ~2,000-16,000 $BABY | ~60K-480K |

### Network Emission Rate

Para emitir 21B de forma muy gradual:

```
Target: 21,000,000,000 $BABY
Method: Difficulty D22 controls emission naturally

NO HAY CAPS - La dificultad es el control:
- D22 = shares muy dificiles
- GPU encuentra ~10 shares/hora (no 700 como en D16)
- Esto limita ganancias a MILES naturalmente

Ejemplo con 1000 GPUs minando 24/7:
- 1000 × 80 shares × 200 $BABY = 16M/dia
- 21B / 16M = 1,312 dias = ~3.6 años

Note: Sin limites artificiales, solo fisica de dificultad
```

---

## Why This Works for Meme Token

### 1. Easy to Start
- Mine on any device (phone, laptop, desktop)
- No special hardware required
- See rewards immediately

### 2. Fair Distribution
- No pre-mine
- No VC allocation
- 100% mined by community

### 3. Engaging Gameplay
- Baby grows with mining
- NFTs boost mining rate
- Achievements unlock rewards

### 4. Sustainable Long-term
- Bitcoin-style halvings create scarcity
- 15-20 year mining window
- Later miners still rewarded

---

## NFT Mining Boosts

| Rarity | Boost | Effect |
|--------|-------|--------|
| Common | +5% | 1.05x hashrate |
| Uncommon | +10% | 1.10x hashrate |
| Rare | +20% | 1.20x hashrate |
| Epic | +35% | 1.35x hashrate |
| Legendary | +50% | 1.50x hashrate |
| Mythic | +100% | 2.00x hashrate |

---

## Comparison with Other Meme Tokens

| Token | Supply | Distribution | Mining |
|-------|--------|--------------|--------|
| $DOGE | Infinite | PoW (ASIC) | Hardware required |
| $SHIB | 1 Quadrillion | Pre-mined | None |
| $PEPE | 420 Trillion | Pre-mined | None |
| **$BABY** | 21 Billion | **PoW (Browser)** | **Anyone can mine!** |

---

## Burns = VALUE, not Penalties

Burns happen when users get VALUE - no penalties on basic actions:

| Action | Burn Amount | What User Gets |
|--------|-------------|----------------|
| **Withdraw to Bitcoin** | **0%** | 100% of tokens (no penalty!) |
| **Buy NFT** | 100% | NFT with mining boost |
| **Evolve Baby** | 100% | Stronger baby, more XP |
| **Custom Name** | 5,000 $BABY | Personalized baby name |
| **Custom Skin** | 10,000 $BABY | Unique baby appearance |
| **Mining Boost 1h** | 2,500 $BABY | +50% hashrate for 1 hour |
| **Mining Boost 24h** | 25,000 $BABY | +50% hashrate for 24 hours |
| **Revive Baby** | 50,000 $BABY | Skip death penalty |
| **Reset Stats** | 15,000 $BABY | Respec baby stats |

### Why This Works

```
Users WANT to burn (for value)
More engagement = More burns
More burns = Less supply
Less supply = More value
```

### Projected Burn Rate

With 10,000 active users:
- ~200,000 $BABY burned daily from NFTs/evolution
- ~100,000 $BABY burned daily from premium features
- = ~300,000 $BABY burned per day
- = ~110M $BABY burned per year

**Result:** High engagement = naturally deflationary. No withdrawal penalty = happy users.

---

## Future Features (Phase 2+)

When the community grows, we can add:

| Feature | Description | Phase |
|---------|-------------|-------|
| **Staking** | Lock $BABY for mining boost | Phase 2 |
| **Governance** | Vote on parameters | Phase 3 |
| **Adaptive Emission** | Adjust based on activity | Phase 3 |

These are optional and will be added based on community feedback.

---

## Summary

- **21 Billion** total supply (like Bitcoin's 21M but 1000x for meme factor)
- **Mining sin limites** - mina todo lo que quieras!
- **Easy browser mining** - no hardware needed
- **Fair launch** - no pre-mine
- **Natural rewards** - 100 $BABY per share at D22 (doubles each level)
- **Streak bonus** - up to 2x reward for continuous mining
- **NO CAPS** - la dificultad controla emision naturalmente
- **NFT boosts** for dedicated miners
- **Baby evolution** tied to mining progress
- **NO withdrawal penalty** - users keep 100%
- **Value-based burns** - premium features burn tokens

### Key Changes (v2.0)

| Metric | Before | After |
|--------|--------|-------|
| Base Reward | 10,000 $BABY | 100 $BABY |
| Min Difficulty | D16 | D22 |
| Max Streak Bonus | - | 2x |
| Daily Cap (per user) | 10M | **SIN LIMITE** |
| Daily Cap (global) | None | **SIN LIMITE** |
| Expected GPU earnings | 7M/hour | ~2K/hour |

**Filosofia:** MILES por dia (no millones), SIN LIMITES artificiales.
