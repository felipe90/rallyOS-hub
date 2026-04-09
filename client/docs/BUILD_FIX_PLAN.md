# Plan de Mitigación - Build Errors RallyOS Client

## Resumen de Errores

| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| **Path aliases no resuelven** | ~20 | `@/components/...`, `@/hooks/...`, `@/contexts/...`, `@/test/...` no funcionan |
| **Módulo compartido no encontrado** | ~10 | `../../../../shared/types` no existe en client |
| **Exports faltantes** | 2 | ButtonProps, AuthContext |
| **Tipos implícitos any** | 6 | Parámetros sin tipo en ScoreboardMain, DashboardPage |
| **Errores de test** | 2 | Icon test con tipo inválido |

---

## Análisis de Causas Raíz

### 1. Path aliases (`@/`) no funcionan
**Causa:** tsconfig.app.json NO tiene configurado el alias `@` que vite.config.ts usa.

**Solución:** Agregar `paths` en tsconfig.app.json que apunte a la misma ubicación que el alias de Vite.

### 2. Módulo `shared/types` no existe
**Causa:** Los componentes usan `import type { ... } from '../../../../shared/types'` pero ese directorio NO existe en el cliente. Los tipos están en `/shared/types.ts` en la raíz del monorepo.

**Solución:** 
- Opción A: Crear enlace simbólico o copiar tipos a `client/src/shared/`
- Opción B: Crear un archivo de declaración de módulo (`client/src/types/shared.ts`) con las exportaciones que se usan
- Opción C (más rápida): Crear `client/src/shared/` con los tipos que se usan

### 3. Exports faltantes
**Causa:** 
- `Button.tsx` no exporta `ButtonProps` como named export
- `AuthContext` se nombró diferente en la creación de carpetas

**Solución:** Agregar exports faltantes en los archivos originales.

---

## Plan de Ejecución (Subagentes)

### Fase 1: Configuración Base (1 agent)
1. Agregar `@` alias a `tsconfig.app.json`
2. Crear `client/src/shared/types.ts` con los tipos que se usan (MatchState, TableStatus, Score, Player, etc.)

### Fase 2: Exports y Types (2 agents en paralelo)
**Agent A:**
- Fix: `Button.tsx` exportar `ButtonProps`
- Fix: `Icon.tsx` - crear tipo válido o usar `as const` en test

**Agent B:**
- Fix: `AuthContext` index.ts - exportar correctamente
- Fix: Cada componente tipo `.types.ts` debe exportarse desde el barrel

### Fase 3: Fix tipos implícitos (1 agent)
- ScoreboardMain.tsx - agregar tipos a parámetros
- DashboardPage.tsx - agregar tipos a parámetros

### Fase 4: Verificación (1 agent)
- Ejecutar `npm run build` 
- Verificar que todos los tests pasen

---

## Archivos a Modificar/Crear

### tsconfig.app.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### src/shared/types.ts
Copiar tipos de `/shared/types.ts` del monorepo:
- MatchState, MatchStateExtended
- TableStatus
- Score
- Player

### Archivos con exports a fixear:
- src/components/atoms/Button/Button.tsx
- src/hooks/AuthContext/index.ts
- src/components/atoms/index.ts

---

## Orden de Ejecución Sugerido

1. **Config tsconfig + shared types** (Agent 1)
2. **Fix exports Button + AuthContext** (Agent 2)  
3. **Fix Icon test + implicit any** (Agent 3)
4. **Verificación final** (Agent 4 o manual)

Cada fase debe ejecutar build después para validar progresivamente.