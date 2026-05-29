# Auditoria UI/UX y plan de remediacion

Fecha: 2026-05-29  
Alcance: frontend completo de Anamneo, incluyendo auth, dashboard, pacientes, atenciones, ajustes, portal, feedback global, navegacion y estados.  
Base de evaluacion: inspeccion de codigo, contrato visual vigente en `docs/design-tokens-anamneo.md`, criterios de producto de `impeccable` y auditoria de `redesign-existing-projects`.

Este documento no cambia contratos, rutas ni API. Es una guia viva de remediacion priorizada para mejorar confianza, claridad, accesibilidad y consistencia visual.

## Resumen ejecutivo

Anamneo ya tiene una direccion visual reconocible: superficies calidas, shell clinico, tipografia consistente, buen uso de App Router y una intencion clara de producto operativo. El problema principal no es falta de diseno, sino exceso de patrones compitiendo entre si: pills, cards, sombras, bordes, iconos Feather, glass, chips y toasts aparecen con demasiada intensidad en zonas donde el usuario necesita calma y foco.

El caso mas visible era el toast de bienvenida. Antes de la primera remediacion se mostraba como una pildora negra en `top-right`, con copy enfatico y tamano visual desproporcionado sobre el header. Esto daba una primera impresion poco clinica y poco cuidada, especialmente al entrar a una app que maneja informacion sensible.

### Health score estimado

| Dimension | Score | Hallazgo principal |
|---|---:|---|
| Accesibilidad | 3/4 | Hay labels, roles y focus en varias zonas, pero persisten targets compactos, feedback no siempre contextual y contraste/jerarquia irregular en chips |
| Performance perceptual | 3/4 | La app usa skeletons en varias areas, pero todavia hay spinners genericos y efectos visuales que pueden sentirse pesados |
| Responsive | 2/4 | Hay breakpoints y mobile shell, pero auth/register y elementos compactos han mostrado overflow/scroll fragile |
| Theming | 2/4 | Existen tokens, pero hay colores hardcoded y estilos paralelos en auth, portal y emails |
| Anti-patterns visuales | 2/4 | Repeticion de pill/card/shadow/iconos Feather, glass header y mensajes demasiado enfaticos |
| **Total** | **12/20** | **Aceptable, pero con deuda UI/UX visible en confianza y consistencia** |

### Prioridades de remediacion

1. Arreglar feedback global: toast, copy de exito/error, severidad, posicion y accesibilidad.
2. Consolidar sistema visual: tokens, radios, sombras, botones, banners y estados.
3. Estabilizar auth y navegacion: login/register, scroll, header, sidebar y responsive.
4. Pulir flujos clinicos criticos: guardado, offline, conflictos, formularios y confirmaciones.
5. Hacer QA visual final con screenshots desktop/mobile/Safari.

## Registro de remediacion ejecutada

Actualizado: 2026-05-29

### Fase 1: feedback global y copy

- `frontend/src/components/providers/Providers.tsx`: el toast global paso de `top-right` con pildora oscura a `top-center`, superficie clara, borde suave, radio de 16px y sombra menos dominante.
- `frontend/src/lib/notify.ts`: se agrego `notify` y `feedbackCopy` para centralizar el contrato de mensajes.
- `frontend/src/lib/api.ts`: los fallbacks de `getErrorMessage` ahora clasifican red, validacion, sesion, permisos, no encontrado, conflicto, limite de intentos y servidor con siguiente accion recuperable.
- `frontend/src/app/(dashboard)/admin/solicitudes/page.tsx`: se eliminaron `alert()` del navegador en errores, validaciones, revocacion y avisos de correo; el flujo usa `notify` y copy sobrio.
- `frontend/src/app/(dashboard)/pacientes/[id]/administrativo/page.tsx`: invitacion al portal dejo de usar `alert()` y reporta validacion/error mediante `notify`.
- Auth, dashboard, atenciones, pacientes, ajustes, admin, agenda, analitica, catalogo, plantillas, seguimientos, cambio de contrasena y componentes comunes dejaron de llamar `react-hot-toast` directamente.
- Login/2FA usa `Sesion iniciada`, registro usa `Cuenta creada` y los avisos de inactividad quedan sin icono decorativo.

Estado: no quedan imports productivos directos de `react-hot-toast`; solo permanecen `Toaster`, `notify.ts` y tests que mockean el paquete. Tampoco quedan `window.prompt` ni `alert()` productivos en `frontend/src`.

### Fase 3 parcial: auth y navegacion

- `frontend/src/app/register/page.tsx`: la zona izquierda de register copia la de login, incluyendo eyebrow, titulo, descripcion y chip principal.
- `frontend/src/app/styles/auth.css`: el shell auth evita overflow horizontal, mantiene la columna izquierda sticky en desktop y conserva el fondo de la columna al scrollear formularios largos.
- `frontend/src/lib/proxy-security.ts`: la directiva `upgrade-insecure-requests` queda limitada a produccion para evitar que Safari degrade la carga de assets locales en desarrollo.
- `frontend/src/app/styles/dashboard.css`: el smart header dejo de usar glass/blur/sombra elevada y sus chips/acciones pasan a radios mas contenidos.

Estado: mitigado el desalineamiento login/register y el scroll visualmente roto en register. Sigue pendiente QA visual en Safari real y screenshots comparativos por viewport.

### Fase 4 parcial: flujos clinicos criticos

- `frontend/src/app/(dashboard)/atenciones/[id]/*`: guardado, offline, conflicto, drafts, workflow, ficha, adjuntos y acciones de seccion pasan por `notify`.
- Se eliminaron imports directos de `react-hot-toast` del flujo `atenciones/[id]`; quedan centralizados en `frontend/src/lib/notify.ts`.
- `frontend/src/app/(dashboard)/atenciones/[id]/EncounterWorkspaceStatusBanner.tsx`: nuevo banner persistente para conflicto, offline, cola local y error de guardado.
- `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`: se reemplazo el banner puntual de conflicto por el banner de estado de workspace.
- `frontend/src/__tests__/app/atencion-cierre.test.tsx`: se actualizo la expectativa del warning no bloqueante para el nuevo contrato de toast sobrio.

Estado: atenciones ya no depende solo de toast para offline/conflicto/error de guardado. Sigue pendiente elevar otros estados clinicos a banners cuando sean persistentes.

### Fase 2 parcial: sistema visual compartido

- `frontend/src/components/common/AlertBanner.tsx`: nueva primitiva compartida para error, warning, info, success y offline con roles `alert/status`, aria-live y variantes basadas en tokens.
- `frontend/src/components/common/EmptyState.tsx`: nueva primitiva compartida para estados vacios accionables, con icono, titulo, descripcion y accion opcional.
- `frontend/src/components/common/ErrorAlert.tsx`: queda como wrapper de `AlertBanner` para no duplicar estilos de error.
- `frontend/src/app/descargar-ficha/page.tsx` y `frontend/src/app/derechos/*`: las superficies publicas legales migraron fuera de `slate-*`/`teal-*` hardcoded hacia `surface-*`, `ink-*`, `auth-teal`, `form-input`, `btn` y `AlertBanner`.
- `frontend/src/app/(dashboard)/admin/solicitudes/page.tsx`: la vista de solicitudes legales migro fuera de `slate-*`, incorporo `AlertBanner`, `EmptyState`, skeletons de tabla, botones/tabs tokenizados y labels en sentence case.
- `frontend/src/app/(dashboard)/admin/usuarios/UsersCard.tsx`: el restablecimiento de clave paso de `confirm()` + `window.prompt()` a panel modal controlado con contraseña temporal visible, validacion inline y copy de consecuencia.
- `frontend/src/app/(dashboard)/pacientes/page.tsx`, `frontend/src/app/(dashboard)/atenciones/page.tsx`, `frontend/src/app/(dashboard)/seguimientos/page.tsx`, `frontend/src/app/(dashboard)/catalogo/*` y `frontend/src/app/(dashboard)/analitica-clinica/page.tsx`: estados vacios migraron a `EmptyState` con explicacion contextual y accion cuando aplica.
- `frontend/src/app/cambiar-contrasena/page.tsx`, `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` y `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx`: spinners de pantalla completa se reemplazaron por skeletons con forma de la vista final.
- `frontend/src/app/portal/page.tsx` y `frontend/src/app/portal/historial-acceso/page.tsx`: loading paso de spinner/texto generico a skeletons con forma real, errores usan `AlertBanner` y estados vacios explican la siguiente condicion visible.
- `frontend/src/components/common/ConfirmModal.tsx` y `frontend/src/components/common/OfflineBanner.tsx`: se corrigio texto blanco sobre fondos amarillos/lime para mejorar contraste.
- `frontend/src/app/globals.css`: `toolbar-btn`, `toolbar-btn-primary`, `toolbar-btn-success` y `section-icon-button` suben a target minimo de 44px y agregan feedback `active:scale(0.97)` con `--ease-out`.
- `frontend/src/app/globals.css`: `stepper-item-active` dejo de usar side-stripe (`border-l-4`) y paso a ring completo para mantener jerarquia sin acento lateral grueso.
- `docs/design-tokens-anamneo.md`: tokens de superficies, texto, sombras, radios y motion se reconciliaron con `globals.css` y `tailwind.config.js`.
- `frontend/src/app/styles/portal.css`: se creo una capa de portal con superficies, botones, inputs, alertas y tabla basados en tokens Anamneo.
- `frontend/src/app/portal/*`: las pantallas del portal migraron fuera de `slate-*` y usan `portal-*`, `surface-*`, `ink-*` y estados semanticos.
- `frontend/src/app/globals.css` y `frontend/src/app/styles/dashboard.css`: se agregaron curvas `--ease-out`/`--ease-in-out`, botones con target minimo de 44px y feedback `active:scale(0.97)` en acciones tocadas.
- `frontend/src/app/loading.tsx`, `frontend/src/app/(dashboard)/loading.tsx`, `error.tsx`, `global-error.tsx` y `not-found.tsx`: estados globales migraron de spinner/card generica a skeletons, copy recuperable y superficies mas sobrias.
- `frontend/tailwind.config.js` y `docs/design-tokens-anamneo.md`: radios `shell/card` y sombras `card/elevated/dropdown` bajaron de intensidad para reducir jerarquia falsa.
- `docs/index.md`: la auditoria UI/UX quedo enlazada en el mapa de documentacion activa.
- `PRODUCT.md` y `DESIGN.md`: se agrego contexto formal para `impeccable`, con registro `product`, principios, tono, anti-referencias, componentes y reglas de motion/copy.

Estado: mitigado el drift mas visible de portal, tokens, motion, estados globales, estados vacios obvios y chrome del header. Sigue pendiente iconografia, QA visual y reducir all-caps/radios en zonas densas.

### Validacion ejecutada

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --runInBand
npm --prefix frontend run test -- atencion-cierre.test.tsx use-encounter-section-save-flow.test.tsx use-encounter-section-persistence.test.tsx pacientes-list.test.tsx paciente-detalle.test.tsx ajustes.test.tsx --runInBand
npm --prefix frontend run build
```

Resultado: typecheck limpio, build exitoso, prueba enfocada pasando 6 suites/49 tests, suite completa pasando 72 suites/349 tests y diff check limpio. QA visual Playwright intentada contra frontend build, bloqueada por dependencia nativa faltante `libnspr4.so` y sudo no disponible para `playwright install-deps chromium`.

Validacion adicional ejecutada en la segunda pasada:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --runInBand
npm --prefix frontend run build
```

Resultado: typecheck limpio, suite completa pasando 72 suites/349 tests y build exitoso. La suite emitio warnings preexistentes de fake timers en `sospecha-diagnostica-section.test.tsx`, sin fallar tests.

Validacion adicional ejecutada en la tercera pasada:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --runInBand
npm --prefix frontend run build
git diff --check
grep -RIn "window.prompt\|alert(" frontend/src --include='*.tsx' --include='*.ts'
grep -RIn "animate-spin rounded-full h-12\|animate-spin rounded-full.*border-4" frontend/src --include='*.tsx' --include='*.ts'
```

Resultado: typecheck limpio, suite completa pasando 72 suites/349 tests, build exitoso, diff check limpio y sin hallazgos de `window.prompt`, `alert()` o spinners grandes de pantalla completa en `frontend/src`.

## Guia formal de microcopy de feedback

| Dominio | Severidad | Patron | Ejemplo aprobado |
|---|---|---|---|
| Sesion | Success | Accion completada, sin celebracion | `Sesion iniciada` |
| Sesion | Warning | Condicion temporal y accion esperada | `Tu sesion expirara pronto por inactividad` |
| Registro | Success | Resultado directo | `Cuenta creada` |
| Red | Error | Que fallo y recuperacion | `No se pudo conectar. Revisa tu conexion e intenta nuevamente.` |
| Validacion | Error | Que revisar antes de continuar | `Revisa los datos ingresados e intenta nuevamente.` |
| Permisos | Error | Limite de acceso, sin detalle tecnico | `No tienes permisos para realizar esta accion.` |
| Conflicto | Warning/Error | Estado concurrente y siguiente accion | `Hay cambios en conflicto. Actualiza la informacion antes de continuar.` |
| Offline | Warning persistente | Estado actual y garantia | `Sin conexion. Los cambios de secciones se encolan localmente y se sincronizaran al reconectar.` |
| Guardado clinico | Success/Status | Estado observable | `Cambios sincronizados correctamente.` |
| Legal | Info/Success | Resultado y trazabilidad | `Enlace generado` |
| Legal | Error | Decision bloqueada y requisito | `Ingresa al menos 10 caracteres para auditar la decision.` |
| Adjuntos/PDF | Error | Accion fallida y recuperacion | `No se pudo preparar el archivo. Intenta nuevamente en unos minutos.` |

Reglas de uso:

- Toast solo para eventos efimeros y confirmaciones secundarias.
- `AlertBanner` para estados persistentes, decisiones legales, error recuperable y condiciones que el usuario debe resolver.
- `EmptyState` para listas sin resultados o primer uso; siempre explicar por que no hay contenido o que lo hara aparecer.
- Evitar signos de exclamacion, emojis, stack traces, nombres de excepciones y `Error al...` sin accion.

## Hallazgos por severidad

### P1. Toast global dominante y poco clinico

- Ubicacion: `frontend/src/components/providers/Providers.tsx`, usos en `frontend/src/app/login/LoginClient.tsx`, `frontend/src/app/register/page.tsx` y multiples hooks del dashboard.
- Categoria: Feedback, copy, confianza.
- Impacto: El toast invade el header, compite con iconos de busqueda/notificaciones y hace que acciones normales parezcan gritos visuales. En una app clinica, el feedback debe ser claro pero sobrio.
- Evidencia original: `position="top-right"`, fondo `var(--frame-dark)`, `borderRadius: '9999px'`, `fontWeight: 600`, copy enfatico de bienvenida.
- Recomendacion: crear una variante global de toast mas contenida: posicion `top-center` o debajo del header shell, ancho maximo, radio menor, icono discreto, fondo `surface-elevated`, borde suave y copy sin signos de exclamacion. Definir mensajes por tipo: success, warning, error, info.
- Estado: mitigado. El estilo global y los usos productivos pasan por `notify`.
- Esfuerzo: S.
- Fase: 1.

### P1. Lenguaje de feedback inconsistente

- Ubicacion: busqueda global de `toast.success`, `toast.error`, `toast(...)` en `frontend/src`.
- Categoria: UX writing.
- Impacto: El usuario recibe mensajes con tonos distintos: algunos celebran, otros son tecnicos, otros usan emojis, otros dicen "Error al..." sin indicar recuperacion. Esto reduce confianza en acciones clinicas sensibles.
- Ejemplos originales: bienvenida enfatica, cuenta creada con tono celebratorio, `Error al guardar: ...`, `Sin conexion - guardado en cola local`, aviso de inactividad con icono decorativo.
- Recomendacion: crear una guia de microcopy para feedback. Evitar exclamaciones. Usar estructura: accion completada, que paso, siguiente paso si aplica. Ejemplos: "Sesion iniciada", "Cuenta creada", "No se pudo guardar. Revisa tu conexion e intenta de nuevo.".
- Estado: mitigado. Existe tabla formal de microcopy por dominio/severidad y fallbacks de errores comunes.
- Esfuerzo: M.
- Fase: 1.

### P1. Auth/register tiene layout fragile en scroll y alturas dispares

- Ubicacion: `frontend/src/app/styles/auth.css`, `frontend/src/components/auth/AuthFrame.tsx`, `frontend/src/app/login/LoginClient.tsx`, `frontend/src/app/register/page.tsx`.
- Categoria: Layout, responsive, confianza.
- Impacto: Login y register comparten marco, pero el formulario de register es mas alto. Los ajustes de altura/sticky pueden provocar cortes visuales, fondo discontinuo o scroll horizontal. Esto se nota en Safari y pantallas bajas.
- Recomendacion: redisenar el shell auth como layout explicito de dos columnas: columna izquierda con fondo independiente que cubra todo el alto del documento, contenido hero anclado a viewport en desktop y flujo normal en mobile. Evitar que la altura del formulario derecho decida la alineacion del hero. Agregar pruebas visuales manuales en 1366x768, 2048x1152, 390x844 y Safari.
- Esfuerzo: M.
- Fase: 3.

### P1. Portal usa un lenguaje visual distinto al producto principal

- Ubicacion: `frontend/src/app/portal/*`.
- Categoria: Theming, consistencia.
- Impacto: El portal usa clases `slate-*`, cards blancas genericas y una estetica mas default que el dashboard. Para pacientes, esto puede sentirse como otra aplicacion o una zona menos confiable.
- Recomendacion: migrar portal a tokens Anamneo: `surface-*`, `ink-*`, `status-*`, radios y botones compartidos. Mantener una variante mas simple para pacientes, pero reconocible.
- Estado: mitigado. Portal, paginas publicas legales, descarga de ficha y admin de solicitudes legales ya usan tokens principales en las superficies tocadas. Persisten hardcoded colors en emails y zonas no legales del dashboard.
- Esfuerzo: M.
- Fase: 2.

### P1. Patrones de guardado/offline/conflicto dependen demasiado de toast

- Ubicacion: `frontend/src/app/(dashboard)/atenciones/[id]/*`, especialmente hooks de secciones, draft sync, offline queue y workflow actions.
- Categoria: Feedback, flujos clinicos criticos.
- Impacto: Guardado, conflictos de edicion, cola offline y restauracion de borradores son estados de alto riesgo. Si se comunican solo con toast, el usuario puede perder el mensaje o no entender que accion tomar.
- Recomendacion: mantener toast solo como confirmacion secundaria y mover estados criticos a banners persistentes dentro del workspace: guardando, guardado, sin conexion, conflicto, copia local restaurada, requiere recarga. Los banners deben tener accion clara.
- Esfuerzo: L.
- Fase: 4.

### P2. Sistema visual mezcla demasiadas formas con igual peso

- Ubicacion: `frontend/src/app/globals.css`, `frontend/src/app/styles/dashboard.css`, cards del dashboard, filtros, headers y componentes comunes.
- Categoria: Sistema visual, jerarquia.
- Impacto: Muchos elementos usan combinaciones parecidas de `rounded-pill`, `rounded-card`, borde, sombra y background elevado. Como todo parece importante, la jerarquia se diluye.
- Recomendacion: definir vocabulario de superficies:
  - superficie plana para secciones;
  - card solo para bloques repetibles;
  - pill solo para filtros/chips pequenos;
  - botones primarios con radio consistente menor que pills cuando sean acciones estructurales;
  - sombras solo cuando haya superposicion real.
- Estado: mitigado parcialmente. Ya existen `AlertBanner` y `EmptyState`, toolbar/icon buttons tienen target minimo y `stepper-item-active` dejo el side-stripe. Sigue pendiente reducir all-caps, radios pill heredados y cards similares en admin/ajustes.
- Esfuerzo: M.
- Fase: 2.

### P2. Tokens visuales documentados no coinciden completamente con el codigo

- Ubicacion: `docs/design-tokens-anamneo.md`, `frontend/tailwind.config.js`, `frontend/src/app/globals.css`.
- Categoria: Theming, mantenibilidad.
- Impacto: El documento declara valores como `surface-base: #DFDFD5`, mientras el codigo usa `#ebe9e4`. Esto convierte el contrato visual en una referencia parcialmente falsa.
- Recomendacion: reconciliar tokens: elegir si el contrato vigente es el codigo o el documento, actualizar ambos, y prohibir nuevos hardcoded colors salvo excepciones documentadas.
- Esfuerzo: S.
- Fase: 2.

### P2. Hardcoded colors y estilos paralelos en auth

- Ubicacion: `frontend/src/app/styles/auth.css`.
- Categoria: Theming, consistencia.
- Impacto: Auth introduce su propia paleta (`#e8e4d8`, `#1e2826`, `#4e5b58`, `#235f58`, etc.) y muchas reglas manuales. Es visualmente atractivo, pero aumenta riesgo de drift respecto al sistema principal.
- Recomendacion: promover los colores de auth a tokens semanticos o re-mapearlos a tokens existentes. Mantener una variante `auth` explicita solo si se documenta.
- Esfuerzo: M.
- Fase: 2.

### P2. Header inteligente puede sentirse sobredecorado

- Ubicacion: `frontend/src/components/layout/SmartHeaderBar.tsx`, `frontend/src/app/styles/dashboard.css`.
- Categoria: Jerarquia, densidad, anti-pattern.
- Impacto: KPIs, chips, glass, tooltips, botones de accion, alert popover y badges compiten en una banda pequena. En escritorio grande se ve sofisticado, pero en uso repetido puede generar ruido.
- Recomendacion: separar informacion de accion. Reducir glass y sombras, dejar KPIs solo si son accionables en la ruta actual, y mover acciones globales a una zona fija con jerarquia clara.
- Estado: mitigado parcialmente en CSS: sin glass/blur, menos sombra y radios menos pill.
- Esfuerzo: M.
- Fase: 3.

### P2. Estados globales de loading/error/not-found son genericos

- Ubicacion: `frontend/src/app/loading.tsx`, `frontend/src/app/error.tsx`, `frontend/src/app/global-error.tsx`, `frontend/src/app/not-found.tsx`.
- Categoria: Estados, confianza.
- Impacto: La app invierte mucho en UI clinica, pero los estados globales parecian placeholders: spinner circular, card generica, icono `!`. Esto aparece justo cuando algo salio mal.
- Recomendacion: mantener skeletons de shell, mensajes con recuperacion clara y acciones secundarias: volver al inicio, reintentar, contactar soporte si aplica. Mantener tono sobrio.
- Estado: mitigado en loading/error/not-found globales y dashboard.
- Esfuerzo: S.
- Fase: 2.

### P2. Spinners aparecen donde deberia haber feedback contextual

- Ubicacion: botones de login/register, loading global, modales, acciones de adjuntos y guardados.
- Categoria: Performance perceptual.
- Impacto: El spinner no dice que esta pasando ni cuanto falta. En acciones clinicas, un skeleton o estado textual reduce ansiedad.
- Recomendacion: usar spinners solo para acciones cortas dentro de botones. Para cargas de contenido, usar skeletons con forma real. Para guardados, usar estado textual persistente.
- Estado: mitigado parcialmente. Portal home, portal historial, admin solicitudes, cambio de contrasena, workspace de atencion y ficha clinica usan skeletons contextuales. Persisten spinners aceptables en botones y algunos modales/busquedas internas.
- Esfuerzo: M.
- Fase: 2 y 4.

### P2. Iconografia depende casi totalmente de Feather/Fi

- Ubicacion: imports `react-icons/fi` en auth, dashboard, pacientes, atenciones, portal y componentes comunes.
- Categoria: Identidad, anti-pattern visual.
- Impacto: Feather comunica limpieza, pero usado en todas partes vuelve generica la interfaz. Ademas se repiten metaforas obvias: shield, lock, search, file, users.
- Recomendacion: mantener Feather donde sirve para affordances estandar, pero crear un set reducido de iconos propios o variantes para identidad clinica, estados criticos y branding. Auditar stroke, tamano y color.
- Esfuerzo: M.
- Fase: 5.

### P2. Targets tactiles compactos en chips e icon buttons

- Ubicacion: smart header chips, nav secundaria, alert badge, filtros, botones compactos de tablas y cards.
- Categoria: Accesibilidad, responsive.
- Impacto: Algunos controles se acercan o quedan bajo los 44px recomendados para touch. En mobile/tablet clinico, esto aumenta errores.
- Recomendacion: crear regla minima: controles interactivos tactiles `min-height: 44px`, icon buttons `44x44`, chips clickables con padding suficiente. Mantener excepciones solo para informacion no interactiva.
- Estado: mitigado parcialmente. `.btn`, `.toolbar-btn*`, `.section-icon-button` y botones portal cumplen 44px; quedan chips/segmentos especificos por auditar en tablas, analitica, catalogo y header secundario.
- Esfuerzo: M.
- Fase: 3.

### P2. Error messages mezclan causa tecnica y accion de usuario

- Ubicacion: hooks y paginas con `getErrorMessage`, `Error al...`, `No se pudo...`.
- Categoria: UX writing, soporte.
- Impacto: Algunos mensajes explican el error, otros solo nombran el fallo. Falta consistencia sobre si el usuario debe reintentar, revisar conexion, recargar o contactar soporte.
- Recomendacion: clasificar errores: validacion, red, permisos, conflicto, servidor. Cada clase debe tener copy y accion recomendada.
- Estado: mitigado parcialmente en `getErrorMessage`, con fallbacks por red, validacion, sesion, permisos, 404, conflicto, 422, rate limit y servidor. Falta mapear codigos de dominio clinico cuando el backend los exponga.
- Esfuerzo: M.
- Fase: 1 y 4.

### P2. Empty states son funcionales pero no siempre orientan

- Ubicacion: dashboard, pacientes, atenciones, seguimientos, catalogo y portal.
- Categoria: Onboarding, orientacion.
- Impacto: Varios estados dicen que no hay datos, pero no siempre sugieren la accion siguiente o explican por que la vista esta vacia.
- Recomendacion: estandarizar empty states por contexto: titulo claro, una frase, accion principal si el rol puede ejecutarla, enlace secundario a ayuda o filtros.
- Estado: mitigado parcialmente. Existe `EmptyState` y ya se usa en portal home, admin solicitudes, pacientes, atenciones, seguimientos, catalogo y analitica. Persisten estados vacios ad hoc en componentes secundarios y detalle de paciente.
- Esfuerzo: M.
- Fase: 4.

### P2. Dashboard admin usa cards de modulo demasiado similares

- Ubicacion: `frontend/src/app/(dashboard)/DashboardAdminView.tsx`.
- Categoria: Layout, jerarquia.
- Impacto: La grilla de cards para admin es clara, pero se acerca al patron generico de icono + titulo + descripcion + flecha. No distingue criticidad ni frecuencia de uso.
- Recomendacion: reorganizar por tareas: usuarios, auditoria, catalogo y sistema. Dar mas peso visual a acciones frecuentes y menos a accesos raros.
- Esfuerzo: M.
- Fase: 3.

### P3. Uso excesivo de all-caps en labels pequenos

- Ubicacion: auth card kickers, badges, chips y algunas secciones de ajustes.
- Categoria: Tipografia.
- Impacto: All-caps ayuda a separar jerarquia, pero usado de forma repetida vuelve la UI rigida y menos humana.
- Recomendacion: reservar all-caps para metadatos raros o estados. Usar sentence case en etiquetas funcionales.
- Esfuerzo: S.
- Fase: 5.

### P3. Radios muy grandes en superficies internas

- Ubicacion: `rounded-card`, `rounded-shell`, `rounded-pill` en cards, modales, headers y formularios.
- Categoria: Sistema visual.
- Impacto: Radios grandes dan suavidad, pero cuando todos los elementos son redondos se pierde precision operativa.
- Recomendacion: reducir radios internos: inputs y cards compactas con 12-16px, shells principales con 24-32px, pills solo para chips/filters.
- Esfuerzo: M.
- Fase: 2.

### P3. Comentarios visuales en CSS son abundantes

- Ubicacion: `frontend/src/app/globals.css`, `frontend/src/app/styles/auth.css`, `frontend/src/app/styles/dashboard.css`.
- Categoria: Mantenibilidad.
- Impacto: Los comentarios ayudan a navegar, pero algunos separadores largos aumentan ruido y pueden ocultar deuda real.
- Recomendacion: mantener comentarios de seccion principales y eliminar decoracion redundante cuando se refactorice el sistema visual.
- Esfuerzo: S.
- Fase: 5.

## Areas auditadas

### Notificaciones y feedback

Estado actual:

- Feedback efimero centralizado con `notify` sobre `react-hot-toast`.
- Estilo global sobrio, claro y `top-center`; estados persistentes empiezan a migrar a banners.
- Mensajes frecuentes y fallbacks de error ya tienen tono recuperable, pero falta guia formal por dominio.

Mejoras:

- Ampliar `feedbackCopy` a una tabla formal por dominio y severidad.
- Mantener success de login/register en tono neutro: "Sesion iniciada" y "Cuenta creada".
- Evitar emojis en mensajes operativos o reservarlos para estados no clinicos.
- Usar banners persistentes para offline, conflicto, permisos y acciones que requieren decision.

### Auth

Estado actual:

- `AuthFrame` permite compartir login/register.
- El hero izquierdo ya esta mas consistente, pero sigue siendo sensible a scroll y altura de formulario.
- Register tiene mas contenido y puede romper simetria visual.

Mejoras:

- Definir un contrato de layout para auth: hero fijo al viewport en desktop, fondo continuo al alto del documento, columna derecha con scroll natural.
- Unificar footer, spacing y densidad entre login/register.
- Revisar Safari y pantallas bajas como parte obligatoria de QA.

### Dashboard shell

Estado actual:

- Sidebar, smart header, command search y alert popover son funcionales.
- Hay buen trabajo de accesibilidad en roles, labels y shortcuts.
- La densidad visual de smart header puede ser alta.

Mejoras:

- Reducir decoracion del smart header.
- Asegurar targets de 44px.
- Separar KPIs informativos de acciones globales.
- Revisar mobile nav para evitar doble navegacion o opciones redundantes.

### Flujos clinicos

Estado actual:

- Hay cuidado por offline, drafts, conflictos y auditoria.
- Muchos estados criticos se comunican por toast.
- Formularios usan labels y errores, pero la experiencia de guardado podria ser mas visible.

Mejoras:

- Estado de guardado por seccion visible y persistente.
- Banners para offline/conflicto con accion clara.
- Mensajes por clase de error.
- Confirmaciones destructivas con copy menos generico y foco accesible.

### Ajustes, admin y portal

Estado actual:

- Ajustes tiene muchas cards, tabs y acciones de mantenimiento.
- Portal usa estilos `slate` y parece visualmente separado.
- Admin dashboard es claro pero generico.

Mejoras:

- Migrar portal a tokens principales.
- Agrupar ajustes por riesgo y frecuencia.
- Dar jerarquia operacional al admin dashboard.
- Unificar botones de acciones peligrosas, mantenimiento y seguridad.

### Sistema visual

Estado actual:

- Hay tokens y paleta definida.
- Drift principal entre docs, Tailwind y CSS mitigado.
- Ya existen primitivas compartidas para banners y empty states.
- Persisten variantes ad hoc en modales, emails, iconografia, analitica, catalogo y algunas cards de ajustes/admin.

Mejoras:

- Mantener sincronizados `docs/design-tokens-anamneo.md`, `tailwind.config.js` y `globals.css` cuando cambien tokens.
- Definir reglas de uso para radios, sombras, cards, pills y banners.
- Extender componentes primitivos para toasts enriquecidos, section headers y confirmaciones destructivas.

## Plan de remediacion

### Fase 1: Feedback global y copy

Objetivo: eliminar la sensacion de UI ruidosa o poco clinica en mensajes.

- Reemplazar estilo global del toast por variante sobria y no invasiva.
- Cambiar login/register: `¡Bienvenido!` a `Sesion iniciada`; `¡Cuenta creada exitosamente!` a `Cuenta creada`.
- Crear una tabla de microcopy para success, error, warning, offline y conflicto.
- Normalizar errores mas frecuentes: red, permisos, validacion, conflicto, servidor.
- Mantener toasts para eventos efimeros; mover estados criticos a banners persistentes.

Criterios de aceptacion:

- Ningun success toast usa signos de exclamacion.
- Toast no tapa el smart header ni controles principales.
- Errores criticos tienen accion clara.

### Fase 2: Sistema visual compartido

Objetivo: reducir drift y crear jerarquia mas precisa.

- Sincronizar tokens entre doc, Tailwind y CSS.
- Definir radios por tipo de componente.
- Reducir uso simultaneo de borde + sombra + background en cards.
- Crear primitives: `AlertBanner`, `EmptyState`, `StatusCard`, `ToastContent` o helper equivalente.
- Migrar colores hardcoded repetidos a tokens.
- Unificar portal con `surface-*`, `ink-*` y botones compartidos.

Criterios de aceptacion:

- Los tokens documentados coinciden con el codigo.
- Portal ya no depende de `slate-*` como paleta principal.
- Nuevos componentes no agregan colores hardcoded salvo excepciones documentadas.

### Fase 3: Auth y navegacion

Objetivo: estabilizar las primeras pantallas y el shell diario.

- Rehacer auth shell con grid robusto para login/register.
- Probar scroll en register con formularios largos y pantallas bajas.
- Ajustar smart header para bajar ruido visual.
- Asegurar targets minimos en chips, icon buttons y acciones compactas.
- Revisar sidebar colapsada, mobile menu y command search como un flujo unico.

Criterios de aceptacion:

- Login y register mantienen alineacion equivalente en desktop.
- Register no deja fondos cortados ni scroll horizontal en Safari.
- Controles interactivos principales cumplen 44px en mobile.

### Fase 4: Flujos clinicos criticos

Objetivo: que estados de alto riesgo sean visibles, persistentes y accionables.

- Crear banners de workspace para guardado, offline, conflicto y copia local.
- Estandarizar empty states en pacientes, atenciones, seguimientos y catalogo.
- Revisar modales de confirmacion destructiva para copy, foco y jerarquia.
- Mejorar estados de carga de adjuntos, PDF, busqueda y formularios largos.
- Revisar errores de permisos y sesion con rutas de recuperacion claras.

Criterios de aceptacion:

- Offline/conflicto no depende solo de toast.
- Cada flujo critico indica estado actual y siguiente accion.
- Empty states incluyen accion si el rol tiene permiso.

### Fase 5: Polish, QA visual y accesibilidad

Objetivo: cerrar deuda de confianza y consistencia.

- Auditar iconografia: mantener Feather donde sea affordance estandar, reemplazar metaforas repetidas en identidad/seguridad.
- Reducir all-caps decorativo.
- Ajustar tipografia y line-height en headers compactos.
- Revisar contrastes y focus rings con teclado.
- Crear checklist visual con screenshots: desktop, mobile, Safari, login, register, dashboard, atencion, paciente, portal.

Criterios de aceptacion:

- QA visual captura pantallas clave antes/despues.
- Navegacion por teclado no pierde foco visible.
- La UI se siente como un solo producto entre app interna y portal.

## Checklist de implementacion sugerido

| Orden | Trabajo | Riesgo | Impacto |
|---:|---|---|---|
| 1 | Redisenar toast global y microcopy de login/register | Bajo | Alto |
| 2 | Crear guia de feedback y normalizar mensajes frecuentes | Medio | Alto |
| 3 | Reconciliar tokens doc/codigo | Medio | Alto |
| 4 | Refactor auth shell con QA Safari | Medio | Alto |
| 5 | Migrar portal a tokens Anamneo | Medio | Medio |
| 6 | Banners persistentes para offline/conflicto | Alto | Alto |
| 7 | Reducir ruido del smart header | Medio | Medio |
| 8 | Empty states y errores globales | Bajo | Medio |
| 9 | Audit iconografico y radios | Medio | Medio |
| 10 | QA visual y accesibilidad final | Bajo | Alto |

## Registro de remediacion ejecutada — cuarta pasada (2026-05-29)

### Items cerrados

2. **Empty states secundarios**: migrados a `EmptyState` o patron inline consistente en `PatientEncounterTimeline`, `PatientAlerts`, `ConsentHistoryList`, `EncounterAttachmentsModal` y `auditoria/page` (full EmptyState); y con icono inline en `PatientProblemsCard`, `PatientTasksCard`, `PatientVitalsCard`, `PatientDetailSidebar` y `PatientLongitudinalSummaryCard`.

3. **Spinners de contenido**: `PdfPreviewModal`, `AttachmentPreviewModal`, `CommandPalette`, `MobileSearchOverlay` y `DashboardSidebarParts` pasan de spinner a skeletons con forma real.

4. **Iconografia**: nuevo doc `docs/iconography.md`. Set de identidad en `frontend/src/components/icons/` (ShieldIcon, LockIcon, ActivityIcon). Cableados en login, register, SignEncounterModal y admin dashboard cards (auditoria/solicitudes). Politica de uso documentada.

5. **All-caps y radios**: reduccion dirigida en `PatientVitalsCard`, `atenciones/page`, `AuditDetailModal`, `AuditIntegrityCard`, `SystemTab`, `ProfileSecurityTab`. Botones estructurales (Retomar atencion, Nueva atencion, Crear seguimiento) dePillados en `DashboardClinicalView`.

6. **Admin/ajustes IA**: `ADMIN_CARD_SECTIONS` reemplaza `ADMIN_CARDS` en `dashboard.constants.ts`, con grupos "Operacion diaria" y "Gobernanza y configuracion". Se agrega card faltante de `/admin/solicitudes`. `DashboardAdminView.tsx` renderiza encabezados de seccion. `SystemTab.tsx` divide en secciones (Salud del sistema, Documentos legales, Secciones de atencion, Mantenimiento, Politica de sesion) con Mantenimiento visualmente aislado como zona de riesgo.

7. **Modales destructivos y QA de teclado (items 7+9)**: nueva primitiva `Dialog` (`frontend/src/components/common/Dialog.tsx`) y hook `useFocusTrap` (`frontend/src/hooks/useFocusTrap.ts`). Implementa focus trap real, initial focus configurable, Escape, y restore de foco al cerrar. Migrados: `ConfirmModal`, `SignEncounterModal`, `ReopenEncounterModal`, `InProgressEncounterConflictModal`, `AttachmentPreviewModal`, `PdfPreviewModal`, `OnboardingWelcomeModal`, `RevokeConsentModal`, `admin/solicitudes/page` (modales selected y pendingDecision), `admin/usuarios/UsersCard` (password reset — ahora con foco inicial en el input de contrasena, no en Cancel).

### Items bloqueados (condicion de desbloqueo documentada)

1. **QA visual real** (item 1): bloqueado por `libnspr4.so` en este entorno. Para desbloquear: en una maquina con `sudo` ejecutar `sudo npx --prefix frontend playwright install-deps chromium webkit` o instalar manualmente las librerias del sistema. Playwright webkit en Linux cubre el riesgo "Safari" sin macOS. Pantallas a capturar: login, register, dashboard, atencion, paciente, portal, derechos, descarga de ficha y admin solicitudes en desktop/mobile.

8. **Codigos de error de dominio** (item 8): bloqueado hasta que el backend exponga un campo `code` estable en el body de error. Para desbloquear: (1) backend incluye `code: "PATIENT_BLOCKED"` etc. en la respuesta; (2) catalogo de codigos y significados. Con eso se mapean en `frontend/src/lib/api.ts` (`getErrorMessage`) siguiendo la tabla de microcopy de este documento.

### Validacion ejecutada

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --runInBand
npm --prefix frontend run build
git diff --check
grep -RIn "window.prompt\|alert(" frontend/src --include='*.tsx' --include='*.ts'
grep -RIn "animate-spin rounded-full h-12\|animate-spin rounded-full.*border-4" frontend/src --include='*.tsx' --include='*.ts'
```

Resultado: typecheck limpio, suite completa pasando 72 suites/349 tests, build exitoso, diff check limpio y sin hallazgos de spinners grandes ni prompts en `frontend/src`.

## Pendientes post-cuarta pasada

1. QA visual real (bloqueado — ver condicion arriba).
8. Codigos de error de dominio (bloqueado — ver condicion arriba).

Pendientes opcionales de menor prioridad:
- Migrar empty states ad hoc restantes en componentes secundarios (analitica, agenda, reportes).
- Reemplazar `FiClipboard` en cabeceras de atencion y `FiFileText` en ficha por iconos propios si se decide ampliar el set de identidad.
- QA de teclado manual en modales migrados para confirmar que el retorno de foco se siente correcto en cada caso.
- Reducir all-caps adicional en componentes de analitica y agenda (baja prioridad).

## Validacion recomendada

Comandos base:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test
```

Validacion visual manual:

- Login y register: 390x844, 768x1024, 1366x768, 2048x1152.
- Safari: login, register con scroll, dashboard con toast activo.
- Dashboard: sidebar expandida/colapsada, smart header, command search, alert popover.
- Atencion: guardado normal, error de red, conflicto, offline.
- Portal: home, historial de acceso, detalle de atencion.

Validacion de accesibilidad:

- Navegacion completa por teclado en auth y dashboard shell.
- Focus visible en botones icon-only.
- Targets tactiles de acciones primarias y chips interactivos.
- Contraste de chips, badges y status text.

## Notas positivas a conservar

- La app ya tiene un sistema visual propio, no parte de cero.
- Hay buen uso de labels, roles y `aria-*` en auth, sidebar, smart header y command search.
- Los flujos clinicos tienen una base funcional solida: offline queue, drafts, conflictos, auditoria y permisos.
- La documentacion existente es amplia y permite convertir esta auditoria en tareas incrementales.
- El uso de tokens existe; el trabajo principal es consolidar y aplicar, no inventar un sistema desde cero.

## Fuera de alcance de este documento

- Cambios de API, backend, base de datos o permisos.
- Redisenar la marca desde cero.
- Incorporar librerias nuevas de UI.
- Leer o exponer secretos de entorno.
