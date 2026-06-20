# Sistema de Balance - Genesis Babies

> **"Todos pueden ganar. Nadie domina todo."**

Este documento define las reglas de balance para que el juego sea justo.

---

## El Problema: Bonus Sin Control

### Situacion Actual (SIN BALANCE)

Un jugador "whale" podria acumular:

```
Alien (durante alineacion):     +150%
Rogue Bloodline:                +25%
Items Legendarios:              +30%
Herencia Oceania:               +5%
Nivel 100 Mythic:               +50%
────────────────────────────────────
TOTAL:                          +260% (x3.6)
```

Un jugador nuevo:

```
Human basico:                   +0%
Sin bloodline especial:         +0%
Sin items:                      +0%
Momento cosmico malo:           -30%
────────────────────────────────────
TOTAL:                          -30% (x0.7)
```

**Diferencia: 5x** - El whale gana 5 veces mas que el nuevo. Esto mata el juego.

---

## La Solucion: Sistema de Balance

### Principios Fundamentales

1. **Techo (Cap)**: Ningun bonus total puede superar +100%
2. **Piso (Floor)**: Nadie puede tener menos de 50% de la base
3. **Rendimientos Decrecientes**: Mientras mas bonus, menos efecto adicional
4. **Catch-up**: Los nuevos progresan mas rapido
5. **Redistribucion**: Parte de los rewards van a la comunidad

---

## 1. Sistema de Techo y Piso

### Limites Absolutos

```typescript
const BALANCE_LIMITS = {
  // Maximo bonus total permitido
  MAX_TOTAL_BONUS: 1.0,      // +100% maximo (x2)

  // Minimo multiplicador (nunca menos de esto)
  MIN_MULTIPLIER: 0.5,       // -50% minimo (x0.5)

  // Diferencia maxima entre mejor y peor caso
  MAX_DISPARITY: 4.0,        // El mejor gana maximo 4x mas que el peor
};
```

### Resultado Balanceado

| Jugador | Bonus Bruto | Bonus Aplicado | Multiplicador |
|---------|-------------|----------------|---------------|
| Whale optimizado | +260% | **+100%** (cap) | x2.0 |
| Jugador promedio | +40% | +40% | x1.4 |
| Jugador nuevo | -30% | -30% | x0.7 |
| Peor caso posible | -80% | **-50%** (floor) | x0.5 |

**Nueva diferencia maxima: 4x** (2.0 / 0.5) - Mucho mas justo.

---

## 2. Rendimientos Decrecientes

Los bonus no se suman linealmente. Mientras mas tienes, menos efecto tiene cada bonus adicional.

### Formula de Rendimiento Decreciente

```typescript
function applyDiminishingReturns(rawBonus: number): number {
  if (rawBonus <= 0) {
    // Penalizaciones se aplican completas (sin diminishing)
    return Math.max(rawBonus, -0.5); // Floor de -50%
  }

  // Bonus positivos tienen diminishing returns
  // Formula: bonus_efectivo = 1 - e^(-raw * factor)
  // Esto hace que bonus altos tengan menos impacto

  const factor = 0.7; // Ajustar para controlar la curva
  const effective = 1 - Math.exp(-rawBonus * factor);

  return Math.min(effective, 1.0); // Cap de +100%
}
```

### Tabla de Conversion

| Bonus Bruto | Bonus Efectivo | Eficiencia |
|-------------|----------------|------------|
| +10% | +7% | 70% |
| +25% | +16% | 64% |
| +50% | +29% | 58% |
| +75% | +41% | 55% |
| +100% | +50% | 50% |
| +150% | +65% | 43% |
| +200% | +75% | 38% |
| +300% | +88% | 29% |
| +500% | +97% | 19% |

**Insight:** Pasar de +50% a +100% bruto solo da +21% efectivo adicional.

---

## 3. Categorias de Bonus con Caps Individuales

Cada categoria tiene su propio limite para evitar stacking extremo.

### Caps por Categoria

| Categoria | Cap Individual | Descripcion |
|-----------|----------------|-------------|
| **Tipo Base** | ±30% | Human, Animal, Robot, etc. |
| **Bloodline** | +15% | Royal, Warrior, Rogue, Mystic |
| **Herencia Cultural** | +5% | Americas, Africa, Asia, etc. |
| **Eventos Cosmicos** | ±40% | Luna, eclipses, solsticios |
| **Items Equipados** | +25% | Maximo de items combinados |
| **Nivel/Evolucion** | +20% | Por nivel alto |
| **Rareza NFT** | +15% | Common a Mythic |

### Ejemplo de Calculo

```
JUGADOR OPTIMIZADO:
  Tipo (Alien en alineacion): +150% → CAP +30%
  Bloodline (Rogue):          +25%  → CAP +15%
  Herencia (Oceania):         +5%   → +5%
  Evento (Alineacion):        +50%  → CAP +40%
  Items (Legendarios):        +45%  → CAP +25%
  Nivel 100:                  +30%  → CAP +20%
  Rareza Mythic:              +25%  → CAP +15%
  ─────────────────────────────────────────────
  SUMA CON CAPS:              +150% (bruto)
  DIMINISHING RETURNS:        +63% (efectivo)
  MULTIPLICADOR FINAL:        x1.63

JUGADOR NUEVO:
  Tipo (Human):               +0%
  Bloodline (ninguno):        +0%
  Herencia (random):          +3%
  Evento (neutral):           +0%
  Items (basicos):            +5%
  Nivel 5:                    +2%
  Rareza Common:              +0%
  ─────────────────────────────────────────────
  SUMA:                       +10% (bruto)
  DIMINISHING RETURNS:        +7% (efectivo)
  MULTIPLICADOR FINAL:        x1.07

DIFERENCIA: 1.63 / 1.07 = 1.52x
```

**El whale gana ~50% mas, no 500% mas.** Esto es justo.

---

## 4. Sistema de Catch-Up para Nuevos

Los jugadores nuevos progresan mas rapido para alcanzar a los veteranos.

### Bonus de Catch-Up

```typescript
function getCatchUpBonus(playerLevel: number, averageServerLevel: number): number {
  if (playerLevel >= averageServerLevel) {
    return 0; // No bonus si estas arriba del promedio
  }

  const levelsBehind = averageServerLevel - playerLevel;

  // +5% XP por cada nivel debajo del promedio (max +50%)
  return Math.min(levelsBehind * 0.05, 0.5);
}
```

### Tabla de Catch-Up

| Tu Nivel | Promedio Server | Bonus XP |
|----------|-----------------|----------|
| 5 | 20 | +50% (cap) |
| 10 | 20 | +50% (cap) |
| 15 | 20 | +25% |
| 18 | 20 | +10% |
| 20+ | 20 | +0% |

---

## 5. Redistribucion Comunitaria

Parte de las ganancias de los top players van a un pool comunitario.

### Impuesto de Exito

```typescript
function calculateCommunityTax(earnings: number, playerRank: number, totalPlayers: number): number {
  const percentile = playerRank / totalPlayers;

  if (percentile > 0.10) {
    return 0; // Solo el top 10% paga impuesto
  }

  // Top 1%: 15% de tax
  // Top 5%: 10% de tax
  // Top 10%: 5% de tax
  if (percentile <= 0.01) return earnings * 0.15;
  if (percentile <= 0.05) return earnings * 0.10;
  return earnings * 0.05;
}
```

### Distribucion del Pool

El pool comunitario se distribuye:

| Destino | % del Pool | Beneficiarios |
|---------|------------|---------------|
| Jugadores nuevos (< nivel 10) | 40% | Bonus de bienvenida |
| Eventos comunitarios | 30% | Premios para todos |
| Staking rewards | 20% | Holders de $BABY |
| Desarrollo | 10% | Mejoras del juego |

---

## 6. Balance de Tipos y Bloodlines

### Nuevo Balance de Tipos

Todos los tipos deben ser **viables**, no solo diferentes.

| Tipo | Fortaleza Principal | Debilidad | Balance |
|------|---------------------|-----------|---------|
| **Human** | +10% a TODO (versatil) | Ninguna especialidad | Jack of all trades |
| **Animal** | +20% evolucion | -10% en eclipses solares | Rapido crecimiento |
| **Robot** | +20% mining | -10% en lunas llenas | Eficiencia constante |
| **Mystic** | +15% en eventos lunares | -5% base constante | Picos de poder |
| **Alien** | +20% eventos raros | -15% en momentos normales | Alto riesgo/recompensa |

**Nota:** Las debilidades compensan las fortalezas. Ningun tipo es "el mejor".

### Nuevo Balance de Bloodlines

| Bloodline | Bonus | Limitacion | Balance |
|-----------|-------|------------|---------|
| **Royal** | +10% XP siempre | -5% mining | Crece rapido, mina menos |
| **Warrior** | +15% mining | -5% XP | Mina bien, crece lento |
| **Rogue** | +10% drops raros | Drops comunes -10% | Calidad sobre cantidad |
| **Mystic** | Evolucion especial | Requiere 2x XP | Unico pero costoso |

---

## 7. Balance de Rareza

La rareza NO debe dar ventajas de poder desproporcionadas.

### Viejo Sistema (MALO)

```
Common:    x1.0
Uncommon:  x1.2 (+20%)
Rare:      x1.5 (+50%)
Epic:      x2.0 (+100%)
Legendary: x3.0 (+200%)
Mythic:    x5.0 (+400%)  ← DEMASIADO
```

### Nuevo Sistema (BALANCEADO)

```
Common:    x1.00 (+0%)   - Base solida
Uncommon:  x1.05 (+5%)   - Ligera ventaja
Rare:      x1.10 (+10%)  - Ventaja notable
Epic:      x1.12 (+12%)  - Ventaja buena
Legendary: x1.14 (+14%)  - Muy bueno
Mythic:    x1.15 (+15%)  - Tope (CAP)
```

**La rareza da:** Cosmeticos unicos, acceso a contenido especial, prestigio social - NO poder desmedido.

---

## 8. Balance de Items

### Reglas de Items

1. **Maximo 3 items activos** a la vez
2. **No stackean** del mismo tipo
3. **Duracion limitada** (excepto permanentes raros)
4. **Disponibles para todos** (aunque con diferente probabilidad)

### Items Balanceados

| Item | Efecto | Duracion | Como Obtener |
|------|--------|----------|--------------|
| **Comunes** | +3-5% | 1 hora | Facil (drops frecuentes) |
| **Uncommon** | +5-8% | 2 horas | Moderado |
| **Rare** | +8-12% | 4 horas | Eventos/crafting |
| **Epic** | +10-15% | 8 horas | Dificil |
| **Legendary** | +12-18% | 24 horas | Muy raro |

**Nota:** Un jugador con 3 items legendarios tiene max +54% de items (pero con cap de categoria = +25%).

---

## 9. Eventos Cosmicos Balanceados

### Nuevo Balance de Eventos

| Evento | Bonus Maximo | Penalizacion Maxima | Quien se beneficia |
|--------|--------------|---------------------|-------------------|
| Luna Nueva | +25% | -15% | Mystics (+), Robots (=), Animals (-) |
| Luna Llena | +25% | -15% | Animals (+), Mystics (+), Robots (-) |
| Eclipse Lunar | +30% | -20% | Mystics (++), Animals (+), Robots (--) |
| Eclipse Solar | +30% | -20% | Robots (++), Aliens (+), Animals (--) |
| Solsticio | +20% | -15% | Varía por estacion |
| Alineacion | +40% | 0% | Todos (+), Aliens (++) |

**Regla:** El evento beneficia a unos y perjudica a otros, pero nadie queda en 0.

---

## 10. Formula Final de Rewards

```typescript
function calculateFinalRewards(
  baseReward: number,
  player: Player,
  cosmicState: CosmicState
): RewardResult {

  // 1. Calcular bonus bruto por categoria (con caps)
  const typeBonus = Math.min(getTypeBonus(player, cosmicState), 0.30);
  const bloodlineBonus = Math.min(player.bloodlineBonus, 0.15);
  const heritageBonus = Math.min(player.heritageBonus, 0.05);
  const cosmicBonus = clamp(getCosmicBonus(player, cosmicState), -0.40, 0.40);
  const itemBonus = Math.min(getTotalItemBonus(player), 0.25);
  const levelBonus = Math.min(player.level * 0.002, 0.20);
  const rarityBonus = Math.min(getRarityBonus(player.nft), 0.15);

  // 2. Sumar bonus bruto
  const rawBonus = typeBonus + bloodlineBonus + heritageBonus +
                   cosmicBonus + itemBonus + levelBonus + rarityBonus;

  // 3. Aplicar diminishing returns
  const effectiveBonus = applyDiminishingReturns(rawBonus);

  // 4. Calcular multiplicador (con floor y cap)
  const multiplier = clamp(1 + effectiveBonus, 0.5, 2.0);

  // 5. Aplicar catch-up bonus para nuevos
  const catchUp = getCatchUpBonus(player.level, serverAverageLevel);
  const finalMultiplier = multiplier * (1 + catchUp);

  // 6. Calcular reward final
  const grossReward = baseReward * finalMultiplier;

  // 7. Aplicar tax comunitario si es top player
  const tax = calculateCommunityTax(grossReward, player.rank, totalPlayers);
  const netReward = grossReward - tax;

  return {
    gross: grossReward,
    tax: tax,
    net: netReward,
    multiplier: finalMultiplier,
    breakdown: {
      type: typeBonus,
      bloodline: bloodlineBonus,
      heritage: heritageBonus,
      cosmic: cosmicBonus,
      items: itemBonus,
      level: levelBonus,
      rarity: rarityBonus,
      catchUp: catchUp,
    }
  };
}
```

---

## Resumen Visual

```
SISTEMA BALANCEADO
==================

         PISO                    TECHO
          │                        │
    x0.5  │   ████████████████████ │  x2.0
          │   ▲                  ▲ │
          │   │   RANGO JUSTO    │ │
          │   │   (4x maximo)    │ │
          │   │                  │ │
      NUEVO   PROMEDIO      OPTIMIZADO
     PLAYER                   WHALE

Diferencia maxima: 4x (no 10x o 20x)
Todos pueden ganar y progresar.
```

---

## Checklist de Balance

- [x] Cap global de +100% bonus
- [x] Floor global de -50% penalizacion
- [x] Caps por categoria
- [x] Diminishing returns
- [x] Catch-up para nuevos
- [x] Tax comunitario para whales
- [x] Rareza da prestigio, no poder
- [x] Todos los tipos son viables
- [x] Ningun bloodline domina
- [x] Items limitados y temporales

---

*"Un juego donde solo ganan los whales, muere. Un juego donde todos pueden brillar, prospera."*
