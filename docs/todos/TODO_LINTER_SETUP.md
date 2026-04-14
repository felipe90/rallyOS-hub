# TODO - ESLint + TypeScript Setup

## Prioridad
- **P0** (crítico) - Code quality improvement

## Referencias
- PRD: `docs/prd-plans/PRD_LINTER_SETUP.md`

## Backlog por fases

### Fase 1 - Client ESLint
- [ ] (P0) Instalar dependencias en client (VERSIONES LOCKED)
  - `npm install -D eslint@^8.57.0 @typescript-eslint/parser@^6.21.0 @typescript-eslint/eslint-plugin@^6.21.0 eslint-plugin-react@^4.3.0 eslint-plugin-react-hooks@^4.6.0`
  - Estado: TODO

- [ ] (P0) Initial scan - CORRER LINT PRIMERO
  - `npm run lint -- --output-file lint-client-results.txt`
  - Contar errors vs warnings
  - Documentar en archivo para tracking
  - Ajustar estrategia según cantidad
  - Estado: TODO

- [ ] (P0) Crear `.eslintrc.js` en client/
  - Extends: eslint:recommended, plugin:react, plugin:@typescript-eslint, plugin:react-hooks
  - Estado: TODO

- [ ] (P0) Agregar `npm run lint` a client/package.json
  - Script: `eslint src --ext .ts,.tsx`
  - Estado: TODO

- [ ] (P0) Fixear errores encontrados (según initial scan)
  - Estado: TODO

### Fase 2 - Server ESLint
- [ ] (P0) Instalar dependencias en server (VERSIONES LOCKED)
  - `npm install -D eslint@^8.57.0 @typescript-eslint/parser@^6.21.0 @typescript-eslint/eslint-plugin@^6.21.0`
  - Estado: TODO

- [ ] (P0) Initial scan - CORRER LINT PRIMERO
  - `npm run lint -- --output-file lint-server-results.txt`
  - Contar errors vs warnings
  - Estado: TODO

- [ ] (P0) Crear `.eslintrc.js` en server/
  - Extends: eslint:recommended, plugin:@typescript-eslint
  - Estado: TODO

- [ ] (P0) Agregar `npm run lint` a server/package.json
  - Script: `eslint src --ext .ts`
  - Estado: TODO

- [ ] (P0) Correr lint y fix errores críticos
  - Estado: TODO

### Fase 3 - Pre-commit Hook
- [ ] (P0) Instalar husky + lint-staged (VERSIONES LOCKED)
  - `npm install -D husky@^8.0.0 lint-staged@^14.0.0`
  - Estado: TODO

- [ ] (P0) Configurar husky hook
  - `.husky/pre-commit` corre `lint-staged`
  - Estado: TODO

- [ ] (P0) Configurar lint-staged con --cache
  - Solo lint changed files
  - Usar `eslint --cache` para performance
  - Estado: TODO

### Fase 4 - CI Integration
- [ ] (P1) Crear `.github/workflows/lint.yml`
  - on push y pull_request
  - Solo errors bloquean merge
  - Warnings reportados pero no bloquean
  - Estado: TODO

### Fase 5 - Code Base Audit (CRÍTICO - MÁS IMPORTANTE)
- [ ] (P0) Correr `npm run lint` en todo client/src
  - Estado: TODO
  - Listar TODOS errores y warnings en un archivo

- [ ] (P0) Correr `npm run lint` en todo server/src
  - Estado: TODO
  - Listar TODOS errores y warnings en un archivo

- [ ] (P0) Fixear TODOS los errores en client
  - Estado: TODO
  - Cada fix committeado individualmente o en batch por módulo

- [ ] (P0) Fixear TODOS los errores en server
  - Estado: TODO
  - Cada fix committeado individualmente o en batch por módulo

- [ ] (P1) Fixear TODOS los warnings en client (o disable con justificación)
  - Estado: TODO
  - Documentar en eslintrc si se usa disable

- [ ] (P1) Fixear TODOS los warnings en server (o disable con justificación)
  - Estado: TODO
  - Documentar en eslintrc si se usa disable

- [ ] (P0) Commitear fixes con mensaje descriptivo
  - Estado: TODO
  - Ej: "lint: fix unused vars in ScoreboardMain"

---

## Estado del backlog

| Fase | Estado |
|------|--------|
| Client ESLint | TODO |
| Server ESLint | TODO |
| Pre-commit Hook | TODO |
| CI Integration | TODO |

---

## Registro de avances

- 2026-04-14 - PRD creado - raikenwolf

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-14  
**Estado:** TODO