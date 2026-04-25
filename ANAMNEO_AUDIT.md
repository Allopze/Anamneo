# Auditoria tecnica y funcional de Anamneo

Fecha de auditoria: 2026-04-25

## 1. Resumen ejecutivo

### Que audite

- Estructura general del repo, scripts, `.env.example`, `docker-compose.yml`, docs operativas y de seguridad.
- Backend NestJS, frontend Next.js, contratos compartidos, Prisma/SQLite, backups/restore drill, auth/2FA, permisos, auditoria y persistencia local del frontend.
- Ejecucion real de instalacion, typecheck, tests, builds, arranque local y scripts SQLite.

### Evidencia ejecutada

Comandos y resultado resumido:

- `npm install`: OK.
- `npm --prefix backend run typecheck`: OK.
- `npm --prefix frontend run typecheck`: OK.
- `npm --prefix backend run test`: OK, 64 suites / 335 tests.
- `npm --prefix frontend run test`: OK, 61 suites / 295 tests.
- `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`: OK, 220 tests.
- `npm --prefix frontend run test:e2e:smoke`: OK, 2 tests.
- `npm --prefix frontend run test:e2e:workflow-clinical`: 9/10 OK, 1 falla por drift del selector del test en el flujo de firma.
- `npm --prefix backend run build`: OK.
- `npm --prefix frontend run build`: OK.
- `npm --prefix backend run audit:prod`: 3 vulnerabilidades moderadas (`postcss`, `uuid` transitive via `natural`).
- `npm --prefix frontend run audit:prod`: 5 vulnerabilidades moderadas (`postcss`, `uuid` transitive via Next/Sentry tooling).
- `npm --prefix backend run db:sqlite:monitor`: inicialmente `warn` por backup vencido; luego `ok` tras backup manual.
- `npm --prefix backend run db:sqlite:restore:drill`: OK.
- `npm --prefix backend run db:sqlite:backup`: OK.
- `npm run dev`: frontend y backend levantan; la app responde, pero Next/Sentry emite warnings de instrumentacion incompleta.

### Estado general

Base tecnica bastante solida para una app chica:

- Auth por cookies HttpOnly y same-origin bien orientado.
- Backend, frontend, builds y e2e backend pasan.
- Hay trazabilidad, sesiones por dispositivo, backup SQLite, restore drill y health operacional.
- La app arranca y los flujos principales funcionan.

Los bloqueantes reales no estan en estabilidad general sino en privacidad operativa y disponibilidad de acceso:

- los logs registran URLs y query params clinicos completos,
- el frontend persiste datos clinicos localmente por defecto y no siempre los limpia,
- y 2FA no tiene una recuperacion practica si se pierde el dispositivo.

### Riesgo global

Riesgo global: **Medio-Alto**.

### Conclusion corta

Anamneo se ve cerca de una salida productiva para 1 a 5 usuarios, pero **todavia no la considero lista para produccion** por tres motivos altos y concretos: exposicion innecesaria de informacion clinica en logs, persistencia local de PHI en navegador con limpieza incompleta, y ausencia de una ruta de recuperacion usable para 2FA.

Tambien hay varias cosas bien resueltas y eso importa: el stack compila, los tests grandes pasan, el restore drill funciona y el despliegue esta pensado con criterio simple. No hace falta una reescritura. Hace falta cerrar bien unos pocos puntos sensibles.

## 2. Veredicto de produccion

**No lista para produccion** para una app pequena de 1 a 5 usuarios.

Justificacion concreta:

1. El backend hoy registra `req.originalUrl` completo en cada request. En una EMR eso puede volcar a logs terminos clinicos, filtros de busqueda y IDs de pacientes/atenciones.
2. El frontend guarda borradores clinicos y conflictos en `localStorage`, y guardados offline en `IndexedDB`, con TTL de 24h. El logout manual los limpia, pero la expiracion por inactividad y el logout forzado por `401` no.
3. 2FA no tiene backup codes ni un flujo administrativo de recuperacion. Un reset de password no desactiva TOTP, asi que una perdida de dispositivo puede dejar fuera al unico medico.
4. La cobertura automatizada del flujo clinico mas sensible no esta confiable: el Playwright de completar y firmar falla por selector desfasado.

Si esos puntos se corrigen, el resto del producto esta razonablemente bien orientado para un consultorio chico.

## 3. Hallazgos criticos y altos

No confirme hallazgos **criticos**. Si confirme los siguientes hallazgos **altos**:

| Severidad | Titulo | Archivo(s) afectados | Descripcion | Impacto | Recomendacion | Esfuerzo |
|---|---|---|---|---|---|---|
| Alto | Logs HTTP exponen rutas y query params clinicos completos | `backend/src/common/utils/request-tracing.ts` | El middleware loguea `req.originalUrl` completo. Durante la auditoria quedaron registradas requests como `/api/analytics/clinical/summary?condition=...`, ademas de IDs de pacientes y encounters. | Riesgo potencial alto en produccion: los logs pueden terminar conteniendo busquedas clinicas, identificadores y contexto sensible fuera del circuito clinico. | Loguear ruta normalizada o plantillas de endpoint, eliminar query params clinicos/IDs del log, y agregar tests para redaccion. | Bajo-Medio |
| Alto | Persistencia local de datos clinicos con limpieza incompleta | `frontend/src/lib/encounter-draft.ts`, `frontend/src/lib/offline-queue.ts`, `frontend/src/stores/auth-store.ts`, `frontend/src/lib/useSessionTimeout.ts`, `frontend/src/lib/api.ts` | Se guardan borradores/conflictos en `localStorage` y cola offline en `IndexedDB` por 24h. La limpieza esta detras de `logout({ clearLocalState: true })`, pero los caminos automaticos (`401`, refresh fallido, inactividad) llaman `logout()` sin esa limpieza. | Riesgo potencial alto en produccion, especialmente en notebooks o boxes compartidos: pueden quedar datos clinicos en el navegador aun despues de expirar la sesion. | Limpiar siempre estado local clinico en cualquier logout, timeout o `401`. Ademas, decidir si el modo equipo compartido debe venir activado por defecto o configurable por politica. | Medio |
| Alto | No existe recuperacion operativa de 2FA si se pierde el dispositivo | `backend/src/auth/auth-totp.service.ts`, `backend/src/users/users-service.helpers.ts` | Hay setup, enable y disable de 2FA, pero no backup codes ni flujo administrativo para resetear TOTP. El reset de password solo cambia password y revoca sesiones; no toca `totpEnabled` ni `totpSecret`. | Riesgo alto de indisponibilidad: una sola profesional podria quedar bloqueada fuera del sistema sin camino simple de recuperacion. | Agregar backup codes o un flujo admin auditado de "reset 2FA". Para este proyecto chico, con eso alcanza; no hace falta un sistema enterprise. | Medio |

## 4. Bugs e inconsistencias funcionales

### Confirmados

1. **El E2E del flujo clinico final ya no representa la UI real.**
   - El test `frontend/tests/e2e/workflow-clinical.spec.ts` busca un boton con `/agregar medicamento/i`.
   - La UI actual renderiza el boton como `Agregar manual` en `frontend/src/components/sections/StructuredMedicationsEditor.parts.tsx`.
   - Resultado observado: 9/10 tests del flujo clinico pasan y falla precisamente `complete and sign encounter clinically`.
   - Impacto: no rompe la app en si, pero deja sin red de seguridad automatica el flujo de completar y firmar.
   - Severidad recomendada: **Medio**.

2. **El login siempre sugiere `Crear cuenta`, aun cuando el registro publico esta cerrado.**
   - `frontend/src/app/login/page.tsx` mantiene el link a `/register` de forma fija.
   - `frontend/src/app/register/page.tsx` luego detecta `hasAdmin` y, sin token de invitacion, muestra `Necesita una invitacion valida para crear una cuenta.`
   - Impacto: friccion y confusion para usuarios invitados o para equipos chicos donde casi todo alta posterior es por invitacion.
   - Severidad recomendada: **Bajo**.

3. **`npm run dev` levanta, pero la integracion Sentry del frontend esta incompleta.**
   - El arranque emite warnings de Next/Sentry sobre falta de `instrumentation` y `global-error`.
   - Impacto: no bloquea operacion, pero reduce visibilidad de errores justo en un producto que quiere trazabilidad.
   - Severidad recomendada: **Bajo**.

### Observaciones positivas

- `npm run dev` si levanta correctamente la app y el login responde.
- Backend e2e principal pasa completo, lo que da bastante confianza en auth, permisos, aislamiento de datos y workflow base.
- Frontend smoke e2e tambien pasa, asi que login, redirect y bootstrap privado estan bien.

## 5. Seguridad y privacidad

### Riesgos observados en este entorno de desarrollo

1. **No trate los datos vistos como incidente real.** Los datos del entorno son ficticios o de prueba, y la auditoria se hizo en desarrollo.
2. **El monitor SQLite estaba en warning por backup viejo** hasta que ejecute manualmente `db:sqlite:backup`. Esto en dev no es incidente real, pero si muestra que el estado operacional no se sostiene solo sin correr el runner o el cron.
3. **El backend de desarrollo escucha en `0.0.0.0`.** No es problema directo aqui, pero en una maquina compartida o en una LAN abierta deja una superficie mas amplia de la necesaria.

### Riesgos potenciales si se despliega asi en produccion

1. **Exposicion de PHI en logs**.
   - Hallazgo alto ya descrito.
   - Para una EMR chica esto importa mas que tener observabilidad sofisticada.
   - Solucion simple: no loguear query strings clinicos ni rutas crudas con IDs.

2. **PHI residual en el navegador**.
   - El producto tiene una buena idea (`modo equipo compartido`), pero viene como opt-in local y no limpia todos los caminos de cierre de sesion.
   - En produccion esto deberia endurecerse.

3. **Recuperacion de acceso debil frente a 2FA perdido**.
   - Es un riesgo de disponibilidad mas que de confidencialidad, pero para una app unipersonal puede ser tan grave como una falla de seguridad.

4. **Verificacion de integridad de auditoria solo parcial por default y no expuesta en UI**.
   - El endpoint `GET /api/audit/integrity/verify` existe, pero el controlador usa `limit=1000` por defecto.
   - El servicio devuelve warning cuando verifica solo una parte de la cadena.
   - No encontre consumo frontend del endpoint en `frontend/src`.
   - Riesgo: dar por "verificada" una auditoria incompleta si la base crece.
   - Severidad recomendada: **Medio**.

5. **Vulnerabilidades de dependencias no criticas, pero presentes.**
   - `npm audit --omit=dev --audit-level=high` no mostro altas ni criticas, solo moderadas.
   - No bloquea por si solo la salida productiva de una app chica, pero conviene resolverlo antes o en la primera semana.

### Lo que esta bien resuelto

- `.env` y `.env.*` estan ignorados; `.env.example` queda versionado.
- `assertSafeConfig()` impone secretos minimos, `BOOTSTRAP_TOKEN`, `SETTINGS_ENCRYPTION_KEY`, confirmacion de cifrado en reposo y guardrail para SQLite en produccion.
- Frontend usa `/api` same-origin y cookies `HttpOnly`, que es la decision correcta para este producto.
- Hay sesiones persistidas por dispositivo, revocacion y UI para gestion de sesiones.

## 6. Modelo de datos e integridad clinica

### Lo bueno

- El modelo `Patient` + `PatientHistory` + `Encounter` + `EncounterSection` esta bien orientado para una EMR chica.
- Existe gating de salida clinica segun completitud del paciente.
- `Encounter` tiene estado, revision, cierre y firma.
- Consentimientos, alertas, adjuntos y export bundle tienen una base razonable.
- `PatientsExportBundleService` si aplica scope por medico y usa path resolution defensivo para archivos.

### Riesgos y observaciones

1. **Muchos estados clinicos y operativos estan como `String`, no enums de DB.**
   - No es un blocker para este tamano, pero obliga a mantener DTOs y servicios muy alineados.
   - Hoy eso esta relativamente bien cubierto por tests; conviene mantener esa disciplina.

2. **La cadena de integridad de auditoria se arma con dos pasos (`find last` -> `insert`).**
   - En `AuditService.log()` no hay un mecanismo extra de serializacion o unicidad para evitar ramas de hash si dos escrituras concurrentes leen el mismo ultimo hash antes de insertar.
   - Para 1-5 usuarios el riesgo es bajo, pero existe como deuda tecnica probable.
   - Lo marcaria como **Medio** y como inferencia razonable, no como bug ya reproducido.

3. **La verificacion de restore no ejercio adjuntos reales en esta auditoria.**
   - El restore drill paso, pero con `attachmentCount: 0`.
   - O sea: se valido la restauracion de la DB, no la recuperacion real de adjuntos en un caso con archivos presentes.
   - Esto no invalida la solucion; solo limita la confianza empirica actual.

4. **Falta elevar el diagnostico elegido a dato estructurado de primer orden.**
   - El producto tiene sugerencias, catalogos y logs, pero sigue siendo una deuda razonable del propio backlog.
   - No es bug actual; si es una mejora de integridad semantica muy alineada con una EMR.

## 7. Mantenibilidad y deuda tecnica

1. **Existe deuda visible en tamano de archivos.**
   - `FILES_OVER_300_LINES.md` sigue listando paginas, hooks y suites grandes en frontend y backend.
   - No es dramatica, pero si aumenta el costo de tocar flujos sensibles como atenciones, ajustes y tests E2E.

2. **La configuracion de Sentry quedo a medio migrar para Next 16.**
   - Hay `sentry.client.config.ts` y `sentry.server.config.ts`, pero faltan `instrumentation` y `global-error` segun los warnings reales de arranque.

3. **La suite automatizada esta fuerte, pero hay drift en el borde mas importante del frontend.**
   - Esto pesa mas que la cantidad de tests: cuando falla el flujo mas sensible por selector fragil, la confianza operativa baja.

4. **Las vulnerabilidades de dependencias son moderadas y acotadas.**
   - No ameritan una reingenieria, pero si un cierre ordenado.

### Balance general de mantenibilidad

Buena para el tamano del proyecto, con deuda manejable. No veo necesidad de grandes redisenos. La prioridad no es arquitectura enterprise; es terminar de endurecer seguridad operativa, pulir UX de acceso y mantener los tests del flujo clinico finos.

## 8. Funcionalidades sugeridas alineadas con Anamneo

### Imprescindibles

1. **Recuperacion de 2FA auditada**
   - Valor real: evita lockout del unico medico o del pequeno equipo.
   - Solucion proporcionada: backup codes o reset administrativo de 2FA con auditoria.

2. **Politica de privacidad para equipos compartidos**
   - Valor real: en consultorios chicos es comun usar notebooks o PCs compartidos.
   - Solucion proporcionada: modo compartido forzado por defecto o configurable globalmente, y purga total de borradores locales en cualquier cierre de sesion.

3. **Verificacion de integridad y estado operacional visible en admin**
   - Valor real: la persona que opera la app necesita ver rapido backup fresco, restore drill vigente y estado de auditoria, sin usar endpoints manuales.

### Muy utiles

1. **Diagnostico final como dato estructurado del encuentro**
   - Valor real: mejora lectura clinica, exportacion, filtros y continuidad de atencion.

2. **Plantillas clinicas reutilizables (SOAP, control, receta, seguimiento)**
   - Valor real: acelera documentacion repetitiva sin agregar complejidad operativa.

3. **Previsualizacion segura de adjuntos dentro del encounter/ficha**
   - Valor real: evita descargar todo para revisar examenes y mejora la consulta rapida.

### Opcionales

1. **Explicabilidad visible de sugerencias diagnosticas**
   - Valor real: da confianza al medico sin convertir el producto en un sistema de IA complejo.

2. **Busqueda avanzada de pacientes por criterios clinicos y administrativos**
   - Valor real: ayuda cuando la base crezca a algunos miles de registros, aunque siga siendo una app chica.

3. **Checklist pre-consulta / panel de pendientes**
   - Valor real: sirve mucho a recepcion o asistencia para no pasar a consulta con ficha incompleta.

## 9. Quick wins

1. Dejar de loguear `req.originalUrl` completo; sanitizar query params e IDs sensibles.
2. Limpiar siempre `localStorage` clinico e `IndexedDB` en cualquier camino de logout, timeout o refresh fallido.
3. Corregir el selector de Playwright del flujo de firma usando `data-testid` o un nombre accesible estable.
4. Exponer en UI admin el endpoint `/api/audit/integrity/verify` y mostrar claramente cuando la verificacion fue parcial.
5. Completar la migracion de Sentry a `instrumentation` / `global-error` o desactivar Sentry hasta configurarlo bien.
6. Ejecutar `npm audit fix` donde no implique cambios breaking y revisar el resto manualmente.

## 10. Checklist minimo antes de produccion

1. Redactar o simplificar logs HTTP para no almacenar informacion clinica en URLs.
2. Endurecer el manejo de persistencia local clinica: limpiar siempre y decidir politica por defecto para equipos compartidos.
3. Implementar una recuperacion simple y auditada para 2FA.
4. Arreglar y rerunear el flujo E2E de completar + firmar atencion.
5. Verificar que el host de produccion corra backup fresco + restore drill segun runbook, y no solo por ejecucion manual.
6. Cerrar warnings de Sentry o dejarlo explicitamente deshabilitado hasta completar la configuracion.
7. Revisar y actualizar dependencias con vulnerabilidades moderadas de produccion.
8. Repetir smoke final sobre el hostname HTTPS real del despliegue soportado (`cloudflared` + same-origin `/api`).

## 11. Supuestos y limitaciones

1. La auditoria se hizo en desarrollo y con datos ficticios; no reporte la mera presencia de esos datos como incidente real.
2. No inspeccione el `.env` real para no exponer secretos locales; me base en `.env.example`, validaciones de arranque y `docker-compose.yml`.
3. No desplegue `docker compose` + `cloudflared` completo contra un host publico; evalua el modelo soportado, pero no lo certifique extremo a extremo.
4. No ejecute toda la suite Playwright completa; si ejecute smoke y el flujo clinico principal.
5. El restore drill que corri no valido adjuntos reales porque el backup auditado no tenia adjuntos cargados.
6. El riesgo de posible bifurcacion de la cadena de auditoria por concurrencia es una inferencia de diseno basada en codigo, no una falla reproducida durante esta auditoria.

## Cierre

Para una EMR chica, Anamneo ya tiene bastante mas estructura que muchos proyectos de este tamano: permisos, auditoria, backups, restore drill, auth same-origin, tests y un modelo clinico razonable. El problema no es falta de base; es que todavia hay tres decisiones operativas y de privacidad que conviene cerrar antes de usarla con datos reales.

Mi lectura final es pragmatica: no hace falta enterprise, no hace falta reescribir, y SQLite no es el enemigo aqui. Lo que si hace falta es dejar de filtrar contexto clinico a logs, tratar con mas rigor la persistencia local del navegador y asegurarse de que perder el telefono con 2FA no deje fuera a quien atiende.