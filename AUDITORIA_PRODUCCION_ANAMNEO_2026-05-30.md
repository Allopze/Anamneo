# Auditoria de produccion Anamneo

Fecha: 2026-05-30  
Alcance: auditoria tecnica, producto, seguridad y UX/UI para uso personal o semi-personal de Anamneo como EMR/EHR.

## Veredicto ejecutivo

Anamneo esta bastante cerca de una produccion personal o semi-personal seria. La arquitectura, controles de seguridad, modelo clinico, permisos, cifrado, auditoria y cobertura de pruebas estan por encima de lo esperable para un EMR personal.

No lo pondria todavia con datos reales de salud hasta corregir los hallazgos P1 y hacer una prueba explicita de backup/restauracion. Para evaluacion interna o datos sinteticos, el sistema ya parece apto.

## Lectura general

El producto apunta bien: prioriza flujos de baja friccion, controles pragmaticos y una experiencia clinica con recuperacion ante errores. No se percibe como un sistema enterprise sobredimensionado, sino como una base solida para uso personal serio.

Los puntos mas fuertes son:

- Backend con defensas de arranque, validacion global, Helmet, CSRF, cookies seguras, guardias por rol, auditoria y cifrado de campos sensibles.
- Modelo clinico amplio: pacientes, atenciones, alergias, medicamentos, problemas, tareas, signos vitales, consentimientos, adjuntos, timeline, exports, portal, auditoria y derechos de datos.
- Frontend con flujos utiles para trabajo real: autosave, cola offline, resolucion de conflictos, recuperacion, formularios diferenciados medico/asistente, alertas criticas y resumen longitudinal.
- Buen alineamiento con el criterio del repositorio: bajo mantenimiento, seguridad pragmatica y mismo origen para llamadas `/api`.

## Hallazgos P1

Estos deberian corregirse antes de usar datos reales.

### 1. Vulnerabilidad alta en axios

`npm --prefix frontend run audit:prod` reporta una vulnerabilidad alta asociada a `axios`.

Advisories observados:

- `GHSA-pjwm-pj3p-43mv`
- `GHSA-898c-q2cr-xwhg`
- `GHSA-654m-c8p4-x5fp`
- `GHSA-35jp-ww65-95wh`

Recomendacion: actualizar dependencia/lockfile y volver a correr `npm --prefix frontend run audit:prod`.

### 2. Error real de lint por hook condicional

`npm --prefix frontend run lint` falla por una regla de React en:

- [`frontend/src/components/PatientRegulatoryActions.tsx:37`](frontend/src/components/PatientRegulatoryActions.tsx)
- `useMutation` queda despues de un `return null` condicional.

Riesgo: si `isAdmin` cambia entre renders, el orden de hooks puede romperse.

Recomendacion: mover todos los hooks antes del retorno condicional, o encapsular la vista admin en un componente hijo.

### 3. Lint backend con imports/tipos no usados

`npm --prefix backend run lint:check` falla por imports/tipos no usados en:

- [`backend/src/patients/patients-demographics-mutations.ts`](backend/src/patients/patients-demographics-mutations.ts)
- [`backend/src/patients/patients-merge-data.helpers.ts`](backend/src/patients/patients-merge-data.helpers.ts)
- `backend/test/suites/encounters/encounters-followup-export-review.e2e-group.ts`
- `backend/test/suites/encounters/encounters-followup-output-policy.e2e-group.ts`

Recomendacion: limpiar esos imports y volver a ejecutar lint.

### 4. Backup y restore no deben quedar implicitos

Para datos clinicos personales, el riesgo operativo mas importante no es solo acceso indebido: tambien es perdida de datos.

Recomendacion antes de produccion real:

- Definir ubicacion de backups.
- Confirmar cifrado del volumen o destino.
- Ejecutar una restauracion completa en entorno separado.
- Documentar frecuencia, retencion y comando exacto.

## Hallazgos P2

No bloquean una beta personal, pero conviene resolverlos para una produccion mas confiable.

### 1. Confirmaciones nativas del navegador

Hay usos de `confirm()` / `window.confirm()` en flujos sensibles:

- [`frontend/src/components/common/InProgressEncounterConflictModal.tsx`](frontend/src/components/common/InProgressEncounterConflictModal.tsx)
- [`frontend/src/app/(dashboard)/ajustes/LegalAdminSection.tsx`](frontend/src/app/(dashboard)/ajustes/LegalAdminSection.tsx)
- [`frontend/src/app/(dashboard)/plantillas/page.tsx`](frontend/src/app/(dashboard)/plantillas/page.tsx)
- [`frontend/src/app/(dashboard)/pacientes/nuevo/usePatientFormDraft.ts`](frontend/src/app/(dashboard)/pacientes/nuevo/usePatientFormDraft.ts)

Recomendacion: reemplazarlos por un componente modal propio con foco controlado, copy claro, acciones destructivas diferenciadas y consistencia visual.

### 2. Escaneo de adjuntos opcional

El flujo de adjuntos tiene validaciones importantes: tamano, MIME, extension, magic bytes, proteccion de path traversal, soft delete y cifrado de aplicacion si `ENCRYPTION_KEY` esta configurado.

El escaneo con ClamAV parece opcional. Es aceptable para uso personal con uploads confiables; para exposicion a terceros, conviene activarlo.

### 3. Deriva visual del sistema de diseno

Se observan colores y estilos hardcodeados en zonas como templates de email, auth, medicamentos y graficos.

No es un problema funcional, pero con el tiempo puede erosionar consistencia visual y accesibilidad.

Recomendacion: migrar esos casos a tokens/componentes compartidos gradualmente.

### 4. Ruido en tests frontend

`npm --prefix frontend run test -- --runInBand` pasa, pero aparecen warnings sobre fake timers en tests de sospecha diagnostica.

Recomendacion: limpiar esos warnings para que la suite vuelva a ser una senal mas nitida.

### 5. Politica de PHI local

El frontend cifra borradores/colas locales y contempla modo dispositivo compartido. En produccion, mantener `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` salvo que sea una maquina personal cifrada y controlada.

## Seguridad y privacidad

La postura general es buena para el objetivo del producto.

Aspectos positivos:

- Arranque estricto con validaciones de configuracion.
- JWT con version de sesion y sesiones activas.
- Cookies HttpOnly y SameSite.
- CSRF double-submit para requests mutantes.
- CORS con allowlist.
- Validacion global con whitelist/forbid.
- Separacion razonable de roles y guardias.
- Cifrado de campos sensibles de pacientes.
- Auditoria y trazabilidad.
- Browser traffic mismo origen por `/api`, alineado con la arquitectura.

Notas de cuidado:

- Mantener `.env`, backups, dumps y runtime fuera de Git y en volumen cifrado.
- No relajar `TRUST_PROXY`, CORS, secretos ni `BOOTSTRAP_TOKEN` en produccion.
- Si se habilita portal paciente o uploads de terceros, subir el estandar operativo de adjuntos y monitoreo.

## UX/UI y producto

La experiencia ya cubre buena parte de lo que un EMR personal necesita:

- Busqueda, filtros y resumen de completitud en pacientes.
- Alta de paciente con flujo medico completo y flujo rapido para asistente.
- Detalle de paciente con alergias criticas, resumen longitudinal, alertas, consentimientos, medicamentos, problemas, tareas, signos vitales y acciones regulatorias.
- Workspace de atencion con autosave, offline queue, conflictos, panel de recuperacion, secciones clinicas, warnings y adjuntos.
- Exportaciones, templates, auditoria y derechos de datos.

Mejoras utiles para produccion personal:

- Pantalla o checklist simple de backup/restore y estado de ultima copia.
- Home diario para uso individual: pacientes recientes, tareas vencidas, atenciones abiertas y alertas criticas.
- Resumen imprimible de emergencia por paciente.
- Recordatorios recurrentes simples.
- Estructuras especificas para inmunizaciones y laboratorios si el uso personal lo requiere.
- Busqueda global mas potente sobre notas, metadata de adjuntos y problemas activos.

Mejoras que dejaria para despues:

- FHIR completo.
- Analitica avanzada.
- OCR/importacion masiva de PDFs.
- Multi-tenant complejo.
- Portal paciente muy sofisticado.

## Validacion ejecutada

Pasaron:

- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix backend run build`
- `npm --prefix frontend run build`
- `npm --prefix backend run test -- --runInBand`
- `npm --prefix frontend run test -- --runInBand`
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
- `npm --prefix frontend run test:e2e:smoke`

Resultados relevantes:

- Backend unit/integration: 98 suites pasadas, 533 tests pasados, 1 suite omitida.
- Frontend tests: 74 suites pasadas, 365 tests pasados.
- Backend e2e: 280 tests pasados.
- Frontend smoke Playwright: 2 tests pasados.

Fallaron en la auditoria inicial:

- `npm --prefix frontend run audit:prod`
- `npm --prefix backend run lint:check`
- `npm --prefix frontend run lint`

Limitacion:

- El detector automatico del skill de UI no pudo ejecutarse porque faltaba su bundle local. La revision UI fue manual/estatica mas smoke test.

## Recomendacion final inicial

Para datos sinteticos o evaluacion interna: avanzar.

Para datos reales de salud:

1. Corregir vulnerabilidad de `axios`.
2. Corregir lint frontend por hook condicional.
3. Corregir lint backend.
4. Ejecutar y documentar prueba de backup/restore.
5. Repetir audit, lint, tests y smoke.

Despues de eso, Anamneo parece razonable para produccion personal y tiene una base tecnica madura para su tamano y objetivo.

## Bitacora de remediacion

Fecha de intervencion: 2026-05-30

### Cambios aplicados

- Se inicio un pase de remediacion sobre los hallazgos P1 y P2 de bajo riesgo.
- Se confirmo que `axios` estaba en `1.15.2` en `frontend/package-lock.json`.
- Se confirmo que el error de hooks en `PatientRegulatoryActions.tsx` venia de retornar `null` antes de declarar `useMutation`.
- Se confirmo que los fallos de lint backend eran imports/tipos no usados.
- Se corrigio el orden de hooks en `frontend/src/components/PatientRegulatoryActions.tsx`.
- Se limpiaron imports/tipos no usados en backend y tests e2e.
- Se ejecuto `npm --prefix frontend audit fix`; `axios` quedo resuelto a `1.16.1` en `frontend/package-lock.json`.
- Verificacion parcial posterior: `npm --prefix backend run lint:check` paso.
- Verificacion parcial posterior: `npm --prefix frontend run audit:prod` paso con 0 vulnerabilidades.
- Verificacion parcial posterior: `npm --prefix frontend run lint` paso sin errores; queda 1 warning de hooks en autosave.
- Se corrigio el warning de hooks en `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts`.
- Se reemplazaron las confirmaciones nativas de navegador por `ConfirmModal` en:
  - `frontend/src/components/common/InProgressEncounterConflictModal.tsx`
  - `frontend/src/app/(dashboard)/ajustes/LegalAdminSection.tsx`
  - `frontend/src/app/(dashboard)/plantillas/page.tsx`
  - `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx`
- `frontend/src/app/(dashboard)/pacientes/nuevo/usePatientFormDraft.ts` ahora expone la navegacion pendiente para que la pagina confirme con UI propia. El aviso `beforeunload` se mantiene porque es controlado por el navegador.
- Verificacion parcial posterior: `npm --prefix frontend run typecheck` paso.
- Verificacion parcial posterior: `npm --prefix frontend run lint` paso sin errores ni warnings.
- Se limpio el ruido de fake timers en `frontend/src/__tests__/components/sospecha-diagnostica-section.test.tsx`; el test puntual paso sin warnings.
- Durante la validacion final, `backend test:e2e` detecto fragilidad en el test de filtro de auditoria por fecha del mismo dia. Se ajusto `backend/test/suites/admin.e2e-suite.ts` para crear un audit log propio, derivar la fecha desde su timestamp real y validar `dateFrom/dateTo` sobre ese evento.
- Se amplio la cobertura visual E2E con `frontend/tests/e2e/visual-full-app.spec.ts`.
- La nueva suite complementa `visual-screenshots.spec.ts` y cubre las rutas App Router que faltaban en desktop y mobile: recuperacion/cambio de clave, derechos, activacion/login reset de portal, altas/ediciones/historial/admin de pacientes, nueva atencion, detalle y ficha de atencion, plantillas, seguimientos, reportes, casos de analitica, catalogo de afecciones/medicamentos, home/solicitudes/historial/detalle de portal paciente.
- Se actualizo `npm --prefix frontend run test:e2e:visual` para ejecutar la suite visual historica y la suite full-app nueva.
- Al preparar fixtures reales para portal paciente, Playwright detecto un bug backend: la invitacion de portal fallaba por no tener razon explicita de auditoria para `PatientPortalAccount/CREATE`.
- Se corrigio ese bug agregando `PATIENT_PORTAL_INVITED` al contrato de razones de auditoria, al catalogo, a la inferencia y al log de `PatientPortalService`.
- Se generaron capturas visuales nuevas en `frontend/tests/e2e/screenshots/` para las rutas incorporadas.

### Validacion post-remediacion

Pasaron:

- `npm --prefix backend run lint:check`
- `npm --prefix frontend run lint`
- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix backend run audit:prod`
- `npm --prefix frontend run audit:prod`
- `npm --prefix backend run build`
- `npm --prefix frontend run build`
- `npm --prefix backend run test -- --runInBand`
- `npm --prefix frontend run test -- --runInBand`
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
- `npm --prefix frontend run test:e2e:smoke`
- `npm --prefix backend run test -- --runInBand src/audit/audit-catalog.spec.ts`
- `npm --prefix frontend run test:e2e -- --workers=1 tests/e2e/visual-full-app.spec.ts`
- `npm --prefix frontend run test:e2e:visual`

Resultados post-remediacion:

- Backend unit/integration: 98 suites pasadas, 533 tests pasados, 1 suite omitida.
- Frontend tests: 74 suites pasadas, 365 tests pasados, sin el warning previo de fake timers.
- Backend e2e: 280 tests pasados.
- Frontend smoke Playwright: 2 tests pasados.
- Auditorias npm de produccion: 0 vulnerabilidades high+ en backend y frontend.
- Catalogo de auditoria: 38 tests pasados.
- Nueva cobertura visual full-app: 26 tests pasados, con captura desktop y mobile por ruta.
- Suite visual integrada: 41 tests pasados, combinando capturas historicas y rutas full-app.

### Estado de hallazgos

- P1 `axios`: resuelto.
- P1 hook condicional en acciones regulatorias: resuelto.
- P1 lint backend: resuelto.
- P1 backup/restore: pendiente operacional. Requiere ejecutar una restauracion real en entorno separado.
- P2 confirmaciones nativas: resuelto para navegacion interna y acciones de app. El `beforeunload` nativo se mantiene por ser el mecanismo del navegador.
- P2 warning de fake timers: resuelto.
- P2 escaneo ClamAV: pendiente de decision/configuracion de despliegue.
- P2 deriva visual de tokens: pendiente gradual, no bloqueante.
- P2 politica de PHI local: sin cambio de codigo; mantener modo dispositivo compartido forzado en produccion salvo equipo personal cifrado/controlado.
- Cobertura visual E2E de pantallas App Router: ampliada. Queda como mejora futura convertir parte de estas capturas en regresion visual con comparacion automatica de snapshots, si se quiere bloquear cambios visuales no revisados en CI.

## Siguientes pasos naturales

1. Ejecutar un backup real y restaurarlo en una base nueva; registrar comando, ubicacion, retencion y evidencia.
2. Decidir politica de adjuntos: activar ClamAV si habra uploads de terceros o exposicion publica.
3. Revisar almacenamiento de `runtime/`, dumps y backups para confirmar volumen cifrado y fuera de sincronizacion accidental.
4. Revisar manualmente las capturas generadas en `frontend/tests/e2e/screenshots/` para decidir si alguna pantalla necesita pulido visual.
5. Convertir las capturas mas criticas a snapshots comparativos con umbrales de tolerancia para que CI bloquee regresiones visuales reales.
6. Convertir la deriva visual restante a tokens compartidos cuando se toquen esas pantallas.
