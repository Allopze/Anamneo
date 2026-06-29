# Anamneo — CONTEXT.md (AI ingestion dump)

> Archivo de contexto denso orientado a IAs. Para lectura humana usar `README.md` (narrativo) y `AGENTS.md` (guía operativa corta). Para detalle por dominio usar `docs/`.

## 1. Identidad del proyecto

- **Nombre:** Anamneo.
- **Dominio:** gestión de fichas clínicas para consultas médicas en Chile.
- **Producto:** plataforma clínica para digitalizar pacientes, historia clínica, encuentros, sugerencias diagnósticas, seguimientos, consentimientos, adjuntos, auditoría, exportación y portal del paciente. Reemplaza papel, Excel heredado y memoria institucional.
- **Usuarios primarios:** clínicos (médicos), asistentes, administradores, pacientes (portal).
- **Cumplimiento objetivo:** Ley 19.628 / Ley 21.719 (Chile). Auditoría viva en `docs/audits/ley-21719-chile-audit-2026-05-23.md`.
- **Licencia:** privado / uso interno.
- **Tono de producto:** calmado, preciso, humano. Sin exclamaciones, lenguaje de marketing ni SaaS genérico. Estados clínicos siempre visibles, reversibles y auditables. Mensajes de error siempre ofrecen camino de recuperación.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS 11, Prisma 5, Passport JWT, class-validator, helmet, cookie-parser, sanitize-html, bcrypt |
| Frontend | Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS 3 |
| Estado cliente | Zustand (auth), React Query 5 (data fetching) |
| DB | PostgreSQL 16 (único motor soportado) |
| Infra | Docker Compose, scripts bash de supervisor/release/deploy |
| Observabilidad | Sentry (`@sentry/cli`, sourcemaps), auditoría persistente con diff |
| Seguridad de transporte | Helmet + throttling; en producción expuesto detrás de Cloudflare Tunnel (`cloudflared`) |

## 3. Estructura del repositorio (alto nivel)

```
Anamneo/
├── AGENTS.md               # Guía corta para coding agents (canonical commands, gotchas)
├── README.md               # Onboarding humano (español, narrativo)
├── PRODUCT.md              # Principios de producto (tono, anti-referencias)
├── CONTEXT.md              # Este archivo — dump técnico para IAs
├── DESIGN.md               # Sistema de diseño
├── package.json            # Workspace root con scripts dev/build/db/release
├── docker-compose.yml      # Stack local (loopback, no internet-facing directo)
├── .env.example            # Config base compartida; backend/frontend tienen .env locales como overlay
├── docs/                   # Documentación activa (ver docs/index.md)
│   ├── index.md            # Mapa de docs
│   ├── development.md      # Setup local y comandos diarios
│   ├── environment.md      # Variables de entorno
│   ├── testing.md          # Estrategia de tests
│   ├── backend-architecture.md
│   ├── frontend-architecture.md
│   ├── data-model.md       # Modelo Prisma resumido
│   ├── security-and-permissions.md
│   ├── idor-isolation-matrix.md
│   ├── data-privacy-and-compliance.md
│   ├── postgres-operations.md
│   ├── deployment-and-release.md
│   ├── clinical-workflows.md
│   ├── clinical-analytics.md
│   ├── settings-key-rotation-runbook.md
│   ├── account-recovery-runbook.md
│   ├── observability-slos.md
│   ├── design-tokens-anamneo.md
│   ├── iconography.md
│   ├── ui-ux-audit-remediation.md
│   ├── product/features.md
│   ├── audits/             # Auditorías vivas (Ley 21.719, técnica, perf)
│   ├── technical-debt/
│   └── archive/            # Contexto histórico, NO operar desde aquí
├── backend/                # NestJS API
├── frontend/               # Next.js 16 app
├── shared/                 # Código cross-cutting FE/BE (ver §6)
├── scripts/                # dev-supervisor.sh, release.sh, deploy.sh
├── infra/                  # Configs de despliegue
├── releases/               # Zips de release generados
├── audit/                  # Auditorías ad-hoc
├── screenshots/            # Capturas para audits UI
├── UI/                     # Mockups / referencia
├── logos/                  # Identidad
├── test-results/           # Artefactos de Playwright
├── runtime/                # Logs / data efímera local
└── .venv/                  # Entorno Python (probablemente tooling auxiliar)
```

## 4. Backend (`backend/`)

### 4.1 Bootstrap
- Entrada: `backend/src/main.ts` → `bootstrapApp()` desde `main.bootstrap.ts`.
- Capas globales: `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), helmet, cookie-parser, request tracing, CORS derivado de `CORS_ORIGIN`, filtro global de excepciones, prefijo `/api`, checks de config segura antes de escuchar.
- Sentry inicializado vía `backend/src/instrument.ts`.

### 4.2 Módulos de dominio (`backend/src/`)

| Módulo | Responsabilidad |
|---|---|
| `auth/` | Login, refresh, 2FA TOTP, invitaciones, password reset, sesiones, recovery codes |
| `users/` | Usuarios, roles (`MEDICO`, `ASISTENTE`, `ADMIN`), relación médico-asistente |
| `patients/` | Pacientes, RUT validación, historial, completitud |
| `encounters/` | Encuentros clínicos, secciones, autoguardado, revisión, cierre, PDF, dashboard |
| `conditions/` | Catálogos diagnósticos globales (CIE-10) y locales, sugerencias por similitud (TF-IDF), log de sugerencias |
| `attachments/` | Adjuntos, scan, storage, relación con encounter y órdenes |
| `templates/` | Plantillas de texto por médico |
| `consents/` | Consentimientos informados clínicos |
| `alerts/` | Alertas clínicas, acknowledgement, métricas |
| `audit/` | Log de cambios con diff persistente, cadena de integridad, catálogo, verificación |
| `settings/` | Settings cifrados (SMTP) |
| `mail/` | Integración SMTP |
| `prisma/` | Acceso a DB |
| `cie10/` | Catálogo clínico CIE-10 |
| `common/` | Cross-cutting: guards, decorators, filters, middleware, utils, types |
| `admin-maintenance/` | Endpoints admin operativos |
| `analytics/` | Analítica clínica (read models, summary, casos, ranking, export) |
| `appointments/` | Citas |
| `medications/` y `patient-medications/` | Medicamentos y vista paciente |
| `allergies/` | Alergias |
| `data-breach/` | Reporte/gestión de brechas de datos |
| `patient-data-rights/` | Derechos ARCO / Ley 21.719 (titular) |
| `patient-portal/` | Portal paciente |
| `patient-consents/` | Consentimientos desde portal |
| `legal/` | Endpoints legales |
| `metrics/` | Métricas backend |
| `onboarding/` | Flujo inicial |

### 4.3 Patrones backend
- **Controllers finos:** enrutan, validan, delegan. Negocio en services.
- **Services como orquestadores:** Prisma + reglas de dominio + autorización + side effects (audit, mail).
- **DTOs con class-validator:** bloqueados por `ValidationPipe`.
- **Archivos ≤500 líneas hard, ≤300 líneas target.** Si un service crece, dividir en `*.helpers.ts`, `*.read-model.ts`, `*.policy.ts`, sub-servicios. NO usar service gordo como justificación.
- **`common/`** es la capa transversal: si una regla aparece en 3 módulos, vive aquí.
- **Estados clínicos persistidos como strings,** no enums de DB — validar transiciones en services y tests.

### 4.4 Persistencia
- Fuente de verdad: `backend/prisma/schema.prisma`.
- Provider: PostgreSQL.
- Detalle de entidades y relaciones: `docs/data-model.md`.

### 4.5 Auth (resumen)
- JWT access + refresh tokens.
- Sesiones por dispositivo con revocación (ver `auth.service.session.spec.ts`).
- 2FA TOTP con recovery codes (`auth-totp.service.ts`, `auth-recovery-codes.ts`).
- Bootstrap: primera cuenta creada por `/register` recibe rol admin; luego no se reparten "coronas".
- Refresca tokens vía `POST /auth/refresh`.

### 4.6 Auditoría
- Módulo `audit/` con catálogo (`audit-catalog.ts`), diff persistente, chain verifier (`audit-chain-verifier.ts`), helper (`audit-helpers.ts`), integrity (`audit-integrity.ts`).
- Toda acción sensible pasa por aquí. Detalle operacional en `docs/security-and-permissions.md`.

### 4.7 Tests backend
- Jest unit + spec por módulo (`.spec.ts` junto al source).
- E2E: `backend/test/app.e2e-spec.ts` — **stateful/sequential**, ejecutar el archivo completo (NO filtrar con `--testNamePattern`).
- Scripts clave: `npm --prefix backend run test`, `test:e2e`, `typecheck`.

## 5. Frontend (`frontend/`)

### 5.1 Estructura

```
frontend/
├── next.config.js          # rewrite /api/* → backend
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root: fuente Inter, globals.css, Providers
│   │   ├── page.tsx        # Raíz — NO hereda (dashboard) layout automáticamente
│   │   ├── (dashboard)/    # Shell privado (DashboardLayout)
│   │   ├── login/
│   │   ├── register/
│   │   └── cambiar-contrasena/
│   ├── components/         # Compartidos (forms, banners, FloatingQuickNotes, EncounterAuditTimeline, etc.)
│   ├── lib/                # api.ts, permissions.ts, proxy-session.ts, clinical-output.ts
│   ├── stores/             # Zustand (auth-store.ts principalmente)
│   ├── hooks/
│   ├── proxy.ts            # Gatekeeping de sesión per-request
│   ├── instrumentation.ts / instrumentation-client.ts
│   ├── types/
│   └── __tests__/
└── tests/e2e/              # Playwright (webServer levanta FE + BE E2E)
```

### 5.2 Reglas importantes frontend

- **Same-origin `/api` desde el browser.** Next.js rewrite lleva a backend. NO llamar al backend directo desde navegador (rompe cookies + sospechas falsas de auth roto).
- **`src/app/page.tsx` NO hereda `(dashboard)/layout.tsx`.** Si la home debe verse como dashboard, envolver explícitamente.
- **`src/proxy.ts`** = control de navegación. Detecta cookies, hace chequeo optimista, decide redirect. NO reemplaza enforcement del backend ni hace llamadas pesadas por request.
- **Validación efectiva de sesión** la hace `DashboardLayout` con `GET /api/auth/me`. El prefill post-login vive una sola vez para evitar refetch inmediato (login / register / 2fa/verify).
- **Permisos UI ≠ permisos backend.** UI oculta/informa; backend decide. Contrato compartido en `shared/permission-contract.ts`.

### 5.3 Estado cliente
- **Zustand** (`src/stores/auth-store.ts`): sesión, usuario, roles.
- **React Query 5:** fetching/cache de datos remotos.
- **`src/lib/api.ts`:** cliente API con refresh flow.
- **`src/lib/proxy-session.ts`:** reglas de decisión de sesión y redirección.
- **`src/lib/clinical-output.ts`:** bloqueos/ayudas de output clínico.

### 5.4 Layout de atención (`atenciones/[id]`)
- **Desktop xl+:** grid `xl:grid-cols-[264px_minmax(0,1fr)]` (expandido) o `[64px_1fr]` (colapsado).
- **Rail izquierdo (264/64 px):** sticky, navegación + progreso. Colapsable a solo iconos (64 px), persiste en `localStorage` key `anamneo:encounter-rail-collapsed`. Items `px-3 py-2.5`, círculos `size-7`. 3+ secciones completas → colapsable inline con animación `grid-template-rows: 0fr/1fr`. Botón colapsar con `aria-expanded` y chevron rotando 180°. Highlight de sección activa con `transition-all duration-200`.
- **Centro (1fr):** formulario `max-w-5xl`, contenido `max-w-4xl` interno.
- **Barra de progreso header:** `h-2`, `transition-all duration-300`. Rail tiene barra separada `h-1` `bg-status-green`.
- **Tools inline (NO drawer lateral desde 2026-04-14):**
  - **Revisión:** chip de estado en toolbar → sección inline (nota + cambio estado + resumen).
  - **Apoyo clínico:** `Más > Apoyo clínico`, inline sobre sección activa (notas internas, adjuntos, antecedentes, seguimiento rápido según permisos).
  - **Cierre:** bloque fijo tras sección activa cuando se puede cerrar (checklist + nota + seguimientos).
  - **Historial:** `Más > Historial` para usuarios con permiso auditoría; inline, sin overlay.
- Estado del panel inline: `activeWorkspacePanel` local, NO persistido.
- **Footer sección:** borde `border-frame/12` + fondo `bg-surface-base/25`.
- Componentes clave: `EncounterWorkspaceTools`, `FloatingQuickNotes`, `EncounterAuditTimeline`.

### 5.5 Testing frontend
- **Jest:** componentes y utilidades.
- **Playwright:** `frontend/tests/e2e`, levanta frontend + backend E2E propio vía `webServer`.
- Scripts: `npm --prefix frontend run test`, `test:e2e`, `typecheck`, `bundle:budget`.

## 6. Shared (`shared/`)

- **`shared/permission-contract.ts`:** contrato de permisos entre FE y BE. Roles: `MEDICO`, `ASISTENTE`, `ADMIN`. Define `PermissionContractUser`, `PermissionContractExpectations` (`canEditAntecedentes`, `canEditPatientAdmin`, `canCreateEncounter`, `canRegisterClinicalConsent`, `canRevokeClinicalConsent`, `canViewMedicoOnlySections`, `canUpdateReviewStatus`) y escenarios.
- El **backend es source of truth para enforcement**; el frontend solo refleja intención.

## 7. Comandos canónicos (raíz)

```bash
npm install                                # instala root + workspaces
npm run dev                                # supervisor (backend + frontend)
npm run dev:backend                        # backend watch con prisma migrate deploy previo
npm run dev:frontend                       # frontend Next.js en :5555
npm run build                              # backend + frontend
npm run db:migrate                         # prisma migrate dev
npm run db:seed                            # seed inicial
npm run db:reset                           # reset DB (destructivo)
npm run db:ops                             # backup + restore drill + monitor + alerta
npm run db:backup | db:backup:mirror | db:restore:drill | db:monitor | db:ops:monitor
npm run release                            # zip reproducible en releases/
npm run deploy                             # script bash de deploy
npm run docker:up | docker:down | docker:logs
npm run sentry:sourcemaps                  # inject + upload a Sentry
```

**Servicios locales esperados:**
- Frontend: `http://localhost:5555`
- API: `http://localhost:5678/api`

## 8. Matriz de validación (de AGENTS.md)

- **Solo backend:** `npm --prefix backend run typecheck` + `npm --prefix backend run test`.
- **Solo frontend:** `npm --prefix frontend run typecheck` + `npm --prefix frontend run test`.
- **Contratos / auth / permisos / encounters / cross-layer:**
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run test:e2e` cuando se afecta UX de ruta/auth.
- **Performance / bundle:** `npm run test:performance-regression` (corre backend, frontend, build y budget).

## 9. Gotchas (leer antes de tocar)

1. Browser → backend solo via `/api` same-origin. No romper rewrite a menos que se pida explícitamente.
2. `frontend/src/app/page.tsx` no hereda `(dashboard)/layout.tsx`.
3. `backend/test/app.e2e-spec.ts` es **stateful/sequential**. Correrlo completo, sin `--testNamePattern`.
4. Playwright arranca frontend; tests que pegan a `/api` real necesitan backend en `:5678`.
5. Archivos fuente manuales ≤300 líneas ideal, ≤500 hard. Dividir por dominio/responsabilidad.
6. El release hoy NO crea tags ni changelog (sólo zip). No prometerlos.
7. `docker-compose.yml` publica en loopback. Producción esperada: `Docker Compose + cloudflared`. NO exponer `:5678` a internet ni abrir `:5555` directo.
8. SMTP secrets cifrados con clave rotable — ver `docs/settings-key-rotation-runbook.md`.
9. Recuperación de cuentas / admin de emergencia: `docs/account-recovery-runbook.md`.
10. Auditoría: toda acción clínica/legal sensible debe pasar por `audit/`. La cadena es verificable (`audit-chain-verifier.ts`).
11. IDOR: matriz en `docs/idor-isolation-matrix.md`. Acceso a pacientes por encuentro debe estar enforced en services, no solo en UI.
12. Tests e2e Playwright = stateful. Limpieza entre tests vía helpers del proyecto, no asumir aislamiento.

## 10. Privacidad y cumplimiento (Chile)

- Marco: Ley 19.628 + Ley 21.719.
- Auditoría vigente: `docs/audits/ley-21719-chile-audit-2026-05-23.md`.
- Derechos del titular: módulo `patient-data-rights/` + runbook `account-recovery-runbook.md`.
- Retención y DPA: `docs/data-privacy-and-compliance.md`.
- Brechas: módulo `data-breach/` + runbook (revisar `docs/`).

## 11. Sistema de diseño

- Tokens activos: `docs/design-tokens-anamneo.md`.
- Iconografía: set propio, reglas en `docs/iconography.md`.
- Diseño raíz: `DESIGN.md`.
- Auditorías UI/UX: `docs/ui-ux-audit-remediation.md` + archivos ad-hoc en raíz (`anamneo-auditoria-playwright.md`, `visual-audit-desktop.md`) y `audit/`.
- Anti-patrones explícitos en `PRODUCT.md`: cards SaaS genéricas, headers de cristal oscuro, blur decorativo, ornamento, toast-only para estados clínicos, prompts nativos del browser para decisiones auditadas, micro-labels all-caps.

## 12. Flujo de release

- `npm run release` → `bash scripts/release.sh` → `releases/` (zip reproducible). No crea tags ni changelog.
- Deploy: `bash scripts/deploy.sh`. Detalles en `docs/deployment-and-release.md`.
- Sentry sourcemaps: `npm run sentry:sourcemaps` (org `alejandro-lopez-zelaya`, project `node-nestjs`).

## 13. Mapa rápido de archivos clave para código

| Tema | Archivo |
|---|---|
| Bootstrap backend | `backend/src/main.ts`, `main.bootstrap.ts` |
| Instrumentación Sentry | `backend/src/instrument.ts` |
| Schema DB | `backend/prisma/schema.prisma` |
| Auth guard backend | `backend/src/common/guards/jwt-auth.guard.ts` |
| Decorator usuario | `backend/src/common/decorators/current-user.decorator.ts` |
| Catálogo auditoría | `backend/src/audit/audit-catalog.ts` |
| Permisos compartidos | `shared/permission-contract.ts` |
| Proxy sesión FE | `frontend/src/proxy.ts` |
| Cliente API FE | `frontend/src/lib/api.ts` |
| Estado auth FE | `frontend/src/stores/auth-store.ts` |
| Decisión sesión FE | `frontend/src/lib/proxy-session.ts` |
| Permisos FE | `frontend/src/lib/permissions.ts` |
| Root layout FE | `frontend/src/app/layout.tsx` |
| Shell privado FE | `frontend/src/app/(dashboard)/layout.tsx` |
| Página atención FE | `frontend/src/app/(dashboard)/atenciones/[id]/...` |

## 14. Convenciones operativas para IAs

- **No proponer cambios a código no leído.** Si el usuario pide modificar un archivo, leer primero.
- **No añadir complejidad innecesaria.** Producto prioriza low-friction y low-maintenance.
- **No introducir `// removed` / shims de retrocompatibilidad.** Borrar lo no usado.
- **No comentar código** salvo que la lógica no sea autoexplicativa.
- **No prejuzgar permisos.** UI sugiere; backend decide. Para cualquier endpoint sensible, abrir `docs/security-and-permissions.md` y `docs/idor-isolation-matrix.md`.
- **Tests antes de declarar done.** Respetar matriz de validación por capa.
- **Estados clínicos visibles y reversibles.** No usar toast-only.
- **Idioma de producto y mensajes de UI:** español de Chile, sobrio, sin exclamaciones.
- **No inventar rituales.** Si algo no está documentado, preguntar antes de operar.

## 15. Cuando el usuario pregunta algo y no sabes la respuesta

1. Buscar primero en `docs/index.md` → documento relevante.
2. Si es sobre código: leer el archivo exacto (no explorar miles).
3. Si es cross-cutting o ambiguo: lanzar explore agent con `Depth: medium` o `thorough`.
4. Si toca producto / tono / UX: leer `PRODUCT.md` + `docs/design-tokens-anamneo.md`.
5. Si toca compliance: `docs/audits/ley-21719-chile-audit-2026-05-23.md` + `docs/data-privacy-and-compliance.md`.
6. Si toca release / deploy: `docs/deployment-and-release.md`.