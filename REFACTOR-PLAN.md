# Plan de Refactorización — Monolitos de Código

> Generado: 2026-04-14  
> Criterio: archivos con más de 300 líneas de código fuente

---

## Resumen

| Zona | Archivos >300L | Peor ofensor |
|------|:--------------:|-------------|
| Backend services | 11 | `encounters.service.ts` (2096) |
| Backend tests | 2 | `app.e2e-spec.ts` (2652) |
| Frontend pages | 14 | `atenciones/[id]/page.tsx` (2182) |
| Frontend components | 5 | `DashboardLayout.tsx` (662→331 ✅) |
| Frontend types | 1 | `types/index.ts` (551) |
| Otros | 1 | `UX_REFERENCE.jsx` (882) |

---

## Prioridad 1 — Críticos (>1000 líneas)

### 1. `backend/test/app.e2e-spec.ts` — 2652 → 21 líneas (orquestador) ✅
- **Resultado:** refactorizado el 2026-04-15.
  - [x] `test/helpers/e2e-setup.ts` (223 líneas) — bootstrap/teardown, estado compartido (`state`), `prisma`, `alertsService`, helpers (`req`, `extractCookies`, `cookieHeader`).
  - [x] `test/suites/health.e2e-suite.ts` (14 líneas) — health check.
  - [x] `test/suites/auth.e2e-suite.ts` (285 líneas) — bootstrap, registro admin/médico/asistente, login, perfil, logout, refresh, invitaciones.
  - [x] `test/suites/conditions.e2e-suite.ts` (74 líneas) — importación CIE-10, creación local, deduplicación.
  - [x] `test/suites/patients.e2e-suite.ts` (299 líneas) — CRUD pacientes, historial, campos admin, completitud, verificación, archivo/restauración.
  - [x] `test/suites/encounters.e2e-suite.ts` (1068 líneas) — creación, secciones, validaciones, alertas, problemas, tareas, adjuntos, review-status, exportación PDF, workflow completo/cancelar/reabrir.
  - [x] `test/suites/admin.e2e-suite.ts` (194 líneas) — gestión usuarios, settings, audit logs.
  - [x] `test/suites/validation.e2e-suite.ts` (500 líneas) — validación inputs, aislamiento de datos (IDOR), timeline volumen.
  - [x] `test/app.e2e-spec.ts` (21 líneas) — orquestador que importa y ejecuta todas las suites.
  - **Nota:** 9 tests pre-existentes fallaban antes del refactor. Corregidos el 2026-04-14: (a) nota de revisión/cierre obligatoria ≥10 chars en `updateReviewStatus` y `complete`, (b) documentos individuales ya no requieren `COMPLETADO/FIRMADO`, (c) test unitario apuntaba al método extraído. **167 e2e + 137 unit = 304 tests verdes.**
  - **Pendiente:** `encounters.e2e-suite.ts` (1068 líneas) podría subdividirse en pasada futura.

### 2. `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` — 2182 → 453 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `encounter-wizard.constants.ts` (204 líneas) — tipos, CSS tokens, formatters, section components.
  - [x] `useEncounterWizard.ts` (1110 líneas) — hook con todo el estado, queries, mutations, effects y handlers.
  - [x] `EncounterHeader.tsx` (276 líneas) — header con info paciente, progreso, botones.
  - [x] `EncounterSectionRail.tsx` (342 líneas) — nav lateral de secciones.
  - [x] `EncounterAttachmentsModal.tsx` (286 líneas) — modal de adjuntos.
  - [x] `page.tsx` (453 líneas) — orquestador compositional.
  - **Pendiente:** `useEncounterWizard.ts` sigue grande (1110). Podría subdividirse en pasada futura.

### 3. `backend/src/encounters/encounters.service.ts` — 2096 → 1224 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `encounters-sanitize.ts` (928 líneas) — todas las funciones de sanitización de secciones, constantes, helpers de snapshot, audit y formato de tareas.
  - [x] `encounters.service.ts` (1224 líneas) — CRUD core, transiciones de workflow, dashboard, audit history.
  - **Nota:** el servicio sigue por encima de 500 líneas porque cada operación CRUD/workflow es sustancial con validación y auditoría. Se extrajo ~42% del código.

### 4. `backend/src/patients/patients.service.ts` — 1920 → 1480 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `patients-format.ts` (469 líneas) — formatTask, formatProblem, decoratePatient, formatAdminSummary, resolvePatientVerificationState, normalizeNullableString, matchesClinicalSearch, CSV helpers (neutralizeCsvField, toCsvCell), encounter timeline/clinical summary formatters (formatEncounterTimelineItem, buildEncounterSummaryLines, buildClinicalSummary, getEncounterSectionData).
  - [x] `patients.service.ts` (1480 líneas) — CRUD, búsqueda, exportación, problemas, tareas. Importa todo desde patients-format.ts.

### 5. `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx` — 1124 → 352 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `patient-detail.constants.ts` (27 líneas) — schemas Zod, tipos ProblemForm/TaskForm, VITAL_CHART_CONFIG.
  - [x] `usePatientDetail.ts` (309 líneas) — hook con estado, queries, mutations, effects, handlers.
  - [x] `PatientProblemsCard.tsx` (140 líneas) — lista de problemas + formulario CRUD.
  - [x] `PatientTasksCard.tsx` (144 líneas) — lista de seguimientos + formulario CRUD.
  - [x] `PatientVitalsCard.tsx` (148 líneas) — tendencias clínicas + mini charts.
  - [x] `PatientEncounterTimeline.tsx` (210 líneas) — timeline de atenciones con paginación.
  - [x] `page.tsx` (352 líneas) — orquestador compositional.

### 6. `frontend/src/app/(dashboard)/ajustes/page.tsx` — 1065 → 128 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `ajustes.constants.ts` (26 líneas) — schemas Zod, tipos ProfileForm/PasswordForm/AjustesTab.
  - [x] `useAjustes.ts` (340 líneas) — hook con estado, tabs, queries, mutations, memos.
  - [x] `ProfileSecurityTab.tsx` (338 líneas) — datos personales + cambio contraseña + 2FA.
  - [x] `ClinicTab.tsx` (83 líneas) — datos del centro médico.
  - [x] `EmailTab.tsx` (319 líneas) — SMTP + editor de plantilla HTML + preview.
  - [x] `page.tsx` (128 líneas) — orquestador con tab navigation.

---

## Prioridad 2 — Altos (500–1000 líneas)

### 7. `backend/src/encounters/encounters-pdf.service.ts` — 805 → 556 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `encounters-pdf.helpers.ts` (271 líneas) — constantes de display (SEXO_MAP, PREVISION_MAP, STATUS_MAP, etc.), helpers de formato (formatRutDisplay, formatEncounterDateTime, formatSospechaDiagnosticaLabel, getTreatmentPlanText, formatHistoryFieldText, formatRevisionSystemEntries), utilidades de identificación (buildIdentificationSnapshotFromPatient, getIdentificationDifferenceLabels, getRutDisplayData), filename helpers.
  - [x] `encounters-pdf.service.ts` (556 líneas) — carga de datos, buildDocumentBuffer, render de ficha clínica (generatePdf), render de documentos individuales (generateFocusedPdf), auditoría.

### 8. `frontend/src/app/(dashboard)/admin/usuarios/page.tsx` — 793 → 402 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `usuarios.constants.ts` (95 líneas) — tipos (Role, InvitationStatus, AdminUserRow, AdminInvitationRow, UserInvitationResponse, CreatedInvitationState), constantes (INVITATION_STATUS_LABELS, INVITATION_STATUS_STYLES, ROLE_LABELS), helpers de validación (isValidEmail, getPasswordError, formatInvitationDate, getBrowserOrigin).
  - [x] `useUsuarios.ts` (293 líneas) — hook con estado, queries (admin-users, user-invitations), mutations (create invitation, update user, toggle active, revoke, reset password), memos (medicos, activeAdminCount, assistantGroups), handlers (startEdit, prefillAssistantForMedico).
  - [x] `UsersCard.tsx` (157 líneas) — lista de usuarios con acciones (editar, reset password, activar/desactivar) + ConfirmModal.
  - [x] `page.tsx` (402 líneas) — orquestador con formulario de invitación, lista de invitaciones, grupos de asistentes y panel de edición.

### 9. `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx` — 774 → 478 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `ficha.constants.ts` (38 líneas) — ESTADO_GENERAL_LABELS, fallbackPdfFilename, getFilenameFromDisposition.
  - [x] `useFichaClinica.ts` (193 líneas) — hook con query, mutations (sign, download), callbacks, section data extraction, computed values (outputBlockReason, linkedAttachmentsByOrderId, patientCompletenessMeta).
  - [x] `FichaToolbar.tsx` (154 líneas) — barra de acciones (volver, descargar receta/órdenes/derivación/PDF, imprimir, firmar) con integración a HeaderBarSlot.
  - [x] `LinkedAttachments.tsx` (59 líneas) — componente de adjuntos vinculados a exámenes/derivaciones estructuradas.
  - [x] `page.tsx` (478 líneas) — renderizado de las 10 secciones clínicas + header + footer + modales.

### 10. `backend/src/users/users.service.ts` — 764 → 412 líneas ✅
- **Resultado:** refactorizado el 2026-04-14.
  - [x] `users-helpers.ts` (39 líneas) — constantes (BCRYPT_ROUNDS, INVITATION_TTL_MS), funciones puras (normalizeEmail, hashInvitationToken, validateTemporaryPassword, validateRoleMedicoId).
  - [x] `users-session.service.ts` (149 líneas) — Injectable con métodos de sesión: findAuthById, rotateRefreshTokenVersion, createSession, findActiveSessionById, rotateSessionTokenVersion, revokeSessionById, revokeAllSessionsForUser, normalizeSessionMetadata.
  - [x] `users-invitation.service.ts` (211 líneas) — Injectable con métodos de invitación: createInvitation, findInvitationByToken, acceptInvitation, listInvitations, revokeInvitation.
  - [x] `users.service.ts` (412 líneas) — CRUD usuarios, update, remove, updateProfile, changePassword, resetPassword, contadores.
  - **Nota:** UsersModule exporta los 3 servicios. AuthService inyecta UsersSessionService + UsersInvitationService. UsersController inyecta UsersInvitationService. 304 tests verdes.

### 11. `frontend/src/components/layout/DashboardLayout.tsx` — 662 → 331 líneas ✅
- **Resultado:** refactorizado el 2026-04-15.
  - [x] `useDashboardSearch.ts` (92 líneas) — hook con estado y lógica de búsqueda: searchOpen, searchQuery, searchResults, searchLoading, searchActiveIndex, handleSearchChange (debounced), handleSearchNavigate, closeSearch.
  - [x] `DashboardSidebar.tsx` (289 líneas) — sidebar flotante desktop: logo, user card, search input con dropdown de resultados, navegación primaria/secundaria, botón logout. Exporta interfaz NavItem.
  - [x] `MobileSearchOverlay.tsx` (127 líneas) — overlay full-screen de búsqueda móvil con input, resultados agrupados por tipo, navegación por teclado.
  - [x] `DashboardLayout.tsx` (331 líneas) — orquestador: auth bootstrap, session timeout, nav filtering, mobile header/nav, SmartHeaderBar, Cmd+K shortcut.

### 12. `frontend/src/components/layout/SmartHeaderBar.tsx` — 582 → 251 líneas ✅
- **Resultado:** refactorizado el 2026-04-15.
  - [x] `smart-header-bar.config.ts` (230 líneas) — tipos (DashboardCounts, KpiChip, AlertSummary), constantes (SEVERITY_STYLE, SEVERITY_LABEL, NON_CLINICAL_PREFIXES), funciones puras (getChipsForRoute, isChipActive).
  - [x] `AlertPopover.tsx` (150 líneas) — componente con queries de alertas, badge, popover con lista, navegación por teclado.
  - [x] `SmartHeaderBar.tsx` (251 líneas) — orquestador: KPI chips mobile/desktop, search trigger, quick create dropdown, AlertPopover.

### 13. `backend/src/conditions/conditions.service.ts` — 581 → 514 líneas ✅
- **Resultado:** refactorizado el 2026-04-15.
  - [x] `conditions-helpers.ts` (76 líneas) — funciones puras: normalizeConditionName, sanitizeStringArray, mergeUniqueStrings, parseStringArray, toConditionResponse, getInstanceId.
  - [x] `conditions.service.ts` (514 líneas) — CRUD global/local, merge, suggest, importCsv, logSuggestion.

### 14. ✅ `frontend/src/app/(dashboard)/pacientes/page.tsx` — 565 → 383 líneas
- [x] `pacientes.constants.ts` (42 líneas) — SEXO_OPTIONS, PREVISION_OPTIONS, COMPLETENESS_OPTIONS, SORT_OPTIONS, PatientFilters interface.
- [x] `PatientsFilterPanel.tsx` (181 líneas) — Panel de filtros avanzados con exportación CSV.
- [x] `page.tsx` (383 líneas) — Orquestador con query, summary cards, search, lista de pacientes, paginación.

### 15. ✅ `frontend/src/app/(dashboard)/page.tsx` — 562 → 377 líneas
- [x] `dashboard.constants.ts` (81 líneas) — DashboardData interface, ADMIN_CARDS, sectionAnimation, getGreeting.
- [x] `OverdueAlertSection.tsx` (61 líneas) — Alerta de tareas atrasadas.
- [x] `RecentActivitySection.tsx` (91 líneas) — Tabla de actividad reciente.
- [x] `page.tsx` (377 líneas) — Orquestador con vista admin, vista clínica, hero, encounters en curso, seguimientos.

### 16. ✅ `frontend/src/types/index.ts` — 551 → 2 líneas (barrel)
- [x] `patient.types.ts` (224 líneas) — Patient, PatientHistory, PatientProblem, PatientTask, PatientClinicalSummary, PatientAdminSummary, labels de paciente.
- [x] `encounter.types.ts` (334 líneas) — Encounter, EncounterSection, SectionKey, section data types, Attachment, Condition, labels de encounter.
- [x] `index.ts` (2 líneas) — Barrel re-export. 57 archivos consumidores sin cambios.

### 17. ✅ `frontend/src/app/(dashboard)/admin/auditoria/page.tsx` — 521 → 379 líneas
- [x] `auditoria.constants.ts` (91 líneas) — AuditLogEntry, AdminUserRow interfaces, ACTION_LABELS, ENTITY_LABELS, RESULT_LABELS, REASON_LABELS.
- [x] `AuditDetailModal.tsx` (88 líneas) — Modal de detalle de auditoría con diff redactado.
- [x] `page.tsx` (379 líneas) — Orquestador con filtros, métricas, tabla, paginación.

### 18. ✅ `backend/src/auth/auth.service.ts` — 521 → 463 líneas
- [x] `auth-totp.service.ts` (75 líneas) — Injectable con setup2FA, enable2FA, disable2FA. Inyectado en AuthController.
- [x] `auth.service.ts` (463 líneas) — Login, registro, refresh, revoke, verify2FALogin, issueTokens, lockout.
- [x] `auth.module.ts` — AuthTotpService registrado como provider.
- **Nota:** verify2FALogin se mantiene en AuthService porque requiere el método privado issueTokens. 137 unit + 167 e2e tests verdes.

---

## Prioridad 3 — Moderados (300–500 líneas)

### 19. ✅ `frontend/src/app/(dashboard)/admin/catalogo/page.tsx` — 496 → 307 líneas
- [x] `CatalogImportPanel.tsx` (201 líneas) — Panel de importación CSV/manual con formulario y drag-and-drop.
- [x] `page.tsx` (307 líneas) — Orquestador con búsqueda, tabla, paginación.

### 20. ✅ `frontend/src/app/(dashboard)/atenciones/page.tsx` — 484 → 446 líneas
- [x] `atenciones.constants.ts` (48 líneas) — STATUS_CONFIG, FILTER_TABS, FilterTab type, EncounterListFilters interface.
- [x] `page.tsx` (446 líneas) — Orquestador con filtros, summary, lista, paginación.

### 21. ✅ `frontend/src/components/sections/TratamientoSection.tsx` — 476 → 428 líneas
- [x] `LinkedAttachmentBlock.tsx` (88 líneas) — Componente de adjuntos vinculados a órdenes estructuradas.
- [x] `TratamientoSection.tsx` (428 líneas) — Formulario de tratamiento con medicamentos, órdenes, derivaciones.

### 22. ✅ `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx` — 475 → 426 líneas
- [x] `editar.constants.ts` (53 líneas) — EditForm type, buildEditSchema(isDoctor) con validación Zod.
- [x] `page.tsx` (426 líneas) — Formulario de edición con imports actualizados.

### 23. ✅ `frontend/src/app/register/page.tsx` — 474 → 432 líneas
- [x] `register.constants.tsx` (52 líneas) — RegisterRole, ROLE_OPTIONS, registerSchema, RegisterForm, REGISTER_DRAFT_KEY, REGISTER_BOOTSTRAP_CHIPS, REGISTER_INVITATION_CHIPS.
- [x] `page.tsx` (432 líneas) — Formulario de registro con imports actualizados.

### 24. ✅ `frontend/src/components/EncounterDrawer.tsx` — 467 → 397 líneas
- [x] `encounter-drawer.constants.ts` (81 líneas) — Clases CSS (SURFACE_PANEL_CLASS, INNER_PANEL_CLASS, TOOLBAR_BUTTON_CLASS, TOOLBAR_PRIMARY_BUTTON_CLASS), SIDEBAR_TABS, SidebarTabKey, formatters (formatDateTime, formatCompactDate), EncounterDrawerProps.
- [x] `EncounterDrawer.tsx` (397 líneas) — Re-exporta SidebarTabKey para useEncounterWizard.ts.

### 25. ✅ `frontend/src/__tests__/app/atencion-cierre.test.tsx` — 436 → 297 líneas
- [x] `atencion-cierre.fixtures.ts` (140 líneas) — authStoreState, encounterResponse (fixture completo con 6 secciones).
- [x] `atencion-cierre.test.tsx` (297 líneas) — Imports de fixtures.

### 26. ✅ `backend/src/attachments/attachments.service.ts` — 426 → 361 líneas
- [x] `attachments-helpers.ts` (80 líneas) — SIGNATURE_BYTES_TO_READ, SUPPORTED_MIME_TYPES, LINKABLE_ORDER_FIELDS, tipos (LinkedOrderType, AttachmentMetadata, StructuredOrder), sanitizeFilename, normalizeMimeType, detectMimeFromSignature.
- [x] `attachments.service.ts` (361 líneas) — CRUD con imports de helpers.

### 27. ✅ `frontend/src/__tests__/app/paciente-detalle.test.tsx` — 412 → 240 líneas
- [x] `paciente-detalle.fixtures.ts` (121 líneas) — basePatientResponse, baseEncounterListPage1/2, baseClinicalSummary, emptyClinicalSummary, emptyEncounterList.
- [x] `paciente-detalle.test.tsx` (240 líneas) — Patrón spread overrides para variantes.

### 28. ✅ `backend/src/mail/mail.service.ts` — 408 → 298 líneas
- [x] `mail-helpers.ts` (102 líneas) — Tipos (InvitationRole, InvitationEmailPayload, InvitationEmailResult, MailSettingsOverrides, ResolvedMailSettings), DEFAULT_INVITATION_SUBJECT, funciones puras (pickValue, parsePort, parseBoolean, normalizePublicUrl, escapeHtml, formatFromAddress, buildLogoUrl, renderTemplate).
- [x] `mail.service.ts` (298 líneas) — sendInvitation, resolveSettings, buildDefaultInvitationHtml con imports de helpers.

### 29. ✅ `backend/src/auth/auth.service.spec.ts` — 416 → 340 líneas
- [x] `auth.service.spec.fixtures.ts` (87 líneas) — mockUser, mockSession, createMockServices() factory (7 mock services).
- [x] `auth.service.spec.ts` (340 líneas) — Imports fixtures, usa createMockServices() + destructuring en beforeEach.

### 30. ✅ `backend/src/patients/patients-pdf.service.ts` — 400 → 296 líneas
- [x] `patients-pdf-helpers.ts` (90 líneas) — Constantes (SEXO_MAP, PREVISION_MAP, PDF_LOCALE, PDF_TIME_ZONE), funciones puras (formatRutDisplay, formatSospechaDiagnosticaLabel, buildSectionsMap, getTreatmentPlanText, formatHistoryFieldText, formatDateTime).
- [x] `patients-pdf.service.ts` (296 líneas) — generateLongitudinalPdf + buildDocumentBuffer con imports de helpers.

### 31. ✅ `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx` — 394 → 333 líneas
- [x] `nuevo.constants.ts` (53 líneas) — basePatientSchema, fullPatientSchema (Zod), PatientForm type, shared rutExemptRefine.
- [x] `page.tsx` (333 líneas) — Formulario con imports actualizados.

### 32. `backend/src/prisma/prisma.service.ts` — 361 líneas — Aceptable ⏭️
- Servicio de infraestructura singleton. SQLite pragmas, health checks, backup status. No se justifica extraer.

### 33. ✅ `frontend/src/components/sections/ExamenFisicoSection.tsx` — 347 → 258 líneas
- [x] `examen-fisico.constants.ts` (95 líneas) — BODY_PARTS, ESTADO_GENERAL_OPTIONS, VitalAlert interface, getVitalAlerts (alertas de signos vitales), calculateImc.
- [x] `ExamenFisicoSection.tsx` (258 líneas) — Formulario con imports actualizados.

### 34. ✅ `backend/src/audit/audit.service.ts` — 341 → 163 líneas
- [x] `audit-helpers.ts` (137 líneas) — Constantes (DATE_ONLY_PATTERN, ISO_DATE_TIME_PATTERN, CLINICAL_ENTITY_TYPES, SAFE_CLINICAL_STRING_KEYS, SENSITIVE_FIELDS), LogInput interface, funciones puras (parseDateFilter, sanitizeDiff, minimizeClinicalDiff, summarizeClinicalValue, shouldKeepClinicalStringValue).
- [x] `audit.service.ts` (163 líneas) — log, findAll, findByEntity, findByUser, verifyChain con imports de helpers.

---

## Estrategia de ejecución

1. **No romper nada** — cada refactor debe pasar los tests existentes.
2. **Un monolito a la vez** — PR individual por archivo refactorizado.
3. **Empezar por frontend** — impacto visual inmediato, menos riesgo.
4. **Orden sugerido:** `atenciones/[id]/page.tsx` → `pacientes/[id]/page.tsx` → `ajustes/page.tsx` → `encounters.service.ts` → `patients.service.ts` → `app.e2e-spec.ts`.
5. **Criterio de éxito:** ningún archivo > 500 líneas (excepto tests e2e < 800).
