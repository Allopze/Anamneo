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
| Bloqueo temporal (Art 8 ter) — resolución por el responsable | **2 días hábiles**. (Nota: los 3 días hábiles del Art 41 inciso final aplican a la resolución de la Agencia en ciertos escenarios, no al plazo ordinario del responsable.) |

El cron interno (`DataRequestSlaService.markExpiredRequests`) corre cada hora y marca como `VENCIDA` cualquier solicitud cuyo plazo (incluyendo prórroga) haya pasado. Esto NO exime de responsabilidad sino que crea evidencia auditable del retraso.

## 3. Workflow por tipo de solicitud

### 3.1 Acceso (Art 5)

1. Verificar identidad del titular (ver §4).
2. Vincular la solicitud a un `Patient` desde la admin UI (`PATCH /admin/data-requests/:id` con `patientId`).
3. Generar enlace temporal desde la bandeja admin (`POST /api/admin/data-requests/:id/export-link`).
4. El sistema reutiliza el bundle regulatorio, guarda el ZIP cifrado en `runtime/data/data-requests/` y envía un enlace a `/descargar-ficha?token=...`.
5. El titular debe ingresar el RUT asociado para descargar. El enlace vence en 72 horas, permite máximo 3 descargas y cada descarga queda auditada.
6. Marcar la solicitud como `RESUELTA_ACEPTADA` con nota que incluya el ID del enlace/export entregado.

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
3. El módulo de analítica respeta `ANALITICA_INTERNA=true` y excluye al paciente de resumen y drill-down de casos.
4. Marcar `RESUELTA_ACEPTADA`.

### 3.5 Portabilidad (Art 9)

1. Verificar identidad.
2. Generar el enlace temporal (mismo flujo que §3.1).
3. Entregarlo en formato ZIP con `data.json` estructurado + adjuntos.
4. Marcar `RESUELTA_ACEPTADA`.

### 3.6 Bloqueo temporal (Art 8 ter)

1. Verificar identidad rápidamente (plazo del responsable: **2 días hábiles**).
2. Setear `Patient.blockedAt = now()` + `blockedReason` desde la admin UI.
3. El `PatientNotBlockedGuard` impedirá nuevas mutaciones clínicas mientras el bloqueo esté activo.
4. Durante el bloqueo, permitir sólo excepciones admin/regulatorias:
   revisión de solicitudes de derechos, evidencia administrativa,
   export regulatorio, rectificaciones estrictamente necesarias para
   resolver la solicitud, auditoría/verificación de integridad,
   conservación/custodia y respuesta a autoridad competente.
5. Registrar cada excepción en `AuditLog` con motivo, usuario, paciente,
   solicitud asociada cuando exista y alcance exacto de la acción.
6. Una vez resuelta la causa que motivó el bloqueo (típicamente otra solicitud), levantar el bloqueo seteando `blockedAt = null`.

## 4. Verificación de identidad

Métodos aceptables, ajustados al riesgo de cada canal/solicitud (`identityVerificationMethod` en `PatientDataRequest`):

| Canal / situación | Verificación sugerida | Evidencia a guardar |
|---|---|---|
| Portal autenticado (paciente con cuenta) | Sesión fuerte + segundo factor | Hash de sesión + timestamp + IP |
| Correo electrónico | Enlace seguro + validación con datos conocidos del paciente | Mensaje enviado + datos validados |
| Solicitud sensible o ficha clínica | Cédula vigente + autenticación fuerte o validación presencial equivalente | Constancia presencial firmada o copia/foto controlada |
| Tercero autorizado | Poder o mandato válido | Documento legal + identidad del mandatario |
| Representante de NNA | Identidad del representante + acreditación del vínculo proporcional al riesgo | Cédula + acreditación (declaración auditada para padre/madre; documento para tutor judicial) |
| Heredero | Documentación sucesoria o respaldo suficiente | Posesión efectiva / certificado de defunción + acreditación de calidad de heredero |

**Principio de proporcionalidad:** no exigir copia de cédula + selfie por defecto en todas las solicitudes. Eso aumenta innecesariamente el tratamiento de datos sensibles/biométricos. Pedirla solo cuando el riesgo lo justifique (solicitudes sensibles, dudas razonables sobre identidad).

Guarde la evidencia en `identityVerificationEvidence` (JSON) — si es un archivo, súbalo a un repositorio seguro y referencie su URL.

## 5. Plantillas de respuesta (en código)

Las plantillas las emite automáticamente `MailService`:

| Evento | Método | Plantilla |
|---|---|---|
| Acuse de recibo | `sendDataRequestAcknowledgement` | Inline HTML + texto plano |
| Resolución aceptada | `sendDataRequestResolved` | Inline HTML + texto plano |
| Resolución rechazada (motivo fundado) | `sendDataRequestRejected` | Inline HTML + texto plano |
| Prórroga aplicada | `sendDataRequestExtended` | Inline HTML + texto plano |
| Enlace temporal de ficha | `sendDataRequestExportLink` | Inline HTML + texto plano |

Ver [`backend/src/mail/mail.service.ts`](../backend/src/mail/mail.service.ts) (sección "Ley 21.719 — comunicaciones a titulares").

## 6. Causales típicas de denegación fundada

Cuando se rechaza, la nota DEBE citar la causal específica. Causales admisibles:

1. **Falta de verificación de identidad** del solicitante (no se rechaza definitivamente; se solicita complemento antes de denegar).
2. **Falta de legitimación** del solicitante (no es el titular ni un representante o heredero acreditado).
3. **Inexistencia de datos** sobre el solicitante en los registros.
4. **Conservación obligatoria por norma sanitaria** (Ley 20.584, Código Sanitario, normas MINSAL específicas) — caso típico para SUPRESIÓN de ficha clínica.
5. **Necesidad para defensa jurídica** del responsable (formulación, ejercicio o defensa de reclamaciones).
6. **Obligación legal** específica que ordene conservar el dato.
7. **Interés público o salud pública** (Art 7 excepción iv).
8. **Investigación bajo condiciones legales** (Art 16 quinquies + autorización ética cuando aplique).
9. **Afectación de derechos de terceros** (un dato que también identifica o concierne a otra persona).
10. **Imposibilidad técnica justificada** y explicada, si aplica.
11. **Solicitud manifiestamente infundada o excesiva** (si la ley/reglamento lo permite y se documenta — Art 10 puede habilitar cobro o rechazo).

### Caso especial: solicitud de supresión sobre ficha clínica dentro del plazo de conservación

La respuesta correcta NO es eliminar. La respuesta correcta es indicar que la supresión no procede por la obligación sanitaria de conservación, **pero ofrecer alternativas**:

- revocar consentimientos opcionales (analítica, comunicaciones no clínicas, investigación);
- bloquear usos no necesarios;
- restringir finalidades secundarias;
- corregir datos inexactos;
- entregar copia / acceso al titular;
- informar plazo legal de conservación y la base normativa que lo ampara.

## 7. Escalamiento

| Situación | Escalamiento |
|---|---|
| Plazo de respuesta vencido sin acción | DPO + responsable técnico. Documentar causa raíz. |
| Solicitud de NNA sin representante legal acreditado | DPO + asesor legal. |
| Solicitud relacionada con brecha de seguridad | Activar runbook de brechas (Art 14 sexies). |
| Reclamación recibida sobre una resolución | Defensa formal con asesor legal + preparación para reclamación judicial Art 43. |

## 8. Auditoría

Toda acción sobre `PatientDataRequest` queda registrada con razones específicas del catálogo (`PATIENT_RIGHT_REQUESTED`, `PATIENT_RIGHT_RESOLVED_*`, `PATIENT_RIGHT_EXPIRED`). Los enlaces temporales usan `PATIENT_DATA_REQUEST_EXPORT_LINK_CREATED`, `PATIENT_DATA_REQUEST_EXPORT_DOWNLOADED`, `PATIENT_DATA_REQUEST_EXPORT_EXPIRED` y `PATIENT_DATA_REQUEST_EXPORT_REVOKED`. El bloqueo y desbloqueo de pacientes usa `PATIENT_BLOCKED` / `PATIENT_UNBLOCKED`. La cadena SHA-256 de `AuditLog` provee evidencia íntegra.

## 9. Referencias

- [DPIA Anamneo](dpia-2026.md)
- [Política de Privacidad v1.0 borrador (seed)](../backend/prisma/seed.ts)
- [ADR-002](architecture-decisions/002-ley-21719-compliance.md)
- [Auditoría completa Ley 21.719](audits/ley-21719-chile-audit-2026-05-23.md)
- [Preguntas al asesor legal](preguntas-abogado-ley21719.md)
