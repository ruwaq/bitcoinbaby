# Sistema de Eventos Cosmicos - Genesis Babies

> **"El universo habla. Tu Baby escucha... y tambien sufre."**

Este documento define como los eventos astronomicos reales afectan el gameplay.

---

## Concepto Principal

Los Genesis Babies estan conectados con el cosmos. Eventos astronomicos **reales** activan poderes especiales segun el tipo de Baby y bloodline.

**La idea:** El jugador siente que su Baby esta vivo y conectado con algo mas grande que el juego.

### Sistema Bidireccional: Ganar Y Perder

**IMPORTANTE:** No solo ganan poder - tambien **pierden energia** cuando estan lejos de su momento favorable.

```
MOMENTO FAVORABLE:    +20% a +150% bonus
MOMENTO NEUTRAL:      Sin cambio (x1.0)
MOMENTO DESFAVORABLE: -10% a -30% penalizacion
MOMENTO CRITICO:      -50% (necesita cuidado extra)
```

**Por que esto importa:**
- Crea **urgencia** - hay que jugar en los momentos correctos
- Requiere **estrategia** - elegir que Baby usar cuando
- Genera **engagement** - razones para volver en diferentes momentos
- El jugador debe **cuidar** su Baby durante momentos dificiles

---

## Tipos de Eventos Cosmicos

### 1. FASES LUNARES (Ciclo ~29.5 dias)

Afecta a **TODOS** los Babies, pero especialmente a Mystics.

| Fase | Duracion | Efecto Global | Mystic Bonus |
|------|----------|---------------|--------------|
| **Luna Nueva** | 1 dia | +10% regeneracion | +25% poder oculto |
| **Cuarto Creciente** | ~7 dias | +5% XP | +15% crecimiento |
| **Luna Llena** | 1 dia | +20% drops raros | +50% poder magico |
| **Cuarto Menguante** | ~7 dias | +5% eficiencia | +15% sabiduria |

**Implementacion:** Usar [Moon Phase API](https://www.phaseofthemoontoday.com/api-documentation) gratuita.

---

### 2. ECLIPSES (Eventos Raros)

Eventos **super especiales** que ocurren pocas veces al ano.

#### Eclipse Lunar (Blood Moon)
```
Frecuencia: ~2-3 por ano
Duracion: 3-4 horas
Efecto: TODOS los Babies +100% poder
        Drops LEGENDARIOS disponibles
        Spawn de items unicos "Eclipse Edition"
```

#### Eclipse Solar
```
Frecuencia: ~2 por ano (visibles localmente)
Duracion: 2-3 horas
Efecto: Babies ROBOT y ALIEN +200% mining
        Portal temporal a zona secreta
        Posibilidad de encontrar Mythic items
```

**Proximos Eclipses 2026:**
| Fecha | Tipo | Efecto Especial |
|-------|------|-----------------|
| Feb 17 | Solar Anular | "Ring of Fire" - +200% para Robots |
| Mar 3 | Lunar Total | "Blood Moon" - Todos +100% |
| Ago 12 | Solar Total | "Darkness Falls" - Portal abierto |
| Ago 28 | Lunar Parcial | "Shadow Touch" - +50% Mystics |

---

### 3. SOLSTICIOS Y EQUINOCCIOS (4 por ano)

Los puntos de inflexion del ano. Cada uno favorece diferentes tipos.

| Evento | Fecha | Tipo Favorecido | Efecto |
|--------|-------|-----------------|--------|
| **Equinoccio Primavera** | Mar 20 | ANIMAL | Renacimiento: +50% evolucion |
| **Solsticio Verano** | Jun 21 | HUMAN | Maximo poder: +30% todos stats |
| **Equinoccio Otono** | Sep 22 | MYSTIC | Balance: Redistribucion de XP |
| **Solsticio Invierno** | Dic 21 | ROBOT | Eficiencia maxima: +50% mining |

**Bonus por Bloodline durante Solsticio/Equinoccio:**
- Royal: +20% XP adicional
- Warrior: +20% poder adicional
- Rogue: +20% drops adicional
- Mystic: Acceso a habilidad especial temporal

---

### 4. LLUVIAS DE METEOROS (Multiples por ano)

Eventos de duracion media con rewards especiales.

| Lluvia | Pico | Intensidad | Efecto |
|--------|------|------------|--------|
| **Cuadrantidas** | Ene 3-4 | Alta (120/hr) | Lluvia de $BABY tokens |
| **Liridas** | Abr 22 | Media (20/hr) | +XP por hora |
| **Perseidas** | Ago 12-13 | Alta (100/hr) | Items cosmicos raros |
| **Geminidas** | Dic 13-14 | Alta (150/hr) | Evento de comunidad |

**Mecanica de Lluvia de Meteoros:**
```
Durante el evento (24-48 horas):
- Cada X minutos cae un "meteoro" en el juego
- El jugador puede "capturarlo" con un minijuego
- Recompensas segun rareza del meteoro:
  - Comun (70%): +10 $BABY
  - Raro (20%): +50 $BABY + item
  - Epico (8%): +200 $BABY + item raro
  - Legendario (2%): +1000 $BABY + item legendario
```

---

### 5. ALINEACIONES PLANETARIAS (Muy raras)

Los eventos mas poderosos. Ocurren pocas veces por decada.

#### Proxima Alineacion: 28 Feb 2026
**6 planetas alineados:** Mercury, Venus, Jupiter, Saturn, Uranus, Neptune

```
Efecto: "COSMIC CONVERGENCE"
- TODOS los tipos +100% stats durante 24 horas
- Spawn del item "Stardust of Alignment" (unico)
- Los 3 Mythic Masters aparecen en el juego
- Evento de comunidad global con leaderboard
```

---

## Sistema de Poder por Tipo y Evento (BIDIRECCIONAL)

Cada BaseType tiene **afinidad** con ciertos eventos cosmicos. **Ganan en su momento, pierden en el opuesto.**

### Matriz Completa de Afinidad

```
Leyenda:
  ++ = Momento de PODER (+30% a +100%)
  +  = Favorable (+10% a +25%)
  =  = Neutral (sin cambio)
  -  = Desfavorable (-10% a -20%)
  -- = Momento CRITICO (-30% a -50%)
```

| Evento | Human | Animal | Robot | Mystic | Alien |
|--------|-------|--------|-------|--------|-------|
| **Luna Nueva** | = | - | = | **++** | + |
| **Luna Llena** | + | **++** | - | **++** | = |
| **Eclipse Lunar** | + | + | -- | **++** | + |
| **Eclipse Solar** | - | -- | **++** | + | **++** |
| **Solsticio Verano** | **++** | + | -- | = | - |
| **Solsticio Invierno** | - | -- | **++** | + | = |
| **Equinoccio** | + | + | = | + | + |
| **Lluvia Meteoros** | = | = | + | + | **++** |
| **Alineacion** | + | + | + | + | **++** |

### Detalle de Penalizaciones

| Tipo | Momento Critico | Penalizacion | Como Mitigar |
|------|-----------------|--------------|--------------|
| **Human** | Solsticio Invierno | -25% energia | Items de calor, comunidad |
| **Animal** | Eclipse Solar | -30% stats | Refugio, descanso |
| **Robot** | Luna Llena | -20% eficiencia | Mantenimiento, updates |
| **Mystic** | (Ninguno critico) | -10% max | Meditacion |
| **Alien** | Solsticio Verano | -25% adaptacion | Sombra, items de frio |

### Ciclo de Energia Diario

Ademas de eventos especiales, hay un **ciclo diario** basado en Sol/Luna:

```
HUMAN:
  Dia (6am-6pm):    +15% energia
  Noche (6pm-6am): -10% energia

ANIMAL:
  Luna visible:     +10% stats
  Luna oculta:     -5% stats

ROBOT:
  24/7 estable:     Sin variacion diaria
  (Pero afectado por temperatura simulada)

MYSTIC:
  Amanecer/Atardecer: +20% (momentos liminales)
  Mediodia/Medianoche: -5%

ALIEN:
  Noche estrellada: +15%
  Dia nublado:     -10%
```

**Logica:**
- **Human:** Conectados al Sol y ciclos estacionales
- **Animal:** Responden a la Luna y ciclos naturales
- **Robot:** Maxima eficiencia en frio y eclipses solares
- **Mystic:** Poder en eventos lunares y espirituales
- **Alien:** Conexion extraterrestre, meteoros y alineaciones

---

## Sistema de Herencia Cultural + Eventos

La herencia cultural del Baby modifica ligeramente su respuesta a eventos.

| Herencia | Evento Favorito | Bonus Extra |
|----------|-----------------|-------------|
| Americas | Solsticios | +10% (culturas solares) |
| Africa | Luna Llena | +10% (tradiciones lunares) |
| Asia | Equinoccios | +10% (balance yin-yang) |
| Europa | Eclipses | +10% (tradiciones astronomicas) |
| Oceania | Lluvias de Meteoros | +10% (navegacion estelar) |

---

## Implementacion Tecnica

### Solucion Elegida: Astronomy Engine (Open Source)

**Por que Astronomy Engine:**
- 100% gratuito y open source (MIT license)
- Sin API key, funciona localmente
- Soporta JavaScript/TypeScript nativamente
- Preciso a ±1 arcminuto (nivel NASA)
- Funciona offline (no dependemos de servidores externos)
- Facil de cambiar en el futuro (interfaz modular)

**Instalacion:**
```bash
pnpm add astronomy-engine --filter @bitcoinbaby/core
```

**GitHub:** https://github.com/cosinekitty/astronomy

### Arquitectura Modular (Facil de Cambiar)

```
┌─────────────────────────────────────────────────────────┐
│                    COSMIC SERVICE                        │
│  (Interface abstracta - facil de cambiar proveedor)     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Astronomy   │  │ NASA API    │  │ Custom API  │     │
│  │ Engine      │  │ (futuro)    │  │ (futuro)    │     │
│  │ (default)   │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│              ┌───────────▼───────────┐                  │
│              │  CosmicDataProvider   │                  │
│              │  (Interface comun)    │                  │
│              └───────────────────────┘                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### APIs de Backup (Para el Futuro)

| API | Costo | Uso |
|-----|-------|-----|
| **Astronomy Engine** | Gratis | Default - local |
| **NASA Dial-A-Moon** | Gratis | Backup para Luna |
| **IPGeolocation** | Freemium | Sol/Luna por ubicacion |
| **TimeAndDate** | $99/ano | Cuando escalemos |

### Estructura de Datos

```typescript
// types/cosmic.ts

// Multiplicador puede ser positivo (bonus) o negativo (penalizacion)
interface TypeMultiplier {
  human: number;    // -0.5 a +1.5
  animal: number;
  robot: number;
  mystic: number;
  alien: number;
}

interface CosmicEvent {
  id: string;
  type: 'lunar_phase' | 'eclipse' | 'solstice' | 'equinox' | 'meteor_shower' | 'alignment';
  name: string;
  startTime: Date;
  endTime: Date;
  intensity: number; // 0-1
  multipliers: TypeMultiplier; // Ahora incluye negativos!
  specialRewards?: string[];
  isCritical?: boolean; // Evento critico que requiere atencion
}

interface CosmicState {
  // Evento actual (puede ser null)
  currentEvent: CosmicEvent | null;

  // Proximos eventos
  upcomingEvents: CosmicEvent[];

  // Estado lunar
  moon: {
    phase: MoonPhase;
    illumination: number; // 0-100
    isVisible: boolean;
    nextFullMoon: Date;
    nextNewMoon: Date;
  };

  // Estado solar
  sun: {
    isDay: boolean;
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
  };

  // Estado de estaciones
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  daysUntilNextSolstice: number;
  daysUntilNextEquinox: number;
}

type MoonPhase =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

// Energia del Baby afectada por cosmos
interface BabyCosmicEnergy {
  baseEnergy: number;      // Energia base del Baby
  cosmicMultiplier: number; // Multiplicador actual (-0.5 a +1.5)
  effectiveEnergy: number;  // baseEnergy * (1 + cosmicMultiplier)
  status: 'thriving' | 'normal' | 'struggling' | 'critical';
  activeEffects: string[]; // Lista de efectos activos
  warnings: string[];      // Advertencias para el jugador
}
```

### Implementacion con Astronomy Engine

```typescript
// packages/core/src/cosmic/provider.ts
import * as Astronomy from 'astronomy-engine';

/**
 * Interface abstracta - permite cambiar de proveedor facilmente
 */
export interface ICosmicProvider {
  getMoonPhase(date: Date): MoonPhaseData;
  getSunPosition(date: Date, lat: number, lon: number): SunData;
  getNextEclipse(date: Date): EclipseData | null;
  getNextSolsticeOrEquinox(date: Date): SeasonalEvent;
  getCurrentSeason(date: Date, hemisphere: 'north' | 'south'): Season;
}

/**
 * Proveedor por defecto usando Astronomy Engine (gratis, local)
 */
export class AstronomyEngineProvider implements ICosmicProvider {

  getMoonPhase(date: Date): MoonPhaseData {
    const phase = Astronomy.MoonPhase(date);
    const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);

    return {
      phase: this.phaseAngleToName(phase),
      angle: phase,
      illumination: illum.phase_fraction * 100,
      emoji: this.getPhaseEmoji(phase),
    };
  }

  getSunPosition(date: Date, lat: number, lon: number): SunData {
    const observer = new Astronomy.Observer(lat, lon, 0);
    const sunrise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, date, 1);
    const sunset = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, date, 1);

    return {
      isDay: this.isDaytime(date, sunrise?.date, sunset?.date),
      sunrise: sunrise?.date || null,
      sunset: sunset?.date || null,
    };
  }

  getNextEclipse(date: Date): EclipseData | null {
    // Buscar proximo eclipse lunar
    const lunarEclipse = Astronomy.SearchLunarEclipse(date);
    // Buscar proximo eclipse solar
    const solarEclipse = Astronomy.SearchGlobalSolarEclipse(date);

    // Retornar el mas cercano
    if (!lunarEclipse && !solarEclipse) return null;
    // ... logica de comparacion
  }

  getNextSolsticeOrEquinox(date: Date): SeasonalEvent {
    const seasons = Astronomy.Seasons(date.getFullYear());
    const now = date.getTime();

    const events = [
      { type: 'spring_equinox', date: seasons.mar_equinox.date },
      { type: 'summer_solstice', date: seasons.jun_solstice.date },
      { type: 'autumn_equinox', date: seasons.sep_equinox.date },
      { type: 'winter_solstice', date: seasons.dec_solstice.date },
    ];

    // Encontrar el proximo evento
    return events.find(e => e.date.getTime() > now) || events[0];
  }

  private phaseAngleToName(angle: number): MoonPhase {
    if (angle < 22.5) return 'new';
    if (angle < 67.5) return 'waxing_crescent';
    if (angle < 112.5) return 'first_quarter';
    if (angle < 157.5) return 'waxing_gibbous';
    if (angle < 202.5) return 'full';
    if (angle < 247.5) return 'waning_gibbous';
    if (angle < 292.5) return 'last_quarter';
    if (angle < 337.5) return 'waning_crescent';
    return 'new';
  }

  private getPhaseEmoji(angle: number): string {
    if (angle < 22.5) return '🌑';
    if (angle < 67.5) return '🌒';
    if (angle < 112.5) return '🌓';
    if (angle < 157.5) return '🌔';
    if (angle < 202.5) return '🌕';
    if (angle < 247.5) return '🌖';
    if (angle < 292.5) return '🌗';
    if (angle < 337.5) return '🌘';
    return '🌑';
  }
}

/**
 * Proveedor de NASA API (para futuro)
 */
export class NasaApiProvider implements ICosmicProvider {
  // Implementar cuando necesitemos cambiar
  // Solo hay que implementar la misma interface
}
```

### Servicio de Energia Cosmica

```typescript
// packages/core/src/cosmic/energy-calculator.ts

/**
 * Calcula la energia del Baby basada en eventos cosmicos
 */
export function calculateCosmicEnergy(
  baby: BabyNFT,
  cosmicState: CosmicState
): BabyCosmicEnergy {
  const { baseType, bloodline } = baby;
  let multiplier = 0;
  const effects: string[] = [];
  const warnings: string[] = [];

  // 1. Efecto de fase lunar
  const moonEffect = getMoonPhaseEffect(baseType, cosmicState.moon.phase);
  multiplier += moonEffect.value;
  if (moonEffect.value !== 0) effects.push(moonEffect.description);

  // 2. Efecto de dia/noche
  const dayNightEffect = getDayNightEffect(baseType, cosmicState.sun.isDay);
  multiplier += dayNightEffect.value;
  if (dayNightEffect.value !== 0) effects.push(dayNightEffect.description);

  // 3. Efecto de estacion
  const seasonEffect = getSeasonEffect(baseType, cosmicState.season);
  multiplier += seasonEffect.value;
  if (seasonEffect.value !== 0) effects.push(seasonEffect.description);

  // 4. Efecto de evento especial (eclipse, alineacion, etc)
  if (cosmicState.currentEvent) {
    const eventMultiplier = cosmicState.currentEvent.multipliers[baseType];
    multiplier += eventMultiplier;
    effects.push(`${cosmicState.currentEvent.name}: ${formatMultiplier(eventMultiplier)}`);

    if (eventMultiplier < -0.2) {
      warnings.push(`⚠️ ${cosmicState.currentEvent.name} afecta negativamente a tu Baby`);
    }
  }

  // 5. Bonus de bloodline
  const bloodlineBonus = getBloodlineBonus(bloodline, cosmicState);
  multiplier += bloodlineBonus;

  // Calcular energia efectiva
  const effectiveEnergy = baby.energy * (1 + multiplier);

  // Determinar status
  let status: BabyCosmicEnergy['status'];
  if (multiplier >= 0.3) status = 'thriving';
  else if (multiplier >= 0) status = 'normal';
  else if (multiplier >= -0.2) status = 'struggling';
  else status = 'critical';

  // Advertencia si esta en estado critico
  if (status === 'critical') {
    warnings.push('🚨 Tu Baby necesita cuidado urgente!');
  }

  return {
    baseEnergy: baby.energy,
    cosmicMultiplier: multiplier,
    effectiveEnergy: Math.max(0, effectiveEnergy),
    status,
    activeEffects: effects,
    warnings,
  };
}

// Tablas de efectos por tipo
const MOON_EFFECTS: Record<BaseType, Record<MoonPhase, number>> = {
  human: {
    new: 0, waxing_crescent: 0.05, first_quarter: 0.1, waxing_gibbous: 0.1,
    full: 0.15, waning_gibbous: 0.05, last_quarter: 0, waning_crescent: -0.05,
  },
  animal: {
    new: -0.1, waxing_crescent: 0.1, first_quarter: 0.15, waxing_gibbous: 0.2,
    full: 0.4, waning_gibbous: 0.15, last_quarter: 0.05, waning_crescent: -0.05,
  },
  robot: {
    new: 0.05, waxing_crescent: 0, first_quarter: 0, waxing_gibbous: -0.05,
    full: -0.15, waning_gibbous: -0.05, last_quarter: 0.05, waning_crescent: 0.1,
  },
  mystic: {
    new: 0.5, waxing_crescent: 0.2, first_quarter: 0.1, waxing_gibbous: 0.2,
    full: 0.4, waning_gibbous: 0.2, last_quarter: 0.1, waning_crescent: 0.3,
  },
  alien: {
    new: 0.1, waxing_crescent: 0.05, first_quarter: 0, waxing_gibbous: 0,
    full: 0.1, waning_gibbous: 0.05, last_quarter: 0.1, waning_crescent: 0.15,
  },
};
```

### Hook de React

```typescript
// packages/core/src/hooks/useCosmicEnergy.ts
import { useEffect, useState, useMemo } from 'react';
import { AstronomyEngineProvider } from '../cosmic/provider';
import { calculateCosmicEnergy } from '../cosmic/energy-calculator';

const provider = new AstronomyEngineProvider();

export function useCosmicEnergy(baby: BabyNFT | null) {
  const [cosmicState, setCosmicState] = useState<CosmicState | null>(null);

  // Actualizar estado cosmico cada minuto
  useEffect(() => {
    const updateCosmicState = () => {
      const now = new Date();
      const lat = 0; // Default, o usar geolocalizacion
      const lon = 0;

      setCosmicState({
        currentEvent: detectCurrentEvent(now),
        upcomingEvents: getUpcomingEvents(now, 7), // Proximos 7 dias
        moon: provider.getMoonPhase(now),
        sun: provider.getSunPosition(now, lat, lon),
        season: provider.getCurrentSeason(now, 'north'),
        daysUntilNextSolstice: calculateDaysUntil(provider.getNextSolsticeOrEquinox(now)),
      });
    };

    updateCosmicState();
    const interval = setInterval(updateCosmicState, 60000); // Cada minuto
    return () => clearInterval(interval);
  }, []);

  // Calcular energia del Baby
  const energy = useMemo(() => {
    if (!baby || !cosmicState) return null;
    return calculateCosmicEnergy(baby, cosmicState);
  }, [baby, cosmicState]);

  return {
    cosmicState,
    energy,
    isLoading: !cosmicState,
  };
}
```

---

## UI/UX del Sistema Cosmico

### Indicador de Estado en Pantalla Principal

El jugador debe ver SIEMPRE como esta su Baby respecto al cosmos:

```
┌─────────────────────────────────────────────────────┐
│  🌓 Luna Creciente (68%)            ☀️ Dia         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ESTADO COSMICO DE TU BABY:                         │
│                                                     │
│  ████████████░░░░░░  75% Energia                   │
│                                                     │
│  ✅ Luna favorable: +15%                            │
│  ✅ Momento del dia: +10%                           │
│  ⚠️ Estacion: -5% (Invierno afecta a Animals)      │
│                                                     │
│  Resultado: +20% energia efectiva                   │
│                                                     │
│  Proximo evento: 🌕 Luna Llena en 3d               │
│  (Tu Animal tendra +40%!)                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Estados Visuales del Baby

El sprite del Baby debe CAMBIAR segun su estado cosmico:

| Estado | Visual | Color Aura | Animacion |
|--------|--------|------------|-----------|
| **Thriving** (+30%+) | Brillante, activo | Dorado/Verde | Rapida, particulas |
| **Normal** (0% a +30%) | Normal | Sin aura | Normal |
| **Struggling** (-20% a 0%) | Opaco, lento | Gris | Lenta |
| **Critical** (-20%-) | Muy opaco, triste | Rojo pulsante | Muy lenta, temblor |

### Alertas y Notificaciones

```
// Alerta POSITIVA (cuando su momento llega)
┌─────────────────────────────────────┐
│  🌕 ¡LUNA LLENA!                    │
│                                     │
│  Tu Animal Baby esta en su          │
│  momento de maximo poder!           │
│                                     │
│  +40% a todos los stats             │
│  Duracion: 24 horas                 │
│                                     │
│  [¡Ir a Minar Ahora!]               │
└─────────────────────────────────────┘

// Alerta NEGATIVA (cuando necesita cuidado)
┌─────────────────────────────────────┐
│  ☀️ ECLIPSE SOLAR ACTIVO            │
│                                     │
│  ⚠️ Tu Animal Baby esta             │
│  sufriendo! (-30% energia)          │
│                                     │
│  Recomendaciones:                   │
│  • Usa item "Sombra Protectora"     │
│  • Dejalo descansar                 │
│  • Espera 3 horas a que pase        │
│                                     │
│  [Ir a Cuidarlo] [Ver Items]        │
└─────────────────────────────────────┘
```

### Notificaciones de Eventos

```
🌕 LUNA LLENA ACTIVA
Tu Mystic Baby tiene +40% poder magico
durante las proximas 24 horas!

[Ver Detalles] [Ir a Minar]
```

### Calendario Cosmico (Pantalla Dedicada)

Vista mensual con:
- Fases lunares marcadas
- Eventos especiales destacados
- Prediccion de bonus para tu Baby especifico
- Countdown a proximos eventos importantes

---

## Calendario 2026 Completo

### Eventos Mayores

| Fecha | Evento | Tipo | Intensidad |
|-------|--------|------|------------|
| Ene 3-4 | Cuadrantidas | Meteoros | Alta |
| Ene 10 | Jupiter en Oposicion | Planeta | Media |
| Feb 17 | Eclipse Solar Anular | Eclipse | Alta |
| Feb 28 | Alineacion 6 Planetas | Alineacion | **Maxima** |
| Mar 3 | Eclipse Lunar Total | Eclipse | Alta |
| Mar 20 | Equinoccio Primavera | Estacional | Media |
| Abr 22 | Liridas | Meteoros | Media |
| Jun 21 | Solsticio Verano | Estacional | Alta |
| Ago 12 | Eclipse Solar Total | Eclipse | **Maxima** |
| Ago 12-13 | Perseidas | Meteoros | Alta |
| Ago 28 | Eclipse Lunar Parcial | Eclipse | Media |
| Sep 22 | Equinoccio Otono | Estacional | Media |
| Sep 25 | Neptuno en Oposicion | Planeta | Baja |
| Oct 4 | Saturno en Oposicion | Planeta | Media |
| Dic 13-14 | Geminidas | Meteoros | Alta |
| Dic 21 | Solsticio Invierno | Estacional | Alta |

---

## Integracion con Bitcoin

Los eventos de Bitcoin tambien son "cosmicos" en el universo del juego.

| Evento Bitcoin | Frecuencia | Efecto |
|----------------|------------|--------|
| **Halving** | ~4 anos | Todos suben 1 nivel + rewards especiales |
| **Block Milestone** | Cada 100k bloques | Evento de comunidad |
| **ATH** | Variable | Lluvia de $BABY tokens |
| **Difficulty Up** | ~2 semanas | Robots +20% |
| **Mempool Full** | Variable | Rogues +30% (oportunidades) |

---

## Resumen

El sistema cosmico hace que Genesis Babies se sienta **vivo y conectado** con el mundo real:

1. **Eventos reales** = Engagement continuo
2. **Cada tipo brilla** en diferentes momentos
3. **Razon para volver** = "Hay luna llena manana!"
4. **Comunidad** = Eventos globales compartidos
5. **Profundidad opcional** = Casual puede ignorar, hardcore optimiza

---

*"Mira al cielo. Tu Baby ya lo esta haciendo."*
