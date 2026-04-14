# PRD - ESLint + TypeScript Setup

## Overview

- **Proyecto**: rallyOS-hub
- **Feature**: Configuración de linting para cliente y servidor
- **Prioridad**: P0 (crítico) - Mejora de code quality
- **RFC**: N/A (mejora interna)

## Problema

El código actual no tiene linting configurado:
- No hay estándar de código uniforme
- Errores comunes no se detectan antes de commit
- CODE REVIEW requiere correcciones manuales重复
- Inconsistencias entre archivos

## Solución propuesta

Configurar ESLint con soporte TypeScript para client y server:
- Usar `eslint` + `@typescript-eslint` (TSLint está deprecado)
- Extender config de React recomendada
- Agregar pre-commit hook con husky + lint-staged
- Correr en CI/CD pipeline

## Scope

### In scope
- [ ] Configurar ESLint para `client/`
- [ ] Configurar ESLint para `server/`
- [ ] Agregar script `npm run lint` en ambos packages
- [ ] Agregar pre-commit hook (husky)
- [ ] Integrar en build pipeline
- **[CRÍTICO] Correr lint en TODA la base de código**
- **[CRÍTICO] Fixear TODOS los errores y warnings**

### Out of scope
- Cambios de arquitectura
- Configuración de Prettier (separado)

---

## Requisitos funcionales

### RF-01: ESLint en cliente
- `client/` tiene `.eslintrc.js` o `eslint.config.js`
- Detecta errores TypeScript comunes
- Detecta React-specific issues (hooks deps, key props)
- `npm run lint` corre y reporta issues

### RF-02: ESLint en servidor
- `server/` tiene `.eslintrc.js` o `eslint.config.js`
- Detecta errores Node.js/Express comunes
- Detecta TypeScript strict mode issues
- `npm run lint` corre y reporta issues

### RF-03: Pre-commit hook
- Husky intercepta `git commit`
- `lint-staged` corre lint solo en archivos changed
- Si lint fails, commit se rechaza

### RF-04: CI Integration

**Workflow**: `.github/workflows/lint.yml`
```yaml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
        working-directory: client
      - run: npm run lint
        working-directory: server
```

**Reglas**:
- Solo `errors` bloquean merge
- `warnings` se reportan pero NO bloquean
- Usar `--max-warnings=0` si se quiere bloquear warnings

### RF-05: Code Base Audit (CRÍTICO)

**PASO 0 (REQUIRED) - Initial Scan:**
- Correr `npm run lint` en todo client/src → guardar output
- Correr `npm run lint` en todo server/src → guardar output
- Contar errors vs warnings
- **Decidir estrategia de fix** según cantidad:
  - <50 errors: fixear todos en una sesión
  - 50-100 errors: priorizar critical files, остальные en follow-up
  - >100 errors: crear tracking issue con todos los errores

**PASO 1 - Fix errors:**
- Fixear CADA error hasta que lint pase con 0 errors
- Commits individuales por módulo o batch por feature

**PASO 2 - Fix warnings:**
- Fixear CADA warning O
- Usar `eslint-disable` con justificación técnica en comentario
- Documentar cada disable en eslintrc rules

**eslint-disable policy:**
- Solo usar si hay razón técnica documentada
- Siempre incluir comentario: `// eslint-disable-next-line -- razón`
- Registrar en eslintrc si es patrón repetido

**Este es el item más importante del setup**. Sin código limpio, el linter no tiene valor.

---

## Configuración propuesta

### ESLint Version
**Usar ESLint v8** con `.eslintrc.js` (formato legacy, más estable con TypeScript en 2026).

### Client (React + TypeScript)
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  },
  "settings": {
    "react": { "version": "detect" }
  }
}
```

### Server (Node + TypeScript)
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

### Prettier vs ESLint
**Decisión**: Usar ESLint para formatting también. NO usar Prettier.
- `prettier/prettier`: "error" → NO habilitamos esta regla
- Conflicto resuelto: solo ESLint, sin Prettier

---

## User stories

| ID | Story | Criterio de aceptación |
|----|-------|----------------------|
| US-01 | Como dev, quiero `npm run lint` en client | Pasa sin errors/warnings críticos |
| US-02 | Como dev, quiero `npm run lint` en server | Pasa sin errors/warnings críticos |
| US-03 | Como dev, quiero commit bloqueado si lint fail | `git commit` rejected con lint errors |
| US-04 |Como dev, quiero lint en CI | GitHub Actions checks lint status |

---

## Technical notes

### Dependencias cliente (VERSIONES LOCKED)
- `eslint@^8.57.0`
- `@typescript-eslint/parser@^6.21.0`
- `@typescript-eslint/eslint-plugin@^6.21.0`
- `eslint-plugin-react@^4.3.0`
- `eslint-plugin-react-hooks@^4.6.0`
- `husky@^8.0.0`
- `lint-staged@^14.0.0`

### Dependencias servidor (VERSIONES LOCKED)
- `eslint@^8.57.0`
- `@typescript-eslint/parser@^6.21.0`
- `@typescript-eslint/eslint-plugin@^6.21.0`
- `husky@^8.0.0`
- `lint-staged@^14.0.0`

### Alternativas consideradas
- **TSLint**: DEPCiado desde 2019, no mantener
- **Biome**: Rápido pero muy nuevo, less plugins
- **Oxlint**: Muy nuevo, no stability garanteed

---

## Timeline estimado

- Setup config: **1 hora**
- Run existing code fix: **2-4 horas** (depending on errors)
- CI integration: **30 minutos**

---

## Checklist de implementación

- [ ] Instalar dependencias en client
- [ ] Crear `.eslintrc.js` en client
- [ ] Agregar `npm run lint` a client/package.json
- [ ] Correr y fix errores/warnings
- [ ] Instalar dependencias en server
- [ ] Crear `.eslintrc.js` en server
- [ ] Agregar `npm run lint` a server/package.json
- [ ] Correr y fix errores/warnings
- [ ] Configurar husky + lint-staged
- [ ] Agregar lint step a CI

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-14  
**Estado:** TODO