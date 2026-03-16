# Anamneo

Sistema de gestión de fichas clínicas para atención médica.

## Requisitos

- Node.js 20+ y npm (desarrollo local)
- Docker y Docker Compose (opcional)

## Inicio Rápido en Desarrollo

1. **Clonar el repositorio y entrar al directorio:**

   ```bash
   cd pacientes
   ```

2. **Instalar dependencias:**

   ```bash
   npm run install:all
   ```

3. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   # Editar .env y reemplazar JWT_* por valores reales
   # DATABASE_URL ya viene configurado para SQLite (backend/prisma/dev.db)
   ```

4. **Inicializar base de datos (primera vez):**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Iniciar en modo desarrollo:**

   ```bash
   npm run dev
   ```

6. **Acceder a la aplicación:**
   - Frontend: http://localhost:5555
   - API: http://localhost:4444/api

## Inicio Rápido con Docker (Opcional)

1. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   # Editar .env y reemplazar JWT_* por valores reales
   ```

2. **Iniciar los servicios:**

   ```bash
   docker-compose up -d
   ```

3. **Ejecutar migraciones y seed (primera vez):**

   ```bash
   docker-compose exec backend npm run prisma:migrate:prod
   docker-compose exec backend npm run prisma:seed
   ```

4. **Acceder a la aplicación:**
   - Frontend: http://localhost:5555
   - API: http://localhost:4444/api

## Operacion SQLite en Produccion

Cuando se mantiene SQLite en produccion, aplicar esta base operativa:

1. Usar ruta persistente de base de datos (por ejemplo con volumen Docker):

   ```env
   DATABASE_URL=file:./data/prod.db
   ALLOW_SQLITE_IN_PRODUCTION=true
   SQLITE_SYNCHRONOUS=NORMAL
   SQLITE_BUSY_TIMEOUT_MS=5000
   SQLITE_WAL_AUTOCHECKPOINT_PAGES=1000
   SQLITE_BACKUP_DIR=/app/data/backups
   SQLITE_BACKUP_RETENTION_DAYS=14
   SQLITE_BACKUP_MAX_AGE_HOURS=24
   SQLITE_WAL_WARN_SIZE_MB=128
   SQLITE_RESTORE_DRILL_FREQUENCY_DAYS=7
   SQLITE_NOTIFY_POLICY=on-failure
   SQLITE_ALERT_SERVICE_NAME=anamneo-backend
   SQLITE_ALERT_WEBHOOK_URL=https://tu-endpoint-alertas
   ```

2. Ejecutar respaldo consistente de SQLite:

   ```bash
   npm run db:backup
   ```

3. Ejecutar simulacro de restore (sin tocar la DB activa):

   ```bash
   npm run db:restore:drill
   ```

4. Verificar monitoreo operativo (falla con codigo != 0 en modo estricto):

   ```bash
   npm run db:monitor
   ```

5. Endpoints operativos de salud:
   - `GET /api/health` valida conectividad DB para readiness.
   - `GET /api/health/sqlite` expone estado WAL/backup y warnings operativos.

6. Ejecutar runner unificado (backup + restore drill por cadencia + monitor estricto + alerta webhook opcional):

   ```bash
   npm run db:ops
   ```

7. Verificacion rapida (solo monitor estricto con alerta en falla):

   ```bash
   npm run db:ops:monitor
   ```

### Ejemplo de cron (host o job scheduler)

```cron
# Ciclo operacional cada 6 horas (backup + drill segun cadencia + monitor + webhook si aplica)
0 */6 * * * cd /ruta/pacientes && npm run db:ops >> /var/log/anamneo-sqlite-ops.log 2>&1

# Monitor cada 10 minutos para deteccion temprana de degradacion
*/10 * * * * cd /ruta/pacientes && npm run db:ops:monitor >> /var/log/anamneo-sqlite-monitor.log 2>&1
```

## Desarrollo Local

El comando `npm run dev` en la raíz levanta backend y frontend con un supervisor que escucha señales de cierre (`SIGINT`, `SIGTERM`, `SIGHUP`) para detener ambos procesos de forma automática al cerrar la terminal/IDE.

### Backend

```bash
npm --prefix backend install
cp .env.example .env
# Editar .env con tus secretos JWT y CORS reales
# DATABASE_URL debe usar formato file:... (SQLite)
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
npm --prefix backend run start:dev
```

### Frontend

```bash
npm --prefix frontend install
npm run dev:frontend
```

## Primeros Pasos

1. Acceder a http://localhost:5555/register
2. Crear la primera cuenta de médico
3. Iniciar sesión con la cuenta creada
4. Crear asistentes desde la administración una vez inicializado el sistema

## Estructura del Proyecto

```
pacientes/
├── backend/           # API NestJS
│   ├── src/
│   │   ├── auth/      # Autenticación JWT
│   │   ├── patients/  # Gestión de pacientes
│   │   ├── encounters/# Atenciones médicas
│   │   ├── conditions/# Catálogo con TF-IDF
│   │   └── ...
│   └── prisma/        # Schema y migraciones
├── frontend/          # Next.js 14
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/# Componentes React
│       └── lib/       # Utilidades
└── docker-compose.yml
```

## Funcionalidades Principales

- ✅ Gestión de pacientes con validación de RUT
- ✅ Wizard de 10 secciones para atenciones
- ✅ Autoguardado cada 10 segundos
- ✅ Sugerencias de afecciones con TF-IDF
- ✅ Vista de ficha clínica para impresión
- ✅ Control de acceso por roles
- ✅ Auditoría de cambios
- ✅ Seguimientos clínicos accionables por paciente y atención
- ✅ Problemas clínicos persistentes y revisión médico/asistente
- ✅ Órdenes estructuradas para medicamentos, exámenes y derivaciones
- ✅ Adjuntos enlazados a exámenes o derivaciones estructuradas
- ✅ Tendencias clínicas básicas y resumen longitudinal del paciente
- ✅ Bandeja dedicada de seguimientos para pendientes y atrasados
- ✅ Dictado por voz y resumen clínico reutilizable

## Operacion y Release

- Checklist de salida: [RELEASE_CHECKLIST.md](/home/allopze/dev/pacientes/RELEASE_CHECKLIST.md)
- Deploy Prisma + SQLite existente: [PRISMA_SQLITE_DEPLOY.md](/home/allopze/dev/pacientes/PRISMA_SQLITE_DEPLOY.md)
- Roadmap de afinaciones clinicas: [TODO_FUNCIONALIDADES_MEDICAS.md](/home/allopze/dev/pacientes/TODO_FUNCIONALIDADES_MEDICAS.md)

## Licencia

Privado / Uso interno
