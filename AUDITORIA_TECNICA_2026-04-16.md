# Auditoria Tecnica End-to-End

Fecha: 2026-04-16
Repositorio auditado: entorno de desarrollo de Anamneo

## 1. Resumen ejecutivo

- La app tiene una base tecnica bastante mejor de lo que suele verse en una webapp interna pequena: NestJS modular, Next.js App Router, validacion global, auth con refresh por cookies, gating por completitud de paciente, y una suite de tests que ya cubre varias fronteras delicadas.
- No la veo como un caos ni como una app para rehacer. La arquitectura general es razonable para el contexto de hasta 5 usuarios.
- El principal problema real que encontré ya se corrigió durante esta misma pasada: la política de permisos de encounters se consolidó y la UI dejó de bloquear al médico tratante para completar una atención preparada por un asistente.
- Tambien quedaba pendiente trazabilidad y politica clinica clara en alertas automatizadas; eso ya se resolvió con auditoria de creacion/reconocimiento y con una regla explicita para que una alerta critica reconocida pueda reaparecer si el mismo valor peligroso persiste.
- La app es razonablemente usable para su contexto actual si la usa principalmente el medico sin delegacion fuerte. En cuanto entra de verdad el flujo medico + asistente, hoy hay riesgos funcionales y clinicos que conviene corregir antes.
- Nivel de madurez general: medio. Buen esqueleto, varios controles sensatos, y la mayoria de los riesgos clinicos concretos ya quedaron mitigados sin tocar la arquitectura.
- Lo que si vi bien: los typechecks estan limpios, el bloqueo por completitud del paciente esta bien encaminado, y la fuga de consentimientos/alertas entre medicos vinculados al mismo paciente tiene cobertura e2e explicita y se ve correctamente protegida.

## 2. Hallazgos

### 2.1 Secciones clinicas solo-medico expuestas a asistentes en lectura

- Prioridad: Critico
- Area afectada: Full stack, permisos, datos clinicos
- Archivos o modulos involucrados:
  - [backend/src/encounters/encounters-read-side.ts](backend/src/encounters/encounters-read-side.ts)
  - [backend/src/encounters/encounters-presenters.ts](backend/src/encounters/encounters-presenters.ts)
  - [frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx](frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx)
  - [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts](frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts)
- Explicacion concreta del problema:
  - El frontend define `MEDICO_ONLY_SECTIONS = ['SOSPECHA_DIAGNOSTICA', 'TRATAMIENTO', 'RESPUESTA_TRATAMIENTO']` y solo las oculta en cliente.
  - El backend, en `findEncounterByIdReadModel`, devuelve `sections` completas para cualquier usuario con scope del medico.
  - `formatEncounterResponse` serializa todas las secciones sin filtrar por rol.
- Por que importa:
  - Un asistente asignado puede recibir por API diagnostico, tratamiento y respuesta al tratamiento aunque la UI no lo muestre.
  - Eso convierte una restriccion de UX en una fuga real de datos clinicos sensibles.
- Como reproducirlo o como lo razone:
  - `GET /api/encounters/:id` esta habilitado para `MEDICO` y `ASISTENTE`.
  - El filtro de acceso del read model es por `medicoId`, no por rol ni por tipo de seccion.
  - El filtrado de secciones ocurre despues, solo en React.
- Propuesta de solucion proporcional al tamano de la app:
  - Filtrar server-side las secciones solo-medico al construir la respuesta para asistentes.
  - Mantener la regla en una sola fuente de verdad compartida entre backend y frontend, pero con enforcement real en backend.
  - Agregar un e2e negativo: asistente puede abrir la atencion, pero no recibe esas secciones en el payload.
- Complejidad estimada de arreglo: Media

### 2.2 El backend permite que el asistente creador edite secciones solo-medico

- Prioridad: Critico
- Area afectada: Backend, permisos, flujo clinico
- Archivos o modulos involucrados:
  - [backend/src/encounters/encounters.controller.ts](backend/src/encounters/encounters.controller.ts)
  - [backend/src/encounters/encounters-section-mutations.ts](backend/src/encounters/encounters-section-mutations.ts)
  - [frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx](frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx)
  - [shared/permission-contract.ts](shared/permission-contract.ts)
- Explicacion concreta del problema:
  - `PUT /api/encounters/:id/sections/:sectionKey` admite `MEDICO` y `ASISTENTE`.
  - `updateEncounterSectionMutation` valida scope del medico y, para asistentes, que el encounter haya sido creado por ese asistente.
  - No hay ningun bloqueo por `sectionKey` para `SOSPECHA_DIAGNOSTICA`, `TRATAMIENTO` o `RESPUESTA_TRATAMIENTO`.
- Por que importa:
  - El backend no esta haciendo cumplir una frontera clinica que la propia UI ya declara como necesaria.
  - Un asistente puede escribir diagnosticos o tratamiento mediante llamada directa a la API.
- Como reproducirlo o como lo razone:
  - Un asistente asignado puede crear encounters segun contrato y tests.
  - Si ese asistente es `createdById`, el backend le permite editar la atencion.
  - No existe condicion adicional que niegue las secciones solo-medico.
- Propuesta de solucion proporcional al tamano de la app:
  - En backend, negar cualquier update de `MEDICO_ONLY_SECTIONS` cuando `user.role !== 'MEDICO'`.
  - Agregar tests e2e de denegacion explicitos para lectura y escritura.
- Complejidad estimada de arreglo: Baja/Media

### 2.3 La UI bloquea al medico tratante para completar atenciones creadas por asistentes

- Prioridad: Alto
- Area afectada: Frontend, full stack, workflow
- Archivos o modulos involucrados:
  - [frontend/src/lib/permissions.ts](frontend/src/lib/permissions.ts)
  - [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts](frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts)
  - [frontend/src/app/(dashboard)/atenciones/[id]/EncounterHeader.tsx](frontend/src/app/(dashboard)/atenciones/[id]/EncounterHeader.tsx)
  - [frontend/src/__tests__/lib/permissions.test.ts](frontend/src/__tests__/lib/permissions.test.ts)
  - [backend/src/encounters/encounters-workflow-complete-sign.ts](backend/src/encounters/encounters-workflow-complete-sign.ts)
  - [backend/src/encounters/encounters-workflow-complete-sign.spec.ts](backend/src/encounters/encounters-workflow-complete-sign.spec.ts)
- Explicacion concreta del problema:
  - En frontend, `canCompleteEncounter()` exige que el encounter activo haya sido creado por el mismo medico.
  - En backend, `completeEncounterWorkflowMutation()` solo exige que `encounter.medicoId === userId`.
  - Como el producto permite que asistentes creen atenciones, la UI rompe ese flujo colaborativo.
- Por que importa:
  - Bloquea un flujo clave y esperado del producto: asistente prepara, medico revisa y cierra.
  - Empuja a workarounds manuales o a rehacer atenciones.
- Como reproducirlo o como lo razone:
  - El test frontend actual ya codifica este comportamiento: el medico no puede completar una atencion creada por otro usuario.
  - El backend, en cambio, si acepta al medico tratante.
- Propuesta de solucion proporcional al tamano de la app:
  - Alinear la UI con la regla real del backend: el medico tratante debe poder completar aunque no sea `createdBy`.
  - Agregar regression test que cubra el caso exacto asistente-crea / medico-completa.
- Complejidad estimada de arreglo: Baja

### 2.4 Las alertas clinicas ya dejan trazabilidad y la recurrencia quedo definida

- Prioridad: Alto
- Area afectada: Backend, auditoria, seguridad funcional
- Archivos o modulos involucrados:
  - [backend/src/alerts/alerts.service.ts](backend/src/alerts/alerts.service.ts)
  - [backend/src/audit/audit-catalog.ts](backend/src/audit/audit-catalog.ts)
  - [backend/src/common/types/index.ts](backend/src/common/types/index.ts)
- Explicacion concreta del problema:
  - `AlertsService.create()` y `AlertsService.acknowledge()` ya quedaron auditados en codigo.
  - Lo que seguia abierto era la politica de alertas criticas recurrentes: ya se definio que una alerta reconocida puede volver a generarse si el valor peligroso persiste.
- Por que importa:
  - En una app medica pequena, no hace falta compliance teatral, pero si hace falta poder contestar una pregunta basica: quien creo esta alerta y quien la dio por reconocida.
  - Hoy esa trazabilidad no esta.
- Como reproducirlo o como lo razone:
  - La auditoria de alertas ya quedo implementada.
  - El punto restante ya se resolvio: una alerta crítica reconocida puede volver a generarse al repetirse el mismo valor peligroso.
- Propuesta de solucion proporcional al tamano de la app:
  - Mantener auditoria de `ALERT_CREATED` y `ALERT_ACKNOWLEDGED`.
  - Permitir que una alerta crítica reconocida vuelva a generarse si reaparece el mismo valor peligroso, para no perder la señal clinica.
  - Cubrirlo con una prueba backend pequena.
- Complejidad estimada de arreglo: Baja

### 2.5 La mayor parte de los flujos sensibles ya quedaron con negocio + auditoria en la misma transaccion

- Prioridad: Medio
- Area afectada: Backend, persistencia, manejo de errores
- Archivos o modulos involucrados:
  - [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts)
  - [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts)
  - [backend/src/patients/patients-task-mutations.ts](backend/src/patients/patients-task-mutations.ts)
  - [backend/src/patients/patients-problem-mutations.ts](backend/src/patients/patients-problem-mutations.ts)
  - [backend/src/consents/consents.service.ts](backend/src/consents/consents.service.ts)
  - [backend/src/encounters/encounters-workflow-complete-sign.ts](backend/src/encounters/encounters-workflow-complete-sign.ts)
- Explicacion concreta del problema:
  - Ya se corrigieron los flujos que mas importaban en este repo: encounters de cierre/firma, consentimientos, settings, attachments, tasks, problems, intake, demographics y lifecycle de pacientes.
  - El riesgo general de `mutacion -> auditoria` sigue existiendo como patron tecnico en otros servicios, pero ya no es el estado dominante de los flujos clinicos sensibles revisados.
- Por que importa:
  - Genera errores silenciosos invertidos: el usuario cree que fallo y reintenta, pero el cambio ya quedo aplicado.
  - En cierres, problemas, seguimientos o consentimientos esto puede crear confusion seria.
- Como reproducirlo o como lo razone:
  - Se validaron con tests y typecheck los codepaths sensibles ya transaccionados.
  - Queda auditoria separada en otros servicios menos criticos, pero no se trato como hallazgo prioritario porque no afecta el flujo clinico principal.
- Propuesta de solucion proporcional al tamano de la app:
  - Mantener el patron transaccional en los flujos clinicos criticos ya corregidos.
  - Revisar solo si aparece un caso nuevo con impacto clinico directo.
- Complejidad estimada de arreglo: Baja

### 2.6 El frontend oculta el mensaje real de bloqueo temporal de login

- Prioridad: Medio
- Area afectada: Frontend, UX, auth
- Archivos o modulos involucrados:
  - [backend/src/auth/auth-login-flow.ts](backend/src/auth/auth-login-flow.ts)
  - [frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx)
  - [frontend/src/__tests__/app/login.test.tsx](frontend/src/__tests__/app/login.test.tsx)
- Explicacion concreta del problema:
  - El backend devuelve un 401 especifico cuando la cuenta esta temporalmente bloqueada e indica cuantos minutos faltan.
  - El login page transforma cualquier 401 en `Credenciales incorrectas. Verifica tu correo y contrasena.`
- Por que importa:
  - El usuario recibe una instruccion falsa y tiende a seguir intentando.
  - En un producto interno de pocas personas, esto no rompe la seguridad, pero si empeora bastante el uso.
- Como reproducirlo o como lo razone:
  - `registerFailedLoginAttempt()` y `clearExpiredLockout()` construyen el mensaje especifico.
  - El `catch` del login page descarta ese mensaje si el status es 401.
  - El test actual del frontend lo valida asi.
- Propuesta de solucion proporcional al tamano de la app:
  - Si el backend entrega `message`, mostrarlo.
  - Solo usar el texto generico cuando no haya detalle util.
- Complejidad estimada de arreglo: Baja

### 2.7 Hipotesis: una alerta automatica critica puede dejar de reaparecer tras ser reconocida aunque el valor peligroso persista

- Prioridad: Medio
- Area afectada: Backend, UX clinica
- Archivos o modulos involucrados:
  - [backend/src/alerts/alerts.service.ts](backend/src/alerts/alerts.service.ts)
  - [backend/test/suites/encounters/encounters-sections.e2e-group.ts](backend/test/suites/encounters/encounters-sections.e2e-group.ts)
- Explicacion concreta del problema:
  - `checkVitalSigns()` no recrea una alerta automatica si ya existe otra identica para ese encuentro, aunque la anterior este reconocida.
  - La suite e2e actual valida explicitamente que no se recree.
- Por que importa:
  - Si la intencion clinica era que una condicion critica vuelva a mostrarse como activa cuando reaparece o persiste, hoy eso no pasa.
  - Si la intencion era evitar spam dentro del mismo encounter, entonces el comportamiento es consistente.
- Como reproducirlo o como lo razone:
  - La deduplicacion busca por `patientId + encounterId + type + severity + title + message + autoGenerated`, sin mirar `acknowledgedAt`.
- Propuesta de solucion proporcional al tamano de la app:
  - Definir con criterio clinico cual de las dos conductas se quiere.
  - Si debe reaparecer, ignorar alertas reconocidas al deduplicar o reactivar una nueva alerta activa.
- Complejidad estimada de arreglo: Media

## 3. Inconsistencias frontend-backend

### Contratos rotos o fragiles

| Tema | Frontend asume | Backend garantiza | Estado |
|---|---|---|---|
| Secciones solo medico | Ocultarlas en UI basta | Ya no. El backend filtra y niega la edicion de secciones clinicas sensibles para asistentes | Ya corregido |
| Completar atencion | Solo el medico creador puede cerrar | El backend permite al medico tratante, aunque no sea creador | Ya corregido |
| Login 401 | Todo 401 es credencial invalida | Ya no. La UI muestra el mensaje real de bloqueo temporal cuando el backend lo devuelve | Ya corregido |
| Session check en `proxy` | Se valida con fetch remoto en rutas publicas | Funciona, pero es una estrategia mas fragil y mas costosa que el chequeo optimista por cookie recomendado por Next.js | Ya corregido |

### Campos con nombres distintos

- No encontre hoy un drift activo relevante de nombres tipo `qrCode` vs `qrCodeDataUrl`; en el estado actual del repo ese punto parece alineado.

### Formatos incompatibles

- No vi hoy incompatibilidad rota en consentimientos/alertas. El shape que consume el frontend de consentimientos (`revokeReason`, `grantedBy`) coincide con el formateo actual del backend.

### Validaciones que no coinciden

- La visibilidad de secciones solo-medico sigue existiendo en frontend pero ya quedo reforzada en backend para lectura/escritura.
- El permiso de cierre de atencion ya quedo alineado entre `frontend/src/lib/permissions.ts` y `backend/src/encounters/encounters-workflow-complete-sign.ts`.

### Respuestas HTTP mal manejadas

- El frontend ya conserva el detalle de bloqueo temporal en login; la regresion anterior quedo corregida.

### Supuestos del frontend que el backend no garantiza

- El frontend asume que ocultar secciones clinicas sensibles equivale a restringirlas.
- El frontend ya quedo alineado para no bloquear al medico tratante; el supuesto viejo fue corregido.

## 4. Riesgos especificos por tratarse de una app medica

- Diagnostico y tratamiento expuestos a asistentes por payload aunque la UI los esconda. Esto puede confundir roles y exponer contenido clinico que el propio producto considera solo-medico.
- El asistente creador puede modificar diagnostico/tratamiento por API. Esto es el riesgo mas serio de toda la auditoria, porque afecta contenido clinico central, no solo metadata.
- El medico tratante puede quedar bloqueado para cerrar una atencion preparada por un asistente. Eso retrasa cierre, firma y salida documental en un flujo que el producto ya intenta soportar.
- Reconocer una alerta critica ya deja auditoria.
- Hipotesis clinica ya resuelta: una alerta critica de signos vitales reconocida debe poder reaparecer como activa si el mismo valor peligroso persiste o vuelve a registrarse.
- Lo que si esta bien: el bloqueo de output clinico cuando la ficha del paciente esta incompleta o pendiente de verificacion esta bien orientado y tiene cobertura visible en tests y flujo.

## 5. Mejoras recomendadas

### Quick wins

- Agregar auditoria a cualquier nuevo flujo clinico sensible que aparezca.
- Mantener cubiertas con tests las rutas ya corregidas de encounters, consentimientos, settings, attachments y pacientes.

### Arreglos de mayor impacto

- Consolidar la politica de permisos de encounters en un helper backend unico, en vez de repartirla entre UI, controller y mutation helpers.
- Revisar que eventos clinicos sensibles deben ser auditables por defecto: cierre, firma, alertas, consentimientos, exportaciones, cambios clinicos relevantes.
- Resolver el patron `mutacion -> auditoria` solo si aparece un flujo nuevo con impacto clinico directo.

### Limpieza tecnica util, no overkill

- Simplificar `frontend/src/proxy.ts` hacia un chequeo optimista por cookie y dejar la validacion fuerte a `DashboardLayout` / data layer. Esto ya quedo implementado.
- La lista de secciones solo-medico ya vive en una fuente compartida explicita (`shared/encounter-section-policy.ts`) y backend/frontend la consumen desde alli.

## 6. Nuevas funcionalidades sugeridas

| Funcionalidad | Que problema resuelve | Por que tiene sentido aqui | Impacto esperado | Dificultad | Prioridad |
|---|---|---|---|---|---|
| Checklist pre-cierre de atencion | Evita cierres con datos clave omitidos | Ya existe logica de completitud; falta una vista mas explicita para el usuario | Alto | Baja | Ahora |
| Banner fijo de alergias y medicacion activa dentro de la atencion | Reduce errores por olvidar antecedentes criticos mientras se redacta | El sistema ya tiene historial maestro y secciones clinicas | Alto | Baja/Media | Ahora |
| Reapertura guiada con motivo estructurado | Hace mas segura la correccion de atenciones completadas | Ya existe reabrir, pero conviene dejar causa mas visible y usable | Medio/Alto | Baja | Despues |
| Duplicar una atencion previa como borrador | Reduce reescritura en controles sucesivos | Encaja muy bien con encuentros seriados y app pequena | Alto | Media | Despues |
| Seguimientos recurrentes simples | Evita recrear tareas repetitivas a mano | Ya hay `EncounterTask`; esto es una extension natural | Medio | Media | Despues |
| Lista de pacientes recientes / ultimas atenciones abiertas | Reduce navegacion innecesaria | Muy util para 5 usuarios trabajando sobre pocos pacientes por vez | Medio | Baja | Ahora |
| Diff visible de cambios antes de firmar | Ayuda a revisar que se modifico realmente antes de firma | Ya hay auditoria y timeline; falta explotarlo mejor | Medio/Alto | Media | Despues |
| Estado clinico resumido en la ficha del paciente | Mejora continuidad entre encuentros | La app ya calcula resumen clinico y tendencias vitales | Medio | Media | Despues |

## 7. Estado tras primera pasada de fixes

- Resuelto en codigo: enforcement backend de secciones solo-medico en lectura detallada y en escritura de secciones por asistentes.
- Resuelto en codigo: la lista de secciones solo-medico quedo consolidada en `shared/encounter-section-policy.ts` y ya no se duplica entre backend y frontend.
- Resuelto en codigo: alineacion del permiso de cierre en frontend para que el medico tratante pueda completar atenciones aunque no sea `createdBy`.
- Resuelto en codigo: trazabilidad de alertas clinicas al crear y reconocer alertas, incluyendo las auto-generadas por signos vitales.
- Resuelto en codigo: el login ahora puede mostrar el mensaje real de bloqueo temporal devuelto por backend en vez de aplanarlo siempre como credenciales invalidas.
- Agregado en tests: cobertura para ocultar secciones solo-medico a asistentes, negar su edicion, reflejar la regla actual de cierre del medico tratante y mostrar el mensaje de lockout en login.
- Pendiente de decidir: ya no. La politica quedo ajustada para permitir reaparicion cuando el valor peligroso persiste.
- Validado en esta pasada:
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/app/login.test.tsx` OK
  - `npm --prefix backend run typecheck` OK
  - `npm --prefix backend run test -- --runInBand src/alerts/alerts.service.spec.ts src/encounters/encounters-workflow-complete-sign.spec.ts` OK
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` OK

## 8. Estado tras segunda pasada de fixes

- Resuelto en codigo: `Encounter.complete`, `Encounter.sign`, `Consent.create` y `Consent.revoke` ahora agrupan mutacion de negocio y auditoria dentro de la misma transaccion, reduciendo el riesgo de cambios aplicados con respuesta de error si falla el audit log.
- Resuelto en codigo: `frontend/src/proxy.ts` deja de hacer `fetch` remoto a `/api/auth/me` y pasa a un chequeo optimista por cookie, consistente con el uso recomendado para esta capa y menos fragil para rutas publicas.
- Agregado en tests: cobertura unitaria para consentimientos transaccionales y ajuste de tests de workflow/proxy a la nueva semantica.
- Pendiente principal de producto: ninguno de los de alto riesgo ya listados sigue abierto; la lista de secciones solo-medico ya quedo consolidada en una fuente compartida explicita.
- Pendiente tecnico importante: ya no. La referencia base de permisos generales vive en `shared/permission-contract.ts` y dejo de duplicarse como fixture JSON separado.
- Validado en esta pasada:
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/proxy.test.ts` OK
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounters-workflow-complete-sign.spec.ts src/consents/consents.service.spec.ts src/alerts/alerts.service.spec.ts` OK
  - `npm --prefix backend run typecheck` OK

## 9. Plan de accion priorizado

### Arreglar primero

1. Mantener la lista de secciones solo-medico en `shared/encounter-section-policy.ts` y no volver a duplicarla.
2. Mantener los tests de regresion que cubren los flujos ya corregidos.
3. Mantener el contrato compartido de encounters en `shared/encounter-permission-contract.ts` y extenderlo antes de agregar nuevas secciones sensibles o nuevas transiciones de workflow.

### Despues de eso

1. Agregar auditoria a cualquier flujo clinico nuevo que aparezca.
2. Si hiciera falta una vista mas humana del contrato, proyectarlo desde el helper compartido a docs o fixtures, no volver a duplicar logica a mano.
3. Afinar el resumen clinico/paciente reciente si el producto empieza a crecer en uso.

### Dejar para despues, pero sin olvidarlo

1. Revisar el patron de persistencia seguido de auditoria solo en servicios nuevos que introduzcan mutaciones sensibles.
2. Consolidar mas del contrato de permisos de encounters solo si aparece nueva superficie clinica sensible.
3. Mantener `proxy.ts` como chequeo optimista y no volver a checks remotos.

### No tocaria todavia

1. Rehacer arquitectura.
2. Separar servicios o meter colas.
3. Observabilidad pesada, hardening enterprise o cambios pensados para miles de usuarios.

## 10. Estado tras tercera pasada de fixes

- Resuelto en codigo: `encounters` ya no dependen solo de reglas paralelas entre frontend y backend; la politica compartida ahora vive en `shared/encounter-permission-contract.ts`.
- Resuelto en codigo: frontend y backend consumen el mismo contrato para visibilidad de secciones solo-medico, edicion por creador vs medico tratante, cierre en progreso y transiciones de `reviewStatus`.
- Agregado en tests: cobertura unitaria para el contrato compartido en helpers de permisos frontend y wrappers backend.
- Agregado en e2e: regresion explicita para el flujo `asistente crea -> medico tratante completa` sin rehacer la atencion.
- Actualizado en docs: `docs/security-and-permissions.md` y `docs/clinical-workflows.md` ya no describen como deuda activa varios drifts que en el estado actual del repo estan corregidos.
- Validado en esta pasada:
  - `npm --prefix backend run typecheck` OK
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounter-access-policy.spec.ts src/encounters/encounter-policy.spec.ts src/alerts/alerts.service.spec.ts src/encounters/encounters-workflow-complete-sign.spec.ts src/encounters/encounters-pdf.service.spec.ts` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/lib/permissions-contract.test.ts src/__tests__/app/login.test.tsx src/__tests__/lib/proxy.test.ts` OK
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` OK

## 11. Estado tras cuarta pasada de fixes

- Resuelto en codigo: el contrato compartido de `encounters` ahora tambien cubre `sign`, `reopen`, `cancel`, `export`, `print` y `audit`, no solo view/edit/complete/review.
- Resuelto en frontend: el wizard y la ficha clinica dejaron de depender de checks sueltos como `isDoctor` para review/sign; ahora consumen permisos derivados del contrato compartido.
- Agregado en tests: hay cobertura explicita para `canSign/canReopen/canCancel/canExport/canPrint/canViewAudit` y una regresion de UI para el caso `medico tratante puede finalizar una atencion creada por asistente`.
- Agregado en e2e: la proteccion de secciones solo-medico ya no se valida con un solo ejemplo; ahora cubre `SOSPECHA_DIAGNOSTICA`, `TRATAMIENTO` y `RESPUESTA_TRATAMIENTO`.
- Actualizado en docs: `docs/security-and-permissions.md` y `docs/clinical-workflows.md` ya reflejan que el contrato compartido cubre tambien acciones de workflow y salidas clinicas.
- Validado en esta pasada:
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix backend run typecheck` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/lib/permissions-contract.test.ts src/__tests__/app/atencion-cierre.test.tsx` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounters-workflow-reopen-cancel-review.spec.ts src/encounters/encounter-policy.spec.ts src/encounters/encounter-access-policy.spec.ts` OK
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` OK

## 12. Estado tras quinta pasada de fixes

- Resuelto en codigo: la referencia base de permisos generales ya no vive en `shared/permission-contract.json`; ahora la unica fuente compartida es `shared/permission-contract.ts`.
- Resuelto en tests: `permissions-contract`, `paciente-detalle` e `historial-paciente` consumen directamente el contrato TS compartido y dejan de depender de un JSON duplicado.
- Resuelto en frontend: `EncounterDrawer` ya no ata la `Nota de revisión` a `canEdit`; ahora usa un permiso fino derivado de las acciones reales de revisión disponibles.
- Resuelto en frontend: `Seguimiento Rápido` dentro del drawer ahora exige permiso explícito de creación de tareas del paciente y ya no queda visible por arrastre de otros permisos.
- Agregado en tests: cobertura visible para nota de revisión editable en atención completada y ocultamiento de seguimiento rápido cuando el usuario no tiene permiso.
- Actualizado en docs: referencias operativas y de seguridad ahora apuntan a `shared/permission-contract.ts`.
- Validado en esta pasada:
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix backend run typecheck` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/lib/permissions-contract.test.ts src/__tests__/app/atencion-cierre.test.tsx src/__tests__/app/paciente-detalle.test.tsx src/__tests__/app/historial-paciente.test.tsx` OK

## Base de evidencia usada

- Lectura de backend, frontend, schema Prisma, tests y docs internas.
- Validaciones ejecutadas:
  - `npm --prefix backend run typecheck` OK
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/app/login.test.tsx` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounters-workflow-complete-sign.spec.ts` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounter-access-policy.spec.ts src/encounters/encounter-policy.spec.ts src/alerts/alerts.service.spec.ts src/encounters/encounters-workflow-complete-sign.spec.ts src/encounters/encounters-pdf.service.spec.ts` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/lib/permissions-contract.test.ts src/__tests__/app/atencion-cierre.test.tsx` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounters-workflow-reopen-cancel-review.spec.ts src/encounters/encounter-policy.spec.ts src/encounters/encounter-access-policy.spec.ts` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/lib/permissions-contract.test.ts src/__tests__/app/atencion-cierre.test.tsx src/__tests__/app/paciente-detalle.test.tsx src/__tests__/app/historial-paciente.test.tsx` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/lib/permissions-contract.test.ts src/__tests__/app/login.test.tsx src/__tests__/lib/proxy.test.ts` OK
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` OK
