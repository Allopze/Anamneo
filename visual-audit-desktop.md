# Inspección Visual Desktop — Anamneo

**Fecha:** 2026-06-02  
**Screenshots:** 45 pantallas desktop (1280×900 · fullPage)  
**Generados con:** `tests/e2e/visual-full-app.spec.ts`

---

## 🔴 Alta Prioridad

### 1. Topbar — Skeleton permanente en páginas de Admin

**Páginas afectadas:** `dashboard__admin`, `pacientes__list`, `pacientes__detail`, `pacientes__admin`, `agenda__week`, `admin__auditoria`, `admin__solicitudes`, `admin__usuarios`

El área del topbar donde deberían aparecer breadcrumbs o stat chips se queda en un rectángulo gris de carga. En el rol Médico la misma zona carga correctamente (`0 Activas · 0 Pendientes · 1 Completadas`). Parece un race condition que afecta exclusivamente al rol Admin.

### 2. Seguimientos — Overflow del filtro "Solo atrasados"

El label del checkbox está cortado, solo se lee `Solo atra…`. El contenedor de filtros no tiene overflow o hace wrap, y el elemento final queda fuera del viewport visible.

### 3. Reportes — Skeleton no resuelto en las stat cards

El selector de fecha `02-06-2026` muestra bien, pero los 4 cards debajo siguen en estado gris de carga. El fetch de datos es demasiado lento relativo al `waitForLoadState('networkidle')`.

---

## 🟠 Media Prioridad

### 4. Auth — Asimetría en el panel izquierdo de Login / Register / Portal Login

"Trazabilidad clínica" aparece con tarjeta bordeada completa (card), mientras "Cifrado de extremo a extremo" aparece solo con ícono + texto sin borde. En el portal login la asimetría es más obvia: hay 2 features con card completa y 1 feature sin card. La jerarquía visual de los feature callouts no es consistente entre sí.

### 5. Forgot-Password — Layout diferente al resto del flujo de auth

Login y Register usan split de 2 columnas con panel de marca a la izquierda. Forgot-password es un card centrado sobre fondo gris sólido. El flujo de autenticación tiene 3 patrones de layout distintos.

### 6. Portal Activar — Sin branding

La página de activación del portal es un card aislado sin logo, nombre del producto ni panel lateral. Es la única página pública que carece de identidad de marca. Contrasta con todas las demás pantallas de onboarding.

### 7. Portal Atención Detail — Estado "Completa" / "Pendiente" sin color

Ambos estados se muestran como texto gris sin diferenciación cromática. "Completa" debería ser verde, "Pendiente" puede quedar gris. Actualmente las secciones completadas y pendientes se ven idénticas a primera vista.

### 8. Auditoría — Filtros de rango de fecha disociados

Los dropdowns Acción, Entidad, Usuario, Motivo, Resultado, Desde están en una fila, y en la segunda fila está `Request ID` + `Hasta`. Los filtros `Desde` y `Hasta` deberían estar juntos como par de rango de fecha.

---

## 🟡 Baja Prioridad / Inconsistencias

### 9. Catálogo Nueva Afección — Campo "Nombre" sin placeholder

Sinónimos y Tags tienen placeholders descriptivos (`cefalea, jaqueca, …` / `neurológico, dolor, …`). El campo Nombre está vacío sin texto de ayuda.

### 10. Pacientes Nuevo vs Editar — Checkbox "Sin RUT" inconsistente

En `/nuevo`: el checkbox aparece debajo del campo RUT como línea simple. En `/editar`: el checkbox aparece a la derecha del campo RUT con descripción de cuándo usarlo. Misma funcionalidad, diferente nivel de detalle y layout.

### 11. Portal Home — Espacio vacío excesivo

La página tiene 2 cards (Datos generales + Atenciones finalizadas) y luego ~500px de espacio vacío gris. Con datos mínimos da sensación de página incompleta.

### 12. Portal Historial de Accesos — Badges de actor inconsistentes

El actor desconocido muestra un `?` con fondo gris neutro. Los actores conocidos muestran iniciales (`DV`) con un fondo gris ligeramente diferente. El relleno de los badges no es el mismo entre ambos tipos.

### 13. Atención Detail — "Reasignar atención" siempre visible

El formulario de reasignación (Select + campo de motivo + checkbox + botón) está expuesto directamente en el panel derecho sin estar detrás de un toggle o sección colapsable. Agrega ruido cognitivo en la vista principal de una atención.

### 14. Pacientes Admin — Botón "Volver a pacientes" aislado

El botón secundario aparece en el extremo superior derecho de la página, alejado del contenido. A medida que el usuario scrollea hacia abajo pierde referencia a la navegación de retorno.

### 15. Dashboard Médico — CTA secundarios de Guía Inicial sin estilo de botón

Los links de acción a la derecha de cada paso (Ir al inicio, Nuevo paciente, etc.) son texto plano sin apariencia de botón. No hay affordance visual claro de interactividad.

### 16. Ajustes Perfil — Badge de rol sin grupo semántico

La pastilla `ADMIN` aparece debajo del campo Email sin alineación clara con ningún label. Visualmente flota sin un grupo semántico definido.

---

## Observaciones generales

- La consistencia de sidebar + layout de dashboard es sólida a través de todas las vistas de Médico.
- Los empty states están todos bien ejecutados: ícono centrado, título, descripción, CTA. Ninguno se ve descuidado.
- Los stat card headers son consistentes en padding, tipografía y jerarquía.
- El portal paciente tiene deliberadamente un diseño más simple que la app clínica. La diferenciación es apropiada, pero algunas páginas del portal (especialmente `/portal/activar`) necesitan algo más de identidad de marca.
