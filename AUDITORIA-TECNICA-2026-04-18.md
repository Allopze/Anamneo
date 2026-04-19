# Auditoría técnica integral - Anamneo

Fecha: 2026-04-18

## Actualización 2026-04-19

- Se aplicó una pasada correctiva sobre los hallazgos altos H1, H2 y H4.
- Se aplicó una segunda pasada correctiva sobre los hallazgos medios H3 y H5.
- Quedó implementada una bandeja mínima de pacientes archivados con restauración desde frontend, filtro `archived` en backend y reapertura automática de las atenciones que el archivado había cancelado.
- `Encounter.updatedAt` ahora se toca cuando se guarda o reconcilia una sección, por lo que dashboard, actividad reciente y detección de borradores obsoletos vuelven a apoyarse en una fecha clínicamente útil.
- `ClinicalAlerts` dejó de depender del timeline resumido roto y pasó a leer `clinical-summary`, reutilizando `shared/vital-sign-alerts.ts`.
- Ante un `409`, el frontend ahora conserva la copia local conflictiva en `localStorage`, recarga la versión servidor como base segura y expone acciones explícitas para restaurar o descartar esa copia.
- `verifyChain()` ahora recalcula el hash esperado con el contenido real de cada evento, y la ruta `GET /api/audit/integrity/verify` quedó declarada en un orden no ambiguo.
- Validación posterior a los fixes: `npm --prefix backend run typecheck`, `npm --prefix frontend run typecheck`, `npm --prefix backend run test -- --runInBand src/audit/audit.service.spec.ts`, `npm --prefix frontend run test -- --runInBand src/__tests__/lib/encounter-draft.test.ts src/__tests__/app/atencion-cierre.test.tsx` y `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`, todo en verde.

## 1. Resumen ejecutivo

- La base del producto está mejor de lo que suele verse en una app interna pequeña: monorepo claro, límites de dominio razonables, permisos bastante bien alineados entre frontend y backend, y una suite de tests amplia para el tamaño real del sistema.
- Durante esta auditoría quedaron en verde `backend/frontend typecheck`, suites unitarias dirigidas, E2E backend completo y previamente también Playwright frontend completo.
- No encontré corrupción directa de datos en los flujos principales, ni bypasses obvios de permisos en pacientes, atenciones, tareas, consentimientos o alertas.
- Tras las dos pasadas correctivas del 2026-04-19, ya no quedan abiertos los hallazgos altos ni los medios más delicados detectados en la auditoría original.
- El impacto residual es funcional y operativo, no "enterprise": hoy lo pendiente es más de cierre de producto y consistencia que de estabilidad base.
- Nivel de madurez general: medio-alto para una app médica pequeña usada por hasta 5 personas.
- Veredicto actualizado: **está razonablemente lista para producción** para su contexto real.

## 2. Veredicto de preparación para producción

- Conclusión: **está razonablemente lista**
- Justificación concreta:
- Hay buena base técnica y buena cobertura automática.
- Quedaron en verde `npm --prefix backend run typecheck`, `npm --prefix frontend run typecheck`, `npm --prefix backend run test -- --runInBand src/audit/audit.service.spec.ts`, `npm --prefix frontend run test -- --runInBand src/__tests__/lib/encounter-draft.test.ts src/__tests__/app/atencion-cierre.test.tsx` y `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`.
- Los contratos de permisos clínicos están bastante bien cerrados y el guardado de secciones tiene control de concurrencia con `409`.
- El flujo de concurrencia ya no pierde silenciosamente el texto local: conserva una copia recuperable y obliga a una acción explícita del usuario para restaurarla o descartarla.
- La verificación de auditoría ya no es superficial: recalcula el hash del contenido real de cada evento antes de declarar la cadena válida.
- Blockers de producción:
  - No identifiqué blockers nuevos de severidad alta o media para el contexto real de uso.
- Riesgos aceptables para este contexto:
  - El tope de 500 pacientes en búsqueda clínica es aceptable hoy porque la UI sí avisa cuando aplica.
  - La UX de login con refresh revocado es molesta pero no rompe datos.
  - `centroMedico` incompleto en UI no bloquea si ese campo aún no es operativo.
- Condiciones mínimas para desplegar con confianza:
  - Mantener la pasada actual validada en staging/local con el flujo real de archivado-restauración y conflicto `409`.
  - Cerrar la decisión de producto sobre `centroMedico`: exponerlo bien o retirarlo temporalmente.
  - Unificar la convención de fechas "solo día" antes de seguir ampliando problemas/tareas/fechas administrativas.

## 3. Hallazgos

### H1. Archivar un paciente cancela atenciones activas, pero la recuperación es incompleta y la UI no expone restauración

- Estado 2026-04-19: **Resuelto en esta pasada**
- Prioridad original: **Alto**
- Área afectada: **full stack / flujos clínicos / UX**
- Archivo(s) o módulo(s) involucrados:
  - `backend/src/patients/patients-lifecycle-mutations.ts:165-201`
  - `backend/src/patients/patients.controller.ts:287-293`
  - `frontend/src/app/(dashboard)/pacientes/[id]/page.tsx:372-379`
  - `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx:155-160`
  - `backend/src/encounters/encounters-workflow-reopen-cancel-review.ts:116-155`
- Explicación concreta del problema:
  - Al archivar un paciente, el backend cancela en lote todas las atenciones `EN_PROGRESO` con `updateMany`.
  - El backend sí tiene endpoint de restauración (`POST /patients/:id/restore`), pero no encontré ninguna UI en `frontend/src` para usarlo.
  - Restaurar el paciente solo limpia `archivedAt`; no reactiva automáticamente las atenciones canceladas durante el archivado.
  - Además, el archivado masivo no deja auditoría por encuentro ni motivo explícito de cancelación por cada atención afectada.
- Por qué importa:
  - Un archivado erróneo o apresurado puede cortar una atención en curso y dejar al usuario con una recuperación parcial y poco obvia.
  - En una app médica pequeña esto no es un edge case teórico: archivar duplicados o fichas erróneas es un flujo plausible.
- Cómo reproducirlo o cómo razoné que existe:
  - El código de archivado cancela en bloque atenciones activas en `patients-lifecycle-mutations.ts:167-175`.
  - La restauración del paciente no toca encuentros en `patients-lifecycle-mutations.ts:236-243`.
  - En frontend solo existe la acción de archivar y el mensaje "podrá restaurarse más adelante", pero no una acción visible de restauración.
- Resolución aplicada:
  - Se añadió filtro/lista de pacientes archivados en frontend y backend.
  - Se expuso restauración real desde la UI con `POST /patients/:id/restore`.
  - El archivado ahora deja trazabilidad por encuentro y la restauración reabre exactamente las atenciones que ese archivado había cancelado.
- Complejidad estimada de arreglo: **media**

### H2. `encounter.updatedAt` no refleja la última edición clínica real, pero el sistema sí lo trata como si la reflejara

- Estado 2026-04-19: **Resuelto en esta pasada**
- Prioridad original: **Alto**
- Área afectada: **backend / frontend / datos / UX**
- Archivo(s) o módulo(s) involucrados:
  - `backend/src/encounters/encounters-section-mutations.ts:178-186`
  - `backend/src/encounters/encounters-presenters.ts:127-139`
  - `backend/src/encounters/encounters-dashboard-read-model.ts:48-57`
  - `frontend/src/app/(dashboard)/page.tsx:398`
  - `frontend/src/app/(dashboard)/RecentActivitySection.tsx:68-72`
  - `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterDraftSync.ts:57-60`
- Explicación concreta del problema:
  - Guardar una sección actualiza `EncounterSection.updatedAt`, pero no toca la fila `Encounter`.
  - Aun así, el backend sigue exponiendo `encounter.updatedAt` como si fuera la última edición útil de la atención.
  - El dashboard ordena actividad reciente por ese campo y el frontend lo usa para decidir si un borrador local quedó obsoleto.
- Por qué importa:
  - La actividad reciente puede quedar desordenada o con timestamps engañosos.
  - Un borrador viejo puede restaurarse como si siguiera vigente aunque otra sesión ya haya cambiado secciones.
- Cómo reproducirlo o cómo razoné que existe:
  - La mutación de sección no hace `update` del `Encounter` padre.
  - El dashboard ordena `recent` por `updatedAt desc`.
  - El hook de borradores compara `encounter.updatedAt` con `storedDraft.encounterUpdatedAt`.
- Resolución aplicada:
  - `Encounter.updatedAt` se actualiza cuando se guarda o reconcilia una sección, cerrando la incoherencia sin introducir un campo nuevo.
- Complejidad estimada de arreglo: **media**

### H3. La resolución de conflictos `409` descarta el estado local de la sección sin ofrecer merge, diff ni backup

- Estado 2026-04-19: **Resuelto de forma proporcional en esta pasada**

- Prioridad: **Medio**
- Área afectada: **frontend / edición clínica / manejo de errores**
- Archivo(s) o módulo(s) involucrados:
  - `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts:122-153`
  - `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts:323-334`
- Explicación concreta del problema:
  - Cuando el backend devuelve `409`, el frontend recarga la sección desde servidor y reemplaza `formData` local por la versión remota.
  - El usuario recibe un toast, pero el texto local no se conserva en un draft paralelo, diff modal o mecanismo de recuperación.
- Por qué importa:
  - La concurrencia está protegida contra sobrescritura silenciosa, lo cual es bueno.
  - Pero el costo actual de esa protección es pérdida local de trabajo ya escrito.
- Cómo reproducirlo o cómo razoné que existe:
  - Dos pestañas editan la misma sección.
  - La segunda guarda con `baseUpdatedAt` viejo.
  - `onError` llama `refreshSectionFromServer`, reinyecta `latestSection.data` y marca la sección como limpia.
- Resolución aplicada:
  - Antes de sobreescribir la sección, el frontend guarda la copia local conflictiva en `localStorage`.
  - La atención vuelve a mostrar la versión servidor como base segura, pero expone un banner con acciones explícitas para restaurar o descartar la copia local.
  - Se añadieron pruebas dirigidas para helpers de conflicto y para la UX visible de recuperación.
- Complejidad estimada de arreglo: **media**

### H4. `ClinicalAlerts` no puede leer el último examen físico y pierde advertencias contextuales relevantes

- Estado 2026-04-19: **Resuelto en esta pasada**
- Prioridad original: **Alto**
- Área afectada: **full stack / UX clínica**
- Archivo(s) o módulo(s) involucrados:
  - `frontend/src/components/ClinicalAlerts.tsx:23-30`
  - `frontend/src/components/ClinicalAlerts.tsx:77-87`
  - `backend/src/encounters/encounters-read-side.ts:194-222`
  - `backend/src/encounters/encounters-presenters.ts:66-85`
  - `shared/vital-sign-alerts.ts:36-169`
- Explicación concreta del problema:
  - `ClinicalAlerts` consume `/patients/:id/encounters?page=1&limit=1` y luego intenta leer `recentEncounter.sections`.
  - Ese endpoint devuelve un timeline resumido: las `sections` solo traen `sectionKey` y `completed` para progreso, y el presenter final ni siquiera expone `sections`.
  - Resultado: `latestExam` queda `undefined` y nunca se agregan advertencias derivadas del último examen físico.
  - Además, este componente duplica lógica clínica con umbrales distintos a `shared/vital-sign-alerts.ts`, en vez de reutilizar el contrato compartido.
- Por qué importa:
  - En la workspace de atención no se están viendo advertencias contextuales de warning-level del último control previo, como fiebre o PA elevada.
  - No es el mismo circuito que las alertas persistidas críticas; aquí se pierde contexto útil, no solo "ruido".
- Cómo reproducirlo o cómo razoné que existe:
  - El componente espera `Encounter.sections`.
  - El read model `findEncountersByPatientReadModel` devuelve `formatEncounterForPatientList`, que no incluye `sections`.
  - El propio código de `ClinicalAlerts` calcula `latestExam` a partir de un campo que no llega.
- Resolución aplicada:
  - El componente dejó de usar el timeline resumido.
  - Ahora consume `/patients/:id/clinical-summary` y reutiliza `shared/vital-sign-alerts.ts`.
- Complejidad estimada de arreglo: **baja-media**

### H5. La verificación de integridad de auditoría da más confianza de la que realmente merece

- Estado 2026-04-19: **Resuelto en esta pasada**

- Prioridad: **Medio**
- Área afectada: **backend / auditoría**
- Archivo(s) o módulo(s) involucrados:
  - `backend/src/audit/audit.service.ts:140-161`
  - `backend/src/audit/audit.controller.ts:35-44`
- Explicación concreta del problema:
  - `verifyChain()` solo comprueba que `previousHash` encadene con el `integrityHash` anterior.
  - No vuelve a calcular el hash esperado a partir del contenido real de cada fila.
  - Adicionalmente, el endpoint está declarado después de `:entityType/:entityId`, lo que lo deja innecesariamente frágil a nivel de routing.
- Por qué importa:
  - Si alguien altera contenido de una fila sin tocar los hashes, la verificación actual puede seguir devolviendo `valid: true`.
  - Eso convierte la verificación en una comprobación parcial, no en una validación íntegra del registro.
- Cómo reproducirlo o cómo razoné que existe:
  - El método solo selecciona `id`, `integrityHash` y `previousHash`.
  - Nunca carga `entityType`, `entityId`, `userId`, `requestId`, `action`, `reason`, `result` ni `diff`, que son precisamente la base del hash al crear el log.
- Resolución aplicada:
  - `verifyChain()` ahora carga el payload canónico completo y recalcula el hash esperado de cada fila.
  - La ruta `integrity/verify` quedó antes de la parametrizada para evitar ambigüedad innecesaria.
  - Se añadieron pruebas unitarias de cadena válida/adulterada y cobertura E2E del endpoint admin.
- Complejidad estimada de arreglo: **media**

### H6. `centroMedico` quedó a medio camino: se crea y viaja por API, pero no se puede consultar ni corregir bien desde la UI

- Prioridad: **Bajo**
- Área afectada: **full stack / datos administrativos / UX**
- Archivo(s) o módulo(s) involucrados:
  - `frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx:304-315`
  - `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx:44-54`
  - `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx:72-82`
  - `frontend/src/app/(dashboard)/pacientes/[id]/editar/page.tsx:137-145`
  - `frontend/src/app/(dashboard)/pacientes/[id]/administrativo/page.tsx:138-146`
  - `backend/src/patients/dto/update-patient.dto.ts:77-80`
  - `backend/src/patients/patients-format.ts:114-145`
- Explicación concreta del problema:
  - El alta de paciente sí expone `centroMedico`.
  - El backend lo acepta en update y lo devuelve en responses.
  - Pero la UI de edición no lo carga ni lo envía, y las vistas de detalle no lo muestran.
- Por qué importa:
  - Si el dato se registra mal, hoy queda prácticamente write-only.
  - Si el dato no se usa, sobra. Si se usa, está incompleto.
- Cómo reproducirlo o cómo razoné que existe:
  - El campo existe en creación.
  - No aparece en `editar/page.tsx`.
  - No se renderiza en detalle clínico ni administrativo.
- Propuesta de solución, proporcional al tamaño de la app:
  - O se incorpora de punta a punta en edición y detalle.
  - O se elimina del producto por ahora para no mantener un dato fantasma.
- Complejidad estimada de arreglo: **baja**

### H7. El proxy de autenticación puede generar un bounce innecesario con refresh token revocado

- Prioridad: **Bajo**
- Área afectada: **frontend / auth / UX**
- Archivo(s) o módulo(s) involucrados:
  - `frontend/src/lib/proxy-session.ts:17-20`
  - `frontend/src/proxy.ts:10-20`
  - `frontend/src/lib/api.ts:75-85`
- Explicación concreta del problema:
  - En `/login` y `/register`, el proxy redirige a `/` si hay `refresh_token`, aunque ese refresh token ya no sea válido a nivel servidor.
  - La invalidez real recién se descubre después con `/auth/me` o `/auth/refresh`.
- Por qué importa:
  - No rompe datos, pero sí genera una experiencia confusa de ida y vuelta a login cuando la sesión ya no es recuperable.
- Cómo reproducirlo o cómo razoné que existe:
  - Basta con que la cookie siga presente pero la sesión haya sido revocada del lado servidor.
  - El proxy deja pasar o redirige solo por presencia de cookie; la validez real se resuelve más tarde.
- Propuesta de solución, proporcional al tamaño de la app:
  - En rutas públicas, redirigir automáticamente solo si hay `access_token` validado.
  - O mantener la decisión actual pero con un guard más explícito y sin bounce visual.
- Complejidad estimada de arreglo: **baja**

## 4. Inconsistencias frontend-backend

- `ClinicalAlerts` asume que `/patients/:id/encounters?page=1&limit=1` devuelve `Encounter.sections`; el backend responde un resumen sin `sections` utilizables para ese componente.
- Resuelta 2026-04-19: `ClinicalAlerts` ya no depende de ese contrato.
- Resuelta 2026-04-19: `encounter.updatedAt` vuelve a representar la última edición clínica útil porque se toca al guardar secciones.
- Resuelta 2026-04-19: el frontend ya expone restauración de pacientes archivados.
- Resuelta 2026-04-19: el frontend ya no pierde silenciosamente el texto local cuando el backend responde `409`; conserva una copia recuperable antes de reinyectar estado servidor.
- El backend soporta `centroMedico` en DTOs y responses; el frontend solo lo usa al crear y luego lo deja invisible.
- Hipótesis: la estrategia de fechas "solo día" no está unificada.
- Pacientes usan `new Date(fechaNacimiento)` en `backend/src/patients/patients-intake-mutations.ts:73` y `backend/src/patients/patients-demographics-mutations.ts:73`.
- Problemas y tareas usan `parseDateOnlyToStoredUtcDate(...)` en `backend/src/common/utils/local-date.ts:86-89`.
- No vi un bug visible hoy en UI por esto, pero sí una convención inconsistente que conviene unificar antes de que aparezcan desfaces por zona horaria.

## 5. Riesgos específicos por tratarse de una app médica

- Riesgo mitigado 2026-04-19: archivar una ficha equivocada ya no deja una recuperación ciega; existe bandeja de archivados y reapertura automática de atenciones canceladas por ese archivado.
- Riesgo mitigado 2026-04-19: el panel de contexto clínico ya no pierde warning-level del último control por leer un contrato roto.
- Riesgo mitigado 2026-04-19: un conflicto de edición entre sesiones ya no descarta automáticamente el texto local; queda una copia recuperable explícita.
- Riesgo mitigado 2026-04-19: la actividad reciente volvió a alinearse con edición clínica real al corregirse `encounter.updatedAt`.
- No vi errores directos de dosis, identificadores de paciente mezclados, ni documentos firmados editables por accidente; esa parte quedó mejor resuelta que el promedio.

## 6. Mejoras recomendadas

### Quick wins

- Añadir una vista mínima de pacientes archivados con botón `Restaurar`.
- Corregir `ClinicalAlerts` para que lea una fuente que sí incluya el último examen físico o, mejor, que ya traiga un resumen clínico derivado.
- Guardar una copia local del payload conflictivo antes de sobrescribirlo tras un `409`.
- O exponer `centroMedico` en edición/detalle o retirarlo temporalmente del producto.
- Hecho 2026-04-19: copia local recuperable y banner de recuperación ante conflictos `409`.
- Hecho 2026-04-19: tests dirigidos para `archive -> restore -> recovery de atenciones`.
- Hecho 2026-04-19: tests dirigidos para `section save -> parent encounter updatedAt`.
- Hecho 2026-04-19: tests dirigidos para `ClinicalAlerts` con resumen clínico real.
- Hecho 2026-04-19: tests dirigidos y E2E para `audit integrity verify`.

### Arreglos de mayor impacto

- Unificar el significado de "última actualización clínica" y dejar de depender del `updatedAt` padre cuando solo cambian secciones.
- Dar trazabilidad por encuentro cuando el archivado de un paciente cancele trabajo en curso.
- Hecho 2026-04-19: `verifyChain()` ahora verifica contenido real y no solo el encadenamiento superficial.

### Limpieza técnica útil pero no overkill

- Unificar la convención de fechas "solo día" en pacientes, problemas y tareas.
- Eliminar código de auditoría no usado (`AuditService.findByUser`) o exponer el caso de uso real si sí se necesita.
- Reducir duplicación de reglas clínicas entre `ClinicalAlerts` y `shared/vital-sign-alerts.ts`.

## 7. Nuevas funcionalidades sugeridas

| Funcionalidad | Qué problema resuelve | Por qué tiene sentido aquí | Impacto esperado | Dificultad | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Bandeja de pacientes archivados con restauración | Hoy archivar era prácticamente unidireccional desde la UI | Ya quedó implementada en esta pasada | Alto | Baja-media | Hecho |
| Reapertura guiada de atenciones canceladas por archivado | Recuperación incompleta tras archivar/restaurar | Ya quedó resuelta automáticamente para las atenciones canceladas por el archivado | Alto | Media | Hecho |
| Modal de conflicto con diff/copia local | Hacer más legible la recuperación tras `409` | Ya existe copia local recuperable; un diff visual sería el siguiente paso natural | Medio | Media | Después |
| `lastClinicalUpdatedAt` real | Actividad reciente y drafts eran engañosos | El repositorio ya quedó cubierto tocando `Encounter.updatedAt` al guardar secciones | Alto | Media | Hecho |
| Panel clínico contextual basado en `clinical-summary` | `ClinicalAlerts` mezclaba lógica y contrato roto | Ya quedó implementado reutilizando reglas compartidas | Alto | Baja-media | Hecho |
| Timeline con eventos de archivo/cancelación/reapertura | Falta trazabilidad operativa fina | Muy útil en una app médica pequeña para entender qué pasó | Medio-alto | Media | Después |
| Centro de borradores locales | Recuperar trabajo tras logout, caída o conflicto | Ya hay drafts locales; falta hacerlos visibles y gestionables | Medio | Media | Después |
| Asistente de resolución de duplicados de paciente | Archivar duplicados hoy es un martillo grande | Ayuda a no cancelar trabajo por error cuando solo se quería revisar duplicidad | Medio | Media | Después |

## 8. Plan de acción priorizado

1. En el siguiente ciclo corto: unificar manejo de fechas "solo día" y cerrar el ciclo de `centroMedico`.

2. Después, sin urgencia: mejorar la UX de conflicto con diff visual o comparación rápida entre copia local y servidor.

3. Después, sin urgencia: mejorar trazabilidad visual de archivo/cancelación/reapertura, añadir bandeja o centro de borradores/recuperaciones y refinar la experiencia de login con refresh revocado.

4. Lo que no tocaría todavía: no reharía arquitectura, no movería a microservicios ni colas, y no metería observabilidad pesada ni compliance sobredimensionado para 5 usuarios.

## Conclusión corta

La app no está "verde" en sentido ideal, pero para su tamaño real ya quedó en un punto razonable para producción pequeña. La base es buena, los fixes de estas pasadas cerraron los hallazgos altos y medios más operativos, y los tests siguen respaldando el comportamiento. Lo que hoy separa a Anamneo de una salida todavía más tranquila no es una deuda masiva, sino cerrar algunos ajustes de producto y consistencia de menor alcance ya identificados.
