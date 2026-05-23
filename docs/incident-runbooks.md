# Runbooks de Incidentes — Anamneo

Este documento contiene runbooks detallados para los incidentes más comunes en producción.

> Todos los comandos asumen que la variable `ANAMNEO_ROOT` apunta al directorio donde vive el deploy. Exportala antes de copiar/pegar:
>
> ```bash
> export ANAMNEO_ROOT=/ruta/a/anamneo
> ```

## Índice de Runbooks

1. [Base de datos corrupta](#1-base-de-datos-corrupta)
2. [Servicio backend caído](#2-servicio-backend-caído)
3. [Servicio frontend caído](#3-servicio-frontend-caído)
4. [Backup fallido](#4-backup-fallido)
5. [Restore drill fallido](#5-restore-drill-fallido)
6. [Error de autenticación masivo](#6-error-de-autenticación-masivo)
7. [Espacio en disco insuficiente](#7-espacio-en-disco-insuficiente)
8. [Error de migración de base de datos](#8-error-de-migración-de-base-de-datos)
9. [Cloudflared caído](#9-cloudflared-caído)
10. [Error de Sentry no envía alertas](#10-error-de-sentry-no-envía-alertas)

---

## 1. Base de datos corrupta

**Síntomas:**
- Backend no responde o responde con errores 500
- Logs muestran errores de SQLite: `database disk image is malformed`
- Health check falla con `database: { status: "error" }`

**Diagnóstico:**
```bash
# Verificar estado de la base de datos
docker compose exec backend sqlite3 /app/data/anamneo.db "PRAGMA integrity_check;"

# Verificar logs de errores
docker compose logs --tail 50 backend | grep -i "sqlite\|database\|malformed"
```

**Resolución:**
```bash
# 1. Detener servicios para evitar más corrupción
docker compose down

# 2. Verificar corrupción confirmada
sqlite3 ${ANAMNEO_ROOT}/runtime/data/anamneo.db "PRAGMA integrity_check;"

# 3. Identificar último backup válido
LATEST_BACKUP=$(ls -t ${ANAMNEO_ROOT}/runtime/data/backups/*.db | head -1)
echo "Último backup: $LATEST_BACKUP"

# 4. Verificar integridad del backup
sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"

# 5. Si el backup es válido, restaurar
if [ "$(sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;")" = "ok" ]; then
  cp "$LATEST_BACKUP" ${ANAMNEO_ROOT}/runtime/data/anamneo.db
  echo "Backup restaurado exitosamente"
else
  echo "ERROR: El backup también está corrupto. Buscar backup anterior."
  ls -lt ${ANAMNEO_ROOT}/runtime/data/backups/*.db
fi

# 6. Reiniciar servicios
docker compose up -d

# 7. Verificar recuperación
sleep 10
curl -s http://localhost:5679/api/health | jq .
```

**Prevención:**
- Asegurar que `SQLITE_SYNCHRONOUS=NORMAL` está configurado
- Verificar que los backups automáticos se ejecutan cada 6 horas
- Monitorear tamaño del WAL file

---

## 2. Servicio backend caído

**Síntomas:**
- Health check `/api/health` no responde
- Frontend muestra errores de conexión
- Logs muestran errores de inicio

**Diagnóstico:**
```bash
# Verificar estado del servicio
docker compose ps backend

# Verificar logs
docker compose logs --tail 100 backend

# Verificar puerto
netstat -tlnp | grep 5679
```

**Resolución:**
```bash
# 1. Intentar reiniciar servicio
docker compose restart backend

# 2. Si no funciona, verificar logs de error
docker compose logs --tail 200 backend | grep -i "error\|fatal\|exception"

# 3. Si es error de base de datos, verificar DB
docker compose exec backend sqlite3 /app/data/anamneo.db "PRAGMA integrity_check;"

# 4. Si es error de dependencias, reconstruir
docker compose down
docker compose build backend
docker compose up -d backend

# 5. Verificar recuperación
sleep 15
curl -s http://localhost:5679/api/health | jq .
```

**Escalación:** Si el servicio no se recupera después de 3 intentos, escalar a Nivel 3.

---

## 3. Servicio frontend caído

**Síntomas:**
- Página web no carga
- Error 502/503 en navegador
- Health check de frontend falla

**Diagnóstico:**
```bash
# Verificar estado del servicio
docker compose ps frontend

# Verificar logs
docker compose logs --tail 100 frontend

# Verificar puerto
netstat -tlnp | grep 5556
```

**Resolución:**
```bash
# 1. Intentar reiniciar servicio
docker compose restart frontend

# 2. Si no funciona, verificar logs
docker compose logs --tail 200 frontend | grep -i "error\|fatal"

# 3. Si es error de build, reconstruir
docker compose down
docker compose build frontend
docker compose up -d frontend

# 4. Verificar recuperación
sleep 15
curl -s http://localhost:5556 | head -5
```

---

## 4. Backup fallido

**Síntomas:**
- Logs de backup-cron muestran errores
- No hay backups recientes en `runtime/data/backups/`
- Alerta de webhook (si configurado)

**Diagnóstico:**
```bash
# Verificar últimos backups
ls -lht ${ANAMNEO_ROOT}/runtime/data/backups/*.db | head -5

# Verificar logs de backup
docker compose logs --since 24h backup-cron | grep -i "backup\|error"

# Ejecutar backup manual para diagnosticar
docker compose run --rm --no-deps backend node /app/scripts/pg-backup.js
```

**Resolución:**
```bash
# 1. Ejecutar backup manual
docker compose run --rm --no-deps backend node /app/scripts/pg-backup.js

# 2. Si falla, verificar espacio en disco
df -h ${ANAMNEO_ROOT}/runtime

# 3. Si es espacio insuficiente, limpiar backups expirados
find ${ANAMNEO_ROOT}/runtime/data/backups -name "*.db" -mtime +14 -delete

# 4. Reintentar backup
docker compose run --rm --no-deps backend node /app/scripts/pg-backup.js

# 5. Verificar resultado
ls -lht ${ANAMNEO_ROOT}/runtime/data/backups/*.db | head -3
```

---

## 5. Restore drill fallido

**Síntomas:**
- Logs muestran `sqlite_restore_drill_failed`
- Alerta de webhook (si configurado)

**Diagnóstico:**
```bash
# Verificar logs de restore drill
docker compose logs --since 24h backup-cron | grep -i "restore.*drill\|drill.*fail"

# Ejecutar restore drill manual
docker compose run --rm --no-deps backend node /app/scripts/pg-restore-drill.js
```

**Resolución:**
```bash
# 1. Ejecutar restore drill manual con verbose
docker compose run --rm --no-deps backend node /app/scripts/pg-restore-drill.js 2>&1

# 2. Si falla por integridad, verificar backup
LATEST_BACKUP=$(ls -t ${ANAMNEO_ROOT}/runtime/data/backups/*.db | head -1)
sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"

# 3. Si el backup está corrupto, usar backup anterior
ls -lt ${ANAMNEO_ROOT}/runtime/data/backups/*.db

# 4. Ejecutar restore drill con backup específico
docker compose run --rm --no-deps backend node /app/scripts/pg-restore-drill.js --from=/path/to/backup.db
```

---

## 6. Error de autenticación masivo

**Síntomas:**
- Usuarios no pueden iniciar sesión
- Errores 401/403 en logs
- Cookies no se establecen correctamente

**Diagnóstico:**
```bash
# Verificar logs de autenticación
docker compose logs --since 1h backend | grep -i "auth\|login\|jwt\|cookie"

# Verificar configuración de JWT
docker compose exec backend env | grep JWT

# Verificar estado de sesiones
docker compose exec backend sqlite3 /app/data/anamneo.db "SELECT COUNT(*) FROM user_sessions;"
```

**Resolución:**
```bash
# 1. Verificar que JWT_SECRET no ha cambiado
echo "JWT_SECRET configurado: $(docker compose exec backend env | grep JWT_SECRET)"

# 2. Si JWT_SECRET cambió, los usuarios deben volver a iniciar sesión
# No hay solución automática - comunicar a usuarios

# 3. Si es problema de cookies, verificar configuración
docker compose logs --tail 50 backend | grep -i "cookie\|secure\|samesite"

# 4. Reiniciar servicios si es necesario
docker compose restart backend frontend
```

---

## 7. Espacio en disco insuficiente

**Síntomas:**
- Alertas de disco lleno
- Backups fallan
- Base de datos no puede escribir

**Diagnóstico:**
```bash
# Verificar uso de disco
df -h

# Verificar directorios grandes
du -sh ${ANAMNEO_ROOT}/runtime/*
du -sh ${ANAMNEO_ROOT}/runtime/data/backups/
du -sh ${ANAMNEO_ROOT}/runtime/uploads/
```

**Resolución:**
```bash
# 1. Limpiar backups expirados
find ${ANAMNEO_ROOT}/runtime/data/backups -name "*.db" -mtime +14 -delete
find ${ANAMNEO_ROOT}/runtime/data/backups -name "*.meta.json" -mtime +14 -delete

# 2. Limpiar uploads antiguos (si aplica)
find ${ANAMNEO_ROOT}/runtime/uploads -type f -mtime +30 -delete

# 3. Limpiar logs de Docker
docker compose logs --since 7d > /tmp/anamneo-logs-$(date +%Y%m%d).txt

# 4. Optimizar base de datos
docker compose exec backend sqlite3 /app/data/anamneo.db "VACUUM;"

# 5. Verificar espacio liberado
df -h
```

---

## 8. Error de migración de base de datos

**Síntomas:**
- Deploy falla durante migración
- Error de Prisma: `Migration failed`
- Base de datos en estado inconsistente

**Diagnóstico:**
```bash
# Verificar estado de migraciones
docker compose run --rm --no-deps backend npx prisma migrate status

# Verificar logs de migración
docker compose logs --tail 50 backend | grep -i "migrate\|migration"
```

**Resolución:**
```bash
# 1. Detener servicios
docker compose down

# 2. Restaurar backup pre-migración
LATEST_BACKUP=$(ls -t ${ANAMNEO_ROOT}/runtime/data/backups/*.db | head -1)
cp "$LATEST_BACKUP" ${ANAMNEO_ROOT}/runtime/data/anamneo.db

# 3. Verificar integridad
sqlite3 ${ANAMNEO_ROOT}/runtime/data/anamneo.db "PRAGMA integrity_check;"

# 4. Reiniciar servicios
docker compose up -d

# 5. Verificar estado
curl -s http://localhost:5679/api/health | jq .

# 6. Reintentar migración con precaución
docker compose run --rm --no-deps backend npx prisma migrate deploy
```

---

## 9. Cloudflared caído

**Síntomas:**
- Sitio no accesible desde internet
- Error de conexión en navegador
- Servicios locales funcionan correctamente

**Diagnóstico:**
```bash
# Verificar estado de cloudflared
sudo systemctl status cloudflared

# Verificar logs
sudo journalctl -u cloudflared --since 1h

# Verificar tunnel
cloudflared tunnel info <tunnel-uuid>
```

**Resolución:**
```bash
# 1. Reiniciar cloudflared
sudo systemctl restart cloudflared

# 2. Verificar estado
sudo systemctl status cloudflared

# 3. Si no funciona, verificar configuración
cat /etc/cloudflared/config.yml

# 4. Verificar conectividad
cloudflared tunnel info <tunnel-uuid>

# 5. Si es problema de credenciales, regenerar
cloudflared tunnel login
```

---

## 10. Error de Sentry no envía alertas

**Síntomas:**
- Errores no aparecen en Sentry Dashboard
- No se reciben alertas por webhook
- Logs muestran errores de Sentry

**Diagnóstico:**
```bash
# Verificar configuración de Sentry
docker compose exec backend env | grep SENTRY_DSN
docker compose exec frontend env | grep NEXT_PUBLIC_SENTRY_DSN

# Verificar logs de Sentry
docker compose logs --tail 50 backend | grep -i "sentry"
docker compose logs --tail 50 frontend | grep -i "sentry"
```

**Resolución:**
```bash
# 1. Verificar que DSN está configurado
echo "Backend SENTRY_DSN: $(docker compose exec backend env | grep SENTRY_DSN)"
echo "Frontend NEXT_PUBLIC_SENTRY_DSN: $(docker compose exec frontend env | grep NEXT_PUBLIC_SENTRY_DSN)"

# 2. Si DSN está vacío, configurar en .env
# SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
# NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# 3. Reiniciar servicios
docker compose restart backend frontend

# 4. Probar envío de error
docker compose exec backend node -e "
const Sentry = require('@sentry/node');
Sentry.captureMessage('Test de conectividad Sentry');
console.log('Mensaje de prueba enviado');
"

# 5. Verificar en Sentry Dashboard que el mensaje aparece
```

---

## Plantilla de Reporte de Incidente

```markdown
# Reporte de Incidente

**Fecha:** YYYY-MM-DD HH:MM
**Duración:** X minutos/horas
**Severidad:** Nivel 1/2/3
**Servicio afectado:** Backend/Frontend/Database/Cloudflared

## Descripción
[Descripción breve del incidente]

## Impacto
- [ ] Usuarios no pueden iniciar sesión
- [ ] Datos perdidos/corruptos
- [ ] Servicio completamente caído
- [ ] Servicio degradado
- [ ] Solo afecta a algunos usuarios

## Causa Raíz
[Descripción de la causa identificada]

## Acciones Tomadas
1. [Acción 1]
2. [Acción 2]
3. [Acción 3]

## Lecciones Aprendidas
- [Lección 1]
- [Lección 2]

## Acciones Preventivas
- [Acción 1]
- [Acción 2]
```
