# BitcoinBaby - Guia de Diseno Pixel Art 8-bit

> **Estilo Visual:** Pixel Art 8-bit inspirado en NES/SNES con toques modernos

Este documento define el sistema de diseno visual para BitcoinBaby.

---

## Filosofia de Diseno

### Principios Core

1. **Nostalgia Moderna** - Estetica retro con UX contemporanea
2. **Claridad sobre Complejidad** - Sprites simples pero expresivos
3. **Cohesion Visual** - Paleta limitada, estilo consistente
4. **Animacion Sutil** - Frames minimos pero impactantes

### Inspiraciones

- **NES/Famicom** - Paleta de 52 colores, sprites 8x8 y 16x16
- **SNES** - Paletas de 15 colores por sprite, dithering
- **Juegos de referencia:**
  - Shovel Knight (NES moderno)
  - Celeste (pixel art expresivo)
  - Stardew Valley (UI clara)
  - Undertale (personalidad unica)

---

## Paleta de Colores

### Paleta Principal (16 colores)

Basada en la paleta NES con ajustes para mejor contraste en pantallas modernas.

```css
:root {
  /* Background */
  --pixel-bg-dark: #0f0f1b;
  --pixel-bg-medium: #1a1a2e;
  --pixel-bg-light: #2d2d44;

  /* Primary (Bitcoin Orange/Gold) */
  --pixel-primary: #f7931a;
  --pixel-primary-light: #ffc107;
  --pixel-primary-dark: #e67e00;

  /* Secondary (Baby Blue) */
  --pixel-secondary: #4fc3f7;
  --pixel-secondary-light: #81d4fa;
  --pixel-secondary-dark: #29b6f6;

  /* Accent (Pixel Green - Success) */
  --pixel-success: #4ade80;
  --pixel-success-dark: #22c55e;

  /* Error (Pixel Red) */
  --pixel-error: #ef4444;
  --pixel-error-dark: #dc2626;

  /* Text */
  --pixel-text: #ffffff;
  --pixel-text-muted: #9ca3af;
  --pixel-text-dark: #1f2937;

  /* Borders & Shadows (NES style) */
  --pixel-border: #374151;
  --pixel-shadow: #000000;
}
```

### Paletas Tematicas

```css
/* Baby States */
--baby-sleeping: #6366f1;    /* Indigo */
--baby-hungry: #f97316;      /* Orange */
--baby-happy: #fbbf24;       /* Yellow */
--baby-learning: #8b5cf6;    /* Purple */
--baby-evolving: #ec4899;    /* Pink */

/* Mining States */
--mining-active: #22c55e;    /* Green pulse */
--mining-idle: #6b7280;      /* Gray */
--mining-boost: #f59e0b;     /* Amber */
```

---

## Tipografia

### Fuentes Principales

```css
/* Fuente principal - Titulos y UI */
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

/* Fuente secundaria - Texto legible */
@import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap');

/* Fuente monospace - Numeros y datos */
@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

:root {
  --font-pixel: 'Press Start 2P', cursive;
  --font-pixel-body: 'Pixelify Sans', sans-serif;
  --font-pixel-mono: 'VT323', monospace;
}
```

### Escala Tipografica

```css
/* Press Start 2P - Solo para titulos (es muy angular) */
.pixel-title-xl { font-size: 24px; line-height: 1.5; }
.pixel-title-lg { font-size: 16px; line-height: 1.5; }
.pixel-title-md { font-size: 12px; line-height: 1.5; }
.pixel-title-sm { font-size: 10px; line-height: 1.5; }

/* Pixelify Sans - Para texto legible */
.pixel-body-lg { font-size: 20px; }
.pixel-body-md { font-size: 16px; }
.pixel-body-sm { font-size: 14px; }

/* VT323 - Para numeros y stats */
.pixel-mono-lg { font-size: 32px; }
.pixel-mono-md { font-size: 24px; }
.pixel-mono-sm { font-size: 18px; }
```

---

## Componentes UI

### Bordes Pixelados (NES Style)

```css
/* Borde clasico NES */
.pixel-border {
  border: 4px solid var(--pixel-border);
  box-shadow:
    inset -4px -4px 0 0 var(--pixel-shadow),
    inset 4px 4px 0 0 rgba(255,255,255,0.1);
  image-rendering: pixelated;
}

/* Borde con esquinas redondeadas pixel */
.pixel-border-rounded {
  border: 4px solid var(--pixel-border);
  border-radius: 0;
  /* Simular esquinas con clip-path */
  clip-path: polygon(
    0 8px, 8px 8px, 8px 0,
    calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px,
    100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px),
    calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 8px),
    0 calc(100% - 8px)
  );
}
```

### Botones

```css
.pixel-button {
  font-family: var(--font-pixel);
  font-size: 12px;
  padding: 12px 24px;
  background: var(--pixel-primary);
  color: var(--pixel-text-dark);
  border: 4px solid var(--pixel-shadow);
  cursor: pointer;
  image-rendering: pixelated;
  text-transform: uppercase;

  /* Sombra 3D */
  box-shadow:
    4px 4px 0 0 var(--pixel-shadow),
    inset -2px -2px 0 0 var(--pixel-primary-dark),
    inset 2px 2px 0 0 var(--pixel-primary-light);

  transition: transform 0.1s, box-shadow 0.1s;
}

.pixel-button:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 0 var(--pixel-shadow);
}

.pixel-button:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}
```

### Cards

```css
.pixel-card {
  background: var(--pixel-bg-medium);
  border: 4px solid var(--pixel-border);
  padding: 16px;

  /* Sombra estilo NES */
  box-shadow:
    8px 8px 0 0 var(--pixel-shadow),
    inset -4px -4px 0 0 rgba(0,0,0,0.3),
    inset 4px 4px 0 0 rgba(255,255,255,0.05);
}

.pixel-card-header {
  font-family: var(--font-pixel);
  font-size: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--pixel-border);
  margin-bottom: 12px;
}
```

---

## Sprites y Animaciones

### Tamanos de Sprite

```
8x8   - Iconos pequenos, particulas
16x16 - Iconos UI, items
32x32 - Baby avatar pequeno
64x64 - Baby avatar principal
128x128 - Baby avatar detallado (evoluciones)
```

### Animaciones CSS

```css
/* Parpadeo retro */
@keyframes pixel-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Flotacion suave (idle) */
@keyframes pixel-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* Pulso de mineria */
@keyframes pixel-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--mining-active);
  }
  50% {
    box-shadow: 0 0 0 8px transparent;
  }
}

/* Shake de error */
@keyframes pixel-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* Entrada desde abajo */
@keyframes pixel-slide-up {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### Sprite Sheet Animation

```css
.sprite-baby {
  width: 64px;
  height: 64px;
  background-image: url('/sprites/baby-sheet.png');
  background-size: 256px 64px; /* 4 frames */
  image-rendering: pixelated;
  animation: sprite-walk 0.5s steps(4) infinite;
}

@keyframes sprite-walk {
  from { background-position: 0 0; }
  to { background-position: -256px 0; }
}
```

---

## Baby Character Design

### Estados del Baby

```
SLEEPING   - Ojos cerrados, Zzz particulas
HUNGRY     - Boca abierta, lagrima
HAPPY      - Ojos brillantes, corazones
LEARNING   - Signos de interrogacion, libro
EVOLVING   - Brillo, particulas de estrella
```

### Niveles de Evolucion

```
Level 1-10:   Baby basico (32x32)
Level 11-25:  Baby juvenil (48x48)
Level 26-50:  Baby adolescente (64x64)
Level 51+:    Baby adulto (96x96)
```

### Paleta del Baby

```css
/* Baby Base Colors */
--baby-skin: #ffd5b5;
--baby-skin-shadow: #e5a87a;
--baby-outline: #5c3d2e;
--baby-eyes: #2d1b0e;
--baby-cheeks: #ff9a8b;
--baby-highlight: #fff5eb;
```

---

## Herramientas Recomendadas

### Creacion de Assets

| Herramienta | Uso | Link |
|-------------|-----|------|
| **Aseprite** | Sprites y animaciones | https://www.aseprite.org/ |
| **Piskel** | Editor online gratuito | https://www.piskelapp.com/ |
| **Lospec** | Paletas de colores | https://lospec.com/palette-list |
| **Pixelorama** | Editor open source | https://orama-interactive.itch.io/pixelorama |

### Librerias React

| Libreria | Descripcion | Instalacion |
|----------|-------------|-------------|
| **NES.css** | Framework CSS retro | `npm i nes.css` |
| **8bitcn/ui** | Componentes shadcn 8-bit | Via shadcn CLI |
| **RetroUI** | Componentes pixelados | `npx pixel-retroui` |
| **nes-ui-react** | NES.css para React | `npm i nes-ui-react` |

### Fuentes

| Fuente | Uso | Link |
|--------|-----|------|
| **Press Start 2P** | Titulos | Google Fonts |
| **Pixelify Sans** | Cuerpo legible | Google Fonts |
| **VT323** | Numeros/Stats | Google Fonts |

---

## Implementacion Tecnica

### Configuracion Tailwind

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        'pixel-body': ['"Pixelify Sans"', 'sans-serif'],
        'pixel-mono': ['VT323', 'monospace'],
      },
      colors: {
        pixel: {
          bg: { dark: '#0f0f1b', medium: '#1a1a2e', light: '#2d2d44' },
          primary: { DEFAULT: '#f7931a', light: '#ffc107', dark: '#e67e00' },
          secondary: { DEFAULT: '#4fc3f7', light: '#81d4fa', dark: '#29b6f6' },
          success: { DEFAULT: '#4ade80', dark: '#22c55e' },
          error: { DEFAULT: '#ef4444', dark: '#dc2626' },
        },
      },
      boxShadow: {
        'pixel': '4px 4px 0 0 #000000',
        'pixel-lg': '8px 8px 0 0 #000000',
        'pixel-inset': 'inset -4px -4px 0 0 rgba(0,0,0,0.3)',
      },
    },
  },
};
```

### CSS Global

```css
/* Rendering pixelado global */
img, canvas, .sprite {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

/* Cursor personalizado */
body {
  cursor: url('/cursors/pointer.png'), auto;
}

/* Seleccion de texto estilo retro */
::selection {
  background: var(--pixel-primary);
  color: var(--pixel-text-dark);
}
```

---

## Referencias

### Librerias
- [NES.css](https://nostalgic-css.github.io/NES.css/)
- [8bitcn/ui](https://8bitcn.com/)
- [RetroUI](https://retroui.io/)
- [nes-ui-react](https://kyr0.github.io/nes-ui-react/)

### Paletas
- [Lospec Palette List](https://lospec.com/palette-list)
- [NES Color Palette](https://www.nesdev.org/wiki/PPU_palettes)

### Tutoriales
- [NES Style Guide](https://eirifu.wordpress.com/2025/02/21/a-style-guide-for-nes-inspired-pixel-art-in-your-retro-game/)
- [Game UI Database](https://www.gameuidatabase.com/)

### Herramientas
- [Aseprite](https://www.aseprite.org/)
- [Piskel](https://www.piskelapp.com/)
- [Pixelify Sans Font](https://fonts.google.com/specimen/Pixelify+Sans)
