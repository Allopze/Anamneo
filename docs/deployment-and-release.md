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
- El arranque productivo real puede pasar por `start:prod:migrate`, que ejecuta `prisma migrate deploy` antes de `node dist/main`.

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
docker compose up -d --build
docker compose exec backend npm run prisma:migrate:prod
```

Si el entorno requiere seed inicial:

```bash
docker compose exec backend npm run prisma:seed
```

## Smoke Checks

1. `GET /api/health` responde OK.
2. El frontend carga en `:5555`.
3. Login, refresh de sesion y navegacion privada funcionan.
4. Si aplica, `GET /api/health/sqlite` no reporta alertas graves.
5. SMTP y Sentry estan configurados si el entorno lo exige.

## Rollback

No hay un flujo automatizado de rollback. Hoy el rollback depende de:

- tener un artefacto anterior,
- restaurar variables compatibles,
- y contar con backup valido de la base si hubo migraciones o cambios de datos.

Antes de desplegar cambios delicados en persistencia, trata el backup como requisito y no como una costumbre optimista.

## Referencias

- Variables: `environment.md`
- Operacion SQLite: `sqlite-operations.md`
- Desarrollo local: `development.md`
