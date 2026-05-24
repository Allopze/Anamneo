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

### `20260524010000_ley21719_phase_d_drop_legal_representative_plaintext`

Phase D — drop de las columnas plaintext del representante legal NNA
(`legal_representative_name`, `legal_representative_rut`,
`legal_representative_relationship`, `legal_representative_contact`).

**Pre-requisitos** documentados en la cabecera de la migración.

---

### `20260524020000_ley21719_phase_e_drop_consent_signer_plaintext`

Phase E — drop de las columnas plaintext del firmante de consentimiento
(`signer_name`, `signer_rut`) en `patient_data_processing_consents`.

**Pre-requisitos** documentados en la cabecera de la migración.

---

### `20260524030000_ley21719_phase_f_drop_data_request_requester_plaintext`

Phase F — drop de las columnas plaintext del solicitante DSAR
(`requester_name`, `requester_rut`, `requester_email`) en `patient_data_requests`.

**Pre-requisitos** documentados en la cabecera de la migración.

---

## Historial (ya activadas)

| Migración | Activada |
|---|---|
| `20260524000000_ley21719_phase_c_drop_patient_plaintext` | ✅ Movida a `migrations/` (Phase C) |
