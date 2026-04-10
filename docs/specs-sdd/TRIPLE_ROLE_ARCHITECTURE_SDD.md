# SDD - Arquitectura de Tres Entradas (Triple Role)

## 1) Referencia al PRD
- PRD origen: `docs/prd-plans/TRIPLE_ROLE_ARCHITECTURE_PRD.md`
- Objetivos cubiertos:
  - Separar navegación y control en 3 flujos (Owner/Árbitr@/Espectador)
  - Sin BD - fricción cero - autenticación stateless por socket
  - Un seul Árbitr@ ACTIVO por mesa
  - Kill-Switch para regenerar PIN
  - PIN encriptado en QR
  - URL Scrubbing post-handshake

## 2) Arquitectura actual (AS-IS)
- AuthPage actual tiene 2 botones: Espectador y Árbitro (con PIN hardcodeado '12345')
- El que crea la mesa es automáticamente referee
- PIN de mesa se expone en payload público (bug de seguridad ya resuelto)
- No existe flujo de Tournament Owner con PIN global
- No existe Kill-Switch ni restricción de único árbitro activo
- QR usa PIN en texto plano

## 3) Arquitectura propuesta (TO-BE)

### 3.1 Autenticación por Roles
- **Tournament Owner**: Login con PIN global (de env), acceso total (crear mesas, regenerar PIN, ver dashboard completo)
- **Árbitr@**: Dashboard restringido (ver mesas, unirse con PIN, no puede crear), también puede escanear QR
- **Espectador**: Directo a Waiting Room, solo observa

### 3.2 Seguridad
- Un seul Árbitr@ ACTIVO por mesa - si ya hay referee, `SET_REF` retorna error
- Kill-Switch: Regenerar PIN desconecta al árbitro anterior (emite `REF_REVOKED`)
- PIN en QR encriptado con XOR cipher formato `{encrypted}:{timestamp}`
- URL Scrubbing: post-handshake, cliente limpia `?ePin` de la URL

## 4) Diseño de datos y contratos

### 4.1 Nuevos eventos Socket

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `VERIFY_OWNER` | `{ pin: string }` | Valida PIN global de entorno |
| `OWNER_VERIFIED` | `{ token: string }` | Respuesta exitosa |
| `REGENERATE_PIN` | `{ tableId: string, pin: string }` | Owner regenera PIN de mesa |
| `REF_REVOKED` | `{ tableId: string, reason: string }` | Notifica alárbitro anterior |
| `REF_ROLE_CHECK` | `{ tableId: string }` | Verifica si socket es referee |

### 4.2 Tipos nuevos/modificados

```typescript
// server/src/types.ts
interface QRData {
  hubSsid: string;
  hubIp: string;
  hubPort: number;
  tableId: string;
  tableName: string;
  pin?: string;          // Legacy - mantener optional
  encryptedPin?: string; // NUEVO - PIN encriptado
  url: string;
}

// client/src/shared/types.ts
interface RefRevokedEvent {
  tableId: string;
  reason: 'Regenerado' | 'Expulsado';
}
```

## 5) Reglas de negocio

- RB-01: Tournament Owner debe validarse contra PIN de entorno (`process.env.TOURNAMENT_OWNER_PIN`)
- RB-02: Árbitr@ que llega por Dashboard no puede crear mesas (solo unirse con PIN)
- RB-03: Si mesa tiene referee activo, `SET_REF` con PIN debe retornar error
- RB-04: `REGENERATE_PIN` debe emitir `REF_REVOKED` al socket anterior antes de cambiar PIN
- RB-05: QR debe contener `encryptedPin` (no texto plano)
- RB-06: Post-handshake exitosa, cliente debe ejecutar `history.replaceState()` para limpiar URL

## 6) Seguridad y validaciones

- Validar PIN de Owner contra variable de entorno
- Rate limiting ya implementado en `SET_REF` y `DELETE_TABLE` (5 intentos)
- Verificar que `setReferee()` rechace si ya existe referee activo
- Encriptación XOR simple pero suficiente para POC LAN

## 7) Observabilidad

- Logs de `VERIFY_OWNER` success/failure
- Log de `REGENERATE_PIN` con tableId
- Emitir `REF_REVOKED` solo al socket afectado (no broadcast)

## 8) Plan de implementación técnica

### Fase 1 - Foundation
- Modificar tipos en server y client
- Crear `server/src/utils/pinEncryption.ts` (XOR encrypt/decrypt)

### Fase 2 - Backend
- Modificar `tableManager.ts`: `regeneratePin()`, actualizar `setReferee()` para único árbitro
- Modificar `socketHandler.ts`: handlers `VERIFY_OWNER`, `REGENERATE_PIN`, `REF_ROLE_CHECK`
- Actualizar `generateQRData()` para incluir PIN encriptado

### Fase 3 - Frontend Auth
- Rediseñar AuthPage con 3 botones
- Owner click → PIN input → emit `VERIFY_OWNER`
- Árbitr@ click → navega a Dashboard con rol limitado
- Espectador click → navega a Waiting Room

### Fase 4 - Frontend Dashboard
- Agregar botón "Regenerar PIN" (solo visible para Owner)
- Mostrar indicador de "Árbitr@ activo" en cada tarjeta de mesa
- Handler para `REGENERATE_PIN` y接收 nuevo QR

### Fase 5 - Frontend Scoreboard
- Agregar useEffect para leer `?ePin=` de URL
- Desencriptar y emitir `SET_REF`
- Post-handshake: `history.replaceState()` limpia URL
- Escuchar `REF_REVOKED` y mostrar mensaje

## 9) Plan de migración/compatibilidad

- No hay migración de datos
- backwards compatible: `pin` en QR sigue siendo optional
- El PIN global de Owner se lee de env (default "0000" para dev)

## 10) Plan de pruebas

- Unit: `setReferee()` retorna false si ya hay referee activo
- Unit: `regeneratePin()` genera nuevo PIN de 4 dígitos
- Unit: XOR encrypt/decrypt funciona correctamente
- Integration: Owner login con PIN correcto/incorrecto
- Integration: Kill-Switch emite `REF_REVOKED` y desconecta socket
- E2E: Full flow Owner → crea mesa → QR → Árbitr@ escanea → URL limpiada

## 11) Riesgos técnicos y trade-offs

- Riesgo: Testing de socket con múltiples clientes.
  - Mitigación: Usar timeouts apropiados en tests
- Trade-off: Encriptación XOR no es criptográficamente segura.
  - Mitigación: Suficiente para POC LAN, rotación diaria por timestamp

## 12) Criterios de aceptación técnicos

- [ ] AuthPage muestra 3 botones claros
- [ ] Owner puede hacer login con PIN de entorno
- [ ] Árbitr@ llega a Dashboard sin poder crear mesas
- [ ] Espectador navega directo a Waiting Room
- [ ] QR contiene PIN encriptado (no texto plano)
- [ ] Deep link con `?ePin=` funciona y limpia URL post-handshake
- [ ] Si mesa tiene referee activo, `SET_REF` retorna error
- [ ] Kill-Switch regenera PIN y emite `REF_REVOKED`

## 13) Archivos impactados

| Archivo | Acción |
|---------|--------|
| `server/src/types.ts` | Modificar - agregar `encryptedPin` a QRData |
| `server/src/tableManager.ts` | Modificar - `regeneratePin()`, `setReferee()` single |
| `server/src/socketHandler.ts` | Modificar - handlers nuevos |
| `server/src/utils/pinEncryption.ts` | Crear - XOR encrypt/decrypt |
| `client/src/shared/types.ts` | Modificar - agregar `RefRevokedEvent` |
| `client/src/pages/AuthPage/AuthPage.tsx` | Modificar - 3 botones |
| `client/src/pages/DashboardPage/DashboardPage.tsx` | Modificar - Regenerar PIN, indicador |
| `client/src/pages/ScoreboardPage/ScoreboardPage.tsx` | Modificar - URL scrubbing |

---

**Estado:** Ready  
**Owner técnico:** Felipe  
**Fecha:** 2026-04-09  
**Versión:** v1.0