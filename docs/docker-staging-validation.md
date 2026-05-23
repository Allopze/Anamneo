# Validacion Docker/Staging — Anamneo

Plan de validacion para el despliegue Docker/staging antes de produccion. El
stack soportado usa PostgreSQL como unico motor runtime.

## 1. Dominio, HTTPS, CORS y cookies

```bash
dig +short anamneo.example.com
curl -vI https://anamneo.example.com 2>&1 | grep -E "SSL|subject|issuer|expire"
cloudflared tunnel info <tunnel-uuid>
curl -v -X OPTIONS https://anamneo.example.com/api/health \
  -H "Origin: https://anamneo.example.com" \
  -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control"
```

Checklist:
- Cookies `access_token` y `refresh_token` son `Secure`, `HttpOnly` y `SameSite`.
- Browser usa `/api` same-origin.
- Backend no queda expuesto directamente a internet.

## 2. Health checks

```bash
docker compose ps
curl -s http://127.0.0.1:${BACKEND_PORT:-5679}/api/health | jq .
curl -sI http://127.0.0.1:${FRONTEND_PORT:-5556} | head -5
```

Checklist:
- Backend responde `status=ok`.
- `database.driver` es `postgres` cuando se consulta health de DB.
- Frontend responde `200`.
- No hay errores de healthcheck en logs.

## 3. PostgreSQL: backup, restore drill y rollback

Backup manual:

```bash
npm run db:backup
ls -lht runtime/data/backups/*.dump | head -5
cat runtime/data/backups/*.dump.meta.json 2>/dev/null | head -40
```

Restore drill:

```bash
npm run db:restore:drill
npm run db:monitor
```

Rollback de ensayo en staging:

```bash
./scripts/deploy.sh --no-rollback
# Para rollback manual, usar el ultimo .dump validado:
docker compose down
docker compose up -d postgres
LATEST_BACKUP=$(ls -t runtime/data/backups/*.dump | head -1)
docker compose run --rm --no-deps backend sh -c \
  'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$MIGRATION_DATABASE_URL" "$1"' \
  sh "/app/data/backups/$(basename "$LATEST_BACKUP")"
docker compose up -d
```

Checklist:
- Backup genera `.dump` y `.meta.json`.
- Restore drill crea y elimina una base temporal.
- Snapshot de uploads queda referenciado en metadata.
- Rollback documentado deja `/api/health` en OK.

## 4. Sentry con PHI falsa

```bash
docker compose exec backend env | grep SENTRY_DSN
docker compose exec frontend env | grep NEXT_PUBLIC_SENTRY_DSN
```

Checklist:
- `sendDefaultPii=false`.
- Headers sensibles y cookies se redactan antes de enviar.
- Datos falsos de prueba no aparecen como PHI legible en Sentry.

## 5. Alcance single-clinic

La beta productiva soportada es una clinica por instancia:

- `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`.
- Una base PostgreSQL por instalacion.
- Un directorio de uploads y backups por instalacion.
- Multi-tenant requiere modelo `Clinic/Tenant`, filtros obligatorios y pruebas de aislamiento antes de mezclar clinicas.

Checklist:
- No hay mas de una clinica real operando en la misma instancia.
- Variables `DATABASE_URL` y `MIGRATION_DATABASE_URL` apuntan a PostgreSQL.
- `NEXT_PUBLIC_API_URL=/api`.

## 6. Validacion desde clone limpio

```bash
npm install
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix backend run test
npm --prefix frontend run test
npm run build
docker compose config --quiet
```

Para pruebas E2E:

```bash
docker compose up -d postgres
npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts
npm --prefix frontend run test:e2e
```

## Referencias

- [Operacion PostgreSQL](./postgres-operations.md)
- [Despliegue y release](./deployment-and-release.md)
- [Entorno](./environment.md)
