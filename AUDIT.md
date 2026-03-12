# Análisis completo del proyecto "Fichas Clínicas"

Proyecto de gestión de fichas clínicas médicas con backend NestJS + Prisma (SQLite) y frontend Next.js 14. Soporte para roles MEDICO, ASISTENTE y ADMIN.

---

## BUGS CRÍTICOS (causan errores en runtime)

| # | Problema | Ubicación |
|---|---------|-----------|
| **B1** | **Import faltante `FiFileText`** — el ícono se usa pero no se importa. Crash al renderizar encuentro para usuarios con permisos de edición de antecedentes. | `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` |
| **B2** | **Loop infinito de renders en el cálculo de IMC** — `useEffect` llama `onChange()` que actualiza `data`, que re-dispara el efecto. La guarda `sv.imc !== imc` no previene del todo el ciclo. | `frontend/src/components/sections/ExamenFisicoSection.tsx` |
| **B3** | **Loop infinito en MotivoConsulta** — `useCallback` wrapping `debounce()` tiene `[data, onChange]` como dependencias. Cada auto-select cambia `data` → recrea el callback → destruye el timer del debounce → re-dispara búsqueda. | `frontend/src/components/sections/MotivoConsultaSection.tsx` |
| **B4** | **Autosave compara shapes incompatibles** — `lastSavedRef.current` se inicializa con todas las secciones pero se compara contra una sola. Siempre detecta "cambios" y guarda innecesariamente. | `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` |
| **B5** | **`@IsEnum` usado incorrectamente con array plano** en `SaveSuggestionDto` — `@IsEnum(['AUTO', 'MANUAL'])` no funciona como se espera. Debería ser `@IsIn(...)`. La validación puede fallar silenciosamente. | `backend/src/conditions/dto/save-suggestion.dto.ts` |
| **B6** | **`UpdateUserDto.medicoId` tipado como `string \| null`** pero `@IsUUID()` rechaza `null`. El flujo de "desasignar médico" desde admin está roto. | `backend/src/users/dto/update-user.dto.ts` |
| **B7** | **`debounce.ts` hace type assertion `as T` incorrecto** — la función retorna `void` via `setTimeout`, pero el tipo dice que retorna lo que `T` retorna. Los callers obtienen `undefined`. | `frontend/src/lib/debounce.ts` |

---

## VULNERABILIDADES DE SEGURIDAD

| # | Problema | Ubicación |
|---|---------|-----------|
| **S1** | **Tokens JWT en localStorage** via Zustand `persist` — vulnerable a XSS. HttpOnly cookies sería más seguro. | `frontend/src/stores/auth-store.ts` |
| **S2** | **Sin `@MaxLength` en NINGÚN campo de NINGÚN DTO** — permite payloads arbitrariamente grandes. Bcrypt tiene límite de 72 bytes en passwords; strings enormes causan truncación silenciosa o DoS. | Todos los DTOs del backend |
| **S3** | **`sectionKey` como `@Param` no se valida** — cualquier string se acepta. Un `sectionKey` inválido falla silenciosamente sin error claro. | `backend/src/encounters/encounters.controller.ts` |
| **S4** | **`Record<string, any>` con solo `@IsObject()`** sin validación profunda — permite almacenar JSON arbitrario en historial y secciones de encuentro. | `backend/src/patients/dto/update-patient-history.dto.ts`, `backend/src/encounters/dto/update-section.dto.ts` |
| **S5** | **Registro permite rol `ADMIN` en el DTO** — aunque el servicio lo restringe al primer usuario, el DTO lo expone. Un POST crafteado puede intentar registrar admin. | `backend/src/auth/dto/register.dto.ts` |
| **S6** | **Sin `@Transform` ni sanitización en ningún DTO** — toda sanitización es ad-hoc en servicios (y solo en algunos campos). | Global |

---

## INCONSISTENCIAS DE DATOS / SCHEMA

| # | Problema | Detalle |
|---|---------|---------|
| **D1** | **SQLite en desarrollo, Postgres en Docker** — `schema.prisma` apunta a `file:./dev.db` (SQLite) pero `docker-compose.yml` levanta PostgreSQL. Incompatibilidad de providers al desplegar. |
| **D2** | **Política de passwords inconsistente** — Login acepta `min 6`, Registro requiere `min 8` + complejidad, Admin crea usuarios con `min 6` sin complejidad. |
| **D3** | **`CreateEncounterDto.notes` es código muerto** — el campo existe en el DTO pero el servicio nunca lo lee. |
| **D4** | **Sin `@Transform(.trim())` ni `.toLowerCase()` en emails** — `usuario@MAIL.com` y `usuario@mail.com` son usuarios distintos. |
| **D5** | **Historial se serializa a JSON con `if (dto.field)` en vez de `if (dto.field !== undefined)`** — enviar un campo con valor `null`, `""` o `0` no lo actualiza (falsy check). | `backend/src/patients/patients.service.ts` → `updateHistory` |

---

## FUNCIONALIDADES FALTANTES

| # | Funcionalidad | Impacto |
|---|-------------|---------|
| **F1** | **Sin paginación en lista de atenciones** — el state `page` existe y se pasa al API, pero no se renderizan botones de paginación. Usuarios ven solo la primera página. | Alto |
| **F2** | **Ficha clínica imprimible faltan 2 secciones** — "Revisión por Sistemas" y "Respuesta al Tratamiento" no se renderizan en la vista de impresión. | Alto |
| **F3** | **Sin flujo de "olvidé mi contraseña"** — no hay endpoint ni UI para recuperación. | Alto |
| **F4** | **Sin endpoint `/api/health`** — `docker-compose.yml` hace healthcheck a `/api/health` pero no existe ningún endpoint. El container reportará unhealthy. | Alto |
| **F5** | **Página de Ajustes es un stub** — solo muestra versión y URL del API. Sin funcionalidad real. | Medio |
| **F6** | **Sin manejo de offline/red caída** — sin banner offline, sin retry-on-reconnect, sin `onError` default en `QueryClient`. | Medio |
| **F7** | **Sin validación RUT en el frontend** — se acepta cualquier string. La validación existe en el backend pero el usuario no obtiene feedback instantáneo. | Medio |
| **F8** | **Admin muestra UUID raw del médico asignado** — en vez del nombre del médico. | Medio |
| **F9** | **Búsqueda global (⌘K) es mentira visual** — muestra el badge `⌘K` pero no hay `keydown` listener. La búsqueda siempre redirige a `/pacientes` sin importar la página actual. | Bajo |
| **F10** | **Sin tests unitarios ni e2e** — ni un solo archivo `.spec.ts` en el proyecto. Los scripts `test` están configurados pero no hay tests. | Alto |
| **F11** | **Sin rate limiting visual / CAPTCHA** en login/registro — el backend tiene throttler pero el frontend no muestra feedback del rate limit. | Bajo |
| **F12** | **Audit log solo accesible para MEDICO** — sin UI de admin para ver logs de auditoría globales. El `AuditController` solo tiene `findByEntity`, falta `findAll` general para admin. | Medio |
| **F13** | **Sin reactivar usuarios** — `UsersService.remove()` hace soft-delete (desactiva), pero no hay endpoint para reactivar. | Medio |
| **F14** | **Asistente no puede editar secciones del encuentro** — `@Roles('MEDICO')` en `updateSection` excluye a asistentes. | Medio |

---

## PROBLEMAS DE UX

| # | Problema | Ubicación |
|---|---------|-----------|
| **U1** | **Sin `Suspense` para `useSearchParams()`** — Next.js 13+ lo requiere; causa warnings o errores en build. | Atenciones y Pacientes pages |
| **U2** | **Errores no mostrados en listas** — queries de pacientes, atenciones y catálogo ignoran `error`. Si el API falla, el usuario ve skeletons eternos. | Varias páginas |
| **U3** | **Login usa `<a>` en vez de `<Link>`** para ir a registro — causa recarga completa de página. | `frontend/src/app/login/page.tsx` |
| **U4** | **Formularios de admin sin validación client-side** — se puede enviar formularios vacíos de creación de usuario. | `frontend/src/app/(dashboard)/admin/usuarios/page.tsx` |
| **U5** | **Copyright "© 2024" hardcodeado** — la fecha actual es 2026. | `frontend/src/app/register/page.tsx` |
| **U6** | **Botón "Volver a edición" aparece para encuentros completados** — misleading porque son read-only. | `frontend/src/app/(dashboard)/atenciones/[id]/ficha/page.tsx` |
| **U7** | **Selects sin opción vacía por defecto** — Sexo y Previsión auto-seleccionan el primer valor sin elección del usuario. | `frontend/src/components/sections/IdentificacionSection.tsx` |
| **U8** | **Sin límites en signos vitales** — se puede ingresar temperatura de 500°C o peso negativo. | `frontend/src/components/sections/ExamenFisicoSection.tsx` |
| **U9** | **Header de wizard desborda en tablets** — 5+ botones sin `flex-wrap`. | `frontend/src/app/(dashboard)/atenciones/[id]/page.tsx` |
| **U10** | **Búsqueda del catálogo no está debounced** — cada tecla dispara un request al API. | `frontend/src/app/(dashboard)/catalogo/page.tsx` |

---

## CALIDAD DE CÓDIGO

| # | Problema |
|---|---------|
| **Q1** | Todos los componentes de sección usan `data: any` y `onChange: (data: any) => void` — elimina el valor de TypeScript en todo el sistema de formularios. |
| **Q2** | `getEffectiveMedicoId()` duplicado en 3 servicios (patients, encounters, attachments). Debería ser utility compartido. |
| **Q3** | `JSON.parse` de synonyms/tags disperso en múltiples archivos. Debería centralizarse. |
| **Q4** | Service de pacientes usa `(updatePatientDto as any).rut` — el casting a `any` para acceder a propiedades indica que los tipos del DTO no están correctamente definidos. |
| **Q5** | `JwtStrategy.validate()` usa `(user as any).isAdmin` y `(user as any).medicoId` — los tipos del select de Prisma no incluyen estos campos. |

---

## RESUMEN DE PRIORIDADES

| Prioridad | Items | Acción |
|-----------|-------|--------|
| **P0 — Crashes** | B1, B2, B3, B5, B6 | Fix inmediato |
| **P1 — Seguridad** | S1-S6, D1 | Fix antes de producción |
| **P2 — Funcionalidad rota** | F1, F2, F4, F14 | Usuarios impactados |
| **P3 — Validación** | Todos los DTOs sin `@MaxLength`, D2, D4, D5 | Hardening |
| **P4 — UX** | U1-U10 | Mejora de experiencia |
| **P5 — Deuda técnica** | F10 (tests), Q1-Q5 | Mantenibilidad |
