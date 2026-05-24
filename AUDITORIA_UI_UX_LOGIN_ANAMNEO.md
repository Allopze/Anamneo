# Auditoría UI/UX — Login de Anamneo

## Resumen ejecutivo

La pantalla de login de Anamneo quedó más sólida tras esta pasada de fixes: mantiene el flujo completo de credenciales, 2FA, recuperación de contraseña, bloqueo por intentos, sesiones con cookies HttpOnly y rutas legales, pero ahora evita el submit nativo por GET, mejora contraste, hit areas, loading inicial y estabilidad mobile. Visualmente conserva una marca sobria y clínica, con un hero mobile más compacto, CTA visible en 320px y skeleton de acceso alineado al layout real. La vista base y el paso 2FA no presentan overflow horizontal ni violaciones automáticas WCAG A/AA con Axe en validación manual Playwright. Lo que queda pendiente ya no bloquea el login: principalmente refactor de estilos auth, homologar pantallas públicas relacionadas, revisar copy de confianza con producto y ajustar el layout tablet de forma más profunda.

## Score general

- Claridad visual: 8.5/10
- Facilidad de uso: 8.5/10
- Accesibilidad: 8.6/10
- Responsive: 8.2/10
- Confianza percibida: 8.3/10
- Calidad del código UI: 7.9/10
- Conversión / fricción: 8.4/10

Nota global final: 8.4/10

## Fixes aplicados en esta pasada

- Seguridad del form: agregué `method="post"` y `noValidate` a los formularios de credenciales y 2FA en `frontend/src/app/login/LoginClient.tsx`.
- Tests de seguridad UI: agregué aserciones en `frontend/src/__tests__/app/login.test.tsx` para verificar `method="post"` y `novalidate`.
- Error global: cambié el texto de `ErrorAlert` a `text-status-red-text` y marqué el icono como decorativo en `frontend/src/components/common/ErrorAlert.tsx`.
- Copy de error: reemplacé el fallback de 401 genérico por "No pudimos iniciar sesión. Revisa tus credenciales o recupera tu contraseña.".
- Loading copy: cambié `Cargando acceso...` por `Preparando acceso…` en `frontend/src/app/login/page.tsx` y `frontend/src/app/login/LoginClient.tsx`.
- Mobile login: compacté el hero mobile y reduje el logo del card en mobile para que el CTA principal quede dentro del primer viewport.
- Mobile 2FA: quité `autoFocus`, compacté el card 2FA, oculté el logo del card en mobile solo en ese paso y acorté los labels de método.
- Targets táctiles: amplié el toggle de contraseña y enlaces secundarios a 44px mínimos cuando aplican.
- Orden de tabulación: moví recuperación de contraseña después del CTA principal para que el flujo sea email -> password -> toggle -> submit -> recuperación.
- Motion/accessibilidad: añadí una regla `prefers-reduced-motion` para reducir animaciones en auth/loading.
- Placeholders: actualicé email y 2FA para usar ejemplos con `…`; cambié contraseña a copy textual en vez de bullets.
- Loading estructural: reemplacé el spinner de Suspense por `LoginFallback`, un skeleton accesible con `role="status"` y `aria-live="polite"` en `frontend/src/app/login/LoginFallback.tsx`.
- Reuso del fallback: `frontend/src/app/login/page.tsx` y `frontend/src/app/login/LoginClient.tsx` comparten el mismo skeleton en vez de duplicar spinners.
- Regresión responsive: agregué `frontend/tests/e2e/login-responsive.spec.ts` para cubrir 320x720, CTA visible, 2FA visible, `scrollY=0`, `method="post"` y Axe.
- Infra de e2e: corregí `backend/scripts/e2e-webserver.js` para usar `--maintenance-db` y remover `schema=public` al llamar `dropdb/createdb`, igual que el helper backend existente.

## Validación post-fix

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run test -- login.test.tsx --runInBand`: OK, 10 tests pasando.
- `npm --prefix frontend run lint`: OK.
- `npx eslint tests/e2e/login-responsive.spec.ts` desde `frontend`: OK.
- `npm --prefix frontend run build`: OK.
- `node --check backend/scripts/e2e-webserver.js`: OK.
- Playwright 320/375/390/768/1024/1440: sin overflow horizontal.
- Axe WCAG A/AA en login base y 2FA mobile: 0 violaciones.
- Medición 320x720 login base: submit pasó de `y=731-777` a `y=557-603`.
- Medición 320x720 2FA: submit quedó en `y=665-711`, sin `scrollY` automático.
- Playwright manual 320x720 con API mockeada: login `buttonBottom=603`, 2FA `buttonBottom=711`, `overflow=false`, `scrollY=0`, `method=post`, Axe serio/crítico `0`.
- `npm --prefix frontend run test:e2e -- tests/e2e/login-responsive.spec.ts`: bloqueado por credenciales locales de Postgres (`password authentication failed for user "anamneo_owner"`). El spec queda agregado; el webServer ya avanzó más allá de los errores previos de `dropdb/createdb`.

## Hallazgos críticos

### 1. El formulario puede exponer credenciales en la URL si se envía antes de hidratar

- Problema: Los formularios de credenciales y 2FA no declaran `method`. Si React todavía no hidrata, si el bundle falla, o si el submit nativo se dispara antes de enganchar `handleSubmit`, el navegador usa el método GET por defecto y serializa campos con `name` en la query string.
- Evidencia concreta en la repo: Form de 2FA en `frontend/src/app/login/LoginClient.tsx:263`; form de credenciales en `frontend/src/app/login/LoginClient.tsx:366`; inputs registrados con `react-hook-form` generan `name="email"`, `name="password"` y `name="code"` (`LoginClient.tsx:384`, `411`, `312`). Durante la prueba Playwright/dev se observó en logs de Next: `GET /login?email=doc%40test.cl&password=Password1`.
- Impacto UX: Riesgo real de privacidad: email, contraseña o código 2FA pueden quedar en historial, logs, analytics, capturas de soporte o cabeceras referer posteriores. En una app clínica, esto daña seriamente la confianza aunque el flujo hidratado normal funcione.
- Recomendación: Añadir `method="post"` a ambos formularios como mínimo defensivo. Idealmente agregar `action="/api/auth/login"` solo si se soporta progressive enhancement seguro; si no, `method="post"` sin action evita el leak por query aunque el submit sin JS falle. Añadir test/e2e que fuerce submit antes de hidratación o inspeccione que el form no pueda serializar secretos por GET.
- Prioridad: Crítica.
- Estado: Corregido. Los forms ahora tienen `method="post"` y tests de regresión.

## Hallazgos altos

### 1. El CTA principal queda fuera del primer viewport en mobile pequeño

- Problema: En 320px, el botón `Iniciar sesión` queda bajo el borde inferior inicial del viewport.
- Evidencia concreta en la repo: `frontend/src/app/login/LoginClient.tsx:200` usa `AuthFrame` con hero + card; `frontend/src/app/globals.css:636-703` fija el hero mobile en una franja alta y el card debajo. Medición Playwright en 320x720: hero `0-255`, card `y=283`, form `y=518-777`, submit `y=731-777`; el viewport termina en `720`.
- Impacto UX: En móviles pequeños, el usuario ve campos pero no siempre ve el CTA sin scroll. Esto aumenta fricción en una pantalla de alta intención.
- Recomendación: En `<768px`, reducir la franja hero o convertirla en header compacto: logo + título breve dentro del card, ocultando subtítulo largo o moviéndolo debajo del título del card. Objetivo: submit visible antes de `y=680` en 320x720.
- Prioridad: Alta.
- Estado: Corregido. En 320x720 el submit queda en `y=557-603`.

### 2. 2FA provoca salto de scroll por `autoFocus` en mobile

- Problema: Al pasar a 2FA, el campo `#totp-code` usa `autoFocus`, lo que desplaza la página en mobile.
- Evidencia concreta en la repo: `frontend/src/app/login/LoginClient.tsx:311` define `autoFocus`. Medición Playwright en 320x720 tras login con 2FA: `scrollY=289`, hero `y=-289`, card `y=-6`, submit 2FA `y=640-686`.
- Impacto UX: El usuario pierde contexto visual del paso, el header queda fuera de pantalla, y el scroll automático puede sentirse brusco en teclado móvil.
- Recomendación: Aplicar autoFocus solo en desktop con media query/hook, o enfocar después de que el usuario toque el método 2FA. En mobile, mantener scroll estable y usar `scroll-margin-top` si se decide enfocar.
- Prioridad: Alta.
- Estado: Corregido. Se quitó `autoFocus`; 2FA queda sin `scrollY` automático y el submit en `y=665-711` en 320x720.

### 3. El error global de credenciales tiene contraste insuficiente

- Problema: `ErrorAlert` usa `text-status-red` para texto, equivalente a `#D08C84`, sobre fondo claro rojo al 10%; el contraste calculado contra blanco es 2.70:1, bajo WCAG AA para texto normal.
- Evidencia concreta en la repo: `frontend/src/components/common/ErrorAlert.tsx:18` usa `text-status-red`; token en `frontend/tailwind.config.js:44-45` separa `status.red` y `status.red-text`. Captura de credenciales inválidas mostró color computado `rgb(208, 140, 132)`.
- Impacto UX: Usuarios con baja visión pueden no leer el error más importante del flujo.
- Recomendación: Cambiar el texto de `ErrorAlert` a `text-status-red-text` y dejar `status-red` solo para borde/icono suave. Mantener `role="alert"` y `aria-live`.
- Prioridad: Alta.
- Estado: Corregido. `ErrorAlert` usa `text-status-red-text`.

## Hallazgos medios

### 1. Targets táctiles secundarios bajo 44px

- Problema: Enlaces y controles secundarios son visualmente pequeños: `¿Olvidaste tu contraseña?` mide 155x16; `Términos` 57x16; `Privacidad` 63x16; toggle de contraseña 36x36.
- Evidencia concreta en la repo: `frontend/src/app/login/LoginClient.tsx:399`, `413-420`, `229-235`; estilos en `frontend/src/app/globals.css:558-559`, `592-594`, `769-779`. Medición Playwright 320x720 confirma alturas de 16px y 36px.
- Impacto UX: Son difíciles de tocar con una mano, especialmente en mobile.
- Recomendación: Subir hit areas con `min-h-11`, padding invisible y `touch-manipulation`. El texto puede seguir pequeño, pero el área clicable no.
- Prioridad: Media.
- Estado: Corregido para login. Toggle y enlaces principales auditados quedaron en 44px mínimos.

### 2. El link de recuperación aparece antes del campo contraseña en el orden de tabulación

- Problema: El orden de foco en desktop/mobile es email -> recuperación -> password -> mostrar contraseña -> submit.
- Evidencia concreta en la repo: El link está en el header del bloque de contraseña, antes del `<input>` (`frontend/src/app/login/LoginClient.tsx:394-412`). Focus Playwright en 1024x768: email, `¿Olvidaste tu contraseña?`, password, toggle, submit.
- Impacto UX: Para teclado, el flujo de entrada se interrumpe antes de completar la contraseña.
- Recomendación: Mantener el enlace visual arriba/derecha si se desea, pero moverlo en DOM después del input o usar layout CSS para posicionarlo sin alterar el orden lógico.
- Prioridad: Media.
- Estado: Corregido. El enlace de recuperación quedó después del CTA principal.

### 3. El fallback de loading usaba spinner genérico y texto con tres puntos

- Problema: El fallback de Suspense usaba spinner circular y `Cargando acceso...`.
- Evidencia concreta en la repo: Antes estaba duplicado en `frontend/src/app/login/page.tsx` y `frontend/src/app/login/LoginClient.tsx`; ahora ambos usan `LoginFallback` (`frontend/src/app/login/page.tsx:9`, `frontend/src/app/login/LoginClient.tsx:55`). El skeleton vive en `frontend/src/app/login/LoginFallback.tsx:1-31` y sus dimensiones en `frontend/src/app/globals.css:537-597`.
- Impacto UX: El estado inicial se siente menos premium y no sigue la guía tipográfica actual que prefiere `…`. En login, el spinner no aporta estructura ni reduce layout shift percibido.
- Recomendación: Cambiar a skeleton mínimo del card o estado compacto con texto `Preparando acceso…`; usar el mismo alto aproximado del card para estabilidad.
- Prioridad: Media.
- Estado: Corregido. El fallback ahora es un skeleton estructural accesible y reutilizable.

### 4. El microcopy del hero repite confianza, pero no aclara privacidad concreta

- Problema: `trazabilidad`, `permisos activos`, `acceso protegido` y `sesiones resguardadas` se repiten, pero falta una señal concreta de privacidad o ámbito clínico.
- Evidencia concreta en la repo: `frontend/src/app/login/LoginClient.tsx:204-221` y `LOGIN_CHIPS` en `frontend/src/app/login/LoginClient.tsx:42-48`.
- Impacto UX: La pantalla se siente confiable, pero el mensaje podría ser más específico para salud y datos sensibles.
- Recomendación: Sustituir una repetición por una promesa concreta: "Tus sesiones usan cookies seguras y permisos por rol." o "Acceso auditado para equipos clínicos autorizados."
- Prioridad: Media.
- Estado: Pendiente. No se cambió el mensaje del hero para evitar mover posicionamiento de marca sin validación de producto.

### 5. La vista tablet queda muy vertical y desperdicia espacio

- Problema: En 768px, el layout todavía apila hero y card; el submit queda en `y=959-1005` dentro de un viewport de 1024.
- Evidencia concreta en la repo: `frontend/src/app/globals.css:404-405` activa grid solo en `lg`; medición 768x1024: hero `h=499`, panel inicia en `y=499`, card `y=527-1151`.
- Impacto UX: En tablet, la pantalla parece larga y obliga a recorrer más de lo necesario.
- Recomendación: Introducir un breakpoint `md` específico: hero compacto horizontal o grid de dos columnas desde 768px con proporción más suave.
- Prioridad: Media.
- Estado: Parcial. El CTA principal queda visible en 768px tras compactación, pero la composición tablet sigue pendiente de rediseño.

## Hallazgos bajos

### 1. Placeholders no siguen la convención de ejemplo con elipsis

- Problema: Los placeholders son ejemplos estáticos (`nombre@clinica.cl`, `000000`, `ABCD-EFGH`) sin elipsis.
- Evidencia concreta en la repo: `frontend/src/app/login/LoginClient.tsx:308`, `381`, `408`; guideline web actual recomienda ejemplos con `…`.
- Impacto UX: Bajo. Los labels existen y son claros; esto es consistencia de interfaz.
- Recomendación: Usar `nombre@clinica.cl…` si se adopta la regla global. Para contraseña, considerar no usar placeholder de bullets y dejar helper accesible si hace falta.
- Prioridad: Baja.
- Estado: Corregido para login. Email y 2FA usan ejemplos con `…`; contraseña cambió a texto claro.

### 2. Iconos dentro de chips no están marcados como decorativos

- Problema: Los iconos de `LOGIN_CHIPS` se pasan como nodos sin `aria-hidden`.
- Evidencia concreta en la repo: `frontend/src/app/login/LoginClient.tsx:44` y render en `frontend/src/components/auth/AuthFrame.tsx:65`.
- Impacto UX: Bajo, porque los SVG de `react-icons` no suelen tener nombre accesible útil, pero es más limpio marcarlos decorativos.
- Recomendación: Pasar `aria-hidden="true"` en iconos de chips o envolverlos con `span aria-hidden`.
- Prioridad: Baja.
- Estado: Corregido en login.

### 3. Estilos auth demasiado concentrados en `globals.css`

- Problema: El bloque de auth ocupa muchas reglas globales y mezcla variants, layout, tokens locales y overrides.
- Evidencia concreta en la repo: `frontend/src/app/globals.css:403-823`.
- Impacto UX: Bajo directo, medio en mantenimiento: cambios de login/register/forgot pueden tener efectos laterales.
- Recomendación: Mover auth a componentes o CSS module local, conservando tokens globales. Separar `AuthFrame`, form controls auth y variantes.
- Prioridad: Baja.

### 4. Logo inline usa `dangerouslySetInnerHTML`

- Problema: El logo inline se inyecta como string SVG.
- Evidencia concreta en la repo: `frontend/src/components/branding/AnamneoLogo.tsx:21-54`.
- Impacto UX: Bajo si el string es estático, pero reduce mantenibilidad y complica auditorías de accesibilidad/seguridad visual.
- Recomendación: Convertir a componente SVG typed o usar el asset con `currentColor` preparado.
- Prioridad: Baja.

## Quick wins

- Hecho: Cambiar `ErrorAlert` de `text-status-red` a `text-status-red-text`.
- Hecho: Añadir `method="post"` a los formularios de credenciales y 2FA.
- Hecho: Reemplazar `Cargando acceso...` por `Preparando acceso…`.
- Hecho: Quitar `autoFocus` móvil en `#totp-code`.
- Hecho: Aumentar hit area de links secundarios y toggle de contraseña a 44px mínimos.
- Hecho: Mover recuperación de contraseña después del CTA principal en DOM.
- Hecho: Reducir hero mobile y esconder el subtítulo en 320-390px.
- Hecho: Marcar iconos decorativos de chips con `aria-hidden="true"`.
- Hecho: Usar `noValidate` en los forms para que Zod sea la fuente de mensajes.
- Hecho: Reemplazar el spinner inicial por un skeleton de card estable.

## Recomendaciones de rediseño

- Layout: En mobile, usar una composición de una sola columna con card más arriba. El hero debería ser un bloque compacto de marca de 140-170px, no una sección de 255px.
- Jerarquía visual: El `h1` del hero funciona en desktop; en mobile compite con el card. Priorizar `Anamneo + Iniciar sesión` y mover la promesa de confianza a una línea breve dentro del card.
- Copy: Cambiar de "Acceso seguro a tu espacio clínico." a una frase más concreta y menos genérica sobre acceso clínico auditado.
- Estados de error: Mantener error global encima del form para credenciales inválidas, pero con color legible y copy que no enumere cuentas. Para validaciones de campo, conservar errores inline.
- Estados de carga: Mantener el skeleton de Suspense y revisar en una iteración posterior si los spinners internos de botones deben convertirse en indicadores sin rotación.
- Mobile: CTA visible sin scroll en 320x720; links secundarios con hit area mayor; evitar autofocus que fuerce scroll.
- Accesibilidad: Corregir contraste de error global, ordenar tabulación según flujo de entrada, aumentar targets táctiles y evitar foco automático móvil.
- Confianza y seguridad percibida: Mantener señales de 2FA, auditoría y permisos, pero hacerlas específicas: rol, sesión segura, trazabilidad. No exagerar con claims absolutos.

## Propuesta de copy mejorado

- Título principal: Acceso clínico auditado
- Subtítulo: Entra a tu espacio Anamneo con permisos por rol y sesiones protegidas.
- Label email: Correo profesional
- Label contraseña: Contraseña
- Placeholder email: nombre@clinica.cl
- Placeholder contraseña: Tu contraseña
- CTA principal: Iniciar sesión
- Texto de loading: Verificando acceso…
- Error genérico de login: No pudimos iniciar sesión. Revisa tus credenciales o recupera tu contraseña.
- Enlace de recuperación de contraseña: Recuperar contraseña
- Enlace de registro, si aplica: Crear cuenta del espacio clínico

## Checklist de accesibilidad

- Labels asociados correctamente a inputs: Cumple. `htmlFor`/`id` en email, contraseña y 2FA (`LoginClient.tsx:368-384`, `396-411`, `290-310`).
- Tipos y autocomplete adecuados: Cumple. Email, current-password, one-time-code (`LoginClient.tsx:375-379`, `405-407`, `301-305`).
- Mensajes inline de validación: Cumple. Errores por campo con `role="alert"` (`LoginClient.tsx:387-390`, `422-425`, `328-331`).
- Error global accesible: Cumple. Tiene `role="alert"`, `aria-live` y texto con token de contraste alto (`ErrorAlert.tsx:10-18`).
- Contraste de elementos principales: Cumple. CTA blanco sobre teal calculado 5.84:1; texto secundario sobre blanco 7.09:1.
- Contraste de error global: Cumple. El texto usa `status-red-text`; `status-red` queda para borde/icono suave.
- Navegación por teclado: Cumple en login. Orden actual: email, password, mostrar/ocultar contraseña, submit, recuperar contraseña, legales.
- Focus states visibles: Cumple. Inputs, botones y links tienen focus ring o estilo visible en tokens globales/auth.
- Tamaños táctiles mobile: Cumple en login. Inputs/CTA, toggle y enlaces principales medidos en 44px o más.
- Orden lógico de headings: Cumple. `h1` hero y `h2` card (`AuthFrame.tsx:58-91`).
- Evita depender solo del color: Parcial. Errores tienen texto e icono, pero estados 2FA usan color + texto; correcto en general.
- Lectores de pantalla: Cumple en el flujo auditado. Iconos decorativos de chips/pasos se marcaron con `aria-hidden` cuando correspondía.
- Responsive sin overflow: Cumple. Playwright en 320, 375, 390, 768, 1024 y 1440 no detectó overflow horizontal.
- Respeta reducción de movimiento: Cumple en el login auditado. El skeleton usa opacidad y queda cubierto por `prefers-reduced-motion`; el fallback ya no depende de spinner circular.
- Submit seguro antes de hidratación: Cumple. Los forms declaran `method="post"` y se cubrió con test.

## Plan de implementación

### 1. Cambios inmediatos

- Hecho: Corregir contraste en `ErrorAlert`.
- Hecho: Añadir `method="post"` a ambos formularios y cubrirlo con test.
- Hecho: Cambiar textos de loading a `…`.
- Hecho: Aumentar área táctil de links secundarios y toggle.
- Hecho: Quitar `autoFocus` del 2FA en mobile.
- Hecho: Ajustar copy del error genérico de login.

### 2. Cambios de corto plazo

- Hecho: Compactar hero mobile para que el CTA quede visible en 320x720.
- Hecho: Reordenar DOM del link de recuperación.
- Añadir prueba de login para toggle de contraseña y estado loading bloqueado.
- Hecho: Añadir caso visual/e2e automatizado para 320px y 2FA (`frontend/tests/e2e/login-responsive.spec.ts`).
- Pendiente ambiental: Ejecutar el spec nuevo en un entorno con Postgres local válido para `anamneo_owner`.
- Revisar forgot-password para alinearlo visualmente con `AuthFrame`, porque hoy usa un card más genérico (`frontend/src/app/forgot-password/page.tsx:42-110`).

### 3. Cambios de diseño más profundos

- Extraer estilos auth de `globals.css` a una capa local o componentes dedicados.
- Definir tokens auth específicos en Tailwind/documentación para evitar hex locales repetidos.
- Convertir `AnamneoLogo` inline a componente SVG mantenible.
- Diseñar un patrón común de pantallas públicas: login, register, forgot-password, cambiar contraseña y portal login.

## Resultado esperado

Después de aplicar las mejoras, el login debería sentirse más directo y estable: marca clínica clara, CTA visible en mobile, errores legibles, navegación por teclado sin interrupciones, 2FA sin saltos bruscos, y señales de seguridad concretas sin ruido. La pantalla ya tiene una buena base; el siguiente paso es hacer que la primera interacción en móvil sea tan precisa y confiable como la versión desktop.

## Faltante y siguientes pasos naturales

- Ejecutar `npm --prefix frontend run test:e2e -- tests/e2e/login-responsive.spec.ts` cuando las credenciales locales de Postgres para `anamneo_owner` estén alineadas con `.env`/Playwright.
- Homologar `forgot-password`, `cambiar-contrasena`, `register` y `portal/login` con el patrón actualizado de `AuthFrame`.
- Extraer los estilos auth de `globals.css` a una capa local o componentes dedicados; el bloque auth sigue siendo demasiado grande y global.
- Convertir el SVG inline de `AnamneoLogo` a componente mantenible o asset preparado para `currentColor`.
- Revisar tablet 768px con una decisión de diseño propia: hoy el CTA principal queda visible, pero la página sigue larga y el footer baja fuera del primer viewport.
- Revisar si los spinners internos de botones (`Iniciando sesión…`, `Verificando…`) deben migrar a un indicador de progreso más sobrio y sin rotación.
