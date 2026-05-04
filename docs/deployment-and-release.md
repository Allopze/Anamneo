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

## Alcance De La Beta Productiva

La beta soportada por este release es **single-clinic**:

- `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` debe estar configurado en produccion.
- Una clinica equivale a una instancia de Compose, una base SQLite, un directorio de uploads y una carpeta de backups.
- No mezcles clinicas distintas en la misma instancia. El schema aun no tiene `Clinic`, `Tenant` ni `clinicId` obligatorio.
- El backend rechaza otros alcances productivos, incluido `multi-tenant`, hasta que exista un modelo de tenant/clinic con migraciones, guards, filtros y tests de aislamiento.

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
- `README.md`
- `package.json`
- `backend/`
- `frontend/`
- `shared/`
- `scripts/deploy.sh`

El contenido queda en la raiz del zip, sin una carpeta contenedora adicional, para que al extraerlo puedas entrar directo al directorio destino y correr `docker compose build` o `npm run deploy`.

Excluye, entre otros:

- `node_modules/`
- `.next/`
- `dist/`
- bases SQLite y journals
- `runtime/data/` completo, incluyendo backups locales
- `runtime/uploads/` completo
- `.env*` reales
- releases previos

Importante:

- el script no crea tag git,
- no genera changelog,
- y no corre validaciones previas automaticamente.

Si quieres un release serio, corre primero build, typecheck y tests relevantes. El zip por si solo no compensa malas decisiones.

## Checklist Pre-Release

1. `npm --prefix backend run lint:check`
2. `npm --prefix frontend run lint`
3. `npm --prefix backend run typecheck`
4. `npm --prefix frontend run typecheck`
5. `npm --prefix backend run test`
6. `npm --prefix frontend run test`
7. `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
8. `npm --prefix frontend run test:e2e`
9. `npm run build`
10. `DATABASE_URL=file:<tmp>/migrate.db npm --prefix backend run prisma:migrate:prod`
11. `git ls-files 'backend/.env' 'frontend/.env' '*.db' '*.db.*' '*.db-journal' '*.db-shm' '*.db-wal' '*.bak' 'backend/.playwright-e2e/**' 'backend/uploads-e2e/**' 'runtime/**' 'backend/tmp*.pdf'` no debe listar nada.
12. `npm run release`

Para cerrar la evidencia local/Docker de una beta single-clinic, ademas corre:

```bash
docker compose build
docker compose up -d
curl -s http://127.0.0.1:${BACKEND_PORT:-5678}/api/health
npm run db:backup
npm run db:restore:drill
npm --prefix backend run audit:integrity:verify
```

Si necesitas probar rollback sin datos reales, usa una base sintetica, toma backup, fuerza una falla controlada de migracion en una copia de trabajo y documenta que el backup vuelve a dejar `/api/health` en OK.

## Despliegue Manual

```bash
unzip anamneo-<timestamp>.zip -d anamneo
cd anamneo
mkdir -p runtime/data runtime/uploads
cp .env.example .env
# Completa al menos JWT_SECRET, JWT_REFRESH_SECRET, BOOTSTRAP_TOKEN,
# CORS_ORIGIN, APP_PUBLIC_URL, SETTINGS_ENCRYPTION_KEY,
# ENCRYPTION_AT_REST_CONFIRMED y ANAMNEO_DEPLOYMENT_SCOPE=single-clinic antes de seguir.
# Si trabajas backend o frontend por separado, revisa tambien sus .env locales como overlays de desarrollo.
docker compose build
docker compose run --rm --no-deps backend npx prisma migrate deploy
docker compose up -d
```

### Despliegue Automatizado (recomendado)

```bash
unzip anamneo-<timestamp>.zip -d anamneo
cd anamneo
mkdir -p runtime/data runtime/uploads
cp .env.example .env
# Completa al menos JWT_SECRET, JWT_REFRESH_SECRET, BOOTSTRAP_TOKEN,
# CORS_ORIGIN, APP_PUBLIC_URL, SETTINGS_ENCRYPTION_KEY,
# ENCRYPTION_AT_REST_CONFIRMED y ANAMNEO_DEPLOYMENT_SCOPE=single-clinic antes de seguir.
# Si trabajas backend o frontend por separado, revisa tambien sus .env locales como overlays de desarrollo.
docker compose build
npm run deploy
```

El script `scripts/deploy.sh` ejecuta:

1. Backup pre-migración usando `backend/scripts/sqlite-backup.js`, incluyendo metadata y snapshot de uploads.
2. Restore drill sobre ese backup para validar que es utilizable también cuando existen adjuntos.
3. `prisma migrate deploy` sobre todas las migraciones pendientes empaquetadas en `backend/prisma/migrations/`.
4. Si la migración falla, ofrece rollback automático al estado previo.
5. `docker compose up -d` y espera health check del backend.

Eso incluye cambios de esquema puntuales como la migración de recovery codes 2FA (`20260425110000_add_totp_recovery_codes`) sin requerir pasos manuales extra fuera del flujo de release.

Hasta aca el stack queda listo en el host, no publicado a internet. La publicacion soportada ocurre cuando `cloudflared` enruta tu hostname HTTPS al frontend local.

Si el entorno requiere seed inicial:

```bash
docker compose exec backend npm run prisma:seed
```

## Smoke Checks

Prerequisitos para este smoke final:

- El stack de Anamneo debe estar realmente arriba en loopback (`127.0.0.1:<BACKEND_PORT>` y `127.0.0.1:<FRONTEND_PORT>`).
- Debes conocer el hostname HTTPS publicado por el tunnel. Un proceso `cloudflared` activo sin frontend respondiendo en loopback no valida el despliegue soportado.

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
cp runtime/data/backups/anamneo-<timestamp>.db runtime/data/anamneo.db
docker compose up -d
```

Si la migración ya se aplicó y necesitas volver atrás:

1. Identifica el backup más reciente en `runtime/data/backups/`.
2. Detén los servicios: `docker compose down`.
3. Restaura la DB: `cp runtime/data/backups/anamneo-<timestamp>.db runtime/data/anamneo.db`.
4. Levanta: `docker compose up -d`.
5. Verifica: `curl http://127.0.0.1:5678/api/health`.

El cron de backup (`backup-cron`) ahora ejecuta `sqlite-ops-runner.js --mode=all`, que incluye backup + restore drill periódico + monitor + alertas. Los restore drills se ejecutan automáticamente según `SQLITE_RESTORE_DRILL_FREQUENCY_DAYS` (default: 7 días).

## Referencias

- Variables: `environment.md`
- Operacion SQLite: `sqlite-operations.md`
- Desarrollo local: `development.md`
