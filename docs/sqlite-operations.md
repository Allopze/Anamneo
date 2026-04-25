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
| Docker cron | servicio `backup-cron` | Ejecuta `sqlite-ops-runner.js --mode=all` (backup + restore drill periódico + monitor + alertas) y purga de adjuntos eliminados |

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

## Configurar alertas con Discord / Slack

`SQLITE_ALERT_WEBHOOK_URL` debe apuntar a un webhook HTTP que reciba JSON. El runner operativo de SQLite envía una alerta cuando falla el backup, cuando el restore drill no pasa o cuando el monitor detecta condiciones críticas.

- Para Discord: crea un webhook en el canal deseado y copia la URL de `https://discord.com/api/webhooks/...`.
- Para Slack: crea un Incoming Webhook en la app de Slack y copia la URL de `https://hooks.slack.com/services/...`.
- Opcional: usa un transformador de webhook (Pipedream, n8n, Huginn o similar) si quieres enriquecer el mensaje o reenviarlo a otros destinos.

El runner ahora incluye tanto `content` como `text` en la carga útil, de modo que los webhooks Discord y Slack pueden recibir una notificación legible. El cuerpo JSON contiene también el resumen completo del evento, el modo ejecutado y el estado de cada tarea.

### Ejemplo de configuración

```bash
SQLITE_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/XXXX/YYYY
SQLITE_NOTIFY_POLICY=on-failure
SQLITE_ALERT_SERVICE_NAME=anamneo-backend
```

### Recomendaciones

- Mantén `SQLITE_NOTIFY_POLICY=on-failure` para recibir alertas solo cuando algo falla.
- Si quieres monitoreo continuo, usa `SQLITE_NOTIFY_POLICY=always` y revisa los mensajes periódicos.
- Comprueba que `backup-cron` tenga acceso al mismo volumen de `SQLITE_BACKUP_DIR` y `UPLOAD_DEST` que el backend.
- Verifica el webhook con `npm run db:ops` y busca en la salida JSON el campo `alert.sent: true`.

## Operacion Recomendada

### En desarrollo

- usa `npm run db:backup` antes de operaciones destructivas,
- usa `npm run db:reset` solo si realmente quieres perder el estado local,
- y evita compartir la misma base entre varios procesos o terminales creativos.

### En produccion

1. Habilitar SQLite explicitamente.
2. Mantener backup automatico cada 6 horas o mejor.
3. El restore drill se ejecuta automáticamente dentro de `backup-cron` según `SQLITE_RESTORE_DRILL_FREQUENCY_DAYS` (default: 7 días).
4. Configurar `SQLITE_ALERT_WEBHOOK_URL`.
5. Revisar health checks y crecimiento del WAL.
6. Si usas Docker Compose, asegúrate de que `backup-cron` monte `./runtime/uploads` en modo lectura y use `UPLOAD_DEST=/app/uploads`; si no, puedes terminar con backups válidos de la base pero sin adjuntos reales.
7. Usar `npm run deploy` (o `scripts/deploy.sh`) para despliegues con backup pre-migración reutilizando `sqlite-backup.js`, restore drill y rollback automático.

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

La pestaña `Ajustes > Sistema` resume estos checks para administracion dentro de la app. Usala como tablero rapido de backup, restore drill y checklist; este documento sigue siendo el runbook completo.

## Cron Recomendado Fuera de Docker

```cron
0 */6 * * * cd /ruta/Anamneo && npm run db:ops >> /var/log/anamneo-sqlite-ops.log 2>&1
*/10 * * * * cd /ruta/Anamneo && npm run db:ops:monitor >> /var/log/anamneo-sqlite-monitor.log 2>&1
```

## Restore Drill

El restore drill existe para verificar que un backup sirve para algo mas que tranquilizar a la conciencia.

Punto importante para esta app:

- el backup incluye snapshot de `uploads`,
- el restore drill valida tambien que los adjuntos restaurados existan en el snapshot copiado,
- y si ejecutas validaciones manuales conviene correr `npm run db:backup` y despues `npm run db:restore:drill` en secuencia, no en paralelo.

Checklist minimo:

1. Confirmar backup reciente.
2. Revisar `Ajustes > Sistema` para detectar alertas operativas pendientes.
3. Ejecutar `npm run db:restore:drill`.
4. Revisar salida y artefactos generados.
5. Registrar fecha del ultimo simulacro.
6. Corregir alertas pendientes antes del siguiente ciclo.

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
