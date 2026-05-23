# Runbook: vulneraciones a la seguridad de datos personales (Ley 21.719 Art 14 sexies)

**Versión:** 0.1 — Borrador estructural (2026-05-23)
**Estado:** Vigente operativamente; revisión legal externa pendiente
**DPO responsable:** Alejandro López Zelaya `<allopze@gmail.com>` (interino)
**Ámbito:** este runbook es el procedimiento específico de Anamneo para incidentes que afecten la confidencialidad, integridad o disponibilidad de datos personales. Los incidentes operativos generales siguen en [`incident-runbooks.md`](incident-runbooks.md).

---

## 1. Marco legal aplicable

Ley 21.719 Art 14 sexies — el responsable debe reportar a la **Agencia de Protección de Datos Personales** **sin dilaciones indebidas** cuando exista **riesgo razonable** para los derechos de los titulares.

Anamneo trata datos sensibles (Art 2 lit g) por construcción. Por tanto, **toda vulneración con riesgo razonable también activa la obligación de notificar a los titulares afectados** (Art 14 sexies inciso 3).

**El plazo legal NO es 72 horas** (eso es GDPR). El estándar es cualitativo: "sin dilaciones indebidas". Como política interna se adopta como objetivo operativo **decidir reportabilidad en ≤24h y notificar en ≤72h** desde la detección.

## 2. Detección

Fuentes de detección admisibles:

- Alertas automáticas (Sentry, Cloudflare, monitoreo del host).
- Reporte del personal sanitario o admin.
- Reporte del titular.
- Auditoría rutinaria de `AuditLog` (cadena rota, accesos anómalos).
- Auditoría externa.

**Acción inicial inmediata (≤1h):** registrar el incidente en `DataBreachIncident` vía la UI admin o `POST /api/admin/data-breaches`. Capturar lo conocido aunque sea parcial.

## 3. Severidades y decisiones

| Severidad | Definición | Acción |
|---|---|---|
| **CRITICO** | Fuga confirmada de PHI / credenciales / muchos titulares afectados | Activar gabinete de crisis. Decidir reporte a la Agencia y notificación a titulares dentro de 24h. |
| **ALTO** | Acceso no autorizado sin fuga confirmada / pérdida de disponibilidad >12h | Evaluación profunda de "riesgo razonable". Decidir en 24-48h. |
| **MEDIO** | Indisponibilidad puntual, fallo de respaldo, configuración expuesta sin fuga | Registro + análisis técnico. Reporte a Agencia solo si la evaluación lo indica. |
| **BAJO** | Incidente cubierto por runbook estándar, sin afectación a datos | Registro interno. No requiere notificación externa. |

## 4. Evaluación de "riesgo razonable"

Documente esta evaluación en el campo `riskAssessment` del incidente. Marca los factores aplicables:

- [ ] **Naturaleza** del dato afectado (sensible salud = peso alto).
- [ ] **Volumen** (número de titulares afectados).
- [ ] **Identificabilidad** del titular en el dato expuesto.
- [ ] **Posibilidad de uso indebido** (fraude, reidentificación, daño físico).
- [ ] **Existencia de mitigantes** (cifrado, anonimización, accesos rastreables).
- [ ] **Si el incidente involucra menores de 14, datos financieros o sensibles** → notificación a titulares **obligatoria** (Art 14 sexies inciso 3).

Si tras la evaluación al menos un factor pesa "alto" y no hay mitigante suficiente, **reportar a la Agencia**.

## 5. Workflow técnico

1. Crear incidente: `POST /api/admin/data-breaches` con severity, scope, affectedPatientIds.
2. Investigar y contener (rotar credenciales, revocar sesiones, aislar host).
3. Documentar evaluación: `POST /api/admin/data-breaches/:id/assess` con `riskAssessment`.
4. Si procede reportar: `POST /api/admin/data-breaches/:id/notify-agency` (registra `reportedToAgencyAt`).
5. Si procede notificar a titulares: `POST /api/admin/data-breaches/:id/notify-subjects` con `measuresTaken`. Envía emails automáticos (`MailService.sendBreachNotificationToSubject`).
6. Cerrar incidente: `POST /api/admin/data-breaches/:id/close` con `postMortem`.

Cada paso queda auditado con razones `DATA_BREACH_*` y entra en la cadena de integridad SHA-256.

## 6. Reporte a la Agencia

[PENDIENTE_ABOGADO] Confirmar canal formal (correo, formulario web, oficio) de la Agencia una vez constituida. Mantener en este runbook la URL/contacto oficial y la plantilla del reporte (datos del responsable, naturaleza del incidente, categorías y volumen, consecuencias probables, medidas adoptadas y propuestas).

## 7. Notificación a titulares

La plantilla automática (`sendBreachNotificationToSubject`) incluye:
- Identificación del incidente.
- Fecha de detección.
- Alcance.
- Medidas adoptadas.
- Recomendaciones.
- Mención a la Agencia como vía de reclamación.

Si el titular no tiene email registrado (`Patient.email = NULL`), la notificación se hace por canal alternativo (presencial, correo certificado). Documente en `postMortem` qué titulares quedaron pendientes de notificar y por qué medio.

## 8. Post-mortem obligatorio

Antes de cerrar el incidente, complete:

- **Línea de tiempo** detectada → contenida → reportada → notificada → cerrada.
- **Causa raíz** técnica/organizacional.
- **Vector** de explotación.
- **Medidas correctivas** implementadas.
- **Medidas preventivas** a implementar (con responsable y fecha).
- **Indicadores** para detectar recurrencia.

El post-mortem se concatena al `rootCause` del incidente y queda en `AuditLog`.

## 9. Drill cronometrado

Como parte del Go/No-Go (Ola 4), ejecutar un drill anual cronometrado:

1. Simular detección de incidente (escenario predefinido).
2. Cronometrar: tiempo a apertura, a evaluación, a notificación, a cierre.
3. Objetivo interno: cierre del flujo en <72h.
4. Documentar lecciones aprendidas.

## 10. Referencias

- [DPIA Anamneo](dpia-2026.md)
- [Política de Privacidad v1.0 (seed)](../backend/prisma/seed.ts)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [Runbooks operativos generales](incident-runbooks.md)
- [Auditoría completa Ley 21.719](../AUDITORIA_LEY_21719_CHILE.md)
- [Preguntas al asesor legal](preguntas-abogado-ley21719.md)
