---
name: component
description: Crea componentes React reutilizables en packages/ui con CVA (class-variance-authority). Usa cuando usuario diga "crear componente", "nuevo componente", "UI component", "componente compartido", o necesite agregar elementos visuales al design system.
disable-model-invocation: true
argument-hint: "[ComponentName]"
allowed-tools: Read, Write, Edit
---

# /component - Crear Componente UI

Ubicacion: `packages/ui/src/components/$ARGUMENTS.tsx`

## Template

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const $ARGUMENTSVariants = cva('base-classes', {
  variants: {
    variant: { default: '', primary: '', secondary: '' },
    size: { sm: '', md: '', lg: '' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

interface $ARGUMENTSProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof $ARGUMENTSVariants> {}

export function $ARGUMENTS({ className, variant, size, ...props }: $ARGUMENTSProps) {
  return <div className={cn($ARGUMENTSVariants({ variant, size }), className)} {...props} />;
}
```

## Checklist
1. Crear componente con template
2. Exportar desde `packages/ui/src/components/index.ts`
3. Seguir estilo pixel-art (ver rules/pixel-art.md)
