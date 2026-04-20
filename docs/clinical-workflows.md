# Flujos Clinicos y Operativos

Este documento resume el comportamiento actual mas importante del producto. `FEATURES.md` sigue existiendo para backlog; esto intenta describir lo que el sistema hace o deberia resguardar hoy, que no es exactamente lo mismo por razones demasiado humanas.

## Pacientes

### Alta y completitud

- `Patient.registrationMode` distingue registro completo y rapido.
- `Patient.completenessStatus` diferencia estados como verificada vs pendiente de verificacion.
- La verificacion demografica tiene timestamp y responsable persistidos.
- El soft delete se modela con `archivedAt` y `archivedById`.

Implicacion funcional:

- no todo paciente creado esta listo para salida clinica,
- y el sistema ya contempla bloquear output clinico cuando la completitud requerida no esta verificada.

## Encuentros Clinicos

### Ciclo de vida

- `Encounter.status` gobierna el progreso general.
- `Encounter.reviewStatus` separa necesidad y resultado de revision.
- Las secciones viven en `EncounterSection`, identificadas por `sectionKey`.
- El cierre persiste `completedAt`, `completedById` y `closureNote`.

### Reglas de trabajo

- las secciones se actualizan por separado,
- existe flujo de revision y cierre,
- la visibilidad y edicion de secciones solo-medico se resuelve con contrato compartido entre frontend y backend,
- las acciones de firmar, reabrir, cancelar, exportar, imprimir y ver historial tambien tienen una referencia compartida de permisos,
- y varias acciones sensibles dependen del estado del paciente y del encounter.

## Diagnostico Asistido y Catalogos

- Existe catalogo global (`ConditionCatalog`).
- Existe catalogo local por medico (`ConditionCatalogLocal`).
- Se registran sugerencias y seleccion final en `ConditionSuggestionLog`.

Esto permite soporte diagnostico sin obligar a que todo conocimiento clinico viva en un unico catalogo global inmovil.

### Sugerencias de afeccion en motivo de consulta

- El backend genera sugerencias usando el catalogo global o el catalogo fusionado de la instancia, segun el rol del usuario.
- El ranking ahora pondera mas fuerte coincidencias exactas o parciales en `name` que en sinonimos, y mas en sinonimos que en tags.
- El texto normalizado sigue ignorando tildes y puntuacion para no penalizar escritura clinica rapida.
- La UI puede auto-seleccionar la mejor sugerencia solo mientras el medico no haya forzado explicitamente el modo manual.
- Cuando el medico confirma una sugerencia o decide mantener seleccion manual, la decision se registra en `ConditionSuggestionLog`.

### Importacion CSV del catalogo global

- Solo un usuario `ADMIN` puede validar o importar el CSV global de afecciones.
- El formato recomendado usa encabezados: `name`, `synonyms`, `tags`.
- `name` es obligatorio.
- `synonyms` y `tags` aceptan multiples valores separados por `|`.
- El formato legacy de una sola columna sigue soportado para cargas antiguas, pero no deberia usarse para catalogos nuevos.
- La UI valida primero contra el parser real del backend y luego ejecuta la importacion.
- Duplicados dentro del mismo archivo se consolidan por nombre normalizado antes de persistir.
- Si la afeccion ya existe, la importacion actualiza nombre, fusiona sinonimos y tags, y reactiva entradas inactivas.

### Mejora CSV en curso

- Ya implementado: parser CSV formal, preview server-side y consolidacion de duplicados dentro del archivo.
- Ya implementado: `ConditionCatalog` persiste `normalizedName` y la base de datos impone unicidad por ese valor normalizado.
- Ya implementado: la importacion bulk del catalogo global registra auditoria explicita (`CONDITION_CSV_IMPORTED`) con trazabilidad de cambios.
- Pendiente: definir si el CSV soportara control explicito de `active` en una fase posterior.

### Catalogo de medicamentos

- Existe catalogo global `MedicationCatalog` para normalizar medicamentos visibles y su principio activo.
- Solo un usuario `ADMIN` puede crear, editar, desactivar o cargar CSV global de medicamentos.
- La UI expone la categoria `Medicamentos` dentro de `Catalogo` con busqueda por `name` y `activeIngredient`.

### Importacion CSV del catalogo de medicamentos

- El formato recomendado usa encabezados `nombre`, `principioactivo`.
- Tambien se aceptan encabezados `name`, `activeIngredient` para cargas externas.
- Ambas columnas son obligatorias.
- Duplicados dentro del mismo archivo se consolidan por nombre normalizado; prevalece la ultima fila del archivo.
- Si el medicamento ya existe, la importacion actualiza `name`, `activeIngredient` y reactiva entradas inactivas.
- La importacion registra auditoria explicita (`MEDICATION_CSV_IMPORTED`) con resumen de filas creadas, actualizadas y reactivadas.

### Mejora de sugerencias en curso

- Ya implementado: ranking con mayor peso para coincidencias directas en nombre, luego sinonimos y despues tags.
- Ya implementado: el modo manual deja de ser sobrescrito por una nueva auto-seleccion mientras el medico sigue escribiendo.
- Ya implementado: la eleccion manual tambien queda registrada en `ConditionSuggestionLog`.
- Ya implementado: el backend valida coherencia entre `chosenMode`, `chosenConditionId` y el arreglo `suggestions` antes de registrar la decision.
- Ya implementado: existe cobertura e2e dedicada para obtener sugerencias y persistir decisiones manuales o rechazar payloads `AUTO` inconsistentes.
- Ya implementado: `ConditionSuggestionLog` guarda `rankingVersion` y `rankingMetadata` serializada con cantidad de sugerencias, top suggestion y posicion/score/confidence de la opcion elegida.
- Ya implementado: existe cobertura e2e para una decision `AUTO` valida que comprueba la persistencia de metadata del ranking.
- Ya implementado: existe un `e2e-spec` aislado del flujo de sugerencias para validarlo sin depender del estado compartido de `app.e2e-spec.ts`.
- Pendiente: validar si `ConditionSuggestionLog` debe guardar tambien el texto final persistido de la seccion y no solo el input enviado al endpoint.
- Pendiente: definir si conviene agregar explicabilidad visible de la sugerencia en UI, por ejemplo motivo de coincidencia o campo matched.
- Pendiente: decidir si la metadata persistida actual es suficiente o si conviene guardar tambien los campos exactos de matching usados para explicar la sugerencia.

## Tareas y Problemas

- `PatientProblem` modela problemas clinicos activos o resueltos.
- `EncounterTask` modela seguimientos con prioridad, estado y fecha limite.

Riesgo actual a tener presente:

- hoy son entidades a nivel paciente y no ownership fuerte por medico, por lo que acceso y visibilidad deben tratarse con cuidado.

## Consentimientos y Alertas

- `InformedConsent` persiste otorgamiento, revocacion y razon.
- `ClinicalAlert` persiste severidad, mensaje, origen y acknowledgement.

Riesgo conocido:

- la validacion de acceso sobre consentimientos y alertas necesita mantenerse consistente en todos los endpoints.

## Adjuntos y Exportacion

- `Attachment` vincula archivos a encuentros y opcionalmente a ordenes.
- La exportacion clinica depende del estado del encounter y de la completitud del paciente.
- El frontend ya expone ayudas para bloquear output clinico cuando corresponde.

## Roles En La Operacion Diaria

- medico: foco en contenido clinico y decisiones del encuentro,
- asistente asignado: apoyo operativo y ciertas ediciones permitidas,
- admin: administracion, no necesariamente edicion clinica cotidiana.

El detalle de permisos compartidos esta en `security-and-permissions.md` y la proyeccion de backlog en `../FEATURES.md`.

En la superficie de `encounters`, la regla compartida actual vive en `shared/encounter-permission-contract.ts` e incluye visibilidad de secciones, cierre, review status, firma, reapertura, cancelacion, exportacion, impresion e historial.

## Diferencia Entre Comportamiento y Backlog

Usa este criterio:

- si una regla existe en schema, endpoints, UI y tests, tratala como comportamiento actual,
- si esta en `FEATURES.md`, tratala como backlog hasta validar implementacion real,
- si aparece en auditorias o regressions, tratala como deuda conocida aunque suene incomodo.

## Riesgos Vigentes Que Merecen Atencion

- si aparece una nueva seccion clinica sensible o una nueva accion/transition de workflow, hay que extender el contrato compartido de encounters antes de tocar solo frontend o solo backend,
- las reglas de acceso clinico deben seguir uniformes entre pacientes, encounters, consentimientos, alertas, adjuntos y exportaciones,
- cuando aparezcan nuevas mutaciones clinicas sensibles, conviene mantener el patron de negocio + auditoria en una misma transaccion,
- en sugerencias diagnosticas todavia quedan decisiones de producto abiertas sobre explicabilidad visible y cuanta metadata de matching vale la pena persistir.

## Donde Seguir

- Modelo de datos: `data-model.md`
- Seguridad y permisos: `security-and-permissions.md`
- Backlog por rol: `../FEATURES.md`
