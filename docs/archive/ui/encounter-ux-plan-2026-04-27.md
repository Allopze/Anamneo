## Plan: Mejora UX Encuentros (3-5 dias)

Optimizar la edicion de encuentros para reducir friccion de registro, mejorar escaneabilidad y cerrar brechas moviles sin redisenar el flujo clinico completo. Se prioriza reutilizar primitives/tokens existentes para bajar riesgo y acelerar entrega.

**Steps**
1. Alinear criterios de exito UX y baseline visual/funcional en la pantalla de encuentro (tiempo de completitud de seccion, scroll por seccion, claridad de estado de guardado). *bloquea el resto*
2. Fase 1 - Jerarquia visual y densidad (quick wins en canvas principal): reforzar encabezados de bloque, reducir ruido de contenedores, mejorar contraste semantico y ritmo vertical para lectura clinica rapida. *depende de 1*
3. Fase 1 - Ergonomia de captura: hacer mas evidente el dictado, mejorar affordances de campos largos, mantener guia persistente en campos sensibles (inicio/evolucion) y ajustar estados activo/guardado por seccion. *depende de 1, en paralelo con 2*
4. Fase 2 - Optimizacion movil del flujo de secciones: mejorar navegacion de secciones, estado de progreso visible durante edicion y accesibilidad de herramientas inline en breakpoints pequenos. *depende de 2 y 3*
5. Fase 2 - Accesibilidad y semantica: asociaciones label-control, agrupacion semantica de sintomas, foco al cambiar de seccion, mejoras de contraste en estados de alerta/estado. *depende de 2 y 3, en paralelo con 4*
6. Fase 3 - Ajustes de robustez UX: feedback de autosave mas claro, limites de crecimiento de textarea, manejo de estados vacios y conflictos de recuperacion de borrador con mensajes mas accionables. *depende de 4 y 5*
7. Validacion automatizada y manual, ajuste final y checklist de regresion por ruta de encuentros. *depende de 6*

**Relevant files**
- /home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/page.tsx - coordina layout general, rail/canvas de edicion, herramientas inline y estados globales de guardado/progreso.
- /home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/EncounterActiveSectionCard.tsx - jerarquia del bloque activo (eyebrow, titulo, estado de seccion, spacing).
- /home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/EncounterClinicalSummaryCard.tsx - claridad del resumen clinico fijo y densidad de informacion visible.
- /home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/EncounterSectionRail.tsx - escaneabilidad de navegacion, estados y comportamiento sticky.
- /home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/EncounterMobileSectionNav.tsx - navegacion movil y progreso durante edicion.
- /home/allopze/dev/Anamneo/frontend/src/components/sections/AnamnesisProximaSection.tsx - bloque de mayor friccion observado en la captura (relato, cronologia, sintomas, dictado).
- /home/allopze/dev/Anamneo/frontend/src/components/sections/SectionPrimitives.tsx - punto de reutilizacion para unificar patrones de titulo/callout/acciones.
- /home/allopze/dev/Anamneo/frontend/src/components/common/VoiceDictationButton.tsx - visibilidad, tamano de objetivo tactil y microcopy de dictado.
- /home/allopze/dev/Anamneo/frontend/src/app/(dashboard)/atenciones/[id]/EncounterWorkspaceTools.tsx - herramientas inline de revision, apoyo, cierre e historial.
- /home/allopze/dev/Anamneo/frontend/src/components/EncounterWorkspacePanels.tsx - contenido reutilizado de herramientas inline.
- /home/allopze/dev/Anamneo/frontend/src/app/globals.css - clases utilitarias de seccion/formulario/callout para ajustar ritmo y contraste.
- /home/allopze/dev/Anamneo/frontend/tailwind.config.js - tokens de color/espaciado/radius/shadow para consistencia visual.
- /home/allopze/dev/Anamneo/frontend/src/__tests__/app/atencion-cierre.test.tsx - prueba de flujo principal para detectar regresiones visibles en cierre.
- /home/allopze/dev/Anamneo/frontend/src/__tests__/app/use-encounter-wizard-navigation.test.tsx - asegurar navegacion/guardado al ajustar UX de secciones.

**Verification**
1. Revisar visualmente desktop y movil en la ruta de encuentro con foco en: tiempo para ubicar el campo siguiente, claridad de estado de guardado y cantidad de scroll para completar Anamnesis proxima.
2. Ejecutar: npm --prefix frontend run typecheck.
3. Ejecutar: npm --prefix frontend run test.
4. Ejecutar pruebas de ruta/flujo de encuentro afectadas (incluyendo app/encuentro y navegacion de secciones).
5. Si hay impacto en experiencia de ruta o sesiones: npm --prefix frontend run test:e2e.
6. Verificar accesibilidad basica: navegacion por teclado (tab/foco visible), labels asociadas, contraste de estados, lectura de encabezados y grupos en lector de pantalla.

**Decisions**
- Incluye: mejoras UX/UI incrementales en encuentro sin reescritura de dominio ni cambios de permisos.
- Incluye: priorizacion de velocidad de registro + legibilidad + movil (acordado por usuario).
- Excluye: rediseno completo del wizard, cambios de backend, cambios de contrato de datos clinicos.
- Excluye: alteraciones de auth/session fuera de lo necesario para UX de ruta.
- Restricciones: mantener patrones existentes de App Router, /api same-origin y componentes <=300 lineas cuando sea posible.

**Further Considerations**
1. Medicion de impacto: definir 2-3 metricas simples (ej. tiempo promedio para completar seccion 3, taps para cambiar seccion en movil, percepcion de claridad de guardado) antes/despues.
2. Rollout controlado: aplicar primero a AnamnesisProximaSection como piloto y luego extender al resto de secciones si el resultado es positivo.
3. Debt tecnico: evaluar extraer subcomponentes del page.tsx de encuentros (archivo grande) para acelerar futuras iteraciones UX sin aumentar riesgo de regresion.

**Auditoria de pasadas**

### 2026-04-27 - Pasada 1: eliminar panel lateral generico

Completado:
- [x] Se quito el boton "Panel lateral" del toolbar de atencion.
- [x] El chip de revision abre una herramienta inline de revision, sin overlay ni focus trap modal.
- [x] Apoyo clinico e Historial se movieron al menu "Mas" y se muestran inline en el canvas principal.
- [x] Cierre se integro como bloque fijo despues de la seccion activa para que la nota de cierre y checklist queden visibles antes de finalizar.
- [x] Se retiro el estado persistido heredado (`localStorage`) y el atajo `Ctrl+.`/`Cmd+.` asociado.
- [x] Se elimino el componente lateral heredado y los helpers de estado/atajo.
- [x] Se actualizo `docs/frontend-architecture.md` con la nueva arquitectura de herramientas inline.

Faltante:
- [x] Renombrar `EncounterDrawerPanels.tsx` y `encounter-drawer.constants.ts` a nombres de workspace/herramientas para cerrar deuda semantica interna.
- [ ] Revisar visualmente desktop y movil: el bloque de Cierre ahora queda siempre visible cuando se puede completar, y puede requerir ajuste de densidad.
- [x] Ejecutar `npm --prefix frontend run typecheck` y `npm --prefix frontend run test`; despues ajustar pruebas si aparece algun texto legacy.
- [ ] Revisar E2E completo cuando se pueda levantar un backend aislado o confiable.

Siguientes pasos naturales:
1. Hacer una pasada visual responsive de `atenciones/[id]` con la nueva ubicacion de Revision/Apoyo/Cierre/Historial.
2. Afinar el bloque de Cierre para que sea compacto en desktop y no genere scroll innecesario en movil.
3. Revisar si Apoyo clinico debe quedar como bloque siempre visible o seguir bajo `Mas`.

### 2026-04-27 - Pasada 2: limpiar deuda semantica y pruebas enfocadas

Completado:
- [x] Se renombraron los archivos internos a `EncounterWorkspacePanels.tsx` y `encounter-workspace.constants.ts`.
- [x] Se reemplazaron los tipos internos heredados por `WorkspacePanelKey` y `EncounterWorkspaceProps`.
- [x] Se actualizaron IDs de campos de `drawer-*` a `workspace-*`.
- [x] Se actualizo el E2E clinico para abrir Apoyo/Cierre desde herramientas inline.
- [x] Paso `npm --prefix frontend run typecheck`.
- [x] Pasaron pruebas enfocadas: `npm --prefix frontend run test -- atencion-cierre.test.tsx encounter-header.test.tsx --runInBand`.

Faltante:
- [x] Ejecutar suite frontend completa para detectar impactos fuera de cierre/header.
- [ ] Verificar visualmente desktop y movil con app corriendo.
- [ ] Decidir si `Apoyo clinico` debe quedar visible como bloque permanente o seguir como herramienta bajo `Mas`.
- [ ] Ajustar densidad del bloque `Cierre` si la verificacion visual muestra demasiado scroll.

Siguientes pasos naturales:
1. Correr `npm --prefix frontend run test`.
2. Levantar frontend y hacer pasada visual de `atenciones/[id]` en desktop/movil.
3. Si la pagina se siente pesada, compactar `CloseTabPanel` o moverlo a un bloque plegable semantico junto al CTA de finalizar.

### 2026-04-27 - Pasada 3: validacion frontend completa

Completado:
- [x] Paso la suite frontend completa: `npm --prefix frontend run test`.
- [x] Resultado: 63 suites y 302 tests verdes.

Faltante:
- [ ] Verificacion visual en navegador de la ruta real de atencion.
- [ ] Verificacion E2E clinica con backend si se requiere validar adjuntos/cierre/firma de punta a punta.

Siguientes pasos naturales:
1. Levantar app y abrir una atencion en progreso para revisar toolbar, herramienta de revision, apoyo clinico, historial y cierre.
2. Si el backend local no esta listo, ejecutar `npm --prefix frontend run test:e2e` cuando el stack pueda inicializar sus servidores.

### 2026-04-27 - Pasada 4: intento E2E clinico

Completado:
- [x] Se intento `npm --prefix frontend run test:e2e:workflow-clinical`.
- [x] El primer intento quedo bloqueado porque `localhost:5678` ya estaba en uso y Playwright no reutiliza servidores salvo `PLAYWRIGHT_REUSE_EXISTING=true`.
- [x] Se intento nuevamente con `PLAYWRIGHT_REUSE_EXISTING=true`.
- [x] Se limpiaron artefactos QA generados por el intento fallido.

Resultado:
- [ ] El E2E no valido la ruta: fallo en `beforeAll` por timeout al esperar la navegacion principal tras login admin en el servidor existente.

Faltante:
- [ ] Reintentar E2E con puertos libres o con un stack local conocido.
- [ ] Hacer verificacion visual manual de la ruta real de atencion.

Siguientes pasos naturales:
1. Liberar o cambiar `PLAYWRIGHT_BACKEND_PORT`/`PLAYWRIGHT_FRONTEND_PORT` para que Playwright cree su entorno aislado.
2. Repetir `npm --prefix frontend run test:e2e:workflow-clinical`.
3. Capturar una pasada visual desktop/movil si el E2E vuelve a iniciar correctamente.

### 2026-04-27 - Pasada 5: ficha clinica, lectura documental

Completado:
- [x] Se alinearon los avisos de bloqueo de ficha al ancho del documento (`max-w-5xl`) y se redujo el radio visual.
- [x] El encabezado de ficha integra estado y fecha en una linea de metadatos, evitando el chip aislado para estados no firmados.
- [x] Se quito la barra de color repetida de todos los titulos de seccion.
- [x] El motivo de consulta dejo de parecer un input deshabilitado y ahora se muestra como bloque de lectura.
- [x] Las secciones vacias muestran `Sin registro.` en vez de guiones o bloques vacios.
- [x] Se mantuvo el uso de render condicional recomendado por React/Context7 para estados vacios y contenido opcional.

Faltante:
- [ ] Validar visualmente la ficha en desktop y movil.
- [ ] Revisar si la ficha debe mantener `max-w-5xl` o volver a `max-w-4xl` en pantallas medianas.
- [ ] Revisar impresion/PDF visual si los estilos de lectura afectan el resultado esperado.

Siguientes pasos naturales:
1. Abrir una ficha real y comprobar que los vacios compactan la lectura sin ocultar informacion clinica.
2. Ajustar espaciado vertical si el documento queda demasiado largo o demasiado denso.
3. Ejecutar suite frontend completa si la pasada visual requiere mas cambios.

Validacion:
- [x] Paso `npm --prefix frontend run test -- atencion-ficha.test.tsx --runInBand`.
- [x] Paso `npm --prefix frontend run typecheck`.
- [x] Paso `npm --prefix frontend run test` completo: 63 suites y 302 tests verdes.

### 2026-04-27 - Pasada 6: ficha clinica, composicion hoja/alerta

Completado:
- [x] Se agrego separacion inferior a los avisos superiores para que no queden pegados a la ficha.
- [x] Los avisos dejaron de usar el radio gigante del sistema y ahora usan `rounded-lg`.
- [x] La ficha recibio borde sutil para leerse como hoja asentada sobre el fondo, no como bloque flotante.
- [x] Las secciones vacias se compactaron en una sola linea (`titulo + Sin registro.`) para reducir scroll muerto.
- [x] Se mantuvieron secciones con contenido en formato expandido.

Faltante:
- [ ] Validar visualmente desktop/movil con la captura actualizada.
- [ ] Revisar si el borde de la hoja debe mantenerse en print o solo pantalla; por ahora se oculta al imprimir.
- [ ] Evaluar si secciones vacias deben omitirse completamente en ficha en progreso.

Siguientes pasos naturales:
1. Reabrir la ficha y comparar contra la captura donde la alerta estaba pegada.
2. Si aun se ve demasiado documental/larga, agrupar vacios consecutivos en una sola fila tipo `Sin registro: Anamnesis proxima, remota...`.
3. Revalidar con typecheck y pruebas de ficha.

Validacion:
- [x] Paso `npm --prefix frontend run typecheck`.
- [x] Paso `npm --prefix frontend run test -- atencion-ficha.test.tsx --runInBand`.
