# Procedimientos de Operacion — Anamneo

Este documento cubre la operacion diaria, semanal y de emergencia del
despliegue soportado: Docker Compose, PostgreSQL, frontend same-origin y
publicacion mediante cloudflared.

> Todos los comandos asumen que `ANAMNEO_ROOT` apunta al directorio del
> deploy.
>
> ```bash
> export ANAMNEO_ROOT=/ruta/a/anamneo
> cd "$ANAMNEO_ROOT"
> ```

## 1. Rutina diaria

### Salud del stack

```bash
docker compose ps
curl -s http://127.0.0.1:${BACKEND_PORT:-5679}/api/health | jq .
curl -sI http://127.0.0.1:${FRONTEND_PORT:-5556} | head -5
docker compose logs --since 24h backend | grep -i "error\|fatal\|exception" | tail -20
docker compose logs --since 24h frontend | grep -i "error\|fatal" | tail -20
df -h "$ANAMNEO_ROOT/runtime"
du -sh "$ANAMNEO_ROOT/runtime/data/backups" "$ANAMNEO_ROOT/runtime/uploads" 2>/dev/null || true
```

Checklist:
- Backend responde `status=ok`.
- Frontend responde `200`.
- No hay errores criticos recientes.
- Disco con al menos 20% libre.
- `backup-cron` corre sin errores recientes.

### Backups PostgreSQL

```bash
ls -lht "$ANAMNEO_ROOT"/runtime/data/backups/*.dump 2>/dev/null | head -5
docker compose logs --since 24h backup-cron | grep -i "postgres_backup\|backup.*failed\|restore_drill"
npm run db:monitor
```

Checklist:
- Ultimo `.dump` existe y tiene menos de `PG_BACKUP_MAX_AGE_HOURS`.
- Existe metadata `.meta.json` junto al dump.
- `npm run db:monitor` no reporta locks, backup vencido ni restore drill vencido.

## 2. Rutina semanal

### Restore drill

```bash
npm run db:restore:drill
docker compose logs --since 1h backup-cron | grep -i "restore_drill"
```

Checklist:
- El drill restaura una base temporal PostgreSQL.
- La validacion encuentra tablas publicas.
- Los adjuntos del snapshot asociado existen.

### Integridad y busqueda clinica

```bash
npm --prefix backend run audit:integrity:verify
npm --prefix backend run db:pg:ops:clinical-search
```

Checklist:
- La cadena de auditoria valida.
- La proyeccion `patient_clinical_search` no reporta drift.

### Seguridad y accesos

```bash
docker compose logs --since 7d backend | grep -i "login.*fail\|auth.*fail" | tail -20
docker compose logs --since 7d backend | grep -i "403\|401" | tail -20
docker compose logs --since 7d backend | grep -i "settings.*change\|config.*update" | tail -20
```

## 3. Rutina mensual

### Dependencias y build

```bash
npm --prefix backend outdated || true
npm --prefix frontend outdated || true
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix backend run test
npm --prefix frontend run test
npm run build
```

### Certificados y tunnel

```bash
echo | openssl s_client -servername anamneo.example.com -connect anamneo.example.com:443 2>/dev/null | openssl x509 -noout -dates
cloudflared tunnel info <tunnel-uuid>
```

### Auditoria operativa

Usar la pantalla `Admin > Auditoria` para revisar eventos recientes. Si se
requiere evidencia directa de base, usar `psql` con `MIGRATION_DATABASE_URL`
desde el host o `docker compose exec postgres psql`, nunca procedimientos
manuales que eviten `AuditLog` para cambios de datos.

## 4. Emergencias

### Rollback de deploy fallido

El flujo principal es `npm run deploy`; si una migracion falla, el script
ofrece rollback automatico al backup pre-migracion.

Rollback manual:

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

### Recuperacion ante base no disponible

```bash
docker compose ps postgres backend
docker compose logs --tail 100 postgres
docker compose logs --tail 100 backend
npm run db:restore:drill
```

Si el problema requiere restaurar datos, detener backend/frontend, restaurar el
ultimo `.dump` valido con `pg_restore --clean --if-exists`, restaurar el
snapshot de uploads indicado en el `.meta.json` y ejecutar smoke checks antes
de volver a exponer el frontend.

### Servicio caido

```bash
docker compose ps
docker compose logs --tail 100 backend
docker compose logs --tail 100 frontend
docker compose restart backend frontend
curl -s http://127.0.0.1:${BACKEND_PORT:-5679}/api/health | jq .
curl -sI http://127.0.0.1:${FRONTEND_PORT:-5556} | head -5
```

## 5. Mantenimiento

### Logs

```bash
docker compose logs --since 7d > /tmp/anamneo-logs-$(date +%Y%m%d).txt
docker system df
```

### PostgreSQL

```bash
npm run db:monitor
docker compose exec postgres psql -U "${POSTGRES_USER:-anamneo_owner}" -d "${POSTGRES_DB:-anamneo}" -c \
  "SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;"
```

## 6. Checklists

Diario:
- Salud backend/frontend.
- Backup reciente.
- Logs sin errores criticos.
- Disco suficiente.

Semanal:
- Restore drill.
- Integridad de auditoria.
- Revision de auth/401/403.
- Drift de busqueda clinica.

Mensual:
- Typecheck, tests y build.
- Certificado/tunnel.
- Revision de dependencias.
- Ensayo documentado de rollback cuando haya cambios de esquema relevantes.

## 7. Referencias

- [Operacion PostgreSQL](./postgres-operations.md)
- [Despliegue y release](./deployment-and-release.md)
- [Validacion Docker/Staging](./docker-staging-validation.md)
- [Entorno](./environment.md)
