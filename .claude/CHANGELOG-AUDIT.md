# Changelog - Auditoría Skills Claude

Fecha: 2026-03-08

## Configuración Global Creada

Reglas comunes movidas a `~/.claude/` para aplicar a todos los proyectos:
- `commits.md` - Commits neutrales sin firmas
- `typescript.md` - TypeScript strict
- `react.md` - React best practices
- `instalacion.md` - CLIs oficiales
- `investigar.md` - Investigar antes de codificar
- `/commit` skill - Crear commits
- `/test` skill - Ejecutar tests

BitcoinBaby ahora solo contiene reglas específicas del proyecto.

## Resumen de Optimización

| Métrica | Antes | Después | Reducción |
|---------|-------|---------|-----------|
| CLAUDE.md | 127 líneas | 68 líneas | **46%** |
| Skills (total) | 197 líneas | 108 líneas | **45%** |
| Agents (total) | 497 líneas | 159 líneas | **68%** |
| Rules (total) | 481 líneas | 131 líneas | **73%** |
| **TOTAL** | **1302 líneas** | **466 líneas** | **64%** |

## Cambios por Archivo

### CLAUDE.md
- **Eliminado**: Duplicación de paleta de colores (ya en rules/pixel-art.md)
- **Eliminado**: Duplicación de seguridad blockchain (ya en rules/blockchain.md)
- **Condensado**: Comandos en formato más compacto
- **Agregado**: Referencia a rules/pixel-art.md

### Skills

| Skill | Cambio Principal |
|-------|------------------|
| `dev` | Description "pushy" con keywords: "dev", "run", "correr", "levantar" |
| `build` | Description con triggers: "build", "compilar", "deploy", "produccion" |
| `mining-research` | Keywords específicos: WebGPU, hashrate, orchestrator |
| `charms-research` | Keywords: Spells, Runes, BitSNARK, Scrolls API |
| `component` | Keywords: "crear componente", "UI component" |

### Agents

| Agent | Cambio Principal |
|-------|------------------|
| `blockchain-expert` | Eliminada sección "Auto-Activación" inútil, condensado a tabla |
| `security-auditor` | Formato de reporte simplificado |
| `code-reviewer` | Criterios en tabla, eliminados ejemplos redundantes |
| `mining-expert` | Eliminado código de ejemplo (Claude ya sabe), dejado estructura |
| `ai-expert` | Eliminados ejemplos de código, dejada referencia |
| `pixel-designer` | Referencia a rules/pixel-art.md, eliminada duplicación |

### Rules

| Rule | Cambio Principal |
|------|------------------|
| `typescript.md` | Eliminados ejemplos "Incorrecto", dejado solo lo correcto |
| `react.md` | Eliminada explicación Server/Client (Claude sabe) |
| `blockchain.md` | Agregado "porqué" en vez de NEVER/ALWAYS |
| `pixel-art.md` | Condensada paleta, eliminadas explicaciones obvias |
| `instalacion.md` | Reducido a lo esencial |
| `investigar.md` | Formato checklist más compacto |

## Contradicciones Resueltas

1. **Paleta de colores** - Definición única en `rules/pixel-art.md`
2. **Seguridad blockchain** - Definición única en `rules/blockchain.md`
3. **Agentes con "Auto-Activación"** - Eliminada sección (no funciona técnicamente)

## Principios Aplicados

Basado en [Anthropic Skill Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):

1. **< 500 líneas** por archivo ✓
2. **Descriptions "pushy"** con keywords específicos ✓
3. **Tercera persona** en descriptions ✓
4. **Explicar el porqué** en vez de MUST/ALWAYS/NEVER ✓
5. **Sin duplicación** - cada instrucción aparece una vez ✓
6. **Progressive disclosure** - referencias a archivos externos ✓

## Estructura Final

```
.claude/
├── CLAUDE.md              # Overview del proyecto (68 líneas)
├── settings.json          # Permisos y hooks
├── skills/
│   ├── dev/SKILL.md       # /dev (15 líneas)
│   ├── build/SKILL.md     # /build (18 líneas)
│   ├── mining-research/SKILL.md   # Research (31 líneas)
│   ├── charms-research/SKILL.md   # Research (39 líneas)
│   └── component/SKILL.md # /component (40 líneas)
├── agents/
│   ├── blockchain-expert.md  # Task agent (23 líneas)
│   ├── security-auditor.md   # Task agent (26 líneas)
│   ├── code-reviewer.md      # Task agent (30 líneas)
│   ├── mining-expert.md      # Task agent (29 líneas)
│   ├── ai-expert.md          # Task agent (31 líneas)
│   └── pixel-designer.md     # Task agent (35 líneas)
├── rules/
│   ├── typescript.md      # Auto-load en *.ts (26 líneas)
│   ├── react.md           # Auto-load en *.tsx (24 líneas)
│   ├── blockchain.md      # Auto-load en packages/bitcoin (30 líneas)
│   ├── pixel-art.md       # Auto-load en UI/CSS (45 líneas)
│   ├── instalacion.md     # Auto-load en configs (23 líneas)
│   └── investigar.md      # Auto-load global (22 líneas)
└── hooks/
    ├── format-on-edit.sh  # Post-edit formatting
    └── protect-env.sh     # Pre-edit .env protection
```

## Próximos Pasos Sugeridos

1. **Crear `references/`** - Para documentación extensa que exceda 500 líneas
2. **Agregar skill `/test`** - Para correr tests automáticamente
3. **Agregar skill `/commit`** - Para commits con convenciones del proyecto
4. **Evaluar triggering** - Probar que las skills se activen correctamente

---

*Generado siguiendo las mejores prácticas de [Anthropic Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)*
