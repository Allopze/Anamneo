# Operacion PostgreSQL

Anamneo usa PostgreSQL como motor unico en desarrollo y produccion. El modelo operativo sigue siendo una instancia por clinica: una base, un directorio de uploads y un set de backups por instalacion.

## Roles

- `anamneo_owner`: migraciones Prisma y DDL.
- `anamneo_app`: runtime de la API, con permisos DML sobre el schema.
- `anamneo_monitor`: consultas de monitoreo.

En Docker Compose, `infra/postgres/init/001-roles.sh` crea los roles de aplicacion y monitoreo al inicializar el volumen de Postgres. El superusuario/owner se configura con `POSTGRES_USER` y `POSTGRES_PASSWORD`.

## Variables Principales

```bash
DATABASE_URL=postgresql://anamneo_app:...@localhost:5432/anamneo?schema=public&connection_limit=10&pool_timeout=10
MIGRATION_DATABASE_URL=postgresql://anamneo_owner:...@localhost:5432/anamneo?schema=public
PG_BACKUP_DIR=./backend/prisma/backups
PG_BACKUP_RETENTION_DAYS=14
PG_BACKUP_MAX_AGE_HOURS=24
PG_RESTORE_DRILL_FREQUENCY_DAYS=7
```

## Comandos

| Comando | Uso |
|---|---|
| `npm run db:backup` | Ejecuta `pg_dump --format=custom` y snapshot de uploads |
| `npm run db:restore:drill` | Restaura el ultimo dump en una base temporal y valida tablas/adjuntos |
| `npm run db:monitor` | Revisa tamano, conexiones, locks, backup y restore drill |
| `npm run db:ops` | Backup + restore drill periodico + monitor + integridad + busqueda clinica |
| `npm --prefix backend run audit:integrity:verify` | Verifica hash-chain de auditoria |

## Health y Metricas

- `GET /api/health` valida conectividad basica con `SELECT 1`.
- `GET /api/health/database` requiere admin y muestra version, tamano, conexiones, locks, backup y restore drill.
- Prometheus expone `anamneo_postgres_backup_age_hours`, `anamneo_postgres_connections_total`, `anamneo_postgres_waiting_locks_total` y `anamneo_postgres_database_size_bytes`.

## Restore Manual

```bash
createdb --dbname="$MIGRATION_DATABASE_URL" anamneo_restore_check
pg_restore --no-owner --no-privileges --dbname="postgresql://anamneo_owner:...@localhost:5432/anamneo_restore_check?schema=public" backup.dump
```

Para restaurar una instalacion real, detener servicios de aplicacion, restaurar el dump con `--clean --if-exists`, restaurar el snapshot de uploads asociado y correr smoke checks antes de exponer el frontend.
