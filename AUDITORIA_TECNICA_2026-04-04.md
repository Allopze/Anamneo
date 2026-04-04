# Auditoría Técnica Anamneo

Fecha: 2026-04-04

## 1. Resumen ejecutivo

- Estado general: la app está bastante más ordenada y validada de lo normal para un proyecto pequeño. `typecheck` frontend/backend, `build` de Next, tests frontend y `e2e` backend pasaron.
- Riesgos reales principales hoy: falta validar con un flujo real de navegador la recuperación del borrador tras `401 -> login -> volver a la atención`, y todavía no existe una UX específica para un `ADMIN` operativo que necesite consultar algo administrativo más profundo de un paciente sin entrar al detalle clínico.
- Madurez general: media. Backend sólido en validación clínica, sanitización y reglas de workflow; frontend razonable y bastante más consistente que al inicio de la auditoría.
- Usabilidad para el contexto actual: sí, razonablemente usable para un equipo pequeño de médico/asistente. Con el alcance no clínico de `ADMIN` ya aplicado, la app quedó mucho más coherente para su contexto real.
- Lo mejor del código actual: validación backend de secciones clínicas, snapshot de identificación, manejo de fechas "date-only", auditoría útil y cobertura de tests bastante decente para la escala.

## 1.1 Actualización post-fixes

### Corregido en código en esta pasada

- Se alinearon permisos frontend/tests con el backend para que `ADMIN` ya no vea como disponibles acciones clínicas que hoy el backend rechaza.
- Se definió e implementó el alcance de `ADMIN` como rol operativo no clínico.
  - Backend dejó de hacer bypass general por `isAdmin`.
  - `ADMIN` ya no puede entrar a detalle clínico de paciente, historial, clinical summary, inbox de seguimientos, lista/detalle de atenciones, adjuntos clínicos ni reapertura de atenciones.
  - Frontend dejó de exponer navegación clínica efectiva para `ADMIN` y redirige fuera de vistas clínicas.
- Se corrigió el flujo de cambio de contraseña para cerrar sesión localmente y redirigir a `/login` al invalidarse cookies y sesiones.
- Se corrigió el falso estado vacío de antecedentes cuando el historial viene serializado como string.
- Se corrigió la incoherencia entre `status` y `overdueOnly` en la bandeja de seguimientos.
- Se reintrodujo validación de RUT en formularios médicos de alta y edición.
- Se ajustó la métrica del dashboard para no rotular como "Completadas hoy" un total acumulado.
- Se agregó persistencia mínima de borrador en `sessionStorage` para atenciones en curso, acotada por `userId + encounterId`, con restauración automática al reabrir la atención.
- Se corrigió el redirect por `401` para preservar la ruta origen mediante `from`, permitiendo volver automáticamente a la atención tras login.
- Se agregó una prueba e2e de navegador para el flujo `borrador -> 401 -> login -> restauración` usando Playwright con mocks de red sobre el frontend.
- Se agregó una ficha administrativa reducida y no clínica para `ADMIN`, con endpoint backend dedicado y navegación desde la lista de pacientes.

### Lo que sigue pendiente de verdad

- Si el producto necesita que una misma persona haga tareas clínicas y administrativas, falta modelar eso explícitamente.
  - Mi recomendación sigue siendo `MEDICO` con capacidades administrativas adicionales, no reabrir el rol `ADMIN` clínico.
- Validar en ambiente real integrado el e2e de navegador nuevo con backend levantado y credenciales/cookies reales.
  - La cobertura Playwright quedó agregada sobre el frontend con mocks de red.
  - Sigue siendo útil correr además una validación manual o integrada completa antes de cerrar el riesgo como totalmente extinguido.

## 2. Hallazgos

### 2.1 Pérdida de cambios clínicos no guardados al expirar o revocarse la sesión

- Prioridad: `Crítico`
- Área afectada: `frontend/full stack`
- Archivos o módulos involucrados:
  - [api.ts](/home/allopze/dev/Anamneo/frontend/src/lib/api.ts#L35)
  - [atenciones/[id]/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/page.tsx#L543)
- Explicación concreta del problema:
  - El interceptor redirige con `window.location.replace('/login')` tras un `401`, mientras la atención usa autosave diferido de 10s y solo protege `beforeunload`.
  - Si la sesión cae entre tecleo y autosave, el texto se pierde.
- Por qué importa:
  - Puede borrar nota clínica en curso.
- Cómo reproducirlo o cómo razoné que existe:
  - Editar una sección, dejar cambios sin guardar, forzar expiración o invalidación de cookie y disparar una request.
  - El redirect no pasa por el warning de `beforeunload`.
- Propuesta de solución:
  - Persistir borrador local por `encounterId + sectionKey`.
  - Bloquear redirect automático si hay cambios pendientes.
  - Ofrecer recuperación del borrador al volver a abrir la atención.
- Complejidad estimada de arreglo: `media`

### 2.2 El frontend y su contrato de permisos dan al admin acciones que el backend rechaza

- Prioridad: `Alto`
- Área afectada: `full stack`
- Archivos o módulos involucrados:
  - [permissions.ts](/home/allopze/dev/Anamneo/frontend/src/lib/permissions.ts#L26)
  - [permission-contract.json](/home/allopze/dev/Anamneo/shared/permission-contract.json#L15)
  - [patients.controller.ts](/home/allopze/dev/Anamneo/backend/src/patients/patients.controller.ts#L35)
  - [encounters.controller.ts](/home/allopze/dev/Anamneo/backend/src/encounters/encounters.controller.ts#L37)
  - [pacientes/nuevo/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx#L61)
  - [atenciones/nueva/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/nueva/page.tsx#L14)
  - [pacientes/[id]/editar/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx#L122)
- Explicación concreta del problema:
  - Frontend habilita a `ADMIN` para crear paciente, crear atención y editar datos administrativos.
  - Backend solo permite varias de esas acciones a `MEDICO` o `ASISTENTE`.
  - Además, el contrato compartido y los tests del frontend consolidan esa expectativa incorrecta.
- Por qué importa:
  - El admin ve acciones disponibles y termina en `403`.
  - La UI promete capacidades que el sistema real no soporta.
- Cómo reproducirlo o cómo razoné que existe:
  - Entrar como admin a `/pacientes/nuevo`, `/atenciones/nueva` o edición de paciente.
  - Comparar helpers frontend con `@Roles(...)` del backend.
- Propuesta de solución:
  - Definir una sola verdad.
  - Para esta app, lo más simple es alinear frontend y tests al backend actual salvo que realmente quieran que admin opere clínicamente.
- Complejidad estimada de arreglo: `baja`

### 2.3 Los read models del admin quedan parcial o silenciosamente vacíos por scope a `admin.id`

- Prioridad: `Alto`
- Área afectada: `backend/full stack/datos`
- Archivos o módulos involucrados:
  - [medico-id.ts](/home/allopze/dev/Anamneo/backend/src/common/utils/medico-id.ts#L17)
  - [patients.service.ts](/home/allopze/dev/Anamneo/backend/src/patients/patients.service.ts#L589)
  - [patients.service.ts](/home/allopze/dev/Anamneo/backend/src/patients/patients.service.ts#L654)
  - [encounters.service.ts](/home/allopze/dev/Anamneo/backend/src/encounters/encounters.service.ts#L1440)
- Explicación concreta del problema:
  - `getEffectiveMedicoId()` devuelve `admin.id`.
  - Luego timeline, resumen clínico, lista de atenciones y dashboard filtran por `medicoId = admin.id`.
  - El admin puede abrir paciente, pero ver timeline o resumen vacíos aunque existan atenciones de médicos reales.
- Por qué importa:
  - Un vacío silencioso puede interpretarse como ausencia de historia.
- Cómo reproducirlo o cómo razoné que existe:
  - El acceso del admin al paciente se permite en [patients.service.ts](/home/allopze/dev/Anamneo/backend/src/patients/patients.service.ts#L76).
  - Los read models posteriores sí filtran por `effectiveMedicoId`.
- Propuesta de solución:
  - O admin es solo administrativo y no debe entrar a vistas clínicas.
  - O admin debe ver scope global.
  - Hoy ambas ideas están mezcladas.
- Complejidad estimada de arreglo: `media`

### 2.4 Cambio de contraseña deja una sesión fantasma en frontend

- Prioridad: `Medio`
- Área afectada: `frontend/auth`
- Archivos o módulos involucrados:
  - [auth.controller.ts](/home/allopze/dev/Anamneo/backend/src/auth/auth.controller.ts#L133)
  - [ajustes/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/ajustes/page.tsx#L215)
  - [auth-store.ts](/home/allopze/dev/Anamneo/frontend/src/stores/auth-store.ts#L57)
- Explicación concreta del problema:
  - Backend revoca sesiones y limpia cookies tras cambiar contraseña.
  - Frontend solo muestra toast y resetea el form.
- Por qué importa:
  - La UI sigue viéndose autenticada hasta la próxima request.
  - El corte de sesión ocurre tarde y sin contexto claro.
- Cómo reproducirlo o cómo razoné que existe:
  - Comparando el `clearAuthCookies` backend con el `onSuccess` del mutation frontend.
- Propuesta de solución:
  - Tras éxito, hacer `logout()` local y redirigir a login con mensaje explícito.
- Complejidad estimada de arreglo: `baja`

### 2.5 El detalle de paciente puede decir "No hay antecedentes registrados" aunque sí los haya

- Prioridad: `Medio`
- Área afectada: `frontend/UX`
- Archivos o módulos involucrados:
  - [pacientes/[id]/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/pacientes/[id]/page.tsx#L372)
  - [utils.ts](/home/allopze/dev/Anamneo/frontend/src/lib/utils.ts#L1)
- Explicación concreta del problema:
  - La renderización de cada bloque sí parsea strings con `parseHistoryField()`.
  - El empty-state evalúa los valores crudos de `patient.history`.
  - Si vienen como string almacenado, el mensaje de vacío aparece igual.
- Por qué importa:
  - "No hay antecedentes" en una app médica no es un detalle visual; puede cambiar la lectura clínica.
- Cómo reproducirlo o cómo razoné que existe:
  - Cargar historia persistida como string JSON o texto.
  - La UI puede renderizar contenido y también el mensaje de vacío.
- Propuesta de solución:
  - Calcular el empty-state usando la misma normalización parseada que usa el render.
- Complejidad estimada de arreglo: `baja`

### 2.6 El filtro "Solo atrasados" pisa el filtro de estado en Seguimientos

- Prioridad: `Medio`
- Área afectada: `backend/frontend`
- Archivos o módulos involucrados:
  - [seguimientos/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/seguimientos/page.tsx#L23)
  - [patients.service.ts](/home/allopze/dev/Anamneo/backend/src/patients/patients.service.ts#L779)
- Explicación concreta del problema:
  - La UI permite combinar `status` con `overdueOnly`.
  - Backend reemplaza `where.status` por `['PENDIENTE', 'EN_PROCESO']` cuando `overdueOnly=true`.
- Por qué importa:
  - El filtro visible no coincide con los resultados.
- Cómo reproducirlo o cómo razoné que existe:
  - Seleccionar `COMPLETADA` y activar "Solo atrasados".
  - El backend ignora el estado elegido.
- Propuesta de solución:
  - O deshabilitar combinaciones inválidas en UI.
  - O resolver una intersección coherente de filtros en backend.
- Complejidad estimada de arreglo: `baja`

### 2.7 Validación de RUT incompleta en formularios médicos de alta y edición

- Prioridad: `Medio`
- Área afectada: `frontend/formularios`
- Archivos o módulos involucrados:
  - [pacientes/nuevo/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx#L28)
  - [pacientes/[id]/editar/page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx#L58)
  - [patients.service.ts](/home/allopze/dev/Anamneo/backend/src/patients/patients.service.ts#L89)
- Explicación concreta del problema:
  - El schema base sí valida RUT.
  - El schema completo para médico no replica esa regla.
  - El form de edición tampoco la aplica de forma consistente.
- Por qué importa:
  - El usuario recibe error tardío del backend en un dato central de identidad.
- Cómo reproducirlo o cómo razoné que existe:
  - Comparando schemas frontend con la validación backend.
- Propuesta de solución:
  - Extraer la validación de RUT a una refinación compartida y reutilizarla.
- Complejidad estimada de arreglo: `baja`

### 2.8 El dashboard rotula "Completadas hoy" pero muestra completadas acumuladas

- Prioridad: `Bajo`
- Área afectada: `frontend/backend/UX`
- Archivos o módulos involucrados:
  - [page.tsx](/home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/page.tsx#L113)
  - [encounters.service.ts](/home/allopze/dev/Anamneo/backend/src/encounters/encounters.service.ts#L1452)
- Explicación concreta del problema:
  - Backend cuenta todas las atenciones `COMPLETADO`.
  - Frontend lo presenta como "Completadas hoy".
- Por qué importa:
  - Induce lectura operativa equivocada.
- Cómo reproducirlo o cómo razoné que existe:
  - Comparando etiqueta del dashboard con el query del backend.
- Propuesta de solución:
  - Cambiar la etiqueta o agregar filtro real por fecha.
- Complejidad estimada de arreglo: `baja`

### 2.9 Los tests cubren bastante, pero refuerzan un contrato equivocado y dejan huecos justo donde hoy hay riesgo

- Prioridad: `Medio`
- Área afectada: `tests`
- Archivos o módulos involucrados:
  - [permissions-contract.test.ts](/home/allopze/dev/Anamneo/frontend/src/__tests__/lib/permissions-contract.test.ts#L9)
  - [permissions.test.ts](/home/allopze/dev/Anamneo/frontend/src/__tests__/lib/permissions.test.ts#L62)
  - [app.e2e-spec.ts](/home/allopze/dev/Anamneo/backend/test/app.e2e-spec.ts#L1211)
- Explicación concreta del problema:
  - Parte del verde actual es engañoso.
  - El contrato compartido afirma permisos de admin que backend no sostiene.
  - No vi cobertura específica de timeline, clinical summary o dashboard para admin.
- Por qué importa:
  - Los bugs de permisos y scope ya quedaron legitimados por tests.
- Cómo reproducirlo o cómo razoné que existe:
  - Los tests frontend esperan `true` para varias capacidades del admin.
  - Los e2e backend no verifican ese comportamiento cruzado.
- Propuesta de solución:
  - Agregar 4 tests dirigidos:
    - admin no ve CTA clínico si backend no lo soporta
    - cambio de contraseña hace logout visible
    - empty-state de antecedentes no miente
    - admin summary/dashboard según el scope real definido
- Complejidad estimada de arreglo: `baja`

## 3. Inconsistencias frontend-backend

Estado actual tras los fixes: no quedaron contratos rotos relevantes verificados en permisos, validación de RUT, filtros `status + overdueOnly` ni visibilidad clínica del rol `ADMIN`.

Las inconsistencias importantes detectadas durante la auditoría ya quedaron cerradas en código:

- `ADMIN` dejó de tener helpers y navegación clínica que el backend no soportaba.
- Backend dejó de permitir bypass general por `isAdmin` y ahora exige `@Roles('ADMIN')` de forma explícita cuando corresponde.
- Los formularios médicos volvieron a validar RUT de forma consistente con el backend.
- La combinación `status + overdueOnly` ya conserva una semántica coherente.
- El detalle de paciente ya no mezcla render válido con un empty-state clínicamente engañoso.

## 4. Riesgos específicos por tratarse de una app médica

- La pérdida de borrador en atención en curso sigue siendo el punto a vigilar más delicado, aunque ya quedó mitigada con persistencia local.
  - Lo pendiente no es tanto de implementación como de validación completa del flujo real con expiración de sesión.
- El riesgo de que `ADMIN` vea historia clínica parcial o engañosa quedó resuelto al sacar a ese rol de vistas clínicas.
- El falso "No hay antecedentes registrados" quedó corregido.
- No vi fallos graves en validación de signos vitales, reglas mínimas de cierre ni sanitización de payloads clínicos. Esa parte del backend está bien encaminada.

## 5. Mejoras recomendadas

### Quick wins

- Mantener la separación actual entre vistas clínicas y vistas operativas para que no reaparezca un `ADMIN` clínico por accidente.
- Revisar si `MEDICO` con privilegios administrativos extra debe existir como variante real de usuario.

### Arreglos de mayor impacto

- Consolidar el modelo de roles para que no reaparezca un `ADMIN` clínico por helpers o endpoints nuevos.
- Validar el flujo nuevo de recuperación de borrador también contra backend real y expiración de sesión real, no solo con mocks.

### Limpieza técnica útil

- Mantener tests de contrato de permisos cuando aparezcan endpoints o CTAs nuevos.
- Mantener la cobertura Playwright del flujo `401 -> login -> retorno -> borrador restaurado` dentro del baseline de release.

## 6. Nuevas funcionalidades sugeridas

### 6.1 Recuperación de borrador por atención y sección

- Qué problema resuelve:
  - Pérdida de texto por expiración de sesión, refresh o navegación accidental.
- Por qué tiene sentido en este producto:
  - La app ya trabaja con autosave y edición larga por secciones.
- Impacto esperado:
  - Alto.
- Dificultad estimada:
  - Media.
- Prioridad:
  - `ahora`

### 6.2 Reconciliación explícita entre identificación del encuentro y ficha maestra

- Qué problema resuelve:
  - Divergencias entre snapshot clínico e identidad maestra del paciente.
- Por qué tiene sentido en este producto:
  - Ya existe detección de divergencia; falta UX explícita para resolverla.
- Impacto esperado:
  - Alto.
- Dificultad estimada:
  - Media.
- Prioridad:
  - `ahora`

### 6.3 Confirmación de revisión de exámenes y adjuntos ligados a órdenes

- Qué problema resuelve:
  - No queda suficientemente claro qué resultado fue efectivamente revisado.
- Por qué tiene sentido en este producto:
  - La app ya maneja órdenes estructuradas y adjuntos.
- Impacto esperado:
  - Alto.
- Dificultad estimada:
  - Media.
- Prioridad:
  - `después`

### 6.4 Detector simple de posibles pacientes duplicados sin RUT

- Qué problema resuelve:
  - Duplicación de fichas cuando no hay RUT o está exento.
- Por qué tiene sentido en este producto:
  - Es una app médica pequeña; un aviso heurístico simple basta.
- Impacto esperado:
  - Medio.
- Dificultad estimada:
  - Media.
- Prioridad:
  - `después`

### 6.5 Seguimientos predefinidos desde tratamiento

- Qué problema resuelve:
  - Carga manual repetitiva al crear tareas clínicas frecuentes.
- Por qué tiene sentido en este producto:
  - El equipo es pequeño y se beneficia de atajos simples.
- Impacto esperado:
  - Medio.
- Dificultad estimada:
  - Baja.
- Prioridad:
  - `después`

### 6.6 Última atención, último cambio y último revisor en la lista de pacientes

- Qué problema resuelve:
  - Falta de contexto rápido al priorizar pacientes.
- Por qué tiene sentido en este producto:
  - Mejora coordinación clínica con poco costo.
- Impacto esperado:
  - Medio.
- Dificultad estimada:
  - Baja.
- Prioridad:
  - `después`

### 6.7 Filtro de timeline por estado o profesional

- Qué problema resuelve:
  - Navegación clínica limitada cuando hay varias atenciones.
- Por qué tiene sentido en este producto:
  - En un equipo de hasta 5 personas sigue siendo útil y manejable.
- Impacto esperado:
  - Medio.
- Dificultad estimada:
  - Baja.
- Prioridad:
  - `después`

### 6.8 Banner persistente de alertas críticas

- Qué problema resuelve:
  - Riesgo de pasar por alto alergias, tareas vencidas o problemas activos.
- Por qué tiene sentido en este producto:
  - Son señales clínicas de alto valor y bajo costo de implementación.
- Impacto esperado:
  - Alto.
- Dificultad estimada:
  - Media.
- Prioridad:
  - `ahora`

## 7. Plan de acción priorizado

### Qué arreglar primero

- Validar en ambiente integrado real el flujo de recuperación de borrador con sesión expirada.
- Si alguien del equipo requiere doble función, modelar un rol clínico con capacidades administrativas adicionales.

### Qué dejar para después

- Mejoras de UX administrativa.
- Ajustes finos de navegación para `ADMIN`.
- Nuevas utilidades clínicas como banner persistente de alertas o seguimientos predefinidos.

### Qué no tocar todavía

- Arquitectura.
- Infraestructura.
- Observabilidad compleja.
- Reescrituras grandes.

### Roadmap corto y pragmático

1. Validar el flujo nuevo de restauración de borrador en un entorno integrado con backend y cookies reales.
2. Mantener el modelo actual: `MEDICO` clínico, `ASISTENTE` clínico acotado, `ADMIN` operativo.
3. Si aparece la necesidad de doble perfil, implementarlo como privilegios extra sobre `MEDICO`, no como reapertura del `ADMIN` clínico.

## Verificaciones realizadas

- `npm --prefix frontend run typecheck`
- `npm --prefix frontend test -- --runInBand --runTestsByPath src/__tests__/app/login.test.tsx src/__tests__/lib/login-redirect.test.ts src/__tests__/app/paciente-admin-detalle.test.tsx`
- `npm --prefix frontend run test:e2e -- tests/e2e/encounter-draft-recovery.spec.ts`
- `npm --prefix frontend run build`
- `npm --prefix backend run typecheck`
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`

Todas las verificaciones anteriores pasaron durante la auditoría.
