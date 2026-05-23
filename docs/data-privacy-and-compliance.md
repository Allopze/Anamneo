# Privacidad de Datos y Compliance — Anamneo

Este documento describe cómo Anamneo trata datos personales y datos sensibles
de salud (PHI/datos clínicos) de pacientes, y los procedimientos mínimos
exigibles antes de operar con datos reales en Chile bajo la **Ley 21.719**
(vigencia plena el 01-DIC-2026).

> Este es un marco operativo, no asesoría legal. Antes de procesar PHI real
> en producción, se debe completar el roadmap de cumplimiento documentado
> en [ADR-002](architecture-decisions/002-ley-21719-compliance.md) y pasar
> el Gate Go/No-Go documentado en `/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`.

**Estado al 2026-05-23:** este documento se actualizó tras la auditoría
integral contra el texto oficial de la Ley 21.719 (ver
[`../AUDITORIA_LEY_21719_CHILE.md`](../AUDITORIA_LEY_21719_CHILE.md)).
Cita correctamente los artículos vigentes y refleja la implementación real
del repo (no la planificada).

---

## 1. Marco regulatorio aplicable

- **Ley 21.719 (2024) sobre Protección y Tratamiento de los Datos Personales
  y crea la Agencia de Protección de Datos Personales** — vigencia plena el
  **1 de diciembre de 2026**. Sustituye y refunde la Ley 19.628. Introduce:
  - Derechos del titular del Art 4 (acceso, rectificación, supresión,
    oposición, portabilidad, bloqueo). Esta ley NO usa el término "ARCO+";
    referirse al catálogo del Art 4 por su nombre legal.
  - Figura del Delegado de Protección de Datos (DPO, Art 50).
  - Registro de Actividades de Tratamiento (acreditación Art 3 e).
  - Evaluación de Impacto en Protección de Datos / DPIA (Art 15 ter,
    obligatoria para datos sensibles bajo excepción del consentimiento).
  - Régimen sancionatorio (Art 34-38) con multas hasta 20.000 UTM por
    infracción gravísima.
- **Ley 20.584 (2012) sobre Derechos y Deberes de las Personas en su
  Atención de Salud** — regula la ficha clínica como categoría sanitaria
  con reglas propias de conservación, acceso y entrega.
- **Código Sanitario (DFL 725)** — secreto médico aplicable a la
  información clínica registrada.
- **Normas técnicas MINSAL y FONASA** — fijan plazos específicos de
  retención de fichas clínicas (sujeto a revisión legal específica).

Como buena práctica complementaria se siguen, sin afirmar cumplimiento
formal, los principios de minimización, integridad/confidencialidad y
limitación de finalidad de **GDPR Art. 5**.

---

## 2. Categorías de datos tratados

| Categoría | Sensibilidad | Ejemplos en Anamneo |
|---|---|---|
| Datos identificatorios | Alta | `Patient.rut`, `Patient.nombre`, `Patient.email`, `Patient.telefono`, `Patient.domicilio` |
| Datos demográficos | Media | `Patient.sexo`, `Patient.fechaNacimiento`, `Patient.edad`, `Patient.prevision`, `Patient.trabajo` |
| Datos de salud (PHI) | **Crítica** | `PatientHistory`, `EncounterSection.data`, `EncounterDiagnosis`, `EncounterTreatment`, `PatientProblem`, `ClinicalAlert`, `InformedConsent`, `Attachment` |
| Datos de contacto de emergencia | Alta | `Patient.contactoEmergencia*` |
| Datos de representante legal (NNA) | Alta | Pendiente — Ola 1 del roadmap |
| Datos de personal sanitario | Media | `User.email`, `User.nombre`, `User.role`, sesiones, logs de auditoría |
| Telemetría | Baja | `AuditLog` (con `requestId`, `userId`, `entityId`), logs HTTP |

Anamneo **no** trata por defecto datos de pago, datos biométricos
(huellas/iris), datos genéticos brutos, ni datos de geolocalización.

Anamneo trata datos de menores de edad en contexto clínico. La Ley 21.719
Art 16 quáter exige consentimiento de padres o representante legal para
menores de 14 años, y para datos sensibles de menores de 16 años.
**Implementación pendiente en Ola 3 del roadmap.**

---

## 3. Finalidades y bases de tratamiento

| Finalidad | Base legítima (Ley 21.719) |
|---|---|
| Registro y gestión de fichas clínicas | Art 16 lit e (medicina preventiva/laboral, diagnóstico, asistencia sanitaria) + ley sanitaria especial (pendiente: anclar a Ley 20.584 + norma MINSAL específica) |
| Auditoría interna y trazabilidad | Art 13 lit b (cumplimiento de obligación legal) + obligación del Art 14 quinquies (medidas de seguridad) |
| Generación de documentos clínicos (recetas, órdenes, derivaciones) | Art 16 lit e + Ley 20.584 |
| Envío de correos transaccionales (invitaciones a personal) | Art 13 lit d (interés legítimo) |
| Monitoreo técnico (Sentry, logs HTTP) | Art 13 lit d (interés legítimo) + minimización (PHI scrubeada antes de enviar) |
| Estadística/analítica clínica | Art 16 quinquies (fines estadísticos/científicos de interés público) + anonimización previa |

No se realiza tratamiento con fines de marketing, perfilamiento publicitario
ni cesión comercial a terceros.

**Pendiente para producción:** anclar formalmente cada base legal a la ley
sanitaria especial chilena que la ampara. Ver
[`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §2.

---

## 4. Técnicas de protección implementadas

| Control | Implementación |
|---|---|
| Autenticación fuerte | bcrypt cost 12, JWT por cookie HttpOnly SameSite=strict, 2FA TOTP opcional con recovery codes, lockout persistente tras 5 intentos |
| Autorización | Guards NestJS (`JwtAuthGuard`, `RolesGuard`, `AdminGuard`) + scope por médico efectivo (`getEffectiveMedicoId`) |
| Cifrado en tránsito | HTTPS obligatorio en producción vía cloudflared |
| Cifrado en reposo | Disco con LUKS/dm-crypt (confirmado por `ENCRYPTION_AT_REST_CONFIRMED`) + cifrado app-level AES-256-GCM para secciones clínicas (`ENCRYPTION_KEY`, obligatoria en prod) + cifrado app-level para settings secretos (`SETTINGS_ENCRYPTION_KEY`) |
| Cifrado app-level pendiente | RUT/nombre/email/teléfono del paciente, adjuntos y snapshots regulatorios — implementación en Ola 3 |
| Auditoría | `AuditLog` con cadena de hashes SHA-256 (`integrityHash`/`previousHash`), serializada para concurrencia. Eventos READ también registrados sobre PHI. |
| Minimización en logs/Sentry | Scrubbing de RUT, email, secuencias de 8+ dígitos en `instrument.ts` antes de enviar a Sentry |
| Retención | Backups Postgres rotables; logs de Docker rotables según configuración del host |
| Aislamiento | Modelo single-clinic (`ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`). Una instancia = una clínica = una base de datos. |
| Adjuntos | Validación magic-bytes (PDF/JPEG/PNG/GIF), tamaño máximo configurable, soft-delete con retención. AV scan opcional vía ClamAV (queda `SKIPPED` si no hay host/puerto). |

---

## 5. Derechos del titular (Art 4-11 Ley 21.719)

> **Estado actual:** los endpoints regulatorios (`GET /api/patients/:id/export/regulatory`
> y `DELETE /api/patients/:id/purge`) existen y son admin-only. No hay
> aún UI/endpoint público para que el titular ejerza sus derechos
> directamente. **La Ola 2 del roadmap entrega la entidad
> `PatientDataRequest` y la UI pública de derechos.**

### 5.1 Acceso (Art 5)

El titular puede solicitar copia de sus datos a la clínica. El admin
debe:
1. Verificar identidad del solicitante (presencial o RUT + medio de
   contacto registrado).
2. Generar la exportación regulatoria vía
   `GET /api/patients/:id/export/regulatory`
   (implementado en
   [`backend/src/patients/patients-regulatory.controller.ts`](../backend/src/patients/patients-regulatory.controller.ts)).
3. Entregar el archivo de forma segura (correo cifrado o entrega
   presencial).
4. La acción queda registrada automáticamente en `AuditLog` con razón
   `PATIENT_DATA_EXPORTED_REGULATORY`.
5. Responder en un plazo no superior a **30 días corridos** (Art 11),
   prorrogable por otros 30 días corridos por una sola vez.

### 5.2 Rectificación (Art 6)

Realizar la edición en `Pacientes > [paciente] > Editar`. La edición
queda registrada en `AuditLog` con diff completo. Cuando los datos
hayan sido comunicados a terceros, el responsable debe notificar la
rectificación a esos destinatarios salvo que sea imposible o exija
esfuerzo desproporcionado.

### 5.3 Supresión (Art 7)

1. **Soft delete** inmediato vía `Pacientes > [paciente] > Archivar`.
   El paciente deja de aparecer en listados activos pero la información
   se conserva por motivos de auditoría sanitaria.
2. **Purga regulatoria** (borrado físico): disponible vía
   `DELETE /api/patients/:id/purge` con confirmación
   `PURGE-REGULATORY`, justificación ≥16 caracteres y respeto a la
   retención mínima configurable
   (`PATIENT_PURGE_MIN_AGE_DAYS`, default 5475 días = 15 años).
   Implementado en
   [`backend/src/patients/patients-regulatory-purge.service.ts`](../backend/src/patients/patients-regulatory-purge.service.ts).
   Antes de la eliminación física se genera un snapshot del bundle
   regulatorio para retención sanitaria.

   **Excepciones del Art 7** (la supresión NO procede): ejercicio de
   libertades de informar, obligación legal, función pública,
   **interés público en salud pública**, fines históricos/estadísticos
   /científicos, formulación o defensa de reclamación.

### 5.4 Oposición (Art 8)

El titular puede oponerse a tratamientos basados en interés legítimo,
marketing (no aplica a Anamneo) o cuando los datos provengan de
fuentes públicas. **Implementación pendiente en Ola 2 del roadmap**
(campo `Patient.processingObjections` y respeto en módulo
`clinical-analytics`).

### 5.5 Bloqueo temporal (Art 8 ter)

El titular puede solicitar suspensión temporal del tratamiento mientras
se resuelve una solicitud de rectificación, supresión u oposición.
Plazo de resolución del bloqueo: 3 días hábiles (Art 41 inciso final).
**Implementación pendiente en Ola 2 del roadmap** (campo
`Patient.blockedAt` y `PatientNotBlockedGuard` sobre mutaciones
clínicas).

### 5.6 Portabilidad (Art 9)

Entregar el archivo JSON+adjuntos generado por el procedimiento §5.1.
Aplica cuando el tratamiento es automatizado y basado en
consentimiento.

### 5.7 Decisiones automatizadas (Art 8 bis)

Anamneo **no** realiza decisiones automatizadas con efectos jurídicos
ni perfilamiento. Si en el futuro se incorpora IA clínica o triage
automatizado, deberá implementarse derecho a explicación,
intervención humana, expresión del punto de vista y revisión.

---

## 6. Anexo: DPA mínimo (Acuerdo de Tratamiento de Datos)

Este es un **template referencial**. Validar con asesor jurídico antes de
firmarlo con una clínica o un proveedor de infraestructura.
**La Ola 3 del roadmap incluye la firma definitiva con cada subencargado
real (Cloudflare, Sentry, SMTP).**

```text
ENTRE:
  [Clínica usuaria] (Responsable del Tratamiento)
Y:
  [Operador técnico de la instancia] (Encargado del Tratamiento)

OBJETO:
  Tratamiento de datos personales y de salud bajo Ley 21.719,
  en el contexto del uso del sistema Anamneo.

ALCANCE:
  - Single-clinic, base PostgreSQL aislada, volúmenes
    `runtime/data` y `runtime/uploads` exclusivos.
  - Sin cesión a terceros, salvo subencargados expresamente listados
    (cloudflare/cloudflared, sentry, smtp provider).

CLAUSULAS MINIMAS (Art 15 bis Ley 21.719):
  - Objeto, duración, naturaleza y finalidad del tratamiento.
  - Tipo de datos personales tratados y categorías de titulares.
  - Derechos y obligaciones del responsable.
  - Encargado solo trata datos según instrucciones documentadas.
  - Cumplimiento de medidas técnicas (§4 de este documento) y del
    Art 14 quinquies (cifrado, seudonimización, resiliencia,
    verificación regular).
  - Deber de confidencialidad del personal del encargado.
  - Asistencia al responsable en el ejercicio de derechos del titular.
  - Notificación al responsable de toda vulneración (Art 14 sexies).
  - Devolución o supresión segura de los datos al término del contrato.
  - Disponibilidad de la información necesaria para auditorías.
  - Régimen de subencargados con autorización previa por escrito.

DURACION: [vigencia]
SUBENCARGADOS AUTORIZADOS: [lista]
FECHA: [...]
```

---

## 7. Procedimientos operativos

### 7.1 Exportar datos regulatorios de un paciente

**Endpoint disponible:**
`GET /api/patients/:id/export/regulatory` (admin-only,
`JwtAuthGuard + AdminGuard`).

Implementación:
[`backend/src/patients/patients-regulatory.controller.ts`](../backend/src/patients/patients-regulatory.controller.ts)
y
[`backend/src/patients/patients-regulatory-export.service.ts`](../backend/src/patients/patients-regulatory-export.service.ts).

El endpoint devuelve un ZIP con:
- `data.json` con paciente, historial, encuentros, secciones clínicas
  descifradas, diagnósticos, tratamientos, consentimientos, alertas y
  AuditLog asociado.
- Adjuntos en sus rutas relativas.

Auditoría automática con razón `PATIENT_DATA_EXPORTED_REGULATORY`.

### 7.2 Borrado regulatorio (purga física)

**Endpoint disponible:**
`DELETE /api/patients/:id/purge` (admin-only).

Body requerido:
```json
{
  "confirmation": "PURGE-REGULATORY",
  "justification": "texto >= 16 caracteres",
  "bypassRetention": "false"
}
```

Implementación:
[`backend/src/patients/patients-regulatory-purge.service.ts`](../backend/src/patients/patients-regulatory-purge.service.ts).

Flujo:
1. Valida que el paciente esté archivado (soft-deleted) previamente.
2. Valida retención (default 15 años desde archivo, vía
   `PATIENT_PURGE_MIN_AGE_DAYS`).
3. Genera snapshot regulatorio defensivo en
   `runtime/data/purges/<nombre>.zip` **(actualmente en claro;
   cifrado app-level pendiente en Ola 3 del roadmap)**.
4. Registra evento `PATIENT_RECORD_PURGED_REGULATORY` en `AuditLog`
   con cadena de integridad.
5. Cascade delete sobre `Patient` y todas sus relaciones.

> El plazo de retención de 15 años se basa en práctica habitual del
> sector salud chileno, pero NO está respaldado por una norma
> específica única. Revisión legal pendiente — ver
> [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §3.

### 7.3 Reporte de incidentes y brechas (Art 14 sexies)

El Art 14 sexies de la Ley 21.719 obliga a reportar a la Agencia
**sin dilaciones indebidas** cuando exista **riesgo razonable** para
los derechos y libertades de los titulares. Cuando la vulneración
involucre **datos sensibles** (caso aplicable siempre a Anamneo),
**datos de menores de 14 años**, o **datos financieros**, también
debe comunicarse a los titulares afectados en lenguaje claro y
sencillo.

> **El plazo legal NO es 72 horas** (eso es estándar GDPR). La Ley
> 21.719 usa el criterio cualitativo "sin dilaciones indebidas". Una
> política interna puede fijarse un objetivo de 72h como buena
> práctica.

| Severidad interna | Definición | Acción interna |
|---|---|---|
| **Crítico** | Fuga confirmada de PHI o credenciales | Reporte a la Agencia + notificación a titulares afectados |
| **Alto** | Acceso no autorizado sin fuga confirmada | Evaluación de "riesgo razonable" + decisión documentada |
| **Medio** | Indisponibilidad >4h o backup fallido consecutivo >24h | Registro interno + análisis post-mortem |
| **Bajo** | Incidente cubierto por runbook estándar | Registro en `AuditLog`/Sentry |

Flujo operativo: ver [`incident-runbooks.md`](incident-runbooks.md).
**El runbook específico de brechas alineado al Art 14 sexies se
crea en la Ola 3 del roadmap** (`docs/incident-runbook-data-breach.md`)
junto con la entidad `DataBreachIncident` y las plantillas de
notificación.

---

## 8. Retención y disposición

| Dato | Retención por defecto | Justificación |
|---|---|---|
| Ficha clínica (encounters, sections) | 15 años post última atención (pendiente validación legal sanitaria específica) | Práctica del sector salud chileno; norma específica por revisar |
| Datos de contacto del paciente | Vida útil de la relación + retención clínica | Acceso a la ficha |
| `AuditLog` | Indefinido en single-clinic | Integridad de cadena de hashes; prescripción de infracciones Art 40 (4 años) |
| Backups Postgres | Política de host (ej. 14 días rotando) | Recuperación operativa |
| Logs HTTP/stdout | Política del host (recomendado ≥90 días) | Forensics |
| Sesiones (`UserSession`) | Hasta revocación o expiración del refresh (7 días default) | Continuidad |
| Invitaciones (`UserInvitation`) | TTL definido + 30 días post-uso | Auditoría |
| `PasswordResetToken` | TTL definido + retención de auditoría | Forensics y prevención de abuso |
| Snapshots regulatorios pre-purge | Mismo plazo que la ficha clínica original | Evidencia ante revisión |

**Pendiente:** matriz de retención validada por asesor legal por cada
categoría. Ver [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §3.

---

## 9. Roles y responsables

| Rol | Responsabilidad |
|---|---|
| **Delegado de Protección de Datos (DPO)** — *Alejandro López Zelaya `<allopze@gmail.com>`* (interino al 2026-05-23 durante el roadmap de cumplimiento; ver [ADR-002](architecture-decisions/002-ley-21719-compliance.md)) | Validar este documento, aprobar borrados regulatorios, recibir solicitudes de titulares, escalar incidentes, supervisar el cumplimiento de la Ley 21.719 Art 50. |
| Administrador técnico | Operar la instancia, ejecutar backups/drills, aplicar parches, gestionar accesos |
| Médico/a tratante | Decidir sobre consentimientos clínicos, registro de fichas, retención clínica |
| Asistente | Apoyo administrativo bajo permiso explícito por médico responsable |
| Responsable del tratamiento | La clínica usuaria que decide finalidades y medios |
| Encargado del tratamiento | El operador técnico de la instancia (Art 15 bis) |

---

## 10. Brechas conocidas y plan de cierre

Esta tabla resume el estado. El detalle, secuencia y dependencias está
en el roadmap aprobado:
[`/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`](../../.claude/plans/crea-un-plan-para-logical-hearth.md).

| Brecha | Estado | Ola del roadmap |
|---|---|---|
| Política de privacidad seeded marcada "no apta para producción" | Bloqueada en `NODE_ENV=production` por seed; reemplazo pendiente | Ola 1 |
| Política v1.0 con 12 elementos Art 14 ter | Pendiente | Ola 1 |
| Modelo de consentimiento del titular separado del clínico (Art 12) | Pendiente | Ola 1 |
| Registro de Actividades de Tratamiento (Art 14 ter, Art 3 e) | Pendiente | Ola 1 |
| DPIA formal (Art 15 ter) | Pendiente | Ola 1 (borrador) → Ola 4 (firma) |
| Designación formal de DPO (Art 50) | Interino designado en ADR-002; formalización pendiente | Ola 0 / Ola 1 |
| Entidad `PatientDataRequest` para Arts 4-11 | Pendiente | Ola 2 |
| Derecho de bloqueo temporal (Art 8 ter) | Pendiente | Ola 2 |
| Derecho de oposición / opt-out a analítica (Art 8) | Pendiente | Ola 2 |
| Tratamiento diferenciado de NNA (Art 16 quáter) | Pendiente | Ola 1 (schema) + Ola 3 (enforcement) |
| Cifrado app-level adicional (RUT, email, adjuntos, snapshots) | Pendiente | Ola 3 |
| Procedimiento de brechas alineado al Art 14 sexies + entidad `DataBreachIncident` | Pendiente | Ola 3 |
| DPAs firmados con subencargados (Cloudflare, Sentry, SMTP) | Pendiente | Ola 3 |
| Inventario de transferencias internacionales (Arts 27-28) | Pendiente | Ola 3 |
| Programa de prevención de infracciones (Art 48) | Pendiente | Ola 3 |
| Modelo voluntario de cumplimiento + certificación (Art 49, Art 51) | Pendiente | Ola 4 |
| UI pública de derechos del titular | Pendiente | Ola 2 |
| Plantillas de comunicación (acuse, rechazo, brecha) | Pendiente | Olas 2-3 |
| Drills (acceso end-to-end, brecha cronometrada, restore) | Pendiente | Ola 4 |
