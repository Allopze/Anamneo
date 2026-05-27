# Auditoría integral de Anamneo (delta 2026-05-26)

## Cierre de brechas ejecutado por Codex (2026-05-27)

Se contrastó este documento contra el código y se implementaron las brechas de código que seguían abiertas o parciales:

| Ítem | Estado actualizado | Archivos principales |
|---|---|---|
| Q2 Signos vitales estructurados | ✅ Implementado modelo relacional `EncounterVitalSigns` 1:1 con atención; el guardado de `EXAMEN_FISICO.signosVitales` ahora sincroniza tabla estructurada y conserva el JSON existente por compatibilidad. | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260527023000_add_vital_signs_and_appointment_encounter_link/migration.sql`, `backend/src/encounters/encounters-section-mutations.ts` |
| Q4 Agenda → atención | ✅ Implementado vínculo `Appointment` ↔ `Encounter`; crear atención desde cita marca la cita como `ATENDIDA` y abre la atención. Si ya existe una atención en progreso, se reutiliza y se asocia a la cita. | `schema.prisma`, `create-encounter.dto.ts`, `encounters-create-mutation.ts`, `agenda/page.tsx` |
| Q4 Agenda con paciente vinculado | ✅ Implementada búsqueda/selección de paciente en la UI de agenda; backend valida scope médico/asistente y descifra datos identificatorios para mostrar nombre/RUT. | `appointments.service.ts`, `agenda/page.tsx` |
| Q1 Portal auditoría CSV | ✅ Implementado endpoint `GET /portal/audit-log.csv` y botón "Exportar CSV" en portal paciente. | `patient-portal.controller.ts`, `patient-portal.service.ts`, `portal/historial-acceso/page.tsx` |
| Q6 CIE-10 oficial | ✅ Base técnica implementada: `ConditionCatalog.cieCode`, parser CSV acepta `cie_code`/`cie10`/`code`, UI muestra código, script `npm --prefix backend run import:cie10 -- ./cie10.csv`. Falta cargar dataset oficial real. | `schema.prisma`, `conditions-csv-*`, `conditions-helpers.ts`, `import-cie10.js`, catálogo/selector FE |
| A2 guard navegación interna `pacientes/nuevo` | ✅ Añadido guard para clicks en links internos cuando el formulario está dirty; se mantiene autosave cifrado en `sessionStorage` y `beforeunload`. | `frontend/src/app/(dashboard)/pacientes/nuevo/usePatientFormDraft.ts` |

Validación ejecutada:

- `npm --prefix backend run prisma:generate`
- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix backend run test -- conditions-csv.service.spec.ts encounters-section-mutations.spec.ts --runInBand`

Nota de validación: se intentó `npm --prefix frontend run test -- agenda portal --runInBand`, pero Jest no encontró suites con esos patrones; quedan recomendados e2e/frontend específicos para agenda y portal CSV.

Pendientes tras este cierre:

1. **Operativo/staging**: ejecutar migraciones en staging, probar rollback/smoke Ley 21.719, activar y validar `NEXT_PUBLIC_STRICT_CSP=true`, verificar DSN Sentry real contra CSP, smoke manual de dictado por voz.
2. **CIE-10 oficial**: conseguir CSV oficial MINSAL/OMS y ejecutar `npm --prefix backend run import:cie10 -- <archivo.csv>`; luego revisar duplicados semánticos.
3. **Features Sprint 5+**: recetas electrónicas con QR, mensajería médico-paciente, vacunas estructuradas, antecedentes familiares estructurados y reportes operacionales siguen como roadmap no implementado.
4. **QA recomendado**: e2e de agenda → crear cita con paciente → Atender → atención asociada; e2e de `EXAMEN_FISICO` verificando fila en `encounter_vital_signs`; e2e portal descarga CSV.

## Segunda pasada de cierre ejecutada por Codex (2026-05-27)

Se avanzó sobre los pendientes naturales que quedaron después del primer cierre:

| Ítem | Estado actualizado | Archivos principales |
|---|---|---|
| M4 split `useEncounterSectionSaveFlow` | ✅ Hook reducido de 471 a 387 líneas; tipos y helpers puros extraídos a archivo vecino de 97 líneas. | `useEncounterSectionSaveFlow.ts`, `useEncounterSectionSaveFlow.helpers.ts` |
| QA agenda → atención | ✅ Tests unitarios para crear atención desde cita, marcar cita `ATENDIDA`, rechazar cita ya asociada y validar scope de agenda. | `encounters-create-mutation.spec.ts`, `appointments.service.spec.ts` |
| QA signos vitales estructurados | ✅ Test unitario que verifica `encounter_vital_signs.upsert` al guardar `EXAMEN_FISICO`. | `encounters-section-mutations.spec.ts` |
| Reportes operacionales | ✅ Implementado endpoint `GET /analytics/operational/daily-summary` y pantalla `/reportes` con resumen diario de citas, no-show, atenciones, pacientes únicos, conversión agenda y espontáneas. | `operational-daily-summary.read-model.ts`, `analytics.controller.ts`, `analytics.service.ts`, `frontend/src/app/(dashboard)/reportes/page.tsx`, `DashboardLayout.tsx` |

Validación adicional ejecutada:

- `npm --prefix backend run test -- appointments.service.spec.ts encounters-create-mutation.spec.ts encounters-section-mutations.spec.ts conditions-csv.service.spec.ts operational-daily-summary.read-model.spec.ts --runInBand`
- `npm --prefix frontend run test -- use-encounter-section-save-flow.test.tsx --runInBand`
- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`

Pendientes tras la segunda pasada:

1. **Operativo/staging**: ejecutar migraciones en staging, probar rollback/smoke Ley 21.719, activar y validar `NEXT_PUBLIC_STRICT_CSP=true`, verificar DSN Sentry real contra CSP, smoke manual de dictado por voz.
2. **CIE-10 oficial**: cargar dataset oficial real con `npm --prefix backend run import:cie10 -- <archivo.csv>` y revisar duplicados semánticos.
3. **Features Sprint 5+ no implementadas**: recetas electrónicas con QR, mensajería médico-paciente, vacunas estructuradas y antecedentes familiares estructurados.
4. **QA e2e recomendado**: Playwright/e2e para agenda → cita con paciente → Atender; portal → export CSV; EXAMEN_FISICO → persistencia relacional visible en API/DB.

## Estado de implementación — Sprint 1 completado (2026-05-26)

Todos los Quick Wins (QW1–QW11) y los hallazgos A1–A4 de Sprint 1 fueron implementados y verificados con typecheck limpio:

| Ítem | Estado | Archivos modificados |
|---|---|---|
| QW1 Paginación disabled+spinner | ✅ | `pacientes/page.tsx` |
| QW2 Cohorte cuantificada en analítica | ✅ | `analitica-clinica/page.tsx` |
| QW3 Máscara RUT on-change | ✅ | `pacientes/nuevo/page.tsx`, `EditarPacienteFormSections.tsx` |
| QW4 Disclaimer observacional en export | ✅ | `clinical-analytics.summary.export.ts` |
| QW5 PatientBlockingControls → tokens | ✅ | `PatientBlockingControls.tsx` |
| QW6/A3 AdminGuard exige role=ADMIN | ✅ | `admin.guard.ts` |
| QW7 Eliminar N+1 alerts (include) | ✅ | `alerts.service.ts` |
| QW8 Atajos Ctrl+S / Alt+arrows | ✅ | `atenciones/[id]/page.tsx` |
| QW9 aria-busy en DashboardSidebarSearch | ✅ | `DashboardSidebarSearch.tsx` |
| QW10 Banner global sincronización offline | ✅ | `OfflineBanner.tsx` |
| QW11 Fechas formato dd/MM/yyyy hrs | ✅ | `atenciones/page.tsx`, `FichaClinicalRecord.tsx` |
| A1 Revocación con preview evidencia legal | ✅ | `PatientDataProcessingConsents.tsx` |
| A2 Autosave+beforeunload en pacientes/nuevo | ✅ | `usePatientFormDraft.ts`, `nuevo/page.tsx` |
| A4 e2e cross-patient isolation | ✅ | `clinical-cross-patient-isolation.e2e-spec.ts` |

**Sprint 2 completado (2026-05-27)**:

| Ítem | Estado | Archivos modificados |
|---|---|---|
| Q3 Alergias estructuradas | ✅ | `schema.prisma`, `allergies/*`, `PatientAllergiesList.tsx`, `EncounterClinicalWarnings.tsx`, `pacientes/[id]/page.tsx` |
| Q7 Completitud visible | ✅ | `PatientCompletenessWidget.tsx` (nuevo), `pacientes/[id]/page.tsx` |
| Q5 Próximo control sugerido | ✅ | `diagnosis-followup-map.ts` (nuevo), `useEncounterWorkflowActions.ts`, `useEncounterWizard.ts`, `atenciones/[id]/page.tsx` |
| Q4 Agenda/citas MVP | ✅ | `schema.prisma`, migración `add_appointments`, `appointments/*`, `agenda/page.tsx`, `DashboardLayout.tsx` |
| Q1 Portal acceso auditoría | ✅ | `patient-portal.service.ts` (getAuditLog), `patient-portal.controller.ts`, `portal/historial-acceso/page.tsx`, `portal/page.tsx` |

**Pendiente Sprint 3+**: staging validation migraciones Ley 21.719, CSP staging, carga del dataset oficial CIE-10, recetas con QR, comunicación médico-paciente, vacunas y antecedentes familiares estructurados.

## Contexto

- Anamneo es un EHR para consultas médicas chilenas (NestJS 11 + Prisma 5 + Next.js 16 + PostgreSQL 16). Cumplimiento explícito Ley 21.719.
- Roles: `MEDICO`, `ASISTENTE`, `ADMIN` (admin operacional, **sin permisos clínicos** — ver [shared/permission-contract.ts](shared/permission-contract.ts)).
- Ya existe una auditoría exhaustiva del 24-may en [AUDITORIA_INTEGRAL_ANAMNEO_2026-05-24.md](AUDITORIA_INTEGRAL_ANAMNEO_2026-05-24.md) con varios issues remediados y validados con tests. **Este informe NO repite hallazgos ya remediados**; se enfoca en validar estado actual, deltas y hallazgos nuevos.
- Verifiqué cada hallazgo contra código real antes de incluirlo. Varios "hallazgos" inicialmente propuestos por exploración resultaron inválidos (analítica ya filtra por `medicoId`, `EncounterToolbar` ya tiene `aria-live="polite"`, portal-paciente ya tiene `@Throttle` en reset, cascada Patient→Encounter es intencional por purga regulatoria) y fueron descartados.

## Resumen ejecutivo

**Etapa confirmada por el usuario: uso personal / desarrollo, sin pacientes reales aún.** Eso desactiva la urgencia regulatoria inmediata y permite priorizar lo que más mueve la aguja antes del primer paciente: cerrar deuda visible, completar el **flujo operacional diario que hoy falta (agenda)** y elevar la calidad UX hasta un nivel "instalable" en una consulta real.

Anamneo es un producto técnicamente sólido y más maduro que un MVP. La auditoría previa ya cerró las brechas críticas conocidas (IDOR en consentimientos de datos, guard de bloqueo, dictado vs `Permissions-Policy`, CSP/Sentry, PHI local). Quedan **tres ejes** abiertos:

1. **Deuda de mantenibilidad** — varios archivos productivos siguen sobre 460 líneas (registro, ajustes, ficha de paciente, save-flow de atenciones). No bloquea producción, pero aumenta riesgo de regresión clínica.
2. **Gaps de producto operacional** — falta lo que cualquier médico chileno espera de un EHR diario: **agenda/citas**, **alergias estructuradas**, **signos vitales estructurados**, **CIE-10 oficial**, **portal del paciente con acceso a su propia auditoría** (este último también es requisito Ley 21.719 cuando haya pacientes reales).
3. **Microcalidad UX** — confirmaciones destructivas, máscaras de input chilenas, indicadores explícitos de sincronización offline, atajos de teclado clínicos.

No detecté ningún issue de severidad **crítica nuevo**. Sí hay un **alto** confirmado (A1: revocación de consentimiento de tratamiento de datos sin paso de confirmación que muestre evidencia legal). Dado que no hay pacientes reales aún, A1 baja de "crítico inmediato" a "imprescindible antes del primer paciente".

## Qué parece ser Anamneo y cuál es su flujo principal

Un sistema de ficha clínica para consultas chilenas pequeñas/medianas, con:

- Identificación de paciente con validación RUT y completitud progresiva.
- Atenciones por secciones (identificación → anamnesis próxima/remota → examen físico → diagnóstico → tratamiento → respuesta) con autosave, draft cifrado en cliente (WebCrypto), cola offline e IndexedDB.
- Revisión y firma estructurada del encuentro.
- Consentimientos clínicos y consentimientos de tratamiento de datos (Ley 21.719), separados conceptualmente en el backend pero **mezclados visualmente** en la ficha.
- Auditoría persistente con cadena hash (integridad verificable).
- Solicitudes DSAR (acceso, rectificación, portabilidad, oposición, bloqueo, supresión).
- Portal del paciente con autenticación independiente.
- Analítica clínica por médico (cohortes, desenlaces proxy, supresión <10 pacientes).
- Operación: Docker Compose, backup PostgreSQL automatizado, Sentry, despliegue detrás de Cloudflare Tunnel same-origin.

Usuario principal: médico/asistente de una clínica pequeña; admin operacional (no clínico).

## Estado validado de la auditoría previa (2026-05-24)

Verifiqué con código actual:

| Issue 24-may | Estado validado 26-may |
|---|---|
| IDOR en `patient-consents` | ✅ `PatientConsentsController` usa `RolesGuard` + scope; tests e2e existen |
| `PatientNotBlockedGuard` inconsistente | ✅ aplicado en encounters/alerts/consents/attachments con `RolesGuard` |
| Dictado vs `Permissions-Policy` | ✅ `microphone=(self)` con flag de opt-out |
| CSP bloquea Sentry | ✅ origen DSN incluido en `connect-src` |
| PHI en localStorage/IndexedDB | ✅ cifrado WebCrypto + `sharedDeviceMode` default |
| Throttle en `portal/forgot-password` | ✅ `@Throttle({ short: { limit: 2, ttl: 60000 } })` ya aplicado |
| `EncounterToolbar` save status accesible | ✅ `aria-live="polite"` + `role="status"` ya presente |
| Analítica clínica filtra por `medicoId` | ✅ `clinical-analytics.read-model.ts` filtra por `effectiveMedicoId` |

**Sigue pendiente** (operacional, no código):
- Validación staging del DSN real con CSP.
- Smoke manual de dictado por voz en navegador objetivo.
- Despliegue operativo de las migraciones destructivas Ley 21.719 a staging/prod (drops legacy).
- Activación staging de `NEXT_PUBLIC_STRICT_CSP=true` antes de default.

## Hallazgos críticos y altos nuevos

### A1 — Revocación de consentimiento de tratamiento de datos sin paso de confirmación con evidencia [ALTA]

- Archivo: [frontend/src/components/PatientDataProcessingConsents.tsx](frontend/src/components/PatientDataProcessingConsents.tsx)
- Problema: el flujo de revocación pide `revokeReason` pero no presenta al usuario el documento legal que se está revocando (versión, hash de evidencia, fecha y firmante) antes de confirmar. Una pulsación errónea revoca un acto legal con consecuencias regulatorias (Ley 21.719 art. 14 bis): pierde base legal el tratamiento y el paciente queda bloqueado para nuevas atenciones.
- Impacto: regulatorio, no solo UX. Auditoría queda con revocación accidental indistinguible de revocación intencional.
- Recomendación: paso de confirmación tipo "previsualizar antes de revocar" que muestre: nombre del titular, finalidad del consentimiento, versión del documento legal aceptado (`legalDocumentVersion`/`hash`), fecha de otorgamiento, RUT del firmante, y `revokeReason` requerido con mínimo 20 caracteres (mismo umbral que purga). Estilo `ConfirmModal` existente, no overlay manual.

### A2 — `pacientes/nuevo` no protege datos en caso de cierre/navegación accidental [MEDIA-ALTA]

- Archivo: [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx) (494 líneas)
- Problema: formulario largo, sin `beforeunload` ni autosave en draft local, sin guard al navegar dentro de la app con cambios sin guardar. El equivalente clínico (atenciones) sí tiene autosave; el formulario de paciente nuevo no.
- Impacto: pérdida silenciosa de datos demográficos ingresados antes del primer encuentro. Para usuarios clínicos que están copiando del Excel heredado, alta probabilidad de tener que reingresar.
- Recomendación: añadir guard de navegación (`useUnsavedChangesGuard` o equivalente) + autosave a `sessionStorage` cifrado (reutilizar utilidades de `encounter-draft.ts`) con purga al submit exitoso.

### A3 — `AdminGuard` valida solo `user.isAdmin`, decoupled de rol [MEDIA-ALTA]

- Archivo: [backend/src/common/guards/admin.guard.ts](backend/src/common/guards/admin.guard.ts)
- Problema: el guard rechaza si `!user.isAdmin` pero **no valida el rol**. El contrato `permission-contract.ts` define ADMIN como rol sin permisos clínicos, pero un usuario con `role: MEDICO` y `isAdmin: true` (legítimo en bootstrap inicial o por configuración) pasa `AdminGuard` y por tanto accede a `data-breach`, `legal/admin`, `patient-data-rights/admin`, etc.
- Impacto: si en algún momento `isAdmin` se otorga a usuarios clínicos para acciones administrativas puntuales (p.ej. importar catálogo), heredan acceso a endpoints sensibles de cumplimiento.
- Recomendación: o bien `AdminGuard` exige también `user.role === 'ADMIN'`, o agregar `RolesGuard + @Roles('ADMIN')` junto a `AdminGuard` en cada controlador de admin. Documentar la semántica de `isAdmin` vs `role` explícitamente en `permission-contract.ts`.

### A4 — Falta tests e2e de aislamiento para módulos clínicos por paciente [MEDIA-ALTA]

- Cobertura actual: existe e2e stateful para `patient-consents` (post-remediación 24-may), pero NO existe matriz equivalente para `consents` (clínicos), `problems`, `tasks`, `clinical-alerts`, `attachments` (escritura cross-patient), `patient-data-rights` (admin con `patientId`).
- Riesgo: la regresión que llevó al IDOR de `patient-consents` puede repetirse en cualquier módulo nuevo sin red de seguridad.
- Recomendación: `backend/test/clinical-cross-patient-isolation.e2e-spec.ts` que pruebe matriz [médico A vs paciente de médico B] para read/write en cada módulo. Reutilizar fixtures de la suite e2e existente.

## Hallazgos medios nuevos

### M1 — Cascada `Patient → Attachment.deletedAt` no aprovecha soft-delete

- Archivo: [backend/prisma/schema.prisma](backend/prisma/schema.prisma) líneas 479/495
- Observación: `Attachment` ya tiene `deletedAt` con índice, pero la relación a `Patient` es `onDelete: Cascade`. El `purgePatient` legítimo borra todo, pero también borra cualquier otra eliminación de paciente (no debería existir fuera de purga, pero no está prohibida por el modelo).
- Recomendación: añadir comentario en schema y verificar en revisión de PR que ninguna ruta llama `prisma.patient.delete` fuera de `PatientsRegulatoryPurgeService`. Considerar guardrail estático similar a `audit:legacy-plaintext`.

### M2 — N+1 en `alerts.service.findByPatient`

- Archivo: [backend/src/alerts/alerts.service.ts:126](backend/src/alerts/alerts.service.ts#L126)
- Problema: `attachUserNames(this.prisma, sortedAlerts)` resuelve nombres de creadores tras el `findMany` principal, en vez de incluirlos con `include`.
- Recomendación: cambiar `findMany` a `include: { createdByUser: { select: { id, nombre } } }` y eliminar `attachUserNames`. Bajo perfil de severidad porque el N suele ser bajo (alertas por paciente), pero patrón a unificar.

### M3 — Modelo de datos no estructura alergias ni signos vitales

- Archivo: [backend/prisma/schema.prisma](backend/prisma/schema.prisma) (`PatientHistory.alergias` texto libre; `EncounterSection` con `sectionKey='EXAMEN_FISICO'` parsea JSON pero sin tabla relacional)
- Problema: dos áreas con valor de seguridad clínica alta están como texto libre/JSON, sin posibilidad de:
  - Cruzar alergias contra `MedicationCatalog.activeIngredient` antes de prescribir.
  - Generar `ClinicalAlert` automática por presión >140/90 o temperatura >38.
  - Curvas de evolución de signos vitales.
- Recomendación de bajo costo: crear `PatientAllergy` (allergen, severity, reaction, onsetDate, deletedAt) y `EncounterVitalSigns` (uno-a-uno con encuentro, columnas estructuradas). UI: banner rojo en atención si paciente tiene alergias activas; advertencia visual cuando signos vitales caen fuera de rango. Reutilizar `ClinicalAlert` para auto-disparo.

### M4 — Tres archivos productivos siguen sobre 460 líneas con responsabilidades mezcladas

Snapshot 2026-05-26 confirmado contra repo:

| Archivo | Líneas | Riesgo dominante |
|---|---:|---|
| [frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx](frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx) | 489 | perfil + 2FA + sesiones + privacidad local en un solo archivo |
| [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx) | 494 | form largo, validación y submit acoplados |
| [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts](frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts) | 471 | máquina de estados de save+offline+conflicto sin separar reducer |

Recomendación: dividir `ProfileSecurityTab` en `ProfileForm`, `TwoFactorPanel`, `SessionsPanel`, `LocalPrivacyPanel`; extraer hooks de submit y duplicados de `pacientes/nuevo`; convertir `useEncounterSectionSaveFlow` en un reducer puro + hooks de orquestación.

### M5 — Botones de paginación en `pacientes` no se deshabilitan durante fetch

- Archivo: [frontend/src/app/(dashboard)/pacientes/page.tsx](frontend/src/app/(dashboard)/pacientes/page.tsx) líneas 395-423
- Problema: `Anterior`/`Siguiente` no usan `disabled={isFetching}`, generando múltiples requests si el usuario hace clic repetidos en listas grandes.
- Recomendación: agregar `disabled` derivado del query state y un spinner inline.

### M6 — Mensaje de cohorte pequeña no cuantifica

- Archivo: [frontend/src/app/(dashboard)/analitica-clinica/page.tsx](frontend/src/app/(dashboard)/analitica-clinica/page.tsx)
- Problema: `suppressedEmptyMessage` informa "menos de N pacientes" pero no cuántos hay realmente; el médico tratante (autor de la query) podría ver el conteo agregado sin exponer desgloses.
- Recomendación: mostrar `Cohorte: X pacientes (umbral mínimo para desglose: Y)`. El conteo total no reidentifica; el desglose sí.

### M7 — Búsqueda en `DashboardSidebar` sin estado de "esperando debounce"

- Archivo: [frontend/src/components/layout/DashboardSidebar.tsx](frontend/src/components/layout/DashboardSidebar.tsx) (usa `DashboardSidebarSearch`)
- Problema: si hay debounce, no es visible al usuario; si no hay, dispara queries por tecla.
- Recomendación: confirmar debounce 250-300ms y exponer `aria-busy` o spinner inline durante la espera.

### M8 — Confirmación destructiva de bloqueo de paciente usa overlay manual fuera del sistema

- Archivo: [frontend/src/components/PatientBlockingControls.tsx](frontend/src/components/PatientBlockingControls.tsx)
- Problema: modal de bloqueo construido a mano (`fixed inset-0`, colores hardcoded `bg-rose-700`/`bg-teal-700`) en vez del `ConfirmModal` del proyecto. Mismo problema con componentes legales (auditoría 24-may ya lo identificó en general; este es un caso concreto).
- Recomendación: migrar a `ConfirmModal` reutilizable y tokens semánticos (`bg-status-danger`, `bg-status-ok`).

### M9 — Validación de RUT sin máscara en tiempo real

- Archivo: [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx) y form de edición
- Problema: el usuario tipea `12345678-9` o `123456789` y la validación rechaza solo al submit. Existe normalización en backend, no en input.
- Recomendación: máscara de input chilena (`12.345.678-9`) on-change con cálculo de DV opcional. Reutilizar utilidad del backend si está expuesta en `shared/`.

### M10 — Banner de "sincronizando cambios pendientes" no es visible al volver de offline

- Archivos: [frontend/src/lib/offline-queue.ts](frontend/src/lib/offline-queue.ts), [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts](frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts)
- Problema: al recuperar conexión, la cola se procesa, pero la UI no muestra "Sincronizando 3 cambios" en un banner visible. El badge accesible existe en `EncounterToolbar` pero solo refleja el estado de la sección activa, no la cola global.
- Recomendación: banner global con `aria-live="polite"` que muestre count de items pendientes y errores de sincronización con CTA para reintentar manualmente.

## Bugs reproducibles

```text
Bug:
Revocación de consentimiento de datos sin previsualizar evidencia legal antes de confirmar.
Ubicación:
frontend/src/components/PatientDataProcessingConsents.tsx
Severidad:
Alta.
Como reproducir:
1. Ficha de paciente con consentimiento de tratamiento de datos vigente.
2. Pulsar "Revocar".
3. Llenar revokeReason y confirmar.
Resultado actual:
Se revoca sin mostrar el documento legal, versión/hash, ni fecha original.
Resultado esperado:
Mostrar evidencia legal, versión, hash y firma original antes de exigir confirmación final.
Causa probable:
Modal de revocación construido como acción rápida, no como acto regulado.
Solución recomendada:
ConfirmModal con preview + reason >= 20 chars + double-confirm.
Archivos involucrados:
frontend/src/components/PatientDataProcessingConsents.tsx, backend/src/patient-consents/patient-consents.service.ts (exponer evidencia en GET por id).
```

```text
Bug:
Datos demográficos perdidos al cerrar pestaña en pacientes/nuevo.
Ubicación:
frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx
Severidad:
Media-alta.
Como reproducir:
1. Iniciar alta de paciente, ingresar 70% del formulario.
2. Cerrar pestaña, navegar a otra sección del shell, o presionar Atrás.
Resultado actual:
Se pierden todos los datos sin advertencia.
Resultado esperado:
Prompt nativo de "cambios sin guardar" + draft cifrado en sessionStorage recuperable al volver.
Solución recomendada:
useUnsavedChangesGuard + draft cifrado con WebCrypto (utilidad de encounter-draft.ts).
```

```text
Bug:
AdminGuard otorga acceso a admin endpoints a usuarios con isAdmin=true pero rol != ADMIN.
Ubicación:
backend/src/common/guards/admin.guard.ts (y todos los controladores que lo usan solo)
Severidad:
Media-alta (potencial, depende de operación).
Como reproducir:
1. Asignar isAdmin=true a un usuario con role='MEDICO' (legítimo para bootstrap).
2. Llamar GET /admin/data-breaches o /admin/legal/documents.
Resultado actual:
Pasa el guard, accede a datos sensibles.
Resultado esperado:
Solo rol ADMIN explícito.
Solución recomendada:
AdminGuard debe verificar también user.role==='ADMIN', o componer con RolesGuard.
```

```text
Bug:
N+1 en alerts.findByPatient al resolver nombres de creadores.
Ubicación:
backend/src/alerts/alerts.service.ts:126 (attachUserNames después del findMany).
Severidad:
Baja-media.
Solución recomendada:
include: { createdByUser: { select: { id: true, nombre: true } } } en el findMany.
```

```text
Bug:
RUT validado solo al submit, sin máscara ni feedback en vivo.
Ubicación:
frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx y editar.
Severidad:
Baja.
Resultado esperado:
Máscara on-change y feedback verde/rojo según DV.
```

## Inconsistencias

1. **`isAdmin` vs `role`**: `permission-contract.ts` modela admin como rol clínico vacío, pero `AdminGuard` solo lee `isAdmin`. Dos modelos de autorización coexisten sin reconciliar. Decidir cuál es la fuente de verdad y migrar el otro.
2. **Consentimientos clínicos vs consentimientos de tratamiento de datos** comparten componentes vecinos en la ficha del paciente con iconografía similar; son entidades regulatoriamente distintas. Auditoría 24-may lo identificó; sigue sin resolver visualmente.
3. **`PatientHistory.alergias` texto libre** vs **promesa clínica de seguridad**: la palabra "alergia" aparece en docs/features pero el modelo no la trata como dato estructurado de seguridad.
4. **Fechas en UI**: `format(date, "d MMM yyyy, HH:mm", { locale: es })` sin marcador explícito de zona horaria. Si servidor es UTC y cliente Chile, el render es local pero el usuario no lo sabe. Añadir sufijo "CLT" o normalizar formato chileno DD/MM/YYYY HH:mm consistente.
5. **`docs/product/features.md` marca "plantillas de texto" como YA** pero falta UI admin para crear/editar globales; existe `TextTemplate` por médico individual. Lo mismo con catálogo de medicamentos (existe tabla, falta UI de import). Actualizar features.md a estado real.

## Auditoría técnica (delta)

- **Permisos**: matriz clínica sólida tras 24-may. La duda restante es `AdminGuard` (A3).
- **Validación**: clase-validator usado consistentemente; recomiendo que `LegalDocument.contentJson` tenga DTO específico con `@ValidateNested()` para evitar políticas con estructura inesperada renderizadas en el portal.
- **Auditoría**: cadena hash extraída a `audit-integrity.ts`. Tests de concurrencia existen (`audit.service.concurrency.spec.ts`).
- **Tests**: 90 suites backend / 69 frontend / 280 e2e backend / 20+6 e2e frontend. Cobertura buena, **gap específico**: aislamiento cross-patient fuera de `patient-consents`.
- **Performance**: N+1 en `alerts` (M2). Verificar también `patient-portal.service` (466 líneas) para queries duplicadas. JSON-en-Prisma en secciones clínicas: aceptable mientras la analítica use `clinical-analytics-encounter-persistence.ts` como capa de proyección.
- **Migraciones**: la fase F destructiva está aplicada local; documentar runbook de rollback en staging/prod antes de release (referenciar `DECISION_ALMACENAMIENTO_LOCAL_PHI.md` como precedente de runbook).
- **Observabilidad**: tags Sentry de tenant/clinic/user — verificar que `instrumentation-client.ts` envía `userId` solo cuando hay sesión activa.

## Mejoras de producto recomendadas

### Q1 — Acceso del paciente a su propia auditoría [P1 REGULATORIO]

- Estado: `AuditLog` exhaustivo en DB; portal del paciente existe; **NO** existe vista de "quién accedió a mi ficha".
- Valor: Ley 21.719 art. 14 da derecho de acceso a logs. Antes de tener fiscalización formal, es defensa proactiva.
- MVP:
  - Endpoint `GET /portal/audit-log` autenticado como paciente (`PatientPortalAccount`), filtrado por `entityId = patient.id` y acciones LEER/EDITAR/DESCARGAR.
  - UI en `/app/portal/historial-acceso` con tabla: usuario (anonimizado al rol+iniciales), fecha, acción, sección.
  - Exportar a CSV.
- Archivos: nuevo módulo `patient-portal/audit-view.controller.ts`, nueva ruta frontend en `app/portal/`.

### Q2 — Signos vitales estructurados con alertas automáticas [P1 CLÍNICO]

- Estado: `EncounterSection` parsea JSON; no hay tabla 1:1 con columnas; sin alertas auto.
- Valor: seguridad clínica + datos analizables.
- MVP:
  - Tabla `EncounterVitalSigns` con columnas: temperatura, sistólica, diastólica, FC, FR, SpO2, peso, talla, IMC derivado.
  - UI estructurada en sección EXAMEN_FISICO con validación de rangos y badges (verde/amarillo/rojo).
  - Trigger en backend: si valores fuera de rango → crear `ClinicalAlert` automáticamente.
  - Gráfico simple en ficha de paciente con últimas 5 medidas.

### Q3 — Alergias estructuradas [P1 CLÍNICO]

- Estado: texto libre.
- MVP:
  - Tabla `PatientAllergy` (allergen, severity ENUM, reactionType, onsetDate, deletedAt).
  - UI CRUD en ficha de paciente.
  - Banner rojo persistente en `EncounterDrawer` y arriba de TRATAMIENTO si paciente tiene alergias activas.
  - V2: validar contra `MedicationCatalog.activeIngredient` al prescribir.

### Q4 — Agenda / Citas con recordatorios [P0 OPERACIONAL]

- Estado: NO EXISTE. Schema sin `Appointment`.
- Valor: fricción operacional diaria. Sin agenda, asistente sigue en Excel.
- MVP:
  - `Appointment` con `medicoId`, `patientId?`, `startAt`, `endAt`, `status` (PROGRAMADA, CONFIRMADA, NO_SHOW, ATENDIDA), `notes`.
  - UI calendario semanal por médico (reusar `date-fns` ya presente).
  - Al "ATENDER" → crear `Encounter` con `appointmentId` (FK opcional).
  - Recordatorio manual: botón "Enviar recordatorio" que arma mailto con plantilla.
- Roadmap V2: integración SMTP automatizada + SMS (Twilio o similar).

### Q5 — Próximo control sugerido automático [QUICK WIN]

- Estado: `EncounterTask` existe; no hay sugerencia automática.
- MVP:
  - JSON estático `diagnosis-followup-map.ts` con CIE-10/condición → intervalo de control (HTA: 90d, DM2: 90d, asma controlada: 180d, ITU: 7d).
  - Al cerrar atención con diagnóstico en mapa, mostrar modal "Crear control sugerido para DD/MM/YYYY" preseleccionado.
  - Reusa `EncounterTask` existente.

### Q6 — CIE-10 oficial en catálogo de condiciones [P2]

- Estado: `ConditionCatalog` sin `cieCode`.
- MVP:
  - Migration añade `cieCode String?` a `ConditionCatalog`.
  - Script `npm --prefix backend run import:cie10` que carga CSV oficial MINSAL.
  - UI muestra código junto al nombre.

### Q7 — Indicador visual de completitud de antecedentes [QUICK WIN]

- Estado: `Patient.completenessStatus` existe (VERIFICADA/NO_VERIFICADA); no hay barra de % de campos completos.
- MVP:
  - `PatientCompletenessReadModel` cuenta campos no-null en `PatientHistory` y demografía.
  - Badge "Ficha 75% — faltan: alergias, antecedentes familiares" en header de ficha.
  - Tooltip con lista accionable.

### Q8 — Antecedentes familiares estructurados [P2 CLÍNICO]

- Estado: texto libre en `PatientHistory.antecedentesFamiliares`.
- MVP: tabla `FamilyHistory` (relation, condition FK a `ConditionCatalog`, ageAtDiagnosis, alive). CRUD ligero en ficha.

### Q9 — Atajos de teclado para flujo clínico [QUICK WIN]

- MVP:
  - `Ctrl+S` (o `⌘+S`) = guardar sección actual.
  - `Alt+→`/`Alt+←` = siguiente/anterior sección.
  - `Alt+N` = nuevo paciente.
  - Modal `?` con cheat-sheet.

## Funcionalidades nuevas alineadas con el core

Listo aquí solo lo que encaja con el core (digitalizar ficha clínica chilena, reducir fricción, cumplir Ley 21.719). Explícitamente **descarto**: facturación, isapres, telemedicina propia, vademécum propio, LME MINSAL — son scope ajeno o requieren integraciones complejas mejor delegadas a terceros.

```text
Funcionalidad:
Recetas electrónicas con QR (sin firma FES oficial en MVP).
Por qué encaja:
Cierra el ciclo de TRATAMIENTO; ya hay EncounterTreatment + EncounterSignature.
Flujo:
Médico cierra atención → botón "Generar receta" → PDF con medicamentos, posología, RUT médico, QR (hash interno verificable en portal del paciente).
Pantallas/componentes:
Sección TRATAMIENTO, nuevo botón en EncounterToolbar, nuevo módulo backend prescriptions/.
Datos necesarios:
Tabla Prescription (encounterId, medicamentos JSON, signedAt, qrPayload, expiresAt).
Cambios técnicos:
Reusar EncounterSignature, integrar lib QR (qrcode npm).
MVP: PDF con QR interno (validación en portal). Avanzado: firma FES integración ISP.
Prioridad: P2.
```

```text
Funcionalidad:
Comunicación médico-paciente en portal (mensajes asíncronos, no chat).
Por qué encaja:
Reduce llamadas, mejora retención. Portal ya autenticado.
Flujo:
Paciente desde portal envía mensaje (límite 1/día), médico lo ve en bandeja del dashboard, responde, paciente lo ve.
Datos necesarios:
Tabla PatientMessage (fromUserId/fromPatientAccountId, content cifrado, readAt, threadId).
MVP: 1 thread por paciente, sin notificaciones email aún.
Prioridad: P2.
```

```text
Funcionalidad:
Vacunas estructuradas.
Por qué encaja:
Obligatorio por ley para menores; el campo "inmunizaciones" hoy es texto libre.
Datos: VaccineRecord (vaccineType, date, lot, doseNumber, nextDueDate, clinic).
MVP: CRUD simple en ficha de paciente. Alertas de vencimiento P3.
Prioridad: P2 (para pediatría) / P3 (resto).
```

```text
Funcionalidad:
Reportes operacionales (agenda, no-shows, productividad).
Por qué encaja:
Datos ya están en Encounter; falta agregación + UI.
MVP: endpoint /analytics/operational/daily-summary + tabla en admin.
Prioridad: P2 (depende de Q4 agenda).
```

## Quick wins implementables en menos de 1 día

| # | Quick win | Archivos | Effort |
|---|---|---|---|
| QW1 | Disabled state + spinner en paginación pacientes | `pacientes/page.tsx` | 1h |
| QW2 | Cuantificar cohorte en mensaje suprimido analítica | `analitica-clinica/page.tsx` | 30m |
| QW3 | Máscara RUT on-change en formularios paciente | `pacientes/nuevo`, `pacientes/[id]/editar` | 2h |
| QW4 | Disclaimer "análisis observacional, no causal" en export analítica | `clinical-analytics.summary.export.ts` | 30m |
| QW5 | Migrar `PatientBlockingControls` a `ConfirmModal` + tokens | `PatientBlockingControls.tsx` | 2h |
| QW6 | `AdminGuard` exige `role==='ADMIN'` + actualizar tests | `admin.guard.ts`, specs | 1h |
| QW7 | `include: createdByUser` en alerts (elimina N+1) | `alerts.service.ts` | 30m |
| QW8 | Atajos `Ctrl+S`/`Alt+arrows` en atención | `atenciones/[id]/page.tsx` | 3h |
| QW9 | `aria-busy` y debounce visible en `DashboardSidebarSearch` | sidebar | 1h |
| QW10 | Banner global de "sincronizando N cambios" en shell | `DashboardLayout.tsx` + suscripción a `offline-queue` | 4h |
| QW11 | Sufijo de zona horaria CLT/formato chileno consistente en listas | utilidad `format-date.ts` + usos | 2h |

Conjunto realista para 1-2 sprints cortos (~3 días de un dev senior).

## Roadmap sugerido (orden ajustado para "uso personal/desarrollo")

Sin pacientes reales aún, la prioridad real es **levantar el nivel del producto antes del primer paciente**. Reordeno:

**Sprint 1 (~1 semana) — Quick wins y endurecimiento ligero**
- Todos los Quick Wins (QW1–QW11). A3 (decisión `AdminGuard` rol vs flag) y A4 (tests e2e cross-patient) ahora caben aquí porque no hay presión regulatoria inmediata.

**Sprint 2 (~2 semanas) — Operación diaria del médico**
- Q4 (agenda/citas MVP) + Q7 (indicador de completitud). Es el gap más visible para alguien que vaya a usarlo en consulta real.

**Sprint 3 (~2 semanas) — Seguridad clínica estructurada**
- Q2 (signos vitales estructurados + alertas), Q3 (alergias estructuradas), Q5 (próximo control sugerido), A2 (autosave en `pacientes/nuevo`).

**Sprint 4 (~1 semana) — Antes del primer paciente real**
- A1 (revocación con preview legal), Q1 (portal acceso a auditoría), validación staging migraciones destructivas Ley 21.719, smoke manual dictado, activación staging `NEXT_PUBLIC_STRICT_CSP`. Este sprint es la "compuerta regulatoria" que se ejecuta justo antes de salir de uso personal.

**Sprint 5+ — Diferenciador**
- Recetas electrónicas con QR, comunicación paciente, vacunas, CIE-10 oficial, antecedentes familiares estructurados, reportes operacionales.

**Decisión pendiente (A3)**: revisar `isAdmin` vs `role` como parte de Sprint 1. Propuesta default: unificar a "rol como fuente de verdad" — `AdminGuard` exige `user.role === 'ADMIN'` y `isAdmin` se conserva solo como flag de bootstrap inicial (el primer usuario registrado obtiene rol ADMIN + isAdmin=true; ningún otro puede tener isAdmin sin rol ADMIN). Documentar la semántica en `permission-contract.ts` y agregar test que falle si un usuario con `isAdmin=true && role!='ADMIN'` puede crearse.

## Matriz final de prioridades

| Prio | Ítem | Tipo | Effort |
|---|---|---|---|
| **P0** | Q4 Agenda/citas MVP | feature operacional | alto |
| **P0** | Smoke staging migraciones destructivas Ley 21.719 | operación | medio |
| **P1** | A1 Revocación de consentimiento de datos con preview | bug regulatorio | bajo |
| **P1** | A2 Autosave en `pacientes/nuevo` | bug UX | medio |
| **P1** | A3 `AdminGuard` exige rol ADMIN | seguridad | bajo |
| **P1** | A4 e2e cross-patient isolation | red de seguridad | medio |
| **P1** | Q1 Portal paciente acceso a auditoría | regulatorio | medio |
| **P1** | Q2 Signos vitales estructurados | clínico | medio |
| **P1** | Q3 Alergias estructuradas | clínico | bajo |
| **P2** | M4 split de archivos >460 líneas | deuda técnica | medio |
| **P2** | Q5 Próximo control sugerido | quick win | bajo |
| **P2** | Q6 CIE-10 oficial | clínico | bajo |
| **P2** | Q7 Completitud visible | UX | bajo |
| **P2** | Recetas electrónicas con QR | diferenciador | medio |
| **P2** | Comunicación médico-paciente | retención | medio |
| **P3** | Atajos teclado, microcopy, formato fechas, máscara RUT | QW múltiples | bajo |
| **P3** | Vacunas estructuradas, antecedentes familiares estructurados | clínico | bajo |
| **P3** | Reportes operacionales | admin | medio |

## Archivos/módulos que requieren revisión inmediata

1. [frontend/src/components/PatientDataProcessingConsents.tsx](frontend/src/components/PatientDataProcessingConsents.tsx) — A1.
2. [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx) — A2 + máscara RUT + M4 split.
3. [backend/src/common/guards/admin.guard.ts](backend/src/common/guards/admin.guard.ts) — A3.
4. [backend/src/alerts/alerts.service.ts:126](backend/src/alerts/alerts.service.ts) — M2 N+1.
5. [backend/test/](backend/test/) — agregar `clinical-cross-patient-isolation.e2e-spec.ts` (A4).
6. [frontend/src/components/PatientBlockingControls.tsx](frontend/src/components/PatientBlockingControls.tsx) — QW5 migrar a `ConfirmModal`.

## Verificación end-to-end

Tras implementar este plan, validar:

1. Tipado y unit: `npm --prefix backend run typecheck && npm --prefix frontend run typecheck && npm run test`.
2. Guardrails estáticos: `npm --prefix backend run audit:patient-scope && npm --prefix backend run audit:legacy-plaintext`.
3. E2E nuevo aislamiento: `npm --prefix backend run test:e2e -- --testPathPattern=clinical-cross-patient-isolation`.
4. E2E existentes: `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`.
5. E2E headers de seguridad: `npm --prefix frontend run test:e2e:security-headers`.
6. Smoke manual:
   - Revocar consentimiento de datos → ver preview con evidencia legal antes de confirmar (A1).
   - Iniciar alta de paciente, cerrar pestaña, reabrir → recuperar draft (A2).
   - Login con `role=MEDICO, isAdmin=true` → `/admin/data-breaches` debe 403 (A3 si se elige reforzar rol).
   - Atención offline con 2 cambios → reconectar → banner global "Sincronizando 2 cambios" (QW10).
7. Accesibilidad: `npm --prefix frontend run test:e2e -- accessibility.spec.ts`.

## Preguntas abiertas y supuestos

1. **`isAdmin` vs `role`**: ¿se mantiene la dualidad o se elimina `isAdmin` y se confía solo en `role`? Pregunto antes de cerrar A3 con código.
2. **Agenda (Q4)**: ¿se construye nativa o se integra con Google/Outlook Calendar embed? Definir antes de Sprint 4.
3. **Recetas electrónicas**: ¿es valor de MVP local (PDF+QR sin firma FES) o requiere integración ISP/MINSAL para que las farmacias acepten? Decide complejidad real.
4. **Despliegue actual**: ¿está Anamneo ya en producción con pacientes reales, en staging, o solo en uso personal/dev? Define urgencia de los P0/P1.
5. **Volumen esperado**: ¿1 médico solo, 1 clínica con 5 médicos, o red? Impacta diseño de agenda y reportes operacionales.
6. Supuesto: `permission-contract.ts` es fuente de verdad de roles clínicos y `AdminGuard` solo orquesta acciones de plataforma — si es al revés, A3 cambia.
