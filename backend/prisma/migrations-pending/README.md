# Migraciones pendientes de revision

Esta carpeta contiene migraciones Prisma que **NO se aplican automaticamente**.
Estan aqui porque requieren validacion humana antes de cambiar el schema
productivo.

Prisma solo ejecuta las migraciones que estan en `prisma/migrations/`.
Para activar una migracion de esta carpeta:

```bash
# 1. Verificar prerequisitos (cada migracion documenta los suyos arriba)
# 2. Mover el directorio:
mv prisma/migrations-pending/<id> prisma/migrations/
# 3. Aplicar:
npx prisma migrate deploy
# 4. Regenerar cliente:
npx prisma generate
```

## Migraciones actuales

### `20260524000000_ley21719_phase_c_drop_patient_plaintext`

Phase C del cifrado app-level del paciente: drop final de las columnas
plaintext (`rut`, `nombre`, `telefono`, `email`, `domicilio`,
`contacto_emergencia_nombre`, `contacto_emergencia_telefono`).

**Pre-requisitos** documentados en la cabecera de la migracion.
**Acompanar** con cambios en `schema.prisma` (eliminar las columnas
plaintext de `model Patient`) y en `patients-presenters.ts` (eliminar
los argumentos `*Enc, *plain` de `decryptOrFallback` y dejar solo el
descifrado directo).
