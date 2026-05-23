# Architecture Decision Record: Cumplimiento Ley 21.719 (Chile)

**Status:** Active
**Date:** 2026-05-23
**Decision Owner:** Alejandro López Zelaya (DPO interino, allopze@gmail.com)
**Supersedes:** N/A
**Related:** [`001-tenant-clinic-model.md`](001-tenant-clinic-model.md), [`../data-privacy-and-compliance.md`](../data-privacy-and-compliance.md), [`../audits/ley-21719-chile-audit-2026-05-23.md`](../audits/ley-21719-chile-audit-2026-05-23.md)

## Context

La Ley 21.719 de Chile (Regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales) entra en vigencia el **1 de diciembre de 2026** (idNorma BCN 1209272, idVersion 2026-12-01). Anamneo procesa datos personales sensibles de salud y, por construcción, cae dentro del ámbito de aplicación material y territorial de la ley.

Dos auditorías previas (la última realizada el 2026-05-23 contra el texto oficial y el código del repo) identificaron 16 brechas P0 que cruzan código, documentación legal y procedimientos operativos. Las críticas:

1. La política de privacidad publicada por el seed es autodeclarada "no apta para producción".
2. El `InformedConsent` se otorga por un `User` del sistema, no por el titular — incumple Art 12 estructuralmente.
3. Snapshots regulatorios pre-purge se persisten en claro.
4. Datos identificatorios del paciente (RUT, nombre, teléfono, email, domicilio) sin cifrado a nivel aplicación.
5. Cero infraestructura para: solicitudes ARCO+ (Art 4), bloqueo temporal (Art 8 ter), oposición (Art 8), NNA (Art 16 quáter), DPIA (Art 15 ter), RAT (Art 14 ter).
6. `docs/data-privacy-and-compliance.md` cita artículos equivocados y declara como "pendiente" funcionalidad que ya existe.

El proyecto está en desarrollo, sin clientes reales. Esto permite migraciones Prisma con `migrate reset` sin coste de data migration.

## Decision

Adoptar el roadmap de cumplimiento documentado en [`/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`](../../../.claude/plans/crea-un-plan-para-logical-hearth.md), estructurado en 5 olas (~10-12 semanas calendario con 1 dev senior + abogado a tiempo parcial), optimizando por unblocking más que por fecha fija.

### Resumen de olas

| Ola | Capacidad entregada | Duración | Migración Prisma |
|---|---|---|---|
| 0 | Saneamiento docs + DPO interino + kickoff legal | 1 sem | — |
| 1 | Modelo de consentimiento del titular + Política v1.0 (Art 12, 14 ter) | 3 sem | `ley21719_consent_model` |
| 2 | Derechos del titular Art 4-11 (entidad `PatientDataRequest`) | 3 sem | `ley21719_data_requests` |
| 3 | Cifrado app-level extendido + NNA (Art 16 quáter) + brechas (Art 14 sexies) | 3 sem | `ley21719_encryption_envelopes` + `ley21719_data_breach` |
| 4 | Drills + Gate Go/No-Go (10 criterios) | 2 sem | — |

### Decisiones de diseño que esta ADR fija

1. **Separación de consentimientos.** El consentimiento clínico (acto médico) y el consentimiento de tratamiento de datos personales son entidades distintas:
   - `ClinicalConsent` (rename de `InformedConsent`): otorgado por un `User`, registra el consentimiento clínico de un procedimiento.
   - `PatientDataProcessingConsent` (nueva): otorgado por el titular o su representante legal, vincula a una versión específica de `LegalDocument`, captura identidad, IP, user agent y evidencia.

2. **Solicitudes del titular como entidad de primera clase.** `PatientDataRequest` modela los 6 derechos del Art 4 con SLA del Art 11 (30 días corridos + prórroga 30). Las solicitudes admiten origen `TITULAR | REPRESENTANTE | ADMIN` y exigen verificación de identidad documentada.

3. **Bloqueo temporal y oposición como atributos de `Patient`.** `Patient.blockedAt` (Art 8 ter) y `Patient.processingObjections` (Art 8) son campos directos sobre `Patient` para que los guards de mutación clínica y la analítica los respeten sin joins adicionales.

4. **Cifrado app-level adicional sobre lo ya cifrado.** Más allá de `EncounterSection.data` (ya cifrado), agregar cifrado AES-256-GCM (reutilizando [`backend/src/common/utils/field-crypto.ts`](../../backend/src/common/utils/field-crypto.ts)) para: identificatorios del `Patient`, `Attachment` (envelope per file), y snapshots regulatorios. Las columnas plaintext de `Patient` se eliminan en la migración (no hay clientes reales).

5. **Política de privacidad versionable y vinculante.** `LegalDocument` v1.0 publicado en seed cubre los 12 elementos del Art 14 ter. Cada `PatientDataProcessingConsent` referencia una `legalDocumentId` específica, lo que permite invalidar consents cuando se publica nueva versión y exigir re-consentimiento.

6. **Procedimiento de brechas como módulo dedicado.** `DataBreachIncident` con flujo formal: detección → evaluación de "riesgo razonable" (Art 14 sexies) → reporte a la Agencia "sin dilaciones indebidas" → notificación a titulares (siempre obligatoria en Anamneo por tratarse de datos sensibles).

7. **DPO designado y publicado.** Alejandro López Zelaya (allopze@gmail.com) actúa como DPO interino durante el roadmap. La designación se formaliza al cierre de Ola 0 y queda registrada en [`docs/data-privacy-and-compliance.md`](../data-privacy-and-compliance.md) §9 y publicada en la política de privacidad v1.0.

8. **Asesor legal externo en el loop.** Cada ola tiene apoyo legal documentado (kickoff, política, RAT/DPIA, procedimientos, DPAs, firma final). Las preguntas pendientes para el abogado se mantienen en [`docs/preguntas-abogado-ley21719.md`](../preguntas-abogado-ley21719.md).

### Criterios de aceptación finales (Gate Go/No-Go, Ola 4)

Para declarar a Anamneo listo para tratar datos reales bajo Ley 21.719, los 10 criterios del plan deben estar en verde simultáneamente. No hay rebajas: cualquier criterio rojo bloquea el go-live.

## Consequences

**Positivas:**
- Anamneo dispondrá de evidencia técnica, documental y operativa verificable para auditoría externa o ante la Agencia.
- El stack actual (NestJS + Prisma + Next.js + AES-256-GCM + cadena de auditoría SHA-256) se reutiliza casi sin disrupción.
- Las migraciones Prisma se hacen con `migrate reset` mientras el proyecto no tiene clientes reales, evitando complejidad de data migration.

**Negativas:**
- 10-12 semanas de trabajo enfocado antes de operar con datos reales.
- Refactor del modelo de consentimiento rompe compatibilidad con cualquier código que asuma `InformedConsent` como única tabla.
- Costes legales (DPIA, RAT, DPAs, asesoría continua) son externos al equipo de ingeniería.

**Riesgos abiertos:**
- La Agencia de Protección de Datos Personales no estará constituida hasta poco antes del 01-DIC-2026, por lo que algunos requisitos (lista de países con nivel adecuado de protección, modelos de cláusulas, criterios de certificación del modelo de prevención) solo se cerrarán cerca de esa fecha.
- Reglamentos derivados de la ley (Art 26, Art 51) pueden agregar requisitos no contemplados.

## References

- [Auditoría completa Ley 21.719](../audits/ley-21719-chile-audit-2026-05-23.md)
- [Plan de implementación por olas](../../../.claude/plans/crea-un-plan-para-logical-hearth.md)
- [Privacidad de Datos y Compliance — Anamneo](../data-privacy-and-compliance.md)
- [BCN — Ley 21.719 (idNorma 1209272, vigencia 01-DIC-2026)](https://www.bcn.cl/leychile/navegar?idNorma=1209272)
- [Tenant/Clinic Model (ADR-001)](001-tenant-clinic-model.md)
