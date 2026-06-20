# Sistema de Mundo Dinamico - Genesis Babies

> **"Un mundo que respira, cambia y sorprende"**

Este documento define como hacer que el mundo de Genesis Babies sea dinamico y no estatico, usando algoritmos eficientes y opcionalmente AI.

---

## Objetivo

Que cada jugador sienta que:
- El mundo esta **vivo** y cambia constantemente
- Su Baby tiene **personalidad unica** que evoluciona
- Los eventos son **impredecibles** pero coherentes
- Las causas tienen **efectos** realistas

---

## Tres Capas de Dinamismo

### Capa 1: Procedural Generation (Ligera, Sin AI)
**Recursos:** Minimos (~1MB de codigo)
**Uso:** Siempre activo

### Capa 2: Rule-Based AI (Ligera, Determinista)
**Recursos:** Bajos (~500KB de reglas)
**Uso:** Comportamientos y decisiones

### Capa 3: Transformers.js (Opcional, AI Real)
**Recursos:** Medios (50-500MB de modelo)
**Uso:** Textos unicos, dialogos especiales

---

## Capa 1: Procedural Generation

### 1.1 Sistema de Semillas (Seeds)

Cada Baby tiene un DNA que actua como semilla para generar contenido unico.

```typescript
interface BabySeed {
  dna: string;           // 32 chars hex = semilla principal
  tokenId: number;       // Identificador unico
  birthBlock: number;    // Bloque de nacimiento = variacion temporal
  ownerHash: string;     // Hash del dueno = variacion por jugador
}

// Generar numero pseudo-aleatorio determinista
function seededRandom(seed: string, offset: number = 0): number {
  const hash = hashString(seed + offset.toString());
  return (hash % 10000) / 10000; // 0.0 - 1.0
}
```

### 1.2 Variaciones de Personalidad

Cada Baby tiene personalidad generada proceduralmente:

```typescript
interface BabyPersonality {
  // Rasgos principales (0-100)
  energy: number;      // Activo vs Tranquilo
  social: number;      // Extrovertido vs Introvertido
  curious: number;     // Explorador vs Cauteloso
  stubborn: number;    // Terco vs Flexible
  playful: number;     // Jugueton vs Serio

  // Preferencias
  favoriteTime: 'morning' | 'afternoon' | 'evening' | 'night';
  favoriteWeather: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  favoriteActivity: 'mining' | 'playing' | 'learning' | 'sleeping';

  // Quirks unicos
  quirks: string[];    // "Le gusta girar en circulos", "Odia los lunes"
}

function generatePersonality(seed: BabySeed): BabyPersonality {
  const r = (offset: number) => seededRandom(seed.dna, offset);

  return {
    energy: Math.floor(r(0) * 100),
    social: Math.floor(r(1) * 100),
    curious: Math.floor(r(2) * 100),
    stubborn: Math.floor(r(3) * 100),
    playful: Math.floor(r(4) * 100),

    favoriteTime: ['morning', 'afternoon', 'evening', 'night'][Math.floor(r(5) * 4)],
    favoriteWeather: ['sunny', 'cloudy', 'rainy', 'stormy'][Math.floor(r(6) * 4)],
    favoriteActivity: ['mining', 'playing', 'learning', 'sleeping'][Math.floor(r(7) * 4)],

    quirks: selectQuirks(seed, 2), // 2 quirks aleatorios
  };
}
```

### 1.3 Clima Dinamico

El clima cambia basado en tiempo real + ruido Perlin:

```typescript
interface Weather {
  type: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
  intensity: number;    // 0-1
  temperature: number;  // -20 to 45
  humidity: number;     // 0-100
  windSpeed: number;    // 0-100
}

function getCurrentWeather(date: Date, location: CosmicState): Weather {
  // Usar simplex noise para variacion suave
  const timeNoise = simplexNoise2D(
    date.getTime() / (1000 * 60 * 60 * 6), // Cambia cada 6 horas aprox
    location.season.current === 'winter' ? 1 : 0
  );

  // Combinar con datos cosmicos reales
  const moonInfluence = location.moon.illumination / 100;

  // Generar clima
  const baseTemp = getSeasonBaseTemp(location.season.current);
  const variation = timeNoise * 10;

  return {
    type: determineWeatherType(timeNoise, location.season.current),
    intensity: Math.abs(timeNoise),
    temperature: baseTemp + variation,
    humidity: 50 + timeNoise * 30 + moonInfluence * 20,
    windSpeed: Math.abs(timeNoise) * 50,
  };
}
```

### 1.4 Mini-Eventos Procedurales

Eventos pequenos que ocurren aleatoriamente pero con logica:

```typescript
const MINI_EVENTS = [
  {
    id: 'found_coin',
    name: 'Moneda Encontrada',
    description: 'Tu Baby encontro una moneda brillante!',
    probability: 0.05, // 5% por hora
    conditions: { minLevel: 1, weather: ['sunny', 'cloudy'] },
    effect: { reward: { baby: 10 } },
  },
  {
    id: 'butterfly_friend',
    name: 'Amigo Mariposa',
    description: 'Una mariposa se poso en tu Baby',
    probability: 0.03,
    conditions: { minLevel: 1, weather: ['sunny'], season: ['spring', 'summer'] },
    effect: { mood: +10, xp: 5 },
  },
  {
    id: 'stubbed_toe',
    name: 'Tropiezo',
    description: 'Tu Baby se tropezo con una piedra',
    probability: 0.02,
    conditions: { personality: { curious: { min: 70 } } },
    effect: { mood: -5 },
  },
  // ... mas eventos
];

function checkForMiniEvents(baby: Baby, state: GameState): MiniEvent[] {
  const triggered: MiniEvent[] = [];

  for (const event of MINI_EVENTS) {
    if (meetsConditions(baby, state, event.conditions)) {
      const roll = seededRandom(baby.dna + Date.now().toString(), event.id.length);
      if (roll < event.probability) {
        triggered.push(event);
      }
    }
  }

  return triggered;
}
```

---

## Capa 2: Rule-Based AI (Comportamientos)

### 2.1 Sistema de Necesidades

El Baby tiene necesidades que cambian su comportamiento:

```typescript
interface BabyNeeds {
  hunger: number;      // 0-100 (100 = muy hambriento)
  energy: number;      // 0-100 (0 = agotado)
  happiness: number;   // 0-100
  social: number;      // 0-100 (necesidad de interaccion)
  boredom: number;     // 0-100
}

// Las necesidades cambian con el tiempo
function updateNeeds(baby: Baby, deltaTime: number): BabyNeeds {
  const personality = baby.personality;
  const cosmicState = getCurrentCosmicState();

  return {
    hunger: baby.needs.hunger + (deltaTime * 0.5), // Aumenta con tiempo
    energy: baby.needs.energy - (deltaTime * getEnergyDrain(baby, cosmicState)),
    happiness: calculateHappiness(baby, cosmicState),
    social: baby.needs.social + (personality.social > 50 ? deltaTime * 0.3 : deltaTime * 0.1),
    boredom: baby.needs.boredom + (personality.curious > 50 ? deltaTime * 0.4 : deltaTime * 0.2),
  };
}
```

### 2.2 Arbol de Decisiones

El Baby "decide" que hacer basado en sus necesidades:

```typescript
type BabyAction =
  | 'idle'
  | 'eating'
  | 'sleeping'
  | 'playing'
  | 'mining'
  | 'exploring'
  | 'socializing'
  | 'complaining';

function decideBabyAction(baby: Baby): BabyAction {
  const needs = baby.needs;
  const personality = baby.personality;

  // Prioridad 1: Necesidades criticas
  if (needs.energy < 10) return 'sleeping';
  if (needs.hunger > 90) return 'complaining'; // Pide comida

  // Prioridad 2: Necesidades altas
  if (needs.hunger > 70) return 'eating';
  if (needs.energy < 30) return 'sleeping';

  // Prioridad 3: Preferencias de personalidad
  if (needs.boredom > 60 && personality.curious > 50) return 'exploring';
  if (needs.social > 60 && personality.social > 50) return 'socializing';
  if (needs.boredom > 40 && personality.playful > 50) return 'playing';

  // Prioridad 4: Actividad por defecto segun momento cosmico
  const cosmicBonus = getCosmicBonus(baby);
  if (cosmicBonus > 0.2) return 'mining'; // Buen momento para minar

  return 'idle';
}
```

### 2.3 Sistema de Emociones

Las emociones afectan el comportamiento y la UI:

```typescript
type Emotion =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'scared'
  | 'excited'
  | 'bored'
  | 'tired'
  | 'hungry'
  | 'curious'
  | 'proud';

interface EmotionState {
  primary: Emotion;
  secondary: Emotion | null;
  intensity: number; // 0-1
  trigger: string;   // Que lo causo
}

function calculateEmotion(baby: Baby, recentEvents: GameEvent[]): EmotionState {
  // Evaluar eventos recientes
  const lastEvent = recentEvents[0];
  if (lastEvent?.type === 'reward') {
    return { primary: 'happy', secondary: 'excited', intensity: 0.8, trigger: 'Recibio recompensa' };
  }

  // Evaluar necesidades
  if (baby.needs.hunger > 80) {
    return { primary: 'hungry', secondary: 'angry', intensity: 0.7, trigger: 'Tiene hambre' };
  }

  // Evaluar momento cosmico
  const cosmicEnergy = calculateCosmicEnergy(baby);
  if (cosmicEnergy.status === 'thriving') {
    return { primary: 'happy', secondary: 'proud', intensity: 0.6, trigger: 'Momento cosmico favorable' };
  }
  if (cosmicEnergy.status === 'critical') {
    return { primary: 'tired', secondary: 'sad', intensity: 0.7, trigger: 'Momento cosmico desfavorable' };
  }

  // Default basado en personalidad
  return { primary: 'happy', secondary: null, intensity: 0.5, trigger: 'Estado normal' };
}
```

### 2.4 Cadenas de Causa-Efecto

Los eventos tienen consecuencias que generan nuevos eventos:

```typescript
interface CauseEffect {
  cause: string;
  effect: string;
  probability: number;
  delay: number; // ms hasta que ocurra el efecto
}

const CAUSE_EFFECTS: CauseEffect[] = [
  {
    cause: 'baby_hungry_ignored',
    effect: 'baby_mood_decrease',
    probability: 1.0,
    delay: 5 * 60 * 1000, // 5 minutos
  },
  {
    cause: 'baby_mood_decrease',
    effect: 'baby_productivity_decrease',
    probability: 0.8,
    delay: 10 * 60 * 1000,
  },
  {
    cause: 'mining_success',
    effect: 'baby_experience_gain',
    probability: 1.0,
    delay: 0,
  },
  {
    cause: 'cosmic_event_favorable',
    effect: 'baby_bonus_temporary',
    probability: 1.0,
    delay: 0,
  },
  // ... mas cadenas
];
```

---

## Capa 3: Transformers.js (Opcional)

### 3.1 Cuando Usar AI Real

| Caso de Uso | Modelo Sugerido | Tamano | Necesario? |
|-------------|-----------------|--------|------------|
| Dialogos de Baby | SmolLM-135M | ~135MB | Opcional |
| Descripciones de items | Qwen2.5-0.5B | ~500MB | Opcional |
| Historias de eventos | Llama-3.2-1B | ~1GB | Lujo |
| Nombres procedurales | Reglas simples | 0MB | NO necesita AI |

### 3.2 Implementacion Ligera

```typescript
// Solo cargar AI cuando se necesita
let aiModel: TextGenerationPipeline | null = null;

async function loadAIModel() {
  if (aiModel) return aiModel;

  const { pipeline } = await import('@xenova/transformers');

  // Modelo pequeno para browser
  aiModel = await pipeline('text-generation', 'HuggingFaceTB/SmolLM-135M', {
    quantized: true, // Version comprimida
  });

  return aiModel;
}

// Generar texto solo cuando se pide
async function generateBabyThought(baby: Baby, context: string): Promise<string> {
  // Primero intentar con templates (sin AI)
  const template = getThoughtTemplate(baby, context);
  if (template) return template;

  // Si no hay template, usar AI
  const model = await loadAIModel();
  const prompt = `El Baby ${baby.name} de tipo ${baby.baseType} esta ${context}. Piensa: "`;

  const result = await model(prompt, {
    max_new_tokens: 30,
    temperature: 0.7,
  });

  return result[0].generated_text.split('"')[1] || template;
}
```

### 3.3 Templates Sin AI (Recomendado)

Para la mayoria de casos, templates con variaciones son suficientes:

```typescript
const THOUGHT_TEMPLATES = {
  hungry: [
    "Tengo hambre...",
    "Mi pancita hace ruidos",
    "Quisiera comer algo rico",
    "Cuando es hora de comer?",
  ],
  happy: [
    "Que bonito dia!",
    "Me siento genial",
    "La vida es bella",
    "Estoy muy contento",
  ],
  mining: [
    "Hash hash hash...",
    "Encontrare el nonce!",
    "Minando con energia",
    "Proof of Work!",
  ],
  // ... mas templates por estado
};

function getBabyThought(baby: Baby): string {
  const emotion = baby.emotion.primary;
  const templates = THOUGHT_TEMPLATES[emotion] || THOUGHT_TEMPLATES.happy;

  // Seleccionar template basado en DNA (determinista pero variado)
  const index = Math.floor(seededRandom(baby.dna, Date.now() / (1000 * 60)) * templates.length);
  return templates[index];
}
```

---

## Costos y Recursos

### Sin AI (Recomendado para MVP)

| Componente | Tamano | RAM | CPU |
|------------|--------|-----|-----|
| Procedural Gen | ~50KB | ~5MB | Minimo |
| Rule-Based AI | ~100KB | ~10MB | Minimo |
| Templates | ~50KB | ~2MB | Minimo |
| **TOTAL** | ~200KB | ~17MB | Minimo |

### Con Transformers.js (Opcional)

| Componente | Tamano | RAM | CPU/GPU |
|------------|--------|-----|---------|
| SmolLM-135M | ~135MB | ~500MB | Medio |
| Qwen2.5-0.5B | ~500MB | ~1GB | Alto |
| Llama-3.2-1B | ~1GB | ~2GB | Alto (WebGPU) |

**Recomendacion:** Empezar SIN AI, agregar Transformers.js solo para features premium o desktop.

---

## Implementacion por Fases

### Fase 1: MVP (Sin AI)
- [x] Procedural personality generation
- [x] Weather system con noise
- [ ] Mini-eventos aleatorios
- [ ] Sistema de necesidades
- [ ] Arbol de decisiones basico

### Fase 2: Mejoras
- [ ] Cadenas causa-efecto
- [ ] Sistema de emociones completo
- [ ] Templates de dialogos
- [ ] Eventos en cadena

### Fase 3: AI Opcional
- [ ] Integracion Transformers.js
- [ ] Dialogos generados por AI
- [ ] Descripciones unicas de items
- [ ] Sistema de historias

---

## Resumen

| Pregunta | Respuesta |
|----------|-----------|
| **Es posible?** | Si, muy posible |
| **Necesita AI pesada?** | No, procedural es suficiente para 90% |
| **Cuantos recursos?** | Minimos sin AI (~17MB RAM) |
| **Cuando usar AI real?** | Features premium, dialogos unicos |
| **Modelo recomendado?** | SmolLM-135M (si se usa AI) |

---

*"El mejor AI es el que parece inteligente pero usa trucos simples."*

**Sources:**
- [Procedural Generation - Wikipedia](https://en.wikipedia.org/wiki/Procedural_generation)
- [Transformers.js - Hugging Face](https://huggingface.co/docs/transformers.js)
- [Crafting Dynamic Game Worlds](https://www.designthegame.com/learning/tutorial/crafting-dynamic-game-worlds-procedural-generation)
