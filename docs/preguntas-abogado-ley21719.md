# Preguntas para el asesor legal — Ley 21.719 Chile

**Contexto:** Anamneo está implementando el roadmap de cumplimiento de la Ley 21.719 documentado en [ADR-002](architecture-decisions/002-ley-21719-compliance.md) y en `/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`. Este documento concentra las preguntas, decisiones y entregables esperados del asesor legal externo, organizados por la ola del roadmap en que se necesitan.

**DPO interino:** Alejandro López Zelaya `<allopze@gmail.com>`

**Estado del archivo:** vivo — se actualiza con las respuestas a medida que se reciben.

---

## §1. Bloque urgente — Ola 0 (kickoff)

### 1.1 Alcance del compromiso del asesor
- ¿Confirma alcance del trabajo cubriendo: política de privacidad v1.0, registro de actividades de tratamiento (RAT), DPIA, plantillas DPA, procedimiento de derechos del titular, procedimiento de brechas, programa de prevención de infracciones?
- ¿Modalidad: retainer mensual, paquete cerrado, por hito?
- ¿Quién es el contacto operativo en el estudio para iteración rápida (revisión de drafts del equipo de ingeniería)?

### 1.2 Designación formal de DPO
- ¿Es suficiente la designación interna del DPO interino (Alejandro López Zelaya) o se requiere algún acto formal adicional (poder, escritura, registro)?
- ¿Hay incompatibilidades a considerar (Art 50 inciso 4: "El delegado de protección de datos podrá desempeñar otras funciones y cometidos, procurando mantener la independencia en su función")?
- ¿Conviene tener un DPO externo o interno mientras Anamneo opera con un equipo pequeño?

---

## §2. Bloque crítico — Ola 1 (política v1.0 + RAT + DPIA)

### 2.1 Política de privacidad v1.0 (Art 14 ter)

El frontend ya renderiza `LegalDocument.contentJson` de forma flexible (ver
[`frontend/src/components/legal/LegalDocumentPage.tsx`](../frontend/src/components/legal/)).
La pregunta para el abogado es de **contenido**, no de forma.

Necesitamos texto redactado para los 12 elementos exigidos por el Art 14 ter:

1. La política de tratamiento adoptada, fecha y versión.
2. La individualización del responsable y representante legal.
3. La identificación del encargado de prevención (DPO).
4. Domicilio postal, correo electrónico o medio equivalente.
5. Categorías, clases o tipos de datos tratados; descripción del universo de titulares; destinatarios; finalidades por base legal.
6. Política y medidas de seguridad adoptadas.
7. Derecho del titular a solicitar acceso, rectificación, supresión, oposición y portabilidad.
8. Derecho del titular a recurrir ante la Agencia.
9. Existencia y características de transferencias internacionales de datos, si las hay (en Anamneo: Cloudflare, Sentry, SMTP).
10. Período de conservación.
11. Fuente de los datos personales y, en su caso, si proceden de fuentes de acceso público.
12. Existencia de decisiones automatizadas, incluida la elaboración de perfiles.

Adicionalmente, cuando el tratamiento se base en consentimiento, debe informarse el derecho a retirarlo en cualquier momento sin afectar la licitud previa.

**Pregunta operativa:** ¿la política se redacta como un solo documento monolítico o se separa en política general + anexos por finalidad? El stack soporta ambas opciones.

### 2.2 Base legal específica para datos de salud (Art 16 bis)

El Art 16 bis exige que los datos de salud se traten "para los fines previstos por las leyes especiales en materia sanitaria". Anamneo sostiene actualmente que la base legal es la Ley 20.584 + Código Sanitario + normas MINSAL.

- ¿Esta cita legal es suficiente o se requiere mencionar normas más específicas (norma técnica de ficha clínica, reglamento, instrucción de la Superintendencia)?
- ¿Hay tratamientos que NO calzan en la excepción del Art 16 lit e (medicina preventiva/laboral, diagnóstico, asistencia sanitaria) y requieren consentimiento expreso adicional?
- ¿Cómo tratar la analítica clínica interna (no investigación, no estadística agregada): excepción de Art 16 lit e o consentimiento separado por Art 16 quinquies?

### 2.3 Tratamiento de datos de NNA (Art 16 quáter)

- ¿La edad para "niños/as" en Chile a efectos de protección de datos es siempre 14 años, o hay normas sanitarias que fijen otra edad de mayoría sanitaria?
- ¿Para el consentimiento del representante legal: basta la firma del padre/madre/tutor, o se requiere acreditar el vínculo (certificado de nacimiento, resolución de tutela)?
- ¿Cómo manejar adolescentes (14-18) con autonomía sanitaria progresiva: cuándo pueden consentir por sí mismos y cuándo se requiere representante?
- ¿Hay alguna obligación específica adicional de registro o reporte cuando el `Patient` es NNA?

### 2.4 Modelo de consentimiento del titular (Art 12)

El consentimiento debe ser libre, informado, específico, previo, inequívoco, mediante declaración o acción afirmativa, con prueba a cargo del responsable.

Anamneo planea capturar para cada `PatientDataProcessingConsent`:
- Identidad del titular (nombre, RUT).
- Identidad del firmante (`signerRelationship`: `TITULAR | PADRE | MADRE | TUTOR | REPRESENTANTE`).
- Versión de `LegalDocument` aceptada.
- Método: `PRESENCIAL_TABLET | WEB_TITULAR | REPRESENTANTE`.
- IP + user agent (cuando aplique).
- Timestamp.
- Hash del payload firmado.

**Preguntas:**
- ¿Es suficiente esta captura para satisfacer la carga probatoria del Art 12 inciso final?
- ¿En `PRESENCIAL_TABLET` (médico/asistente captura con el paciente al frente), qué firma adicional se necesita: digital, manuscrita escaneada, ninguna si hay IP+timestamp+acto presencial?
- ¿El consentimiento debe separarse por finalidad (atención clínica, analítica interna, comunicaciones, investigación) o puede agruparse?
- ¿La revocación del consentimiento implica supresión inmediata, suspensión de tratamiento, o ambos según el caso?

### 2.5 Registro de Actividades de Tratamiento (RAT)

Necesitamos plantilla validada del RAT que cumpla con el principio de responsabilidad (Art 3 lit e) y sirva como evidencia ante fiscalización. Formato sugerido por columna:

| Finalidad | Categorías de datos | Categorías de titulares | Destinatarios | Base legal | Plazo de conservación | Transferencias internacionales | Medidas de seguridad |

- ¿Esta estructura es suficiente o falta alguna columna requerida?
- ¿Debe incluirse cada subencargado (Cloudflare, Sentry, SMTP) como destinatario / transferencia?
- ¿Quién firma el RAT internamente (DPO, responsable, ambos)?

### 2.6 DPIA (Art 15 ter)

Anamneo cae en la causal (d) del Art 15 ter (datos sensibles bajo excepción del consentimiento) por lo que la DPIA es obligatoria.

- ¿Cuál es la metodología recomendada para la DPIA en Chile (CNIL adaptada, ISO 29134, propia del estudio)?
- ¿La DPIA es un documento único anual o se hace una por categoría/finalidad?
- ¿Qué nivel de detalle técnico debe contener: descripción de medidas de seguridad línea por línea o resumen ejecutivo + anexo técnico?
- ¿La DPIA debe presentarse a la Agencia o queda como documento interno disponible bajo requerimiento?

---

## §3. Bloque importante — Olas 2-3

### 3.1 Procedimiento de derechos del titular (Art 11)

- Plazo legal: 30 días corridos + prórroga 30 días corridos por una sola vez. Confirmar.
- Bloqueo temporal (Art 8 ter): 3 días hábiles según Art 41 inciso final. Confirmar.
- ¿Qué constituye "verificación de identidad" suficiente para una solicitud por correo: copia de cédula + selfie, video con cédula, presencial, mecanismo digital tipo Clave Única?
- ¿Es válido cobrar costos directos por solicitudes de acceso más de una vez por trimestre (Art 10) y por portabilidad?
- ¿Qué causales de denegación fundada son admisibles y cómo redactar la respuesta?
- ¿Cómo gestionar solicitudes que pretenden eliminar datos cuya retención es obligatoria por norma sanitaria (Art 7 excepciones lit ii, iii, iv)?

### 3.2 Retención por categoría

El default actual del repo es 15 años para fichas clínicas (`PATIENT_PURGE_MIN_AGE_DAYS = 5475`). Necesitamos validación legal específica:

- ¿Cuál es el plazo legal de conservación de la ficha clínica en Chile y qué norma lo fija? ¿Aplica norma única o varía por tipo de prestación (urgencia, ambulatorio, hospitalización, salud mental, oncología, pediatría, etc.)?
- ¿Los consentimientos clínicos tienen un plazo distinto a la ficha?
- ¿Los logs de auditoría (`AuditLog`) tienen un plazo mínimo o se rigen por prescripción de infracciones (Art 40: 4 años infracciones, 3 años sanciones)?
- ¿Backups tienen plazo mínimo legal o quedan a criterio del responsable por necesidad operativa?
- ¿Los datos de personas fallecidas se rigen por las mismas reglas (Art 4 inciso 3-4)?

### 3.3 Procedimiento de brechas (Art 14 sexies)

- ¿Cómo se interpreta "sin dilaciones indebidas" en la práctica chilena: objetivo interno de 24/48/72h?
- ¿Cuál es el canal formal de reporte a la Agencia mientras no esté formalmente operativa?
- ¿Qué constituye "riesgo razonable" en datos sensibles de salud: cualquier acceso no autorizado, fuga confirmada, o se requiere análisis caso a caso?
- ¿La notificación a titulares puede hacerse por email/SMS o requiere correo certificado/medio formal?
- ¿Qué información mínima debe contener la notificación a titulares (modelo)?

### 3.4 DPAs con subencargados (Art 15 bis)

Subencargados actuales:
- **Cloudflare** (tunelización + CDN): EE.UU. principalmente.
- **Sentry** (telemetría errores): EE.UU.
- **SMTP** (provider transaccional): por definir.

Preguntas:
- ¿Es suficiente aceptar los DPA estándar de cada provider (Cloudflare DPA, Sentry DPA) o se requiere addendum específico a la Ley 21.719?
- ¿Para EE.UU. mientras la Agencia no publique la lista de países adecuados (Art 28), qué garantías son aceptables: SCCs UE adoptadas por analogía, BCRs, consentimiento explícito del titular?
- ¿Cómo documentar que el subencargado cumple con los estándares del Art 14 quinquies (cifrado, seudonimización, resiliencia, verificación regular)?

### 3.5 Cifrado y minimización (Art 14 quinquies)

Decisión técnica pendiente: Anamneo planea cifrar app-level (AES-256-GCM) los datos identificatorios del paciente (RUT, nombre, teléfono, email, domicilio), los adjuntos y los snapshots regulatorios.

- ¿La ley exige seudonimización/cifrado específico para identificatorios o basta con cifrado de filesystem + medidas organizacionales?
- ¿Si optamos por NO cifrar a nivel app y justificarlo en la DPIA por estado del arte / costo, qué riesgo regulatorio enfrentamos en fiscalización?

---

## §4. Bloque de madurez — Ola 4

### 4.1 Programa de prevención de infracciones (Art 48)
- El Art 48 lo declara obligatorio. ¿Qué contenido mínimo exige la ley en la práctica (vs el modelo voluntario del Art 49)?

### 4.2 Modelo voluntario de cumplimiento (Art 49) + certificación (Art 51)
- ¿Conviene perseguir certificación ante la Agencia desde el inicio o esperar a tener historia operativa?
- ¿Existen entidades certificadoras autorizadas o ese aspecto está pendiente de regulación?
- ¿La certificación del modelo opera como atenuante automática del Art 36.5 o requiere acreditarse caso a caso?

### 4.3 Sanciones y prescripción
- ¿Cómo se calcula la UTM aplicable: día de la infracción, día de la sanción, día del pago?
- Para empresas no PYME, el Art 35 inciso final permite multas hasta 2%/4% de ingresos anuales por reincidencia. ¿Anamneo (operador técnico) y la clínica usuaria responden conjuntamente o separadamente?

---

## §5. Preguntas operativas transversales

### 5.1 Atribución de responsabilidades
- ¿La clínica usuaria es siempre el responsable y el operador técnico de la instancia es siempre el encargado, o hay configuraciones (ej. cloud hospedado por Anamneo) en que el operador es co-responsable?
- ¿Qué cláusulas del contrato Anamneo ↔ clínica deben dejar esto claro?

### 5.2 Documentación para fiscalización
- En caso de fiscalización de la Agencia: ¿qué documentos debe poder entregar Anamneo en 24-48h? Idealmente queremos mantener todo ese paquete versionado en el repo o en un drive accesible.

### 5.3 Capacitación obligatoria
- ¿Qué frecuencia y formato de capacitación esperan las autoridades para personal con acceso a PHI? ¿Existe currículo recomendado?

---

## Bitácora de respuestas

> Conforme se reciben respuestas del asesor, registrarlas aquí indicando fecha,
> sección abordada y referencia al deliverable (documento, commit, decisión).

| Fecha | Sección | Respuesta resumida | Deliverable |
|---|---|---|---|
| _por iniciar_ | — | — | — |
