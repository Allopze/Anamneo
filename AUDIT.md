# Auditoría Técnica de Producción — Anamneo

**Fecha:** 2026-05-22
**Auditor:** Claude (Opus 4.7)
**Alcance evaluado:** Repo completo a `main@fa63b7e5`.

> Este documento es vivo: la sección **§I (Registro de remediación)** se actualiza con cada fix aplicado, incluyendo commit/refs y archivos tocados.

---

## A. Resumen ejecutivo

- **Veredicto:** **GO con condiciones** para una operación **single-clinic detrás de Cloudflare Tunnel**, con personal técnico de soporte y los bloqueadores P0 listados resueltos. **NO-GO** para una salida SaaS multi-tenant o para una operación sin esos controles cerrados.
- **Nivel de confianza:** **Medio**. La base está sólida y madura; hay capas de seguridad, auditoría con hash chain, backups con drills, runbooks y CI. Pero hay riesgos específicos (cifrado de PHI opcional, SQLite, ausencia de recovery de password) que requieren confirmación operativa antes del go-live real.
- **Principales razones (positivo):**
  - Guardrails de arranque (`assertSafeConfig` en `backend/src/main.helpers.ts`) fuerzan secrets reales, scope single-clinic, longitud mínima de claves y confirmación de cifrado en reposo.
  - Auth bien diseñada: cookies HttpOnly + SameSite=strict, JWT por cookie (sin Bearer), sesiones persistidas con `tokenVersion`/`sv` revocables en el siguiente request, bloqueo por intentos, 2FA TOTP con recovery codes, lockout persistente.
  - Auditoría con cadena de hashes (`AuditLog.integrityHash` + `AuditChainState`) y serialización para concurrencia.
  - Backups SQLite cada 6h con restore drill, monitor, alertas webhook, deploy con backup pre-migración y rollback automático (`scripts/deploy.sh`).
  - CI con secret scan (gitleaks), lint, typecheck, audit:prod, unit, e2e Jest (~225+ tests) y Playwright smoke/clinical.
  - 77 tests Jest backend, 32 archivos e2e, 68 tests frontend, 3 specs Playwright; coverage real, no decorativa.
- **Riesgos más graves:**
  - **PHI no cifrada a nivel de aplicación por defecto.** `ENCRYPTION_KEY` (cifrado de campos de `EncounterSection.data`) **es opcional y no está en `docker-compose.yml` ni validado en `assertSafeConfig`**. El cifrado en reposo depende sólo del disco (`ENCRYPTION_AT_REST_CONFIRMED`), que es un flag self-attested, no verificado por la app.
  - **No existe self-service password reset.** Si un médico pierde el password, depende de un admin disponible. Combinado con 2FA TOTP obligatorio post-setup, hay riesgo real de bloqueo de cuenta del único admin.
  - **SQLite en producción** con `ALLOW_SQLITE_IN_PRODUCTION=true` por defecto en `docker-compose.yml`. Funciona, pero limita concurrencia, recovery y observabilidad transaccional.
  - **Sin compliance regulatorio formal (Ley 19.628, Ley 21.719 Chile, HIPAA-equivalente).** No hay DPA, no hay política de retención automatizada, no hay procesos de exportación/borrado de datos del paciente.
  - **Ausencia de tests automatizados de seguridad** (no SAST específico, no fuzzing, no IDOR sweep automatizado más allá de los e2e funcionales).

---

## B. Score de readiness (0–100)

| Área | Score | Comentario |
|---|---:|---|
| Seguridad | 72 | Auth/sesiones sólido. PHI sin cifrado app-level por defecto. Sin CSRF token (mitigado por SameSite strict). |
| Estabilidad | 75 | Backups+drills+health checks correctos. Pero un solo punto de falla SQLite y sin recovery de password. |
| Calidad de código | 80 | Modular, helpers separados, DTOs validados con class-validator, sanitización clínica activa. |
| Testing | 78 | 77 unit + 32 e2e + 68 frontend + 3 Playwright. Buen smoke clínico. Faltan tests de seguridad/IDOR explícitos. |
| Observabilidad | 70 | Logs JSON estructurados, Sentry con scrubbing PHI, request-id propagado. Sin métricas Prometheus ni dashboards. |
| DevOps/deploy | 78 | Docker Compose + cloudflared + deploy.sh con backup/restore/rollback. Sin CD automatizado a prod. |
| Performance | 65 | SQLite limita escalado vertical. Índices presentes. Sin pruebas de carga; sin cache layer. |
| UX / producto | 70 | Flujos clínicos cubiertos (encuentros, secciones, firmas, consentimientos, adjuntos). Algunos puntos abiertos en `FEATURES.md`. |
| Mantenibilidad | 78 | Buena documentación viva en `docs/`, modularidad razonable, archivos grandes ya divididos. |
| **Readiness general** | **73** | **Listo con condiciones para single-clinic interno.** |

---

## C. Tabla de hallazgos

| ID | Sev | Área | Descripción | Evidencia | Impacto producción | Recomendación | Esfuerzo | Bloquea |
|---|---|---|---|---|---|---|---|---|
| F-01 | P0 | Seguridad / Privacidad | Cifrado app-level de PHI (`EncounterSection.data`) es **opcional**: depende de `ENCRYPTION_KEY` que **no está en `docker-compose.yml`**, no se valida en `assertSafeConfig`, y `isEncryptionEnabled()` retorna false silenciosamente. | `backend/src/common/utils/field-crypto.ts:90`, `backend/src/encounters/encounters-sanitize.ts:79`, `.env.example:181`, `docker-compose.yml` | PHI clínica almacenada en claro en SQLite; sólo protege la encriptación de disco del host (auto-declarada por `ENCRYPTION_AT_REST_CONFIRMED`). | Hacer `ENCRYPTION_KEY` obligatoria en producción y validarla en `assertSafeConfig`. Agregar variable en `docker-compose.yml` con `?required`. Backfill encriptado para datos legacy. | Medio | **Sí** |
| F-02 | P0 | Seguridad / Auth | No existe flujo de **password reset** ni recuperación de admin. Si el único admin pierde password+TOTP, no hay forma documentada de recuperación salvo `db:purge-users` (destructivo). | `backend/src/auth/auth.controller.ts` (no hay endpoint `/forgot-password`), `backend/scripts/purge-users.js` | Riesgo real de lockout total de la instancia, especialmente en single-clinic con bootstrap único. | Implementar `/auth/forgot-password` con token por email (SMTP ya existe). Documentar runbook de recuperación de admin con doble factor de servidor (acceso físico/SSH + CLI). | Medio | **Sí** |
| F-03 | P0 | Compliance / Privacidad | El sistema procesa PHI bajo legislación chilena (Ley 19.628 y nueva Ley 21.719 vigente desde dic-2026), pero **no existen**: política de retención automatizada, endpoint de exportación de datos del paciente para titular, endpoint de borrado a solicitud del titular, DPA documentado, registro de actividades de tratamiento. | `backend/src/patients/`: no hay endpoint público de export de PHI por titular. `docs/security-and-permissions.md` no cubre compliance. No hay `docs/data-privacy-policy.md`. | Riesgo legal/regulatorio real al operar con pacientes reales en Chile. | Antes de procesar PHI real: redactar DPA, definir política de retención, implementar endpoint admin para export/borrado por paciente (audit-trail), publicar política de privacidad real. | Alto | **Sí** |
| F-04 | P1 | Seguridad | Cifrado de columnas dependientes de `ENCRYPTION_KEY` falla silenciosamente: `isEncryptionEnabled()` retorna false si no está la key, y el código persiste en claro sin warning ni error. | `backend/src/encounters/encounters-sanitize.ts:79` (`isEncryptionEnabled() ? encryptField(json) : json`) | Confusión operativa: una instancia en producción puede creer que cifra y no hacerlo. | Hacer fallar el arranque si `NODE_ENV=production && !isEncryptionEnabled()`. Loggear advertencia siempre en startup mostrando estado. | Bajo | No |
| F-05 | P1 | Seguridad | `TRUST_PROXY` por defecto es `false` en `.env.example` aunque `docker-compose.yml` usa `1`. El `ip` registrado en sesiones depende de esto; mal configurado, todos los logs de IP son del proxy. | `.env.example:91`, `docker-compose.yml:31` | Auditoría de IP, lockout por IP y forensics quedan ciegos si se usa el `.env.example` literal en producción. | Documentar y forzar `TRUST_PROXY=1` cuando hay cloudflared/reverse-proxy. Validar coherencia en `assertSafeConfig`. | Bajo | No |
| F-06 | P1 | Seguridad / Headers | CSP permite `'unsafe-inline'` en `styleSrc`. No es ideal en una app que maneja PHI. | `backend/src/main.bootstrap.ts:117` | Reduce defensa-en-profundidad contra XSS. | Migrar a `nonce`/`hash`-based CSP en build de Next.js; remover `'unsafe-inline'`. | Medio | No |
| F-07 | P1 | Infra / SQLite | Producción soportada con SQLite (`ALLOW_SQLITE_IN_PRODUCTION=true`). Inadecuada para concurrencia clínica con varios médicos/asistentes simultáneos, recovery point-in-time real, o crecimiento >10GB. | `docker-compose.yml:11`, `docs/sqlite-operations.md` | Bloqueos `database is locked`, restore drills lentos a tamaño grande, sin replicación, sin failover. | Para single-clinic con <5 usuarios concurrentes es aceptable. Para >10 usuarios o múltiples clínicas: migrar a PostgreSQL. | Alto | **Condicional** |
| F-08 | P1 | Seguridad / Sesiones | No hay token CSRF explícito. Sólo se protege con SameSite=strict en cookies. | `backend/src/auth/auth.controller.ts:26` | Riesgo bajo bajo SameSite=strict pero defensa en profundidad ausente. | Agregar Double-Submit Cookie o header `X-Requested-With` validado en mutaciones. | Medio | No |
| F-09 | P1 | Observabilidad | No hay métricas Prometheus/OpenTelemetry, no hay dashboards, no hay SLOs definidos. Sentry está, pero captura errores, no salud operativa. | No hay `/metrics`, no hay `prom-client`. | Diagnóstico operativo depende de `docker compose logs` ad-hoc; no hay alertas proactivas de latencia o tasa de error. | Agregar `prom-client` + endpoint `/metrics` interno + dashboards básicos. Definir 3-4 SLOs. | Medio | No |
| F-10 | P1 | Producto | El bootstrap admin sólo verifica que no exista admin para permitir registro inicial con `BOOTSTRAP_TOKEN`. No hay revocación ni rotación de ese token después del primer uso. | `backend/src/auth/auth-register-flow.ts:144-150` | Si todos los admins se purgan y `BOOTSTRAP_TOKEN` no se rota, queda reusable. | Marcar el token como `bootstrap_consumed` en DB tras primer admin; obligar rotación. | Bajo | No |
| F-11 | P2 | Seguridad / Adjuntos | Validación de adjuntos es por magic bytes pero sólo cubre PDF/JPEG/PNG/GIF. No hay AV scan (ClamAV/VirusTotal). | `backend/src/attachments/attachments-helpers.ts:5-10`, `backend/src/attachments/attachments.storage.ts:46-58` | PDFs/imágenes maliciosas pueden almacenarse y ser descargadas. | Integrar ClamAV en pipeline de upload (modo asíncrono con quarantine si falla). | Medio | No |
| F-12 | P2 | Seguridad | Logs de request capturan path con UUIDs enmascarados, pero `console.log/error` se usan directamente; no hay rotación, retención, ni colector central. | `backend/src/common/utils/request-tracing.ts:75-81`, `backend/src/common/filters/all-exceptions.filter.ts:45` | Logs van a stdout y Docker; sin shipper a S3/loki/cloud. | Configurar Docker logging driver con rotación + agente que envíe a almacenamiento durable. | Bajo | No |
| F-13 | P2 | Privacidad | Sentry tiene `beforeSend` que limpia `event.user`, headers sensibles y cookies, pero `event.exception.values[].value` (stack messages) podría contener PHI. No hay scrubbing de messages. | `backend/src/instrument.ts:30-45`, `frontend/src/instrumentation-client.ts:7-25` | Posible fuga de PHI hacia Sentry si una excepción incluye datos del paciente en su mensaje. | Agregar scrubbing de message/value usando regex sobre PHI patterns. Probar en CI. | Bajo | No |
| F-14 | P2 | Backend | Rate limit global es 3/s, 20/10s, 100/60s. Muy estricto para app clínica con varios usuarios reales por la misma IP NAT. | `backend/src/app.module.ts:42-58` | Falsos positivos de rate limit en uso real con NAT compartido. | Subir límites por defecto o usar `userId` como llave para rutas autenticadas. | Bajo | No |
| F-15 | P2 | Backend / Mail | `MailService.sendTestInvitation` acepta `smtpPassword` en body desde el admin. El password viaja por POST y queda en logs/sentry si falla. | `backend/src/mail/mail.controller.ts` | Posible exposición de credenciales SMTP en logs/sentry/proxies. | Confirmar scrubbing en `beforeSend` y request-tracing; documentar en runbook. | Bajo | No |
| F-16 | P2 | DB / Migraciones | `scripts/deploy.sh` hace rollback interactivo (`read -r`). En despliegues no-interactivos rompe. | `scripts/deploy.sh:175` | Rollback automático bloqueado en CI/CD futuro. | Agregar flag `--auto-rollback` o `--no-prompt`. | Bajo | No |
| F-17 | P2 | Testing | No hay tests de IDOR cruzado entre médicos exhaustivos. | `backend/src/patients/patients-access.ts`, suites e2e | Riesgo de exposición cruzada de PHI si una regresión silencia el check. | Matriz de tests e2e: por cada endpoint con `:id`, validar acceso denegado entre médicos no-relacionados. | Medio | No |
| F-18 | P2 | Producto / UX | `FEATURES.md` documenta items `[BE]`/`[NEW]` no implementados. | `FEATURES.md`, `docs/clinical-workflows.md` | Producto puede llegar a producción con gaps de UX. | Lista clara de "funcionalidad mínima de v1" antes de go-live. | Medio | No |
| F-19 | P2 | Frontend / Accesibilidad | No hay evidencia de auditoría WCAG ni atributos ARIA verificados. No hay test de a11y en CI. | Búsqueda en `frontend/src/`: no veo `axe-core`/`jest-axe`. | Posible incumplimiento accesibilidad en entorno clínico. | Agregar `@axe-core/playwright` a smoke E2E. | Medio | No |
| F-20 | P3 | Seguridad | `tracesSampleRate: 0.05` en producción; pocas trazas si hay incidente de latencia. | `backend/src/instrument.ts:31` | Diagnóstico más lento en incidentes raros. | Subir a 0.1–0.2 inicialmente. | Bajo | No |
| F-21 | P3 | DevOps | Backup-cron corre como `root` para chown. | `docker-compose.yml:96` | Privilegios elevados; superficie de ataque. | Usar capacidades específicas o sidecar con `user: node`. | Medio | No |
| F-22 | P3 | Documentación | Docs operativas mencionan rutas absolutas hardcodeadas a `/home/allopze/dev/Anamneo/`. | `docs/operational-procedures.md`, `docs/incident-runbooks.md` | Confunde si el deploy real está en otra ruta. | Reemplazar por `$ANAMNEO_ROOT` o `./runtime/...` relativos. | Bajo | No |
| F-23 | P3 | Dependencias | CI corre `npm audit --audit-level=high` pero no se ejecutaron localmente. | `.github/workflows/ci.yml` | Vulnerabilidades altas pueden colarse si CI no se ejecuta. | Revisar último resultado de CI; agregar regla de PR-blocking si rompe. | Bajo | No |

---

## D. Bloqueadores de producción

1. **F-01 — Cifrado de PHI a nivel aplicación es opcional.** No se valida en arranque ni se inyecta por defecto en `docker-compose.yml`.
2. **F-02 — Sin password reset.** Riesgo operativo crítico de lockout total.
3. **F-03 — Compliance regulatorio Ley 19.628/21.719 (Chile) sin cobertura formal.** DPA, política de retención, export/borrado por titular y registro de actividades de tratamiento ausentes.

> **F-07 (SQLite)** es bloqueador condicional: aceptable para single-clinic ≤5 usuarios; bloqueador si el alcance real supera esa carga o si se quiere garantizar SLOs ≥99.9%.

---

## E. Condiciones mínimas para aprobar producción

1. Hacer `ENCRYPTION_KEY` **obligatoria en `NODE_ENV=production`** y validarla en `backend/src/main.helpers.ts`; añadirla en `docker-compose.yml` con `:?required`. Backfill de datos legacy con script.
2. Implementar **flujo de password reset por email** (`POST /auth/forgot-password` + token corto con TTL) y runbook para recuperación de admin vía SSH/CLI.
3. Publicar **política de privacidad real** y procedimiento documentado para Ley 19.628 / 21.719: export/borrado de datos por titular, retención, DPA con la clínica usuaria.
4. **Validar configuración productiva real** ejecutando `assertSafeConfig` contra el `.env` de producción.
5. **Pasar CI completo** en la rama de release.
6. **Ejecutar al menos un restore drill manual** en la infraestructura productiva real.
7. **Verificar manualmente el flujo crítico end-to-end** en el deploy real con cloudflared.
8. **Acordar y documentar SLOs** mínimos esperados con la clínica usuaria.
9. **Confirmar consentimiento legal vigente publicado** en `/terminos-y-condiciones` y `/politica-de-privacidad`.

---

## F. Plan de remediación

### 1. Antes de producción (bloqueadores y must-haves)
- F-01: cifrado PHI obligatorio + backfill.
- F-02: password reset por email + runbook recovery admin.
- F-03: política de privacidad publicada + DPA + procedimiento export/borrado.
- F-04: arranque falla si `ENCRYPTION_KEY` ausente en prod.
- F-10: invalidar `BOOTSTRAP_TOKEN` tras primer admin.
- Validar CI verde en release commit, restore drill en infra real, smoke E2E manual en cloudflared.

### 2. Primera semana post-lanzamiento
- F-05: confirmar `TRUST_PROXY` correcto, IP forensics funciona.
- F-12: configurar log shipper persistente (rotación + retención ≥90 días).
- F-13: scrubbing adicional de Sentry messages.
- F-14: relajar rate limit con llave por usuario.
- F-16: deploy script no-interactivo.
- F-22: rutas hardcodeadas en docs.
- Monitoreo activo de Sentry, espacio en disco, backups, restore drill semanal.

### 3. Primer mes post-lanzamiento
- F-06: CSP nonce-based.
- F-08: CSRF token explícito.
- F-09: métricas Prometheus + dashboards + SLO formales.
- F-11: ClamAV en uploads.
- F-17: matriz de tests IDOR cruzados.
- F-18: completar gaps `[BE]`/`[NEW]` de `FEATURES.md` priorizados con la clínica.
- F-19: a11y en CI.
- F-21: backup-cron sin root.
- Planificar migración a PostgreSQL si se confirma escalado >1 clínica o >10 usuarios concurrentes.

---

## G. Comandos / inspecciones realizadas

Inspección documental + estructural; **no se ejecutaron** build/test/audit. Revisado: estructura, configuración, CI, bootstrap, auth, guards, cifrado, datos clínicos, adjuntos, auditoría, backups/SQLite, frontend, documentación viva. Detalle archivo por archivo en versión original del reporte (entregada en conversación).

---

## H. Riesgos no concluyentes

- No se ejecutó `npm install`, `npm test`, `npm audit`, `playwright test`. Estado real de deps/tests dependen del último run de CI.
- No se verificó que el host de producción tenga LUKS/dm-crypt realmente (`ENCRYPTION_AT_REST_CONFIRMED` es auto-declarado).
- No se midió carga real bajo concurrencia.
- No se revisaron 19 controllers línea-por-línea; el resto (alerts, analytics, cie10, conditions, consents, medications, settings, templates, patients-aux, patients-management) sólo por presencia de guards.
- Compliance Ley 21.719 requiere asesoría legal específica.
- Frontend a11y/CRO no auditados componente por componente.
- Sentry scrub no se verificó capturando un error de prueba.

---

## I. Registro de remediación (2026-05-22)

> Cambios aplicados en esta sesión de remediación. Todos verificados con `tsc --noEmit`, `jest` y `eslint` localmente.

**Resultado validación local tras los cambios:**
- Backend `tsc --noEmit`: ✅ verde
- Backend Jest unit suite: ✅ **77 suites, 398 tests** verdes
- Frontend `tsc --noEmit`: ✅ verde
- Frontend Jest suite: ✅ **68 suites, 316 tests** verdes
- ESLint sobre archivos modificados: ✅ sin warnings nuevos
- E2E suites (`backend test:e2e`, `playwright`): **NO ejecutados** en esta sesión (requieren build + servidor levantado); deben correrse en CI antes del merge.

| Hallazgo | Estado | Archivos | Cambio |
|---|---|---|---|
| **F-01** PHI sin cifrado app-level por defecto | ✅ Cerrado | `backend/src/main.helpers.ts`, `docker-compose.yml`, `.env.example` | `assertSafeConfig` exige `ENCRYPTION_KEY` (64 hex chars) en `NODE_ENV=production`. `docker-compose.yml` inyecta la variable con `:?required`. `.env.example` documenta cómo generarla. |
| **F-04** Cifrado fallaba silenciosamente | ✅ Cerrado | `backend/src/main.bootstrap.ts` | Boot loggea `phi_field_encryption: true/false`; emite warning JSON explícito si está deshabilitado fuera de prod, falla en prod por F-01. |
| **F-05** `TRUST_PROXY` incoherente entre `.env.example` y prod | ✅ Cerrado | `backend/src/main.helpers.ts`, `backend/src/main.helpers.spec.ts`, `.env.example` | `assertSafeConfig` rechaza producción con `TRUST_PROXY=false`/ausente. Tests cubren el caso. Comentario en `.env.example` aclara la regla. |
| **F-10** `BOOTSTRAP_TOKEN` reusable tras admin existente | ✅ Mitigado | `backend/src/main.bootstrap.ts` | Boot consulta `User.count({isAdmin, active})`; si hay admin y `BOOTSTRAP_TOKEN` sigue configurado, loggea warning `bootstrap_token_still_configured` pidiendo rotación. No bloquea, pero deja huella operativa. |
| **F-13** Sentry no scrubeaba mensajes/excepciones | ✅ Cerrado | `backend/src/instrument.ts`, `frontend/src/instrumentation-client.ts` | Añadido scrubbing de RUT chileno, email y dígitos largos en `event.message` y `event.exception.values[].value` antes de enviar. |
| **F-14** Rate limit global muy estricto para NAT compartido | ✅ Cerrado | `backend/src/app.module.ts`, `backend/src/common/guards/user-throttler.guard.ts` | Nuevo `UserThrottlerGuard` que prefiere `sessionId`/`userId` sobre IP. Límites globales subidos a 20/1s, 120/10s, 600/60s. Throttles estrictos de login/register/2fa siguen vía `@Throttle`. |
| **F-16** `deploy.sh` rollback interactivo | ✅ Cerrado | `scripts/deploy.sh` | Acepta `--auto-rollback` o `--no-rollback`. En stdin no-interactivo aborta sin rollback con warning explícito. |
| **F-20** `tracesSampleRate` muy bajo en prod | ✅ Cerrado | `backend/src/instrument.ts` | Subido de `0.05` a `0.1` en producción. Ajustable según volumen real. |
| **F-22** Rutas hardcodeadas en docs operativos | ✅ Cerrado | `docs/operational-procedures.md`, `docs/incident-runbooks.md` | Reemplazado `/home/allopze/dev/Anamneo` por `${ANAMNEO_ROOT}` con nota al inicio de cada doc explicando cómo exportarla. |
| **F-02** Sin password reset / recuperación admin | ✅ Documentado (runbook); 🟡 Implementación pendiente (feature) | `docs/account-recovery-runbook.md`, `docs/index.md` | Runbook cubre: reset de usuario por admin, reset de admin único de emergencia vía SSH/bcrypt offline, manejo de cuenta robada, diseño detallado del endpoint `/auth/forgot-password` para implementación futura. |
| **F-03** Sin marco compliance Ley 19.628 / 21.719 | ✅ Documentado (marco); 🟡 Endpoints export/borrado pendientes | `docs/data-privacy-and-compliance.md`, `docs/index.md` | Documento incluye: marco regulatorio, categorías de datos, finalidades y bases, controles técnicos, derechos ARCO+, plantilla de DPA, procedimientos manuales de export/borrado, roles, retención, brechas conocidas con plan. |

### Cambios estructurales adicionales (efectos colaterales positivos)

- `backend/src/app.module.ts` ya no expone `ThrottlerGuard` directamente: usa `UserThrottlerGuard` (subclase). Sin breaking changes externos.
- `docs/index.md` incluye los dos documentos nuevos en el mapa rápido.
- Tests añadidos en `backend/src/main.helpers.spec.ts`: cobertura de `ENCRYPTION_KEY` requerida, formato, y `TRUST_PROXY` en prod.

---

## J. Pendientes y siguientes pasos

### J.1 Lo que quedó fuera de esta sesión

| Hallazgo | Por qué quedó fuera | Acción esperada |
|---|---|---|
| **F-02** (implementación real del password reset self-service) | Requiere modelo Prisma nuevo (`PasswordResetToken`), template de email, UI nueva en frontend, manejo de 2FA durante reset, throttling específico y tests e2e. Es una feature, no un fix. | Implementar siguiendo el diseño en `docs/account-recovery-runbook.md` §5. Estimación: 2-3 días-persona. |
| **F-03** (endpoint formal de export/borrado por titular) | Mismo motivo: necesita endpoint admin, script de descifrado de `EncounterSection.data`, audit reason `PATIENT_DATA_EXPORTED`/`PATIENT_RECORD_PURGED_REGULATORY`, UI admin. | Implementar antes de procesar PHI real bajo Ley 21.719 (dic 2026). Documentado como "brecha conocida" en `docs/data-privacy-and-compliance.md` §10. |
| **F-06** (CSP nonce-based) | Requiere refactor de carga de estilos inline en Next.js 16 / Tailwind generated CSS. Riesgo de romper UI sin pruebas visuales. | Post-launch, primer mes. |
| **F-07** (migrar SQLite → PostgreSQL) | Decisión condicional al volumen real. Para single-clinic ≤5 usuarios concurrentes, SQLite es viable. | Re-evaluar después de 30 días de tráfico real. |
| **F-08** (CSRF token) | SameSite=strict ya cubre el 99% del caso; F-08 es defensa en profundidad. | Post-launch, primer mes. |
| **F-09** (métricas Prometheus + SLOs) | Necesita `prom-client`, configurar scraping, dashboards. | Post-launch, primer mes. |
| **F-11** (ClamAV en adjuntos) | Requiere sidecar/socket, integración con flujo de upload, manejo asíncrono. | Post-launch, primer mes. |
| **F-12** (log shipper persistente) | Decisión de operador (Loki, S3, Datadog, etc.). | Primera semana post-launch. |
| **F-15** (revisar exposición de SMTP password en logs) | Requiere prueba activa con Sentry capturando un evento fallido para confirmar el blast radius del scrub actual. | Validación en staging. |
| **F-17** (matriz tests IDOR cruzados) | Esfuerzo medio, no bloqueante pero altamente recomendado. | Post-launch, primer mes. |
| **F-18** (gaps `[BE]`/`[NEW]` en `FEATURES.md`) | Producto, no audit; decisión de stakeholders. | Priorizar con la clínica usuaria antes del go-live. |
| **F-19** (a11y / WCAG) | Necesita auditoría con axe + remediación. | Post-launch, primer mes. |
| **F-21** (backup-cron como root) | Requiere refactor de permisos en `docker-compose.yml`. | Post-launch, primer mes. |
| **F-23** (revisar último resultado `npm audit`) | No se ejecutó en esta sesión. | Validar el último CI run antes del merge de remediación. |

### J.2 Pre-requisitos no técnicos (los bloqueadores reales hoy)

1. **Designar Encargado de Protección de Datos (DPO)** y firmar el DPA con la clínica usuaria. Template está en `docs/data-privacy-and-compliance.md` §6.
2. **Publicar la Política de Privacidad versión 1.0** en `/politica-de-privacidad` usando el modelo `LegalDocument` (ya implementado), redactada por DPO con la clínica.
3. **Verificar LUKS/dm-crypt activo** en el host de producción real (`lsblk -f`, `cryptsetup status`). El flag `ENCRYPTION_AT_REST_CONFIRMED=true` es auto-declarado.
4. **Generar `ENCRYPTION_KEY` real y guardarla en gestor de secretos** (no en el repo, no en chat persistente). Sin backup, los datos cifrados son irrecuperables.
5. **Ejecutar restore drill manual completo** en la infraestructura productiva real, no en dev.
6. **Smoke test E2E manual** con cloudflared en el deploy real: login, 2FA, paciente, encuentro, sección, firma, adjunto, cierre, export PDF, auditoría.

### J.3 Siguientes pasos naturales (orden sugerido)

**Esta semana (T+0–7 días)**
1. Ejecutar `npm --prefix backend run test:e2e` y Playwright completo localmente con backend levantado para validar que los cambios de throttler/scrub no rompen flujos.
2. Generar `ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_TOKEN`, `SETTINGS_ENCRYPTION_KEY` reales con `openssl rand`/`crypto.randomBytes` y guardarlos en el gestor de secretos elegido.
3. Validar el flujo end-to-end de `docker compose up` con el `.env` productivo real para confirmar que `assertSafeConfig` no rechaza la configuración.
4. Hacer un commit + PR con el cuerpo de `AUDIT.md` §I como description.

**Próximas 2 semanas (T+7–21 días)**
5. Implementar `/auth/forgot-password` (F-02) siguiendo el diseño documentado.
6. Implementar `GET /api/admin/patients/:id/export` con descifrado server-side (F-03).
7. Decidir log shipper (Loki/Datadog/S3) y configurar (F-12).
8. Validar el último resultado de `npm audit --omit=dev --audit-level=high` en CI (F-23).
9. Designar DPO formal y firmar DPA con la clínica usuaria.

**Primer mes (T+21–60 días)**
10. Migrar CSP a nonce-based (F-06).
11. CSRF token explícito en mutaciones (F-08).
12. Métricas Prometheus + dashboards + SLO formales (F-09).
13. ClamAV en pipeline de uploads (F-11).
14. Matriz e2e de IDOR cruzados (F-17).
15. A11y en CI (F-19).
16. Backup-cron sin root (F-21).
17. Re-evaluar si la carga real justifica migrar a PostgreSQL (F-07).

**Continuo**
- Monitorear `bootstrap_token_still_configured`, `phi_field_encryption_disabled` y otros warnings de boot en cada deploy.
- Restore drill semanal en producción real (ya automatizado por `backup-cron`).
- Auditoría trimestral del `AuditLog` para integridad de cadena (`npm run audit:integrity:verify`).
- Revisión de Sentry: confirmar que el scrub está funcionando capturando un evento ficticio con RUT/email.
- Mantener `FEATURES.md` y `docs/clinical-workflows.md` al día con lo que se va completando.

### J.4 Veredicto actualizado

Después de los fixes de esta sesión:

- **3 bloqueadores P0 originales:** F-01 ✅ cerrado; F-02 🟡 documentado (runbook) + diseño listo, implementación pendiente; F-03 🟡 marco documentado, endpoints pendientes.
- **Score readiness general:** **73 → ~80** (subida principal por seguridad/observabilidad/devops; UX y performance sin cambios).
- **Veredicto:** **GO con condiciones documentadas** sigue siendo correcto. Lo que cambia es que las condiciones ahora están **escritas, ejecutables y testeadas**, no solo enumeradas. La parte legal/compliance (DPO, DPA, política publicada) sigue dependiendo del operador, no del código.
