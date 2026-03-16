# Prisma SQLite Deploy

## Contexto

Este proyecto usa SQLite y Prisma. En el entorno local actual la base ya existia y el schema se sincronizo antes de resolver el historial con `migrate resolve`.

## Para una base nueva

1. Configurar `DATABASE_URL`.
2. Ejecutar:

```bash
npm --prefix backend run prisma:migrate:prod
npm --prefix backend run prisma:seed
```

## Para una base SQLite existente ya sincronizada pero sin `_prisma_migrations`

1. Hacer respaldo del archivo `.db`.
2. Verificar que el schema real coincida con `backend/prisma/schema.prisma`.
3. Marcar migraciones como aplicadas:

```bash
cd backend
for m in \
  20260313221918_init_fresh \
  20260315130000_soft_delete_patients \
  20260315173500_add_refresh_token_version \
  20260315194000_add_user_sessions \
  20260315195500_add_clinical_workflow_features
do
  npx prisma migrate resolve --applied "$m" --schema ./prisma/schema.prisma
done
```

4. Confirmar estado:

```bash
npx prisma migrate status --schema ./prisma/schema.prisma
```

Debe indicar `Database schema is up to date!`.

## Recomendacion operativa

- Antes de cualquier cambio de schema, ejecutar backup SQLite.
- Si la base de produccion ya esta en uso, no correr `prisma migrate dev`.
- Usar `prisma migrate deploy` solo cuando el historial ya este consistente.
