# Anamneo

Anamneo es un sistema de gestion de fichas clinicas para consultas medicas en Chile. Digitaliza el flujo completo de atencion: pacientes, historia clinica, encuentros por secciones, sugerencias diagnosticas, seguimientos, consentimientos, adjuntos y exportacion. La idea es sencilla: depender menos del papel, menos del Excel heredado y bastante menos de la memoria epica de alguien que "se acuerda perfecto".

## Que hace

- Gestiona pacientes con validacion de RUT, historial medico y estados de completitud.
- Orquesta encuentros clinicos por secciones con autoguardado, revision y cierre.
- Mantiene catalogos diagnosticos globales y locales con sugerencias por similitud.
- Permite tareas, consentimientos, alertas clinicas, plantillas de texto y adjuntos.
- Expone auditoria persistente y sesiones por dispositivo con revocacion.
- Soporta despliegue simple con Docker Compose y operacion SQLite con backup automatizado.

## Documentacion

La documentacion activa vive en `docs/` y ya no esta repartida entre intuicion, folklore y arqueologia de markdown.

| Documento | Para que sirve |
|---|---|
| [docs/index.md](docs/index.md) | Mapa general de la documentacion activa |
| [docs/development.md](docs/development.md) | Setup local, comandos diarios y troubleshooting |
| [docs/environment.md](docs/environment.md) | Variables de entorno y defaults reales |
| [docs/testing.md](docs/testing.md) | Estrategia y ejecucion de tests |
| [docs/backend-architecture.md](docs/backend-architecture.md) | Mapa de modulos NestJS y flujo backend |
| [docs/frontend-architecture.md](docs/frontend-architecture.md) | Rutas, proxy y estado del frontend |
| [docs/data-model.md](docs/data-model.md) | Resumen del modelo Prisma |
| [docs/security-and-permissions.md](docs/security-and-permissions.md) | Auth, sesiones, cifrado, auditoria y permisos |
| [docs/sqlite-operations.md](docs/sqlite-operations.md) | Backups, restore drills y monitoreo SQLite |
| [docs/deployment-and-release.md](docs/deployment-and-release.md) | Build, empaquetado y despliegue |
| [docs/clinical-workflows.md](docs/clinical-workflows.md) | Flujos funcionales que cruzan producto y backend |
| [FEATURES.md](FEATURES.md) | Backlog por rol; no confundir con comportamiento garantizado |

## Stack

| Capa | Tecnologia |
|---|---|
| Backend | NestJS 11, Prisma 5, Passport JWT |
| Frontend | Next.js 16 App Router, React 18, Tailwind CSS 3 |
| Estado cliente | Zustand, React Query 5 |
| Seguridad | Helmet, throttling, bcrypt, sanitize-html, cifrado de settings |
| Observabilidad | Sentry y auditoria persistente con diff |
| Infraestructura | Docker Compose, SQLite WAL y backup automatizado |

## Inicio rapido

### Requisitos

- Node.js 20+
- Docker y Docker Compose si quieres levantar el stack en contenedores

### Instalacion local

```bash
git clone <repo-url> && cd Anamneo
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Servicios esperados:

- Frontend en `http://localhost:5555`
- API en `http://localhost:5678/api`

La primera cuenta creada desde `/register` obtiene bootstrap de administrador. Despues de eso el sistema deja de repartir coronas gratis.

### Con Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend npm run prisma:migrate:prod
docker compose exec backend npm run prisma:seed
```

El `docker-compose.yml` de este repo publica backend y frontend en loopback por defecto. Eso tambien es intencional: para uso internet-facing este producto esta pensado para publicarse detras de Cloudflare Tunnel con `cloudflared`, apuntando al frontend local y manteniendo `/api` same-origin.

La guia completa esta en [docs/deployment-and-release.md](docs/deployment-and-release.md).

## Flujo diario de desarrollo

Los comandos que realmente vas a usar estan aqui. El resto existe, pero eso no significa que quieras empezar la manana con ellos.

| Comando | Uso |
|---|---|
| `npm run dev` | Levanta backend y frontend con supervisor |
| `npm run dev:backend` | Backend en watch con `prisma migrate deploy` previo |
| `npm run dev:frontend` | Frontend Next.js en `:5555` |
| `npm run build` | Compila backend y frontend |
| `npm run db:migrate` | Corre migraciones Prisma en desarrollo |
| `npm run db:seed` | Carga datos iniciales |
| `npm run db:reset` | Resetea la base. Si lo corres alegremente, la culpa no sera del README. |
| `npm run db:ops` | Backup + restore drill + monitor + alerta para SQLite |
| `npm run release` | Empaqueta un zip de despliegue. No crea magia, ni changelog, ni rollback. |

Mas detalle en [docs/development.md](docs/development.md), [docs/testing.md](docs/testing.md) y [docs/sqlite-operations.md](docs/sqlite-operations.md).

## Arquitectura en una mirada

```text
Anamneo/
  backend/        API NestJS, Prisma, scripts operativos y tests e2e
  frontend/       Next.js App Router, componentes compartidos, stores y tests
  docs/           Documentacion activa y archivo historico
  scripts/        Supervisor local y empaquetado de release
  shared/         Contratos compartidos entre backend y frontend
```

Si quieres el mapa tecnico de verdad, no el resumen para humanos cansados, ve a:

- [docs/backend-architecture.md](docs/backend-architecture.md)
- [docs/frontend-architecture.md](docs/frontend-architecture.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/security-and-permissions.md](docs/security-and-permissions.md)

## Notas operativas honestas

- El frontend habla con `/api` same-origin y Next.js reescribe al backend. Forzar llamadas directas desde el navegador suele romper cookies y luego aparecen teorias conspirativas sobre la autenticacion.
- En produccion, el despliegue esperado es `Docker Compose + cloudflared`; no exponer `:5678` a internet y no abrir `:5555` directo salvo que realmente sepas por que estas rompiendo el modelo soportado.
- SQLite en produccion esta soportado solo con habilitacion explicita. Funciona, pero exige disciplina operativa; no es un amuleto.
- El script de release empaqueta una entrega reproducible en `releases/`, pero hoy no genera tags ni changelog aunque el optimismo corporativo a veces sugiera lo contrario.
- La rotacion de secretos SMTP esta documentada en [docs/settings-key-rotation-runbook.md](docs/settings-key-rotation-runbook.md).

## Primeros pasos despues de levantar la app

1. Abrir `http://localhost:5555/register`.
2. Crear la primera cuenta.
3. Iniciar sesion.
4. Configurar usuarios, SMTP y catalogos si corresponde.
5. Revisar [docs/index.md](docs/index.md) antes de improvisar procedimientos heroicos.

## Licencia

Privado / uso interno.
