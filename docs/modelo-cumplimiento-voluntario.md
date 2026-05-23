# Modelo Voluntario de Cumplimiento (Ley 21.719 Art 49 + Art 51)

**Versión:** 0.1 — Borrador estructural (2026-05-23)
**Estado:** Borrador interno; certificación ante la Agencia evaluada para cuando esté operativa
**DPO responsable:** Alejandro López Zelaya `<allopze@gmail.com>` (interino)

> El Art 49 de la Ley 21.719 permite a los responsables **adoptar voluntariamente** un modelo de prevención de infracciones. Cuando es certificado por la Agencia (Art 51), opera como **atenuante automática** del Art 36.5. Este documento define el modelo voluntario de Anamneo, que extiende el programa obligatorio del Art 48 documentado en [`programa-prevencion-infracciones.md`](programa-prevencion-infracciones.md).

---

## 1. Elementos exigidos por el Art 49

| Lit | Elemento | Cumplimiento en Anamneo |
|---|---|---|
| a | **Delegado de Protección de Datos** | Alejandro López Zelaya (interino). Formalización en Ola 0/1 del roadmap. |
| b | Medios y facultades del delegado | Sección 2 de este documento. |
| c | Identificación del tipo de información tratada, ámbito territorial, categorías, base de datos, características de los titulares | [RAT](data-processing-register.md). |
| d | Identificación de actividades o procesos que generen riesgo de las infracciones (Arts 34 bis, 34 ter, 34 quáter) | [`programa-prevencion-infracciones.md`](programa-prevencion-infracciones.md) §1. |
| e | Protocolos, reglas y procedimientos específicos para prevenir esas infracciones | Sección 3 de este documento + módulos backend ya implementados. |
| f | Mecanismos de reporte interno + reporte a la Agencia (Art 14 sexies) | [Runbook brechas](incident-runbook-data-breach.md) + módulo `DataBreachService`. |
| g | Sanciones administrativas internas + procedimientos de denuncia o castigo | Sección 4 de este documento. |

## 2. Facultades del DPO (Art 50)

El DPO de Anamneo tiene autonomía respecto de la administración en las materias relacionadas con la Ley 21.719. Sus facultades incluyen:

- Acceso a cualquier información de tratamiento de datos personales.
- Decisión sobre reportabilidad de brechas a la Agencia.
- Veto técnico sobre cambios que afecten cumplimiento (nuevas finalidades, subencargados, integraciones).
- Validación previa de DPAs con terceros.
- Aprobación de purgas regulatorias (vía workflow del `PatientsRegulatoryPurgeService`).
- Capacitación al personal.
- Punto de contacto único con la Agencia.

**Recursos asignados:** [PENDIENTE_OPERATIVO] presupuesto anual + tiempo dedicado + herramientas.

## 3. Protocolos específicos por infracción tipo

Cada protocolo está implementado como código + documentación. Tabla resumen:

| Infracción | Protocolo | Implementación |
|---|---|---|
| Tratamiento sin consentimiento (Art 34 ter lit a) | Verificar consentimiento del titular antes de cada `Patient` create/update sobre la versión publicada de la política | `PolicyComplianceService.assertConsentFor` |
| Vulnerar deber de secreto (Art 34 ter lit i, lit d) | Capacitación + cláusula contractual + auditoría de lectura PHI | RAT A1 + Programa O1 + AuditLog `PATIENT_RECORD_VIEWED` |
| Vulnerar seguridad (Art 34 ter lit j) | Gates de arranque + cifrado AES-256-GCM + verificación periódica de cadena | `main.helpers.ts` + `field-crypto.ts` + `AuditService.verifyChain` |
| Omitir registro de brecha (Art 34 ter lit k) | Entidad obligatoria + runbook + drill anual | `DataBreachService` + runbook |
| Transferencia internacional sin garantía (Art 34 ter lit m) | Inventario en RAT §3 + DPA por subencargado | RAT + DPAs (Ola 3 operativo) |
| Datos de NNA en contravención (Art 34 quáter lit e) | Validador de consentimiento parental para menores de 16 con datos sensibles | `PolicyComplianceService.assertNNAConsentValid` |
| Omitir notificación de brecha (Art 34 quáter lit f) | Plantilla + flujo notificación a Agencia y titulares con auditoría | `DataBreachService.notifyAgency / notifySubjects` |

## 4. Sanciones internas

[PENDIENTE_ABOGADO + RRHH] Definir y publicar internamente la matriz de sanciones por incumplimiento del personal:

- Advertencia escrita.
- Capacitación adicional obligatoria.
- Suspensión temporal del acceso.
- Causal de término del contrato (gravedad).

Las sanciones deben quedar incorporadas como obligación en los contratos laborales y de prestación de servicios (Art 49 inciso final).

## 5. Certificación ante la Agencia (Art 51)

[PENDIENTE — esperar reglamento]. Pasos previstos cuando la Agencia y el reglamento estén operativos:

1. Solicitar certificación con el dossier:
   - Este documento.
   - Programa obligatorio (Art 48).
   - DPIA firmada.
   - RAT firmado.
   - Evidencia de drills.
2. Acreditar vigencia de las medidas (auditorías internas, drill anual).
3. Mantener anotaciones en el Registro Nacional de Sanciones y Cumplimiento.
4. Vigencia: 3 años (Art 52), renovable.

## 6. Revisión y mejora continua

Este modelo se revisa al cierre de cada ola del roadmap y, como mínimo, una vez al año. La efectividad del modelo se mide por:

- Número de incidentes detectados y reportados a tiempo.
- Cumplimiento del SLA de derechos (Art 11).
- Resultados de drills cronometrados.
- Hallazgos de auditorías externas.
- Sanciones recibidas (objetivo: 0).

## 7. Referencias

- [Auditoría completa Ley 21.719](../AUDITORIA_LEY_21719_CHILE.md)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [DPIA](dpia-2026.md)
- [RAT](data-processing-register.md)
- [Programa de prevención obligatorio (Art 48)](programa-prevencion-infracciones.md)
- [Runbook de brechas](incident-runbook-data-breach.md)
- [Procedimiento de derechos del titular](operational-procedures-data-rights.md)
