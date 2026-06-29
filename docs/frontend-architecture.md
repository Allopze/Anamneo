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
- hace un chequeo optimista basado en cookies y refresh token,
- y decide si una ruta publica o privada debe continuar o redirigir antes del render.

Cuando el usuario inicia sesion, el frontend reutiliza el usuario devuelto por `POST /auth/login`, `POST /auth/register` o `POST /auth/2fa/verify` y guarda un prefill de una sola vez para que `DashboardLayout` no tenga que volver a pedir `/auth/me` en la navegacion inmediata despues del login.

La validacion efectiva de sesion ocurre en `DashboardLayout` con `GET /api/auth/me` una vez que la ruta privada ya cargo. El proxy no reemplaza el enforcement del backend ni deberia hacer llamadas pesadas por request.

Esto evita confiar ciegamente en la existencia de cookies. Tener una cookie no implica tener una sesion valida; solo implica que podria existir una sesion recuperable.

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
- Ningun archivo fuente de frontend debe superar las 500 lineas y 300 lineas es el objetivo por defecto.
- Si una pagina, componente o hook cruza 300 lineas, separa subcomponentes, hooks o constantes antes de seguir cargandolo.

## Testing Frontend

- Jest cubre componentes y utilidades.
- Playwright cubre flujos E2E desde `frontend/tests/e2e`.
- En este repo, Playwright levanta tanto el frontend como un backend E2E propio mediante `webServer`.

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

### Herramientas de atencion

Las acciones transversales ya no viven en un drawer lateral. Se integran en el flujo principal para evitar un contenedor generico y reducir interrupciones durante la edicion:

1. **Revision** — el chip de estado del toolbar abre una seccion inline de revision con nota, cambio de estado y resumen generado.
2. **Apoyo clinico** — vive en `Mas > Apoyo clinico` y se muestra inline sobre la seccion activa; contiene notas internas, adjuntos, antecedentes y seguimiento rapido segun permisos.
3. **Cierre** — se renderiza como bloque fijo despues de la seccion activa cuando la atencion puede completarse; contiene checklist, nota de cierre y seguimientos vinculados.
4. **Historial** — vive en `Mas > Historial` para usuarios con permiso de auditoria y se muestra inline sin overlay.

La herramienta inline activa se mantiene como estado local del wizard (`activeWorkspacePanel`) y no se persiste en `localStorage`, porque es una preferencia momentanea de trabajo y no parte del estado clinico.

### Footer de seccion

El footer de navegacion (Anterior / Siguiente / Completar) usa un borde superior `border-frame/12` con fondo sutil `bg-surface-base/25` para diferenciarlo visualmente del contenido del formulario.

### Componentes clave

| Componente | Ubicacion | Funcion |
|---|---|---|
| `EncounterWorkspaceTools` | `atenciones/[id]/EncounterWorkspaceTools.tsx` | Herramientas inline de Revision, Apoyo, Cierre e Historial |
| `FloatingQuickNotes` | `components/FloatingQuickNotes.tsx` | Editor expandible de notas internas en Apoyo clinico |
| `EncounterAuditTimeline` | `components/EncounterAuditTimeline.tsx` | Timeline de auditoria en Historial |

Anteriormente (pre-2026-04-14) el layout usaba 3 columnas (`264px 1fr 356px`) con el panel secundario fijo a la derecha. Se migro a drawer para maximizar el espacio del formulario en pantallas medianas.

## Donde Seguir

- Setup y comandos: `development.md`
- Variables: `environment.md`
- Seguridad y sesiones: `security-and-permissions.md`
- Flujos de producto: `clinical-workflows.md`
