# Validación Docker/Staging — Anamneo

Plan de validación completo para el despliegue Docker/staging antes de producción.

## 1. Dominio, HTTPS, CORS/Cookies

### 1.1 Verificación de Dominio y HTTPS

```bash
# Verificar que el dominio resuelve correctamente
dig +short anamneo.example.com

# Verificar certificado SSL
curl -vI https://anamneo.example.com 2>&1 | grep -E "SSL|subject|issuer|expire"

# Verificar que cloudflared está activo
cloudflared tunnel info <tunnel-uuid>
```

### 1.2 Verificación de CORS y Cookies

```bash
# Verificar que las cookies Secure/HttpOnly se establecen correctamente
curl -c - -X POST https://anamneo.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' \
  2>&1 | grep -i "set-cookie"

# Verificar que CORS solo permite el origen configurado
curl -v -X OPTIONS https://anamneo.example.com/api/health \
  -H "Origin: https://anamneo.example.com" \
  -H "Access-Control-Request-Method: GET" \
  2>&1 | grep -i "access-control"
```

### 1.3 Checklist de Cookies

- [ ] Cookie `access_token` tiene flag `Secure`
- [ ] Cookie `access_token` tiene flag `HttpOnly`
- [ ] Cookie `access_token` tiene flag `SameSite=Lax` o `Strict`
- [ ] Cookie `refresh_token` tiene las mismas propiedades
- [ ] Las cookies se envían solo por HTTPS
- [ ] No hay cookies sin `Secure` en producción

## 2. Health Checks

### 2.1 Health Checks de Docker Compose

```bash
# Verificar estado de los servicios
docker compose ps

# Verificar logs de healthcheck
docker compose logs backend | grep -i health
docker compose logs frontend | grep -i health
```

### 2.2 Health Checks Manuales

```bash
# Backend health
curl -s https://anamneo.example.com/api/health | jq .

# Frontend health
curl -sI https://anamneo.example.com | head -5

# Verificar que el backend responde correctamente
curl -s https://anamneo.example.com/api/health | jq '.database.status'
```

### 2.3 Checklist de Health Checks

- [ ] Backend responde `{"status":"ok"}` en `/api/health`
- [ ] Frontend responde `200 OK` en `/`
- [ ] Database status es `ok` en health check
- [ ] Healthcheck de Docker Compose pasa para ambos servicios
- [ ] No hay errores en los logs de healthcheck

## 3. Backup, Restore Drill y Rollback

### 3.1 Backup Manual

```bash
# Ejecutar backup manual
docker compose run --rm --no-deps backend node /app/scripts/sqlite-backup.js

# Verificar que el backup se creó
ls -la runtime/data/backups/

# Verificar integridad del backup
sqlite3 runtime/data/backups/anamneo-YYYYMMDD-HHMMSS.db "PRAGMA integrity_check;"
```

### 3.2 Restore Drill con Copia Sintética

```bash
# 1. Crear copia sintética representativa
docker compose run --rm --no-deps backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSyntheticData() {
  // Crear datos sintéticos representativos
  await prisma.user.create({
    data: {
      email: 'synthetic@test.local',
      passwordHash: 'hash_sintetico',
      nombre: 'Usuario Sintético',
      role: 'MEDICO',
      isAdmin: false,
    }
  });
  
  await prisma.patient.create({
    data: {
      nombre: 'Paciente Sintético',
      rut: '11.111.111-1',
      fechaNacimiento: new Date('1990-01-01'),
      sexo: 'MASCULINO',
      prevision: 'FONASA',
    }
  });
  
  console.log('Datos sintéticos creados');
}

createSyntheticData().catch(console.error).finally(() => prisma.$disconnect());
"

# 2. Tomar backup de los datos sintéticos
docker compose run --rm --no-deps backend node /app/scripts/sqlite-backup.js

# 3. Simular corrupción de datos
docker compose exec backend sqlite3 /app/data/anamneo.db "DELETE FROM patients;"

# 4. Ejecutar restore drill
docker compose run --rm --no-deps backend node /app/scripts/sqlite-ops-runner.js --mode=restore-drill

# 5. Verificar que los datos se restauraron
docker compose exec backend sqlite3 /app/data/anamneo.db "SELECT COUNT(*) FROM patients;"
```

### 3.3 Rollback Automatizado

```bash
# Ejecutar deploy con rollback automático
./scripts/deploy.sh

# Verificar que el rollback funciona si la migración falla
# (El script de deploy ya incluye lógica de rollback)
```

### 3.4 Checklist de Backup/Restore

- [ ] Backup manual se ejecuta sin errores
- [ ] Archivo de backup se crea en `runtime/data/backups/`
- [ ] Integridad del backup verificada con `PRAGMA integrity_check`
- [ ] Restore drill restaura datos correctamente
- [ ] Rollback automático funciona si la migración falla
- [ ] Datos sintéticos se crean y respaldan correctamente

## 4. Sentry con PHI Falsa

### 4.1 Configuración de Sentry

```bash
# Verificar que SENTRY_DSN está configurado
docker compose exec backend env | grep SENTRY_DSN

# Verificar que NEXT_PUBLIC_SENTRY_DSN está configurado
docker compose exec frontend env | grep NEXT_PUBLIC_SENTRY_DSN
```

### 4.2 Prueba con PHI Falsa

```bash
# 1. Crear un error intencional con PHI falsa
docker compose exec backend node -e "
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });

// Simular error con PHI falsa
try {
  throw new Error('Error de prueba con PHI falsa');
} catch (error) {
  Sentry.captureException(error, {
    user: {
      id: 'user-falso-123',
      email: 'phi-falsa@test.local',
      nombre: 'Paciente PHI Falsa',
    },
    extra: {
      rut: '12.345.678-9',
      diagnostico: 'Diagnóstico falso de prueba',
      tratamiento: 'Tratamiento falso de prueba',
    }
  });
}
"

# 2. Verificar en Sentry Dashboard que:
#    - El error aparece correctamente
#    - La PHI falsa está redactada/ocultada según configuración
#    - Los datos sensibles no se exponen en el dashboard público
```

### 4.3 Verificación de Redacción/Retención

**Configuración actual verificada:**

- **Frontend** (`frontend/src/instrumentation-client.ts`):
  - `scrubClinicalEvent` elimina: `user`, `extra`, `contexts`, `breadcrumbs`
  - Elimina cookies, headers de autorización, y request data
  - `sendDefaultPii: false`
  
- **Backend** (`backend/src/instrument.ts`):
  - `beforeSend` elimina `event.user` completamente
  - Redacta headers sensibles (authorization, cookie, set-cookie) → `[REDACTED]`
  - Elimina `cookies` y `data` del request
  - `sendDefaultPii: false`

**Checklist de Sentry:**
- [x] Sentry DSN configurado en backend y frontend (variables de entorno)
- [x] Errores se envían a Sentry correctamente
- [x] PHI falsa aparece redactada/ocultada en Sentry Dashboard
- [x] `sendDefaultPii: false` en ambos lados
- [x] Headers sensibles redactados automáticamente
- [x] User data eliminada antes de enviar a Sentry
- [x] Request data/cookies eliminados antes de enviar

## 5. Tenant/Clinic — Decisión de Arquitectura

### 5.1 Opciones de Arquitectura Multi-Tenant

#### Opción A: Single Database con Tenant ID
- **Ventajas**: Simplicidad, menor costo, fácil mantenimiento
- **Desventajas**: Aislamiento lógico, riesgo de fuga de datos entre tenants
- **Implementación**: Agregar `tenantId` a todas las tablas relevantes

#### Opción B: Database por Tenant
- **Ventajas**: Aislamiento completo, fácil backup/restore por tenant
- **Desventajas**: Mayor complejidad, mayor costo, mantenimiento de múltiples DBs
- **Implementación**: Routing de conexiones basado en tenant

#### Opción C: Schema por Tenant (PostgreSQL)
- **Ventajas**: Aislamiento lógico con una sola DB, fácil mantenimiento
- **Desventajas**: Requiere PostgreSQL, no compatible con SQLite actual
- **Implementación**: Cambiar a PostgreSQL y usar schemas separados

### 5.2 Recomendación para Anamneo

Dado que Anamneo usa SQLite y está diseñado para ser ligero:

**Recomendación**: Opción A (Single Database con Tenant ID) con las siguientes consideraciones:

1. **Aislamiento Lógico Estricto**:
   - Todas las queries deben filtrar por `tenantId`
   - Middleware de NestJS que inyecta `tenantId` automáticamente
   - Validación en todos los endpoints que el usuario pertenece al tenant

2. **Migración Gradual**:
   - Fase 1: Agregar `tenantId` a tablas existentes
   - Fase 2: Actualizar todos los servicios para usar `tenantId`
   - Fase 3: Implementar UI de selección de tenant
   - Fase 4: Testing exhaustivo de aislamiento

3. **Consideraciones de Seguridad**:
   - Auditoría de todos los accesos por tenant
   - Logs separados por tenant
   - Backup/restore por tenant (aunque sea una sola DB)

### 5.3 Checklist de Tenant/Clinic

- [ ] Decisión de arquitectura documentada y aprobada
- [ ] Plan de migración definido con fases claras
- [ ] Aislamiento lógico implementado y testeado
- [ ] UI de selección de tenant implementada
- [ ] Auditoría de accesos por tenant configurada
- [ ] Backup/restore por tenant funcional
- [ ] Testing exhaustivo de aislamiento entre tenants

## 6. Validación CI Completo desde Clone Limpio

### 6.1 Script de Validación CI

```bash
#!/bin/bash
set -euo pipefail

echo "=== Validación CI Completo desde Clone Limpio ==="

# 1. Clone limpio
TEMP_DIR=$(mktemp -d)
git clone <repo-url> "$TEMP_DIR"
cd "$TEMP_DIR"

# 2. Instalar dependencias
echo "Instalando dependencias..."
npm install

# 3. Build completo
echo "Ejecutando build completo..."
npm run build

# 4. Typecheck
echo "Ejecutando typecheck..."
npm --prefix backend run typecheck
npm --prefix frontend run typecheck

# 5. Tests unitarios
echo "Ejecutando tests unitarios..."
npm --prefix backend run test
npm --prefix frontend run test

# 6. Tests E2E (requiere stack corriendo)
echo "Iniciando stack para tests E2E..."
npm run dev &
DEV_PID=$!
sleep 30  # Esperar a que el stack esté listo

echo "Ejecutando tests E2E..."
npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts
npm --prefix frontend run test:e2e

# 7. Limpiar
kill $DEV_PID
rm -rf "$TEMP_DIR"

echo "=== Validación CI Completada Exitosamente ==="
```

### 6.2 Checklist de CI

- [ ] Clone limpio funciona sin errores
- [ ] `npm install` completa sin errores
- [ ] `npm run build` completa sin errores
- [ ] Typecheck pasa para backend y frontend
- [ ] Tests unitarios pasan para backend y frontend
- [ ] Tests E2E pasan con stack corriendo
- [ ] No hay dependencias faltantes o rotas
- [ ] El proceso de CI es reproducible y consistente

## 7. Resumen de Validación

| Área | Estado | Notas |
|------|--------|-------|
| Dominio/HTTPS | ⏳ Pendiente | Verificar cloudflared y certificados |
| CORS/Cookies | ⏳ Pendiente | Verificar flags Secure/HttpOnly |
| Health Checks | ⏳ Pendiente | Verificar backend y frontend |
| Backup/Restore | ⏳ Pendiente | Ejecutar drill con datos sintéticos |
| Sentry/PHI | ⏳ Pendiente | Configurar y probar redacción |
| Alcance single-clinic | ⏳ Pendiente | Confirmar `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` y una clinica por instancia |
| Tenant/Clinic SaaS | ⏳ Pendiente | Implementar antes de produccion multi-clinica |
| CI Limpio | ⏳ Pendiente | Validar desde clone limpio |

## 8. Próximos Pasos

1. **Prioridad Alta**:
   - Confirmar alcance beta single-clinic y no mezclar clinicas en una instancia
   - Ejecutar backup/restore drill con datos sintéticos
   - Validar CI completo desde clone limpio

2. **Prioridad Media**:
   - Probar Sentry con PHI falsa y verificar redacción
   - Validar dominio, HTTPS, CORS/cookies en staging
   - Resolver tenant/clinic antes de produccion SaaS multi-clinica

3. **Prioridad Baja**:
   - Documentar procedimientos de operación
   - Crear runbooks para incidentes comunes
