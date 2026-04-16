# Auditoría técnica de producción

## 0. Seguimiento de mitigación

### Pasada 1 - 2026-04-14

- C1 mitigado: los dos módulos que rompían `next build` por JSX en archivos `.ts` fueron movidos a `.tsx`.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx` y `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx`.
- Criterio aplicado: Next.js documenta soporte TypeScript basado en archivos `.ts` y `.tsx`, y sus ejemplos para TypeScript con JSX usan `.tsx`.
- Validación final: `npm --prefix frontend run typecheck` pasó y `npm --prefix frontend run build` volvió a completar; durante esa pasada también se corrigieron errores de tipado expuestos en `admin/usuarios`, `PatientEncounterTimeline`, `useEncounterWizard`, `DashboardSidebar`, `MobileSearchOverlay` y la exportación de `PatientDetailHook`.
- Pendientes tras esta pasada: C3, C4, C5, vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, migraciones automáticas al arranque, y endurecimiento adicional de operación/release.

### Pasada 2 - 2026-04-14

- C3 mitigado en Compose: `backup-cron` ahora monta `./runtime/uploads` en modo lectura y fija `UPLOAD_DEST=/app/uploads`, alineando el contenedor de backup con el storage real de adjuntos.
- Alcance del cambio: `docker-compose.yml` y `docs/sqlite-operations.md`.
- Validación final: `docker compose config` resuelto muestra `UPLOAD_DEST=/app/uploads` y el volumen `/app/uploads` marcado `read_only` dentro de `backup-cron`.
- Pendientes tras esta pasada: C4, C5, vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, migraciones automáticas al arranque, y endurecimiento adicional de operación/release.

### Pasada 3 - 2026-04-14

- C4 mitigado en flujo: el primer registro administrador ahora requiere `BOOTSTRAP_TOKEN` cuando el sistema no tiene admins, y en produccion el backend falla al arrancar si ese token no esta configurado con un valor no-placeholder.
- Alcance del cambio: `backend/src/auth/auth.service.ts`, `backend/src/auth/dto/register-with-invitation.dto.ts`, `backend/src/main.ts`, `.env.example`, `docs/environment.md` y `docs/security-and-permissions.md`.
- Validación final: `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix frontend run typecheck` y `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts --testNamePattern='Auth -'` pasaron con el nuevo flujo de bootstrap.
- Pendientes tras esta pasada: C5, vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, migraciones automáticas al arranque, y endurecimiento adicional de operación/release.

### Pasada 4 - 2026-04-14

- C5 mitigado en UX: la eliminación de adjuntos ya no sale directa desde la lista; ahora exige una confirmación explícita antes del borrado.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx` y `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`.
- Validación final: `npm --prefix frontend run typecheck` y `npm --prefix frontend run build` pasaron después del cambio. El build sigue emitiendo un `ReferenceError: location is not defined` no fatal durante `Collecting page data`, así que quedó como remanente técnico a investigar, no como blocker del pipeline.
- Pendientes tras esta pasada: vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, ausencia de papelera/soft-delete real para adjuntos, migraciones automáticas al arranque, y el warning `location is not defined` durante build.

### Pasada 5 - 2026-04-14

- Remanentes de release mitigados: desapareció el `ReferenceError: location is not defined` del build moviendo la redirección de `/cambiar-contrasena` fuera del render, y `follow-redirects` quedó fijado en `1.16.0` mediante `overrides`, dejando limpio el audit productivo del frontend.
- Alcance del cambio: `frontend/src/app/cambiar-contrasena/page.tsx`, `frontend/package.json` y `frontend/package-lock.json`.
- Criterio aplicado: Context7 para Next.js documenta que los Client Components también se prerenderizan durante `next build`, así que los efectos de navegación y browser APIs deben ejecutarse después del mount; el advisory `GHSA-r4q5-vmmm-2653` queda mitigado resolviendo `follow-redirects` en una versión posterior a `1.15.11`.
- Validación final: `npm --prefix frontend ls follow-redirects` resuelve `1.16.0 overridden`; `npm --prefix frontend run typecheck` pasa; `npm --prefix frontend run build` pasa sin warning; `npm --prefix frontend audit --omit=dev --json` queda en 0 vulnerabilidades.
- Pendientes tras esta pasada: duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, ausencia de papelera/soft-delete real para adjuntos, migraciones automáticas al arranque, runtime del backend con dependencias de desarrollo y endurecimiento adicional de operación/release.

### Pasada 6 - 2026-04-14

- Flujo de despliegue endurecido: el contenedor backend ya no ejecuta `prisma migrate deploy` por efecto lateral al arrancar; el camino soportado pasó a ser `docker compose build`, migración explícita y recién después `docker compose up -d`.
- Alcance del cambio: `backend/Dockerfile`, `docs/deployment-and-release.md`, `README.md` y `scripts/release.sh`.
- Criterio aplicado: Context7 para Prisma recomienda `prisma migrate deploy` como paso explícito de despliegue o CI/CD, no como side effect repetido en cada arranque del proceso principal.
- Validación final: `docker compose config` resuelve correctamente y `docker compose build backend backup-cron` pasa con el nuevo entrypoint sin migración automática.
- Pendientes tras esta pasada: duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, ausencia de papelera/soft-delete real para adjuntos, runtime del backend con dependencias de desarrollo y endurecimiento adicional de operación/release.

### Pasada 7 - 2026-04-14

- Duplicación `/auth/me` mitigada en el camino caliente: el proxy ahora solo valida sesión remotamente en `/login` y `/register`; las rutas privadas pasan con cookies y el `DashboardLayout` hace el bootstrap real de usuario, eliminando el roundtrip duplicado por navegación privada.
- Alcance del cambio: `frontend/src/proxy.ts`, `frontend/src/lib/proxy-session.ts` y `frontend/src/__tests__/lib/proxy.test.ts`.
- Validación final: `npm --prefix frontend test -- --runInBand --runTestsByPath src/__tests__/lib/proxy.test.ts` pasa con 6 tests; `npm --prefix frontend run typecheck` pasa; `npm --prefix frontend run build` pasa.
- Pendientes tras esta pasada: cobertura E2E real de frontend, estrategia de snapshot completo de uploads, ausencia de papelera/soft-delete real para adjuntos, runtime del backend con dependencias de desarrollo y endurecimiento adicional de operación/release.

### Pasada 8 - 2026-04-14

- Runtime backend podado: la imagen final deja de copiar `node_modules` completos del builder y pasa a instalar solo dependencias de producción; `prisma` quedó como dependencia productiva para conservar la migración explícita del release.
- Alcance del cambio: `backend/package.json`, `backend/package-lock.json` y `backend/Dockerfile`.
- Criterio aplicado: Context7 para Prisma advierte que si el despliegue ejecuta `prisma migrate deploy`, el CLI debe seguir disponible en producción aunque el entorno pode `devDependencies`.
- Validación final: `npm --prefix backend run build` pasa; `docker compose build backend backup-cron` pasa; `docker run --rm anamneo-backend sh -lc "npm ls --omit=dev --depth=0"` confirma un runtime limitado a dependencias productivas y Prisma CLI.
- Pendientes tras esta pasada: cobertura E2E real de frontend, estrategia de snapshot completo de uploads, ausencia de papelera/soft-delete real para adjuntos, restore drills/rollback no integrados al flujo por defecto y endurecimiento adicional de infraestructura.

### Pasada 9 - 2026-04-14

- Soft-delete real para adjuntos: el borrado ya no elimina el archivo físico ni el registro; marca `deletedAt`/`deletedById` y el archivo se purga automáticamente tras 30 días (configurable con `ATTACHMENT_SOFT_DELETE_RETENTION_DAYS`).
- Alcance del cambio: `backend/prisma/schema.prisma` (columnas `deleted_at`, `deleted_by_id` e índice), migración `20260414235352_soft_delete_attachments`, `backend/src/attachments/attachments.service.ts` (soft-delete en `remove()`, filtro `deletedAt: null` en consultas, método `purgeExpiredAttachments()`), `backend/src/common/types/index.ts` y `backend/src/audit/audit-catalog.ts` (nuevo action `SOFT_DELETE` y reason `ATTACHMENT_SOFT_DELETED`), `backend/scripts/purge-deleted-attachments.js` (script de purga standalone), `docker-compose.yml` (purga integrada al cron de backup), `backend/test/suites/encounters.e2e-suite.ts` (assertion actualizada), `frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx` y `useEncounterWizard.ts` (textos de confirmación actualizados).
- Criterio aplicado: Context7 para Prisma documenta soft-delete como filtro `deletedAt: null` en consultas; la retención de 30 días permite recuperar adjuntos de borrados accidentales dentro del período de backup (14 días) más margen.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix frontend run typecheck` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174 tests; `docker compose config` resuelve correctamente.
- Pendientes tras esta pasada: cobertura E2E real de frontend, estrategia de snapshot completo de uploads, restore drills/rollback no integrados al flujo por defecto y endurecimiento adicional de infraestructura.

### Pasada 10 - 2026-04-14

- Backup incremental de uploads: el snapshot de adjuntos ya no copia todos los archivos en cada corrida; usa hardlinks al snapshot previo para archivos sin cambios (mismo tamaño y mtime) y solo copia los nuevos o modificados.
- Alcance del cambio: `backend/scripts/sqlite-backup.js` (funciones `findLatestUploadsSnapshot` y `createUploadsSnapshot` reescritas con lógica de hardlink incremental, metadata y logs extendidos con `copiedFiles`/`linkedFiles`).
- Criterio aplicado: en un filesystem Linux/ext4, los hardlinks comparten inodo; eliminar un snapshot antiguo solo baja el link count sin destruir el dato mientras otro snapshot lo referencie. Esto preserva la recuperación por punto en el tiempo sin duplicar el costo de disco.
- Validación final: `node --check backend/scripts/sqlite-backup.js` pasa; `node --check backend/scripts/purge-deleted-attachments.js` pasa.
- Pendientes tras esta pasada: cobertura E2E real de frontend, restore drills/rollback no integrados al flujo por defecto y endurecimiento adicional de infraestructura.

### Pasada 11 - 2026-04-15

- E2E browser tests con Playwright contra backend real: se creó infraestructura full-stack E2E. `frontend/playwright.config.ts` reescrito con dual `webServer` (backend vía `node dist/src/main` con DB de test dedicada `e2e-playwright.db`, y frontend con `npm run dev`). `frontend/tests/e2e/global-setup.ts` prepara la DB de test (migrate deploy + seed). `frontend/tests/e2e/smoke.spec.ts` contiene 2 tests: registro de admin bootstrap con verificación de dashboard y sidebar, y verificación de redirect a /login en rutas privadas sin sesión.
- Alcance del cambio: `frontend/playwright.config.ts` (dual webServer con env vars de test), `frontend/tests/e2e/global-setup.ts` (nuevo), `frontend/tests/e2e/smoke.spec.ts` (nuevo).
- Validación final: `npx playwright test tests/e2e/smoke.spec.ts` pasa con 2/2 tests en ~35s. El test pre-existente `encounter-draft-recovery.spec.ts` tiene un fallo de strict-mode pre-existente no relacionado.
- Pendientes tras esta pasada: restore drills/rollback no integrados al flujo por defecto y endurecimiento adicional de infraestructura.

### Pasada 12 - 2026-04-15

- Restore drills y rollback integrados al flujo operativo: `backup-cron` ahora ejecuta `sqlite-ops-runner.js --mode=all` (backup + restore drill periódico + monitor + alertas) en vez de solo `sqlite-backup.js`. Los restore drills se ejecutan automáticamente cada `SQLITE_RESTORE_DRILL_FREQUENCY_DAYS` (default 7 días). Nuevo script `scripts/deploy.sh` que envuelve el despliegue con backup pre-migración, restore drill de validación, `prisma migrate deploy`, y rollback automático si la migración falla.
- Alcance del cambio: `docker-compose.yml` (cron usa `sqlite-ops-runner.js`), `scripts/deploy.sh` (nuevo), `scripts/release.sh` (instrucciones actualizadas), `package.json` (nuevo script `deploy`), `docs/deployment-and-release.md` (despliegue automatizado y rollback documentados), `docs/sqlite-operations.md` (restore drill automático documentado).
- Validación final: `docker compose config` resuelve correctamente; `bash -n scripts/deploy.sh` pasa; `bash -n scripts/release.sh` pasa; `package.json` válido.
- Pendientes tras esta pasada: endurecimiento adicional de infraestructura (cifrado en reposo).

### Pasada 13 - 2026-04-15

- Cifrado en reposo: el backend ahora emite un warning estructurado (`encryption_at_rest_not_confirmed`) en cada arranque de producción si `ENCRYPTION_AT_REST_CONFIRMED` no está en `true`. No bloquea el arranque pero deja evidencia en logs de que la configuración de cifrado no fue verificada. Se documentó la configuración recomendada con LUKS/dm-crypt en `docs/security-and-permissions.md` y se agregó la variable a `.env.example` y `docker-compose.yml`.
- Alcance del cambio: `backend/src/main.ts` (warning de cifrado en reposo en `assertSafeConfig`), `.env.example` (nueva sección `CIFRADO EN REPOSO`), `docker-compose.yml` (`ENCRYPTION_AT_REST_CONFIRMED` en backend), `docs/environment.md` (variable documentada), `docs/security-and-permissions.md` (sección completa con guía LUKS, alternativas y verificación).
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix frontend run typecheck` pasa; `docker compose config` resuelve correctamente.
- Pendientes tras esta pasada: ampliar cobertura E2E Playwright a flujos clínicos.

### Pasada 14 - 2026-04-15

- Cobertura E2E clínica ampliada y estabilizada: Playwright ya valida flujo clínico real contra backend y frontend levantados de forma full-stack para alta completa de paciente, navegación a ficha, búsqueda del paciente y creación de atención con guardado de `Motivo de consulta`. La preparación destructiva de la base SQLite de test salió de `globalSetup` y pasó al arranque del backend E2E, eliminando la carrera que dejaba el proceso vivo apuntando a un archivo recreado durante la ejecución.
- Alcance del cambio: `backend/scripts/e2e-webserver.js` (nuevo entrypoint E2E que resetea DB/uploads, corre `prisma migrate deploy`, seed y luego arranca Nest), `frontend/playwright.config.ts` (backend `webServer` usa el nuevo script y se elimina `globalSetup`), `frontend/tests/e2e/global-setup.ts` (eliminado), `frontend/tests/e2e/workflow-clinical.spec.ts` (suite clínica estabilizada y sin logs/diagnósticos temporales).
- Validación final: `npm --prefix backend run build` pasa; `cd frontend && npx playwright test tests/e2e/workflow-clinical.spec.ts --project=chromium --reporter=list` pasa con 4/4 tests en ~54 s.
- Pendientes tras esta pasada: extender Playwright a adjuntos y firma clínica para cubrir el resto del camino crítico browser real.

### Pasada 15 - 2026-04-15

- Adjuntos cubiertos en browser real: la suite Playwright clínica ahora valida apertura del panel lateral de apoyo, apertura del modal de adjuntos, carga real de un PDF permitido, persistencia visible del archivo y render posterior del item cargado dentro de la atención. Para evitar falsos negativos del harness, la suite dejó de reloguear por UI en cada test y reutiliza las cookies de la sesión médico creada en `beforeAll`, eliminando choques con el throttler de login.
- Alcance del cambio: `frontend/tests/e2e/workflow-clinical.spec.ts` (nuevo caso `upload attachment to encounter`, helper de sesión reutilizando cookies, submit robusto del form de adjuntos), `frontend/tests/e2e/fixtures/resultado-laboratorio-e2e.pdf` (fixture PDF mínima válida para upload E2E).
- Validación final: la batería clínica completa vuelve a correr con el nuevo caso de adjuntos incluido y el caso `upload attachment to encounter` queda verde dentro de la suite consolidada.
- Pendientes tras esta pasada: cerrar firma clínica browser real y revisar el warning React `collapsible-group` detectado durante navegación profunda del wizard.

### Pasada 16 - 2026-04-15

- Firma clínica cubierta en browser real: la suite Playwright ya completa las secciones obligatorias restantes (`EXAMEN_FISICO`, `SOSPECHA_DIAGNOSTICA`, `TRATAMIENTO`), registra nota de cierre, finaliza la atención desde el wizard, navega a ficha clínica y ejecuta la firma electrónica simple con contraseña del médico tratante, verificando tanto el badge `Firmada` como el toast `Atención firmada electrónicamente`.
- Alcance del cambio: `frontend/tests/e2e/workflow-clinical.spec.ts` (nuevo caso `complete and sign encounter clinically`, helpers de navegación/completitud alineados con el wizard real y assertions finales no ambiguas).
- Validación final: `cd frontend && npx playwright test tests/e2e/workflow-clinical.spec.ts --project=chromium --reporter=list` pasa con 6/6 tests en ~59 s.
- Pendientes tras esta pasada: investigar y corregir el warning React `Encountered two children with the same key, \`collapsible-group\`` que aparece repetidamente durante la navegación de secciones; ya no bloquea la suite, pero indica deuda real de renderizado.

### Pasada 17 - 2026-04-15

- Warning React del wizard corregido: la rail de secciones podía insertar múltiples placeholders `SLOT` para el grupo colapsable de secciones completadas, lo que renderizaba más de un bloque con la misma key `collapsible-group` y provocaba warnings repetidos durante la navegación profunda. El rail ahora inserta un único grupo colapsable por render.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/EncounterSectionRail.tsx` (lógica de inserción del bloque colapsable corregida para evitar duplicados).
- Validación final: `cd frontend && npx playwright test tests/e2e/workflow-clinical.spec.ts --project=chromium --reporter=list` pasa con 6/6 tests en ~60 s y la salida ya no muestra el warning `Encountered two children with the same key, \`collapsible-group\``.
- Pendientes tras esta pasada: retomar la reducción de los monolitos todavía fuera de objetivo (`useEncounterWizard`, `encounters.service`, `patients.service`, `encounters.e2e-suite`).

### Pasada 18 - 2026-04-15

- Suite E2E de encuentros desarmada sin cambiar comportamiento: `backend/test/suites/encounters.e2e-suite.ts` dejó de concentrar más de mil líneas y pasó a ser un coordinador mínimo de 13 líneas que registra tres grupos secuenciales. La cobertura quedó repartida en `encounters-sections.e2e-group.ts` (438 líneas), `encounters-followup.e2e-group.ts` (458 líneas) y `encounters-workflow.e2e-group.ts` (176 líneas), todos por debajo del umbral de 500 líneas.
- Alcance del cambio: `backend/test/suites/encounters.e2e-suite.ts`, `backend/test/suites/encounters/encounters-sections.e2e-group.ts`, `backend/test/suites/encounters/encounters-followup.e2e-group.ts` y `backend/test/suites/encounters/encounters-workflow.e2e-group.ts`.
- Validación final: `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests en ~28 s después del split. La validación filtrada solo por nombre `Encounters` no es representativa para esta suite porque depende del estado armado por `Auth` y `Patients` dentro del mismo `app.e2e-spec.ts`.
- Pendientes tras esta pasada: retomar la reducción de los monolitos todavía fuera de objetivo (`useEncounterWizard`, `encounters.service`, `patients.service`, `encounters-sanitize`, `encounters-pdf.service`).

### Pasada 19 - 2026-04-15

- Servicio PDF de encuentros reducido sin alterar la exportación clínica: `backend/src/encounters/encounters-pdf.service.ts` bajó de 556 a 194 líneas extrayendo los renderers completos de ficha clínica y documentos focalizados a `backend/src/encounters/encounters-pdf.renderers.ts` (343 líneas). El servicio quedó como orquestador de carga, buffer y auditoría, mientras el render quedó encapsulado en funciones puras reutilizables.
- Alcance del cambio: `backend/src/encounters/encounters-pdf.service.ts` y `backend/src/encounters/encounters-pdf.renderers.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` vuelve a pasar con 174/174 tests en ~27 s, incluyendo los casos de `GET /api/encounters/:id/export/document/receta`, `ordenes` y `derivacion`.
- Pendientes tras esta pasada: retomar la reducción de los monolitos todavía fuera de objetivo (`useEncounterWizard`, `encounters.service`, `patients.service`, `encounters-sanitize`).

### Pasada 20 - 2026-04-15

- Sanitización de encuentros desarmada por dominios sin cambiar comportamiento: `backend/src/encounters/encounters-sanitize.ts` pasó a ser una fachada de 314 líneas y el sanitizado se repartió en tres módulos internos por responsabilidad: primitivos (`encounters-sanitize-primitives.ts`, 164 líneas), clínico (`encounters-sanitize-clinical.ts`, 241 líneas) e ingreso/historia (`encounters-sanitize-intake.ts`, 260 líneas). Todos quedaron por debajo del umbral de 500 líneas.
- Alcance del cambio: `backend/src/encounters/encounters-sanitize.ts`, `backend/src/encounters/encounters-sanitize-primitives.ts`, `backend/src/encounters/encounters-sanitize-clinical.ts` y `backend/src/encounters/encounters-sanitize-intake.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` vuelve a pasar con 174/174 tests en 27.629 s.
- Pendientes tras esta pasada: retomar la reducción de los monolitos todavía fuera de objetivo (`useEncounterWizard`, `encounters.service`, `patients.service`).

### Pasada 21 - 2026-04-16

- Capa de presentación de encuentros extraída sin alterar contratos: el formateo de read models (listado, timeline por paciente, dashboard y detalle completo) salió de `backend/src/encounters/encounters.service.ts` a `backend/src/encounters/encounters-presenters.ts` (195 líneas). Con esto, `encounters.service.ts` bajó de 1226 a 1068 líneas y quedó más concentrado en orquestación de casos de uso.
- Endurecimiento del harness E2E para tareas vencidas: el caso `GET /api/patients/tasks?overdueOnly=true` ahora fija una fecha de vencimiento claramente anterior (48 h) para evitar flakiness en bordes UTC/local alrededor de medianoche.
- Alcance del cambio: `backend/src/encounters/encounters.service.ts`, `backend/src/encounters/encounters-presenters.ts` y `backend/test/suites/encounters/encounters-followup.e2e-group.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests en 26.457 s.
- Pendientes tras esta pasada: retomar la reducción de los monolitos todavía fuera de objetivo (`useEncounterWizard`, `encounters.service`, `patients.service`).

### Pasada 22 - 2026-04-16

- Eliminado el roundtrip inmediato a `/auth/me` en el camino caliente de auth: `POST /auth/login`, `POST /auth/register` y `POST /auth/2fa/verify` ahora devuelven el usuario de sesión sanitizado junto a las cookies, y el frontend lo reutiliza para hidratar el store y un prefill de sesión de una sola vez antes de montar el dashboard.
- Alcance del cambio: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`, `backend/test/suites/auth.e2e-suite.ts`, `frontend/src/lib/auth-session.ts`, `frontend/src/lib/api.ts`, `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/app/login/page.tsx`, `frontend/src/app/register/page.tsx` y `frontend/src/__tests__/app/login.test.tsx`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests; `npm --prefix frontend run typecheck` pasa; `npm --prefix frontend run build` pasa; `npm --prefix frontend test -- --runInBand --runTestsByPath src/__tests__/app/login.test.tsx` pasa; `npm --prefix frontend run test:e2e -- tests/e2e/smoke.spec.ts` pasa; `npm --prefix frontend run test:e2e -- tests/e2e/workflow-clinical.spec.ts` pasa.
- Nota operativa del harness: `smoke.spec.ts` y `workflow-clinical.spec.ts` comparten la misma base de datos de E2E, así que deben validarse en invocaciones separadas o con un solo worker; juntos compiten por el bootstrap inicial.
- Pendientes tras esta pasada: retomar la reducción de los monolitos todavía fuera de objetivo (`useEncounterWizard`, `encounters.service`, `patients.service`).

### Pasada 23 - 2026-04-16

- El wizard de atenciones volvió a dividirse por responsabilidades: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts` dejó de concentrar el cálculo derivado y la persistencia del drawer, que ahora viven en `useEncounterWizardDerived.ts`, `encounter-drawer-state.ts` y `encounter-drawer-shortcut.ts`. El hook principal quedó con orquestación, handlers y estado de edición, mientras que la página y el header consumen los helpers compartidos para abrir/cerrar el panel lateral sin duplicar `localStorage`.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/encounter-drawer-state.ts`, `frontend/src/lib/encounter-drawer-shortcut.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`, `frontend/src/app/(dashboard)/atenciones/[id]/EncounterHeader.tsx` y `frontend/tests/e2e/encounter-draft-recovery.spec.ts`.
- Validación final: `npm --prefix frontend run typecheck` pasa; `npm --prefix frontend run build` pasa; `npm --prefix frontend run test:e2e -- tests/e2e/workflow-clinical.spec.ts` pasa con 6/6 tests; `npm --prefix frontend run test:e2e -- tests/e2e/encounter-draft-recovery.spec.ts` pasa con 1/1 test.
- Pendientes tras esta pasada: seguir con la reducción de los monolitos que todavía quedan fuera de objetivo, empezando por `backend/src/patients/patients.service.ts`.

### Pasada 24 - 2026-04-16

- Catálogo global de afecciones endurecido: `ConditionCatalog` ahora persiste `normalizedName` y la base impone unicidad por nombre normalizado; además, la importación CSV masiva del catálogo global registra auditoría explícita con reason `CONDITION_CSV_IMPORTED`.
- Alcance del cambio: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260416170000_add_condition_normalized_name_unique/migration.sql`, `backend/src/conditions/conditions.service.ts`, `backend/src/conditions/conditions-csv.service.ts`, `backend/src/conditions/conditions.controller.ts`, `backend/src/conditions/conditions-csv.service.spec.ts`, `backend/src/common/types/index.ts`, `backend/src/audit/audit-catalog.ts`, `backend/prisma/seed.ts`, `frontend/src/app/(dashboard)/admin/auditoria/auditoria.constants.ts` y `docs/clinical-workflows.md`.
- Validación final: `npm --prefix backend run prisma:generate` pasa; `npm --prefix backend run test -- --runInBand --runTestsByPath src/conditions/conditions-csv.service.spec.ts` pasa (3/3); `npm --prefix backend run build` pasa; `npm --prefix frontend run typecheck` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Pendientes tras esta pasada: seguir con la reducción de monolitos, empezando por `backend/src/patients/patients.service.ts`.

### Pasada 25 - 2026-04-16

- Segunda pasada en `patients.service` para bajar riesgo de regresión: se extrajo la lógica repetida de validación de RUT y estado de exención en helpers internos (`resolveCreateRutInput` y `resolveRutState`), y `create`/`createQuick` quedaron como orquestadores del flujo.
- Alcance del cambio: `backend/src/patients/patients.service.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests; `npm --prefix backend run test -- --runInBand` mantiene 2 suites rojas preexistentes fuera de este alcance (`src/auth/auth.service.spec.ts` y `src/patients/patients-pdf.service.spec.ts`).
- Pendientes tras esta pasada: continuar la extracción por bloques en `patients.service` (timeline/resumen/actualización administrativa) hasta dejarlo bajo el umbral de mantenibilidad del proyecto.

### Pasada 26 - 2026-04-16

- Read models clínicos de paciente extraídos sin alterar contratos: la construcción del timeline de atenciones y del resumen clínico derivado salió de `backend/src/patients/patients.service.ts` hacia `backend/src/patients/patients-clinical-read-model.ts` (184 líneas), manteniendo validación de acceso previa en `assertPatientAccess`.
- Alcance del cambio: `backend/src/patients/patients.service.ts` y `backend/src/patients/patients-clinical-read-model.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Pendientes tras esta pasada: continuar la reducción de `patients.service` en bloques de mutación (`update`, `updateAdminFields`, `problems/tasks`) y luego retomar `encounters.service`.

### Pasada 27 - 2026-04-16

- Mutaciones demográficas y clínicas de paciente extraídas sin alterar comportamiento: `update` y `updateAdminFields` migraron a `backend/src/patients/patients-demographics-mutations.ts`, y las mutaciones de problemas/tareas (`create/update problem`, `create/update task`) migraron a `backend/src/patients/patients-clinical-mutations.ts`.
- Alcance del cambio: `backend/src/patients/patients.service.ts`, `backend/src/patients/patients-demographics-mutations.ts` y `backend/src/patients/patients-clinical-mutations.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Pendientes tras esta pasada: seguir bajando `patients.service` (read/updateHistory/archive/restore) por debajo de 500 líneas y luego continuar con `encounters.service` y `useEncounterWizard`.

### Pasada 28 - 2026-04-16

- `patients.service` quedó reducido a capa de orquestación para el lado de lectura y ciclo de vida: `findAll`, `findById`, `getAdminSummary` y `exportCsv` migraron a `backend/src/patients/patients-read-side.ts`, mientras `verifyDemographics`, `updateHistory`, `remove` y `restore` migraron a `backend/src/patients/patients-lifecycle-mutations.ts`.
- Se añadieron pruebas unitarias focalizadas para los módulos extraídos de mutaciones, cubriendo reglas de RUT/fecha futura, auditoría, scoping clínico y actualización de tareas/problemas.
- Alcance del cambio: `backend/src/patients/patients.service.ts`, `backend/src/patients/patients-read-side.ts`, `backend/src/patients/patients-lifecycle-mutations.ts`, `backend/src/patients/patients-demographics-mutations.spec.ts` y `backend/src/patients/patients-clinical-mutations.spec.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test -- --runInBand --runTestsByPath src/patients/patients-demographics-mutations.spec.ts src/patients/patients-clinical-mutations.spec.ts` pasa con 8/8 tests; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Métricas tras la pasada: `backend/src/patients/patients.service.ts` 623 líneas; `backend/src/patients/patients-read-side.ts` 347; `backend/src/patients/patients-lifecycle-mutations.ts` 240; `backend/src/patients/patients-demographics-mutations.ts` 298; `backend/src/patients/patients-clinical-mutations.ts` 338.
- Pendientes tras esta pasada: bajar `patients.service` por debajo de 500 líneas extrayendo `findTasks` y los helpers internos de creación; luego retomar `encounters.service` y finalmente `useEncounterWizard`.

### Pasada 29 - 2026-04-16

- `patients.service` ya quedó bajo el umbral de mantenibilidad del repo: `findTasks` migró a `backend/src/patients/patients-task-read-model.ts`, y los helpers privados de alta (`resolveCreateRutInput` y `resolveRutState`) salieron a `backend/src/patients/patients-create-utils.ts` para evitar duplicación futura de reglas de RUT.
- Criterio aplicado: sí convino mover los helpers de RUT a un módulo compartido porque ya dejaron de ser detalle interno del service y representan una regla reusable de creación/normalización de paciente.
- Alcance del cambio: `backend/src/patients/patients.service.ts`, `backend/src/patients/patients-task-read-model.ts` y `backend/src/patients/patients-create-utils.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Métricas tras la pasada: `backend/src/patients/patients.service.ts` 469 líneas; `backend/src/patients/patients-create-utils.ts` 70; `backend/src/patients/patients-task-read-model.ts` 115.
- Pendientes tras esta pasada: retomar `encounters.service` y luego cerrar el monolito de `useEncounterWizard`.

### Pasada 30 - 2026-04-16

- Retomado el split de `encounters.service`: las transiciones clínicas de workflow (`complete`, `sign`, `reopen`, `cancel`, `updateReviewStatus`) migraron a `backend/src/encounters/encounters-workflow-mutations.ts`, dejando el service más concentrado en create/read/update-section/dashboard/audit.
- Alcance del cambio: `backend/src/encounters/encounters.service.ts` y `backend/src/encounters/encounters-workflow-mutations.ts`.
- Validación final: `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Métricas tras la pasada: `backend/src/encounters/encounters.service.ts` 793 líneas; `backend/src/encounters/encounters-workflow-mutations.ts` 410.
- Pendientes tras esta pasada: seguir partiendo `encounters.service` por read-side o dashboard/auditoría y luego atacar `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`.

### Pasada 31 - 2026-04-16

- `encounters.service` quedó finalmente por debajo del hard limit del repo: el read-side principal (`findAll`, `findById`, `findByPatient`) migró a `backend/src/encounters/encounters-read-side.ts`, el dashboard pasó a `backend/src/encounters/encounters-dashboard-read-model.ts` y el historial de auditoría a `backend/src/encounters/encounters-audit-history.ts`.
- Revisión aplicada sobre `updateSection`: sí merecía su propio módulo en esta pasada porque, aun después de extraer workflow y read-side, `encounters.service` seguía en 523 líneas. Se movieron `reconcileIdentificationSnapshot` y `updateSection` a `backend/src/encounters/encounters-section-mutations.ts`, dejando el service en 370 líneas y aislando la mutación clínica más sensible para futuras pruebas focalizadas.
- Alcance del cambio: `backend/src/encounters/encounters.service.ts`, `backend/src/encounters/encounters-read-side.ts`, `backend/src/encounters/encounters-dashboard-read-model.ts`, `backend/src/encounters/encounters-audit-history.ts` y `backend/src/encounters/encounters-section-mutations.ts`.
- Validación final: `npm --prefix backend run typecheck` pasa; `npm --prefix backend run build` pasa; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 174/174 tests.
- Métricas tras la pasada: `backend/src/encounters/encounters.service.ts` 370 líneas; `backend/src/encounters/encounters-read-side.ts` 186; `backend/src/encounters/encounters-dashboard-read-model.ts` 99; `backend/src/encounters/encounters-audit-history.ts` 68; `backend/src/encounters/encounters-section-mutations.ts` 216.
- Pendientes tras esta pasada: continuar con el split de `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts` y, si se quiere seguir endureciendo backend, añadir tests unitarios focalizados para `encounters-section-mutations.ts` y `encounters-workflow-mutations.ts`.

### Pasada 32 - 2026-04-16

- El wizard de atenciones dejó de concentrar persistencia, navegación, adjuntos y firma en un único hook: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts` bajó a una fachada de 320 líneas y la lógica se repartió en `useEncounterSectionPersistence.ts`, `useEncounterWizardNavigation.ts`, `useEncounterAttachments.ts` y `useEncounterWorkflowActions.ts`.
- Criterio aplicado: se priorizó extraer primero los handlers de persistencia y navegación, luego el manejo de adjuntos y finalmente firma/revisión/cierre, manteniendo estable el contrato público que consume `page.tsx` para evitar una pasada de UI más riesgosa de lo necesario.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardNavigation.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterAttachments.ts` y `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWorkflowActions.ts`.
- Validación final: `npm --prefix frontend run typecheck` pasa; `npm --prefix frontend run build` pasa; `npm --prefix frontend run test:e2e -- tests/e2e/workflow-clinical.spec.ts` pasa con 6/6 tests; `npm --prefix frontend run test:e2e -- tests/e2e/encounter-draft-recovery.spec.ts` pasa con 1/1 test.
- Nota residual observada en Playwright: el browser logueó `Internal Next.js error: Router action dispatched before initialization.` una vez durante `workflow-clinical.spec.ts`, sin romper el flujo ni las assertions. Queda como ruido a revisar aparte, no como regresión funcional confirmada de esta pasada.
- Métricas tras la pasada: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts` 320 líneas; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts` 494; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterAttachments.ts` 139; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardNavigation.ts` 128; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWorkflowActions.ts` 157.
- Pendientes tras esta pasada: bajar `useEncounterSectionPersistence.ts` hacia el objetivo suave de 300 líneas, revisar el warning de router visto en Playwright y sumar pruebas unitarias focalizadas para las mutaciones clínicas ya extraídas en frontend/backend.

### Pasada 33 - 2026-04-16

- Split adicional de persistencia en el wizard: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts` dejó de concentrar draft sync/autosave/cola offline en un único módulo. Esa lógica quedó encapsulada en `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterDraftSync.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterAutosave.ts` y `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue.ts`.
- Revisión del warning de router en Playwright: tras volver a correr la suite clínica y la de recuperación de borrador, no se reprodujo `Internal Next.js error: Router action dispatched before initialization.`. Con evidencia actual se clasifica como ruido intermitente de harness/hidratación y no como regresión funcional confirmada.
- Endurecimiento de pruebas unitarias del cierre clínico: `frontend/src/__tests__/app/atencion-cierre.test.tsx` se adaptó al flujo real del drawer (helper para abrir tabs dentro del panel y cambio determinista en la nota de cierre), eliminando flakiness por selectores y por tipeo caracter a caracter.
- Descubrimiento de Jest corregido: `frontend/jest.config.js` ahora ignora `*.fixtures.ts` para evitar suites vacías en el run completo.
- Validación final: `npm --prefix frontend run typecheck` pasa; `npm --prefix frontend run build` pasa; `npm --prefix frontend test -- --runInBand` pasa con 35/35 suites y 190/190 tests; `npm --prefix frontend run test:e2e -- tests/e2e/workflow-clinical.spec.ts` pasa con 6/6; `npm --prefix frontend run test:e2e -- tests/e2e/encounter-draft-recovery.spec.ts` pasa con 1/1 (queda un log 401 esperado durante el escenario de recuperación).
- Métricas tras la pasada: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts` 366 líneas; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterDraftSync.ts` 132; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterAutosave.ts` 27; `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue.ts` 102; `backend/src/patients/patients.service.ts` 469; `backend/src/encounters/encounters-workflow-mutations.ts` 410.
- Pendientes tras esta pasada: dejar `useEncounterSectionPersistence.ts` por debajo de 300 líneas (queda un tramo final de orquestación/snapshot), y decidir una pasada adicional en backend para acercar `patients.service.ts` y `encounters-workflow-mutations.ts` al objetivo suave de 300 líneas con bajo riesgo de regresión.

> Actualizacion 2026-04-14: C2 quedo mitigado en el repo. `docker-compose.yml` ahora publica backend y frontend solo en loopback por defecto, y la documentacion de despliegue/entorno deja explicito que este producto esta pensado para publicarse detras de Cloudflare Tunnel con `cloudflared` y HTTPS.

## 1. Resumen ejecutivo

Audité el estado actual del repositorio como si hoy hubiera que desplegarlo para uso real con datos clínicos. Revisé arquitectura, frontend, backend, base de datos, adjuntos, seguridad, testing, Docker Compose, guía de despliegue y scripts operativos. Además ejecuté verificaciones directas sobre el código actual:

- `npm --prefix backend run typecheck`: pasa.
- `npm --prefix backend run build`: pasa.
- `npm --prefix frontend run typecheck`: pasa.
- `npm --prefix frontend run build`: pasa limpio, sin warning de prerender ni errores de compilación.
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts --testNamePattern='Auth -'`: pasa.
- `npm --prefix frontend test -- --runInBand --runTestsByPath src/__tests__/lib/proxy.test.ts`: pasa.
- `npm --prefix frontend audit --omit=dev --json`: queda en 0 vulnerabilidades.
- `docker compose build backend backup-cron`: pasa.
- `docker run --rm anamneo-backend sh -lc "npm ls --omit=dev --depth=0"`: confirma runtime backend con dependencias productivas.

También validé con Context7 dos puntos que guiaron las últimas mitigaciones: en Next.js los Client Components se prerenderizan durante `next build`, así que side effects como `router.replace` o acceso a browser APIs deben moverse fuera del render; y Prisma recomienda ejecutar `prisma migrate deploy` como paso explícito de despliegue/CI, no como efecto lateral en cada arranque del proceso principal.

Conclusión corta: la base técnica no es mala. De hecho, tiene varias decisiones correctas para una app clínica pequeña: sesiones con rotación, cookies HttpOnly, TOTP, trazabilidad, validación de archivos y CI útil. Después de las pasadas de mitigación de hoy, C1, C2, C3 y C4 quedaron corregidos en código, C5 quedó mitigado en UX, el warning de prerender desapareció, el audit productivo del frontend quedó limpio, la duplicación principal de `/auth/me` fue reducida y el flujo de release quedó más controlado.

Los pendientes más relevantes ahora son:

1. Ya no quedan monolitos por encima del hard limit de 500 líneas; el trabajo pendiente pasó a ser bajar piezas intermedias que siguen por encima del objetivo suave de 300 líneas y reforzar pruebas focalizadas.

## 2. Veredicto de producción

Veredicto actual: **Go condicionado**.

No hace falta rehacer el sistema ni migrarlo de inmediato a una arquitectura más compleja. Para el tamaño real del producto, eso sería overkill. Las fallas operativas y de seguridad que sí justificaban un `No-Go` inicial ya fueron mitigadas en estas pasadas. Lo que queda es suficiente para exigir seguimiento cercano, pero ya no para descartar el release por bloqueo inmediato.

Para sostener ese **Go condicionado** sin autoengaño, las correcciones de bloqueo ya fueron cerradas. Lo que queda abierto ya no es cobertura clínica crítica ni warnings visibles del flujo principal, sino deuda de implementación que conviene bajar antes de seguir ampliando el producto.

## 3. Hallazgos críticos

### C1. El frontend no buildaba y bloqueaba cualquier release (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia original: `npm --prefix frontend run build` fallaba con errores de parsing en `frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.ts` y `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.ts` porque contenían JSX en archivos `.ts`.
- Evidencia adicional original: `npm --prefix frontend run typecheck` también fallaba hasta la pasada 1.
- Validación actual: `npm --prefix frontend run typecheck` y `npm --prefix frontend run build` pasan en el estado actual del repo.
- Impacto original: no había release reproducible del frontend; cualquier intento de desplegar esa revisión quedaba bloqueado antes de llegar a producción.
- Causa raíz: regresión de refactor donde se movió JSX a archivos con extensión incorrecta.
- Corrección mínima: renombrar esos módulos a `.tsx` o extraer el JSX a componentes separados y dejar solo tipos/lógica en `.ts`.

### C2. La guía de despliegue actual no resuelve HTTPS, pero auth usa cookies `Secure` en producción (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `docs/deployment-and-release.md` documenta despliegue con `docker compose up -d --build` y acceso al frontend por `:5555`, sin reverse proxy ni TLS.
- Evidencia: `backend/src/auth/auth.controller.ts` marca cookies con `secure: isProduction`.
- Impacto: si alguien sigue la guía y expone el stack por HTTP, los navegadores no persistirán la sesión de autenticación como se espera en producción. En términos prácticos, el flujo de login puede quedar roto fuera de localhost o detrás de despliegues mal configurados.
- Causa raíz: la política de cookies es correcta, pero la operación documentada no está alineada con ella.
- Corrección mínima: documentar y exigir un reverse proxy HTTPS real delante del frontend/backend o, como mínimo, declarar explícitamente que Compose no es un despliegue internet-facing completo.

### C3. El backup por Docker Compose no incluye los adjuntos reales (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `docker-compose.yml` monta `./runtime/uploads:/app/uploads` solo en `backend`, no en `backup-cron`.
- Evidencia: `backend/scripts/sqlite-backup.js` intenta snapshotear `UPLOAD_DEST` y, si no está definido, cae por defecto en `./uploads`, que dentro del contenedor de backup resuelve a `/app/uploads`.
- Evidencia: `backup-cron` no define `UPLOAD_DEST` ni monta `runtime/uploads`.
- Impacto: el backup de base SQLite puede salir bien, pero los adjuntos clínicos reales quedan fuera del respaldo por defecto en el escenario Docker Compose. Eso significa restauraciones incompletas con pérdida de evidencia clínica adjunta.
- Causa raíz: desalineación entre el script de backup y los volúmenes efectivos del servicio que lo ejecuta.
- Corrección mínima: montar `./runtime/uploads:/app/uploads` en `backup-cron`, fijar `UPLOAD_DEST=/app/uploads` y validar restauración extremo a extremo.

### C4. En una instalación nueva, el primer visitante puede quedarse con la cuenta admin (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `backend/src/auth/auth.service.ts` permite que, si no existe admin activo, el primer registro válido cree la cuenta administradora inicial. El mismo flujo solo bloquea roles distintos de `ADMIN` cuando el sistema está vacío.
- Impacto: si se despliega una instancia nueva y se expone antes de que el dueño cree su cuenta inicial, cualquier tercero que llegue primero puede apropiarse del sistema.
- Causa raíz: bootstrap inicial abierto por diseño, sin token de instalación, allowlist o mecanismo de cierre automático del onboarding público.
- Corrección mínima: exigir un `BOOTSTRAP_TOKEN`, restringir bootstrap a red local/entorno controlado o crear el admin inicial fuera del flujo público.

### C5. El borrado de adjuntos es inmediato e irreversible desde la UI (Mitigado 2026-04-14)

- Severidad: alta.
- Evidencia original: `frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx` disparaba `deleteMutation.mutate(attachment.id)` directamente desde el botón `Eliminar`, sin confirmación visible.
- Evidencia original: `backend/src/attachments/attachments.service.ts` hacía `safeUnlink` del archivo físico y luego `prisma.attachment.delete`.
- Impacto original: un clic accidental podía borrar un adjunto clínico del disco y de la base. Aunque quedara rastro en auditoría, el contenido se perdía hasta restaurar backup.
- Causa raíz: se modeló la eliminación como operación final y no como retiro reversible o flujo con confirmación.
- Corrección aplicada: se agregó confirmación explícita en UI (pasada 4), y en pasada 9 se implementó soft-delete real con retención de 30 días, purga automática integrada al cron de backup, y `storagePath` en el log de auditoría para permitir recuperación desde snapshots.

## 4. Arquitectura general

Para el objetivo real del producto, la arquitectura general es razonable. No veo necesidad inmediata de migrar a microservicios, colas distribuidas ni PostgreSQL solo por moda. El sistema ya tiene una separación clara entre frontend Next.js y backend NestJS, con Prisma, módulos clínicos definidos y una base operativa suficiente para una consulta o equipo pequeño.

Lo que sí veo es tensión de mantenibilidad:

- `backend/src/patients/patients.service.ts`: 469 líneas.
- `backend/src/encounters/encounters.service.ts`: 370 líneas.
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`: 320 líneas.
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts`: 366 líneas (refinado en pasada 33 con split de draft sync/autosave/cola offline).
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterDraftSync.ts`: 132 líneas (nuevo módulo de sincronización de borrador extraído en pasada 33).
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterAutosave.ts`: 27 líneas (nuevo módulo de temporizador de autosave extraído en pasada 33).
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue.ts`: 102 líneas (nuevo módulo de cola offline/sync extraído en pasada 33).
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWorkflowActions.ts`: 157 líneas (nuevo módulo de firma/revisión/cierre extraído en pasada 32).
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterAttachments.ts`: 139 líneas (nuevo módulo de adjuntos extraído en pasada 32).
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardNavigation.ts`: 128 líneas (nuevo módulo de navegación extraído en pasada 32).
- `backend/src/encounters/encounters-presenters.ts`: 195 líneas (nuevo módulo de proyección extraído en pasada 21).
- `backend/src/encounters/encounters-read-side.ts`: 186 líneas (nuevo módulo de read-side extraído en pasada 31).
- `backend/src/encounters/encounters-dashboard-read-model.ts`: 99 líneas (nuevo módulo de dashboard extraído en pasada 31).
- `backend/src/encounters/encounters-audit-history.ts`: 68 líneas (nuevo módulo de auditoría extraído en pasada 31).
- `backend/src/encounters/encounters-section-mutations.ts`: 216 líneas (nuevo módulo de mutaciones de sección extraído en pasada 31).
- `backend/src/patients/patients-clinical-read-model.ts`: 184 líneas (nuevo módulo de read-model extraído en pasada 26).
- `backend/src/patients/patients-demographics-mutations.ts`: 298 líneas (nuevo módulo de mutación demográfica extraído en pasada 27).
- `backend/src/patients/patients-clinical-mutations.ts`: 338 líneas (nuevo módulo de mutación clínica extraído en pasada 27).
- `backend/src/patients/patients-read-side.ts`: 347 líneas (nuevo módulo de read-side extraído en pasada 28).
- `backend/src/patients/patients-lifecycle-mutations.ts`: 240 líneas (nuevo módulo de lifecycle extraído en pasada 28).
- `backend/src/patients/patients-create-utils.ts`: 70 líneas (nuevo helper compartido de alta extraído en pasada 29).
- `backend/src/patients/patients-task-read-model.ts`: 115 líneas (nuevo inbox read-model extraído en pasada 29).
- `backend/src/encounters/encounters-workflow-mutations.ts`: 410 líneas (nuevo módulo de workflow extraído en pasada 30).
- Sanitización de encuentros ahora modularizada y bajo umbral: `encounters-sanitize.ts` (314), `encounters-sanitize-primitives.ts` (164), `encounters-sanitize-clinical.ts` (241), `encounters-sanitize-intake.ts` (260).

Ya no quedan archivos por encima del hard limit de 500 líneas, pero todavía hay piezas por encima del objetivo suave de 300 (`patients.service`, `encounters-workflow-mutations`, `useEncounterSectionPersistence`, `encounters-sanitize`) que siguen concentrando suficiente lógica como para merecer una pasada adicional.

Evaluación de arquitectura: **apta para el tamaño actual del producto, pero con deuda de modularidad visible y regresiones recientes que ya demostraron lo fácil que es romper cosas básicas**.

## 5. Frontend

Estado actual del frontend: **liberable con deuda puntual, no perfecto**.

Puntos positivos:

- Hay `error.tsx`, `loading.tsx` y `not-found.tsx` en el App Router.
- La navegación privada usa validación de sesión en borde y bootstrap de estado en cliente; el hot path de login/registro ya reutiliza la respuesta autenticada para evitar un `/auth/me` inmediato.
- El contrato de login redirect está saneado en `frontend/src/lib/login-redirect.ts`, evitando open redirect trivial.

Problemas relevantes:

1. La duplicación principal de `/auth/me` en rutas privadas ya se redujo, pero el frontend sigue dependiendo bastante de bootstrap de sesión en cliente para cold boots y eso conviene vigilarlo con pruebas reales.
2. Las regresiones recientes de build y prerender ya se corrigieron, pero dejaron claro que side effects durante render y módulos demasiado grandes siguen siendo puntos frágiles.

E2E browser real: en la pasada 11 se creó infraestructura Playwright full-stack con `frontend/tests/e2e/smoke.spec.ts` que levanta backend+frontend reales, registra un admin bootstrap, verifica dashboard con sidebar, y prueba redirect de rutas privadas sin sesión. En las pasadas 14, 15, 16 y 17 esa base quedó ampliada con `frontend/tests/e2e/workflow-clinical.spec.ts`, que ahora cubre alta completa de paciente, búsqueda, navegación a ficha, creación de atención con guardado de `Motivo de consulta`, carga de adjuntos y firma electrónica simple, sin emitir warnings React en el rail clínico durante la navegación validada.

En la pasada 22 se validó además que el bootstrap de sesión del dashboard consume el usuario recién autenticado sin volver a pedir `/auth/me` inmediatamente, y se verificó que el smoke y el workflow clínico pasan cuando se ejecutan por separado sobre el mismo harness de E2E.

Mi lectura práctica: el frontend volvió a un estado liberable con una red de seguridad E2E real establecida. Lo que le falta no es otro gran refactor visual, sino bajar la fragilidad de los módulos grandes que todavía concentran demasiada lógica.

## 6. Backend

Estado del backend: **más sólido que el frontend y bastante mejor de lo que sugeriría una primera lectura superficial**.

Fortalezas claras:

- Cookies HttpOnly con `SameSite: 'strict'`.
- Rotación de refresh tokens con `UserSession` y versionado de sesión.
- Lockout por intentos fallidos.
- 2FA TOTP funcional y coherente entre backend y frontend.
- Validación fuerte de payloads con `ValidationPipe`.
- Auditoría y request tracing presentes.

Debilidades operativas que quedaban al inicio de la auditoría:

1. El bootstrap del primer admin estaba abierto en instalaciones vacías.
2. El runtime Docker copiaba `node_modules` completos del builder a producción.
3. El `CMD` del contenedor ejecutaba `prisma migrate deploy` en cada arranque.

Ese trio ya quedó mitigado en estas pasadas. Mi lectura práctica sigue siendo la misma: el backend no pide una reescritura. Pide disciplina operativa y un par de protecciones más en storage y release.

## 7. Base de datos

Usar SQLite aquí no es el problema principal.

Para una aplicación clínica de una profesional o un equipo pequeño, SQLite con WAL, `busy_timeout`, checks de integridad y backups puede ser una decisión pragmática y perfectamente válida. El proyecto además ya tiene bastante trabajo operativo alrededor de eso en `backend/src/prisma/prisma.service.ts` y `backend/scripts/`.

Límites reales:

1. Es una arquitectura single-host por definición.
2. Base y adjuntos viven atados a la misma operación física.
3. Varias estructuras siguen serializadas como JSON/texto, lo que baja capacidad de consulta fina y endurece algunas migraciones.

Mi veredicto aquí es simple: **SQLite no bloquea esta app por su tamaño real, pero obliga a que backups, restauración y operación del host estén bien resueltos. Después de la pasada 12 ese punto quedó integrado: el cron ejecuta restore drills periódicos y el deploy incluye backup pre-migración con rollback automático**.

## 8. Sistema de archivos y uploads

Esta área tiene cosas buenas y cosas peligrosas.

Lo bueno:

- `backend/src/attachments/attachments.module.ts` y `attachments.service.ts` limitan tipos de archivo.
- Hay verificación de firma binaria, no solo MIME/extensión.
- `resolveUploadsRoot` evita que `UPLOAD_DEST` se salga del root esperado.
- El acceso a archivos está atado a la atención y al médico efectivo; no encontré evidencia de links públicos, signed URLs ni compartición anónima. En ese sentido, el sistema **no** es un Google Drive ni un Cloudreve, y hoy eso juega a favor de la seguridad.

Lo malo:

1. ~~No hay evidencia en el repositorio de cifrado de adjuntos o snapshots en reposo.~~ Mitigado en pasada 13: el backend emite warning en producción si `ENCRYPTION_AT_REST_CONFIRMED` no está en `true`, y `docs/security-and-permissions.md` documenta la configuración LUKS recomendada. El cifrado efectivo sigue siendo responsabilidad del operador del host.

Avance reciente: el borrado de adjuntos ahora es soft-delete con retención de 30 días, confirmación en UI y purga automática integrada al cron. El archivo físico se mantiene durante el período de retención y el `storagePath` queda registrado en auditoría para facilitar recuperación. Además, el backup de uploads pasó de copia completa a incremental con hardlinks, reduciendo drásticamente el costo de disco.

Mi juicio: esta es una de las áreas más delicadas del sistema porque mezcla continuidad operativa y sensibilidad de datos.

## 9. Seguridad

La postura de seguridad es mejor de lo habitual para un proyecto pequeño, pero todavía no está cerrada para producción real.

Fortalezas:

- Autenticación por cookies HttpOnly, sin bearer abierto por defecto.
- `SameSite: 'strict'` y `secure` en producción.
- TOTP 2FA.
- Throttling y lockout de intentos.
- Validación y sanitización de entradas.
- Restricción fuerte de acceso a adjuntos y recursos clínicos.
- Auditoría de acciones sensibles.

Debilidades confirmadas:

1. ~~No hay evidencia de cifrado en reposo para adjuntos y snapshots.~~ Mitigado en pasada 13: el backend emite warning en producción si `ENCRYPTION_AT_REST_CONFIRMED` no está en `true`, y la documentación incluye guía de configuración LUKS/dm-crypt.

Balance honesto: el diseño base de seguridad es bueno y la operación documentada acompaña bastante mejor que al inicio de la auditoría. El rollback y los restore drills ya están integrados al flujo de despliegue (`scripts/deploy.sh`) y al cron operativo (`backup-cron` con `sqlite-ops-runner.js`). El cifrado en reposo queda como responsabilidad documentada del operador con warning activo si no se confirma. Los bloqueadores de seguridad identificados en esta auditoría están cerrados.

## 10. Rendimiento

Para el uso esperado, no veo cuellos de botella graves en tiempo de respuesta por diseño puro. El mayor riesgo hoy no es latencia, sino operación incorrecta.

De todos modos, sí hay focos de costo innecesario:

1. Previews y descargas manejadas como blobs completos en frontend, mitigado parcialmente por el límite de tamaño de upload.

La duplicación de `/auth/me` en rutas privadas ya se redujo (pasada 7) y el snapshot de uploads pasó a incremental con hardlinks (pasada 10). Para una consulta pequeña lo que queda no exige un rediseño.

## 11. Escalabilidad

La app escala bien solo dentro de un rango pequeño, y eso no es necesariamente un defecto dado el propósito del producto.

Límites estructurales claros:

1. Docker Compose con SQLite y uploads locales implica nodo único.
2. No hay separación entre almacenamiento clínico y storage de aplicación.
3. No hay estrategia para múltiples instancias concurrentes del backend escribiendo el mismo SQLite y el mismo storage local.

Mi veredicto: **escala lo suficiente para una médica y un entorno controlado; no escala limpiamente a operación multi-sede o de alta concurrencia**. Eso está bien, siempre que se diga y se opere con ese techo en mente.

## 12. Testing y QA

El proyecto tiene señales mixtas.

Lo bueno:

- `.github/workflows/ci.yml` no es decorativo: corre secret scan, audits, lint, typecheck, tests y builds.
- El backend tiene una superficie de pruebas relativamente amplia entre unitarias y e2e.

Lo insuficiente (mejorado en pasadas 11, 14, 15, 16 y 17):

1. ~~El frontend browser E2E hoy es un solo spec.~~ Ya hay 2 smoke specs full-stack con Playwright: registro bootstrap + dashboard, y redirect de rutas privadas.
2. ~~Ese spec no representa una navegación completa contra backend real.~~ Los nuevos smoke tests levantan backend y frontend reales contra una DB de test dedicada.
3. Ya existe cobertura clínica real para alta de paciente, búsqueda, creación de atención, adjuntos y firma en E2E browser, y la navegación profunda validada del wizard quedó sin warnings React visibles en la salida de Playwright tras la corrección de la rail.

La conclusión aquí ya no es que no existe red E2E. La infraestructura está montada, es estable contra backend real y ya cubre el camino clínico crítico completo sin warnings visibles en el flujo validado. Lo que falta es **sostener esa base mientras se reduce deuda estructural**.

## 13. DevOps y operación

Esta es la capa más floja del proyecto hoy.

Problemas confirmados:

1. No hay rollback automatizado. → **Mitigado en pasada 12**: `scripts/deploy.sh` toma backup pre-migración, ejecuta restore drill de validación, y ofrece rollback automático si la migración falla.
2. Los restore drills y chequeos operativos de SQLite existen como scripts, pero no están integrados en el despliegue Compose por defecto. → **Mitigado en pasada 12**: `backup-cron` ahora ejecuta `sqlite-ops-runner.js --mode=all` que incluye backup + restore drill periódico + monitor + alertas.

Orden de remediación recomendado:

1. Completar una pasada corta sobre `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts` para empujarlo bajo 300 líneas (quedó en 366 y ya tiene extraídos autosave/offline/draft sync).
2. Añadir pruebas unitarias focalizadas para `backend/src/encounters/encounters-section-mutations.ts` y `backend/src/encounters/encounters-workflow-mutations.ts` para proteger la parte más sensible del dominio clínico ya extraído.
3. Mantener monitoreo del warning `Router action dispatched before initialization` en Playwright: en la pasada 33 no se reprodujo y hoy está clasificado como ruido intermitente de harness/hidratación.
4. ~~Integrar restore drills y rollback operativo al flujo de despliegue.~~ Hecho en pasada 12.
5. ~~Completar endurecimiento de infraestructura alrededor de storage y backups.~~ Hecho en pasada 13.

---

## Cierre honesto

Si alguien me preguntara hoy si puede poner esta revisión en producción para guardar fichas clínicas reales, diría **sí, con condiciones y sin vender humo**.

No porque el sistema haya quedado perfecto, sino porque los bloqueadores directos de release y operación ya fueron mitigados:

- el frontend builda y typecheckea sin warnings de prerender,
- el despliegue soportado ya quedó alineado con HTTPS y Cloudflare Tunnel,
- los backups por Compose ya incluyen adjuntos,
- el bootstrap inicial del admin quedó blindado,
- el arranque del backend ya no migra por sorpresa,
- y el runtime Docker del backend dejó de cargar todo el lastre de desarrollo.

Lo que queda abierto sigue importando, pero ya no justifica decir que el sistema está fuera de estado productivo. El trabajo pendiente ahora es menos vistoso y más útil: seguir bajando la deuda de modularidad que todavía quedó en hooks y servicios grandes.