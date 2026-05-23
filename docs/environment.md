# Variables de Entorno

La fuente base para estas variables es `.env.example` en la raiz. `backend/.env` y `frontend/.env` funcionan como overlays locales cuando trabajas cada servicio por separado, pero el contrato compartido vive en el archivo raiz y en esta guia.

## Reglas Que Si Importan

- `JWT_SECRET` y `JWT_REFRESH_SECRET` son obligatorias y deben ser distintas.
- `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` es obligatorio en produccion. Esta beta soporta una clinica por instancia; `multi-tenant` queda bloqueado hasta implementar `Clinic/Tenant`.
- `BOOTSTRAP_TOKEN` debe existir en produccion para proteger el primer registro administrador.
- En produccion, ambas deben tener al menos 32 caracteres.
- En produccion, `BOOTSTRAP_TOKEN` tambien debe tener al menos 32 caracteres.
- `DATABASE_URL` y `MIGRATION_DATABASE_URL` deben usar PostgreSQL.
- En produccion, el backend exige `SETTINGS_ENCRYPTION_KEY` o `SETTINGS_ENCRYPTION_KEYS` validas.
- El frontend debe hablar con `/api` same-origin siempre que sea posible para preservar cookies `HttpOnly`.
- El despliegue soportado para publicar la app a internet es `Docker Compose + cloudflared`, no exponer los puertos de Compose directamente a internet.

## Variables Principales

| Variable | Requerida | Default | Uso |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Entorno general |
| `ANAMNEO_DEPLOYMENT_SCOPE` | Si en produccion | `single-clinic` | Alcance de despliegue soportado. La beta actual es una clinica por instancia/base/volumen |
| `DATABASE_URL` | Si | `postgresql://anamneo_app:...` en ejemplo | Conexion Prisma runtime |
| `MIGRATION_DATABASE_URL` | Si para migraciones | `postgresql://anamneo_owner:...` en ejemplo | Conexion Prisma para DDL/migraciones |
| `POSTGRES_DB` | Si en Docker | `anamneo` | Nombre de base creada por el contenedor Postgres |
| `POSTGRES_USER` | Si en Docker | `anamneo_owner` | Rol owner usado por migraciones y DDL |
| `POSTGRES_PASSWORD` | Si en Docker | Ninguno valido | Password del owner Postgres |
| `ANAMNEO_APP_DB_PASSWORD` | Si en Docker | Ninguno valido | Password del rol runtime `anamneo_app` |
| `ANAMNEO_MONITOR_DB_PASSWORD` | Recomendado en Docker | `change-me-before-production` | Password del rol de monitoreo |
| `TEST_DATABASE_URL` | No | `postgresql://.../anamneo_test` | Base de datos opcional para e2e |
| `PLAYWRIGHT_DATABASE_URL` | No | `postgresql://.../anamneo_playwright` | Base de datos para e2e frontend |
| `JWT_SECRET` | Si | Ninguno valido | Firma de access token |
| `JWT_EXPIRES_IN` | No | `15m` | TTL access token |
| `JWT_REFRESH_SECRET` | Si | Ninguno valido | Firma de refresh token |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | TTL refresh token |
| `BOOTSTRAP_TOKEN` | Si en produccion | Ninguno valido | Token requerido para crear la primera cuenta administradora |
| `CORS_ORIGIN` | Si | `http://localhost:5555,https://anamneo.cloudbox.lat` en ejemplo | Allowlist CORS backend |
| `PORT` | No | `5678` backend / `5555` frontend | Puertos HTTP |
| `BACKEND_PORT` | No | `5678` | Puerto externo del backend en Docker Compose |
| `FRONTEND_PORT` | No | `5555` | Puerto externo del frontend en Docker Compose |
| `BACKEND_BIND_HOST` | No | `127.0.0.1` | Host de bind del puerto backend en Docker Compose |
| `FRONTEND_BIND_HOST` | No | `127.0.0.1` | Host de bind del puerto frontend en Docker Compose |
| `APP_TIME_ZONE` | No | `America/Santiago` | Zona horaria clinica usada para comparaciones `date-only` (edad, vencimientos, seguimientos) |
| `NEXT_PUBLIC_API_URL` | Si en despliegue frontend | `/api` en desarrollo recomendado | URL consumida por browser |
| `API_PROXY_TARGET` | No | `http://localhost:5678/api` | Destino server-side del proxy de Next.js |
| `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE` | No | `true` en ejemplos productivos | Fuerza modo compartido en el frontend y desactiva borradores/offline locales con PHI |
| `NEXT_ALLOWED_DEV_ORIGINS` | No | vacio | Origenes extra permitidos por Next.js en desarrollo |
| `APP_PUBLIC_URL` | No | `http://localhost:5555` en ejemplo | Links publicos en correos |
| `FRONTEND_PUBLIC_URL` | No | vacio | URL alternativa del frontend para enlaces y correos |
| `TRUST_PROXY` | No | `false` | Ajuste de proxy para Nest |

## PostgreSQL Operativo

| Variable | Default | Uso |
|---|---|---|
| `PG_BACKUP_DIR` | `./backend/prisma/backups` en ejemplo, `/app/data/backups` en Docker | Ruta de backups |
| `PG_BACKUP_RETENTION_DAYS` | `14` | Retencion de backups |
| `PG_BACKUP_MAX_AGE_HOURS` | `24` | Antiguedad maxima aceptable del ultimo backup |
| `PG_RESTORE_DRILL_FREQUENCY_DAYS` | `7` | Cadencia esperada de restore drills |
| `PG_FORCE_RESTORE_DRILL` | `false` | Fuerza un restore drill en la siguiente ejecucion |
| `BACKUP_CRON_SCHEDULE` | `0 */6 * * *` | Cron del contenedor `backup-cron` |
| `PG_NOTIFY_POLICY` | `on-failure` | Politica de notificacion del runner |
| `PG_ALERT_SERVICE_NAME` | `anamneo-backend` | Nombre del servicio en alertas |
| `PG_ALERT_WEBHOOK_URL` | vacio | Webhook para alertas PostgreSQL |

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
| `ENCRYPTION_AT_REST_CONFIRMED` | `false` | Confirma que el host tiene cifrado de filesystem (LUKS/dm-crypt) en los volumenes de datos clinicos. En produccion debe quedar en `true` despues de verificarlo; si no, el backend falla al arrancar |
| `SENTRY_DSN` | vacio | Sentry backend |
| `NEXT_PUBLIC_SENTRY_DSN` | vacio | Sentry frontend |
| `NEXT_PUBLIC_SENTRY_REPLAY_ENABLED` | `false` | Replay de Sentry solo para depuracion no productiva |
| `METRICS_SCRAPE_TOKEN` | recomendado para observabilidad | Token Bearer para que Prometheus lea `/api/metrics` sin sesion humana |
| `GRAFANA_ADMIN_USER` | `admin` | Usuario admin local de Grafana en Docker Compose |
| `GRAFANA_ADMIN_PASSWORD` | recomendado cambiar | Password admin local de Grafana en Docker Compose |
| `PROMETHEUS_RETENTION` | `30d` | Retencion TSDB de Prometheus |
| `PROMETHEUS_PORT` / `GRAFANA_PORT` / `LOKI_PORT` | `9090` / `3000` / `3100` | Puertos locales del stack de observabilidad |

## Desarrollo vs Produccion

### Desarrollo local

- Usa `.env` en la raiz.
- Mantiene `NEXT_PUBLIC_API_URL=/api`.
- Requiere PostgreSQL local o accesible por `DATABASE_URL`.

### Produccion con Docker Compose + cloudflared

- `docker-compose.yml` exige `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_TOKEN`, `CORS_ORIGIN`, `APP_PUBLIC_URL`, `SETTINGS_ENCRYPTION_KEY` y `ENCRYPTION_AT_REST_CONFIRMED`. Para observabilidad real, configura tambien `METRICS_SCRAPE_TOKEN` y cambia `GRAFANA_ADMIN_PASSWORD`.
- `docker-compose.yml` exige `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`. Cada clinica productiva debe tener su propia instancia, base PostgreSQL, uploads y backups aislados.
- El frontend recibe `NEXT_PUBLIC_API_URL` como argumento de build y tambien como variable de runtime.
- El backend aplica chequeos de seguridad al arrancar y falla rapido si encuentra placeholders o si falta la confirmacion de cifrado en reposo.
- `BACKEND_BIND_HOST` y `FRONTEND_BIND_HOST` deberian quedarse en `127.0.0.1` salvo que tengas un motivo muy claro para abrirlos.
- `APP_PUBLIC_URL` y `CORS_ORIGIN` deben apuntar al hostname HTTPS publico que entrega Cloudflare Tunnel.
- `NEXT_PUBLIC_API_URL` debe mantenerse en `/api` para preservar cookies `HttpOnly` y same-origin.
- `cloudflared` debe publicar el frontend local, por ejemplo `http://localhost:5555`; el backend no necesita quedar expuesto publicamente.
- El primer registro administrador requerira `BOOTSTRAP_TOKEN`; el deploy no deberia considerarse listo hasta validar ese flujo en una ventana controlada.

## Consejo Practico

No metas secretos reales al repositorio, no reutilices el mismo secret para access y refresh, y no cambies `NEXT_PUBLIC_API_URL` al backend directo por impulso. Ese camino suele terminar en cookies rotas y reuniones largas.
