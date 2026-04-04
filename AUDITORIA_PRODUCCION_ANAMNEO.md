# Auditoria de produccion de Anamneo

- Fecha: 2026-04-01 UTC
- Repositorio auditado: `Anamneo`
- Modalidad: inspeccion estatica del repositorio + ejecucion selectiva de `build`, `typecheck`, `lint`, `test`, `e2e` y `npm audit --omit=dev`
- Criterio: estandar alto para webapp medica con datos clinicos sensibles

## 1. Veredicto ejecutivo

**No esta lista para produccion.**

La aplicacion tiene una base funcional mejor que la media: autenticacion por cookies `HttpOnly`, validacion global, rate limiting, healthchecks, Sentry y una suite e2e backend util. Pero para una app medica eso no basta. Hoy la bloquean problemas serios de privacidad, seguridad y operacion: SQLite como ruta real de produccion, PHI duplicada en auditoria, secretos versionados en el repo y una operacion todavia demasiado manual. Los gates locales de calidad quedaron nuevamente verdes tras los fixes del 2026-04-02, pero eso no compensa los bloqueadores arquitectonicos y de compliance que siguen abiertos.

## 2. Nota final

**4.9/10 - F**

La nota es deliberadamente estricta porque la vara aqui es "apta para datos clinicos sensibles", no "funciona en local".

## 3. Tabla de puntuacion por categoria

| Categoria | Nota | Hallazgos clave | Impacto | Prioridad |
|---|---:|---|---|---|
| Arquitectura | 5.4 | Monorepo FE/BE claro, pero logica critica concentrada en archivos de 800-1600 lineas y diseno operativo centrado en SQLite | Escalado y cambios mas riesgosos | Alto |
| Calidad de codigo | 5.8 | DTOs y validacion presentes, pero mucho `any`, drift entre codigo y tests, y modulos muy grandes | Riesgo de bugs y regresiones | Alto |
| Seguridad | 4.2 | Buenas bases de auth, pero secretos versionados, endpoint operativo publico, IP spoofable y riesgo de empaquetar DB local | Compromiso de cuentas, fuga de datos, mala trazabilidad | Critico |
| Privacidad/compliance | 3.1 | Auditoria guarda payload clinico, borradores con PII en navegador, sin evidencia de cifrado at-rest/retencion/consentimiento | Fuga de PHI/PII y mala minimizacion | Critico |
| Base de datos | 3.8 | Esquema razonable e indices basicos, pero SQLite en produccion, baseline manual y DR incompleto | Locking, recuperacion fragil, baja resiliencia | Critico |
| Frontend/UX | 5.6 | Formularios razonables y validacion, pero draft sensible en `sessionStorage`, paginas enormes y poca evidencia de a11y | Error humano y exposicion local de datos | Alto |
| Backend/API | 5.9 | Guards, sesiones y validacion bien encaminados; aun asi hay sobrecarga de servicios, exposicion operativa y migraciones al arranque | Riesgo operativo y de regresion | Alto |
| Testing | 6.2 | e2e backend fuerte, pero unit/backend y frontend estan desalineados; la rama actual no queda verde | Cobertura poco confiable para release | Alto |
| DevOps/operacion | 4.3 | Hay CI, Docker, healthchecks y Sentry; faltan IaC real, rollback maduro, secreto seguro y release discipline | Despliegue inseguro y recuperacion debil | Critico |
| Rendimiento | 4.5 | SQLite bajo carga, sin cache visible y con payloads clinicos redundantes en auditoria | Degradacion bajo concurrencia real | Alto |
| Mantenibilidad | 5.2 | Hay docs y runbooks, pero deuda estructural alta y configuracion dispersa; dependencias sin CVEs altas pero con deuda moderada | Onboarding lento y cambios caros | Alto |

## 3.1 Estado de remediacion en curso

- Actualizacion 2026-04-02 UTC:
  - `4.2 Auditoria con payload clinico real`: **mitigado en codigo**. Se redaccionan diffs clinicos en backend y se agrego `npm --prefix backend run audit:redact:clinical-logs` para sanear logs historicos.
  - `4.3 Recuperacion incompleta de adjuntos clinicos`: **mitigado en repo**. Los backups SQLite ahora incluyen snapshot de `uploads` y el restore drill verifica adjuntos restaurados.
  - `4.4 Riesgo de empaquetar bases/backups locales`: **mitigado en repo**. Se endurecio `backend/.dockerignore`, se eliminaron artefactos SQLite trackeados y CI ahora falla si reaparecen `.env` o DBs locales versionadas.
  - `4.5 Secretos versionados`: **parcialmente mitigado**. Se eliminaron los symlinks `.env` trackeados y el frontend carga el `.env` compartido sin depender de archivos versionados; sigue pendiente rotacion y saneamiento de historial.
  - `4.6 Gates de calidad`: **mitigado en este checkout**. `lint`, `test`, `typecheck`, `e2e` y `build` quedaron verdes en backend/frontend despues de los ajustes.

## 4. Bloqueadores de salida a produccion

### 4.1 SQLite como ruta real de produccion

- Severidad: **Critico**
- Problema: la ruta real de produccion esta disenada alrededor de SQLite.
- Por que es grave: para una app medica critica, un unico archivo `.db` con operacion manual, locking/WAL y sin HA/PITR nativos no es una base seria de produccion.
- Evidencia:
  - [backend/prisma/schema.prisma](backend/prisma/schema.prisma): `datasource db { provider = "sqlite" }`
  - [backend/src/main.ts](backend/src/main.ts): `ALLOW_SQLITE_IN_PRODUCTION=true` como excepcion explicita
  - [README.md](README.md): seccion `Operacion SQLite en Produccion`
  - [docker-compose.yml](docker-compose.yml): variables `SQLITE_*` y servicio `backup-cron`
  - [PRISMA_SQLITE_DEPLOY.md](PRISMA_SQLITE_DEPLOY.md): runbook especifico de despliegue con SQLite
- Impacto: indisponibilidad, lock contention, recuperacion fragil y escalado pobre.
- Recomendacion concreta: migrar a PostgreSQL gestionado o equivalente con PITR, migraciones separadas del arranque y restore drill real.

### 4.2 Auditoria con payload clinico real

- Severidad: **Critico**
- Problema: la auditoria persiste y expone payload clinico real de secciones y notas clinicas.
- Por que es grave: duplica PHI fuera del registro clinico primario y la vuelve visible en la UI de auditoria; eso rompe minimizacion y amplia la superficie de fuga.
- Evidencia:
  - [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts): guarda `data: JSON.stringify(sanitizedData)` en `auditService.log(...)`
  - [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts): registra `closureNote`
  - [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts): registra `review note`
  - [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts): la minimizacion no elimina el string JSON ya serializado
  - [frontend/src/app/(dashboard)/admin/auditoria/page.tsx](frontend/src/app/(dashboard)/admin/auditoria/page.tsx): parsea y pretty-printa `selectedLog.diff`
- Impacto: fuga de PHI, crecimiento innecesario de la DB de auditoria y mayor radio de exposicion.
- Recomendacion concreta: registrar solo metadatos y hashes/resumenes, purgar o backfillear logs existentes y prohibir payload clinico en `diff`.

### 4.3 Recuperacion incompleta de adjuntos clinicos

- Severidad: **Critico**
- Problema: la recuperacion ante desastres es incompleta para adjuntos clinicos.
- Por que es grave: el backup documentado cubre SQLite, pero no asegura restaurar los archivos adjuntos que forman parte del expediente.
- Evidencia:
  - [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts): `diskStorage(...)`
  - [backend/src/attachments/attachments.service.ts](backend/src/attachments/attachments.service.ts): persiste `storagePath`
  - [backend/prisma/schema.prisma](backend/prisma/schema.prisma): modelo `Attachment.storagePath`
  - [docker-compose.yml](docker-compose.yml): volumen `uploads_data`
  - [README.md](README.md): runbook operativo centrado en backups de SQLite
- Impacto: restauraciones parciales, expedientes rotos y perdida funcional de evidencia clinica.
- Recomendacion concreta: mover adjuntos a object storage cifrado con versionado o incluir `uploads` en backup/restore y probarlo de extremo a extremo.

### 4.4 Riesgo de empaquetar bases/backups locales dentro de la imagen

- Severidad: **Critico**
- Problema: la imagen backend puede empaquetar bases SQLite y backups locales del contexto de build.
- Por que es grave: publicar una imagen con datos locales o restos WAL/SHM es inaceptable en un producto medico.
- Evidencia:
  - [backend/Dockerfile](backend/Dockerfile): `COPY . .`
  - [backend/Dockerfile](backend/Dockerfile): copia `/app/prisma` al stage final
  - [backend/.dockerignore](backend/.dockerignore): no excluye `prisma/*.db*` ni `prisma/backups/`
  - [backend/prisma/dev.db-wal.pre-reset-20260315-235721.bak](backend/prisma/dev.db-wal.pre-reset-20260315-235721.bak)
  - [backend/prisma/dev.db-shm.pre-reset-20260315-235721.bak](backend/prisma/dev.db-shm.pre-reset-20260315-235721.bak)
- Impacto: exfiltracion de datos o artefactos sensibles via registry/CI artifacts.
- Recomendacion concreta: excluir `prisma/*.db*` y `prisma/backups/` del build, limpiar el repo y hacer fallar CI si detecta DBs o backups en el contexto.

### 4.5 Secretos versionados en el repositorio

- Severidad: **Critico**
- Problema: la gestion de secretos no es de nivel produccion; hay `.env` versionados con valores configurados.
- Por que es grave: JWT, SMTP, Sentry y DB en source control destruyen la higiene minima de secretos.
- Evidencia:
  - [backend/.env](backend/.env): variables configuradas de `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_PASSWORD`, `SENTRY_DSN`
  - [frontend/.env](frontend/.env): mismo patron
  - [ci.yml](.github/workflows/ci.yml): existe secret scanning, pero igual hay `.env` versionados
- Impacto: posible bypass de auth, abuso de SMTP y rotacion forzada.
- Recomendacion concreta: rotar todo, purgar historial si aplica, mover secretos a un secret manager y dejar solo `.env.example`.

### 4.6 Rama actual no pasa todos sus gates de calidad

- Severidad: **Alto**
- Problema: el arbol actual no pasa sus propias validaciones de release.
- Por que es grave: si la rama candidata no queda verde, no hay baseline confiable para lanzar.
- Evidencia:
  - [ci.yml](.github/workflows/ci.yml): exige lint, typecheck, tests y build
  - [backend/src/auth/auth.service.spec.ts](backend/src/auth/auth.service.spec.ts): mockea `configService.get`, pero el codigo usa `getOrThrow`
  - [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts): usa `configService.getOrThrow('JWT_REFRESH_SECRET')`
  - [backend/src/common/utils/medico-id.spec.ts](backend/src/common/utils/medico-id.spec.ts): usa `require(...)` y hace caer `lint:check`
  - [frontend/src/__tests__/app/login.test.tsx](frontend/src/__tests__/app/login.test.tsx): espera boton `Iniciar sesion`
  - [frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx): renderiza `Entrar a Anamneo`
- Impacto: regresiones no controladas y baja confianza operativa.
- Recomendacion concreta: no liberar hasta dejar la suite y el checklist consistentes y verdes.

## 5. Riesgos altos pero no bloqueantes

### 5.1 Borrador de paciente en `sessionStorage`

- Severidad: **Alto**
- Problema: el formulario de alta de paciente guarda el borrador completo en `sessionStorage`.
- Por que es grave: deja PII/PHI local en navegador, especialmente riesgoso en equipos compartidos.
- Evidencia:
  - [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx): lectura del draft
  - [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx): escritura del draft completo
  - [frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx](frontend/src/app/(dashboard)/pacientes/nuevo/page.tsx): remocion solo al crear exitosamente
- Impacto: fuga local de datos sensibles.
- Recomendacion concreta: eliminar ese autosave o limitarlo a campos no sensibles con TTL explicito.

### 5.2 IP de auditoria/sesion spoofable

- Severidad: **Alto**
- Problema: la IP de sesion/auditoria confia en `x-forwarded-for` enviado por el cliente.
- Por que es grave: debilita trazabilidad forense y no repudio.
- Evidencia:
  - [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts): toma la IP desde `x-forwarded-for`
- Impacto: auditoria menos confiable.
- Recomendacion concreta: configurar `trust proxy` correctamente y aceptar IP solo desde proxies de confianza.

### 5.3 Endpoint operativo publico

- Severidad: **Alto**
- Problema: `GET /api/health/sqlite` es publico y expone metadata operativa interna.
- Por que es grave: revela tamano WAL, backups y warnings operativos sin autenticacion.
- Evidencia:
  - [backend/src/health.controller.ts](backend/src/health.controller.ts): `@Public()` en `/health/sqlite`
  - [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts): devuelve status operacional detallado
  - [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts): prueba publica del endpoint
  - [README.md](README.md): documenta el endpoint
- Impacto: fingerprinting y exposicion innecesaria de estado interno.
- Recomendacion concreta: hacerlo interno o autenticado.

### 5.4 CSV formula injection

- Severidad: **Alto**
- Problema: la exportacion CSV es vulnerable a formula injection.
- Por que es grave: nombres o campos que empiecen con `=`, `+`, `-` o `@` pueden ejecutar formulas al abrirse en Excel/Sheets.
- Evidencia:
  - [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts): exporta campos directos a CSV sin neutralizar formulas
  - [backend/src/patients/patients.controller.ts](backend/src/patients/patients.controller.ts): endpoint de descarga CSV
- Impacto: ejecucion de formulas maliciosas en entorno del operador.
- Recomendacion concreta: neutralizar celdas con prefijo `'`.

### 5.5 Sin evidencia de cifrado at-rest ni AV para adjuntos/backups

- Severidad: **Alto**
- Problema: no vi evidencia de cifrado at-rest ni de antivirus/escaneo malware para adjuntos y backups.
- Por que es grave: el repositorio si muestra almacenamiento local en disco, pero no controles adicionales para PHI binaria.
- Evidencia:
  - [backend/src/attachments/attachments.module.ts](backend/src/attachments/attachments.module.ts): almacenamiento en disco local
  - [backend/src/attachments/attachments.service.ts](backend/src/attachments/attachments.service.ts): validacion por firma, no AV
  - [backend/src/settings/settings.service.ts](backend/src/settings/settings.service.ts): solo cifra `smtp.password`
  - [docker-compose.yml](docker-compose.yml): volumenes locales para DB y uploads
- Impacto: mayor exposicion ante robo de volumen o carga maliciosa.
- Recomendacion concreta: object storage cifrado/KMS, escaneo AV y politica explicita de almacenamiento.

### 5.6 Operacion y despliegue aun demasiado manuales

- Severidad: **Alto**
- Problema: la disciplina de release/deploy sigue siendo fragil y manual.
- Por que es grave: las migraciones corren al arrancar la app y el release checklist no refleja todos los gates reales.
- Evidencia:
  - [backend/package.json](backend/package.json): `start:prod:migrate`
  - [backend/Dockerfile](backend/Dockerfile): `CMD ["npm", "run", "start:prod:migrate"]`
  - [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md): checklist mas corto que el gate real de CI
  - Infra declarativa observada: `docker-compose.yml` y `.github/workflows/ci.yml`; no vi Terraform, Helm ni manifests de despliegue
- Impacto: despliegues mas riesgosos y rollback pobre.
- Recomendacion concreta: separar migraciones, endurecer checklist y automatizar mas alla de `docker-compose`.

## 6. Hallazgos rapidos / quick wins

- Hecho en repo: cortar el `diff` clinico en auditoria y agregar script de saneamiento historico `npm --prefix backend run audit:redact:clinical-logs`.
- Hecho en repo: sacar `backend/prisma/*.db*` y `backend/prisma/backups/` del contexto Docker y bloquear su reaparicion en CI.
- Parcialmente hecho: desversionar `backend/.env` y `frontend/.env`; sigue pendiente rotacion y saneamiento de historial.
- Hecho en repo: volver autenticado `GET /api/health/sqlite`.
- Hecho en repo: eliminar el autosave sensible en `sessionStorage` del alta de pacientes.
- Hecho en repo: neutralizar CSV formula injection.
- Hecho en repo: alinear [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) con [ci.yml](.github/workflows/ci.yml).
- Hecho en repo: cambiar `x-forwarded-for` manual por `req.ip` con `TRUST_PROXY` configurable.

## 7. Evidencia tecnica

### 7.1 Fortalezas reales observadas

- Cookies `HttpOnly` y `SameSite=strict` en [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts).
- Validacion global con `whitelist`, `forbidNonWhitelisted` y `transform` en [backend/src/main.ts](backend/src/main.ts).
- Rate limiting global en [backend/src/app.module.ts](backend/src/app.module.ts).
- Sentry backend con scrubbing de headers/cookies/body en [backend/src/instrument.ts](backend/src/instrument.ts).
- Frontend same-origin `/api` en [frontend/next.config.js](frontend/next.config.js).
- Refresh por cookie y manejo centralizado de 401 en [frontend/src/lib/api.ts](frontend/src/lib/api.ts).
- Guardas de rol/admin y control de acceso por medico efectivo en [backend/src/common/guards/roles.guard.ts](backend/src/common/guards/roles.guard.ts), [backend/src/common/guards/admin.guard.ts](backend/src/common/guards/admin.guard.ts) y [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts).
- Cobertura e2e backend util en [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts), incluyendo auth, permisos, adjuntos, review workflow y aislamiento por medico/asistente.

### 7.2 Debilidad estructural

- Archivos demasiado grandes:
  - [backend/src/encounters/encounters.service.ts](backend/src/encounters/encounters.service.ts): 1529 lineas
  - [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts): 1306 lineas
  - [frontend/src/app/(dashboard)/atenciones/[id]/page.tsx](frontend/src/app/(dashboard)/atenciones/[id]/page.tsx): 1635 lineas
  - [frontend/src/app/(dashboard)/pacientes/[id]/page.tsx](frontend/src/app/(dashboard)/pacientes/[id]/page.tsx): 858 lineas
- Uso extendido de `any` en servicios, DTOs y tipos clinicos:
  - [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts)
  - [frontend/src/types/index.ts](frontend/src/types/index.ts)
  - [backend/src/encounters/dto/update-section.dto.ts](backend/src/encounters/dto/update-section.dto.ts)

### 7.3 Resultados de verificacion ejecutados durante la auditoria

- Corrida inicial 2026-04-01 UTC:
  - `npm --prefix backend run build`: OK
  - `npm --prefix backend run typecheck`: OK
  - `npm --prefix backend run test:e2e -- --runInBand`: OK
  - `npm --prefix backend test -- --runInBand`: FAIL
  - `npm --prefix backend run lint:check`: FAIL
  - `npm --prefix frontend run build`: OK
  - `npm --prefix frontend run lint`: OK
  - `npm --prefix frontend test -- --ci --runInBand`: FAIL
  - `npm --prefix backend run audit:prod`: OK
  - `npm --prefix frontend run audit:prod`: OK
- Revalidacion despues de fixes 2026-04-02 UTC:
  - `npm --prefix backend run lint:check`: OK
  - `npm --prefix backend test -- --ci --runInBand`: OK
  - `npm --prefix backend run test:e2e -- --runInBand`: OK
  - `npm --prefix backend run typecheck`: OK
  - `npm --prefix backend run build`: OK
  - `npm --prefix frontend run lint`: OK
  - `npm --prefix frontend test -- --ci --runInBand`: OK
  - `npm --prefix frontend run typecheck`: OK
  - `npm --prefix frontend run build`: OK

## 8. Falsos positivos o dudas

- **Demostrado por codigo:** SQLite como ruta de produccion, `.env` versionados, audit log con payload clinico, `sessionStorage` de pacientes, endpoint `/health/sqlite` publico, backup incompleto de adjuntos, drift de tests/lint.
- **Inferencia razonable, no prueba formal:** no vi cifrado at-rest general, AV scanning, consentimientos, retencion programatica ni portabilidad mas alla de archivado/CSV; esos controles podrian existir fuera del repo.
- **No evaluado en vivo:** TLS, WAF, backups reales en cloud, IAM, networking, monitorizacion externa y practicas de operacion del entorno desplegado.
- **Matiz importante:** el fallo de `frontend typecheck` observado en este workspace dependio de artefactos generados en `.next`; ese punto exacto merece confirmacion en un checkout limpio.
- **Severidad condicional:** si los secretos versionados fueron reutilizados en staging/produccion, esto ya no es solo una mala practica: es un incidente de seguridad.

## 9. Plan de remediacion priorizado

### 9.1 Antes de produccion

- Migrar la persistencia productiva a PostgreSQL gestionado o equivalente con PITR.
- Eliminar PHI de auditoria y purgar/backfillear registros ya guardados.
- Rotar todos los secretos, sacar `.env` del repo y moverlos a un secret manager.
- Corregir el contexto Docker para que jamas incluya DBs/backups locales.
- Resolver DR completo de adjuntos y hacer restore drill con DB + archivos.
- Dejar verde la suite exigida por CI y bloquear releases con CI rojo.
- Quitar el autosave sensible del frontend.

### 9.2 En las primeras 2 semanas post-lanzamiento

- Endurecer trazabilidad: trusted proxy, IP real, monitoreo de accesos a auditoria.
- Cerrar `/health/sqlite` al publico o eliminarlo.
- Arreglar CSV formula injection.
- Anadir alertas operativas utiles: errores 5xx, backup freshness, restore drill, fallos de adjuntos.
- Incorporar escaneo AV y `no-store` donde corresponda para descargas sensibles.
- Agregar pruebas e2e del flujo mas critico de paciente-atencion-adjunto-auditoria.

### 9.3 Mejoras estructurales a mediano plazo

- Partir servicios y paginas gigantes en modulos de dominio mas pequenos.
- Reducir `any` y tipar de punta a punta secciones clinicas y contratos API.
- Formalizar politicas tecnicas de retencion, eliminacion y exportacion de datos.
- Pasar de `docker-compose` + runbooks a despliegue mas declarativo y reproducible.
- Hacer pruebas de carga y presupuesto de rendimiento sobre flujos clinicos reales.

## 10. Resumen final brutalmente honesto

Anamneo no esta en estado "amateur", pero tampoco en estado "medico listo para produccion". Hoy lo veo como un producto funcional con varias buenas decisiones puntuales, construido todavia con mentalidad de entorno controlado: SQLite en el centro, secretos mal gobernados, auditoria que sobreexpone datos clinicos y recuperacion incompleta de adjuntos. Mi nivel de confianza para desplegarlo con PHI real es bajo. Como CTO responsable, no firmaria el pase a produccion hasta cerrar esos bloqueadores; la nota que le pongo hoy, sin suavizar, es **4.9/10 (F)**.
