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
- GitHub Actions corre `npm run lint` en PR checks
- Merge blocked si lint fails

### RF-05: Code Base Audit (CRÍTICO)
- Correr `npm run lint` en TODA la base de código de client
- Correr `npm run lint` en TODA la base de código de server
- Listar TODOS los errores (errors) encontrados
- Listar TODOS los warnings encontrados
- Fixear CADA error hasta que lint pase sin errores
- Fixear CADA warning (o documentar si es necesario disable)
- Commitear los fixes con mensaje descriptivo

**Este es el item más importante del setup**. Sin código limpio, el linter no tiene valor.

---

## Configuración propuesta

### Client (React + TypeScript)
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

### Server (Node + TypeScript)
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

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

### Dependencias cliente
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `husky`
- `lint-staged`

### Dependencias servidor
- `eslint`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- `husky`
- `lint-staged`

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