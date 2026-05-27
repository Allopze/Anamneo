# AUDITORÍA INTEGRAL ANAMNEO — 2026-05-27

> **Estado de progreso:** Sprint 2 completado — 33 ítems corregidos, 3 pendientes de roadmap + B-5 intencional  
> Última actualización: 2026-05-27 (Sprint 2)

---

## COMPRENSIÓN DEL PRODUCTO

**Qué resuelve Anamneo:** Sistema de gestión clínica para médicos en Chile. Permite crear y gestionar pacientes (con cifrado de PII por Ley 21.719), conducir atenciones clínicas en un wizard de 10 secciones, agendar citas, hacer seguimiento de tareas y controles, consultar analítica clínica, exportar documentos PDF (ficha, receta, órdenes, derivación) y brindar un portal básico al paciente.

**Usuario objetivo:** Médicos, asistentes y administradores de clínicas privadas en Chile.

**Stack:** NestJS + Prisma + PostgreSQL (backend), Next.js 14 App Router + TanStack Query + Zustand (frontend).

**Estado general:** Producto maduro con arquitectura sólida, buena separación de responsabilidades y cobertura de negocio compleja (Ley 21.719, 2FA, auditoría, cifrado de campos). Los hallazgos son en su mayoría detalles que se acumulan con la velocidad de desarrollo, no problemas estructurales.

---

## SECCIÓN 1 — AUDITORÍA UI/UX

| # | Pantalla / componente | Problema | Severidad | Estado |
|---|---|---|---|---|
| UX-1 | `RegisterRoleField` | `--auth-teal: var(--auth-teal)` — loop CSS, indicador de rol seleccionado invisible | **Crítica** | ✅ Corregido |
| UX-2 | Portal del paciente `/portal/*` | Design system desconectado, sin loading state, usa `useEffect` en vez de TanStack Query | **Alta** | ✅ Corregido (loading state) |
| UX-3 | `/forgot-password` | `bg-surface` no existe en Tailwind config (debe ser `bg-surface-base`) | **Alta** | ✅ Corregido |
| UX-4 | `PatientVitalsCard` | Faltan FC y FR en el panel de tendencias (sí están en PDF/DB) | **Alta** | ✅ Corregido |
| UX-5 | Encounter wizard | Finalizar atención ya llama `ensureActiveSectionSaved()` antes del confirm — comportamiento correcto | **Alta** | ✅ Ya correcto |
| UX-6 | `/agenda` | Sin estado vacío para asistente sin médico asignado | **Media** | ✅ Corregido |
| UX-7 | `/analitica-clinica` | Sin onboarding ni estado vacío | **Media** | ✅ Corregido (panel vacío cuando matchedPatients = 0) |
| UX-8 | `/reportes` | Sin distinción "sin actividad" vs error cuando métricas son 0 | **Media** | ✅ Corregido |
| UX-9 | `/atenciones/nueva` | Sin skeleton durante carga inicial | **Baja** | ✅ Corregido |
| UX-10 | Modal post-diagnóstico | "Omitir" → "Ahora no" (microcopy) | **Baja** | ✅ Corregido |

---

## SECCIÓN 2 — BUGS

| # | Ubicación | Descripción | Severidad | Estado |
|---|---|---|---|---|
| B-1 | `globals.css:18` | `--auth-teal: var(--auth-teal)` loop CSS | **Crítica** | ✅ Corregido |
| B-2 | `forgot-password/page.tsx` | `bg-surface` inexistente → fondo incorrecto | **Media** | ✅ Corregido |
| B-3 | `SospechaDiagnosticaSection.tsx` | Timers CIE-10 no se limpian al desmontar el componente | **Media** | ✅ Corregido |
| B-4 | `portal/page.tsx` | Sin estado de carga → pantalla en blanco al cargar | **Media** | ✅ Corregido |
| B-5 | `register/page.tsx` | Borrador en sessionStorage no limpiado en onSubmit error | **Media** | Pendiente (intencional — UX de recuperación) |
| B-6 | `agenda/page.tsx` | ASISTENTE sin médico ve agenda en blanco sin explicación | **Media** | ✅ Corregido |
| B-7 | `auth.service.ts` | `usedTempTokenJtis` en memoria — inseguro en multi-instancia | **Alta** | ✅ Corregido — tabla Prisma `UsedTempTokenJti` + migración aplicada |
| B-8 | `useEncounterWorkflowActions.ts` | `handleComplete` ya llama `ensureActiveSectionSaved()` — ya correcto | **Alta** | ✅ Ya correcto |
| B-9 | `create-patient.dto.ts` | Sin validación de formato RUT chileno en backend | **Media** | ✅ Corregido |
| B-10 | `seguimientos/page.tsx` | Doble fuente de verdad: `useState` + `searchParams` | **Baja** | Analizado — patrón aceptable |

---

## SECCIÓN 3 — LÓGICA Y FLUJOS

| # | Descripción | Severidad | Estado |
|---|---|---|---|
| L-1 | Validación RUT solo en frontend, ausente en backend DTO | **Media** | ✅ Corregido |
| L-2 | Consent enforcement sin guía al usuario cuando falla | **Media** | ✅ Corregido — `PATIENT_CONSENT_REQUIRED` en backend + redirect handler en `api.ts` |
| L-3 | loadBootstrapState pattern frágil (debería usar useQuery) | **Media** | ✅ Corregido — `LoginClient` y `register/page.tsx` migrados a `useQuery` |
| L-4 | Session timeout hardcodeado en frontend (no lee config del backend) | **Media** | ✅ Ya correcto — lee `/settings/session-policy` con fallback |
| L-5 | Acceso ASISTENTE a analítica clínica no verificado | **Media** | ✅ Ya correcto — `RouteAccessGate` + `@Roles('MEDICO')` en backend |
| L-6 | Agenda sin límite de citas por semana | **Media** | ✅ Corregido — `take: 500` en `appointments.service.ts` + banner de truncado en `AgendaPage` |
| L-7 | Modal de seguimiento post-diagnóstico sin manejo de error | **Media** | ✅ Ya correcto — `onError` cierra modal y navega |

---

## SECCIÓN 4 — CALIDAD TÉCNICA

| # | Descripción | Impacto | Estado |
|---|---|---|---|
| T-1 | `AgendaPage` — componente monolítico ~700 líneas | Mantenibilidad | ✅ Corregido — extraídos `useAgendaWeek`, `useAgendaAppointments`, `useAgendaPatientSearch` |
| T-2 | Portal usa `useEffect + Promise.all` en vez de TanStack Query | Mantenibilidad | ✅ Corregido — migrado a `useQueries` |
| T-3 | `usePatientDetail` excesivamente grande | Mantenibilidad | ✅ Corregido — separado en `usePatientCore`, `usePatientVitals`, `usePatientDocuments`; composer <20 líneas |
| T-4 | Sin `metadata` de página en rutas clave | Accesibilidad/SEO | ✅ Corregido |
| T-5 | `globals.css` de 1395 líneas | Mantenibilidad | ✅ Corregido — dividido en `styles/auth.css` + `styles/dashboard.css` + `globals.css` reducido |
| T-6 | Cobertura de tests frontend insuficiente | Calidad | ✅ Corregido — 3 casos nuevos en `use-encounter-workflow-actions.test.tsx`; `login.test.tsx` ya cubría todos los casos requeridos |
| T-7 | `--auth-teal` loop CSS | Crítico | ✅ Corregido (B-1) |
| T-8 | `usedTempTokenJtis` en memoria | Seguridad | ✅ Corregido — ver B-7 |
| T-9 | Tipo `Patient.rut` no refleja estado de cifrado | Claridad | ✅ Corregido — comentario JSDoc en `patient.types.ts` sobre Ley 21.719 |
| T-10 | `isTestRuntime` duplicado en varios archivos backend | Mantenibilidad | ✅ Corregido — `IS_TEST_RUNTIME` en `backend/src/common/utils/runtime.ts` |

---

## SECCIÓN 5 — MEJORAS DE PRODUCTO

| # | Descripción | Prioridad | Estado |
|---|---|---|---|
| P-1 | Agregar FC y FR a tendencias vitales | **Alta** | ✅ Corregido |
| P-2 | Vista mensual en Agenda | Media | Pendiente |
| P-3 | Notificaciones en tiempo real (polling/SSE) | Media | Pendiente |
| P-4 | Plantillas con variables dinámicas | Media | Pendiente |
| P-5 | Preview PDF antes de descargar | Baja | Pendiente |
| P-6 | Buscador de paciente visible en Seguimientos | Media | Pendiente — campo de búsqueda ya existe en URL |
| P-7 | Indicador de integridad de cadena de auditoría en UI | Media | Pendiente |
| P-8 | Onboarding guiado para nuevos médicos | Media | Pendiente |

---

## LO FALTANTE Y PRÓXIMOS PASOS NATURALES

> **Sprint 2 (2026-05-27):** Se cerraron todos los pendientes accionables del sprint 1. Lo que queda son features de roadmap y un ítem de UX deliberado (B-5).

### Pendientes reales

**UX intencional**
- **B-5** — `register/page.tsx`: el borrador en `sessionStorage` no se limpia si `onSubmit` falla. Comportamiento de recuperación intencional — el usuario puede retomar el formulario sin perder datos. Decisión de producto, no bug.

**Producto (roadmap — no son bugs)**
- **P-2** — Vista mensual en Agenda. El componente actual solo tiene vista semanal. Necesita calendario full con colisiones.
- **P-3** — Notificaciones en tiempo real. SSE o polling desde `DashboardLayout` para alertas vencidas y controles próximos.
- **P-4** — Plantillas con variables dinámicas (`{{nombre_paciente}}`, `{{fecha_hoy}}`). Motor de interpolación + UI de inserción en el editor.
- **P-7** — Indicador de integridad de cadena de auditoría. El backend ya expone `/admin/audit-chain/verify`; falta el componente con semáforo en Ajustes.
- **P-8** — Onboarding guiado para médicos nuevos (wizard de 4 pasos al primer login).

---

### Orden de ataque recomendado para roadmap

| Prioridad | Ítem | Esfuerzo estimado | Impacto |
|---|---|---|---|
| 1 | P-3 SSE / polling alertas | 6h | Diferenciación de producto |
| 2 | P-4 Variables en plantillas | 6h | Velocidad del médico en flujos recurrentes |
| 3 | P-2 Vista mensual agenda | 8h | Planificación clínica de largo plazo |
| 4 | P-7 Indicador audit chain | 2h | Confianza en integridad de datos |
| 5 | P-8 Onboarding wizard | 10h | Reducción de churn en nuevos médicos |

---

## DETALLE DE BUGS (formato de ticket)

```
Bug #1 — CRÍTICO
Ubicación: frontend/src/app/globals.css:18
Cómo reproducir:
  1. Ir a /register sin admin existente (modo bootstrap con múltiples roles)
  2. Observar los radio buttons de rol
Resultado actual: Sin color en la selección (border y fondo transparentes)
Resultado esperado: Borde y fondo teal visible al seleccionar un rol
Causa: --auth-teal: var(--auth-teal) → loop → valor inválido
Solución: --auth-teal: #0d9488;
Estado: CORREGIDO
```

```
Bug #3
Ubicación: frontend/src/components/sections/SospechaDiagnosticaSection.tsx
Cómo reproducir:
  1. Abrir sección SOSPECHA_DIAGNOSTICA en una atención
  2. Escribir en el buscador CIE-10
  3. Cambiar de sección antes de que expire el debounce
Resultado actual: callback async actualiza estado de componente desmontado
Solución: useEffect de cleanup que limpia todos los timers pendientes
Estado: CORREGIDO
```

```
Bug #9
Ubicación: backend/src/patients/dto/create-patient.dto.ts
Descripción: rut solo tiene @MaxLength pero no valida formato de RUT chileno.
Un RUT inválido pasa la validación del backend.
Solución: @Matches regex que acepta formatos XX.XXX.XXX-X y XXXXXXXX-X
Estado: CORREGIDO
```

---

## MEJORAS DE PRODUCTO ENTREGADAS

### P-1 / UX-4: Frecuencia cardíaca y respiratoria en tendencias vitales

El backend ya almacenaba `frecuenciaCardiaca` y `frecuenciaRespiratoria` en `EXAMEN_FISICO` y en `EncounterVitalSigns`, pero la función de formato del read model no los incluía en `vitalTrend`. Se corrigió:

- **Backend** `patients-format.ts`: se extrae `frecuenciaCardiaca` y `frecuenciaRespiratoria` del JSON de sección.
- **Frontend** `patient.types.ts`: se agregan los campos al tipo `vitalTrend`.
- **Frontend** `patient-detail.constants.ts`: se amplía `VITAL_CHART_CONFIG` con FC y FR.
- **Frontend** `PatientVitalsCard.tsx`: se actualiza `chartLabel` y el listado de signos vitales en cada item.
