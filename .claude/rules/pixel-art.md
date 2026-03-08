---
paths:
  - "packages/ui/**/*"
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.css"
  - "**/*.css"
---

# Pixel Art 8-bit

BitcoinBaby usa estetica NES/SNES. Esto crea consistencia visual y diferenciacion de marca.

## Paleta (16 colores)
```css
/* Fondos */      #0f0f1b, #1a1a2e, #2d2d44
/* Primary */     #f7931a, #ffc107, #e67e00
/* Secondary */   #4fc3f7, #81d4fa, #29b6f6
/* Success */     #4ade80, #22c55e
/* Error */       #ef4444, #dc2626
/* Text */        #ffffff, #9ca3af
/* Border */      #374151, #000000
```

## Tipografia
```css
font-family: 'Press Start 2P';     /* Titulos */
font-family: 'Pixelify Sans';      /* Body */
font-family: 'VT323';              /* Numeros */
```

## CSS Obligatorio
```css
image-rendering: pixelated;
border: 4px solid #374151;
box-shadow: 4px 4px 0 0 #000;      /* Efecto 3D NES */
animation: walk 0.5s steps(4);     /* Frames discretos */
```

## Evitar
- `border-radius` > 2px
- `box-shadow` con blur
- Gradientes suaves
- Fuentes sans-serif normales
- `ease-in-out` (usar `steps()`)
