# Auditoria Tecnica Integral - 2026-04-17

## 1. Resumen ejecutivo

- La base tecnica general es mejor de lo que suele verse en una app interna pequena: arquitectura modular clara, permisos clinicos razonablemente modelados, bloqueo de output clinico por completitud del paciente, trazabilidad en auditoria y una bateria de tests que cubre bastantes flujos sensibles.
- El estado actual no es caotico ni improvisado. Backend, frontend y E2E pasan validaciones relevantes, y la aislacion de datos entre medicos esta bien cubierta por pruebas.
- El principal problema real no esta en auth ni en aislamiento de datos, sino en el flujo de trabajo clinico del encounter: hoy existen caminos para sobrescribir contenido de secciones con datos viejos o para avanzar de seccion sin que el guardado haya terminado realmente.
- En una app medica, eso pesa mas que varios detalles de UX o deuda tecnica, porque puede dejar texto clinico inconsistente sin una senal suficientemente fuerte para quien atiende.
- Tambien hay una inconsistencia semantica en la UI de alertas: en el workspace se muestra un bloque llamado “Alertas clinicas” que no consume las alertas persistidas del backend, sino heuristicas derivadas de historia y ultimo encounter.
- La madurez general es media: el producto ya tiene forma operable para un equipo pequeno, pero todavia conserva un par de defectos de flujo que no deberian salir a produccion tal como estan.
- Veredicto inicial: **no esta lista para produccion** en su estado actual, no por falta de features ni por deuda “enterprise”, sino por dos riesgos funcionales concretos en el core clinico.

### Validaciones ejecutadas para esta auditoria

- `npm --prefix backend run typecheck` -> OK
- `npm --prefix frontend run typecheck` -> OK
- Backend unitario focalizado en workflow/sections -> 16 tests OK
- Frontend unitario focalizado en proxy/offline/permissions/workflow -> 18 tests OK
- Backend E2E principal `app.e2e-spec.ts` -> 187 tests OK
- Frontend smoke E2E -> 2 tests OK

## 2. Veredicto de preparacion para produccion

### Conclusion

**No esta lista para produccion.**

### Justificacion concreta

Lo que hoy bloquea salida no es la infraestructura ni la escalabilidad. Son defectos del flujo principal de atencion:

1. La cola offline puede reinyectar payloads viejos de una seccion sin control de version y el backend los acepta ciegamente.
2. El wizard de atencion permite cambiar de seccion antes de confirmar si el guardado actual fue exitoso o no.

Ambos problemas afectan la integridad de la informacion clinica, justo en la superficie mas sensible de la app.

### Blockers de produccion

1. Sobrescritura silenciosa de secciones por replays viejos de la cola offline.
2. Navegacion entre secciones sin esperar confirmacion real del guardado.
3. Ambiguedad entre “alerta clinica real” y “resumen derivado” en la UI del workspace.

### Riesgos aceptables para este contexto

- Uso con SQLite para hasta 5 personas, siempre que se mantenga la rutina operativa documentada de backups/monitor/restore drill.
- Proxy de auth con chequeo optimista por cookies y validacion real posterior, porque el backend sigue siendo la capa de enforcement.
- Dependencia en tests E2E secuenciales mientras el equipo siga tratandolos como suite completa y no como tests aislados filtrables.

### Condiciones minimas para desplegar con confianza

1. Agregar control de concurrencia o deduplicacion para saves offline por encounter + section.
2. Bloquear el cambio de seccion hasta que guardar termine bien, o mantener al usuario en la seccion si falla.
3. Separar o renombrar la UI de alertas del workspace para que no compita conceptualmente con las alertas persistidas.
4. Hacer un pase corto de regresion manual del flujo: crear paciente rapido -> completar admin -> crear encounter -> editar secciones -> revision -> cierre -> firma -> ficha.

## 3. Hallazgos

### Hallazgo 1: La cola offline puede sobrescribir contenido clinico mas nuevo con un payload viejo

- Prioridad: **Critico**
- Area afectada: **full stack / datos / encounter workflow**
- Archivos o modulos:
  - [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue.ts](frontend/src/app/(dashboard)/atenciones/%5Bid%5D/useEncounterOfflineQueue.ts)
  - [frontend/src/lib/offline-queue.ts](frontend/src/lib/offline-queue.ts)
  - [backend/src/encounters/encounters-section-mutations.ts](backend/src/encounters/encounters-section-mutations.ts)
- Problema concreto:
  - La cola offline almacena el payload completo de la seccion y luego lo reenvia tal cual cuando vuelve la conectividad.
  - Ese replay no incluye version, `updatedAt`, hash ni ningun indicador de frescura.
  - El backend actualiza la seccion con un `update` directo y no valida si el contenido en servidor ya cambio desde que se encolo el save.
- Por que importa:
  - Puede revertir motivo de consulta, examen, sospecha o tratamiento a una version vieja sin conflicto visible.
  - En una app medica eso es riesgo directo de inconsistencia clinica y de trazabilidad enganosa.
- Como reproducirlo o razonamiento:
  - Edita una seccion sin red para que se encole.
  - Antes de que esa cola sincronice, modifica la misma seccion desde otra pestana, otra sesion o mas tarde ya online.
  - Al abrir cualquier workspace de encounter online, `syncQueue()` reenvia el save viejo y el backend lo acepta.
  - Ademas, el sync invalida solo `['encounter', id]` del encounter actualmente abierto, aunque haya sincronizado saves de otros encounters del mismo usuario.
- Propuesta de solucion proporcional:
  - En frontend, deduplicar por `encounterId + sectionKey` y conservar solo el ultimo save pendiente por seccion.
  - Guardar `sectionUpdatedAt` o un `sectionVersion` al encolar.
  - En backend, rechazar updates si la version base no coincide, devolviendo un conflicto manejable.
  - Si hay conflicto, mostrar banner simple de “esta seccion cambio en otra sesion, revisa antes de sobrescribir”.
- Complejidad estimada: **media**

### Hallazgo 2: El wizard avanza de seccion antes de saber si el guardado fue exitoso

- Prioridad: **Alto**
- Area afectada: **frontend / formularios / UX critica**
- Archivos o modulos:
  - [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardNavigation.ts](frontend/src/app/(dashboard)/atenciones/%5Bid%5D/useEncounterWizardNavigation.ts)
  - [frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts](frontend/src/app/(dashboard)/atenciones/%5Bid%5D/useEncounterSectionSaveFlow.ts)
- Problema concreto:
  - `moveToSection()` llama `saveCurrentSection()` y cambia de seccion sin esperar resultado.
  - `handleNavigate('next')` dispara `persistSection(...)` con `void` y avanza igual.
  - Si el backend responde con error de validacion, el usuario ya abandono la seccion y el feedback llega tarde y descontextualizado.
- Por que importa:
  - Puede hacer creer que una seccion quedo guardada o completada cuando no fue asi.
  - Ese patron es especialmente malo en fichas clinicas porque fomenta avanzar con falsa sensacion de cierre.
- Como reproducirlo o razonamiento:
  - Provoca un save rechazado por validacion en una seccion.
  - Presiona siguiente o cambia de seccion.
  - La navegacion ocurre antes de conocer el resultado del guardado.
- Propuesta de solucion proporcional:
  - Hacer `await` del save antes de cambiar de seccion.
  - Si falla, no navegar y dejar la seccion activa con foco en el error.
  - Mientras guarda, deshabilitar navegacion lateral y teclado de avance.
- Complejidad estimada: **baja**

### Hallazgo 3: El bloque “Alertas clinicas” del workspace no usa las alertas reales del backend

- Prioridad: **Alto**
- Area afectada: **frontend / UX / full stack semantico**
- Archivos o modulos:
  - [frontend/src/components/ClinicalAlerts.tsx](frontend/src/components/ClinicalAlerts.tsx)
  - [frontend/src/components/PatientAlerts.tsx](frontend/src/components/PatientAlerts.tsx)
  - [backend/src/alerts/alerts.service.ts](backend/src/alerts/alerts.service.ts)
- Problema concreto:
  - En el workspace de atencion, el componente llamado `ClinicalAlerts` no consulta `/alerts`.
  - Construye un listado derivado desde historia del paciente, problemas, tareas y ultimo examen fisico.
  - En otra parte del producto, `PatientAlerts` si muestra las alertas persistidas y reconocibles del backend.
- Por que importa:
  - Dos superficies distintas usan el mismo concepto visual de “alerta clinica” para fuentes distintas.
  - Una alerta reconocida o resuelta puede seguir apareciendo en el workspace porque ahi no se refleja el estado real de acknowledgement.
  - Esto puede inducir a interpretar heuristicas como alertas operativas reales.
- Como reproducirlo o razonamiento:
  - Compara el workspace de encounter con la vista de alertas del paciente.
  - Veras que una usa datos derivados y la otra usa `ClinicalAlert` persistida.
  - El nombre y el tratamiento visual no hacen esa diferencia suficientemente explicita.
- Propuesta de solucion proporcional:
  - O bien renombrar `ClinicalAlerts` a algo como “Contexto clinico relevante”.
  - O bien alimentar el bloque desde alertas reales y dejar los derivados como “recordatorios de contexto”.
  - No mezclar ambos conceptos bajo el mismo rotulo.
- Complejidad estimada: **baja**

### Hallazgo 4: Un fallo de red al bootstrap de sesion derriba la sesion local y redirige a login

- Prioridad: **Medio**
- Area afectada: **frontend / auth / resiliencia UX**
- Archivos o modulos:
  - [frontend/src/components/layout/DashboardLayout.tsx](frontend/src/components/layout/DashboardLayout.tsx)
  - [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
- Problema concreto:
  - El bootstrap del dashboard intenta `GET /auth/me`.
  - Si falla por red o backend temporalmente caido, el `catch` ejecuta `logout()`.
  - El interceptor de axios solo intenta refresh cuando hay 401; un error de transporte cae directo al logout local.
- Por que importa:
  - Un reload durante una caida breve del backend saca al profesional del flujo aunque su sesion siga siendo valida.
  - En una consulta en curso es una interrupcion evitable.
- Como reproducirlo o razonamiento:
  - Inicia sesion.
  - Corta backend o desconecta red.
  - Recarga una ruta privada.
  - El bootstrap falla y termina en login por el camino de logout local.
- Propuesta de solucion proporcional:
  - Distinguir entre error de autenticacion y error de conectividad.
  - Si es red, mantener estado local, mostrar banner offline y ofrecer reintento.
  - Reservar `logout()` para 401/refresh fallido, no para cualquier excepcion.
- Complejidad estimada: **baja**

### Hallazgo 5: Hay duplicacion real en helpers de acceso a pacientes

- Prioridad: **Bajo**
- Area afectada: **backend / permisos / mantenibilidad**
- Archivos o modulos:
  - [backend/src/patients/patients-access.ts](backend/src/patients/patients-access.ts)
  - [backend/src/common/utils/patient-access.ts](backend/src/common/utils/patient-access.ts)
- Problema concreto:
  - Existen dos implementaciones muy parecidas de chequeo de alcance sobre pacientes.
  - Ambas resuelven ownership + fallback por encounters del medico.
- Por que importa:
  - Hoy no parece romper comportamiento, pero aumenta el riesgo de drift silencioso al tocar permisos.
  - En este repo ya hay suficiente sensibilidad de alcance clinico como para no tener dos fuentes semanticas casi iguales.
- Como reproducirlo o razonamiento:
  - Al leer ambos helpers se ve que resuelven la misma logica con diferencias menores de seleccion de campos.
- Propuesta de solucion proporcional:
  - Consolidar la politica de acceso en un helper unico y derivar wrappers finos si hace falta.
- Complejidad estimada: **baja**

### Hallazgo 6: La documentacion interna del proxy de auth no coincide con la implementacion real

- Prioridad: **Bajo**
- Area afectada: **documentacion / auth**
- Archivos o modulos:
  - [docs/frontend-architecture.md](docs/frontend-architecture.md)
  - [frontend/src/proxy.ts](frontend/src/proxy.ts)
  - [frontend/src/lib/proxy-session.ts](frontend/src/lib/proxy-session.ts)
- Problema concreto:
  - La documentacion arquitectonica dice que el proxy valida sesion real consultando `/api/auth/me`.
  - El codigo real hace chequeo optimista por cookies y refresh token, y deja la validacion real para el bootstrap del dashboard.
- Por que importa:
  - No rompe produccion hoy, pero induce a diagnosticos incorrectos y decisiones futuras equivocadas en auth.
  - La documentacion de Next.js 16 recomienda precisamente usar proxy para chequeos optimistas basados en cookies y evitar checks pesados por request.
- Como reproducirlo o razonamiento:
  - Contraste directo entre documento y codigo.
  - Verificado ademas contra la doc actual de Next.js 16.
- Propuesta de solucion proporcional:
  - Corregir el doc para reflejar que el proxy hace prefiltrado optimista y el dashboard hace validacion efectiva.
- Complejidad estimada: **baja**

## 4. Inconsistencias frontend-backend

### Contratos rotos o fragiles

1. **Alertas del workspace vs alertas persistidas**
   - Frontend workspace: [frontend/src/components/ClinicalAlerts.tsx](frontend/src/components/ClinicalAlerts.tsx)
   - Frontend alertas reales: [frontend/src/components/PatientAlerts.tsx](frontend/src/components/PatientAlerts.tsx)
   - Backend real: [backend/src/alerts/alerts.service.ts](backend/src/alerts/alerts.service.ts)
   - El frontend usa dos conceptos distintos bajo una semantica casi identica.

2. **Saves de seccion sin version de concurrencia**
   - Frontend envia payload completo de seccion sin base version.
   - Backend persiste sin comparar contra `updatedAt` o version conocida.
   - El contrato de update es funcional, pero fragil para offline y multi-sesion.

3. **Proxy documentado como validacion real, implementado como chequeo optimista**
   - El comportamiento real esta bien para Next.js 16.
   - Lo inconsistente es la documentacion interna, no el runtime.

### Campos con nombres distintos

- No encontre un drift fuerte de nombres en auth, encounters, consents o alerts durante esta revision.
- El contrato general de review status, medico-only sections y completitud del paciente se ve alineado entre backend, shared contract y frontend.

### Formatos incompatibles

- No encontre un desalineamiento grave de fechas o formatos entre frontend y backend en los flujos probados.
- Si hay una fragilidad de formato, esta mas en el terreno de replays ciegos de secciones completas que en un campo puntual mal nombrado.

### Validaciones que no coinciden

- La validacion de secciones obligatorias, review note y closure note se ve consistente entre frontend y backend.
- El problema es que la UI no espera el resultado del guardado antes de permitir avanzar, no que valide menos de lo que valida el backend.

### Respuestas HTTP mal manejadas

- `GET /auth/me` en el bootstrap de dashboard trata tanto 401 como error de red por el mismo camino visible de “pierde sesion”, lo que mezcla auth y disponibilidad.

### Supuestos del frontend que el backend no garantiza

1. El frontend asume implicitamente que un save queued sigue siendo valido cuando vuelva la conectividad.
2. El wizard asume que puede avanzar mientras el save aun esta en vuelo.
3. El workspace asume que un resumen derivado puede presentarse como “alerta clinica” sin explicitar que no es una alerta persistida.

## 5. Riesgos especificos por tratarse de una app medica

1. **Sobrescritura silenciosa de una seccion clinica**
   - Riesgo directo sobre motivo de consulta, examen, sospecha o plan terapeutico.
   - Es el punto mas delicado de toda la auditoria.

2. **Avance de seccion con falsa sensacion de guardado**
   - Puede dejar secciones obligatorias incompletas o con contenido rechazado por backend mientras el profesional ya siguio el flujo.

3. **Confusion entre alerta real y resumen contextual**
   - Puede afectar la interpretacion de estados como “alerta activa”, “alerta reconocida” o “sin alertas”.

4. **Logout por error de red durante una atencion**
   - No corrompe datos por si solo, pero si interrumpe operacion en un momento sensible y puede generar desconfianza en el sistema.

## 6. Mejoras recomendadas

### Quick wins

1. Esperar el resultado del save antes de cambiar de seccion.
2. Renombrar el bloque `ClinicalAlerts` o separarlo visualmente de alertas persistidas.
3. Corregir la documentacion de auth/proxy.
4. Diferenciar en bootstrap entre 401 y error de conectividad.

### Arreglos de mayor impacto

1. Agregar control de concurrencia en updates de secciones.
2. Deduplicar cola offline por seccion y reenviar solo la ultima version pendiente.
3. Mostrar conflicto simple cuando una seccion fue modificada en otra sesion.

### Limpieza tecnica util sin overkill

1. Consolidar helpers duplicados de acceso a pacientes.
2. Invalidad caches de encounters afectados realmente cuando se sincronizan saves offline de varios encounters.
3. Agregar una prueba puntual para “no navegar si guardar falla”.

## 7. Nuevas funcionalidades sugeridas

### 1. Resolucion simple de conflictos de seccion

- Problema que resuelve: sobrescritura entre offline, otra pestana o otra sesion.
- Por que tiene sentido: ataca el mayor riesgo real detectado sin rehacer la app.
- Impacto esperado: alto.
- Dificultad estimada: media.
- Prioridad: **ahora**.

### 2. Banner de “ultima actualizacion por otro usuario/dispositivo”

- Problema que resuelve: falta de contexto cuando cambian datos entre sesiones.
- Por que tiene sentido: mejora la seguridad funcional sin complejidad enterprise.
- Impacto esperado: medio-alto.
- Dificultad estimada: baja-media.
- Prioridad: **ahora**.

### 3. Historial corto por seccion dentro del encounter

- Problema que resuelve: dificultad para entender que cambio entre borrador, reapertura y firma.
- Por que tiene sentido: ya existe auditoria; falta una lectura mas util para operacion diaria.
- Impacto esperado: medio.
- Dificultad estimada: media.
- Prioridad: **despues**.

### 4. Alertas persistidas visibles dentro del workspace de atencion

- Problema que resuelve: hoy el workspace mezcla contexto derivado y alertas reales.
- Por que tiene sentido: unifica criterio operativo en el lugar donde se atiende.
- Impacto esperado: alto.
- Dificultad estimada: baja-media.
- Prioridad: **ahora**.

### 5. Reglas de “pendientes al cierre” para tareas o examenes vinculados

- Problema que resuelve: cerrar una atencion sin ver que quedan examenes/seguimientos pendientes.
- Por que tiene sentido: encaja con el producto actual y con el modelo de tareas/adjuntos ya existente.
- Impacto esperado: medio.
- Dificultad estimada: media.
- Prioridad: **despues**.

### 6. Plantillas de cierre por motivo frecuente

- Problema que resuelve: notas de cierre repetitivas o pobres.
- Por que tiene sentido: ya existe infraestructura de templates.
- Impacto esperado: medio.
- Dificultad estimada: baja.
- Prioridad: **despues**.

### 7. Confirmacion guiada de resultados criticos en adjuntos

- Problema que resuelve: subir examen/imagen sin dejar trazado de si fue revisado.
- Por que tiene sentido: aprovecha adjuntos y alertas actuales sin meter workflow enorme.
- Impacto esperado: medio-alto.
- Dificultad estimada: media.
- Prioridad: **despues**.

### 8. Vista “pendientes del dia” por paciente

- Problema que resuelve: seguimiento operativo disperso entre tasks, review y alertas.
- Por que tiene sentido: app pequena, equipo pequeno, valor alto con muy poca complejidad extra.
- Impacto esperado: medio.
- Dificultad estimada: baja-media.
- Prioridad: **despues**.

## 8. Plan de accion priorizado

### Que arreglar primero

1. Blindar updates de secciones contra replays viejos y conflictos multi-sesion.
2. Hacer que el wizard no avance hasta confirmar guardado exitoso.
3. Alinear la semantica de alertas en el workspace.

### Que dejar para despues

1. Mejora de resiliencia del bootstrap de sesion frente a caidas temporales.
2. Consolidacion de helpers duplicados de acceso.
3. UX adicional de conflictos, cambios recientes y paneles de pendientes.

### Que no tocaria todavia

1. No migraria arquitectura ni base de datos solo por escala; para 5 usuarios SQLite sigue siendo razonable con la operacion documentada.
2. No meteria observabilidad compleja, colas ni infraestructura adicional salvo que aparezca una necesidad operativa concreta.
3. No reharia auth ni permisos: hoy son de las zonas mas fuertes del sistema.

### Roadmap corto y pragmatico

1. **Semana 1**
   - Bloquear navegacion hasta save confirmado.
   - Renombrar o separar visualmente alertas derivadas.
   - Corregir doc de proxy/auth.
2. **Semana 2**
   - Deduplicacion de cola offline por seccion.
   - Versionado simple de save de seccion con rechazo por conflicto.
   - Test unitario y E2E focalizado del conflicto.
3. **Semana 3**
   - Mejorar bootstrap offline/no-red.
   - Consolidar helpers de acceso.
   - Pase final de regresion manual y smoke clinico.

## Cierre

Si se arreglan los dos blockers del workflow clinico y se aclara la semantica de alertas, la app queda cerca de “lista con reservas” para su contexto real de uso. Hoy no la frenan problemas de escala; la frenan un par de riesgos concretos de integridad y UX en el flujo principal de atencion.