# Despliegue y Release

Este documento cubre build, empaquetado y despliegue. El objetivo es que el release sea repetible. No glamoroso, no mistico, solo repetible.

## Build

### Root

```bash
npm run build
```

Eso orquesta:

- `npm run build:backend`
- `npm run build:frontend`

### Backend

- `backend/package.json` usa `nest build`.
- El contenedor productivo ya no ejecuta `prisma migrate deploy` en cada arranque.
- La migracion soportada en produccion es un paso explicito de release: `docker compose run --rm --no-deps backend npx prisma migrate deploy`.

### Frontend

- `frontend/package.json` usa `node ./scripts/next-build.js`.
- El frontend se compila con salida `standalone`.
- Next.js reescribe `/api/*` al backend configurado.

## Docker Compose

`docker-compose.yml` define tres servicios:

| Servicio | Puerto | Funcion |
|---|---|---|
| `backend` | `5678` | API NestJS |
| `frontend` | `5555` | App Next.js |
| `backup-cron` | n/a | Backup automatico SQLite |

Tambien persiste datos en carpetas locales bajo `./runtime/`:

- `./runtime/data`
- `./runtime/uploads`

Los puertos publicados por Compose quedan atados a loopback por defecto (`127.0.0.1`). Eso es intencional. Este producto esta pensado para publicarse detras de `cloudflared`, no para exponer `:5555` o `:5678` directo a internet y despues preguntarse por que las cookies `Secure` no cooperan.

## Modelo Soportado De Publicacion

El despliegue internet-facing soportado para este proyecto es:

1. `docker compose build` en el host.
2. `docker compose run --rm --no-deps backend npx prisma migrate deploy` en el host.
3. Backend y frontend publicados solo en loopback del host.
4. `cloudflared` corriendo en el mismo host y exponiendo por HTTPS el frontend local.
5. El navegador entra por el hostname publico y Next.js mantiene `/api` same-origin hacia el backend interno.

Esto importa porque auth usa cookies `HttpOnly` y `Secure` en produccion. Si publicas el stack por HTTP directo, el problema no es "que Next a veces se pone raro"; el problema es que el despliegue quedo mal planteado.

Segun la configuracion local administrada documentada por Cloudflare Tunnel, el tunnel publica un `hostname` y lo enruta a un `service` local mediante reglas `ingress`, con una regla catch-all al final. Para Anamneo el flujo recomendado es exponer el frontend local y dejar que Next resuelva `/api` de forma interna:

```yml
tunnel: <uuid-del-tunnel>
credentials-file: /etc/cloudflared/<uuid-del-tunnel>.json

ingress:
	- hostname: anamneo.example.com
		service: http://localhost:5555
	- service: http_status:404
```

No expongas `:5678` al publico. El backend debe quedar detras del frontend same-origin o dentro de la red local del host.

## Empaquetado de Release

```bash
npm run release
```

El script `scripts/release.sh` genera `releases/anamneo-YYYYMMDD-HHMMSS.zip` e incluye:

- `docker-compose.yml`
- `.env.example`
- `package.json`
- `backend/`
- `frontend/`
- `scripts/dev-supervisor.sh`

Excluye, entre otros:

- `node_modules/`
- `.next/`
- `dist/`
- bases SQLite y journals
- backups locales
- uploads locales
- `.env*` reales
- releases previos

Importante:

- el script no crea tag git,
- no genera changelog,
- y no corre validaciones previas automaticamente.

Si quieres un release serio, corre primero build, typecheck y tests relevantes. El zip por si solo no compensa malas decisiones.

## Checklist Pre-Release

1. `npm run build`
2. `npm --prefix backend run typecheck`
3. `npm --prefix frontend run typecheck`
4. Tests relevantes del area tocada
5. Confirmar variables de entorno del entorno destino
6. Confirmar backup reciente si hay cambios de datos o migraciones

## Despliegue Manual

```bash
unzip anamneo-<timestamp>.zip -d anamneo
cd anamneo
cp .env.example .env
docker compose build
docker compose run --rm --no-deps backend npx prisma migrate deploy
docker compose up -d
```

### Despliegue Automatizado (recomendado)

```bash
unzip anamneo-<timestamp>.zip -d anamneo
cd anamneo
cp .env.example .env
docker compose build
npm run deploy
```

El script `scripts/deploy.sh` ejecuta:

1. Backup pre-migración de la DB activa (con WAL y SHM si existen).
2. Restore drill sobre el backup para validar que es utilizable.
3. `prisma migrate deploy`.
4. Si la migración falla, ofrece rollback automático al estado previo.
5. `docker compose up -d` y espera health check del backend.

Hasta aca el stack queda listo en el host, no publicado a internet. La publicacion soportada ocurre cuando `cloudflared` enruta tu hostname HTTPS al frontend local.

Si el entorno requiere seed inicial:

```bash
docker compose exec backend npm run prisma:seed
```

## Smoke Checks

1. `GET http://127.0.0.1:<BACKEND_PORT>/api/health` responde OK en el host.
2. El frontend carga localmente en `http://127.0.0.1:<FRONTEND_PORT>`.
3. El hostname HTTPS publicado por `cloudflared` responde y carga la app.
4. Login, refresh de sesion y navegacion privada funcionan a traves del hostname HTTPS publico.
5. Si aplica, `GET http://127.0.0.1:<BACKEND_PORT>/api/health/sqlite` no reporta alertas graves.
6. SMTP y Sentry estan configurados si el entorno lo exige.

## Rollback

El rollback está integrado en `scripts/deploy.sh`. Si la migración falla durante el deploy, el script ofrece restaurar automáticamente el backup pre-migración.

Para rollback manual fuera del script:

```bash
docker compose down
cp runtime/data/backups/pre-deploy-<timestamp>.db runtime/data/anamneo.db
docker compose up -d
```

Si la migración ya se aplicó y necesitas volver atrás:

1. Identifica el backup pre-deploy más reciente en `runtime/data/backups/`.
2. Detén los servicios: `docker compose down`.
3. Restaura la DB: `cp runtime/data/backups/pre-deploy-<timestamp>.db runtime/data/anamneo.db`.
4. Si existen, restaura WAL y SHM con el mismo prefijo.
5. Levanta: `docker compose up -d`.
6. Verifica: `curl http://127.0.0.1:5678/api/health`.

El cron de backup (`backup-cron`) ahora ejecuta `sqlite-ops-runner.js --mode=all`, que incluye backup + restore drill periódico + monitor + alertas. Los restore drills se ejecutan automáticamente según `SQLITE_RESTORE_DRILL_FREQUENCY_DAYS` (default: 7 días).

## Referencias

- Variables: `environment.md`
- Operacion SQLite: `sqlite-operations.md`
- Desarrollo local: `development.md`
