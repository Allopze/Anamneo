# Auditoria Tecnica End-to-End

Fecha: 2026-04-16
Repositorio auditado: entorno de desarrollo de Anamneo

## 1. Resumen ejecutivo

- La app tiene una base tecnica bastante mejor de lo que suele verse en una webapp interna pequena: NestJS modular, Next.js App Router, validacion global, auth con refresh por cookies, gating por completitud de paciente, y una suite de tests que ya cubre varias fronteras delicadas.
- No la veo como un caos ni como una app para rehacer. La arquitectura general es razonable para el contexto de hasta 5 usuarios.
- El principal problema real hoy no es de escala ni de infraestructura: es de permisos clinicos. Hay secciones que el frontend trata como `solo medico`, pero el backend aun las expone a asistentes y permite que el asistente creador las modifique por API.
- El segundo problema importante es un drift de permisos entre frontend y backend: el medico tratante puede completar una atencion en backend, pero la UI le bloquea el cierre si la atencion fue creada por un asistente.
- Tambien falta trazabilidad en alertas clinicas: crear y reconocer alertas no deja auditoria, aunque el sistema si audita muchos otros eventos sensibles.
- La app es razonablemente usable para su contexto actual si la usa principalmente el medico sin delegacion fuerte. En cuanto entra de verdad el flujo medico + asistente, hoy hay riesgos funcionales y clinicos que conviene corregir antes.
- Nivel de madurez general: medio. Buen esqueleto, varios controles sensatos, pero todavia hay drift contractual y reglas de permisos importantes viviendo solo en frontend.
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
  - [shared/permission-contract.json](shared/permission-contract.json)
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

### 2.4 Las alertas clinicas no dejan trazabilidad de creacion ni reconocimiento

- Prioridad: Alto
- Area afectada: Backend, auditoria, seguridad funcional
- Archivos o modulos involucrados:
  - [backend/src/alerts/alerts.service.ts](backend/src/alerts/alerts.service.ts)
  - [backend/src/audit/audit-catalog.ts](backend/src/audit/audit-catalog.ts)
  - [backend/src/common/types/index.ts](backend/src/common/types/index.ts)
- Explicacion concreta del problema:
  - `AlertsService.create()` crea la alerta y devuelve el registro sin llamar a `auditService.log()`.
  - `AlertsService.acknowledge()` cambia `acknowledgedAt/acknowledgedById` sin auditar el evento.
  - El catalogo de auditoria no tiene razones para `ClinicalAlert`.
- Por que importa:
  - En una app medica pequena, no hace falta compliance teatral, pero si hace falta poder contestar una pregunta basica: quien creo esta alerta y quien la dio por reconocida.
  - Hoy esa trazabilidad no esta.
- Como reproducirlo o como lo razone:
  - Se revisaron los codepaths y el catalogo de auditoria. No hay eventos `ClinicalAlert`.
- Propuesta de solucion proporcional al tamano de la app:
  - Agregar razones de auditoria `ALERT_CREATED` y `ALERT_ACKNOWLEDGED`.
  - Registrar ambos eventos con diffs minimos.
  - Cubrirlo con una prueba backend pequena.
- Complejidad estimada de arreglo: Baja/Media

### 2.5 Si falla la auditoria, varias operaciones pueden quedar aplicadas aunque el usuario reciba error

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
  - En muchos flujos, primero se persiste el cambio de negocio y despues se hace `await auditService.log()` por separado.
  - Si ese segundo write falla, el cliente puede ver un 500 aunque el dato clinico/operativo ya cambio en DB.
- Por que importa:
  - Genera errores silenciosos invertidos: el usuario cree que fallo y reintenta, pero el cambio ya quedo aplicado.
  - En cierres, problemas, seguimientos o consentimientos esto puede crear confusion seria.
- Como reproducirlo o como lo razone:
  - La mutacion y la auditoria no comparten transaccion en varios codepaths.
  - `AuditService.log()` puede lanzar error por fallo de DB o por catalogacion no resuelta.
- Propuesta de solucion proporcional al tamano de la app:
  - Para flujos clinicos criticos, incluir negocio + auditoria en la misma transaccion cuando sea simple hacerlo.
  - Para flujos no criticos, si se decide tolerar auditoria degradada, devolver exito y registrar un error tecnico aparte, no romper la operacion ya aplicada.
- Complejidad estimada de arreglo: Media

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
| Secciones solo medico | Ocultarlas en UI basta | No. `GET /encounters/:id` devuelve todas y `PUT /sections/:key` no filtra por rol | Roto |
| Completar atencion | Solo el medico creador puede cerrar | El backend permite al medico tratante, aunque no sea creador | Roto |
| Login 401 | Todo 401 es credencial invalida | El backend usa 401 tambien para bloqueo temporal con mensaje util | Roto |
| Session check en `proxy` | Se valida con fetch remoto en rutas publicas | Funciona, pero es una estrategia mas fragil y mas costosa que el chequeo optimista por cookie recomendado por Next.js | Fragil |

### Campos con nombres distintos

- No encontre hoy un drift activo relevante de nombres tipo `qrCode` vs `qrCodeDataUrl`; en el estado actual del repo ese punto parece alineado.

### Formatos incompatibles

- No vi hoy incompatibilidad rota en consentimientos/alertas. El shape que consume el frontend de consentimientos (`revokeReason`, `grantedBy`) coincide con el formateo actual del backend.

### Validaciones que no coinciden

- El permiso de cierre de atencion no coincide entre `frontend/src/lib/permissions.ts` y `backend/src/encounters/encounters-workflow-complete-sign.ts`.
- La visibilidad de secciones solo-medico existe en frontend, pero no en backend.

### Respuestas HTTP mal manejadas

- El frontend aplana cualquier 401 del login a un solo mensaje y pierde el detalle de bloqueo temporal.

### Supuestos del frontend que el backend no garantiza

- El frontend asume que ocultar secciones clinicas sensibles equivale a restringirlas.
- El frontend asume que quien no puede ver el boton de completar tampoco podria completar por API, pero backend usa otra regla.

## 4. Riesgos especificos por tratarse de una app medica

- Diagnostico y tratamiento expuestos a asistentes por payload aunque la UI los esconda. Esto puede confundir roles y exponer contenido clinico que el propio producto considera solo-medico.
- El asistente creador puede modificar diagnostico/tratamiento por API. Esto es el riesgo mas serio de toda la auditoria, porque afecta contenido clinico central, no solo metadata.
- El medico tratante puede quedar bloqueado para cerrar una atencion preparada por un asistente. Eso retrasa cierre, firma y salida documental en un flujo que el producto ya intenta soportar.
- Reconocer una alerta critica no deja auditoria. Si mas tarde hay duda sobre por que una alerta ya no estaba activa, hoy no hay rastro fiable del usuario y momento exacto.
- Hipotesis a validar con criterio clinico: una alerta critica de signos vitales reconocida una vez podria dejar de reaparecer como activa aunque se vuelva a registrar el mismo valor peligroso dentro del mismo encounter.
- Lo que si esta bien: el bloqueo de output clinico cuando la ficha del paciente esta incompleta o pendiente de verificacion esta bien orientado y tiene cobertura visible en tests y flujo.

## 5. Mejoras recomendadas

### Quick wins

- Mover la regla de secciones solo-medico al backend y filtrar tambien la lectura.
- Corregir `canCompleteEncounter()` para que siga la misma logica que el backend.
- Mostrar el mensaje real de bloqueo temporal en login.
- Agregar auditoria a `ClinicalAlert.create` y `ClinicalAlert.acknowledge`.
- Agregar tres tests de regresion pequenos y de alto impacto:
  - asistente no recibe secciones solo-medico en `GET /encounters/:id`
  - asistente no puede `PUT` una seccion solo-medico
  - medico puede completar una atencion creada por asistente

### Arreglos de mayor impacto

- Consolidar la politica de permisos de encounters en un helper backend unico, en vez de repartirla entre UI, controller y mutation helpers.
- Revisar que eventos clinicos sensibles deben ser auditables por defecto: cierre, firma, alertas, consentimientos, exportaciones, cambios clinicos relevantes.
- Resolver el patron `mutacion -> auditoria` para evitar operaciones exitosas que aparentan fallar.

### Limpieza tecnica util, no overkill

- Simplificar `frontend/src/proxy.ts` hacia un chequeo optimista por cookie y dejar la validacion fuerte a `DashboardLayout` / data layer. Context7 para Next.js 16 recomienda evitar checks remotos o de DB dentro de `proxy` por costo y fragilidad.
- Dejar la lista de secciones solo-medico en una fuente compartida o, mejor todavia, derivarla desde el backend y no solo desde constantes del frontend.

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
- Resuelto en codigo: alineacion del permiso de cierre en frontend para que el medico tratante pueda completar atenciones aunque no sea `createdBy`.
- Resuelto en codigo: trazabilidad de alertas clinicas al crear y reconocer alertas, incluyendo las auto-generadas por signos vitales.
- Resuelto en codigo: el login ahora puede mostrar el mensaje real de bloqueo temporal devuelto por backend en vez de aplanarlo siempre como credenciales invalidas.
- Agregado en tests: cobertura para ocultar secciones solo-medico a asistentes, negar su edicion, reflejar la regla actual de cierre del medico tratante y mostrar el mensaje de lockout en login.
- Pendiente de decidir: si la deduplicacion de alertas criticas reconocidas debe mantenerse o permitir reaparicion cuando el valor peligroso persiste dentro del mismo encounter.
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
- Pendiente principal de producto: decidir el comportamiento clinico deseado para alertas criticas reconocidas que vuelven a aparecer o persisten.
- Pendiente tecnico importante: consolidar politicas de permisos de encounters en una sola fuente de verdad compartida para evitar drift entre backend y frontend.
- Validado en esta pasada:
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/proxy.test.ts` OK
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounters-workflow-complete-sign.spec.ts src/consents/consents.service.spec.ts src/alerts/alerts.service.spec.ts` OK
  - `npm --prefix backend run typecheck` OK

## 8. Plan de accion priorizado

### Arreglar primero

1. Enforce server-side de secciones solo-medico en lectura y escritura.
2. Corregir el permiso de cierre en frontend para que el medico tratante pueda completar atenciones creadas por asistentes.
3. Agregar tests de regresion para esos dos puntos.

### Despues de eso

1. Agregar auditoria de alertas clinicas.
2. Corregir el manejo del mensaje de lockout en login.
3. Definir si las alertas criticas deben reaparecer tras reconocimiento cuando el valor sigue siendo peligroso.

### Dejar para despues, pero sin olvidarlo

1. Revisar el patron de persistencia seguido de auditoria fuera de transaccion en flujos sensibles.
2. Simplificar `proxy.ts` para bajar fragilidad y trabajo innecesario en auth.
3. Consolidar permisos de encounters en una politica backend unica para reducir drift futuro.

### No tocaria todavia

1. Rehacer arquitectura.
2. Separar servicios o meter colas.
3. Observabilidad pesada, hardening enterprise o cambios pensados para miles de usuarios.

## Base de evidencia usada

- Lectura de backend, frontend, schema Prisma, tests y docs internas.
- Context7/Context7-compatible docs para Next.js 16 sobre `proxy`: recomendacion de chequeo optimista por cookie y evitar validaciones remotas pesadas en esa capa.
- Validaciones ejecutadas:
  - `npm --prefix backend run typecheck` OK
  - `npm --prefix frontend run typecheck` OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/lib/permissions.test.ts src/__tests__/app/login.test.tsx` OK
  - `npm --prefix backend run test -- --runInBand src/encounters/encounters-workflow-complete-sign.spec.ts` OK
