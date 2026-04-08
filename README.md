# Anamneo

**Sistema de gestion de fichas clinicas** para consultas medicas en Chile.
Anamneo digitaliza el flujo completo de la atencion: registro de pacientes, historia clinica estructurada, atenciones por secciones con autoguardado, sugerencias diagnosticas por NLP, ordenes clinicas, adjuntos, seguimientos y exportacion a PDF -- todo bajo un modelo de roles y auditoria completa.

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| **Backend** | NestJS 11, Prisma 5 (SQLite / PostgreSQL), Passport JWT |
| **Frontend** | Next.js 16 (App Router), React 18, Tailwind CSS 3, Zustand, React Query 5 |
| **Seguridad** | Helmet, Throttler (3 capas), CORS allowlist, bcrypt, sanitize-html, cifrado de settings |
| **Observabilidad** | Sentry (backend + frontend), auditoria persistente con diff |
| **Infraestructura** | Docker Compose (backend + frontend + backup cron), SQLite WAL con backup automatizado |

---

## Funcionalidades

**Pacientes** -- Registro con validacion de RUT chileno, soft-delete, historial medico completo (antecedentes, alergias, medicamentos, habitos), problemas clinicos activos/resueltos.

**Atenciones** -- Wizard de secciones con autoguardado cada 10 segundos. Flujo de estados (en progreso, revision, completada). Soporte para borradores y reanudacion.

**Diagnostico asistido** -- Catalogo de afecciones con sugerencias por TF-IDF (NLP). Catalogos globales (admin) y locales (por medico). Importacion CSV masiva.

**Ordenes clinicas** -- Ordenes estructuradas para medicamentos, examenes y derivaciones. Adjuntos enlazados a ordenes.

**Seguimientos** -- Tareas clinicas con tipo, prioridad, fecha limite y estado. Bandeja dedicada de pendientes y atrasados.

**Plantillas de texto** -- Templates reutilizables por medico, categorizados por seccion, para acelerar la documentacion.

**Exportacion** -- Ficha clinica exportable a PDF. Resumen longitudinal del paciente con tendencias vitales y diagnosticos recientes.

**Dictado por voz** -- Entrada de texto por voz con resumen clinico reutilizable.

**Roles y permisos** -- Tres roles: Medico, Asistente y Admin. Permisos diferenciados por accion (asistente edita datos administrativos, medico edita contenido clinico).

**Invitaciones** -- Sistema de invitacion por enlace o correo SMTP con tokens con expiracion, aceptacion y revocacion.

**Auditoria** -- Registro completo de cambios por entidad, usuario, accion y diff. Filtrable y con redaccion clinica configurable.

**Seguridad de sesion** -- JWT access (15 min) + refresh (7 dias) en cookies httpOnly. Sesiones por dispositivo con revocacion individual. Bloqueo por intentos fallidos (5 intentos, 15 min).

---

## Inicio Rapido

### Requisitos

- Node.js 20+
- Docker y Docker Compose (opcional, para despliegue)

### Instalacion

```bash
git clone <repo-url> && cd Anamneo
npm install                    # instala root, backend y frontend automaticamente
cp .env.example .env           # editar JWT_SECRET, JWT_REFRESH_SECRET y CORS_ORIGIN
npm run db:migrate             # aplica migraciones Prisma
npm run db:seed                # carga datos iniciales
npm run dev                    # levanta backend (5678) y frontend (5555)
```

Abrir http://localhost:5555 y registrar la primera cuenta de administrador.

### Con Docker

```bash
cp .env.example .env           # configurar secretos JWT, CORS_ORIGIN y DATABASE_URL
docker-compose up -d
docker-compose exec backend npm run prisma:migrate:prod
docker-compose exec backend npm run prisma:seed
```

La aplicacion queda disponible en http://localhost:5555 con la API en http://localhost:5678/api.

---

## Estructura del Proyecto

```
Anamneo/
  backend/                  API NestJS
    src/
      auth/                 Autenticacion JWT + sesiones + invitaciones
      patients/             Gestion de pacientes e historial
      encounters/           Atenciones por secciones
      conditions/           Catalogo de afecciones (TF-IDF)
      attachments/          Adjuntos y archivos
      templates/            Plantillas de texto
      audit/                Auditoria central
      settings/             Configuracion cifrada (SMTP, etc.)
      mail/                 Envio de correos
      users/                Gestion de usuarios y roles
    prisma/                 Schema, migraciones y seed
    scripts/                Backup, restore, monitoreo SQLite

  frontend/                 Next.js 16 (App Router)
    src/
      app/                  Rutas: login, pacientes, atenciones, catalogo,
                            plantillas, seguimientos, admin, ajustes
      components/           Componentes React compartidos
      lib/                  API client (Axios), utilidades, permisos
      stores/               Estado global (Zustand)

  scripts/                  Dev supervisor, release
  docs/                     Runbooks operativos
  shared/                   Contrato de permisos compartido
  docker-compose.yml        Backend + Frontend + Backup cron
```

---

## Scripts Disponibles

Todos los scripts se ejecutan desde la raiz del proyecto.

| Comando | Descripcion |
|---|---|
| `npm run dev` | Levanta backend y frontend con supervisor de procesos |
| `npm run build` | Compila backend y frontend para produccion |
| `npm run db:migrate` | Aplica migraciones Prisma |
| `npm run db:seed` | Carga datos iniciales |
| `npm run db:reset` | Reinicia la base de datos (destructivo) |
| `npm run db:backup` | Respaldo SQLite + directorio de adjuntos |
| `npm run db:restore:drill` | Simulacro de restore sin afectar la DB activa |
| `npm run db:monitor` | Monitoreo operativo (WAL, integridad, advertencias) |
| `npm run db:ops` | Ciclo completo: backup + drill + monitor + alerta |
| `npm run db:ops:monitor` | Verificacion rapida con alerta en caso de falla |
| `npm run docker:up` | Inicia contenedores en segundo plano |
| `npm run docker:down` | Detiene contenedores |
| `npm run release` | Flujo de release con tag y changelog |

---

## Operacion SQLite en Produccion

SQLite se soporta en produccion con `ALLOW_SQLITE_IN_PRODUCTION=true`. La configuracion operativa incluye:

```env
DATABASE_URL=file:./data/prod.db
ALLOW_SQLITE_IN_PRODUCTION=true
SQLITE_SYNCHRONOUS=NORMAL
SQLITE_BUSY_TIMEOUT_MS=5000
SQLITE_WAL_AUTOCHECKPOINT_PAGES=1000
SQLITE_BACKUP_DIR=/app/data/backups
SQLITE_BACKUP_RETENTION_DAYS=14
SQLITE_BACKUP_MAX_AGE_HOURS=24
SQLITE_RESTORE_DRILL_FREQUENCY_DAYS=7
SQLITE_NOTIFY_POLICY=on-failure
SQLITE_ALERT_WEBHOOK_URL=https://tu-endpoint-alertas
```

**Endpoints de salud:**

- `GET /api/health` -- readiness check con validacion de conectividad DB.
- `GET /api/health/sqlite` -- estado WAL, backup y advertencias operativas (requiere sesion admin).

**Cron recomendado:**

```cron
# Ciclo operacional cada 6 horas
0 */6 * * * cd /ruta/Anamneo && npm run db:ops >> /var/log/anamneo-sqlite-ops.log 2>&1

# Monitor cada 10 minutos
*/10 * * * * cd /ruta/Anamneo && npm run db:ops:monitor >> /var/log/anamneo-sqlite-monitor.log 2>&1
```

---

## Configuracion de Correo

Las invitaciones se envian por SMTP cuando esta configurado. Dos formas de configurarlo:

1. **Desde la UI**: Ajustes > Correo SMTP (requiere `SETTINGS_ENCRYPTION_KEY` para cifrar credenciales en BD).
2. **Desde `.env`**: Variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`.

Si SMTP no esta disponible, el sistema genera enlaces de invitacion manuales como respaldo.

La rotacion de claves de cifrado esta documentada en [docs/settings-key-rotation-runbook.md](docs/settings-key-rotation-runbook.md).

---

## API Clinica

| Endpoint | Descripcion |
|---|---|
| `GET /api/patients/:id/encounters?page&limit` | Timeline paginada de atenciones |
| `GET /api/patients/:id/clinical-summary` | Resumen longitudinal: tendencias vitales, diagnosticos recientes, problemas y tareas |
| `GET /api/health` | Health check para readiness |
| `GET /api/health/sqlite` | Estado operativo SQLite (admin) |

El frontend consume la API via same-origin `/api`, reescrita por Next.js hacia `http://localhost:5678/api`.

---

## Variables de Entorno

| Variable | Requerida | Descripcion |
|---|---|---|
| `DATABASE_URL` | Si | Ruta SQLite (`file:./dev.db`) o connection string PostgreSQL |
| `JWT_SECRET` | Si | Secreto para access tokens (min 32 caracteres en produccion) |
| `JWT_REFRESH_SECRET` | Si | Secreto para refresh tokens (debe diferir de JWT_SECRET) |
| `CORS_ORIGIN` | Si | Origenes permitidos para CORS |
| `SETTINGS_ENCRYPTION_KEY` | Prod | Clave para cifrar settings en BD |
| `SENTRY_DSN` | No | DSN de Sentry para el backend |
| `NEXT_PUBLIC_SENTRY_DSN` | No | DSN de Sentry para el frontend |
| `SMTP_HOST` | No | Servidor SMTP para invitaciones por correo |
| `APP_PUBLIC_URL` | No | URL publica para enlaces en correos |

Copiar `.env.example` para ver la lista completa con valores por defecto.

---

## Primeros Pasos tras Instalar

1. Abrir http://localhost:5555/register
2. Crear la primera cuenta (se asigna rol administrador automaticamente)
3. Iniciar sesion
4. Desde administracion, invitar medicos o asistentes

---

## Documentacion Adicional

- [FEATURES.md](FEATURES.md) -- Backlog de funcionalidades por rol
- [docs/settings-key-rotation-runbook.md](docs/settings-key-rotation-runbook.md) -- Rotacion de claves de cifrado
- [docs/ui-refactor-plan-anamneo.md](docs/ui-refactor-plan-anamneo.md) -- Plan de refactor de UI
- [docs/design-tokens-anamneo.md](docs/design-tokens-anamneo.md) -- Tokens de diseno

---

## Licencia

Privado / Uso interno
