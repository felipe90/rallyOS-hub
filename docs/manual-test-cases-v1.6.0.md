# Manual Test Cases — v1.6.0 (JWT Session Persistence)

> Probar contra GLM 5.2. Marcar con ✅ / ❌ a medida que se verifican.

---

## T01 — Owner login + recarga

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Abrir `{hub-ip}/auth` en el navegador | Se ve la pantalla de autenticación |
| 2 | Ingresar PIN de organizador (8 dígitos) y presionar Enter | Se ve el selector de deporte |
| 3 | Seleccionar deporte, cargar/crear torneo | Se ve el dashboard del owner con las mesas |
| 4 | **Recargar la página** (⌘R / F5) | Sigue logueado como owner, sin pedir PIN |
| 5 | Verificar que se ven las mesas del torneo | Aparecen todas las mesas del torneo |
| 6 | Verificar que se ven las mesas ocupadas por el club | Aparecen las mesas del club en la lista |

**Resultado:** ❌ / ✅

---

## T02 — Owner: QR y PIN

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Estando en el dashboard (post-recarga T01), hacer clic en una mesa | Se abre el modal con QR y PIN |
| 2 | Cerrar modal | Vuelve al dashboard |
| 3 | Hacer clic en regenerar PIN de alguna mesa | El PIN cambia, se actualiza en el modal |
| 4 | **Recargar** y regenerar PIN de nuevo | Funciona igual (sigue siendo owner) |

**Resultado:** ❌ / ✅

---

## T03 — Owner: HTTP endpoints (export)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Sin recargar, navegar a `{hub-ip}/api/tournament/export` | Descarga el CSV |
| 2 | **Recargar** primero (T01 paso 4), luego ir a `/api/tournament/export` | Descarga el CSV (JWT Bearer auth) |

**Resultado:** ❌ / ✅

---

## T04 — Owner: cierre de sesión

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Estando logueado como owner, hacer clic en "Cerrar sesión" | Vuelve a la pantalla de autenticación |
| 2 | **Recargar** la página | Sigue en la pantalla de auth, pide PIN |

**Resultado:** ❌ / ✅

---

## T05 — Club admin login + recarga

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Ir a `{hub-ip}/club/admin` | Se ve la pantalla de ingreso de PIN |
| 2 | Ingresar el PIN de admin del club | Se ve el dashboard del admin con las canchas |
| 3 | **Recargar** (⌘R / F5) | **Sigue en el dashboard del admin** sin pedir PIN |
| 4 | Verificar que se ven las canchas del club | Aparecen las canchas con sus estados |

**Resultado:** ❌ / ✅

---

## T06 — Club admin: CRUD de canchas

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Crear una cancha nueva | Aparece en la lista con estado AVAILABLE |
| 2 | Activar la cancha | Cambia a OCCUPIED, genera PIN |
| 3 | Desactivar la cancha | Vuelve a AVAILABLE |
| 4 | Resetear una cancha FINISHED | Vuelve a estado inicial |
| 5 | Eliminar una cancha | Desaparece de la lista |
| 6 | **Recargar** y repetir pasos 1-5 | Todo funciona igual |

**Resultado:** ❌ / ✅

---

## T07 — Club admin: cierre de sesión

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Estando en dashboard admin, cerrar sesión / ir a otra página | Vuelve a pantalla de PIN |
| 2 | **Recargar** | Pide PIN otra vez (sesión terminada) |

**Resultado:** ❌ / ✅

---

## T08 — Club player: join + scoreboard

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Desde un dispositivo, ir a `{hub-ip}/club/play` | Ingresar PIN de cancha activa |
| 2 | Se ve el scoreboard en vivo | Marcador se actualiza en tiempo real |
| 3 | **Recargar** el dispositivo | Sigue en el scoreboard, se reconecta automáticamente (CLUB_RECONNECT) |

**Resultado:** ❌ / ✅

---

## T09 — Club player: reconexión sin PIN (sesión expirada)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Abrir `{hub-ip}/club/play` en otro dispositivo | |
| 2 | NO ingresar PIN (ir directo a una cancha sin PIN en sessionStorage) | |
| 3 | Si el hook recibe MATCH_UPDATE, debe mostrar "Sesión expirada" | |

> *Nota: Este flujo normalmente no ocurre porque el PIN se guarda al hacer JOIN. Es un caso borde de seguridad.*

**Resultado:** ❌ / ✅

---

## T10 — Session expiration (JWT)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Configurar `SESSION_TOKEN_HOURS=0.016` (~1 minuto) en el servidor | |
| 2 | Hacer login como owner | Login exitoso |
| 3 | Esperar 1 minuto | |
| 4 | **Recargar** | Debe pedir PIN otra vez (JWT expirado) |
| 5 | Restaurar `SESSION_TOKEN_HOURS` al valor original | |

**Resultado:** ❌ / ✅

---

## T11 — JWT inválido / manipulado

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Abrir DevTools → Application → Session Storage | |
| 2 | Editar `rallyos.sessionToken` cambiando el último carácter | |
| 3 | **Recargar** | Debe pedir login (firma inválida) |

**Resultado:** ❌ / ✅

---

## T12 — Múltiples pestañas

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Abrir `{hub-ip}/auth` en dos pestañas | |
| 2 | Login como owner en la primera | |
| 3 | **Recargar** la segunda pestaña | También debe estar logueada (sessionStorage compartido en mismo origen) |

**Resultado:** ❌ / ✅

---

## Resumen

| Test | Escenario | Estado |
|---|---|---|
| T01 | Owner login + recarga | ❌ / ✅ |
| T02 | Owner QR y PIN | ❌ / ✅ |
| T03 | Owner HTTP export | ❌ / ✅ |
| T04 | Owner logout | ❌ / ✅ |
| T05 | Club admin login + recarga | ❌ / ✅ |
| T06 | Club admin CRUD | ❌ / ✅ |
| T07 | Club admin logout | ❌ / ✅ |
| T08 | Club player join + recarga | ❌ / ✅ |
| T09 | Club player sesión expirada | ❌ / ✅ |
| T10 | JWT expiration | ❌ / ✅ |
| T11 | JWT manipulado | ❌ / ✅ |
| T12 | Múltiples pestañas | ❌ / ✅ |
