# Hallazgos

## Criticos

No confirme un hallazgo critico explotable de forma inmediata en esta pasada estatica.

## Altos

1. **Escaneo antivirus de adjuntos no se ejecuta**
   - Evidencia: `attachments-scan.service.ts` (line 46) define `enqueueScan`, pero no hay llamadas; `attachments.service.ts` (line 84) crea el adjunto sin encolar scan, y el schema deja `scanStatus=PENDING` por defecto en `schema.prisma` (line 480).
   - Riesgo: PDFs e imagenes potencialmente maliciosas quedan disponibles para descarga.
   - Recomendacion: llamar scan antes de cifrar o adaptar scan a archivos cifrados; bloquear descarga si `scanStatus` no es `CLEAN` o una politica explicita `SKIPPED`.

2. **Export bundle agrega adjuntos cifrados como ciphertext**
   - Evidencia: upload cifra el archivo en `attachments.service.ts` (line 72); descarga directa si descifra en `attachments.file-operations.ts` (line 43); pero bundle hace `fs.readFile` y mete bytes crudos en `patients-export-bundle.service.ts` (line 131).
   - Riesgo: paquete clinico/regulatorio con adjuntos corruptos o ilegibles.
   - Recomendacion: seleccionar `encryptionEnvelope` y usar `decryptBuffer`, o reutilizar `getAttachmentFile`; agregar test con adjunto cifrado.

3. **PHI puede quedar en storage local del navegador**
   - Evidencia: drafts clinicos en `localStorage` en `encounter-draft.ts` (line 96); cola offline en IndexedDB guarda data en `offline-queue.ts` (line 84); el modo compartido depende de `config/store` en `privacy-settings-store.ts` (line 5).
   - Riesgo: exposicion de PHI en equipos compartidos o ante XSS/perfil de SO comprometido.
   - Recomendacion: forzar shared-device mode en produccion clinica, o cifrar storage cliente con WebCrypto y limpiar al logout; idealmente mover drafts sensibles al backend.

4. **PII fuera de Patient sigue en claro**
   - Evidencia: `PatientDataProcessingConsent.signerName/signerRut` en `schema.prisma` (line 723); se escribe en claro en `patient-consents.service.ts` (line 135). Solicitudes publicas guardan `requesterName/Rut/Email` en `schema.prisma` (line 777). Representante legal NNA esta plaintext en `schema.prisma` (line 120).
   - Riesgo: Phase C reduce identificadores de paciente, pero quedan identidades sensibles en otras tablas.
   - Recomendacion: extender helpers de cifrado/blind indexes a firmantes, solicitantes y representantes; migracion/backfill similar a Patient.

## Medios

5. **Flujo NNA frontend/backend esta desalineado**
   - Evidencia: frontend envia `legalRepresentative*` en `page.tsx` (line 102), pero `CreatePatientDto` no declara esos campos en `create-patient.dto.ts` (line 31). Con `forbidNonWhitelisted` activo, si se envian valores reales el backend rechaza.
   - Riesgo: no se persiste representante legal; brecha funcional/compliance.
   - Recomendacion: agregar DTO + write/read paths cifrados para representante legal, o retirar UI hasta soportarlo.

6. **Busqueda post-decrypt no acotada**
   - Evidencia: pacientes carga todos los candidatos para search/sort nombre en `patients-list-read-model.ts` (line 123); encounters hace lo mismo con search en `encounters-read-side.ts` (line 40); tasks tambien en `patients-task-read-model.ts` (line 89).
   - Riesgo: latencia y memoria degradan con volumen; DoS autenticado.
   - Recomendacion: limites duros, paginacion por cursor, hash exacto para RUT y proyecciones/buscadores normalizados para nombre.

7. **Limite de descargas publicas tiene race condition**
   - Evidencia: verifica `downloadCount >= maxDownloads` y luego incrementa separado en `patient-data-request-delivery.service.ts` (line 168).
   - Riesgo: descargas concurrentes pueden superar `maxDownloads`.
   - Recomendacion: transaccion con `updateMany` condicional (`downloadCount < maxDownloads`) o SQL equivalente atomico.

8. **`legal.service.ts` combina compatibilidad raw SQL, normalizacion y reglas de negocio en 746 lineas**
   - Evidencia: `legal.service.ts` (line 195), `legal.service.ts` (line 272).
   - Riesgo: mantenimiento fragil; futuros cambios con `$queryRawUnsafe` pueden introducir riesgo.
   - Recomendacion: extraer repositorio legal y usar `$queryRaw`/`Prisma.sql` cuando sea posible.

9. **Varios archivos superan el limite operativo de 500 lineas**
   - Evidencia: reporte `wc -l`: `legal.service.ts` 746, `mail.service.ts` 739, `audit.service.ts` 574, varias paginas FE >500.
   - Riesgo: revisiones mas lentas y bugs por acoplamiento.
   - Recomendacion: partir por servicios con mas churn: legal, mail, audit, wizard/ajustes.

## Quick Wins

- En `PatientsExportBundleService`, descifrar adjuntos antes de `archive.append`.
- Llamar `this.scanService.enqueueScan(...)` al crear adjunto y bloquear descarga de `PENDING`/`INFECTED`.
- Agregar DTO backend para `legalRepresentative*` o quitar esos campos del payload temporalmente.
- Anadir `Max`/`Min` a `page`/`limit` de pacientes/tareas y clamp server-side.
- Cambiar descarga publica a incremento atomico condicional.
- Actualizar README de migrations-pending Phase C: aun menciona helpers antiguos (`decryptOrFallback`, Phase A/B).

> Validacion de dependencias: `npm audit --omit=dev --audit-level=high` en backend y frontend; 0 vulnerabilidades reportadas.