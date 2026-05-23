# Bitácora de Decisiones de Cumplimiento — Ley 21.719

**Versión:** Vigente desde 2026-05-23
**Mantenedor:** DPO interino (Alejandro López Zelaya, allopze@gmail.com)

> Esta bitácora registra cada decisión relevante en materia de cumplimiento de la Ley 21.719: cambios de política, designaciones, contratos con encargados/subencargados, evaluaciones de riesgo, decisiones sobre reportabilidad de brechas, ajustes al programa de prevención y respuestas a fiscalización. La existencia de esta bitácora es uno de los 18 elementos del programa de prevención obligatorio (Art 48 — ver [`programa-prevencion-infracciones.md`](programa-prevencion-infracciones.md) §1 ítem 16) y parte del paquete de fiscalización (ítem 25).

---

## Convención de registro

Cada entrada usa el formato:

```
### YYYY-MM-DD — [TÍTULO BREVE]
- **Decisión:** qué se decidió.
- **Responsable:** quién tomó la decisión.
- **Justificación:** por qué (con cita legal o referencia técnica cuando aplique).
- **Artefactos:** archivos / documentos modificados o creados.
- **Próxima revisión:** cuándo y bajo qué condición se reevalúa.
```

---

## Entradas

### 2026-05-23 — Apertura de bitácora y consolidación de la Ola 0

- **Decisión:** establecer esta bitácora como registro vivo del cumplimiento y consolidar los entregables de la Ola 0 del roadmap.
- **Responsable:** DPO interino.
- **Justificación:** cumplir con el elemento 16 del programa de prevención obligatorio (Art 48 Ley 21.719) y con la recomendación del asesor legal (`respuestas-borrador-ley21719.md` §4.1 ítem 16).
- **Artefactos:** este archivo; [`dpo-designation-act.md`](dpo-designation-act.md); [`programa-prevencion-infracciones.md`](programa-prevencion-infracciones.md).
- **Próxima revisión:** al cierre de Ola 1 (publicación de política v1.0 validada).

### 2026-05-23 — Designación de DPO interino

- **Decisión:** designar a Alejandro López Zelaya `<allopze@gmail.com>` como DPO interino mientras dure la ejecución del roadmap de cumplimiento Ley 21.719.
- **Responsable:** Alejandro López Zelaya como propietario del proyecto (asumiendo dual rol: máxima autoridad + DPO interino).
- **Justificación:** Ley 21.719 Art 50 + recomendación del asesor (`respuestas-borrador-ley21719.md` §1.2). Equipo pequeño justifica DPO interno interino con autonomía documentada.
- **Artefactos:** [`dpo-designation-act.md`](dpo-designation-act.md) (borrador para firma).
- **Próxima revisión:** al cierre de Ola 4 (Go/No-Go) o, en cualquier caso, antes del 2026-11-30 para formalizar designación definitiva.

### 2026-05-23 — Corrección del plazo de bloqueo temporal (Art 8 ter)

- **Decisión:** corregir el plazo del responsable para resolver una solicitud de bloqueo temporal de 3 días hábiles a **2 días hábiles**. Los 3 días hábiles aplican a la Agencia en ciertos escenarios del Art 41 inciso final, no al plazo ordinario del responsable.
- **Responsable:** DPO interino (a partir de la respuesta legal en `respuestas-borrador-ley21719.md` §3.1).
- **Justificación:** Ley 21.719 Art 8 ter + interpretación recogida en respuesta legal §3.1.
- **Artefactos:** [`operational-procedures-data-rights.md`](operational-procedures-data-rights.md) §2 y §3.5; [`data-privacy-and-compliance.md`](data-privacy-and-compliance.md) §5.5.
- **Próxima revisión:** al recibir validación formal del asesor legal externo.

### 2026-05-23 — Estructura modular para la política de privacidad v1.0

- **Decisión:** adoptar la estructura **política general + anexos por finalidad** en lugar de un documento monolítico. El frontend (`LegalDocumentPage.tsx`) ya es agnóstico al contenido y soporta secciones extensibles.
- **Responsable:** DPO interino (basado en `respuestas-borrador-ley21719.md` §2.1).
- **Justificación:** mantenibilidad ante cambios técnicos y operativos; consistencia con el RAT por finalidad.
- **Artefactos:** [`backend/prisma/seed.ts`](../backend/prisma/seed.ts) (`legal-privacy-v1-draft`); refactorización a múltiples anexos pendiente.
- **Próxima revisión:** cuando el asesor legal externo entregue el texto definitivo de la política y cada anexo.

### 2026-05-23 — Cifrado app-level: alcance definido para Olas 3 y posterior

- **Decisión:** cifrar a nivel aplicación con AES-256-GCM (a) los snapshots regulatorios pre-purge, (b) los adjuntos de pacientes. Diferir cifrado de identificatorios del paciente (RUT, nombre, teléfono, email, domicilio) como criterio del Gate Go/No-Go Ola 4 — sujeto a decisión arquitectónica sobre lookup hashes para `rut UNIQUE`.
- **Responsable:** DPO interino + equipo de ingeniería.
- **Justificación:** Ley 21.719 Art 14 quinquies lit a + respuesta legal §3.5 que confirma "recomendación fuerte" sin ser exigencia literal. Adjuntos y snapshots se priorizan por su sensibilidad agregada (contienen PHI completa en un único artefacto).
- **Artefactos:** [`patients-regulatory-export.service.ts`](../backend/src/patients/patients-regulatory-export.service.ts), [`attachments.service.ts`](../backend/src/attachments/attachments.service.ts), [`field-crypto.ts`](../backend/src/common/utils/field-crypto.ts).
- **Próxima revisión:** antes de tratar datos reales en producción. Si se decide NO cifrar identificatorios, justificar en la DPIA y aplicar controles compensatorios.

### 2026-05-23 — Inclusión de cláusulas modelo de Diciembre 2025 como referencia para SCCs

- **Decisión:** adoptar las cláusulas contractuales modelo aprobadas por la Resolución RAEX202503748 (publicada 19-12-2025) como referencia principal para documentar las transferencias internacionales a Cloudflare, Sentry y SMTP provider.
- **Responsable:** DPO interino + asesor legal externo (cuando se contrate formalmente).
- **Justificación:** Ley 21.719 Arts 27-28 + respuesta legal §3.4. Mientras la Agencia no emita criterios adicionales, esas cláusulas son la referencia oficial más relevante.
- **Artefactos:** [`data-privacy-and-compliance.md` §6](data-privacy-and-compliance.md), [`data-processing-register.md`](data-processing-register.md) §3 (inventario de subencargados).
- **Próxima revisión:** al firmar los DPAs reales con cada subencargado (Ola 3 operativo).

---

## Plantilla para próximas entradas

```markdown
### YYYY-MM-DD — [Título]

- **Decisión:**
- **Responsable:**
- **Justificación:**
- **Artefactos:**
- **Próxima revisión:**
```
