# Auditoria tecnica y funcional de Anamneo

Fecha: 2026-04-22
Actualizado: 2026-04-23

## 1. Resumen ejecutivo

Audite el repositorio completo de Anamneo como EMR/EHR chica para 1 a 5 usuarios, con foco en backend NestJS + Prisma, frontend Next.js, autenticacion, permisos, validaciones, flujos clinicos, exportes, adjuntos, operacion SQLite, tests y build.

Estado general:

- La base tecnica sigue siendo buena para una app chica real: arquitectura por dominios clara, permisos clinicos bastante explicitados, cookies HttpOnly + same-origin, sesiones persistidas, auditoria con hash chain, backups/restore drill para SQLite y documentacion superior al promedio de un proyecto pequeno.
- No veo necesidad de reescritura ni de arquitectura enterprise. Para este tamano, el stack actual es razonable.
- Los hallazgos altos y medios que dejaban a la app en rojo en la auditoria inicial quedaron corregidos y revalidados.

Riesgo global actual: **Medio**, principalmente por riesgos operativos residuales y algunos puntos de endurecimiento no bloqueantes.

Conclusion corta: **tras esta ronda de fixes, la considero apta para una salida chica o piloto controlado, siempre que el despliegue real cumpla el checklist operativo de secretos, cifrado del host y backup/restore**.

Validaciones ejecutadas en la ronda de remediacion:

- `npm --prefix backend run lint:check` -> PASS
- `npm --prefix backend run test` -> PASS
- `npm --prefix backend run typecheck` -> PASS
- `npm --prefix backend run build` -> PASS
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` -> PASS (220/220)
- `npm --prefix frontend run lint` -> PASS
- `npm --prefix frontend run test` -> PASS (61 suites, 295 tests)
- `npm --prefix frontend run test:e2e:smoke` -> PASS (2/2)

Estado de remediacion de hallazgos altos y medios:

- [x] Corregido el 500 en `GET /api/encounters/:id/export/document/ordenes`.
- [x] Agregada cobertura de regresion para export focused `ordenes`.
- [x] Eliminada la suite placeholder que rompia Jest backend.
- [x] Reparado el mock desactualizado del flujo de cierre en frontend.
- [x] Limpiado el backend hasta dejar `lint:check` en verde.
- [x] Endurecido el arranque en produccion para exigir `ENCRYPTION_AT_REST_CONFIRMED=true`.
- [x] Resuelto el warning pendiente de hooks en `DashboardClinicalView`.
- [x] `GET /api/settings/session-policy` ya no depende del fallback fail-open de `RolesGuard`.
- [x] `POST /api/auth/refresh` acepta refresh token solo por cookie `HttpOnly`.

## 2. Veredicto de produccion

**Lista para produccion pequena o piloto controlado**, usando como criterio una app medica pequena de 1 a 5 usuarios y no un SaaS masivo.

Justificacion concreta:

- El fallo clinico reproducible en el export de `ordenes` quedo corregido y validado en unitarias y e2e.
- Las compuertas minimas de calidad que estaban rotas en la auditoria inicial quedaron verdes: backend lint, backend test, backend typecheck/build, backend e2e principal y frontend test.
- La seguridad base esta bien encaminada y ahora el arranque en produccion falla si no se confirma `ENCRYPTION_AT_REST_CONFIRMED=true`.

Matiz importante:

- Esto no elimina la disciplina operativa necesaria: el host debe estar realmente cifrado, los secretos deben ser reales y el backup/restore debe haberse probado en el entorno final.
- Siguen existiendo riesgos menores o de endurecimiento, pero ya no veo un bloqueo alto o medio que por si solo impida una salida pequena prudente.

## 3. Hallazgos criticos y altos

No confirme hallazgos **criticos**. Si confirme los siguientes **altos**:

| Severidad | Titulo | Archivo(s) afectados | Descripcion | Impacto | Recomendacion | Esfuerzo |
| --- | --- | --- | --- | --- | --- | --- |
| Alto | Export de ordenes clinicas devuelve 500 | `backend/src/encounters/encounters-pdf.focused.renderers.ts`, `backend/src/encounters/encounters-pdf.service.ts`, `backend/test/suites/encounters/encounters-followup-export-review.e2e-group.ts` | La suite `app.e2e-spec.ts` falla en `GET /api/encounters/:id/export/document/ordenes`. En el renderer hay un typo: valida `trat.examenesEstructurados` pero luego itera `trat.examenesEstructuradas`. | Rompe una salida clinica real para emitir ordenes/examenes. En consulta real esto bloquea un uso importante del sistema. | Corregir el typo, agregar test unitario/focused e2e para los 3 documentos (`receta`, `ordenes`, `derivacion`) y no volver a liberar si ese endpoint responde 500. | Bajo |
| Alto | El cifrado en reposo del host no es obligatorio al arrancar en produccion | `backend/src/main.helpers.ts`, `docs/security-and-permissions.md`, `docs/environment.md`, `docker-compose.yml` | Si `ENCRYPTION_AT_REST_CONFIRMED` no esta en `true`, el backend solo emite warning y sigue arrancando. DB SQLite, adjuntos y backups quedan dependiendo totalmente del cifrado del host. | En desarrollo no es un incidente real porque los datos son de prueba. En produccion, si se despliega asi sin disco cifrado, una intrusion o acceso al host expone datos clinicos y adjuntos. | Exigir este control en el checklist de salida como condicion operativa obligatoria. Si se quiere endurecer mas, fallar el arranque en produccion cuando falte esa confirmacion documentada. | Bajo-Medio |

Estado 2026-04-23: **ambos hallazgos altos quedaron corregidos**.

## 4. Bugs e inconsistencias funcionales

### 4.1 Export clinico roto para ordenes

- Hecho comprobado: la suite integrada del backend falla en `GET /api/encounters/:id/export/document/ordenes -> 500`.
- Evidencia tecnica: typo en `renderFocusedEncounterPdf()` dentro de `backend/src/encounters/encounters-pdf.focused.renderers.ts`.
- Relevancia funcional: una consulta real puede necesitar imprimir o entregar ordenes de examenes aunque el resto de la atencion funcione.
- Estado 2026-04-23: **resuelto**. El typo fue corregido y la suite integrada paso en verde.

### 4.2 La suite backend queda en rojo por un archivo placeholder que Jest sigue descubriendo

- `backend/src/common/__tests__/dto-validation.spec.ts` ya no contiene tests: solo comentarios que dicen que fue dividido.
- `npm --prefix backend run test` falla con `Your test suite must contain at least one test`.
- Esto no parece bug de producto, pero si una regression clara del flujo de mantenimiento despues del split de specs.
- Estado 2026-04-23: **resuelto**. El archivo placeholder fue eliminado y la suite backend completa paso en verde.

### 4.3 La suite frontend del flujo de cierre esta rota por un mock desactualizado

- `npm --prefix frontend run test` falla con 10 tests en `frontend/src/__tests__/app/atencion-cierre.test.tsx`.
- La causa visible no es un bug productivo directo: el mock de `@/lib/clinical` solo exporta `buildGeneratedClinicalSummary`, pero el componente `frontend/src/app/(dashboard)/atenciones/[id]/EncounterClinicalSummaryCard.tsx` ahora tambien usa `splitHistoryField`.
- Impacto: se pierde confianza automatica justo en el flujo de cierre de atencion, que es uno de los mas sensibles.
- Estado 2026-04-23: **resuelto**. El mock ahora reutiliza el modulo real y la suite frontend completa paso en verde.

### 4.4 Lint backend roto por refactors incompletos

- `npm --prefix backend run lint:check` falla con 75 errores, casi todos por imports o variables no usados.
- Hay errores en codigo de dominio y tambien en suites (`alerts`, `analytics`, `patients`, `auth`, `encounters`, etc.).
- Esto no bloquea la app en runtime, pero si muestra que el release gate de higiene esta caido.
- Estado 2026-04-23: **resuelto en esta ronda**. `npm --prefix backend run lint:check` quedo en verde tras limpiar imports y variables residuales.

### 4.5 Warning de hooks en frontend

- `npm --prefix frontend run lint` deja un warning en `frontend/src/app/(dashboard)/DashboardClinicalView.tsx` por dependencias de `useMemo`.
- No lo considero bloqueante, pero es una senal de que el estado de UI puede no estar tan estabilizado como parece a simple vista.
- Estado 2026-04-23: **resuelto**. `recentEncounters` quedo estabilizado y `npm --prefix frontend run lint` paso en verde.

## 5. Seguridad y privacidad

### Riesgo observado hoy en desarrollo

- No trate los datos visibles del entorno como incidente real porque el contexto indica que son ficticios/sinteticos.
- No vi evidencia de secretos reales trackeados en git: `.env` esta ignorado en `.gitignore` y `.env.example` usa placeholders.
- El smoke browser confirma que una ruta privada redirige a login cuando no hay sesion valida.

### Lo que esta bien resuelto

- Cookies `HttpOnly`, `sameSite: 'strict'` y `secure` en produccion: `backend/src/auth/auth.controller.ts`.
- Frontend same-origin por `/api` con rewrite server-side: `frontend/next.config.js`.
- Guardrails de arranque para `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_TOKEN`, placeholders y SQLite en produccion: `backend/src/main.helpers.ts`.
- Sesiones persistidas y timeout de inactividad aplicado en refresh: `backend/src/auth/auth-refresh-flow.ts`, `backend/prisma/schema.prisma` (`UserSession`).
- Auditoria con hash chain y verificacion disponible: `backend/src/audit/audit.service.ts`, `backend/src/audit/audit.controller.ts`.

### Riesgos potenciales si se despliega asi en produccion

#### 5.1 Cifrado en reposo del host

- La app ya no advierte solamente: ahora falla al arrancar en produccion si el operador no confirma `ENCRYPTION_AT_REST_CONFIRMED=true`.
- Para una EMR chica esto no requiere un sistema sofisticado: basta con un host/volumen cifrado y una operacion disciplinada. Pero si eso falta en la realidad del despliegue, el riesgo sigue siendo real.

#### 5.2 `RolesGuard` es fail-open para endpoints autenticados sin `@Roles()`

- En `backend/src/common/guards/roles.guard.ts`, si un endpoint autenticado no declara `@Roles()` ni `@Public()`, el guard devuelve `true` y deja la restriccion solo en `JwtAuthGuard`.
- Estado 2026-04-23: **endurecido**. La unica ruta real que dependia de ese fallback en esta auditoria, `GET /api/settings/session-policy`, ya quedo decorada explicitamente.
- Estado 2026-04-23: **endurecido**. `backend/src/common/__tests__/controller-roles.spec.ts` ahora recorre los controladores y falla si encuentra una ruta con `JwtAuthGuard` + `RolesGuard` sin `@Roles()`, sin `@Public()` y sin `AdminGuard`.
- El fallback sigue existiendo en runtime, pero dejo de ser un fallo silencioso de mantenimiento porque CI/test lo detecta apenas aparezca una nueva ruta mal decorada.

#### 5.3 Refresh token tambien aceptado por body por compatibilidad

- Estado anterior: `backend/src/auth/auth.controller.ts` tomaba `refresh_token` desde cookie o desde body.
- Estado 2026-04-23: **resuelto**. El refresh ya es cookie-only, que es mas coherente con el modelo same-origin actual.

## 6. Modelo de datos e integridad clinica

### Lo que esta bien

- El modelo base es razonable para una EMR chica: `Patient`, `PatientHistory`, `Encounter`, `EncounterSection`, `Attachment`, `InformedConsent`, `ClinicalAlert`, `PatientProblem`, `EncounterTask`, `UserSession`.
- Hay validaciones compartidas y consistentes para campos de paciente tanto en backend como en frontend: `shared/patient-field-constraints.ts`, DTOs de `patients`, schemas Zod en `frontend/src/app/(dashboard)/pacientes/...`.
- `UpdateSectionDto` pone limites concretos al payload de secciones: tipo objeto, maximo de claves, maximo serializado y razon minima para `notApplicable`.

### Riesgos o limitaciones

#### 6.1 Mucha informacion clinica sigue guardandose como texto/JSON serializado

- `PatientHistory` guarda varios campos como `String?`.
- `EncounterSection.data` se guarda como `String` serializado en Prisma.
- Esto es pragmatico y valido para este tamano, pero hace mas fragil la evolucion de schemas, la explotacion analitica y la validacion fuerte a largo plazo.

#### 6.2 Los outputs oficiales son mas fragiles que el modelo base

- El bug actual de `ordenes` no nace en Prisma ni en permisos, sino en la ultima capa de render de documento.
- Conclusion: la integridad del dato base esta mejor cuidada que la integridad de sus salidas oficiales. Para una EMR, ambos importan.

#### 6.3 SQLite es aceptable aqui, pero la recuperabilidad no puede quedar solo en “deberia funcionar”

- El repo trae `sqlite-backup`, `sqlite-monitor`, `sqlite-ops-runner` y `sqlite-restore-drill`, lo cual esta muy bien para este tamano.
- Para salir a produccion chica, lo importante no es cambiar de motor “por enterprise”, sino verificar en el host real que backup y restore drill corran de verdad y que adjuntos queden incluidos.

## 7. Mantenibilidad y deuda tecnica

### Hallazgos

- El propio repo lleva un inventario de archivos grandes en `FILES_OVER_300_LINES.md` y aun quedan varios pendientes, sobre todo en frontend y suites e2e.
- Hay senales de refactor incompleto: el archivo `backend/src/common/__tests__/dto-validation.spec.ts` quedo como stub, pero sigue dentro del patron de descubrimiento de Jest.
- La suite frontend del flujo de cierre depende de mocks demasiado acoplados a imports internos (`@/lib/clinical`), por eso se rompio sin que fallara el build.
- El lint backend roto por 75 errores indica que la higiene automatica no esta integrada como verdadera compuerta de merge/release.

### Balance

- No veo deuda tecnica “terminal”.
- Si veo deuda de mantenimiento rapido: refactors utiles pero aun no del todo consolidados con herramientas y tests.

## 8. Funcionalidades sugeridas alineadas con Anamneo

### Imprescindibles

1. **Checklist pre-consulta para asistente**
   Valor real: evitar pasar a consulta un paciente con datos demograficos incompletos, adjuntos faltantes o consentimientos pendientes.

2. **Panel simple de pendientes clinicos y operativos**
   Valor real: para 1 a 5 usuarios, un tablero corto con atenciones abiertas, pacientes pendientes de verificacion y seguimientos vencidos resuelve mas que cualquier dashboard complejo.

### Muy utiles

1. **Plantillas de texto por medico para motivos/controles frecuentes**
   Valor real: acelera la carga sin aumentar complejidad tecnica.

2. **Previsualizacion segura de adjuntos PDF/imagen dentro de la atencion**
   Valor real: menos cambio de contexto y menos descargas innecesarias durante la consulta.

3. **Exportacion administrativa simple por rango de fechas y medico**
   Valor real: soporte operativo y cierre mensual sin tocar base ni scripts manuales.

### Opcionales

1. **Comparacion de versiones de una seccion**
   Valor real: mejora la auditabilidad clinica cuando una nota cambia varias veces.

2. **Busqueda avanzada de pacientes/atenciones**
   Valor real: util si el volumen crece, pero no la pondria antes que los quick wins anteriores.

## 9. Quick wins

1. [x] Corregir `trat.examenesEstructuradas` -> `trat.examenesEstructurados` en el renderer de PDF focalizado.
2. [x] Sacar `backend/src/common/__tests__/dto-validation.spec.ts` del patron de tests o convertirlo en un archivo que no matchee Jest.
3. [x] Actualizar el mock de `@/lib/clinical` en `frontend/src/__tests__/app/atencion-cierre.test.tsx` para incluir `splitHistoryField` y helpers relacionados.
4. [x] Limpiar los 75 errores de lint backend; muchos eran unused imports/variables residuales.
5. [x] Agregar una compuerta minima de release que exija verdes: backend lint, backend test, frontend test, backend e2e principal y smoke Playwright.

## 10. Checklist minimo antes de produccion

1. Dejar verde el export de `ordenes` y revalidar `receta` + `derivacion`.
2. Dejar verdes `npm --prefix backend run lint:check`, `npm --prefix backend run test`, `npm --prefix frontend run test` y `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`.
3. Confirmar secretos reales, no placeholders, en el entorno objetivo.
4. Confirmar cifrado del host/volumen para DB, adjuntos y backups, y dejar `ENCRYPTION_AT_REST_CONFIRMED=true` solo despues de verificarlo.
5. Ejecutar un backup real y un restore drill real en el host final.
6. Hacer una pasada manual corta de login -> paciente -> atencion -> cierre -> exportes -> logout.

## 11. Supuestos y limitaciones

- Asumi que los datos de desarrollo son ficticios y no los trate como incidente de privacidad real.
- No inspeccione valores reales de secretos del `.env` local para no exponer material sensible innecesariamente.
- No audite infraestructura productiva real, TLS real del despliegue ni cifrado efectivo del host; solo lo que el repositorio implementa o documenta.
- No ejecute la suite completa de Playwright clinico; si ejecute el smoke e2e, que paso en verde.
- No levante `docker-compose` completo porque ya pude validar build y smoke integrado con el harness del repo.

## Cierre

Lo mejor de Anamneo hoy:

- buena base tecnica para una EMR chica,
- permisos clinicos bastante explicitados,
- operaciones SQLite mas maduras de lo esperable para un proyecto pequeno,
- auth/sesiones razonables,
- y documentacion util para operar sin sobredimensionar el sistema.

Lo que falta para una salida prudente:

- sostener estas validaciones como compuerta de release y no solo como verificacion manual puntual,
- asegurar que el despliegue real tenga secretos, backup y cifrado del host bien resueltos,
- y endurecer algunos detalles menores de seguridad y mantenibilidad que ya no son bloqueo alto o medio.