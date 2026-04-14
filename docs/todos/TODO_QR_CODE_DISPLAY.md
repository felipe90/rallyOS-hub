# TODO - QR Code Display en Dashboard ✅ COMPLETADO

## Contexto
El QR que se muestra en las cards del Dashboard aparecía como imagen rota/incorrecta porque `getQrDisplay()` devolvía una URL de texto en vez de una imagen QR real.

## Estado actual
- ✅ `showQr` está enabled para Owner
- ✅ `getQrDisplay()` eliminado, ahora se usa `QRCodeImage` molecule
- ✅ QRCodeImage renderiza QR real usando `qrcode.react`
- ✅ QR incluye PIN encriptado como `?ePin=` (no texto plano)

## Solución implementada
- Instalado `qrcode.react`
- Creado componente `QRCodeImage` en `client/src/components/molecules/QRCodeImage/`
- Actualizado `TableStatusChip` para usar QRCodeImage
- QR usa deep link con PIN encriptado (XOR + clave diaria)

## Tareas

- [x] (P1) Instalar `qrcode.react` en el cliente
- [x] (P1) Crear componente `QRCodeImage` que tome `tableId` y `pin` y renderice el QR
- [x] (P1) Actualizar `TableStatusChip` para usar el componente QR
- [x] (P1) Testing: verificar que el QR se escanea correctamente

## Alternativas
- Server envía el QR como imagen (mas trabajo, innecesario) - DESCARTADO
- Dejar como está (no hay QR visible) - DESCARTADO

---

**Owner:** raikenwolf  
**Fecha:** 2026-04-13  
**Estado:** ✅ COMPLETADO