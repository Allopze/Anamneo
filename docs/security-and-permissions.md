# Seguridad y Permisos

La seguridad de Anamneo mezcla controles de arranque, autenticacion por cookies, sesiones persistidas, cifrado de settings y autorizacion por rol. Es decir: bastante mas que un `if (user)` con autoestima.

## Guardrails de Arranque

`backend/src/main.ts` falla el arranque si detecta configuraciones peligrosas:

- `DATABASE_URL` ausente o placeholder,
- `JWT_SECRET` o `JWT_REFRESH_SECRET` ausentes o placeholders,
- `BOOTSTRAP_TOKEN` ausente, placeholder o demasiado corto en produccion,
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
| Revocacion | `refreshTokenVersion` + `UserSession.tokenVersion` validado en access y refresh |
| Bloqueo de intentos | `LoginAttempt` registra fallos y ventana de bloqueo |

`frontend/src/proxy.ts` usa un chequeo optimista por cookie para redirigir rutas publicas o protegidas sin hacer `fetch` remoto en esa capa. La validacion real de sesion sigue ocurriendo en el bootstrap normal del dashboard y en el data layer cuando corresponde.

En el camino caliente de autenticacion, `login`, `register` y `2fa/verify` devuelven tambien el usuario de sesion sanitizado. El frontend usa ese payload para hidratar el store y evitar un segundo roundtrip inmediato a `/auth/me`, pero sigue reservando `GET /auth/me` para el bootstrap real cuando se entra al dashboard sin ese contexto reciente.

Cuando el sistema aun no tiene un admin activo, el primer registro requiere `BOOTSTRAP_TOKEN`. La idea es simple: una instancia vacia expuesta a internet no debe quedar al alcance del primer visitante que encuentre `/register`.

## Roles y Contrato Base

La referencia compartida base para permisos generales esta en `shared/permission-contract.ts`.

Para permisos clinicos de `encounters` que necesitan mas granularidad, la fuente compartida actual vive en `shared/encounter-permission-contract.ts`. Ahi se define:

- visibilidad de secciones solo-medico,
- edicion de atenciones segun rol y creador,
- cierre de encounters en progreso,
- firma, reapertura y cancelacion segun estado,
- exportacion, impresion e historial de auditoria,
- transiciones permitidas de `reviewStatus`.

Escenarios documentados ahi:

| Caso | Puede editar antecedentes | Puede editar administrativo | Puede crear encounter |
|---|---|---|---|
| Medico | Si | Si | Si |
| Admin | No | No | No |
| Asistente asignado | Si | Si | Si |
| Asistente no asignado | No | No | No |

Esto no reemplaza el enforcement backend, pero si reduce drift entre frontend y backend al reutilizar la misma regla en ambos lados para la superficie mas sensible del flujo clinico y de sus salidas oficiales.

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

### Pasada de hardening 2026-05-03

Cambios aplicados en la primera pasada post-auditoria:

- Las lecturas principales de PHI ahora generan eventos `READ` en `AuditLog`: ficha de paciente, resumen clinico, detalle de atencion, timeline de atenciones, listas de consentimientos, alertas, adjuntos y vistas de analitica clinica.
- Los eventos nuevos usan motivos catalogados (`PATIENT_RECORD_VIEWED`, `PATIENT_CLINICAL_SUMMARY_VIEWED`, `ENCOUNTER_RECORD_VIEWED`, `ENCOUNTER_TIMELINE_VIEWED`, `CONSENT_LIST_VIEWED`, `ALERT_LIST_VIEWED`, `ATTACHMENT_LIST_VIEWED`, `CLINICAL_ANALYTICS_SUMMARY_VIEWED`, `CLINICAL_ANALYTICS_CASES_VIEWED`) para que la auditoria no acepte lecturas sensibles como eventos genericos.
- La auditoria de analitica clinica registra solo metadatos minimos de filtros (`source`, fechas y ventana de seguimiento), no filtros clinicos crudos como condicion o foco de busqueda.
- La configuracion de despliegues nuevos fuerza `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` por defecto en `.env.example` y `docker-compose.yml`; esto desactiva guardados locales/offline pensados para equipos personales y reduce exposicion de PHI en navegadores compartidos.
- Verificacion ejecutada: `node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json` y tests focalizados de auditoria, consentimientos, alertas y analitica clinica (`61` tests).

Pendiente despues de esta pasada:

- Completar tests de regresion para lecturas auditadas fuera de analitica y catalogo.
- Decidir si listas amplias como inbox de tareas, dashboard y busquedas deben auditarse por cada apertura o con eventos agregados para no saturar `AuditLog`.
- Revisar el modo offline personal: si se quiere permitir en produccion, debe tener cifrado local con clave de sesion y borrado verificable.

### Pasada de hardening 2026-05-03, revocacion de sesiones

Cambios aplicados:

- Los access tokens emitidos por `backend/src/auth/auth-token-issuance.ts` incluyen `sv` (`UserSession.tokenVersion`) ademas de `sid`.
- `backend/src/auth/strategies/jwt.strategy.ts` rechaza access tokens sin `sid/sv`, con sesion revocada, de otro usuario o con version distinta. Esto hace efectiva la revocacion de sesion en el siguiente request autenticado, no solo durante refresh.
- Se agregaron tests unitarios para emision de tokens con version de sesion y validacion/rechazo de access tokens rotados o sin version.
- Verificacion ejecutada: `node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json` y tests focalizados de auth/session (`20` tests).

Pendiente despues de esta pasada:

- Definir estrategia de migracion operacional: al desplegar este cambio, access tokens antiguos sin `sv` quedan invalidados y el usuario debera reautenticarse.

### Pasada de hardening 2026-05-03, e2e de revocacion de access token

Cambios aplicados:

- `backend/test/suites/auth-session.e2e-suite.ts` valida el flujo completo: una sesion remota se autentica, otra sesion la revoca, y la sesion remota ya no puede usar su access token contra `GET /api/auth/me`.
- `backend/test/suites/auth-2fa.e2e-suite.ts` reautentica explicitamente al medico al final del bloque 2FA para que las suites secuenciales posteriores no dependan de una cookie mutable potencialmente vieja.
- `backend/test/suites/admin.e2e-suite.ts` reautentica explicitamente al medico despues de un reset administrativo de password, ya que ese flujo revoca sesiones y deshabilita 2FA como control de seguridad.
- Verificacion ejecutada: `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` (`225` tests e2e).

Pendiente despues de esta pasada:

- Agregar una variante e2e para revocacion masiva por cambio de password o reset administrativo.
- Definir estrategia de migracion operacional: al desplegar tokens con `sv` obligatorio, access tokens antiguos sin version quedan invalidados y el usuario debera reautenticarse.

### Pasada de hardening 2026-05-03, validacion frontend

Cambios aplicados:

- Se instalo `frontend/node_modules` desde `frontend/package-lock.json` para poder ejecutar validaciones locales de UI.
- `npm --prefix frontend run typecheck` queda verde.
- Se actualizaron mocks unitarios de `frontend/src/__tests__` para exponer los hooks selectores actuales de `auth-store` (`useAuthUser`, `useAuthCan...`, etc.) y evitar falsos negativos cuando componentes clinicos usan el contrato nuevo.
- `frontend/src/__tests__/lib/date.test.ts` valida mediodia local en vez de fijar un ISO UTC que depende de la zona horaria de ejecucion.
- Verificacion ejecutada: `npm --prefix frontend run typecheck` y `npm --prefix frontend run test -- --runInBand --silent` (`68` suites, `316` tests).

Pendiente despues de esta pasada:

- Ejecutar Playwright (`npm --prefix frontend run test:e2e`) con backend disponible para cubrir la experiencia real post-revocacion.

### Pasada de hardening 2026-05-03, integridad de auditoria concurrente

Cambios aplicados:

- `backend/src/audit/audit.service.ts` serializa las escrituras de `AuditLog` dentro del proceso antes de leer la cabeza de la cadena de hashes. Esto reduce el riesgo de bifurcacion de cadena o errores de transaccion cuando varias acciones clinicas auditables llegan al mismo tiempo.
- `backend/src/audit/audit.service.concurrency.spec.ts` cubre llamadas concurrentes a `AuditService.log`, que usan la transaccion interna del servicio y verifican que la cadena de hashes queda valida.
- Verificacion ejecutada: `node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json`, prueba focalizada de concurrencia de auditoria y suite backend completa (`75` suites, `378` tests).

Pendiente despues de esta pasada:

- Repetir la prueba contra el motor de base de datos real de produccion si se migra desde SQLite a Postgres u otro proveedor.
- Si se despliegan multiples instancias backend o muchas transacciones clinicas externas concurrentes, reemplazar o complementar la cola en memoria con bloqueo distribuido/DB-level locking para que la cadena de auditoria siga siendo unica entre procesos.

### Pasada de hardening 2026-05-03, proteccion distribuida de cadena de auditoria

Cambios aplicados:

- `backend/prisma/schema.prisma` agrega `AuditChainState` y `AuditLog.chainSequence`. La cadena de auditoria deja de depender solo de `timestamp` para ordenar entradas y pasa a tener una secuencia monotona persistida en base de datos.
- `backend/prisma/migrations/20260503120000_add_audit_chain_state/migration.sql` crea `audit_chain_state`, agrega `audit_logs.chain_sequence` y deja inicializada la cabeza de cadena con el ultimo `integrity_hash` existente cuando hay datos previos.
- `backend/src/audit/audit.service.ts` toma un bloqueo de escritura sobre `audit_chain_state` dentro de la misma transaccion antes de leer la cabeza de cadena, asigna `chainSequence` al nuevo log y actualiza la cabeza solo despues de crear el evento. Esto protege la cadena cuando dos instancias backend comparten la misma base SQLite.
- `backend/src/audit/audit.service.concurrency.spec.ts` agrega cobertura con dos instancias separadas de `AuditService` y dos clientes Prisma apuntando al mismo archivo SQLite, verificando que la cadena queda valida y que las secuencias son contiguas.
- Se regenero Prisma Client con el CLI local del backend (`node backend/node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma`). No usar `npx prisma` sin version fijada: intenta resolver Prisma 7 y no es compatible con el schema actual.
- Verificacion ejecutada: `node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json`, `npm --prefix backend run test -- --runInBand audit.service.concurrency.spec.ts audit.service.spec.ts` (`14` tests) y suite backend completa (`75` suites, `379` tests).
- Verificacion parcial de migracion: todas las migraciones, incluida `20260503120000_add_audit_chain_state`, aplican correctamente con `sqlite3` sobre una base temporal limpia. `node backend/node_modules/prisma/build/index.js validate --schema backend/prisma/schema.prisma` y `migrate diff --from-empty --to-schema-datamodel` tambien quedan verdes.

Pendiente despues de esta pasada:

- No verificado: `node backend/node_modules/prisma/build/index.js migrate deploy --schema backend/prisma/schema.prisma` contra una SQLite temporal devuelve `Schema engine error` sin detalle en este entorno, aunque el SQL aplica con `sqlite3` y el schema valida. Antes de produccion hay que resolver o documentar este comportamiento del CLI de Prisma usado en deploy.
- Ejecutar migracion contra una copia de una base con auditoria historica y luego `npm --prefix backend run audit:integrity:verify`, porque la inicializacion de `audit_chain_state` toma el ultimo hash historico por timestamp para encadenar entradas nuevas.
- Si se migra a Postgres u otro motor, reemplazar el bloqueo SQLite por bloqueo nativo equivalente (`SELECT ... FOR UPDATE`, advisory lock o transaccion serializable probada).

## Riesgos Conocidos a Vigilar

No veo hoy un drift activo fuerte en auth, 2FA, consentimientos o payloads de sections como el que existia en pasadas anteriores. Lo que si conviene vigilar:

- si aparece una nueva seccion clinica sensible o una nueva transicion de workflow, actualizar `shared/encounter-permission-contract.ts` y sus tests antes de tocar solo una capa,
- si aparece una accion nueva sobre `encounters` que dependa de rol o estado, declararla primero en el contrato compartido antes de repartir condicionales nuevos por la UI,
- mantener `patient access` y `encounter access` uniformes en consentimientos, alertas, adjuntos y exports,
- seguir agrupando mutacion de negocio y auditoria en la misma transaccion cuando el flujo sea clinicamente sensible.

## Cifrado en Reposo

Anamneo cifra settings sensibles (como credenciales SMTP) a nivel de aplicacion con `SETTINGS_ENCRYPTION_KEY`. Sin embargo, los adjuntos clinicos, la base de datos SQLite y los snapshots de backup se almacenan sin cifrado propio en el filesystem.

La proteccion de esos datos en reposo es responsabilidad de la infraestructura del host, no de la aplicacion. La recomendacion es usar cifrado de filesystem completo.

### Configuracion Recomendada (Linux / LUKS)

1. Crear un volumen cifrado LUKS para el directorio `runtime/`:

```bash
# Crear particion cifrada (ajustar dispositivo)
sudo cryptsetup luksFormat /dev/sdX1
sudo cryptsetup luksOpen /dev/sdX1 anamneo-data
sudo mkfs.ext4 /dev/mapper/anamneo-data
sudo mount /dev/mapper/anamneo-data /ruta/anamneo/runtime
```

2. Configurar apertura automatica al arranque (via keyfile o TPM):

```bash
# Con keyfile
sudo dd if=/dev/urandom of=/root/.luks-keyfile bs=512 count=1
sudo chmod 400 /root/.luks-keyfile
sudo cryptsetup luksAddKey /dev/sdX1 /root/.luks-keyfile
```

3. Agregar entrada a `/etc/crypttab` y `/etc/fstab`.

4. Confirmar en `.env`:

```bash
ENCRYPTION_AT_REST_CONFIRMED=true
```

### Alternativas

- **VPS con disco cifrado por defecto**: algunos proveedores (Hetzner, DigitalOcean) ofrecen cifrado de volumen. Verificar que cubre el directorio de datos.
- **macOS**: FileVault cubre el disco completo.
- **Windows**: BitLocker para el volumen de datos.

### Verificacion

En produccion, si `ENCRYPTION_AT_REST_CONFIRMED` no esta en `true`, el backend falla el arranque:

```
ENCRYPTION_AT_REST_CONFIRMED=true is required in production after verifying filesystem-level encryption for the database, uploads, and backups volumes.
```

Ese fallo es deliberado: para este proyecto el cifrado en reposo del host ya no queda como un recordatorio optativo.

## Reglas Practicas

1. Los permisos visibles en UI son ayuda de UX, no seguridad real.
2. Cada endpoint clinico debe validar acceso efectivo al paciente o encounter correspondiente.
3. Si un cambio toca permisos de encounters o sus acciones de workflow, el lugar para declararlo primero es `shared/encounter-permission-contract.ts`.
4. Cualquier cambio en auth o permisos deberia venir con tests backend y, si afecta experiencia visible, tests frontend.
5. No uses placeholders en entornos compartidos aunque sea "solo por un rato". Ese rato siempre termina siendo mas largo de lo que alguien admite.

## Donde Seguir

- Variables: `environment.md`
- Arquitectura backend: `backend-architecture.md`
- Flujos funcionales: `clinical-workflows.md`
