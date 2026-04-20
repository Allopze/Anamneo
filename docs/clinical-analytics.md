# Analitica Clinica

Esta seccion documenta la nueva vista de analitica clinica de Anamneo. No intenta vender estadistica fuerte donde todavia no la hay. Documenta lo que existe hoy, como se calcula y cuales son sus limites reales.

## Objetivo

La vista responde preguntas descriptivas del tipo:

- cuantos pacientes o atenciones forman una cohorte clinica,
- que sintomas asociados aparecen dentro de esa cohorte,
- si el cuadro parece asociado a comida o no,
- que tratamientos estructurados se indicaron,
- y que desenlaces proxy quedaron registrados despues.

Ejemplo de uso esperado:

- tengo 10 pacientes que consultan por dolor abdominal,
- de esos 10, 6 tienen vomitos y 4 diarrea,
- cuantos aparecen asociados a comida,
- y cuantas veces el tratamiento A o B quedo asociado a respuesta favorable proxy.

## Acceso

- Ruta frontend: `/analitica-clinica`
- Ruta drill-down: `/analitica-clinica/casos`
- Endpoint backend: `/api/analytics/clinical/summary`
- Endpoint drill-down: `/api/analytics/clinical/cases`
- Perfil habilitado en UI: `MEDICO` no administrativo
- Enforcement backend: `JwtAuthGuard` + `RolesGuard` + validacion de servicio para permitir solo `MEDICO` no administrativo

Referencias:

- `frontend/src/app/(dashboard)/analitica-clinica/page.tsx`
- `frontend/src/components/layout/DashboardLayout.tsx`
- `backend/src/analytics/analytics.controller.ts`

## Que muestra la vista

## 1. Resumen de cohorte

Tarjetas con:

- pacientes unicos,
- atenciones coincidentes,
- cobertura de tratamiento estructurado,
- reconsulta dentro de la ventana,
- ajuste terapeutico,
- problema resuelto,
- alerta posterior,
- edad promedio y distribucion basica por sexo.

## 2. Cohortes principales

Ranking de afecciones estructuradas detectadas desde:

- `MOTIVO_CONSULTA.afeccionSeleccionada`
- `SOSPECHA_DIAGNOSTICA.sospechas[]`

## 3. Sintomas asociados

Subgrupos detectados dentro de la cohorte filtrada. Hoy esta orientado sobre todo a sintomas gastrointestinales y dolor abdominal.

## 4. Relacion con comida

Clasificacion de cada atencion en:

- asociado a comida,
- no asociado a comida,
- sin dato claro.

## 5. Patrones terapeuticos

Rankings separados para:

- medicamentos estructurados,
- examenes estructurados,
- derivaciones estructuradas.

## 6. Tratamientos con respuesta favorable proxy

Tabla que resume, por tratamiento estructurado, cuantas indicaciones quedaron asociadas a:

- respuesta favorable proxy,
- reconsulta,
- ajuste terapeutico,
- tasa favorable aproximada.

## 7. Drill-down a casos reales

La vista principal ahora permite abrir la lista exacta de atenciones que componen:

- una cohorte filtrada,
- un medicamento estructurado,
- o un sintoma asociado.

La ruta de drill-down muestra, por atencion:

- paciente,
- fecha y estado,
- condiciones detectadas,
- medicamentos estructurados,
- sintomas,
- lectura rapida de relacion con comida,
- y enlaces directos a la atencion y al paciente.

## Filtros disponibles

- `condition`: texto libre para afeccion, sintoma o CIE10
- `source`: `ANY`, `AFECCION_PROBABLE`, `SOSPECHA_DIAGNOSTICA`
- `fromDate`
- `toDate`
- `followUpDays`
- `limit`

Reglas importantes:

- Cuando `source = ANY`, el filtro puede coincidir no solo con diagnosticos estructurados, sino tambien con motivo y anamnesis para soportar cohortes por sintoma como dolor abdominal.
- Cuando `source = AFECCION_PROBABLE` o `SOSPECHA_DIAGNOSTICA`, el matching vuelve a depender de las fuentes estructuradas de diagnostico.
- La UI mantiene filtros en borrador y solo aplica la consulta al actualizar la URL.

## Fuentes de datos

## Secciones clinicas

- `MOTIVO_CONSULTA`
- `ANAMNESIS_PROXIMA`
- `REVISION_SISTEMAS`
- `EXAMEN_FISICO`
- `SOSPECHA_DIAGNOSTICA`
- `TRATAMIENTO`
- `RESPUESTA_TRATAMIENTO`

## Otras entidades

- `PatientProblem`
- `ClinicalAlert`

## Estados incluidos

Solo se consideran atenciones con estado:

- `COMPLETADO`
- `FIRMADO`

## Campos estructurados nuevos

Para reducir dependencia de texto libre se agregaron dos bloques estructurados nuevos.

## 1. Perfil estructurado de dolor abdominal

Vive dentro de `ANAMNESIS_PROXIMA.perfilDolorAbdominal`.

Campos:

- `presente`
- `vomitos`
- `diarrea`
- `nauseas`
- `estrenimiento`
- `asociadoComida`: `SI`, `NO`, `NO_CLARO`
- `notas`

Referencias:

- `frontend/src/components/sections/AnamnesisProximaSection.tsx`
- `backend/src/encounters/encounters-sanitize-intake.ts`
- `backend/src/common/utils/encounter-section-schema.ts`

## 2. Respuesta estructurada al tratamiento

Vive dentro de `RESPUESTA_TRATAMIENTO.respuestaEstructurada`.

Campos:

- `estado`: `FAVORABLE`, `PARCIAL`, `SIN_RESPUESTA`, `EMPEORA`
- `notas`

Referencias:

- `frontend/src/components/sections/RespuestaTratamientoSection.tsx`
- `backend/src/encounters/encounters-sanitize-clinical.ts`
- `backend/src/common/utils/encounter-section-schema.ts`

## Como se calcula hoy

## Cohorte base

El read-model arma un universo de atenciones del medico en el rango consultado, parsea sus secciones y luego filtra por la condicion buscada.

Si la fuente es `ANY`, la coincidencia puede venir de:

- afeccion probable estructurada,
- sospecha diagnostica estructurada,
- sintomas estructurados del perfil abdominal,
- texto clinico normalizado de motivo/anamnesis/revision gastrointestinal/examen abdominal.

## Sintomas asociados

Se obtienen por dos caminos:

- desde el nuevo perfil abdominal estructurado,
- y desde heuristicas de texto normalizado para dolor abdominal, vomitos, diarrea, nauseas, fiebre, distension y estrenimiento.

## Relacion con comida

Prioridad actual:

1. `perfilDolorAbdominal.asociadoComida` cuando existe.
2. Heuristica textual sobre `factoresAgravantes`, `relatoAmpliado`, `sintomasAsociados`, notas estructuradas del perfil abdominal y revision gastrointestinal.

## Respuesta favorable proxy

Prioridad actual:

1. `respuestaEstructurada.estado`
2. texto libre de evolucion/resultados
3. resolucion posterior de `PatientProblem`

La tabla de tratamientos considera cada medicamento estructurado indicado en el encuentro y lo cruza con una ventana de seguimiento para estimar:

- respuesta favorable proxy,
- reconsulta,
- ajuste terapeutico,
- alertas posteriores,
- resolucion de problema.

## Superficies afectadas

## Frontend

- `frontend/src/app/(dashboard)/analitica-clinica/page.tsx`
- `frontend/src/app/(dashboard)/analitica-clinica/casos/page.tsx`
- `frontend/src/app/(dashboard)/analitica-clinica/AnalyticsRankedTable.tsx`
- `frontend/src/app/(dashboard)/analitica-clinica/AnalyticsOutcomeTable.tsx`
- `frontend/src/app/(dashboard)/analitica-clinica/casos/AnalyticsCasesTable.tsx`
- `frontend/src/app/(dashboard)/analitica-clinica/analytics-filters.ts`
- `frontend/src/components/layout/DashboardLayout.tsx`
- `frontend/src/components/sections/AnamnesisProximaSection.tsx`
- `frontend/src/components/sections/RespuestaTratamientoSection.tsx`
- `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaContentBlocks.tsx`

## Backend

- `backend/src/analytics/analytics.controller.ts`
- `backend/src/analytics/analytics.service.ts`
- `backend/src/analytics/dto/clinical-analytics-query.dto.ts`
- `backend/src/analytics/dto/clinical-analytics-cases-query.dto.ts`
- `backend/src/analytics/clinical-analytics.helpers.ts`
- `backend/src/analytics/clinical-analytics.read-model.ts`
- `backend/src/analytics/clinical-analytics.cases.read-model.ts`
- `backend/src/encounters/encounters-sanitize-intake.ts`
- `backend/src/encounters/encounters-sanitize-clinical.ts`
- `backend/src/common/utils/encounter-section-schema.ts`
- `backend/src/encounters/encounters-pdf.renderers.ts`

## Limitaciones importantes

- La vista es descriptiva y observacional.
- No demuestra causalidad.
- Si un encuentro tiene varios tratamientos o varios problemas clinicos, la atribucion de desenlace sigue siendo aproximada.
- `PARCIAL` hoy se conserva como estado estructurado distinto; no se agrupa automaticamente como favorable.
- La tabla de desenlaces proxy actual se centra en medicamentos estructurados; examenes y derivaciones no tienen aun una tabla equivalente.
- El drill-down actual existe para cohorte, medicamentos y sintomas; aun no cubre examenes, derivaciones ni exportacion CSV desde la vista.

## Validacion minima recomendada

Cuando esta seccion cambie:

1. `npm --prefix backend run typecheck`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix backend run test -- clinical-analytics.helpers.spec.ts`
4. `npm --prefix backend run test -- --runTestsByPath backend/src/analytics/analytics.service.spec.ts`
5. `npm --prefix frontend run test -- --runInBand --runTestsByPath frontend/src/__tests__/app/clinical-analytics-page.test.tsx frontend/src/__tests__/app/clinical-analytics-cases-page.test.tsx frontend/src/__tests__/components/dashboard-layout.analytics-navigation.test.tsx`
6. `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts` si se tocan encounter workflows, sanitizacion o contratos de seccion

## Decision de producto vigente

Esta seccion existe para apoyar lectura clinica y seguimiento, no para afirmar que un tratamiento fue superior con rigor bioestadistico fuerte. Mientras no exista una capa mas estructurada de diagnostico, exposicion terapeutica y desenlace, hay que leer sus resultados como soporte observacional y no como comparacion causal.