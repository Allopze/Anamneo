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
  - `EncounterEpisode`
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
- `EncounterEpisode` ya quedó integrado en el flujo clínico principal:
  - se reconcilia al sincronizar secciones clínicas estructuradas
  - se reasigna si cambia el diagnóstico principal
  - se desvincula y recompone al cancelar una atención
  - se expone en los read models de encounter para consumo clínico y operativo
- La evaluación longitudinal de analytics ya prioriza episodio cuando existe, en vez de depender solo del matching heurístico por paciente + condición.
- Los ítems estructurados de tratamiento ahora pueden quedar vinculados a una sospecha diagnóstica concreta desde la ficha, y backend persiste ese vínculo en `EncounterTreatment.diagnosisId` usando la relación ya existente.
- Cuando ese vínculo explícito existe, analytics deja de repartir todas las condiciones del encuentro al mismo bloque terapéutico y usa la condición realmente asociada al medicamento, examen o derivación.
- `RESPUESTA_TRATAMIENTO` ahora puede registrar desenlaces por tratamiento u orden estructurada, y backend sincroniza esos registros como `EncounterTreatmentOutcome` específicos por ítem.
- La analítica clínica prioriza esos outcomes específicos por tratamiento cuando existen y deja el desenlace global de la sección como fallback compatible hacia atrás.
- `EncounterTreatmentOutcome` ahora también puede guardar adherencia y evento adverso por tratamiento, y esas señales ya se reflejan en summary, casos y tablas de outcomes.
- Los filtros temporales de analytics, tareas operacionales y auditoría ahora usan límites de día consistentes con la zona horaria clínica de la aplicación, en vez de medianoche UTC cruda.
- La validación backend quedó cerrada para esta capa:
  - `typecheck` OK
  - pruebas unitarias de episodios y analytics OK
  - `app.e2e-spec.ts` OK

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

- Ya existen modelos persistentes `EncounterDiagnosis`, `EncounterTreatment`, `EncounterTreatmentOutcome` y `EncounterEpisode`, pero todavía falta enriquecer la granularidad clínica de esas relaciones.
- El vínculo diagnóstico-tratamiento ya puede ser explícito por ítem estructurado, pero las atenciones históricas o los tratamientos cargados sin selección diagnóstica siguen cayendo en heurísticas de respaldo.

### Limitaciones analíticas importantes

- Las atenciones históricas siguen teniendo `RESPUESTA_TRATAMIENTO` global, sin outcomes por ítem ya capturados.
- `RESPUESTA_TRATAMIENTO` mantiene texto libre importante aunque exista `respuestaEstructurada` o desenlace por tratamiento.
- Las respuestas estructuradas actuales son limitadas a `FAVORABLE`, `PARCIAL`, `SIN_RESPUESTA`, `EMPEORA`.
- La adherencia y los eventos adversos ya pueden registrarse, pero todavía no distinguen causa, mecanismo ni relación temporal más fina.
- No hay severidad basal estandarizada para comparar tratamientos.

## Qué sigue faltando para una analítica más confiable

- Reducir aún más la heurística de respaldo en atenciones históricas que todavía no tienen vínculo diagnóstico-tratamiento ni outcomes por ítem.
- Gravedad basal y mayor detalle causal para adherencia y eventos adversos.
- Comparaciones de efectividad ajustadas por riesgo.

## Conclusión

Hoy Anamneo ya puede entregar:

- cohortes descriptivas por afección probable o sospecha,
- patrones de tratamiento estructurado,
- persistencia estructurada de diagnósticos, tratamientos y resultados de tratamiento,
- vínculo explícito entre sospecha diagnóstica y tratamiento estructurado cuando el clínico lo selecciona en la ficha,
- desenlaces estructurados por tratamiento u orden cuando el clínico los registra en la sección de respuesta,
- adherencia y eventos adversos estructurados por tratamiento,
- episodio clínico longitudinal persistido y reconciliado dentro del flujo de encounter,
- proxies de respuesta basados en reconsulta, ajustes, resolución de problemas y alertas,
- clasificación de dolor abdominal con relación a comida.

Pero todavía falta la estructura de datos clave para poder responder con seguridad a preguntas de efectividad, comparativa de tratamientos y desenlaces verdaderamente robustos.
