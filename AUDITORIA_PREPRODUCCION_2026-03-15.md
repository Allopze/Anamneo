# Auditoria Preproduccion - Anamneo

Fecha: 2026-03-15

## Resumen Ejecutivo

El estado actual baja de riesgo alto-critico a riesgo medio, con avances concretos sobre bloqueadores criticos y hallazgos altos priorizados. Se mitigo en codigo el borrado clinico destructivo con restauracion, se saneo el tracking de artefactos generados, se endurecio parte del arranque/configuracion de produccion, se aplico revocacion/rotacion stateful de refresh tokens con sesiones por dispositivo, se restringio lectura de settings, se reforzaron criterios de cierre clinico, se endurecio la capa de adjuntos (firma binaria y path allowlist) y se agregaron gates de CI para secretos, lint, typecheck y auditoria de dependencias. Persisten pendientes de seguridad y gobernanza antes de salida a produccion.

Veredicto: aun no listo para produccion ni recomendable para piloto con pacientes reales hasta cerrar pendientes criticos remanentes y hallazgos altos residuales.

Alcance de esta auditoria: revision estatica de codigo backend/frontend/DB/CI y evidencia de repositorio. No incluye pentest activo ni pruebas de carga en entorno desplegado.

## Actualizacion de remediacion (corte 2026-03-15)

### Critico 1) Exposicion de secretos y artefactos sensibles versionados

- Estado: PARCIALMENTE MITIGADO.
- Completado:
	- Exclusiones ampliadas para entorno y artefactos en [.gitignore](.gitignore#L2), [.gitignore](.gitignore#L14), [.gitignore](.gitignore#L23).
	- Desindexacion de caches/builds generados (backend/dist, backend/node_modules, .next) para evitar nueva exposicion por commits accidentales.
- Pendiente:
	- Rotacion inmediata de secretos JWT en todos los entornos.
	- Limpieza del historial Git (no solo working tree) para eliminar material sensible historico.
	- Endurecer reglas del secret scanning (patrones propios + baseline de falsos positivos).

### Critico 2) Borrado clinico destructivo con cascada

- Estado: MITIGADO Y VALIDADO E2E.
- Completado:
	- Eliminacion de paciente ahora archiva en vez de borrar fisicamente en [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts#L465).
	- Restauracion de paciente archivado en [backend/src/patients/patients.controller.ts](backend/src/patients/patients.controller.ts#L130), [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts#L516).
	- Campos de archivado en modelo de datos en [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L50).
	- Migracion aplicada para soporte de archivado en [backend/prisma/migrations/20260315130000_soft_delete_patients/migration.sql](backend/prisma/migrations/20260315130000_soft_delete_patients/migration.sql#L1).
	- Cobertura funcional e2e de archivado/restauracion en [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts#L381), [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts#L396).
- Pendiente:
	- Politica formal de retencion legal (plazos, bloqueo de purge, procedimientos).

### Critico 3) Capa de datos de produccion no endurecida

- Estado: PARCIALMENTE MITIGADO (SQLITE COMO DECISION OPERATIVA).
- Completado:
	- Scripts migratorios endurecidos: [backend/package.json](backend/package.json#L15), [backend/package.json](backend/package.json#L24), [backend/package.json](backend/package.json#L26).
	- Arranque de contenedor con deploy de migraciones en [backend/Dockerfile](backend/Dockerfile#L40).
	- Validaciones de secretos reforzadas al arranque en [backend/src/main.ts](backend/src/main.ts#L45), [backend/src/main.ts](backend/src/main.ts#L49).
	- Endurecimiento SQLite al iniciar conexion (WAL/synchronous/busy_timeout/wal_autocheckpoint) en [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts#L183).
	- Scripts operativos de backup y restore drill en [backend/scripts/sqlite-backup.js](backend/scripts/sqlite-backup.js#L1), [backend/scripts/sqlite-restore-drill.js](backend/scripts/sqlite-restore-drill.js#L1), [backend/scripts/sqlite-monitor.js](backend/scripts/sqlite-monitor.js#L1).
	- Runner operacional para scheduler con notificacion webhook (backup + drill por cadencia + monitor estricto) en [backend/scripts/sqlite-ops-runner.js](backend/scripts/sqlite-ops-runner.js#L1), [backend/package.json](backend/package.json#L33), [package.json](package.json#L16).
	- Monitoreo de estado SQLite (WAL, backups, umbrales) en [backend/src/health.controller.ts](backend/src/health.controller.ts#L30), [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts#L264).
	- Documentacion alineada a migraciones versionadas en [README.md](README.md#L67), [README.md](README.md#L87).
- Pendiente:
	- Activar scheduler y webhook reales en entorno productivo (actualmente listo a nivel de codigo/runbook).
	- Ejecutar evidencia periodica (runbooks + simulacros) en entorno productivo real.
	- Politica CI/CD con review obligatoria de migraciones.

## Hallazgos Criticos

### 1) Exposicion de secretos y artefactos sensibles versionados (PARCIAL)

- Problema: el repositorio contiene secretos reales y datos/artefactos no publicables.
- Importancia: compromete confidencialidad y eleva riesgo de acceso no autorizado.
- Evidencia: [.env](.env#L33), [.env](.env#L41), [.env](.env#L20), [backend/prisma/dev.db](backend/prisma/dev.db), [.next/trace](.next/trace).
- Manifestacion/explotacion: cualquier clon o fuga del repositorio puede habilitar firma de tokens y acceso a datos historicos locales.
- Impacto tecnico y clinico: secuestro de sesion/API y potencial exposicion de datos de pacientes.
- Validacion (baseline pre-remediacion): salida de control de archivos versionados confirmaba seguimiento de entorno, DB local y build artifacts.
- Actualizacion 2026-03-15: se mitigaron commits accidentales futuros mediante exclusiones y desindexacion; el riesgo principal residual es historico (rotacion y limpieza de historial).
- Remediacion concreta: rotar JWT secretos hoy mismo, retirar .env/dev.db/.next del historial (no solo del working tree), crear politica de secretos con escaneo en CI, y separar configuracion por entorno con gestor de secretos.

### 2) Borrado clinico destructivo con cascada (MITIGADO EN CODIGO)

- Problema: eliminacion de paciente borra el registro de forma definitiva y arrastra relaciones clinicas.
- Importancia: riesgo regulatorio y medico-legal (retencion, trazabilidad, reconstruccion clinica).
- Evidencia: [backend/src/patients/patients.controller.ts](backend/src/patients/patients.controller.ts#L118), [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts#L462), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L76), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L91).
- Manifestacion/explotacion: un medico con sesion valida puede eliminar historia completa sin periodo de gracia.
- Impacto tecnico y clinico: perdida irreversible de continuidad asistencial y de evidencia clinica.
- Validacion (baseline pre-remediacion): endpoint DELETE activo y borrado fisico con cascada en relaciones.
- Actualizacion 2026-03-15: el endpoint DELETE conserva semantica de negocio pero ahora archiva (soft delete) y registra auditoria de archivado.
- Remediacion concreta: reemplazar por soft delete + estado archivado + retencion legal, bloquear hard delete en API productiva, y agregar flujo de eliminacion con doble control y ventana de recuperacion.

### 3) Capa de datos de produccion no endurecida (PARCIAL)

- Problema: la app exige SQLite por diseno de arranque y scripts de produccion usan sincronizacion no migratoria.
- Importancia: disponibilidad, concurrencia, backup/recovery y gobernanza de cambios insuficientes para operacion clinica.
- Evidencia: [backend/src/main.ts](backend/src/main.ts#L25), [backend/src/main.ts](backend/src/main.ts#L26), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L9), [backend/package.json](backend/package.json#L24).
- Manifestacion/explotacion: riesgo de corrupcion/bloqueos bajo carga y deriva de esquema por cambios directos.
- Impacto tecnico y clinico: indisponibilidad o inconsistencias durante atencion.
- Validacion (baseline pre-remediacion): validacion de arranque fuerza formato file y scripts productivos usaban prisma db push.
- Actualizacion 2026-03-15: se sustituyo db push por migraciones en scripts/README y arranque Docker. Adicionalmente se aplicaron PRAGMAs operativos de SQLite (WAL/synchronous/busy_timeout/wal_autocheckpoint), backup consistente por `VACUUM INTO`, restore drill automatizable y endpoint de monitoreo operativo. SQLite se mantiene por decision de arquitectura y requiere disciplina de ejecucion operacional.
- Remediacion concreta: mantener migraciones versionadas revisadas en CI/CD, automatizar jobs de backup/drill con alertas, agregar evidencia periodica de restore exitoso, cifrado en reposo y monitoreo.

## Hallazgos Altos

### 4) Refresh token sin rotacion ni revocacion de servidor (MITIGADO)

- Problema: refresco JWT verificado de forma stateless, sin jti/store de revocacion; logout limpia cookie pero no invalida token emitido.
- Importancia: si se filtra un refresh token, conserva valor hasta expiracion.
- Evidencia: [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L95), [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L97), [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L106), [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts#L123).
- Manifestacion/explotacion: sesion robada puede seguir renovandose durante ventana de vida.
- Impacto tecnico y clinico: acceso prolongado no autorizado a datos clinicos.
- Validacion (baseline pre-remediacion): no habia persistencia de revocacion ni rotacion stateful.
- Actualizacion 2026-03-15: se implemento modelo stateful de refresh con versionado global de usuario + sesiones por dispositivo, validacion de identificador/version de sesion y revocacion selectiva en logout, con invalidacion global en cambio de contraseña en [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L104), [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts#L106), [backend/src/users/users.service.ts](backend/src/users/users.service.ts#L182), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L33), [backend/prisma/migrations/20260315173500_add_refresh_token_version/migration.sql](backend/prisma/migrations/20260315173500_add_refresh_token_version/migration.sql#L1), [backend/prisma/migrations/20260315194000_add_user_sessions/migration.sql](backend/prisma/migrations/20260315194000_add_user_sessions/migration.sql#L1).
- Remediacion concreta: agregar deteccion de reuse/anomalias por sesion, expiracion adaptativa por riesgo y vista operativa de sesiones activas para revocacion administrativa.

### 5) Criterio de cierre clinico demasiado laxo

- Problema: completar atencion solo exige dos secciones obligatorias.
- Importancia: se puede cerrar ficha clinicamente incompleta.
- Evidencia: [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts#L382), [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts#L383), [backend/src/encounters/encounters.controller.ts](backend/src/encounters/encounters.controller.ts#L108).
- Manifestacion/explotacion: cierre prematuro por presion de tiempo o error operativo.
- Impacto tecnico y clinico: perdida de calidad documental, riesgo asistencial y legal.
- Validacion (baseline pre-remediacion): validacion de complete restringia a IDENTIFICACION y MOTIVO_CONSULTA.
- Actualizacion 2026-03-15: se ampliaron secciones obligatorias para cierre y se agrego validacion semantica minima de contenido en [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts#L45), [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts#L430), con cobertura e2e de rechazo por incompletitud en [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts#L465).
- Remediacion concreta: evolucionar a reglas por tipo de atencion (perfil configurable) y validaciones clinicas mas ricas previas al cierre.

### 6) Endurecimiento insuficiente en archivos adjuntos (PARCIAL)

- Problema: validacion basada en mimetype/extension; descarga usa ruta almacenada sin verificacion fuerte de integridad/allowlist de path.
- Importancia: riesgo de subir contenido malicioso disfrazado y de abuso en manejo de archivos.
- Evidencia: [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L26), [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L27), [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L33), [backend/src/attachments/attachments.controller.ts](backend/src/attachments/attachments.controller.ts#L58).
- Manifestacion/explotacion: archivo poliglota o payload no esperado pasa filtro superficial.
- Impacto tecnico y clinico: riesgo operacional y reputacional; posible vector lateral.
- Validacion (baseline pre-remediacion): no se observaba inspeccion de firma magica ni controles fuertes de path.
- Actualizacion 2026-03-15: se implemento validacion por firma binaria, normalizacion/saneamiento de nombre, y allowlist de rutas para lectura/eliminacion en [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L10), [backend/src/attachments/attachments.service.ts](backend/src/attachments/attachments.service.ts#L13), [backend/src/attachments/attachments.service.ts](backend/src/attachments/attachments.service.ts#L31), [backend/src/attachments/attachments.controller.ts](backend/src/attachments/attachments.controller.ts#L58).
- Remediacion concreta: agregar escaneo antimalware y pipeline de normalizacion/re-encode de archivos antes de disponibilizarlos.

### 7) Gobernanza de calidad y seguridad incompleta en CI (PARCIAL)

- Problema: CI ejecuta tests/build pero no linters, typecheck estricto, SAST, dependencia vulnerable ni escaneo de secretos; frontend no tiene suite de pruebas efectiva en codigo de producto.
- Importancia: regresiones y fallos de seguridad pueden pasar a release.
- Evidencia: [.github/workflows/ci.yml](.github/workflows/ci.yml#L28), [.github/workflows/ci.yml](.github/workflows/ci.yml#L32), [.github/workflows/ci.yml](.github/workflows/ci.yml#L59), [frontend/package.json](frontend/package.json#L10).
- Manifestacion/explotacion: cambios criticos sin cobertura clinica/seguridad pasan a produccion.
- Impacto tecnico y clinico: incidentes evitables y menor confiabilidad del flujo asistencial.
- Validacion: se agregaron gates de secretos, lint, typecheck y auditoria de dependencias en [.github/workflows/ci.yml](.github/workflows/ci.yml#L10), [.github/workflows/ci.yml](.github/workflows/ci.yml#L42), [.github/workflows/ci.yml](.github/workflows/ci.yml#L46), [.github/workflows/ci.yml](.github/workflows/ci.yml#L50), [.github/workflows/ci.yml](.github/workflows/ci.yml#L88), [.github/workflows/ci.yml](.github/workflows/ci.yml#L92), [.github/workflows/ci.yml](.github/workflows/ci.yml#L96).
- Remediacion concreta: completar SAST/SBOM/firma de artefactos y suite de pruebas frontend para cobertura bloqueante integral.

## Hallazgos Medios

### 8) Puntaje de confianza de IA potencialmente enganoso

- Problema: confianza relativa al top resultado, no calibrada clinicamente.
- Importancia: puede inducir sobreconfianza diagnostica en UI.
- Evidencia: [backend/src/conditions/conditions-similarity.service.ts](backend/src/conditions/conditions-similarity.service.ts#L123), [backend/src/conditions/conditions-similarity.service.ts](backend/src/conditions/conditions-similarity.service.ts#L129), [backend/src/conditions/conditions-similarity.service.ts](backend/src/conditions/conditions-similarity.service.ts#L200).
- Manifestacion/explotacion: valores altos aunque la base semantica sea debil.
- Impacto tecnico y clinico: sesgo cognitivo y sugerencias no robustas.
- Validacion: calculo de confianza normaliza por maxScore local.
- Remediacion concreta: calibracion offline, umbral de abstencion, explicabilidad por terminos y etiquetado explicito de herramienta de apoyo no diagnostica.

### 9) Auditoria clinica minimizada en exceso

- Problema: diffs clinicos se redacted/minimizan ampliamente.
- Importancia: protege privacidad, pero puede degradar trazabilidad para auditoria forense legal.
- Evidencia: [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts#L117), [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts#L142), [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts#L149), [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts#L159).
- Manifestacion/explotacion: dificultad para reconstruir decisiones clinicas editadas.
- Impacto tecnico y clinico: menor capacidad de analisis post-incidente.
- Validacion: estrategia actual resume y oculta gran parte del contenido clinico.
- Remediacion concreta: separar auditoria operacional vs clinica; almacenar hash encadenado + metadata granular de cambio con acceso controlado.

### 10) Lectura de ajustes globales abierta a cualquier autenticado (MITIGADO)

- Problema: endpoint de lectura sin restriccion de rol especifico.
- Importancia: filtracion de metadata organizacional interna.
- Evidencia: [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L21), [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L23), [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L27).
- Manifestacion/explotacion: usuario no admin consulta configuracion de clinica.
- Impacto tecnico y clinico: exposicion innecesaria de informacion operacional.
- Validacion (baseline pre-remediacion): solo update estaba restringido a ADMIN, lectura no.
- Actualizacion 2026-03-15: lectura restringida a ADMIN en [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L20) y cobertura e2e de autorizacion en [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts#L529).
- Remediacion concreta: mantener endpoint publico separado solo para llaves no sensibles si negocio lo requiere.

## Riesgos Priorizados

1. Compromiso de secretos y fuga de datos por repositorio.
2. Riesgo operacional residual de SQLite por dependencia de disciplina de ejecucion (jobs/alertas/evidencia) aunque con hardening tecnico base implementado.
3. Riesgo residual en adjuntos (falta escaneo antimalware y normalizacion avanzada).
4. Cierre clinico aun sin reglas diferenciadas por tipo de atencion.
5. Gobernanza CI aun incompleta en SAST/SBOM y pruebas frontend bloqueantes.

Nota: el riesgo de perdida irreversible por borrado duro queda mitigado en codigo y pasa a seguimiento de validacion operacional.

## Veredicto Final

No apto para produccion en estado actual, con mejora parcial respecto al baseline inicial.

No apto para piloto con pacientes reales hasta cerrar bloqueadores criticos y altos.

Apto solo para entorno de desarrollo/demo controlado sin datos reales.

## Plan de Remediacion por Fases

### Fase 0 (48-72 horas, contencion inmediata)

- [ ] Rotar todos los secretos y credenciales.
- [ ] Retirar secretos y artefactos sensibles del historial.
- [x] Crear exclusiones de repositorio en raiz.
- [x] Deshabilitar borrado fisico de pacientes (archivado en lugar de delete fisico).
- [x] Activar escaneo de secretos en CI.
- [ ] Congelar releases hasta cierre de pendientes criticos.

### Fase 1 (1-2 semanas, seguridad y continuidad clinica)

- [x] Implementar soft delete base (archivedAt/archivedById + endpoint de archivado).
- [x] Implementar restauracion operativa base de ficha archivada.
- [ ] Completar retencion legal y controles de restauracion.
- [x] Endurecer archivos adjuntos base (firma binaria + path allowlist).
- [ ] Incorporar escaneo antimalware y re-encode seguro de adjuntos.
- [x] Reforzar reglas base de cierre clinico (secciones y semantica minima).
- [ ] Ajustar criterios por tipo de atencion con politica configurable.
- [x] Restringir exposicion de settings.

### Fase 2 (2-4 semanas, identidad y plataforma)

- [x] Migrar refresh tokens a modelo rotatorio/revocable global.
- [x] Instrumentar sesiones por dispositivo.
- [x] Endurecer operacion SQLite productiva base (WAL, backup/restore drill, monitoreo tecnico).
- [ ] Operacionalizar backups y restore drills con scheduler/alertas y evidencia recurrente.

### Fase 3 (3-6 semanas, calidad regulatoria)

- [x] CI con gates base de seguridad/calidad (secret scan, lint, typecheck, audit deps).
- [ ] Completar CI con SAST/SBOM/firma de artefactos.
- Pruebas frontend de flujo clinico critico.
- Revision de auditoria legal/tecnica con trazabilidad balanceada.
- Validacion de IA con metricas clinicas y threshold de abstencion.

## Checklist de Segunda Auditoria (Go/No-Go)

1. Confirmacion de rotacion y revocacion efectiva de secretos/tokens.
2. Verificacion de que no hay archivos sensibles versionados.
3. Evidencia de soft delete, retencion y restauracion de ficha clinica.
4. Prueba de carga y recuperacion de base de datos productiva.
5. Test de integracion de cierre clinico con criterios completos.
6. Pentest focalizado en sesion, subida de archivos y autorizacion.
7. CI bloqueante con lint, typecheck, SAST/SCA, secretos y cobertura minima.
8. Validacion de trazabilidad medico-legal de auditoria.
9. Evaluacion de IA con seguridad clinica documentada.
