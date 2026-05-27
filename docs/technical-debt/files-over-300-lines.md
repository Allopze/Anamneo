# Archivos a dividir

Documento de seguimiento para ir partiendo archivos grandes y marcar el avance a medida que se vayan reduciendo.

Convención:
- [ ] pendiente de split
- [x] ya revisado o dividido

## Snapshot prioritario 2026-05-26

Archivos productivos por encima del umbral recomendado de 300 lineas. No quedan archivos productivos de `backend/src`, `frontend/src` o `shared` sobre 500 lineas en este snapshot; quedan tests heredados sobre 500 listados mas abajo como deuda separada.

| Prioridad | Lineas | Archivo | Split sugerido |
| --- | ---: | --- | --- |
| P1 | 462 | `frontend/src/app/register/page.tsx` | pasos, validacion, llamadas API, estado del wizard; `RegisterPasswordFields` ya extraido |
| P1 | 431 | `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts` | persistencia local/remota, rehidratacion y eventos de estado |
| P2 | 476 | `backend/src/patient-portal/patient-portal.service.ts` | auth portal, solicitudes, descargas y consentimiento; auditoria ya extraida |
| P2 | 460 | `backend/src/patients/patients-merge-mutation.helpers.ts` | validaciones/merge de identificadores, auditoria y payloads |
| P2 | 450 | `frontend/src/app/(dashboard)/pacientes/page.tsx` | filtros, tabla/lista, acciones y estados vacios |
| P2 | 447 | `frontend/src/app/(dashboard)/atenciones/page.tsx` | filtros/lista, acciones y componentes de estado |
| P2 | 445 | `frontend/src/app/(dashboard)/pacientes/[id]/editar/EditarPacienteFormSections.tsx` | secciones demograficas, contacto, representante, validaciones |
| P2 | 445 | `frontend/src/app/(dashboard)/admin/solicitudes/page.tsx` | filtros, detalle, acciones y estados DSAR |
| P2 | 442 | `frontend/src/app/login/LoginClient.tsx` | credenciales, 2FA, reset y errores |
| P2 | 389 | `backend/src/legal/legal.service.ts` | seguir bajando hacia 300; helpers internos extraidos |
| P2 | 387 | `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts` | reducer/maquina de estados de guardado |
| P2 | 378 | `backend/src/mail/mail.service.ts` | seguir bajando hacia 300; templates extraidos a helpers |
| P2 | 376 | `frontend/src/app/(dashboard)/agenda/page.tsx` | grid semanal y queries; modales/tipos ya extraidos |
| P2 | 311 | `backend/src/audit/audit.service.ts` | retencion/consultas restantes; integridad ya extraida a `audit-integrity.ts` |

## Backend

- [x] backend/src/audit/audit.service.ts (bajo de 500; integridad extraida a `audit-integrity.ts`, pendiente seguir bajando hacia 300)
- [x] backend/src/legal/legal.service.ts (bajo de 500; helpers extraidos a `legal-service-helpers.ts`, pendiente seguir bajando hacia 300)
- [x] backend/src/mail/mail.service.ts (bajo de 500; templates extraidos a `mail-auth-templates.ts` y `mail-notification-templates.ts`, pendiente seguir bajando hacia 300)
- [x] backend/src/patient-portal/patient-portal.service.ts (bajo de 500; auditoria portal extraida a `patient-portal-audit-log.service.ts`, pendiente seguir bajando hacia 300)
- [x] backend/src/alerts/alerts.service.ts
- [x] backend/src/analytics/clinical-analytics-summary.ts
- [x] backend/src/analytics/clinical-analytics.helpers.spec.ts
- [x] backend/src/analytics/clinical-analytics-encounter-parser.ts
- [x] backend/src/auth/auth.service.spec.ts
- [x] backend/src/auth/auth.service.ts
- [x] backend/src/attachments/attachments.service.ts
- [x] backend/src/common/__tests__/dto-validation.spec.ts
- [x] backend/src/conditions/conditions-similarity.service.ts
- [x] backend/src/conditions/conditions.service.ts
- [x] backend/src/encounters/encounters-clinical-structures.ts
- [x] backend/src/encounters/encounters-pdf.renderers.ts
- [x] backend/src/encounters/encounters-sanitize-clinical.ts
- [x] backend/src/encounters/encounters-sanitize-intake.ts
- [x] backend/src/encounters/encounters-workflow-complete-sign.spec.ts
- [x] backend/src/main.ts
- [x] backend/src/medications/medications-csv-parser.ts
- [x] backend/src/patients/patients-clinical-mutations.spec.ts
- [x] backend/src/patients/patients.controller.ts
- [x] backend/src/patients/patients-demographics-mutations.spec.ts
- [x] backend/src/patients/patients-demographics-mutations.ts
- [x] backend/src/patients/patients-format.ts
- [x] backend/src/patients/patients-lifecycle-mutations.ts
- [x] backend/src/patients/patients-merge-mutation.ts
- [x] backend/src/patients/patients.service.ts
- [x] backend/src/prisma/prisma.service.ts
- [x] backend/src/users/users.service.ts
- [x] backend/test/suites/analytics.e2e-suite.ts
- [x] backend/test/suites/auth.e2e-suite.ts
- [x] backend/test/suites/encounters/encounters-followup.e2e-group.ts
- [x] backend/test/suites/encounters/encounters-sections.e2e-group.ts
- [x] backend/test/suites/patients.e2e-suite.ts
- [x] backend/test/suites/validation.e2e-suite.ts
- [ ] backend/test/suites/validation-isolation.e2e-suite.ts
- [ ] backend/test/suites/encounters/encounters-followup-export-review.e2e-group.ts

## Frontend

- [ ] frontend/src/__tests__/app/ajustes.test.tsx
- [ ] frontend/src/__tests__/app/atencion-cierre.test.tsx
- [ ] frontend/src/__tests__/app/atencion-ficha.test.tsx
- [ ] frontend/src/__tests__/app/clinical-analytics-page.test.tsx
- [ ] frontend/src/__tests__/app/paciente-detalle.test.tsx
- [ ] frontend/src/app/(dashboard)/ajustes/EmailTab.tsx
- [ ] frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx
- [ ] frontend/src/app/(dashboard)/ajustes/SystemTab.tsx
- [ ] frontend/src/app/(dashboard)/analitica-clinica/page.tsx
- [ ] frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx
- [ ] frontend/src/app/(dashboard)/atenciones/[id]/EncounterSectionRail.tsx
- [ ] frontend/src/app/(dashboard)/atenciones/[id]/page.tsx
- [ ] frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts
- [ ] frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts
- [ ] frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts
- [ ] frontend/src/app/(dashboard)/atenciones/page.tsx
- [x] frontend/src/app/(dashboard)/agenda/page.tsx (bajo de 500; modales y tipos extraidos, pendiente seguir bajando hacia 300)
- [x] frontend/src/app/(dashboard)/page.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/[id]/editar/EditarPacienteFormSections.tsx
- [x] frontend/src/app/(dashboard)/pacientes/[id]/page.tsx (bajo a 123; header/acciones extraidos a `PatientDetailHeader`, columna lateral a `PatientDetailSidebar`)
- [ ] frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/page.tsx
- [ ] frontend/src/app/(dashboard)/seguimientos/page.tsx
- [ ] frontend/src/app/login/page.tsx
- [ ] frontend/src/app/register/page.tsx (bajo de 500; pendiente seguir bajando hacia 300)
- [x] frontend/src/components/EncounterDrawer.tsx
- [x] frontend/src/components/PatientDataProcessingConsents.tsx (bajo a 208; formulario, historial, modal de revocacion y constantes/tipos extraidos)
- [x] frontend/src/components/layout/DashboardLayout.tsx
- [x] frontend/src/components/layout/DashboardSidebar.tsx
- [ ] frontend/src/components/sections/RespuestaTratamientoSection.tsx
- [x] frontend/src/components/sections/StructuredMedicationsEditor.tsx
- [ ] frontend/src/components/sections/TratamientoSection.tsx
- [ ] frontend/src/lib/encounter-completion.ts
- [ ] frontend/src/types/encounter.types.ts
- [ ] frontend/tests/e2e/encounter-draft-recovery.spec.ts
- [ ] frontend/tests/e2e/workflow-clinical.spec.ts

## Documentación y referencias

- [x] docs/audits/technical-production-audit-2026-05-22.md
- [ ] UI/UX_REFERENCE.jsx
