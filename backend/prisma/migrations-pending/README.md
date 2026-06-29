# Migraciones pendientes de revisión

Esta carpeta contiene migraciones Prisma que **NO se aplican automáticamente**.
Están aquí porque requieren validación humana antes de cambiar el schema
productivo.

Prisma solo ejecuta las migraciones que están en `prisma/migrations/`.
Para activar una migración de esta carpeta:

```bash
# 1. Verificar prerequisitos (cada migración documenta los suyos arriba)
# 2. Mover el directorio:
mv prisma/migrations-pending/<id> prisma/migrations/
# 3. Aplicar:
npx prisma migrate deploy
# 4. Regenerar cliente:
npx prisma generate
```

---

## Migraciones pendientes activas

No hay migraciones pendientes activas.

---

## Historial (ya activadas)

| Migración | Activada |
|---|---|
| `20260524000000_ley21719_phase_c_drop_patient_plaintext` | ✅ Movida a `migrations/` (Phase C) |
| `20260524010000_ley21719_phase_d_drop_legal_representative_plaintext` | ✅ Movida a `migrations/` (Phase D-drop) |
| `20260524020000_ley21719_phase_e_drop_consent_signer_plaintext` | ✅ Movida a `migrations/` (Phase E-drop) |
| `20260524030000_ley21719_phase_f_drop_data_request_requester_plaintext` | ✅ Movida a `migrations/` (Phase F-drop) |
