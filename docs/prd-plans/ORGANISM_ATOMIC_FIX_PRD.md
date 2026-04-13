# PRD - Atomic Fix: DashboardGrid & HistoryDrawer

## 1) Contexto
- Revisando en profundidad la carpeta de organismos (`DashboardGrid` e `HistoryDrawer`), si bien su tamaño (en líneas de código) no es crítico, están violando el principio de reusabilidad de Atomic Design.
- Tienen bloques JSX en crudo (inline loops, divs con clases utilitarias) que reproducen visual y lógicamente el comportamiento de moléculas ya estandarizadas en el repositorio: `StatCard` e `HistoryList`.

## 2) Problema
- **Qué duele hoy:** Código duplicado no en términos de volumen masivo, sino en términos conceptuales. Si mañana cambiamos cómo luce un "StatCard", el Dashboard quedará desactualizado porque tiene sus propios `<div>` hardcodeados.
- **Quién lo sufre:** La consistencia del diseño (UI/UX) y nosotros como desarrolladores al perder el "Single Source of Truth".

## 3) Objetivo del producto
- Purgar el JSX inline y sustituirlo por el consumo estricto de las moléculas pre-existentes (`StatCard` e `HistoryList`).

## 4) Metas
- Reducción total de JSX redundante.
- Cero impacto visual (la UI tiene que seguir viéndose y funcionando prácticamente igual).

## 5) No metas
- Cambiar la lógica interna de `DashboardGrid` o de `HistoryDrawer`.
- Modificar el estado o propiedades del enrutamiento.

## 6) Alcance
- Únicamente los archivos `DashboardGrid.tsx` e `HistoryDrawer.tsx`.

## 11) Criterios de aceptación (DoD)
- [ ] `DashboardHeader` usa `<StatCard />`.
- [ ] `HistoryDrawer` usa `<HistoryList />`.

---

**Estado:** Draft  
**Owner:** Antigravity  
**Fecha:** 2026-04-09  
**Versión:** v1.0
