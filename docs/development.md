# Desarrollo Local

Esta guia cubre el setup local, los comandos diarios y los tropiezos mas comunes. La meta es que puedas trabajar en el proyecto sin abrir siete terminals, nueve pestañas y una tesis sobre por que algo escucha en `:5555`.

## Requisitos

- Node.js 20+
- npm
- Docker Compose, solo si vas a levantar el stack en contenedores

## Primer Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Que hace cada paso:

- `npm install` instala dependencias del root y, via `postinstall`, tambien las de `backend/` y `frontend/`.
- `cp .env.example .env` parte desde el set compartido del proyecto. Si ejecutas backend o frontend por separado, revisa tambien sus `.env` locales como overlays de desarrollo.
- `npm run db:migrate` ejecuta `prisma migrate dev` en backend.
- `npm run db:seed` carga datos iniciales.
- `npm run dev` arranca backend y frontend con un supervisor bash.

## Comandos de Trabajo Diario

| Comando | Descripcion |
|---|---|
| `npm run dev` | Levanta backend y frontend al mismo tiempo |
| `npm run dev:backend` | Arranca backend en watch, ejecuta `prisma migrate deploy` antes y reinicia usando `dist/backend/src/main.js` |
| `npm run dev:frontend` | Arranca Next.js en `0.0.0.0:5555` con watchdog de parent/session |
| `npm run build` | Compila backend y frontend |
| `npm run db:migrate` | Aplica nuevas migraciones locales |
| `npm run db:seed` | Reinyecta datos iniciales |
| `npm run db:reset` | Resetea la base de datos sin seed |

Nota para backend: como el build emite archivos en `backend/dist/backend/src/*` por los imports compartidos con `shared/`, el watch de desarrollo usa un runner propio para reiniciar el servidor con esa ruta real en vez de depender de `dist/main.js`. Ese runner tambien apaga el backend si desaparece el parent inmediato o la sesion original de terminal.

## Puertos y URLs

| Servicio | URL | Fuente |
|---|---|---|
| Frontend | `http://localhost:5555` | `frontend/package.json` |
| Backend API | `http://localhost:5678/api` | `backend/src/main.ts` + `docker-compose.yml` |
| Proxy browser | `/api/*` | `frontend/next.config.js` |

## Como Funciona `scripts/dev-supervisor.sh`

El comando `npm run dev` usa `scripts/dev-supervisor.sh`. Ese script:

- arranca backend y frontend como procesos hijos,
- propaga `SIGINT`, `SIGTERM` y `SIGHUP`,
- corta ambos procesos si uno cae,
- vigila la sesion original del terminal para no dejar procesos huerfanos al cerrar el IDE o shell,
- y sanitiza algunas variables globales antes de arrancar.

La sanitizacion evita que un entorno global roto contamine el desarrollo local:

- desactiva `DATABASE_URL` si no apunta a SQLite,
- elimina `JWT_SECRET` y `JWT_REFRESH_SECRET` si siguen con placeholders inseguros,
- y deja que cada app cargue sus archivos `.env` esperados.

## Flujo Recomendado

1. Levantar todo con `npm run dev`.
2. Crear o ajustar migraciones solo cuando cambie el modelo Prisma.
3. Ejecutar tests del area tocada antes de cerrar cambios.
4. Si cambias auth, permisos o operaciones SQLite, revisar tambien la documentacion relacionada.

## Guardrails de Codigo

- Ningun archivo fuente mantenido a mano debe superar las 500 lineas.
- El objetivo real es 300 lineas o menos por archivo.
- Si un cambio te empuja por encima de 300, evalua separar helpers, componentes, hooks, DTOs o servicios antes de mergear.
- Si un archivo supera 500 lineas, el trabajo no esta terminado aunque funcione.
- Excepciones solo para artefactos generados, lockfiles o salidas de herramientas; nunca para codigo de aplicacion o tests mantenidos a mano.

## Troubleshooting Basico

### `DATABASE_URL is required` o placeholders invalidos

Revisa el `.env` de raiz. El backend valida que `DATABASE_URL`, `JWT_SECRET` y `JWT_REFRESH_SECRET` existan y no tengan valores de mentira.

### `SQLite in production requires ALLOW_SQLITE_IN_PRODUCTION=true`

Eso es correcto en produccion. En desarrollo no deberia aparecer salvo que `NODE_ENV` y la config apunten a un escenario raro.

### `database is locked`

- confirma que no haya multiples procesos tocando la misma base,
- revisa `SQLITE_BUSY_TIMEOUT_MS`,
- y evita correr scripts destructivos mientras el backend esta escribiendo.

### El frontend levanta, pero la sesion no funciona

- confirma que el backend este en `:5678`,
- no cambies `NEXT_PUBLIC_API_URL` a un origen distinto salvo que entiendas el impacto en cookies,
- y recuerda que el navegador habla con `/api`, no con el backend directo.

### Quiero correr solo frontend o solo backend

Usa `npm run dev:frontend` o `npm run dev:backend`. Si corres solo el frontend, el proxy seguira esperando un backend real en `http://localhost:5678/api`.
