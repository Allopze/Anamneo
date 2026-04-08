# Auditoria Tecnica Webapp Medica

Fecha: 2026-04-08

## Resumen ejecutivo

La base tecnica del producto es bastante mas solida de lo habitual para un proyecto pequeno: el backend tiene validacion global estricta, la separacion por modulos es clara, la autenticacion con cookies y rotacion de refresh token esta razonablemente bien armada y la suite automatizada relevante quedo nuevamente validada en esta iteracion.

El problema principal no esta en compilacion, seguridad basica o ausencia total de pruebas, sino en varios puntos de integridad funcional donde el sistema permite que estados clinicos o administrativos queden representados de forma enganosa. En una app medica, eso importa mucho mas que una imperfeccion cosmética: hoy hay rutas donde el sistema puede guardar datos de paciente ficticios como si fueran reales, perder contexto de revision clinica al cerrar una atencion, contaminar el catalogo reutilizable con texto libre del historial y aceptar estados de problemas clinicos fuera del contrato esperado.

Mi conclusion: el producto sigue siendo utilizable y, tras esta iteracion, los dos frentes mas delicados de integridad de datos quedaron bastante mejor contenidos. La decision que faltaba sobre ficha incompleta ya quedo resuelta en los puntos mas sensibles: ahora el sistema bloquea cierre de atencion, exportes PDF/documentales oficiales y la propia impresion de la ficha mientras la ficha maestra siga `INCOMPLETA` o `PENDIENTE_VERIFICACION`. En la superficie HTML, la vista sigue siendo consultable en pantalla, pero en modo impresion oculta el contenido clinico y emite solo un aviso de bloqueo.

Tambien use Context7 para contrastar dos decisiones de framework con documentacion actual: el comportamiento de `proxy` en Next.js y el alcance real del `ValidationPipe` global de NestJS.

## Estado de implementacion

Actualizado: 2026-04-08

### Implementado en esta iteracion

1. Se corrigio la sobrescritura de `reviewNote` al completar una atencion.
2. Se restauro validacion real para updates parciales de problemas clinicos con un DTO derivado via `PartialType`.
3. Se alineo el modal de atenciones en progreso con el permiso real del backend: cancelar ya no se expone por defecto y solo se habilita para medicos en los callers actuales.
4. Se evito que el historial del paciente escriba automaticamente nuevas entradas en el catalogo local reutilizable.
5. Se corrigio `edadMeses` opcional para que un input vacio no termine en `NaN`.
6. Se corrigio la deteccion de contenido del historial para ignorar metadatos tecnicos.
7. Se agregaron regresiones automaticas backend/frontend para estos cambios.
8. El alta rapida dejo de persistir placeholders semanticos: ahora guarda `null` en edad/sexo/prevision y marca el origen del registro como `RAPIDO`.
9. Se introdujo un estado formal de completitud de ficha (`INCOMPLETA`, `PENDIENTE_VERIFICACION`, `VERIFICADA`) con metadatos de verificacion medica.
10. Los updates administrativos y medicos recalculan ese estado de forma consistente, y existe un endpoint medico explicito para verificar una ficha completada por recepcion/asistencia.
11. Se agregaron indicadores visuales de completitud en lista, detalle, ficha administrativa, creacion de atencion, wizard de atencion, ficha clinica y PDF exportado.
12. Se agrego migracion Prisma/SQLite y regresiones e2e/Jest para el flujo `alta rapida -> completar -> verificar`.
13. El historial del paciente ahora distingue entre "agregar solo al historial" y "agregar tambien al catalogo local", sin persistencia automatica implicita.
14. El catalogo local ahora deduplica por nombre normalizado en `createLocal()` y rechaza renombres que colisionen por nombre normalizado en `updateLocal()`.
15. El shell del dashboard ahora revalida siempre la sesion real con `GET /auth/me` antes de liberar UI protegida, aunque el store ya venga hidratado.
16. El `proxy` de Next.js dejo de tratar la mera presencia de cookies como sesion confirmada para redirigir desde rutas publicas; ahora solo lo hace cuando el `access_token` fue validado, manteniendo compatibilidad con recuperacion via `refresh_token`.
17. Se centralizo una politica de bloqueo clinico por completitud de ficha en el backend y se expuso en el read model de `Encounter`.
18. `POST /encounters/:id/complete`, `GET /encounters/:id/export/pdf` y `GET /encounters/:id/export/document/:kind` ahora rechazan en backend cuando la ficha maestra del paciente sigue `INCOMPLETA` o `PENDIENTE_VERIFICACION`.
19. El wizard de atencion y la ficha clinica deshabilitan cierre, exportes oficiales e impresion desde la propia UI, explican el motivo y redirigen operativamente a la ficha administrativa del paciente.
20. Se agregaron regresiones Jest/e2e para estos bloqueos en estados `INCOMPLETA` y `PENDIENTE_VERIFICACION`.
21. La ficha HTML bloqueada ya no expone contenido clinico al papel si el usuario fuerza la impresion desde el navegador: en `print` solo sale un aviso generico de bloqueo.

### Pendiente de implementacion

No quedan pendientes implementables de esta auditoria sobre las superficies actuales del producto.

### Pendiente operativo futuro

1. Cualquier nuevo canal de salida clinica futuro (mail, integraciones, firma digital, nuevos PDFs) debe reutilizar esta misma politica central antes de exponerse.

## Hallazgos

### 1. Critico: el flujo de alta rapida guarda datos ficticios de paciente y luego los propaga a la atencion clinica

Estado: implementado en esta iteracion.

**Que pasa**

Originalmente el flujo rapido para asistentes creaba pacientes con placeholders semanticos (`edad: 0`, `sexo: PREFIERE_NO_DECIR`, `prevision: DESCONOCIDA`) que luego se propagaban al snapshot de `IDENTIFICACION`, a la ficha y al PDF clinico como si fueran datos confirmados.

En esta iteracion se reemplazo ese comportamiento por:

- persistencia de `null` reales en edad/sexo/prevision para `POST /patients/quick`
- `registrationMode` (`COMPLETO` o `RAPIDO`)
- `completenessStatus` (`INCOMPLETA`, `PENDIENTE_VERIFICACION`, `VERIFICADA`)
- endpoint medico explicito de verificacion demografica
- advertencias visibles en lista, detalle, wizard, ficha y PDF cuando la identificacion sigue incompleta o pendiente
- bloqueo duro de cierre y exportes oficiales mientras la ficha maestra no este `VERIFICADA`
- ocultamiento del contenido clinico en `print` dentro de la ficha HTML bloqueada, reemplazado por un aviso generico no sensible

**Por que importa**

No es solo un formulario incompleto: el sistema transforma ausencia de dato en dato aparentemente valido. Un paciente puede terminar con una atencion o un PDF mostrando `0 anos`, sexo indefinido y prevision desconocida sin una marca fuerte de ficha incompleta. En contexto medico eso genera ambiguedad documental y puede afectar identificacion, trazabilidad y lectura posterior del caso.

**Riesgo real**

Un medico puede abrir una atencion y asumir que los datos de identificacion ya fueron confirmados porque aparecen estructurados y persistidos. No hay una distincion fuerte entre "dato verificado" y "placeholder operacional".

**Recomendacion**

La decision operativa ya quedo tomada y aplicada donde mas importa: no se puede completar la atencion ni emitir documentos oficiales mientras la ficha maestra siga incompleta o pendiente de verificacion, y la ficha HTML bloqueada ya no entrega contenido clinico al papel aunque el usuario intente imprimirla desde el navegador.

### 2. Alto: al completar una atencion se sobrescribe la nota de revision con la nota de cierre

Estado: implementado en esta iteracion.

**Que pasa**

El backend modela `reviewNote` y `closureNote` como conceptos distintos, pero al completar la atencion ejecuta:

- `reviewNote: sanitizedClosureNote`
- `closureNote: sanitizedClosureNote`

en `backend/src/encounters/encounters.service.ts:1236-1247`.

Eso contradice el propio flujo de revision, donde `updateReviewStatus()` guarda `reviewNote` por separado en `backend/src/encounters/encounters.service.ts:1369-1420`.

En el frontend, la separacion tambien existe de forma explicita: la pantalla de atencion tiene un campo `Nota de revision` y otro `Nota de cierre` distintos en `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`.

**Por que importa**

Se pierde contexto de handoff entre asistente y medico, y tambien se degrada la trazabilidad medico-legal del flujo. La nota de revision explica por que la atencion fue enviada o marcada como revisada; la nota de cierre resume el acto clinico final. No son intercambiables.

**Riesgo real**

Un medico puede completar una atencion y borrar sin querer la justificacion de revision previa, dejando un registro historico menos confiable.

**Recomendacion**

Mantener ambos campos independientes end-to-end, no tocar `reviewNote` en `complete()`, y agregar e2e que cubra el caso: enviar a revision -> marcar revisada -> completar -> verificar que la nota de revision original se conserva.

### 3. Alto: `PUT /patients/problems/:problemId` permite persistir estados clinicos fuera del contrato esperado

Estado: implementado en esta iteracion.

**Que pasa**

El controlador usa `@Body() dto: Partial<UpsertPatientProblemDto>` en `backend/src/patients/patients.controller.ts:187-194`.

Con NestJS, esa firma no entrega una clase DTO concreta a `ValidationPipe`, por lo que las reglas decoradas en `UpsertPatientProblemDto` dejan de ser una proteccion efectiva para el update parcial. Luego, el servicio persiste directamente `status: dto.status || problem.status` en `backend/src/patients/patients.service.ts:1279-1290`.

**Por que importa**

Un cliente puede mandar cualquier string como `status` y dejar el problema clinico en un estado no soportado por la UI ni por las etiquetas del dominio. Eso es un problema de integridad de la lista longitudinal de problemas, no solo de robustez tecnica.

**Riesgo real**

Se pueden romper filtros, badges, resolucion de problemas y consistencia del historial clinico compartido por medico y asistente.

**Recomendacion**

Crear un DTO real para update parcial usando `PartialType(UpsertPatientProblemDto)` o equivalente, y agregar test negativo que confirme que estados fuera de `PATIENT_PROBLEM_STATUSES` son rechazados.

### 4. Medio: el selector de afecciones convierte texto libre del historial del paciente en cambios permanentes del catalogo local

Estado: implementado en esta iteracion.

**Que pasa**

Cuando el usuario escribe una etiqueta nueva en `ConditionSelector`, el componente la agrega al formulario y, si no coincide con una sugerencia existente, hace `POST /conditions/local` automaticamente en `frontend/src/components/common/ConditionSelector.tsx:60-75`.

Ese selector se usa directamente en antecedentes medicos y alergias del historial del paciente en `frontend/src/app/(dashboard)/pacientes/[id]/historial/page.tsx:197-201`.

En backend, `createLocal()` crea una afeccion local nueva si no viene `baseConditionId`, sin deduplicacion por nombre en `backend/src/conditions/conditions.service.ts:211-264`.

**Por que importa**

Se mezclan dos conceptos distintos:

- tags o texto libre especifico de un paciente
- catalogo reusable que despues alimenta sugerencias y normalizacion

Un typo, abreviatura local o dato poco curado escrito mientras se completa un historial puede terminar contaminando el catalogo reutilizable del medico.

**Riesgo real**

Con el tiempo el catalogo local puede llenarse de duplicados, variantes inconsistentes y ruido que luego reaparece como sugerencia clinica en otros pacientes.

**Recomendacion**

Esta recomendacion quedo implementada en el flujo de historial: ahora existe una accion explicita para agregar tambien al catalogo local y el backend reutiliza o rechaza entradas segun nombre normalizado para evitar duplicados triviales.

### 5. Medio: el modal de atenciones en progreso ofrece cancelar incluso a asistentes, pero el backend lo prohibe

Estado: implementado en esta iteracion.

**Que pasa**

El modal `InProgressEncounterConflictModal` expone `allowCancel = true` por defecto y dispara `POST /encounters/:id/cancel` en `frontend/src/components/common/InProgressEncounterConflictModal.tsx:29-90`.

Sin embargo, el endpoint backend es exclusivo para medicos: `@Post(':id/cancel')` + `@Roles('MEDICO')` en `backend/src/encounters/encounters.controller.ts:161-167`.

**Por que importa**

Es una inconsistencia concreta frontend-backend en un flujo frecuente: resolver atenciones duplicadas o en progreso. El asistente ve una accion que el sistema nunca le va a dejar completar.

**Riesgo real**

Produce errores 403 evitables, ruido operativo y percepcion de inestabilidad justo en un punto donde se esta intentando recuperar continuidad de la atencion.

**Recomendacion**

Ocultar `Cancelar` para asistentes o pasar `allowCancel={isDoctor}` desde los callers. Si ademas se quiere permitir esa accion a asistentes, entonces hay que cambiar el contrato backend deliberadamente, no dejarlo ambiguo.

### 6. Medio: el campo opcional `edadMeses` del alta completa puede fallar cuando se deja en blanco

Estado: implementado en esta iteracion.

**Que pasa**

En `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx:15-18` y `:45-48`, `edadMeses` se define como `z.number().optional()`. Pero el input usa `valueAsNumber` en `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx:242-252`.

Con React Hook Form, un input numerico vacio con `valueAsNumber` produce `NaN`, y `z.number().optional()` no acepta `NaN`. Lo valide aparte con un snippet de Zod en el workspace.

**Por que importa**

Es un bug de formulario real en un campo simple pero cotidiano. Puede generar validaciones inexplicables para el usuario en una pantalla de registro central.

**Riesgo real**

El medico deja "Meses" vacio, el formulario considera invalido el payload y el error no necesariamente queda bien explicado en la UI.

**Recomendacion**

Transformar `NaN` a `undefined` antes de validar, o usar `setValueAs` en vez de `valueAsNumber` para campos opcionales.

### 7. Medio: la UI puede creer que el historial clinico tiene contenido aunque solo existan metadatos tecnicos

Estado: implementado en esta iteracion.

**Que pasa**

`patientHistoryHasContent()` recorre `Object.values(history)` en `frontend/src/lib/utils.ts:19-21` sin excluir metadatos como `id`, `patientId` o `updatedAt`.

Eso hace que un historial vacio pero persistido sea interpretado como "con contenido". Lo reproduje en Node con un objeto de historial vacio y la funcion devuelve `true`.

En la ficha del paciente, esa utilidad se usa para decidir si mostrar el mensaje "No hay antecedentes registrados" en `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx:98` y `:405`.

**Por que importa**

No rompe datos, pero si degrada la lectura de ficha: el sistema deja de mostrar correctamente que no hay antecedentes cargados.

**Riesgo real**

La pantalla parece mas completa de lo que realmente esta, que es justamente el tipo de sesgo de interfaz que conviene evitar en salud.

**Recomendacion**

Evaluar solo las claves clinicas del historial y agregar un test que incluya metadatos reales del modelo.

## Inconsistencias frontend-backend

### 1. El frontend modela `reviewActionNote` y `closureNote` como campos distintos, pero el backend los colapsa al completar

Esto no es una discrepancia menor de naming: el frontend y la UX entienden dos momentos clinicos diferentes, mientras el backend los termina almacenando como uno solo en el cierre.

### 2. El frontend ofrece cancelar atenciones en progreso a cualquier usuario del modal, pero el backend solo autoriza a medicos

Es un contrato roto visible para el usuario final.

### 3. El frontend y el backend ahora distinguen alta rapida, ficha incompleta y verificacion medica, y ya aplican bloqueos duros en los puntos de salida mas sensibles

La inconsistencia original ya quedo corregida y la decision operativa tambien: el frontend expone badges/advertencias, el backend persiste `null` + estado formal de completitud, y ahora existe bloqueo duro en backend para `complete` y exportes oficiales. En frontend, el wizard y la ficha deshabilitan esas acciones y explican por que.

Ese borde ya quedo mitigado en la propia superficie HTML: la app bloquea su boton de impresion y, si el navegador entra igual en modo `print`, el contenido clinico se oculta y solo queda un aviso generico de bloqueo.

### 4. La proteccion de shell es mas debil de lo que aparenta

Estado: implementado en esta iteracion.

`frontend/src/proxy.ts:4-19` deja pasar cualquier ruta protegida si existe `access_token` o `refresh_token`, aunque no se valide la sesion. Ademas, `DashboardLayout` da por valida la sesion si el store persistido ya estaba autenticado y corta el bootstrap en `frontend/src/components/layout/DashboardLayout.tsx:97-137`.

No es una vulnerabilidad grave por si sola, pero si una inconsistencia funcional: la UI puede asumir una sesion vigente antes de reconfirmarla con backend, o quedar en spinner permanente si `auth/me` falla y `isAuthenticated` queda en `false` (`frontend/src/components/layout/DashboardLayout.tsx:223-228`).

En esta iteracion se corrigio el punto central del riesgo: el shell ya no desbloquea la UI solo porque el store persistido diga `isAuthenticated`, y el `proxy` solo usa validacion real de `access_token` para redirigir fuera de `/login` y `/register`. Cuando solo queda `refresh_token`, deja pasar la navegacion para que el bootstrap cliente recupere la sesion de forma silenciosa.

## Riesgos especificos por tratarse de una app medica

1. Placeholder demografico persistido como si fuera dato real: riesgo de documentacion clinica enganosa y errores de interpretacion posterior.
2. Perdida de nota de revision al cerrar: riesgo medico-legal y de trazabilidad entre quien prepara y quien valida/cierra la atencion.
3. Catalogo contaminado con texto libre del historial: riesgo de degradar futuras sugerencias y normalizacion clinica.
4. Estados invalidos en problemas clinicos: riesgo de dejar la lista longitudinal en un estado que la UI no sabe interpretar bien.
5. Todo nuevo canal de salida clinica debe enganchar la politica central antes de exponerse; hoy el riesgo residual ya no esta en la ficha HTML actual, sino en superficies futuras que se agreguen sin reutilizar ese contrato.

## Mejoras recomendadas

### Mejoras de alta prioridad

1. Completar la politica operativa sobre que acciones deben bloquearse cuando la ficha siga incompleta o pendiente.
2. Separar definitivamente los eventos de revision y cierre en persistencia, API y tests.
3. Reemplazar updates parciales sin DTO real por DTOs validados (`PartialType` o clases equivalentes).

Todas estas tres prioridades ya quedaron implementadas en esta iteracion.

### Mejoras de alta prioridad remanentes

1. Extender la politica central de bloqueo a cualquier nuevo canal de salida clinica que se agregue en el futuro.
2. Mantener regresiones especificas cada vez que aparezca un nuevo tipo de documento o salida clinica.
3. Revisar periodicamente que ninguna nueva vista imprimible o documento server-side omita `clinicalOutputBlock`.

### Mejoras de prioridad media

1. Incorporar indicadores operativos de calidad de ficha y revision pendiente.
2. Crear una bandeja de revision clinica con diferencias entre captura asistencial y validacion medica.
3. Separar mejor alergias, antecedentes y problemas activos con severidad, fuente y fecha de verificacion.

### Mejoras de higiene tecnica

1. Mantener y ampliar las pruebas dirigidas a estos huecos concretos cuando se abran nuevas superficies: alta rapida, nota de revision preservada, update invalido de problema, `edadMeses` vacio, conflicto de cancelacion por rol, bloqueos de salida por completitud.
2. Limpiar artefactos locales del arbol de trabajo (`.next`, `.next.bak`, `test-results`, etc.) para que la exploracion del repo no se contamine con duplicados o basura generada.

## Nuevas funcionalidades sugeridas

### 1. Estado visible de ficha incompleta

Banner persistente y filtros para pacientes con datos minimos cargados pero no verificados. Esto encaja perfecto con el flujo asistente -> medico que ya existe.

### 2. Bandeja de revision clinica con diferencias

Cuando una atencion pasa a revision, mostrar diff claro entre lo redactado por asistente y lo consolidado por medico. Eso aprovecha mejor el workflow ya implementado.

### 3. Registro estructurado de alergias y problemas cronicos

Separar mejor alergias, antecedentes y problemas activos con campos de severidad, fuente y fecha de verificacion. Hoy varias piezas existen, pero todavia mezcladas.

### 4. Alertas operativas de calidad de dato

Ejemplos utiles y realistas: paciente sin RUT pero sin motivo de exencion, ficha con datos rapidos sin completar, atencion completada sin seguimiento en ciertos tipos de consulta, catalogo con duplicados locales obvios.

## Plan de accion priorizado

### Semana 1

1. Revisar y fusionar los cambios ya implementados de `complete()`, DTO parcial real, modal de conflicto, `edadMeses`, `patientHistoryHasContent()`, catalogo local explicito y shell/proxy endurecido.
2. Decidir si la cancelacion de atenciones en progreso seguira siendo solo medica o si el backend debe habilitar una variante para asistentes.

### Semana 2

1. Extender la politica central de bloqueo a cualquier nueva salida clinica que se agregue.
2. Mantener regresiones adicionales para el flujo de completitud cada vez que se amplie a nuevos puntos de salida.

### Semana 3

1. Incorporar indicadores operativos de calidad de ficha y revision pendiente.
2. Auditar futuras superficies de salida clinica para que hereden el mismo contrato de bloqueo.

## Cierre

La aplicacion no esta "rota" ni cerca de ser un caos. De hecho, tiene varias decisiones buenas y una base valida para seguir creciendo. Pero en salud no basta con que el flujo funcione: importa mucho que el sistema distinga bien entre dato real, dato incompleto, dato revisado y dato de cierre. Hoy esa frontera aun esta demasiado borrosa en algunos puntos clave.

Si tuviera que priorizar sin dispersarse desde el estado actual, empezaria por una cosa: tomar la politica de bloqueo ya implementada como contrato transversal y obligar a que toda nueva salida clinica futura la reutilice. El debate ya no es si bloquear o no la ficha HTML actual, sino como evitar que nuevas superficies pasen por fuera de ese contrato.