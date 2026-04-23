# Archivos a dividir

Documento de seguimiento para ir partiendo archivos grandes y marcar el avance a medida que se vayan reduciendo.

Convención:
- [ ] pendiente de split
- [x] ya revisado o dividido

## Backend

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
- [x] frontend/src/app/(dashboard)/page.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/[id]/editar/EditarPacienteFormSections.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/[id]/page.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx
- [ ] frontend/src/app/(dashboard)/pacientes/page.tsx
- [ ] frontend/src/app/(dashboard)/seguimientos/page.tsx
- [ ] frontend/src/app/login/page.tsx
- [ ] frontend/src/app/register/page.tsx
- [x] frontend/src/components/EncounterDrawer.tsx
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

- [x] ANAMNEO_AUDIT.md
- [ ] UI/UX_REFERENCE.jsx
