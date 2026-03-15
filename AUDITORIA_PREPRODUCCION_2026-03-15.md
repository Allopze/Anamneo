# Auditoria Preproduccion - Anamneo

Fecha: 2026-03-15

## Resumen Ejecutivo

El estado actual es de riesgo alto-critico para uso clinico real. Hay tres bloqueadores mayores: exposicion operativa de secretos y artefactos sensibles versionados, borrado destructivo de historia clinica con cascada, y base de datos/operacion no endurecida para produccion.

Veredicto: no listo para produccion y no recomendable para piloto con pacientes reales hasta cerrar fase de remediacion inmediata.

Alcance de esta auditoria: revision estatica de codigo backend/frontend/DB/CI y evidencia de repositorio. No incluye pentest activo ni pruebas de carga en entorno desplegado.

## Hallazgos Criticos

### 1) Exposicion de secretos y artefactos sensibles versionados

- Problema: el repositorio contiene secretos reales y datos/artefactos no publicables.
- Importancia: compromete confidencialidad y eleva riesgo de acceso no autorizado.
- Evidencia: [.env](.env#L33), [.env](.env#L41), [.env](.env#L20), [backend/prisma/dev.db](backend/prisma/dev.db), [frontend/.next/BUILD_ID](frontend/.next/BUILD_ID).
- Manifestacion/explotacion: cualquier clon o fuga del repositorio puede habilitar firma de tokens y acceso a datos historicos locales.
- Impacto tecnico y clinico: secuestro de sesion/API y potencial exposicion de datos de pacientes.
- Validacion: salida de control de archivos versionados confirma seguimiento de entorno, DB local y build artifacts.
- Remediacion concreta: rotar JWT secretos hoy mismo, retirar .env/dev.db/.next del historial (no solo del working tree), crear politica de secretos con escaneo en CI, y separar configuracion por entorno con gestor de secretos.

### 2) Borrado clinico destructivo con cascada

- Problema: eliminacion de paciente borra el registro de forma definitiva y arrastra relaciones clinicas.
- Importancia: riesgo regulatorio y medico-legal (retencion, trazabilidad, reconstruccion clinica).
- Evidencia: [backend/src/patients/patients.controller.ts](backend/src/patients/patients.controller.ts#L118), [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts#L462), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L76), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L91).
- Manifestacion/explotacion: un medico con sesion valida puede eliminar historia completa sin periodo de gracia.
- Impacto tecnico y clinico: perdida irreversible de continuidad asistencial y de evidencia clinica.
- Validacion: endpoint DELETE activo y borrado fisico con cascada en relaciones.
- Remediacion concreta: reemplazar por soft delete + estado archivado + retencion legal, bloquear hard delete en API productiva, y agregar flujo de eliminacion con doble control y ventana de recuperacion.

### 3) Capa de datos de produccion no endurecida

- Problema: la app exige SQLite por diseno de arranque y scripts de produccion usan sincronizacion no migratoria.
- Importancia: disponibilidad, concurrencia, backup/recovery y gobernanza de cambios insuficientes para operacion clinica.
- Evidencia: [backend/src/main.ts](backend/src/main.ts#L25), [backend/src/main.ts](backend/src/main.ts#L26), [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L9), [backend/package.json](backend/package.json#L24).
- Manifestacion/explotacion: riesgo de corrupcion/bloqueos bajo carga y deriva de esquema por cambios directos.
- Impacto tecnico y clinico: indisponibilidad o inconsistencias durante atencion.
- Validacion: validacion de arranque fuerza formato file y scripts productivos usan prisma db push.
- Remediacion concreta: migrar a PostgreSQL gestionado, activar migraciones versionadas revisadas en CI/CD, cifrado en reposo, backups automaticos y pruebas de restore.

## Hallazgos Altos

### 4) Refresh token sin rotacion ni revocacion de servidor

- Problema: refresco JWT verificado de forma stateless, sin jti/store de revocacion; logout limpia cookie pero no invalida token emitido.
- Importancia: si se filtra un refresh token, conserva valor hasta expiracion.
- Evidencia: [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L95), [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L97), [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L106), [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts#L123).
- Manifestacion/explotacion: sesion robada puede seguir renovandose durante ventana de vida.
- Impacto tecnico y clinico: acceso prolongado no autorizado a datos clinicos.
- Validacion: no hay persistencia de refresh token hash, ni blacklist, ni rotacion one-time.
- Remediacion concreta: refresh token rotatorio por dispositivo con jti, hash en DB, revocacion en logout/reset-password y deteccion de reuse.

### 5) Criterio de cierre clinico demasiado laxo

- Problema: completar atencion solo exige dos secciones obligatorias.
- Importancia: se puede cerrar ficha clinicamente incompleta.
- Evidencia: [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts#L382), [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts#L383), [backend/src/encounters/encounters.controller.ts](backend/src/encounters/encounters.controller.ts#L108).
- Manifestacion/explotacion: cierre prematuro por presion de tiempo o error operativo.
- Impacto tecnico y clinico: perdida de calidad documental, riesgo asistencial y legal.
- Validacion: validacion de complete restringe a IDENTIFICACION y MOTIVO_CONSULTA.
- Remediacion concreta: reglas por tipo de atencion con set minimo obligatorio y verificaciones semanticas previas al cierre.

### 6) Endurecimiento insuficiente en archivos adjuntos

- Problema: validacion basada en mimetype/extension; descarga usa ruta almacenada sin verificacion fuerte de integridad/allowlist de path.
- Importancia: riesgo de subir contenido malicioso disfrazado y de abuso en manejo de archivos.
- Evidencia: [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L26), [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L27), [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts#L33), [backend/src/attachments/attachments.controller.ts](backend/src/attachments/attachments.controller.ts#L58).
- Manifestacion/explotacion: archivo poliglota o payload no esperado pasa filtro superficial.
- Impacto tecnico y clinico: riesgo operacional y reputacional; posible vector lateral.
- Validacion: no se observa inspeccion de firma magica ni escaneo AV en pipeline de subida.
- Remediacion concreta: validar magic bytes, re-encode de imagenes/PDF, escaneo antimalware, almacenamiento fuera de root de app, y politica de nombres/cabeceras mas estricta.

### 7) Gobernanza de calidad y seguridad incompleta en CI

- Problema: CI ejecuta tests/build pero no linters, typecheck estricto, SAST, dependencia vulnerable ni escaneo de secretos; frontend no tiene suite de pruebas efectiva en codigo de producto.
- Importancia: regresiones y fallos de seguridad pueden pasar a release.
- Evidencia: [.github/workflows/ci.yml](.github/workflows/ci.yml#L28), [.github/workflows/ci.yml](.github/workflows/ci.yml#L32), [.github/workflows/ci.yml](.github/workflows/ci.yml#L59), [frontend/package.json](frontend/package.json#L10).
- Manifestacion/explotacion: cambios criticos sin cobertura clinica/seguridad pasan a produccion.
- Impacto tecnico y clinico: incidentes evitables y menor confiabilidad del flujo asistencial.
- Validacion: no hay jobs explicitos de lint/typecheck/security scans en workflow actual.
- Remediacion concreta: anadir gates obligatorios (lint, typecheck, test unit/integration/e2e frontend, npm audit/SCA, secret scanning, SBOM y firma de artefactos).

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

### 10) Lectura de ajustes globales abierta a cualquier autenticado

- Problema: endpoint de lectura sin restriccion de rol especifico.
- Importancia: filtracion de metadata organizacional interna.
- Evidencia: [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L21), [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L23), [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts#L27).
- Manifestacion/explotacion: usuario no admin consulta configuracion de clinica.
- Impacto tecnico y clinico: exposicion innecesaria de informacion operacional.
- Validacion: solo update esta restringido a ADMIN, lectura no.
- Remediacion concreta: restringir GET segun necesidad de negocio o retornar subconjunto publico.

## Riesgos Priorizados

1. Compromiso de secretos y fuga de datos por repositorio.
2. Perdida irreversible de historia clinica por borrado duro.
3. Fragilidad de operacion clinica por SQLite y db push en produccion.
4. Persistencia de sesion comprometida por refresh tokens no revocables.
5. Cierre de atenciones clinicamente incompletas.

## Veredicto Final

No apto para produccion en estado actual.

No apto para piloto con pacientes reales hasta cerrar bloqueadores criticos y altos.

Apto solo para entorno de desarrollo/demo controlado sin datos reales.

## Plan de Remediacion por Fases

### Fase 0 (48-72 horas, contencion inmediata)

- Rotar todos los secretos y credenciales.
- Retirar secretos y artefactos sensibles del historial.
- Crear exclusiones de repositorio en raiz.
- Deshabilitar temporalmente borrado fisico de pacientes.
- Congelar releases.

### Fase 1 (1-2 semanas, seguridad y continuidad clinica)

- Implementar soft delete con retencion.
- Endurecer archivos adjuntos con validacion binaria y escaneo.
- Reforzar reglas de cierre clinico.
- Restringir exposicion de settings.

### Fase 2 (2-4 semanas, identidad y plataforma)

- Migrar refresh tokens a modelo rotatorio revocable.
- Instrumentar sesiones por dispositivo.
- Sustituir SQLite productivo por PostgreSQL y migraciones versionadas.
- Habilitar backups y restore drills.

### Fase 3 (3-6 semanas, calidad regulatoria)

- CI con gates completos de seguridad y calidad.
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
