# Auditoría técnica y funcional de Anamneo

Fecha: 2026-04-21

## Estado de remediación en esta rama

- 2026-04-22, pasada 1: corregido el aislamiento de consentimientos y alertas paciente-nivel entre médicos cuando `encounterId` es `null`.
- 2026-04-22, pasada 1: alineada la capa de analytics para excluir también alertas paciente-nivel de otro médico.
- 2026-04-22, pasada 1: agregado coverage unitario y E2E para esos casos.
- 2026-04-22, pasada 2: recuperado el smoke E2E frontend moviendo el workspace de Playwright dentro de `backend/`, manteniendo activo el guard de upload root.
- 2026-04-22, pasada 3: corregido el drift de `SQLITE_BACKUP_DIR` para ejecuciones desde raíz del repo y desde `backend/`.
- 2026-04-22, pasada 4: alineados los fixtures unitarios de export/PDF con la política vigente de completitud del paciente (`fechaNacimiento` requerida).
- 2026-04-22, pasada 5: backend `lint:check` en verde y cobertura unitaria explícita para el fallback de scope en problemas/tareas legacy.
- 2026-04-22, pasada 6: endurecida la validación DTO de consentimientos y alertas con `UUID`, `trim` y límites de longitud, más cobertura unitaria dedicada.
- 2026-04-22, pasada 7: agregado script operativo de backfill para `patient_problems` y `encounter_tasks` legacy sin `medicoId`, con `dry-run` por defecto y `--apply` explícito.
- 2026-04-22, pasada 8: endurecido el bootstrap de sesión frontend para preservar sesión local solo en errores de red sin respuesta, no ante `5xx` del backend.
- 2026-04-22, pasada 9: eliminada la compatibilidad legacy para problemas y tareas sin `medicoId`, junto con el backfill asociado, porque no existen datos previos que conservar.
- 2026-04-22, pasada 10: endurecidos los DTOs de analytics para limitar filtros libres y exigir que `focusType` y `focusValue` viajen juntos en `/clinical/cases`.
- 2026-04-22, pasada 11: endurecido el DTO de revisión de atenciones para exigir nota válida cuando un médico marca una atención como revisada.
- 2026-04-22, pasada 12: endurecidos DTOs clínicos de severidad media (adjuntos, plantillas, guardado de sugerencias, cierre de atención y registro rápido de paciente) con `trim`, normalización de blancos y mínimos cuando aplica.
- 2026-04-22, pasada 13: endurecidos DTOs clínicos de alta prioridad para historial maestro de paciente, motivo de “no aplica” en secciones y firma de atención, con cobertura unitaria y revalidación E2E.
- 2026-04-22, pasada 14: acotado `UpdateSectionDto.data` con validación mínima de payload (objeto plano, máximo de campos de primer nivel y tamaño serializado), manteniendo el sanitizado clínico por sección.
- Estado después de esta pasada: el veredicto general se mantiene en `Casi lista para producción chica`, con foco ya puesto en validación final y no en compatibilidad hacia atrás.

## 1. Resumen ejecutivo

Audité el repositorio completo con foco en una EMR/EHR pequeña para 1 a 5 usuarios reales. Revisé arquitectura, auth, permisos, modelo clínico, flujos de pacientes y atenciones, adjuntos, consentimientos, alertas, analytics, scripts SQLite, entorno, build y tests.

La base del proyecto es buena para una app chica: el backend arranca con guardrails de configuración, la autenticación usa cookies `HttpOnly` con `sameSite: 'strict'`, hay validación fuerte en backend, existe bitácora de auditoría, hay bloqueo de emisión/cierre cuando la ficha maestra está incompleta, hay backup/restore drill SQLite y la cobertura E2E backend es inusualmente buena para el tamaño del producto.

La señal de “lista para salir” quedó casi limpia. El hueco principal de permisos en consentimientos/alertas paciente-nivel ya quedó corregido en esta rama, la regresión del harness E2E frontend también, el drift operativo de backups SQLite también, los tests unitarios de export/PDF ya volvieron a estar alineados y el backend quedó en verde en lint, typecheck, tests y E2E. Además, el bootstrap de sesión frontend ya no conserva permisos/rol locales ante `5xx` del backend: esa tolerancia quedó limitada a errores de red sin respuesta. Dado que no existen datos previos que conservar, también se eliminó la compatibilidad legacy para problemas y tareas sin `medicoId`, simplificando el scope clínico. En analytics, los filtros libres ya no aceptan cadenas arbitrariamente grandes y el endpoint de casos dejó de tolerar focos incompletos. En workflow clínico, la revisión médica ya no acepta una “nota” vacía que recién falle más abajo en negocio: ese contrato quedó movido al DTO. En las últimas pasadas también se endurecieron DTOs clínicos medios y altos, y ahora además se limitó el tamaño/forma del payload de secciones para reducir superficie de entrada blanda antes del sanitizado. Para una producción chica y restringida, la app ya está cerca de estar lista.

Riesgo global: Medio.

Conclusión corta: la considero casi lista para producción pequeña y restringida, con una validación manual final y algunos endurecimientos menores todavía recomendables.

### Validación ejecutada

| Check | Resultado | Observación |
|---|---|---|
| `npm --prefix backend run typecheck` | OK | Sin errores |
| `npm --prefix frontend run typecheck` | OK | Sin errores |
| `npm --prefix backend run test -- --runInBand` | OK | 53 suites, 299 tests en verde |
| `npm --prefix backend run test -- --runInBand src/common/__tests__/dto-validation.spec.ts` | OK | 54 tests en verde, incluyendo consentimientos, alertas, analytics, review workflow y hardening de payload en secciones |
| `npm --prefix frontend run test -- --runInBand` | OK | 59 suites, 288 tests |
| `npm --prefix frontend run test -- --runInBand src/__tests__/lib/session-bootstrap.test.ts src/__tests__/components/dashboard-layout.analytics-navigation.test.tsx` | OK | 2 suites, 8 tests en verde |
| `npm --prefix backend run lint:check` | OK | Sin errores |
| `npm --prefix frontend run lint` | OK | Sin errores |
| `npm --prefix backend run build` | OK | Compila |
| `npm --prefix frontend run build` | OK | Build de producción exitosa |
| `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` | OK | 219 tests E2E en verde |
| `PLAYWRIGHT_FRONTEND_PORT=5565 PLAYWRIGHT_BACKEND_PORT=5688 npm --prefix frontend run test:e2e:smoke` | OK | 2 tests smoke en verde tras mover workspace E2E dentro de `backend/` |
| `cd backend && node scripts/sqlite-monitor.js` | OK | Backup dir resuelto correctamente a `backend/prisma/backups` |
| `npm --prefix backend run db:sqlite:restore:drill` | OK | Restore drill pasó |
| `npm --prefix backend run db:sqlite:monitor` | OK | Estado `ok` |
| `npm --prefix backend run audit:prod` | OK | 0 vulnerabilidades altas/críticas |
| `npm --prefix frontend run audit:prod` | OK | 0 vulnerabilidades altas/críticas |
| `curl http://127.0.0.1:5678/api/health` | OK | Health responde |
| `curl -I http://127.0.0.1:5555` | OK | Frontend redirige a login sin sesión |

## 2. Veredicto de producción

### Casi lista para producción chica

El criterio aplicado sigue siendo el correcto para una app pequeña de 1 a 5 usuarios, no para un SaaS enterprise.

La dejaría pasar a una producción chica y restringida con tres cautelas concretas:

1. Conviene hacer una prueba manual final en el entorno objetivo para confirmar login, alta de paciente, atención, adjuntos y exportación completa.
2. Conviene confirmar en el entorno objetivo que backup, restore drill y monitor escriben exactamente donde esperas.
3. Sigue siendo razonable decidir si el smoke E2E actual basta para release o si quieres una corrida Playwright más amplia por tranquilidad adicional.

No veo hoy un blocker técnico rojo comparable al que había al inicio de la auditoría.

## 3. Hallazgos críticos y altos

No encontré un hallazgo crítico comprobado que por sí solo vuelva inviable el uso. Los hallazgos altos detectados al inicio de la auditoría ya quedaron corregidos en esta rama; lo pendiente ahora es de robustez y validación final, no de aislamiento clínico roto ni de compatibilidad hacia atrás.

| Severidad | Título | Archivo(s) afectados | Descripción | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|---|
| Alto | Consentimientos a nivel paciente podían filtrarse y revocarse entre médicos | `backend/src/consents/consents.service.ts` | `findByPatient()` aceptaba cualquier consentimiento con `encounterId: null` para cualquier médico con acceso al paciente, y `revoke()` solo endurecía el control cuando existía `encounterId`. | Riesgo de privacidad clínica y de trazabilidad. | Corregido en esta rama usando ownership por médico efectivo del creador (`grantedById` o `grantedBy.medicoId`) y nuevo coverage E2E. Mantener como riesgo resuelto pendiente de merge. | Medio |
| Alto | Alertas a nivel paciente sin `encounter` podían filtrarse y contaminar el inbox clínico | `backend/src/alerts/alerts.service.ts`, `backend/src/analytics/clinical-analytics.read-model.ts` | `findByPatient()`, `countUnacknowledged()`, `findRecentUnacknowledged()` y analytics aceptaban `{ encounterId: null }` para cualquier médico con acceso al paciente. | Riesgo clínico real: inbox y summary podían contar alertas ajenas. | Corregido en esta rama usando ownership por médico efectivo del creador (`createdById` o `createdBy.medicoId`) y nuevo coverage E2E/unitario. Mantener como riesgo resuelto pendiente de merge. | Medio |
| Moderado | Persisten algunos endurecimientos de entrada y validaciones finales por cerrar | `backend/src/**/dto/*.ts`, `frontend/tests/e2e/*.ts` | Los riesgos principales de permisos y compatibilidad ya quedaron resueltos, pero todavía hay espacio para endurecer otros DTO clínicos y decidir el nivel exacto de validación final previo al release. | Riesgo operativo moderado y acotado, más de robustez que de privacidad. | Completar el barrido de DTOs clínicos restantes y cerrar la estrategia final de validación pre-release. | Bajo |

## 4. Bugs e inconsistencias funcionales

### Comprobados

1. El smoke E2E frontend aislado ya volvió a pasar en esta rama; el bloqueo de validación frontend dejó de estar vigente.
   Evidencia: `frontend/playwright.config.ts` ahora crea el workspace E2E dentro de `backend/` y `PLAYWRIGHT_FRONTEND_PORT=5565 PLAYWRIGHT_BACKEND_PORT=5688 npm --prefix frontend run test:e2e:smoke` pasó con 2 tests en verde.

2. La suite unitaria backend de export/PDF ya quedó alineada con la política clínica actual de completitud en esta rama.
   Evidencia: `npm --prefix backend run test -- --runInBand src/patients/patients-export-bundle.service.spec.ts src/patients/patients-pdf.service.spec.ts` pasó con 6 tests en verde tras agregar `fechaNacimiento` a los fixtures verificados.

3. La ruta efectiva de backups SQLite ya quedó alineada en esta rama tanto desde raíz del repo como desde `backend/`.
   Evidencia: `cd backend && node scripts/sqlite-monitor.js` resolvió `backupDir` a `backend/prisma/backups`, sin duplicar `backend/backend`.

### Probables / de riesgo moderado

4. El frontend ya no conserva sesión local ante `5xx` del backend; solo la preserva cuando Axios hizo la request pero no recibió respuesta.
   Evidencia: `frontend/src/lib/session-bootstrap.ts` ya no trata respuestas `5xx` como sesión preservable, `frontend/src/components/layout/DashboardLayout.tsx` ajustó el mensaje a “problema de red”, `src/__tests__/lib/session-bootstrap.test.ts` cubre el contrato y el smoke E2E siguió en verde.

5. La validación DTO de consentimientos y alertas ya quedó endurecida en esta rama.
   Evidencia: `backend/src/consents/dto/consent.dto.ts` y `backend/src/alerts/dto/alert.dto.ts` ahora validan `patientId` y `encounterId` como UUID, recortan espacios y limitan longitud en `description`, `reason`, `title` y `message`; además `src/common/__tests__/dto-validation.spec.ts` cubre ese contrato.

6. Analytics ya no acepta filtros de foco incompletos en `/clinical/cases`.
   Evidencia: `backend/src/analytics/dto/clinical-analytics-query.dto.ts` y `backend/src/analytics/dto/clinical-analytics-cases-query.dto.ts` ahora limitan la longitud de `condition` y `focusValue`, y exigen que `focusType` y `focusValue` vayan juntos; `src/common/__tests__/dto-validation.spec.ts` cubre ambos casos inválidos.

7. La revisión de atenciones ya no permite marcar `REVISADA_POR_MEDICO` sin una nota válida desde la capa DTO.
   Evidencia: `backend/src/encounters/dto/update-review-status.dto.ts` ahora recorta la nota, exige mínimo de 10 caracteres cuando `reviewStatus = REVISADA_POR_MEDICO` y mantiene la nota opcional para otros estados; `src/common/__tests__/dto-validation.spec.ts` cubre el caso inválido y el opcional válido.

8. El endurecimiento de DTOs clínicos medios ya quedó aplicado en esta rama.
   Evidencia: `backend/src/attachments/dto/upload-attachment.dto.ts` normaliza metadatos opcionales en blanco; `backend/src/templates/dto/template.dto.ts` recorta y evita campos vacíos en create/update; `backend/src/conditions/dto/save-suggestion.dto.ts` exige texto de entrada no vacío tras recorte y sanea snapshots opcionales; `backend/src/encounters/dto/complete-encounter.dto.ts` recorta y exige mínimo de longitud cuando se informa nota de cierre; `backend/src/patients/dto/create-patient-quick.dto.ts` recorta y normaliza `rut` y `rutExemptReason`; `src/common/__tests__/dto-validation.spec.ts` cubre todos estos contratos.

9. El endurecimiento de DTOs clínicos de alta prioridad ya quedó aplicado en esta rama.
   Evidencia: `backend/src/patients/dto/update-patient-history.dto.ts` ahora valida objetos anidados de historial con texto/listas saneadas y límites de tamaño; `backend/src/encounters/dto/update-section.dto.ts` ahora exige y acota `notApplicableReason` cuando corresponde; `backend/src/encounters/dto/sign-encounter.dto.ts` acota longitud de contraseña de firma; `src/common/__tests__/dto-validation.spec.ts` cubre estos nuevos contratos; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` volvió a pasar con 219 tests.

10. `UpdateSectionDto.data` ya no acepta payloads arbitrarios sin tope básico de tamaño/forma.
   Evidencia: `backend/src/encounters/dto/update-section.dto.ts` ahora aplica una constraint dedicada para rechazar payload no-objeto (incluyendo arrays), exceso de campos de primer nivel y contenido serializado excesivo; `src/common/__tests__/dto-validation.spec.ts` cubre los tres escenarios inválidos; `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` se mantuvo en verde.

## 5. Seguridad y privacidad

### Lo que está bien

1. Auth backend razonablemente sólida para el tamaño del proyecto.
   `backend/src/auth/auth.controller.ts` usa cookies `HttpOnly`, `secure` en producción y `sameSite: 'strict'`; `backend/src/auth/strategies/jwt.strategy.ts` extrae JWT solo desde cookie y no acepta Bearer tokens.

2. El backend arranca con guardrails serios para secrets y despliegue.
   `backend/src/main.ts` falla si faltan `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_TOKEN` en producción, si hay placeholders inseguros, si access/refresh comparten secreto, o si faltan claves de cifrado de settings.

3. La instrumentación no expone cookies ni payloads por defecto.
   `backend/src/instrument.ts` redácta `authorization`, `cookie`, `set-cookie` y borra `event.request.data` antes de enviar a Sentry.

4. La segregación clínica general entre médicos está bien cubierta.
   El E2E backend pasó 219 tests, incluyendo aislamiento de pacientes, atenciones, historial, problemas, tareas y encounters entre médicos distintos.

### Riesgos observados en desarrollo

1. No observé un incidente real de exposición de datos personales reales.
   El entorno auditado es de desarrollo y se indicó que los datos son ficticios/sintéticos; lo tomo como supuesto válido.

2. No audité ni expongo valores reales de `.env` locales.
   Sí verifiqué la existencia de guardrails y ejemplos de configuración; no traté secretos locales como hallazgo por sí mismos.

### Riesgos potenciales si se desplegara así en producción

1. Ese riesgo ya quedó mitigado en esta rama para consentimientos, alertas, problemas y tareas dentro del modelo actual asumido por el proyecto.

2. Los adjuntos, la DB SQLite y los backups siguen dependiendo del cifrado del host.
   `backend/src/main.ts` solo emite warning si `ENCRYPTION_AT_REST_CONFIRMED=false`; no es un bloqueo. Para un proyecto chico esto puede ser aceptable, pero solo si el host usa cifrado de filesystem real y verificable.

3. La preservación de sesión local quedó acotada a fallas de red sin respuesta. Eso reduce bastante el riesgo de UI stale por permisos, aunque no lo elimina frente a conectividad inestable prolongada.

## 6. Modelo de datos e integridad clínica

### Fortalezas

1. La política de completitud clínica está bien pensada.
   `backend/src/common/utils/patient-completeness.ts` bloquea completar atenciones o emitir documentos oficiales cuando la ficha maestra está incompleta o pendiente de verificación. Eso es correcto para una EMR chica y previene documentación “oficial” sobre datos demográficos flojos.

2. El flujo de merge/archive/restore de pacientes está bien cubierto en E2E.
   No vi evidencia de una corrupción gruesa de datos en esos caminos; al contrario, el E2E backend valida merge de duplicados, archive/restore y timeline.

### Riesgos

3. Consentimientos y alertas a nivel paciente ya quedaron endurecidos en esta rama usando ownership del médico efectivo del creador; problemas y tareas también quedaron simplificados para depender sólo de `medicoId` denormalizado en un proyecto sin datos históricos que migrar.

4. Problemas y tareas ya dependen sólo de `medicoId` denormalizado para scope clínico. Eso simplifica el modelo y elimina la compatibilidad hacia atrás que no aportaba valor en este proyecto sin datos históricos.

5. Los tests unitarios de export/PDF ya quedaron alineados en esta rama; el drift anterior quedó resuelto.

### Validaciones de negocio que faltan o conviene endurecer

6. Mantener vigilancia de payloads clínicos excepcionales para ajustar los límites de `UpdateSectionDto.data` solo si aparecen falsos positivos en uso real.

## 7. Mantenibilidad y deuda técnica

1. La deuda técnica quedó localizada y acotada.
   No veo necesidad de reescritura ni de cambios arquitectónicos grandes. El frente legacy de problemas/tareas quedó eliminado al asumir correctamente que no hay datos previos que preservar.

2. Los checks automáticos principales quedaron en verde.
   Backend typecheck, backend tests, backend lint, backend E2E, frontend typecheck, frontend tests y frontend smoke E2E pasaron en esta rama.

3. La mayor deuda pendiente es de endurecimiento y validación final, no de compatibilidad hacia atrás.
   El sistema ya no carga fallbacks legacy innecesarios en este frente, así que la complejidad remanente es bastante más acotada.

### Lo que está bien aquí

6. La cobertura es buena para un proyecto chico.
   El backend E2E fuerte, los tests frontend unitarios amplios y la política de build/typecheck en verde son una base muy aprovechable.

## 8. Funcionalidades sugeridas alineadas con anamneo

### Imprescindibles

1. Resumen clínico fijo en la cabecera de paciente/atención con alergias, medicación habitual, problemas activos y alertas relevantes.
   Valor real: reduce saltos entre pestañas durante la consulta.

2. Historial contextual de cambios por paciente/atención dentro de la UI clínica.
   Ya existe `AuditLog`; falta acercarlo al flujo clínico para responder rápido “quién cambió qué y cuándo” sin ir a una vista global de auditoría.

3. Ownership visible para consentimientos y alertas a nivel paciente.
   Mostrar claramente si el ítem pertenece al encuentro actual, al paciente o a otro creador reduce errores operativos y acompaña el fix de permisos.

### Muy útiles

4. Plantillas rápidas de evolución/indicaciones/derivación en los campos libres más usados.
   Valor real: menos escritura repetitiva y menos variabilidad innecesaria.

5. Filtros clínicos rápidos en pacientes/seguimientos por problema activo, último control y vencidos.
   Ya existe bastante base operativa; falta afinar la consulta rápida.

6. Mensajes de elegibilidad más accionables antes de exportar/imprimir.
   En vez de solo bloquear, mostrar un “faltan estos 2 datos y puedes corregirlos aquí” reduce frustración.

### Opcionales

7. Hoja breve imprimible de indicaciones post consulta para el paciente.
   No necesita ser compleja ni legalista; una salida clara y breve ya agrega valor.

8. Recordatorio diario/semanal simple de seguimientos pendientes.
   Puede vivir en dashboard sin notificaciones enterprise ni infraestructura extra.

9. Vista rápida de adjuntos recientes por paciente, no solo por encuentro.
   Útil cuando el usuario recuerda el examen, pero no el encounter exacto.

## 9. Quick wins

1. Hacer una prueba manual final de punta a punta en el entorno objetivo.
2. Decidir si vale la pena correr la matriz Playwright completa o si el smoke más los checks dirigidos ya son suficientes para esta release.
3. Replicar el endurecimiento DTO ya aplicado en consentimientos/alertas al resto de entradas clínicas donde todavía aporte valor.
4. Confirmar que la operación real de backups en el host final coincide con la ruta ya corregida.
5. Verificar si quieres elevar el veredicto a “lista” después de la pasada manual final y la decisión sobre Playwright completa.

## 10. Checklist mínimo antes de producción

1. Confirmar en el entorno objetivo que backup, restore drill y monitor escriben donde realmente esperas.
2. Confirmar `BOOTSTRAP_TOKEN`, secrets JWT y cifrado del host antes de abrir acceso real.
3. Hacer una prueba manual completa: login, alta de paciente, atención, adjunto, exportación y cierre con médico y asistente.
4. Confirmar que no existen caminos de carga clínica que sigan admitiendo datos blandos donde hoy ya esperas `UUID`, `trim` y límites de longitud.
5. Verificar si hace falta una corrida Playwright completa adicional para esta release o si el smoke más la matriz unitaria ya cubren el riesgo razonable.

## 11. Supuestos y limitaciones

1. No audité infraestructura de producción real, DNS, reverse proxy externo ni host final.
2. No revisé valores reales de secrets locales ni los considero incidente en este contexto de desarrollo.
3. Tomé como válido que los datos del entorno son de prueba/sintéticos.
4. Ejecuté el smoke frontend E2E aislado y quedó en verde; no repetí la matriz Playwright completa porque los cambios frontend fueron de harness y no de UI/contratos de negocio.
5. No intenté medir performance de alta concurrencia porque no sería una recomendación proporcionada para este producto.

## Cierre

Anamneo no necesita un rediseño grande. La pasada corta y disciplinada sobre permisos clínicos a nivel paciente, señal de release y operación SQLite ya quedó hecha en esta rama. Para una app pequeña y de uso restringido, la base ahora se ve razonablemente buena, sin blockers técnicos rojos y con una deuda remanente más asociada a endurecimiento final que a problemas estructurales.