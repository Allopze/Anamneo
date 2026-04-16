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
| Revocacion | `refreshTokenVersion` + revocacion de sesion |
| Bloqueo de intentos | `LoginAttempt` registra fallos y ventana de bloqueo |

El frontend no se guia solo por la presencia de cookies: `src/proxy.ts` valida sesion real consultando `/api/auth/me` antes de decidir redirecciones sensibles.

En el camino caliente de autenticacion, `login`, `register` y `2fa/verify` devuelven tambien el usuario de sesion sanitizado. El frontend usa ese payload para hidratar el store y evitar un segundo roundtrip inmediato a `/auth/me`, pero sigue reservando `GET /auth/me` para el bootstrap real cuando se entra al dashboard sin ese contexto reciente.

Cuando el sistema aun no tiene un admin activo, el primer registro requiere `BOOTSTRAP_TOKEN`. La idea es simple: una instancia vacia expuesta a internet no debe quedar al alcance del primer visitante que encuentre `/register`.

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

En produccion, si `ENCRYPTION_AT_REST_CONFIRMED` no esta en `true`, el backend emite un warning en cada arranque:

```
encryption_at_rest_not_confirmed: Clinical attachments and database backups are stored unencrypted on disk.
```

Ese warning no bloquea el arranque, pero si aparece en produccion, alguien deberia preguntar por que.

## Reglas Practicas

1. Los permisos visibles en UI son ayuda de UX, no seguridad real.
2. Cada endpoint clinico debe validar acceso efectivo al paciente o encounter correspondiente.
3. Cualquier cambio en auth o permisos deberia venir con tests backend y, si afecta experiencia visible, tests frontend.
4. No uses placeholders en entornos compartidos aunque sea "solo por un rato". Ese rato siempre termina siendo mas largo de lo que alguien admite.

## Donde Seguir

- Variables: `environment.md`
- Arquitectura backend: `backend-architecture.md`
- Flujos funcionales: `clinical-workflows.md`