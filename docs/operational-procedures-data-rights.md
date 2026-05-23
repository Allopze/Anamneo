# Procedimiento operativo — Derechos del titular (Ley 21.719 Art 4-11)

**Norma de referencia:** Ley 21.719 Arts 4, 5, 6, 7, 8, 8 bis, 8 ter, 9, 10, 11, 41
**Versión:** 0.1 — Borrador estructural (2026-05-23)
**Estado:** Vigente para la operación interna mientras dure el roadmap; revisión legal externa pendiente
**DPO responsable:** Alejandro López Zelaya `<allopze@gmail.com>` (interino)

> Procedimiento operativo de cómo Anamneo recibe, evalúa y responde a las solicitudes de los titulares de datos en cumplimiento de la Ley 21.719. La parte técnica está implementada en el módulo [`backend/src/patient-data-rights/`](../backend/src/patient-data-rights/) y en la página pública [`frontend/src/app/derechos/`](../frontend/src/app/derechos/page.tsx).

---

## 1. Canales de recepción

| Canal | Quién lo opera | Tracking |
|---|---|---|
| Página pública `/derechos` (formulario) | Cualquier titular | Crea `PatientDataRequest` con `submittedBy=TITULAR\|REPRESENTANTE`. Rate-limit: 5 solicitudes / 10 min por IP. |
| Correo al DPO | DPO | El DPO crea manualmente la solicitud desde admin (`PATCH /admin/data-requests/:id`) o registra directamente en la admin UI. |
| Presencial en la clínica | Personal de admisión | El DPO o admin transcribe al sistema y deja constancia de identidad verificada. |

Cualquiera sea el canal, la solicitud DEBE quedar registrada en `PatientDataRequest` para SLA tracking y auditoría.

## 2. Plazos legales (Art 11)

| Hito | Plazo |
|---|---|
| Respuesta al titular | **30 días corridos** desde recepción de la solicitud. |
| Prórroga (una sola vez, por causa fundada) | +30 días corridos. |
| Bloqueo temporal (Art 8 ter) — resolución | **3 días hábiles** (Art 41 inciso final). |

El cron interno (`DataRequestSlaService.markExpiredRequests`) corre cada hora y marca como `VENCIDA` cualquier solicitud cuyo plazo (incluyendo prórroga) haya pasado. Esto NO exime de responsabilidad sino que crea evidencia auditable del retraso.

## 3. Workflow por tipo de solicitud

### 3.1 Acceso (Art 5)

1. Verificar identidad del titular (ver §4).
2. Vincular la solicitud a un `Patient` desde la admin UI (`PATCH /admin/data-requests/:id` con `patientId`).
3. Generar bundle regulatorio: `GET /api/patients/:id/export/regulatory` (admin-only). Audita automáticamente con razón `PATIENT_DATA_EXPORTED_REGULATORY`.
4. Entregar el ZIP de forma segura: encriptación de transporte (correo cifrado, descarga autenticada con TTL corto, presencial). NUNCA por canales no cifrados.
5. Marcar la solicitud como `RESUELTA_ACEPTADA` con nota que incluya el ID del export entregado.

### 3.2 Rectificación (Art 6)

1. Verificar identidad.
2. Editar los datos solicitados desde la UI clínica habitual.
3. La edición queda auditada con diff completo (cadena `AuditLog`).
4. Si los datos fueron previamente comunicados a terceros (no aplica hoy a Anamneo), informar a esos destinatarios.
5. Marcar `RESUELTA_ACEPTADA` con nota explicativa.

### 3.3 Supresión (Art 7)

1. Verificar identidad.
2. Evaluar las **excepciones del Art 7**: ¿el dato es necesario para obligación legal, función pública, **interés público en salud pública**, fines históricos/estadísticos/científicos, defensa de reclamación?
3. Si **NO** procede supresión → `RESUELTA_RECHAZADA` con motivo fundado citando la excepción aplicable.
4. Si **SÍ** procede → `Archivar` paciente (soft delete) y, cuando aplique la retención sanitaria, ejecutar `DELETE /api/patients/:id/purge`.
5. Documentar la decisión en `resolutionNote`.

### 3.4 Oposición (Art 8)

1. Verificar identidad.
2. Si la base legal del tratamiento es **consentimiento** o **interés legítimo**, registrar la oposición en `Patient.processingObjections` (clave por finalidad).
3. El módulo de analítica debe respetar este flag (pendiente refactor — Ola 3).
4. Marcar `RESUELTA_ACEPTADA`.

### 3.5 Portabilidad (Art 9)

1. Verificar identidad.
2. Generar el ZIP regulatorio (mismo flujo que §3.1).
3. Entregarlo en formato JSON estructurado (el ZIP ya cumple: `data.json` + adjuntos).
4. Marcar `RESUELTA_ACEPTADA`.

### 3.6 Bloqueo temporal (Art 8 ter)

1. Verificar identidad rápidamente (plazo: 3 días hábiles).
2. Setear `Patient.blockedAt = now()` + `blockedReason` desde la admin UI.
3. El `PatientNotBlockedGuard` impedirá nuevas mutaciones clínicas mientras el bloqueo esté activo.
4. Una vez resuelta la causa que motivó el bloqueo (típicamente otra solicitud), levantar el bloqueo seteando `blockedAt = null`.

## 4. Verificación de identidad

Métodos aceptables (`identityVerificationMethod` en `PatientDataRequest`):

| Método | Evidencia esperada | Riesgo |
|---|---|---|
| PRESENCIAL | Anotación firmada por personal + ID con foto verificado | Bajo |
| CEDULA_FOTO | Foto cédula + selfie con cédula visible | Medio |
| CLAVE_UNICA | Login con Clave Única + verificación del email del registro | Bajo |
| OTRO | Documentar caso a caso | Variable |

[PENDIENTE_ABOGADO] Validar listado y criterios mínimos — ver [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §3.1.

Guarde la evidencia en `identityVerificationEvidence` (JSON) — si es un archivo, súbalo a un repositorio seguro y referencie su URL.

## 5. Plantillas de respuesta (en código)

Las plantillas las emite automáticamente `MailService`:

| Evento | Método | Plantilla |
|---|---|---|
| Acuse de recibo | `sendDataRequestAcknowledgement` | Inline HTML + texto plano |
| Resolución aceptada | `sendDataRequestResolved` | Inline HTML + texto plano |
| Resolución rechazada (motivo fundado) | `sendDataRequestRejected` | Inline HTML + texto plano |
| Prórroga aplicada | `sendDataRequestExtended` | Inline HTML + texto plano |

Ver [`backend/src/mail/mail.service.ts`](../backend/src/mail/mail.service.ts) (sección "Ley 21.719 — comunicaciones a titulares").

## 6. Causales típicas de denegación fundada

Cuando se rechaza, la nota DEBE citar la causal específica:

- Art 7 lit iii — la conservación es necesaria para una **función pública** (no aplica a clínicas privadas, pero sí a clínicas estatales).
- Art 7 lit iv — **interés público en salud pública**.
- Art 7 lit i — ejercicio de la **libertad de informar** (no aplica a Anamneo).
- Identidad no verificada o insuficiente → no se rechaza, se solicita complemento.
- Solicitud manifiestamente abusiva o repetitiva → causal del Art 10 (cobro o rechazo).

## 7. Escalamiento

| Situación | Escalamiento |
|---|---|
| Plazo de respuesta vencido sin acción | DPO + responsable técnico. Documentar causa raíz. |
| Solicitud de NNA sin representante legal acreditado | DPO + asesor legal. |
| Solicitud relacionada con brecha de seguridad | Activar runbook de brechas (Art 14 sexies). |
| Reclamación recibida sobre una resolución | Defensa formal con asesor legal + preparación para reclamación judicial Art 43. |

## 8. Auditoría

Toda acción sobre `PatientDataRequest` queda registrada con razones específicas del catálogo (`PATIENT_RIGHT_REQUESTED`, `PATIENT_RIGHT_RESOLVED_*`, `PATIENT_RIGHT_EXPIRED`). El bloqueo y desbloqueo de pacientes usa `PATIENT_BLOCKED` / `PATIENT_UNBLOCKED`. La cadena SHA-256 de `AuditLog` provee evidencia íntegra.

## 9. Referencias

- [DPIA Anamneo](dpia-2026.md)
- [Política de Privacidad v1.0 borrador (seed)](../backend/prisma/seed.ts)
- [ADR-002](architecture-decisions/002-ley-21719-compliance.md)
- [Auditoría completa Ley 21.719](../AUDITORIA_LEY_21719_CHILE.md)
- [Preguntas al asesor legal](preguntas-abogado-ley21719.md)
