# Auditoría de bugs de interacción y uso de Anamneo

Fecha: 2026-04-10

Metodología aplicada:
- Recorrido funcional manual asistido con Playwright local en desktop y mobile.
- Revisión de rutas, componentes, handlers, hooks, mutaciones y sincronización UI/backend.
- Pruebas sobre flujos críticos con rol médico y rol administrador.
- Los hallazgos `H-07` y `H-08` se confirmaron por código y no se ejecutaron de forma destructiva para no alterar innecesariamente el entorno.

Pantallas y flujos auditados:
- Login y bootstrap de sesión.
- Alta de paciente.
- Detalle de paciente y creación de atención.
- Editor de atención y vista `Ficha Clínica`.
- Seguimientos.
- Ajustes.
- Administración de usuarios.
- Header global, chips/KPIs y búsqueda.

## 1. Resumen ejecutivo
La app no se siente confiable todavía para uso clínico diario. La base visual es razonable y varias pantallas cargan bien, pero encontré demasiados casos donde el click no produce exactamente el resultado que la UI promete, o produce un resultado técnicamente válido pero operacionalmente peligroso.

Lo más grave no es un botón roto aislado, sino la combinación de tres patrones: la UI guarda datos que el usuario nunca eligió, marca pasos como completos cuando no lo están, y permite navegar a vistas “oficiales” que contradicen el último estado editado. En un producto médico, eso erosiona la confianza muy rápido.

## 2. Nota global de confiabilidad funcional
**4/10**

Hoy no confiaría ciegamente en que “si hago click, pasa lo correcto” en todos los flujos críticos. Hay suficiente fragilidad como para inducir errores humanos reales.

## 3. Tabla de hallazgos
| ID | Severidad | Pantalla o flujo | Elemento clicable | Acción esperada | Comportamiento real | Impacto | Evidencia técnica | Causa probable | Recomendación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-01 | Crítico | Crear paciente `/pacientes/nuevo` | `Guardar paciente` | Exigir selección explícita de `Sexo` y `Previsión` antes de crear la ficha | El formulario llega ya con `Sexo=MASCULINO` y `Previsión=FONASA` aunque el usuario no toque esos campos; el alta se guarda con esos valores | Riesgo de registrar datos demográficos falsos y condicionar decisiones clínicas/administrativas posteriores | Reproducido en navegador: al abrir el formulario, `#sexo.value === "MASCULINO"` y `#prevision.value === "FONASA"`. Código: `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx:145-150,338-368`; persistencia backend en `backend/src/patients/patients.service.ts:217-243` | Los `<select>` tienen placeholder `disabled`, pero no tienen valor inicial vacío controlado; el navegador cae en la primera opción real | Forzar `defaultValues` explícitos (`sexo: ''`, `prevision: ''`), usar selects controlados y bloquear submit hasta que el usuario elija |
| H-02 | Alto | Editor de atención `/atenciones/[id]` | `Siguiente` | Avanzar sin mentir sobre el estado de completitud de la sección | `Siguiente` marca la sección actual como `completed: true` aunque siga mostrando advertencias de identificación incompleta | Falso positivo de avance clínico; un médico puede asumir que la identificación quedó resuelta cuando no es cierto | Reproducido en flujo real. Código: `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:802-818`; también `No aplica` fuerza completitud en `:821-831` | La navegación mezcla “cambiar de paso” con “certificar completitud”, sin validación semántica previa | Separar avance visual de completitud real. Solo marcar `completed` cuando pase validaciones de negocio de la sección |
| H-03 | Alto | Editor de atención -> `Ficha Clínica` | Link `Ficha Clínica` | Abrir una vista consistente con lo último que el usuario editó o advertir que hay cambios sin guardar | Si el usuario escribe y navega enseguida a `Ficha Clínica`, la vista muestra el estado persistido anterior y omite lo recién tipeado | Alto riesgo de falsa sensación de guardado y de lectura clínica sobre datos desactualizados | Reproducido en navegador con `Motivo de consulta`: el editor tenía texto nuevo y `Ficha Clínica` mostró `-`. Código: `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:712-721,1402-1408`; `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx:292-302,480-482` | Solo se protege `beforeunload`; la navegación interna no bloquea ni fuerza guardado, y `Ficha Clínica` lee solo desde servidor | Interceptar navegación interna con cambios pendientes, o guardar/esperar antes de abrir `Ficha Clínica` |
| H-04 | Alto | Header global mobile | Botón de búsqueda (`aria-label="Buscar"`) | Abrir una búsqueda usable en mobile | El botón visible no abre ningún buscador usable; el input real está oculto porque vive dentro de una sidebar `hidden lg:flex` | CTA muerta en mobile; el usuario ve una acción disponible que no funciona | Reproducido en mobile: el input de búsqueda tiene `width: 0` y `height: 0` tras el click. Código: `frontend/src/components/layout/DashboardLayout.tsx:92-100,164-170,272,299-398,516-519`; `frontend/src/components/layout/SmartHeaderBar.tsx:438-446` | El trigger del header solo hace `setSearchOpen(true)` para una búsqueda desktop embebida en la sidebar | Implementar una búsqueda responsive real: modal, drawer o command palette disponible en mobile |
| H-05 | Alto | Seguimientos | Chip `Vencidas` desde el header | Activar filtro de atrasadas y reflejarlo en todos los controles visibles | La URL pasa a `?overdueOnly=true` y el chip queda activo, pero el checkbox `Solo atrasados` sigue desmarcado | UI contradictoria: URL, KPI activo y filtros visibles no dicen lo mismo | Reproducido en navegador: `http://127.0.0.1:5555/seguimientos?overdueOnly=true` con checkbox `false`. Código: `frontend/src/components/layout/SmartHeaderBar.tsx:199-203`; `frontend/src/app/(dashboard)/seguimientos/page.tsx:24-40,114-120` | El estado del componente se inicializa desde `searchParams` una sola vez y luego se manipula con `window.history.replaceState` sin resincronización | Sincronizar estado desde `searchParams` en un `useEffect`, o usar router/query params como única fuente de verdad |
| H-06 | Medio | Ajustes | Tabs + botón atrás del navegador | La pestaña visible debería seguir a la URL y al historial | Después de entrar a `Correo e invitaciones` y volver atrás, la URL vuelve a `/ajustes` pero la pestaña visible sigue siendo `Correo e invitaciones` | Navegación no confiable; la app rompe la expectativa básica del historial | Reproducido en navegador: tras `goBack()`, URL `/ajustes` con tab activo `Correo e invitaciones`. Código: `frontend/src/app/(dashboard)/ajustes/page.tsx:70-82` | El tab activo se toma desde `searchParams` solo al montar y luego se empuja con `pushState`, sin escuchar cambios posteriores | Sincronizar `activeTab` con `searchParams` o delegar toda la fuente de verdad al router |
| H-07 | Alto | Admin -> Usuarios | Botón `Desactivar` / `Activar` | Pedir confirmación antes de una acción destructiva sobre cuentas | El click dispara directamente la mutación de activación/desactivación sin paso intermedio | Desactivación accidental de usuarios y bloqueo operativo evitable | Confirmado por código: mutación en `frontend/src/app/(dashboard)/admin/usuarios/page.tsx:266-275`; click directo en `:734-737` | Falta una capa de confirmación para una acción destructiva y sensible | Agregar `ConfirmModal` con texto explícito, impacto y usuario afectado |
| H-08 | Medio | Modales de confirmación | Backdrop y `X` en `ConfirmModal` | Durante `loading`, el modal debería quedar estable y no desaparecer hasta terminar la acción | El backdrop y la `X` siguen cerrando el modal aunque la operación esté en curso; solo los botones inferiores respetan `loading` | Feedback inconsistente y sensación de “no sé si la acción siguió, falló o quedó colgada” en archivado/finalización/eliminación | Confirmado por código: `frontend/src/components/common/ConfirmModal.tsx:67,89-106`. Este modal se usa para archivar paciente y finalizar/eliminar en atención: `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx:930-939`, `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:1880-1905` | La protección de estado pendiente está aplicada a los botones, pero no a los cierres alternativos del modal | Deshabilitar backdrop, `Esc` y `X` mientras `loading === true`; mostrar estado pendiente inequívoco |

## 4. Bugs críticos
- `H-01`: el alta de paciente puede guardar `Sexo` y `Previsión` incorrectos sin consentimiento explícito del usuario. En contexto médico esto es directamente peligroso.
- `H-02`: el wizard de atención marca secciones como completas aunque el propio flujo sigue advirtiendo que faltan datos clave.
- `H-03`: la app permite abrir una `Ficha Clínica` que contradice lo recién editado, creando falsa sensación de persistencia.
- `H-07`: la desactivación de usuarios operativos se ejecuta sin confirmación, con riesgo de corte operativo por click accidental.

## 5. Bugs por tipo
### Navegación
- `H-03`: navegación interna a `Ficha Clínica` sin resolver cambios pendientes.
- `H-04`: búsqueda global mobile visible pero inusable.
- `H-05`: navegación por chip/KPI deja URL y filtros desacoplados.
- `H-06`: tabs de Ajustes no respetan correctamente el historial.

### Botones y CTAs
- `H-02`: `Siguiente` hace más de lo que promete y certifica completitud.
- `H-04`: el botón `Buscar` en mobile es esencialmente un CTA muerto.
- `H-07`: `Desactivar`/`Activar` ejecuta un cambio sensible sin confirmación.

### Formularios
- `H-01`: el formulario de alta de paciente autoasigna valores clínicamente sensibles.

### Modales, drawers y overlays
- `H-08`: `ConfirmModal` puede cerrarse por backdrop o `X` en mitad de una acción pendiente.

### Persistencia
- `H-03`: el usuario puede creer que guardó, pero la vista oficial sigue leyendo un estado anterior.

### Feedback visual e inconsistencias UI vs estado real
- `H-02`: la UI dice “Completa” mientras sigue mostrando faltantes.
- `H-05`: el chip dice “filtro activo”, el checkbox visible dice “no”.
- `H-06`: la URL dice una cosa, la tab visible otra.

### Acciones destructivas
- `H-07`: desactivar usuario sin confirmación.
- `H-08`: modal destructivo inestable durante la ejecución.

## 6. Elementos clicables sospechosos o ambiguos
- El icono `Buscar` del header mobile parece plenamente funcional, pero hoy es engañoso: invita a una acción que no expone ninguna UI usable.
- `Siguiente` en el editor de atención no es solo navegación; también muta el estado clínico de la sección. El texto del botón no comunica esa consecuencia.
- `Desactivar` / `Activar` en usuarios tiene semántica destructiva, pero visualmente se comporta como un botón de baja fricción.
- Las acciones por icono en `Plantillas` (`editar` y `eliminar`) dependen demasiado de iconografía y hover, con poca claridad textual: `frontend/src/app/(dashboard)/plantillas/page.tsx:203-214`.

## 7. Flujos rotos o frágiles
- **Crear ficha clínica desde cero**
  - El médico puede completar nombre y fecha de nacimiento, no tocar `Sexo` ni `Previsión`, guardar, y terminar con una ficha falseada desde el primer click.

- **Documentar una atención y revisar la ficha**
  - El médico escribe, ve el editor actualizado, entra a `Ficha Clínica` y encuentra una versión vieja. Ese contraste mina inmediatamente la confianza en el producto.

- **Avanzar por el wizard clínico**
  - El flujo permite “seguir avanzando” y al mismo tiempo deja la sensación de que el paso quedó bien cerrado aunque siga incompleto.

- **Usar Seguimientos desde los KPIs del header**
  - El chip de acceso rápido activa un estado que el panel de filtros no reconoce, así que el usuario ya no sabe cuál es la verdad.

- **Navegar Ajustes con historial**
  - El usuario usa tabs y luego el botón atrás, pero el contenido visible no acompaña a la URL.

- **Gestionar usuarios**
  - Un click accidental en `Desactivar` tiene consecuencias reales sin pausa de validación.

## 8. Quick wins
- Inicializar `sexo` y `prevision` con `''` y validar selección explícita antes del submit.
- Quitar la auto-completitud implícita de `Siguiente`; la completitud debe depender de reglas, no del mero avance.
- Bloquear o interceptar navegación interna con `hasUnsavedChanges`, especialmente hacia `Ficha Clínica`.
- Convertir la búsqueda global en un patrón responsive único para desktop y mobile.
- Eliminar `window.history.pushState/replaceState` manuales donde el estado local no se resincroniza con la URL.
- Agregar confirmación obligatoria a `Activar`/`Desactivar`, con nombre del usuario y consecuencia.
- Congelar completamente `ConfirmModal` durante `loading`.

## 9. Evidencia técnica
- Alta de pacientes:
  - `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx:145-150`
  - `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx:338-368`
  - `backend/src/patients/patients.service.ts:217-243`

- Editor de atención y persistencia:
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:688-721`
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:802-831`
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:1402-1408`
  - `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx:292-302`
  - `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx:480-482`

- Header global y búsqueda:
  - `frontend/src/components/layout/DashboardLayout.tsx:92-100`
  - `frontend/src/components/layout/DashboardLayout.tsx:164-170`
  - `frontend/src/components/layout/DashboardLayout.tsx:272`
  - `frontend/src/components/layout/DashboardLayout.tsx:299-398`
  - `frontend/src/components/layout/DashboardLayout.tsx:516-519`
  - `frontend/src/components/layout/SmartHeaderBar.tsx:438-446`

- Seguimientos:
  - `frontend/src/components/layout/SmartHeaderBar.tsx:199-203`
  - `frontend/src/app/(dashboard)/seguimientos/page.tsx:24-40`
  - `frontend/src/app/(dashboard)/seguimientos/page.tsx:114-120`

- Ajustes:
  - `frontend/src/app/(dashboard)/ajustes/page.tsx:70-82`

- Administración de usuarios:
  - `frontend/src/app/(dashboard)/admin/usuarios/page.tsx:266-275`
  - `frontend/src/app/(dashboard)/admin/usuarios/page.tsx:734-737`

- Modales de confirmación:
  - `frontend/src/components/common/ConfirmModal.tsx:67,89-106`
  - `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx:930-939`
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:1880-1905`

## 10. Prioridad de arreglo
| ID | Urgencia | Esfuerzo estimado | Riesgo si no se arregla |
| --- | --- | --- | --- |
| H-01 | Inmediata | Bajo-Medio | Corrupción silenciosa de datos demográficos |
| H-02 | Inmediata | Medio | Progreso clínico engañoso y cierre semántico falso |
| H-03 | Inmediata | Medio | El usuario cree que guardó cuando no guardó |
| H-04 | Alta | Medio | Función global importante rota en mobile |
| H-05 | Alta | Bajo | Filtros y KPIs dejan de ser confiables |
| H-06 | Media-Alta | Bajo | Historial/back deja UI y URL desacopladas |
| H-07 | Inmediata | Bajo | Desactivación accidental de usuarios |
| H-08 | Alta | Bajo | Feedback inestable en acciones destructivas |

## 11. Conclusión brutalmente honesta
Anamneo todavía no da la seguridad operativa que debería dar una app médica. No está “rota por todos lados”, pero sí tiene varios puntos donde el sistema aparenta una cosa y hace otra, y ese tipo de error es exactamente el que más daño hace en uso real.

Si hoy un médico o un administrativo usa la app con confianza normal de usuario, puede terminar guardando datos que no eligió, creyendo que una sección quedó completa cuando no lo está, o leyendo una ficha que no refleja lo último que escribió. Mi lectura directa es esta: **la app aún no se siente lista para uso real clínico sin corregir primero `H-01`, `H-02`, `H-03` y `H-07`**.
---

## 12. Resolución de hallazgos (2026-04-10)

Todos los hallazgos fueron verificados contra el código fuente y confirmados como correctos. Se implementaron las siguientes correcciones:

| ID | Estado | Fix aplicado | Archivos modificados |
| --- | --- | --- | --- |
| H-01 | **Corregido** | Se agregaron `defaultValues` explícitos (`sexo: ''`, `prevision: ''`) al formulario de alta de paciente. Los selects controlados con valor inicial vacío + `<option value="" disabled>` fuerzan selección explícita; la validación Zod rechaza `''` en submit. | `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx` |
| H-02 | **Corregido** | `Siguiente` ya no marca automáticamente la sección como `completed: true`. Ahora solo guarda el contenido actual y avanza visualmente. La completitud queda reservada a validaciones explícitas o al botón `No aplica`. | `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` |
| H-03 | **Corregido** | El link `Ficha Clínica` fue reemplazado por un botón que guarda los cambios pendientes (vía `saveSectionMutation.mutateAsync`) antes de navegar. Si el guardado falla, la navegación se cancela. | `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` |
| H-04 | **Corregido** | Se agregó un overlay de búsqueda full-screen para mobile (`lg:hidden`) en `DashboardLayout`. Se activa con el mismo `onSearchOpen` del header y con `Ctrl/⌘+K`. Incluye input, resultados, cierre por `Esc` y navegación por teclado. | `frontend/src/components/layout/DashboardLayout.tsx` |
| H-05 | **Corregido** | Se agregó un `useEffect` que sincroniza `search`, `status`, `type` y `overdueOnly` desde `searchParams` cada vez que estos cambian, eliminando el desacople entre URL (chip KPI) y estado local del filtro. | `frontend/src/app/(dashboard)/seguimientos/page.tsx` |
| H-06 | **Corregido** | Se reemplazó `window.history.pushState` por `router.push()` para cambios de tab, y se agregó un `useEffect` que sincroniza `activeTab` desde `searchParams` para que el botón atrás del navegador funcione correctamente. | `frontend/src/app/(dashboard)/ajustes/page.tsx` |
| H-07 | **Corregido** | Se agregó `ConfirmModal` con mensaje explícito (nombre del usuario + consecuencia) antes de ejecutar `toggleActiveMutation`. El modal protege contra clicks accidentales tanto en activación como en desactivación. | `frontend/src/app/(dashboard)/admin/usuarios/page.tsx` |
| H-08 | **Corregido** | El backdrop, el botón `X` y la tecla `Escape` del `ConfirmModal` ahora respetan el estado `loading`. Durante una operación en curso, el modal queda completamente congelado hasta que termine. | `frontend/src/components/common/ConfirmModal.tsx` |

### Pendientes / fuera de alcance
No quedan hallazgos sin corregir de esta auditoría. Todos los H-01 a H-08 fueron resueltos.