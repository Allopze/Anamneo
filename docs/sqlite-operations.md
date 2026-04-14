# Operacion SQLite

SQLite esta soportado en este proyecto, incluso en produccion, pero no como excusa para operar sin disciplina. Esta guia documenta la parte que evita convertir la base en una anecdota triste.

## Componentes Operativos

| Componente | Fuente | Funcion |
|---|---|---|
| Backup manual | `npm run db:backup` | Ejecuta `backend/scripts/sqlite-backup.js` |
| Restore drill | `npm run db:restore:drill` | Ejecuta simulacro sin tocar la base activa |
| Monitor | `npm run db:monitor` | Chequea WAL, integridad y condiciones de advertencia |
| Runner completo | `npm run db:ops` | Backup + restore drill + monitor + alerta |
| Monitor rapido | `npm run db:ops:monitor` | Solo validacion operativa con notificacion |
| Docker cron | servicio `backup-cron` | Ejecuta backup automatico cada `BACKUP_CRON_SCHEDULE` |

## Variables Que Gobiernan la Operacion

| Variable | Default | Efecto |
|---|---|---|
| `ALLOW_SQLITE_IN_PRODUCTION` | `false` | Habilita SQLite en prod |
| `SQLITE_BACKUP_DIR` | `/app/data/backups` en Docker | Carpeta de backups |
| `SQLITE_BACKUP_RETENTION_DAYS` | `14` | Retencion |
| `SQLITE_BACKUP_MAX_AGE_HOURS` | `24` | Antiguedad maxima tolerada |
| `SQLITE_RESTORE_DRILL_FREQUENCY_DAYS` | `7` | Frecuencia esperada del drill |
| `SQLITE_WAL_WARN_SIZE_MB` | `128` | Alerta por crecimiento WAL |
| `SQLITE_NOTIFY_POLICY` | `on-failure` | Politica de alertas |
| `SQLITE_ALERT_WEBHOOK_URL` | vacio | Webhook de salida |

## Operacion Recomendada

### En desarrollo

- usa `npm run db:backup` antes de operaciones destructivas,
- usa `npm run db:reset` solo si realmente quieres perder el estado local,
- y evita compartir la misma base entre varios procesos o terminales creativos.

### En produccion

1. Habilitar SQLite explicitamente.
2. Mantener backup automatico cada 6 horas o mejor.
3. Mantener restore drill al menos semanal.
4. Configurar `SQLITE_ALERT_WEBHOOK_URL`.
5. Revisar health checks y crecimiento del WAL.
6. Si usas Docker Compose, asegúrate de que `backup-cron` monte `./runtime/uploads` en modo lectura y use `UPLOAD_DEST=/app/uploads`; si no, puedes terminar con backups válidos de la base pero sin adjuntos reales.

## Comandos Operativos

```bash
npm run db:backup
npm run db:restore:drill
npm run db:monitor
npm run db:ops
npm run db:ops:monitor
```

## Endpoints de Salud

| Endpoint | Uso |
|---|---|
| `GET /api/health` | Readiness general |
| `GET /api/health/sqlite` | Estado WAL, backup y advertencias operativas |

`/api/health/sqlite` requiere sesion administrativa.

## Cron Recomendado Fuera de Docker

```cron
0 */6 * * * cd /ruta/Anamneo && npm run db:ops >> /var/log/anamneo-sqlite-ops.log 2>&1
*/10 * * * * cd /ruta/Anamneo && npm run db:ops:monitor >> /var/log/anamneo-sqlite-monitor.log 2>&1
```

## Restore Drill

El restore drill existe para verificar que un backup sirve para algo mas que tranquilizar a la conciencia.

Checklist minimo:

1. Confirmar backup reciente.
2. Ejecutar `npm run db:restore:drill`.
3. Revisar salida y artefactos generados.
4. Registrar fecha del ultimo simulacro.
5. Corregir alertas pendientes antes del siguiente ciclo.

## Problemas Frecuentes

### WAL creciendo demasiado

- revisa carga de escritura,
- valida `SQLITE_WAL_AUTOCHECKPOINT_PAGES`,
- y corre el monitor para confirmar que no hay degradacion silenciosa.

### Backups viejos o inexistentes

- confirma `SQLITE_BACKUP_DIR`,
- confirma permisos de escritura,
- verifica el contenedor `backup-cron` o el cron del host,
- confirma que `backup-cron` vea el mismo volumen de uploads que usa `backend`,
- y configura el webhook de alertas si aun no existe.

### Base bloqueada

- revisa procesos concurrentes,
- confirma timeout y journaling,
- y evita scripts de mantenimiento mientras hay trafico normal.

## Relacion Con Otros Documentos

- Configuracion general: `environment.md`
- Despliegue: `deployment-and-release.md`
- Rotacion de claves de settings: `settings-key-rotation-runbook.md`