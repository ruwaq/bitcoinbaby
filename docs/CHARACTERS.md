# BitcoinBaby - Character Design Guide

> Pixel Art 8-bit Character Ecosystem

## Design Philosophy

All characters follow the **retro pixel art aesthetic** inspired by:
- Tamagotchi virtual pets
- NES/SNES RPG sprites
- Retro arcade games

**Core Style Rules:**
- Clean black outlines (2px minimum)
- Limited color palette (16 colors max)
- 16x16, 32x32, or 64x64 pixel grids
- Flat 2D, no gradients
- Isolated on transparent/white background

---

## Main Characters

### BitcoinBaby Logo (Base Design)

The core mascot of the ecosystem.

```
Prompt: 8-bit pixel art logo of a cute chubby robot baby shaped like
the Bitcoin 'B' logo. It is hatching from a cybernetic egg. The top
of its head is transparent, showing a glowing electric cyan and magical
purple neural network brain. It is holding a small yellow lightning bolt.
Retro virtual pet Tamagotchi aesthetic, flat 2D, clean black outlines,
solid white background. Main colors: Bitcoin orange, cyan, purple.
```

**Color Palette:**
- Body: `#f7931a` (Bitcoin Orange)
- Brain Glow: `#4fc3f7` (Cyan) + `#8b5cf6` (Purple)
- Lightning: `#ffc107` (Yellow)
- Outlines: `#1f2937` (Dark Gray)

---

## NPCs & Companions

### El Oraculo del Mempool (The Guide NPC)

A wise, ancient robotic wizard that guides users through the blockchain mysteries.
Appears in tutorials, help sections, and lore pages.

```
Prompt: 8-bit pixel art character sprite of a wise, ancient robotic wizard.
It has a long flowing beard made of grey pixelated cables. It wears robes
that look like scrolling green binary code data. A large, glowing red
mechanical scanning eye is in the center of its forehead. It holds a staff
topped with a glowing block. Retro RPG NPC style, clean black outlines,
isolated on solid white background.
```

**Color Palette:**
- Robes: `#0f0f1b` (Dark) with `#4ade80` (Green) binary patterns
- Beard/Cables: `#6b7280` (Gray)
- Eye: `#ef4444` (Red glow)
- Staff Block: `#f7931a` (Bitcoin Orange)

**Use Cases:**
- Tutorial popups
- Help tooltips
- Loading screens with tips
- Whitepaper illustrations

---

### Los Sato-Bots (Helper Companions)

Tiny flying drones representing satoshis and micro-transactions.
Appear in groups, following the Baby or indicating rewards.

```
Prompt: 8-bit pixel art sprite set of three tiny, identical helper bots.
They are small, round, golden-orange flying drones, resembling little
pixelated coins with tiny antennas and propellers. They have small blue
glowing eyes and leave a tiny pixel sparkle trail. Retro arcade game
item style, isolated on solid white background.
```

**Color Palette:**
- Body: `#f7931a` (Bitcoin Orange)
- Eyes: `#4fc3f7` (Cyan)
- Propeller: `#6b7280` (Gray)
- Sparkle Trail: `#ffc107` (Yellow)

**Use Cases:**
- Mining rewards animation
- Transaction confirmations
- Achievement unlocks
- Background decoration

---

## Baby Evolution Stages

### Stage 0: El Huevo de Codigo (The Code Egg)

The dormant state before the Baby is born. Heavy with potential.

```
Prompt: 8-bit pixel art item. A large, dormant metallic cybernetic egg
resting on the ground. The shell is made of grey and dark blue pixelated
metal plates with glowing orange circuit patterns leaking through cracks.
It looks heavy and inactive. Retro sci-fi game asset style, clean black
outlines, isolated on solid white background.
```

**Color Palette:**
- Shell: `#374151` (Gray) + `#1a1a2e` (Dark Blue)
- Circuits: `#f7931a` (Orange glow)
- Cracks: `#000000` (Black)

**States:**
- `dormant` - No animation, dim circuits
- `warming` - Circuits pulse slowly
- `hatching` - Shake animation, bright circuits

**Appears When:**
- New user onboarding
- Before first mining session
- Account creation flow

---

### Stage 1: El Bebe Nodo (Baby Node) - CURRENT

The active Baby that mines and learns. Your main companion.

```
Prompt: 8-bit pixel art character sprite. The cute orange Bitcoin 'B'
shaped robot baby character. It has a transparent dome head revealing
a glowing electric cyan and magical purple pixelated neural network brain.
It has a smiling face and is holding up a small yellow lightning bolt.
Standing pose ready for action. Clean black outlines, isolated on solid
white background.
```

**Color Palette:**
- Body: `#f7931a` (Bitcoin Orange)
- Body Highlight: `#ffc107` (Light Orange)
- Body Shadow: `#e67e00` (Dark Orange)
- Brain: `#4fc3f7` (Cyan) + `#8b5cf6` (Purple)
- Lightning: `#ffc107` (Yellow)
- Eyes: `#1f2937` (Dark) with `#ffffff` shine

**States:**
- `idle` - Floating animation
- `happy` - Bouncing, sparkles
- `sleeping` - Eyes closed, "Zzz", blue tint
- `hungry` - Shaking, orange tint
- `mining` - Glowing, sparkles flying
- `learning` - Brain pulses brighter
- `evolving` - Rainbow effect, particles

**Level Range:** 1-10

---

### Stage 2: El Cypher-Adolescente (The Evolved Teen)

The mature, advanced form showing AI model growth.

```
Prompt: 8-bit pixel art character, evolved form of the Bitcoin baby.
A taller, cooler orange robot character based on the letter 'B'. It is
wearing a dark purple pixelated hacker hoodie over its head. Instead of
the transparent dome, it wears large pixelated VR goggles reflecting
scrolling green data code. Advanced blue circuitry patterns visible on
its body. Confident pose. Retro cyberpunk game style, isolated on solid
white background.
```

**Color Palette:**
- Body: `#f7931a` (Bitcoin Orange)
- Hoodie: `#6366f1` (Purple)
- VR Goggles: `#1f2937` (Dark) with `#4ade80` (Green) reflection
- Circuits: `#4fc3f7` (Cyan)

**States:**
- `idle` - Subtle hover, confident stance
- `hacking` - Goggles flash, typing animation
- `mining_boost` - Energy aura, 2x sparkles
- `teaching` - Points forward, speech bubble

**Level Range:** 11-25

---

### Stage 3: El Maestro Cadena (Future - The Chain Master)

*Coming in Phase 3*

The final evolution - a powerful entity that can validate blocks.

```
Prompt: 8-bit pixel art character, final evolution of the Bitcoin baby.
A majestic floating robot entity shaped like a golden 'B'. It has
multiple holographic screens orbiting around it showing blockchain data.
Its body is chrome and gold with intricate circuit engravings. A crown
of pixelated light beams emanates from its head. Powerful aura effect.
Retro boss character style, isolated on solid white background.
```

**Level Range:** 26-50

---

## Animation Guidelines

### Frame Counts
- Idle: 2-4 frames, 500ms loop
- Action: 4-8 frames, 200ms loop
- Special: 8-16 frames, 100ms loop

### Pixel Movement
- Small movements: 1-2 pixels
- Medium movements: 4 pixels
- Large movements: 8 pixels
- Always in 4px increments for retro feel

### CSS Animation Classes
```css
.sprite-idle { animation: pixel-float 2s ease-in-out infinite; }
.sprite-action { animation: pixel-bounce 0.5s steps(4) infinite; }
.sprite-special { animation: pixel-glow 1s ease-in-out infinite; }
```

---

## File Naming Convention

```
/public/sprites/
├── baby/
│   ├── egg-dormant.svg
│   ├── egg-hatching.svg
│   ├── baby-idle.svg
│   ├── baby-happy.svg
│   ├── baby-sleeping.svg
│   ├── baby-mining.svg
│   ├── teen-idle.svg
│   └── teen-hacking.svg
├── npcs/
│   ├── oracle-idle.svg
│   └── oracle-talking.svg
├── items/
│   ├── sato-bot.svg
│   ├── lightning-bolt.svg
│   └── block-reward.svg
└── effects/
    ├── sparkle.svg
    ├── mining-particles.svg
    └── level-up.svg
```

---

## Generation Tips

When generating with AI (Midjourney, DALL-E, etc.):

1. **Force retro style:** Add `retro game style, restricted color palette, low resolution`
2. **Ensure isolation:** Always end with `isolated on solid white background`
3. **Specify grid:** Add `16x16 pixel grid` or `32x32 pixel grid`
4. **Clean outlines:** Include `clean black outlines, flat 2D, no gradients`

---

## Integration with React

```tsx
import { BabySprite } from '@/components/sprites/BabySprite';

// Usage
<BabySprite
  stage="baby"
  state="mining"
  size={128}
/>
```

See `/packages/ui/src/components/sprites/` for implementations.
