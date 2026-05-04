# Auditoría de producción de Anamneo

Fecha de auditoría: 2026-05-04  
Alcance: código fuente, configuración, documentación, Docker, CI, Prisma, backend NestJS, frontend Next.js, tests y scripts operativos presentes en el workspace.

## Veredicto ejecutivo

**No listo para SaaS multi-clínica. Candidato a beta productiva single-clinic tras completar la evidencia local/Docker.**

Anamneo tiene una base técnica seria: cookies `HttpOnly`, validación global, controles de arranque, permisos por rol, auditoría con cadena de integridad, backups SQLite, CI, tests frontend y suite backend/e2e backend ahora verdes. En las pasadas de remediación se corrigieron compilación/build backend, migración SQLite desde base limpia, redacción de auditoría, Sentry frontend, artefactos runtime trackeados, lint/backend, e2e backend y e2e frontend operativo. En la pasada de cierre beta se formalizó `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`, se bloqueó cualquier despliegue productivo multi-tenant sin modelo `Clinic/Tenant`, se reactivó el e2e de recuperación de borrador y se documentó la evidencia local/Docker requerida.

La conclusión cambia por alcance: para **SaaS médico multi-clínica**, sigue sin estar listo porque no existe modelo tenant/clinic. Para **beta controlada single-clinic**, puede avanzar si la matriz local/Docker pasa, el release queda limpio y se mantienen explícitas las deudas aceptadas: proxy real en Playwright, Sentry externo con PHI falsa y tenant/clinic antes de expansión.

## Nivel de riesgo general

**Alto para beta single-clinic; crítico para SaaS multi-clínica.**

La criticidad ya no viene de build/migración básica ni de e2e backend/frontend principales. Para beta single-clinic, el riesgo está en cerrar evidencia operativa local/Docker, release reproducible y runbooks. Para SaaS multi-clínica, el riesgo sigue siendo crítico porque la arquitectura de datos todavía es de instalación clínica aislada.

## Correcciones realizadas

### Pasada 1 - 2026-05-04

- **Backend compila y construye:** se tiparon y normalizaron filas Prisma/raw en `backend/src/legal/legal.service.ts`. `npm --prefix backend run typecheck`, `npm --prefix backend run build` y `npm --prefix backend run test -- --runInBand` pasan.
- **Migración SQLite limpia desbloqueada:** se añadió `backend/scripts/ensure-sqlite-db-file.js`, se integró en `backend/package.json` (`prisma:migrate:prod`) y `scripts/deploy.sh` crea `runtime/data/anamneo.db` vacío en primera instalación. `DATABASE_URL=file:<tmp>/migrate.db npm --prefix backend run prisma:migrate:prod` aplica las 48 migraciones.
- **Auditoría con menos PHI en `diff`:** `backend/src/audit/audit-helpers.ts` ahora minimiza también `Attachment`, `ClinicalAlert`, `InformedConsent` y `TextTemplate`; `backend/src/audit/audit-catalog.ts` cataloga eventos de `TextTemplate`; `backend/src/audit/audit.service.spec.ts` cubre nombres de archivo, rutas, motivos libres y contenido de plantillas.

### Pasada 2 - 2026-05-04

- **Sentry frontend endurecido:** `frontend/src/instrumentation-client.ts` desactiva replay en producción, exige opt-in solo no productivo con `NEXT_PUBLIC_SENTRY_REPLAY_ENABLED=true`, configura `sendDefaultPii: false` y limpia `user`, `extra`, `contexts`, `breadcrumbs`, cookies, request data y headers sensibles en `beforeSend`.
- **Artefactos runtime fuera del índice:** se amplió `.gitignore` para DBs, WAL/SHM, backups, `.playwright-e2e`, uploads e2e y PDFs temporales; se quitaron del índice DBs/backup/PDFs/uploads e2e ya trackeados sin borrarlos del disco.
- **CI artifact guard ampliado:** `.github/workflows/ci.yml` ahora falla si aparecen DBs, `.bak`, `.playwright-e2e`, uploads/runtime o PDFs temporales de backend trackeados.

### Pasada 3 - 2026-05-04

- **Lint y build raíz verificados:** `npm --prefix backend run lint:check`, `npm --prefix frontend run lint`, `npm run build`, `npm --prefix backend run typecheck` y `npm --prefix backend run build` pasan.
- **Test de metadata de roles corregido:** `backend/src/common/__tests__/controller-roles.spec.ts` ya no usa `require()` ni el tipo inseguro `Function`; conserva la verificación de guards/roles por controller.
- **E2E backend completo verde:** `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` pasa con 225 tests y 1 snapshot.
- **Fallos reales detectados por e2e corregidos:** `backend/test/helpers/e2e-setup.ts` ahora inserta documentos legales con `updated_at` y `content_json` válido; `backend/src/audit/audit.service.ts` y `backend/src/audit/audit.service.concurrency.spec.ts` inicializan `audit_chain_state.updated_at` en los raw upserts.

### Pasada 4 - 2026-05-04

- **Playwright frontend desbloqueado:** `frontend/playwright.config.ts` aumenta timeout de webServers a 300s y fija `BACKEND_PORT`, evitando que el backend arranque en `5678` mientras Playwright esperaba `5679`.
- **Seed legal para e2e/frontend:** `backend/prisma/seed.ts` crea documentos legales publicados sintéticos para entornos de prueba que usan `prisma migrate diff` y no ejecutan inserts de migraciones.
- **E2E frontend actualizado al flujo legal real:** `frontend/tests/e2e/smoke.spec.ts` y `frontend/tests/e2e/workflow-clinical.spec.ts` aceptan el checkbox legal requerido antes del registro.
- **E2E frontend actualizado al toolbar actual:** `workflow-clinical.spec.ts` valida `Receta`, `Órdenes`, `Derivación`, `Descargar PDF` e `Imprimir` como `menuitem` dentro de `Exportar documentos`.
- **E2E frontend operativo en ese momento:** `npm --prefix frontend run test:e2e` pasaba con 12 tests y 1 omitido. Ese omitido fue abordado en la pasada 5.

### Pasada 5 - 2026-05-04

- **Alcance beta single-clinic formalizado:** se agregó `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` en `.env.example`, `backend/.env.example` y `docker-compose.yml`; `backend/src/main.helpers.ts` ahora falla en producción si falta esa variable o si se intenta `multi-tenant` antes de implementar un modelo `Clinic/Tenant`.
- **Cobertura de arranque productivo:** `backend/src/main.helpers.spec.ts` cubre aceptación de `single-clinic`, rechazo de variable ausente y rechazo de `multi-tenant`.
- **Drift frontend corregido:** `frontend/next-env.d.ts` volvió a apuntar a `.next/types/routes.d.ts` y `frontend/.env.example` quedó alineado con `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true`.
- **E2E de draft reactivado con deuda aceptada:** `frontend/tests/e2e/encounter-draft-recovery.spec.ts` existe y Playwright lo lista. El flujo usa sesión/cookies reales de backend, pero el webServer frontend mantiene `E2E_DISABLE_PROXY_AUTH=true`; para esta beta se documenta como deuda aceptada.
- **Docs de operación actualizadas:** `docs/environment.md`, `docs/deployment-and-release.md` y `docs/docker-staging-validation.md` describen una clínica por instancia/base/volúmenes, la matriz local/Docker y el bloqueo de SaaS multi-clínica hasta implementar tenant/clinic.
- **Verificación focalizada ejecutada:** pasan `npm --prefix backend run test -- --runInBand main.helpers.spec.ts`, `npm --prefix backend run typecheck`, `npm --prefix backend run lint:check`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run lint`, `npm --prefix frontend exec -- playwright test --list`, `git diff --check`, artifact guard y migración SQLite limpia con `prisma:migrate:prod`. `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic docker compose config --quiet` pasa; sin esa variable falla como control de seguridad esperado.

### Aclaración del punto 5: alcance single-clinic vs SaaS multi-tenant

El punto 5 de las sugerencias no es un detalle de naming; es una decisión de arquitectura de producto. Hoy Anamneo demuestra aislamiento por médico/creador/asistente en servicios como `backend/src/common/utils/patient-access.ts` y `backend/src/encounters/encounter-policy.ts`, pero `backend/prisma/schema.prisma` no contiene una frontera `Tenant`, `Clinic` u `Organization` que sea obligatoria en pacientes, encuentros, adjuntos, consentimientos, auditoría y administración.

Si el lanzamiento es una beta controlada de una sola clínica en una instalación aislada, esto puede documentarse como restricción operativa temporal. Si el objetivo es SaaS médico multi-clínica, antes de datos reales debe existir un modelo tenant/clinic con FK obligatorias, guards/middleware que apliquen ese scope en cada query, índices/constraints por tenant, fixtures cruzados y tests negativos que prueben que un usuario de una clínica no puede ver ni modificar datos de otra. Sin esa frontera, un único bug de filtro puede causar exposición inter-clínica de PHI.

## Bloqueadores para producción

### Evidencia local/Docker y release reproducible pendientes

- **Severidad:** Alta.
- **Evidencia en workspace:** la pasada de cierre agrega cambios intencionales en código/config/docs. Antes de release debe quedar un commit trazable, `git status --short` sin artefactos accidentales, `npm run release` validado y zip revisado.
- **Riesgo real:** Sin hash/zip reproducible y matriz local/Docker no se puede demostrar qué versión se desplegó ni recuperar con confianza.
- **Recomendación concreta:** Cerrar el diff, ejecutar la matriz local/Docker documentada, generar tag/release y guardar hash, zip y logs de validación.
- **Esfuerzo estimado:** Bajo.

### Validación local/Docker pendiente tras los fixes

- **Severidad:** Alta.
- **Evidencia en código/proceso:** El e2e de recuperación de borrador está reactivado y Playwright lista 13 tests en 3 archivos, pero la evidencia requerida para esta beta es local/Docker: build, health, migración limpia, backup, restore drill, integridad de auditoría y rollback simulado con datos sintéticos.
- **Riesgo real:** Sin esa prueba, una instalación clínica single-host puede fallar en operación aunque las suites de código pasen.
- **Recomendación concreta:** Ejecutar la matriz de `docs/deployment-and-release.md`, guardar resultados y bloquear beta si falla health, backup, restore drill, migración limpia o integridad de auditoría.
- **Esfuerzo estimado:** Medio.

### Arquitectura de datos no demuestra aislamiento SaaS multi-tenant

- **Severidad:** Alta.
- **Evidencia en código:** `backend/prisma/schema.prisma` no define `Tenant`, `Clinic`, `Organization` ni scopes multi-tenant. El aislamiento operativo se basa en `medicoId`, `createdById` y asistentes (`backend/src/common/utils/patient-access.ts:63-78`, `backend/src/encounters/encounter-policy.ts:10-23`). Docker productivo usa `DATABASE_URL=file:/app/data/anamneo.db` (`docker-compose.yml:9-11`).
- **Riesgo real:** Para SaaS médico con múltiples clínicas, no hay frontera de tenant auditable a nivel de modelo, índices, constraints ni middleware. Un bug de scope médico puede convertirse en exposición inter-clínica. Para beta single-clinic, el riesgo se contiene operativamente con una clínica por instancia/base/volúmenes.
- **Recomendación concreta:** Mantener `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` en producción beta. Antes de SaaS multi-clínica, definir modelo tenant/clinic, agregar FK obligatorias en entidades clínicas y administrativas, middleware/guards de tenant, migraciones, fixtures de aislamiento y tests e2e de no exposición entre tenants.
- **Esfuerzo estimado:** Alto.

## Riesgos importantes no bloqueantes

### Persistencia local de PHI en navegador si no se fuerza modo compartido

- **Severidad:** Alta.
- **Evidencia en código:** `frontend/src/lib/encounter-draft.ts:92-99` guarda borradores clínicos en `localStorage`; `frontend/src/lib/encounter-draft.ts:146-153` guarda conflictos locales; `frontend/src/lib/offline-queue.ts:84-102` guarda payloads de secciones en IndexedDB. Se desactiva si `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` (`docker-compose.yml:76`).
- **Riesgo real:** Si una instalación cambia esa variable o usa un build no Docker, PHI queda en almacenamiento local sin cifrado por 24h.
- **Recomendación concreta:** Mantener forzado en producción, eliminar modo offline para datos reales o cifrar localmente con clave efímera de sesión y borrado verificable.
- **Esfuerzo estimado:** Medio.

### Sentry frontend requiere prueba de redacción con datos sintéticos

- **Severidad:** Media.
- **Evidencia en código:** `frontend/src/instrumentation-client.ts` ahora desactiva replay en producción y limpia contexto sensible en `beforeSend`. No se ejecutó una prueba real contra un proyecto Sentry/staging con datos sintéticos.
- **Riesgo real:** Aunque el código reduce el riesgo, una mala configuración externa de Sentry, sourcemaps, retención o replay podría volver a capturar contexto sensible.
- **Recomendación concreta:** Probar evento sintético en staging con PHI falsa, verificar que no llegan cookies, headers, breadcrumbs, extra/context ni replay; documentar DSN, sample rates y retención.
- **Esfuerzo estimado:** Bajo.

### Algunas rutas con PHI de lectura no parecen auditadas

- **Severidad:** Media.
- **Evidencia en código:** `PatientsService.findById`, `getClinicalSummary`, `EncountersService.findById`, adjuntos, consentimientos y alertas sí auditan lecturas. `findAllPatients`, dashboards, inbox de tareas y `getPatientAdminSummary` no muestran eventos `READ` equivalentes en los servicios inspeccionados.
- **Riesgo real:** No siempre se puede responder “quién vio qué” si la vista lista o panel muestra datos identificables o clínicos.
- **Recomendación concreta:** Definir política de auditoría para listados y dashboards con eventos agregados minimizados.
- **Esfuerzo estimado:** Medio.

### SQLite como base principal limita disponibilidad y escalabilidad

- **Severidad:** Media.
- **Evidencia en código/config:** `backend/prisma/schema.prisma` usa `provider = "sqlite"`. `docker-compose.yml:9-19` opera SQLite con WAL, backups y restore drill.
- **Riesgo real:** Para beta controlada single-host puede ser aceptable con disciplina operativa. Para SaaS multi-tenant con disponibilidad alta, concurrencia y DR formal, es insuficiente.
- **Recomendación concreta:** Plan de migración a Postgres antes de producción amplia; probar bloqueos de auditoría y transacciones con el motor real.
- **Esfuerzo estimado:** Alto.

### CI y repositorio deben mantenerse libres de artefactos runtime

- **Severidad:** Media.
- **Evidencia en código:** `.github/workflows/ci.yml` y `.gitignore` fueron ampliados; los artefactos existentes se quitaron del índice. Debe confirmarse en CI desde un clone limpio.
- **Riesgo real:** Si se relajan patrones o se añaden fixtures con datos reales, sigue existiendo riesgo de filtrar PHI por git.
- **Recomendación concreta:** Mantener fixture PDFs sintéticos explícitos, revisar `git status` antes de release y conservar el artifact guard como job bloqueante.
- **Esfuerzo estimado:** Bajo.

## Hallazgos por área

### Seguridad

- **Fortalezas:** Cookies `HttpOnly`, `secure` en producción y `sameSite: strict` (`backend/src/auth/auth.controller.ts:22-29`); JWT solo desde cookie, sin bearer fallback (`backend/src/auth/strategies/jwt.strategy.ts:11-25`); sesión persistida y validación de `sid/sv` (`jwt.strategy.ts:29-41`); bloqueo de login persistente (`backend/src/auth/auth-login-flow.ts:132-157`); rate limiting global (`backend/src/app.module.ts:36-58`); Helmet/CSP/CORS configurados (`backend/src/main.bootstrap.ts:111-146`).
- **Debilidades:** No hay token CSRF explícito. `SameSite=Strict` reduce mucho el riesgo, pero un SaaS médico debería documentar la decisión y cubrir flujos cross-site. No verifiqué pentest XSS/CSRF/SSRF dinámico.
- **IDOR:** Pacientes y encounters tienen validaciones backend por scope (`patient-access.ts`, `encounter-policy.ts`), pero no hay tenant model explícito.
- **Secretos:** Arranque falla por placeholders y secretos cortos (`backend/src/main.helpers.ts:26-96`). CI usa Gitleaks (`.github/workflows/ci.yml:10-22`).

### Privacidad y datos médicos

- PHI principal se almacena en SQLite, adjuntos y backups; la app exige confirmación de cifrado de filesystem en producción (`backend/src/main.helpers.ts:89-96`), pero no cifra todo a nivel aplicación.
- `EncounterSection.data` puede cifrarse si `ENCRYPTION_KEY` existe (`backend/src/encounters/encounters-sanitize.ts`), pero esa variable no es obligatoria en producción y `.env.example` la deja vacía.
- La auditoría de lecturas existe para fichas, resumen clínico, encounters, adjuntos, consentimientos, alertas y analytics. Queda como política pendiente decidir si listados amplios como inbox, dashboards y búsquedas deben generar eventos agregados.
- La redacción de `audit_logs.diff` se amplió a `Attachment`, `ClinicalAlert`, `InformedConsent` y `TextTemplate`; quedan por revisar exports analíticos, Sentry frontend y una política completa de listados/dashboards.
- Textos legales base existen, pero la propia migración indica que requieren revisión legal antes de producción.

### Backend

- Organización modular razonable por dominio.
- Validación global con whitelist y `forbidNonWhitelisted` (`backend/src/main.bootstrap.ts:148-158`).
- Controllers en general delgados y servicios con reglas de negocio.
- Backend `typecheck`, `build`, lint y suite unitaria completa pasan tras las correcciones.
- Riesgo de operaciones no atómicas si auditoría falla después de persistir fuera de transacción; conviene revisar el patrón en servicios nuevos antes de ampliar la superficie clínica.
- Auditoría usa cadena de hash y estado persistido; los raw upserts de `audit_chain_state` ya inicializan `updated_at`. Para beta single-clinic falta ejecutar verificación de integridad en Docker local; para despliegues con múltiples instancias backend se requiere bloqueo distribuido o DB-level locking.

### Frontend

- API same-origin por `/api` (`frontend/next.config.js:45-49`), proxy de sesión (`frontend/src/proxy.ts`), store en `sessionStorage` para auth (`frontend/src/stores/auth-store.ts`).
- Flujos clínicos tienen loading/error/empty states, confirmaciones para finalizar, firmar, archivar, fusionar y eliminar adjuntos.
- Permisos UI existen, pero dependen correctamente del backend como enforcement real.
- Riesgo: drafts/offline/conflicts guardan PHI local si se desactiva modo compartido. Docker, `.env.example` raíz y `frontend/.env.example` quedan alineados en `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true`.
- Sentry frontend ahora desactiva replay en producción y limpia contexto sensible; falta prueba real contra staging/Sentry.

### Base de datos

- Modelo clínico amplio con relaciones, índices y cascades.
- `Patient.rut` es `@unique`, lo que evita duplicación global pero puede ser una decisión problemática si el SaaS debe separar clínicas/tenants.
- No hay tenant/clinic FK.
- `prisma validate` pasó y `prisma:migrate:prod` aplica las 48 migraciones sobre base SQLite limpia si el archivo `.db` existe o se crea con el nuevo helper.
- La suite e2e detectó y se corrigió que fixtures legales y estado de cadena de auditoría asumían defaults `updated_at` inexistentes.
- Migraciones recientes incluyen reescrituras de tablas; requieren prueba contra copia real antes de producción.

### Infraestructura

- Docker Compose está pensado para loopback y Cloudflare Tunnel (`docker-compose.yml:46-81`).
- `backup-cron` ejecuta backup, restore drill, monitor y purga (`docker-compose.yml:89-119`).
- `scripts/deploy.sh:98-145` hace backup y restore drill pre-migración; ahora crea el archivo SQLite vacío antes de migrar en primera instalación y luego ofrece rollback si falla.
- `backend/scripts/ensure-sqlite-db-file.js` prepara `DATABASE_URL=file:*` antes de `prisma migrate deploy`.
- No verificado: configuración real de dominio, HTTPS, Cloudflare Tunnel, firewall, cifrado LUKS/volumen, SMTP, Sentry y webhook de alertas en producción.

### Testing

- Frontend unitario pasó: 68 suites, 316 tests.
- Backend unitario pasó: 75 suites, 381 tests.
- Backend e2e completo pasó: 225 tests, 1 snapshot.
- Backend typecheck, lint y build pasan.
- Frontend typecheck, lint y build pasan.
- Frontend e2e ahora lista 13 tests en 3 archivos, incluyendo recuperación de borrador. La deuda aceptada para beta es que Playwright mantiene `E2E_DISABLE_PROXY_AUTH=true`.
- No ejecuté todavía la matriz local/Docker completa; sigue bloqueando declarar lista la beta con datos reales.

### Dependencias

- `npm --prefix backend run audit:prod`: 0 vulnerabilidades.
- `npm --prefix frontend run audit:prod`: 0 vulnerabilidades.
- Dependabot está configurado para root/backend/frontend (`.github/dependabot.yml`).
- No verificado: salud de mantenimiento de cada dependencia ni SBOM formal.

### Observabilidad

- Backend tiene Sentry con `sendDefaultPii: false` y redacción de headers/cookies/data (`backend/src/instrument.ts`).
- Health público para DB básica (`backend/src/health.controller.ts:13-24`) y health SQLite admin (`:29-43`).
- Alertas SQLite por webhook configurable (`docker-compose.yml:20-22`).
- Sentry frontend/backend tienen redacción básica; no verificado: alertas reales, dashboards, retención de logs, runbooks de incidentes, objetivos SLO/SLA.

### Documentación

- Buena documentación en `docs/`: seguridad, entorno, despliegue, testing, arquitectura, datos.
- Documenta límites de SQLite, cifrado en reposo, backup/restore y despliegue con cloudflared.
- Falta evidencia de operación real probada: restore drill en entorno productivo, checklist firmado, matriz regulatoria final, RTO/RPO y respuesta a incidentes.

## Checklist de producción

| Ítem | Estado | Evidencia | Acción requerida |
|---|---|---|---|
| Autenticación segura | Parcial | Cookies `HttpOnly/Secure/SameSite`, JWT cookie-only, sesiones `sid/sv`; backend unitario/e2e backend pasan; e2e draft reactivado | Revalidar en matriz local/Docker; proxy real Playwright queda deuda aceptada |
| Autorización por rol | Parcial | `RolesGuard`, `AdminGuard`, contratos compartidos; test de metadata pasa y lint queda verde | Cubrir rutas nuevas y mantener e2e permisos |
| Aislamiento de datos entre usuarios/tenants | Parcial por alcance | Scope por `medicoId`/`createdById`; `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`; sin `Tenant` | Una clínica por instancia en beta; diseñar tenant/clinic antes de SaaS |
| Cifrado en tránsito | No verificado | App asume cloudflared/HTTPS | Verificar TLS real y HSTS externo |
| Manejo de secretos | Parcial | `assertSafeConfig`, Gitleaks | Validar secret management real y rotación |
| Logs sin datos sensibles | Parcial | Redacción ampliada para `Attachment`, `ClinicalAlert`, `InformedConsent`, `TextTemplate`; Sentry frontend limpia contexto y no usa replay en producción | Revisar exports, logs reales y evento Sentry sintético |
| Backups | Parcial | `backup-cron`, `sqlite-backup.js`, docs | Probar en entorno real con alertas |
| Restauración probada | Parcial | Script restore drill existe; migración limpia ya aplica | Probar restore completo con copia real |
| Auditoría de acciones clínicas | Parcial | `AuditLog`, hash chain, eventos de lectura críticos | Cubrir listados/dashboards y limpiar PHI en diff |
| Tests críticos | Parcial | E2E draft reactivado; matriz completa debe ejecutarse en esta rama | Correr lint/typecheck/unit/e2e/build y matriz Docker local |
| CI/CD | Parcial | GitHub Actions con lint/typecheck/test/e2e/audit y artifact guard ampliado | Exigir migración deploy y validar CI limpio |
| Monitoreo | Parcial | Sentry backend/frontend con redacción básica, health checks | Configurar dashboards, alertas y prueba sintética |
| Alertas | Parcial | SQLite webhook configurable | Verificar alertas reales y on-call |
| Manejo de errores | Parcial | Global exception filter, Sentry backend | Validar frontend/backend en producción |
| Rollback | Parcial | `scripts/deploy.sh` ofrece rollback DB/uploads y prepara primera DB SQLite | Probar con copia real y documentar RTO |
| Documentación operativa | Parcial | `docs/deployment-and-release.md`, `docs/sqlite-operations.md` | Añadir runbook incidentes y checklist release |
| Hardening de producción | Parcial para beta | Alcance single-clinic formalizado; SaaS multi-clínica bloqueado por diseño | Cerrar evidencia local/Docker antes de datos reales |

## Pruebas que debes ejecutar o sugerir

Ejecutadas:

```bash
npm --prefix backend run typecheck
# Pasó tras corregir legal.service.ts

npm --prefix backend run build
# Pasó

npm --prefix backend run test -- --runInBand
# Pasó: 75 suites, 381 tests

npm --prefix frontend run typecheck
# Pasó

npm --prefix frontend run test -- --runInBand
# Pasó: 68 suites, 316 tests

npm --prefix frontend run build
# Pasó

npm --prefix frontend run typecheck
# Pasó tras endurecer instrumentation-client.ts

npm --prefix frontend run build
# Pasó tras endurecer Sentry frontend

npm --prefix backend run audit:prod
# Pasó: 0 vulnerabilidades

npm --prefix frontend run audit:prod
# Pasó: 0 vulnerabilidades

npm exec -- prisma validate --schema prisma/schema.prisma
# Pasó desde backend/

DATABASE_URL=file:<tmp>/migrate.db npm exec -- prisma migrate deploy --schema prisma/schema.prisma
# Falló si el archivo SQLite no existe

DATABASE_URL=file:<tmp>/migrate.db npm --prefix backend run prisma:migrate:prod
# Pasó tras crear backend/scripts/ensure-sqlite-db-file.js: 48 migraciones aplicadas

npm --prefix backend run test -- --runInBand audit.service.spec.ts audit-catalog.spec.ts attachments.service.spec.ts consents.service.spec.ts
# Pasó: 4 suites, 51 tests; incluye redacción de audit diff

git ls-files 'backend/.env' 'frontend/.env' '*.db' '*.db.*' '*.db-journal' '*.db-shm' '*.db-wal' '*.bak' 'backend/.playwright-e2e/**' 'backend/uploads-e2e/**' 'runtime/**' 'backend/tmp*.pdf'
# Pasó: sin artefactos sensibles/runtime trackeados bajo esos patrones

npm --prefix backend run lint:check
# Pasó tras corregir controller-roles.spec.ts y audit_chain_state

npm --prefix frontend run lint
# Pasó

npm run build
# Pasó: build backend + frontend desde raíz

npm --prefix backend run test -- --runInBand controller-roles.spec.ts
# Pasó: 4 tests

npm --prefix backend run test -- --runInBand audit.service.spec.ts audit.service.concurrency.spec.ts
# Pasó: 2 suites, 16 tests

npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts
# Pasó: 225 tests, 1 snapshot

npm --prefix backend run typecheck
# Pasó tras la pasada 3

npm --prefix backend run build
# Pasó tras la pasada 3

npm --prefix frontend run test:e2e
# Pasó tras la pasada 4: 12 tests, 1 omitido

npm --prefix frontend exec -- playwright test --list
# Pasó tras la pasada 5: 13 tests listados en 3 archivos, incluyendo encounter-draft-recovery.spec.ts

npm --prefix backend run test -- --runInBand main.helpers.spec.ts
# Pasó tras la pasada 5: 1 suite, 3 tests

ANAMNEO_DEPLOYMENT_SCOPE=single-clinic docker compose config --quiet
# Pasó tras la pasada 5

npm --prefix frontend run lint
# Pasó tras la pasada 4

npm --prefix frontend run typecheck
# Pasó tras la pasada 4

npm --prefix backend run typecheck
# Pasó tras la pasada 4

npm --prefix backend run lint:check
# Pasó tras la pasada 4

npm run build
# Pasó tras la pasada 4
```

Pendientes antes de release:

```bash
npm install
npm --prefix backend run lint:check
npm --prefix frontend run lint
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix backend run test
npm --prefix frontend run test
npm --prefix frontend run test:e2e
npm run build
npm --prefix frontend exec -- playwright test --list
npm run db:restore:drill
npm --prefix backend run audit:integrity:verify
DATABASE_URL=file:<tmp>/migrate.db npm --prefix backend run prisma:migrate:prod
git ls-files 'backend/.env' 'frontend/.env' '*.db' '*.db.*' '*.db-journal' '*.db-shm' '*.db-wal' '*.bak' 'backend/.playwright-e2e/**' 'backend/uploads-e2e/**' 'runtime/**' 'backend/tmp*.pdf'
npm run release
docker compose build
docker compose up -d
curl -s http://127.0.0.1:${BACKEND_PORT:-5678}/api/health
npm run db:backup
```

## Recomendaciones prioritarias

### 1. Antes de producción

1. Cerrar cambios intencionales en un commit/tag y obtener matriz local/Docker verde.
2. Mantener `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` y documentar una clínica por instancia/base/volúmenes.
3. Probar `prisma:migrate:prod`, backup, restore drill, integridad de auditoría y rollback con copia sintética representativa.
4. Validar que los artefactos runtime eliminados del índice no vuelven a aparecer.
5. Probar redacción Sentry frontend con evento sintético y PHI falsa antes de producción amplia o staging externo.
6. Bloquear cualquier despliegue SaaS multi-clínica hasta implementar tenant/clinic.

### 2. Antes de beta con usuarios reales

1. Mantener `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` y prohibir modo offline local con PHI salvo cifrado local futuro.
2. Ejecutar e2e auth/permissions/encounters/consents/alerts y recuperación de borrador en la matriz local.
3. Probar backup, restore, rollback y verificación de integridad de auditoría con datos sintéticos.
4. Configurar HTTPS real, dominio, CORS exacto, firewall y Cloudflare Tunnel antes de exponer la beta.
5. Definir política operativa de acceso admin, retención, exportación y respuesta a incidentes.

### 3. Primeros 30 días post-lanzamiento

1. Diseñar y planificar tenant/clinic model o migración a arquitectura multi-tenant real.
2. Migrar de SQLite a Postgres si el objetivo es SaaS multi-clínica con crecimiento.
3. Implementar métricas/SLO, alertas de error, backup, restore drill, latencia y fallos de login.
4. Revisar logs/auditoría/Sentry semanalmente con muestreo de privacidad.
5. Hacer prueba de restauración y simulacro de incidente documentado.

## Faltante tras la pasada 5

1. Ejecutar y guardar evidencia de la matriz local/Docker completa.
2. Probar backup, restore drill, integridad de auditoría y rollback con copia sintética.
3. Probar Sentry frontend con evento sintético y revisar retención/sample rates antes de producción amplia.
4. Validar artifact guard en pull request limpio o clone limpio.
5. Implementar tenant/clinic antes de producción SaaS multi-clínica.
6. Documentar explícitamente que `E2E_DISABLE_PROXY_AUTH=true` es deuda aceptada en Playwright para esta beta.

## Siguientes pasos naturales

1. Hacer prueba operativa Docker local con backup/restore/rollback.
2. Preparar PR/release con cambios intencionales y comprobar CI.
3. Probar Sentry con PHI falsa en entorno externo antes de ampliar exposición.
4. Abrir implementación de tenant/clinic antes de cualquier oferta SaaS multi-clínica.

## Decisión final

**Anamneo está listo para producción SaaS multi-clínica: No.**

**Anamneo puede avanzar a beta single-clinic: Solo si pasa la matriz local/Docker y el release queda trazable.**

Condiciones mínimas para cambiar el veredicto beta a listo: e2e frontend sin omitidos críticos, release reproducible, matriz local/Docker verde, backups/restauración/rollback probados con copia representativa, integridad de auditoría verificada y `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` configurado. Para SaaS multi-clínica, la condición mínima sigue siendo implementar modelo tenant/clinic con aislamiento probado.
