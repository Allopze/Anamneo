# Auditoría técnica y funcional de Anamneo

Fecha de auditoría: 2026-04-21

## 1. Resumen ejecutivo

Auditée el repositorio completo de `anamneo` como EMR/EHR pequeña para 1 a 5 usuarios, con foco en backend NestJS, frontend Next.js, auth/permisos, integridad clínica, despliegue simple con SQLite, backups y tests.

Estado general: la base del producto es bastante buena para el tamaño del proyecto. La arquitectura está ordenada por dominios, hay validaciones fuertes, guardrails de arranque razonables, trazabilidad con auditoría persistente, contrato compartido de permisos y una cobertura de tests poco común para un proyecto de este tamaño.

Riesgo global: **medio-bajo**. No encontré evidencia de un core clínico roto ni de permisos clínicos evidentemente mal implementados. Los dos problemas operativos más importantes detectados al inicio de la auditoría ya fueron corregidos en el repo: el bootstrap de producción en Docker y el uso inconsistente de backups pre-deploy.

Conclusión corta: **el producto quedó bastante mejor encaminado y cerca de estar listo para una producción chica, pero todavía no lo declararía listo sin una validación operativa real de deploy/restore/bootstrap**.

## 2. Veredicto de producción

**No lista para producción aún**

Criterio aplicado: app clínica pequeña, uso real restringido de 1 a 5 usuarios, sin exigir estándares enterprise pero sí pidiendo privacidad, integridad de datos y recuperabilidad razonable.

Justificación concreta del estado actual:

- El core funcional principal se ve sólido: auth, pacientes, atenciones, tareas, adjuntos, consentimientos, alertas, exportes y aislamiento entre médicos tienen evidencia fuerte por tests y revisión de código.
- Ya quedaron corregidos tres puntos importantes en el repo:
  - `docker-compose.yml` ahora exige `BOOTSTRAP_TOKEN` en producción,
  - `scripts/deploy.sh` ahora reutiliza `sqlite-backup.js` y corre restore drill contra un backup con metadata y snapshot de uploads,
  - `sanitize-html` quedó actualizado y `npm audit` del backend pasó sin vulnerabilidades,
  - `fechaNacimiento` quedó alineada entre UI, DTO, regla de completitud clínica y flujos de verificación/export.
- Lo que sigue bloqueando un “lista para producción” no es un bug estructural claro del código, sino validación operativa pendiente:
  - probar un deploy Docker real de punta a punta,
  - verificar el bootstrap del primer admin en ese entorno,
  - correr un restore drill y rollback operativos con datos/adjuntos de prueba,
  - cerrar algunos puntos medianos de integridad, testing y mantenibilidad.

## 3. Hallazgos críticos y altos

No encontré hallazgos **críticos** comprobados en el core clínico actual. Al momento de esta actualización, **no quedan hallazgos altos abiertos** en el repo que haya podido comprobar por código.

### Hallazgos altos resueltos durante esta iteración

| Estado | Severidad original | Título | Archivo(s) tocados | Resolución aplicada |
|---|---|---|---|---|
| Resuelto en repo | Alto | La ruta Docker de producción omite `BOOTSTRAP_TOKEN` aunque el backend lo exige | `docker-compose.yml`, `docs/environment.md`, `docs/deployment-and-release.md` | Se agregó `BOOTSTRAP_TOKEN` como variable requerida del servicio `backend` y se alineó la documentación de despliegue. |
| Resuelto en repo | Alto | `scripts/deploy.sh` usa un backup/restore pre-deploy inconsistente con adjuntos | `scripts/deploy.sh`, `docs/deployment-and-release.md`, `docs/sqlite-operations.md` | El deploy ahora usa `sqlite-backup.js`, toma backups con metadata/snapshot de uploads y ejecuta restore drill compatible con adjuntos. |
| Resuelto en repo | Medio | Vulnerabilidad moderada en `sanitize-html` | `backend/package-lock.json` | `sanitize-html` quedó actualizado a `2.17.3` y `npm --prefix backend run audit:prod` pasó sin vulnerabilidades. |
| Resuelto en repo | Medio | `fechaNacimiento` estaba desalineada entre frontend, DTO y completitud clínica | `backend/src/patients/dto/create-patient.dto.ts`, `backend/src/common/utils/patient-completeness.ts`, `backend/src/patients/patients-intake-mutations.ts`, tests backend/e2e | El backend ahora exige `fechaNacimiento` en alta clínica completa, la usa para completitud/verificación y los flujos de exporte/pendiente quedaron alineados. |

## 4. Bugs e inconsistencias funcionales

### Hechos comprobados

- No encontré bugs funcionales bloqueantes en los flujos principales auditados. La evidencia más fuerte es que pasó:
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` con **218/218 tests**
  - `npm --prefix backend run test -- --runInBand` con **53/53 suites**
  - `npm --prefix frontend run test -- --runInBand` con **59/59 suites**
- Los permisos clínicos están bastante bien resueltos para una app chica:
  - contrato compartido entre frontend y backend para `encounters`,
  - tests e2e de aislamiento entre médicos,
  - asistentes sin acceso a secciones sólo-médico,
  - bloqueo de exportes/cierre si la ficha maestra está incompleta o pendiente de verificación.

### Inconsistencias y bordes a corregir

- **El flujo de recuperación de borrador tras 401/relogin quedó corregido.**
  - Causa encontrada:
    - la spec `frontend/tests/e2e/encounter-draft-recovery.spec.ts` no mockeaba `GET /api/settings/session-policy`, por lo que el layout llegaba al backend real con cookies de prueba y se auto-logout;
    - además, el `logout()` del store limpiaba borradores locales incluso cuando la sesión se invalidaba por 401/expiración, lo que contradecía el objetivo del flujo de recuperación.
  - Corrección aplicada:
    - la spec ahora mockea `session-policy`,
    - `useAuthStore.logout()` ahora diferencia entre logout explícito (`clearLocalState: true`) y expiración/reauth no voluntaria, preservando drafts locales en este segundo caso.
  - Resultado:
    - `PLAYWRIGHT_FRONTEND_PORT=5571 PLAYWRIGHT_BACKEND_PORT=5691 npm --prefix frontend run test:e2e -- --workers=1 tests/e2e/encounter-draft-recovery.spec.ts` pasó,
    - la suite completa `PLAYWRIGHT_FRONTEND_PORT=5573 PLAYWRIGHT_BACKEND_PORT=5693 npm --prefix frontend run test:e2e` volvió a reportar los **13 tests con ✓**.

### Cambios aplicados y validados en esta iteración

- Se contrastó con documentación actual de Prisma vía Context7 que el comando correcto para producción es `prisma migrate deploy` y no `migrate dev`; el flujo de release del repo se mantuvo alineado con eso.
- `BOOTSTRAP_TOKEN` agregado como requerido en `docker-compose.yml`.
- `scripts/deploy.sh` rehecho para tomar el backup pre-migración con `sqlite-backup.js` y usar restore drill compatible con adjuntos.
- Documentación de entorno, despliegue y operación SQLite alineada con esos cambios.
- Dependencia vulnerable `sanitize-html` actualizada en backend.
- `fechaNacimiento` alineada en backend:
  - `CreatePatientDto` ahora la exige para alta clínica completa.
  - `patient-completeness` la considera dato demográfico crítico.
  - cambios en fecha de nacimiento vuelven a disparar la lógica correcta de completitud/verificación.
  - se ajustaron tests unitarios y e2e relacionados.
- `fechaNacimiento` alineada también en frontend de edición médica:
  - el schema doctor-side ya no permite guardar una ficha dejando vacía la fecha de nacimiento,
  - se agregó validación focalizada en `frontend/src/__tests__/app/editar-paciente.test.tsx`.
- Primera ronda de reducción de deuda en ficha clínica:
  - `FichaContentBlocks.tsx` bajó de 598 a 199 líneas,
  - `FichaClinicalRecord.tsx` quedó como shell de 144 líneas,
  - los bloques numerados se movieron primero a `FichaClinicalSections.tsx`.
- Segunda ronda de reducción de deuda en ficha clínica:
  - `FichaClinicalSections.tsx` quedó reducido a un barrel de 9 líneas,
  - se separaron bloques clínicos en:
    - `FichaPatientSections.tsx` con 177 líneas,
    - `FichaExamSections.tsx` con 61 líneas,
    - `FichaTreatmentSections.tsx` con 147 líneas.
- Primera ronda de reducción de deuda en analytics:
  - `backend/src/analytics/clinical-analytics.helpers.ts` bajó de 1089 a 838 líneas,
  - se extrajeron helpers puros de texto/síntomas/comida a `backend/src/analytics/clinical-analytics-text.ts` con 283 líneas.
- Segunda ronda de reducción de deuda en analytics:
  - `backend/src/analytics/clinical-analytics.read-model.ts` bajó de 684 a 279 líneas,
  - se extrajeron rankings, caveats, promedio etario y evaluación de desenlaces a `backend/src/analytics/clinical-analytics-summary.ts` con 441 líneas.
- Tercera ronda de reducción de deuda en analytics:
  - `backend/src/analytics/clinical-analytics.helpers.ts` bajó de 838 a 98 líneas,
  - el parseo y enriquecimiento de encounters clínicos quedó dividido en:
    - `backend/src/analytics/clinical-analytics-encounter-parser.ts` para parseo por secciones,
    - `backend/src/analytics/clinical-analytics-encounter-persistence.ts` para merge con persistencia.
- Nueva ronda de reducción de deuda en la página de atención:
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` quedó en 300 líneas,
  - se separaron `EncounterClinicalWarnings.tsx`, `EncounterMobileSectionNav.tsx` y `EncounterActiveSectionCard.tsx`.
- Validaciones corridas después de los fixes:
  - `npm --prefix backend run audit:prod`
  - `npm --prefix backend run test -- --runInBand`
  - `npm --prefix backend run typecheck`
  - `npm --prefix backend run test -- --runInBand clinical-analytics.helpers.spec.ts`
  - `npm --prefix backend run test -- --runInBand clinical-analytics.read-model.spec.ts clinical-analytics.helpers.spec.ts`
  - `npm --prefix backend run test -- --runInBand patient-completeness.spec.ts patients-intake-mutations.spec.ts patients-demographics-mutations.spec.ts`
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run test -- --runInBand src/__tests__/stores/auth-store.test.ts`
  - `npm --prefix frontend run test -- --runInBand editar-paciente.test.tsx`
  - `PLAYWRIGHT_FRONTEND_PORT=5571 PLAYWRIGHT_BACKEND_PORT=5691 npm --prefix frontend run test:e2e -- --workers=1 tests/e2e/encounter-draft-recovery.spec.ts`
  - `PLAYWRIGHT_FRONTEND_PORT=5573 PLAYWRIGHT_BACKEND_PORT=5693 npm --prefix frontend run test:e2e` con la suite frontend e2e reportando **13/13 tests OK**
  - `PLAYWRIGHT_FRONTEND_PORT=5577 PLAYWRIGHT_BACKEND_PORT=5697 npm --prefix frontend run test:e2e:workflow-clinical` con el flujo clínico reportando sus pasos en verde, y se reforzó el teardown de `frontend/scripts/e2e-webserver.js` con fallback a `SIGKILL`.
  - `bash -n scripts/deploy.sh`
  - `BOOTSTRAP_TOKEN=test-bootstrap-token-for-config docker compose config --quiet`

## 5. Seguridad y privacidad

### Lo que está bien

- `backend/src/main.ts` tiene guardrails útiles para un proyecto chico pero serio:
  - rechaza secrets placeholder,
  - exige separar `JWT_SECRET` y `JWT_REFRESH_SECRET`,
  - exige `BOOTSTRAP_TOKEN` en producción,
  - exige claves de cifrado de settings en producción,
  - advierte si no se confirmó cifrado de filesystem.
- Auth y sesión están bien planteados para esta escala:
  - cookies `HttpOnly`,
  - refresh token persistido por sesión,
  - revocación por `refreshTokenVersion` y `UserSession`,
  - 2FA/TOTP disponible,
  - throttling en login/registro/2FA.
- Hay auditoría persistente con diff e integridad encadenada, algo muy valioso para contexto clínico chico sin complicarse con observabilidad enterprise.
- Adjuntos tienen validación de tipo declarado vs firma binaria y resolución de paths defensiva.

### Riesgos observados en desarrollo

- El entorno local tiene `.env`, DB SQLite y backups locales presentes, pero no están trackeados en git según `git ls-files`. Dado que los datos de este entorno son ficticios o de prueba, **no lo reporto como incidente real**.
- El smoke de Playwright no fue verificable en este entorno por conflicto de puertos, no por una falla comprobada del producto.

### Riesgos potenciales si se despliega así en producción

- **Sigue faltando validación operativa real del despliegue soportado** con `cloudflared`, bootstrap admin, migración y restore drill, aunque el repo ya quedó mejor alineado para eso.
- El cifrado en reposo de DB y adjuntos depende del host, no de la app. Esto está documentado y advertido, lo cual está bien, pero hay que cumplirlo de verdad en producción.

### Nota de actualización

- Los dos riesgos operativos anteriores ya quedaron corregidos en el repo durante esta iteración; lo pendiente ahora es validar el comportamiento real del deploy en un entorno de ejecución controlado.

## 6. Modelo de datos e integridad clínica

### Fortalezas

- Buenas barreras de integridad clínica para el tamaño del sistema:
  - la ficha del paciente bloquea cierre/exportes oficiales si faltan datos críticos,
  - una atención firmada pasa a ser inmutable,
  - la identificación de la atención funciona como snapshot y no se deja editar libremente,
  - el backend recalcula edad desde fecha de nacimiento cuando ésta se informa,
  - hay control de secciones obligatorias y “no aplica”.
- Hay aislamiento por médico razonablemente bien cubierto en tests.

### Riesgos o huecos

- El modelo usa bastante JSON serializado en strings (`EncounterSection.data`, metadata de sugerencias, etc.). Es una decisión pragmática válida para esta escala, pero exige disciplina alta en DTOs, sanitización y tests para evitar drift.
- Problemas y tareas viven a nivel paciente y no sólo de encounter. Eso es funcionalmente útil, pero obliga a seguir cuidando mucho la visibilidad entre médicos si el modelo de pacientes compartidos crece.

## 7. Mantenibilidad y deuda técnica

### Lo positivo

- La separación por dominios backend está bastante bien.
- Los controladores son relativamente finos y la lógica sensible cae en servicios/mutations/read-models.
- Hay CI real con lint, typecheck, tests backend, e2e backend, build frontend y Playwright en GitHub Actions.

### Deuda técnica relevante

- **Hay archivos manuales por encima del límite de tamaño declarado por el propio proyecto.**
  - `backend/src/analytics/clinical-analytics.helpers.ts` tiene 838 líneas tras el primer corte.
  - `backend/src/analytics/clinical-analytics-summary.ts` tiene 441 líneas tras el segundo corte.
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` tiene 502 líneas.
  - Esto no rompe hoy, pero aumenta el costo de tocar lógica clínica y analítica.
  - Severidad: **Medio**
  - Esfuerzo: **Medio**

- **La deuda de ficha bajó de forma material, pero todavía conviene fortalecer tipos y recortar la página contenedora.**
  - `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaContentBlocks.tsx` quedó por debajo de 200 líneas.
  - `FichaClinicalRecord.tsx` quedó como shell de 144 líneas.
  - `FichaClinicalSections.tsx` ya no concentra la lógica; ahora funciona como barrel de 9 líneas y los bloques quedaron repartidos por dominio.
  - Lo que queda como siguiente paso natural en ficha es tipar mejor los bloques serializados y recortar `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`.

- **Analytics mejoró, pero todavía tiene un helper y un read-model grandes para el estándar del repo.**
  - La extracción de `clinical-analytics-text.ts`, `clinical-analytics-summary.ts` y `clinical-analytics-encounter.ts` dejó mucho mejor repartida la lógica pura y de parseo.
  - El foco principal de analytics ahora ya no es `clinical-analytics.helpers.ts`, sino decidir si `clinical-analytics-encounter.ts` conviene partir entre parseo por secciones y enriquecimiento persistido.

- Hay varios `any` todavía en frontend y backend, sobre todo en formateadores clínicos, PDFs y utilidades históricas. No es un caos, pero sí una señal de deuda en contratos clínicos serializados.
- Aunque `scripts/deploy.sh` ya quedó mejor alineado con `sqlite-backup.js`, conviene mantener una sola fuente de verdad para operaciones SQLite y evitar que vuelva a divergir del runner operativo.

## 8. Funcionalidades sugeridas alineadas con anamneo

### Imprescindibles

- **Resumen clínico fijo al abrir una atención**
  - Mostrar alergias, medicación habitual, problemas activos y alertas al inicio de la ficha.
  - Valor real: reduce errores en consulta rápida y aprovecha datos que el sistema ya tiene.

- **Diagnóstico final explícito dentro del encounter**
  - Hoy hay trazabilidad fuerte del sugeridor, pero convendría persistir de forma más visible el diagnóstico clínico final de la atención.
  - Valor real: mejora lectura longitudinal, exportes y continuidad clínica.

- **Plantillas rápidas por tipo de consulta**
  - No una mega-feature; algo simple para controles frecuentes, SOAP breve, control crónico o recetas repetidas.
  - Valor real: menos escritura repetitiva y menos omisiones.

### Muy útiles

- **Checklist pre-consulta para asistentes**
  - Confirmación rápida de datos demográficos, adjuntos, consentimientos pendientes y tareas.
  - Valor real: baja fricción operativa y menos interrupciones durante la consulta.

- **Previsualización segura de adjuntos**
  - Imágenes/PDF dentro del flujo clínico sin tener que descargar todo.
  - Valor real: acelera lectura de exámenes para un consultorio chico.

- **Comparación simple de cambios por sección**
  - Especialmente útil en atenciones reabiertas o correcciones posteriores.
  - Valor real: más trazabilidad clínica sin montar versionado complejo.

### Opcionales

- **Explicabilidad visible del sugeridor diagnóstico**
  - Mostrar por qué sugirió una condición y qué coincidió.
  - Valor real: confianza clínica y mejor corrección manual.

- **Búsqueda avanzada de pacientes con últimos eventos**
  - Última atención, tareas vencidas, alertas activas, filtros rápidos.
  - Valor real: buena mejora operativa para agenda y seguimiento.

## 9. Quick wins

- Correr un deploy Docker real de ensayo con `cloudflared` o un entorno lo más parecido posible al definitivo.
- Ejecutar un restore drill manual y un rollback simulado usando el flujo ya corregido.
- Seguir partiendo `clinical-analytics.helpers.ts` y luego `clinical-analytics.read-model.ts` antes de seguir agregándoles lógica.
- Tipar mejor los bloques serializados de ficha y recortar `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`.
- Ya se aplicó un corte adicional de `clinical-analytics-encounter.ts` entre parseo por secciones y merge con persistencia; conviene revisar si aún hay oportunidad de extraer más lógica hacia helpers puros.
- Se reforzó el cierre del runner Playwright en `frontend/scripts/e2e-webserver.js` para no dejar el proceso colgado tras la suite.

## 10. Checklist mínimo antes de producción

- Ejecutar un deploy de prueba con:
  - backup,
  - restore drill,
  - migración,
  - rollback simulado,
  - adjuntos presentes.
- Verificar el deploy soportado completo detrás de `cloudflared` con login, refresh, cierre de atención, export PDF y descarga de adjuntos.
- Confirmar cifrado de filesystem real en el host productivo y marcar `ENCRYPTION_AT_REST_CONFIRMED=true`.
- Mantener estable la suite frontend e2e y, si persiste, revisar el cierre del runner Playwright tras los `13/13` OK.

## 11. Supuestos y limitaciones

### Qué sí pude verificar

- Revisión de arquitectura, módulos, permisos, auth, flujos clínicos y operación SQLite.
- Ejecución de:
  - `npm --prefix backend run typecheck`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix backend run lint:check`
  - `npm --prefix frontend run lint`
  - `npm --prefix backend run test -- --runInBand`
  - `npm --prefix frontend run test -- --runInBand`
  - `npm run build`
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
  - `npm --prefix backend run audit:prod`
  - `npm --prefix frontend run audit:prod`

### Qué no pude verificar del todo

- No corrí Playwright smoke/frontend e2e completo en este entorno porque `npm --prefix frontend run test:e2e:smoke` abortó al detectar `http://localhost:5678` ya ocupado por un proceso `node` activo del entorno local.
- Más adelante pude correr la suite frontend e2e en puertos libres, reproducir la falla de recuperación de borrador, corregirla y volver a ejecutar la suite completa con los **13 tests reportados en verde**.
- No ejecuté un deploy Docker real de punta a punta porque la auditoría estaba orientada al repo y el workspace ya tenía actividad/estado en curso.

### Supuestos

- Tomé como válidas las premisas de negocio de una app chica, no multi-tenant, con muy pocos usuarios.
- Consideré que los datos visibles en desarrollo son ficticios; por eso diferencié entre riesgo técnico potencial y exposición real actual.

## Señales positivas destacables

- Muy buena cobertura de tests para el tamaño del proyecto.
- Buen enfoque pragmático de seguridad para una app pequeña.
- Permisos clínicos y aislamiento entre médicos bastante mejor resueltos que en muchos proyectos similares.
- Backups, restore drill y monitoreo SQLite ya están pensados; falta cerrar mejor la integración con el deploy.
