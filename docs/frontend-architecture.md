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

## Layout de la Pagina de Atencion (`atenciones/[id]`)

La pagina de trabajo de una atencion usa un grid de **2 columnas** en desktop (xl+):

```
xl:grid-cols-[264px_minmax(0,1fr)]   // expandido (default)
xl:grid-cols-[64px_minmax(0,1fr)]    // colapsado
```

- **Izquierda (264px / 64px):** Rail de secciones (navegacion + progreso). Sticky, visible solo en xl+. Se puede **colapsar a solo iconos** (64px) con un boton en la parte inferior del rail. El estado se persiste en `localStorage` (key: `anamneo:encounter-rail-collapsed`). En modo expandido muestra items compactos (`px-3 py-2.5`, circulo `size-7`) con labels y status badges. En modo colapsado muestra unicamente los circulos numerados como tooltips (`title`). Las secciones completas se pueden colapsar/expandir con animacion (CSS `grid-template-rows: 0fr/1fr`) cuando hay 3+ terminadas (solo en modo expandido). El boton de colapso incluye `aria-expanded` y el chevron rota 180° al expandir. Al cambiar de seccion activa, el highlight (borde, fondo, sombra) transiciona suavemente (`transition-all duration-200`).
- **Centro (1fr):** Formulario de la seccion activa con `max-w-5xl` centrado. El contenido del formulario tiene un wrapper `max-w-4xl` interno para mantener los campos de texto en un ancho legible.

### Barra de progreso

La barra de progreso del header usa `h-2` con `transition-all duration-300` para animar cambios suavemente. El rail lateral tiene una barra separada (`h-1`, `bg-status-green`).

### Acciones secundarias (Drawer)

Las acciones secundarias (Revision, Apoyo, Cierre, Historial) se muestran en un **drawer lateral** (`EncounterDrawer.tsx`) que se abre a demanda desde tres puntos:

1. **Chip de estado de revision** en el toolbar del header — chip compacto (`rounded-pill`, `text-xs`) que al hacer clic abre el drawer en la pestaña Revision. Incluye `aria-label` dinamico con el estado actual de revision.
2. **Boton "Panel lateral"** en el toolbar — toggle general del drawer. Muestra un dot animado (`animate-ping`) cuando el estado es `LISTA_PARA_REVISION` y el drawer esta cerrado. El tooltip muestra el atajo platform-aware (`⌘.` en Mac, `Ctrl+.` en otros).
3. **Atajo de teclado** `Ctrl+.` / `⌘.` — toggle del drawer (platform-aware via `navigator.platform`).

El estado abierto/cerrado del drawer se persiste en `localStorage` (key: `anamneo:encounter-drawer-open`) para mantenerlo entre recargas. La pestaña activa tambien se persiste (key: `anamneo:encounter-drawer-tab`).

El drawer usa `createPortal` para renderizar fuera del arbol del componente, con overlay + transicion CSS (250ms slide-in desde la derecha). En movil, las pestanas del drawer muestran `shortLabel` (ej: "Hist." en vez de "Historial") para evitar overflow.

**Focus trap**: cuando el drawer esta visible, Tab/Shift+Tab ciclan entre los elementos focusables internos sin escapar al contenido de fondo.

### Footer de seccion

El footer de navegacion (Anterior / Siguiente / Completar) usa un borde superior `border-frame/12` con fondo sutil `bg-surface-base/25` para diferenciarlo visualmente del contenido del formulario.

### Componentes clave

| Componente | Ubicacion | Funcion |
|---|---|---|
| `EncounterDrawer` | `components/EncounterDrawer.tsx` | Drawer lateral con 4 tabs: Revision, Apoyo, Cierre, Historial |
| `FloatingQuickNotes` | `components/FloatingQuickNotes.tsx` | Editor expandible de notas internas (tab Apoyo) |
| `EncounterAuditTimeline` | `components/EncounterAuditTimeline.tsx` | Timeline de auditoria (tab Historial) |

Anteriormente (pre-2026-04-14) el layout usaba 3 columnas (`264px 1fr 356px`) con el panel secundario fijo a la derecha. Se migro a drawer para maximizar el espacio del formulario en pantallas medianas.

## Donde Seguir

- Setup y comandos: `development.md`
- Variables: `environment.md`
- Seguridad y sesiones: `security-and-permissions.md`
- Flujos de producto: `clinical-workflows.md`