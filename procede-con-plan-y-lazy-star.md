# Estado: fixes de inspección visual desktop (Anamneo)

## Contexto

La inspección visual desktop (`visual-audit-desktop.md`, 45 screenshots) levantó 16 hallazgos. Primero se corrigieron los bugs e inconsistencias de bajo riesgo (#1, #2, #5, #6, #7, #8, #9). Luego se amplió el alcance para cerrar los ítems restantes (#3, #4, #10-#16) con cambios conservadores, respetando el registro de producto: UI clínica sobria, predecible, sin rediseños grandes ni cambios de flujo innecesarios.

## Fixes aplicados

### #1 Topbar admin atrapado en skeleton
**Archivo:** `frontend/src/components/layout/SmartHeaderBar.tsx`
- Se detecta `isAdminUser(user)`.
- Se deshabilita la query clínica de KPIs para admin.
- `showSkeleton` ya no puede activarse para admin en rutas clínicas.

### #2 Seguimientos: filtro "Solo atrasados" recortado
**Archivo:** `frontend/src/app/(dashboard)/seguimientos/page.tsx`
- Se redujeron los mínimos del grid `xl`.
- Se agregó `whitespace-nowrap` al label del checkbox.

### #3 Reportes: skeleton de stat cards no resuelto
**Archivo:** `frontend/src/app/(dashboard)/reportes/page.tsx`
- Se agregó `retry: false` a la query del resumen diario.
- Resultado: si el endpoint falla o no está permitido, la pantalla sale rápido del skeleton y muestra el estado de error existente.

### #4 Auth: asimetría visual entre chips y hero footer
**Archivos:**
- `frontend/src/app/styles/auth/base.css`
- `frontend/src/app/styles/auth/compact.css`
- El `heroFooter` ahora usa el mismo lenguaje de superficie que los chips del hero.
- Login, register, portal login y forgot-password quedan más consistentes sin tocar cada pantalla.

### #5 Forgot-password fuera del layout de auth
**Archivo:** `frontend/src/app/forgot-password/page.tsx`
- Se migró al `AuthFrame` compartido con `variant="loginCompact"`.
- Se reutilizan chips de trazabilidad y footer de cifrado.
- El estado de éxito y el formulario mantienen la lógica existente.

### #6 Portal activar sin branding
**Archivo:** `frontend/src/app/portal/activar/page.tsx`
- Se agregó `AnamneoLogo`.
- Se agregó el contexto visual "Portal paciente".

### #7 Portal atención detail: estado sin color
**Archivo:** `frontend/src/app/portal/atenciones/[id]/page.tsx`
- El badge "Completa" usa `status-green`.
- "Pendiente" y "No aplica" siguen neutros.

### #8 Auditoría: rango de fechas disociado
**Archivo:** `frontend/src/app/(dashboard)/admin/auditoria/AuditFiltersPanel.tsx`
- `Request ID` se movió antes del rango.
- `Desde` y `Hasta` quedaron dentro de un grid anidado conjunto.

### #9 Catálogo nueva afección: campo "Nombre" sin placeholder
**Archivos:**
- `frontend/src/app/(dashboard)/catalogo/nueva/page.tsx`
- `frontend/src/app/(dashboard)/catalogo/medicamentos/nueva/page.tsx`
- Se agregó placeholder al campo Nombre en afecciones.
- Se replicó el patrón en medicamentos.

### #10 Pacientes nuevo vs editar: checkbox "Sin RUT" inconsistente
**Archivo:** `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx`
- El bloque de RUT ahora sigue el patrón de edición: input + panel lateral "Paciente sin RUT".
- Se agregó texto contextual de cuándo usar la exención.
- El motivo de exención usa el mismo estilo de callout.

### #11 Portal home: espacio vacío excesivo
**Archivo:** `frontend/src/app/portal/page.tsx`
- Se reorganizó el contenido en dos columnas en desktop.
- Se agregó un bloque de "Accesos y solicitudes" con enlaces existentes a historial y solicitudes.
- El portal queda más completo cuando hay pocos datos o atenciones vacías.

### #12 Portal historial de accesos: badges de actor inconsistentes
**Archivo:** `frontend/src/app/portal/historial-acceso/page.tsx`
- Se normaliza `actorInitials` con fallback `?`.
- Todos los actores usan el mismo tamaño, borde y superficie.

### #13 Atención detail: "Reasignar atención" siempre visible
**Archivos:**
- `frontend/src/components/ReassignmentCard.tsx`
- `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`
- `ReassignmentCard` ahora soporta `defaultCollapsed`.
- En la atención detail el formulario inicia colapsado detrás de un disclosure inline.
- No se introdujo modal.

### #14 Pacientes admin: botón "Volver a pacientes" aislado
**Archivo:** `frontend/src/app/(dashboard)/pacientes/[id]/administrativo/page.tsx`
- El link de retorno ahora está integrado arriba del título de la ficha administrativa.
- Se removió como acción aislada en el extremo derecho.

### #15 Dashboard médico: CTAs secundarios de guía inicial sin affordance
**Archivo:** `frontend/src/components/onboarding/OnboardingPanel.tsx`
- Los links de cada paso mantienen estilo de botón.
- Se agregó `FiChevronRight` para reforzar affordance de navegación.

### #16 Ajustes perfil: badge de rol sin grupo semántico
**Archivo:** `frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx`
- El badge ahora está agrupado bajo label "Rol".
- Se agregó fallback "Sin rol asignado".

## Validación ejecutada

- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test`

Todo pasó después de los fixes ampliados.

## Faltante actual

### Validación pendiente
- Regenerar screenshots visuales con Playwright:
  `PLAYWRIGHT_E2E_RUN_ID=visual-verify npx playwright test tests/e2e/visual-full-app.spec.ts --project=chromium`
- Comparar pantallas afectadas:
  `dashboard__admin`, `pacientes__list`, `seguimientos__list`, `reportes__list`, `admin__auditoria`, `portal__atencion-detail`, `public__forgot-password`, `portal__activar`, `catalogo__afeccion-new`, `pacientes__new`, `pacientes__edit`, `portal__home`, `portal__historial-acceso`, `atenciones__detail`, `pacientes__admin`, `dashboard__medico`, `ajustes__perfil`.

### Sanity manual pendiente
- Admin en `/pacientes`: topbar sin skeleton.
- Médico en `/seguimientos` a 1280px: filtro "Solo atrasados" completo.
- Usuario con acceso a `/reportes`: error rápido si el endpoint no está permitido, sin skeleton infinito.
- Auth login/register/portal/forgot: hero chips y footer visualmente consistentes.
- Atención detail: formulario de reasignación colapsado inicialmente.

### Riesgo residual
- No hay comparación visual automatizada todavía en esta ejecución.
- El worktree tenía cambios previos ajenos en backend, pacientes, screenshots y algunos componentes; estos fixes se aplicaron sobre ese estado sin revertir cambios existentes.
