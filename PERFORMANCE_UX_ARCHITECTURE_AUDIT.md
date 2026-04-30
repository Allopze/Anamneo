# Auditoria de rendimiento, arquitectura frontend y UX - Anamneo

Fecha: 2026-04-29  
Alcance: frontend Next.js, backend NestJS/API, Prisma/SQLite, flujos clinicos principales, build y dependencias.  
Enfoque: mejorar rendimiento, fluidez y mantenibilidad sin debilitar permisos, trazabilidad, validaciones clinicas ni privacidad de datos de pacientes.

## Resumen ejecutivo

Anamneo tiene una base tecnica solida para una EMR/ERM medica de escala pequena o media: Next.js App Router, React 18, TanStack Query, Zustand, NestJS, Prisma y SQLite con auditoria de integridad. La arquitectura esta razonablemente modular, con permisos compartidos y enforcement backend real.

Los riesgos de rendimiento mas importantes no vienen de un unico bug, sino de varios patrones acumulados: carga inicial bloqueada por bootstrap cliente, endpoints clinicos demasiado amplios, busquedas clinicas filtradas en memoria, queries duplicadas, serializacion frecuente de JSON en el editor de atenciones y ausencia de indices compuestos para las consultas reales del producto.

Validacion realizada durante la auditoria:

- `npm --prefix frontend run build`: OK.
- Next.js 16.2.4 con Turbopack compilo correctamente.
- Revision estatica de rutas, hooks, servicios Nest, Prisma schema, dependencias y componentes criticos.
- Observacion de tamanos de build/dev como senal direccional, no como medicion final de bundle productivo.

## Registro de fixes aplicados

### Pasada 1 - 2026-04-29

Objetivo: cerrar quick wins de alto impacto sin tocar los archivos del wizard que ya tenian cambios sin confirmar.

Cambios aplicados:

- Se creo `frontend/src/lib/dashboard-stats.ts` con `DASHBOARD_STATS_QUERY_KEY` y `fetchDashboardStats`.
- `SmartHeaderBar`, dashboard home y lista de atenciones ahora comparten la misma query key para `/encounters/stats/dashboard`, permitiendo deduplicacion real de TanStack Query.
- `frontend/src/lib/query-invalidation.ts` invalida la key canonica nueva en vez de tres keys duplicadas.
- Se agrego `GET /conditions/count` en backend y el header de catalogo usa ese endpoint para no descargar todo el catalogo solo por un numero.
- `useDashboardSearch` y `CommandPalette` ahora abortan requests obsoletas y descartan respuestas fuera de orden.
- `AuditIntegrityCard` verifica por defecto `limit=1000` y deja la verificacion completa como accion explicita desde la UI.
- Se actualizo `frontend/src/__tests__/app/admin-auditoria.test.tsx` para el nuevo comportamiento por defecto.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run typecheck`: OK.
- `npm --prefix frontend run test -- --runInBand header-kpi-bar.test.tsx dashboard-page.test.tsx admin-auditoria.test.tsx`: OK, 3 suites / 7 tests.
- `npm --prefix backend run test -- --runInBand conditions`: OK, 4 suites / 25 tests.

Siguientes pasos naturales:

1. Aplicar indices compuestos de Prisma/SQLite y validarlos con `EXPLAIN QUERY PLAN`.
2. Paginar/lazy-load alertas reconocidas y consentimientos historicos en ficha paciente.
3. Reducir trabajo del wizard de atenciones: dirty flags por seccion y menos `JSON.stringify` por keystroke.
4. Separar payload critico de `/encounters/:id` de adjuntos, baseline, consentimientos y recursos secundarios.
5. Agregar bundle analyzer y remover dependencias frontend no usadas.

### Pasada 2 - 2026-04-29

Objetivo: atacar la degradacion progresiva de listados/dashboard con indices compuestos alineados a filtros reales.

Cambios aplicados:

- Se agregaron indices compuestos en `Patient` para creador/archivado/fecha, completitud/archivado y `updatedAt`.
- Se agregaron indices compuestos en `Encounter` para medico/estado/fecha, medico/revision/fecha, paciente/medico/fecha y `updatedAt`.
- Se agrego indice compuesto en `EncounterTask` para medico/estado/vencimiento.
- Se agregaron indices en `ClinicalAlert` para paciente/reconocimiento/fecha y encuentro/reconocimiento.
- Se creo la migracion `backend/prisma/migrations/20260429170000_add_performance_indexes/migration.sql`.

Validacion de la pasada:

- `npx --prefix backend prisma validate --schema backend/prisma/schema.prisma`: OK.
- `npm --prefix backend run typecheck`: OK.

Siguientes pasos naturales:

1. Ejecutar `npm run db:migrate` en entorno local/controlado y validar que la migracion aplica limpia sobre datos existentes.
2. Correr `EXPLAIN QUERY PLAN` para `/encounters`, `/encounters/stats/dashboard`, `/patients` y alertas por paciente.
3. Medir p95 de endpoints antes/despues con dataset semilla grande.
4. Si algun indice queda redundante en SQLite, limpiar en una migracion posterior basada en evidencia.

### Pasada 3 - 2026-04-29

Objetivo: reducir dependencias frontend no usadas y mantener el lockfile coherente.

Cambios aplicados:

- Se removieron `@react-pdf/renderer` y `jwt-decode` de `frontend/package.json` y `frontend/package-lock.json`.
- `npm --prefix frontend uninstall @react-pdf/renderer jwt-decode` elimino 57 paquetes transitivos.
- `npm --prefix frontend ls @react-pdf/renderer jwt-decode --depth=0` confirma que ya no estan instalados.

Validacion de la pasada:

- `npm --prefix frontend run build`: OK.
- `npm --prefix frontend run typecheck`: OK despues de repetirlo con el build ya finalizado.
- `npm --prefix frontend run test -- --runInBand header-kpi-bar.test.tsx dashboard-page.test.tsx admin-auditoria.test.tsx`: OK, 3 suites / 7 tests.
- Nota: una primera corrida de typecheck en paralelo con build fallo por `.next/types/validator.ts` leyendo `./routes.js` durante generacion intermedia; no se reprodujo al correr typecheck despues del build.

Siguientes pasos naturales:

1. Agregar bundle analyzer opt-in para medir First Load JS por ruta clinica.
2. Definir presupuesto de bundle para login, pacientes, ficha paciente y atencion.
3. Revisar `react-icons` y `date-fns` con analyzer antes de tocar imports.

### Pasada 4 - 2026-04-29

Objetivo: aplicar la migracion de indices y confirmar que SQLite los usa en patrones representativos.

Cambios/acciones aplicadas:

- Se ejecuto `npm run db:migrate`; Prisma aplico `20260429170000_add_performance_indexes`.
- `prisma migrate dev` entro luego a prompt para crear una migracion adicional; se termino el proceso sin crear migraciones interactivas nuevas.
- `npx --prefix backend prisma migrate status --schema backend/prisma/schema.prisma` confirmo: `Database schema is up to date!`.
- Se validaron planes de consulta con `sqlite3 ... EXPLAIN QUERY PLAN`.

Evidencia de planes:

- `encounters` por medico/estado/fecha usa `encounters_medico_id_status_created_at_idx`.
- `encounters` por medico/revision/fecha usa `encounters_medico_id_review_status_created_at_idx`.
- `encounter_tasks` por medico/estado/vencimiento usa `encounter_tasks_medico_id_status_due_date_idx`.
- `clinical_alerts` por paciente/reconocimiento/fecha usa `clinical_alerts_patient_id_acknowledged_at_created_at_idx`.
- `patients` por creador/archivado/fecha usa `patients_created_by_id_archived_at_created_at_idx`.

Validacion de la pasada:

- `npx --prefix backend prisma migrate status --schema backend/prisma/schema.prisma`: OK.
- `npx --prefix backend prisma validate --schema backend/prisma/schema.prisma`: OK.
- `npm --prefix backend run typecheck`: OK.

Siguientes pasos naturales:

1. Mantener estos `EXPLAIN QUERY PLAN` como referencia y repetirlos con datos de mayor volumen.
2. Medir p95 real de `/encounters`, `/patients`, dashboard stats y alertas por paciente.
3. Si algun indice no aporta en dataset real, retirarlo despues con migracion explicita.

### Pasada 5 - 2026-04-29

Objetivo: reducir payload y render de historiales en ficha paciente sin ocultar alertas activas ni consentimientos vigentes.

Cambios aplicados:

- `AlertsService.findByPatient` ahora devuelve todas las alertas activas y solo las ultimas alertas reconocidas cuando la UI pide `acknowledgedLimit`.
- `PatientAlerts` solicita `includeAcknowledged=true&acknowledgedLimit=20` y etiqueta el bloque como "Ultimas alertas reconocidas".
- `ConsentsService.findByPatient` ahora devuelve todos los consentimientos activos y limita revocados cuando la UI pide `revokedLimit`.
- `PatientConsents` solicita `revokedLimit=20` y etiqueta el bloque como "Ultimos consentimientos revocados".
- El uso interno de exportacion mantiene compatibilidad porque `ConsentsService.findByPatient(patientId, user)` sin limite sigue devolviendo todo.
- Se agrego indice compuesto `@@index([patientId, revokedAt, grantedAt])` y migracion `20260429183000_add_consent_history_index`.

Validacion de la pasada:

- `npx --prefix backend prisma validate --schema backend/prisma/schema.prisma`: OK.
- `npm --prefix backend run typecheck`: OK.
- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand alerts.service.spec.ts consents.service.spec.ts`: OK, 2 suites / 10 tests.
- `npm --prefix frontend run test -- --runInBand patient-consents.test.tsx`: OK, 1 suite / 1 test.
- `npx --prefix backend prisma migrate deploy --schema backend/prisma/schema.prisma`: OK.
- `npx --prefix backend prisma migrate status --schema backend/prisma/schema.prisma`: OK.
- `EXPLAIN QUERY PLAN` confirma uso de `informed_consents_patient_id_revoked_at_granted_at_idx` para consentimientos activos/revocados por paciente.

Siguientes pasos naturales:

1. Agregar paginacion visual "ver mas historial" para alertas reconocidas y consentimientos revocados si el usuario necesita navegar mas alla de los ultimos 20.
2. Medir payload inicial de ficha paciente antes/despues en pacientes con historial largo.
3. Agregar tests de componente para `PatientAlerts` con reconocidas limitadas.

### Pasada 6 - 2026-04-29

Objetivo: reducir trabajo de render del wizard de atenciones durante escritura sin cambiar guardado, autosave ni datos clinicos.

Cambios aplicados:

- `useEncounterWizardDerived` ahora usa `useDeferredValue(formData)` para que la generacion del resumen clinico longitudinal no compita de inmediato con cada keystroke.
- Se precalculan mapas `sectionDataJsonByKey` y `savedDataJsonByKey` una vez por cambio de `formData`/snapshot, en vez de ejecutar `JSON.stringify` dentro de cada llamada de `getSectionUiState`.
- `getSectionUiState` conserva los mismos estados (`saving`, `error`, `dirty`, `notApplicable`, `completed`, `saved`, `idle`) pero lee comparaciones ya preparadas.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run test -- --runInBand use-encounter-wizard-derived.test.tsx`: OK, 1 suite / 1 test.

Siguientes pasos naturales:

1. Medir con React Profiler commits por tecla en secciones largas antes/despues.
2. Llevar el siguiente paso a dirty flags por seccion en `useEncounterSectionPersistence` para evitar serializar todas las secciones cuando solo cambia una.
3. Separar la generacion del resumen a demanda si el panel de herramientas no esta visible.

### Pasada 7 - 2026-04-29

Objetivo: reducir el payload inicial del editor de atencion evitando cargar el baseline de firma cuando no se usa.

Cambios aplicados:

- `findEncounterByIdReadModel` acepta `includeSignatureBaseline`, con default compatible `true`.
- `EncountersController.findOne` expone `includeSignatureBaseline=false` para omitir la busqueda secundaria.
- El editor (`useEncounterWizardEncounter`) solicita `/encounters/:id?includeSignatureBaseline=false`.
- La ficha firmable/imprimible (`useFichaClinica`) solicita `/encounters/:id?includeSignatureBaseline=true` para conservar diff de firma y adjuntos del baseline.
- Se agrego test backend que confirma que el lookup de baseline no corre cuando el editor opta por omitirlo.

Validacion de la pasada:

- `npm --prefix backend run typecheck`: OK.
- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand encounters-read-side.spec.ts`: OK, 1 suite / 2 tests.

Siguientes pasos naturales:

1. Separar adjuntos/consentimientos/tareas del payload inicial de `/encounters/:id` con flags o endpoints secundarios.
2. Hacer que el checklist de cierre use `attachmentsState.attachments` cuando el modal de adjuntos ya se cargo, para no depender del payload inicial.
3. Medir `Content-Length` y tiempo DB de `/encounters/:id?includeSignatureBaseline=false` vs `true`.

### Pasada 8 - 2026-04-29

Objetivo: dejar medicion de bundle accionable para futuras optimizaciones de rutas clinicas.

Cambios aplicados:

- Se agrego `@next/bundle-analyzer` como devDependency.
- Se agrego script `npm --prefix frontend run build:analyze`.
- `next.config.js` envuelve la config con analyzer solo cuando `ANALYZE=true`.
- `frontend/scripts/next-build.js` usa `next build --webpack` cuando `ANALYZE=true`, porque el analyzer no genera reportes sobre builds Turbopack.

Validacion de la pasada:

- `npm --prefix frontend run build:analyze`: OK; genero `frontend/.next/analyze/client.html`, `edge.html` y `nodejs.html`.
- Durante `build:analyze`, Next emitio un warning de copia de traced files en standalone con webpack analyzer, pero el proceso termino en codigo 0 y genero reportes.
- `npm --prefix frontend run build`: OK con Turbopack normal despues del analisis.

Siguientes pasos naturales:

1. Abrir `frontend/.next/analyze/client.html` y registrar top modulos por rutas clinicas.
2. Definir presupuestos iniciales para `/login`, `/pacientes`, `/pacientes/[id]`, `/atenciones/[id]`.
3. Solo despues del analyzer, decidir si conviene atacar `react-icons`, `date-fns` o componentes pesados por ruta.

### Pasada 9 - 2026-04-29

Objetivo: reducir re-renders por suscripciones amplias a `auth-store` en componentes frecuentes.

Cambios aplicados:

- `SmartHeaderBar` ahora se suscribe solo a `user` y deriva permisos con helpers puros.
- Dashboard home y lista de atenciones se suscriben solo a `user`.
- `PatientAlerts` y `PatientConsents` se suscriben solo a `user` y derivan `isMedico` con `isMedicoUser`.
- Se evita extraer acciones/funciones completas de Zustand en estas superficies de alta frecuencia.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run test -- --runInBand header-kpi-bar.test.tsx dashboard-page.test.tsx patient-consents.test.tsx`: OK, 3 suites / 6 tests.

Siguientes pasos naturales:

1. Repetir el mismo patron en `DashboardLayout`, `useEncounterWizard`, `ConditionsCatalogSection` y otras vistas que aun consumen `useAuthStore()` completo.
2. Medir con React Profiler si refrescos de sesion siguen disparando renders del shell completo.
3. Considerar hooks dedicados `useAuthUser`, `useAuthCapabilities` para estandarizar el patron.

### Pasada 10 - 2026-04-29

Objetivo: reducir transiciones globales demasiado amplias que pueden animar propiedades de layout.

Cambios aplicados:

- Se reemplazaron los `transition-all` restantes en `frontend/src/app/globals.css` por `transition-colors` en stepper, nav del header, chips del smart header y nav mobile.
- `rg "transition-all" frontend/src/app/globals.css` ya no encuentra usos en el CSS global.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run build`: OK.

Siguientes pasos naturales:

1. Revisar capturas/Playwright en desktop y mobile para confirmar que no hubo regresion visual.
2. Medir FPS al colapsar rail y navegar chips/header.
3. Auditar clases `transition-all` fuera de `globals.css` y reemplazarlas donde no aporten valor.

### Pasada 11 - 2026-04-29

Objetivo: cerrar el pendiente de suscripciones amplias a `auth-store` en superficies frecuentes.

Cambios aplicados:

- Se agregaron hooks selectivos en `frontend/src/stores/auth-store.ts`: `useAuthUser`, `useAuthIsAuthenticated`, `useAuthHasHydrated`, acciones atomicas y capacidades derivadas.
- `DashboardLayout` ya no se suscribe al store completo; lee `user`, `isAuthenticated`, `hasHydrated`, `login` y `logout` con selectors separados.
- Se migraron consumidores de dashboard, catalogos, ajustes, pacientes, atenciones, auditoria y analitica clinica a selectors atomicos.
- `rg "useAuthStore\\(\\)" frontend/src` ya no encuentra consumidores amplios en codigo de app; solo quedan tests que usan `useAuthStore.getState()`.
- Se ajustaron consumidores que esperaban funciones de permiso (`canEditAntecedentes`, `isAdmin`) para trabajar con booleanos derivados.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.

Siguientes pasos naturales:

1. Medir con React Profiler si refrescos de sesion reducen renders del shell, header, catalogos y vistas clinicas.
2. Considerar remover o desincentivar el uso directo de metodos derivados en `AuthState` para que nuevos componentes usen hooks atomicos.
3. Mantener tests del store actualizados si se decide deprecar las funciones historicas `isMedico`, `isAdmin`, `canCreatePatient`, etc.

### Pasada 12 - 2026-04-29

Objetivo: cerrar el quick win de transiciones amplias fuera de estilos globales.

Cambios aplicados:

- Se reemplazo `transition-all` en items del sidebar por `transition-[background-color,color,box-shadow]`.
- Se reemplazo `transition-all` en navegacion mobile por `transition-colors`.
- Se quitaron transiciones innecesarias de contenedores `card` en listados de pacientes y atenciones.
- Se acotaron transiciones de acciones de catalogo a `background-color`, `color` y `opacity`.
- Se acoto la tarjeta admin a `background-color` y `box-shadow`.
- Se acoto la barra de progreso de `EncounterHeader` a `width`.
- `rg "transition-all" frontend/src` ya no encuentra usos.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.

Siguientes pasos naturales:

1. Revisar visualmente con Playwright desktop/mobile sidebar, nav mobile, catalogos, pacientes, atenciones y header de atencion.
2. Medir FPS/layout al colapsar rail y navegar el workspace clinico.
3. Revisar si las transiciones de `grid-template-columns`, `width` y `grid-template-rows` del wizard deben pasar a estado instantaneo o a animaciones transform/opacity.

### Pasada 13 - 2026-04-29

Objetivo: reducir duplicacion en busqueda global manteniendo abort/sequence ya implementados.

Cambios aplicados:

- Se creo `frontend/src/lib/clinical-search.ts` con el tipo compartido `SearchResult` y `fetchClinicalSearchResults`.
- `useDashboardSearch` usa el fetcher compartido y conserva cancelacion con `AbortController`, debounce y descarte por secuencia.
- `CommandPalette` usa el mismo fetcher compartido y mantiene su estado local de modal/teclado.
- La normalizacion de resultados de pacientes y atenciones queda en un unico lugar.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.

Siguientes pasos naturales:

1. Agregar tests unitarios para `fetchClinicalSearchResults` cubriendo pacientes, atenciones, fallos parciales y query vacia.
2. Si la duplicacion de estado UI vuelve a crecer, extraer un hook compartido sobre el fetcher.
3. A mediano plazo, crear endpoint backend `/search?q=&types=patients,encounters` con permisos centralizados y payload minimo.

### Pasada 14 - 2026-04-29

Objetivo: optimizar el conteo de afecciones para usuarios no admin sin reconstruir todo el catalogo fusionado.

Cambios aplicados:

- Se agrego `countMergedConditions` en `backend/src/conditions/conditions-local-queries.ts`.
- `ConditionsService.count` usa counts directos para globales activos, overrides locales que excluyen una base activa y afecciones locales puras activas.
- El endpoint `/conditions/count` mantiene el mismo contrato `{ count }`, pero evita parsear/ordenar todo el catalogo para el header.

Validacion de la pasada:

- `npm --prefix backend run typecheck`: OK.

Siguientes pasos naturales:

1. Agregar test unitario de `countMergedConditions` con globales activos, override oculto, override inactivo, override activo y condicion local pura.
2. Medir `/conditions/count` con catalogo grande y usuarios medico/asistente.
3. Considerar indices adicionales en `condition_catalog_local` si el catalogo local crece mucho por instancia.

### Pasada 15 - 2026-04-29

Objetivo: convertir el analisis de bundle en un presupuesto verificable.

Cambios aplicados:

- Se agrego `frontend/scripts/check-bundle-budget.js`.
- Se agrego script `npm --prefix frontend run bundle:budget`.
- El script mide JS referenciado por HTML de rutas App Router ya construidas, sumando tamano raw y gzip de chunks unicos por ruta.
- Presupuestos iniciales:
  - `/login`: 320 KiB gzip.
  - `/pacientes`: 330 KiB gzip.
  - `/atenciones`: 330 KiB gzip.
  - `/atenciones/nueva`: 320 KiB gzip.

Validacion de la pasada:

- `npm --prefix frontend run bundle:budget`: OK.
  - `/login`: 286 KiB gzip / 320 KiB.
  - `/pacientes`: 288 KiB gzip / 330 KiB.
  - `/atenciones`: 285 KiB gzip / 330 KiB.
  - `/atenciones/nueva`: 279 KiB gzip / 320 KiB.

Siguientes pasos naturales:

1. Integrar `npm --prefix frontend run bundle:budget` en CI despues de `npm --prefix frontend run build`.
2. Ajustar presupuestos con datos reales de analyzer y separar shared chunks vs route-specific chunks si hace falta.
3. Agregar presupuestos para ficha paciente y editor de atencion cuando Next genere HTML medible o se instrumente el manifest adecuado.

### Pasada 16 - 2026-04-29

Objetivo: permitir navegar historiales largos de alertas reconocidas y consentimientos revocados sin cargarlos completos por defecto.

Cambios aplicados:

- `PatientAlerts` mantiene carga inicial de 20 alertas reconocidas y agrega accion "Ver mas alertas reconocidas" para aumentar el limite de 20 en 20.
- `PatientConsents` mantiene carga inicial de 20 consentimientos revocados y agrega accion "Ver mas consentimientos revocados" para aumentar el limite de 20 en 20.
- Ambas queries incluyen el limite en la query key para cachear cada ventana de historial.
- `PatientAlerts` y `PatientConsents` usan `useAuthUser` en vez de selector inline directo.
- Se actualizo el mock de auth-store en `patient-consents.test.tsx` para los hooks atomicos nuevos.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run test -- --runInBand patient-consents.test.tsx`: OK, 1 suite / 1 test.

Siguientes pasos naturales:

1. Agregar test de componente para `PatientAlerts` que verifique el boton "Ver mas" y el incremento de `acknowledgedLimit`.
2. Agregar respuesta backend con `hasMore`/`total` para no depender de `items.length >= limit` como heuristica.
3. Si historiales llegan a cientos/miles, migrar de limites crecientes a cursor real (`cursor`, `take`) para evitar reconsultar ventanas acumuladas.

### Pasada 17 - 2026-04-29

Objetivo: reducir el payload inicial del editor de atencion separando agregados secundarios restantes.

Cambios aplicados:

- `findEncounterByIdReadModel` acepta flags nuevos: `includeAttachments`, `includeConsents`, `includeTasks`, `includeSignatures` e `includeSuggestions`.
- `EncountersService.findById` y `EncountersController.findOne` propagan los flags por query string.
- El editor (`useEncounterWizardEncounter`) solicita payload liviano:
  - `includeSignatureBaseline=false`
  - `includeAttachments=false`
  - `includeConsents=false`
  - `includeTasks=false`
  - `includeSignatures=false`
  - `includeSuggestions=false`
- La ficha firmable/imprimible (`useFichaClinica`) solicita payload completo explicitamente.
- Se separaron query keys frontend: `['encounter', id, 'editor']` y `['encounter', id, 'ficha']`, evitando que la ficha reutilice accidentalmente el payload liviano del editor.
- Se agrego test backend para confirmar que los agregados secundarios no entran al include cuando el editor opta por omitirlos.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand encounters-read-side.spec.ts`: OK, 1 suite / 3 tests.

Siguientes pasos naturales:

1. Medir `Content-Length` y tiempo DB de `/encounters/:id` con payload editor liviano vs ficha completa.
2. Revisar si `patient.problems` e `history` deben dividirse en modo compacto sin romper resumen clinico ni permisos.
3. Considerar endpoints secundarios dedicados para tareas/consentimientos de atencion si una UI futura los necesita dentro del editor.

### Pasada 18 - 2026-04-29

Objetivo: reducir serializacion global por render en el wizard usando dirty flags por seccion.

Cambios aplicados:

- `useEncounterSectionPersistence` mantiene `dirtySectionKeys` como `Set<SectionKey>`.
- `handleSectionDataChange` actualiza solo la seccion modificada contra el snapshot guardado.
- `hasUnsavedChanges` de la seccion activa se deriva de `dirtySectionKeys`, sin volver a serializar la seccion activa en cada render.
- Cuando cambia el snapshot guardado, se recalculan dirty flags de forma acotada al evento de snapshot/hidratacion, no por cada keystroke.
- `useEncounterWizardDerived` recibe `dirtySectionKeys` y `getSectionUiState` usa el set para marcar `dirty`, eliminando los mapas de `JSON.stringify` de todas las secciones por cambio de `formData`.
- La restauracion de conflictos marca la seccion como dirty y la reconciliacion de identificacion limpia dirty para `IDENTIFICACION` cuando actualiza snapshot.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix frontend run test -- --runInBand use-encounter-wizard-derived.test.tsx`: OK, 1 suite / 1 test.

Siguientes pasos naturales:

1. Agregar tests especificos para `useEncounterSectionPersistence` cubriendo dirty por seccion, guardado exitoso y restauracion de conflicto.
2. Medir con React Profiler commits/duracion por tecla en anamnesis/tratamiento antes/despues.
3. Separar la generacion del resumen clinico para que solo se ejecute cuando el panel de apoyo/resumen este visible.

### Pasada 19 - 2026-04-29

Objetivo: mejorar el primer paint percibido de rutas privadas sin exponer datos clinicos antes de validar sesion.

Cambios aplicados:

- Se agrego `DashboardBootstrapShell` en `DashboardLayout`.
- Durante `mounted`/rehydration/`authCheckComplete`, el layout muestra una estructura skeleton de sidebar, header y contenido.
- Se reemplazo el spinner global centrado por un shell sin PHI ni children de rutas privadas.
- El flujo de redirect a login sigue dependiendo de `authCheckComplete` e `isAuthenticated`; el backend sigue siendo fuente de verdad.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.

Siguientes pasos naturales:

1. Medir LCP y tiempo hasta shell visible en `/`, `/pacientes` y `/atenciones`.
2. Ejecutar E2E de auth/logout/session timeout para confirmar que el skeleton no altera redirects.
3. Evaluar una hidratacion server-assisted de `/auth/me` o un bootstrap menos bloqueante si se necesita reducir mas el tiempo a contenido real.

### Pasada 20 - 2026-04-29

Objetivo: reforzar con tests unitarios las optimizaciones nuevas de esta tanda.

Cambios aplicados:

- Se agrego `frontend/src/__tests__/lib/clinical-search.test.ts` para query vacia, normalizacion de pacientes/atenciones y fallo parcial.
- Se agrego `frontend/src/__tests__/components/patient-alerts.test.tsx` para verificar el incremento de `acknowledgedLimit` al usar "Ver mas alertas reconocidas".
- Se agrego `backend/src/conditions/conditions-local-queries.spec.ts` para cubrir el conteo fusionado: globales activos menos overrides excluidos mas locales activos.
- Se amplio `encounters-read-side.spec.ts` en pasada 17 para cubrir omision de agregados secundarios.

Validacion de la pasada:

- `npm --prefix frontend run test -- --runInBand clinical-search.test.ts patient-alerts.test.tsx patient-consents.test.tsx use-encounter-wizard-derived.test.tsx`: OK, 4 suites / 6 tests.
- `npm --prefix backend run test -- --runInBand conditions-local-queries.spec.ts encounters-read-side.spec.ts`: OK, 2 suites / 4 tests.

Siguientes pasos naturales:

1. Agregar tests especificos para dirty flags en `useEncounterSectionPersistence`.
2. Agregar tests para `/conditions/count` a nivel service/controller si se quiere cubrir contrato HTTP.
3. Sumar estas suites focalizadas a una tarea CI de performance-regression.

### Pasada 21 - 2026-04-29

Objetivo: sacar `clinicalSearch` del filtrado en memoria sobre JSON clinico y eliminar el cap de 500 pacientes.

Cambios aplicados:

- Se agrego modelo Prisma `PatientClinicalSearch` con tabla `patient_clinical_search`.
- Se creo migracion `20260429203000_add_patient_clinical_search_projection` con tabla, indices y backfill desde secciones existentes:
  - `MOTIVO_CONSULTA`
  - `ANAMNESIS_PROXIMA`
  - `REVISION_SISTEMAS`
- Se agrego `patient-clinical-search-projection.ts` para reconstruir la proyeccion por `patientId + medicoId`.
- `updateEncounterSectionMutation` reconstruye la proyeccion cuando se guarda una seccion clinica buscable.
- `findPatientsReadModel` reemplaza el flujo anterior:
  - ya no carga encuentros/secciones JSON para busqueda clinica;
  - ya no filtra en JavaScript;
  - ya no usa `CLINICAL_SEARCH_CAP`;
  - usa `clinicalSearches.some({ text contains, medicoId })` respetando scope por medico/asistente.
- Para admin, la busqueda clinica consulta cualquier proyeccion visible por paciente, manteniendo filtros administrativos.
- Se agregaron tests:
  - `patient-clinical-search-projection.spec.ts`
  - `patients-list-read-model.spec.ts`

Validacion de la pasada:

- `npx --prefix backend prisma generate --schema backend/prisma/schema.prisma`: OK.
- `npx --prefix backend prisma validate --schema backend/prisma/schema.prisma`: OK.
- `npm --prefix backend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand patient-clinical-search-projection.spec.ts patients-list-read-model.spec.ts encounters-section-mutations.spec.ts`: OK, 3 suites / 11 tests.
- `npx --prefix backend prisma migrate deploy --schema backend/prisma/schema.prisma`: OK; aplico `20260429203000_add_patient_clinical_search_projection`.
- `npx --prefix backend prisma migrate status --schema backend/prisma/schema.prisma`: OK, base local al dia.
- `EXPLAIN QUERY PLAN` en SQLite confirma uso de `patient_clinical_search_patient_id_medico_id_key` en la subconsulta de proyeccion.

Siguientes pasos naturales:

1. Medir p95 de `/patients?clinicalSearch=...` con dataset grande antes/despues.
2. Si el texto proyectado crece mucho, migrar la tabla de proyeccion a FTS5 o agregar tabla virtual FTS sincronizada.
3. Agregar job/script operativo para reconstruir toda la proyeccion si se sospecha drift o despues de imports masivos.
4. Revisar si conviene normalizar acentos en busqueda y proyeccion para mejorar recall clinico.

### Pasada 22 - 2026-04-29

Objetivo: dejar una herramienta operativa para reparar/reconstruir la proyeccion de busqueda clinica.

Cambios aplicados:

- Se agrego `backend/scripts/rebuild-patient-clinical-search.js`.
- Se agrego script npm `npm --prefix backend run clinical-search:rebuild`.
- El script:
  - resuelve `DATABASE_URL` con las mismas utilidades SQLite existentes;
  - borra la proyeccion actual;
  - reconstruye `patient_clinical_search` desde `encounter_sections` y `encounters`;
  - reporta conteo `before`/`after` en JSON para logs operativos.

Validacion de la pasada:

- `npm --prefix backend run clinical-search:rebuild`: OK, `{"event":"patient_clinical_search_rebuilt","before":1,"after":1}`.
- `npm --prefix backend run typecheck`: OK.

Siguientes pasos naturales:

1. Ejecutar `clinical-search:rebuild` despues de imports masivos o restauraciones de backup antiguas.
2. Agregar este script al bundle de operaciones SQLite si se quiere incluirlo en `db:sqlite:ops`.
3. Agregar modo `--dry-run` si se necesita inspeccion previa en entornos productivos.

### Pasada 23 - 2026-04-29

Objetivo: reemplazar la heuristica `length >= limit` en historiales por metadata `hasMore` del backend.

Cambios aplicados:

- `AlertsService.findByPatient` acepta `withMeta` y usa `acknowledgedLimit + 1` para calcular `acknowledgedHasMore`.
- `ConsentsService.findByPatient` acepta `withMeta` y usa `revokedLimit + 1` para calcular `revokedHasMore`.
- Los controladores mantienen compatibilidad:
  - sin `withMeta=true`, responden el array historico;
  - con `withMeta=true`, responden `{ data, meta }`.
- `PatientAlerts` pide `withMeta=true` y muestra "Ver mas alertas reconocidas" solo si `meta.acknowledgedHasMore`.
- `PatientConsents` pide `withMeta=true` y muestra "Ver mas consentimientos revocados" solo si `meta.revokedHasMore`.
- Se actualizaron tests de componentes para la nueva respuesta con metadata.

Validacion de la pasada:

- `npm --prefix backend run typecheck`: OK.
- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand alerts.service.spec.ts consents.service.spec.ts`: OK, 2 suites / 10 tests.
- `npm --prefix frontend run test -- --runInBand patient-alerts.test.tsx patient-consents.test.tsx`: OK, 2 suites / 2 tests.

Siguientes pasos naturales:

1. Pasar de limites crecientes a cursor real si historiales superan cientos de filas por paciente.
2. Agregar tests backend especificos para `withMeta=true` en alertas y consentimientos. Estado: aplicado en pasada 27.
3. Mostrar un contador total solo si el usuario realmente necesita dimensionar el historial completo.

### Pasada 24 - 2026-04-29

Objetivo: evitar verificacion de integridad en la carga inicial de auditoria y dejar un estado persistido de la ultima verificacion.

Cambios aplicados:

- Se agrego `AuditIntegritySnapshot` en Prisma y la migracion `20260429210000_add_audit_integrity_snapshots`.
- `AuditService.verifyChain` ahora persiste el resultado de cada verificacion en `audit_integrity_snapshots` con:
  - `valid`, `checked`, `total`, `brokenAt`, `warning`;
  - `verificationScope` (`LIMIT_1000`, `FULL`, etc.);
  - `verifiedAt`.
- Cuando se usa `limit`, `verifyChain` verifica la ventana mas reciente y toma como borde el hash del registro inmediatamente anterior.
- Se agrego `GET /audit/integrity/latest` para leer el ultimo resultado sin recorrer `audit_logs`.
- `AuditIntegrityCard` ahora carga `/audit/integrity/latest` por defecto y deja `Verificar reciente` / `Verificar completa` como acciones explicitas.
- La verificacion manual actualiza el cache de TanStack Query con el nuevo snapshot.
- Se actualizaron tests de auditoria admin y concurrencia para cubrir el nuevo contrato.

Validacion de la pasada:

- `npx --prefix backend prisma generate --schema backend/prisma/schema.prisma`: OK.
- `npx --prefix backend prisma validate --schema backend/prisma/schema.prisma`: OK.
- `npx --prefix backend prisma migrate deploy --schema backend/prisma/schema.prisma`: OK.
- `npx --prefix backend prisma migrate status --schema backend/prisma/schema.prisma`: OK.
- `npm --prefix backend run typecheck`: OK.
- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand audit.service.spec.ts audit.service.concurrency.spec.ts`: OK, 2 suites / 13 tests.
- `npm --prefix frontend run test -- --runInBand admin-auditoria.test.tsx`: OK, 1 suite / 2 tests.

Siguientes pasos naturales:

1. Agregar una tarea programada o comando operativo para ejecutar `verifyChain` reciente/completo fuera del render de la UI. Estado: comando operativo aplicado en pasada 25.
2. Agregar checkpoints de hash cada N logs si la verificacion completa sobre historiales grandes supera el presupuesto operativo.
3. Medir `/audit/integrity/latest` y `/audit/integrity/verify?full=true` con 10k/100k logs para fijar limites recomendados.

### Pasada 25 - 2026-04-29

Objetivo: dejar la verificacion de integridad ejecutable fuera de la UI para cron/operaciones.

Cambios aplicados:

- Se agrego `backend/scripts/verify-audit-integrity.js`.
- Se agrego script npm `npm --prefix backend run audit:integrity:verify`.
- El comando por defecto verifica la ventana reciente `LIMIT_1000`.
- El comando acepta `--full` para recorrer toda la cadena.
- El comando acepta `--limit=N` para ajustar la ventana reciente.
- La salida es JSON con `event`, `valid`, `checked`, `total`, `verifiedAt` y `verificationScope`.
- Si encuentra un quiebre, persiste el snapshot y termina con exit code distinto de cero para integrarlo en jobs.

Validacion de la pasada:

- `npm --prefix backend run audit:integrity:verify`: OK, `valid=true`, `checked=55`, `total=55`, `verificationScope=LIMIT_1000`.
- `npm --prefix backend run audit:integrity:verify -- --full`: OK, `valid=true`, `checked=55`, `total=55`, `verificationScope=FULL`.
- `npm --prefix backend run typecheck`: OK.

Siguientes pasos naturales:

1. Conectar `audit:integrity:verify` a un cron/job operativo y alertar si el exit code es distinto de cero.
2. Agregar el comando al runner `db:sqlite:ops` si se quiere incluirlo en la rutina operacional diaria. Estado: aplicado en pasada 26.
3. Medir costo de `--full` con dataset grande antes de programarlo frecuentemente.
4. Implementar checkpoints de hash si `--full` supera el presupuesto de tiempo.

### Pasada 26 - 2026-04-29

Objetivo: integrar la verificacion de integridad al runner operativo SQLite.

Cambios aplicados:

- `sqlite-ops-runner.js` ahora soporta `--mode=integrity`.
- El modo `all` incluye `verify-audit-integrity.js` despues de backup, restore drill cuando corresponda y monitor.
- Se agregaron parametros operativos:
  - `--audit-integrity=recent|full`;
  - `--audit-integrity-limit=N`;
  - variables `SQLITE_AUDIT_INTEGRITY_SCOPE` y `SQLITE_AUDIT_INTEGRITY_LIMIT`.
- Se agrego script npm `npm --prefix backend run db:sqlite:ops:integrity`.
- El runner guarda `lastAuditIntegrityAt` en `.sqlite-ops-state.json` cuando la verificacion pasa.

Validacion de la pasada:

- `npm --prefix backend run db:sqlite:ops:integrity`: OK, ejecuta `verify-audit-integrity.js --limit=1000`.
- `npm --prefix backend run db:sqlite:ops:integrity -- --audit-integrity=full`: OK, ejecuta `verify-audit-integrity.js --full`.
- `npm --prefix backend run db:sqlite:ops -- --mode=integrity` no sirve para cambiar el modo porque el script npm ya fija `--mode=all`; por eso se agrego el alias dedicado `db:sqlite:ops:integrity`.

Siguientes pasos naturales:

1. Programar `db:sqlite:ops:integrity` en el entorno real con `--audit-integrity=recent` diario y `--audit-integrity=full` con menor frecuencia.
2. Configurar `SQLITE_ALERT_WEBHOOK_URL` para notificar fallos del runner.
3. Medir `db:sqlite:ops` completo con base grande, porque ahora el modo `all` tambien incluye integridad.
4. Implementar checkpoints si el modo full crece por encima del presupuesto operativo.

### Pasada 27 - 2026-04-29

Objetivo: cubrir en backend el contrato `withMeta=true` de historiales de alertas y consentimientos.

Cambios aplicados:

- `alerts.service.spec.ts` valida que `findByPatient(..., { withMeta: true })`:
  - pide `acknowledgedLimit + 1`;
  - calcula `acknowledgedHasMore`;
  - no devuelve la fila extra usada solo para detectar paginacion.
- `consents.service.spec.ts` valida que `findByPatient(..., { withMeta: true })`:
  - pide `revokedLimit + 1`;
  - calcula `revokedHasMore`;
  - no devuelve la fila extra usada solo para detectar paginacion.

Validacion de la pasada:

- `npm --prefix backend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand alerts.service.spec.ts consents.service.spec.ts`: OK, 2 suites / 12 tests.

Siguientes pasos naturales:

1. Migrar a cursor real si los historiales pasan de limites crecientes a navegacion larga.
2. Agregar tests controller para verificar compatibilidad entre respuesta legacy array y respuesta `{ data, meta }`. Estado: aplicado en pasada 28.
3. Evaluar contador total solo si producto lo necesita para auditoria o navegacion clinica.

### Pasada 28 - 2026-04-29

Objetivo: proteger en controller la compatibilidad entre respuestas legacy y respuestas con metadata.

Cambios aplicados:

- Se agrego `alerts.controller.spec.ts`.
- Se agrego `consents.controller.spec.ts`.
- Los tests de alertas validan:
  - sin `withMeta`, el controller llama al service sin `withMeta` y mantiene respuesta array;
  - con `withMeta=true`, el controller pasa `{ withMeta: true }` y mantiene respuesta `{ data, meta }`.
- Los tests de consentimientos validan el mismo contrato para `revokedLimit` y `revokedHasMore`.

Validacion de la pasada:

- `npm --prefix backend run typecheck`: OK.
- `npm --prefix backend run test -- --runInBand alerts.controller.spec.ts consents.controller.spec.ts alerts.service.spec.ts consents.service.spec.ts`: OK, 4 suites / 16 tests.

Siguientes pasos naturales:

1. Migrar alertas/consentimientos a cursor real si los historiales crecen mas alla de una navegacion corta.
2. Medir payload y p95 de la ficha paciente con muchos historiales revocados/reconocidos.
3. Agregar contador total solo con una necesidad concreta de producto.

### Pasada 29 - 2026-04-29

Objetivo: integrar el presupuesto de bundle al pipeline para detectar regresiones de JS en rutas criticas.

Cambios aplicados:

- `.github/workflows/ci.yml` ahora ejecuta `npm run bundle:budget` en el job frontend inmediatamente despues de `npm run build`.
- La validacion usa el artefacto `.next` recien construido y falla el CI si una ruta medida supera su presupuesto gzip.

Validacion de la pasada:

- Cambio revisado estaticamente; no se ejecuto CI local completo.

Siguientes pasos naturales:

1. Correr el job frontend completo en CI para confirmar que `bundle:budget` encuentra los HTML generados en entorno limpio.
2. Registrar deltas de bundle en PRs cuando falle el presupuesto, distinguiendo shared chunks de chunks especificos de ruta.
3. Agregar presupuestos para ficha paciente y editor de atencion cuando se pueda medir esas rutas dinamicas de forma estable.

### Pasada 30 - 2026-04-29

Objetivo: reforzar con tests la optimizacion de dirty flags por seccion del wizard de atenciones.

Cambios aplicados:

- Se agrego `frontend/src/__tests__/app/use-encounter-section-persistence.test.tsx`.
- El test cubre que al editar `MOTIVO_CONSULTA` solo esa seccion queda marcada como dirty, y que cambiar a otra seccion no hereda `hasUnsavedChanges`.
- El test cubre que un guardado exitoso actualiza el snapshot y limpia el dirty flag de la seccion guardada.
- El test cubre que restaurar un conflicto recuperable marca como dirty solo la seccion restaurada y conserva la copia local visible.
- Los efectos de autosave, draft sync, cola offline y save-flow se aislaron con mocks para verificar la logica propia de `useEncounterSectionPersistence` sin depender de red ni timers.

Validacion de la pasada:

- `npm --prefix frontend run test -- --runInBand use-encounter-section-persistence.test.tsx`: OK, 1 suite / 3 tests.

Siguientes pasos naturales:

1. Agregar un caso para reconciliacion de identificacion que confirme que `IDENTIFICACION` queda limpia despues de actualizar snapshot.
2. Incluir esta suite en una tarea focalizada de performance-regression junto con los tests de busqueda clinica, alertas y bundle budget.
3. Medir con React Profiler commits/duracion por tecla en anamnesis y tratamiento para validar el impacto real de los dirty flags.

### Pasada 31 - 2026-04-29

Objetivo: agrupar las pruebas focalizadas de regresion de performance para que sean faciles de ejecutar.

Cambios aplicados:

- Se agrego script root `npm run test:performance-regression`.
- Se agrego `npm --prefix backend run test:performance-regression` con suites de busqueda clinica, read models de atencion, alertas/consentimientos con metadata, conteo de catalogo y auditoria.
- Se agrego `npm --prefix frontend run test:performance-regression` con suites de busqueda clinica, historiales de paciente, wizard dirty flags, dashboard/auditoria y derivaciones del wizard.
- El script root ejecuta backend, frontend, `npm --prefix frontend run build` y luego `npm --prefix frontend run bundle:budget`, para que el presupuesto se mida sobre un build fresco.

Validacion de la pasada:

- `npm --prefix frontend run test:performance-regression`: OK, 6 suites / 11 tests.
- `npm --prefix backend run test:performance-regression`: OK, 10 suites / 36 tests.
- `npm run test:performance-regression`: OK; backend/frontend focalizados, build frontend y `bundle:budget`.
  - `/login`: 286 KiB gzip / 320 KiB.
  - `/pacientes`: 288 KiB gzip / 330 KiB.
  - `/atenciones`: 285 KiB gzip / 330 KiB.
  - `/atenciones/nueva`: 279 KiB gzip / 320 KiB.

Siguientes pasos naturales:

1. Decidir si esta tarea corre siempre en CI o solo como job/manual check de PRs con cambios clinicos/performance.
2. Mantener la lista de suites focalizadas actualizada cuando se agreguen endpoints compactos, cursores reales o checkpoints de auditoria.
3. Agregar presupuestos para rutas dinamicas cuando el script pueda medir manifiestos/chunks de `/pacientes/[id]` y `/atenciones/[id]`.

### Pasada 32 - 2026-04-29

Objetivo: extender el presupuesto de bundle a rutas dinamicas clinicas.

Cambios aplicados:

- `frontend/scripts/check-bundle-budget.js` ahora soporta dos fuentes de medicion:
  - HTML prerenderizado para rutas estaticas;
  - `page_client-reference-manifest.js` para rutas dinamicas App Router.
- Se agregaron presupuestos iniciales para:
  - `/pacientes/[id]`: 190 KiB gzip via manifest.
  - `/atenciones/[id]`: 180 KiB gzip via manifest.
  - `/atenciones/[id]/ficha`: 170 KiB gzip via manifest.
- La salida del script ahora indica la fuente usada (`html` o `manifest`) para evitar comparar mediciones de distinta naturaleza sin contexto.

Validacion de la pasada:

- `npm --prefix frontend run bundle:budget`: OK.
  - `/login`: 286 KiB gzip / 320 KiB.
  - `/pacientes`: 288 KiB gzip / 330 KiB.
  - `/atenciones`: 285 KiB gzip / 330 KiB.
  - `/atenciones/nueva`: 279 KiB gzip / 320 KiB.
  - `/pacientes/[id]`: 142 KiB gzip / 190 KiB.
  - `/atenciones/[id]`: 130 KiB gzip / 180 KiB.
  - `/atenciones/[id]/ficha`: 118 KiB gzip / 170 KiB.

Siguientes pasos naturales:

1. Revisar los reportes de analyzer para atribuir los chunks grandes de las rutas dinamicas antes de bajar presupuestos.
2. Registrar en PRs si una regresion viene de chunks compartidos o de codigo especifico de ficha/editor.
3. Considerar presupuestos separados para rutas admin/analitica si empiezan a crecer por dependencias de tablas/exportacion.

### Pasada 33 - 2026-04-29

Objetivo: permitir inspeccionar la reconstruccion de busqueda clinica sin modificar datos.

Cambios aplicados:

- `backend/scripts/rebuild-patient-clinical-search.js` acepta `--dry-run`.
- El modo dry-run calcula cuantas filas proyectadas se generarian desde `encounter_sections` + `encounters` sin borrar ni insertar en `patient_clinical_search`.
- La salida JSON incluye `before`, `projected`, `drift` y `dryRun`.
- El modo normal conserva el rebuild destructivo controlado, pero ahora tambien reporta `projected` y `dryRun: false`.

Validacion de la pasada:

- `npm --prefix backend run clinical-search:rebuild -- --dry-run`: OK, `before=1`, `projected=1`, `drift=0`.
- `npm --prefix backend run clinical-search:rebuild`: OK, `before=1`, `after=1`, `projected=1`.

Siguientes pasos naturales:

1. Documentar en `docs/` o en el runner operativo cuando usar `clinical-search:rebuild -- --dry-run` antes de imports/restores.
2. Agregar el rebuild de busqueda clinica al runner SQLite si se quiere una rutina operacional unica.
3. Si aparece drift frecuente, registrar eventos/alertas operativas antes de reconstruir automaticamente.

### Pasada 34 - 2026-04-29

Objetivo: integrar la inspeccion/reconstruccion de busqueda clinica al runner operativo SQLite.

Cambios aplicados:

- `backend/scripts/sqlite-ops-runner.js` ahora soporta `--mode=clinical-search`.
- El modo `clinical-search` ejecuta `rebuild-patient-clinical-search.js --dry-run` por defecto.
- Se agrego parametro `--clinical-search=dry-run|rebuild` y variable `SQLITE_CLINICAL_SEARCH_ACTION`.
- El runner guarda estado separado:
  - `lastClinicalSearchProjectionCheckAt` para dry-run;
  - `lastClinicalSearchProjectionRebuildAt` para rebuild.
- Se agrego script npm `npm --prefix backend run db:sqlite:ops:clinical-search`.

Validacion de la pasada:

- `npm --prefix backend run db:sqlite:ops:clinical-search`: OK, ejecuta dry-run con `drift=0`.
- `npm --prefix backend run db:sqlite:ops:clinical-search -- --clinical-search=rebuild`: OK, reconstruye y reporta `after=1`.

Siguientes pasos naturales:

1. Programar `db:sqlite:ops:clinical-search` en modo dry-run despues de imports/restores para detectar drift.
2. Usar `--clinical-search=rebuild` solo como accion operativa explicita cuando el drift sea esperado o confirmado.
3. Evaluar alertas si `drift !== 0` se vuelve senal operacional importante.

### Pasada 35 - 2026-04-29

Objetivo: cubrir el contrato barato de `/conditions/count` y sumarlo a regresion de performance.

Cambios aplicados:

- Se agrego `backend/src/conditions/conditions.controller.spec.ts` para verificar que el controller mantiene `/conditions/count` como passthrough a `ConditionsService.count(user)`.
- Se agrego `backend/src/conditions/conditions.service.count.spec.ts` para cubrir:
  - admin: count directo del catalogo global;
  - no admin: uso de `countMergedConditions`.
- `npm --prefix backend run test:performance-regression` incluye ahora los specs de count de condiciones.

Validacion de la pasada:

- `npm --prefix backend run test -- --runInBand conditions.controller.spec.ts conditions.service.count.spec.ts conditions-local-queries.spec.ts`: OK, 3 suites / 4 tests.
- `npm --prefix backend run test:performance-regression`: OK, 12 suites / 39 tests.

Siguientes pasos naturales:

1. Medir `/conditions/count` con catalogo grande y usuarios medico/asistente para confirmar el delta contra `/conditions`.
2. Agregar indices adicionales en `condition_catalog_local` solo si la medicion muestra scans costosos.
3. Mantener el header consumiendo exclusivamente `/conditions/count` para evitar regresiones de payload.

### Pasada 36 - 2026-04-29

Objetivo: separar los KPIs livianos del header del read model completo del dashboard.

Cambios aplicados:

- Se agrego `getEncounterHeaderCountsReadModel` en `encounters-dashboard-read-model.ts`.
- El nuevo read model solo ejecuta counts y no carga listas de atenciones recientes ni tareas proximas.
- `EncountersService.getHeaderCounts` y `GET /encounters/stats/header` exponen el contrato liviano.
- `SmartHeaderBar` usa `DASHBOARD_HEADER_COUNTS_QUERY_KEY` y `fetchDashboardHeaderCounts` contra `/encounters/stats/header`.
- `query-invalidation.ts` invalida tanto dashboard completo como header counts cuando hay mutaciones operativas.
- Las suites focalizadas de performance incluyen ahora `encounters-dashboard-read-model.spec.ts` y `header-kpi-bar.test.tsx`.

Validacion de la pasada:

- `npm --prefix backend run test -- --runInBand encounters-dashboard-read-model.spec.ts`: OK, 1 suite / 1 test.
- `npm --prefix frontend run test -- --runInBand header-kpi-bar.test.tsx dashboard-page.test.tsx`: OK, 2 suites / 5 tests.
- `npm --prefix backend run test:performance-regression`: OK, 13 suites / 40 tests.
- `npm --prefix frontend run test:performance-regression`: OK, 7 suites / 15 tests.
- `npm --prefix frontend run bundle:budget`: OK, incluyendo rutas dinamicas por manifest.

Siguientes pasos naturales:

1. Medir `/encounters/stats/header` vs `/encounters/stats/dashboard` con dataset grande para confirmar reduccion de tiempo DB y payload.
2. Revisar si `upcomingTasks` del header debe mostrarse como total de tareas activas o conservar un contador capado segun decision de producto.
3. Si el header sigue siendo frecuente, considerar cache corto server-side por medico efectivo para estos counts.

### Pasada 37 - 2026-04-29

Objetivo: reducir escrituras por keystroke en el borrador no clinico de registro.

Cambios aplicados:

- `frontend/src/app/register/page.tsx` debounced el guardado de `REGISTER_DRAFT_KEY` en `sessionStorage` a 300 ms.
- El ultimo borrador pendiente se flushea al desmontar para no perder nombre/email/rol si el usuario navega rapidamente.
- Al registrar exitosamente, se limpia el timer pendiente y el draft en memoria antes de remover `REGISTER_DRAFT_KEY`, evitando que un timeout reescriba datos viejos.

Validacion de la pasada:

- `npm --prefix frontend run typecheck`: OK.

Siguientes pasos naturales:

1. Agregar test de registro con fake timers si se quiere verificar explicitamente debounce y flush de `REGISTER_DRAFT_KEY`.
2. Revisar otros formularios no clinicos con persistencia por keystroke antes de tocar flujos clinicos sensibles.
3. Mantener el autosave clinico separado: este cambio no reemplaza la logica de borradores/cola del wizard de atenciones.

### Pasada 38 - 2026-04-29

Objetivo: validar de punta a punta la tanda de regresion de performance tras los cambios de header, bundle y scripts.

Acciones realizadas:

- Se ejecuto el comando root `npm run test:performance-regression`.
- La tarea corrio suites focalizadas backend, suites focalizadas frontend, build frontend con Turbopack y presupuesto de bundle.

Validacion de la pasada:

- Backend focalizado: OK, 13 suites / 40 tests.
- Frontend focalizado: OK, 7 suites / 15 tests.
- `npm --prefix frontend run build`: OK.
- `npm --prefix frontend run bundle:budget`: OK.
  - `/login`: 286 KiB gzip / 320 KiB.
  - `/pacientes`: 288 KiB gzip / 330 KiB.
  - `/atenciones`: 285 KiB gzip / 330 KiB.
  - `/atenciones/nueva`: 279 KiB gzip / 320 KiB.
  - `/pacientes/[id]`: 142 KiB gzip / 190 KiB.
  - `/atenciones/[id]`: 130 KiB gzip / 180 KiB.
  - `/atenciones/[id]/ficha`: 118 KiB gzip / 170 KiB.

Siguientes pasos naturales:

1. Ejecutar E2E de auth/logout/session timeout para validar el skeleton privado y redirects reales.
2. Medir endpoints con dataset grande: `/encounters/stats/header`, `/encounters/stats/dashboard`, `/patients?clinicalSearch=...` y `/encounters/:id`.
3. Revisar analyzer para decidir si conviene atacar `react-icons`, `date-fns` o componentes especificos de rutas clinicas.

### Pasada 39 - 2026-04-29

Objetivo: validar en navegador real el flujo smoke de auth y redirects privados despues del cambio de skeleton/bootstrap.

Acciones realizadas:

- Se ejecuto Playwright smoke en Chromium.
- La prueba cubre flujo de acceso bootstrap-aware y redirect de ruta privada no autenticada hacia login.

Validacion de la pasada:

- `npm --prefix frontend run test:e2e:smoke`: OK, 2 tests.

Siguientes pasos naturales:

1. Ejecutar E2E especifico de logout/session timeout si se necesita cubrir expiracion y refresco de sesion mas alla del smoke.
2. Medir LCP y tiempo hasta shell visible en `/`, `/pacientes` y `/atenciones` con Playwright trace o Web Vitals.
3. Mantener el skeleton sin PHI mientras se explora bootstrap server-assisted o revalidacion menos bloqueante.

## Stack y organizacion

| Area | Stack observado | Archivos guia |
|---|---|---|
| Frontend | Next.js App Router, React 18, TypeScript, TanStack Query, Zustand, React Hook Form, Zod, Tailwind/CSS global, Axios | `frontend/package.json`, `frontend/src/app`, `frontend/src/components`, `frontend/src/lib` |
| Backend/API | NestJS 11, TypeScript, Prisma 5, SQLite, DTO validation, guards JWT, auditoria con hash | `backend/package.json`, `backend/src`, `backend/prisma/schema.prisma` |
| Estado y datos | TanStack Query para server state, Zustand para auth/settings/local UI | `frontend/src/components/providers/Providers.tsx`, `frontend/src/stores` |
| Seguridad | Cookies HttpOnly, proxy same-origin, permisos compartidos, audit log, session policy | `frontend/src/proxy.ts`, `frontend/src/lib/api.ts`, `shared/permission-contract.ts`, `backend/src/audit` |
| Build | Monorepo npm, Next standalone, Sentry opcional por DSN | `package.json`, `frontend/next.config.js` |

## Puntos criticos probables

- Carga inicial del dashboard bloqueada por autenticacion en cliente antes de pintar el shell.
- Endpoint `/encounters/stats/dashboard` ejecutado por varias vistas y header, con muchas consultas Prisma por request.
- Busqueda clinica de pacientes con carga de secciones JSON y filtrado en memoria.
- Apertura de atenciones con payload amplio: paciente, secciones, problemas, tareas, adjuntos, consentimientos, firmas y baseline.
- Editor de atenciones con `JSON.stringify` frecuente sobre secciones clinicas durante escritura.
- Vista de ficha paciente con varias requests paralelas y recursos secundarios no diferidos.
- Alertas, consentimientos y auditoria con rutas que escalan mal cuando el historial crece.
- Indices Prisma/SQLite insuficientes para filtros reales por medico, estado, fecha y paciente.
- Archivos frontend grandes en vistas clinicas y settings, lo que eleva costo de cambio.

## Tabla resumen de hallazgos

| # | Area | Hallazgo | Severidad | Impacto principal | Archivo(s) |
|---|---|---|---|---|---|
| 1 | Carga inicial | El dashboard espera bootstrap cliente y `/auth/me` antes de mostrar shell | Alta | LCP/percepcion de lentitud en cada entrada privada | `DashboardLayout.tsx`, `proxy.ts` |
| 2 | Carga de datos | KPIs del dashboard se piden varias veces y disparan muchas consultas | Alta | DB/API sobrecargados y header lento | `SmartHeaderBar.tsx`, `page.tsx`, `encounters-dashboard-read-model.ts` |
| 3 | Busqueda clinica | `clinicalSearch` carga secciones JSON y filtra en memoria con cap | Alta | Resultados incompletos, CPU/memoria y latencia con muchos pacientes | `patients-list-read-model.ts`, `pacientes/page.tsx` |
| 4 | Apertura de atencion | `/encounters/:id` devuelve demasiados agregados de una vez | Alta | Apertura de ficha/atencion lenta y payload excesivo | `encounters-read-side.ts`, `useEncounterWizardEncounter.ts` |
| 5 | Editor clinico | El wizard serializa y recalcula estado de secciones al escribir | Media-Alta | INP degradado en formularios largos | `useEncounterSectionPersistence.ts`, `useEncounterWizardDerived.ts` |
| 6 | Ficha paciente | La vista de paciente lanza muchas queries iniciales | Media | UI fragmentada y TTFB/API acumulado | `usePatientDetailQueries.ts`, `PatientAlerts.tsx`, `PatientConsents.tsx` |
| 7 | Alertas/consentimientos | Listados historicos se cargan completos y se filtran en cliente | Media | Escala mal en pacientes con historial largo | `alerts.service.ts`, `PatientAlerts.tsx`, `PatientConsents.tsx` |
| 8 | Auditoria | Verificacion completa de integridad corre al montar la pagina admin | Alta | O(N) sobre `audit_logs`, bloqueo de admin y DB | `AuditIntegrityCard.tsx`, `audit.service.ts` |
| 9 | Base de datos | Faltan indices compuestos para queries reales | Alta | Degradacion progresiva en listados, dashboard y busquedas | `schema.prisma`, read models |
| 10 | Busqueda global | Busquedas sin cancelacion y logica duplicada | Media | Resultados obsoletos, requests redundantes, UX inconsistente | `useDashboardSearch.ts`, `CommandPalette.tsx` |
| 11 | Header/catalogo | El header descarga todo `/conditions` solo para contar | Baja-Media | Payload innecesario en navegacion | `SmartHeaderBar.tsx` |
| 12 | Estado global | Suscripciones amplias a Zustand provocan renders extra | Baja-Media | Re-renders del shell y componentes clinicos | `auth-store.ts`, multiples consumidores |
| 13 | Animaciones | `transition-all`, grid/width transitions y shimmer global pueden generar jank | Baja-Media | Fluidez irregular en workspace clinico | `globals.css`, `atenciones/[id]/page.tsx`, `EncounterSectionRail.tsx` |
| 14 | Build/deps | Dependencias no usadas y falta de presupuesto de bundle | Baja-Media | Bundle mas pesado y drift de mantenimiento | `frontend/package.json`, `next.config.js` |
| 15 | Auditoria writes | Cada evento auditado serializa escritura con lock SQLite pragmatico | Media | Cuello de botella futuro bajo autosave/concurrencia | `audit.service.ts` |

---

## Hallazgos detallados

### 1. El dashboard bloquea el primer paint hasta completar bootstrap cliente

Severidad: Alta

Archivos y lineas:

- `frontend/src/components/layout/DashboardLayout.tsx:56-76`
- `frontend/src/components/layout/DashboardLayout.tsx:141-188`
- `frontend/src/components/layout/DashboardLayout.tsx:190-245`
- `frontend/src/proxy.ts:4-27`

Impacto esperado:

- Incrementa LCP y tiempo percibido de entrada a cualquier ruta privada.
- El usuario ve spinner global aunque el proxy ya hizo una decision de acceso basada en cookies.
- En redes lentas, cada entrada al dashboard depende de hidratacion cliente + request `/auth/me`.

Explicacion tecnica:

`DashboardLayout` es un componente cliente que espera `mounted`, `hasHydrated`, `authCheckComplete` e `isAuthenticated`. En el efecto de bootstrap llama a `/auth/me`, actualiza Zustand y solo despues renderiza el shell. Esto protege la UI, pero retrasa todo el layout privado. El `proxy.ts` ya existe y resuelve redirects con cookies, por lo que parte del gating puede moverse antes o hidratarse de forma menos bloqueante.

Evidencia observada:

- `DashboardLayout.tsx:159` llama `api.get('/auth/me')`.
- `DashboardLayout.tsx:240-245` renderiza solo spinner mientras no esten completos `mounted`, `hasHydrated`, `authCheckComplete` o `isAuthenticated`.
- `proxy.ts:13-27` ya redirige rutas privadas/publicas segun cookies.

Recomendacion concreta:

- Mantener enforcement de permisos en backend.
- Usar el proxy como primera barrera y permitir que el shell privado pinte skeleton estructural antes de terminar datos secundarios.
- Separar bootstrap critico de datos no criticos: user/session primero; `session-policy`, busqueda global y KPIs despues.
- Si se mantiene cliente puro, cachear `/auth/me` como query con `initialData` desde storage seguro solo para pintar nombre/rol, y revalidar en background.

Estado tras pasada 19:

- Parcialmente resuelto a nivel perceptual. `DashboardLayout` muestra un skeleton estructural sin PHI durante bootstrap en vez de spinner global.
- Pendiente: medir LCP real y evaluar un bootstrap server-assisted o una revalidacion no bloqueante para pintar contenido real antes.

Ejemplo orientativo:

```tsx
// Shell: renderiza estructura despues de hydration minima.
if (!hasHydrated) return <DashboardSkeleton />;

// Auth revalidation no deberia bloquear sidebar/header skeleton.
const userQuery = useQuery({
  queryKey: ['auth', 'me'],
  queryFn: () => api.get('/auth/me').then((r) => r.data),
  staleTime: 60_000,
});
```

Riesgos:

- No exponer PHI ni rutas clinicas si el usuario no esta autenticado.
- No confiar en el frontend para enforcement; el backend debe seguir siendo fuente de verdad.

Como validar:

- Medir LCP y tiempo hasta primer shell visible en `/`, `/pacientes` y `/atenciones`.
- Comparar waterfall antes/despues: spinner global vs skeleton + revalidacion.
- Ejecutar E2E de auth/logout/session timeout.

### 2. KPIs del dashboard se consultan de forma duplicada y costosa

Severidad: Alta

Archivos y lineas:

- `frontend/src/components/layout/SmartHeaderBar.tsx:92-103`
- `frontend/src/app/(dashboard)/page.tsx:17-24`
- `frontend/src/app/(dashboard)/atenciones/page.tsx:137-145`
- `backend/src/encounters/encounters-dashboard-read-model.ts:29-125`

Impacto esperado:

- Mas latencia en header y dashboard.
- Multiplica consultas a DB por navegacion.
- Degrada con mas encuentros, tareas, alertas y pacientes.

Explicacion tecnica:

El header, la home del dashboard y la lista de atenciones piden `/encounters/stats/dashboard` con claves distintas: `['dashboard-header-kpis']`, `['dashboard']` y `['encounters-dashboard-stats']`. TanStack Query no puede deduplicar entre keys diferentes. El backend ejecuta muchas operaciones Prisma en paralelo para cada request.

Evidencia observada:

- `SmartHeaderBar.tsx:94` usa `queryKey: ['dashboard-header-kpis']`.
- `page.tsx:19` usa `queryKey: ['dashboard']`.
- `atenciones/page.tsx:139` usa `queryKey: ['encounters-dashboard-stats']`.
- `encounters-dashboard-read-model.ts:43-125` ejecuta counts, listados y agregados en `Promise.all`.

Recomendacion concreta:

- Crear un hook unico `useDashboardStats` con key canonica, por ejemplo `['encounters', 'stats', 'dashboard']`.
- Dividir el endpoint si el header solo necesita 2-4 contadores baratos.
- Cachear el read model por usuario/medico efectivo durante 30-60 segundos si la frescura clinica lo permite.
- Evitar que el header dispare el endpoint en rutas donde la pagina ya lo pidio.

Estado tras pasada 1:

- Parcialmente resuelto. `frontend/src/lib/dashboard-stats.ts:3-7` define la key canonica y el fetcher.
- `SmartHeaderBar.tsx:94-100`, `page.tsx:17-20` y `atenciones/page.tsx:138-142` usan la misma key, por lo que TanStack Query puede deduplicar y reutilizar cache entre header/paginas.
- Sigue pendiente dividir el endpoint backend en contadores baratos vs dashboard completo, o cachear el read model server-side.

Ejemplo orientativo:

```ts
export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ['encounters', 'stats', 'dashboard'],
    queryFn: () => api.get('/encounters/stats/dashboard').then((r) => r.data),
    staleTime: 60_000,
    enabled,
  });
}
```

Riesgos:

- No ocultar alertas o tareas clinicas criticas por cache excesivo.
- Para datos operativos sensibles, preferir cache corto y refetch en mutaciones.

Como validar:

- Contar requests a `/encounters/stats/dashboard` al navegar dashboard -> atenciones -> paciente.
- Medir duracion del endpoint con 100, 1.000 y 10.000 encuentros semilla.
- Revisar Query Devtools/render profiler para confirmar deduplicacion.

### 3. La busqueda clinica de pacientes filtra JSON en memoria y puede omitir resultados

Severidad: Alta

Archivos y lineas:

- `backend/src/patients/patients-list-read-model.ts:93-104`
- `backend/src/patients/patients-list-read-model.ts:129-168`
- `frontend/src/app/(dashboard)/pacientes/page.tsx:133-153`

Impacto esperado:

- Latencia alta y uso de memoria/CPU cuando hay muchas atenciones.
- Resultados potencialmente incompletos por `CLINICAL_SEARCH_CAP=500`.
- Riesgo de experiencia confusa: el usuario busca un dato clinico real pero no aparece por estar fuera del cap.

Explicacion tecnica:

La busqueda demografica usa `contains` sobre paciente, pero la busqueda clinica carga hasta 500 pacientes con secciones de encuentros (`MOTIVO_CONSULTA`, `ANAMNESIS_PROXIMA`, `REVISION_SISTEMAS`), selecciona `data` JSON y luego filtra en JavaScript con `matchesClinicalSearch`.

Evidencia observada:

- `patients-list-read-model.ts:130` define `CLINICAL_SEARCH_CAP = 500`.
- `patients-list-read-model.ts:139-151` incluye `encounters.sections.data`.
- `patients-list-read-model.ts:155-161` filtra con `matchingPatients.filter(...)`.
- `patients-list-read-model.ts:163-168` pagina despues de filtrar en memoria.

Recomendacion concreta:

- Crear una proyeccion de busqueda clinica minimizada, autorizable por `patientId`/`medicoId`.
- En SQLite, usar FTS5 para texto clinico normalizado si esta disponible en el entorno.
- Actualizar la proyeccion cuando se guarda una seccion relevante.
- Mantener el scope de permisos por medico/equipo antes de consultar la proyeccion.

Ejemplo orientativo:

```sql
-- Conceptual: tabla FTS sin PHI extra innecesaria.
CREATE VIRTUAL TABLE patient_clinical_search
USING fts5(patientId UNINDEXED, medicoId UNINDEXED, text);

SELECT p.*
FROM patient_clinical_search s
JOIN Patient p ON p.id = s.patientId
WHERE s.text MATCH ?
  AND s.medicoId = ?
LIMIT ? OFFSET ?;
```

Riesgos:

- La proyeccion contiene texto clinico sensible; debe respetar backups, auditoria, permisos y retencion.
- Requiere migracion y estrategia de backfill.

Como validar:

- Seed con miles de pacientes y secciones clinicas.
- Comparar tiempo de `/patients?clinicalSearch=...` antes/despues.
- Verificar que resultados fuera de los primeros 500 ahora aparecen.
- Probar aislamiento entre medicos.

### 4. La apertura de una atencion trae agregados secundarios demasiado temprano

Severidad: Alta

Archivos y lineas:

- `backend/src/encounters/encounters-read-side.ts:101-172`
- `backend/src/encounters/encounters-read-side.ts:182-208`
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardEncounter.ts:18-25`
- `frontend/src/app/(dashboard)/atenciones/[id]/EncounterClinicalSummaryCard.tsx:16-22`

Impacto esperado:

- Mayor tiempo de apertura de ficha/atencion.
- Payload grande para usuarios que solo necesitan editar una seccion.
- Trabajo DB innecesario para baseline de firma, adjuntos, consentimientos o historial si no se abren esos paneles.

Explicacion tecnica:

`findEncounterById` incluye paciente con historia, todas las secciones, problemas, tareas, sugerencias, adjuntos, firmas, consentimientos y tareas. Luego busca un `signatureBaseline` previo con secciones y adjuntos. El frontend abre el wizard con ese endpoint y ademas el card de resumen clinico hace otra request a `/patients/:id/clinical-summary`.

Evidencia observada:

- `encounters-read-side.ts:110` incluye `sections`.
- `encounters-read-side.ts:116-171` incluye varios agregados relacionados.
- `encounters-read-side.ts:182-200` busca baseline previo.
- `useEncounterWizardEncounter.ts:21` consume `/encounters/${encounterId}`.
- `EncounterClinicalSummaryCard.tsx:20` consume `/patients/${patientId}/clinical-summary`.

Recomendacion concreta:

- Separar payload critico de editor y payloads secundarios.
- Endpoint inicial: secciones + datos minimos de paciente + estado/permisos.
- Lazy loading: adjuntos, consentimientos, auditoria, baseline de firma, summary extendido y problemas/tareas cuando su panel esta visible.
- Incluir counts/metadatos livianos para mostrar badges sin descargar todo.

Estado tras pasada 7:

- Parcialmente resuelto para baseline de firma. `encounters-read-side.ts:96-103` recibe `includeSignatureBaseline`; `encounters-read-side.ts:183-203` omite la consulta secundaria cuando vale `false`.
- `encounters.controller.ts:111-120` expone el flag por query.
- `useEncounterWizardEncounter.ts:18-23` abre el editor con `includeSignatureBaseline=false`.
- `ficha/useFichaClinica.ts:45-48` conserva `includeSignatureBaseline=true` para diff/firma.
- Pasada 17 agrega flags para omitir adjuntos, consentimientos, tareas, firmas y sugerencias en el payload inicial del editor, y separa query keys de editor/ficha.
- Pendiente: medir payload real y evaluar si `patient.problems`/`history` necesitan modo compacto.

Ejemplo orientativo:

```ts
GET /encounters/:id/editor
// paciente minimo, secciones, status, reviewStatus, permissions

GET /encounters/:id/attachments
GET /encounters/:id/signature-baseline
GET /patients/:id/clinical-summary?mode=compact
```

Riesgos:

- Puede cambiar el orden de disponibilidad de datos en UI.
- Necesita asegurar que cada endpoint secundario tenga los mismos guards y scope de permisos.

Como validar:

- Medir `Content-Length` y tiempo DB de `/encounters/:id` antes/despues.
- Lighthouse/Performance: tiempo hasta primer campo editable.
- E2E de firma, adjuntos, consentimiento y cierre para detectar regresiones.

### 5. El editor de atenciones recalcula y serializa demasiado durante escritura

Severidad: Media-Alta

Archivos y lineas:

- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts:50-58`
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts:193-200`
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionPersistence.ts:287-339`
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived.ts:153-193`
- `frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx:14-45`

Impacto esperado:

- Peor INP al escribir en formularios clinicos largos.
- Re-render del shell/rail/resumen aunque cambie un unico campo.
- Mayor consumo de CPU al comparar secciones con `JSON.stringify`.

Explicacion tecnica:

El estado `formData` es un objeto global por seccion. Cada cambio clona el objeto completo. Luego se comparan snapshots con `JSON.stringify`, se recalculan estados de seccion y se regenera el resumen clinico sobre todas las secciones. La carga dinamica de componentes por seccion ya esta bien aplicada, pero el estado compartido todavia propaga demasiado trabajo.

Evidencia observada:

- `handleSectionDataChange` en `useEncounterSectionPersistence.ts:193-200` actualiza `formData` completo.
- `useEncounterSectionPersistence.ts:287-303` compara seccion actual con `JSON.stringify`.
- `useEncounterSectionPersistence.ts:305-339` itera todas las secciones para snapshots.
- `useEncounterWizardDerived.ts:161-174` usa `JSON.stringify` por seccion para UI state.
- `useEncounterWizardDerived.ts:184-193` reconstruye resumen clinico desde todas las secciones ante cambios.
- Positivo: `encounter-wizard.constants.tsx:14-45` ya usa `next/dynamic` para secciones.

Recomendacion concreta:

- Mantener datos por seccion con reducer o store segmentado.
- Guardar flags `dirtySections` en vez de serializar todo en cada render.
- Calcular hashes/snapshots al guardar, cambiar de seccion o antes de salir.
- Diferir resumen clinico con `useDeferredValue` o actualizarlo solo cuando se abre el panel.
- Memoizar filas del rail por `sectionKey`, `status`, `dirty`, `hasErrors`.

Estado tras pasada 6:

- Parcialmente resuelto. `useEncounterWizardDerived.ts:151-210` usa `useDeferredValue` para el resumen generado y mapas precalculados para comparar estado de secciones.
- La UI state de rail/mobile evita repetir `JSON.stringify` por cada llamada a `getSectionUiState`.
- Pasada 18 introduce dirty flags por seccion en persistencia y elimina mapas de `JSON.stringify` de todas las secciones en `useEncounterWizardDerived`.
- Pendiente: calcular resumen solo bajo demanda/panel visible y medir con React Profiler.

Ejemplo orientativo:

```ts
type WizardState = {
  sections: Record<string, SectionData>;
  dirty: Record<string, boolean>;
};

function updateSection(key: string, data: SectionData) {
  dispatch({ type: 'section/change', key, data });
}

// La comparacion profunda ocurre al persistir, no por cada tecla.
```

Riesgos:

- La logica de autosave y recuperacion de borradores es sensible; conviene migrarla con tests.
- No perder advertencias de cambios sin guardar.

Como validar:

- React Profiler escribiendo en anamnesis/tratamiento: commits por tecla y duracion.
- Medir INP local con Performance panel.
- Tests de autosave, conflicto, cambio de seccion y cierre con cambios pendientes.

### 6. La ficha de paciente dispara demasiadas queries iniciales

Severidad: Media

Archivos y lineas:

- `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetailQueries.ts:25-69`
- `backend/src/patients/patients-clinical-read-model.ts:88-173`
- `frontend/src/components/PatientAlerts.tsx:47-52`
- `frontend/src/components/PatientConsents.tsx:45-51`

Impacto esperado:

- Apertura de ficha mas lenta en redes reales.
- Render progresivo fragmentado: varias tarjetas llegan en momentos diferentes.
- Mas carga backend por abrir un paciente.

Explicacion tecnica:

La vista de detalle pide paciente, timeline, historial operacional y resumen clinico en paralelo. Ademas, componentes hijos piden alertas y consentimientos. El resumen clinico ejecuta varias consultas y puede traer secciones de hasta 12 encuentros, o mas si se habilita historial completo de signos vitales.

Evidencia observada:

- `usePatientDetailQueries.ts:25-69` define cinco queries.
- `patients-clinical-read-model.ts:88-173` compone resumen con varios `findMany`/`count`.
- `PatientAlerts.tsx:50` pide `includeAcknowledged=true`.
- `PatientConsents.tsx:48` pide todos los consentimientos del paciente.

Recomendacion concreta:

- Priorizar above-the-fold: datos demograficos, alertas activas y resumen compacto.
- Diferir historial operacional, consentimientos revocados y alertas reconocidas hasta que el usuario abra la seccion.
- Crear un endpoint compacto para ficha inicial si reduce round trips sin crear payload excesivo.
- Mantener alertas activas como dato critico inmediato.

Riesgos:

- No esconder alertas clinicas activas por optimizacion.
- Cuidar que tabs/paneles muestren skeletons y estados de error claros.

Como validar:

- Medir tiempo de apertura de ficha medica hasta mostrar nombre, edad, alertas activas y ultima atencion.
- Contar requests iniciales antes/despues.
- Probar paciente con mucho historial y otro sin historial.

### 7. Alertas y consentimientos historicos escalan mal

Severidad: Media

Archivos y lineas:

- `backend/src/alerts/alerts.service.ts:65-86`
- `backend/src/alerts/alerts.service.helpers.ts:53-97`
- `frontend/src/components/PatientAlerts.tsx:47-70`
- `frontend/src/components/PatientAlerts.tsx:131-155`
- `frontend/src/components/PatientConsents.tsx:45-85`
- `frontend/src/components/PatientConsents.tsx:219-243`
- `backend/prisma/schema.prisma:555`

Impacto esperado:

- Pacientes con muchos eventos historicos cargan y renderizan demasiado.
- Sorting y filtrado en memoria aumentan con el tiempo.
- Mas payload de PHI historica en pantalla de lo necesario.

Explicacion tecnica:

`findByPatient` recupera alertas sin paginacion y luego ordena por prioridad en memoria. El frontend pide `includeAcknowledged=true`, filtra activas/reconocidas y renderiza el historial completo dentro de `details`. Los consentimientos tambien se recuperan completos y se separan en cliente.

Evidencia observada:

- `alerts.service.ts:65-86` no usa `take`/`skip`.
- `alerts.service.helpers.ts:53-61` ordena alertas en JS.
- `PatientAlerts.tsx:69-70` filtra en cliente.
- `PatientConsents.tsx:84-85` separa activos y revocados en cliente.
- `schema.prisma:555` solo tiene indice `@@index([patientId, acknowledgedAt])` para `ClinicalAlert`.

Recomendacion concreta:

- Endpoint por defecto: alertas activas + ultimas N reconocidas.
- Historial paginado: `GET /alerts/patient/:id?status=acknowledged&limit=20&cursor=...`.
- Consentimientos: activos inmediatos, revocados paginados o lazy.
- Agregar indices compuestos por paciente/estado/fecha.

Estado tras pasada 5:

- Parcialmente resuelto. `alerts.service.ts:65-110` mantiene alertas activas completas y limita reconocidas con `acknowledgedLimit`.
- `PatientAlerts.tsx:47-51` pide las ultimas 20 reconocidas.
- `consents.service.ts:134-175` mantiene activos completos y limita revocados con `revokedLimit`.
- `PatientConsents.tsx:45-49` pide los ultimos 20 revocados.
- `schema.prisma:540-541` y `20260429183000_add_consent_history_index` agregan indice para consentimientos historicos.
- Pasada 16 agrega acciones "Ver mas" para alertas reconocidas y consentimientos revocados, aumentando el limite incrementalmente desde la UI.
- Pendiente: reemplazar la heuristica `length >= limit` por `hasMore`/cursor cuando se necesite paginacion precisa.

Riesgos:

- El historial debe seguir auditable y accesible, solo no cargarlo completo por defecto.
- Cambiar ordenamiento requiere preservar prioridad clinica visible.

Como validar:

- Seed con 500 alertas y 200 consentimientos por paciente.
- Medir payload y tiempo de render de ficha.
- Verificar que alertas activas siguen apareciendo primero.

### 8. La verificacion completa de auditoria corre al montar la vista admin

Severidad: Alta

Archivos y lineas:

- `frontend/src/app/(dashboard)/admin/auditoria/AuditIntegrityCard.tsx`
- `backend/src/audit/audit.controller.ts:35-44`
- `backend/src/audit/audit.service.ts:178-229`
- `backend/prisma/schema.prisma:386-396`

Impacto esperado:

- La vista de auditoria puede bloquearse a medida que crece `audit_logs`.
- CPU/DB O(N) para una accion de navegacion.
- Riesgo operativo: revisar auditoria se vuelve lento justo cuando mas datos existen.

Explicacion tecnica:

El card pide `/audit/integrity/verify?full=true` al montar. En backend, `full=true` no aplica limite y `verifyIntegrityChain` recorre todos los logs ordenados, recalculando hashes.

Evidencia observada:

- `AuditIntegrityCard.tsx:17` usa `full=true`.
- `audit.controller.ts:39-41` convierte `full=true` en `limit: undefined`.
- `audit.service.ts:186-197` hace `findMany` de logs.
- `audit.service.ts:203-221` recorre y verifica hash encadenado.

Recomendacion concreta:

- Por defecto verificar ultimos N registros o mostrar ultimo resultado programado.
- Boton explicito "Verificar cadena completa" con confirmacion y estado de progreso.
- A mediano plazo, checkpoints de hash cada N logs para acelerar verificacion parcial.
- Mantener verificacion completa disponible para auditoria formal.

Estado tras pasadas 1 y 24:

- Resuelto el comportamiento de carga inicial: la UI consulta `GET /audit/integrity/latest` por defecto y no recorre `audit_logs` al montar.
- `AuditService.verifyChain` persiste el ultimo resultado en `audit_integrity_snapshots` con alcance y fecha de verificacion.
- La UI conserva acciones explicitas para verificacion reciente y completa, y actualiza el snapshot en cache al terminar.
- Pendiente de mediano plazo: checkpoints o job programado para acelerar verificaciones completas sobre historiales grandes.

Riesgos:

- No convertir una garantia de integridad en una verificacion cosmetica.
- Debe quedar claro en UI si se verifico muestra reciente o cadena completa.

Como validar:

- Crear 10k/100k audit logs de prueba.
- Medir tiempo de carga de `/admin/auditoria`.
- Medir tiempo de verificacion completa bajo accion explicita.

### 9. Faltan indices compuestos para los patrones reales de consulta

Severidad: Alta

Archivos y lineas:

- `backend/prisma/schema.prisma:118-156`
- `backend/prisma/schema.prisma:94`
- `backend/prisma/schema.prisma:445-448`
- `backend/prisma/schema.prisma:555`
- `backend/src/encounters/encounters-read-side.ts:22-50`
- `backend/src/encounters/encounters-dashboard-read-model.ts:44-125`
- `backend/src/patients/patients-list-read-model.ts:127-205`

Impacto esperado:

- Listados y dashboard se degradan linealmente con datos reales.
- SQLite necesitara scans o sorts evitables.
- La paginacion no alcanza si el filtro previo no usa indice adecuado.

Explicacion tecnica:

El modelo `Encounter` tiene indice por `medicoId`, pero muchas consultas combinan `medicoId`, `status`, `reviewStatus`, `patientId`, `createdAt` o `updatedAt`. `Patient` solo tiene indice por `archivedAt`, mientras listados ordenan y filtran por estado/completitud/fecha. `EncounterTask` tiene indices utiles, pero falta uno directo para `medicoId + status + dueDate`.

Evidencia observada:

- `schema.prisma:155` solo indexa `Encounter.medicoId`.
- `schema.prisma:94` solo indexa `Patient.archivedAt`.
- `encounters-read-side.ts:26-50` filtra por medico/status/reviewStatus y ordena `createdAt`.
- `encounters-dashboard-read-model.ts:44-125` cuenta y lista por medico, estado y fechas.
- `patients-list-read-model.ts:189-205` pagina pacientes ordenando por `createdAt`, `updatedAt` o `nombre`.

Recomendacion concreta:

Agregar indices compuestos guiados por `EXPLAIN QUERY PLAN`, por ejemplo:

```prisma
model Encounter {
  @@index([medicoId, status, createdAt])
  @@index([medicoId, reviewStatus, createdAt])
  @@index([patientId, medicoId, createdAt])
  @@index([updatedAt])
}

model Patient {
  @@index([createdById, archivedAt, createdAt])
  @@index([completenessStatus, archivedAt])
  @@index([updatedAt])
}

model EncounterTask {
  @@index([medicoId, status, dueDate])
}

model ClinicalAlert {
  @@index([patientId, acknowledgedAt, createdAt])
  @@index([encounterId, acknowledgedAt])
}
```

Estado tras pasada 2:

- Implementado a nivel de schema y migracion. Ver `schema.prisma:94-97`, `schema.prisma:158-162`, `schema.prisma:452-456` y `schema.prisma:563-565`.
- La migracion esta en `backend/prisma/migrations/20260429170000_add_performance_indexes/migration.sql:1-29`.
- Validado con `prisma validate` y `backend typecheck`.
- Pasada 4 aplico la migracion en la base local y confirmo con `EXPLAIN QUERY PLAN` que las consultas representativas usan los indices nuevos.
- Pendiente: repetir mediciones con dataset grande y p95 de endpoints.

Riesgos:

- Indices aceleran lectura pero encarecen escrituras y migraciones.
- En SQLite, demasiados indices tambien afectan tamano y writes; validar con datos representativos.

Como validar:

- `EXPLAIN QUERY PLAN` antes/despues para listados y dashboard.
- Benchmark de endpoints con dataset grande.
- Medir tiempo de migracion y tamano DB.

### 10. La busqueda global duplica logica y no cancela requests obsoletas

Severidad: Media

Archivos y lineas:

- `frontend/src/components/layout/useDashboardSearch.ts:25-64`
- `frontend/src/components/common/CommandPalette.tsx:76-128`
- `backend/src/patients/patients-list-read-model.ts:98-104`
- `backend/src/encounters/encounters-read-side.ts:37-43`

Impacto esperado:

- Resultados fuera de orden si una respuesta vieja llega despues de una nueva.
- Requests redundantes al tipear rapido.
- UX distinta entre header search y command palette.

Explicacion tecnica:

`useDashboardSearch` y `CommandPalette` implementan busqueda paralela similar contra pacientes y atenciones. Hay debounce, pero no `AbortController` ni guard de secuencia para descartar respuestas viejas.

Evidencia observada:

- `useDashboardSearch.ts:36-39` lanza requests paralelas.
- `useDashboardSearch.ts:59-64` debouncea pero no cancela HTTP anterior.
- `CommandPalette.tsx:76-128` repite flujo de busqueda.

Recomendacion concreta:

- Extraer hook compartido `useClinicalSearch`.
- Usar `AbortController`/`signal` con Axios o un contador `requestId`.
- Considerar endpoint backend unificado `/search?q=&types=patients,encounters` con payload minimo.
- Minimizar PHI devuelta en resultados globales.

Estado tras pasada 1:

- Parcialmente resuelto. `useDashboardSearch.ts:23-75` y `CommandPalette.tsx:29-140` abortan requests anteriores, pasan `signal` a Axios y descartan respuestas viejas por secuencia.
- Pasada 13 centraliza la normalizacion/fetch de resultados en `frontend/src/lib/clinical-search.ts`.
- Sigue pendiente, a mediano plazo, crear un endpoint `/search` con payload minimo y permisos centralizados.

Riesgos:

- Un endpoint global debe aplicar permisos por tipo de recurso.
- Evitar mostrar datos clinicos en resultados si no son necesarios.

Como validar:

- Simular red lenta y escribir rapido: los resultados deben corresponder al ultimo termino.
- Verificar numero de requests canceladas y no completadas.
- Tests de permisos por rol.

### 11. El header descarga todo el catalogo de condiciones solo para mostrar un conteo

Severidad: Baja-Media

Archivos y lineas:

- `frontend/src/components/layout/SmartHeaderBar.tsx:105-123`

Impacto esperado:

- Payload innecesario en rutas de catalogo.
- Latencia y memoria crecen si el catalogo aumenta.

Explicacion tecnica:

En ruta `/catalogos`, el header ejecuta `/conditions` y usa `catalogConditions?.length` para mostrar el total. Si el endpoint devuelve el catalogo completo, se descargan datos que el header no necesita.

Evidencia observada:

- `SmartHeaderBar.tsx:107-111` llama `api.get('/conditions')`.
- `SmartHeaderBar.tsx:123` usa solo `.length`.

Recomendacion concreta:

- Crear `/conditions/count` o devolver `{ total }` desde una query compartida de catalogo.
- Si la pagina ya carga condiciones, reutilizar la misma query key.

Estado tras pasada 1:

- Resuelto para el header. `SmartHeaderBar.tsx:103-110` usa `/conditions/count`.
- Backend expone `conditions.controller.ts:84-88` y `conditions.service.ts:65-72`.
- Pasada 14 optimiza el conteo de usuarios no admin con counts directos en vez de reconstruir todo el merge.

Riesgos:

- Bajo; cuidar que el conteo respete filtros si el header indica contexto filtrado.

Como validar:

- Comparar payload de `/conditions` vs `/conditions/count`.
- Confirmar que el header no dispara requests extra al entrar a catalogos.

### 12. Suscripciones amplias a Zustand causan renders extra

Severidad: Baja-Media

Archivos y lineas:

- `frontend/src/stores/auth-store.ts:1-128`
- `frontend/src/components/layout/DashboardLayout.tsx:56-64`
- `frontend/src/components/layout/SmartHeaderBar.tsx:38`
- `frontend/src/components/PatientAlerts.tsx:45`
- `frontend/src/components/PatientConsents.tsx:39`
- `frontend/src/app/(dashboard)/pacientes/page.tsx:67`

Impacto esperado:

- Componentes no relacionados se re-renderizan ante cambios del store.
- El shell puede hacer mas trabajo al refrescar sesion o permisos.

Explicacion tecnica:

Varios componentes llaman `useAuthStore()` y destructuran campos. En Zustand, esto suscribe al resultado completo del selector implicito; cualquier cambio relevante del store puede volver a renderizar consumidores amplios.

Evidencia observada:

- `DashboardLayout.tsx:56-64` extrae muchos campos/acciones.
- `SmartHeaderBar.tsx:38`, `PatientAlerts.tsx:45`, `PatientConsents.tsx:39` consumen store completo o selectors amplios.

Recomendacion concreta:

- Crear hooks selectivos: `useAuthUser`, `useAuthRole`, `useAuthActions`, `useEffectiveDoctorId`.
- Usar selectors atomicos y `shallow` cuando se necesiten varios campos.
- Evitar funciones derivadas pesadas dentro de renders frecuentes.

Estado tras pasada 9:

- Parcialmente resuelto. `SmartHeaderBar.tsx:40` se suscribe solo a `user` y deriva permisos en `SmartHeaderBar.tsx:130-132`.
- `page.tsx:13-16` y `atenciones/page.tsx:60-63` usan selector atomico de `user`.
- `PatientAlerts.tsx:46-47` y `PatientConsents.tsx:40-41` derivan `isMedico` desde `user`.
- Pasada 11 extiende el patron a `DashboardLayout`, catalogos, ajustes, pacientes, atenciones, auditoria y analitica clinica.
- Pendiente: medir render real con React Profiler y decidir si se deprecan las funciones derivadas historicas del store.

Ejemplo orientativo:

```ts
const user = useAuthStore((s) => s.user);
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const logout = useAuthStore((s) => s.logout);
```

Riesgos:

- Bajo, pero cambiar selectors puede romper tests si algun componente dependia de updates amplios.

Como validar:

- React Profiler al refrescar sesion y navegar.
- Contar renders del shell/header antes/despues.

### 13. Animaciones y transiciones pueden generar jank en vistas clinicas densas

Severidad: Baja-Media

Archivos y lineas:

- `frontend/src/app/globals.css:41-48`
- `frontend/src/app/globals.css:153-158`
- `frontend/src/app/globals.css:290`
- `frontend/src/app/globals.css:715-778`
- `frontend/src/app/globals.css:888-901`
- `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx:113-117`
- `frontend/src/app/(dashboard)/atenciones/[id]/EncounterSectionRail.tsx:97`

Impacto esperado:

- Transiciones de layout pueden bloquear el hilo principal en pantallas con muchos nodos.
- Shimmer/skeletons infinitos pueden sumar CPU en equipos modestos.
- Cambios de rail/grid en atenciones pueden sentirse bruscos.

Explicacion tecnica:

Hay `transition-all` en estilos globales y transiciones sobre `grid-template-columns`/anchos en el wizard. `will-change-transform` ayuda solo si lo animado es transform; si el cambio real es layout, el navegador recalcula layout.

Evidencia observada:

- `globals.css` contiene varias reglas `transition-all` y skeleton shimmer.
- `atenciones/[id]/page.tsx:113-117` anima columnas del grid.
- `EncounterSectionRail.tsx:97` declara `will-change-transform`.

Recomendacion concreta:

- Reemplazar `transition-all` por propiedades concretas (`color`, `background-color`, `box-shadow`, `opacity`, `transform`).
- Evitar animar grid/width en el workspace clinico; preferir estado instantaneo o transform/opacity.
- Mantener `prefers-reduced-motion` y aplicar tambien a shimmer.
- Usar `content-visibility: auto` en secciones largas debajo del fold cuando no rompa accesibilidad.

Estado tras pasada 10:

- Parcialmente resuelto. `globals.css` ya no contiene `transition-all`; los casos seguros pasaron a `transition-colors`.
- Pasada 12 elimina `transition-all` de todo `frontend/src`.
- Pendiente: revisar transiciones de grid/width del workspace clinico con Performance panel y Playwright visual.

Riesgos:

- Cambios visuales sutiles pueden alterar la percepcion de calidad; validar con captura y uso real.

Como validar:

- Performance panel: FPS y layout/recalculate style al colapsar rail.
- Probar en laptop modesta y viewport movil.
- Verificar `prefers-reduced-motion`.

### 14. Dependencias no usadas y falta de presupuesto de bundle

Severidad: Baja-Media

Archivos y lineas:

- `frontend/package.json:22`
- `frontend/package.json:28`
- `frontend/next.config.js:53-57`

Impacto esperado:

- Mayor superficie de mantenimiento y lockfile.
- Posible inclusion accidental futura de librerias pesadas.
- Sin presupuesto de bundle, las regresiones pasan desapercibidas.

Explicacion tecnica:

`@react-pdf/renderer` y `jwt-decode` figuran como dependencias frontend, pero no se observan imports reales en `frontend/src`. Sentry se activa por DSN y es valido, pero conviene monitorear su impacto. La salida de build actual no muestra una tabla clara de First Load JS por ruta, por lo que falta una metrica automatizada.

Evidencia observada:

- `frontend/package.json:22` declara `@react-pdf/renderer`.
- `frontend/package.json:28` declara `jwt-decode`.
- Busqueda estatica no encontro uso en `frontend/src`.
- `next.config.js:53-57` activa Sentry cuando hay DSN.

Recomendacion concreta:

- Eliminar dependencias no usadas tras confirmar con `npm ls` y tests.
- Agregar bundle analyzer bajo script opt-in.
- Definir presupuesto por rutas clinicas: login, pacientes, paciente detalle, atencion detalle.
- Revisar imports de iconos y mantener imports por subpaquete como ahora, evitando barrels grandes.

Estado tras pasada 3:

- Parcialmente resuelto. `frontend/package.json:20-34` ya no declara `@react-pdf/renderer` ni `jwt-decode`.
- `npm --prefix frontend uninstall @react-pdf/renderer jwt-decode` removio 57 paquetes transitivos y dejo `frontend/package-lock.json` actualizado.
- Validado con build y typecheck frontend.
- Pasada 8 agrega `build:analyze` y reportes en `frontend/.next/analyze`.
- Pasada 15 agrega presupuesto ejecutable para `/login`, `/pacientes`, `/atenciones` y `/atenciones/nueva`.
- Pendiente: revisar reportes del analyzer para top modulos y agregar rutas dinamicas cuando haya manifest/HTML medible.

Riesgos:

- Si alguna dependencia se usa en tooling no detectado, removerla puede romper scripts. Validar con build/test.

Como validar:

- `npm --prefix frontend run build`.
- Bundle analyzer antes/despues.
- Revisar delta de `package-lock.json`.

### 15. La escritura de auditoria serializa cada evento con lock SQLite

Severidad: Media

Archivos y lineas:

- `backend/src/audit/audit.service.ts:66-115`
- `backend/prisma/schema.prisma:366`

Impacto esperado:

- Bajo volumen: aceptable y positivo para integridad.
- Mayor concurrencia/autosave: puede ser cuello de botella de writes.

Explicacion tecnica:

Cada evento auditado corre en transaccion, ejecuta un lock pragmatico con `DELETE FROM audit_logs WHERE 1 = 0`, lee el ultimo hash y crea el nuevo registro encadenado. Esto conserva integridad de cadena, pero serializa writes auditados.

Evidencia observada:

- `audit.service.ts:66-72` envuelve en transaccion.
- `audit.service.ts:84-88` fuerza lock de escritura SQLite.
- `audit.service.ts:90-115` lee ultimo log y crea nuevo.

Recomendacion concreta:

- No eliminar esta proteccion.
- Medir primero: latencia p95 de mutaciones auditadas y tiempo de transaccion.
- Reducir eventos auditados redundantes si existieran, sin perder trazabilidad clinica.
- A largo plazo, si crece concurrencia, considerar DB server o mecanismo append-only mas robusto.

Riesgos:

- Cualquier cambio aqui puede comprometer trazabilidad medico-legal.
- La optimizacion debe preservar hash chain, orden y atomicidad.

Como validar:

- Load test de mutaciones auditadas concurrentes.
- Verificar integridad de cadena despues del test.
- Medir p50/p95/p99 de create/update clinicos.

---

## Auditoria por areas

### Frontend

Fortalezas:

- App Router organizado por rutas de dashboard.
- TanStack Query ya evita mucho estado servidor manual.
- Secciones del wizard de atencion usan `next/dynamic`, buena decision para dividir UI clinica pesada.

Riesgos principales:

- Shell privado bloqueado por auth cliente.
- Vistas clinicas grandes cercanas o superiores a 400 lineas.
- Queries iniciales numerosas y algunas duplicadas.
- Estado de wizard demasiado global.

### Animaciones y transiciones

La UI usa transiciones globales y shimmer. Son utiles para percepcion, pero en una EMR conviene favorecer estabilidad, lectura y baja latencia. Las animaciones de layout en el wizard deben reducirse porque coinciden con la zona de mayor densidad clinica.

### Estado global/local

Zustand esta bien para auth y preferencias, pero conviene usar selectors mas atomicos. TanStack Query esta configurado con `staleTime` general de 60s, correcto como base; el problema esta en keys inconsistentes y requests secundarias no diferidas.

### Formularios

El mayor riesgo esta en formularios clinicos del wizard: serializacion, snapshots y resumen derivado. En formularios de registro, hay persistencia por keystroke en `sessionStorage`; es menor, pero puede debounced para reducir ruido.

### Tablas/listas

Listados de pacientes y atenciones tienen paginacion, pero algunos historiales embebidos no. Si el volumen crece, hay que virtualizar o paginar historiales largos y evitar cargar recursos secundarios por defecto.

### Carga de datos

Hay oportunidades claras de separar datos criticos de secundarios:

- Ficha paciente: datos demograficos + alertas activas primero.
- Atencion: secciones editables + paciente minimo primero.
- Header: counters baratos o query compartida.
- Auditoria: resumen reciente primero, cadena completa bajo accion explicita.

### Backend/API

Los read models estan claros, pero algunos endpoints son demasiado amplios. La recomendacion no es multiplicar endpoints sin control, sino definir payloads por intencion de UI: editor, summary compacto, historial paginado, integridad reciente.

### Base de datos

SQLite es viable para escala pequena si se cuida. El siguiente salto de rendimiento esta en indices compuestos y FTS/proyecciones de busqueda, no en cambiar de base inmediatamente. Si el uso concurrente crece, revisar PostgreSQL seria un cambio estructural, no un quick win.

### Build/bundling

El build pasa. Falta presupuesto de bundle y analisis por ruta. Remover dependencias no usadas y medir First Load JS por rutas criticas reducira riesgo de regresiones.

### Dependencias

No se detecta abuso grave, pero `@react-pdf/renderer` y `jwt-decode` parecen no usados en frontend. `react-icons/fi` se importa de forma focalizada; aun asi, conviene medir su contribucion real con analyzer.

### Arquitectura general

La separacion dominio/backend es buena. La principal deuda de arquitectura frontend esta en componentes/vistas grandes y hooks que mezclan UI, persistencia, estado derivado y autosave. Refactorizar el wizard por secciones reducira riesgo y mejorara INP.

---

## Top 10 optimizaciones mas importantes

1. Desbloquear el primer paint del dashboard separando shell/skeleton de revalidacion `/auth/me`.
2. Unificar query key y hook para `/encounters/stats/dashboard`; considerar endpoint compacto para header.
3. Reemplazar `clinicalSearch` en memoria por proyeccion/FTS autorizada.
4. Dividir `/encounters/:id` en payload critico de editor y recursos secundarios lazy.
5. Reducir `JSON.stringify` y recalculos globales en el wizard de atenciones.
6. Agregar indices compuestos para `Encounter`, `Patient`, `EncounterTask` y `ClinicalAlert`.
7. Cambiar auditoria admin para no verificar cadena completa al montar.
8. Diferir historiales largos de alertas, consentimientos y operacional de paciente.
9. Cancelar requests de busqueda global y consolidar logica duplicada.
10. Agregar bundle analyzer y presupuesto por rutas clinicas.

## Quick wins aplicables en menos de 1 dia

- Usar una unica query key para dashboard stats. Estado: aplicado en pasada 1.
- Cambiar `SmartHeaderBar` para no pedir `/conditions` completo solo por count. Estado: aplicado en pasada 1.
- Remover dependencias frontend no usadas tras build/test. Estado: aplicado en pasada 3.
- Reemplazar `transition-all` mas visibles por propiedades concretas.
- Agregar `AbortController` o request sequence a busqueda global. Estado: aplicado parcialmente en pasada 1; falta unificar hook.
- Cambiar `AuditIntegrityCard` para no verificar cadena al montar y leer ultimo snapshot persistido. Estado: aplicado en pasadas 1 y 24.
- Debouncear escrituras de borrador no clinico en registro.
- Crear selectors atomicos para `useAuthStore` en header/layout/componentes frecuentes.

## Cambios de mediano plazo

- Endpoint compacto de apertura de ficha paciente.
- Endpoints secundarios lazy para adjuntos, consentimientos, baseline y auditoria de atencion.
- Refactor del wizard: estado por seccion, dirty flags y resumen diferido.
- Paginacion de alertas reconocidas y consentimientos revocados.
- Indices compuestos validados con `EXPLAIN QUERY PLAN`.
- Bundle budgets en CI y reporte de tamanos por ruta.

## Cambios estructurales de largo plazo

- FTS/proyeccion de busqueda clinica con permisos y backfill.
- Checkpoints de audit log para verificacion eficiente de cadena; estado persistido aplicado en pasada 24 y comando operativo en pasada 25.
- Migracion a PostgreSQL si la concurrencia o volumen superan los limites operativos de SQLite.
- Observabilidad real de frontend y backend: Web Vitals, spans por endpoint, slow queries y profiling de renders.
- Reorganizacion de vistas clinicas grandes en modulos por responsabilidad: presentacion, persistencia, validacion, derivaciones y autosave.

## Metricas recomendadas para monitorear

| Metrica | Objetivo inicial recomendado | Donde medir |
|---|---:|---|
| LCP | < 2.5 s en rutas privadas principales | Web Vitals/RUM |
| INP | < 200 ms en formularios clinicos | Web Vitals + React Profiler |
| CLS | < 0.1 | Web Vitals |
| TTFB | < 500 ms local/red interna; < 800 ms remoto | Server timings/API gateway |
| Carga de vista `/pacientes` | p95 < 1.5 s con 10k pacientes | RUM + synthetic |
| Busqueda de pacientes | p95 < 300 ms demografica; < 600 ms clinica optimizada | Logs endpoint |
| Apertura de ficha medica | p95 < 1.5 s hasta datos criticos | RUM mark custom |
| Apertura de atencion | p95 < 1.8 s hasta primer campo editable | RUM mark custom |
| FPS al colapsar rail/scroll | > 55 FPS en laptop media | Performance panel |
| Bundle por ruta critica | Presupuesto por ruta, revisar delta en PR | Bundle analyzer CI |
| Renders por vista critica | Reducir commits por keystroke en wizard | React Profiler |
| Payload `/encounters/:id` | Reducir bytes iniciales 40-70% | Network/RUM |
| Tiempo `/audit/integrity/verify` | Reciente < 300 ms; full asincrono/explicito | Backend metrics |

## Plan de validacion sugerido

1. Crear dataset de performance con pacientes, encuentros, secciones, alertas, consentimientos, tareas y audit logs en volumen.
2. Medir baseline: endpoints p50/p95, payloads, Web Vitals y renders.
3. Aplicar quick wins sin cambiar comportamiento clinico.
4. Repetir mediciones y documentar delta.
5. Abordar cambios medianos con tests E2E de permisos, ficha, atencion, firma, adjuntos y auditoria.
6. Para cambios de busqueda/auditoria, agregar pruebas especificas de aislamiento por medico y consistencia de resultados.

## Nota de seguridad clinica

Ninguna recomendacion requiere eliminar validaciones, auditoria, permisos ni controles de acceso. Las optimizaciones propuestas deben preservar:

- Backend como fuente de verdad de permisos.
- Cookies HttpOnly y flujo same-origin via `/api`.
- Trazabilidad de eventos clinicos.
- Integridad de cadena de auditoria.
- Disponibilidad inmediata de alertas activas.
- No exposicion innecesaria de PHI en resultados de busqueda, caches o payloads secundarios.
