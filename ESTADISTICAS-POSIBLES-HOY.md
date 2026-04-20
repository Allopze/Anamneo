# Bioestadisticas Posibles Hoy en Anamneo

## Objetivo

Este documento ya no se enfoca en metricas de operacion de la app, sino en preguntas clinicas tipo:

- cuantos pacientes tienen una afeccion determinada,
- que tratamientos recibieron,
- como evolucionaron,
- y hasta donde se puede comparar resultados con el dato que Anamneo guarda hoy.

El punto importante es metodologico: con el modelo actual se puede hacer analitica clinica descriptiva y algunos analisis de cohortes con proxies de desenlace. Todavia no alcanza para afirmar con solidez que un tratamiento fue mas efectivo que otro salvo en escenarios muy acotados y con varias advertencias.

## Resumen ejecutivo

Hoy la app si permite responder, con distinto nivel de confianza, preguntas como estas:

- cuantos pacientes o atenciones quedaron asociadas a una afeccion,
- que medicamentos, examenes o derivaciones se indicaron para esa afeccion,
- cuantas veces ese plan requirio ajuste posterior,
- cuantas veces hubo nueva consulta, nueva alerta o nueva derivacion,
- y en algunos casos si hubo mejoria objetiva en signos vitales o resolucion de un problema clinico.

Pero hoy no permite responder con rigor clinico fuerte preguntas como:

- cual tratamiento fue mas efectivo,
- cual logro mejor respuesta clinica ajustada por gravedad,
- cual redujo sintomas mas rapido,
- o cual fue superior por subgrupo de pacientes.

La razon no es falta de volumen de datos, sino falta de estructura y trazabilidad fina entre:

- diagnostico confirmado,
- tratamiento indicado,
- seguimiento de ese tratamiento,
- y desenlace clinico medido de forma estandar.

## Base real del analisis

Este reenfoque se basa en lo que hoy existe en el repositorio:

- `backend/prisma/schema.prisma`
- `docs/data-model.md`
- `docs/clinical-workflows.md`
- `backend/src/common/utils/encounter-section-meta.ts`
- `backend/src/encounters/encounters-sanitize-clinical.ts`
- `backend/src/encounters/encounters-sanitize-intake.ts`
- `frontend/src/types/encounter.types.ts`

## Que dato clinico existe hoy y que tan util es para bioestadistica

## 1. Afeccion o diagnostico

Hoy la app guarda tres capas que pueden servir para armar cohortes clinicas:

### A. Afeccion seleccionada en motivo de consulta

En `MOTIVO_CONSULTA` existe `afeccionSeleccionada` con:

- `id`
- `name`
- `confidence`

Esto sirve para cohortes del tipo:

- pacientes con probable afeccion X,
- atenciones donde se sugirio y selecciono la afeccion X,
- distribucion de afecciones probables por periodo.

Ventaja:

- esta ligada al catalogo.

Limitacion:

- representa afeccion probable o elegida en ese momento, no necesariamente diagnostico final confirmado.

### B. Sospecha diagnostica de la atencion

En `SOSPECHA_DIAGNOSTICA` existe un arreglo `sospechas[]` con:

- `diagnostico`
- `codigoCie10`
- `descripcionCie10`
- `prioridad`
- `notas`

Esto sirve para cohortes del tipo:

- atenciones con sospecha diagnostica X,
- atenciones con CIE10 Y,
- top sospechas por periodo,
- comparacion entre primer diagnostico sospechado y planes indicados.

Ventaja:

- ya existe un componente semiestructurado y puede traer CIE10.

Limitacion:

- sigue siendo sospecha diagnostica de la atencion, no diagnostico longitudinal normalizado y confirmado.

### C. Problemas clinicos del paciente

`PatientProblem` guarda:

- `label`
- `status`
- `severity`
- `onsetDate`
- `resolvedAt`

Esto sirve para cohortes longitudinales del tipo:

- pacientes con problema activo X,
- tiempo hasta resolucion,
- carga clinica activa por paciente,
- severidad de problemas registrados.

Ventaja:

- es longitudinal y no depende solo de una atencion puntual.

Limitacion:

- no esta normalizado contra el catalogo de afecciones y no siempre queda ligado de forma fuerte al tratamiento que lo abordo.

## 2. Tratamiento

La mejor noticia para este reenfoque es que si existe una parte estructurada del tratamiento.

En `TRATAMIENTO` hoy se guarda:

- `plan`
- `indicaciones`
- `receta`
- `examenes`
- `derivaciones`
- `medicamentosEstructurados[]`
- `examenesEstructurados[]`
- `derivacionesEstructuradas[]`

### Tratamiento estructurado disponible hoy

`medicamentosEstructurados[]` permite capturar:

- nombre,
- dosis,
- via,
- frecuencia,
- duracion,
- indicacion.

`examenesEstructurados[]` y `derivacionesEstructuradas[]` permiten capturar:

- nombre,
- indicacion,
- estado,
- resultado.

Esto ya habilita analitica bastante util sobre patron de tratamiento.

### Principal limitacion actual

El tratamiento esta guardado a nivel de seccion de la atencion, no enlazado de forma explicita a una sospecha diagnostica especifica cuando una misma atencion tiene varias.

En otras palabras:

- una atencion puede tener varios diagnosticos sospechados,
- la seccion `TRATAMIENTO` es un bloque comun,
- pero no existe una relacion formal tipo `este farmaco fue para este diagnostico`.

Eso debilita mucho cualquier comparacion de efectividad por afeccion cuando hay mas de un problema tratado en la misma consulta.

## 3. Seguimiento y respuesta

En `RESPUESTA_TRATAMIENTO` hoy se guarda:

- `evolucion`
- `resultadosExamenes`
- `ajustesTratamiento`
- `planSeguimiento`

Esto es clinicamente valioso, pero analiticamente tiene una limitacion fuerte:

- el desenlace esta principalmente en texto libre.

Ademas, no existe hoy un esquema estructurado del tipo:

- mejoro,
- estable,
- empeoro,
- resuelto,
- respuesta parcial,
- sin respuesta,
- evento adverso,
- adherente / no adherente.

Por eso hoy se puede medir seguimiento y ajustes, pero no efectividad comparativa robusta.

## 4. Variables objetivas adicionales

Para algunos grupos clinicos si existen variables mas utiles:

- signos vitales estructurados en `EXAMEN_FISICO`,
- `PatientProblem.resolvedAt`,
- tareas de seguimiento,
- alertas clinicas,
- nuevas atenciones posteriores,
- derivaciones y examenes estructurados.

Estas variables permiten construir proxies de desenlace mejores que el puro texto libre.

## Que bioestadisticas si se pueden obtener hoy

## A. Cohortes por afeccion

Estas son las bioestadisticas mas viables hoy.

| Analisis | Fuente principal | Nivel de confianza | Comentario |
|---|---|---|---|
| Pacientes con afeccion probable X | `MOTIVO_CONSULTA.afeccionSeleccionada` | Medio-alto | Util si el equipo usa consistentemente la seleccion sugerida |
| Atenciones con sospecha diagnostica X | `SOSPECHA_DIAGNOSTICA.sospechas[]` | Medio | Valido para carga clinica por episodio |
| Atenciones con CIE10 Y | `codigoCie10` | Medio | Mejor si se documenta de forma consistente |
| Pacientes con problema activo X | `PatientProblem.label/status` | Medio | Mejor para seguimiento longitudinal que para episodio puntual |
| Nuevos casos por periodo | cualquiera de las anteriores + `createdAt` | Medio | Depende de la definicion de caso |
| Distribucion por sexo, edad, prevision | `Patient` + diagnostico/afeccion | Medio-alto | Factible hoy |
| Frecuencia de afecciones por medico | `Encounter.medicoId` + diagnostico | Medio | Descriptivo, no comparativo |

## B. Que tratamiento se dio a pacientes con X afeccion

Esto tambien es viable hoy, sobre todo si se prioriza lo estructurado.

| Analisis | Fuente principal | Nivel de confianza | Comentario |
|---|---|---|---|
| Medicamentos mas usados para afeccion X | `medicamentosEstructurados[]` | Medio-alto | Muy util para patron terapeutico |
| Dosis, vias y frecuencias mas usadas | `medicamentosEstructurados[]` | Medio-alto | Factible si el llenado es consistente |
| Examenes mas pedidos por afeccion | `examenesEstructurados[]` | Medio-alto | Bueno para patron diagnostico/seguimiento |
| Derivaciones mas indicadas por afeccion | `derivacionesEstructuradas[]` | Medio-alto | Bueno para complejidad o escalamiento |
| Planes o recetas mas frecuentes | `plan`, `receta`, `indicaciones` | Bajo-medio | Requiere clasificacion manual o NLP simple |
| Combinaciones de tratamiento | medicamentos + examenes + derivaciones | Medio | Util para ver patrones de manejo |

## C. Proxies de desenlace o respuesta clinica

Aqui ya no hablamos de efectividad fuerte, sino de senales observables que pueden servir como aproximacion.

| Analisis | Fuente principal | Nivel de confianza | Comentario |
|---|---|---|---|
| Necesidad de ajuste de tratamiento | `RESPUESTA_TRATAMIENTO.ajustesTratamiento` | Bajo-medio | Hoy es texto libre |
| Persistencia de seguimiento activo | `planSeguimiento`, tareas y nuevas atenciones | Medio | Sirve como proxy de no resolucion completa |
| Resolucion de problema clinico | `PatientProblem.resolvedAt` | Medio | Mejor si el problema esta bien mantenido |
| Reconsulta por la misma afeccion en 7/30/90 dias | nuevas atenciones con diagnostico similar | Medio-bajo | Requiere criterio de matching |
| Cambios en signos vitales | `EXAMEN_FISICO.signosVitales` | Medio | Valioso solo para condiciones donde aplique |
| Necesidad de derivacion posterior | `derivacionesEstructuradas[]` o nuevas derivaciones | Medio | Proxy de complejidad o no resolucion |
| Alertas clinicas posteriores | `ClinicalAlert` | Medio-bajo | Proxy indirecto, no desenlace puro |
| Examenes con resultado revisado | `StructuredOrder.estado/resultado` | Medio | Mejor para continuidad que para efectividad |

## D. Analisis longitudinal por paciente

Esto puede tener bastante valor practico si se hace bien.

| Analisis | Fuente principal | Nivel de confianza | Comentario |
|---|---|---|---|
| Evolucion de una afeccion en encuentros sucesivos | secciones de varias atenciones | Medio-bajo | Requiere consolidacion por paciente |
| Numero de ajustes antes de estabilizacion | `ajustesTratamiento` + encuentros sucesivos | Bajo-medio | Hoy no esta estructurado |
| Tiempo entre primera consulta y resolucion | atenciones + `PatientProblem.resolvedAt` | Medio-bajo | Necesita definicion clara del inicio del episodio |
| Tendencia de signos vitales | encuentros seriados | Medio | Bueno para HTA, peso, satO2, etc. |

## Ejemplo directo: "pacientes con X afeccion, que tratamiento se les dio, cual fue mas efectivo"

Con el dato actual, esta pregunta se separa asi:

### 1. Pacientes con X afeccion

Si se puede responder.

La mejor estrategia hoy es usar una jerarquia de fuentes:

1. `afeccionSeleccionada` en `MOTIVO_CONSULTA` si existe.
2. `codigoCie10` o `diagnostico` en `SOSPECHA_DIAGNOSTICA`.
3. `PatientProblem` para carga longitudinal activa o resuelta.

### 2. Que tratamiento se les dio

Si se puede responder razonablemente bien cuando el medico uso campos estructurados:

- medicamentos estructurados,
- examenes estructurados,
- derivaciones estructuradas.

Si el manejo quedo solo en `plan`, `receta` o `indicaciones`, la respuesta sigue siendo posible, pero ya exige clasificacion manual o mineria de texto.

### 3. Cual fue mas efectivo

Hoy solo se puede responder en modo exploratorio y con proxies, por ejemplo:

- que grupo tuvo menos reconsultas por la misma afeccion,
- que grupo tuvo menos ajustes posteriores,
- que grupo mostro mas resolucion de `PatientProblem`,
- que grupo tuvo mejor tendencia en signos vitales,
- o que grupo requirio menos derivaciones / alertas posteriores.

Eso no equivale a demostrar efectividad clinica real, porque hoy faltan piezas clave:

- diagnostico final confirmado y normalizado,
- severidad basal,
- adherencia,
- evento adverso,
- desenlace estructurado,
- y linkage formal entre diagnostico, tratamiento y resultado.

### Traduccion operativa del ejemplo medico

Con el MVP que conviene construir primero, la app ya puede aproximar una pregunta como esta:

- tengo 10 pacientes que consultan por dolor abdominal,
- de esos 10, 6 tienen vomitos y 4 diarrea,
- cuantos aparecen asociados a comida o no,
- y dentro de los tratamientos estructurados, cuantas veces el tratamiento A quedo asociado a una respuesta favorable proxy y cuantas el tratamiento B.

Para lograrlo no hace falta esperar un modelo causal completo. Basta con combinar:

- cohortes por afeccion o sintoma usando diagnostico mas texto clinico,
- subgrupos por sintomas asociados desde anamnesis y revision por sistemas,
- clasificacion heuristica de relacion con comida,
- y respuesta favorable proxy usando evolucion, resolucion del problema, ajustes y reconsulta.

La limitacion sigue siendo la misma: eso sirve para analitica descriptiva util en consulta y seguimiento, pero no para afirmar que un tratamiento fue objetivamente superior en sentido clinico fuerte.

## Bioestadisticas de alto valor que recomendaria construir primero

Si el objetivo es utilidad clinica real y no decoracion, priorizaria estas vistas:

## 1. Cohorte por afeccion

Para cada afeccion:

- numero de pacientes,
- numero de atenciones,
- distribucion por sexo y tramo etario,
- distribucion temporal,
- frecuencia por medico.

## 2. Patron terapeutico por afeccion

Para cada afeccion:

- medicamentos mas usados,
- combinaciones mas frecuentes,
- examenes mas pedidos,
- derivaciones mas frecuentes,
- ajustes posteriores mas frecuentes.

## 3. Desenlaces proxy por afeccion y tratamiento

Para cada combinacion afeccion-tratamiento:

- reconsulta en 7/30/90 dias,
- ajuste de tratamiento,
- derivacion posterior,
- resolucion de problema,
- cambio de signos vitales cuando aplique.

## 4. Seguimiento longitudinal

- tiempo hasta nueva consulta,
- tiempo hasta resolucion,
- numero de cambios de plan,
- continuidad del control.

## 5. Riesgo y complejidad

- alertas asociadas a esa cohorte,
- severidad de problemas activos,
- volumen de examenes y derivaciones,
- pacientes con multiples problemas activos.

## Lo que no es confiable llamar "bioestadistica fuerte" con el modelo actual

Estas preguntas pueden sonar atractivas, pero hoy no conviene prometerlas como estadistica confiable:

- tratamiento mas efectivo,
- tasa real de remision,
- tiempo estandarizado a la mejoria,
- efectividad comparada entre esquemas A vs B,
- respuesta ajustada por severidad,
- perfil de efectos adversos,
- adherencia al tratamiento,
- fracaso terapeutico estandarizado,
- comparaciones clinicas causales entre medicos o esquemas.

El problema central no es solo que parte del dato este en texto libre. El problema mas serio es este:

- no hay un diagnostico final canonico por encuentro,
- no hay una tabla de tratamiento ligada a un diagnostico concreto,
- y no hay una tabla de resultado clinico estructurado ligada a ese tratamiento.

## Que haria falta para poder responder "cual fue mas efectivo" en serio

## Minimo modelo adicional recomendado

### 1. Diagnostico clinico confirmado

Crear una entidad estructurada por encuentro, por ejemplo `EncounterDiagnosis`, con campos como:

- `conditionId` o `cie10Code`
- `label`
- `kind` principal / secundario
- `status` sospechado / confirmado / descartado
- `recordedAt`

### 2. Exposicion terapeutica estructurada

Crear una entidad tipo `EncounterTreatment` o `TreatmentExposure` ligada al diagnostico, con:

- medicamento o intervencion,
- dosis,
- via,
- frecuencia,
- duracion,
- fecha de inicio,
- fecha de termino,
- indicacion,
- diagnostico asociado.

### 3. Desenlace clinico estructurado

Crear una entidad tipo `TreatmentOutcome` o `ClinicalOutcome`, con:

- mejoro / estable / empeoro / resuelto,
- fecha de evaluacion,
- score o medida objetiva cuando aplique,
- evento adverso,
- necesidad de ajuste,
- necesidad de derivacion,
- adherencia.

### 4. Vinculo longitudinal de episodio

Poder agrupar varias atenciones dentro de un mismo episodio clinico o seguimiento de una misma afeccion.

Sin eso, muchas comparaciones terminan mezclando consultas independientes como si fueran parte del mismo proceso terapeutico.

## Recomendacion pragmatica para integrar esta vista en la app

## Enfoque recomendado

En vez de una pagina generica de "estadisticas", convendria una seccion de analitica clinica o cohortes, por ejemplo:

- `/estadisticas-clinicas`, o
- `/estadisticas?vista=clinica`.

## Primer release util

El MVP deberia enfocarse en analitica descriptiva y cohortes, no en prometer efectividad comparativa.

### Filtros globales recomendados

- rango de fechas,
- afeccion,
- fuente diagnostica: afeccion probable / sospecha / problema activo,
- medico,
- sexo,
- tramo etario.

### Bloques recomendados

1. Cohorte.
2. Tratamientos indicados.
3. Seguimiento y desenlaces proxy.
4. Drill-down a casos o pacientes.

### Regla de diseno importante

Cada grafico o tarjeta deberia indicar la calidad del dato:

- estructurado,
- semiestructurado,
- proxy,
- texto libre interpretado.

Eso evita conclusiones falsas y ayuda a no vender precision donde no la hay.

## MVP bioestadistico que si construiria ahora

Si hubiera que salir con una primera version realmente util, haria esto:

1. Cohortes por afeccion usando `afeccionSeleccionada` y `SOSPECHA_DIAGNOSTICA`.
2. Tabla de tratamientos estructurados por afeccion.
3. Tabla de examenes y derivaciones por afeccion.
4. Proxies de desenlace:
   - reconsulta en 30 dias,
   - ajuste de tratamiento posterior,
   - resolucion de problema,
   - cambio de signos vitales cuando aplique.
5. Badge visible de confiabilidad de cada metrica.

No intentaria en la primera version:

- ranking de efectividad,
- inferencia causal,
- NLP clinico complejo,
- ni comparativas sofisticadas entre medicos.

## Conclusion

Si se puede reenfocar la seccion hacia algo tipo bioestadistica, pero con una precision importante:

- hoy Anamneo ya permite cohortes por afeccion,
- ya permite ver que tratamientos se indicaron,
- ya permite algunos proxies de evolucion,
- pero todavia no permite afirmar de forma robusta cual tratamiento fue mas efectivo.

La oportunidad real hoy es construir una capa de analitica clinica descriptiva y longitudinal basada en cohortes. Si despues se quiere comparacion de efectividad seria, el siguiente paso no es mas grafico: es estructurar mejor diagnostico, tratamiento y desenlace.