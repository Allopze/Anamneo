# Seguridad y Permisos

La seguridad de Anamneo mezcla controles de arranque, autenticacion por cookies, sesiones persistidas, cifrado de settings y autorizacion por rol. Es decir: bastante mas que un `if (user)` con autoestima.

## Guardrails de Arranque

`backend/src/main.ts` falla el arranque si detecta configuraciones peligrosas:

- `DATABASE_URL` ausente o placeholder,
- `JWT_SECRET` o `JWT_REFRESH_SECRET` ausentes o placeholders,
- secrets iguales entre access y refresh,
- secrets demasiado cortos en produccion,
- SQLite en produccion sin `ALLOW_SQLITE_IN_PRODUCTION=true`,
- falta de claves de cifrado de settings en produccion.

## Autenticacion

| Componente | Descripcion |
|---|---|
| Access token | TTL corto, por defecto `15m` |
| Refresh token | TTL mas largo, por defecto `7d` |
| Transporte | Cookies `HttpOnly` |
| Sesiones | Persistidas en `UserSession` |
| Revocacion | `refreshTokenVersion` + revocacion de sesion |
| Bloqueo de intentos | `LoginAttempt` registra fallos y ventana de bloqueo |

El frontend no se guia solo por la presencia de cookies: `src/proxy.ts` valida sesion real consultando `/api/auth/me` antes de decidir redirecciones sensibles.

## Roles y Contrato Base

La referencia compartida actual esta en `shared/permission-contract.json`.

Escenarios documentados ahi:

| Caso | Puede editar antecedentes | Puede editar administrativo | Puede crear encounter |
|---|---|---|---|
| Medico | Si | Si | Si |
| Admin | No | No | No |
| Asistente asignado | Si | Si | Si |
| Asistente no asignado | No | No | No |

Esto no reemplaza el enforcement backend, pero sirve como contrato de intencion compartida entre capas.

## Cifrado de Settings

- `Setting` persiste pares `key/value`.
- Algunos secretos, como SMTP, se cifran en reposo.
- `SETTINGS_ENCRYPTION_KEY` define la clave activa.
- `SETTINGS_ENCRYPTION_KEYS` permite convivir con claves antiguas durante rewrap.

La operacion detallada de rotacion vive en `settings-key-rotation-runbook.md`.

## Auditoria

`AuditLog` persiste:

- entidad,
- id de entidad,
- usuario,
- request id,
- accion,
- resultado,
- diff,
- hashes de integridad,
- timestamp.

Esto da trazabilidad tecnica y operativa. Tambien implica que los cambios sensibles deben pasar por servicios y no por atajos laterales que despues nadie puede explicar.

## Riesgos Conocidos a Corregir

Estos items no son teoria; ya fueron observados y deberian tratarse como deuda activa:

- drift de contrato en 2FA: el frontend espera `qrCode` y el backend devuelve `qrCodeDataUrl`,
- `consents` y `alerts` necesitan validacion consistente de patient access para evitar exposicion indebida,
- el frontend de consentimientos espera un shape mas rico que el que algunas respuestas backend entregan hoy,
- la actualizacion de secciones de encounter puede devolver `data` serializada y contaminar cache cliente si se consume sin normalizar.

## Reglas Practicas

1. Los permisos visibles en UI son ayuda de UX, no seguridad real.
2. Cada endpoint clinico debe validar acceso efectivo al paciente o encounter correspondiente.
3. Cualquier cambio en auth o permisos deberia venir con tests backend y, si afecta experiencia visible, tests frontend.
4. No uses placeholders en entornos compartidos aunque sea "solo por un rato". Ese rato siempre termina siendo mas largo de lo que alguien admite.

## Donde Seguir

- Variables: `environment.md`
- Arquitectura backend: `backend-architecture.md`
- Flujos funcionales: `clinical-workflows.md`