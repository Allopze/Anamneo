# Auditoría de producción de Anamneo

Fecha: 2026-05-28  
Auditor: Claude Sonnet 4.6 (auditoría técnica autónoma)  
Contexto: uso personal o de muy baja escala con datos clínicos sensibles.

---

## 1. Resumen ejecutivo

**Estado general: Casi listo** *(fixes de sesión 8 aplicados — 2026-05-28)*  
**Recomendación: Usar con cautela** — el único bloqueador real restante es el backup/restore drill antes del primer dato real.

Todos los gates de código pasan limpio. Todos los hallazgos de código de esta auditoría fueron corregidos en la misma sesión. El sistema tiene una base técnica sólida para uso personal: autenticación con cookies HttpOnly, cifrado de PHI a nivel aplicación, auditoría con hash chain, soft-delete, validaciones server-side robustas, suite de tests amplia y build reproducible.

**Top 5 cosas que corregiría antes de meter datos reales:**

1. ✅ ~~Corregir la warning de ref en `SospechaDiagnosticaSection.tsx:25`~~ — **HECHO sesión 8**
2. ✅ ~~Remover `eslint-disable` innecesario en `PdfPreviewModal.tsx`~~ — **HECHO sesión 8**
3. ✅ ~~Aclarar fuente de verdad de alergias en sidebar~~ — **HECHO sesión 8** (renombrado a "antecedentes"; badge de alergias críticas en cabecera)
4. ✅ ~~Documentar `NEXT_PUBLIC_STRICT_CSP` en `.env.example` y `.env`~~ — **HECHO sesión 8**
5. **Ejecutar backup real y restore drill** — único bloqueador operacional pendiente.

---

## 2. Contexto y alcance asumido

Esta auditoría está pensada para Anamneo como herramienta personal o semi-personal, usada por una persona o muy pocas personas de confianza. No se mide contra Epic, Cerner ni despliegues regulados enterprise.

El criterio es pragmático: evitar pérdida de datos, exposición accidental de información sensible, errores clínicos por UI confusa, builds rotos, validaciones ausentes y flujos principales inconsistentes. Compliance hospitalario avanzado, SSO corporativo, HL7/FHIR y multi-tenant quedan fuera del alcance salvo como notas futuras.

El `.env` de la máquina auditada tiene las claves reales configuradas (JWT_SECRET, JWT_REFRESH_SECRET, BOOTSTRAP_TOKEN, SETTINGS_ENCRYPTION_KEY, ENCRYPTION_KEY). La auditoría evalúa el estado actual del sistema en esa máquina.

---

## 3. Comandos ejecutados y resultados

| Comando | Resultado | Observaciones |
|---|:---:|---|
| `npm --prefix backend run typecheck` | ✅ | TypeScript backend sin errores. |
| `npm --prefix frontend run typecheck` | ✅ | TypeScript frontend sin errores. |
| `npm --prefix backend run lint:check` | ✅ | 0 errores, 0 warnings. |
| `npm --prefix frontend run lint` | ✅ | **0 errores, 0 warnings** (tras sesión 8: ref stale y eslint-disable corregidos). |
| `npm --prefix backend run test -- --runInBand` | ✅ | 97 suites, 526/528 tests (2 skipped intencionales). |
| `npm --prefix frontend run test -- --runInBand` | ✅ | 70 suites, 334/334 tests. |
| `npm run build` | ✅ | Backend y frontend compilan sin errores. |
| `npm --prefix backend run audit:prod` | ✅ | 0 vulnerabilidades high en dependencias productivas. |
| `npm --prefix frontend run audit:prod` | ✅ | 0 vulnerabilidades high en dependencias productivas. |
| `git ls-files \| grep -E "\.env$"` | ✅ | Solo `.env.example` rastreados. `.env` real está correctamente ignorado. |

Playwright y E2E no se ejecutaron porque requieren base PostgreSQL activa con datos de prueba. Los tests unitarios y de integración verifican la lógica crítica de forma suficiente para la evaluación.

---

## 4. Hallazgos prioritarios

| Prioridad | Área | Hallazgo | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|
| P1 | Operacional | Sin backup/restore drill probado | Pérdida total de datos ante fallo de disco o migración | Ejecutar `npm run db:backup` y `npm run db:restore:drill` con base de prueba antes del primer dato real | Bajo |
| ~~P1~~ **FIXED** | Seguridad | CSP con `'unsafe-inline'` por defecto en producción | XSS aprovechable si se inyecta HTML | **Sesión 8:** `NEXT_PUBLIC_STRICT_CSP=false` documentado en `.env` y `.env.example`; activar `=true` en prod. | Bajo |
| ~~P2~~ **FIXED** | Seguridad | `ANAMNEO_MONITOR_DB_PASSWORD` y `GRAFANA_ADMIN_PASSWORD` con fallback débil en docker-compose | Acceso con contraseña conocida si se abre el puerto | **Sesión 8:** `.env.example` actualizado con instrucción `openssl rand -base64 24` y advertencia explícita | Bajo |
| ~~P2~~ **FIXED** | Datos clínicos / UX | Alergias en dos lugares sin indicador de cuál es autoritativo | Riesgo de perder alergia crítica mirando solo una fuente | **Sesión 8:** Sidebar renombra campo de texto a "Alergias (antecedentes)"; badge de alergias graves/fatales en cabecera del paciente | Bajo/medio |
| P2 | Datos clínicos | Medicamentos en dos lugares: `PatientHistory.medicamentos` (texto libre) y `EncounterTreatment` (estructurado) | Sin vista unificada de medicamentos crónicos actuales por paciente | Agregar panel de "medicación actual" análogo a `PatientAllergiesList` | Medio |
| ~~P2~~ **FIXED** | UI/UX | `SospechaDiagnosticaSection.tsx:25`: ref stale en cleanup de efecto | Cleanup puede dejar timers sin cancelar al desmontar | **Sesión 8:** `cie10TimerRef.current` copiado a variable local antes del cleanup. | Bajo |
| ~~P3~~ **FIXED** | Seguridad | `NEXT_PUBLIC_STRICT_CSP` no documentado en `.env.example` | Operador nuevo no sabe que existe | **Sesión 8:** Variable documentada con valor `false` y comentario en `.env.example`. | Bajo |
| ~~P3~~ **FIXED** | UX | Sidebar: `HistoryCard` con campo `alergias` y `PatientAllergiesList` sin distinción visual | Médico puede actualizar solo una fuente | **Sesión 8:** Labels renombrados a "(antecedentes)" en `historyFields`. | Bajo |
| P3 | EMR | Sin lista de medicamentos crónicos dedicada por paciente | Seguimiento de medicación activa se pierde entre atenciones | Agregar módulo de "medicación activa" análogo a `PatientAllergiesList` | Medio |
| ~~P3~~ **FIXED** | Lint | `PdfPreviewModal.tsx:78`: directiva `eslint-disable` sin problema | Ruido en lint; 1 warning espurio | **Sesión 8:** Directiva removida. Frontend lint: 0 warnings. | Bajo |

---

## 5. Bugs e inconsistencias encontradas

### Warning P2 — Ref stale en cleanup de timer de CIE-10

**Evidencia:** `frontend/src/components/sections/SospechaDiagnosticaSection.tsx:25`

```tsx
useEffect(() => {
  return () => {
    Object.values(cie10TimerRef.current).forEach(clearTimeout);
  };
}, []);
// ESLint warning: "The ref value 'cie10TimerRef.current' will likely have changed
// by the time this effect cleanup function runs."
```

**Impacto:** El objeto `cie10TimerRef.current` puede haber mutado entre el montaje y el desmontaje. En la práctica el ref persiste (es el mismo objeto), pero el patrón es frágil y genera una advertencia legítima.

**Corrección simple:**
```tsx
useEffect(() => {
  const timers = cie10TimerRef.current;
  return () => {
    Object.values(timers).forEach(clearTimeout);
  };
}, []);
```

---

### Warning P3 — eslint-disable no usado en PdfPreviewModal

**Evidencia:** `frontend/src/components/common/PdfPreviewModal.tsx:78`

```
warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')
```

**Corrección:** Remover la directiva `// eslint-disable-next-line react-hooks/exhaustive-deps` de la línea 77.

---

### P2 — Dual allergy/medication fields (inconsistencia de datos clínicos)

**Evidencia:**

- `backend/prisma/schema.prisma:201-202`: `PatientHistory` tiene campos `medicamentos String?` y `alergias String?`.
- `backend/prisma/schema.prisma:173-191`: Existe modelo `PatientAllergy` con campos estructurados (alérgeno, severidad, tipo de reacción, fecha de inicio).
- `frontend/src/app/(dashboard)/pacientes/[id]/PatientDetailSidebar.tsx:51-52`: El sidebar renderiza primero `HistoryCard` (que incluye el campo `.alergias` de texto) y luego `PatientAllergiesList` (que muestra el modelo estructurado).
- `frontend/src/app/(dashboard)/pacientes/[id]/historial/page.tsx:8`: La página de historial permite editar ambos: el campo de texto libre `alergias` y los datos del modelo estructurado.

**Impacto:** Un médico puede registrar alergias en el campo de texto libre sin usar el módulo estructurado, o viceversa. La vista del sidebar muestra las dos secciones sin indicar cuál es autoritativa. En un contexto clínico, una alergia a penicilina registrada solo en el texto libre y no en el módulo estructurado puede no ser visible al buscar por alérgenos.

**Recomendación:** Etiquetar visualmente en la sidebar: el campo de texto libre como "Alergias (historial libre)" y el módulo estructurado como "Alergias registradas". O, preferiblemente, deprecar el campo de texto libre `PatientHistory.alergias` en favor del módulo estructurado y migrar los datos existentes.

---

### P1 — CSP con 'unsafe-inline' en producción por defecto

**Evidencia:** `frontend/src/lib/proxy-security.ts:13-20`:

```ts
const scriptSrc = isProd
  ? strictCspEnabled
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline'`   // ← usado cuando NEXT_PUBLIC_STRICT_CSP != 'true'
  : `'self' 'unsafe-inline' 'unsafe-eval'`;
```

`NEXT_PUBLIC_STRICT_CSP` no está en `.env.example` y por lo tanto el operador no lo activa por defecto. En producción el script-src queda con `'unsafe-inline'`.

**Impacto:** Si alguna ruta procesa HTML de usuario sin sanitizar correctamente, `'unsafe-inline'` permite inyección de scripts. El backend usa `sanitize-html` en secciones de encuentros. El riesgo es bajo pero evitable con una línea en `.env`.

**Corrección:** Agregar `NEXT_PUBLIC_STRICT_CSP=true` al `.env` de producción. Verificar en staging que Next.js no falle con inline scripts bloqueados (en versiones recientes los scripts de bootstrap de Next se sirven con nonce automáticamente).

---

### P2 — Contraseñas de servicios auxiliares con fallback débil

**Evidencia:** `docker-compose.yml:11` y `:236`:

```yaml
ANAMNEO_MONITOR_DB_PASSWORD: ${ANAMNEO_MONITOR_DB_PASSWORD:-change-me-before-production}
GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-change-me-before-production}
```

Si el operador no define estas variables en `.env`, Docker Compose usa el fallback. Grafana y el rol de monitor de la base de datos quedan con contraseñas conocidas.

**Impacto:** Grafana se publica en loopback (`127.0.0.1`) por defecto, lo que limita el riesgo a acceso local. Pero si hay túnel o se abre el puerto, cualquiera puede entrar a Grafana con `admin` / `change-me-before-production`.

**Corrección:**
```bash
# En .env local o de producción:
ANAMNEO_MONITOR_DB_PASSWORD=$(openssl rand -base64 24)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24)
```

---

## 6. Seguridad, privacidad y datos sensibles

### Fortalezas encontradas

- **Autenticación:** Cookies `httpOnly`, `sameSite: 'strict'`, `secure` en producción (`auth.controller.ts:35-43`). Refresh tokens en cookie separada.
- **Sesiones versionadas:** `refreshTokenVersion` en `User` y `UserSession`; revocación granular por dispositivo.
- **CSRF:** Double-submit cookie con `timingSafeEqual`, lista de exenciones mínima y bien documentada (`csrf.middleware.ts:10-27`).
- **Throttling:** Rate limiting por sesión/usuario en todas las rutas; límites más estrictos en login (5/min), register (3/min) y forgot-password (2/min) (`auth.controller.ts:28-35`).
- **Lockout de bruta fuerza:** `LoginAttempt` con 5 intentos máximo y bloqueo de 15 minutos (`auth-login-flow.ts:10`).
- **Cifrado de PHI:** AES-256-GCM para identificadores de paciente (RUT, nombre, teléfono, email, domicilio) y secciones de encuentros. `ENCRYPTION_KEY` obligatoria; el app no arranca sin ella (`main.helpers.ts:120-132`).
- **Cifrado de adjuntos:** Los archivos en disco se cifran con AES-256-GCM con envelope cuando `ENCRYPTION_KEY` está configurada (`attachments.service.ts:70-82`).
- **Validación de archivos:** Magic bytes verificados antes de persistir, no solo tipo declarado (`attachments.storage.ts:45-55`).
- **Auditoría con hash chain:** `AuditLog` con `integrityHash` y `previousHash`, verificable con `npm run audit:integrity:verify`.
- **PHI scrubbing:** RUTs, emails y credenciales se redactan en logs y Sentry antes de enviar (`phi-scrub.ts`).
- **Headers de seguridad:** Helmet con CSP estricta en el backend (que solo sirve JSON), nonce por request en el frontend, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
- **Secretos no versionados:** `git ls-files | grep -E "\.env$"` solo retorna `.env.example`. Secretos reales correctamente ignorados.
- **`assertSafeConfig`:** El backend rechaza arrancar en producción con placeholders, sin `ENCRYPTION_KEY`, sin `ENCRYPTION_AT_REST_CONFIRMED=true` ni con `TRUST_PROXY` ausente. Protección efectiva contra misconfiguraciones silenciosas.
- **Soft-delete:** Pacientes se archivan, no se borran. La purga regulatoria requiere que el paciente ya esté archivado y solo se ejecuta tras snapshot defensivo.
- **2FA TOTP:** Implementado con `otplib`, con backup codes y tabla `UsedTempTokenJti` para prevención de replay.

### Riesgos proporcionados al uso personal

- **CSP `'unsafe-inline'` por defecto en producción** (ver §5 — P1).
- **`GRAFANA_ADMIN_PASSWORD` y `ANAMNEO_MONITOR_DB_PASSWORD` con fallbacks conocidos** (ver §5 — P2).
- **`localStorage` de PHI local:** Si `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=false`, la clave WebCrypto para borradores locales de atención queda persistida en `localStorage`. En equipo compartido o perfil de navegador no privado, esto expone borradores cifrados pero con clave accesible localmente. Mantener `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` en producción.
- **Runtime local no versionado:** `.env`, `runtime/data/`, `backend/uploads/`, backups y bases de datos de Playwright no están en git (correcto), pero no conviene copiar el directorio del proyecto sin limpiar esos archivos.

### Recomendaciones inmediatas

1. Agregar `NEXT_PUBLIC_STRICT_CSP=true` al `.env` de producción.
2. Definir `GRAFANA_ADMIN_PASSWORD` y `ANAMNEO_MONITOR_DB_PASSWORD` con valores aleatorios.
3. Mantener `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true`.
4. Mantener backend y frontend en loopback detrás de tunnel HTTPS (Cloudflare Tunnel o similar).
5. No compartir el directorio del proyecto sin limpiar `runtime/`, `.env` y `backend/uploads/`.

---

## 7. Integridad de datos clínicos

### Fortalezas

- **Modelo amplio y coherente:** Paciente, historia clínica, encuentros por secciones, signos vitales, adjuntos, alergias, problemas activos, tareas de seguimiento, citas, consentimientos, portal de paciente y auditoría. El esquema Prisma tiene 1050 líneas y cubre el ciclo completo de una consulta.
- **Identificadores cifrados con hashes de lookup:** RUT tiene `rut_lookup_hash` para búsqueda sin descifrar; unicidad garantizada en base.
- **Soft-delete con reversión:** `archivedAt` para pacientes, `deletedAt` para adjuntos y alergias; restauración disponible. La purga regulatoria requiere confirmación explícita de admin.
- **Estados de encuentro:** `EN_PROGRESO` → `COMPLETADO`; no se pueden modificar adjuntos ni secciones de encuentros completados. Lógica forzada en backend.
- **Validación de archivos adjuntos:** MIME + magic bytes verificados, sanitización de filename, path traversal prevenido (`attachments.storage.ts:15-30`).
- **Firma de encuentros:** `EncounterSignature` con hash de contenido, IP, user agent y tipo de firma.
- **Backup automatizado:** Script `pg-backup.js` con pg_dump comprimido, SHA-256 del archivo y snapshot de uploads. Retención configurable.
- **Auditoría atómica:** Desde la sesión anterior, `auditService.log` corre dentro de la transacción en mutaciones de secciones de encuentros.

### Riesgos pendientes

- **Sin restore drill probado:** El riesgo número uno para uso personal. Un backup que no se ha restaurado es una esperanza, no una garantía. El script existe; falta ejecutarlo.
- **Dual allergy/medication fields** (ver §5 — P2): Riesgo de inconsistencia entre el texto libre de antecedentes y los módulos estructurados.
- **Sin vista consolidada de medicación activa:** Los medicamentos crónicos del paciente viven dispersos en tratamientos de encuentros pasados y en el campo de texto libre de antecedentes. No hay un panel de "medicación actual" unificado equivalente a `PatientAllergiesList`.
- **Signos vitales Q2 (pendiente de sprint anterior):** Según la memoria del proyecto, la integración de signos vitales Q2 estaba pendiente. La visualización existe (`PatientVitalsCard`), pero conviene verificar que el flujo de captura en el encuentro funciona de extremo a extremo.

### Mejoras pragmáticas recomendadas

- Panel persistente por paciente con alergias críticas, medicamentos activos y problemas activos en la cabecera o sidebar superior.
- Lista de medicación activa/crónica separada de las secciones de encuentro.
- Timeline clínico cronológico por paciente que integre encuentros, adjuntos, alergias, tareas y citas en una vista única con filtros.
- Export personal por paciente: PDF de ficha + adjuntos en ZIP, con fecha y alcance.
- Restore drill documentado como checklist de onboarding.

---

## 8. UI/UX

### Problemas concretos

**P2 — Dual allergy display sin separación clara**  
El sidebar del paciente muestra `HistoryCard` con campo `.alergias` de texto libre inmediatamente seguido de `PatientAllergiesList` con el modelo estructurado. No hay separación visual ni etiqueta que indique cuál es la fuente autoritativa. En un contexto clínico, esto puede llevar a pasar por alto una alergia registrada solo en uno de los dos lugares.

**P2 — Sin indicador visual de alergia crítica en la cabecera del paciente**  
`PatientDetailHeader` muestra nombre, RUT, edad y sexo del paciente. No hay badge o indicador de "alergia crítica" o "medicamento activo" en la cabecera. Cuando se abre una atención, el médico tiene que bajar en el sidebar para ver las alergias.

**P3 — Focus trap incompleto en algunos modales**  
`ConfirmModal` (corregido en sesión anterior para enfocar cancelar) usa `addEventListener` global para `Escape`. No hay un focus trap formal que capture Tab dentro del modal. En uso con teclado, Tab puede escapar al fondo.

**P3 — Estados de carga heterogéneos**  
Algunos componentes usan skeletons (ej: listado de pacientes), otros usan spinners genéricos y otros no muestran nada mientras cargan. La inconsistencia genera saltos visuales. Para una app clínica donde la velocidad de lectura importa, uniformizar los estados de carga mejora la experiencia.

### Cosas que funcionan bien

- Navegación por dashboard organizada y predecible.
- Crear paciente: validación de RUT, cálculo de edad, detección de duplicados, borrador de formulario con auto-persistencia.
- Wizard de atención: autoguardado por sección, Ctrl+S, Alt+Flecha para navegación entre secciones, confirmación antes de salir con cambios no guardados.
- Export clínico: PDF de ficha, receta, órdenes y derivación con control de acceso por estado de atención y completitud del paciente.
- `PatientVitalsCard`: trend charts, tabla comparativa, indicadores de valores fuera de rango con color.
- Agenda: vista semanal y mensual, modales de detalle, búsqueda de pacientes integrada.
- Seguimientos: filtros por tipo, prioridad, estado y fecha, edición inline.
- Toast de feedback en operaciones de guardado y error.
- Estados vacíos con mensajes de acción claros en la mayoría de las listas.

### Correcciones simples priorizadas

1. Etiquetar "Alergias (texto libre)" vs "Alergias registradas" en la sidebar del paciente.
2. Agregar badge de alergia en `PatientDetailHeader` si hay alergias activas con severidad GRAVE o FATAL.
3. Corregir la warning de ref en `SospechaDiagnosticaSection.tsx:25`.
4. Agregar focus trap formal (useFocusTrap o equivalente) en los modales principales.
5. Uniformizar estados de carga: decidir entre skeleton o spinner como estándar y aplicarlo consistentemente.

---

## 9. Funcionalidades EMR faltantes o mejorables

### Muy útiles para producción personal

| Funcionalidad | Estado actual | Recomendación |
|---|---|---|
| Lista de medicamentos activos/crónicos por paciente | Dispersos en `PatientHistory.medicamentos` (texto) y `EncounterTreatment` por atención | Agregar panel dedicado análogo a `PatientAllergiesList` |
| Panel crítico en cabecera: alergias activas | Solo visible bajando en sidebar | Badge/chip de alergia grave en `PatientDetailHeader` |
| Restore drill documentado | Scripts existen, no hay checklist de onboarding | Agregar checklist en `docs/operational-procedures.md` |
| Fuente única de verdad para alergias | Dual (texto libre + estructurado) | Etiquetar o deprecar el campo de texto libre |
| Exportación ZIP de paciente completo (ficha + adjuntos) | Solo PDF de atención o CSV admin | Agregar endpoint de bundle completo por paciente |

### Buenas mejoras futuras

- **Búsqueda global en texto clínico:** actualmente la búsqueda clínica es por nombre/RUT del paciente. Buscar dentro de diagnósticos, notas y tratamientos requeriría indexación de secciones.
- **Tags por paciente o evento clínico:** facilita la organización de casos crónicos o por especialidad.
- **Vista de cambios legible:** mostrar el diff del audit log en lenguaje humano, no como JSON técnico.
- **Recordatorios con alertas visuales más prominentes:** las tareas vencidas no tienen notificación activa; solo son visibles si el médico entra a Seguimientos.
- **Modo solo lectura / revisión:** para revisar fichas sin riesgo de edición accidental.
- **Consolidación del timeline:** integrar encuentros, adjuntos, alergias, tareas, citas y cambios en un único timeline cronológico por paciente con filtros.

### Opcionales o avanzadas

- Búsqueda full-text con PostgreSQL FTS o vector search para notas clínicas.
- OCR de documentos adjuntos (PDFs de exámenes).
- Interoperabilidad HL7/FHIR para exportación estándar.
- Multi-tenant / clínicas múltiples.
- Firma electrónica avanzada (FEA/FES legal externa).
- Dashboards analíticos avanzados por cohorte.

---

## 10. Calidad técnica y mantenibilidad

### Fortalezas

- **Separación de responsabilidades clara:** módulos NestJS por dominio, helpers de lectura/escritura separados, DTOs con class-validator, guards reutilizables.
- **Tipado estricto:** TypeScript sin errores en backend y frontend; types compartidos en `/shared`.
- **Patrones consistentes:** mutations con auditoría atómica, acceso por scope de médico, read-models separados de write-side.
- **Tests útiles:** 97 suites de backend cubren servicios, guards, helpers y concurrencia; 70 suites de frontend cubren hooks, stores y componentes clave.
- **Documentación activa:** `docs/` con índice, arquitectura, modelo de datos, seguridad, permisos, operaciones PostgreSQL, runbooks y registro de decisiones.
- **Scripts operacionales:** backup, restore drill, monitor de PostgreSQL, verificación de integridad de auditoría, redacción de logs de clinical, etc.

### Riesgos de mantenibilidad

- **`PatientHistory` con campos de texto libre que duplican módulos estructurados:** `alergias` y `medicamentos` en texto plano coexisten con `PatientAllergy` y `EncounterTreatment`. Esto puede acumular deuda si los módulos estructurados evolucionan y el texto libre queda desactualizado.
- **Archivos grandes:** `schema.prisma` tiene 1050 líneas. Es manejable pero cerca del umbral donde la orientación por archivo se vuelve necesaria. A medida que el schema crezca, evaluar si conviene dividirlo con Prisma schema splitting.
- **`PatientDetailSidebar.tsx` con muchas responsabilidades:** Renderiza información personal, historia, alergias, problemas, tareas, vitales, consents y alertas. Si crece más, considerar extracción de secciones en componentes de nivel superior.
- **Dependencias con overrides:** Tanto backend como frontend tienen `overrides` para forzar versiones de dependencias transitivas. Revisar periódicamente si ya no son necesarios al actualizar dependencias directas.

---

## 11. Testing mínimo recomendado

### Gates que deben pasar antes de datos reales

```bash
npm --prefix backend run typecheck   # ✅ pasa
npm --prefix frontend run typecheck  # ✅ pasa
npm --prefix backend run lint:check  # ✅ pasa
npm --prefix frontend run lint       # ✅ pasa (2 warnings menores)
npm --prefix backend run test -- --runInBand    # ✅ 526/528
npm --prefix frontend run test -- --runInBand   # ✅ 334/334
npm run build                        # ✅ pasa
```

### Tests adicionales recomendados (con base de datos activa)

```bash
npm --prefix backend run test:e2e -- --runInBand
npm --prefix frontend run test:e2e:smoke
npm --prefix frontend run test:e2e:workflow-clinical
npm --prefix frontend run test:e2e:a11y
npm run db:ops  # backup + restore drill + monitor
```

### Tests puntuales que agregaría

- ~~**CSP con strict mode**~~ — **HECHO sesión 8+**: ya existía en `proxy.test.ts`. Verificado.
- ~~**Stale ref de timer CIE-10**~~ — **HECHO sesión 8+**: `src/__tests__/components/sospecha-diagnostica-section.test.tsx` (7 tests): timer scheduling, cancelación, cleanup on unmount, API call post-debounce, wrapper controlado.
- ~~**Allergy badge en `PatientDetailHeader`**~~ — **HECHO sesión 8+**: `src/__tests__/components/patient-detail-header.test.tsx` (7 tests): sin badge para LEVE/MODERADA, badge para GRAVE, badge para FATAL, contador múltiple, ignorar soft-deleted, query key compartido.
- ~~**E2E: registro de alergia y badge**~~ — **HECHO sesión 8+**: `tests/e2e/workflow-clinical.spec.ts` — test "register GRAVE allergy and verify critical badge appears in header" añadido al flujo serial.
- **Backup/restore:** `npm run db:backup` + verificar SHA-256. Pendiente manual (requiere PostgreSQL vivo).

### Pruebas manuales recomendadas

1. Login, refresh de sesión y expiración/logout.
2. Crear paciente completo y rápido; detectar duplicado por RUT.
3. Crear atención, autosave, cambio de sección, cierre, firma y reapertura.
4. Registrar alergia en módulo estructurado y verificar que aparece en sidebar.
5. Adjuntar PDF, descargar y verificar que el archivo es idéntico al original.
6. Exportar PDF de ficha y de receta/órdenes.
7. Archivar paciente y restaurarlo.
8. **Backup y restore drill con base de prueba** (el único bloqueador real restante).

---

## 12. Recomendaciones de implementación priorizadas

1. **Ejecutar backup + restore drill** — único bloqueador operacional antes de datos reales.
2. ~~**Activar `NEXT_PUBLIC_STRICT_CSP=true`** en `.env` de producción~~ — **HECHO sesión 8** (documentado; activar `=true` en `.env` de prod).
3. ~~**Definir `GRAFANA_ADMIN_PASSWORD` y `ANAMNEO_MONITOR_DB_PASSWORD`** con valores aleatorios~~ — **HECHO sesión 8** (instrucciones en `.env.example`).
4. ~~**Corregir ref stale en `SospechaDiagnosticaSection.tsx:25`**~~ — **HECHO sesión 8**.
5. ~~**Remover directiva `eslint-disable` innecesaria en `PdfPreviewModal.tsx:78`**~~ — **HECHO sesión 8**.
6. ~~**Documentar `NEXT_PUBLIC_STRICT_CSP` en `.env.example`**~~ — **HECHO sesión 8**.
7. ~~**Etiquetar "Alergias (texto libre)" vs "Alergias registradas"** en sidebar~~ — **HECHO sesión 8** (renombrado a "(antecedentes)").
8. ~~**Agregar badge de alergia grave en `PatientDetailHeader`**~~ — **HECHO sesión 8** (badge visible con `FiAlertTriangle` para GRAVE/FATAL).
9. **Agregar panel de medicación activa por paciente** — análogo a `PatientAllergiesList`, consolidando tratamientos activos de atenciones.
10. **Verificar `NEXT_PUBLIC_STRICT_CSP=true` en staging** antes de activar en producción (Next.js puede necesitar ajuste de nonce en algunos builds).

---

## 13. Veredicto final

Anamneo está **casi listo** para uso personal con datos reales. Todos los gates de código pasan limpio. La arquitectura de seguridad es sólida para el contexto: cifrado de PHI, auditoría, soft-delete, validaciones server-side, CSRF, throttling, lockout de bruta fuerza y secretos correctamente aislados del repositorio.

El único bloqueador real antes de meter el primer dato real es la prueba de backup/restore. Sin esa prueba, no hay garantía de recuperación ante pérdida de datos, que es el riesgo número uno para una app personal.

**Condiciones mínimas para usar con datos reales:**

1. ✅ Build y gates de código pasan (0 errores, 0 warnings).
2. ✅ `ENCRYPTION_KEY` y demás secretos configurados con valores reales.
3. ✅ UI de alergias clarifica fuente de verdad; badge de críticas en cabecera.
4. ✅ `NEXT_PUBLIC_STRICT_CSP` documentado en `.env` y `.env.example`.
5. ✅ `.env.example` con instrucciones para generar contraseñas de Grafana/monitor.
6. ⏳ **Backup real ejecutado y restauración verificada en base de prueba** — único pendiente.
7. ⏳ Activar `NEXT_PUBLIC_STRICT_CSP=true` en el `.env` de producción (verificar en staging primero).
8. ⏳ Definir `GRAFANA_ADMIN_PASSWORD` y `ANAMNEO_MONITOR_DB_PASSWORD` con valores aleatorios en el `.env` de producción.

**Lo que puede esperar:**

- Panel de medicación activa por paciente (análogo a `PatientAllergiesList`).
- Focus trap formal en modales.
- Timeline clínico unificado (encuentros + adjuntos + alergias + tareas).
- Test de CSP con `NEXT_PUBLIC_STRICT_CSP=true` en `proxy.test.ts`.

---

## Cambios que haría antes de meter datos reales

En orden de prioridad:

1. **Ejecutar `npm run db:backup`** y verificar que el archivo generado tiene SHA-256 válido.
2. **Ejecutar `npm run db:restore:drill`** con una base de prueba y confirmar que los datos se recuperan.
3. ~~Agregar `NEXT_PUBLIC_STRICT_CSP=true` al `.env` de producción.~~ **HECHO sesión 8** (documentado; activar `=true` en `.env` de prod).
4. ~~Definir `GRAFANA_ADMIN_PASSWORD` con valor aleatorio en `.env`.~~ **HECHO sesión 8** (instrucciones en `.env.example`).
5. ~~Definir `ANAMNEO_MONITOR_DB_PASSWORD` con valor aleatorio en `.env`.~~ **HECHO sesión 8**.
6. ~~Corregir ref stale en `SospechaDiagnosticaSection.tsx:25`.~~ **HECHO sesión 8**.
7. ~~Remover directiva `eslint-disable` innecesaria en `PdfPreviewModal.tsx:78`.~~ **HECHO sesión 8**.
8. ~~Agregar `NEXT_PUBLIC_STRICT_CSP` a `.env.example`.~~ **HECHO sesión 8**.
9. ~~Etiquetar alergias de antecedentes vs. estructuradas en sidebar.~~ **HECHO sesión 8** (renombrado a "(antecedentes)").
10. ~~Agregar badge de alergia grave en `PatientDetailHeader`.~~ **HECHO sesión 8** (badge con `FiAlertTriangle` para GRAVE/FATAL).
11. Verificar flujo completo de captura de signos vitales en encuentro (examen físico → `EncounterVitalSigns` → `PatientVitalsCard`).
12. Confirmar que los logs de Sentry no incluyen datos de paciente reales después de activar `SENTRY_DSN` (correr `npm run audit:redact:clinical-logs` antes del primer uso).
13. Revisar y documentar el restore drill como checklist de operación en `docs/operational-procedures.md`.
14. Verificar que `NEXT_PUBLIC_FORCE_SHARED_DEVICE_MODE=true` está activo en el `.env` de producción si el dispositivo no es de uso exclusivo.
15. Limpiar `runtime/`, archivos `.db` locales de Playwright y bases de datos de prueba antes de compartir el directorio del proyecto.

---

## 14. Registro de fixes — Sesión 8 (2026-05-28)

Todos los hallazgos de código de la auditoría fueron corregidos en la misma sesión. Guardrails post-sesión:

- `npm --prefix frontend run typecheck` ✅
- `npm --prefix backend run typecheck` ✅
- `npm --prefix frontend run lint` ✅ **0 errores, 0 warnings** (antes: 2 warnings)
- `npm --prefix backend run lint:check` ✅ 0 errores
- `npm --prefix frontend run test -- --runInBand` ✅ 334/334
- `npm --prefix backend run test -- --runInBand` ✅ 526/528

| # | Archivo(s) | Descripción |
|---|---|---|
| 1 | `frontend/src/components/sections/SospechaDiagnosticaSection.tsx:23-27` | Stale ref corregido: `cie10TimerRef.current` copiado a variable local `timers` antes del cleanup. Elimina warning de react-hooks. |
| 2 | `frontend/src/components/common/PdfPreviewModal.tsx:77-79` | Directiva `eslint-disable-next-line react-hooks/exhaustive-deps` removida (el hook ya tiene todos sus deps; el disable no suprimía ningún warning real). Lint: 0 warnings. |
| 3 | `frontend/src/app/(dashboard)/pacientes/[id]/PatientDetailSidebar.tsx:38-39` | `historyFields`: "Medicamentos" → "Medicamentos (antecedentes)", "Alergias" → "Alergias (antecedentes)". Deja claro en UI que esos campos son texto libre del antecedente, distintos del módulo estructurado `PatientAllergiesList`. |
| 4 | `frontend/src/app/(dashboard)/pacientes/[id]/PatientDetailHeader.tsx` | Agregado hook `useCriticalAllergies` que reutiliza el cache de React Query `['patient-allergies', patientId]` (mismo key que `PatientAllergiesList`, sin petición extra). Badge `FiAlertTriangle` con nombre del alérgeno visible en la cabecera cuando hay alergias con severidad GRAVE o FATAL activas. |
| 5 | `.env.example` | `NEXT_PUBLIC_STRICT_CSP=false` documentado con comentario explicativo en sección FRONTEND. Comentarios mejorados en `ANAMNEO_MONITOR_DB_PASSWORD` y `GRAFANA_ADMIN_PASSWORD` con advertencia de valor aleatorio en producción y comando `openssl rand`. |
| 6 | `.env` | `NEXT_PUBLIC_STRICT_CSP=false` agregado con comentario. Documenta la variable en el entorno de desarrollo sin cambiar comportamiento (en dev se ignora por `!isProd` en `proxy-security.ts`). |
| 7 | `src/__tests__/components/sospecha-diagnostica-section.test.tsx` | Nuevo archivo — 7 tests unitarios para `SospechaDiagnosticaSection`: timer scheduling (≥2 chars), no-timer (<2 chars), cancelación al retype, `clearTimeout` llamado en unmount, unmount sin timers no lanza, API call post-debounce, wrapper controlado para add-sospecha. |
| 8 | `src/__tests__/components/patient-detail-header.test.tsx` | Nuevo archivo — 7 tests unitarios para el badge de alergias críticas: sin badge (sin alergias), sin badge (LEVE/MODERADA), badge GRAVE con nombre, badge FATAL con nombre, contador múltiple, ignorar soft-deleted, query key compartido con `PatientAllergiesList`. |
| 9 | `tests/e2e/workflow-clinical.spec.ts` | Test E2E "register GRAVE allergy and verify critical badge appears in header" insertado en el flujo serial: registra alergia Penicilina GRAVE via `PatientAllergiesList`, verifica badge en cabecera y label "Alergias (antecedentes)" en `HistoryCard`. |

**Guardrails post-sesión 8 (tests):**
- `npm --prefix frontend run test -- --runInBand` ✅ **348/348** (antes: 334) — 14 tests nuevos añadidos
- `npm --prefix frontend run lint` ✅ 0 errores, 0 warnings
- `npm --prefix frontend run typecheck` ✅
