# Auditoria Tecnica Integral - Anamneo

- Fecha de auditoria: 2026-03-30 a 2026-03-31 UTC
- Proyecto auditado: `Anamneo`
- Alcance: frontend, backend, base de datos, auth, settings, adjuntos, auditoria, CI/CD, DX y riesgos de privacidad/integridad para una webapp medica
- Modalidad: inspeccion estatica del repositorio + ejecucion de build/lint/typecheck/tests/audit de dependencias cuando el entorno lo permitio

## Estado de remediacion - pasadas 1 a 8 (2026-03-31)

### Resuelto en codigo

- `AN-01`: `smtp.password` ya no se devuelve desde `GET /settings`; la UI solo recibe `smtp.passwordConfigured`.
- `AN-02`: Sentry backend ya no envia PII por defecto, bajo el sampling y aplica scrubbing de headers/cookies/body.
- `AN-06`: la matriz de permisos de antecedentes quedo alineada con backend para `ADMIN` y `ASISTENTE`.
- `AN-07`: frontend recupero salud de `typecheck`, `test` y `lint`, y CI ahora ejecuta tests frontend.
- `AN-05`: ya se auditan exportaciones CSV/PDF, upload/download/delete de adjuntos, invitaciones y cambios sensibles de usuarios.
- `AN-03`: `IDENTIFICACION` ya se trata como snapshot explicito de solo lectura en la atención, con restauración desde ficha maestra y bloqueo backend de divergencias manuales.
- `AN-04`: todas las secciones editables de la atención ya se sanean y validan en backend, incluido `ANAMNESIS_REMOTA`; además el historial maestro del paciente ahora rechaza payloads malformados y el snapshot remoto se crea sin metadatos espurios.
- `AN-05`: la auditoria sensible ya incluye correlacion por `requestId`, filtro por request en la UI/admin y migracion de schema para persistirla.
- `AN-08`: dependencias de runtime actualizadas; `npm audit --omit=dev` ya queda en cero para backend y frontend.
- `AN-09`: `dateFrom/dateTo`, `dueDate` y `onsetDate` ya siguen una semantica consistente de fecha "solo dia"; backend normaliza almacenamiento y vencimientos, y frontend formatea sin corrimiento del calendario.
- `AN-10`: `GET /patients/:id` ya no trae todas las secciones completas; la timeline usa un resumen acotado a secciones utiles para cabecera, tendencias y resumen clinico.
- `AN-11`: `lint` dejo de barrer el repo completo y paso a `eslint src`.
- `AN-12`: el guard de auth de Next 16 ya migro de `middleware.ts` a `proxy.ts` y desaparecio el warning de deprecacion en build.
- `AN-13`: README y ejemplos de entorno quedaron alineados con `Anamneo`, Next 16, `/api` same-origin y los comandos/rutas reales del repo.
- Inconsistencia `5.3`: `backend/.env.example` ya usa `JWT_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN`.

### Pendiente para siguientes pasadas

- Catalogo unico de eventos de auditoria y semantica transversal de motivos/resultados.
- Read models longitudinales mas especializados y timeline paginada bajo demanda.
- Versionado formal de schemas clinicos por seccion.
- Cobertura e2e/frontend adicional para flujos clinicos complejos y auditoria avanzada.

### Verificacion de esta pasada

- `npm --prefix frontend run typecheck` -> pasa
- `npm --prefix frontend test -- --ci --runInBand` -> pasa
- `npm --prefix frontend run lint` -> pasa
- `npm --prefix frontend run build` -> pasa
- `npm --prefix frontend run audit:prod` -> pasa
- `npm --prefix backend run typecheck` -> pasa
- `npm --prefix backend run lint:check` -> pasa
- `npm --prefix backend run test:e2e -- --runInBand` -> pasa
- `npm --prefix backend run build` -> pasa
- `npm --prefix backend run audit:prod` -> pasa

## 1. Resumen ejecutivo

Anamneo tiene una base tecnica mejor que la media de un MVP clinico. El backend esta razonablemente ordenado, la separacion por modulos es clara, la suite e2e del backend es amplia, los adjuntos validan firma binaria y tipo MIME, la autenticacion usa cookies `HttpOnly` con `SameSite=strict`, existe autosave en atenciones y hay una capa de auditoria con cierto saneado de payloads.

Dicho eso, hoy no lo considero listo para un contexto clinico exigente sin una ronda clara de endurecimiento. Tras las ocho pasadas de remediacion, los riesgos mas relevantes ya no estan tanto en secretos, observabilidad o drift operativo, sino en integridad del dato y madurez estructural:

- Persistencia de secciones clinicas ya endurecida en runtime, pero aun sin schema versionado de punta a punta.
- La auditoria ya correlaciona por `requestId`, pero aun puede madurar hacia un catalogo unico de eventos y motivos/resultados.
- El detalle longitudinal del paciente ya fue aligerado, pero sigue faltando separar mejor read models y paginacion bajo demanda.

Mi lectura general es: producto funcional, con buena direccion arquitectonica, pero todavia con varios puntos que pueden degradar privacidad, trazabilidad o consistencia clinica sin fallar de forma visible.

### Fortalezas destacables

- Backend con pruebas e2e utiles y no triviales (`72` unit/spec + `105` e2e pasadas durante esta auditoria tras ocho pasadas de remediacion).
- Validacion defensiva de adjuntos por contenido binario y path confinement.
- Controles razonables en auth: bloqueo por intentos fallidos, sesiones con versionado, refresh token versionado, cookies `HttpOnly`.
- Exclusión explicita de `notasInternas` de la ficha exportada a PDF.
- Operacion de SQLite mas madura de lo habitual: health endpoints, backup cron, restore drill y monitorizacion operativa.

## 2. Mapa de arquitectura

### 2.1 Propuesta de valor real deducida desde el codigo

Anamneo no es solo un CRUD de pacientes. La propuesta real que emerge del repo es:

- Gestion longitudinal de pacientes.
- Registro de atenciones clinicas mediante un wizard de 10 secciones.
- Trabajo colaborativo medico/asistente con permisos por rol.
- Seguimientos clinicos y problemas persistentes por paciente.
- Adjuntos vinculables a examenes o derivaciones estructuradas.
- Generacion de ficha clinica y documentos exportables.
- Sugerencias de afecciones y resumen longitudinal de apoyo.

Eso se refleja en el frontend y en el dominio modelado en backend:

- `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx`
- `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`
- `frontend/src/lib/clinical.ts`
- `backend/src/encounters/encounters.service.ts`
- `backend/src/patients/patients.service.ts`
- `backend/prisma/schema.prisma`

### 2.2 Stack actual

#### Frontend

- Next.js App Router
- React 18
- React Query para datos remotos
- Zustand para auth/estado persistido de sesion
- React Hook Form + Zod para formularios
- Axios como API layer

Referencias:

- `frontend/package.json`
- `frontend/src/lib/api.ts`
- `frontend/src/stores/auth-store.ts`

#### Backend

- NestJS 11
- Prisma ORM
- SQLite como datastore actual
- JWT en cookies `HttpOnly`
- Helmet
- Throttler
- Multer para adjuntos
- PDFKit para PDF
- Nodemailer para invitaciones
- Sentry para observabilidad

Referencias:

- `backend/package.json`
- `backend/src/app.module.ts`
- `backend/src/main.ts`
- `backend/prisma/schema.prisma`

### 2.3 Organizacion principal del sistema

#### Frontend

- `frontend/src/app`: rutas y pantallas
- `frontend/src/components`: componentes UI y secciones clinicas
- `frontend/src/lib`: API, permisos, utilidades y logica clinica derivada
- `frontend/src/stores`: estado auth

#### Backend

- `backend/src/auth`
- `backend/src/users`
- `backend/src/patients`
- `backend/src/encounters`
- `backend/src/conditions`
- `backend/src/attachments`
- `backend/src/audit`
- `backend/src/templates`
- `backend/src/settings`
- `backend/src/mail`

### 2.4 Estado global, API layer y auth

- El frontend persiste auth en Zustand (`auth-storage`) y bootstrapea sesion con `GET /auth/me` desde el `DashboardLayout`.
- Axios hace refresh silencioso al recibir `401`.
- El backend emite `access_token` y `refresh_token` via cookies `HttpOnly`.
- `JwtStrategy` valida usuario activo en cada request autenticada.

Referencias:

- `frontend/src/components/layout/DashboardLayout.tsx`
- `frontend/src/lib/api.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/strategies/jwt.strategy.ts`

### 2.5 Base de datos y modelo de dominio real

Entidades reales observadas en Prisma:

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
- `PatientProblem`
- `EncounterTask`
- `UserSession`
- `LoginAttempt`
- `UserInvitation`
- `TextTemplate`
- `Setting`

Referencia:

- `backend/prisma/schema.prisma`

### 2.6 Integraciones, observabilidad y despliegue

- Sentry backend y Next.js con `withSentryConfig`.
- Docker Compose con `backend`, `frontend` y `backup-cron`.
- Endpoints de health y health operacional SQLite.

Referencias:

- `backend/src/instrument.ts`
- `frontend/next.config.js`
- `docker-compose.yml`
- `backend/src/health.controller.ts`

## 3. Flujos criticos revisados end-to-end

Se revisaron especialmente estos flujos:

### 3.1 Bootstrap, registro, login e invitaciones

- El primer usuario debe ser `ADMIN`.
- Luego se deshabilita registro publico y se exige invitacion.
- Login usa cookies y bloqueo temporal por intentos fallidos.

Referencias:

- `backend/src/auth/auth.service.ts`
- `backend/src/users/users.service.ts`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`

### 3.2 Creacion de pacientes

- Flujo completo para medico.
- Flujo rapido para asistente.
- Validacion de RUT y exencion de RUT.

Referencias:

- `backend/src/patients/patients.service.ts`
- `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx`

### 3.3 Creacion y edicion de atenciones

- Inicio de atencion con deteccion de atenciones en progreso.
- Carga inicial de secciones.
- Autosave cada 10 segundos.
- Completar, cancelar, reabrir y exportar ficha/PDF.

Referencias:

- `backend/src/encounters/encounters.service.ts`
- `backend/src/encounters/encounters.controller.ts`
- `frontend/src/app/(dashboard)/atenciones/nueva/page.tsx`
- `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`
- `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx`

### 3.4 Historial remoto, problemas y seguimientos

- Edicion del historial medico longitudinal.
- Problemas activos/persistentes.
- Seguimientos con fechas y estados.

Referencias:

- `backend/src/patients/patients.service.ts`
- `frontend/src/app/(dashboard)/pacientes/[id]/historial/page.tsx`
- `frontend/src/app/(dashboard)/seguimientos/page.tsx`

### 3.5 Adjuntos

- Upload, listado, descarga y borrado.
- Vinculacion con examenes/derivaciones estructuradas.

Referencias:

- `backend/src/attachments/attachments.service.ts`
- `backend/src/attachments/attachments.controller.ts`
- `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`

### 3.6 Admin, settings y auditoria

- Gestion de usuarios e invitaciones.
- Configuracion SMTP e invitaciones HTML.
- Consulta de auditoria operativa.

Referencias:

- `backend/src/users/users.controller.ts`
- `backend/src/settings/settings.controller.ts`
- `backend/src/mail/mail.controller.ts`
- `frontend/src/app/(dashboard)/ajustes/page.tsx`
- `frontend/src/app/(dashboard)/admin/auditoria/page.tsx`

## 4. Hallazgos priorizados

Los hallazgos estan ordenados por severidad y prioridad de accion.

### AN-01. Secretos SMTP expuestos al navegador del administrador

- ID: `AN-01`
- Estado de remediacion: `resuelto en pasada 1 (2026-03-31)`
- Titulo: Secretos SMTP quedan almacenados en claro y el backend los devuelve completos al frontend
- Severidad: `S1 alto`
- Area: `seguridad / backend / frontend / datos`
- Confianza: `alta`
- Evidencia exacta:
  - `backend/src/settings/settings.service.ts:8-15`
  - `backend/src/settings/settings.controller.ts:38-62`
  - `backend/prisma/schema.prisma:325-331`
  - `frontend/src/app/(dashboard)/ajustes/page.tsx:89-114`
  - `frontend/src/app/(dashboard)/ajustes/page.tsx:210-225`
- Impacto real de negocio o clinico:
  - Un XSS o una sesion admin comprometida puede exfiltrar credenciales SMTP.
  - Expone credenciales de infraestructura desde una UI que no necesita leerlas en claro.
- Como reproducirlo o razonamiento tecnico:
  - `GET /settings` devuelve todos los valores.
  - El frontend hidrata `settings['smtp.password']` en estado React.
  - El test mail reenvia esa password desde el navegador al backend.
- Causa raiz:
  - Modelo de settings generico, sin distincion entre secretos y configuracion visible.
- Recomendacion concreta:
  - Hacer `smtp.password` write-only.
  - Enmascarar secretos en lecturas.
  - Evitar que la UI vuelva a recibirlos.
  - Si se mantienen en base de datos, cifrarlos con una clave de aplicacion/KMS y exponer solo un estado "configurado/no configurado".
- Esfuerzo estimado: `medio`

### AN-02. Sentry backend envia PII por defecto y con muestreo maximo

- ID: `AN-02`
- Estado de remediacion: `resuelto en pasada 1 (2026-03-31)`
- Titulo: Observabilidad configurada con `sendDefaultPii: true` en una app medica
- Severidad: `S1 alto`
- Area: `seguridad / privacidad / observabilidad`
- Confianza: `alta`
- Evidencia exacta:
  - `backend/src/instrument.ts:4-13`
- Impacto real de negocio o clinico:
  - Riesgo de fuga de datos sensibles de pacientes o profesionales hacia un tercero.
  - Incremento de superficie de privacidad en errores y trazas.
- Como reproducirlo o razonamiento tecnico:
  - La config inicializa Sentry con `sendDefaultPii: true`, `tracesSampleRate: 1.0` y `profileSessionSampleRate: 1.0`.
  - En rutas clinicas esto puede incluir metadatos personales y de requests.
- Causa raiz:
  - Configuracion de observabilidad demasiado permisiva para el dominio.
- Recomendacion concreta:
  - Desactivar `sendDefaultPii`.
  - Reducir sampling.
  - Aplicar scrubbing de headers, bodies, cookies, email, RUT y payloads clinicos.
  - Definir politicas distintas para `development`, `staging` y `production`.
- Esfuerzo estimado: `bajo`

### AN-03. La identificacion de la atencion puede divergir de la ficha maestra del paciente

- ID: `AN-03`
- Estado de remediacion: `resuelto en pasada 3 (2026-03-31)`
- Titulo: La seccion `IDENTIFICACION` funcionaba como segundo editor no sincronizado del dato maestro del paciente
- Severidad: `S1 alto`
- Area: `full-stack / datos / UX clinica`
- Confianza: `alta`
- Evidencia exacta:
  - `backend/src/encounters/encounters.service.ts:163-191`
  - `backend/src/encounters/encounters.service.ts:395-455`
  - `backend/src/patients/patients.service.ts:544-599`
  - `frontend/src/components/sections/IdentificacionSection.tsx:40-138`
  - `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx:202-214`
  - `backend/src/encounters/encounters-pdf.service.ts:179-188`
- Impacto real de negocio o clinico:
  - La ficha impresa/PDF puede mostrar datos distintos a la ficha maestra.
  - Riesgo de error de identificacion o de continuidad asistencial.
- Como reproducirlo o razonamiento tecnico:
  - Al crear una atencion, `IDENTIFICACION` se rellena desde `Patient`.
  - Luego `updateSection()` solo persiste en `EncounterSection`.
  - No existe sincronizacion inversa a `Patient`.
  - La ficha y el PDF consumen el snapshot de la atencion.
- Causa raiz:
  - Mezcla de conceptos entre "snapshot clinico de una atencion" y "dato maestro del paciente".
- Recomendacion concreta:
  - Elegir una de estas dos estrategias:
  - `1.` Hacer snapshot explicito, visible y eventualmente read-only.
  - `2.` Sincronizar cambios al maestro con transaccion, auditoria y control de conflictos.
- Esfuerzo estimado: `medio-alto`

### AN-04. Las secciones clinicas aceptaban payloads sin contrato real por tipo

- ID: `AN-04`
- Estado de remediacion: `resuelto en pasada 6 para validacion de entrada; queda deuda estructural de schema versionado`
- Titulo: Backend acepta cualquier objeto en `EncounterSection.data`
- Severidad: `S1 alto`
- Area: `backend / datos / integridad`
- Confianza: `alta`
- Evidencia exacta:
  - `backend/src/encounters/dto/update-section.dto.ts:1-10`
  - `backend/src/encounters/encounters.controller.ts:123-128`
  - `backend/src/encounters/encounters.service.ts:434-439`
  - `frontend/src/components/sections/IdentificacionSection.tsx:74-81`
  - `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx:206-214`
  - `backend/src/encounters/encounters-pdf.service.ts:183-185`
- Impacto real de negocio o clinico:
  - Se pueden persistir estados invalidos sin error del backend.
  - Es posible degradar silenciosamente el registro clinico exportado.
- Como reproducirlo o razonamiento tecnico:
  - `UpdateSectionDto` solo exige que `data` sea objeto.
  - Originalmente `IdentificacionSection` hacia `parseInt(e.target.value)` para `edad`; si el input quedaba vacio, la serializacion terminaba degradando el valor.
  - Antes de las pasadas 2 a 6 el backend no imponia reglas de rango, enums ni shape por `sectionKey`; ahora se validan `IDENTIFICACION`, `MOTIVO_CONSULTA`, `ANAMNESIS_PROXIMA`, `ANAMNESIS_REMOTA`, `REVISION_SISTEMAS`, `EXAMEN_FISICO`, `SOSPECHA_DIAGNOSTICA`, `TRATAMIENTO`, `RESPUESTA_TRATAMIENTO` y `OBSERVACIONES`.
  - En pasada 6 tambien se endurecio `PUT /patients/:id/history`, se normalizo el snapshot `ANAMNESIS_REMOTA` al crear atenciones y se corrigio la semantica UI para separar "editar solo esta atención" de "editar historial maestro".
- Causa raiz:
  - Modelo tipo blob JSON sin contrato fuerte por `sectionKey`.
- Recomendacion concreta:
  - Mantener las validaciones por seccion ya añadidas.
  - Siguiente escalon: versionar schemas de seccion para migraciones y compatibilidad futura.
  - Considerar evolucion futura a JSON tipado o columnas estructuradas si el storage cambia.
- Esfuerzo estimado: `alto`

### AN-05. La auditoria no cubre varias operaciones sensibles

- ID: `AN-05`
- Estado de remediacion: `resuelto en pasada 2 y consolidado en pasada 8 (2026-03-31)`
- Titulo: Existen vacios de trazabilidad sobre exportaciones, adjuntos y administracion de usuarios
- Severidad: `S1 alto`
- Area: `seguridad / datos / backend`
- Confianza: `alta`
- Evidencia exacta:
  - `backend/src/audit/audit.service.ts:17-30`
  - `backend/src/attachments/attachments.service.ts:193-255`
  - `backend/src/attachments/attachments.service.ts:318-341`
  - `backend/src/patients/patients.controller.ts:53-59`
  - `backend/src/encounters/encounters.controller.ts:62-97`
  - `backend/src/users/users.service.ts:467-639`
- Impacto real de negocio o clinico:
  - No queda rastro consistente de quien exporto, descargo, borro adjuntos o hizo cambios administrativos criticos.
  - Esto limita trazabilidad operativa y respuesta ante incidentes.
- Como reproducirlo o razonamiento tecnico:
  - Hay logging de `Patient`, `PatientHistory` y `EncounterSection`.
  - No se observa `auditService.log()` en upload/delete de adjuntos, exportaciones CSV/PDF ni update/remove/reset en usuarios.
  - En la pasada 8 se añadió persistencia de `requestId` en `AuditLog`, middleware comun de trazado HTTP y filtro por request en `GET /audit`.
- Causa raiz:
  - Auditoria implementada por caso, no como politica transversal.
- Recomendacion concreta:
  - Añadir auditoria de acceso y exportacion.
  - Registrar altas/bajas/cambios de usuarios, invitaciones, reset password, download/upload/delete de adjuntos y export de CSV/PDF.
  - Adjuntar `requestId`, actor, entidad, motivo y resultado.
- Esfuerzo estimado: `medio`

### AN-06. Permisos de antecedentes desalineados entre frontend y backend

- ID: `AN-06`
- Estado de remediacion: `resuelto en pasada 1 (2026-03-31)`
- Titulo: El frontend permite o bloquea casos que el backend resuelve distinto
- Severidad: `S2 medio`
- Area: `full-stack / UX / permisos`
- Confianza: `alta`
- Evidencia exacta:
  - `frontend/src/lib/permissions.ts:46-48`
  - `frontend/src/__tests__/lib/permissions.test.ts:87-92`
  - `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx:321-332`
  - `frontend/src/app/(dashboard)/pacientes/[id]/historial/page.tsx:37-41`
  - `backend/src/patients/patients.controller.ts:132-139`
  - `backend/src/common/utils/medico-id.ts:17-25`
- Impacto real de negocio o clinico:
  - Admin puede estar habilitado en backend pero oculto en UI.
  - Asistente sin medico asignado puede ver acciones que luego fallan.
  - Produce friccion y errores de operacion.
- Como reproducirlo o razonamiento tecnico:
  - `canEditAntecedentes()` devuelve `true` para cualquier `ASISTENTE` y `false` para `ADMIN`.
  - Backend usa `getEffectiveMedicoId()`: admin si puede; asistente sin medico asignado no puede.
- Causa raiz:
  - Matriz de permisos duplicada y no compartida.
- Recomendacion concreta:
  - Centralizar permisos compartidos o generar helpers frontend desde un contrato unico.
  - Ajustar tests frontend que hoy fijan la logica equivocada.
- Esfuerzo estimado: `bajo`

### AN-07. La puerta de calidad frontend esta rota

- ID: `AN-07`
- Estado de remediacion: `resuelto en pasada 1 (2026-03-31)`
- Titulo: Typecheck, tests y lint frontend no estan en estado sano
- Severidad: `S2 medio`
- Area: `tests / frontend / DevOps`
- Confianza: `alta`
- Evidencia exacta:
  - `frontend/src/__tests__/lib/clinical.test.ts:77-118`
  - `frontend/src/types/index.ts:290-305`
  - `frontend/src/__tests__/app/login.test.tsx:5-10`
  - `frontend/src/app/login/page.tsx:24-61`
  - `frontend/src/app/(dashboard)/ajustes/page.tsx:141-173`
  - `.github/workflows/ci.yml:66-98`
- Impacto real de negocio o clinico:
  - Regresiones de autenticacion o de contratos clinicos pueden pasar a produccion.
  - La confianza en el frontend es artificialmente mayor que la real.
- Como reproducirlo o razonamiento tecnico:
  - `npm --prefix frontend run typecheck` falla por tests desactualizados con `StructuredMedication` y `StructuredOrder`.
  - `npm --prefix frontend test -- --ci --runInBand` falla por mock incompleto de `useSearchParams`.
  - `npx eslint src --max-warnings=0` falla por `Date.now()` impuro durante render en ajustes.
  - CI frontend no ejecuta tests, solo lint/typecheck/build/audit.
- Causa raiz:
  - Evolucion del frontend sin mantener sincronizados tests y pipeline.
- Recomendacion concreta:
  - Corregir tests y mocks.
  - Añadir job de tests frontend a CI.
  - Resolver reglas de pureza React en ajustes.
- Esfuerzo estimado: `bajo-medio`

### AN-08. Dependencias con advisories abiertos en runtime

- ID: `AN-08`
- Estado de remediacion: `resuelto en pasada 8 (2026-03-31)`
- Titulo: Dependencias de produccion con vulnerabilidades conocidas
- Severidad: `S2 medio`
- Area: `seguridad / dependencias / DevOps`
- Confianza: `alta`
- Evidencia exacta:
  - `frontend/package.json`
  - `backend/package.json`
  - `frontend/package-lock.json`
  - `backend/package-lock.json`
- Impacto real de negocio o clinico:
  - Aumenta la superficie de ataque en un sistema que maneja datos sensibles.
- Como reproducirlo o razonamiento tecnico:
  - Inicialmente `npm run audit:prod` reportaba hallazgos en `next`, `nodemailer` y transitivos.
  - Tras actualizar `next` a `16.2.1`, `nodemailer` a `8.0.4`, Nest/Sentry a versiones parcheadas y fijar overrides seguros, `npm --prefix backend run audit:prod` y `npm --prefix frontend run audit:prod` pasan con `0 vulnerabilities`.
- Causa raiz:
  - Deuda de actualizacion en dependencias clave.
- Recomendacion concreta:
  - Actualizar `next`, `nodemailer` y revisar mitigaciones/patches de los transitivos de Nest.
  - Añadir politica de upgrade regular y revisiones automatizadas.
- Esfuerzo estimado: `bajo-medio`

### AN-09. Manejo de fechas "solo dia" con parsing UTC ambiguo

- ID: `AN-09`
- Estado de remediacion: `resuelto en pasada 7 (2026-03-31)`
- Titulo: Filtros y vencimientos usan `new Date('YYYY-MM-DD')` con semantica propensa a errores
- Severidad: `S2 medio`
- Area: `backend / frontend / datos`
- Confianza: `media-alta`
- Evidencia exacta:
  - `backend/src/audit/audit.service.ts:49-53`
  - `frontend/src/app/(dashboard)/admin/auditoria/page.tsx:172-193`
  - `backend/src/patients/patients.service.ts:881`
  - `backend/src/patients/patients.service.ts:937`
  - `frontend/src/app/(dashboard)/seguimientos/page.tsx:122-126`
- Impacto real de negocio o clinico:
  - El filtro `Hasta` puede excluir gran parte del dia esperado.
  - Hipotesis: los vencimientos de tareas pueden desplazarse segun zona horaria del entorno.
- Como reproducirlo o razonamiento tecnico:
  - `new Date('2026-03-30').toISOString()` produce `2026-03-30T00:00:00.000Z`.
  - Originalmente el filtro `dateTo` se interpretaba como inicio del dia, no como fin del dia.
  - `dueDate` y `onsetDate` se persistian con `new Date('YYYY-MM-DD')`, mezclando fecha clinica con timestamp.
- Causa raiz:
  - Ausencia de una politica de `LocalDate` y de normalizacion explicita de rangos.
- Recomendacion concreta:
  - Mantener la regla actual: normalizar fechas "solo dia" a una representacion canonica y comparar vencimientos por fecha, no por hora.
  - Reutilizar helpers compartidos cuando aparezcan nuevos campos `LocalDate`.
  - Mantener cobertura automatizada sobre filtros y vencimientos.
- Esfuerzo estimado: `medio`

### AN-10. La ficha de paciente carga demasiado longitudinal en una sola llamada

- ID: `AN-10`
- Estado de remediacion: `mitigado en pasada 8 (2026-03-31)`
- Titulo: `GET /patients/:id` devuelve todas las atenciones con secciones completas
- Severidad: `S2 medio`
- Area: `backend / frontend / performance`
- Confianza: `alta`
- Evidencia exacta:
  - `backend/src/patients/patients.service.ts:339-371`
  - `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx:63-68`
  - `frontend/src/lib/clinical.ts:17-104`
- Impacto real de negocio o clinico:
  - Pacientes longitudinales pueden degradar tiempos de carga y render.
  - Se traen mas datos clinicos de los necesarios para la primera vista.
- Como reproducirlo o razonamiento tecnico:
  - Originalmente `findById()` incluia `encounters.sections` completos.
  - En la pasada 8 se acoto a un resumen de secciones clinicamente utiles (`MOTIVO_CONSULTA`, `SOSPECHA_DIAGNOSTICA`, `TRATAMIENTO`, `RESPUESTA_TRATAMIENTO`, `EXAMEN_FISICO`) y se añadió cobertura e2e para evitar regresion.
- Causa raiz:
  - Falta de read models o endpoints especializados para resumen longitudinal.
- Recomendacion concreta:
  - Separar endpoint de detalle base, timeline paginada y resumen clinico derivado.
  - Devolver secciones completas solo bajo demanda.
- Esfuerzo estimado: `medio`

### AN-11. El lint frontend sobre el repo completo es fragil y tiende a colgarse

- ID: `AN-11`
- Estado de remediacion: `resuelto en pasada 1 (2026-03-31)`
- Titulo: `eslint .` barre directorios generados no suficientemente excluidos
- Severidad: `S2 medio`
- Area: `DevOps / DX`
- Confianza: `alta`
- Evidencia exacta:
  - `frontend/eslint.config.mjs:3-16`
  - `frontend/package.json:9`
  - `frontend/.next` y `frontend/.next.bak` presentes en workspace
- Impacto real de negocio o clinico:
  - Empeora confiabilidad local y de CI.
  - Hace mas probable que el equipo deje de ejecutar lint o lo considere ruido.
- Como reproducirlo o razonamiento tecnico:
  - `lint` usa `eslint .`.
  - La config ignora `.next/**`, pero no `.next.bak/**`.
  - En este workspace habia miles de archivos generados en ambos directorios.
- Causa raiz:
  - Scope de lint demasiado amplio y ignores incompletos.
- Recomendacion concreta:
  - Cambiar a `eslint src`.
  - Ignorar `.next.bak/**`.
  - Eliminar artefactos generados no necesarios del workspace.
- Esfuerzo estimado: `bajo`

### AN-12. Deuda de compatibilidad con Next 16 en auth middleware

- ID: `AN-12`
- Estado de remediacion: `resuelto en pasada 8 (2026-03-31)`
- Titulo: Se mantiene `middleware.ts` aunque Next 16 ya avisa de la convencion `proxy`
- Severidad: `S3 bajo`
- Area: `frontend / mantenimiento`
- Confianza: `alta`
- Evidencia exacta:
  - `frontend/src/proxy.ts`
  - `frontend/package.json`
  - `npm --prefix frontend run build`
- Impacto real de negocio o clinico:
  - Riesgo de rotura en upgrades futuros de framework.
- Como reproducirlo o razonamiento tecnico:
  - El build emitia warning explicito por `middleware.ts`.
  - Tras migrar la logica a `src/proxy.ts` y retirar el backup residual, el build vuelve a pasar sin ese warning y Next reporta `ƒ Proxy (Middleware)`.
- Causa raiz:
  - Migracion a Next 16 incompleta.
- Recomendacion concreta:
  - Migrar a `proxy.ts`.
  - Eliminar backups `.bak` que inducen ruido y confusion.
- Esfuerzo estimado: `bajo`

### AN-13. Drift documental y de onboarding

- ID: `AN-13`
- Estado de remediacion: `resuelto en pasada 8 (2026-03-31)`
- Titulo: README contiene referencias viejas de paths, stack y comandos
- Severidad: `S3 bajo`
- Area: `docs / DX`
- Confianza: `alta`
- Evidencia exacta:
  - `README.md`
  - `.env.example`
  - `backend/.env.example`
- Impacto real de negocio o clinico:
  - Empeora el onboarding y aumenta errores operativos.
- Como reproducirlo o razonamiento tecnico:
  - Sigue hablando de `pacientes/`.
  - Menciona `Next.js 14` cuando el package actual usa Next 16.
  - Los links de release apuntan a otra ruta de workspace.
  - En la pasada 8 se alinearon comandos, rutas, dominio del repo, `NEXT_PUBLIC_API_URL=/api`, `CORS_ORIGIN` local real y referencias a `proxy.ts`.
- Causa raiz:
  - Documentacion no mantenida al ritmo del codigo.
- Recomendacion concreta:
  - Alinear README con el repo actual, stack real y rutas correctas.
- Esfuerzo estimado: `bajo`

## 5. Inconsistencias frontend-backend

### 5.1 Permisos

- `canEditAntecedentes()` en frontend no coincide con la regla real backend.
- Los tests frontend fijan esa inconsistencia como comportamiento esperado.

### 5.2 Busqueda de pacientes

- UI promete busqueda por correo:
  - `frontend/src/app/(dashboard)/pacientes/page.tsx:154`
- Backend solo filtra por nombre y RUT:
  - `backend/src/patients/patients.service.ts:231-239`

### 5.3 Variables de entorno JWT

- `backend/.env.example` usa:
  - `JWT_EXPIRES_IN`
  - `JWT_REFRESH_EXPIRES_IN`
- El runtime usa:
  - `JWT_EXPIRES_IN`
  - `JWT_REFRESH_EXPIRES_IN`

Estado actual:

- Resuelto en `backend/.env.example` durante la pasada 1.

Referencias:

- `backend/.env.example:7-8`
- `.env.example:36-44`
- `backend/src/auth/auth.controller.ts:39-40`
- `backend/src/auth/auth.module.ts:20`

### 5.4 Contratos de seccion

- Frontend modela tipos ricos por seccion.
- Backend no los garantiza y persiste cualquier objeto.

Referencias:

- `frontend/src/types/index.ts`
- `backend/src/encounters/dto/update-section.dto.ts`

### 5.5 Fechas

- Frontend usa `type="date"` y strings locales.
- Backend las parsea con `new Date(...)` sin contrato explicito de timezone.

## 6. Riesgos medicos, de privacidad y de integridad

Estos hallazgos merecen tratamiento prioritario por el tipo de producto:

### 6.1 Riesgo de identificacion clinica inconsistente

- Asociado a `AN-03`.
- Mitigado en pasada 3 al declarar y hacer cumplir `IDENTIFICACION` como snapshot administrativo de solo lectura, con advertencia de divergencia y accion explicita de restauracion desde la ficha maestra.

### 6.2 Riesgo de corrupcion silenciosa del dato clinico

- Asociado a `AN-04`.
- Mitigado en pasadas 4 a 6 con validacion y saneado por `sectionKey`, endurecimiento del historial maestro y normalizacion del snapshot `ANAMNESIS_REMOTA`.
- Sigue viva la deuda de schema versionado, pero la via directa de persistir blobs clinicos arbitrarios quedo cerrada para los flujos actuales.

### 6.3 Riesgo de trazabilidad insuficiente en actos sensibles

- Asociado a `AN-05`.
- Mitigado en pasadas 2 y 8 con auditoria sobre exportaciones, descargas, adjuntos e hitos administrativos, mas correlacion transversal por `requestId`.
- Queda como mejora futura consolidar un catalogo unico de eventos, motivos y resultados.

### 6.4 Riesgo de fuga de datos sensibles a terceros de observabilidad

- Asociado a `AN-02`.
- No se puede afirmar incumplimiento regulatorio desde el repo solo, pero si existe un vacio importante de minimizacion de datos.

### 6.5 Riesgo de exposicion innecesaria de secretos operativos

- Asociado a `AN-01`.
- No es un riesgo clinico directo, pero si puede terminar en compromiso de infraestructura y canales de comunicacion.

## 7. Calidad, testing y operabilidad

### 7.1 Comandos ejecutados durante la auditoria

#### Backend

- `npm --prefix backend run lint:check` -> pasa
- `npm --prefix backend run typecheck` -> pasa
- `npm --prefix backend test -- --ci --runInBand` -> pasa
- `npm --prefix backend run test:e2e -- --runInBand` -> pasa
- `npm --prefix backend run build` -> pasa
- `npm --prefix backend run audit:prod` -> pasa

#### Frontend

- `npm --prefix frontend run build` -> pasa
- `npm --prefix frontend run typecheck` -> pasa
- `npm --prefix frontend test -- --ci --runInBand` -> pasa
- `npm --prefix frontend run lint` -> pasa
- `npm --prefix frontend run audit:prod` -> pasa

### 7.2 Lectura general de calidad

- Backend:
  - Mejor cubierto.
  - Suite e2e con bastante valor real.
  - Health y operacion SQLite estan mas trabajados de lo habitual.
- Frontend:
  - Build sano.
  - Tras la pasada 1, typecheck, tests y lint quedaron recuperados.
  - La deuda principal ya no es la pipeline ni dependencias de runtime, sino read models longitudinales y refactors clinicos/operativos de fondo.

### 7.3 Decisiones operativas razonables que conviene conservar

- `backend/src/main.ts` valida secretos y evita SQLite en produccion salvo override.
- `backend/src/health.controller.ts` expone health funcional y health operacional SQLite.
- `docker-compose.yml` incorpora `backup-cron`.
- `.gitignore` excluye `backend/prisma/backups/` y `uploads/`.

## 8. Quick wins

Estas son las mejoras de mayor impacto y menor esfuerzo:

1. `Resuelto` Hacer `smtp.password` write-only y no devolverlo desde `GET /settings`.
2. `Resuelto` Desactivar `sendDefaultPii` y bajar sampling en Sentry.
3. `Resuelto` Corregir `canEditAntecedentes()` y sus tests.
4. `Resuelto` Arreglar `frontend`:
   - typecheck roto
   - mocks rotos en login
   - `Date.now()` en render
5. `Resuelto` Cambiar `eslint .` por `eslint src` para dejar de barrer artefactos del repo completo.
6. `Resuelto` Normalizar variables JWT en `backend/.env.example`.
7. `Resuelto` Auditar exportaciones/descargas/subidas/borrados y cambios administrativos.
8. `Resuelto` Ajustar `dateTo` a fin de dia en auditoria y cerrar la politica de fechas "solo dia" para `dueDate` y `onsetDate`.
9. `Resuelto` Migrar `middleware.ts` a `proxy.ts` y actualizar README/envs.
10. `Resuelto` Correlacionar `AuditLog` con `requestId` y exponer el filtro en la UI admin.

## 9. Refactors estructurales recomendados

### 9.1 Modelo de secciones clinicas con schema versionado

Problema:

- `EncounterSection.data` es demasiado libre.

Estrategia incremental:

1. Introducir validadores por `sectionKey` sin romper el storage actual.
2. Rechazar nuevos payloads invalidos.
3. Añadir version de schema en cada seccion.
4. Evaluar migracion futura a columnas estructuradas o JSON tipado si se cambia de motor.

### 9.2 Separar snapshot clinico de dato maestro del paciente

Problema:

- Hoy la identificacion de una atencion mezcla snapshot y master data.

Estrategia incremental:

1. Declarar explicitamente `IDENTIFICACION` como snapshot.
2. Mostrar advertencias de divergencia cuando difiera de `Patient`.
3. Decidir si ciertas correcciones administrativas deben propagarse al maestro via accion explicita.

### 9.3 Read models para longitudinal

Problema:

- `GET /patients/:id` devuelve demasiado.

Estrategia incremental:

1. Endpoint ligero para cabecera del paciente.
2. Endpoint paginado para timeline.
3. Endpoint derivado para tendencias/resumen.

### 9.4 Politica transversal de auditoria

Problema:

- La auditoria esta implementada por modulo, no por politica.

Estrategia incremental:

1. Definir catalogo minimo de eventos obligatorios.
2. Instrumentar una capa reusable para eventos de acceso, exportacion y mutacion sensible.
3. Correlacionar con `requestId`.
   Ya quedo resuelto en pasada 8; la deuda residual es un catalogo unico de eventos.

## 10. Tests que faltan

### Prioridad alta

- tests UI/e2e de restauracion del snapshot de `IDENTIFICACION` desde la ficha maestra.
- tests de auditoria que cubran `update/remove` de usuarios, export PDF completo y catalogo unico de eventos.
- tests frontend/e2e del flujo de `ANAMNESIS_REMOTA` para cubrir "editar solo esta atención" vs "ir al historial maestro".

### Prioridad media

- tests de contrato de permisos FE/BE.
- tests de rendimiento o al menos snapshots de payload de `GET /patients/:id` con muchas atenciones.
- tests del flujo de settings SMTP sin reexponer secrets al cliente.
- tests de compatibilidad para futuros `schemaVersion` por seccion.

## 11. Funcionalidades nuevas recomendadas

Las siguientes propuestas salen de huecos reales del producto y de la arquitectura existente.

### 11.1 Versionado clinico por seccion

- Nombre: `Historial de versiones de secciones`
- Problema real que resolveria:
  - Sobrescritura silenciosa de contenido clinico y dificultad para reconstruir cambios.
- Usuario objetivo:
  - Medicos, asistentes y administracion clinica.
- Por que encaja con la app actual:
  - Ya existe `AuditLog` y el concepto de `EncounterSection`.
- Dependencia tecnica o modulo:
  - `encounters`, `audit`, `frontend ficha/atencion`.
- Prioridad: `alta`
- Complejidad estimada: `media-alta`
- Riesgo regulatorio o de privacidad:
  - Medio; requiere definir bien quien puede ver versiones y diferencias.

### 11.2 Bitacora de accesos y exportaciones

- Nombre: `Audit trail de acceso y export`
- Problema real que resolveria:
  - Hoy ya existe una traza inicial de exportaciones y descargas, pero falta evolucionarla hacia una politica transversal y mas explotable para incidentes, compliance y supervision clinica.
- Usuario objetivo:
  - Admin, seguridad, liderazgo clinico.
- Por que encaja con la app actual:
  - El modulo `audit` ya existe y en la pasada 2 ya quedo instrumentado en eventos sensibles clave.
- Dependencia tecnica o modulo:
  - `audit`, `attachments`, `encounters`, `patients`, `users`.
- Prioridad: `alta`
- Complejidad estimada: `media`
- Riesgo regulatorio o de privacidad:
  - Bajo si se minimiza payload y se evita registrar PHI innecesaria.

### 11.3 Flujo formal de revision medica

- Nombre: `Revision y cierre medico asistido`
- Problema real que resolveria:
  - El estado `reviewStatus` existe, pero todavia no expresa un circuito robusto de validacion clinica.
- Usuario objetivo:
  - Medicos y asistentes.
- Por que encaja con la app actual:
  - Ya existe `reviewStatus`, `reviewedBy`, `reviewedAt`.
- Dependencia tecnica o modulo:
  - `encounters`, `audit`, `frontend atencion`.
- Prioridad: `alta`
- Complejidad estimada: `media`
- Riesgo regulatorio o de privacidad:
  - Medio; conviene definir bien trazabilidad, responsabilidad y evidencia de cierre.

### 11.4 Alertas de divergencia de datos administrativos

- Nombre: `Deteccion de divergencia entre ficha maestra y snapshot de atencion`
- Problema real que resolveria:
  - Evita inconsistencia silenciosa de identificacion.
- Usuario objetivo:
  - Medicos y asistentes.
- Por que encaja con la app actual:
  - Existe `Patient` + `EncounterSection(IDENTIFICACION)`.
- Dependencia tecnica o modulo:
  - `patients`, `encounters`, `ficha`, `PDF`.
- Prioridad: `alta`
- Complejidad estimada: `media`
- Riesgo regulatorio o de privacidad:
  - Bajo.

### 11.5 Recordatorios activos de seguimientos

- Nombre: `Recordatorios y SLA de seguimientos`
- Problema real que resolveria:
  - La bandeja de seguimientos hoy es util, pero pasiva.
- Usuario objetivo:
  - Medicos y asistentes.
- Por que encaja con la app actual:
  - Ya existen `EncounterTask`, `SeguimientosPage` y `MailService`.
- Dependencia tecnica o modulo:
  - `patients`, `mail`, jobs o cron.
- Prioridad: `media`
- Complejidad estimada: `media`
- Riesgo regulatorio o de privacidad:
  - Medio si se envian recordatorios con informacion sensible.

## 12. Hoja de ruta final

### Inmediato

- Profundizar la separacion de read models longitudinales y paginacion de timeline.
- Consolidar catalogo unico de eventos de auditoria con motivos/resultados.
- Mantener regimen de upgrades preventivos para no reabrir `AN-08`.

### Corto plazo

- Introducir versionado o al menos diff util por seccion clinica.
- Expandir cobertura e2e/frontend sobre flujos clinicos complejos y auditoria.
- Completar documentacion operativa de despliegue, backups y restauracion.

### Mediano plazo

- Implementar versionado clinico por seccion.
- Diseñar read models y endpoints especializados para longitudinal.
- Consolidar politica transversal de auditoria.
- Formalizar workflow de revision medica y trazabilidad de cierre.

## 13. Conclusiones finales

Anamneo tiene varias decisiones buenas que merece la pena preservar. No es un proyecto improvisado: hay criterio tecnico en auth, adjuntos, health checks y pruebas backend. El mayor riesgo actual ya no es una ausencia total de controles en ingreso de datos, sino la falta de algunas garantias transversales que un software medico termina necesitando al crecer: read models longitudinales mas finos, versionado clinico y una politica de auditoria todavia mas expresiva.

Si tuviera que priorizar con mentalidad de seguridad del paciente e integridad del dato, el orden seria:

1. payloads/read models longitudinales para evitar fragilidad y latencia creciente
2. catalogo unico de eventos y politica de auditoria mas expresiva
3. schema versionado de secciones clinicas
4. cobertura e2e/frontend adicional sobre flujos clinicos criticos
5. formalizacion del workflow de revision medica

Con esas correcciones, la base existente permitiria evolucionar Anamneo con mucha mas seguridad y bastante mejor confianza operativa.
