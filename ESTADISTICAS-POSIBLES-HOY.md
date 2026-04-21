# Bioestadisticas Posibles Hoy en Anamneo

## Estado actual implementado

Anamneo ya tiene una capa de analitica clinica funcional y accesible, con backend y UI dedicados. No se busca inferencia causal potente: se busca cohortes descriptivas, tratamientos estructurados y proxies de respuesta.

### Lo que ya está implementado hoy

- Vista frontend: `/analitica-clinica` y drill-down a `/analitica-clinica/casos`.
- Endpoints backend: `/api/analytics/clinical/summary` y `/api/analytics/clinical/cases`.
- Acceso de usuario: la vista está pensada para `MEDICO` y se valida con `JwtAuthGuard` + `RolesGuard`.
- Cohortes basadas en:
  - `MOTIVO_CONSULTA.afeccionSeleccionada`
  - `SOSPECHA_DIAGNOSTICA.sospechas[]`
  - `ANAMNESIS_PROXIMA.perfilDolorAbdominal`

- Tratamiento estructurado en `TRATAMIENTO` con:
  - `medicamentosEstructurados[]`
  - `examenesEstructurados[]`
  - `derivacionesEstructuradas[]`

- Seguimiento con:
  - `RESPUESTA_TRATAMIENTO.respuestaEstructurada`
  - `PatientProblem` activo/resuelto con `status`, `severity`, `onsetDate` y `resolvedAt`
  - `EXAMEN_FISICO.signosVitales` y alertas clinicas generadas por valores críticos
  - `ClinicalAlert`

- Mejora reciente: los tratamientos estructurados ahora conservan etiquetas de condiciones asociadas detectadas en la misma atención, y la analítica calcula proxies de resultado también para exámenes y derivaciones.
- Se agregó persistencia estructurada en backend para las entidades clínicas clave:
  - `EncounterDiagnosis`
  - `EncounterTreatment`
  - `EncounterTreatmentOutcome`
- Estas entidades se sincronizan cuando se actualizan las secciones clínicas relevantes:
  - `MOTIVO_CONSULTA`
  - `SOSPECHA_DIAGNOSTICA`
  - `TRATAMIENTO`
  - `RESPUESTA_TRATAMIENTO`
- Se agregó una capa analítica más explícita que infiere:
  - diagnósticos por encuentro (`diagnoses`)
  - tratamientos asociados a esas condiciones (`associatedConditionLabels` en medicamentos, exámenes y derivaciones)
  - resultados de tratamiento con origen `ESTRUCTURADO` o `TEXTO`

- La lectura de datos está implementada en los read models y helpers de analytics, y ahora consume las estructuras persistentes cuando están disponibles:
  - `backend/src/analytics/clinical-analytics.read-model.ts`
  - `backend/src/analytics/clinical-analytics.helpers.ts`
  - `backend/src/analytics/clinical-analytics.cases.read-model.ts`

- Filtrado actual:
  - `condition` libre para afeccion, sintoma o CIE10
  - `source`: `ANY`, `AFECCION_PROBABLE`, `SOSPECHA_DIAGNOSTICA`
  - `fromDate`, `toDate`, `followUpDays`, `limit`

### Qué ofrece hoy la analítica

- Pacientes únicos y atenciones coincidentes.
- Cobertura de tratamiento estructurado.
- Reconsulta dentro de la ventana de seguimiento.
- Ajuste terapéutico detectado.
- Problema resuelto identificado por `PatientProblem.resolvedAt`.
- Alertas posteriores de `ClinicalAlert`.
- Distribución básica por sexo y edad.

## Qué falta o no está formalmente resuelto

### Ausencias estructurales

- Ya existen modelos persistentes `EncounterDiagnosis`, `EncounterTreatment` y `EncounterTreatmentOutcome`, pero todavía falta que su uso sea completo y consistente en todas las capas analíticas.
- Falta formalizar el modelo de `EncounterEpisode` y su uso para agrupar varias atenciones del mismo proceso clínico.
- El vínculo diagnóstico-tratamiento sigue siendo heurístico cuando una atención contiene múltiples sospechas diagnósticas.

### Limitaciones analíticas importantes

- `TRATAMIENTO` es un bloque compartido de la atencion, sin vínculo formal con una sospecha diagnóstica precisa.
- `RESPUESTA_TRATAMIENTO` mantiene texto libre importante aunque exista `respuestaEstructurada`.
- Las respuestas estructuradas actuales son limitadas a `FAVORABLE`, `PARCIAL`, `SIN_RESPUESTA`, `EMPEORA`.
- No hay severidad basal estandarizada para comparar tratamientos.
- No hay métrica de adherencia ni de evento adverso.
- El matching de reconsulta por la “misma afección” no está normalizado como episodio.

## Qué sigue faltando para una analítica más confiable

- Uso completo y generalizado de los modelos persistentes `EncounterDiagnosis`, `EncounterTreatment`, `EncounterTreatmentOutcome` y `EncounterEpisode` en todas las consultas analíticas.
- Episodio longitudinal formalizado para seguir la misma afección.
- Adherencia, eventos adversos y gravedad basal.
- Comparaciones de efectividad ajustadas por riesgo.

## Conclusión

Hoy Anamneo ya puede entregar:

- cohortes descriptivas por afección probable o sospecha,
- patrones de tratamiento estructurado,
- persistencia estructurada de diagnósticos, tratamientos y resultados de tratamiento,
- proxies de respuesta basados en reconsulta, ajustes, resolución de problemas y alertas,
- clasificación de dolor abdominal con relación a comida.

Pero todavía falta la estructura de datos clave para poder responder con seguridad a preguntas de efectividad, comparativa de tratamientos y desenlaces verdaderamente robustos.
