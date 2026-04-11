# Modelo de Datos

La fuente de verdad es `backend/prisma/schema.prisma`. Este documento no reemplaza el schema; lo resume para que no haya que leer cada relacion como si fuera una novela policiaca.

## Contexto General

- El datasource actual del schema usa SQLite.
- La mayoria de estados persistidos son `String`, no enums nativos de base.
- Hay entidades clinicas, operativas y de seguridad mezcladas en un solo schema, por lo que conviene pensar por dominios.

## Dominios Principales

| Dominio | Modelos |
|---|---|
| Usuarios y acceso | `User`, `UserSession`, `LoginAttempt`, `UserInvitation` |
| Pacientes | `Patient`, `PatientHistory`, `PatientProblem` |
| Encuentros | `Encounter`, `EncounterSection`, `EncounterSignature`, `EncounterTask` |
| Decision support | `ConditionCatalog`, `ConditionCatalogLocal`, `ConditionSuggestionLog` |
| Clinico auxiliar | `InformedConsent`, `ClinicalAlert`, `Attachment`, `TextTemplate` |
| Plataforma | `AuditLog`, `Setting` |

## Relaciones Clave

### Usuario

- `User` puede ser medico, asistente o admin.
- Existe auto-relacion `MedicoAssistants` para asociar asistentes a medico.
- `User` crea pacientes, encuentros, tareas, adjuntos y templates.
- `UserSession` persiste sesiones por dispositivo.

### Paciente

- `Patient` pertenece a quien lo crea (`createdById`).
- Puede tener `PatientHistory` unica.
- Se relaciona con `Encounter`, `PatientProblem`, `EncounterTask`, `InformedConsent` y `ClinicalAlert`.
- Tiene `registrationMode` y `completenessStatus` para distinguir alta completa vs registro rapido y verificacion posterior.

### Encounter

- `Encounter` pertenece a `Patient`, `medico` y `createdBy`.
- Tiene estados de trabajo (`status`) y revision (`reviewStatus`).
- Se compone de `EncounterSection` por `sectionKey`.
- Acumula adjuntos, alertas, consentimientos, tareas, problemas y logs de sugerencias.

### Catalogos y sugerencias

- `ConditionCatalog` es el catalogo global.
- `ConditionCatalogLocal` guarda overrides o entradas locales por medico.
- `ConditionSuggestionLog` registra input y sugerencias generadas en un encounter.

## Campos y Estados Que Importan

| Modelo | Campo | Significado |
|---|---|---|
| `Patient` | `registrationMode` | Diferencia registro completo vs rapido |
| `Patient` | `completenessStatus` | Controla verificacion de datos demograficos |
| `Patient` | `archivedAt` | Soft delete |
| `Encounter` | `status` | Estado general del encuentro |
| `Encounter` | `reviewStatus` | Estado de revision clinica |
| `EncounterSection` | `data` | Seccion serializada |
| `EncounterTask` | `status`, `priority`, `dueDate` | Seguimiento clinico |
| `PatientProblem` | `status`, `severity`, `resolvedAt` | Problemas activos/resueltos |
| `InformedConsent` | `revokedAt`, `revokedReason` | Revocacion del consentimiento |
| `ClinicalAlert` | `acknowledgedAt` | Confirmacion de alerta |
| `Setting` | `key`, `value` | Settings persistidos, algunos cifrados |

## Indices Relevantes

El schema ya agrega indices en las rutas de acceso mas sensibles, por ejemplo:

- pacientes archivados,
- encuentros por medico,
- problemas por paciente/estado,
- tareas por paciente/estado/fecha,
- consentimientos y alertas por paciente,
- audit logs por entidad, usuario y timestamp.

## Observaciones de Diseño

- Hay varias estructuras JSON o listas serializadas como `String` (`synonyms`, `tags`, `topSuggestions`, `EncounterSection.data`).
- Eso simplifica ciertas migraciones, pero vuelve mas delicado el contrato entre backend y frontend.
- Los estados persistidos como strings exigen validacion fuerte en DTOs y servicios para no degradarse con el tiempo.

## Riesgos Conocidos

- `EncounterSection.data` puede aparecer serializado en respuestas de actualizacion; el cliente debe tratar ese contrato con cuidado.
- Problemas y tareas son entidades a nivel paciente, no ownership fuerte por medico.
- Consentimientos y alertas requieren validaciones de acceso consistentes para evitar exposicion indebida.

## Donde Seguir

- Seguridad y permisos: `security-and-permissions.md`
- Flujos clinicos: `clinical-workflows.md`
- Arquitectura backend: `backend-architecture.md`