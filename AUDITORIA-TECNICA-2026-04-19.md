# Auditoría Técnica 2026-04-19

## 1. Resumen ejecutivo

- La base técnica está mejor de lo esperable para una app médica pequeña: backend modular, permisos compartidos entre frontend y backend, bloqueo de salidas clínicas por completitud del paciente, manejo cuidadoso de fechas y una suite de tests bastante amplia.
- No encontré un hallazgo crítico demostrable de fuga de pacientes entre médicos, corrupción evidente de datos clínicos ni un fallo grave de persistencia. Tras los fixes de esta iteración pasaron `npm --prefix backend run typecheck`, `npm --prefix backend run test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run test -- --runInBand` y `npm --prefix frontend run test:e2e:workflow-clinical`.
- El principal problema alto detectado en la auditoría inicial, el drift full stack en la emisión de `receta`, `órdenes` y `derivación`, quedó corregido en frontend y cubierto con tests unitarios/integración del lado cliente.
- También quedaron corregidas las inconsistencias de validación entre alta/edición/admin de pacientes, la falta de contexto visible en consentimientos, las guardas de ruta frontend más pobres y los dos hallazgos bajos de duplicación/tamaño que ya estaban generando mantenimiento frágil.
- En la ronda final también quedó endurecido el contrato de lectura de `encounters`, se consolidó un gate reutilizable para redirecciones con permiso y los hooks grandes auditados bajaron bajo el ideal de 300 líneas.
- Para el contexto real de uso, la app queda razonablemente lista para producción: ya no veo blockers funcionales directos para una instalación pequeña de hasta 5 personas, y la cobertura ahora sí detecta el drift clínico que motivó la auditoría.
- Veredicto inicial: está razonablemente lista para producción.
- Nota de descarte: validé con Context7/Next.js 16 que `frontend/src/proxy.ts` y el layout manual de `frontend/src/app/page.tsx` son comportamientos correctos del framework, no bugs.

## 2. Veredicto de preparación para producción

- Conclusión: está razonablemente lista para producción.
- Justificación concreta: el estado actual ya no conserva los desalineamientos altos/medios detectados al inicio y además ya no depende de supuestos por capa para los flujos clínicos sensibles auditados. Pasaron `npm --prefix backend run typecheck`, `npm --prefix backend run test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run test -- --runInBand` y `npm --prefix frontend run test:e2e:workflow-clinical`.
- Blockers de producción:
  1. No identifiqué blockers técnicos duros después de esta ronda de fixes para el contexto real declarado.
- Riesgos aceptables para este contexto:
  1. El módulo de consentimientos quedó mejor presentado, pero sigue siendo importante no interpretarlo como evidencia clínica más fuerte de la que captura el flujo real.
  2. La app ya quedó consistente en los contratos auditados; el riesgo razonable restante es que futuros cambios vuelvan a divergir si no reutilizan las fuentes compartidas creadas en esta ronda.
- Condiciones mínimas para desplegar con confianza:
  1. Reejecutar CI completa en el entorno habitual del proyecto.
  2. Hacer un smoke manual corto de los flujos: crear paciente, editar ficha, abrir atención, emitir documento enfocado, finalizar, firmar y descargar adjunto.

## 2.1. Cambios aplicados tras la auditoría

- Se corrigió H1 separando el bloqueo de documentos clínicos enfocados (`receta`, `órdenes`, `derivación`) del bloqueo de PDF clínico completo/impresión en `frontend/src/lib/clinical-output.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/ficha/useFichaClinica.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaToolbar.tsx` y `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx`.
- Se corrigieron H2 y H3 centralizando límites de campos demográficos en `shared/patient-field-constraints.ts` y alineando DTOs backend (`create`, `create-quick`, `update`, `update-admin`) y schemas Zod frontend (`nuevo.constants.ts`, `editar.constants.ts`).
- Se corrigió H4 ampliando la UI de consentimientos para mostrar mejor proveniencia clínica (`grantedAt`, `encounterId`, copy más preciso) en `frontend/src/components/PatientConsents.tsx`.
- Se corrigió H5 mejorando el comportamiento de rutas con permisos en `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx`, `frontend/src/app/(dashboard)/pacientes/[id]/administrativo/page.tsx`, `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx`, `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` y `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx`, con el nuevo componente `frontend/src/components/common/RedirectNotice.tsx`.
- Se consolidó ese patrón en `frontend/src/components/common/RouteAccessGate.tsx` y se reutilizó además en `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx`, `frontend/src/app/(dashboard)/atenciones/page.tsx` y `frontend/src/app/(dashboard)/seguimientos/page.tsx`, eliminando redirects mudos repetidos.
- Se corrigió H6 agregando pruebas frontend específicas en `frontend/src/__tests__/app/atencion-ficha.test.tsx`, `frontend/src/__tests__/lib/clinical-output.test.ts`, `frontend/src/__tests__/app/editar-paciente.test.tsx`, `frontend/src/__tests__/components/patient-consents.test.tsx` y una prueba E2E real en `frontend/tests/e2e/workflow-clinical.spec.ts` para validar documentos enfocados antes del cierre.
- Se corrigió H7 extrayendo `frontend/src/lib/attachments.ts` como helper compartido de agrupación y `frontend/src/components/attachments/LinkedAttachmentList.tsx` como bloque visual reutilizable consumido por `LinkedAttachmentBlock.tsx` y `LinkedAttachments.tsx`.
- Se corrigió H8 bajando las pantallas auditadas por debajo del tope duro de 500 líneas mediante extracciones puntuales: `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaContentBlocks.tsx`, `frontend/src/app/(dashboard)/pacientes/[id]/editar/EditarPacienteFormSections.tsx` y `frontend/src/app/(dashboard)/atenciones/[id]/NotApplicableModal.tsx`.
- Se endureció el contrato documental de `encounter detail` en `backend/src/encounters/dto/encounter-response.dto.ts`, `backend/src/encounters/encounters-read-side.ts` y `backend/src/encounters/encounters-presenters.ts`, tipando explícitamente `signatures`, `attachments`, `consents` y `signatureBaseline`.
- Se redujeron además los hooks grandes que seguían sobre el ideal: `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx` quedó en 296 líneas tras extraer `usePatientDetailQueries.ts` y `patient-detail.helpers.ts`, y `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts` quedó en 286 líneas tras extraer `useEncounterWizardEncounter.ts`.
- También se estabilizó el workflow E2E existente corrigiendo selectores y expectativas obsoletas en `frontend/tests/e2e/workflow-clinical.spec.ts`.
- Validación ejecutada tras los cambios:
  1. `npm --prefix frontend run test -- --runInBand atencion-ficha.test.tsx clinical-output.test.ts editar-paciente.test.tsx patient-consents.test.tsx` ✅
  2. `npm --prefix frontend run typecheck` ✅
  3. `npm --prefix backend run typecheck` ✅
  4. `npm --prefix backend run test` ✅
  5. `npm --prefix frontend run test -- --runInBand` ✅
  6. `npm --prefix frontend run test:e2e:workflow-clinical` ✅
  7. `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` ✅

## 3. Hallazgos

### H1. Regla contradictoria para `receta`, `órdenes` y `derivación`

- Prioridad: Alto
- Área afectada: Full stack
- Archivo(s) o módulo(s) involucrados: `backend/src/encounters/encounters-pdf.service.ts` (23-50, 70-76, 156-162), `frontend/src/lib/clinical-output.ts` (23-35), `frontend/src/app/(dashboard)/atenciones/[id]/ficha/useFichaClinica.ts` (54-68, 137-163), `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaToolbar.tsx` (77-107), `frontend/src/__tests__/app/atencion-ficha.test.tsx` (207-237), `backend/test/suites/encounters/encounters-followup.e2e-group.ts` (568-592)
- Explicación concreta del problema: el backend permite exportar documentos enfocados (`receta`, `ordenes`, `derivacion`) desde atenciones en progreso porque llama `loadEncounterForPdf(..., false)`. El frontend reutiliza una regla genérica que bloquea cualquier “documento oficial” hasta que la atención esté `COMPLETADO` o `FIRMADO`.
- Por qué importa: hoy el sistema dice dos cosas distintas sobre un flujo clínico sensible. Eso puede bloquear una receta/orden en el momento de la consulta o, al revés, permitirla desde otro cliente mientras la UI principal la niega.
- Cómo reproducirlo o cómo razoné que existe: el backend e2e espera `200` para `GET /api/encounters/:id/export/document/receta|ordenes|derivacion`; el test frontend espera esos tres botones deshabilitados cuando la atención está `EN_PROGRESO`. Ambas cosas están verdes a la vez.
- Propuesta de solución, proporcional al tamaño de la app: decidir una sola regla. Si la intención es permitir documentos enfocados en progreso, separar `EXPORT_FOCUSED_DOCUMENTS` de `PRINT_CLINICAL_RECORD`/PDF completo en frontend. Si la intención real es bloquearlos, endurecer backend y tests backend. En ambos casos, agregar una sola prueba E2E que haga click en esos botones contra backend real.
- Complejidad estimada de arreglo: baja
- Estado actual: corregido. Los botones `Receta`, `Órdenes` y `Derivación` ya quedan disponibles en `EN_PROGRESO` cuando backend también lo permitiría; PDF completo e impresión siguen bloqueados, y el flujo quedó cubierto con prueba cross-layer real.

### H2. `UpdatePatientAdminDto` omite límites que sí existen en la edición clínica completa

- Prioridad: Medio
- Área afectada: Backend / datos
- Archivo(s) o módulo(s) involucrados: `backend/src/patients/dto/update-patient-admin.dto.ts` (29-35), `backend/src/patients/dto/update-patient.dto.ts` (63-80), `backend/src/patients/dto/create-patient.dto.ts` (55-71)
- Explicación concreta del problema: `trabajo` y `domicilio` en `UpdatePatientAdminDto` solo tienen `@IsString()` y `@IsOptional()`. En la edición completa sí tienen `@MaxLength(200)` y `@MaxLength(500)`.
- Por qué importa: el mismo dato acepta límites distintos según la ruta usada. Un asistente puede guardar textos mucho más largos que los que un médico podría enviar por la ruta completa.
- Cómo reproducirlo o cómo razoné que existe: comparación directa de DTOs. La ruta `/patients/:id/admin` usa `UpdatePatientAdminDto`; la ruta `/patients/:id` usa `UpdatePatientDto`.
- Propuesta de solución, proporcional al tamaño de la app: alinear `UpdatePatientAdminDto` con los mismos `MaxLength` para campos compartidos. No hace falta rediseñar nada; basta con copiar las restricciones correctas.
- Complejidad estimada de arreglo: baja
- Estado actual: corregido. `UpdatePatientAdminDto` ya comparte los mismos límites de longitud relevantes que los DTOs clínicos completos.

### H3. Los formularios de alta y edición de pacientes no reflejan las restricciones reales del backend

- Prioridad: Medio
- Área afectada: Full stack / formularios
- Archivo(s) o módulo(s) involucrados: `frontend/src/app/(dashboard)/pacientes/nuevo/nuevo.constants.ts` (5-16, 37-51), `frontend/src/app/(dashboard)/pacientes/[id]/editar/editar.constants.ts` (18-55), `backend/src/patients/dto/create-patient.dto.ts` (16-71), `backend/src/patients/dto/update-patient.dto.ts` (21-80)
- Explicación concreta del problema: los esquemas Zod no reflejan límites máximos del backend para `nombre`, `rut`, `rutExemptReason`, `trabajo`, `domicilio` y `centroMedico`.
- Por qué importa: el usuario puede completar el formulario “bien” en cliente y recién descubrir el error al enviar. Es fricción innecesaria en uno de los flujos más frecuentes de la app.
- Cómo reproducirlo o cómo razoné que existe: comparación directa de Zod vs DTOs. Por ejemplo, `trabajo` y `domicilio` en frontend aceptan cualquier longitud; backend los limita.
- Propuesta de solución, proporcional al tamaño de la app: extraer constantes de longitud compartidas o, como mínimo, replicar los `max` en Zod. Si se toca poco, basta con añadir `.max(...)` en los schemas actuales.
- Complejidad estimada de arreglo: baja
- Estado actual: corregido. Los formularios de alta y edición ahora consumen límites compartidos con backend para `nombre`, `rut`, `rutExemptReason`, `trabajo`, `domicilio` y `centroMedico`.

### H4. La UI de consentimientos oculta contexto que el backend ya entrega

- Prioridad: Medio
- Área afectada: Full stack / UX clínica
- Archivo(s) o módulo(s) involucrados: `backend/src/consents/consents.service.ts` (43-59, 117-139), `backend/src/consents/dto/consent.dto.ts` (5-22), `backend/src/consents/consents.controller.ts` (22-44), `frontend/src/components/PatientConsents.tsx` (19-28, 43-59, 164-170)
- Explicación concreta del problema: el backend devuelve `grantedAt`, `encounterId`, `grantedBy` y ordena por `grantedAt`. La UI tipa solo `createdAt`, no muestra `grantedAt`, no muestra el encuentro origen y presenta el módulo como “Consentimientos Informados”.
- Por qué importa: el registro pierde trazabilidad visible justo en un dato clínicamente delicado. Hipótesis fuerte: si el equipo pretende que esta función se interprete como evidencia clínica seria de consentimiento, hoy la UI le da menos contexto del necesario.
- Cómo reproducirlo o cómo razoné que existe: el contrato backend ya expone campos de proveniencia, pero el componente no los usa y muestra solo `createdAt`.
- Propuesta de solución, proporcional al tamaño de la app: mostrar `grantedAt`, quién lo registró y si quedó asociado a una atención concreta. Si el objetivo real es solo una nota operacional, renombrar el copy para no sobreprometer (“Registro de consentimiento” o similar).
- Complejidad estimada de arreglo: baja
- Estado actual: corregido de forma pragmática. La UI ya muestra mejor proveniencia, fecha otorgada y atención asociada, y el copy dejó de presentar el módulo como si fuera más fuerte de lo que hoy es.

### H5. Las guardas de ruta frontend son inconsistentes y generan UX pobre por permisos

- Prioridad: Medio
- Área afectada: Frontend / UX
- Archivo(s) o módulo(s) involucrados: `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx` (37-42, 62-68), `frontend/src/app/(dashboard)/pacientes/[id]/administrativo/page.tsx` (49-65), `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx` (26-31, 57-59), `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` (36-40), `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx` (60-62)
- Explicación concreta del problema: varias rutas hacen redirect devolviendo `null`, lo que deja pantallas en blanco durante el tránsito. En `pacientes/[id]/editar`, además, el `useQuery` a `/patients/:id` se ejecuta incluso cuando el usuario ya será redirigido por no tener permiso.
- Por qué importa: genera una experiencia confusa, produce requests `403` evitables y ensucia el diagnóstico de permisos.
- Cómo reproducirlo o cómo razoné que existe: el redirect se hace en `useEffect`, pero el query de edición no está condicionado por permisos; otras páginas sí usan `enabled`.
- Propuesta de solución, proporcional al tamaño de la app: estandarizar una compuerta de ruta simple (`RouteGate`) con estado “redirigiendo” y condicionar queries sensibles con `enabled`.
- Complejidad estimada de arreglo: baja
- Estado actual: corregido y ya reutilizable. Las rutas auditadas dejaron de devolver `null` silencioso, la edición de paciente dejó de disparar la query sensible cuando el usuario no tiene permiso y el patrón quedó consolidado en `RouteAccessGate`.

### H6. La suite actual no detectó un drift full stack ya existente

- Prioridad: Medio
- Área afectada: Tests
- Archivo(s) o módulo(s) involucrados: `frontend/src/__tests__/app/atencion-ficha.test.tsx`, `backend/test/suites/encounters/encounters-followup.e2e-group.ts`, `frontend/tests/e2e/workflow-clinical.spec.ts`, `frontend/src/components/PatientConsents.tsx`
- Explicación concreta del problema: frontend y backend pueden seguir verdes aunque estén afirmando reglas opuestas sobre documentos clínicos. Además, no encontré tests frontend específicos del widget `PatientConsents`.
- Por qué importa: la cobertura es buena, pero aquí ya demostró un agujero real. No es una hipótesis: el drift existe hoy con pruebas verdes en ambos lados.
- Cómo reproducirlo o cómo razoné que existe: durante la auditoría todo pasó, incluido e2e backend y smoke frontend, pero el desacuerdo H1 sigue vivo.
- Propuesta de solución, proporcional al tamaño de la app: agregar una sola prueba cross-layer para disponibilidad de `receta/órdenes/derivación` por estado de atención y una prueba RTL mínima para `PatientConsents` mostrando proveniencia.
- Complejidad estimada de arreglo: baja
- Estado actual: corregido. Ya existe cobertura frontend específica y una prueba E2E real contra backend para disponibilidad de documentos enfocados antes del cierre.

### H7. La lógica y la UI de adjuntos vinculados están duplicadas

- Prioridad: Bajo
- Área afectada: Frontend / mantenibilidad
- Archivo(s) o módulo(s) involucrados: `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts` (201-229), `frontend/src/app/(dashboard)/atenciones/[id]/ficha/useFichaClinica.ts` (197-204), `frontend/src/components/sections/LinkedAttachmentBlock.tsx`, `frontend/src/app/(dashboard)/atenciones/[id]/ficha/LinkedAttachments.tsx`
- Explicación concreta del problema: el agrupamiento `attachments -> attachmentsByOrderId` existe en dos hooks distintos y además hay dos componentes parecidos para renderizar adjuntos vinculados.
- Por qué importa: hoy no rompe nada, pero aumenta el riesgo de que la vista de edición y la ficha cerrada evolucionen distinto.
- Cómo reproducirlo o cómo razoné que existe: comparación directa de reducers y componentes.
- Propuesta de solución, proporcional al tamaño de la app: extraer un helper compartido para agrupar adjuntos y, si no hay razones fuertes de diseño, converger a un solo bloque visual con variantes.
- Complejidad estimada de arreglo: baja
- Estado actual: corregido de forma pragmática. La agrupación de adjuntos ya está centralizada y las dos vistas reutilizan un bloque visual común para la lista de adjuntos vinculados.

### H8. Varias pantallas críticas ya rompieron el límite de tamaño que el repo se autoimpone

- Prioridad: Bajo
- Área afectada: Frontend / deuda técnica
- Archivo(s) o módulo(s) involucrados: `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx` (609 líneas), `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx` (583 líneas), `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` (500 líneas), `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx` (367 líneas), `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts` (310 líneas)
- Explicación concreta del problema: el propio `AGENTS.md` pide mantener archivos manuales idealmente bajo 300 líneas y 500 como tope duro. Dos pantallas ya lo superan y otra toca el límite.
- Por qué importa: estos son precisamente los flujos más sensibles del producto. La complejidad accidental futura va a caer aquí.
- Cómo reproducirlo o cómo razoné que existe: conteo directo de líneas.
- Propuesta de solución, proporcional al tamaño de la app: extraer subcomponentes y hooks por responsabilidad cuando se toque cada flujo, sin hacer una reescritura masiva.
- Complejidad estimada de arreglo: media
- Estado actual: corregido de forma proporcional. `ficha/page.tsx` bajó a 150 líneas, `pacientes/[id]/editar/page.tsx` a 264, `atenciones/[id]/page.tsx` quedó en 489, `usePatientDetail.tsx` bajó a 296 y `useEncounterWizard.ts` a 286. Ya no quedan, dentro de los archivos auditados en esta ronda, piezas por encima del límite duro ni hooks auditados sobre el ideal de 300.

## 4. Inconsistencias frontend-backend

- `receta`/`órdenes`/`derivación`: corregido y cubierto con prueba cross-layer real.
- `trabajo` y `domicilio`: corregido; `/patients/:id/admin` ya aplica límites consistentes con `/patients/:id` y `POST /patients`.
- Alta/edición de paciente: corregido; Zod ya refleja los límites backend en los campos auditados.
- Consentimientos: corregido de forma pragmática; frontend ya tipa y muestra parte de la proveniencia que backend entrega.
- Guardas de edición de paciente: corregido en la ruta auditada; la query dejó de ejecutarse sin permiso.
- No quedaron inconsistencias activas demostrables en los contratos auditados tras esta ronda; lo importante ahora es conservar las fuentes compartidas (`patient-field-constraints`, `RouteAccessGate`, presenters tipados) para no reintroducir drift.

## 5. Riesgos específicos por tratarse de una app médica

- Ya no se observa, en las rutas auditadas, el bloqueo artificial de `receta` u `órdenes` por una regla distinta a backend; el riesgo remanente principal es mantener esa cobertura si cambian reglas de exportación.
- El módulo de consentimientos ya reduce parte de la ambigüedad inicial, pero sigue siendo importante no sobrerrepresentarlo como evidencia clínica más fuerte de la que el flujo realmente captura.
- Las validaciones demográficas auditadas quedaron alineadas; el riesgo remanente es mantener esa alineación cuando se agreguen nuevos campos o rutas.

## 6. Mejoras recomendadas

- Quick wins:
  - Mantener `RouteAccessGate` como patrón único cuando se abra una ruta privada nueva o se toque una vieja.
- Arreglos de mayor impacto:
  - Mantener `shared/patient-field-constraints.ts` como fuente única y llevar ahí futuros campos demográficos nuevos.
  - Aclarar semánticamente el módulo de consentimientos si el producto quiere que opere como registro clínico formal y no solo como trazabilidad operacional.
  - Mantener presenters/read-side tipados cuando se amplíe `EncounterDetailResponseDto`.
- Limpieza técnica útil pero no overkill:
  - Seguir dividiendo pantallas grandes solo cuando se toque cada flujo nuevo que vuelva a crecer.
  - Reutilizar el patrón de banners y razones de bloqueo clínicas para evitar nuevas divergencias UI/lógica.

## 7. Nuevas funcionalidades sugeridas

| Funcionalidad | Qué problema resuelve | Por qué tiene sentido aquí | Impacto esperado | Dificultad | Prioridad |
|---|---|---|---|---|---|
| Flujo de fusión de pacientes duplicados | Hoy ya hay avisos de duplicados, pero no una resolución guiada | El producto ya detecta duplicados; falta cerrar el circuito | Alto | Media | Ahora |
| Bandeja de fichas `PENDIENTE_VERIFICACION` con acción rápida | La completitud administrativa ya bloquea cierres y documentos | Aprovecha una capacidad existente y reduce fricción clínica | Alto | Baja | Ahora |
| Plantillas de consentimiento por tipo | El consentimiento actual depende demasiado de texto libre | Baja variabilidad, mejor consistencia y menos ambigüedad | Medio | Baja | Después |
| Resumen de cambios al reabrir una atención | Reabrir una atención requiere más contexto histórico | Ya existe diff para firma; reutilizarlo es natural | Medio | Media | Después |
| Checklist de “resultado pendiente” por examen/derivación | Se pueden emitir órdenes sin evidenciar fácil si falta respaldo | Encaja perfecto con adjuntos vinculados y seguimientos | Alto | Media | Después |
| Presets de tareas de seguimiento | Las tareas existen, pero crear todo manualmente consume tiempo | Reduce clics en una app pequeña y repetitiva | Medio | Baja | Ahora |
| Indicador “última verificación demográfica” visible en ficha | El estado de completitud existe, pero su frescura no siempre es obvia | Ayuda a confiar en la ficha sin abrir auditoría | Medio | Baja | Ahora |
| Validación simple contra alergias al registrar medicamentos | Los antecedentes ya guardan alergias/medicamentos | Aporta seguridad funcional real sin infra extra | Alto | Media | Después |

## 8. Plan de acción priorizado

- Primero:
  1. Mantener `shared/patient-field-constraints.ts` como única fuente cuando aparezcan nuevos campos de paciente.
  2. Mantener el patrón de presenters tipados y no volver a introducir `any[]` en responses clínicos.
- Después:
  1. Reforzar semánticamente consentimientos si el producto decide apoyarse más en ese módulo.
  2. Seguir bajando archivos grandes cuando vuelva a tocarse un flujo que crezca.
  3. Repetir el smoke E2E clínico cada vez que cambien reglas de exportación o cierre.
- Más adelante:
  1. Añadir funcionalidades de valor producto como fusión de duplicados, bandeja de verificación y checklist de resultados pendientes.
- No tocar todavía:
  1. Infraestructura de gran escala, observabilidad compleja, colas, microservicios o hardening enterprise.
  2. Refactors masivos de arquitectura que no atacan defectos reales del estado actual.
