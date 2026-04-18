# Auditoria tecnica senior - 2026-04-18

## 1. Resumen ejecutivo

El estado general del producto es mejor de lo que sugerian las notas historicas del repositorio. La base tecnica esta bastante ordenada para una app pequena: backend NestJS modular, frontend Next.js con rutas y sesion coherentes, contratos compartidos en permisos, documentacion razonablemente alineada y una superficie de pruebas poco comun para un producto de este tamano.

Durante la auditoria se validaron en vivo los checks principales y todos pasaron:

- Backend typecheck: OK
- Frontend typecheck: OK
- Backend e2e principal: 187/187 OK
- Backend Jest: 244/244 OK
- Frontend Jest: 235/235 OK
- Frontend Playwright smoke: 2/2 OK

Despues de aplicar los fixes de prioridad alta y media se corrio una segunda validacion focalizada y tambien quedo en verde:

- Backend typecheck post-fix: OK
- Frontend typecheck post-fix: OK
- Backend Jest focalizado post-fix: 38/38 OK
- Frontend Jest focalizado post-fix: 14/14 OK
- Backend e2e canonico post-fix (`app.e2e-spec.ts`): PASS

Tambien confirme que varios riesgos antiguos ya no aplican en el estado actual del codigo:

- Los controles de acceso de consents y alerts hoy si verifican acceso al paciente y quedaron cubiertos por e2e.
- El problema historico de persistencia de secciones de atencion como string/objeto ya no aparece en el flujo actual.
- La pagina raiz ya envuelve correctamente el layout principal; la observacion vieja sobre App Router quedo resuelta.

Los tres hallazgos prioritarios detectados en la pasada original quedaron corregidos y validados:

1. El contrato de update de seguimientos ya no rompe la edicion desde ficha.
2. El popover del header ya no convierte un error de carga en un falso estado vacio.
3. La generacion automatica de seguimientos recurrentes ahora deja rastro de auditoria propio.

### Actualizacion de remediacion

- Pasada 1 completada: backend alineado para aceptar `recurrenceRule` en update de seguimientos, normalizar `dueDate` vacio a `null` y registrar auditoria `CREATE` al autogenerar tareas recurrentes.
- Pasada 2 completada: frontend alineado para enviar `dueDate: null` al limpiar fecha en edicion y el popover de alertas ahora muestra error explicito con reintento en vez de un falso estado vacio.
- Validacion final completada: typecheck backend/frontend, Jest focalizado backend/frontend y e2e backend canonico en verde.

## 2. Veredicto de produccion

**Veredicto actualizado: esta razonablemente lista.**

No la calificaria como "no esta lista" porque los flujos nucleares ya estaban bien cubiertos y, despues de la remediacion, los tres hallazgos prioritarios quedaron cerrados con pruebas concretas.

Ahora si la calificaria como "esta razonablemente lista" porque el unico bug claramente bloqueante de flujo diario que quedaba en la auditoria inicial ya no sigue abierto, el falso vacio de alertas tambien quedo resuelto y la trazabilidad de recurrencias mejoro.

Mi criterio practico es este:

- Ya movio a "esta razonablemente lista" tras corregir el contrato de update de seguimientos, el estado de error del bell y el audit log de recurrencias.
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

### L1. `priority` existe en modelo y API, pero la UI principal de seguimientos no la usa

**Evidencia tecnica**

- El backend soporta prioridad en update: `backend/src/patients/dto/update-patient-task-status.dto.ts:29-32`.
- La persistencia y la generacion recurrente tambien la mantienen: `backend/src/patients/patients-task-mutations.ts:255-257`.
- El formulario principal de la ficha solo expone titulo, detalle, tipo, recurrencia y fecha, sin un control para prioridad: `frontend/src/app/(dashboard)/pacientes/[id]/PatientTasksCard.tsx:95-120`.

**Impacto real**

- No es un bug bloqueante, pero si una superficie a medio construir: el dominio soporta prioridad, la API la acepta, pero el producto no la aprovecha desde su UI principal.
- Eso agrega complejidad conceptual innecesaria y dificulta decidir si el campo es una feature real o deuda.

## 4. Inconsistencias frontend-backend

### I1. Contrato de update de seguimientos desalineado

Resuelta en esta remediacion. Frontend y backend ya convergen en el mismo contrato para editar seguimientos recurrentes y limpiar fecha de vencimiento.

### I2. `priority` esta viva en el dominio y muerta en la UI principal

No rompe nada, pero hoy hay una API mas rica que el producto real. En una codebase pequena esto conviene resolverlo rapido: o se expone la prioridad de forma util, o se simplifica el dominio y se la saca del camino.

## 5. Riesgos medicos especificos

Tras la remediacion, los riesgos mas serios detectados en la pasada original quedaron cerrados. Los riesgos clinicos residuales pasan a ser mas menores y de producto que de integridad inmediata:

1. `priority` sigue viva en dominio/API pero no en la UI principal de seguimientos.
2. Sigue faltando deteccion simple de posibles pacientes duplicados.
3. Sigue siendo buena idea dar visibilidad operacional a backups y restauracion desde UI admin, aunque el soporte tecnico ya exista por scripts.

Tambien es importante decir lo que **no** vi como riesgo actual:

- No encontre evidencia vigente de acceso cruzado entre medicos en consents y alerts; el codigo actual y los e2e van en la direccion correcta.
- No encontre evidencia actual de corrupcion de datos en el guardado normal de secciones de atencion.
- No vi un problema estructural de autenticacion o refresco de sesion que hoy deje al sistema inestable.

## 6. Mejoras recomendadas

Estas son mejoras concretas y de bajo costo. No recomiendo capas enterprise extra.

1. Decidir si `priority` es feature real. Si lo es, exponerla en ficha y bandeja de seguimientos. Si no, removerla para simplificar.
2. Hacer mas explicitos los permisos a nivel de controller en endpoints sensibles donde hoy el contrato de autorizacion depende mas de servicios que de decoradores.
3. Agregar deteccion simple de duplicados de paciente al crear o editar.
4. Dar visibilidad desde UI admin al ultimo backup exitoso y a la ultima prueba de restauracion.
5. Mantener el patron de pruebas focalizadas para cambios de contrato frontend-backend y para componentes UX clinicos del header.

## 7. Funcionalidades nuevas sugeridas

No propongo nada enterprise. Solo mejoras utiles para una consulta pequena.

1. Deteccion simple de posibles pacientes duplicados al crear o editar, usando RUT y combinacion nombre + fecha de nacimiento.
2. Reagendar o posponer seguimientos desde la bandeja sin entrar a editar toda la ficha.
3. Recordatorios de vencimiento o renovacion de consentimientos.
4. Banner clinico breve en la ficha con alertas relevantes, alergias o banderas de riesgo importantes.
5. Vista previa rapida de adjuntos PDF e imagenes sin descargar siempre el archivo.
6. Filtro operativo de pacientes con seguimientos vencidos hoy, esta semana o sin fecha.
7. Widget de admin con ultimo backup exitoso y ultima prueba de restauracion, aprovechando los scripts que ya existen.
8. Resumen imprimible de una pagina para proximo control, con problemas activos, seguimientos pendientes y alertas.
9. Fusion o archivado asistido de fichas duplicadas.
10. Plantillas cortas de atencion para controles frecuentes, evitando reescritura manual.

## 8. Plan de accion priorizado

### P0 - Completado en esta remediacion

1. Contrato de update de seguimientos corregido en backend y frontend.
2. Normalizacion de `dueDate` vacio corregida en edicion.
3. Error state de `AlertPopover` corregido con reintento.
4. Audit log propio agregado para tareas recurrentes autogeneradas.
5. Cobertura agregada y validada con typecheck, Jest focalizado y e2e backend canonico.

### P1 - Proxima semana

1. Decidir el destino de `priority`: exponerla o eliminarla del producto.
2. Hacer una pasada corta de permisos explicitos en controllers sensibles para que el contrato quede menos implicito.
3. Evaluar deteccion simple de duplicados de pacientes.

### P2 - Corto plazo pragmatica

1. Implementar 2 o 3 mejoras de producto de alto valor y bajo costo: duplicados, reprogramacion rapida de seguimientos y estado visible de backups.
2. Mantener el enfoque actual: simplicidad operativa, buenas pruebas y nada de complejidad enterprise innecesaria.

## Cierre

La conclusion mas importante de esta auditoria y su remediacion es que la app no necesitaba una reescritura ni una re-arquitectura. Necesitaba arreglar bien un par de contratos rotos y cerrar un hueco de trazabilidad y otro de UX clinica. Hecho eso y validado con pruebas, queda en una posicion razonablemente buena para el tamano real del producto.