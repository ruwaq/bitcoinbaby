# Tareas de Implementación (Fase de Corrección de Bugs y Despliegue Local)

- `[x]` **Fase 1: Corrección de CSP y Proxy de Next.js (Convención Next.js 16)**
  - `[x]` Asegurar `apps/web/src/proxy.ts` con la función `proxy` adaptada con todas las cabeceras CSP
  - `[x]` Eliminar el archivo deprecado `middleware.ts` para evitar advertencias de deprecación
  - `[x]` Asegurar que `apps/web/package.json` renombra `src/proxy.ts` en el script `build:native`

- `[x]` **Fase 2: Corrección de Vulnerabilidad XSS en SVG**
  - `[x]` Modificar la regex `DANGEROUS` en `packages/bitcoin/src/inscription/onchain-renderer.ts`

- `[x]` **Fase 3: Verificación y Pruebas**
  - `[x]` Ejecutar `pnpm typecheck` para asegurar que todo compila
  - `[x]` Ejecutar `pnpm test` para asegurar que todas las pruebas pasan

- `[x]` **Fase 4: Despliegue Local**
  - `[x]` Levantar el sistema en local con `pnpm dev`
