# Procedimientos de Operación — Anamneo

Este documento cubre los procedimientos operativos diarios, semanales y de emergencia para mantener Anamneo en producción.

## 1. Procedimientos Diarios

### 1.1 Verificación de Salud del Sistema

**Frecuencia:** Cada mañana (o automatizado)

```bash
# Verificar estado de servicios
docker compose ps

# Verificar health checks
curl -s http://localhost:5679/api/health | jq .
curl -s http://localhost:5556 | head -5

# Verificar logs de errores recientes
docker compose logs --since 24h backend | grep -i "error\|fatal\|exception" | tail -20
docker compose logs --since 24h frontend | grep -i "error\|fatal" | tail -20

# Verificar espacio en disco
df -h /home/allopze/dev/Anamneo/runtime
du -sh /home/allopze/dev/Anamneo/runtime/data/backups/
```

**Checklist:**
- [ ] Backend responde `{"status":"ok"}`
- [ ] Frontend responde `200 OK`
- [ ] No hay errores críticos en logs
- [ ] Espacio en disco > 20% libre
- [ ] Backups automáticos ejecutados (ver logs de backup-cron)

### 1.2 Verificación de Backups

**Frecuencia:** Cada 6 horas (automatizado por backup-cron)

```bash
# Verificar últimos backups
ls -lht /home/allopze/dev/Anamneo/runtime/data/backups/*.db | head -5

# Verificar integridad del último backup
LATEST_BACKUP=$(ls -t /home/allopze/dev/Anamneo/runtime/data/backups/*.db | head -1)
sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"

# Verificar metadata del backup
cat "${LATEST_BACKUP}.meta.json" | jq .
```

**Checklist:**
- [ ] Último backup tiene < 6 horas de antigüedad
- [ ] Integridad del backup: `ok`
- [ ] Tamaño del backup es razonable (> 1MB, < 10GB)
- [ ] Metadata contiene checksum SHA256 válido

### 1.3 Monitoreo de Alertas

**Frecuencia:** Continuo (automatizado)

```bash
# Verificar alertas recientes
docker compose logs --since 1h backup-cron | grep -i "alert\|warning\|error"

# Verificar estado de Sentry (si configurado)
# Acceder a https://sentry.io/organizations/<org>/projects/<project>/
```

## 2. Procedimientos Semanales

### 2.1 Restore Drill Automatizado

**Frecuencia:** Semanal (automatizado por sqlite-ops-runner)

```bash
# Ejecutar restore drill manual
cd /home/allopze/dev/Anamneo
docker compose run --rm --no-deps backend node /app/scripts/sqlite-restore-drill.js

# Verificar resultados
docker compose logs --since 1h backup-cron | grep "restore_drill"
```

**Checklist:**
- [ ] Restore drill ejecutado exitosamente
- [ ] Integridad verificada en base de datos restaurada
- [ ] Adjuntos restaurados correctamente (si aplica)
- [ ] Duración del drill < 5 minutos

### 2.2 Limpieza de Backups Expirados

**Frecuencia:** Automático (cada 6 horas)

```bash
# Verificar backups expirados
ls -lht /home/allopze/dev/Anamneo/runtime/data/backups/*.db | wc -l

# Verificar retención configurada
echo "Retención: ${SQLITE_BACKUP_RETENTION_DAYS:-14} días"

# Limpieza manual si es necesario
docker compose run --rm --no-deps backend node /app/scripts/sqlite-backup.js
```

### 2.3 Revisión de Logs de Seguridad

**Frecuencia:** Semanal

```bash
# Verificar intentos de login fallidos
docker compose logs --since 7d backend | grep -i "login.*fail\|auth.*fail" | tail -20

# Verificar accesos no autorizados
docker compose logs --since 7d backend | grep -i "403\|401" | tail -20

# Verificar cambios de configuración
docker compose logs --since 7d backend | grep -i "settings.*change\|config.*update" | tail -20
```

## 3. Procedimientos Mensuales

### 3.1 Actualización de Dependencias

```bash
# Verificar actualizaciones disponibles
cd /home/allopze/dev/Anamneo/backend
npm outdated

cd /home/allopze/dev/Anamneo/frontend
npm outdated

# Actualizar dependencias (en entorno de desarrollo primero)
cd /home/allopze/dev/Anamneo/backend
npm update

cd /home/allopze/dev/Anamneo/frontend
npm update

# Ejecutar tests después de actualizar
npm --prefix backend test
npm --prefix frontend test
```

### 3.2 Revisión de Certificados SSL

```bash
# Verificar expiración de certificado
echo | openssl s_client -servername anamneo.example.com -connect anamneo.example.com:443 2>/dev/null | openssl x509 -noout -dates

# Verificar configuración de cloudflared
cloudflared tunnel info <tunnel-uuid>
```

### 3.3 Auditoría de Accesos

```bash
# Exportar logs de auditoría
docker compose exec backend sqlite3 /app/data/anamneo.db \
  "SELECT * FROM audit_logs WHERE created_at > datetime('now', '-30 days') ORDER BY created_at DESC;"

# Revisar usuarios activos
docker compose exec backend sqlite3 /app/data/anamneo.db \
  "SELECT id, email, role, last_login FROM users ORDER BY last_login DESC;"
```

## 4. Procedimientos de Emergencia

### 4.1 Rollback de Deploy Fallido

```bash
# 1. Detener servicios actuales
docker compose down

# 2. Restaurar backup pre-migración
LATEST_BACKUP=$(ls -t /home/allopze/dev/Anamneo/runtime/data/backups/*.db | head -1)
cp "$LATEST_BACKUP" /home/allopze/dev/Anamneo/runtime/data/anamneo.db

# 3. Verificar integridad
sqlite3 /home/allopze/dev/Anamneo/runtime/data/anamneo.db "PRAGMA integrity_check;"

# 4. Reiniciar servicios
docker compose up -d

# 5. Verificar salud
curl -s http://localhost:5679/api/health | jq .
```

### 4.2 Recuperación de Base de Datos Corrupta

```bash
# 1. Detener servicios
docker compose down

# 2. Verificar corrupción
sqlite3 /home/allopze/dev/Anamneo/runtime/data/anamneo.db "PRAGMA integrity_check;"

# 3. Si está corrupta, restaurar desde backup
LATEST_BACKUP=$(ls -t /home/allopze/dev/Anamneo/runtime/data/backups/*.db | head -1)
echo "Restaurando desde: $LATEST_BACKUP"
cp "$LATEST_BACKUP" /home/allopze/dev/Anamneo/runtime/data/anamneo.db

# 4. Verificar restauración
sqlite3 /home/allopze/dev/Anamneo/runtime/data/anamneo.db "PRAGMA integrity_check;"

# 5. Reiniciar servicios
docker compose up -d
```

### 4.3 Recuperación de Servicio Caído

```bash
# 1. Verificar estado de servicios
docker compose ps

# 2. Verificar logs de errores
docker compose logs --tail 100 backend
docker compose logs --tail 100 frontend

# 3. Reiniciar servicio específico
docker compose restart backend
docker compose restart frontend

# 4. Si no funciona, reconstruir
docker compose down
docker compose build
docker compose up -d

# 5. Verificar salud
curl -s http://localhost:5679/api/health | jq .
curl -s http://localhost:5556 | head -5
```

### 4.4 Escalación de Incidentes

**Nivel 1 - Problema menor:**
- Servicio lento pero funcional
- Error no crítico en logs
- **Acción:** Monitorear y registrar

**Nivel 2 - Problema moderado:**
- Servicio parcialmente caído
- Error que afecta funcionalidad
- **Acción:** Reiniciar servicio, verificar logs

**Nivel 3 - Problema crítico:**
- Servicio completamente caído
- Pérdida de datos
- **Acción:** Rollback inmediato, notificar equipo

## 5. Procedimientos de Mantenimiento

### 5.1 Limpieza de Logs

```bash
# Limpiar logs de Docker (mantener últimos 7 días)
docker compose logs --since 7d > /tmp/anamneo-logs-$(date +%Y%m%d).txt

# Limpiar logs antiguos
find /home/allopze/dev/Anamneo/runtime -name "*.log" -mtime +7 -delete
```

### 5.2 Optimización de Base de Datos

```bash
# Ejecutar VACUUM para optimizar
docker compose exec backend sqlite3 /app/data/anamneo.db "VACUUM;"

# Verificar tamaño después de optimización
ls -lh /home/allopze/dev/Anamneo/runtime/data/anamneo.db
```

### 5.3 Actualización de Cloudflared

```bash
# Verificar versión actual
cloudflared --version

# Actualizar cloudflared
sudo apt update && sudo apt upgrade cloudflared

# Reiniciar tunnel
sudo systemctl restart cloudflared
```

## 6. Checklist de Operaciones

### 6.1 Checklist Diario
- [ ] Verificar salud de servicios
- [ ] Verificar backups automáticos
- [ ] Revisar logs de errores
- [ ] Verificar espacio en disco
- [ ] Monitorear alertas de Sentry

### 6.2 Checklist Semanal
- [ ] Ejecutar restore drill
- [ ] Revisión de logs de seguridad
- [ ] Verificar retención de backups
- [ ] Revisar métricas de rendimiento

### 6.3 Checklist Mensual
- [ ] Actualizar dependencias
- [ ] Revisar certificados SSL
- [ ] Auditoría de accesos
- [ ] Optimización de base de datos
- [ ] Revisión de procedimientos

## 7. Contactos de Emergencia

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Administrador de Sistema | Alejandro López | allopze@gmail.com |
| Desarrollador Backend | [Nombre] | [Email] |
| Desarrollador Frontend | [Nombre] | [Email] |
| Soporte Cloudflare | [Contacto] | [Email] |

## 8. Referencias

- [Documentación de Despliegue](./deployment-and-release.md)
- [Validación Docker/Staging](./docker-staging-validation.md)
- [Decisiones de Arquitectura](./architecture-decisions/)
- [Documentación de Entornos](./environment.md)
