# Programa de Prevención de Infracciones (Ley 21.719 Art 48)

**Versión:** 0.1 — Borrador estructural (2026-05-23)
**Estado:** Borrador interno; revisión legal externa pendiente
**DPO responsable:** Alejandro López Zelaya `<allopze@gmail.com>` (interino)

> El Art 48 de la Ley 21.719 establece que los responsables del tratamiento de datos personales **DEBEN adoptar acciones destinadas a prevenir la comisión de las infracciones** establecidas en los artículos 34 bis, 34 ter y 34 quáter. Este programa documenta dichas acciones para Anamneo.
>
> Es distinto del **modelo voluntario** del Art 49 (que puede ser certificado por la Agencia y opera como atenuante del Art 36.5). Ese modelo voluntario, cuando se adopte, se documentará en [`modelo-cumplimiento-voluntario.md`](modelo-cumplimiento-voluntario.md).

---

## 1. Identificación de riesgos de infracción

| Infracción tipo | Artículo | Riesgo en Anamneo | Acción preventiva |
|---|---|---|---|
| Tratar datos sin consentimiento o sin base legal | 34 ter lit a | Crear `Patient` sin `PatientDataProcessingConsent` vigente | `PolicyComplianceService.assertConsentFor()` antes de mutaciones críticas. Gate `hard` en producción. |
| Tratar con finalidad distinta a la autorizada | 34 ter lit a | Reutilizar datos clínicos en analítica sin base | Respeto del `Patient.processingObjections`; documentación en RAT por finalidad. |
| Vulnerar deber de secreto del Art 14 bis | 34 ter lit i | Filtración por error de personal | Capacitación + cláusula contractual + auditoría de accesos PHI (`PATIENT_RECORD_VIEWED`). |
| Vulnerar seguridad del Art 14 quinquies | 34 ter lit j | Falla de cifrado en reposo/tránsito | Gates de arranque (`ENCRYPTION_KEY`, `ENCRYPTION_AT_REST_CONFIRMED`, HTTPS) + cifrado app-level para snapshots y adjuntos. |
| Omitir registro de vulneraciones del Art 14 sexies | 34 ter lit k | Brecha no escalada o no documentada | Runbook obligatorio + entidad `DataBreachIncident` + auditoría especial `DATA_BREACH_*`. |
| Transferencia internacional sin garantías Art 27-28 | 34 ter lit m | Subencargados sin DPA adecuado | Inventario en RAT §3 + DPAs firmados (pendiente Ola 3 operativo). |
| Tratar datos de NNA en contravención | 34 quáter lit e | Crear consent sin representante para menor de 16 con datos sensibles | `PolicyComplianceService.assertNNAConsentValid()` rechaza el consentimiento si el firmante no es PADRE/MADRE/TUTOR. |
| Omitir notificación de brecha que afecte confidencialidad | 34 quáter lit f | No reportar a Agencia/titulares | Runbook + auditoría de cada paso + drill anual cronometrado. |
| Efectuar transferencia internacional a sabiendas sin garantías | 34 quáter lit h | Configuración incorrecta de subencargado | Inventario explícito + cláusulas modelo. |

## 2. Acciones técnicas preventivas

| # | Acción | Implementación | Responsable |
|---|---|---|---|
| T1 | Gates de arranque exigen cifrado, secretos no placeholder, deployment scope | `backend/src/main.helpers.ts:assertSafeConfig` | Administrador técnico |
| T2 | Validación de DTOs con `whitelist + forbidNonWhitelisted` | `ValidationPipe` global | Equipo de desarrollo |
| T3 | Cadena de integridad SHA-256 en `AuditLog` | `AuditService` | Equipo de desarrollo |
| T4 | Cifrado AES-256-GCM app-level: secciones clínicas, snapshots, adjuntos | `field-crypto.ts` reutilizado | Equipo de desarrollo |
| T5 | Guardia de bloqueo temporal | `PatientNotBlockedGuard` | Equipo de desarrollo |
| T6 | Consentimiento parental enforced para NNA | `PolicyComplianceService` | Equipo de desarrollo |
| T7 | SLA tracking con cron interno | `DataRequestSlaService` | Equipo de desarrollo |
| T8 | Runbook brechas + entidad dedicada | `DataBreachService` + doc | DPO + Admin |
| T9 | Scrubbing de PHI antes de Sentry/logs | `instrument.ts` + `phi-scrub.ts` | Equipo de desarrollo |
| T10 | Validación magic-bytes en uploads + ClamAV opcional | `attachments.storage.ts` + `AttachmentsScanService` | Equipo de desarrollo |

## 3. Acciones organizacionales preventivas

| # | Acción | Frecuencia | Responsable |
|---|---|---|---|
| O1 | Capacitación obligatoria sobre Ley 21.719 al personal sanitario | Anual + onboarding | DPO |
| O2 | Cláusula de confidencialidad en contratos laborales y de servicio | Al firmar | RRHH / DPO |
| O3 | Revisión de permisos y usuarios activos | Semestral | Admin técnico |
| O4 | Drill cronometrado de brecha y de solicitud de acceso | Anual | DPO |
| O5 | Verificación de cadena de auditoría (`audit:integrity:verify`) | Mensual | Admin técnico |
| O6 | Restore drill desde backup cifrado | Trimestral | Admin técnico |
| O7 | Revisión de DPIA y RAT | Anual + ante cambios sustanciales | DPO + asesor legal |
| O8 | Revisión de DPAs con subencargados (Cloudflare, Sentry, SMTP, hosting) | Anual | DPO + asesor legal |
| O9 | Auditoría externa de cumplimiento | Anual (cuando aplique) | Externa |

## 4. Reporte interno y escalamiento

- Cualquier miembro del equipo puede reportar un posible incidente o vulneración al DPO directamente o mediante la UI admin.
- Las solicitudes vencidas (`PatientDataRequest.status='VENCIDA'`) y las brechas críticas (`DataBreachIncident severity in {ALTO, CRITICO}`) generan alertas internas para el DPO.
- Decisiones de no reportar a la Agencia o de no notificar a titulares deben quedar documentadas con justificación en `riskAssessment`.

## 5. Sanciones internas por incumplimiento

[PENDIENTE_ABOGADO + RRHH] Política interna de sanciones por incumplimiento del personal:
- Advertencia escrita.
- Suspensión del acceso a Anamneo.
- Causal de término del contrato según gravedad.

## 6. Revisión

Este programa se revisa al cierre de cada ola del roadmap y, como mínimo, una vez al año. Su última revisión se documenta en el changelog al pie.

## 7. Referencias

- [Auditoría completa Ley 21.719](../AUDITORIA_LEY_21719_CHILE.md)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [DPIA Anamneo](dpia-2026.md)
- [Registro de Actividades de Tratamiento](data-processing-register.md)
- [Runbook brechas (Art 14 sexies)](incident-runbook-data-breach.md)
- [Procedimiento derechos del titular](operational-procedures-data-rights.md)

---

## Changelog

| Fecha | Cambio | Responsable |
|---|---|---|
| 2026-05-23 | Versión 0.1 inicial — estructura completa con secciones marcadas [PENDIENTE_ABOGADO + RRHH] | DPO interino |
