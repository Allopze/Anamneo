# Variables de Entorno

La fuente base para estas variables es `.env.example`, complementada por `docker-compose.yml` y las validaciones de `backend/src/main.ts`.

## Reglas Que Si Importan

- `JWT_SECRET` y `JWT_REFRESH_SECRET` son obligatorias y deben ser distintas.
- `BOOTSTRAP_TOKEN` debe existir en produccion para proteger el primer registro administrador.
- En produccion, ambas deben tener al menos 32 caracteres.
- En produccion, `BOOTSTRAP_TOKEN` tambien debe tener al menos 32 caracteres.
- Si usas SQLite en produccion, debes habilitarlo explicitamente con `ALLOW_SQLITE_IN_PRODUCTION=true`.
- En produccion, el backend exige `SETTINGS_ENCRYPTION_KEY` o `SETTINGS_ENCRYPTION_KEYS` validas.
- El frontend debe hablar con `/api` same-origin siempre que sea posible para preservar cookies `HttpOnly`.
- El despliegue soportado para publicar la app a internet es `Docker Compose + cloudflared`, no exponer los puertos de Compose directamente a internet.

## Variables Principales

| Variable | Requerida | Default | Uso |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Entorno general |
| `DATABASE_URL` | Si | `file:./dev.db` en ejemplo | Conexion Prisma |
| `JWT_SECRET` | Si | Ninguno valido | Firma de access token |
| `JWT_EXPIRES_IN` | No | `15m` | TTL access token |
| `JWT_REFRESH_SECRET` | Si | Ninguno valido | Firma de refresh token |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | TTL refresh token |
| `BOOTSTRAP_TOKEN` | Si en produccion | Ninguno valido | Token requerido para crear la primera cuenta administradora |
| `CORS_ORIGIN` | Si | `http://localhost:5555,https://anamneo.cloudbox.lat` en ejemplo | Allowlist CORS backend |
| `PORT` | No | `5678` backend / `5555` frontend | Puertos HTTP |
| `BACKEND_BIND_HOST` | No | `127.0.0.1` | Host de bind del puerto backend en Docker Compose |
| `FRONTEND_BIND_HOST` | No | `127.0.0.1` | Host de bind del puerto frontend en Docker Compose |
| `APP_TIME_ZONE` | No | `America/Santiago` | Zona horaria clinica usada para comparaciones `date-only` (edad, vencimientos, seguimientos) |
| `NEXT_PUBLIC_API_URL` | Si en despliegue frontend | `/api` en desarrollo recomendado | URL consumida por browser |
| `APP_PUBLIC_URL` | No | `http://localhost:5555` en ejemplo | Links publicos en correos |
| `TRUST_PROXY` | No | `false` | Ajuste de proxy para Nest |

## SQLite Operativo

| Variable | Default | Uso |
|---|---|---|
| `ALLOW_SQLITE_IN_PRODUCTION` | `false` | Habilitacion explicita de SQLite en prod |
| `SQLITE_SYNCHRONOUS` | `NORMAL` | Politica de sincronizacion |
| `SQLITE_BUSY_TIMEOUT_MS` | `5000` | Espera ante locks |
| `SQLITE_WAL_AUTOCHECKPOINT_PAGES` | `1000` | Checkpoint WAL |
| `SQLITE_BACKUP_DIR` | `./backend/prisma/backups` en ejemplo, `/app/data/backups` en Docker | Ruta de backups |
| `SQLITE_BACKUP_RETENTION_DAYS` | `14` | Retencion de backups |
| `SQLITE_BACKUP_MAX_AGE_HOURS` | `24` | Antiguedad maxima aceptable del ultimo backup |
| `SQLITE_WAL_WARN_SIZE_MB` | `128` | Umbral de alerta de WAL |
| `SQLITE_RESTORE_DRILL_FREQUENCY_DAYS` | `7` | Cadencia esperada de restore drills |
| `BACKUP_CRON_SCHEDULE` | `0 */6 * * *` | Cron del contenedor `backup-cron` |
| `SQLITE_NOTIFY_POLICY` | `on-failure` | Politica de notificacion del runner |
| `SQLITE_ALERT_SERVICE_NAME` | `anamneo-backend` | Nombre del servicio en alertas |
| `SQLITE_ALERT_WEBHOOK_URL` | vacio | Webhook para alertas SQLite |

## SMTP y Settings Cifrados

| Variable | Requerida | Uso |
|---|---|---|
| `SETTINGS_ENCRYPTION_KEY` | Si en produccion | Clave activa para cifrar settings persistidos |
| `SETTINGS_ENCRYPTION_KEYS` | No | Lista de claves aceptadas para rewrap |
| `SMTP_HOST` | No | Host SMTP |
| `SMTP_PORT` | No | Puerto SMTP |
| `SMTP_SECURE` | No | TLS estricto |
| `SMTP_USER` | No | Usuario SMTP |
| `SMTP_PASSWORD` | No | Password SMTP |
| `SMTP_FROM_EMAIL` | No | Sender |
| `SMTP_FROM_NAME` | No | Nombre remitente |
| `INVITATION_EMAIL_SUBJECT` | No | Asunto de invitaciones |

La rotacion de claves esta detallada en `settings-key-rotation-runbook.md`.

## Uploads y Observabilidad

| Variable | Default | Uso |
|---|---|---|
| `UPLOAD_MAX_SIZE` | `10485760` | Limite maximo por archivo |
| `UPLOAD_DEST` | `./uploads` en ejemplo, `/app/uploads` en Docker | Destino de archivos. Debe permanecer dentro del directorio de la app |
| `ENCRYPTION_AT_REST_CONFIRMED` | `false` | Confirma que el host tiene cifrado de filesystem (LUKS/dm-crypt) en los volumenes de datos clinicos. Si no se confirma, el backend emite un warning en produccion |
| `SENTRY_DSN` | vacio | Sentry backend |
| `NEXT_PUBLIC_SENTRY_DSN` | vacio | Sentry frontend |

## Desarrollo vs Produccion

### Desarrollo local

- Usa `.env` en la raiz.
- Mantiene `NEXT_PUBLIC_API_URL=/api`.
- Permite SQLite sin habilitacion extra porque `NODE_ENV` no es `production`.

### Produccion con Docker Compose + cloudflared

- `docker-compose.yml` exige `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_TOKEN`, `CORS_ORIGIN`, `APP_PUBLIC_URL` y `SETTINGS_ENCRYPTION_KEY`.
- El frontend recibe `NEXT_PUBLIC_API_URL` como argumento de build y tambien como variable de runtime.
- El backend aplica chequeos de seguridad al arrancar y falla rapido si encuentra placeholders.
- `BACKEND_BIND_HOST` y `FRONTEND_BIND_HOST` deberian quedarse en `127.0.0.1` salvo que tengas un motivo muy claro para abrirlos.
- `APP_PUBLIC_URL` y `CORS_ORIGIN` deben apuntar al hostname HTTPS publico que entrega Cloudflare Tunnel.
- `NEXT_PUBLIC_API_URL` debe mantenerse en `/api` para preservar cookies `HttpOnly` y same-origin.
- `cloudflared` debe publicar el frontend local, por ejemplo `http://localhost:5555`; el backend no necesita quedar expuesto publicamente.
- El primer registro administrador requerira `BOOTSTRAP_TOKEN`; el deploy no deberia considerarse listo hasta validar ese flujo en una ventana controlada.

## Consejo Practico

No metas secretos reales al repositorio, no reutilices el mismo secret para access y refresh, y no cambies `NEXT_PUBLIC_API_URL` al backend directo por impulso. Ese camino suele terminar en cookies rotas y reuniones largas.
