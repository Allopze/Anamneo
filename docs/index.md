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
| `sqlite-operations.md` | Operacion | Backup, restore drill, monitor y alertas SQLite |
| `deployment-and-release.md` | Operacion | Build, empaquetado, despliegue y smoke checks |
| `clinical-workflows.md` | Producto / Desarrollo | Flujos funcionales vigentes y riesgos conocidos |
| `clinical-analytics.md` | Producto / Desarrollo | Vista de analitica clinica, fuentes de datos, calculos, limites y validacion |
| `settings-key-rotation-runbook.md` | Operacion | Rotacion de claves de cifrado para settings |
| `design-tokens-anamneo.md` | Frontend | Contrato visual activo del frontend |

## Regla Simple

- `README.md` explica que es Anamneo y como arrancarlo.
- `docs/` explica como funciona y como operarlo sin inventar rituales.
- `FEATURES.md` es backlog y roadmap, no contrato de comportamiento.
- `docs/archive/` guarda contexto historico que puede servir para trazabilidad, no para operar hoy.

## Orden Recomendado Para Nuevos Integrantes

1. `../README.md`
2. `development.md`
3. `environment.md`
4. `testing.md`
5. `backend-architecture.md` y `frontend-architecture.md`
6. `security-and-permissions.md`
7. `sqlite-operations.md` y `deployment-and-release.md`

## Archivo Historico

Los documentos de auditoria y refactor UI de marzo 2026 se movieron a `docs/archive/ui/`. Se conservan por contexto historico, no porque alguien deba consultarlos antes de abrir una PR.