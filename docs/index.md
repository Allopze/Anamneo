# Documentacion Activa

Este directorio concentra la documentacion viva del proyecto. Si un tema aparece explicado con lujo de detalles en tres archivos distintos, una de esas versiones sobra y probablemente fue creada en un momento de entusiasmo mal dirigido.

## Mapa Rapido

| Documento | Audiencia principal | Contenido |
|---|---|---|
| `development.md` | Desarrollo | Setup local, comandos diarios, puertos y troubleshooting |
| `environment.md` | Desarrollo / Operacion | Variables de entorno, defaults y requisitos de produccion |
| `testing.md` | Desarrollo | Jest, e2e backend y Playwright frontend |
| `backend-architecture.md` | Desarrollo | Modulos NestJS, request flow y patrones comunes |
| `frontend-architecture.md` | Desarrollo | App Router, layout privado, proxy y estado cliente |
| `data-model.md` | Desarrollo / Producto | Entidades Prisma, relaciones y estados persistidos |
| `security-and-permissions.md` | Desarrollo / Operacion | JWT, sesiones, cifrado, auditoria y permisos |
| `idor-isolation-matrix.md` | Desarrollo / Seguridad | Matriz de endpoints con IDs y cobertura de aislamiento/IDOR |
| `data-privacy-and-compliance.md` | Operacion / Legal | Marco Ley 19.628 / Ley 21.719, DPA, derechos del titular, retencion |
| `legal-postponed.md` | Operacion / Legal | Pendientes legales expresamente postergados y bloqueo de enforcement hard |
| `postgres-operations.md` | Operacion | Backup, restore drill, monitor y alertas PostgreSQL |
| `deployment-and-release.md` | Operacion | Build, empaquetado, despliegue y smoke checks |
| `clinical-workflows.md` | Producto / Desarrollo | Flujos funcionales vigentes y riesgos conocidos |
| `clinical-analytics.md` | Producto / Desarrollo | Vista de analitica clinica, fuentes de datos, calculos, limites y validacion |
| `product/features.md` | Producto | Backlog funcional por rol y pendientes v1 |
| `product/landing-page-brief.md` | Producto / Marketing | Brief autosuficiente para una landing externa |
| `audits/technical-production-audit-2026-05-22.md` | Operacion / Seguridad | Auditoria tecnica de readiness productivo |
| `audits/ley-21719-chile-audit-2026-05-23.md` | Legal / Compliance | Auditoria de cumplimiento Ley 21.719 |
| `audits/performance-ux-architecture-audit-2026-04-29.md` | Desarrollo / Producto | Auditoria historica de rendimiento, frontend y UX |
| `technical-debt/files-over-300-lines.md` | Desarrollo | Seguimiento de archivos grandes pendientes de division |
| `settings-key-rotation-runbook.md` | Operacion | Rotacion de claves de cifrado para settings |
| `account-recovery-runbook.md` | Operacion / Soporte | Recuperacion de cuentas, reset de admin de emergencia y password reset self-service |
| `observability-slos.md` | Operacion | SLOs, metricas Prometheus, busqueda en logs, alertas recomendadas |
| `design-tokens-anamneo.md` | Frontend | Contrato visual activo del frontend |
| `ui-ux-audit-remediation.md` | Frontend / Producto | Auditoria UI/UX viva, remediacion ejecutada y pendientes visuales |

## Regla Simple

- `README.md` explica que es Anamneo y como arrancarlo.
- `docs/` explica como funciona y como operarlo sin inventar rituales.
- `docs/product/features.md` es backlog y roadmap, no contrato de comportamiento.
- `docs/archive/` guarda contexto historico que puede servir para trazabilidad, no para operar hoy.

## Orden Recomendado Para Nuevos Integrantes

1. `../README.md`
2. `development.md`
3. `environment.md`
4. `testing.md`
5. `backend-architecture.md` y `frontend-architecture.md`
6. `security-and-permissions.md`
7. `postgres-operations.md` y `deployment-and-release.md`

## Archivo Historico

Los documentos de refactor UI de marzo/abril 2026 se movieron a `docs/archive/ui/`. Se conservan por contexto historico, no porque alguien deba consultarlos antes de abrir una PR.
