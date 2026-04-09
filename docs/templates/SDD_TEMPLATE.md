# SDD - <Nombre tecnico de la solucion>

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/<archivo_prd>.md`
- Objetivos cubiertos: <lista de metas del PRD>

## 2) Arquitectura actual (AS-IS)
- Componentes involucrados hoy.
- Flujo actual resumido.
- Limitaciones actuales.

## 3) Arquitectura propuesta (TO-BE)
- Componentes nuevos/modificados.
- Contratos entre modulos.
- Diagrama simple (opcional ASCII/Mermaid).

## 4) Diseño de datos y contratos
### 4.1 Modelos/Tipos
- Tipo/entidad A
- Tipo/entidad B

### 4.2 API/Eventos
- Endpoint/evento: input, output, errores.

## 5) Reglas de negocio
- Regla 1
- Regla 2
- Regla 3

## 6) Seguridad y validaciones
- Autorizacion
- Validacion de payloads
- Manejo de secretos/logs

## 7) Observabilidad
- Logs esperados (sin secretos)
- Metricas recomendadas
- Alertas basicas (si aplica)

## 8) Plan de implementacion tecnica
- Fase 1: cambios en backend
- Fase 2: cambios en frontend
- Fase 3: hardening/refactor

## 9) Plan de migracion/compatibilidad
- Compatibilidad hacia atras
- Feature flags (si aplica)
- Estrategia de rollback

## 10) Plan de pruebas
- Unit tests
- Integracion
- E2E/smoke
- Casos borde

## 11) Riesgos tecnicos y trade-offs
- Riesgo A -> mitigacion
- Trade-off B -> justificacion

## 12) Criterios de aceptacion tecnicos
- [ ] Criterio tecnico 1
- [ ] Criterio tecnico 2
- [ ] Criterio tecnico 3

## 13) Archivos impactados
- `server/...`
- `client/...`
- `shared/...`

---

**Estado:** Draft | Ready | Approved  
**Owner tecnico:** <nombre>  
**Fecha:** <YYYY-MM-DD>  
**Version:** v0.1
