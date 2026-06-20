# Plan de Implementación: Corrección de Bugs de Producción (CSP/Middleware y XSS SVG) y Despliegue Local

Este plan describe la solución para dos problemas críticos en el ecosistema `bitcoinbaby` para asegurar que el sistema esté listo para producción:
1. **Desactivación de CSP / Middleware de Next.js**: El archivo del middleware de seguridad está nombrado como `proxy.ts` en lugar del nombre estándar `middleware.ts`, lo que impide que Next.js lo reconozca y aplique la CSP en producción.
2. **Filtro XSS Débil en Renderizador SVG**: La expresión regular para detectar inyecciones peligrosas en el SVG del NFT utiliza barras diagonales invertidas duplicadas (`\\s`), lo que desactiva el filtrado de eventos inline como `onclick=...`.

Posteriormente, se levantará el sistema local para su correspondiente validación y prueba.

---

## Proposed Changes

### Componente: Frontend (`apps/web`)

#### [NEW] [middleware.ts](file:///Users/munay/dev/bitcoinbaby/apps/web/src/middleware.ts)
- Crear el archivo `middleware.ts` en `apps/web/src/` renombrando y adaptando el código de `proxy.ts`.
- Exportar por defecto la función `middleware` (antes llamada `proxy`).
- Mantener la configuración de `matcher` para el filtrado de rutas.

#### [DELETE] [proxy.ts](file:///Users/munay/dev/bitcoinbaby/apps/web/src/proxy.ts)
- Eliminar el archivo `proxy.ts` una vez migrado su contenido a `middleware.ts`.

#### [MODIFY] [package.json](file:///Users/munay/dev/bitcoinbaby/apps/web/package.json)
- Modificar el script de compilación nativa (`build:native`) en la línea 9 para que renombre temporalmente `src/middleware.ts` a `src/middleware.ts.bak` (y viceversa) en lugar de `src/proxy.ts`.

---

### Componente: Bitcoin Core (`packages/bitcoin`)

#### [MODIFY] [onchain-renderer.ts](file:///Users/munay/dev/bitcoinbaby/packages/bitcoin/src/inscription/onchain-renderer.ts)
- Modificar la expresión regular `DANGEROUS` en la línea 473 para usar caracteres de escape simples de regex (`\s`) en lugar de barras duplicadas (`\\s`) dentro del literal `/.../i`.

---

## Verification Plan

### Automated Tests
- Validar tipo estático de TypeScript en todo el monorepo:
  ```bash
  pnpm typecheck
  ```
- Validar pruebas unitarias:
  ```bash
  pnpm test
  ```

### Manual Verification
- Iniciar el servidor local utilizando `pnpm dev` en la raíz del proyecto para asegurar que el sistema se levanta correctamente.
- Verificar que el middleware de Next.js se ejecute (comprobando la existencia de la cabecera `Content-Security-Policy` y `x-nonce` en las respuestas de la aplicación).
