# Auditoria integral de Anamneo

Fecha: 2026-05-24  
Alcance: producto, UI/UX, arquitectura frontend/backend, QA, seguridad operacional y estrategia de producto.  
Metodo: revision estatica profunda de documentacion, rutas, componentes, stores, API clients, controladores, servicios, modelo Prisma, permisos, tests y configuracion. No se ejecuto la matriz completa de pruebas en la primera pasada; los hallazgos se basan en lectura de codigo y artefactos del repo.

## Estado de remediacion

Actualizacion: 2026-05-24. Revision contrastada con codigo y remediacion adicional: 2026-05-26.

Correcciones aplicadas en esta ronda:

- Cerrada la brecha critica de autorizacion en `patient-consents`: el controlador ahora usa `RolesGuard` y el servicio valida scope de paciente antes de listar, otorgar o revocar consentimientos de tratamiento de datos.
- Agregada prueba e2e de aislamiento para consentimientos de tratamiento de datos: usuario A no puede listar, otorgar ni revocar consentimientos de paciente fuera de su scope.
- Normalizado el `PatientNotBlockedGuard`: las rutas de lectura (`GET`, `HEAD`, `OPTIONS`) ya no quedan bloqueadas por error, y las mutaciones de pacientes, problemas, tareas, alertas y consentimientos clinicos pasan por el guard.
- Agregada resolucion de paciente desde `problemId`, `taskId`, `clinicalAlert.id` y `clinicalConsent.id` para cubrir mutaciones que no reciben `patientId` directo.
- Agregada matriz e2e de bloqueo temporal: lectura historica permitida y mutaciones clinicas principales denegadas con `403`.
- Ajustado el contrato de permisos FE/BE para consentimientos clinicos: asistentes pueden registrar evidencia, la revocacion queda reservada al medico.
- Corregido el conflicto entre dictado por voz y `Permissions-Policy`: el microfono queda permitido para `self` salvo que `NEXT_PUBLIC_ENABLE_VOICE_DICTATION=false`; el boton ahora muestra error visible si el dictado no puede iniciar.
- Corregida la CSP de frontend para permitir el origen de `NEXT_PUBLIC_SENTRY_DSN` en `connect-src` cuando Sentry esta activo.
- Extraida la construccion de CSP/Permissions-Policy a `frontend/src/lib/proxy-security.ts` y cubierta con tests unitarios.
- Ajustada la CSP para compatibilidad con el bootstrap inline que Next.js emite en App Router; queda pendiente hardening estricto con nonces/dynamic rendering.
- Reforzado el modo de privacidad local: `sharedDeviceMode` queda activo por defecto salvo `NEXT_PUBLIC_DEFAULT_SHARED_DEVICE_MODE=false`, reduciendo persistencia local de PHI en estaciones compartidas.
- Agregado cifrado WebCrypto para borradores de atencion y copias recuperables de conflicto antes de persistir en `localStorage`; valores legacy plaintext se descartan.
- Agregado cifrado WebCrypto del payload clinico de la cola offline antes de persistir en IndexedDB.
- Resuelta la decision de almacenamiento local de PHI para el contexto actual: uso personal/controlado, opt-in por admin/env, TTL 24h, recuperacion tras cierre del navegador y falla cerrada sin plaintext.
- Cambiada la clave local de PHI a persistencia de navegador para soportar recuperacion tras cerrar el browser; el riesgo residual queda documentado en `DECISION_ALMACENAMIENTO_LOCAL_PHI.md`.
- Creado `DECISION_ALMACENAMIENTO_LOCAL_PHI.md` en la raiz con opciones, respuestas del dev, decision adoptada, riesgo residual y runbook minimo.
- Ampliado `legalStatus` compartido de paciente para exponer si puede recibir atencion, crear/editar atenciones, subir adjuntos, registrar consentimientos, si tiene consentimiento vigente de tratamiento de datos, evidencia/version legal del consentimiento y detalle navegable de solicitudes DSAR activas.
- Agregado resumen visual de estado legal en la ficha de paciente, incluyendo consentimiento de datos, version/hash de evidencia y solicitudes activas con enlace al modulo admin, extraido a componente propio para no crecer `page.tsx`.
- Ejecutadas migraciones destructivas locales para eliminar columnas plaintext legacy de representantes legales, firmantes de consentimientos y solicitantes DSAR, despues de backup, backfill y verificacion de prerequisitos.
- Actualizado `schema.prisma`, servicios y tests para que los campos cifrados/hash sean la unica fuente de verdad tras los drops legacy.
- Agregado guardrail estatico post-drop `npm --prefix backend run audit:legacy-plaintext` para evitar regresiones de dependencias a columnas PHI plaintext ya eliminadas.
- Agregado E2E focalizado de headers de seguridad (`test:e2e:security-headers`) para CSP y `Permissions-Policy`.
- Extraida la logica de integridad/hash chain de auditoria a `backend/src/audit/audit-integrity.ts`, reduciendo `audit.service.ts` bajo el limite duro de 500 lineas.
- Agregada supresion de desgloses detallados en analitica clinica para cohortes menores a 10 pacientes; se mantiene el resumen minimo y caveat explicito.
- Agregado guardrail estatico `npm --prefix backend run audit:patient-scope` para detectar controladores nuevos con `patientId` sin contrato de scope conocido.
- Agregado modo CSP estricto opt-in con `NEXT_PUBLIC_STRICT_CSP=true` para validar `script-src` con nonce/`strict-dynamic` en staging antes de activarlo por defecto.
- Reducido `frontend/src/app/register/page.tsx` bajo el limite duro de 500 lineas extrayendo `RegisterPasswordFields`.
- Corregidos labels accesibles, contraste y nombres de controles en analitica, pacientes, seguimientos, sidebar y superficies legales.
- Corregido el flujo de registro para evitar fallback persistente de `Suspense`/`useSearchParams` en e2e productivo.
- Corregido refresh web para aceptar refresh token por body solo en clientes moviles identificados.
- Corregida preservacion de verificacion de paciente al actualizar identificadores cifrados.
- Agregado caveat de cohorte pequena en analitica clinica cuando el filtro devuelve menos de 10 pacientes.
- Actualizado `docs/technical-debt/files-over-300-lines.md` con snapshot priorizado de archivos grandes.
- Relajado el throttling de endpoints sensibles solo en `NODE_ENV=test` para evitar falsos `429` durante Playwright; limites productivos se mantienen.
- Contrastado el estado de la auditoria contra el codigo actual: `patient-consents`, `PatientNotBlockedGuard`, CSP/Sentry, dictado, PHI local cifrada, columnas plaintext legacy y guardrails estaticos estan implementados.
- Reducido `backend/src/patient-portal/patient-portal.service.ts` bajo el limite duro de 500 lineas extrayendo `PatientPortalAuditLogService`.
- Reducido `frontend/src/app/(dashboard)/agenda/page.tsx` bajo el limite duro de 500 lineas extrayendo modales de creacion/detalle y tipos/constantes de agenda.
- Actualizado el backlog de archivos grandes con conteo real post-refactor.

Validaciones ejecutadas:

- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix backend run audit:patient-scope`
- `npm --prefix backend run audit:legacy-plaintext`
- `DATABASE_URL=postgresql://postgres:***@localhost:5432/anamneo?... npm --prefix backend run prisma:migrate:prod`
- `npm --prefix backend run prisma:generate`
- Verificacion SQL local de ausencia de columnas legacy en `Patient`, `PatientDataProcessingConsent` y `PatientDataRequest`
- `npm --prefix backend run test -- patient-legal-status.spec.ts patient-consents.service.spec.ts patient-data-rights.service.workflow.spec.ts --runInBand`
- `npm --prefix backend run test -- audit.service.spec.ts audit.service.concurrency.spec.ts --runInBand`
- `npm --prefix frontend run test -- encounter-draft.test.ts --runInBand`
- `npm --prefix frontend run test -- paciente-detalle.test.tsx --runInBand`
- `npm --prefix backend run test -- clinical-analytics.read-model.spec.ts --runInBand`
- `npm --prefix frontend run test -- encounter-draft.test.ts proxy.test.ts --runInBand`
- `npm --prefix frontend run test -- offline-queue.test.ts --runInBand`
- `npm --prefix frontend run test -- clinical-analytics-page.test.tsx register-legal.test.ts login.test.tsx --runInBand`
- `npm --prefix backend run test` (90 suites pass, 1 skipped; 492 tests pass, 2 skipped)
- `npm --prefix frontend run test` (69 suites pass; 324 tests pass)
- `npm --prefix backend run test -- patient-consents.service.spec.ts patient-not-blocked.guard.spec.ts`
- `npm --prefix backend run test -- patient-not-blocked.guard.spec.ts clinical-analytics.read-model.spec.ts`
- `npm --prefix backend run test -- patients-demographics-mutations.spec.ts patients-list-read-model.spec.ts`
- `npm --prefix backend run test -- auth.service.session.spec.ts auth-refresh-flow.spec.ts`
- `npm --prefix frontend run test -- clinical-analytics-page.test.tsx`
- `npm --prefix frontend run test -- ajustes.test.tsx encounter-draft.test.ts offline-queue.test.ts`
- `npm --prefix frontend run test -- permissions-contract.test.ts patient-consents.test.tsx proxy.test.ts`
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` (280 tests pass, 1 snapshot pass)
- `npm --prefix frontend run test:e2e -- accessibility.spec.ts` (6 tests pass)
- `npm --prefix frontend run test:e2e` (20 tests pass)
- `PLAYWRIGHT_DATABASE_URL=postgresql://postgres:***@localhost:5432/anamneo_playwright_headers?... npm --prefix frontend run test:e2e:security-headers` (1 test pass)
- `npm --prefix backend run typecheck` (post-refactor portal paciente)
- `npm --prefix frontend run typecheck` (post-refactor agenda)

Pendiente fuera del alcance de esta ronda, por requerir validacion externa, migracion operativa o nueva funcionalidad:

- Prueba real/staging de Sentry bajo CSP.
- Prueba manual de dictado por voz en navegador objetivo.
- Revalidacion de politica de PHI local si Anamneo pasa de uso personal/controlado a uso clinico real con equipos compartidos.
- Validacion staging del modo `NEXT_PUBLIC_STRICT_CSP=true`; el soporte opt-in ya existe, pero no debe activarse por defecto sin smoke real.
- Despliegue operativo de las migraciones destructivas en staging/produccion con el mismo checklist de backup, backfill, verificacion SQL y rollback ya probado en local.
- Refactor estructural de archivos grandes restantes hacia el umbral recomendado de 300 lineas. En el snapshot 2026-05-26 no quedan archivos productivos de `backend/src`, `frontend/src` o `shared` sobre 500 lineas; si quedan varios archivos productivos entre 300 y 500, y tests heredados sobre 500.

## Resumen ejecutivo

Anamneo es un sistema de ficha clinica y gestion de atenciones para prestadores de salud en Chile. El producto apunta principalmente a medicos y asistentes clinico-administrativos, con un rol admin orientado a operacion de la plataforma. Los flujos centrales son: autenticacion, registro/activacion de usuarios, gestion de pacientes, preparacion de datos clinicos, atenciones por secciones, consentimientos, adjuntos, seguimientos, analitica clinica, auditoria y portal/derechos del titular de datos.

La base tecnica es solida: backend modular en NestJS, frontend en Next.js App Router, contratos compartidos de permisos, CSRF, CSP, cookies httpOnly, cifrado de campos sensibles, auditoria, e2e stateful y una intencion clara de cumplir Ley 21.719. La experiencia clinica tambien esta bastante avanzada: atenciones seccionales, autosave, cola offline, conflictos, completitud de paciente, consentimientos, alertas y analitica.

El principal riesgo no esta en la madurez general, sino en inconsistencias puntuales de autorizacion y cumplimiento. La remediacion del 2026-05-24 cerro los riesgos mas directos en consentimientos de tratamiento de datos, bloqueo temporal, CSP/dictado, privacidad local por defecto, decision de PHI local para el contexto actual, cifrado local de PHI, accesibilidad automatizada, estabilidad e2e y eliminacion local de columnas plaintext legacy. Queda pendiente deuda estructural de mantenibilidad y validaciones manuales/staging.

La recomendacion es no tratar esto como una auditoria cosmetica. Tras la remediacion aplicada, los frentes prioritarios antes de ampliar funcionalidad son reducir deuda en archivos core demasiado grandes, llevar las migraciones destructivas ya probadas a staging/produccion y validar manualmente integraciones sensibles como Sentry/dictado.

## Supuestos de producto

- El usuario principal es personal clinico de una consulta o centro medico pequeno/mediano: medico, asistente y admin operacional.
- Anamneo busca bajar friccion en el registro clinico, no reemplazar juicio medico.
- La plataforma opera inicialmente con una sola clinica o tenancy acotada, pero el modelo apunta a crecer hacia multiusuario/multiflujo.
- Chile y Ley 21.719 son contexto regulatorio explicito, por lo que el manejo de datos sensibles debe ser tratado como requisito de producto, no como extra legal.
- El sistema esta en una etapa cercana a produccion o endurecimiento, no en prototipo temprano.

## Escala de severidad

- Critica: riesgo de acceso indebido, perdida de datos, incumplimiento regulatorio material o bloqueo grave de flujo clinico.
- Alta: bug o deuda que puede generar errores clinicos, fuga indirecta, operacion inconsistente o friccion fuerte en usuarios clave.
- Media: problema relevante de UX, mantenibilidad, cobertura o consistencia, sin exposicion inmediata grave.
- Baja: mejora incremental, refinamiento visual, microcopy o deuda menor.

## Hallazgos prioritarios

### 1. Brecha critica de autorizacion en consentimientos de tratamiento de datos

Pantalla o modulo afectado: backend `patient-consents`, UI de consentimientos de tratamiento de datos.  
Archivos: `backend/src/patient-consents/patient-consents.controller.ts`, `backend/src/patient-consents/patient-consents.service.ts`.

Problema: el controlador usa solo `JwtAuthGuard` y el servicio verifica que el paciente exista, pero no valida que el usuario autenticado tenga acceso a ese paciente. Esto aplica a listar, otorgar y revocar consentimientos de tratamiento de datos.

Impacto en usuario/producto: un usuario autenticado podria consultar o alterar consentimientos de pacientes fuera de su ambito si conoce o consigue un UUID de paciente. Es un riesgo directo de privacidad, cumplimiento y confianza.

Severidad: critica.

Estado 2026-05-24: corregido. `PatientConsentsController` usa `RolesGuard` con roles explicitos y `PatientConsentsService` valida acceso al paciente antes de leer, crear o revocar. Se agregaron tests unitarios y e2e stateful de aislamiento entre pacientes/usuarios.

Evidencia:

- `backend/src/patient-consents/patient-consents.controller.ts:28` usa `@UseGuards(JwtAuthGuard)` sin guard de roles ni scope de paciente.
- `backend/src/patient-consents/patient-consents.service.ts:50` valida existencia del paciente, pero no autorizacion del usuario sobre el paciente.
- `backend/src/patient-consents/patient-consents.service.ts:57` consulta por `patientId` y luego descifra datos sensibles.
- `backend/src/patient-consents/patient-consents.service.ts:173` revoca por `consentId` sin comprobar acceso al paciente asociado.

Recomendacion concreta:

- Agregar `RolesGuard` y roles explicitos al controlador.
- Pasar `currentUser` al servicio en operaciones por paciente.
- Usar el mismo helper de acceso a paciente que usan otros modulos (`assertPatientAccess` o equivalente).
- En revocacion, cargar consentimiento, obtener `patientId` y validar acceso antes de mutar.
- Agregar tests e2e de aislamiento entre usuarios/medicos.

Ejemplo de criterio esperado:

```ts
await assertPatientAccess(this.prisma, currentUser, patientId);
```

El criterio debe ejecutarse antes de listar, otorgar o revocar cualquier consentimiento asociado al paciente.

### 2. Bloqueo temporal de paciente aplicado de forma contradictoria

Pantalla o modulo afectado: atenciones, adjuntos, pacientes, alertas, consentimientos, derechos de datos.  
Archivos: `backend/src/patient-data-rights/patient-not-blocked.guard.ts`, `backend/src/encounters/encounters.controller.ts`, `backend/src/attachments/attachments.controller.ts`, `backend/src/patients/*`, `backend/src/alerts/*`, `backend/src/consents/*`, `backend/src/patient-consents/*`.

Problema: el guard `PatientNotBlockedGuard` declara que bloquea mutaciones clinicas, pero esta aplicado a nivel de controlador en atenciones y adjuntos. Eso bloquea tambien lecturas, exportaciones o descargas. En paralelo, varias mutaciones clinicas o relacionadas al paciente no usan ese guard.

Impacto: un paciente bloqueado por tratamiento de datos puede quedar en un estado incoherente: no se puede leer una atencion o descargar un adjunto, pero si se podrian modificar problemas, tareas, alertas o consentimientos desde otros endpoints. Esto debilita el cumplimiento y puede bloquear operacion clinica legitima.

Severidad: alta.

Estado 2026-05-24: corregido para la matriz tecnica prioritaria. El guard ya no bloquea lecturas y se aplica a mutaciones de pacientes, problemas, tareas, alertas y consentimientos clinicos. Se agrego e2e que valida lectura historica permitida y mutaciones clinicas principales denegadas. Queda pendiente decision de producto sobre operaciones regulatorias/admin permitidas durante bloqueo.

Evidencia:

- `backend/src/patient-data-rights/patient-not-blocked.guard.ts:4` documenta bloqueo de mutaciones clinicas.
- `backend/src/patient-data-rights/patient-not-blocked.guard.ts:38` deniega si `patient.blockedAt`.
- `backend/src/encounters/encounters.controller.ts:32` aplica el guard al controlador completo.
- `backend/src/encounters/encounters.controller.ts:75` contiene exportacion y `:116` lectura de atencion bajo el mismo guard.

Recomendacion concreta:

- Definir una matriz explicita: lectura historica, exportacion legal, descarga de adjuntos, nueva atencion, edicion de atencion, creacion de alerta, tareas, problemas, consentimientos.
- Cambiar el guard para operar por metodo HTTP o por metadata de ruta.
- Aplicarlo de forma consistente a todos los endpoints de mutacion clinica.
- Permitir lectura historica cuando corresponda, especialmente para continuidad, auditoria y cumplimiento.
- Crear tests e2e con paciente bloqueado que cubran todos los modulos relevantes.

### 3. Dictado por voz ofrecido en UI pero bloqueado por Permissions-Policy

Pantalla o componente afectado: secciones clinicas de la atencion que usan `VoiceDictationButton`.  
Archivos: `frontend/src/proxy.ts`, `frontend/src/components/common/VoiceDictationButton.tsx`, componentes de secciones clinicas.

Problema: la aplicacion expone dictado por voz via Web Speech API, pero el middleware de frontend define `Permissions-Policy: microphone=()`, bloqueando el uso de microfono en el documento.

Impacto: el boton puede aparecer en navegadores compatibles, pero fallar silenciosamente o no iniciar captura. En un producto clinico, prometer dictado y fallar en consulta genera frustracion y perdida de confianza.

Severidad: alta.

Estado 2026-05-24: corregido tecnicamente. `Permissions-Policy` permite microfono para `self` salvo opt-out por `NEXT_PUBLIC_ENABLE_VOICE_DICTATION=false`, y el boton muestra error visible ante fallo/permisos. Queda pendiente smoke manual en navegador objetivo.

Evidencia:

- `frontend/src/proxy.ts:84` bloquea `microphone=()`.
- `frontend/src/components/common/VoiceDictationButton.tsx:27` detecta `SpeechRecognition`/`webkitSpeechRecognition`.
- `frontend/src/components/common/VoiceDictationButton.tsx:65` apaga el estado ante error, pero no informa causa al usuario.

Recomendacion concreta:

- Elegir una direccion de producto: retirar/feature-flaguear dictado o habilitarlo correctamente.
- Si se mantiene, cambiar policy a `microphone=(self)` solo en entornos/rutas donde aplique.
- Agregar mensaje de error visible para permisos denegados o API no disponible.
- Agregar test e2e o smoke manual documentado para navegador objetivo.

### 4. CSP de frontend probablemente bloquea Sentry en navegador

Pantalla o modulo afectado: observabilidad frontend.  
Archivos: `frontend/src/proxy.ts`, `frontend/src/instrumentation-client.ts`.

Problema: la politica CSP usa `connect-src 'self'`. Si `NEXT_PUBLIC_SENTRY_DSN` apunta a Sentry SaaS, los eventos de cliente no podran enviarse.

Impacto: errores reales de navegador, replays o trazas pueden perderse justo en produccion, reduciendo capacidad de respuesta del equipo.

Severidad: media-alta.

Estado 2026-05-24: corregido tecnicamente. La CSP agrega el origen de `NEXT_PUBLIC_SENTRY_DSN` a `connect-src` cuando existe y esta cubierta por unit tests. Tambien existe modo opt-in `NEXT_PUBLIC_STRICT_CSP=true` para validar `script-src` con nonce/`strict-dynamic` en staging, y un E2E focalizado valida los headers emitidos por Next. Queda pendiente prueba en staging contra el DSN real y contra el modo estricto antes de activarlo por defecto.

Recomendacion concreta:

- Derivar el origen del DSN y permitirlo en `connect-src` cuando Sentry este activo.
- Alternativamente, usar relay same-origin.
- Agregar una prueba o checklist de CSP en staging con error de prueba controlado.
- Validar `NEXT_PUBLIC_STRICT_CSP=true` en staging antes de eliminar `unsafe-inline` por defecto.

### 5. PHI en almacenamiento local del navegador para drafts y cola offline

Pantalla o modulo afectado: atenciones, autosave, offline queue.  
Archivos: `frontend/src/lib/encounter-draft.ts`, `frontend/src/lib/offline-queue.ts`, `frontend/src/stores/auth-store.ts`.

Problema: los borradores de atencion y cambios pendientes se guardan en `localStorage` e IndexedDB con TTL, incluyendo datos clinicos potencialmente sensibles. La implementacion contempla limpieza y modo shared-device, pero sigue siendo una decision de riesgo alta para estaciones compartidas.

Impacto: en computadores compartidos, perfiles persistentes o sesiones mal cerradas, puede quedar informacion clinica en disco local del navegador.

Severidad: alta como riesgo de privacidad; media como bug si el modo shared-device esta bien configurado en operacion.

Estado 2026-05-24: mitigado, endurecido y decidido para el contexto actual. `sharedDeviceMode` queda activo por defecto salvo `NEXT_PUBLIC_DEFAULT_SHARED_DEVICE_MODE=false`, lo que desactiva drafts/conflictos/cola offline locales por defecto. Si el admin/dev permite persistencia local en equipo personal o administrado, drafts, conflictos y payloads de cola offline se cifran con WebCrypto antes de escribirse en `localStorage`/IndexedDB. La clave de PHI local queda persistente en el navegador para recuperar drafts tras cerrar el browser, con riesgo residual documentado. Para clinicas reales o equipos compartidos, la decision sigue siendo mantener `sharedDeviceMode=true` hasta tener politica formal de dispositivo.

Recomendacion concreta:

- Hacer `sharedDeviceMode` predeterminado en contextos clinicos o administrado por politica.
- Mantener el cifrado WebCrypto local y fallar cerrado si no esta disponible.
- Mantener la politica documentada en `DECISION_ALMACENAMIENTO_LOCAL_PHI.md`.
- Revalidar la decision si cambia el contexto de uso personal a clinica real.
- Mostrar indicadores operativos claros de borrador/pendiente/conflicto sin sobrecargar al usuario clinico con jerga tecnica.
- Reducir TTL o hacerlo configurable por organizacion.
- Purgar drafts al expirar sesion, cambiar usuario o cerrar atencion.

### 6. Archivos core sobre el umbral recomendado de mantenibilidad

Modulo afectado: legal, mail, audit, registro y flujos clinicos frontend.  
Archivos principales post-remediacion local 2026-05-26:

| Archivo | Lineas |
| --- | ---: |
| `frontend/src/components/PatientDataProcessingConsents.tsx` | 490 |
| `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx` | 484 |
| `backend/src/patient-portal/patient-portal.service.ts` | 476 |
| `frontend/src/app/register/page.tsx` | 462 |
| `backend/src/patients/patients-merge-mutation.helpers.ts` | 460 |
| `frontend/src/app/(dashboard)/pacientes/page.tsx` | 450 |
| `frontend/src/app/(dashboard)/atenciones/page.tsx` | 447 |
| `frontend/src/app/(dashboard)/pacientes/[id]/editar/EditarPacienteFormSections.tsx` | 445 |
| `frontend/src/app/(dashboard)/admin/solicitudes/page.tsx` | 445 |
| `frontend/src/app/login/LoginClient.tsx` | 442 |

Problema: ya no quedan archivos productivos de `backend/src`, `frontend/src` o `shared` sobre el limite duro de 500 lineas, pero varios archivos manuales siguen sobre el umbral recomendado de 300. Los casos que estaban sobre 500 durante la revision (`legal.service.ts`, `mail.service.ts`, portal paciente y agenda) fueron reducidos o ya estaban reducidos al contrastar con codigo actual. Persisten tests heredados sobre 500 lineas como deuda separada.

Impacto: mayor riesgo de cambios inseguros en modulos de alto impacto: legal, auditoria, emails, registro, detalle de paciente y autosave de atenciones.

Severidad residual: media para mantenibilidad; media-alta en pantallas/flujos clinicos o legales que concentran muchas decisiones.

Recomendacion concreta:

- Seguir bajando archivos productivos hacia 300 lineas con extracciones por caso de uso, no por estetica.
- Priorizar `PatientDataProcessingConsents`, detalle de paciente, portal paciente, registro y hooks de atencion.
- Mantener `legal.service.ts`, `mail.service.ts`, `audit.service.ts`, portal paciente y agenda fuera del limite duro de 500 con guardrail periodico.
- Actualizar el documento de deuda tecnica y convertirlo en backlog con owners.

### 7. Columnas plaintext sensibles eliminadas localmente; pendiente despliegue operativo

Modulo afectado: modelo de datos y migraciones de privacidad.  
Archivos: `backend/prisma/schema.prisma`, `backend/prisma/migrations/*`.

Problema original: el esquema conservaba columnas plaintext legacy para datos de representantes legales, firmantes y solicitantes de derechos. Estado actual local: las fases destructivas D/E/F fueron activadas, aplicadas localmente y el codigo ya no depende de esas columnas.

Impacto residual: el riesgo queda desplazado a operacion de release. Staging y produccion deben repetir el checklist de backup, backfill, verificacion SQL y rollback antes de desplegar los drops.

Severidad residual: media operativa.

Recomendacion concreta:

- Mantener campos cifrados/hash como fuente de verdad.
- Ejecutar `npm --prefix backend run audit:legacy-plaintext` en CI/release junto con `audit:patient-scope`.
- Verificar backfill completo en staging y produccion antes del rollout destructivo.
- Ejecutar fases D/E/F en staging/produccion con backup y prueba de rollback.
- Extender el guardrail cuando se agreguen nuevos campos sensibles.

## Bugs e inconsistencias reproducibles

```text
Bug:
IDOR en consentimientos de tratamiento de datos por patientId.
Ubicacion:
backend/src/patient-consents/patient-consents.controller.ts y backend/src/patient-consents/patient-consents.service.ts
Severidad:
Critica.
Como reproducir:
1. Iniciar sesion como usuario clinico A.
2. Obtener un patientId perteneciente a otro usuario o ambito.
3. Llamar GET /api/patient-consents/patient/{patientId}.
4. Llamar POST /api/patient-consents/grant o POST /api/patient-consents/{consentId}/revoke.
Resultado actual:
El servicio solo valida existencia del paciente/consentimiento y retorna o modifica datos.
Resultado esperado:
Denegacion sin exponer existencia del paciente; en el patron actual del backend, `NotFoundException` para evitar enumeracion.
Causa probable:
Modulo nuevo implementado fuera del patron de assertPatientAccess usado en otros dominios.
Solucion recomendada:
Agregar RolesGuard y validacion de scope de paciente en todas las operaciones.
Archivos posiblemente involucrados:
backend/src/patient-consents/patient-consents.controller.ts, backend/src/patient-consents/patient-consents.service.ts, backend/src/common/utils/patient-access.ts
```

```text
Bug:
Paciente bloqueado no puede leer atenciones/adjuntos, pero aun puede recibir otras mutaciones clinicas.
Ubicacion:
PatientNotBlockedGuard, EncountersController, AttachmentsController, PatientsAuxController, PatientsManagementController, AlertsController, ConsentsController.
Severidad:
Alta.
Como reproducir:
1. Bloquear temporalmente un paciente desde derechos de datos.
2. Intentar leer una atencion existente o descargar un adjunto.
3. Intentar modificar problemas/tareas/alertas/consentimientos desde endpoints no protegidos por PatientNotBlockedGuard.
Resultado actual:
Lecturas en controladores protegidos pueden quedar bloqueadas; otras mutaciones siguen disponibles.
Resultado esperado:
Regla uniforme: lecturas historicas permitidas segun politica; mutaciones clinicas denegadas de forma consistente.
Causa probable:
Guard aplicado a nivel de controlador y no como matriz central de operaciones permitidas.
Solucion recomendada:
Crear matriz de bloqueo por dominio y metodo; aplicar guard por metadata o interceptor de politica.
Archivos posiblemente involucrados:
backend/src/patient-data-rights/patient-not-blocked.guard.ts, backend/src/encounters/encounters.controller.ts, backend/src/attachments/attachments.controller.ts, backend/src/patients/*
```

```text
Bug:
Dictado por voz falla por politica de permisos.
Ubicacion:
frontend/src/proxy.ts y frontend/src/components/common/VoiceDictationButton.tsx
Severidad:
Alta.
Como reproducir:
1. Abrir una atencion en navegador compatible con Web Speech API.
2. Pulsar "Dictar" en una seccion clinica.
3. Observar fallo o ausencia de transcripcion.
Resultado actual:
La politica global bloquea microphone=().
Resultado esperado:
La UI no debe mostrar dictado si no puede funcionar, o debe habilitar microfono con permisos controlados.
Causa probable:
Hardening de headers no sincronizado con funcionalidad de dictado.
Solucion recomendada:
Feature flag + Permissions-Policy compatible + error visible.
Archivos posiblemente involucrados:
frontend/src/proxy.ts, frontend/src/components/common/VoiceDictationButton.tsx
```

```text
Bug:
Eventos Sentry de cliente probablemente bloqueados por CSP.
Ubicacion:
frontend/src/proxy.ts y frontend/src/instrumentation-client.ts
Severidad:
Media-alta.
Como reproducir:
1. Configurar NEXT_PUBLIC_SENTRY_DSN con Sentry SaaS.
2. Generar error de cliente en staging.
3. Revisar consola/red: la solicitud a Sentry queda bloqueada por connect-src.
Resultado actual:
connect-src solo permite 'self'.
Resultado esperado:
El origen de Sentry o relay debe estar permitido cuando Sentry este activo.
Causa probable:
CSP generica no parametrizada por integraciones activas.
Solucion recomendada:
Construir connect-src a partir de DSN o usar relay same-origin.
Archivos posiblemente involucrados:
frontend/src/proxy.ts, frontend/src/instrumentation-client.ts
```

```text
Bug:
Filtros de analitica clinica dependen de placeholder y no tienen labels accesibles.
Ubicacion:
frontend/src/app/(dashboard)/analitica-clinica/page.tsx
Severidad:
Media.
Como reproducir:
1. Abrir /analitica-clinica.
2. Navegar con lector de pantalla o inspeccionar nombres accesibles de inputs/selects.
Resultado actual:
El input de condicion usa placeholder; selects y fechas no tienen label visible o aria-label.
Resultado esperado:
Cada control debe tener nombre accesible estable y comprensible.
Causa probable:
Grid compacto construido visualmente sin componente de campo reutilizable.
Solucion recomendada:
Agregar labels visibles o sr-only para condicion, fuente, fecha desde, fecha hasta y ventana de seguimiento.
Archivos posiblemente involucrados:
frontend/src/app/(dashboard)/analitica-clinica/page.tsx
```

```text
Bug:
Boton "Nuevo" en consentimientos clinicos puede ser ambiguo para asistentes.
Ubicacion:
frontend/src/components/PatientConsents.tsx y backend/src/consents/consents.controller.ts
Severidad:
Media.
Como reproducir:
1. Iniciar sesion como ASISTENTE.
2. Abrir ficha de paciente.
3. Ver modulo de consentimientos clinicos.
Resultado actual:
El asistente puede iniciar "Nuevo", mientras la revocacion se reserva al medico; el lenguaje no explica claramente si el asistente registra, prepara u otorga.
Resultado esperado:
La UI y backend deben reflejar una politica clara: asistente puede preparar/registrar evidencia o solo medico puede otorgar.
Causa probable:
Permisos funcionales y microcopy evolucionaron en paralelo.
Solucion recomendada:
Definir matriz de permisos de consentimiento clinico y ajustar copy/roles.
Archivos posiblemente involucrados:
frontend/src/components/PatientConsents.tsx, backend/src/consents/consents.controller.ts, shared/permission-contract.ts
```

```text
Bug:
Borradores clinicos pueden persistir en navegador compartido mas alla de la expectativa del usuario.
Ubicacion:
frontend/src/lib/encounter-draft.ts, frontend/src/lib/offline-queue.ts
Severidad:
Alta como riesgo de privacidad.
Como reproducir:
1. Editar una atencion con datos sensibles.
2. Cortar red o dejar cambios pendientes.
3. Cerrar pestana sin logout o usar perfil compartido.
4. Inspeccionar localStorage/IndexedDB antes del TTL.
Resultado actual:
Datos clinicos pueden quedar persistidos localmente.
Resultado esperado:
La persistencia local debe ser cifrada, minimizada, comunicada al usuario o desactivada por politica en equipos compartidos.
Causa probable:
Decicion UX correcta para resiliencia, sin endurecimiento local completo.
Solucion recomendada:
WebCrypto con clave de sesion, modo compartido por defecto, purga agresiva y UX explicita.
Archivos posiblemente involucrados:
frontend/src/lib/encounter-draft.ts, frontend/src/lib/offline-queue.ts, frontend/src/stores/auth-store.ts
```

## Auditoria UI/UX

### Direccion visual general

La UI transmite producto cuidado y moderno. El dashboard, el shell privado y varias pantallas clinicas usan jerarquia clara, estados de carga y componentes reutilizables. Hay una decision estetica calida y amigable, con tarjetas amplias, bordes redondeados y superficies suaves.

Riesgo: para uso clinico repetitivo, algunas superficies pueden sentirse mas editoriales que operacionales. En fichas de paciente, analitica y administracion conviene priorizar densidad escaneable, contraste funcional y menos variacion visual.

Severidad: baja-media.

Recomendacion:

- Mantener la calidez en login/onboarding.
- Usar una variante mas densa para vistas clinicas frecuentes: tablas, listas, alertas, timelines y panels legales.
- Reducir `rounded-2xl`/superficies muy decorativas en modulos operacionales, especialmente compliance y detalle de paciente.

### Login y registro

Fortalezas:

- Buen enfoque de seguridad: cookies, CSRF, 2FA, flujo de bootstrap, registro con validacion.
- Microcopy orientado a confianza y contexto regulatorio.

Problemas:

- `frontend/src/app/register/page.tsx` supera 500 lineas, lo que hace dificil mantener un flujo sensible.
- El primer usuario/admin y activacion pueden generar friccion si el producto se instala en clinicas pequenas sin soporte tecnico.

Impacto: onboarding mas fragil y mayor probabilidad de bugs en cambios de registro.

Severidad: media.

Recomendacion:

- Extraer pasos de registro, validaciones y llamadas API a hooks/componentes.
- Agregar checklist post-registro para admin inicial: usuarios, roles, consentimiento base, politica de equipo compartido y datos de clinica.

### Pacientes y ficha clinica

Fortalezas:

- El flujo de paciente tiene mucho valor: datos demograficos, completitud, problemas, alertas, consentimientos, adjuntos, tareas y resumen admin.
- El bloqueo por completitud/verificacion reduce riesgo de salidas clinicas incompletas.

Problemas:

- La ficha concentra demasiadas decisiones de distinto nivel: datos clinicos, legal/compliance, adjuntos, tareas y alertas compiten visualmente.
- Componentes legales como `PatientDataProcessingConsents` y `PatientBlockingControls` usan estilos con `slate`, `teal`, `rose`, `rounded-2xl` y copy denso, menos alineados al sistema visual principal.
- La diferencia entre consentimiento clinico y consentimiento de tratamiento de datos requiere mejor separacion conceptual.

Impacto: el usuario puede no distinguir rapido que bloquea atencion, que es evidencia legal y que es informacion clinica activa.

Severidad: media-alta.

Recomendacion:

- Crear un bloque "Estado legal y permisos de tratamiento" separado del bloque clinico.
- Usar estados muy explicitos: "Habilitado para atencion", "Tratamiento de datos bloqueado", "Consentimiento pendiente", "Solo lectura".
- Separar consentimientos clinicos de consentimientos de tratamiento de datos con iconografia y copy consistentes.

### Atencion clinica

Fortalezas:

- Flujo seccional robusto.
- Autosave, borradores, conflictos, cola offline y estados de completitud estan bien pensados.
- Las secciones tienen potencial para reducir mucho esfuerzo clinico.

Problemas:

- El rail/seccionado puede volverse complejo en mobile.
- El dictado por voz ya es coherente con headers de seguridad a nivel tecnico; falta smoke manual en navegador objetivo.
- La resiliencia offline aumenta riesgo de PHI local si no hay politica operacional fuerte.
- La cantidad de estados posibles puede ser dificil de explicar: guardado local, guardado remoto, pendiente de sincronizar, conflicto, bloqueado, firmado.

Impacto: alto valor funcional con riesgo de friccion cognitiva y privacidad local.

Severidad: alta por dictado/PHI; media por navegacion.

Recomendacion:

- Agregar un pequeno indicador unificado de estado de guardado con tooltip accesible.
- En mobile, ofrecer navegacion de secciones como segmented list o drawer persistente, no solo rail desktop.
- Resolver formalmente la politica de persistencia local antes de promocionarla como diferenciador; para dictado, completar smoke manual y criterio de soporte por navegador.

### Analitica clinica

Fortalezas:

- El modulo aporta direccion estrategica: cohortes, desenlaces proxy, patrones de tratamiento y exportes.

Problemas:

- Los filtros detectados por axe ya tienen labels accesibles; mantener el patron en nuevos controles compactos.
- La palabra "desenlaces proxy" es correcta tecnicamente, pero puede ser interpretada como evidencia causal.
- Se necesitaba prevenir reidentificacion en cohortes pequenas si la analitica se comparte fuera del medico tratante. Se agrego supresion automatica de desgloses para cohortes menores a 10 pacientes, ademas del caveat explicito.

Impacto: riesgo de malinterpretacion clinica y pequenas fallas de accesibilidad.

Severidad: media.

Recomendacion:

- Mantener labels accesibles en todos los filtros nuevos.
- Mostrar disclaimers breves en exportes: "analisis observacional, no causal".
- Mantener supresion de desgloses para cohortes pequenas y validar con producto si el umbral de 10 pacientes debe variar por rol/contexto.

### Admin y ajustes

Fortalezas:

- El producto contempla administracion de usuarios, seguridad de perfil y solicitudes.

Problemas:

- Algunas pantallas/archivos son grandes y concentran multiples preocupaciones.
- Admin no debe parecer usuario clinico accidental; su experiencia debe estar orientada a operacion, permisos, auditoria y cumplimiento.

Severidad: media.

Recomendacion:

- Separar ajustes de perfil, seguridad, sesiones y preferencias en componentes menores.
- En admin, reforzar lenguaje operacional y evitar CTAs que parezcan clinicos si el rol no puede atender pacientes.

## Auditoria de logica y flujos

### Autenticacion y sesion

La arquitectura de autenticacion esta bien encaminada: cookies httpOnly, CSRF double-submit, refresh controlado, middleware de rutas y store frontend. El helper de API centraliza refresh y evita llamadas directas al backend desde navegador, respetando el rewrite `/api`.

Riesgos:

- Cualquier endpoint nuevo debe pasar por la misma disciplina de roles/scope. `patient-consents` demuestra que el patron no esta aun suficientemente blindado por abstraccion o tests.
- Mobile clients pueden saltar CSRF por diseno. Esto es aceptable si hay autenticacion movil robusta y tests separados; debe estar documentado como contrato.

### Permisos

La existencia de `shared/permission-contract.ts` es una fortaleza: alinea intencion frontend/backend. Aun asi, los permisos reales deben vivir en backend. La brecha de `patient-consents` mostro que conviene tener guardrails transversales por dominio. En esta ronda se agrego `npm --prefix backend run audit:patient-scope`, que lista controladores con `patientId` y exige evidencia estatica de scope o una excepcion explicita.

Recomendacion:

- Ejecutar `npm --prefix backend run audit:patient-scope` en CI/release y actualizar su contrato cuando se agreguen dominios nuevos.
- Agregar decorador o interceptor de dominio para reducir dependencia de recordar el helper manualmente.

### Consentimientos y derechos de datos

El producto distingue consentimiento clinico, tratamiento de datos y solicitudes de derechos. Esa separacion es correcta y valiosa. El problema es que la aplicacion todavia no expresa una politica uniforme entre UI, controladores y servicios.

Recomendacion:

- Definir una "fuente de verdad" de estados legales del paciente.
- Exponer un DTO resumido para UI: `canReceiveCare`, `canCreateEncounter`, `canEditEncounter`, `canUploadAttachment`, `legalBlockReason`, `requiredActions`.
- Usar ese DTO tanto para habilitar UI como para validar backend.

### Persistencia y sincronizacion

El flujo de autosave/offline esta por encima del promedio para una app clinica interna. El riesgo no es funcional sino de privacidad y explicabilidad. Los estados de guardado deben ser imposibles de confundir.

Recomendacion:

- Formalizar estados: `remote-saved`, `local-draft`, `queued`, `syncing`, `conflict`, `failed`, `blocked`.
- Hacer que cada estado tenga icono, texto, accion y politica de purga.

## Auditoria tecnica

### Backend

Fortalezas:

- Modularidad por dominio clara.
- Controladores mayormente delgados.
- Prisma centralizado.
- Guards y decorators reutilizables.
- Cifrado de varios campos sensibles.
- Auditoria y health checks considerados.

Deuda o riesgos:

| Hallazgo | Impacto | Prioridad |
| --- | --- | --- |
| `patient-consents` sin scope de paciente | Cerrado con guard, scope service y e2e de aislamiento | Cerrado |
| Bloqueo temporal no uniforme | Cerrado para matriz tecnica prioritaria; falta definicion fina admin/regulatoria | P1 producto |
| Archivos productivos entre 300 y 500 lineas | Mantenibilidad y errores en cambios; sin incumplimiento del limite duro post-refactor | P2 |
| Campos plaintext legacy | Drops destructivos aplicados localmente; pendiente rollout staging/prod con checklist | P1 operativo |
| Estados clinicos como strings dispersos | Bugs por valores invalidos | P2 |
| Reglas legales repartidas | Mitigado con `legalStatus` compartido para bloqueo, consentimiento, evidencia/version legal y DSAR activas navegables; faltan excepciones admin/regulatorias completas | P2 |

Refactors priorizados:

1. Ampliar la capa de politica de paciente iniciada con `legalStatus`: excepciones regulatorias/admin y permisos de mutacion.
2. Seguir dividiendo archivos productivos >300 lineas en casos de uso/componentes acotados.
3. Desplegar migraciones de eliminacion de plaintext legacy en staging/produccion.
4. Tipar estados clinicos con enums o contratos compartidos mas estrictos.
5. Agregar tests de autorizacion por dominio, no solo tests felices de flujo.

### Frontend

Fortalezas:

- App Router ordenado.
- API client centralizado.
- Store de auth con limpieza local.
- Componentes clinicos ricos.
- Buen uso de estados loading/error en muchas pantallas.
- Tests de paginas y accesibilidad existentes.

Deuda o riesgos:

| Hallazgo | Impacto | Prioridad |
| --- | --- | --- |
| Dictado vs Permissions-Policy | Cerrado tecnicamente; pendiente smoke manual | P1 validacion |
| Drafts/queue con PHI local | Mitigado por modo compartido por defecto, cifrado WebCrypto y decision para uso personal/controlado | P1 operativo si cambia el contexto |
| Pantallas >400-500 lineas | Mantenibilidad; `register/page.tsx` ya bajo de 500, quedan otros modulos | P1/P2 |
| Analitica/seguimientos con controles sin labels | Cerrado en controles detectados por axe | Cerrado |
| Estilos legales fuera de tokens | Mitigado en contraste/tokens prioritarios | P2 |
| Complejidad de atencion repartida en hooks largos | Riesgo de regresiones | P2 |

Refactors priorizados:

1. Convertir flujo de atencion en una maquina de estados ligera o reducer tipado.
2. Extraer componentes legales/compliance con tokens de diseno.
3. Reducir patient detail, patient creation y ajustes en subcomponentes; continuar extraccion de hooks de registro si crece de nuevo.
4. Crear componentes de form field accesibles obligatorios para filtros compactos.

## QA y testing

Fortalezas:

- Hay cobertura backend, frontend y e2e.
- El e2e stateful de backend esta documentado.
- Existen pruebas de accesibilidad con axe para rutas publicas y privadas.
- El producto ya tiene tests para flows clinicos, analitica, consentimientos y seguridad.

Brechas:

- Cerrado: ya existe test e2e especifico de aislamiento en `patient-consents`, ademas de cobertura unitaria para denegar acceso cruzado.
- Cerrado para matriz prioritaria: ya existe e2e de bloqueo de paciente con lectura historica permitida y mutaciones clinicas principales denegadas.
- La cobertura de accesibilidad automatizada usa principalmente serious/critical y no reemplaza navegacion completa por teclado/screen reader.
- Hay unit tests y E2E focalizado de CSP/headers y modo estricto; faltan smoke tests reales contra Sentry/dictado en navegador/staging.
- Faltan escenarios robustos de perdida de red, conflicto y cierre de sesion en atencion.

Pruebas recomendadas:

1. Extender matriz de bloqueo si producto define excepciones regulatorias/admin durante bloqueo temporal.
2. Playwright: atencion mobile, cambio de seccion, autosave, conflicto y reload.
3. Playwright a11y manual: analitica, detalle paciente, modal de consentimiento, admin usuarios.
4. CSP smoke: Sentry client event y dictado segun feature flag.
5. Unit tests de helper de estados de guardado/offline.

## Mejoras de producto alineadas con Anamneo

### P0/P1: confianza, cumplimiento y continuidad

- Panel unico de "Estado legal del paciente": iniciado en ficha de paciente con habilitacion/bloqueo/acciones, consentimiento de tratamiento, evidencia/version legal y solicitudes activas navegables; falta sumar excepciones admin/regulatorias y vista dedicada de investigacion/soporte.
- Matriz de permisos visible para admin: que puede hacer medico, asistente y admin.
- Modo equipo compartido gestionado por politica, no solo preferencia local.
- Evidencia de consentimiento mas robusta: identidad del firmante, vinculo, documento asociado, version legal aceptada y auditoria visible.

### P1/P2: mejorar flujo clinico

- Checklist preconsulta para asistente: datos minimos, consentimiento, motivo, signos vitales, adjuntos pendientes.
- Handoff asistente-medico: estado "preparado para medico" con resumen de cambios.
- Explicabilidad de sugerencias clinicas: por que se sugiere una condicion, que campos coincidieron y nivel de confianza operacional.
- Plantillas de seccion por especialidad, con variables clinicas controladas.

### P2/P3: analitica y estrategia

- Cohortes con umbral minimo y lenguaje anti-causalidad.
- Seguimientos convertidos en workflow: crear tarea desde atencion, resultado esperado, recordatorio y cierre.
- Portal paciente enfocado en derechos: solicitudes, descarga de ficha, consentimientos vigentes y revocaciones.
- Export medico-legal versionado con hash/auditoria para documentos sensibles.

## Plan de accion recomendado

### Primeras 48 horas

1. Cerrado: autorizacion de `patient-consents`.
2. Cerrado: tests unitarios y e2e stateful de regresion para acceso cruzado por paciente.
3. Cerrado tecnico: dictado habilitado con policy compatible y opt-out por env.
4. Cerrado para matriz prioritaria: guard ajustado a lecturas vs mutaciones, aplicado a endpoints de mayor riesgo y cubierto por e2e. Pendiente solo definicion fina de producto para operaciones regulatorias/admin.
5. Cerrado para contexto actual: decision de PHI local documentada y aplicada con recuperacion tras cierre de navegador.
6. Cerrado parcial: estado legal compartido expuesto en ficha de paciente con bloqueo, consentimiento de tratamiento, evidencia/version legal y solicitudes DSAR activas navegables.
7. Cerrado local: drops destructivos de plaintext legacy aplicados tras backup/backfill/verificacion y guardrail `audit:legacy-plaintext` actualizado para evitar regresiones.
8. Cerrado local: `patient-portal.service.ts` y `agenda/page.tsx` quedaron bajo 500 lineas mediante extracciones focalizadas.

### 1 a 2 semanas

1. Completar politica central de paciente sobre el `legalStatus` compartido: excepciones regulatorias/admin y permisos de mutacion por caso regulatorio.
2. Ejecutar migraciones destructivas de columnas plaintext en staging/produccion con checklist operativo.
3. Continuar bajando archivos productivos >300 lineas hacia componentes/casos de uso mas pequenos, priorizando consentimientos de datos, detalle de paciente, registro y persistencia de atencion.
4. Rehacer componentes legales de ficha paciente con sistema visual consistente.
5. Revalidar la politica de almacenamiento local de PHI solo si Anamneo pasa a uso clinico real, multiusuario o equipos compartidos.

### 1 mes

1. Convertir estados de atencion/autosave/offline en reducer o maquina de estados tipada.
2. Ampliar Playwright a flujos clinicos reales en desktop/mobile.
3. Consolidar portal paciente y derechos de datos como modulo de confianza.
4. Lanzar checklist preconsulta y handoff asistente-medico.
5. Crear dashboard de cumplimiento para admin.

## Criterios de salida para produccion sensible

Antes de operar con datos reales a escala, recomendaria exigir:

- Cero endpoints por `patientId` sin prueba de acceso.
- Matriz de bloqueo/consentimiento cubierta por e2e.
- CSP compatible con todas las integraciones activas.
- Decision formal sobre almacenamiento local de PHI registrada y revalidada para el contexto real de despliegue.
- Migraciones de plaintext legacy completadas en el entorno objetivo o excepcion documentada con fecha de salida.
- Auditoria de accesibilidad manual en atencion, paciente y consentimientos.
- Runbook de incidente de privacidad y revocacion de acceso.

## Cierre

Anamneo ya tiene una arquitectura y ambicion de producto superiores a un CRUD clinico tradicional. La mayor oportunidad es convertir esa madurez en confianza operacional: menos reglas implicitas, mas politica centralizada, permisos imposibles de olvidar y una UI que separe nitidamente cuidado clinico, administracion y cumplimiento legal.

La prioridad no deberia ser agregar mas pantallas, sino asegurar que las pantallas existentes sean consistentes con las promesas del producto: baja friccion, seguridad pragmatica y confianza clinica.
