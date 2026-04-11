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
- y varias acciones sensibles dependen del estado del paciente y del encounter.

## Diagnostico Asistido y Catalogos

- Existe catalogo global (`ConditionCatalog`).
- Existe catalogo local por medico (`ConditionCatalogLocal`).
- Se registran sugerencias y seleccion final en `ConditionSuggestionLog`.

Esto permite soporte diagnostico sin obligar a que todo conocimiento clinico viva en un unico catalogo global inmovil.

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

## Diferencia Entre Comportamiento y Backlog

Usa este criterio:

- si una regla existe en schema, endpoints, UI y tests, tratala como comportamiento actual,
- si esta en `FEATURES.md`, tratala como backlog hasta validar implementacion real,
- si aparece en auditorias o regressions, tratala como deuda conocida aunque suene incomodo.

## Riesgos Vigentes Que Merecen Atencion

- drift de contrato en 2FA,
- drift en shape de consentimientos,
- serializacion de `EncounterSection.data` en respuestas de update,
- reglas de acceso clinico que deben ser uniformes entre modulos.

## Donde Seguir

- Modelo de datos: `data-model.md`
- Seguridad y permisos: `security-and-permissions.md`
- Backlog por rol: `../FEATURES.md`