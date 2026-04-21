# Auditoria tecnica y funcional de Anamneo

Fecha de auditoria: 2026-04-21

## 1. Resumen ejecutivo

Audite el repositorio completo con foco en una EMR chica de uso real para 1 a 5 usuarios: arquitectura, auth/permisos, modelo de datos, backend NestJS, frontend Next.js, Prisma/SQLite, scripts operativos, build, tests, lint, release y riesgos de privacidad.

Estado general: bueno a nivel de backend y sorprendentemente maduro para el tamano del proyecto. Hay varias decisiones bien resueltas para una app chica: permisos por rol y medico, cookies HttpOnly same-origin, auditoria, restore drill de backups SQLite, firma/inmutabilidad de atenciones, validaciones de secciones y una cobertura backend fuerte.

Riesgo global: medio-alto hoy. No por falta de arquitectura enterprise, sino por 2 riesgos concretos que si pegan directo en produccion: el release puede empaquetar datos clinicos reales y la cola offline puede descartar cambios clinicos locales cuando hay conflicto `409`.

Conclusion corta: Anamneo esta cerca de estar lista para una produccion chica, pero hoy todavia no la pondria en uso real sin una ronda corta de correcciones sobre release, conflictos offline, persistencia local de PHI y limpieza de hooks/lint en frontend.

## Estado tras implementacion

### Pasada 1 completada

Se implementaron fixes sobre los hallazgos criticos y altos priorizados en esta auditoria:

- **Corregido**: `scripts/release.sh` ya no empaqueta `runtime/data/` ni `runtime/uploads/`. Tambien se actualizo [docs/deployment-and-release.md](/home/allopze/dev/Anamneo/docs/deployment-and-release.md) y `scripts/deploy.sh` ahora crea `runtime/data` y `runtime/uploads` antes del deploy.
- **Corregido**: la sincronizacion offline ahora preserva una copia recuperable cuando un guardado en cola entra en conflicto `409`, reutilizando la misma logica de conflicto recuperable del flujo interactivo.
- **Mitigado**: se agrego purge de estado clinico local al `logout` y TTL de 24 horas para la cola offline. Esto baja de forma importante el riesgo de PHI persistida indefinidamente en el navegador.
- **Corregido**: se resolvieron los errores duros de hooks/memoizacion en `dashboard`, `atenciones`, `useEncounterSectionSaveFlow` y `useFichaClinica`.

### Validacion despues de la pasada 1

- `npm --prefix frontend run test`: OK, `58 suites / 278 tests`
- `npm --prefix frontend run typecheck`: OK
- `npm --prefix frontend run lint`: sin errores; queda `1 warning` por uso de `<img>` en `AttachmentPreviewModal.tsx`
- `npm run release`: OK; el zip generado ya no incluye `runtime/data/` ni `runtime/uploads/`

### Pendientes relevantes despues de la pasada 1

- Sigue pendiente limpiar `backend lint:check` y su deuda menor de `unused vars`.
- `frontend test:e2e` sigue sin quedar validado en esta auditoria por el conflicto operativo del puerto `5555`.
- Sigue siendo necesaria una decision operativa real sobre cifrado del host y luego marcar `ENCRYPTION_AT_REST_CONFIRMED=true`.
- El riesgo de PHI local bajo cierre abrupto de navegador baja mucho con el TTL, pero un modo explicito de "equipo compartido" seguiria siendo recomendable.

### Pasada 2 completada

Se implementaron fixes sugeridos adicionales para cerrar deuda de calidad y hacer mas repetible la validacion local:

- **Corregido**: `backend lint:check` ya no falla por imports, tipos o argumentos muertos. Se limpiaron los 10 errores reales reportados por ESLint.
- **Corregido**: `AttachmentPreviewModal.tsx` dejo de usar `<img>` y ahora usa `next/image` con `unoptimized` para previews locales por `blob:`. Esto mantiene la UX del preview y deja `frontend lint` limpio.
- **Corregido**: `frontend/playwright.config.ts` ahora permite puertos configurables via `PLAYWRIGHT_FRONTEND_PORT` y `PLAYWRIGHT_BACKEND_PORT`, y soporte opt-in para `PLAYWRIGHT_REUSE_EXISTING=true`.
- **Corregido**: el spec `encounter-draft-recovery.spec.ts` ya no queda atado al puerto `5555`; toma `baseURL` desde la propia configuracion de Playwright.
- **Actualizado**: [docs/testing.md](/home/allopze/dev/Anamneo/docs/testing.md) documenta la estrategia nueva de puertos y reutilizacion opcional de servidores.

### Validacion despues de la pasada 2

- `npm --prefix backend run lint:check`: OK
- `npm --prefix backend run typecheck`: OK
- `npm --prefix frontend run lint`: OK, sin errores ni warnings
- `npm --prefix frontend run typecheck`: OK
- `npm --prefix frontend run test`: OK, `58 suites / 278 tests`
- `PLAYWRIGHT_FRONTEND_PORT=5565 PLAYWRIGHT_BACKEND_PORT=5688 npm --prefix frontend run test:e2e:smoke`: OK, `2 tests`

### Validaciones ejecutadas

- `npm install`: OK
- `npm audit --omit=dev`: OK, `0 vulnerabilities`
- `npm run build`: OK
- `npm --prefix backend run typecheck`: OK
- `npm --prefix frontend run typecheck`: OK
- `npm --prefix backend run test`: OK, `52 suites / 284 tests`
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`: OK, `208 tests`
- `npm --prefix frontend run test`: OK en rerun, `57 suites / 275 tests`
- `npm --prefix frontend run lint`: FALLA, `5 errors / 4 warnings`
- `npm --prefix backend run lint:check`: FALLA, `10 errors`
- `npm run release`: OK; confirma que el zip incluye `runtime/data/` y `runtime/uploads/`
- `npm --prefix frontend run test:e2e`: no concluyente; Playwright aborta porque `http://localhost:5555` ya estaba ocupado por un `next dev` externo al flujo de auditoria

## 2. Veredicto de produccion

**No lista para produccion** hoy, incluso usando el criterio correcto para una app pequena de 1 a 5 usuarios.

Justificacion concreta:

- Hay un riesgo critico de privacidad/operacion: el release empaqueta `runtime/data/` y `runtime/uploads/`, por lo que un deploy rutinario podria arrastrar base, backups o adjuntos reales.
- Hay un riesgo alto de integridad clinica: la sincronizacion offline elimina guardados en conflicto `409` sin conservar una copia recuperable del cambio local.
- El frontend no esta limpio a nivel hooks/lint: hay violaciones reales de `rules-of-hooks` y de React Compiler en pantallas centrales.
- El cliente deja PHI en `localStorage` e `IndexedDB` mas alla de la sesion sin una politica suficiente de purge para equipos compartidos.

Si se corrigen esos puntos y se valida el checklist minimo de despliegue, el proyecto si podria quedar razonablemente apto para un consultorio chico real.

## 3. Hallazgos criticos y altos

| Severidad | Titulo | Archivos afectados | Descripcion | Impacto | Recomendacion | Esfuerzo |
|---|---|---|---|---|---|---|
| Critico | El release puede incluir PHI real | `scripts/release.sh`, `docs/deployment-and-release.md` | El zip de release incluye `runtime/data/` y `runtime/uploads/`. Los excludes no cubren de forma segura el contenido real de esas rutas. La documentacion ademas afirma que se excluyen backups y uploads locales, pero el script no garantiza eso para `runtime/`. | Riesgo directo de fuga de historias clinicas, backups y adjuntos en cada deploy o handoff de soporte. | Excluir por completo `runtime/data/**` y `runtime/uploads/**` del zip, o incluir solo directorios vacios con `.gitkeep`/placeholders. Alinear script y docs. | Bajo |
| Alto | La cola offline descarta cambios clinicos cuando hay conflicto `409` | `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts` | En replay offline, si el backend responde `409`, el guardado se elimina de IndexedDB y solo se muestra un toast. En cambio, el flujo online si guarda una copia recuperable del conflicto. | Posible perdida silenciosa de notas clinicas cargadas offline, justo en un flujo critico de atencion. | Reutilizar la misma logica de `writeEncounterSectionConflict` del flujo directo, mostrar conflicto recuperable y no descartar el payload local hasta que el usuario lo resuelva. | Medio |
| Alto | PHI persistida en navegador sin purge suficiente | `frontend/src/lib/encounter-draft.ts`, `frontend/src/lib/offline-queue.ts`, `frontend/src/stores/auth-store.ts`, `frontend/src/lib/api.ts` | Borradores, copias de conflicto y cola offline quedan en `localStorage`/`IndexedDB`. Los drafts tienen TTL de 24h, pero la cola offline no; tampoco vi purge global al logout. | En equipo compartido, perdida/robo de notebook o perfiles de navegador reciclados, quedan datos clinicos accesibles localmente. | Limpiar drafts/conflictos/cola al logout, agregar TTL o purge al store offline, y ofrecer un modo "equipo compartido" para desactivar persistencia local. | Medio |
| Alto | Hay errores reales de hooks/memoizacion en frontend | `frontend/src/app/(dashboard)/atenciones/page.tsx`, `frontend/src/app/(dashboard)/page.tsx`, `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow.ts`, `frontend/src/app/(dashboard)/atenciones/[id]/ficha/useFichaClinica.ts` | `eslint` detecta `rules-of-hooks` y errores de React Compiler. Hay hooks despues de early returns por rol (`isOperationalAdmin`), y `saveSectionMutation` se usa antes de declararse dentro de un callback. | Riesgo de comportamiento inconsistente en hidratacion/cambio de rol, mas deuda tecnica en flujos clinicos clave. Tambien deja el frontend fuera de un baseline sano para cambios futuros. | Reordenar hooks para que siempre se ejecuten en el mismo orden, eliminar memoizaciones fragiles y dejar `frontend lint` en verde antes de cerrar produccion. | Medio |

## 4. Bugs e inconsistencias funcionales

- Hay una inconsistencia clara entre conflicto online y conflicto offline. Online: se preserva copia recuperable. Offline replay: se descarta y solo se notifica por toast. Eso rompe la expectativa del usuario y puede afectar una consulta real.
- Observe inestabilidad inicial en la suite `frontend` sobre `atencion-cierre`, aunque luego paso completa al rerun. No lo trato como bug confirmado del flujo, pero si como senal de pruebas poco deterministicas en un circuito sensible.
- `frontend/src/app/(dashboard)/atenciones/page.tsx` y `frontend/src/app/(dashboard)/page.tsx` mezclan logica por rol con hooks en orden no estable. Si el estado de auth/hidratacion cambia durante la vida del componente, el riesgo de desorden de hooks es real.
- `frontend test:e2e` es fragil operativamente: falla apenas el puerto `5555` ya esta ocupado porque `playwright.config.ts` usa `reuseExistingServer: false` y puertos fijos. Para una app chica esto no rompe produccion, pero si dificulta validar el flujo completo antes de deploy.
- `useFichaClinica.ts` tiene memoizacion manual que React Compiler no puede preservar. No es un bug clinico confirmado hoy, pero si un punto de fragilidad en la ficha, PDF/print y documentos.

## 5. Seguridad y privacidad

### Lo que esta bien

- `backend/src/main.ts` hace chequeos de arranque sanos para una app chica: exige secretos no placeholder, `BOOTSTRAP_TOKEN` en produccion, diferencia access/refresh secret y advierte sobre cifrado en reposo.
- El frontend mantiene trafico browser same-origin por `/api`, lo cual encaja bien con cookies `HttpOnly` y refresh silencioso.
- El backend aplica permisos por rol y por medico de forma bastante consistente. No encontre un fallo evidente de autorizacion transversal en lo que ejecute y lei.
- `backend/src/attachments/attachments.service.ts` valida firma/binario del archivo subido y no confia solo en el MIME declarado. Muy buena decision para este contexto.
- Hay auditoria razonable, hashes de integridad y bloqueo de edicion para atenciones firmadas/completadas.
- El esquema operativo SQLite esta bien pensado para una app chica: backup, monitor, restore drill y checklist de deploy.

### Riesgos relevantes

- El release hoy es el mayor riesgo de privacidad.
- El navegador persiste PHI localmente mas de lo deseable para un entorno clinico.
- El cifrado en reposo de adjuntos, DB y backups depende del host. El backend solo advierte si `ENCRYPTION_AT_REST_CONFIRMED` no esta en `true`; no lo fuerza.
- `backend/.env.example` sigue mostrando placeholders debiles (`your-secret-key-change-in-production`), aunque el runtime de produccion los rechaza. Es un riesgo bajo, pero conviene alinearlo con el `.env.example` raiz para no inducir malas copias manuales.

### Evaluacion pragmatica

Para una EMR pequena no hace falta sobredisenar. Pero si hace falta:

- no empaquetar datos reales en releases,
- no perder cambios clinicos locales,
- no dejar PHI cacheada sin control en equipos compartidos,
- y desplegar sobre storage cifrado o volumen equivalente.

## 6. Modelo de datos e integridad clinica

### Fortalezas

- `Patient.completenessStatus` y `registrationMode` son utiles y proporcionados al problema real de "registro rapido vs verificado".
- La seccion `IDENTIFICACION` funciona como snapshot readonly del paciente durante la atencion. Eso protege consistencia medico-legal.
- Las atenciones firmadas/completadas quedan inmutables.
- Existe control de concurrencia optimista por `baseUpdatedAt` en guardado de secciones.
- El backend sincroniza estructuras clinicas derivadas de tratamiento/diagnostico, lo cual reduce desalineaciones.

### Riesgos y faltantes

- `EncounterSection.data` y varias listas auxiliares viven como JSON serializado en `String`. Para SQLite y una app chica es aceptable, pero sube la fragilidad del contrato FE/BE y hace mas facil que se "rompan en silencio" cambios de forma.
- Muchos estados siguen siendo `String` en schema y no enums de base. Es pragmatico para SQLite, pero depende mucho de tests y constantes compartidas para no degradarse.
- No encontre campos de contacto del paciente en el modelo principal (`telefono`, `email`, `contacto de emergencia`). Para una EMR chica real esto no es lujo: aporta continuidad de cuidados, seguimiento y trazabilidad minima.
- El mayor problema de integridad clinica sigue siendo el replay offline con descarte en conflicto.

## 7. Mantenibilidad y deuda tecnica

- La documentacion general esta por encima del promedio de proyectos chicos. Eso suma mucho.
- Build, typecheck y tests principales corren bien. Muy buena base.
- Lint no esta verde ni en backend ni en frontend. En backend hoy son errores menores de limpieza (`unused vars`), pero en frontend ya aparecen errores estructurales de hooks.
- Hay archivos que exceden la guia del propio repo (`<=300` ideal, `500` duro):
  - `backend/src/analytics/clinical-analytics.helpers.ts`: 1089 lineas
  - `backend/src/analytics/clinical-analytics.read-model.ts`: 684
  - `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaContentBlocks.tsx`: 598
  - `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx`: 502
- Hay bastante uso de `any` y contratos JSON flexibles en capas clinicas/presentacion/PDF. No es un incendio hoy, pero encarece cada cambio.
- `shadcn` no esta inicializado; la UI usa un sistema custom. No es un problema en si, pero sube la responsabilidad de mantener consistencia y accesibilidad manualmente.

## 8. Funcionalidades sugeridas alineadas con Anamneo

### Imprescindibles

- Flujo de resolucion/merge de pacientes duplicados
  - Ya existe deteccion de posibles duplicados. Falta la accion realmente util para el dia a dia: consolidarlos sin perder historia.
- Recuperacion guiada de conflictos offline
  - No alcanza con un toast. Se necesita ver "tu version vs servidor" y restaurar lo local si corresponde.
- Modo de privacidad para equipo compartido
  - Toggle simple para limpiar drafts/cola al logout, acortar TTL o directamente desactivar persistencia local de PHI.

### Muy utiles

- Campos de contacto del paciente
  - Telefono principal, email y contacto de emergencia son datos de alto valor practico en consultorio chico.
- Estado operativo de backups visible
  - Una tarjeta simple en ajustes/admin con ultimo backup, ultimo restore drill y alerta si esta vencido aporta mucho mas que otra capa de infraestructura.

### Opcionales

- Export unico por paciente
  - Un paquete simple con PDF longitudinal, adjuntos y registro de consentimientos facilita derivaciones o respaldo manual.

## 9. Quick wins

- Excluir `runtime/data/**` y `runtime/uploads/**` del release hoy mismo.
- En conflicto `409` del replay offline, guardar copia recuperable y no borrar el payload local automaticamente.
- Limpiar `localStorage`/`IndexedDB` clinico al logout y agregar TTL a la cola offline.
- Corregir los `rules-of-hooks` de `dashboard` y `atenciones`, y reordenar `useEncounterSectionSaveFlow`.
- Dejar `frontend lint` y `backend lint:check` en verde antes de seguir agregando features.
- Unificar `.env.example` raiz y `backend/.env.example`.

## 10. Checklist minimo antes de produccion

- Corregir el release para que no empaquete datos reales.
- Corregir el flujo de conflicto offline y probarlo manualmente.
- Limpiar/purgar persistencia local de PHI en logout y definir politica para equipos compartidos.
- Dejar build, typecheck, tests y lint en verde.
- Verificar deploy sobre storage cifrado y luego fijar `ENCRYPTION_AT_REST_CONFIRMED=true`.
- Ejecutar un smoke real con login, alta de paciente, apertura de atencion, guardado, cierre y export PDF en un entorno similar al definitivo.

## 11. Supuestos y limitaciones

- No inspeccione datos clinicos reales ni nombres de archivos sensibles. El `runtime/` del workspace estaba vacio durante la auditoria.
- El riesgo del release esta comprobado por lectura del script y por ejecucion de `npm run release`, no por una fuga real observada.
- `frontend test:e2e` no fue concluyente porque el puerto `5555` ya estaba ocupado por un `next dev` ajeno al flujo de auditoria.
- La suite frontend fallo una vez en corrida completa y luego paso al rerun; lo trate como evidencia de inestabilidad, no como bug funcional deterministico ya probado.
- No tuve un servidor de produccion ni configuracion real de disco/volumen para validar cifrado en reposo del host.

## Nota final

La sensacion general del codigo no es la de un prototipo improvisado. Hay bastante criterio clinico y operativo bien aplicado para un proyecto pequeno. Precisamente por eso vale la pena cerrar bien los pocos puntos que hoy si mueven el riesgo real. No hace falta redisenar Anamneo; hace falta una ronda enfocada de endurecimiento.
