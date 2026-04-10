# Tasks - Triple Role Architecture

## Phase 1: Foundation (Types & Encryption)

- [ ] 1.1 Modificar `server/src/types.ts`: agregar `encryptedPin?: string` a `QRData`
- [ ] 1.2 Modificar `client/src/shared/types.ts`: agregar tipo `RefRevokedEvent`
- [ ] 1.3 Crear `server/src/utils/pinEncryption.ts`: funciones XOR encrypt/decrypt con formato `{encrypted}:{timestamp}`

## Phase 2: Backend Implementation

- [ ] 2.1 Modificar `server/src/tableManager.ts`: agregar método `regeneratePin(tableId)` - genera nuevo PIN 4 dígitos
- [ ] 2.2 Modificar `server/src/tableManager.ts`: actualizar `setReferee()` para retornar false si ya existe REFEREE activo
- [ ] 2.3 Modificar `server/src/tableManager.ts`: actualizar `generateQRData()` para incluir PIN encriptado
- [ ] 2.4 Modificar `server/src/socketHandler.ts`: agregar handler `VERIFY_OWNER` - valida PIN de env, emite `OWNER_VERIFIED` o error
- [ ] 2.5 Modificar `server/src/socketHandler.ts`: agregar handler `REGENERATE_PIN` (Kill-Switch) - emite `REF_REVOKED`, desconecta socket anterior, regenera PIN
- [ ] 2.6 Modificar `server/src/socketHandler.ts`: agregar handler `REF_ROLE_CHECK` - verifica si socket es referee

## Phase 3: Client Auth Page

- [ ] 3.1 Modificar `client/src/pages/AuthPage/AuthPage.tsx`: agregar estado `role: 'select' | 'owner-pin' | 'referee-pin'`
- [ ] 3.2 Modificar `client/src/pages/AuthPage/AuthPage.tsx`: renderizar 3 botones (Tournament Owner, Árbitro, Espectador)
- [ ] 3.3 Modificar `client/src/pages/AuthPage/AuthPage.tsx`: Owner click → muestra PinInput, al completar emite `VERIFY_OWNER`
- [ ] 3.4 Modificar `client/src/pages/AuthPage/AuthPage.tsx`: Árbitr@ click → navega a `/dashboard` con rol limitado (sin CREATE_TABLE)
- [ ] 3.5 Modificar `client/src/pages/AuthPage/AuthPage.tsx`: Espectador click → navega a `/waiting-room`

## Phase 4: Client Dashboard

- [ ] 4.1 Modificar `client/src/pages/DashboardPage/DashboardPage.tsx`: agregar estado `isOwner` (del socket)
- [ ] 4.2 Modificar `client/src/pages/DashboardPage/DashboardPage.tsx`: agregar botón "Regenerar PIN" visible solo si `isOwner`
- [ ] 4.3 Modificar `client/src/pages/DashboardPage/DashboardPage.tsx`: handler emit `REGENERATE_PIN`, recibe nuevo QR
- [ ] 4.4 Modificar `client/src/pages/DashboardPage/DashboardPage.tsx`: mostrar indicador "Árbitr@ activo" en cada tarjeta de mesa

## Phase 5: Client Scoreboard & URL Scrubbing

- [ ] 5.1 Modificar `client/src/pages/ScoreboardPage/ScoreboardPage.tsx`: agregar useEffect que lee `?ePin=` de URL
- [ ] 5.2 Modificar `client/src/pages/ScoreboardPage/ScoreboardPage.tsx`: desencriptar PIN y emitir `SET_REF` al socket
- [ ] 5.3 Modificar `client/src/pages/ScoreboardPage/ScoreboardPage.tsx`: post-handshake exitosa → `history.replaceState()` limpia URL
- [ ] 5.4 Modificar `client/src/pages/ScoreboardPage/ScoreboardPage.tsx`: escuchar evento `REF_REVOKED` y mostrar mensaje "Árbitr@ removido"

## Phase 6: Testing & Verification

- [ ] 6.1 Test: Owner login con PIN correcto → Dashboard con privilegios completos
- [ ] 6.2 Test: Owner login con PIN incorrecto → muestra error
- [ ] 6.3 Test: Árbitr@ click → Dashboard sin botón "Crear Mesa"
- [ ] 6.4 Test: Espectador click → navega a Waiting Room
- [ ] 6.5 Test: QR generado contiene `encryptedPin` (no texto plano)
- [ ] 6.6 Test: Deep link con `?ePin=` funciona y limpia URL post-handshake
- [ ] 6.7 Test: Si mesa tiene referee activo, `SET_REF` retorna error "REF_ALREADY_ACTIVE"
- [ ] 6.8 Test: Kill-Switch regenera PIN y emite `REF_REVOKED` al referee anterior
- [ ] 6.9 Build: verificar `npm run build` en client y server sin errores

## Implementation Order

1. Phase 1 (Types + Encryption) → foundation
2. Phase 2 (Backend) → lógica core antes de UI
3. Phase 3 (AuthPage) → nueva interfaz 3 botones
4. Phase 4 (Dashboard) → funcionalidades Owner
5. Phase 5 (Scoreboard) → URL scrubbing
6. Phase 6 (Testing) → validación final