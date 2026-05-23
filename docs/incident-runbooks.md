# Runbooks de Incidentes — Anamneo

Runbooks para el despliegue vigente: Docker Compose, PostgreSQL, backups
`pg_dump --format=custom`, restore drills y frontend publicado por cloudflared.

> Todos los comandos asumen:
>
> ```bash
> export ANAMNEO_ROOT=/ruta/a/anamneo
> cd "$ANAMNEO_ROOT"
> ```

## 1. Base PostgreSQL no disponible

Sintomas:
- `/api/health` falla o reporta `database.status=error`.
- Backend registra errores de conexion, credenciales, migracion o locks.

Diagnostico:

```bash
docker compose ps postgres backend
docker compose logs --tail 100 postgres
docker compose logs --tail 100 backend
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-anamneo_owner}" -d "${POSTGRES_DB:-anamneo}"
npm run db:monitor
```

Resolucion:

```bash
docker compose restart postgres backend
sleep 15
curl -s http://127.0.0.1:${BACKEND_PORT:-5679}/api/health | jq .
```

Si hay que restaurar:

```bash
docker compose down
docker compose up -d postgres
LATEST_BACKUP=$(ls -t "$ANAMNEO_ROOT"/runtime/data/backups/*.dump | head -1)
docker compose run --rm --no-deps backend sh -c \
  'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$MIGRATION_DATABASE_URL" "$1"' \
  sh "/app/data/backups/$(basename "$LATEST_BACKUP")"
docker compose up -d
curl -s http://127.0.0.1:${BACKEND_PORT:-5679}/api/health | jq .
```

## 2. Backend caido

Diagnostico:

```bash
docker compose ps backend
docker compose logs --tail 200 backend
docker compose exec backend env | grep -E "DATABASE_URL|MIGRATION_DATABASE_URL|NODE_ENV|TRUST_PROXY"
```

Resolucion:

```bash
docker compose restart backend
sleep 15
curl -s http://127.0.0.1:${BACKEND_PORT:-5679}/api/health | jq .
```

Si el error es de build o dependencias:

```bash
docker compose build backend
docker compose up -d backend
```

## 3. Frontend caido

```bash
docker compose ps frontend
docker compose logs --tail 200 frontend
docker compose restart frontend
sleep 10
curl -sI http://127.0.0.1:${FRONTEND_PORT:-5556} | head -5
```

Si hay error de build:

```bash
docker compose build frontend
docker compose up -d frontend
```

## 4. Backup fallido

Sintomas:
- `backup-cron` registra `postgres_backup_failed`.
- No hay `.dump` reciente en `runtime/data/backups`.
- `npm run db:monitor` reporta backup vencido.

Diagnostico y resolucion:

```bash
ls -lht "$ANAMNEO_ROOT"/runtime/data/backups/*.dump 2>/dev/null | head -5
docker compose logs --since 24h backup-cron | grep -i "postgres_backup\|backup.*failed\|error"
df -h "$ANAMNEO_ROOT/runtime"
npm run db:backup
npm run db:monitor
```

Si falla por disco, ampliar volumen o retirar backups antiguos solo despues de
confirmar que existe al menos un backup reciente valido fuera del host.

## 5. Restore drill fallido

Sintomas:
- `backup-cron` registra `postgres_restore_drill_failed`.
- `GET /api/health/database` muestra restore drill vencido o nunca ejecutado.

Diagnostico:

```bash
docker compose logs --since 24h backup-cron | grep -i "restore_drill"
npm run db:restore:drill
```

Con backup especifico:

```bash
BACKUP=/app/data/backups/anamneo-YYYYMMDD-HHMMSS.dump
docker compose run --rm --no-deps backend node /app/scripts/pg-restore-drill.js --from="$BACKUP"
```

Si falla un backup puntual, probar el backup anterior y abrir incidente de
integridad de respaldo.

## 6. Error masivo de autenticacion

```bash
docker compose logs --since 1h backend | grep -i "auth\|login\|jwt\|cookie"
docker compose exec backend env | grep -E "JWT_SECRET|JWT_REFRESH_SECRET|TRUST_PROXY|APP_PUBLIC_URL"
curl -vI http://127.0.0.1:${FRONTEND_PORT:-5556}
```

Acciones:
- Confirmar que `JWT_SECRET` y `JWT_REFRESH_SECRET` no cambiaron sin ventana de mantenimiento.
- Verificar que produccion usa HTTPS via cloudflared y `TRUST_PROXY=1`.
- Reiniciar `backend frontend` si solo hay drift temporal de proceso.

## 7. Disco insuficiente

```bash
df -h
du -sh "$ANAMNEO_ROOT"/runtime/*
du -sh "$ANAMNEO_ROOT"/runtime/data/backups "$ANAMNEO_ROOT"/runtime/uploads 2>/dev/null || true
docker system df
```

Acciones:
- Ampliar disco si `runtime/uploads` o Postgres crecen sostenidamente.
- Retirar backups vencidos solo despues de confirmar copia externa reciente.
- No borrar `runtime/uploads` manualmente salvo que el snapshot de backup y el
  modelo de adjuntos hayan sido revisados.

## 8. Migracion fallida

El camino preferido es `npm run deploy`, que toma backup pre-migracion, ejecuta
restore drill y ofrece rollback si `prisma migrate deploy` falla.

Diagnostico:

```bash
docker compose run --rm --no-deps backend npx prisma migrate status
docker compose logs --tail 100 backend | grep -i "migrate\|migration\|prisma"
```

Rollback manual:

```bash
docker compose down
docker compose up -d postgres
LATEST_BACKUP=$(ls -t "$ANAMNEO_ROOT"/runtime/data/backups/*.dump | head -1)
docker compose run --rm --no-deps backend sh -c \
  'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$MIGRATION_DATABASE_URL" "$1"' \
  sh "/app/data/backups/$(basename "$LATEST_BACKUP")"
docker compose up -d
```

## 9. Cloudflared caido

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared --since 1h
cloudflared tunnel info <tunnel-uuid>
curl -sI http://127.0.0.1:${FRONTEND_PORT:-5556} | head -5
```

Si frontend local responde, reiniciar `cloudflared` y revisar reglas ingress.

## 10. Sentry no envia alertas

```bash
docker compose exec backend env | grep SENTRY_DSN
docker compose exec frontend env | grep NEXT_PUBLIC_SENTRY_DSN
docker compose logs --since 1h backend | grep -i "sentry"
```

Confirmar DSN, bloqueo de red saliente y reglas del proyecto Sentry.

## Escalacion

- Nivel 1: servicio lento o alerta no critica; registrar y monitorear.
- Nivel 2: funcionalidad parcial afectada; reiniciar componente y abrir ticket.
- Nivel 3: caida total, perdida de datos, backup/restore fallido o PHI expuesta;
  detener cambios, preservar logs y activar notificacion segun compliance.

## Referencias

- [Operacion PostgreSQL](./postgres-operations.md)
- [Procedimientos de operacion](./operational-procedures.md)
- [Despliegue y release](./deployment-and-release.md)
