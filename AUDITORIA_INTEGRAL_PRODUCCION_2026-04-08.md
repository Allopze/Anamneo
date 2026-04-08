# Auditoria Integral De Produccion Anamneo

Fecha: 2026-04-08
Rol asumido: auditor senior de software, arquitectura, seguridad, producto, UX, privacidad y operacion

## Veredicto Ejecutivo

Veredicto corto: no considero que Anamneo este listo para produccion seria como SaaS medico de escala o para un entorno regulado exigente.

Veredicto matizado: si considero que el producto ya esta por encima del promedio de muchos MVP clinicos en autenticacion, trazabilidad, validacion de flujos y aislamiento de datos. Hoy lo firmaria solo para un piloto controlado, de bajo volumen, con una sola organizacion, una sola instancia, SLAs modestos y disciplina operativa fuerte. No lo firmaria aun para una salida comercial amplia ni para un entorno donde la continuidad, la recuperacion y la postura regulatoria deban resistir auditoria dura.

Nota global: 7.1/10

Calificacion: B-

## Puntuacion Por Area

| Area | Nota | Estado | Comentario |
| --- | --- | --- | --- |
| Seguridad de aplicacion | 7.6/10 | Buena con reservas | Cookies HttpOnly, rotacion de refresh, revocacion de sesiones, throttling, Helmet y guards estan bien resueltos. |
| Privacidad y trazabilidad | 7.4/10 | Buena | Hay redaccion de diffs clinicos, request id y auditoria util. Falta evidencia operativa y regulatoria fuera del codigo. |
| Calidad de software | 7.2/10 | Buena con deuda | Lint, typecheck, build y tests pasan hoy. La deuda fuerte se movio desde bug inmediato a mantenibilidad y arquitectura. |
| Arquitectura y escalabilidad | 5.4/10 | Insuficiente para produccion seria | El backend esta bien modularizado, pero la base operacional sigue siendo SQLite mononodo con volumen local. |
| DevOps y SRE | 6.4/10 | Aceptable para piloto | Hay CI, health checks, backup cron, monitoreo SQLite y release zip. No hay evidencia suficiente de HA, despliegues robustos, ni de operacion empresarial. |
| Testing y verificacion | 8.3/10 | Fuerte | El backend e2e y el frontend Jest cubren bien flujos clinicos y de roles; tras la ronda actual tambien quedaron alineados con lint. |
| UX y seguridad operacional | 7.0/10 | Correcta con deuda | La interfaz viene mejorando, pero todavia hay zonas fragiles por mezcla de responsabilidades en el shell y deuda de evolucion UX. |
| Preparacion regulatoria | 5.2/10 | No demostrada | No vi evidencia suficiente en repo de cifrado en reposo, politicas de retencion, RPO/RTO formal, controles de acceso revisables o artefactos de cumplimiento. |

## Lo Que Esta Bien

- La autenticacion tiene una base razonable para produccion: cookies HttpOnly, `sameSite: 'strict'`, `secure` en produccion, refresh token separado, versionado y revocacion por sesion en [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts), [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) y [backend/src/users/users.service.ts](backend/src/users/users.service.ts).
- La aplicacion arranca con chequeos preventivos utiles: bloquea SQLite en produccion salvo opt-in explicito, exige secretos JWT reales y exige claves de cifrado de settings en produccion en [backend/src/main.ts](backend/src/main.ts).
- La trazabilidad clinica es mejor de lo habitual: hay request ids, catalogo de razones de auditoria y minimizacion de payload clinico en [backend/src/common/utils/request-tracing.ts](backend/src/common/utils/request-tracing.ts) y [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts).
- El control de acceso esta razonablemente bien separado entre rol clinico, asistente y admin operativo; el suite e2e demuestra aislamiento por medico y vistas administrativas reducidas en [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts).
- Los adjuntos tienen validacion de MIME por firma, saneamiento de nombre y defensa contra traversal en [backend/src/attachments/attachments.service.ts](backend/src/attachments/attachments.service.ts).
- La operacion de SQLite no esta improvisada: hay WAL, `busy_timeout`, autocheckpoint, monitoreo de antiguedad de backups y restore drill en [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts), [docker-compose.yml](docker-compose.yml) y [README.md](README.md).
- La calidad funcional observable es buena: lint, typecheck, build y suites automatizados pasan hoy.
- El riesgo productivo inmediato por dependencias backend quedo corregido: `npm audit --omit=dev --audit-level=high` ya no reporta vulnerabilidades en el arbol productivo actual.

## Blockers Reales De Salida

### 1. Arquitectura de datos y continuidad basada en SQLite mononodo

Este es el principal bloqueo.

La aplicacion sigue modelando su despliegue productivo alrededor de SQLite con archivo local, WAL, backup cron y volumen persistente, no alrededor de un motor de base de datos de servidor. Eso se ve en [backend/prisma/schema.prisma](backend/prisma/schema.prisma), [backend/src/prisma/prisma.service.ts](backend/src/prisma/prisma.service.ts), [docker-compose.yml](docker-compose.yml) y [README.md](README.md).

Lo positivo es que el proyecto no niega este riesgo y pone guardas. Lo insuficiente es que, para un SaaS medico serio, esto sigue siendo un punto unico de falla operativo:

- una sola instancia de app + un solo archivo de base
- recuperacion dependiente de backup/restore, no de replicacion o failover
- escalado horizontal practicamente fuera de juego
- riesgo de lock contention y sensibilidad al disco
- continuidad muy dependiente de la disciplina del operador

Context7 refuerza que Prisma usa `prisma migrate deploy` como camino seguro para produccion y que SQLite sigue siendo un datasource de archivo local, lo que no invalida el stack, pero tampoco resuelve HA ni concurrencia por arte de magia.

Mi lectura: para beta controlada, puede aguantar. Para produccion medica seria, no.

### 2. Falta de evidencia suficiente para firmar cumplimiento operativo/regulatorio

Esto no es un bug de codigo, pero si un bloqueo de auditoria real.

No encontre en el repo evidencia suficiente de:

- cifrado en reposo de base y volumenes de adjuntos a nivel de infraestructura
- RPO y RTO formalmente definidos
- gestion de acceso privilegiado y revisiones periodicas
- politicas de retencion, borrado, exportacion y respuesta a incidentes para dato clinico
- pruebas de recuperacion documentadas con resultados historicos, no solo scripts disponibles
- segregacion por cliente u organizacion si el objetivo es SaaS multi-clinica

Eso no significa que no exista fuera del repo. Significa que no esta evidenciado aqui, por lo que no lo puedo firmar.

## Riesgos Altos No Bloqueantes, Pero Serios

### Shell frontend con demasiadas responsabilidades

[frontend/src/components/layout/DashboardLayout.tsx](frontend/src/components/layout/DashboardLayout.tsx) concentra bootstrap de auth, navegacion, estados offline, shell y reglas de visibilidad. Ya habia senales de esta deuda en [docs/ui-audit-anamneo.md](docs/ui-audit-anamneo.md). No es una falla fatal hoy, pero aumenta el costo de cambio y el riesgo de regresion UX.

### Proxy de acceso basado en presencia de cookies, no en sesion validada

[frontend/src/proxy.ts](frontend/src/proxy.ts) decide redireccion basada en presencia de `access_token` o `refresh_token`. Eso es valido para control de entrada ligero, pero no evita estados de cookie vencida o invalida. La aplicacion se corrige luego via 401 y refresh en [frontend/src/lib/api.ts](frontend/src/lib/api.ts), lo que deja una experiencia aceptable, no elegante.

## Hallazgos UX Potencialmente Peligrosos

- La pagina de detalle de paciente en [frontend/src/app/(dashboard)/pacientes/[id]/page.tsx](frontend/src/app/(dashboard)/pacientes/[id]/page.tsx) fue corregida en esta ronda; mantener vigilancia porque era una pantalla central y este tipo de error revela que faltaba gate de lint en la ruta normal de entrega.
- El panel administrativo permite editar HTML de correo libremente en [frontend/src/app/(dashboard)/ajustes/page.tsx](frontend/src/app/(dashboard)/ajustes/page.tsx). La buena noticia es que la vista previa usa `iframe` con `sandbox`, lo que baja el riesgo de XSS dentro de la app. La mala noticia es que un operador puede romper facilmente la calidad del correo si no existe control editorial.
- La app sigue dependiendo de un layout grande y multifuncion. Eso no solo es deuda de frontend; en producto clinico suele derivar en regresiones de navegacion, foco y contexto en pantallas sensibles.

## Riesgo De Fuga, Perdida O Exposicion De Datos

Mi lectura, separada por tipo de incidente:

### Fuga por logs o auditoria

Riesgo bajo a medio.

La implementacion hace varias cosas bien:

- request tracing sin payloads clinicos en [backend/src/common/utils/request-tracing.ts](backend/src/common/utils/request-tracing.ts)
- redaccion de campos sensibles y minimizacion de diffs clinicos en [backend/src/audit/audit.service.ts](backend/src/audit/audit.service.ts)
- catalogacion de razones de auditoria y exportes trazables en [backend/test/app.e2e-spec.ts](backend/test/app.e2e-spec.ts)

### Fuga por fallo de autorizacion entre usuarios

Riesgo bajo en lo observado.

El suite e2e cubre bien aislamiento por medico y restricciones admin/no admin. Ese es uno de los puntos mas solidos del sistema hoy.

### Perdida o indisponibilidad por operacion

Riesgo medio a alto.

No por ausencia total de mecanismos, sino porque la base operacional sigue siendo archivo SQLite + volumen + backup cron. Hay mitigaciones, pero no hay resiliencia fuerte nativa.

### Exposicion por supply chain

Riesgo bajo a medio.

El arbol productivo del backend quedo limpio en esta ronda. El riesgo remanente ya no es un blocker tecnico inmediato, sino la disciplina de mantener ese estado en CI y upgrades futuros.

## Evidencia Ejecutada En Esta Auditoria

### Validaciones que pasaron

- `npm --prefix backend run typecheck`
- `npm --prefix backend run lint:check`
- `npm --prefix backend run build`
- `npm --prefix backend run test:e2e` -> 1 suite, 136 tests, todo en verde
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `npm --prefix frontend test -- --runInBand` -> 24 suites, 152 tests, todo en verde
- `npm --prefix backend run audit:prod` -> 0 vulnerabilidades
- `npm --prefix frontend run audit:prod` -> 0 vulnerabilidades

### Validaciones que fallaron inicialmente y quedaron corregidas

- `npm --prefix backend run lint:check` -> 1 error
- `npm --prefix frontend run lint` -> 6 errores de hooks + 1 warning
- `npm --prefix backend run audit:prod` -> 3 vulnerabilidades reportadas, incluyendo 2 de severidad alta

## Contraste Con Context7

Use Context7 para contrastar la lectura del repo con documentacion actual de framework:

- NestJS: confirme la validez de `Helmet`, `ThrottlerModule` con multiples politicas y enfoque de hardening HTTP. La implementacion actual en [backend/src/main.ts](backend/src/main.ts) y [backend/src/app.module.ts](backend/src/app.module.ts) esta alineada con ese enfoque.
- Next.js 16: confirme el cambio y uso de `proxy.ts` y el patron de rewrite/proxy que el frontend utiliza en [frontend/src/proxy.ts](frontend/src/proxy.ts) y [frontend/next.config.js](frontend/next.config.js).
- Prisma: confirme que `prisma migrate deploy` es el camino correcto de despliegue no interactivo y que SQLite sigue siendo un modelo de base local, lo que refuerza el analisis de limitacion arquitectonica mas que invalidarlo.
- React: confirme con la documentacion oficial que los hooks no deben invocarse condicionalmente y que la condicion debe vivir dentro del efecto o del callback, no alrededor del hook; ese criterio guio el fix en [frontend/src/app/(dashboard)/pacientes/[id]/page.tsx](frontend/src/app/(dashboard)/pacientes/[id]/page.tsx) y el ajuste de dependencias en [frontend/src/components/sections/SospechaDiagnosticaSection.tsx](frontend/src/components/sections/SospechaDiagnosticaSection.tsx).

## Que Si Firmaria Hoy

Si me obligaran a decidir hoy, esto es lo maximo que firmaria:

- piloto controlado
- una sola institucion
- bajo volumen concurrente
- una sola region
- sin promesa de alta disponibilidad
- con monitoreo humano diario de backups y restore drills
- con decision explicita de aceptar SQLite solo como plataforma de piloto y no como plataforma final de escala
- con responsables operativos claros para backup, restore y respuesta a incidente

## Que No Firmaria Hoy

No firmaria hoy:

- lanzamiento comercial SaaS multi-clinica
- promesa de alta disponibilidad
- operacion con multiples replicas de backend compartiendo el mismo storage SQLite
- certificacion o venta con discurso de cumplimiento fuerte sin artefactos operativos adicionales
- uso en contexto donde un incidente de continuidad o restauracion lenta sea inaceptable

## Plan De Remediacion

## Corregido En Esta Ronda 2026-04-08

- Se corrigio el bug real de hooks en [frontend/src/app/(dashboard)/pacientes/[id]/page.tsx](frontend/src/app/(dashboard)/pacientes/[id]/page.tsx): el redirect administrativo ya no deja `useMutation` detras de un retorno temprano, y el manejo del conflicto 409 dejo de depender de casts amplios.
- Se dejo limpio el error de lint backend por variable no usada en [backend/src/patients/patients.service.ts](backend/src/patients/patients.service.ts).
- Se corrigio la advertencia de dependencias del efecto en [frontend/src/components/sections/SospechaDiagnosticaSection.tsx](frontend/src/components/sections/SospechaDiagnosticaSection.tsx) alineando el hook con la regla de dependencias reactivas de React.
- Se elimino la deuda inmediata de configuracion TypeScript en [frontend/tsconfig.json](frontend/tsconfig.json) y [backend/tsconfig.json](backend/tsconfig.json): el frontend deja de apuntar a `ES5` y el backend deja de depender de `baseUrl` deprecated.
- Se ajusto adicionalmente el alias de [backend/tsconfig.json](backend/tsconfig.json) para que `paths` siga funcionando sin `baseUrl`, evitando que el fix de compatibilidad rompiera typecheck.
- Se completo la remediacion de supply chain en [backend/package.json](backend/package.json) y [backend/package-lock.json](backend/package-lock.json): bump de parches NestJS afectados por advisory, `override` explicito de `lodash` a rama corregida y cierre verificado de `npm audit` productivo.
- Se revalido el estado actual completo del repo: backend y frontend quedaron con lint, typecheck y build en verde; el backend mantuvo su suite e2e completa en verde tras actualizar dependencias.

### 0 a 7 dias

1. Definir politica explicita de go-live: beta controlada versus produccion regulada. Hoy el repo mezcla ambas narrativas.
2. Agregar gates de lint y `npm audit --omit=dev --audit-level=high` al mismo nivel de obligatoriedad que typecheck y build en CI.
3. Documentar criterio operativo de aceptacion para SQLite en piloto: volumen maximo, concurrencia tolerada, RPO, RTO y frecuencia de restore drill.

### 8 a 30 dias

1. Diseñar migracion a PostgreSQL administrado o justificar formalmente por que SQLite seguira solo para piloto limitado.
2. Separar responsabilidades de [frontend/src/components/layout/DashboardLayout.tsx](frontend/src/components/layout/DashboardLayout.tsx).
3. Agregar gates de lint al mismo nivel de obligatoriedad que typecheck y build.
4. Documentar RPO, RTO, procedimiento de restore validado y responsables operativos.

### 31 a 60 dias

1. Mover secretos e identidad operativa a un secret manager real o a un esquema equivalente de gestion controlada.
2. Formalizar politicas de retencion, incident response, acceso privilegiado y exportacion de datos.
3. Incorporar evidencia de cifrado en reposo de infraestructura y de adjuntos.
4. Preparar despliegue con postura SRE mas seria: estrategia de rollback, salud profunda, alertas accionables y pruebas recurrentes de recuperacion.

## Conclusion Brutalmente Honesta

Anamneo no es un juguete. El producto ya tiene varias decisiones maduras: autenticacion sensata, trazabilidad mejor que la media, aislamiento por medico cubierto por e2e, y una preocupacion genuina por continuidad operacional aun usando SQLite.

Pero precisamente por eso el umbral sube. Ya no basta con “funciona en demo”. En este punto, el principal problema no es que el sistema este roto; es que esta demasiado cerca de ser bueno como para tolerar atajos de salida. El stack actual puede sostener un piloto serio. Aun no sostiene, con el nivel de confianza que yo exigiria, una produccion medica amplia, multi-cliente y con exigencia operacional alta.

Mi decision final: no-go para produccion seria. Go condicionado para piloto controlado con los fixes tecnicos inmediatos ya resueltos, pero con deuda estructural y regulatoria aun abierta.