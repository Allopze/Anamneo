# Recuperacion de cuentas — Runbook operativo

Este runbook cubre recuperacion administrada, emergencia operativa y el flujo self-service de `/auth/forgot-password`.

> **Importante:** todas las operaciones aqui descritas son **registradas
> en `AuditLog`** automaticamente cuando se usan los endpoints/admin UI
> previstos. Las operaciones manuales contra PostgreSQL **no se auditan
> automaticamente**: solo usarlas en escenarios de emergencia documentados aqui
> y dejar registro en bitacora.

---

## 1. Usuario olvido su password (medico o asistente)

### Pre-condiciones
- Existe al menos un admin activo en la instancia.
- El usuario afectado puede ser identificado fehacientemente (correo
  corporativo, llamada telefonica directa, presencia fisica).

### Procedimiento

1. El admin entra a `Admin > Usuarios > [usuario] > Resetear contrasena`.
2. Define un password temporal que cumpla la politica (>=8 chars, mayus,
   minus, numero).
3. El backend hace lo siguiente automaticamente:
   - Persiste `passwordHash` con `mustChangePassword=true`.
   - **Revoca todas las sesiones del usuario** (`revokeAllSessionsForUser`).
   - **Desactiva 2FA** si estaba habilitado (`totpEnabled=false`,
     codigos de recuperacion descartados).
   - Registra en `AuditLog` con accion `USER_PASSWORD_RESET_BY_ADMIN`.
4. El admin entrega el password temporal por canal seguro (presencial,
   llamada, no por chat persistente).
5. El usuario hace login, es forzado a cambiar contrasena (`mustChangePassword`).
6. Si tenia 2FA, debe re-configurarlo en `Ajustes > Seguridad`.

### Riesgo cubierto
Reset administrativo + revocacion de sesiones + descarte de 2FA cierra
el escenario de "alguien tomo el dispositivo con sesion activa o el
TOTP secret".

---

## 2. El unico admin olvido password y/o perdio 2FA

Este es el escenario mas critico: no hay otro admin que ejecute §1, y
no existe (aun) un endpoint publico `/auth/forgot-password`.

### Pre-condiciones
- Acceso fisico o SSH al host donde corre Docker Compose.
- Backup reciente verificado (`runtime/data/backups/*.dump`).

### Procedimiento de emergencia

```bash
export ANAMNEO_ROOT=/ruta/a/anamneo
cd "$ANAMNEO_ROOT"

# 0. Snapshot defensivo previo
docker compose run --rm --no-deps backend node /app/scripts/pg-backup.js

# 1. Generar un hash bcrypt offline para el password nuevo
#    (usar la misma version de bcrypt que el backend: ^6.0.0)
NEW_PASSWORD='ChangeMeAhora123'
NEW_HASH=$(docker compose run --rm --no-deps backend node -e "
  const bcrypt = require('bcrypt');
  bcrypt.hash(process.argv[1], 12).then(h => process.stdout.write(h));
" "$NEW_PASSWORD")
echo "$NEW_HASH"

# 2. Identificar el admin
docker compose exec postgres psql \
  -U "${POSTGRES_USER:-anamneo_owner}" \
  -d "${POSTGRES_DB:-anamneo}" \
  -c "SELECT id, email, role, is_admin, active, totp_enabled FROM users WHERE is_admin = true;"

# 3. Aplicar reset directo (registra evento minimo en logs)
ADMIN_ID='<uuid>'
docker compose exec postgres psql \
  -U "${POSTGRES_USER:-anamneo_owner}" \
  -d "${POSTGRES_DB:-anamneo}" <<EOF
UPDATE users
   SET password_hash = '${NEW_HASH}',
       must_change_password = true,
       totp_enabled = false,
       totp_secret = NULL,
       totp_recovery_codes = NULL,
       refresh_token_version = refresh_token_version + 1,
       updated_at = now()
 WHERE id = '${ADMIN_ID}';

UPDATE user_sessions
   SET revoked_at = now()
 WHERE user_id = '${ADMIN_ID}' AND revoked_at IS NULL;
EOF

# 4. Registrar manualmente en AuditLog (cadena de hashes)
#    -> Implementado: `npm --prefix backend run audit:emergency-event -- --user-id=<id> --reason="..." --message="..." --confirmation="REGISTRAR EVENTO EMERGENCIA"`.

# 5. Validar
curl -sf http://127.0.0.1:5679/api/health
docker compose logs --tail 20 backend
```

### Post-condiciones obligatorias
- Admin hace login, es forzado a cambiar password.
- Admin re-configura 2FA en `Ajustes > Seguridad`.
- **Rotar `BOOTSTRAP_TOKEN`** en `.env` (regenerar con `openssl rand -base64 48`).
- Documentar el incidente en bitacora interna con quien, cuando, por que.

### Por que no se usa `db:purge-users`
Borra todos los usuarios y obliga a re-bootstrapping completo, lo que
destruye historial de auditoria y referencias en `Patient.createdById`,
`Encounter.medicoId`, etc. Solo usar en escenarios de re-instalacion
limpia.

---

## 3. Admin se quiere recuperar el control (cuenta robada o sospecha)

1. Otro admin (si existe) bloquea la cuenta: `Admin > Usuarios >
   [usuario] > Desactivar`.
2. Si no hay otro admin, ejecutar §2 para resetear el password de la
   cuenta sospechosa.
3. Revisar `AuditLog` filtrando por `userId = <id>` en las ultimas 72h
   para detectar accion anomala.
4. Si hubo movimiento sospechoso de pacientes o encounters, escalar
   segun §7.3 de `data-privacy-and-compliance.md` (notificacion de
   incidente).

---

## 4. Estados que vale la pena monitorear

| Senal | Que mirar | Que indica |
|---|---|---|
| `bootstrap_token_still_configured` warning al arranque | logs backend | `BOOTSTRAP_TOKEN` sigue presente despues del primer admin; rotar |
| `LOGIN_FAILED` con `attempt >= 5` | `AuditLog.diff` | Posible brute force; revisar IP/userAgent |
| `phi_field_encryption_disabled` warning | logs backend | Solo deberia aparecer fuera de prod. En prod se rechaza el boot |

---

## 5. Auto-servicio de password reset

El reset self-service por correo esta implementado. Mantenerlo operativo exige SMTP configurado, expiracion corta de tokens y purga periodica de tokens usados/expirados.

Flujo implementado:

1. `POST /api/auth/forgot-password` recibe `{ email }` y responde sin filtrar existencia del usuario.
2. Si corresponde, genera token de reset con TTL corto y envia email con link a `/cambiar-contrasena`.
3. `GET /api/auth/forgot-password/:token` valida vigencia sin consumirlo.
4. `POST /api/auth/forgot-password/confirm` aplica la nueva password, marca el token usado, revoca sesiones y audita `USER_PASSWORD_RESET_VIA_EMAIL`.

Riesgos a mitigar:
- Enumeracion: no diferenciar respuesta entre email existente o no.
- Token leak via email: TTL corto (15 min).
- Resets en bucle: throttle + limite N/dia por usuario.
- 2FA bypass: el reset por email **no debe bypassear 2FA**; si el usuario
  tiene 2FA habilitado, exigir tambien un recovery code en `confirm`.

Pendiente operativo: programar o ejecutar la purga periodica de tokens usados/expirados y revisar metricas de abuso.
