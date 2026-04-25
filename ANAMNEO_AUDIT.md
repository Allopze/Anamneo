# ANAMNEO_AUDIT

## 1. Resumen ejecutivo

Audite Anamneo a nivel tecnico y funcional con foco en una EMR chica de 1 a 5 usuarios, revisando arquitectura, auth, permisos, modelo de datos, recuperabilidad con SQLite, UX clinica basica, build, tests y operacion.

La conclusion general es positiva: el repo esta claramente por encima del promedio de proyectos pequenos del mismo tipo. Tiene validaciones de DTO consistentes, guards reales, contrato compartido de permisos, auditoria con cadena de integridad, 2FA disponible, control de adjuntos razonable, bloqueo de output clinico cuando la ficha del paciente esta incompleta, backups automaticos y restore drill ejecutable.

El riesgo global hoy no esta en throughput ni en arquitectura; esta en detalles operativos y de privacidad local: persistencia clinica en navegador por defecto, rollback de deploy incompleto para adjuntos, drift de dependencias en Next.js y cierta fragilidad de la suite de smoke cuando se corre contra instancias ya levantadas.

Conclusion corta: para el contexto declarado, Anamneo esta cerca de estar lista y tecnicamente usable en produccion pequena, pero conviene cerrar algunos riesgos pragmaticos antes o inmediatamente al salir.

### Evidencia ejecutada

- Backend typecheck: OK
- Frontend typecheck: OK
- Backend build: OK
- Frontend build: OK
- Backend npm audit prod: 0 vulnerabilidades altas
- Frontend npm audit prod: 0 vulnerabilidades altas
- Backend Jest: 66 suites, 342 tests, OK
- Frontend Jest: 62 suites, 299 tests, OK
- Backend E2E principal: 221 tests, OK
- Frontend Playwright smoke: OK en puertos aislados; falla en puertos por defecto si ya hay instancia viva y bootstrap consumido
- Frontend Playwright workflow-clinical: 10 tests, OK
- SQLite monitor estricto: OK
- SQLite restore drill: OK
- Health backend en 127.0.0.1:5678: OK
- Frontend respondiendo en 127.0.0.1:5555: OK

## 2. Veredicto de produccion

### Lista para produccion

El criterio aplicado es el pedido: app medica pequena, de uso real pero restringido, para 1 a 5 usuarios totales, sin requerimientos enterprise.

Justificacion concreta:

- El estado actual compila, construye y pasa pruebas unitarias, integracion y E2E relevantes.
- Los flujos criticos de auth, pacientes, encuentros, permisos, exportacion y auditoria tienen evidencia automatizada real.
- El stack SQLite esta acompanado por monitoreo, backup y restore drill, algo suficiente para esta escala si se opera con disciplina.
- Los problemas encontrados son reales, pero mayormente corregibles sin reescritura y no invalidan el uso real de la aplicacion en un consultorio chico.

Reserva importante:

- Si se va a usar en equipos compartidos, no la consideraria realmente lista hasta resolver o mitigar mejor la persistencia local de datos clinicos en navegador.

## 3. Hallazgos criticos y altos

No detecte hallazgos criticos actuales.

| Severidad | Titulo | Archivo(s) afectados | Descripcion | Impacto | Recomendacion | Esfuerzo |
|---|---|---|---|---|---|---|
| Alto | Persistencia local de datos clinicos activada por defecto | frontend/src/lib/encounter-draft.ts, frontend/src/lib/offline-queue.ts, frontend/src/stores/privacy-settings-store.ts, frontend/src/app/(dashboard)/ajustes/ProfileSecurityTab.tsx | Los borradores de encuentro, copias de conflicto y cola offline persisten en localStorage/IndexedDB por 24h salvo que el usuario active manualmente modo equipo compartido. La mitigacion existe, pero es opt-in por navegador y no una politica segura por defecto. | Riesgo potencial de privacidad en produccion si la app se usa en notebooks del centro o boxes compartidos. No es incidente actual en este entorno de desarrollo porque los datos son ficticios. | Para produccion chica, hacer una de estas dos cosas: 1) preguntar en primer login si el equipo es compartido y activar el modo por defecto; 2) permitir forzarlo globalmente por env o setting; 3) como minimo, mostrar aviso visible mientras el modo siga desactivado. | Bajo-Medio |

## 4. Bugs e inconsistencias funcionales

### Medio | Rollback automatico de deploy no restaura adjuntos

Archivo(s): scripts/deploy.sh, backend/scripts/sqlite-backup.js

El deploy hace backup pre-migracion de DB y uploads, pero el rollback automatico solo copia el archivo .db de vuelta. No restaura el snapshot de uploads asociado al backup. En una incidencia real, eso puede dejar la base revertida y los adjuntos en otro estado.

Impacto: inconsistencia entre metadatos y archivos ante rollback o recuperacion apurada.

Recomendacion: que el rollback restaure tambien el uploadsSnapshotRelativePath del metadata del backup, o que invoque un restore script unico para DB + uploads.

Esfuerzo: Bajo.

### Medio | El smoke Playwright da falsos negativos en entornos ya inicializados

Archivo(s): frontend/tests/e2e/smoke.spec.ts, frontend/playwright.config.ts

El smoke principal asume una instancia vacia y siempre busca el campo Token de instalacion. En mi ejecucion fallo contra una instancia ya viva porque el bootstrap ya estaba consumido y porque los puertos por defecto 5555 y 5678 ya estaban ocupados. La misma suite paso completa al correrla en puertos aislados como fue disenada.

Impacto: debilita la confianza del check operativo post-deploy o post-release porque puede fallar por condiciones del entorno, no por el producto.

Recomendacion: separar un smoke de instancia vacia y otro de instancia ya bootstraped, o detectar el estado real con GET /auth/bootstrap antes de decidir el flujo.

Esfuerzo: Bajo.

### Medio | Drift de version de Next.js entre root y frontend

Archivo(s): package.json, frontend/package.json

El package root declara next 16.3.0-canary.2, mientras el frontend real corre con next 16.2.4. No rompio build ni tests hoy, pero es una fuente innecesaria de confusion y drift en instalaciones, troubleshooting y releases.

Impacto: mayor probabilidad de comportamientos dificiles de reproducir y tooling inconsistente.

Recomendacion: eliminar next del root si no es indispensable alli, o alinear explicitamente ambas versiones al mismo canal.

Esfuerzo: Bajo.

### Bajo-Medio | Deuda de mantenibilidad todavia visible en UI clinica y settings

Archivo(s): FILES_OVER_300_LINES.md, frontend/src/app/register/page.tsx, frontend/src/app/(dashboard)/atenciones/[id]/page.tsx, frontend/src/components/sections/TratamientoSection.tsx, frontend/src/app/(dashboard)/ajustes/SystemTab.tsx

El propio repo ya documenta archivos pendientes de split. Algunos puntos clave siguen bastante grandes: register/page.tsx ~496 lineas, page.tsx de encuentro ~306, TratamientoSection.tsx ~342, SystemTab.tsx ~336.

Impacto: mas costo de cambio y mayor riesgo de regresiones en flujos sensibles.

Recomendacion: seguir el plan ya abierto y partir primero register, settings y tratamiento, que son superficies de alta friccion y frecuente cambio.

Esfuerzo: Medio.

### Bajo | Inconsistencia documental sobre cifrado en reposo

Archivo(s): .env.example, backend/src/main.helpers.ts

La documentacion de ejemplo dice que ENCRYPTION_AT_REST_CONFIRMED solo silencia un warning, pero el backend real falla el arranque en produccion si no esta en true.

Impacto: onboarding o despliegue confuso; no afecta la seguridad del runtime, pero si la claridad operativa.

Recomendacion: alinear el comentario de .env.example con la validacion real.

Esfuerzo: Bajo.

## 5. Seguridad y privacidad

### Lo que esta bien resuelto

- Auth basada en cookies HttpOnly con access y refresh separados.
- Refresh revocable por refreshTokenVersion y sesiones persistidas.
- 2FA/TOTP implementado y cubierto por tests.
- Guardrails de arranque fuertes para secrets, SQLite en produccion y cifrado de settings.
- Roles y permisos con enforcement backend real, no solo UX.
- DTOs con ValidationPipe global, whitelist y forbidNonWhitelisted.
- Audit log con hash de integridad y endpoint de verificacion.
- Request tracing que registra metodo, path, status y duracion sin loggear payload clinico bruto.
- Adjuntos con validacion por extension, MIME, firma basica, tamano y control de acceso.

### Riesgos observados en desarrollo

- No observe exposicion real de datos sensibles reales. El entorno usa datos ficticios y ese hecho debe separarse de los riesgos potenciales de produccion.
- Habia servicios locales ya escuchando en 5555 y 5678, lo que afecta el smoke E2E por defecto. Es un riesgo operativo de entorno, no una vulnerabilidad.

### Riesgos potenciales si se desplegara asi en produccion

- Persistencia local de borradores y cola offline por defecto en navegador.
- 2FA disponible pero no obligatoria para admin o medicos.
- SQLITE_ALERT_WEBHOOK_URL sigue siendo opcional; si se deja vacio en produccion, un fallo de backup o monitor puede quedar sin senal fuera de la app.

### Recomendacion pragmatica de seguridad para esta escala

- Obligar 2FA al menos para ADMIN y MEDICO.
- Tratar modo equipo compartido como decision operativa del primer arranque, no como ajuste escondido.
- Configurar webhook de alertas SQLite o, si no se quiere dependencia externa, al menos una notificacion simple a ntfy, Discord o Slack.

## 6. Modelo de datos e integridad clinica

### Puntos fuertes

- Modelo de pacientes con completitud explicita y verificacion demografica.
- Encounter separado por secciones, lo que favorece validacion granular y cierre controlado.
- Bloqueo de outputs clinicos cuando el paciente no esta listo para ello.
- Aislamiento por medico bien cubierto en la suite E2E principal.
- Consentimientos, alertas, adjuntos y problemas o tareas fueron validados en escenarios cross-scope.

### Riesgos y deuda

### Medio | Mucha semantica de dominio sigue persistida como string libre

Archivo(s): backend/prisma/schema.prisma

Status, reviewStatus, role, type, severity y otros campos siguen persistidos como string, no como enums de Prisma o DB. Hoy esto esta relativamente contenido por services, DTOs y tests, pero sigue dejando mas superficie para drift tipografico o contratos divergentes entre capas.

Impacto: deuda de integridad y mantenibilidad, no bug observable actual.

Recomendacion: no hace falta una migracion grande ahora; alcanza con seguir centralizando constantes compartidas y priorizar enums solo en estados clinicos mas sensibles cuando se toque esa superficie.

Esfuerzo: Medio.

### Medio | El backup es correcto para SQLite chica, pero depende de disciplina operativa

Archivo(s): backend/scripts/sqlite-backup.js, backend/scripts/sqlite-monitor.js, backend/scripts/sqlite-restore-drill.js, docker-compose.yml

La base operativa esta bien resuelta para el tamano del proyecto, pero la seguridad de esa eleccion depende de que efectivamente se corran backups, monitor y restore drill, y de que alguien vea la senal si fallan.

Impacto: el riesgo no es la base en si, sino confiar en SQLite sin disciplina de backup y alerta.

Recomendacion: mantener el cron de backup, configurar webhook y dejar un procedimiento corto de recuperacion impreso o documentado para la usuaria real.

Esfuerzo: Bajo.

## 7. Mantenibilidad y deuda tecnica

### Lo mejor del diseno actual

- La modularidad de backend por dominios esta bien lograda.
- Los controllers son razonablemente finos.
- Hay separacion clara entre permisos UX y enforcement backend.
- El contrato compartido de permisos en encounters reduce drift.
- Hay un esfuerzo visible y reciente de dividir archivos demasiado grandes.

### Deuda tecnica relevante

### Medio | La base esta madura, pero con mucha energia invertida en sostener coherencia cross-layer

Archivo(s): shared/permission-contract.ts, docs/security-and-permissions.md, frontend/src/proxy.ts, frontend/src/lib/api.ts

La app ya tiene varias reglas delicadas: bootstrap, sesiones, 2FA, completitud de paciente, output clinico bloqueado, permisos por medico efectivo, cola offline, adjuntos y auditoria. Esta bien, pero requiere mucha disciplina para no reintroducir drift cada vez que se toca un flujo.

Impacto: el costo de cambio empieza a subir, aunque todavia es manejable con la suite actual.

Recomendacion: seguir usando contratos compartidos y tests E2E focalizados en vez de multiplicar condicionales dispersos.

Esfuerzo: Bajo-Medio.

### Bajo-Medio | El release y deploy son buenos, pero todavia no son un boton seguro

Archivo(s): scripts/release.sh, scripts/deploy.sh

Hay zip de release, backup pre-migracion, restore drill y healthcheck. Eso es muy bueno para este tamano. Lo que falta es cerrar algunos detalles: rollback de uploads, health del frontend y documentacion 100 por ciento alineada.

Impacto: riesgo operativo moderado, no de producto.

Recomendacion: pulir esos puntos en vez de rehacer el pipeline.

Esfuerzo: Bajo.

## 8. Funcionalidades sugeridas alineadas con anamneo

### Imprescindibles

1. Plantillas de evolucion, controles y recetas por medico.

Valor: reduce tiempo de escritura, variabilidad y fatiga en consulta. Para una usuaria principal tiene retorno inmediato.

2. Aviso fijo de alergias y medicacion habitual al abrir una atencion.

Valor: mejora seguridad clinica real con complejidad baja.

3. Checklist pre-consulta para asistente.

Valor: evita consultas interrumpidas por datos faltantes, adjuntos sin cargar o consentimiento pendiente.

### Muy utiles

1. Busqueda y filtros mas finos de pacientes y seguimientos.

Valor: mejora mucho el uso diario con poco costo cognitivo, sobre todo cuando crezca la base de pacientes.

2. Historial de cambios por seccion en lenguaje humano.

Valor: aprovecha la auditoria ya existente y la vuelve clinicamente legible.

3. Clasificacion mas visible de adjuntos.

Valor: hace que resultados, ordenes e informes sean recuperables mas rapido en consulta.

### Opcionales

1. Explicabilidad visible del sugeridor diagnostico.

Valor: suma confianza, pero no bloquea uso real.

2. Panel de pendientes clinicos mas compacto para inicio de jornada.

Valor: ayuda operativa, aunque hoy ya existe base funcional de tareas y seguimientos.

## 9. Quick wins

1. Forzar o sugerir explicitamente modo equipo compartido en primer login.
2. Alinear la version de Next.js entre root y frontend.
3. Hacer que el smoke E2E detecte si la instancia ya fue bootstraped.
4. Restaurar uploads junto con DB en rollback automatico.
5. Agregar healthcheck del frontend al deploy script antes de declarar despliegue OK.
6. Configurar SQLITE_ALERT_WEBHOOK_URL para no depender de revisar logs a mano.
7. Corregir la documentacion de ENCRYPTION_AT_REST_CONFIRMED para que coincida con el runtime real.

## 10. Checklist minimo antes de produccion

1. Definir politica de uso en dispositivo personal vs equipo compartido y ajustar la persistencia local en consecuencia.
2. Corregir rollback automatico para restaurar uploads junto con la DB.
3. Alinear Next.js root y frontend o eliminar la dependencia root innecesaria.
4. Configurar secrets reales, cifrado en reposo del host y SQLITE_ALERT_WEBHOOK_URL.
5. Decidir si 2FA sera obligatoria para ADMIN y MEDICO.
6. Ejecutar en el release candidate: build, Jest, app.e2e-spec.ts, Playwright smoke aislado, workflow-clinical y restore drill.

## 11. Supuestos y limitaciones

- La auditoria se hizo sobre el entorno de desarrollo y sus datos ficticios. No se trato la mera presencia de registros de prueba como incidente real.
- No realice un pentest externo ni revision de infraestructura host fuera del repo.
- No valide un deploy real en servidor remoto; si valide scripts, build local, health local, monitor y restore drill.
- El fallo inicial del smoke Playwright no se considero bug del producto porque la misma suite paso completa al ejecutarse en puertos aislados con stack limpio.
- El veredicto asume el escenario declarado: consultorio pequeno, muy pocos usuarios, sin carga alta ni multi-tenant.

## Cierre

Anamneo ya no parece un prototipo improvisado. Tiene suficientes controles, pruebas y recuperabilidad como para usarse de verdad en un contexto chico. Los siguientes pasos valiosos no son reescribir arquitectura, sino cerrar la privacidad local, ajustar dos o tres bordes operativos y mantener la coherencia cross-layer que hoy es una de sus fortalezas.