# Arquitectura Frontend

El frontend usa Next.js 16 con App Router. La app publica es pequena; la parte privada vive dentro del grupo `(dashboard)`, que es donde realmente pasa el negocio.

## Estructura Principal

| Ruta o capa | Funcion |
|---|---|
| `src/app/layout.tsx` | Root layout con metadata, fuente y providers |
| `src/app/(dashboard)/layout.tsx` | Shell privado basado en `DashboardLayout` |
| `src/app/page.tsx` | Ruta raiz; no hereda automaticamente el layout privado |
| `src/app/login/` | Login |
| `src/app/register/` | Registro bootstrap |
| `src/app/cambiar-contrasena/` | Cambio de password |
| `src/components/` | Componentes compartidos |
| `src/lib/` | API client, permisos, helpers y proxy/session logic |
| `src/stores/` | Estado cliente con Zustand |

## Providers y Layouts

El `RootLayout`:

- aplica la fuente Inter,
- carga `globals.css`,
- y envuelve la app con `Providers`.

El layout privado se monta en `src/app/(dashboard)/layout.tsx` usando `DashboardLayout`.

Importante:

- `src/app/page.tsx` no hereda automaticamente ese layout.
- Si la home raiz debe verse como dashboard, hay que envolverla de forma explicita.
- Este detalle ya ha sido una fuente real de confusion, asi que mejor dejarlo escrito que volver a aprenderlo de mala gana.

## Proxy y Sesion

La app usa same-origin `/api` en el navegador. `frontend/next.config.js` reescribe `/api/:path*` al backend configurado.

`src/proxy.ts` agrega una capa de control de navegacion:

- detecta cookies de sesion,
- valida sesion real consultando `GET /api/auth/me`,
- y decide si una ruta publica o privada debe continuar o redirigir.

Esto evita confiar ciegamente en la existencia de cookies. Tener una cookie no implica tener una sesion valida; solo implica que alguien dejo una cookie.

## Estado y Librerias Cliente

| Pieza | Uso |
|---|---|
| Zustand (`src/stores/auth-store.ts`) | Estado de autenticacion en cliente |
| React Query | Fetching y cache de datos remotos |
| `src/lib/api.ts` | Cliente API |
| `src/lib/permissions.ts` | Helpers de permisos |
| `src/lib/proxy-session.ts` | Reglas de decision de sesion y redireccion |
| `src/lib/clinical-output.ts` | Bloqueos/ayudas para output clinico |

## Convenciones Practicas

- Usa `/api` same-origin desde el browser.
- No mezcles chequeos de permisos UI con reglas de negocio backend: la UI oculta o informa, el backend decide.
- Si cambias contratos de respuesta, revisa hooks, componentes y tests frontend de la misma area.
- Si tocas autenticacion o layout privado, valida tambien `src/proxy.ts` y la experiencia de reload.

## Testing Frontend

- Jest cubre componentes y utilidades.
- Playwright cubre flujos E2E desde `frontend/tests/e2e`.
- Playwright levanta el frontend, no el backend, asi que las pruebas con API real dependen de que el backend exista.

## Donde Seguir

- Setup y comandos: `development.md`
- Variables: `environment.md`
- Seguridad y sesiones: `security-and-permissions.md`
- Flujos de producto: `clinical-workflows.md`