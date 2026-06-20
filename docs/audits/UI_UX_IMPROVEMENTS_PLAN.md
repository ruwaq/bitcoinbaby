# UI/UX Modernization Plan — BitcoinBaby

## Investigación (Mayo 2026)

### Tecnologías evaluadas

| Tecnología | Estado | Recomendación |
|-----------|--------|---------------|
| **Motion** (ex-Framer Motion) | v12.6+ | ✅ Reemplazar animaciones CSS manuales |
| **shadcn/ui** | Estándar 2025-26 | ✅ Patrones de componentes, no reemplazar UI propia |
| **Tailwind CSS v4** | Ya lo tenemos | ✅ Usar nuevas features (container queries, oklch) |
| **React 19** | Ya lo tenemos | ✅ useOptimistic, useActionState, Server Components |
| **Next.js App Router** | Ya lo tenemos | ✅ Streaming, Suspense, loading.tsx |
| **TanStack Query v5** | Ya lo tenemos | ✅ Optimistic updates, infinite queries |
| **Zustand v5** | Ya lo tenemos | ✅ Usar selectors atómicos para evitar re-renders |

### Lo que tenemos vs lo que podemos mejorar

| Tenemos | Mejora | Impacto |
|---------|--------|---------|
| Animaciones CSS manuales (sparkles) | Motion `animate` + `variants` | ⚡ 60fps garantizado |
| Pulse CSS en skeletons | Motion `layoutId` + shimmer | 🎨 Más pulido |
| Transiciones bruscas entre tabs | `AnimatePresence` + `layout` | 🎯 UX fluida |
| Scroll simple | `useScroll` + parallax | 🎮 Más inmersivo |
| Estados loading/error/empty básicos | Motion exit animations + stagger | ✨ Profesional |
| Botones estáticos | `whileHover` + `whileTap` + `usePress` | 🎮 Táctil nativo |
| Navegación | `layoutId` entre tabs para continuidad | 🧠 Menos carga cognitiva |

## Plan de implementación (ordenado por impacto)

### Fase A: Motion integration (30 min)
1. Instalar `motion` (10kB gzipped, MIT)
2. Reemplazar sparkles CSS con `<motion.div>` + variants
3. Agregar `AnimatePresence` en transiciones de tabs
4. `whileHover`/`whileTap` en todos los botones

### Fase B: Skeleton shimmer (15 min)
1. Reemplazar `animate-pulse` con Motion shimmer effect
2. Componente `<ShimmerSkeleton />` reutilizable

### Fase C: Empty states animados (15 min)
1. Motion `initial`/`animate` en empty states
2. Stagger children con `variants`

### Fase D: Navegación fluida (15 min)
1. `layoutId` compartido entre tabs
2. Transiciones suaves al cambiar de vista

Total estimado: ~1.5 horas
