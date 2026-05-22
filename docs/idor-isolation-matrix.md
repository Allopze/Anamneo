# Matriz IDOR / aislamiento por endpoint

Esta matriz cubre endpoints con parametros `:id`, `:patientId`, `:encounterId`
o equivalentes. El criterio base es que un medico/asistente no debe leer ni
mutar recursos clinicos fuera de su `effectiveMedicoId`; admin solo accede a
superficies administrativas o regulatorias explicitas.

## Cobertura automatizada

| Recurso | Endpoint(s) | Regla esperada | Prueba |
|---|---|---|---|
| Paciente clinico | `GET /api/patients/:id` | medico externo recibe 404 | `backend/test/suites/validation-isolation.e2e-suite.ts` |
| Paciente vistas derivadas | `GET /api/patients/:id/encounters`, `GET /api/patients/:id/operational-history`, `GET /api/patients/:id/clinical-summary` | medico externo recibe 403/404 o lista vacia segun endpoint | `validation-id-isolation.helpers.ts` |
| Paciente historia/admin | `PUT /api/patients/:id/history`, `PUT /api/patients/:id/admin`, `PUT /api/patients/:id` | medico externo recibe 404 antes de mutar | `validation-id-isolation.helpers.ts` |
| Paciente operaciones | `POST /api/patients/:id/merge`, `POST /api/patients/:id/verify-demographics`, `POST /api/patients/:id/restore`, `DELETE /api/patients/:id` | recurso externo recibe 400/403/404 y no se elimina | `validation-id-isolation.helpers.ts` |
| Paciente export/bundle/delete | `GET /api/patients/:id/export/pdf`, `GET /api/patients/:id/export/bundle`, `DELETE /api/patients/:id` | usa `assertPatientAccess`; medico externo recibe 403/404 | `validation-id-isolation.helpers.ts` |
| Paciente regulatorio | `GET /api/patients/:id/export/regulatory`, `DELETE /api/patients/:id/purge` | admin-only via `AdminGuard`; medico recibe 403/404 | `validation-id-isolation.helpers.ts` |
| Encuentro lectura/export | `GET /api/encounters/:id`, `GET /api/encounters/:id/export/pdf`, `GET /api/encounters/:id/export/document/:kind`, `GET /api/encounters/:id/audit` | medico externo recibe 403/404 | `validation-isolation.e2e-suite.ts` |
| Encuentro mutacion | `POST /api/encounters/:id/duplicate`, `PUT /api/encounters/:id/sections/:sectionKey`, `POST /api/encounters/:id/reconcile-identification`, `POST /api/encounters/:id/complete`, `POST /api/encounters/:id/sign`, `POST /api/encounters/:id/reopen`, `POST /api/encounters/:id/cancel`, `PUT /api/encounters/:id/review-status` | medico externo recibe 403/404 antes de mutar | `validation-isolation.e2e-suite.ts` |
| Encuentro por paciente | `POST /api/encounters/patient/:patientId`, `GET /api/encounters/patient/:patientId` | paciente fuera de scope recibe 404/lista vacia | `validation-isolation.e2e-suite.ts` |
| Adjuntos | `GET /api/attachments/encounter/:encounterId`, `GET /api/attachments/:id/download`, `DELETE /api/attachments/:id` | medico externo recibe 403/404 | `validation-isolation.e2e-suite.ts` |
| Problemas/tareas | `POST /api/patients/:id/problems`, `POST /api/patients/:id/tasks`, `PUT /api/patients/problems/:problemId`, `PUT /api/patients/tasks/:taskId` | recurso externo recibe 400/404; no aparece en vistas derivadas | `validation-isolation.e2e-suite.ts` |
| Consentimientos | `GET /api/consents/patient/:patientId`, `POST /api/consents/:id/revoke` | externo no lista y no revoca | `validation-isolation.e2e-suite.ts` |
| Alertas | `GET /api/alerts/patient/:patientId`, `POST /api/alerts/:id/acknowledge` | externo no lista y no confirma | `validation-isolation.e2e-suite.ts` |
| Templates | `PUT /api/templates/:id`, `DELETE /api/templates/:id` | scoped por `medicoId` efectivo; no aparece en listado ajeno | `validation-id-isolation.helpers.ts` |
| Condiciones locales | `PUT /api/conditions/local/:id`, `DELETE /api/conditions/local/:id` | scoped por `medicoId` efectivo; no aparece en busqueda ajena | `validation-id-isolation.helpers.ts` |
| Catalogos globales | `conditions/:id`, `medications/:id`, `users/:id`, `legal/admin/documents/:id` | admin-only o lectura global no-PHI | suites admin/catalogo existentes |
| Sesiones propias | `DELETE /api/auth/sessions/:id` | usuario solo revoca sesiones propias | `auth-session.e2e-suite.ts` |

## Gaps restantes

- Agregar endpoints nuevos a `expectPatientIdIsolation` o helper equivalente
  cuando se incorpore cualquier recurso clinico con `:id`, `:patientId` o
  `:encounterId`.
- Mantener esta matriz actualizada cuando se agregue cualquier ruta nueva con
  `:id`, `:patientId` o `:encounterId`.
