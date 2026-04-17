# Auditoría técnica de Anamneo

Fecha: 2026-04-17

## Alcance y método

Revisé arquitectura, documentación, contratos compartidos, backend NestJS, frontend Next.js, esquema Prisma, flujos clínicos, permisos, autenticación, persistencia, alertas, consentimientos, tareas, adjuntos y pruebas disponibles.

Además de la auditoría original, en esta misma rama ejecuté dos pasadas de remediación enfocadas solo en hallazgos de prioridad Alta.

No usé Context7 porque no hizo falta para verificar ni corregir los puntos tratados.

## Estado de remediación

- Pasada 1, backend:
  - La creación desde una atención previa ya no hereda contenido clínico, marcas de completitud ni banderas `notApplicable`.
  - Crear, reabrir, cancelar y actualizar revisión de atención ahora auditan dentro de transacción.
- Pasada 2, frontend:
  - `/auth/2fa/verify` quedó excluido del refresh automático de sesión.
  - La UI de seguimiento quedó alineada con el backend endurecido: solo se ofrece desde atenciones `COMPLETADO` o `FIRMADO` y el texto visible ya no promete una duplicación clínica completa.
- Estado actual:
  - No quedan hallazgos `Alta` abiertos de esta auditoría en la rama de trabajo actual.

## Validación ejecutada

- Backend:
  - `npm --prefix backend run typecheck` -> OK
  - `npm --prefix backend run test -- --runInBand backend/src/encounters/encounters-create-mutation.spec.ts backend/src/encounters/encounters-workflow-reopen-cancel-review.spec.ts` -> OK
  - `npm --prefix backend run test -- --runInBand consents.service.spec.ts alerts.service.spec.ts patients-access.spec.ts auth-totp.service.spec.ts auth-2fa-flow.spec.ts` -> OK
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` -> OK
- Frontend:
  - `npm --prefix frontend install` para restaurar las dependencias locales faltantes del workspace
  - `npm --prefix frontend run typecheck` -> OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/app/encounter-header.test.tsx src/__tests__/app/paciente-detalle.test.tsx src/__tests__/app/atencion-ficha.test.tsx src/__tests__/lib/api.test.ts src/__tests__/lib/encounter-duplicate.test.ts` -> OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/app/paciente-detalle.test.tsx src/__tests__/app/ajustes.test.tsx src/__tests__/app/seguimientos.test.tsx` -> OK
  - `npm --prefix frontend run test -- --runInBand src/__tests__/components/examen-fisico-section.test.tsx src/__tests__/components/examen-fisico.constants.test.ts` -> OK
  - `npm --prefix frontend run test:e2e` -> OK, 9/9 verdes
  - Spot-check manual en UI real sobre stack E2E: alta inicial, activación 2FA en ajustes, logout, prompt de verificación TOTP y reingreso exitoso -> OK

## Resumen ejecutivo

La base del proyecto sigue siendo buena para el contexto real del producto: consultorio pequeño, máximo 5 usuarios, prioridades de simplicidad y bajo mantenimiento. El problema principal que impedía recomendar producción no era la arquitectura ni la escala, sino un conjunto acotado de riesgos clínicos y de trazabilidad en flujos sensibles.

Esos bloqueantes altos ya quedaron corregidos en esta rama. En particular, ya no existe el riesgo de arrancar una atención nueva con contenido clínico heredado de otra, ni el riesgo de devolver error al usuario después de persistir una mutación crítica sin haber cerrado la auditoría de forma atómica, ni el tratamiento incorrecto de `/auth/2fa/verify` como si fuera una sesión vencida.

Lo que queda abierto ahora es más acotado y ya no está en el núcleo clínico ni en la señal integrada principal: la regresión E2E quedó estabilizada y verde en esta rama.

## Veredicto actual de preparación para producción

Veredicto actualizado: lista para un despliegue controlado.

Para este producto y este tamaño de operación, ya no veo bloqueantes Altos abiertos ni una brecha relevante de regresión integrada en esta rama. La recomendación sigue siendo mantener la validación pragmática antes de cada release, pero ya no queda un pendiente específico de estabilización E2E de esta pasada.

## Hallazgos altos remediados

### 1. Alta original: duplicar una atención copiaba contenido clínico previo y conservaba secciones ya completas

Estado: corregido en esta rama.

Qué cambió:

- Backend: [backend/src/encounters/encounters-create-mutation.ts](backend/src/encounters/encounters-create-mutation.ts) ahora crea un borrador limpio. Solo siembra datos seguros desde la ficha del paciente y, si existe, anamnesis remota desde la historia maestra del paciente.
- Backend: la atención base solo puede estar en `COMPLETADO` o `FIRMADO`; ya no se aceptan fuentes canceladas.
- Backend: las nuevas secciones nacen con `completed: false` y `notApplicable: false`, salvo identificación.
- Frontend: [frontend/src/lib/encounter-duplicate.ts](frontend/src/lib/encounter-duplicate.ts) unifica la regla de origen válido y el nuevo copy de UI.
- Frontend: las acciones visibles en [frontend/src/app/(dashboard)/pacientes/[id]/PatientEncounterTimeline.tsx](frontend/src/app/(dashboard)/pacientes/[id]/PatientEncounterTimeline.tsx), [frontend/src/app/(dashboard)/atenciones/[id]/EncounterHeader.tsx](frontend/src/app/(dashboard)/atenciones/[id]/EncounterHeader.tsx) y [frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaToolbar.tsx](frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaToolbar.tsx) ahora se presentan como `Nuevo seguimiento`.
- Cobertura: [backend/src/encounters/encounters-create-mutation.spec.ts](backend/src/encounters/encounters-create-mutation.spec.ts) y tests de UI/frontend actualizados.

Resultado práctico:

- Se eliminó el arrastre automático de diagnóstico, tratamiento, observaciones y estados de completitud desde otra atención.
- Se redujo el riesgo clínico más delicado detectado en la auditoría original.

### 2. Alta original: algunas mutaciones críticas auditaban fuera de transacción

Estado: corregido en esta rama.

Qué cambió:

- [backend/src/encounters/encounters-create-mutation.ts](backend/src/encounters/encounters-create-mutation.ts) registra auditoría de creación dentro del `tx`.
- [backend/src/encounters/encounters-workflow-reopen-cancel-review.ts](backend/src/encounters/encounters-workflow-reopen-cancel-review.ts) mueve `reopen`, `cancel` y `review-status` a transacciones que incluyen la escritura de auditoría.
- Cobertura: [backend/src/encounters/encounters-workflow-reopen-cancel-review.spec.ts](backend/src/encounters/encounters-workflow-reopen-cancel-review.spec.ts) ahora valida explícitamente que `auditService.log` reciba el `tx`.

Resultado práctico:

- Ya no queda el caso en que el cambio clínico persista pero el usuario reciba error por una falla de auditoría post-commit en esos caminos.

### 3. Alta original: el login con 2FA pasaba por refresh de sesión aunque todavía no existía sesión autenticada

Estado: corregido en esta rama.

Qué cambió:

- [frontend/src/lib/api.ts](frontend/src/lib/api.ts) ahora excluye explícitamente `/auth/2fa/verify` en `shouldSkipRefresh`.
- Cobertura: [frontend/src/__tests__/lib/api.test.ts](frontend/src/__tests__/lib/api.test.ts).

Resultado práctico:

- El paso TOTP del login ya no dispara el mismo comportamiento pensado para sesión vencida en endpoints protegidos.

## Remediaciones medias posteriores a los hallazgos altos

### 1. Media remediada: la recurrencia mensual de tareas ya no degrada al día 28

Estado: corregido en esta rama.

Qué cambió:

- [backend/src/patients/patients-task-mutations.ts](backend/src/patients/patients-task-mutations.ts) ahora calcula la próxima ocurrencia mensual desde el mes inmediato siguiente y conserva el día ancla original cuando el mes corto obliga a caer temporalmente en 28, 29 o 30.
- [backend/src/patients/patients-clinical-mutations.spec.ts](backend/src/patients/patients-clinical-mutations.spec.ts) agrega cobertura para una tarea mensual anclada en día 31 y para la continuidad correcta después de febrero.

Resultado práctico:

- Un seguimiento mensual del 29, 30 o 31 ahora se mueve al último día disponible del mes siguiente sin perder su ancla original para meses posteriores.

### 2. Media remediada: la UX de 2FA en ajustes ya no culpa siempre al usuario por cualquier error

Estado: corregido en esta rama.

Qué cambió:

- [frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx](frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx) ahora usa `getErrorMessage(err)` con fallback neutro para activar o desactivar 2FA, en vez de reemplazar cualquier fallo por `Código incorrecto` o `Contraseña incorrecta`.
- [frontend/src/__tests__/app/ajustes.test.tsx](frontend/src/__tests__/app/ajustes.test.tsx) cubre fallos de activación y desactivación que devuelven mensajes operativos reales.

Resultado práctico:

- Timeouts, errores de red, `429` o fallos transitorios del backend ya no se presentan como error del usuario cuando no corresponde.

### 3. Baja remediada: las redirecciones de detalle de paciente y seguimientos ya no dejan pantalla en blanco

Estado: corregido en esta rama.

Qué cambió:

- [frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx](frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx) expone estado explícito de redirección para perfiles administrativos.
- [frontend/src/app/(dashboard)/pacientes/[id]/page.tsx](frontend/src/app/(dashboard)/pacientes/[id]/page.tsx) muestra un estado visible de `Redirigiendo…` en vez de devolver `null`.
- [frontend/src/app/(dashboard)/seguimientos/page.tsx](frontend/src/app/(dashboard)/seguimientos/page.tsx) hace lo mismo para perfiles administrativos.
- [frontend/src/__tests__/app/paciente-detalle.test.tsx](frontend/src/__tests__/app/paciente-detalle.test.tsx) y [frontend/src/__tests__/app/seguimientos.test.tsx](frontend/src/__tests__/app/seguimientos.test.tsx) cubren ese comportamiento.

Resultado práctico:

- Entrar por URL directa en esas rutas ya no produce una pantalla vacía transitoria mientras ocurre la redirección.

### 4. Media remediada: los signos vitales ahora distinguen advertencia local de alerta clínica automática

Estado: corregido en esta rama.

Qué cambió:

- [shared/vital-sign-alerts.ts](shared/vital-sign-alerts.ts) centraliza la evaluación de signos vitales y define qué valores son solo advertencia local y cuáles califican como alerta clínica automática.
- [backend/src/alerts/alerts.service.ts](backend/src/alerts/alerts.service.ts) ahora genera alertas automáticas solo desde esa evaluación compartida, en vez de mantener umbrales duplicados por separado.
- [frontend/src/components/sections/examen-fisico.constants.ts](frontend/src/components/sections/examen-fisico.constants.ts) reutiliza la misma lógica compartida para badges y resaltado.
- [frontend/src/components/sections/ExamenFisicoSection.tsx](frontend/src/components/sections/ExamenFisicoSection.tsx) separa visualmente `Advertencias locales` de `Valores críticos con posible alerta clínica automática`.
- Cobertura: [backend/src/alerts/alerts.service.spec.ts](backend/src/alerts/alerts.service.spec.ts), [frontend/src/__tests__/components/examen-fisico-section.test.tsx](frontend/src/__tests__/components/examen-fisico-section.test.tsx) y [frontend/src/__tests__/components/examen-fisico.constants.test.ts](frontend/src/__tests__/components/examen-fisico.constants.test.ts).

Resultado práctico:

- La UI ya no sugiere que toda advertencia visual equivale a una alerta persistida.
- Backend y frontend evalúan los mismos umbrales críticos para los signos vitales que sí deben disparar alerta automática.

## Hallazgos abiertos

No quedaron hallazgos abiertos relevantes dentro del alcance tratado en esta rama.

## Inconsistencias frontend-backend abiertas

Sin inconsistencias abiertas relevantes en los frentes ya remediados de esta auditoría.

## Riesgos clínicos restantes

No quedó un riesgo clínico abierto de la tanda tratada en esta pasada.

## Mejoras recomendadas, proporcionales

1. Mantener emails únicos por corrida y `workers: 1` en Playwright mientras la suite siga compartiendo bootstrap y estado entre specs.
2. Repetir la pasada corta de auth/2FA, `Nuevo seguimiento`, signos vitales y cierre/firma antes de cada release relevante.

Lo que no recomiendo para este producto hoy:

- No veo necesidad de microservicios, colas complejas, Kubernetes ni una refactorización arquitectónica grande.
- Tampoco veo necesidad de reemplazar SQLite solo por tamaño del equipo o por el número esperado de usuarios.

## Funcionalidades útiles y realistas

1. Banner persistente de procedencia para `Nuevo seguimiento`, con acceso rápido a la atención fuente.
2. Comparación contra la última atención para diagnóstico, tratamiento y signos vitales.
3. Reglas de alertas clínicas configurables por la profesional sin complejidad extra.
4. Checklist previo a finalizar que resuma alertas activas, tareas pendientes y campos faltantes del paciente.
5. Vista longitudinal simple de signos vitales y evolución por paciente.
6. Renovación o vencimiento de consentimientos con aviso anticipado.

## Hoja de ruta pragmática

### Próxima semana

1. Mantener la suite E2E verde dentro del flujo normal de cambios, sin reabrir dependencias de estado compartido entre specs.

### Antes de declarar el sistema como estable

1. Repetir una pasada E2E corta centrada en login 2FA, `Nuevo seguimiento`, alertas por signos vitales y cierre/firma cuando se introduzcan cambios en auth o en el workflow clínico.
2. Hacer una regresión manual corta del flujo paciente -> atención -> secciones -> revisión -> cierre -> firma -> ficha cuando cambie la UX clínica, no como pendiente de esta auditoría.

## Conclusión

Los tres hallazgos Altos de la auditoría original quedaron remediados y validados. También quedaron cerradas las remediaciones medias de recurrencia mensual, UX de redirección, mensajes de 2FA en ajustes y semántica compartida de signos vitales. El proyecto queda en una posición bastante más sólida para el contexto real del producto.

Lo que resta ahora ya no es un bloqueo severo del core clínico, sino una tanda razonable de mejoras medias y de pulido evolutivo. Eso cambia el estado general de `no lista` a `lista para despliegue controlado`.
