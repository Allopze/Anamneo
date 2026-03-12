# Auditoría de Codebase

## 0) Preconditions y límites de la auditoría

- Alcance: auditoría estática del repo `/home/allopze/dev/pacientes`, sin acceso a producción/staging ni a servicios externos.
- Acciones realizadas:
  - Lectura estructural de cliente, servidor, Prisma, Docker/CI y pantallas/flows clave.
  - Búsqueda de rutas, endpoints, guards, DTOs, schema y configuración.
  - Ejecución real de validaciones locales:
    - `npm --prefix backend test -- --runInBand` -> OK, `54` tests.
    - `npm --prefix backend run build` -> OK.
    - `npm --prefix frontend run build` -> OK.
    - `npm --prefix backend run test:e2e -- --runInBand` -> FAIL.
- Limitaciones:
  - No validé tráfico real, datos reales ni UX manual en navegador.
  - No encontré jobs/cron/workers por búsqueda textual; la conclusión sobre esa capa es de alta confianza para "no presentes en repo", no para runtime externo.
  - La confianza es más alta en lógica/autorización/contratos que en comportamiento bajo carga real.

## A) System Map (Cliente + Servidor + Datos + Infra)

### Arquitectura real encontrada

- Cliente:
  - Next.js App Router.
  - React Query para fetching/caché.
  - Axios con `withCredentials` y refresh silencioso.
  - Zustand persistido para sesión/UI auth.
  - Entradas principales:
    - `frontend/src/app/layout.tsx`
    - `frontend/src/components/providers/Providers.tsx`
    - `frontend/src/components/layout/DashboardLayout.tsx`
    - `frontend/src/lib/api.ts`
    - `frontend/src/stores/auth-store.ts`
- Servidor:
  - NestJS con `helmet`, `cookie-parser`, CORS, `ValidationPipe`.
  - Módulos reales:
    - `auth`
    - `users`
    - `patients`
    - `encounters`
    - `conditions`
    - `attachments`
    - `audit`
    - `templates`
    - `settings`
  - Entradas principales:
    - `backend/src/main.ts`
    - `backend/src/app.module.ts`
- Persistencia:
  - Prisma con modelos:
    - `User`
    - `Patient`
    - `PatientHistory`
    - `Encounter`
    - `EncounterSection`
    - `ConditionCatalog`
    - `ConditionCatalogLocal`
    - `ConditionSuggestionLog`
    - `AuditLog`
    - `Attachment`
    - `TextTemplate`
    - `Setting`
  - Schema: `backend/prisma/schema.prisma`
- Infra y entrega:
  - `docker-compose.yml`
  - `backend/Dockerfile`
  - `frontend/Dockerfile`
  - `.github/workflows/ci.yml`

### Ownership y frontera de acceso

- El tenancy real es por médico.
- `Patient.medicoId` es la frontera principal de acceso.
- Los asistentes heredan contexto mediante `User.medicoId`.
- La traducción asistente -> médico efectivo vive en:
  - `backend/src/common/utils/medico-id.ts`

### Flujos críticos reconstruidos desde código

#### 1. Auth y sesión

- Cliente:
  - Login en `frontend/src/app/login/page.tsx`
  - Registro en `frontend/src/app/register/page.tsx`
  - Axios y refresh en `frontend/src/lib/api.ts`
  - Estado persistido en `frontend/src/stores/auth-store.ts`
- Servidor:
  - `POST /auth/login`
  - `POST /auth/register`
  - `GET /auth/me`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - Definidos en `backend/src/auth/auth.controller.ts`
- Sesión:
  - Cookies `access_token` y `refresh_token`
  - JWT strategy con cookie + bearer fallback en `backend/src/auth/strategies/jwt.strategy.ts`

#### 2. Pacientes

- Cliente:
  - Listado: `frontend/src/app/(dashboard)/pacientes/page.tsx`
  - Detalle: `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx`
  - Historial: `frontend/src/app/(dashboard)/pacientes/[id]/historial/page.tsx`
- Servidor:
  - `backend/src/patients/patients.controller.ts`
  - `backend/src/patients/patients.service.ts`
- Modelo:
  - `Patient` + `PatientHistory`
  - Historial persistido como strings JSON por campo

#### 3. Atenciones

- Cliente:
  - Nueva atención: `frontend/src/app/(dashboard)/atenciones/nueva/page.tsx`
  - Wizard edición: `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`
  - Ficha imprimible/PDF: `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx`
- Servidor:
  - Controller: `backend/src/encounters/encounters.controller.ts`
  - Service: `backend/src/encounters/encounters.service.ts`
  - PDF: `backend/src/encounters/encounters-pdf.service.ts`
- Flujo real:
  - `POST /encounters/patient/:patientId`
  - Si existe una sola atención en progreso, la reutiliza.
  - Si existen varias, devuelve `409` con conflicto.
  - Si no existe, crea `Encounter` + `EncounterSection[]`.
  - Las secciones guardan `data` como JSON serializado.

#### 4. Catálogo y sugerencias de afecciones

- Cliente:
  - Catálogo: `frontend/src/app/(dashboard)/catalogo/page.tsx`
  - Motivo de consulta registra sugerencias desde `frontend/src/components/sections/MotivoConsultaSection.tsx`
- Servidor:
  - `backend/src/conditions/conditions.controller.ts`
  - `backend/src/conditions/conditions.service.ts`
  - Similaridad: `backend/src/conditions/conditions-similarity.service.ts`

#### 5. Auditoría

- Servidor:
  - `backend/src/audit/audit.controller.ts`
  - `backend/src/audit/audit.service.ts`
- Persistencia:
  - `AuditLog.diff` guarda JSON serializado

#### 6. Archivos adjuntos

- Cliente:
  - Modal/acciones embebidas en el wizard de atención
- Servidor:
  - `backend/src/attachments/attachments.controller.ts`
  - `backend/src/attachments/attachments.service.ts`
  - `backend/src/attachments/attachments.module.ts`

### Puntos de falla relevantes

- Contratos cliente-servidor no siempre alineados.
- Permisos de asistentes no están resueltos de forma consistente.
- Se usan snapshots completas y JSON serializado para datos clínicos y auditoría.
- La historia de configuración DB/env/tests está desalineada entre SQLite y PostgreSQL.

## B) Hallazgos críticos (P0/P1)

### ✅ AUD-001

- Title: Privilegios admin persisten tras degradación de rol
- Type: Security
- Severity: P0
- Priority: Now
- Confidence: High
- Effort: S
- Location:
  - `backend/src/users/users.service.ts` - `UsersService.update()` - líneas 139-157
  - `backend/src/common/guards/admin.guard.ts` - `AdminGuard.canActivate()` - líneas 12-16
  - `backend/src/common/guards/roles.guard.ts` - `RolesGuard.canActivate()` - líneas 25-27
- Evidence:
  - `UsersService.update()` fuerza `isAdmin = true` cuando el siguiente rol es `ADMIN`, pero nunca limpia `isAdmin` cuando el usuario deja de ser `ADMIN`.
  - Los guards autorizan por `user.isAdmin`, no por `user.role`.
- Impact:
  - Un usuario degradado desde admin puede retener acceso a endpoints y UI administrativa.
  - Riesgo directo de bypass de autorización.
- Recommended fix concept:
  - Hacer que admin derive únicamente de `role`, o sincronizar `isAdmin` en cada update.
  - Corregir registros ya persistidos con `role != ADMIN` y `isAdmin = true`.
- How to verify or reproduce:
  - Crear o usar un admin.
  - Cambiar su rol a `MEDICO` o `ASISTENTE`.
  - Volver a intentar acceso a `/users` o `/audit`.
- Suggested regression test:
  - E2E que degrade un admin y valide `403` sobre endpoints admin.
- Notes/risks:
  - Si `isAdmin` se usa como compatibilidad histórica, la migración debe contemplar datos existentes.

### ✅ AUD-002

- Title: Flujo de edición de atenciones para asistentes está roto entre cliente y servidor
- Type: Logic
- Severity: P1
- Priority: Now
- Confidence: High
- Effort: M
- Location:
  - `frontend/src/stores/auth-store.ts` - helpers `canCreateEncounter`, `canUploadAttachments` - líneas 61-77
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` - `canEdit` y rendering read-only - líneas 100-102 y 513-519
  - `backend/src/encounters/encounters.controller.ts` - `PUT :id/sections/:sectionKey` - líneas 91-105
  - `backend/src/encounters/encounters.service.ts` - `updateSection()` - líneas 291-302
- Evidence:
  - El frontend permite a asistentes crear atenciones y adjuntar archivos.
  - El controller backend acepta updates de secciones para `MEDICO` y `ASISTENTE`.
  - La UI del wizard marca edición solo para médicos.
  - El service rechaza si `encounter.patient.medicoId !== userId`, ignorando `effectiveMedicoId`.
- Impact:
  - Un asistente puede iniciar el flujo core y luego quedar bloqueado al editar.
  - El contrato UI/API es incoherente.
- Recommended fix concept:
  - Definir una única regla de negocio para asistentes.
  - Aplicarla igual en guards, services y helpers de frontend.
  - Si asistentes editan, usar `effectiveMedicoId` end-to-end.
- How to verify or reproduce:
  - Loguearse como asistente asignado.
  - Crear una atención para un paciente del médico asociado.
  - Intentar editar una sección y validar si hay solo lectura o `403`.
- Suggested regression test:
  - E2E de asistente asignado creando y editando una atención.
- Notes/risks:
  - Cambiar esta regla puede afectar trazabilidad de autoría de secciones.

### ✅ AUD-003

- Title: El autosave del wizard puede pisar cambios no guardados y perder reintentos
- Type: Data
- Severity: P1
- Priority: Now
- Confidence: High
- Effort: M
- Location:
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` - `saveSectionMutation.onSuccess()` - líneas 120-124
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` - init de `formData` desde `encounter` - líneas 213-224
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` - snapshot update anticipado - líneas 240-249
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` - navegación entre secciones - líneas 295-303
- Evidence:
  - Cada save invalida/refetch toda la atención.
  - Cada refetch resetea todo `formData`.
  - El snapshot `lastSavedRef` se actualiza antes de que la mutación confirme éxito.
- Impact:
  - Con latencia o interacción rápida, el save de una sección puede sobrescribir cambios no guardados de otra.
  - Si una mutación falla, el sistema puede "creer" que ya guardó.
- Recommended fix concept:
  - Mover el avance del snapshot a `onSuccess`.
  - Evitar refetch global si solo cambia una sección.
  - Serializar saves por sección o aplicar merge local.
- How to verify or reproduce:
  - Editar sección A.
  - Navegar rápido a sección B y editar.
  - Introducir latencia artificial y observar si el refetch de A pisa B.
- Suggested regression test:
  - Test de integración con dos ediciones consecutivas y respuesta lenta del servidor.
- Notes/risks:
  - Es un riesgo alto en un path core con texto clínico.

### ✅ AUD-004

- Title: La auditoría almacena PHI completa y expone historial por entidad sin scoping por ownership
- Type: Privacy
- Severity: P1
- Priority: Now
- Confidence: High
- Effort: M
- Location:
  - `backend/src/patients/patients.service.ts` - create/update/delete patient - líneas 67-73, 336-345, 464-470
  - `backend/src/patients/patients.service.ts` - updateHistory - líneas 437-445
  - `backend/src/audit/audit.controller.ts` - `GET /audit/:entityType/:entityId` - líneas 33-39
  - `backend/src/audit/audit.service.ts` - `findByEntity()` - líneas 76-84
  - `backend/src/audit/audit.service.ts` - `sanitizeDiff()` - líneas 110-135
- Evidence:
  - Se registran snapshots completas de `Patient` y `PatientHistory`.
  - La sanitización solo cubre passwords/tokens.
  - El endpoint por entidad está disponible para `MEDICO` y `ADMIN`, sin `AdminGuard` ni validación por owner.
- Impact:
  - Exposición de datos clínicos sensibles en auditoría.
  - Riesgo de acceso lateral si un usuario conoce o descubre IDs.
- Recommended fix concept:
  - Minimizar el diff auditado.
  - Redactar/omitir campos clínicos sensibles.
  - Restringir lectura de auditoría por owner o solo admin.
- How to verify or reproduce:
  - Autenticarse como médico A.
  - Consultar `/audit/:entityType/:entityId` de una entidad ajena.
- Suggested regression test:
  - E2E que niegue acceso a auditoría de entidades ajenas y verifique redacción de diff.
- Notes/risks:
  - Puede requerir distinguir auditoría operativa de auditoría clínica.
  - Pendiente fuera de este fix: saneamiento o purga de registros históricos ya persistidos antes del cambio.

### ✅ AUD-005

- Title: El logging de sugerencias acepta `encounterId` ajeno y persiste texto clínico sin validar ownership
- Type: Security
- Severity: P1
- Priority: Now
- Confidence: High
- Effort: S
- Location:
  - `backend/src/conditions/conditions.controller.ts` - `POST /conditions/encounters/:encounterId/suggestion` - líneas 118-125
  - `backend/src/conditions/conditions.service.ts` - `logSuggestion()` y `saveSuggestionChoice()` - líneas 404-437
  - `frontend/src/components/sections/MotivoConsultaSection.tsx` - envío del payload - líneas 75-81
- Evidence:
  - El endpoint solo exige rol `MEDICO`.
  - El service hace `create()` directo sobre `ConditionSuggestionLog` con el `encounterId` recibido.
  - No valida existencia ni ownership de la atención.
- Impact:
  - Permite contaminar logs clínicos de otra atención.
  - Expone texto sensible a un path sin autorización contextual.
- Recommended fix concept:
  - Resolver la atención antes de guardar.
  - Validar ownership por `effectiveMedicoId`.
  - Rechazar con `403` o `404`.
- How to verify or reproduce:
  - Como médico B, postear contra una atención de médico A usando su UUID.
- Suggested regression test:
  - E2E que valide denegación de `encounterId` ajeno.
- Notes/risks:
  - El problema es de integridad y privacidad, no solo de autorización.

### AUD-006

- Title: La configuración de base de datos está desalineada y hoy rompe e2e y setup local
- Type: Infra
- Severity: P1
- Priority: Next
- Confidence: High
- Effort: M
- Location:
  - `backend/prisma/schema.prisma` - datasource - líneas 8-10
  - `backend/test/app.e2e-spec.ts` - setup test DB - líneas 21-23 y 41-52
  - `.env` - `DATABASE_URL` - líneas 17-22
  - `.env.example` - `DATABASE_URL` - líneas 18-23
  - `README.md` - setup local - líneas 45-52
  - `backend/src/prisma/resolve-database-url.ts`
- Evidence:
  - Prisma usa `provider = "postgresql"`.
  - `.env` y `.env.example` apuntan a `file:./backend/prisma/dev.db`.
  - El e2e fuerza SQLite `file:` y falla con Prisma P1012.
  - La documentación mezcla PostgreSQL y SQLite.
- Impact:
  - Build y tests no representan un story coherente de desarrollo.
  - Alto riesgo de fallos de onboarding y de CI incompleta.
- Recommended fix concept:
  - Elegir una estrategia clara por ambiente.
  - Alinear schema, envs, tests, seed y documentación.
- How to verify or reproduce:
  - Ejecutar `npm --prefix backend run test:e2e -- --runInBand`.
- Suggested regression test:
  - Agregar job CI que ejecute e2e con el proveedor soportado.
- Notes/risks:
  - Si se mantiene compatibilidad dual SQLite/PostgreSQL, el costo de mantenimiento sube.

### AUD-007

- Title: El repo contiene secretos/configuración real y Compose define defaults inseguros
- Type: Security
- Severity: P1
- Priority: Now
- Confidence: High
- Effort: S
- Location:
  - `.env` - líneas 22 y 35-64
  - `docker-compose.yml` - backend service env - líneas 31-39
- Evidence:
  - Existe `.env` comprometido en repo con valores concretos de JWT/CORS/API.
  - Compose usa fallbacks inseguros si faltan variables críticas.
- Impact:
  - Riesgo de exposición de secretos.
  - Riesgo de despliegue con credenciales débiles por omisión.
- Recommended fix concept:
  - Rotar secretos comprometidos.
  - Eliminar `.env` versionado.
  - Mantener solo `.env.example`.
  - Hacer fail-fast si hay placeholders o faltan variables críticas.
- How to verify or reproduce:
  - Revisar el repo y arrancar Compose sin variables externas.
- Suggested regression test:
  - Test de validación de configuración al boot.
- Notes/risks:
  - No reproduzco los valores por seguridad.

### ✅ AUD-008

- Title: El registro público de asistentes es un callejón sin salida
- Type: Logic
- Severity: P1
- Priority: Next
- Confidence: High
- Effort: S
- Location:
  - `frontend/src/app/register/page.tsx` - elección de rol - líneas 198-239
  - `backend/src/auth/dto/register.dto.ts` - roles permitidos - líneas 7-31
  - `backend/src/users/users.service.ts` - validación de asistente con `medicoId` - líneas 28-37
  - `README.md` - primeros pasos - líneas 61-65
- Evidence:
  - El formulario público permite elegir `ASISTENTE`.
  - El backend exige `medicoId` para asistentes no admin.
  - El formulario no pide ni envía `medicoId`.
  - La documentación promete crear cuenta "Médico o Asistente".
- Impact:
  - El onboarding falla en el primer contacto para un rol visible en UI.
- Recommended fix concept:
  - Quitar `ASISTENTE` del registro público, o introducir un flujo de invitación/asignación.
- How to verify or reproduce:
  - Intentar registrar un usuario nuevo con rol `ASISTENTE`.
- Suggested regression test:
  - E2E del flujo público de registro, cubriendo los roles visibles en UI.
- Notes/risks:
  - El primer usuario admin queda fuera de este caso porque se fuerza desde backend.

## C) Inconsistencias y deuda técnica

### ✅ AUD-009

- Title: `docker-compose` usa variables de expiración distintas a las que lee la app
- Type: Infra
- Severity: P2
- Priority: Next
- Confidence: High
- Effort: S
- Location:
  - `docker-compose.yml` - líneas 34-37
  - `backend/src/auth/auth.controller.ts` - líneas 39-40
  - `backend/src/auth/auth.service.ts` - líneas 109-112
- Evidence:
  - Compose define `JWT_EXPIRATION` y `JWT_REFRESH_EXPIRATION`.
  - El backend consume `JWT_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN`.
- Impact:
  - La expiración configurada en contenedor se ignora silenciosamente.

### ✅ AUD-010

- Title: Los filtros de previsión del cliente no coinciden con el contrato del backend
- Type: Logic
- Severity: P2
- Priority: Next
- Confidence: High
- Effort: S
- Location:
  - `frontend/src/app/(dashboard)/pacientes/page.tsx` - líneas 23-35
  - `backend/src/common/types/index.ts` - líneas 8 y 31
  - `backend/src/patients/dto/create-patient.dto.ts` - líneas 49-50
- Evidence:
  - El frontend usa valores `FONASA_A/B/C/D`, `PRAIS`, `DIPRECA`, `CAPREDENA`, `SIN_PREVISION`.
  - El backend solo soporta `FONASA`, `ISAPRE`, `OTRA`, `DESCONOCIDA`.
- Impact:
  - Filtros incoherentes y resultados inesperados.

### ✅ AUD-011

- Title: La Command Palette promete buscar atenciones, pero el backend no soporta `search`
- Type: UX
- Severity: P2
- Priority: Later
- Confidence: High
- Effort: S
- Location:
  - `frontend/src/components/common/CommandPalette.tsx` - líneas 79-82
  - `backend/src/encounters/encounters.controller.ts` - líneas 44-52
  - `backend/src/encounters/encounters.service.ts` - líneas 161-211
- Evidence:
  - El cliente llama `/encounters?search=...`.
  - El controller y service no consumen ni aplican `search`.
- Impact:
  - UX engañosa y resultados parciales.

### ✅ AUD-012

- Title: El estado de sesión puede quedar en falso positivo por refresh incompleto
- Type: Logic
- Severity: P2
- Priority: Next
- Confidence: Medium
- Effort: S
- Location:
  - `backend/src/auth/auth.controller.ts` - `refresh()` - líneas 94-104
  - `frontend/src/lib/api.ts` - interceptor - líneas 20-33
  - `frontend/src/components/layout/DashboardLayout.tsx` - gating por Zustand - líneas 62-66
- Evidence:
  - Si no hay refresh token, el backend responde `200` con mensaje en vez de `401`.
  - El cliente solo hace logout si el refresh falla como error.
  - La UI confía en `isAuthenticated` persistido.
- Impact:
  - Puede quedar UI autenticada localmente sin sesión real efectiva.

### ✅ AUD-013

- Title: El seed del catálogo no es idempotente
- Type: Data
- Severity: P2
- Priority: Later
- Confidence: High
- Effort: S
- Location:
  - `backend/prisma/seed.ts` - líneas 57-68
  - `backend/prisma/schema.prisma` - `ConditionCatalog.id` - líneas 115-125
- Evidence:
  - Hace `upsert` con `where.id = slug`.
  - El modelo genera UUID por defecto.
- Impact:
  - Repetir seed no garantiza matching con registros previos.

### AUD-014

- Title: La cobertura de entrega es insuficiente para los paths críticos actuales
- Type: Testing
- Severity: P2
- Priority: Next
- Confidence: High
- Effort: M
- Location:
  - `.github/workflows/ci.yml` - líneas 28-34 y 50-55
  - Tests backend presentes:
    - `backend/src/auth/auth.service.spec.ts`
    - `backend/src/common/parse-section-key.pipe.spec.ts`
    - `backend/src/common/__tests__/dto-validation.spec.ts`
    - `backend/src/common/utils/parse-json-array.spec.ts`
    - `backend/src/conditions/conditions-similarity.service.spec.ts`
- Evidence:
  - CI corre unit tests backend y builds.
  - No corre e2e.
  - No hay suite frontend detectable.
- Impact:
  - Bugs de contrato, permisos y flows core pueden llegar a release.

## D) Performance y estabilidad

### ✅ AUD-015

- Title: El reset de contraseña expone la clave temporal y usa aleatoriedad débil
- Type: Security
- Severity: P2
- Priority: Next
- Confidence: High
- Effort: S
- Location:
  - `backend/src/users/users.service.ts` - `resetPassword()` - líneas 249-271
  - `frontend/src/app/(dashboard)/admin/usuarios/page.tsx` - líneas 149-156
- Evidence:
  - La contraseña temporal se genera con `Math.random`.
  - Se devuelve por API.
  - El frontend la muestra en un toast.
- Impact:
  - Secreto expuesto en respuesta/UI.
  - Entropía insuficiente para un flujo sensible.

### ✅ AUD-016

- Title: Uploads tienen validación y configuración inconsistente entre controller, service y env
- Type: Stability
- Severity: P2
- Priority: Next
- Confidence: High
- Effort: S
- Location:
  - `backend/src/attachments/attachments.controller.ts` - líneas 26-35
  - `backend/src/attachments/attachments.service.ts` - líneas 31-39
  - `backend/src/attachments/attachments.module.ts` - líneas 15-39
  - `.env` - líneas 69-75
  - `.env.example` - líneas 68-74
- Evidence:
  - Si `file` llega ausente, el service desreferencia `file.filename`.
  - `UPLOAD_MAX_SIZE` y `UPLOAD_DEST` difieren entre `.env`, `.env.example` y defaults del módulo.
- Impact:
  - `500` evitables y drift entre ambientes.

### AUD-017

- Title: Es posible crear múltiples atenciones en progreso por condición de carrera
- Type: Concurrency
- Severity: P2
- Priority: Next
- Confidence: Medium
- Effort: M
- Location:
  - `backend/src/encounters/encounters.service.ts` - `create()` - líneas 49-146
  - `backend/prisma/schema.prisma` - `Encounter` - líneas 81-98
- Evidence:
  - El flujo hace "buscar abiertas" y luego "crear".
  - No hay invariante DB que garantice una sola atención abierta por paciente.
- Impact:
  - Duplicados `EN_PROGRESO`.
  - Conflictos funcionales en el flujo clínico.

### ✅ AUD-018

- Title: La importación CSV del catálogo carga todo en memoria y no fija límite explícito en la ruta
- Type: Performance
- Severity: P2
- Priority: Next
- Confidence: High
- Effort: S
- Location:
  - `backend/src/conditions/conditions.controller.ts` - `POST import/csv` - líneas 41-49
  - `backend/src/conditions/conditions.service.ts` - `importGlobalCsv()` - líneas 349-401
- Evidence:
  - El archivo se procesa completo en `buffer`.
  - El contenido se transforma completo a string.
  - No hay límite específico en la ruta.
- Impact:
  - Riesgo de picos de memoria o abuso administrativo.

### Hotspots y quick wins

- Quick wins:
  - `AUD-003` autosave.
  - `AUD-016` null-guard y normalización de uploads.
  - `AUD-018` límite explícito para imports.
- Riesgos de escalabilidad:
  - Sin métricas ni tracing.
  - Logging muy básico.
  - Dificultad para diagnosticar problemas de latencia o concurrencia.

## E) Seguridad, privacidad y cumplimiento

### Riesgos concretos

- `AUD-001`: bypass de autorización por `isAdmin` persistente.
- `AUD-004`: sobre-recolección de PHI y acceso lateral a auditoría.
- `AUD-005`: escritura de logs clínicos sin ownership validation.
- `AUD-007`: secretos/config real en repo y defaults inseguros en Compose.
- `AUD-015`: reset de contraseña inseguro.

### Mitigaciones conceptuales

- Derivar privilegios administrativos desde una fuente única de verdad.
- Redactar/minimizar datos clínicos en auditoría.
- Validar ownership contextual en cada endpoint ligado a entidad clínica.
- Eliminar secretos comprometidos del repo y validar env obligatorias al boot.
- Sustituir contraseña temporal en claro por flujo de recuperación o activación one-time.

### Cumplimiento y privacidad

- El diseño actual de auditoría y suggestion logging no minimiza datos sensibles.
- Esto introduce riesgo operacional y de cumplimiento, especialmente por trazas persistidas de texto clínico.

## F) Sugerencias de mejoras y nuevas funcionalidades (alineadas)

### SUG-01

- Idea: Unificar permisos por rol en atenciones
- Por qué encaja:
  - Ya existe una capa de permisos en Zustand y otra en Nest guards/services.
- Enfoque conceptual:
  - Definir una matriz única de permisos por rol/owner y aplicarla en frontend y backend.
- Componentes impactados:
  - `auth-store`, pages de atenciones, `encounters.service`, guards.
- Riesgos:
  - Cambios de comportamiento para asistentes.
- Effort: M
- Métrica de éxito:
  - Cero `403` inesperados o pantallas read-only incoherentes para roles válidos.

### SUG-02

- Idea: Estado visual por sección en el wizard (`dirty/saving/saved/error`)
- Por qué encaja:
  - El wizard ya tiene autosave y status local.
- Enfoque conceptual:
  - Mostrar estado por sección y proteger navegación ante save pendiente/error.
- Componentes impactados:
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`
- Riesgos:
  - Complejidad UI moderada.
- Effort: M
- Métrica de éxito:
  - Menor tasa de pérdida percibida y de reingreso manual de datos.

### SUG-03

- Idea: Guardado por sección con merge local en vez de refetch total
- Por qué encaja:
  - La API ya opera por sección.
- Enfoque conceptual:
  - Responder sección actualizada y actualizar caché local granularmente.
- Componentes impactados:
  - Wizard de atenciones, React Query, service de secciones.
- Riesgos:
  - Cuidado con consistencia de progreso.
- Effort: M
- Métrica de éxito:
  - Menos requests y cero sobrescrituras de secciones ajenas.

### SUG-04

- Idea: Idempotencia real para creación de atención abierta
- Por qué encaja:
  - El producto ya asume unicidad funcional de atención en progreso.
- Enfoque conceptual:
  - Introducir invariante persistente y manejo explícito de conflictos.
- Componentes impactados:
  - Prisma, `EncountersService.create`, UI de conflictos.
- Riesgos:
  - Posible migración de datos existentes.
- Effort: M
- Métrica de éxito:
  - Cero pacientes con más de una atención `EN_PROGRESO`.

### SUG-05

- Idea: Auditoría con redacción y vistas operativas
- Por qué encaja:
  - El sistema ya registra eventos.
- Enfoque conceptual:
  - Separar auditoría clínica de auditoría administrativa y redactar PHI.
- Componentes impactados:
  - `audit`, `patients`, pantallas admin.
- Riesgos:
  - Posible ajuste de expectativas de soporte.
- Effort: M
- Métrica de éxito:
  - Logs útiles sin exposición de datos sensibles.

### SUG-06

- Idea: Invitación/asignación formal para asistentes
- Por qué encaja:
  - El modelo ya soporta `medicoId`.
- Enfoque conceptual:
  - Alta de asistente desde admin/médico o por token de invitación.
- Componentes impactados:
  - `auth`, `users`, UI de administración.
- Riesgos:
  - Requiere definir ownership del alta.
- Effort: M
- Métrica de éxito:
  - Onboarding de asistentes sin error de validación opaco.

### SUG-07

- Idea: Preview y validación previa al import CSV
- Por qué encaja:
  - El módulo `conditions` ya tiene import administrativo.
- Enfoque conceptual:
  - Validar archivo, mostrar diff y confirmar persistencia.
- Componentes impactados:
  - `conditions`, pantallas admin/catalogo.
- Riesgos:
  - Bajo.
- Effort: S
- Métrica de éxito:
  - Menos errores operativos de catálogo.

### SUG-08

- Idea: Administración de usuarios más segura
- Por qué encaja:
  - Ya existe panel admin de usuarios.
- Enfoque conceptual:
  - Reasignar asistentes, revocar permisos, confirmaciones seguras de reset.
- Componentes impactados:
  - `users`, `admin/usuarios`, auditoría.
- Riesgos:
  - Reglas de negocio de jerarquía.
- Effort: M
- Métrica de éxito:
  - Menos operaciones manuales y menos soporte.

### SUG-09

- Idea: Observabilidad base con request IDs, logs estructurados y métricas
- Por qué encaja:
  - La app ya tiene puntos de entrada centralizados.
- Enfoque conceptual:
  - Agregar correlación por request y métricas mínimas por módulo crítico.
- Componentes impactados:
  - `main.ts`, interceptors/middleware, módulos core.
- Riesgos:
  - Bajo.
- Effort: M
- Métrica de éxito:
  - Menor tiempo de diagnóstico de incidentes.

### SUG-10

- Idea: Plantillas contextuales por sección con preview
- Por qué encaja:
  - Ya existe módulo `templates`.
- Enfoque conceptual:
  - Filtrar/recomendar plantillas por sección y ver preview antes de insertar.
- Componentes impactados:
  - `templates`, wizard de atenciones.
- Riesgos:
  - Bajo.
- Effort: S
- Métrica de éxito:
  - Mayor reutilización de plantillas y menor tiempo de redacción.

## G) Plan mínimo de pruebas

- Auth/bootstrap:
  - Primer usuario queda admin.
  - Usuarios posteriores respetan el rol permitido.
- Registro:
  - Registro de médico.
  - Registro público de asistente según la regla de negocio final.
- Autorización:
  - Degradar admin revoca acceso a `/users` y `/audit`.
  - Acceso a auditoría por owner/admin según política final.
  - Sugerencias no permiten `encounterId` ajeno.
- Flujos core:
  - Crear paciente.
  - Editar admin fields.
  - Editar historial clínico.
  - Crear atención.
  - Guardar varias secciones.
  - Completar atención.
  - Exportar PDF.
- Contrato cliente-servidor:
  - Filtros `prevision`.
  - Search de pacientes.
  - Search de atenciones en command palette.
- Persistencia:
  - Seed idempotente.
  - Invariante de atención abierta por paciente.
- Errores:
  - Refresh sin cookie.
  - Refresh inválido.
  - Upload sin archivo.
  - Upload MIME inválido.
  - Upload oversize.
- Anti-abuso:
  - Rate limiting en login/register.
  - Import CSV inválido o demasiado grande.

## H) Plan de acción priorizado (Top 12)

1. Corregir revocación de admin (`AUD-001`)
   - Aceptación: un usuario degradado pierde acceso admin inmediato.
   - Riesgo: bajo.
   - Esfuerzo: S.
2. Retirar/rotar secretos y hacer fail-fast de config (`AUD-007`, `AUD-009`)
   - Aceptación: el repo no contiene secretos activos y el arranque falla con placeholders.
   - Riesgo: medio.
   - Esfuerzo: S.
3. Cerrar exposición de auditoría y minimizar PHI (`AUD-004`)
   - Aceptación: solo owner/admin autorizado y diffs redactados.
   - Riesgo: medio.
   - Esfuerzo: M.
4. Validar ownership en suggestion logging (`AUD-005`)
   - Aceptación: `403/404` para `encounterId` ajeno.
   - Riesgo: bajo.
   - Esfuerzo: S.
5. Alinear permisos de asistentes en atenciones (`AUD-002`)
   - Aceptación: flujo asistente consistente entre UI y API.
   - Riesgo: medio.
   - Esfuerzo: M.
6. Rehacer autosave para no perder datos (`AUD-003`)
   - Aceptación: no se pisan cambios con latencia o fallos parciales.
   - Riesgo: medio.
   - Esfuerzo: M.
7. Definir y arreglar onboarding de asistentes (`AUD-008`)
   - Aceptación: todo rol visible en UI tiene un camino válido.
   - Riesgo: bajo.
   - Esfuerzo: S/M.
8. Normalizar DB/env/tests y reparar e2e (`AUD-006`, `AUD-014`)
   - Aceptación: unit + e2e + build verdes en CI.
   - Riesgo: medio.
   - Esfuerzo: M.
9. Corregir refresh/logout y expiraciones efectivas (`AUD-009`, `AUD-012`)
   - Aceptación: sesión expirada vuelve a login y respeta TTL configurada.
   - Riesgo: bajo.
   - Esfuerzo: S.
10. Corregir contratos menores visibles (`AUD-010`, `AUD-011`, `AUD-013`)
    - Aceptación: filtros y búsquedas coherentes, seed repetible.
    - Riesgo: bajo.
    - Esfuerzo: S.
11. Endurecer uploads/imports y reset de contraseña (`AUD-015`, `AUD-016`, `AUD-018`)
    - Aceptación: errores 4xx controlados, sin password temporal en claro y sin imports peligrosos.
    - Riesgo: medio.
    - Esfuerzo: M.
12. Añadir observabilidad base (`SUG-09`)
    - Aceptación: request IDs, logs estructurados y métricas mínimas para auth/encounters/uploads.
    - Riesgo: bajo.
    - Esfuerzo: M.

## Apéndice: ejecuciones reales

- Backend unit tests: OK.
- Backend build: OK.
- Frontend build: OK.
- Backend e2e: FAIL por mismatch entre provider Prisma `postgresql` y `DATABASE_URL` tipo `file:`.
