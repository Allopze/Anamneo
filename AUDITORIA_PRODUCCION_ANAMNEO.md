# Auditoría de producción de Anamneo

Fecha de auditoría: 2026-05-04  
Alcance: código fuente, configuración, documentación, Docker, CI, Prisma, backend NestJS, frontend Next.js, tests y scripts operativos presentes en el workspace.

## Veredicto ejecutivo

**No listo para producción.**

Anamneo tiene una base técnica seria: cookies `HttpOnly`, validación global, controles de arranque, permisos por rol, auditoría con cadena de integridad, backups SQLite, CI, tests frontend y suite backend ahora verde. En la primera pasada se corrigieron compilación/build backend, migración SQLite desde base limpia y redacción de auditoría para varias entidades clínicas. Sigue sin estar listo para producción con datos reales porque no hay modelo tenant/clinic explícito, el release todavía no es reproducible desde un árbol limpio, faltan e2e/staging completos y quedan riesgos operativos/observabilidad propios de SaaS médico.

## Nivel de riesgo general

**Crítico.**

La criticidad ya no viene de build/migración básica, sino de lo que queda: arquitectura de datos todavía más cercana a instalación clínica single-host que a SaaS médico multi-tenant, release no reproducible, e2e no verificados en esta pasada y operación productiva real no probada.

## Correcciones realizadas

### Pasada 1 - 2026-05-04

- **Backend compila y construye:** se tiparon y normalizaron filas Prisma/raw en `backend/src/legal/legal.service.ts`. `npm --prefix backend run typecheck`, `npm --prefix backend run build` y `npm --prefix backend run test -- --runInBand` pasan.
- **Migración SQLite limpia desbloqueada:** se añadió `backend/scripts/ensure-sqlite-db-file.js`, se integró en `backend/package.json` (`prisma:migrate:prod`) y `scripts/deploy.sh` crea `runtime/data/anamneo.db` vacío en primera instalación. `DATABASE_URL=file:<tmp>/migrate.db npm --prefix backend run prisma:migrate:prod` aplica las 48 migraciones.
- **Auditoría con menos PHI en `diff`:** `backend/src/audit/audit-helpers.ts` ahora minimiza también `Attachment`, `ClinicalAlert`, `InformedConsent` y `TextTemplate`; `backend/src/audit/audit-catalog.ts` cataloga eventos de `TextTemplate`; `backend/src/audit/audit.service.spec.ts` cubre nombres de archivo, rutas, motivos libres y contenido de plantillas.

### Pasada 2 - 2026-05-04

- **Sentry frontend endurecido:** `frontend/src/instrumentation-client.ts` desactiva replay en producción, exige opt-in solo no productivo con `NEXT_PUBLIC_SENTRY_REPLAY_ENABLED=true`, configura `sendDefaultPii: false` y limpia `user`, `extra`, `contexts`, `breadcrumbs`, cookies, request data y headers sensibles en `beforeSend`.
- **Artefactos runtime fuera del índice:** se amplió `.gitignore` para DBs, WAL/SHM, backups, `.playwright-e2e`, uploads e2e y PDFs temporales; se quitaron del índice DBs/backup/PDFs/uploads e2e ya trackeados sin borrarlos del disco.
- **CI artifact guard ampliado:** `.github/workflows/ci.yml` ahora falla si aparecen DBs, `.bak`, `.playwright-e2e`, uploads/runtime o PDFs temporales de backend trackeados.

## Bloqueadores para producción

### Estado de release no reproducible

- **Severidad:** Alta.
- **Evidencia en workspace:** `git status --short` muestra cambios no confirmados previos y nuevos en backend, frontend, CI, `.gitignore`, `scripts/deploy.sh`, `AUDITORIA_PRODUCCION_ANAMNEO.md`, `backend/scripts/ensure-sqlite-db-file.js`, además de la migración nueva sin trackear `backend/prisma/migrations/20260504020648_legal/`.
- **Riesgo real:** No se puede saber qué versión exacta se está auditando o desplegando. En sistemas clínicos esto rompe trazabilidad de cambios y rollback.
- **Recomendación concreta:** Cerrar el diff, revisar la migración, confirmar que CI pasa desde un clone limpio, generar tag/release y guardar el hash desplegado.
- **Esfuerzo estimado:** Bajo.

### Validación e2e/staging pendiente tras los fixes

- **Severidad:** Alta.
- **Evidencia en código/proceso:** En esta pasada pasaron unitarios/build backend, pero no se ejecutó `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` ni `npm --prefix frontend run test:e2e`. Tampoco se probó despliegue Docker completo con dominio, cookies, CORS, backups y rollback.
- **Riesgo real:** Los flujos clínicos críticos pueden fallar en integración aunque las suites unitarias pasen. Para SaaS médico, auth, permisos, encounters, consentimientos, adjuntos y auditoría deben validarse de punta a punta antes de datos reales.
- **Recomendación concreta:** Levantar stack local/staging, correr e2e backend secuencial, e2e frontend con backend en `:5678`, restore drill, rollback y health checks; bloquear release si falla.
- **Esfuerzo estimado:** Medio.

### Arquitectura de datos no demuestra aislamiento SaaS multi-tenant

- **Severidad:** Alta.
- **Evidencia en código:** `backend/prisma/schema.prisma` no define `Tenant`, `Clinic`, `Organization` ni scopes multi-tenant. El aislamiento operativo se basa en `medicoId`, `createdById` y asistentes (`backend/src/common/utils/patient-access.ts:63-78`, `backend/src/encounters/encounter-policy.ts:10-23`). Docker productivo usa `DATABASE_URL=file:/app/data/anamneo.db` (`docker-compose.yml:9-11`).
- **Riesgo real:** Para SaaS médico con múltiples clínicas, no hay frontera de tenant auditable a nivel de modelo, índices, constraints ni middleware. Un bug de scope médico puede convertirse en exposición inter-clínica.
- **Recomendación concreta:** Definir modelo de tenant/clinic, agregar FK obligatorias en entidades clínicas y administrativas, middleware/guards de tenant, migraciones, fixtures de aislamiento y tests e2e de no exposición entre tenants.
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
- La auditoría de lecturas existe para fichas, resumen clínico, encounters, adjuntos, consentimientos, alertas y analytics, pero no para todos los listados con PHI.
- La redacción de `audit_logs.diff` se amplió a `Attachment`, `ClinicalAlert`, `InformedConsent` y `TextTemplate`; quedan por revisar exports analíticos, Sentry frontend y una política completa de listados/dashboards.
- Textos legales base existen, pero la propia migración indica que requieren revisión legal antes de producción.

### Backend

- Organización modular razonable por dominio.
- Validación global con whitelist y `forbidNonWhitelisted` (`backend/src/main.bootstrap.ts:148-158`).
- Controllers en general delgados y servicios con reglas de negocio.
- Backend `typecheck`, `build` y suite unitaria completa pasan tras la normalización de `legal.service.ts`.
- Riesgo de operaciones no atómicas si auditoría falla después de persistir fuera de transacción; `TextTemplate` ya está catalogado, pero conviene revisar el patrón en otros servicios.
- Auditoría usa cadena de hash y estado persistido, pero necesita revisión multi-proceso/motor real y e2e de integridad.

### Frontend

- API same-origin por `/api` (`frontend/next.config.js:45-49`), proxy de sesión (`frontend/src/proxy.ts`), store en `sessionStorage` para auth (`frontend/src/stores/auth-store.ts`).
- Flujos clínicos tienen loading/error/empty states, confirmaciones para finalizar, firmar, archivar, fusionar y eliminar adjuntos.
- Permisos UI existen, pero dependen correctamente del backend como enforcement real.
- Riesgo: drafts/offline/conflicts guardan PHI local si se desactiva modo compartido.
- Sentry frontend ahora desactiva replay en producción y limpia contexto sensible; falta prueba real contra staging/Sentry.

### Base de datos

- Modelo clínico amplio con relaciones, índices y cascades.
- `Patient.rut` es `@unique`, lo que evita duplicación global pero puede ser una decisión problemática si el SaaS debe separar clínicas/tenants.
- No hay tenant/clinic FK.
- `prisma validate` pasó y `prisma:migrate:prod` aplica las 48 migraciones sobre base SQLite limpia si el archivo `.db` existe o se crea con el nuevo helper.
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
- Backend typecheck y build pasan.
- Frontend typecheck y build pasan.
- No ejecuté e2e completos en esta pasada; deberían bloquear release.

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
| Autenticación segura | Parcial | Cookies `HttpOnly/Secure/SameSite`, JWT cookie-only, sesiones `sid/sv`; backend unitario pasa | Revalidar e2e auth |
| Autorización por rol | Parcial | `RolesGuard`, `AdminGuard`, contratos compartidos; test de metadata pasa en suite backend | Cubrir rutas nuevas y e2e permisos |
| Aislamiento de datos entre usuarios/tenants | Parcial | Scope por `medicoId`/`createdById`; sin `Tenant` | Diseñar tenant/clinic model para SaaS |
| Cifrado en tránsito | No verificado | App asume cloudflared/HTTPS | Verificar TLS real y HSTS externo |
| Manejo de secretos | Parcial | `assertSafeConfig`, Gitleaks | Validar secret management real y rotación |
| Logs sin datos sensibles | Parcial | Redacción ampliada para `Attachment`, `ClinicalAlert`, `InformedConsent`, `TextTemplate`; Sentry frontend limpia contexto y no usa replay en producción | Revisar exports, logs reales y evento Sentry sintético |
| Backups | Parcial | `backup-cron`, `sqlite-backup.js`, docs | Probar en entorno real con alertas |
| Restauración probada | Parcial | Script restore drill existe; migración limpia ya aplica | Probar restore completo con copia real |
| Auditoría de acciones clínicas | Parcial | `AuditLog`, hash chain, eventos de lectura críticos | Cubrir listados/dashboards y limpiar PHI en diff |
| Tests críticos | Parcial | Backend typecheck/build/test pasan; frontend typecheck/test/build pasaban en auditoría inicial | Correr e2e backend/frontend y lint |
| CI/CD | Parcial | GitHub Actions con lint/typecheck/test/e2e/audit y artifact guard ampliado | Exigir migración deploy y validar CI limpio |
| Monitoreo | Parcial | Sentry backend/frontend con redacción básica, health checks | Configurar dashboards, alertas y prueba sintética |
| Alertas | Parcial | SQLite webhook configurable | Verificar alertas reales y on-call |
| Manejo de errores | Parcial | Global exception filter, Sentry backend | Validar frontend/backend en producción |
| Rollback | Parcial | `scripts/deploy.sh` ofrece rollback DB/uploads y prepara primera DB SQLite | Probar con copia real y documentar RTO |
| Documentación operativa | Parcial | `docs/deployment-and-release.md`, `docs/sqlite-operations.md` | Añadir runbook incidentes y checklist release |
| Hardening de producción | Fallido | Buenas bases, pero tenant/e2e/operación real siguen pendientes | Cerrar bloqueadores antes de datos reales |

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
npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts
npm --prefix frontend run test:e2e
npm run build
npm run db:restore:drill
npm --prefix backend run audit:integrity:verify
DATABASE_URL=file:<tmp>/migrate.db npm --prefix backend run prisma:migrate:prod
```

## Recomendaciones prioritarias

### 1. Antes de producción

1. Cerrar o revertir cambios no committeados, trackear la migración nueva y obtener CI verde desde clone limpio.
2. Ejecutar e2e backend/frontend completos contra stack real.
3. Probar `prisma:migrate:prod`, backup, restore drill y rollback con copia sintética representativa.
4. Definir explícitamente si el alcance de producción será single-clinic controlado o SaaS multi-tenant; si es SaaS, diseñar tenant/clinic model antes de datos reales.
5. Validar en CI limpio que los artefactos runtime eliminados del índice no vuelven a aparecer.
6. Probar redacción Sentry frontend con evento sintético y PHI falsa en staging.

### 2. Antes de beta con usuarios reales

1. Mantener `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` y prohibir modo offline local con PHI.
2. Ejecutar e2e auth/permissions/encounters/consents/alerts en entorno staging.
3. Probar backup, restore, rollback y verificación de integridad de auditoría con datos sintéticos.
4. Configurar HTTPS real, dominio, CORS exacto, firewall y Cloudflare Tunnel.
5. Definir política operativa de acceso admin, retención, exportación y respuesta a incidentes.

### 3. Primeros 30 días post-lanzamiento

1. Diseñar y planificar tenant/clinic model o migración a arquitectura multi-tenant real.
2. Migrar de SQLite a Postgres si el objetivo es SaaS multi-clínica con crecimiento.
3. Implementar métricas/SLO, alertas de error, backup, restore drill, latencia y fallos de login.
4. Revisar logs/auditoría/Sentry semanalmente con muestreo de privacidad.
5. Hacer prueba de restauración y simulacro de incidente documentado.

## Faltante tras la pasada 1

1. Ejecutar e2e backend/frontend completos con backend real.
2. Ejecutar lint backend/frontend y `npm run build` desde raíz.
3. Probar deploy Docker completo, health checks, backup, restore drill y rollback con copia sintética.
4. Probar Sentry frontend con evento sintético y revisar retención/sample rates.
5. Validar CI artifact guard en pull request limpio.
6. Resolver decisión de arquitectura tenant/clinic antes de producción SaaS multi-clínica.

## Siguientes pasos naturales

1. Cerrar validación automatizada: lint, build raíz, e2e backend y e2e frontend.
2. Hacer prueba operativa Docker con backup/restore/rollback.
3. Abrir diseño técnico de tenant/clinic model o limitar formalmente el lanzamiento a beta single-clinic.
4. Preparar PR con los artefactos runtime eliminados del índice y comprobar CI.

## Decisión final

**Anamneo está listo para producción: No.**

Condiciones mínimas para cambiar el veredicto: e2e backend/frontend verdes, release reproducible desde CI limpio, configuración HTTPS/CORS/cookies validada en staging, backups/restauración/rollback probados con copia representativa, Sentry/logs revisados para PHI, y una decisión explícita sobre si el producto será beta single-clinic con SQLite o SaaS multi-tenant con modelo de tenant y base más robusta.
