# Plan de Capacitación — Ley 21.719 Chile

**Versión:** 0.1 — Borrador estructural (2026-05-23)
**Estado:** Borrador interno; revisión y aprobación legal externa pendiente
**DPO responsable:** Alejandro López Zelaya `<allopze@gmail.com>` (interino)

> La Ley 21.719 no fija una frecuencia exacta de capacitación, pero exige responsabilidad, prevención, seguridad y formación permanente dentro del modelo de cumplimiento (Arts 48 y 49). Este plan operativiza esa obligación para Anamneo según las recomendaciones del asesor recogidas en [`respuestas-borrador-ley21719.md` §5.3](respuestas-borrador-ley21719.md).

---

## 1. Programa por público objetivo

| Público | Frecuencia | Contenido principal |
|---|---|---|
| **Todo el equipo** | Onboarding + anual | Principios de la ley, datos sensibles, derechos del titular, brechas, confidencialidad. |
| **Personal con acceso a PHI** (médicos, asistentes, admins clínicos) | Onboarding **antes** de habilitar acceso + anual | Ficha clínica, mínimo necesario, NNA, soporte seguro, escalamiento. |
| **Ingeniería** | Onboarding + semestral | Privacy by design, logs, cifrado, dumps, separación de ambientes, manejo de proveedores. |
| **Soporte / mesa de ayuda** | Onboarding + semestral | Verificación de identidad, tickets sin PHI, escalamiento, comunicaciones seguras. |
| **Dirección / DPO** | Anual + ante cambios relevantes | Riesgo regulatorio, sanciones, DPIA, proveedores, fiscalización. |
| **Simulacro de brecha** (toda la cadena de escalamiento) | Al menos anual | Detección, escalamiento, decisión de reportar, comunicación, evidencia. |

## 2. Currículo mínimo (todo el equipo)

1. Principios de la Ley 21.719.
2. Datos personales y datos sensibles (Art 2 lit g).
3. Datos de salud y su régimen especial.
4. NNA y autonomía progresiva.
5. Ficha clínica y Ley 20.584.
6. Secreto y confidencialidad (Art 14 bis).
7. Mínimo necesario.
8. Derechos del titular (Arts 4-11): acceso, rectificación, supresión, oposición, portabilidad, bloqueo.
9. Retención y supresión (matriz §8 de `data-privacy-and-compliance.md`).
10. Brechas e incidentes (Art 14 sexies): qué hacer en las primeras 24h.
11. Phishing y seguridad básica.
12. Uso seguro de sistemas internos (cuentas personales, 2FA, lockout, equipo compartido).
13. Soporte sin exposición de PHI.
14. Sanciones internas y regulatorias.
15. Casos prácticos (escenarios reales para discutir).

## 3. Currículo adicional (ingeniería)

Sumar al currículo general:

- Privacy by design.
- Seudonimización y anonimización.
- Cifrado a nivel filesystem vs aplicación (qué cubre cada uno).
- Segregación por tenant (single-clinic actual; cuidados al migrar a multi-clinic).
- Control de acceso (`JwtAuthGuard`, `RolesGuard`, `AdminGuard`, `PatientNotBlockedGuard`).
- Logs y scrubbing de PII/PHI (`instrument.ts`, `phi-scrub.ts`).
- Dumps y ambientes de prueba (no usar PHI real en dev/staging).
- Manejo de secretos (`SETTINGS_ENCRYPTION_KEY`, `ENCRYPTION_KEY`, JWT secrets, BOOTSTRAP_TOKEN).
- Revisión de proveedores (Cloudflare, Sentry, SMTP, hosting).
- Threat modeling básico.

## 4. Currículo adicional (soporte)

- Cómo verificar identidad antes de revelar información.
- Cómo redactar tickets sin incluir PHI evitable.
- Cómo escalar al DPO un caso sensible.
- Cómo manejar solicitudes de titulares que llegan por canales no oficiales.
- Cómo comunicar internamente un incidente potencial.

## 5. Currículo adicional (dirección / DPO)

- Régimen sancionatorio Ley 21.719 (Arts 34-38).
- Atribución de responsabilidades responsable / encargado / corresponsable.
- Cuándo Anamneo deja de ser encargado y pasa a ser responsable (ver `respuestas-borrador-ley21719.md` §5.1).
- DPIA y consultas previas.
- Gestión de fiscalización por la Agencia.
- Defensa frente a reclamaciones administrativas y judiciales.

## 6. Simulacros (al menos anuales)

| Simulacro | Objetivo | Script de referencia |
|---|---|---|
| **Brecha de seguridad** | Cronometrar detección → escalamiento → decisión → notificación. Objetivo: <72h | `backend/scripts/drills/breach-drill.js` |
| **Solicitud de acceso del titular** | Validar SLA Art 11 (30 días corridos). Probar verificación identidad + entrega segura. | `backend/scripts/drills/dsar-drill.js` |
| **Restore desde backup cifrado** | Validar continuidad operacional (Art 14 quinquies lit c). | `backend/scripts/pg-restore-drill.js` |
| **Solicitud de NNA con representante legal** | Validar flujo parental, edades, documentación de vínculo. | A diseñar |

Cada simulacro genera evidencia documental: bitácora cronometrada, decisiones tomadas, lecciones aprendidas, acciones correctivas.

## 7. Evidencia de cumplimiento

Por cada capacitación entregada, mantener en el drive seguro:

- Fecha y duración.
- Lista de asistentes (nombre, rol, email).
- Material entregado (PDF, video, slides).
- Evaluación corta (10 preguntas, mínimo 80% aprobado para validar).
- Constancia firmada por cada asistente (puede ser electrónica).

Estos registros son parte del paquete de fiscalización (ver `respuestas-borrador-ley21719.md` §5.2 ítem 23).

## 8. Calendario sugerido (año 0 - vigencia 01-DIC-2026)

| Mes | Acción |
|---|---|
| 2026-06 | Capacitación inicial al equipo actual (currículo §2). |
| 2026-07 | Capacitación dirigida ingeniería (currículo §3). |
| 2026-08 | Capacitación dirigida soporte (currículo §4). |
| 2026-09 | Simulacro de brecha cronometrado. |
| 2026-10 | Simulacro de DSAR end-to-end + restore drill. |
| 2026-11 | Refresher general + casos prácticos. |
| 2026-12 | Vigencia plena Ley 21.719 — auditoría de cumplimiento del plan. |
| Ciclo anual a partir de 2027 | Repetir cadencia con material actualizado por lecciones del año previo. |

## 9. Responsable y revisión

- **Diseño y mantención del plan:** DPO.
- **Ejecución:** DPO + responsable técnico de la clínica usuaria + RRHH del responsable.
- **Aprobación anual:** máxima autoridad directiva del responsable.
- **Revisión:** este plan se revisa al cierre de cada ola del roadmap y, como mínimo, una vez al año.

## 10. Referencias

- [Auditoría completa Ley 21.719](../AUDITORIA_LEY_21719_CHILE.md)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [Programa de prevención de infracciones](programa-prevencion-infracciones.md)
- [Acta DPO](dpo-designation-act.md)
- [Respuestas borrador asesor legal](respuestas-borrador-ley21719.md)
