# Acta de Designación del Delegado de Protección de Datos (DPO)

**Norma de referencia:** Ley 21.719 Art 50
**Versión:** 0.1 — Borrador para firma (2026-05-23)
**Estado:** **Borrador estructural.** Requiere firma de la máxima autoridad directiva o administrativa del responsable del tratamiento para tener efecto formal.

> Este documento es una plantilla operativa basada en las recomendaciones del asesor legal recogidas en [`respuestas-borrador-ley21719.md`](respuestas-borrador-ley21719.md) §1.2. No requiere escritura pública ni registro previo; basta una resolución interna o acta de gerencia firmada por la máxima autoridad directiva del responsable. Cuando se firme, mover una copia digital al drive seguro de cumplimiento y dejar la versión vigente referenciada desde [`data-privacy-and-compliance.md` §9](data-privacy-and-compliance.md).

---

## 1. Identificación del responsable

- **Responsable del tratamiento:** [PENDIENTE — razón social / nombre del responsable]
- **RUT:** [PENDIENTE]
- **Domicilio:** [PENDIENTE]
- **Representante legal:** [PENDIENTE]
- **Modalidad de despliegue:** single-clinic (Anamneo).

## 2. Identificación del DPO designado

- **Nombre completo:** Alejandro López Zelaya
- **Correo electrónico:** allopze@gmail.com
- **Cargo/relación con el responsable:** [PENDIENTE — interino designado en el contexto del roadmap de cumplimiento Ley 21.719]
- **Carácter de la designación:** **interino**, mientras dura la ejecución del roadmap documentado en [ADR-002](architecture-decisions/002-ley-21719-compliance.md) y hasta la formalización de un DPO definitivo.

## 3. Fecha de designación

- **Fecha:** 2026-05-23
- **Fecha de revisión obligatoria:** al cierre de la Ola 4 del roadmap (o, en cualquier caso, a más tardar el 2026-11-30).
- **Reemplazante o suplente operativo:** [PENDIENTE — designar suplente para vacaciones / incapacidad temporal del DPO interino].

## 4. Alcance del rol

El DPO designado actúa como interlocutor único frente a los titulares de datos, frente a los encargados, frente a la Agencia de Protección de Datos Personales y frente al equipo interno, en todas las materias relacionadas con la protección de datos personales tratados por el responsable.

Su alcance cubre todas las actividades de tratamiento documentadas en el [Registro de Actividades de Tratamiento](data-processing-register.md), tanto bajo la configuración base (clínica responsable + Anamneo encargado) como ante cualquier finalidad nueva que se incorpore al sistema.

## 5. Funciones mínimas

1. Validar la [política de privacidad](../backend/prisma/seed.ts), el [RAT](data-processing-register.md), la [DPIA](dpia-2026.md), las plantillas de DPA y los procedimientos de derechos del titular y de brechas.
2. Aprobar la ejecución de **borrados regulatorios** (`PatientsRegulatoryPurgeService`) sobre fichas clínicas archivadas.
3. Recibir y resolver solicitudes de titulares (Arts 4-11 Ley 21.719) dentro de los plazos legales (30 días corridos + prórroga 30; bloqueo temporal en 2 días hábiles).
4. Escalar incidentes de seguridad y decidir la reportabilidad de vulneraciones (Art 14 sexies) a la Agencia y a los titulares afectados.
5. Supervisar el cumplimiento del [Programa de Prevención de Infracciones](programa-prevencion-infracciones.md) (Art 48) y, cuando corresponda, del modelo voluntario del Art 49.
6. Mantener vigente el [paquete de fiscalización](respuestas-borrador-ley21719.md#52-documentación-para-fiscalización) con los 27 documentos mínimos.
7. Revisar y aprobar los DPAs con subencargados (Cloudflare, Sentry, SMTP, hosting, soporte externo) antes de su firma.
8. Coordinar las capacitaciones obligatorias del personal (ver [plan de capacitación](plan-capacitacion-ley21719.md)).
9. Mantener la [bitácora de decisiones de cumplimiento](#bitácora-de-decisiones) que respalde la responsabilidad proactiva (Art 3 lit e).
10. Ejecutar los **drills anuales** (brecha simulada, DSAR end-to-end, restore desde backup cifrado).
11. Reportar al menos una vez al año a la administración sobre el estado del cumplimiento.

## 6. Autonomía funcional

El DPO actúa con **autonomía funcional** respecto de la administración en las materias relacionadas con la Ley 21.719, aun cuando desempeñe otras funciones técnicas o directivas en el responsable. Sus decisiones en estas materias no pueden ser revocadas por subordinados ni revertidas sin justificación documentada por la máxima autoridad.

La administración debe:

- proveer al DPO acceso oportuno a toda la información relevante;
- abstenerse de instrucciones que comprometan la imparcialidad o independencia del DPO en materia de cumplimiento;
- documentar formalmente cualquier discrepancia entre la administración y el DPO.

## 7. Recursos mínimos asignados

- Tiempo dedicado: [PENDIENTE — estimar % de jornada o equivalente].
- Acceso administrativo a Anamneo (rol `ADMIN`).
- Acceso al drive seguro de cumplimiento.
- Presupuesto anual para asesoría legal externa (paquete cerrado + retainer, ver [`respuestas-borrador-ley21719.md` §1.1](respuestas-borrador-ley21719.md)).
- Presupuesto para certificaciones, capacitaciones y pentests cuando aplique.
- Capacidad de contratar asesoría puntual ante incidentes mayores.

## 8. Canal de contacto

| Canal | Destinatario | Uso |
|---|---|---|
| Email DPO | `allopze@gmail.com` | Solicitudes de titulares, escalamientos internos, comunicaciones de la Agencia. |
| Email del responsable | [PENDIENTE] | Comunicaciones formales del responsable hacia el DPO. |
| Canal interno de reporte | [PENDIENTE — definir, por ejemplo Slack #compliance o ticket dedicado] | Reportes internos del equipo al DPO. |

El email del DPO se publica en la política de privacidad y en `data-privacy-and-compliance.md` §9.

## 9. Obligación de confidencialidad

El DPO está obligado a mantener la confidencialidad estricta de toda la información a la que tenga acceso en el ejercicio de su cargo, incluso después de cesar en sus funciones. Esta obligación se extiende a:

- datos personales sensibles de salud de los titulares;
- secretos comerciales del responsable y de los encargados;
- información de incidentes y brechas mientras no sean públicos por canal oficial;
- contenido de las DPIAs, RATs y registros de cumplimiento.

Su incumplimiento puede dar lugar a sanciones contractuales, civiles y/o penales según corresponda.

## 10. Conflictos de interés y reglas de recusación

El DPO debe excusarse y escalar a la máxima autoridad cuando enfrente un conflicto de interés que comprometa su independencia. Casos típicos:

- decisión sobre una vulneración que él mismo causó o conocía y no escaló;
- relación personal o económica con un subencargado o con un titular afectado;
- doble rol con potencial conflicto (por ejemplo, decisor técnico y decisor de cumplimiento sobre el mismo cambio mayor).

Ante cualquiera de estos casos, el DPO documenta el conflicto en la bitácora y la decisión la asume la máxima autoridad o un asesor legal externo independiente.

---

## Firma de aprobación

Firmado por la máxima autoridad directiva o administrativa del responsable del tratamiento:

| Campo | Valor |
|---|---|
| Nombre | [PENDIENTE] |
| Cargo | [PENDIENTE — Gerente General / Representante Legal] |
| RUT | [PENDIENTE] |
| Fecha | [PENDIENTE] |
| Firma | [PENDIENTE — firma manuscrita o firma electrónica avanzada] |

Aceptación del DPO designado:

| Campo | Valor |
|---|---|
| Nombre | Alejandro López Zelaya |
| Correo | allopze@gmail.com |
| Fecha | [PENDIENTE] |
| Firma | [PENDIENTE] |

---

## Bitácora de decisiones

Esta bitácora se mantiene en [`bitacora-decisiones-cumplimiento.md`](bitacora-decisiones-cumplimiento.md) y registra: fecha, decisión, responsable y justificación de cada cambio relevante en política, procedimientos, DPAs, designaciones o incidentes.

---

## Referencias

- [Ley 21.719 Art 50](https://www.leychile.cl/leychile/navegar?idNorma=1209272&idVersion=2026-12-01)
- [ADR-002 Cumplimiento Ley 21.719](architecture-decisions/002-ley-21719-compliance.md)
- [Respuestas borrador asesor legal](respuestas-borrador-ley21719.md) §1.2
- [Privacidad y compliance](data-privacy-and-compliance.md) §9
