# Release Checklist

## 1. Revisar cambios a commitear

- Ejecutar `git status --short`.
- Confirmar que solo se incluyan cambios funcionales y de configuracion esperados.
- Si el repo ya trae cambios ajenos, armar el commit con rutas explicitas en vez de `git add .`.
- Excluir artefactos locales:
  - backups SQLite
  - `*.tsbuildinfo`
  - archivos de uploads
  - bases locales no destinadas al repo

## 2. Validaciones minimas

- `git ls-files 'backend/.env' 'frontend/.env' 'backend/prisma/*.db*' 'backend/prisma/**/*.db*' 'backend/prisma/**/*.bak' 'backend/prisma/backups/**'` debe volver vacio.
- `npm --prefix backend run lint:check`
- `npm --prefix backend run typecheck`
- `npm --prefix backend test -- --ci --runInBand`
- `npm --prefix backend run test:e2e`
- `npm --prefix backend run build`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --ci --runInBand`
- `npm --prefix frontend run build`

## 3. QA funcional minima

- Crear paciente.
- Crear atencion.
- Crear/editar problema clinico.
- Crear/editar seguimiento.
- Cambiar estado de revision.
- Descargar `PDF`, `receta`, `ordenes` y `derivacion`.
- Probar adjunto con categoria y descripcion.

## 4. Deploy

- Seguir [PRISMA_SQLITE_DEPLOY.md](PRISMA_SQLITE_DEPLOY.md).
- Si vas a rotar claves de ajustes, seguir [docs/settings-key-rotation-runbook.md](docs/settings-key-rotation-runbook.md).
- Ejecutar backup antes de tocar la base.
- Si existen logs de auditoria historicos con payload clinico, ejecutar `npm --prefix backend run audit:redact:clinical-logs`.
- Confirmar `prisma migrate status` en el entorno.
- Si la base SQLite ya existe y no tiene `_prisma_migrations`, baselinar antes de `migrate deploy`.
