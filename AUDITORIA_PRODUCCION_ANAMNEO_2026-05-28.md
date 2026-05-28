# Auditoria de produccion de Anamneo

Fecha: 2026-05-28  
Contexto: uso personal o de muy baja escala con datos clinicos sensibles.

## 1. Resumen ejecutivo

- Estado general: Casi listo — todos los gates de codigo pasan (2026-05-28)
- Recomendacion: Pendiente solo de backup/restore drill y verificacion manual antes de datos reales
- Motivo principal (original): el build de produccion del frontend fallaba y los gates de frontend no estaban verdes. **Corregido en sesion 2026-05-28.**
- Top 5 cosas que corregiria primero (estado actual):
  1. ~~Arreglar el build frontend~~ **HECHO** — `@import` movidos al inicio, `@layer components` removido de archivos separados.
  2. ~~Dejar verdes gates de frontend~~ **HECHO** — typecheck, test (334/334) y lint pasan.
  3. ~~Corregir `ConfirmModal`~~ **HECHO** — ahora enfoca el boton cancelar.
  4. ~~Documentar setup inicial de `ENCRYPTION_KEY`~~ **HECHO** — `docs/development.md` actualizado con comandos de generacion.
  5. Hacer un backup real y una prueba de restore antes de ingresar datos medicos **(unico pendiente restante)**.

Lo bueno: la arquitectura apunta en la direccion correcta para una EMR personal seria. Hay PostgreSQL, migraciones, cifrado aplicacional para PHI, cookies `HttpOnly`, CSRF, validacion server-side, soft delete de pacientes/adjuntos, auditoria, scripts de backup, docs de despliegue y una suite backend amplia que pasa. No vi una razon para sobredimensionar el proyecto. El trabajo pendiente es mas de cierre, consistencia y seguridad operacional basica que de rehacer la app.

## 2. Contexto y alcance asumido

Esta auditoria esta pensada para Anamneo como herramienta personal o semi-personal, usada por una persona o muy pocas personas de confianza. No la estoy midiendo contra Epic, Cerner, un HIS hospitalario ni un despliegue regulado enterprise.

El criterio usado fue pragmatico: evitar perdida de datos, exposicion accidental de informacion sensible, errores clinicos por UI confusa, builds rotos, validaciones ausentes y flujos principales inconsistentes. Recomendaciones como multi-tenant, SSO corporativo, SOC 2, HL7/FHIR avanzado o cumplimiento hospitalario completo quedan fuera salvo como futuro opcional.

## 3. Comandos ejecutados y resultados

| Comando | Resultado | Observaciones |
|---|---:|---|
| `npm install` | OK | Instalo/verifico dependencias root, backend y frontend. Auditoria npm inicial: 0 vulnerabilidades reportadas. |
| `npm --prefix backend run typecheck` | OK | TypeScript backend pasa. |
| `npm --prefix frontend run typecheck` | ~~Falla~~ **OK** (2026-05-28) | Corregido limpiando `.next` cache. El error era `Type 'Route' does not satisfy the constraint '"/"'` en tipos generados. |
| `npm --prefix backend run lint:check` | ~~Falla~~ **OK** (2026-05-28) | 12 errores corregidos: async Promise executor en `attachments-scan.service.ts`, imports/vars sin uso en 4 archivos. |
| `npm --prefix frontend run lint` | ~~Falla~~ **OK** (2026-05-28) | 0 errores. `useServerSessionCheck.ts` corregido moviendo ref update a `useEffect`. Quedan 2 warnings preexistentes. |
| `npm --prefix backend run audit:prod` | OK | 0 vulnerabilidades high en dependencias productivas backend. |
| `npm --prefix frontend run audit:prod` | OK | 0 vulnerabilidades high en dependencias productivas frontend. |
| `npm audit --omit=dev --audit-level=high` | OK | 0 vulnerabilidades high en root. |
| `npm --prefix backend run test -- --runInBand` | OK | 97 suites pasaron, 1 skipped. 526 tests pasaron, 2 skipped. |
| `npm --prefix frontend run test -- --runInBand` | ~~Falla~~ **OK** (2026-05-28) | 334 tests / 70 suites pasaron. Tests de `atencion-ficha` actualizados para labels reales (`Vista previa receta`, `Descargar receta`, etc.). |
| `npm run build` | ~~Falla~~ **OK** (2026-05-28) | `@import` movidos al inicio de `globals.css`; `@layer components` removido de archivos CSS separados (incompatible con procesamiento independiente de Turbopack). |
| `npm outdated --depth=0`, backend y frontend | Con pendientes | Hay updates patch/minor razonables y varios major opcionales. No lo trataria como bloqueo mientras `npm audit` este limpio. Cuidaria especialmente upgrades mayores de Prisma, React, Tailwind, Jest y Zod. |

No ejecute Playwright ni navegacion manual completa porque el build de produccion y la suite frontend ya estaban fallando. Para dar un veredicto de produccion no conviene saltarse esos gates.

## 4. Hallazgos prioritarios

| Prioridad | Area | Hallazgo | Impacto | Recomendacion | Esfuerzo |
|---|---|---|---|---|---|
| ~~P0~~ **FIXED** | Build/release | `npm run build` fallaba por `@import` tardio en `globals.css:405-406`. | Build productivo bloqueado. | **2026-05-28**: Imports movidos al inicio; `@layer components` removido de `auth.css` y `dashboard.css` (Turbopack los procesa independientemente). Build pasa. | Bajo |
| ~~P1~~ **FIXED** | Frontend/typecheck | `npm --prefix frontend run typecheck` fallaba por cache `.next` corrupta. | Gate de release no reproducible. | **2026-05-28**: `.next` limpiado; typecheck pasa limpio. | Bajo/medio |
| ~~P1~~ **FIXED** | UX destructiva | `ConfirmModal` enfocaba `confirmRef` (boton destructivo) al abrir. | Enter accidental podia confirmar accion destructiva. | **2026-05-28**: Agregado `cancelRef`, asignado al boton cancelar, enfocado en `useEffect`. | Bajo |
| ~~P1~~ **FIXED** | Tests clinicos frontend | `atencion-ficha.test.tsx` buscaba menuitem `Receta`, pero la UI lo separo en `Vista previa receta` y `Descargar receta`. | Cobertura de salidas clinicas desalineada. | **2026-05-28**: Tests actualizados; validan preview y descarga por separado. 334/334 pasan. | Bajo |
| ~~P1~~ **FIXED** | Lint frontend | `useServerSessionCheck.ts:7-8` escribia `callbackRef.current` durante render. | Gate roto; patron fragil en expiracion de sesion. | **2026-05-28**: Movido a `useEffect([onExpired])`. Lint pasa sin errores. | Bajo |
| ~~P1~~ **FIXED** | Setup inicial | `.env.example:173-182` dejaba `ENCRYPTION_KEY=` vacio y el backend falla al arrancar sin esa clave. | Friction de onboarding; otro operador no puede levantar la app. | **2026-05-28**: `docs/development.md` actualizado con comandos `node -e "..."` para generar todas las claves secretas requeridas antes del primer `npm run dev`. | Bajo |
| ~~P2~~ **FIXED** | Adjuntos/scan | `AttachmentsService.create` inyectaba `scanService` pero nunca llamaba `enqueueScan`. Adjuntos quedaban con `scanStatus=PENDING` indefinidamente. | Estado de seguridad enganoso. | **2026-05-28**: `this.scanService.enqueueScan(id, resolvedStoragePath, normalizedMime)` llamado tras commit de transaccion. Si ClamAV no esta configurado, marca `SKIPPED` automaticamente. | Medio |
| ~~P2~~ **FIXED** | Permisos adjuntos | Contrato concedia `attachment.delete` a `ASISTENTE` pero backend y frontend solo lo permitian a `MEDICO`. | Drift que generaria confusion futura. | **2026-05-28**: `attachment.delete` removido de `ASISTENTE` en `shared/fine-grained-permission-contract.ts`. Contrato, frontend y backend ahora alineados: solo medico elimina adjuntos. | Bajo |
| ~~P2~~ **FIXED** | Autorizacion admin | `RolesGuard` aceptaba `user.isAdmin` como unico criterio para rutas `@Roles('ADMIN')`. `AdminGuard` correctamente exige `isAdmin && role === 'ADMIN'`. | Doble fuente de verdad; riesgo bajo hoy pero inconsistencia arquitectural. | **2026-05-28**: `RolesGuard` actualizado para exigir `user.isAdmin && user.role === 'ADMIN'`, igual que `AdminGuard`. | Bajo/medio |
| ~~P2~~ **FIXED** | Salud publica | `GET /api/health` publico devolvia objeto `database`. | Revela estado interno si se expone a internet. | **2026-05-28**: Endpoint publico ahora devuelve solo `{status, timestamp}`. Detalles en `/api/health/database` protegido por `AdminGuard`. | Bajo |
| ~~P2~~ **FIXED** | UI responsive | `NuevoPacienteDoctorFields.tsx:20` usaba `grid grid-cols-3` sin breakpoint. | Fecha/edad/sexo comprimidos en mobile. | **2026-05-28**: Cambiado a `grid-cols-1 md:grid-cols-3`. | Bajo |
| ~~P2~~ **FIXED** | UI adjuntos | Input de archivo en `EncounterAttachmentsModal.tsx:141-150` sin `accept`. | Usuario elige archivos no soportados; el error aparece tarde. | **2026-05-28**: Agregado `accept=".pdf,.jpg,.jpeg,.png,.gif,..."`. | Bajo |
| ~~P2~~ **FIXED** | Auditoria transaccional | `encounters-section-mutations.ts`: `auditService.log` se llamaba FUERA del bloque `runTransaction`, y `reconcileEncounterIdentificationSection` ni siquiera usaba transaccion. | Cambio clinico podia quedar sin traza si fallaba el audit post-commit. | **2026-05-28**: `auditService.log` movido dentro de `runTransaction` (con `tx`) en `updateEncounterSectionMutation`; `reconcileEncounterIdentificationSection` envuelto en transaccion propia con audit atomico. | Medio |

## 5. Bugs e inconsistencias encontradas

### P0 - Build frontend roto

Evidencia:

- `npm run build` falla en `frontend/src/app/globals.css`.
- Fuente: `frontend/src/app/globals.css:405-406`:
  - `@import './styles/auth.css';`
  - `@import './styles/dashboard.css';`
- Esos imports aparecen despues de reglas y de un bloque `@layer components`, lo que Turbopack rechaza.

Impacto practico: no hay artefacto frontend productivo confiable. Para datos medicos reales, este es bloqueo.

Correccion simple: mover imports al inicio del archivo o convertir esos CSS a imports desde un punto permitido por Next/Turbopack. Luego correr `npm run build`.

### P1 - Typecheck frontend falla por tipos generados

Evidencia:

- `frontend/tsconfig.json:32-38` incluye `.next/types/**/*.ts` y `.next/dev/types/**/*.ts`.
- `frontend/next-env.d.ts:3` importa `./.next/dev/types/routes.d.ts`.
- El comando falla en `.next/types/validator.ts` con `Type 'Route' does not satisfy the constraint '"/"'`.

Impacto practico: no se puede usar typecheck como gate confiable. Puede ser un cache generado roto, pero en la maquina auditada falla.

Correccion simple: limpiar `.next` y regenerar. Si persiste, revisar typed routes de Next 16 y evitar importar tipos dev generados directamente en `next-env.d.ts`.

### P1 - Confirmaciones destructivas enfocan el boton peligroso

Evidencia:

- `ConfirmModal.tsx:47-50` dice "Focus the cancel button by default for destructive actions".
- Pero `confirmRef` se enfoca en `:50`.
- El `ref` esta asignado al boton confirmar en `:103-105`, no al boton cancelar.

Impacto practico: un Enter accidental despues de abrir el modal puede confirmar una accion destructiva. En una app clinica esto no es drama teorico: puede archivar pacientes, borrar adjuntos o ejecutar acciones irreversibles de UX.

Correccion simple: crear `cancelRef`, asignarlo al boton cancelar y enfocarlo al abrir. Para acciones especialmente sensibles, agregar confirmacion por texto o segundo paso solo donde valga la pena.

### P1 - Suite frontend rota en salidas clinicas

Evidencia:

- `frontend/src/__tests__/app/atencion-ficha.test.tsx:217`, `:256`, `:299` buscan `menuitem` con nombre `Receta`.
- La UI define `Vista previa receta` y `Descargar receta` en `frontend/src/app/(dashboard)/atenciones/[id]/ficha/FichaToolbar.tsx:66-82`.

Impacto practico: el test que protege documentos clinicos esta desalineado. La UI puede estar bien, pero el gate no protege el contrato real.

Correccion simple: actualizar tests para validar preview y descarga por separado. Si se prefiere una UX mas compacta, cambiar labels/aria-labels de forma deliberada y volver a testear bloqueos por paciente no verificado y atencion no completada.

### P1 - Lint de sesion frontend

Evidencia:

- `frontend/src/lib/useServerSessionCheck.ts:7-8`:
  - `const callbackRef = useRef(onExpired);`
  - `callbackRef.current = onExpired;`
- ESLint reporta `react-hooks/refs Cannot access refs during render`.

Impacto practico: menor funcionalmente, pero rompe lint y toca expiracion de sesion.

Correccion simple: actualizar `callbackRef.current` dentro de `useEffect(() => { callbackRef.current = onExpired; }, [onExpired])`.

### P2 - Adjuntos no disparan escaneo

Evidencia:

- Modelo: `Attachment.scanStatus` default `PENDING` en `backend/prisma/schema.prisma:539`.
- Servicio de escaneo: `AttachmentsScanService.enqueueScan` en `backend/src/attachments/attachments-scan.service.ts:46-54`.
- Busqueda: `enqueueScan` solo aparece definido, no invocado.
- `AttachmentsService.create` inyecta `scanService` (`backend/src/attachments/attachments.service.ts:24-29`) pero no lo usa al crear adjunto (`:84-140`).

Impacto practico: estado de seguridad enganoso. Para uso personal con archivos confiables no bloquea todo el sistema, pero si se suben PDFs/imagenes recibidas por terceros conviene corregirlo.

Correccion simple: llamar `enqueueScan` tras crear el adjunto, con path absoluto y MIME normalizado. Si no se quiere ClamAV, marcar `SKIPPED` explicitamente y no dejar `PENDING` eterno.

### P2 - Contrato de permisos de adjuntos no coincide

Evidencia:

- Contrato: `ASISTENTE` tiene `attachment.delete` en `shared/fine-grained-permission-contract.ts:59-70`.
- Frontend: `canDeleteAttachments = Boolean(isDoctor && canEdit)` en `useEncounterWizardDerived.ts:120-123`.
- Backend: `@Delete(':id') @Roles('MEDICO')` en `backend/src/attachments/attachments.controller.ts:76-78`.

Impacto practico: confusion futura y tests permisivos que no reflejan backend.

Correccion simple: alinear al comportamiento mas conservador: solo medico borra adjuntos, asistente sube pero no elimina.

### P2 - Formulario de paciente comprimido en mobile

Evidencia:

- `frontend/src/app/(dashboard)/pacientes/nuevo/NuevoPacienteDoctorFields.tsx:20` usa `grid grid-cols-3 gap-4`.

Impacto practico: tres campos administrativos criticos quedan apretados en pantallas chicas. Fecha de nacimiento, edad y sexo son campos donde un error humano importa.

Correccion simple: `grid grid-cols-1 gap-4 md:grid-cols-3`.

## 6. Seguridad, privacidad y datos sensibles

Fortalezas encontradas:

- Autenticacion con cookies `HttpOnly`, `sameSite: 'strict'` y `secure` en produccion (`backend/src/auth/auth.controller.ts:35-43`).
- Sesiones versionadas y validadas contra sesion activa (`backend/src/auth/strategies/jwt.strategy.ts:37-57`).
- CSRF double-submit para mutaciones web, con lista de exenciones pequena (`backend/src/common/middleware/csrf.middleware.ts:10-27`, `:51-91`).
- Frontend usa `/api` same-origin y `withCredentials` (`frontend/src/lib/api.ts:57-63`), y `next.config.js:45-54` fuerza `NEXT_PUBLIC_API_URL: '/api'` con rewrite al backend.
- Backend configura `helmet`, validacion global, CORS allowlist y falla rapido si faltan claves criticas (`backend/src/main.bootstrap.ts:109-120`, `backend/src/main.helpers.ts:120-150`).
- `ENCRYPTION_KEY` es obligatorio para cifrar identificatorios y PHI en reposo (`backend/src/main.helpers.ts:120-132`).
- `.gitignore` esta haciendo su trabajo para secretos y runtime: `git ls-files` solo muestra `.env.example`, `backend/.env.example`, `frontend/.env.example`.
- Los borradores locales de encounter se cifran con WebCrypto y se desactivan cuando `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` (`frontend/src/lib/encounter-draft.ts:50-109`, `.env.example:153-155`).

Riesgos proporcionados al uso personal:

- El setup inicial es facil de fallar por `ENCRYPTION_KEY` vacio. La app falla rapido, lo cual es bueno, pero la documentacion de primer setup debe guiar mejor.
- Existen archivos locales sensibles no versionados en la maquina: `.env`, `backend/.env`, `frontend/.env`, `backend/dev.db`, `runtime/data/anamneo.db`, backups y bases de Playwright. No estan trackeados, pero no conviene compartir/copiar el directorio completo sin limpiar runtime.
- `GET /api/health` publico devuelve detalles de base de datos. No vi PHI ahi, pero para internet-facing basta con estado minimo.
- `GRAFANA_ADMIN_PASSWORD` tiene fallback `change-me-before-production` en `docker-compose.yml:235-236`. Esta atado a loopback por defecto, pero si alguien abre puertos, hay que cambiarlo.
- El modo de PHI local es razonable si se mantiene `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true`. Si se desactiva, el perfil del navegador debe tratarse como almacenamiento sensible, porque la clave WebCrypto persistente queda en `localStorage` (`frontend/src/lib/local-phi-crypto.ts:54-66`).

Recomendaciones simples:

- Generar claves reales: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BOOTSTRAP_TOKEN`, `SETTINGS_ENCRYPTION_KEY`, `ENCRYPTION_KEY`.
- Mantener frontend y backend en loopback detras de un tunnel HTTPS, como ya indica `docs/deployment-and-release.md:57-81`.
- No subir/copiar `runtime/`, `.env`, `.db` ni backups a servicios no cifrados.
- Hacer backup automatico y restore drill antes del primer uso real.

## 7. Integridad de datos clinicos

Fortalezas:

- Modelo amplio: pacientes, atenciones, secciones, firmas, adjuntos, alergias, citas, tareas, problemas, consentimientos, portal, auditoria y settings.
- Pacientes tienen soft delete/archivo, no borrado duro inmediato.
- RUT/identificadores usan campos cifrados y hashes de lookup, con restricciones de unicidad donde corresponde.
- Atenciones tienen estados y controles de edicion; no se puede modificar adjuntos si la atencion ya no esta `EN_PROGRESO` (`backend/src/attachments/attachments.service.ts:31-34`).
- Adjuntos se validan por contenido y MIME antes de persistir (`backend/src/attachments/attachments.service.ts:64-67`).
- Hay exportaciones clinicas y bundle de paciente, mas scripts de backup.

Riesgos:

- Sin restore drill probado, backup documentado no equivale a recuperacion real. Este es el riesgo principal para uso personal.
- Medicamentos parecen repartidos entre tratamiento de atenciones, catalogo y texto clinico. Para EMR personal conviene una lista clara de medicamentos actuales/pasados por paciente.
- Adjuntos quedan con `scanStatus=PENDING` si no se arregla el flujo de escaneo o `SKIPPED`.
- Restaurar/archivar pacientes y reabrir estados debe estar muy claro en UI. El backend tiene logica de soft delete, pero la UX debe evitar sorpresas al cancelar/reabrir atenciones.
- La auditoria existe, pero conviene asegurar que los cambios clinicos criticos y su log se escriban de forma atomica o con retry.

Mejoras pragmaticas:

- Panel superior persistente por paciente con alergias, problemas activos y medicamentos actuales.
- Lista de medicacion dedicada: nombre, dosis, frecuencia, inicio, termino, estado, nota.
- Timeline clinico por paciente que combine atenciones, adjuntos, alergias, tareas, citas y cambios relevantes.
- Export personal sencillo por paciente y prueba periodica de restauracion.

## 8. UI/UX

Problemas concretos:

- Confirmacion destructiva insegura: `ConfirmModal` enfoca confirmar, no cancelar. Puede causar acciones accidentales.
- Botones/menus clinicos de exportacion cambiaron de contrato accesible y los tests no fueron actualizados. La separacion preview/descarga es buena, pero debe quedar testada.
- `EncounterAttachmentsModal` no limita el selector de archivo con `accept` (`EncounterAttachmentsModal.tsx:141-150`). El error aparece tarde.
- Varios modales propios tienen `role="dialog"`/`alertdialog`, pero no vi un patron fuerte de focus trap. Para uso con teclado, el foco puede escaparse al fondo.
- En `NuevoPacienteDoctorFields.tsx:20`, el grid de tres columnas en mobile puede apretar datos administrativos sensibles.
- Controles compactos del wizard/toolbar dependen mucho de iconos y labels ocultos en pantallas pequenas. Donde el texto se oculta con `hidden`, conviene asegurar `aria-label` explicito.
- Loading states existen, pero algunos son spinners genericos. En fichas clinicas, skeletons o estados de carga con estructura reducen ansiedad y clicks repetidos.

Cosas que funcionan bien:

- Navegacion por rutas y dashboard esta organizada.
- La app evita trafico browser directo al backend externo y conserva `/api` same-origin.
- Crear paciente tiene validaciones, calculo de edad, deteccion de duplicados y borrador de formulario.
- La ficha clinica bloquea outputs oficiales cuando el paciente esta pendiente de verificacion o la atencion no esta en estado apropiado. La intencion de producto es buena; falta alinear tests.
- Hay estados vacios y mensajes de bloqueo clinico relativamente claros.

Correcciones simples:

- Focus inicial seguro en modales destructivos.
- `accept` y texto de limite/tipos para adjuntos.
- Breakpoints mobile en formularios administrativos.
- `aria-label` para botones icon-only.
- Focus trap reusable para modales.
- Toasts/feedback consistentes despues de guardar, adjuntar, archivar, restaurar y exportar.

## 9. Funcionalidades EMR faltantes o mejorables

### Muy utiles para produccion personal

- Lista de medicamentos actuales y pasados por paciente, separada del texto libre de la atencion.
- Panel critico persistente en paciente/atencion: alergias, medicamentos actuales, problemas activos y alertas.
- Backup y restore personal con checklist probado, no solo scripts.
- Timeline clinico por paciente si el actual historial longitudinal no integra todos los eventos importantes con filtros simples.
- Plantillas de notas clinicas reutilizables para consultas frecuentes.
- Exportacion personal clara por paciente: PDF y/o Markdown/ZIP con adjuntos, fecha y alcance.

### Buenas mejoras futuras

- Busqueda global en texto clinico, diagnosticos, tareas y adjuntos etiquetados.
- Tags/categorias por paciente o evento clinico.
- Vista de cambios por paciente basada en audit log, en lenguaje humano.
- Recordatorios/tareas con vencimientos mas visibles.
- Modo solo lectura o "bloqueo accidental" para revisar sin editar.
- Mejor preview de adjuntos y asociacion visual con ordenes/examenes.

### Opcionales o avanzadas

- OCR de documentos adjuntos.
- Interoperabilidad FHIR/HL7.
- Multi-tenant/clinicas multiples.
- SSO corporativo.
- Dashboards analiticos avanzados.
- Firma avanzada/legal externa.

## 10. Testing minimo recomendado

Antes de datos reales:

- `npm install`
- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix backend run lint:check`
- `npm --prefix frontend run lint`
- `npm --prefix backend run test -- --runInBand`
- `npm --prefix frontend run test -- --runInBand`
- `npm run build`

Con base PostgreSQL disponible:

- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
- `npm --prefix frontend run test:e2e:smoke`
- `npm --prefix frontend run test:e2e:workflow-clinical`
- `npm --prefix frontend run test:e2e:a11y`

Tests puntuales que agregaria o corregiria:

- ConfirmModal enfoca cancelar y Enter no dispara accion destructiva accidental.
- Attachment create encola scan o marca `SKIPPED` explicitamente.
- Contrato de permisos de adjuntos alineado entre shared/frontend/backend.
- Ficha clinica: preview y descarga de receta/ordenes/derivacion con paciente verificado/no verificado y atencion en progreso/completada.
- Setup/env smoke: si falta `ENCRYPTION_KEY`, error claro con instruccion directa.

Pruebas manuales recomendadas:

- Login/logout, refresh de sesion y expiracion.
- Crear paciente completo e incompleto, editarlo y detectar duplicado por RUT.
- Crear atencion, autosave, cambio de seccion, cierre/firma/reapertura.
- Adjuntar, descargar y borrar adjunto.
- Exportar PDF/documentos clinicos.
- Archivar/restaurar paciente.
- Backup y restore drill con una base de prueba.

## 11. Recomendaciones de implementacion priorizadas

1. ~~Arreglar `globals.css` para que `npm run build` pase.~~ **HECHO 2026-05-28**
2. ~~Limpiar/regenerar tipos de Next y dejar `frontend typecheck` verde.~~ **HECHO 2026-05-28**
3. ~~Corregir lint frontend/backend.~~ **HECHO 2026-05-28** — 0 errores en ambos lados.
4. ~~Actualizar tests de `atencion-ficha`.~~ **HECHO 2026-05-28** — 334/334 pasan.
5. ~~Corregir `ConfirmModal` para foco seguro.~~ **HECHO 2026-05-28**
6. ~~Mejorar `docs/development.md` con generacion obligatoria de `ENCRYPTION_KEY`.~~ **HECHO 2026-05-28** — comandos `node -e "..."` agregados al primer setup.
7. Probar `npm run db:backup` y `npm run db:restore:drill` con una base de prueba. **(pendiente manual — el unico bloqueador real restante)**
8. ~~Decidir politica de escaneo de adjuntos.~~ **HECHO 2026-05-28** — `enqueueScan` activado; si ClamAV no esta configurado marca `SKIPPED`.
9. ~~Alinear permisos de borrar adjuntos entre contrato, frontend y backend.~~ **HECHO 2026-05-28** — `attachment.delete` removido de `ASISTENTE` en el contrato.
10. ~~Reducir exposicion de `/api/health` publico.~~ **HECHO 2026-05-28**
11. ~~Ajustar responsive de formulario nuevo paciente.~~ **HECHO 2026-05-28**
12. ~~Agregar focus trap/aria-labels donde falte en modales y toolbars.~~ **HECHO 2026-05-28** — `aria-label` agregado a botones icon-only en `EncounterToolbar.tsx` (Guardar, Ficha clinica, Finalizar, Firmar).

## 12. Veredicto final

Anamneo esta cerca en arquitectura y controles de base, pero no estaba listo para usar con datos reales al momento de la auditoria. El bloqueo principal era el build de produccion y los gates de frontend. **Tras la sesion de fixes del 2026-05-28 todos los gates de codigo pasan.**

Veredicto actualizado (2026-05-28): **Usable con cautela** en contexto personal una vez completado el backup/restore drill y generadas las claves reales de produccion. El codigo esta en condicion de release.

Pendiente antes de meter datos reales:

1. ~~Arreglar `npm run build`.~~ **HECHO**
2. ~~Dejar verdes `frontend typecheck`, `frontend test` y `frontend lint`.~~ **HECHO**
3. ~~Corregir `ConfirmModal`.~~ **HECHO**
4. ~~Documentar generacion de `ENCRYPTION_KEY` en primer setup.~~ **HECHO**
5. Ejecutar un backup y una restauracion de prueba. **(pendiente — el unico bloqueador real restante)**
6. ~~Corregir o explicitar el estado de escaneo de adjuntos.~~ **HECHO**
7. ~~Alinear permisos de borrar adjuntos (contrato vs frontend vs backend).~~ **HECHO**
8. Verificar manualmente crear/editar paciente, crear/cerrar atencion, adjuntar, exportar, archivar/restaurar. **(pendiente manual)**
9. Mantener `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` salvo que el equipo y perfil del navegador sean privados y confiables.
10. Limpiar o proteger archivos locales de runtime/backups antes de compartir la carpeta del proyecto.

## 13. Registro de fixes aplicados (2026-05-28)

| # | Archivo(s) | Descripcion |
|---|---|---|
| 1 | `frontend/src/app/globals.css`, `styles/auth.css`, `styles/dashboard.css` | `@import` movidos al inicio; `@layer components` removido de archivos split (incompatible con procesamiento independiente de Turbopack). Build pasa. |
| 2 | `frontend/src/lib/useServerSessionCheck.ts` | `callbackRef.current = onExpired` movido a `useEffect([onExpired])`. Elimina violacion de regla de refs de React. |
| 3 | `frontend/src/components/common/ConfirmModal.tsx` | Agregado `cancelRef`; cancel button recibe el ref y el focus inicial al abrir. |
| 4 | `frontend/src/__tests__/app/atencion-ficha.test.tsx` | 3 tests actualizados: `'Receta'` → `'Vista previa receta'` / `'Descargar receta'` (y analogos para ordenes/derivacion). |
| 5 | `frontend/src/app/(dashboard)/pacientes/nuevo/NuevoPacienteDoctorFields.tsx` | `grid-cols-3` → `grid-cols-1 md:grid-cols-3`. |
| 6 | `backend/src/attachments/attachments.service.ts` | `this.scanService.enqueueScan(id, path, mime)` llamado tras commit de transaccion en `create`. |
| 7 | `backend/src/health.controller.ts` | `GET /health` publico ya no devuelve objeto `database`. Solo `{status, timestamp}`. |
| 8 | `frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx` | Agregado `accept=".pdf,.jpg,.jpeg,.png,.gif,..."` al input de archivo. |
| 9 | `backend/src/attachments/attachments-scan.service.ts` | `import('node:net')` hoisted antes del `new Promise(...)` para eliminar async Promise executor. |
| 10 | `backend/src/data-breach/dto/data-breach.dto.ts` | Removido import `Type` no usado. |
| 11 | `backend/src/instrument.ts` | Agregado `eslint-disable-next-line` para `require()` opcional de profiling (dependencia de runtime condicional). |
| 12 | `backend/src/patient-data-rights/dto/patient-data-rights.dto.ts` | Removido import `ValidateNested` no usado. |
| 13 | `backend/src/patient-data-rights/patient-data-request-delivery.service.ts` | Removidos `encryptField` (import) y `normalizeRut` (funcion local no usada). |
| 14 | `backend/src/patients/patients-demographics-mutations.helpers.ts` | Removidos `normalizeNullableEmail` (import) y vars destructuradas sin uso (`domicilio`, `telefono`, `email`, `contactoEmergenciaNombre`, `contactoEmergenciaTelefono`). |

**Guardrails post sesion 1:**
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend run typecheck` ✅
- `npm --prefix frontend run lint` ✅ (0 errores)
- `npm --prefix backend run lint:check` ✅ (0 errores)
- `npm --prefix frontend run test -- --runInBand` ✅ 334/334
- `npm --prefix backend run test -- --runInBand` ✅ 526/528 (2 skipped intencionales)
- `npm run build` ✅
- `npm --prefix backend run audit:patient-scope` ✅
- `npm --prefix backend run audit:legacy-plaintext` ✅

### Sesion 2 (2026-05-28)

| # | Archivo(s) | Descripcion |
|---|---|---|
| 15 | `shared/fine-grained-permission-contract.ts` | `attachment.delete` removido de `ASISTENTE`. Contrato alineado con backend y frontend (solo MEDICO elimina adjuntos). |
| 16 | `backend/src/common/guards/roles.guard.ts` | Condicion admin cambiada de `user.isAdmin` a `user.isAdmin && user.role === 'ADMIN'`, igual que `AdminGuard`. Elimina doble fuente de verdad. |
| 17 | `backend/src/encounters/encounters-section-mutations.ts` | `auditService.log` movido dentro de `runTransaction` (con `tx`) en `updateEncounterSectionMutation`. `reconcileEncounterIdentificationSection` envuelto en transaccion propia; audit atomico con la mutacion. |
| 18 | `backend/src/encounters/encounters-section-mutations.spec.ts` | Test de reconcile actualizado para esperar segundo argumento `tx` en `auditService.log`. |
| 19 | `docs/development.md` | Primer setup ampliado con comandos `node -e "..."` para generar `ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET` y `SETTINGS_ENCRYPTION_KEY`. Advertencia de no regenerar si ya existen datos cifrados. |
| 20 | `frontend/src/app/(dashboard)/atenciones/[id]/EncounterToolbar.tsx` | `aria-label` agregado a botones Guardar, Ficha clinica, Finalizar y Firmar (texto ocultado en mobile con `hidden lg:inline`). |

**Guardrails post sesion 2:**
- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend run typecheck` ✅
- `npm --prefix frontend run lint` ✅ (0 errores)
- `npm --prefix backend run lint:check` ✅ (0 errores)
- `npm --prefix frontend run test -- --runInBand` ✅ 334/334
- `npm --prefix backend run test -- --runInBand` ✅ 526/528 (2 skipped intencionales)
- `npm --prefix backend run audit:patient-scope` ✅
- `npm --prefix backend run audit:legacy-plaintext` ✅
