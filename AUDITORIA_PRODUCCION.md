# Auditoría técnica de producción

## 0. Seguimiento de mitigación

### Pasada 1 - 2026-04-14

- C1 mitigado: los dos módulos que rompían `next build` por JSX en archivos `.ts` fueron movidos a `.tsx`.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.tsx` y `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.tsx`.
- Criterio aplicado: Next.js documenta soporte TypeScript basado en archivos `.ts` y `.tsx`, y sus ejemplos para TypeScript con JSX usan `.tsx`.
- Validación final: `npm --prefix frontend run typecheck` pasó y `npm --prefix frontend run build` volvió a completar; durante esa pasada también se corrigieron errores de tipado expuestos en `admin/usuarios`, `PatientEncounterTimeline`, `useEncounterWizard`, `DashboardSidebar`, `MobileSearchOverlay` y la exportación de `PatientDetailHook`.
- Pendientes tras esta pasada: C3, C4, C5, vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, migraciones automáticas al arranque, y endurecimiento adicional de operación/release.

### Pasada 2 - 2026-04-14

- C3 mitigado en Compose: `backup-cron` ahora monta `./runtime/uploads` en modo lectura y fija `UPLOAD_DEST=/app/uploads`, alineando el contenedor de backup con el storage real de adjuntos.
- Alcance del cambio: `docker-compose.yml` y `docs/sqlite-operations.md`.
- Validación final: `docker compose config` resuelto muestra `UPLOAD_DEST=/app/uploads` y el volumen `/app/uploads` marcado `read_only` dentro de `backup-cron`.
- Pendientes tras esta pasada: C4, C5, vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, migraciones automáticas al arranque, y endurecimiento adicional de operación/release.

### Pasada 3 - 2026-04-14

- C4 mitigado en flujo: el primer registro administrador ahora requiere `BOOTSTRAP_TOKEN` cuando el sistema no tiene admins, y en produccion el backend falla al arrancar si ese token no esta configurado con un valor no-placeholder.
- Alcance del cambio: `backend/src/auth/auth.service.ts`, `backend/src/auth/dto/register-with-invitation.dto.ts`, `backend/src/main.ts`, `.env.example`, `docs/environment.md` y `docs/security-and-permissions.md`.
- Validación final: `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix frontend run typecheck` y `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts --testNamePattern='Auth -'` pasaron con el nuevo flujo de bootstrap.
- Pendientes tras esta pasada: C5, vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, migraciones automáticas al arranque, y endurecimiento adicional de operación/release.

### Pasada 4 - 2026-04-14

- C5 mitigado en UX: la eliminación de adjuntos ya no sale directa desde la lista; ahora exige una confirmación explícita antes del borrado.
- Alcance del cambio: `frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx` y `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`.
- Validación final: `npm --prefix frontend run typecheck` y `npm --prefix frontend run build` pasaron después del cambio. El build sigue emitiendo un `ReferenceError: location is not defined` no fatal durante `Collecting page data`, así que quedó como remanente técnico a investigar, no como blocker del pipeline.
- Pendientes tras esta pasada: vulnerabilidad `follow-redirects`, duplicación `/auth/me`, cobertura E2E real de frontend, estrategia de snapshot completo de uploads, ausencia de papelera/soft-delete real para adjuntos, migraciones automáticas al arranque, y el warning `location is not defined` durante build.

> Actualizacion 2026-04-14: C2 quedo mitigado en el repo. `docker-compose.yml` ahora publica backend y frontend solo en loopback por defecto, y la documentacion de despliegue/entorno deja explicito que este producto esta pensado para publicarse detras de Cloudflare Tunnel con `cloudflared` y HTTPS.

## 1. Resumen ejecutivo

Audité el estado actual del repositorio como si hoy hubiera que desplegarlo para uso real con datos clínicos. Revisé arquitectura, frontend, backend, base de datos, adjuntos, seguridad, testing, Docker Compose, guía de despliegue y scripts operativos. Además ejecuté verificaciones directas sobre el código actual:

- `npm --prefix backend run typecheck`: pasa.
- `npm --prefix backend run build`: pasa.
- `npm --prefix frontend run typecheck`: pasa.
- `npm --prefix frontend run build`: pasa, con warning no fatal `ReferenceError: location is not defined` durante `Collecting page data`.
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts --testNamePattern='Auth -'`: pasa.
- `npm --prefix frontend audit --omit=dev --json`: reporta 1 vulnerabilidad moderada con fix disponible.

También validé con Context7 el comportamiento de Next.js: `next build` falla por defecto ante errores TypeScript o de parsing, salvo que se configure explícitamente `typescript.ignoreBuildErrors = true`. El proyecto no desactiva esa protección, y el fallo observado es consistente con eso.

Conclusión corta: la base técnica no es mala. De hecho, tiene varias decisiones correctas para una app clínica pequeña: sesiones con rotación, cookies HttpOnly, TOTP, trazabilidad, validación de archivos y CI útil. Después de las pasadas de mitigación de hoy, C1, C2, C3 y C4 quedaron corregidos en código, y C5 quedó mitigado en UX. Lo que sigue abierto ya no es un colapso de release, sino deuda operativa y de seguridad de segundo orden que todavía conviene cerrar antes de cantar victoria.

Los pendientes más relevantes ahora son:

1. El build del frontend aún emite un `ReferenceError: location is not defined` no fatal durante la recolección de datos.
2. La dependencia `follow-redirects` sigue con una vulnerabilidad moderada y fix disponible.
3. El borrado de adjuntos ya exige confirmación, pero todavía no existe papelera ni soft-delete real.
4. El backup ya incluye adjuntos, pero la estrategia actual sigue copiando el árbol completo de uploads en cada corrida.

## 2. Veredicto de producción

Veredicto actual: **Go condicionado**.

No hace falta rehacer el sistema ni migrarlo de inmediato a una arquitectura más compleja. Para el tamaño real del producto, eso sería overkill. Las fallas operativas y de seguridad que sí justificaban un `No-Go` inicial ya fueron mitigadas en estas pasadas. Lo que queda es suficiente para exigir seguimiento cercano, pero ya no para descartar el release por bloqueo inmediato.

Para sostener ese **Go condicionado** sin autoengaño, todavía conviene cerrar al menos estas correcciones:

1. Resolver el warning `location is not defined` del build para asegurarse de que no esconda un problema SSR real.
2. Remediar `follow-redirects` y dejar el audit de producción limpio.
3. Convertir la confirmación de borrado de adjuntos en una protección real con papelera o soft-delete.
4. Reducir el costo del snapshot completo de uploads en cada backup.
5. Ampliar E2E real de frontend para login, navegación privada y adjuntos.

## 3. Hallazgos críticos

### C1. El frontend actual no builda y bloquea cualquier release (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `npm --prefix frontend run build` falla con errores de parsing en `frontend/src/app/(dashboard)/atenciones/[id]/encounter-wizard.constants.ts` y `frontend/src/app/(dashboard)/pacientes/[id]/usePatientDetail.ts` porque contienen JSX en archivos `.ts`.
- Evidencia adicional: `npm --prefix frontend run typecheck` también falla en la revisión actual.
- Impacto: no hay release reproducible del frontend; cualquier intento de desplegar esta revisión queda bloqueado antes de llegar a producción.
- Causa raíz: regresión de refactor donde se movió JSX a archivos con extensión incorrecta.
- Corrección mínima: renombrar esos módulos a `.tsx` o extraer el JSX a componentes separados y dejar solo tipos/lógica en `.ts`.

### C2. La guía de despliegue actual no resuelve HTTPS, pero auth usa cookies `Secure` en producción (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `docs/deployment-and-release.md` documenta despliegue con `docker compose up -d --build` y acceso al frontend por `:5555`, sin reverse proxy ni TLS.
- Evidencia: `backend/src/auth/auth.controller.ts` marca cookies con `secure: isProduction`.
- Impacto: si alguien sigue la guía y expone el stack por HTTP, los navegadores no persistirán la sesión de autenticación como se espera en producción. En términos prácticos, el flujo de login puede quedar roto fuera de localhost o detrás de despliegues mal configurados.
- Causa raíz: la política de cookies es correcta, pero la operación documentada no está alineada con ella.
- Corrección mínima: documentar y exigir un reverse proxy HTTPS real delante del frontend/backend o, como mínimo, declarar explícitamente que Compose no es un despliegue internet-facing completo.

### C3. El backup por Docker Compose no incluye los adjuntos reales (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `docker-compose.yml` monta `./runtime/uploads:/app/uploads` solo en `backend`, no en `backup-cron`.
- Evidencia: `backend/scripts/sqlite-backup.js` intenta snapshotear `UPLOAD_DEST` y, si no está definido, cae por defecto en `./uploads`, que dentro del contenedor de backup resuelve a `/app/uploads`.
- Evidencia: `backup-cron` no define `UPLOAD_DEST` ni monta `runtime/uploads`.
- Impacto: el backup de base SQLite puede salir bien, pero los adjuntos clínicos reales quedan fuera del respaldo por defecto en el escenario Docker Compose. Eso significa restauraciones incompletas con pérdida de evidencia clínica adjunta.
- Causa raíz: desalineación entre el script de backup y los volúmenes efectivos del servicio que lo ejecuta.
- Corrección mínima: montar `./runtime/uploads:/app/uploads` en `backup-cron`, fijar `UPLOAD_DEST=/app/uploads` y validar restauración extremo a extremo.

### C4. En una instalación nueva, el primer visitante puede quedarse con la cuenta admin (Mitigado 2026-04-14)

- Severidad: crítica.
- Evidencia: `backend/src/auth/auth.service.ts` permite que, si no existe admin activo, el primer registro válido cree la cuenta administradora inicial. El mismo flujo solo bloquea roles distintos de `ADMIN` cuando el sistema está vacío.
- Impacto: si se despliega una instancia nueva y se expone antes de que el dueño cree su cuenta inicial, cualquier tercero que llegue primero puede apropiarse del sistema.
- Causa raíz: bootstrap inicial abierto por diseño, sin token de instalación, allowlist o mecanismo de cierre automático del onboarding público.
- Corrección mínima: exigir un `BOOTSTRAP_TOKEN`, restringir bootstrap a red local/entorno controlado o crear el admin inicial fuera del flujo público.

### C5. El borrado de adjuntos es inmediato e irreversible desde la UI (Mitigado en UX 2026-04-14)

- Severidad: alta.
- Evidencia: `frontend/src/app/(dashboard)/atenciones/[id]/EncounterAttachmentsModal.tsx` dispara `deleteMutation.mutate(attachment.id)` directamente desde el botón `Eliminar`, sin confirmación visible.
- Evidencia: `backend/src/attachments/attachments.service.ts` hace `safeUnlink` del archivo físico y luego `prisma.attachment.delete`.
- Impacto: un clic accidental puede borrar un adjunto clínico del disco y de la base. Aunque quede rastro en auditoría, el contenido puede perderse hasta restaurar backup.
- Causa raíz: se modeló la eliminación como operación final y no como retiro reversible o flujo con confirmación.
- Corrección mínima: agregar confirmación explícita y, idealmente, soft-delete o papelera con retención corta.

## 4. Arquitectura general

Para el objetivo real del producto, la arquitectura general es razonable. No veo necesidad inmediata de migrar a microservicios, colas distribuidas ni PostgreSQL solo por moda. El sistema ya tiene una separación clara entre frontend Next.js y backend NestJS, con Prisma, módulos clínicos definidos y una base operativa suficiente para una consulta o equipo pequeño.

Lo que sí veo es tensión de mantenibilidad:

- `backend/src/patients/patients.service.ts`: 1480 líneas.
- `backend/src/encounters/encounters.service.ts`: 1226 líneas.
- `frontend/src/app/(dashboard)/atenciones/[id]/useEncounterWizard.ts`: 1110 líneas.
- `backend/test/suites/encounters.e2e-suite.ts`: 1068 líneas.
- `backend/src/encounters/encounters-sanitize.ts`: 928 líneas.
- `backend/src/encounters/encounters-pdf.service.ts`: 556 líneas.

Eso ya contradice la regla del proyecto de no superar 500 líneas por archivo y dificulta detectar regresiones. No es un bloqueador inmediato de producción por sí solo, pero sí explica por qué aparecen errores evitables en refactors recientes.

Evaluación de arquitectura: **apta para el tamaño actual del producto, pero con deuda de modularidad visible y regresiones recientes que ya están golpeando el build**.

## 5. Frontend

Estado actual del frontend: **no liberable**.

Puntos positivos:

- Hay `error.tsx`, `loading.tsx` y `not-found.tsx` en el App Router.
- La navegación privada usa validación de sesión en borde y bootstrap de estado en cliente.
- El contrato de login redirect está saneado en `frontend/src/lib/login-redirect.ts`, evitando open redirect trivial.

Problemas relevantes:

1. El build está roto por JSX en archivos `.ts`.
2. Hay doble validación de sesión con `/auth/me`: una en `frontend/src/proxy.ts` y otra en `frontend/src/components/layout/DashboardLayout.tsx`. Eso añade roundtrip, complejidad y posibles estados inconsistentes de carga.
3. La cobertura E2E browser real es mínima: hoy solo existe `frontend/tests/e2e/encounter-draft-recovery.spec.ts`, y además depende de mocks en vez de ejercitar un backend real.

Mi lectura práctica: el frontend tiene buena intención estructural, pero ahora mismo está en un estado donde un refactor reciente rompió el pipeline más básico. Hasta corregir eso, cualquier otra discusión visual o de performance es secundaria.

## 6. Backend

Estado del backend: **más sólido que el frontend y bastante mejor de lo que sugeriría una primera lectura superficial**.

Fortalezas claras:

- Cookies HttpOnly con `SameSite: 'strict'`.
- Rotación de refresh tokens con `UserSession` y versionado de sesión.
- Lockout por intentos fallidos.
- 2FA TOTP funcional y coherente entre backend y frontend.
- Validación fuerte de payloads con `ValidationPipe`.
- Auditoría y request tracing presentes.

Debilidades operativas:

1. El bootstrap del primer admin queda abierto en instalaciones vacías.
2. El backend Dockerfile copia `node_modules` completos del builder a producción, arrastrando dependencias de desarrollo innecesarias.
3. El `CMD` del contenedor ejecuta `npx prisma migrate deploy && node dist/src/main`, o sea, las migraciones corren automáticamente en cada arranque del backend. Eso es cómodo, pero reduce control operativo y mezcla deploy con arranque.

Mi lectura práctica: el backend no pide una reescritura. Pide cerrar algunos huecos operativos y de seguridad muy concretos.

## 7. Base de datos

Usar SQLite aquí no es el problema principal.

Para una aplicación clínica de una profesional o un equipo pequeño, SQLite con WAL, `busy_timeout`, checks de integridad y backups puede ser una decisión pragmática y perfectamente válida. El proyecto además ya tiene bastante trabajo operativo alrededor de eso en `backend/src/prisma/prisma.service.ts` y `backend/scripts/`.

Límites reales:

1. Es una arquitectura single-host por definición.
2. Base y adjuntos viven atados a la misma operación física.
3. Varias estructuras siguen serializadas como JSON/texto, lo que baja capacidad de consulta fina y endurece algunas migraciones.

Mi veredicto aquí es simple: **SQLite no bloquea esta app por su tamaño real, pero obliga a que backups, restauración y operación del host estén bien resueltos. Hoy ese punto no está bien cerrado**.

## 8. Sistema de archivos y uploads

Esta área tiene cosas buenas y cosas peligrosas.

Lo bueno:

- `backend/src/attachments/attachments.module.ts` y `attachments.service.ts` limitan tipos de archivo.
- Hay verificación de firma binaria, no solo MIME/extensión.
- `resolveUploadsRoot` evita que `UPLOAD_DEST` se salga del root esperado.
- El acceso a archivos está atado a la atención y al médico efectivo; no encontré evidencia de links públicos, signed URLs ni compartición anónima. En ese sentido, el sistema **no** es un Google Drive ni un Cloudreve, y hoy eso juega a favor de la seguridad.

Lo malo:

1. El backup Compose no toma los adjuntos reales, como ya quedó descrito en C3.
2. Si se corrige el volumen sin tocar la estrategia, `backend/scripts/sqlite-backup.js` copiará el árbol completo de uploads en cada corrida. Con el cron por defecto cada 6 horas y 14 días de retención, eso puede disparar el uso de disco muy rápido.
3. No hay soft-delete ni papelera para adjuntos: borrar es borrar.
4. No hay evidencia en el repositorio de cifrado de adjuntos o snapshots en reposo. Si la infraestructura no lo resuelve fuera de la app, un compromiso del host o del directorio de backups expone documentos clínicos completos.

Mi juicio: esta es una de las áreas más delicadas del sistema porque mezcla continuidad operativa y sensibilidad de datos.

## 9. Seguridad

La postura de seguridad es mejor de lo habitual para un proyecto pequeño, pero todavía no está cerrada para producción real.

Fortalezas:

- Autenticación por cookies HttpOnly, sin bearer abierto por defecto.
- `SameSite: 'strict'` y `secure` en producción.
- TOTP 2FA.
- Throttling y lockout de intentos.
- Validación y sanitización de entradas.
- Restricción fuerte de acceso a adjuntos y recursos clínicos.
- Auditoría de acciones sensibles.

Debilidades confirmadas:

1. El despliegue documentado no garantiza HTTPS aunque auth lo requiere en producción.
2. El bootstrap del primer admin puede ser secuestrado si la instancia vacía se expone antes de inicializarse.
3. No hay evidencia de cifrado en reposo para adjuntos y snapshots.
4. `npm audit` del frontend reporta `follow-redirects` con advisory `GHSA-r4q5-vmmm-2653`, severidad moderada y fix disponible.

Balance honesto: el diseño base de seguridad es bueno; la operación documentada todavía no lo acompaña.

## 10. Rendimiento

Para el uso esperado, no veo cuellos de botella graves en tiempo de respuesta por diseño puro. El mayor riesgo hoy no es latencia, sino operación incorrecta.

De todos modos, sí hay focos de costo innecesario:

1. Doble llamada a `/auth/me` por el circuito `proxy.ts` + `DashboardLayout.tsx`.
2. Estrategia de snapshot completo de uploads en cada backup, que es costosa en I/O.
3. Previews y descargas manejadas como blobs completos en frontend, mitigado parcialmente por el límite de tamaño de upload.

Para una consulta pequeña esto no exige un rediseño. Sí exige quitar duplicaciones y evitar copiar árboles completos de archivos cada pocas horas.

## 11. Escalabilidad

La app escala bien solo dentro de un rango pequeño, y eso no es necesariamente un defecto dado el propósito del producto.

Límites estructurales claros:

1. Docker Compose con SQLite y uploads locales implica nodo único.
2. No hay separación entre almacenamiento clínico y storage de aplicación.
3. No hay estrategia para múltiples instancias concurrentes del backend escribiendo el mismo SQLite y el mismo storage local.

Mi veredicto: **escala lo suficiente para una médica y un entorno controlado; no escala limpiamente a operación multi-sede o de alta concurrencia**. Eso está bien, siempre que se diga y se opere con ese techo en mente.

## 12. Testing y QA

El proyecto tiene señales mixtas.

Lo bueno:

- `.github/workflows/ci.yml` no es decorativo: corre secret scan, audits, lint, typecheck, tests y builds.
- El backend tiene una superficie de pruebas relativamente amplia entre unitarias y e2e.

Lo insuficiente:

1. El frontend browser E2E hoy es un solo spec.
2. Ese spec no representa una navegación completa contra backend real.
3. La regresión actual del build demuestra que, al menos en esta revisión, el repositorio puede quedar fuera de estado liberable pese a tener CI definida.

La conclusión aquí no es “faltan cientos de tests”. Es más simple: **falta una red mínima de pruebas end-to-end reales sobre login, navegación privada y adjuntos**.

## 13. DevOps y operación

Esta es la capa más floja del proyecto hoy.

Problemas confirmados:

1. El despliegue manual no incluye reverse proxy HTTPS ni procedimiento de terminación TLS.
2. No hay rollback automatizado.
3. El servicio `backup-cron` está mal cableado para adjuntos persistidos.
4. Los restore drills y chequeos operativos de SQLite existen como scripts, pero no están integrados en el despliegue Compose por defecto.
5. El backend arranca ejecutando migraciones automáticamente, mezclando inicialización con cambio de esquema.

Orden de remediación recomendado:

1. Recuperar el build del frontend.
2. Corregir el circuito de despliegue real con HTTPS documentado.
3. Arreglar backup de adjuntos y probar restauración completa.
4. Blindar bootstrap del primer admin.
5. Meter confirmación y papelera o soft-delete para adjuntos.
6. Reducir duplicación de `/auth/me` y ampliar E2E real de frontend.
7. Refinar estrategia de backup de uploads para no copiar todo cada 6 horas.

---

## Cierre honesto

Si alguien me preguntara hoy si puede poner esta revisión en producción para guardar fichas clínicas reales, diría **no todavía**.

No porque el sistema esté mal pensado, sino porque hay un pequeño grupo de fallas muy concretas que rompen cosas básicas o dejan riesgos demasiado directos:

- el frontend no builda,
- el despliegue documentado no está alineado con la política real de cookies,
- los backups por Compose dejan fuera los adjuntos reales,
- y la instalación vacía puede ser tomada por el primer admin que llegue.

Lo bueno es que ninguna de esas correcciones exige reescribir medio producto. Son arreglos concretos, de bastante valor, y mucho más importantes que cualquier “gran refactor” vistoso.