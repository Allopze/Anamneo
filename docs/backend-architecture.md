# Arquitectura Backend

El backend es una aplicacion NestJS modular. La regla practica es simple: cada dominio tiene su modulo, y `common/` concentra las piezas transversales que nadie deberia reimplementar por deporte.

## Bootstrapping

El arranque ocurre en `backend/src/main.ts` y aplica estas capas globales:

- validacion con `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`),
- `helmet`,
- `cookie-parser`,
- tracing de request,
- CORS con lista derivada de `CORS_ORIGIN`,
- filtro global de excepciones,
- prefijo global `/api`,
- chequeos de configuracion segura antes de escuchar puerto.

## Modulos Principales

| Modulo | Responsabilidad |
|---|---|
| `auth/` | Login, refresh, 2FA, invitaciones, sesiones |
| `users/` | Usuarios, roles, relacion medico-asistente |
| `patients/` | Pacientes, historial, completitud y acceso base |
| `encounters/` | Encuentros clinicos, secciones, revision, cierre y exportacion |
| `conditions/` | Catalogos diagnosticos globales/locales y sugerencias |
| `attachments/` | Adjuntos y relacion con encounter/ordenes |
| `templates/` | Plantillas de texto por medico |
| `consents/` | Consentimientos informados |
| `alerts/` | Alertas clinicas y acknowledgement |
| `audit/` | Registro de cambios y diff persistente |
| `settings/` | Settings cifrados, especialmente SMTP |
| `mail/` | Integracion SMTP |
| `prisma/` | Acceso a base de datos |
| `common/` | Decorators, guards, filtros, utilidades compartidas |
| `cie10/` | Soporte catalogo clinico relacionado |

## Flujo Tipico de Request

1. Entra por controller del modulo.
2. Pasa por guards y decorators de autenticacion/autorizacion.
3. Se valida y transforma el DTO.
4. El service aplica reglas de negocio.
5. Prisma persiste o consulta datos.
6. `audit/` registra acciones sensibles cuando corresponde.
7. La respuesta vuelve serializada al cliente.

## Patrones Del Proyecto

### Controllers finos

Los controllers deberian enrutar, validar y delegar. Si un controller parece querer escribir una novela de negocio, probablemente ese codigo deberia vivir en un service.

### Services como orquestadores

Los services coordinan acceso a Prisma, reglas de dominio, autorizacion especifica y side effects como auditoria o correo.

### Limite de tamano por archivo

- Ningun archivo fuente de backend debe superar las 500 lineas.
- 300 lineas es el objetivo por defecto; si un service empieza a crecer, se divide en helpers, sub-servicios o utilidades puras antes de seguir agregando casos.
- Un service grande no se justifica por tener "mucha logica". Si la logica existe, se organiza.

### DTOs y validacion

- el backend confia en DTOs con `class-validator`,
- `ValidationPipe` bloquea campos no permitidos,
- y los cambios de contrato deberian reflejarse tanto en DTOs como en clientes frontend.

### `common/` como capa transversal

`common/` es el lugar para guards, decorators, filtros y utilidades compartidas. Si una regla de acceso existe en tres modulos, deberia vivir aqui o en una abstraccion equivalente.

## Persistencia

La fuente de verdad es `backend/prisma/schema.prisma`.

- el provider actual del schema es SQLite,
- la aplicacion menciona PostgreSQL como opcion futura/alternativa,
- y varias reglas de estado viven en strings persistidos, no en enums de base.

Eso vuelve especialmente importante documentar contratos y validar transiciones en services y tests.

## Riesgos Tecnicos Ya Observados

- drift de contrato entre frontend y backend en algunos endpoints,
- modulos clinicos que requieren validaciones de patient access consistentes,
- y respuestas que mezclan datos serializados con datos ya parseados.

La version corta: el backend esta bien organizado por dominios, pero necesita mantener disciplina contractual para no ganar velocidad a costa de coherencia.

## Donde Seguir

- Modelo de datos: `data-model.md`
- Seguridad y permisos: `security-and-permissions.md`
- Flujos funcionales: `clinical-workflows.md`