# Auditoria tecnica senior - 2026-04-18

## 1. Resumen ejecutivo

El estado general del producto es mejor de lo que sugerian las notas historicas del repositorio. La base tecnica esta bastante ordenada para una app pequena: backend NestJS modular, frontend Next.js con rutas y sesion coherentes, contratos compartidos en permisos, documentacion razonablemente alineada y una superficie de pruebas poco comun para un producto de este tamano.

Durante la auditoria se validaron en vivo los checks principales y todos pasaron:

- Backend typecheck: OK
- Frontend typecheck: OK
- Backend e2e principal: 190/190 OK
- Backend Jest: 253/253 OK
- Frontend Jest: 242/242 OK
- Frontend Playwright smoke: 2/2 OK

Despues de aplicar los fixes de prioridad alta y media se corrio una segunda validacion focalizada y tambien quedo en verde:

- Backend typecheck post-fix: OK
- Frontend typecheck post-fix: OK
- Backend Jest focalizado post-fix: 38/38 OK
- Frontend Jest focalizado post-fix: 14/14 OK
- Backend e2e canonico post-fix (`app.e2e-spec.ts`): PASS

Despues de la tercera pasada de endurecimiento pragmatica tambien quedo validado lo nuevo:

- Backend typecheck: OK
- Frontend typecheck: OK
- Backend Jest completo: 253/253 OK
- Frontend Jest completo: 242/242 OK
- Backend e2e canonico (`app.e2e-spec.ts`): 190/190 OK

Despues de la cuarta pasada de producto y operacion tambien quedo validado lo nuevo:

- Backend typecheck: OK
- Frontend typecheck: OK
- Backend Jest completo: 253/253 OK
- Frontend Jest completo: 242/242 OK
- Frontend Jest focalizado de flujos nuevos: 20/20 OK
- Backend e2e canonico (`app.e2e-spec.ts`): 190/190 OK

Tambien confirme que varios riesgos antiguos ya no aplican en el estado actual del codigo:

- Los controles de acceso de consents y alerts hoy si verifican acceso al paciente y quedaron cubiertos por e2e.
- El problema historico de persistencia de secciones de atencion como string/objeto ya no aparece en el flujo actual.
- La pagina raiz ya envuelve correctamente el layout principal; la observacion vieja sobre App Router quedo resuelta.

Los tres hallazgos prioritarios detectados en la pasada original quedaron corregidos y validados:

1. El contrato de update de seguimientos ya no rompe la edicion desde ficha.
2. El popover del header ya no convierte un error de carga en un falso estado vacio.
3. La generacion automatica de seguimientos recurrentes ahora deja rastro de auditoria propio.

Y en esta pasada adicional tambien quedaron resueltas tres mejoras pragmatica que habian quedado como siguientes pasos:

1. Los permisos de controllers sensibles quedaron mas explicitos con `@Roles()` donde antes el contrato era mas implicito.
2. Crear y editar paciente ahora advierten posibles duplicados por RUT y por combinacion nombre + fecha de nacimiento.
3. La pestaña admin de sistema ahora muestra ultimo backup y ultima prueba de restauracion usando el estado operativo real de SQLite.

Y en una cuarta pasada quedaron resueltas cuatro decisiones de producto que habian quedado pendientes, sin agregar complejidad innecesaria:

1. `priority` se expuso de forma util en ficha y bandeja en vez de arrastrar un campo muerto en la UI.
2. La bandeja de seguimientos ahora permite reprogramacion rapida sin entrar a editar toda la ficha.
3. La deteccion de duplicados ahora tambien ofrece archivado asistido desde la ficha clinica actual.
4. La pestaña Sistema ahora incluye checklist operativa embebida y comandos reales del runbook.

### Actualizacion de remediacion

- Pasada 1 completada: backend alineado para aceptar `recurrenceRule` en update de seguimientos, normalizar `dueDate` vacio a `null` y registrar auditoria `CREATE` al autogenerar tareas recurrentes.
- Pasada 2 completada: frontend alineado para enviar `dueDate: null` al limpiar fecha en edicion y el popover de alertas ahora muestra error explicito con reintento en vez de un falso estado vacio.
- Pasada 3 completada: controllers con permisos explicitos en lecturas sensibles, endpoint de posibles duplicados con warning en alta/edicion de pacientes y tab admin de sistema con ultimo backup + restore drill real desde `/health/sqlite`.
- Pasada 4 completada: prioridad visible y filtrable en seguimientos, reprogramacion rapida desde bandeja, CTA de archivado asistido para duplicados desde ficha y checklist operativa embebida en Sistema.
- Validacion final completada: typecheck backend/frontend, Jest completo backend/frontend, Jest focalizado frontend de los nuevos flujos y e2e backend canonico en verde.

## 2. Veredicto de produccion

**Veredicto actualizado: esta razonablemente lista.**

No la calificaria como "no esta lista" porque los flujos nucleares ya estaban bien cubiertos y, despues de la remediacion, los tres hallazgos prioritarios quedaron cerrados con pruebas concretas.

Ahora si la calificaria como "esta razonablemente lista" porque el unico bug claramente bloqueante de flujo diario que quedaba en la auditoria inicial ya no sigue abierto, el falso vacio de alertas tambien quedo resuelto y la trazabilidad de recurrencias mejoro.

Mi criterio practico es este:

- Ya movio a "esta razonablemente lista" tras corregir el contrato de update de seguimientos, el estado de error del bell y el audit log de recurrencias.
- La pasada adicional tambien cerro tres endurecimientos utiles sin agregar complejidad de producto: permisos explicitos, warning de duplicados y visibilidad operativa de SQLite.
- La cuarta pasada cerro lo que faltaba para que esas superficies fueran realmente usables: prioridad visible, bandeja con reprogramacion rapida y checklist operativa embebida.
- No veo justificacion para meter microservicios, colas, Kubernetes, SIEM ni capas enterprise adicionales. Para este tamano no hace falta.

Bloqueantes recomendados antes de darla por tranquila en produccion:

1. No quedan bloqueantes de prioridad alta/media abiertos de esta auditoria.
2. Lo pendiente pasa a ser endurecimiento menor y decisiones de simplificacion de producto.

## 3. Hallazgos detallados por prioridad

### Alta

### H1. La edicion de seguimientos desde ficha de paciente puede romperse con 400

**Estado de remediacion**

- Corregido y validado.

**Remediacion aplicada**

- Backend: `UpdatePatientTaskStatusDto` ahora acepta `recurrenceRule` y normaliza `dueDate: ''` a `null`.
- Frontend: el PUT de seguimiento normaliza `dueDate` a `null` cuando el usuario limpia la fecha.
- Cobertura agregada: DTO validation backend, mutacion backend y flujo real de edicion en la pagina de paciente.

**Evidencia tecnica**

- Validado por Jest frontend y backend focalizado, mas e2e backend canonico sin regresiones.

**Impacto residual**

- No queda un riesgo abierto de 400 por este caso dentro del flujo editado y validado.
- El riesgo residual pasa a ser bajo y queda mas asociado a decisiones futuras de producto sobre `priority` que al contrato actual.

**Por que importa en esta app**

Los seguimientos son parte del control clinico y operativo. Si editar falla, el equipo termina cerrando y recreando tareas manualmente, o deja tareas con configuracion vieja. En una app usada por 1 a 5 personas esto no quiebra el sistema, pero si ensucia el trabajo diario y aumenta el riesgo de seguimiento inconsistente.

### Media

### M1. El bell de alertas puede mentir: mostrar vacio cuando la lista fallo

**Estado de remediacion**

- Corregido y validado.

**Remediacion aplicada**

- El popover ahora distingue error de lista y muestra un estado explicito con boton de reintento.
- Se agrego una prueba que cubre exactamente el escenario `count OK + list error + retry`.

**Evidencia tecnica**

- Validado por Jest frontend focalizado.

**Impacto residual**

- Ya no queda el riesgo de empty state falso para el caso auditado.
- El riesgo residual es bajo y se limita a futuros cambios visuales si se toca nuevamente este componente sin cobertura equivalente.

**Por que importa en esta app**

No es un bug cosmetico cualquiera. En un producto clinico, ocultar un fallo de carga bajo un empty state es peor que mostrar error, porque induce una conclusion operativa falsa.

### M2. La auto-creacion de seguimientos recurrentes no deja auditoria propia para la nueva tarea

**Estado de remediacion**

- Corregido y validado.

**Remediacion aplicada**

- La creacion automatica de la siguiente tarea recurrente ahora registra su propio evento `CREATE` en auditoria dentro de la misma transaccion.
- Se agrego una prueba backend que verifica la presencia de ese audit log.

**Evidencia tecnica**

- Validado por Jest backend focalizado.

**Impacto residual**

- Queda cerrada la falta de trazabilidad directa para la nueva tarea recurrente.
- El riesgo residual es bajo y queda en la calidad semantica futura de los diffs de auditoria, no en ausencia del evento.

**Por que importa en esta app**

En un entorno medico pequeno la auditoria no necesita ser enterprise, pero si debe responder algo muy simple: "cuando aparecio este seguimiento y por que". Hoy ese rastro queda incompleto.

### Baja

### L1. `priority` estaba viva en el dominio y muerta en la UI principal

**Estado de remediacion**

- Corregido y validado.

**Remediacion aplicada**

- La ficha del paciente ahora expone `priority` en el formulario principal de seguimientos.
- La bandeja de seguimientos ahora muestra badge, filtro por prioridad y reprogramacion rapida usando el mismo contrato de update.
- Se agrego cobertura e2e para `GET /api/patients/tasks?priority=ALTA` y pruebas frontend para el nuevo flujo de bandeja.

**Impacto residual**

- La decision se resolvio a favor de exponer `priority`, que era mas barata y coherente que limpiar dominio, DTOs, persistencia y dashboard a la vez.
- No queda un hueco de contrato abierto alrededor de este campo.

**Por que importa en esta app**

En una consulta chica, un campo de prioridad solo vale si realmente ordena el trabajo diario. Ahora ya no es deuda conceptual: sirve para marcar, filtrar y posponer seguimientos sin recorrer toda la ficha.

## 4. Inconsistencias frontend-backend

### I1. Contrato de update de seguimientos desalineado

Resuelta en esta remediacion. Frontend y backend ya convergen en el mismo contrato para editar seguimientos recurrentes y limpiar fecha de vencimiento.

### I2. `priority` esta viva en el dominio y muerta en la UI principal

Resuelta en esta remediacion. La prioridad ahora esta expuesta en ficha y bandeja, con filtro operativo y pruebas de contrato.

## 5. Riesgos medicos especificos

Tras la remediacion, los riesgos mas serios detectados en la pasada original quedaron cerrados. Los riesgos clinicos residuales pasan a ser menores y mas de producto que de integridad inmediata:

1. Si a futuro aparece un volumen real de duplicados conflictivos, podria hacer falta una fusion segura; hoy el archivado asistido cubre el caso pragmatico.
2. No veo otro hueco abierto de contrato, acceso o continuidad operacional comparable a los que existian al inicio de la auditoria.

Tambien es importante decir lo que **no** vi como riesgo actual:

- No encontre evidencia vigente de acceso cruzado entre medicos en consents y alerts; el codigo actual y los e2e van en la direccion correcta.
- No encontre evidencia actual de corrupcion de datos en el guardado normal de secciones de atencion.
- No vi un problema estructural de autenticacion o refresco de sesion que hoy deje al sistema inestable.

## 6. Mejoras recomendadas

Estas son mejoras concretas y de bajo costo. No recomiendo capas enterprise extra.

1. Mantener `priority`, el filtro de bandeja y la reprogramacion rapida cubiertos por pruebas cuando cambie el inbox de seguimientos.
2. Si el warning de duplicados empieza a generar trabajo real recurrente, evaluar fusion segura; si no, quedarse con archivado asistido.
3. Mantener `/health/sqlite` y la pestaña de sistema como contrato estable con pruebas cuando cambien scripts operativos.
4. Mantener el patron de `@Roles()` explicito en endpoints nuevos para no volver a contratos de autorizacion demasiado implicitos.
5. Mantener el patron de pruebas focalizadas para cambios de contrato frontend-backend y para componentes UX clinicos del header.

## 7. Funcionalidades nuevas sugeridas

No propongo nada enterprise. Solo mejoras utiles para una consulta pequena.

1. Recordatorios de vencimiento o renovacion de consentimientos.
2. Banner clinico breve en la ficha con alertas relevantes, alergias o banderas de riesgo importantes.
3. Vista previa rapida de adjuntos PDF e imagenes sin descargar siempre el archivo.
4. Filtro operativo de pacientes con seguimientos vencidos hoy, esta semana o sin fecha.
5. Resumen imprimible de una pagina para proximo control, con problemas activos, seguimientos pendientes y alertas.
6. Fusion segura de fichas duplicadas solo si el archivado asistido se queda corto en uso real.
7. Plantillas cortas de atencion para controles frecuentes, evitando reescritura manual.

## 8. Plan de accion priorizado

### P0 - Completado en esta remediacion

1. Contrato de update de seguimientos corregido en backend y frontend.
2. Normalizacion de `dueDate` vacio corregida en edicion.
3. Error state de `AlertPopover` corregido con reintento.
4. Audit log propio agregado para tareas recurrentes autogeneradas.
5. Permisos explicitos agregados en controllers sensibles donde el contrato estaba demasiado implicito.
6. Warning de posibles duplicados agregado en alta y edicion de pacientes.
7. Visibilidad admin agregada para ultimo backup y ultimo restore drill en la pestaña de sistema.
8. `priority` expuesta en ficha y bandeja de seguimientos, con filtro operativo.
9. Reprogramacion rapida agregada en la bandeja de seguimientos.
10. Archivado asistido de ficha duplicada agregado desde la vista clinica.
11. Checklist operativa embebida en la pestaña Sistema con comandos reales del runbook.
12. Cobertura agregada y validada con typecheck, Jest completo, Jest focalizado y e2e backend canonico.

### P1 - Proxima semana

1. Definir si hace falta fusion segura de duplicados mas alla del archivado asistido actual.
2. Agregar filtro operativo de pacientes con seguimientos vencidos hoy, esta semana o sin fecha.
3. Mantener `/health/sqlite` y la pestaña Sistema como contrato estable con pruebas cuando cambien scripts o cron operativos.
4. Evaluar recordatorios simples de consentimientos o tareas administrativas cercanas a vencer.

### P2 - Corto plazo pragmatica

1. Implementar 2 o 3 mejoras de producto de alto valor y bajo costo: recordatorios simples, filtro operativo de seguimientos y resumen imprimible de control.
2. Mantener el enfoque actual: simplicidad operativa, buenas pruebas y nada de complejidad enterprise innecesaria.

## Cierre

La conclusion mas importante de esta auditoria y su remediacion es que la app no necesitaba una reescritura ni una re-arquitectura. Necesitaba arreglar bien un par de contratos rotos, cerrar un hueco de trazabilidad y terminar cuatro superficies de producto que estaban a medio usar. Hecho eso y validado con pruebas, queda en una posicion razonablemente buena para el tamano real del producto.