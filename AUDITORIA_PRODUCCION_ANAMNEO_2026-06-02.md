# Auditoría de producción de Anamneo

> Auditoría técnica de pre-producción (solo lectura). Fecha: 2026-06-02. Contexto: uso personal / muy baja escala, Chile.

## 1. Resumen ejecutivo

- **Estado general:** **Casi listo → Listo con condiciones mínimas.**
- **Recomendación:** **Usar con cautela** tras cumplir ~3 condiciones operativas. No hay bloqueadores de código.
- **Motivo principal:** Repo en excelente estado. Todos los gates pasan en verde (typecheck, lint, build, 899 tests entre back y front, 0 vulnerabilidades de dependencias). La arquitectura de seguridad, el cifrado de PHI, la validación chilena (RUT/fechas) y las funcionalidades EMR ya están implementadas y verificadas. Los sprints de auditoría previos cerraron lo grueso; mi verificación fresca lo confirma. Lo que queda es **pre-vuelo operativo** (probar restore de backup, secretos frescos en prod) y pulidos menores de UX/validación.
- **Corrección importante a un falso positivo:** un barrido inicial reportó "🔴 secretos reales (Brevo SMTP, password DB, JWT, ENCRYPTION_KEY) commiteados a git". **Lo verifiqué con `git` y es falso.** Detalle en §6.

**Top 5 que corregiría primero:**
1. **Probar el ciclo backup → restore** una vez (`npm run db:backup` + `npm run db:restore:drill`) antes de meter datos reales. Está automatizado pero nunca validado en esta máquina.
2. **Secretos frescos al desplegar a producción** (no reusar los de `.env` de dev): `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `SETTINGS_ENCRYPTION_KEY`, `BOOTSTRAP_TOKEN`, passwords de DB/Grafana/monitor.
3. **Validación/normalización de teléfono chileno** (hoy no existe; sólo `MaxLength(30)`).
4. **Guard de cambios sin guardar en *editar paciente*** (existe en *nuevo* pero no en *editar*).
5. **Activar `NEXT_PUBLIC_STRICT_CSP=true` en prod** (validar antes en staging).

---

## 2. Contexto y alcance asumido

Auditoría pensada para **uso personal / muy baja escala** (tu pareja, fines personales, Chile), **no** para despliegue clínico empresarial. Por eso no exijo HIPAA/SOC2/HL7-FHIR/SSO ni infraestructura corporativa. Sí trato los datos de salud con seriedad: privacidad, integridad, no-pérdida y recuperación. Modo **solo lectura**: no modifiqué código del proyecto; sólo corrí comandos no destructivos. El entregable es este informe.

---

## 3. Comandos ejecutados y resultados

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm --prefix backend run typecheck` | ✅ exit 0 | `tsc --noEmit` limpio |
| `npm --prefix backend run lint:check` | ✅ exit 0 | eslint sin errores ni warnings |
| `npm --prefix frontend run typecheck` | ✅ exit 0 | limpio |
| `npm --prefix frontend run lint` | ✅ exit 0 | limpio (memoria previa decía "2 warnings"; ya no) |
| `npm run build:backend` | ✅ exit 0 | `nest build` |
| `npm run build:frontend` | ✅ exit 0 | `next build` completo, rutas generadas |
| `npm --prefix frontend test` | ✅ **74 suites / 365 tests** | 13 s, 0 fallos |
| `npm --prefix backend test` | ✅ **98 suites (1 skip) / 534 tests (2 skip)** | 42 s, 0 fallos (Postgres local activo) |
| `npm --prefix backend run audit:prod` | ✅ **0 vulnerabilidades** | `--omit=dev --audit-level=high` |
| `npm --prefix frontend run audit:prod` | ✅ **0 vulnerabilidades** | idem |

**No ejecuté** (a propósito, por ser potencialmente mutantes o requerir servicios con estado): `dev`, `seed`, `migrate`, `deploy`, `db:reset`, e2e Playwright, ni el backup/restore drill real. Estos quedan como **pruebas manuales recomendadas** (§10).

---

## 4. Hallazgos prioritarios

| Prioridad | Área | Hallazgo | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|
| **P1** | Operación/Datos | Ciclo backup→restore nunca validado en esta instalación | Si el backup no restaura, pérdida total ante incidente | Correr `db:backup` + `db:restore:drill` una vez y confirmar OK | Bajo |
| **P1** | Seguridad (deploy) | Riesgo de reusar secretos de dev en prod | Claves dev conocidas localmente protegerían datos reales | Generar valores frescos por env para todas las claves antes de desplegar | Bajo |
| **P2** | Integridad (Chile) | Teléfono sin validación/normalización de formato | Datos de contacto inconsistentes (+56 9, espacios, guiones) | `@Matches` chileno en DTO + normalizar en front | Bajo |
| **P2** | UI/UX / Datos | *Editar paciente* sin guard de cambios sin guardar | Navegar fuera pierde la edición en silencio | Reusar patrón de `nuevo` (`usePatientFormDraft` / beforeunload) | Bajo |
| **P2** | Seguridad | `NEXT_PUBLIC_STRICT_CSP` desactivado | CSP más laxa de lo necesario en prod | Activar en prod tras validar en staging | Bajo |
| **P2** | Higiene git | JWT secret de **dev obsoleto** quedó en historia git | Sólo relevante si el repo se hace público; ya está en desuso | Si el repo será público: scrub historial + rotar | Medio |
| **P3** | Validación | `rutExemptReason` acepta 1 carácter | Razón de exención de RUT poco útil | `min(5)` en el refine de zod | Bajo |
| **P3** | Docs | README quick-start no incluye paso de generar secretos | Persona nueva podría arrancar y fallar | Añadir el bloque que ya está en `docs/development.md` | Bajo |
| **P3** | UI/UX | Estado vacío de agenda no confirmado | Ambigüedad "cargando vs sin citas" | *Requiere revisión manual* | Bajo |

**P0: ninguno.** No encontré build roto, login roto, guardado crítico fallando, exposición pública de PHI ni ruta de pérdida de datos.

---

## 5. Bugs e inconsistencias encontradas

**Verificados (reales):**

1. **Teléfono sin validación de formato** — `backend/src/patients/dto/create-patient.dto.ts:98-104` y `contactoEmergenciaTelefono` (122-128); idéntico en `backend/src/patients/dto/update-patient.dto.ts:112`. Sólo `@IsString @MaxLength(30) @IsOptional` + trim. El formulario muestra placeholder `Ej: +56 9 1234 5678` (`frontend/src/app/(dashboard)/pacientes/nuevo/NuevoPacienteDoctorFields.tsx:135`) pero el esquema zod sólo valida "no vacío" (`frontend/src/app/(dashboard)/pacientes/nuevo/nuevo.constants.ts:40`). **Corrección:** añadir un `@Matches(/^\+?56\s?9\s?\d{4}\s?\d{4}$/)` opcional o un normalizador a `+569XXXXXXXX` en el `@Transform`.

2. **`editar paciente` no protege cambios sin guardar** — `nuevo` usa `frontend/src/app/(dashboard)/pacientes/nuevo/usePatientFormDraft.ts`; `editar` no tiene ningún `beforeunload`/draft guard (grep vacío en `pacientes/[id]/editar/`). **Corrección:** reusar el mismo hook o un guard `beforeunload`.

3. **`rutExemptReason` con validación débil** — `frontend/src/app/(dashboard)/pacientes/nuevo/nuevo.constants.ts:74`: el refine sólo exige `trim().length === 0`, así que `"X"` pasa. **Corrección:** `min(5)`.

**Descartados (falsos positivos del barrido inicial, verificados como OK):**

- ❌ "CommandPalette sin estado vacío" → **sí tiene** "No se encontraron resultados para…" (`frontend/src/components/common/CommandPalette.tsx:179`).
- ❌ "Secretos reales commiteados a git" → ver §6 (falso).
- ❌ "Fecha de nacimiento futura no rechazada" → **sí se rechaza** server-side en create (`backend/src/patients/patients-intake-mutations.ts:67-68`) y update (`backend/src/patients/patients-demographics-mutations.helpers.ts:94-95`).

**No verificado / requiere revisión manual:** estado vacío "sin citas" de la agenda; QA de teclado en modales; comportamiento responsive real en móvil.

---

## 6. Seguridad, privacidad y datos sensibles

**Postura general: fuerte para el contexto.** Verificado:

- **Autenticación y rutas protegidas:** guards globales `JwtAuthGuard` + `RolesGuard` + `PatientNotBlockedGuard`; controladores de pacientes/encuentros los aplican. Scope por paciente real en `backend/src/common/utils/patient-access.ts` (un médico no ve pacientes de otro salvo relación). Acceso denegado devuelve 404 para evitar enumeración.
- **Brute-force:** `@nestjs/throttler` global + `@Throttle` en login/register/forgot-password (`backend/src/auth/auth.controller.ts:108-203`) **y** lockout por intentos fallidos con `failedAttempts`/`lockedUntil` (`backend/src/auth/auth-login-flow.ts:64-135`). 2FA TOTP con anti-replay de JTI.
- **Cifrado de PHI at-rest:** AES-256-GCM app-level (`backend/src/common/utils/field-crypto.ts`) sobre RUT, nombre, teléfono, email, domicilio, contacto de emergencia, representante legal; hashes HMAC para lookup sin descifrar.
- **Subida de archivos:** límite de tamaño (10 MB), allowlist de MIME/extensión **y validación magic-byte** del contenido (`backend/src/attachments/attachments.service.ts:56`), más escaneo posterior.
- **CORS:** desde `CORS_ORIGIN` env, default `localhost:5555` — no wildcard (`backend/src/main.bootstrap.ts:180`).
- **Health endpoint:** `GET /health` público devuelve sólo `{status,timestamp}`; `/health/database` (con detalles) exige `JwtAuthGuard + AdminGuard` (`backend/src/health.controller.ts`).
- **Logs:** Sentry scrubbing de credenciales; no se loguea PHI en texto plano. (Menor: el flujo de reset loguea el email solicitante — aceptable si los logs son privados.)

**El "hallazgo crítico de secretos" — verificado y corregido:**

- `.env` y `backend/.env` **no están trackeados** hoy (`.gitignore`: `.env`, `.env.*`, `!.env.example`).
- `.env` **sí estuvo** en historia (eliminado en commit `d714f820`), pero su contenido histórico era `DATABASE_URL="file:./dev.db"` (SQLite, **sin** credenciales) y un `JWT_SECRET` de dev **distinto al actual** → ya rotado, en desuso. `ENCRYPTION_KEY` y el password de Postgres **nunca** estuvieron en historia.
- La **Brevo SMTP key live** (`xsmtpsib-…`): **0 apariciones en toda la historia** (`git grep` sobre `git rev-list --all`). Sólo vive en el `backend/.env` local no trackeado. El barrido la marcó como "commiteada" por un test de shell defectuoso.
- Password local de Postgres `Chgo1314.`: **0 apariciones en historia**.

→ **Residual real (severidad baja):** un JWT secret de **dev** obsoleto en historia (irrelevante salvo que publiques el repo, y aun así no se usa). Nota de higiene: la Brevo key live está en texto plano en tu `backend/.env` local — está bien para dev, sólo no la commitees (el `.gitignore` ya lo previene). CI además corre **gitleaks** como red de seguridad.

**Backups y recuperación:** `pg-backup.js` (`pg_dump` custom + checksum + snapshot de adjuntos por hard-link) y `pg-restore-drill.js` (restaura a DB temporal, valida tablas y que existan los archivos de adjuntos), orquestados por cron cada 6 h en el contenedor `backup-cron`, con retención configurable. **Sólido — pero ejecútalo una vez manualmente para confirmar (§4 P1).** Limitación: backups en el mismo filesystem; para personal está bien, pero una copia off-site (rsync/USB/S3) es deseable a futuro.

---

## 7. Integridad de datos clínicos

**Modelo de datos (Prisma):** entidades clínicas completas — `Patient` (soft-delete vía `archivedAt`, bloqueo Ley 21.719), `Encounter` (con firma/revisión), `PatientAllergy` (severidad LEVE→FATAL), `PatientMedication`, `PatientProblem`, `EncounterDiagnosis` (CIE), `EncounterVitalSigns` (con alertas), `Attachment` (cifrado), `EncounterTask`, `ClinicalAlert`, consentimientos clínicos y de datos, `AuditLog` con **hash-chain** (`integrityHash`/`previousHash`/`chainSequence`). Eliminación de paciente es **archivado (soft)**, con purga regulatoria irreversible separada (retención por defecto 15 años + snapshot previo + confirmación `PURGE-REGULATORY`).

**Específico Chile (verificado):**
- **RUT con dígito verificador:** sí, front (`frontend/src/lib/rut.ts`) y back (`backend/src/common/utils/helpers.ts:5-58`); almacenamiento cifrado + hash de lookup. ✅
- **Fechas:** storage ISO con TZ `America/Santiago`; display al usuario `d MMM yyyy` es-CL (p.ej. "31 mar 2026") — coherente, sin formatos US/ISO crudos en UI (`frontend/src/lib/date.ts`). ✅
- **Edad:** calculada con años+meses, rechaza fecha futura (`backend/src/common/utils/local-date.ts:150-178`). ✅
- **Teléfono:** ❌ sin validación de formato (único gap chileno real — §5/§4).

**Trazabilidad:** AuditLog se escribe en create/update/delete de datos clínicos y también en lecturas sensibles (LIST/SUMMARY), con verificación de integridad de la cadena (`audit:integrity:verify`). Detección de duplicados al crear paciente (nombre+fecha de nacimiento).

---

## 8. UI/UX

**Bien resuelto (verificado):**
- Estados vacíos, skeletons de carga y `ErrorAlert` en listas principales (pacientes, atenciones).
- Confirmaciones destructivas con `ConfirmModal` (variante danger) para archivar paciente, revocar consentimiento, reabrir encuentro; firmar encuentro pide contraseña + banner de irreversibilidad.
- Modales con focus-trap, restauración de foco y Escape (`frontend/src/components/common/Dialog.tsx` + `useFocusTrap`); foco inicial en "Cancelar" en confirmaciones.
- `aria-label` en botones-ícono clave; labels asociados a inputs; feedback por toast tras guardar/editar.
- Búsqueda global por command palette con navegación por teclado y estado "sin resultados".

**A mejorar (verificado):**
- *Editar paciente* sin guard de cambios sin guardar (§5 #2) — el más relevante por riesgo de perder edición.
- Validación de teléfono inexistente (§5 #1).

**Requiere revisión manual:** estado "sin citas" de la agenda; QA de teclado completo en todos los modales; responsive en móvil; revisión de las capturas Playwright existentes.

---

## 9. Funcionalidades EMR faltantes o mejorables

Comparado con un EMR personal razonable, Anamneo está **funcionalmente completo**. Verifiqué que ya existen: perfil de paciente, alergias (con badge crítico GRAVE/FATAL), medicamentos activos/pasados, problemas/diagnósticos (CIE), notas clínicas estructuradas, adjuntos cifrados, timeline por paciente, búsqueda global, tareas/seguimientos, **export del paciente a PDF** (`backend/src/patients/patients-aux.controller.ts:77`, locale es-CL), export regulatorio/portabilidad, plantillas con variables, categorías/tags (`category` en schema), audit log, panel resumen, agenda semana/mes, signos vitales con alertas, y un **chequeo alergia↔medicamento** al prescribir (`frontend/src/components/sections/StructuredMedicationsEditor.tsx:154`).

### Muy útiles para producción personal
- **Validación/normalización de teléfono chileno** (única laguna de captura de datos relevante).
- **Confirmar y dejar probado el export/backup** (ya existe; falta validar el restore — §4 P1).

### Buenas mejoras futuras
- **Copia de backup off-site** (rsync a USB/otra máquina/S3) además del local.
- **Recordatorios/notificaciones** de tareas o citas próximas (hoy hay tareas; un aviso proactivo sumaría).
- Guard de cambios sin guardar en *editar* (también es UX, §8).

### Opcionales o avanzadas
- Chequeo de interacciones medicamento↔medicamento (hoy sólo alergia↔medicamento).
- Plantillas/curvas pediátricas, si aplica al uso.
- Cualquier interoperabilidad (HL7/FHIR) — **no necesaria** en este contexto.

---

## 10. Testing mínimo recomendado

La cobertura automatizada ya es **muy buena** (899 tests verdes + e2e Playwright de flujo clínico, a11y, seguridad de headers y visual). Plan mínimo adicional, alto ROI:

1. **Pruebas manuales de humo (1 pasada):** crear paciente → crear/cerrar atención → adjuntar archivo → exportar PDF → archivar/restaurar. (Esfuerzo bajo, valor alto.)
2. **Backup/restore drill real:** `npm run db:backup` && `npm run db:restore:drill` con la DB actual; confirmar que valida tablas y adjuntos. (P1.)
3. **Un test unitario de validación de teléfono** cuando se añada el `@Matches` (consistencia con el patrón de `rut.test.ts`).
4. **Un test del guard de "cambios sin guardar"** en editar paciente, si se implementa.
5. Mantener los gates de CI como condición de merge (ya existen: gitleaks + audit + lint + typecheck + tests + e2e).

No hace falta una suite nueva grande; lo esencial ya está cubierto.

---

## 11. Recomendaciones de implementación priorizadas (impacto/esfuerzo)

1. *(P1, bajo)* Correr y confirmar el **backup→restore drill**.
2. *(P1, bajo)* **Secretos frescos** por entorno antes de desplegar a prod.
3. *(P2, bajo)* **Validación/normalización de teléfono** chileno en DTOs + front.
4. *(P2, bajo)* **Guard de cambios sin guardar** en *editar paciente*.
5. *(P2, bajo)* Activar **`NEXT_PUBLIC_STRICT_CSP=true`** en prod (validar en staging).
6. *(P2, medio)* Si el repo se hará público: **scrub** del JWT de dev en historia + rotar.
7. *(P3, bajo)* `min(5)` en `rutExemptReason`.
8. *(P3, bajo)* Añadir el **paso de generación de secretos al README** quick-start (ya está en `docs/development.md`).
9. *(P3, bajo)* Revisar/añadir **estado vacío de agenda**.
10. *(Futuro)* **Backup off-site** opcional.

---

## 12. Veredicto final

**Anamneo está apto para uso personal cuidadoso por una persona en Chile, en cuanto cumplas un breve pre-vuelo operativo.** No hay bloqueadores de código: build, tipos, lint, ~899 tests y auditoría de dependencias están **todos en verde**; la seguridad (auth, scope por paciente, cifrado de PHI, throttling/lockout, subida de archivos validada, CORS acotado), la integridad clínica (RUT con DV, fechas es-CL, edad, audit hash-chain, soft-delete + purga controlada) y las funcionalidades EMR están implementadas y verificadas.

**Condiciones mínimas antes de ingresar datos reales:** (1) probar una vez el backup→restore; (2) usar secretos frescos si despliegas a un servidor (para uso 100% local los actuales sirven); (3) añadir validación de teléfono para no ensuciar contactos desde el día 1. Todo lo demás (CSP estricta, guard de edición, scrub de historia, tags de agenda) puede esperar y hacerse de forma incremental.

---

## Cambios que haría antes de meter datos reales

1. **Probar backup → restore** (`db:backup` + `db:restore:drill`) y confirmar OK. *(P1)*
2. **Generar secretos frescos** para producción si no es uso puramente local. *(P1)*
3. **Validar/normalizar teléfono** chileno en create/update de paciente. *(P2)*
4. **Guard de cambios sin guardar** en *editar paciente*. *(P2)*
5. **Activar CSP estricta** en prod (tras validar en staging). *(P2)*
6. Hacer **una pasada manual de humo** del flujo principal (crear paciente → atención → adjunto → PDF → archivar/restaurar). *(P1)*
7. Si publicarás el repo: **scrub + rotación** del JWT de dev en historia. *(P2)*
8. `min(5)` en **`rutExemptReason`**. *(P3)*
9. Añadir el **paso de secretos al README** quick-start. *(P3)*
10. Planear un **backup off-site** (aunque sea manual periódico). *(Futuro)*
