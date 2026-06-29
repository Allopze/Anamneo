# Scripts archivados

Scripts que cumplieron su propósito y ya no son ejecutables en el estado actual de la DB/schema.

## backfill-patient-identifier-encryption.js

**Propósito original**: Poblar las columnas `*_enc` y `rut_lookup_hash` del modelo `Patient` a partir de los valores plaintext (`rut`, `nombre`, `telefono`, `email`, `domicilio`, `contactoEmergenciaNombre`, `contactoEmergenciaTelefono`).

**Por qué ya no aplica**: La migración `20260524000000_ley21719_phase_c_drop_patient_plaintext` eliminó las columnas plaintext de la DB. El script se actualizó para usar `$queryRawUnsafe` y leer esas columnas directamente, pero una vez aplicada la migración esas columnas ya no existen.

**Cuándo se usó**: Entre Phase B (adición de columnas `*_enc`) y Phase C (drop de plaintext). Debe ejecutarse en cualquier entorno donde queden pacientes sin `*_enc` poblado, **antes** de aplicar la migración Phase C.
