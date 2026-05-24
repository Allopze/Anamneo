# Respuestas borrador al cuestionario para asesor legal — Ley 21.719 Chile

**Proyecto:** Anamneo
**Documento base:** [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md)
**DPO interino:** Alejandro López Zelaya `<allopze@gmail.com>`
**Fecha de este borrador:** 2026-05-23
**Estado:** **Borrador interno**, NO sustituye la opinión del asesor legal. Sirve como base de trabajo para convertir las preguntas en decisiones operativas, issues, documentos internos y cláusulas contractuales.

> Este documento se mantiene vivo. Cuando el asesor legal externo emita opinión definitiva sobre una sección, marcarla con `[VALIDADO_ABOGADO YYYY-MM-DD]` y enlazar a la opinión firmada en el drive seguro.

---

## Referencias principales

- [Ley 21.719 — Ley Chile / BCN](https://www.leychile.cl/leychile/navegar?idNorma=1209272&idVersion=2026-12-01)
- [Guía práctica para facilitar la implementación de la nueva Ley de Datos Personales — Gobierno Digital](https://wikiguias.digital.gob.cl/datos-personales/guia-practica-implementacion-nueva-ley-datos-personales)
- [Ley 20.584 — Ley Chile / BCN](https://nuevo.leychile.cl/navegar?idNorma=1039348)
- [Resolución RAEX202503748 — cláusulas contractuales modelo para transferencias internacionales](https://www.leychile.cl/navegar?idNorma=1219636)
- [Publicación Diario Oficial, 19 de diciembre de 2025 — cláusulas contractuales modelo](https://www.diariooficial.interior.gob.cl/publicaciones/2025/12/19/44328/01/2742586.pdf)

---

# §1. Bloque urgente — Ola 0

## 1.1 Alcance del compromiso del asesor

### Pregunta

- ¿Confirma alcance del trabajo cubriendo política de privacidad v1.0, RAT, DPIA, plantillas DPA, procedimiento de derechos del titular, procedimiento de brechas y programa de prevención de infracciones?
- ¿Modalidad: retainer mensual, paquete cerrado, por hito?
- ¿Quién es el contacto operativo en el estudio para iteración rápida?

### Respuesta sugerida

Sí. El alcance jurídico debería cubrir como mínimo:

1. política de privacidad v1.0;
2. catálogo o Registro de Actividades de Tratamiento, aunque la ley no use necesariamente el término "RAT" con la misma estructura del GDPR;
3. DPIA o evaluación de impacto;
4. plantillas DPA y cláusulas de encargado/subencargado;
5. procedimiento de derechos del titular;
6. procedimiento de brechas;
7. matriz de retención y eliminación;
8. programa o modelo mínimo de prevención de infracciones;
9. matriz de bases legales y finalidades;
10. revisión de transferencias internacionales y subencargados.

La modalidad más conveniente para Anamneo es **paquete cerrado por entregables base + retainer mensual liviano**. El paquete cerrado evita ambigüedad en los documentos iniciales; el retainer permite resolver iteraciones de ingeniería, cambios de arquitectura, nuevos subencargados, incidentes, DPIA y actualizaciones regulatorias.

Debe nombrarse un **contacto operativo jurídico** con SLA claro. Recomendación:

- revisión simple: 24 a 48 horas hábiles;
- revisión compleja: 3 a 5 días hábiles;
- incidentes o brechas: canal urgente el mismo día;
- entregables versionados: comentarios en Markdown, Google Docs o PRs del repo, según flujo del equipo.

---

## 1.2 Designación formal de DPO

### Pregunta

- ¿Es suficiente la designación interna del DPO interino o se requiere poder, escritura o registro?
- ¿Hay incompatibilidades?
- ¿Conviene DPO externo o interno en un equipo pequeño?

### Respuesta sugerida

No se aprecia una exigencia de escritura pública, poder o registro previo para designar al DPO. La ley exige que el delegado sea designado por la máxima autoridad directiva o administrativa del responsable y que pueda actuar con independencia, aun cuando desempeñe otras funciones.

La decisión práctica recomendable es emitir una **resolución interna simple** o acta de gerencia que designe a Alejandro López Zelaya como DPO interino. Esa resolución debería incluir:

- fecha de designación;
- alcance del rol;
- funciones mínimas;
- autonomía funcional;
- recursos mínimos;
- canal de contacto;
- obligación de confidencialidad;
- reglas de recusación o escalamiento ante conflictos de interés;
- fecha de revisión de la designación;
- reemplazante o suplente operativo.

> **Implementación en repo:** ver [`dpo-designation-act.md`](dpo-designation-act.md) (borrador del acta listo para firma).

Para un equipo pequeño, un **DPO interno interino** es razonable si se documentan independencia, recursos y manejo de conflictos. Lo ideal es complementarlo con asesor legal externo para decisiones complejas, brechas, transferencias internacionales, DPIA y revisión de documentos.

Un DPO externo conviene cuando Anamneo escale, atienda muchas clínicas, trate altos volúmenes de datos sensibles, opere con NNA de forma intensiva, integre IA clínica o requiera mayor independencia frente a clientes/inversionistas/regulador.

---

# §2. Bloque crítico — Ola 1

## 2.1 Política de privacidad v1.0

### Pregunta

- ¿Debe redactarse como documento monolítico o como política general + anexos por finalidad?
- ¿Qué contenido debe cubrir el Art. 14 ter?

### Respuesta sugerida

La política debe cubrir los elementos exigidos por el Art. 14 ter y, adicionalmente, informar el derecho a retirar el consentimiento cuando un tratamiento se base en consentimiento.

Debe incluir como mínimo:

1. política de tratamiento adoptada, fecha y versión;
2. individualización del responsable y representante legal;
3. identificación del DPO o encargado de prevención/protección de datos;
4. domicilio postal, correo electrónico o medio equivalente;
5. categorías de datos tratados;
6. universo de titulares;
7. destinatarios;
8. finalidades y bases legales;
9. política y medidas de seguridad;
10. derechos de acceso, rectificación, supresión, oposición y portabilidad;
11. derecho a reclamar ante la Agencia;
12. transferencias internacionales;
13. período de conservación;
14. fuente de los datos;
15. existencia de decisiones automatizadas o perfiles;
16. derecho a retirar consentimiento, cuando aplique.

La mejor estructura para Anamneo es **política general + anexos por finalidad**.

La política general debería explicar el marco común: responsable, encargado, DPO, derechos, seguridad, contacto, Agencia, reglas generales de conservación y transferencias.

Los anexos por finalidad permiten mantener consistencia con el RAT o catálogo de tratamientos. Ejemplos de anexos:

- atención clínica;
- ficha clínica;
- administración de cuentas;
- soporte;
- auditoría y seguridad;
- telemetría de errores;
- comunicaciones transaccionales;
- facturación;
- investigación o analítica, solo si existe y está habilitada;
- entrenamiento de modelos, solo si se implementa y con base legal separada.

Esta estructura es más mantenible para un producto en evolución y evita que cada cambio técnico obligue a reescribir todo el documento.

> **Implementación en repo:** [`backend/prisma/seed.ts`](../backend/prisma/seed.ts) ya fue refactorizado a **documento general + anexos** manteniendo el contrato de `LegalDocumentPage.tsx`. Sigue pendiente que el asesor legal entregue el texto final y que el documento se publique como versión vigente.

---

## 2.2 Base legal específica para datos de salud

### Pregunta

- ¿Basta citar Ley 20.584 + Código Sanitario + normas MINSAL?
- ¿Hay tratamientos que requieren consentimiento adicional?
- ¿Cómo tratar analítica clínica interna?

### Respuesta sugerida

La cita a **Ley 20.584 + Código Sanitario + normas MINSAL** es un buen punto de partida, pero no debería quedarse como frase genérica. Para cada finalidad del sistema conviene mapear la base legal concreta.

La matriz debería distinguir, al menos:

| Finalidad | Base legal probable | Observación |
|---|---|---|
| Registro y mantención de ficha clínica | Ley 20.584 y normativa sanitaria | Tratamiento necesario para prestación sanitaria y conservación obligatoria. |
| Atención clínica y continuidad del cuidado | Ley 20.584, Código Sanitario, excepción de salud | No debería depender exclusivamente de consentimiento de privacidad. |
| Gestión operativa del sistema asistencial | Excepción sanitaria / gestión de servicios de salud | Debe limitarse a lo necesario. |
| Soporte técnico de la plataforma | Contrato encargado-responsable + instrucciones de la clínica | Requiere DPA y controles de acceso. |
| Auditoría, seguridad y logs | Cumplimiento legal, seguridad, responsabilidad proactiva | Retención y acceso estrictamente limitados. |
| Comunicaciones clínicas transaccionales | Prestación del servicio / atención sanitaria | Separar de marketing. |
| Marketing | Consentimiento separado | No mezclar con atención clínica. |
| Investigación | Consentimiento, anonimización o base legal específica | Evaluar Art. 16 quinquies, comité ético u otras normas. |
| Analítica comercial o de producto con datos identificables | Riesgosa; requiere base separada | Preferir anonimización o agregación robusta. |
| Entrenamiento de modelos | Alta sensibilidad | Requiere DPIA específica, base legal separada y controles reforzados. |

No deberían meterse bajo la misma base finalidades opcionales como marketing, comunicaciones no clínicas, investigación, entrenamiento de modelos, benchmarking comercial o analítica de producto sobre datos identificables.

Para **analítica clínica interna**, la respuesta depende del uso:

- Si la analítica es estrictamente para seguridad, calidad, continuidad del cuidado o gestión asistencial dentro de la clínica, puede documentarse como gestión sanitaria, siempre que sea proporcional y necesaria.
- Si la analítica se usa para investigación, publicación, desarrollo comercial, entrenamiento de modelos, benchmarking entre clínicas o mejora general del producto Anamneo, debe separarse y evaluarse con base legal propia, anonimización, consentimiento o autorización específica.

> **Implementación en repo:** matriz incorporada en [`data-processing-register.md`](data-processing-register.md) §3 y §2-ext. Sigue pendiente validar y firmar el RAT con asesor legal y responsable del tratamiento.

---

## 2.3 Tratamiento de datos de NNA

### Pregunta

- ¿La edad para niños/as es siempre 14 años?
- ¿Cómo acreditar consentimiento del representante legal?
- ¿Cómo manejar adolescentes de 14 a 18 años?
- ¿Hay obligaciones adicionales de registro o reporte?

### Respuesta sugerida

Para efectos de la Ley 21.719, la división relevante es:

- **niños/as:** menores de 14 años;
- **adolescentes:** mayores de 14 y menores de 18 años.

El tratamiento de datos de niños/as exige autorización de padres, representantes legales o quien tenga el cuidado personal, salvo que exista autorización legal suficiente.

Para adolescentes, se reconoce mayor autonomía, pero los datos sensibles de adolescentes menores de 16 años requieren especial cuidado y, según el caso, autorización de padres, representante legal o cuidador, salvo autorización legal.

En salud, además, debe considerarse la autonomía progresiva. La Ley 20.584 reconoce que NNA deben ser informados y escuchados según edad, madurez y desarrollo. Esto no elimina automáticamente la intervención del representante, pero sí exige que el flujo del producto registre mejor el contexto.

Campos recomendados para Anamneo:

- fecha de nacimiento;
- edad calculada al momento del consentimiento o atención;
- tipo de titular: adulto, adolescente, niño/a;
- identidad del representante;
- relación declarada: padre, madre, tutor, representante, cuidador;
- evidencia del vínculo, cuando corresponda;
- versión del documento aceptado;
- método de aceptación;
- constancia de información al NNA, si aplica;
- observaciones clínicas/administrativas sobre autonomía progresiva;
- ID del operador o profesional que registró el consentimiento;
- clínica o establecimiento responsable.

Para acreditar vínculo:

- padre/madre: puede bastar declaración auditada si la clínica ya validó identidad y vínculo dentro de su proceso asistencial;
- tutor o representante judicial: conviene exigir documento de respaldo;
- cuidador u otro tercero: exigir autorización o respaldo documental;
- remoto: usar autenticación fuerte, carga documental o validación por la clínica.

No hay una obligación general de reportar a una autoridad solo por tratar datos de NNA. Sí existe un estándar reforzado: finalidad legítima, interés superior, autonomía progresiva, minimización, control de acceso y trazabilidad.

> **Implementación en repo:** [`patient-consents.service.ts:assertNNAConsentValid`](../backend/src/patient-consents/patient-consents.service.ts) implementa el criterio conservador (<16 con `signerRelationship=TITULAR` se rechaza). El schema agregó campos de representante legal y la UI de creación/detalle de paciente ya expone el flujo. Sigue pendiente validación legal externa del criterio exacto y de la evidencia de vínculo.

---

## 2.4 Modelo de consentimiento del titular

### Pregunta

- ¿La captura propuesta satisface la carga probatoria del Art. 12?
- ¿Qué firma adicional se necesita en `PRESENCIAL_TABLET`?
- ¿El consentimiento debe separarse por finalidad?
- ¿La revocación implica supresión, suspensión o ambas?

### Respuesta sugerida

La captura propuesta es una buena base:

- identidad del titular;
- identidad del firmante;
- relación del firmante con el titular;
- versión del documento legal;
- método de aceptación;
- IP y user agent cuando aplique;
- timestamp;
- hash del payload firmado.

Para robustecer la prueba, agregaría:

- texto exacto mostrado al usuario;
- granularidad por finalidad;
- idioma;
- ID de sesión;
- ID del operador que asistió la firma;
- clínica o establecimiento;
- evidencia del vínculo del representante;
- canal de captura;
- snapshot inmutable del consentimiento;
- evento de revocación;
- motivo o canal de revocación, si el titular lo informa;
- hash de documento + hash de payload + versión de UI.

El consentimiento debe ser libre, informado, específico, previo e inequívoco. El responsable debe poder probarlo.

En `PRESENCIAL_TABLET`, para consentimiento de privacidad no parece indispensable una firma manuscrita si existe:

- acto afirmativo claro;
- identidad verificada;
- operador identificado;
- timestamp;
- versión del documento;
- hash del payload;
- registro de clínica/dispositivo/sesión.

Sin embargo, para consentimientos médicos informados bajo Ley 20.584, el estándar puede cambiar. En cirugías, procedimientos invasivos o procedimientos con riesgo relevante, debe constar por escrito o en sistema electrónico que garantice autenticidad.

El consentimiento debe separarse por finalidad. Puede agruparse lo estrictamente necesario para la atención clínica, pero deben ir separados:

- atención clínica;
- comunicaciones no esenciales;
- marketing;
- investigación;
- entrenamiento de modelos;
- analítica no asistencial;
- cesiones o transferencias no necesarias.

La revocación no implica siempre supresión inmediata. Implica detener el tratamiento basado únicamente en consentimiento. Si existe obligación sanitaria, contractual, legal, defensa jurídica o conservación obligatoria de ficha clínica, se conserva lo necesario y se bloquean o eliminan los usos opcionales.

> **Implementación en repo:** [`PatientDataProcessingConsent`](../backend/prisma/schema.prisma) ya cubre buena parte. Falta extender con: `language`, `sessionId`, `clinicId`, `representativeBondEvidenceRef`, `consentPayloadSnapshot` (texto exacto + hash), `revokedReason`, `revokedChannel`. Pendiente de Ola 3-extension.

---

## 2.5 Registro de Actividades de Tratamiento / catálogo

### Pregunta

- ¿La estructura propuesta es suficiente?
- ¿Debe incluir subencargados?
- ¿Quién firma el RAT?

### Respuesta sugerida

La estructura propuesta es suficiente como punto de partida:

| Finalidad | Categorías de datos | Categorías de titulares | Destinatarios | Base legal | Plazo de conservación | Transferencias internacionales | Medidas de seguridad |
|---|---|---|---|---|---|---|---|

Pero agregaría columnas para que sirva mejor en fiscalización y operación:

| Columna adicional | Motivo |
|---|---|
| ID de tratamiento | Trazabilidad y referencias cruzadas. |
| Responsable | Diferenciar clínica, Anamneo u otro. |
| Encargado/subencargado | Evidenciar cadena de tratamiento. |
| Sistema o módulo | Relacionar con arquitectura. |
| Fuente de datos | Exigencia de transparencia. |
| País de destino | Transferencias internacionales. |
| Mecanismo de transferencia | SCCs, país adecuado, contrato, excepción. |
| Necesidad de DPIA | Gestión de riesgo. |
| Nivel de riesgo | Priorización. |
| Roles con acceso | Control interno. |
| Método de eliminación/anonimización | Retención real. |
| Responsable interno | Accountability. |
| Fecha de última revisión | Evidencia de mantención. |

Cloudflare, Sentry y SMTP deben figurar como encargados/subencargados, destinatarios técnicos y posibles transferencias internacionales si pueden acceder, alojar, enrutar, registrar o procesar datos personales.

El RAT o catálogo debería prepararlo el DPO, validarlo legal, aprobarlo la administración del responsable y versionarlo. Si la clínica es responsable, la clínica debería aprobar su catálogo. Anamneo debería mantener además su propio catálogo como encargado/proveedor.

> **Implementación en repo:** [`data-processing-register.md`](data-processing-register.md) actualizado con columnas extendidas (ver §2 de ese documento).

---

## 2.6 DPIA

### Pregunta

- ¿Qué metodología usar?
- ¿DPIA anual o por categoría/finalidad?
- ¿Qué nivel técnico debe contener?
- ¿Debe presentarse a la Agencia?

### Respuesta sugerida

Anamneo debería hacer DPIA porque trata datos sensibles de salud, potencialmente datos de NNA y tratamientos de riesgo alto. La DPIA debe describir operaciones, finalidades, necesidad, proporcionalidad, riesgos y medidas de mitigación.

Metodologías recomendables:

- ISO/IEC 29134 adaptada a Chile;
- CNIL PIA adaptada a Ley 21.719;
- metodología propia del estudio legal, siempre que sea trazable y cubra los elementos de la ley.

No conviene hacer una DPIA única anual genérica. Es preferible una **DPIA por sistema o familia de tratamiento de alto riesgo**, con anexos por cambios relevantes.

Ejemplos de DPIA o anexos separados:

- ficha clínica y atención sanitaria;
- tratamiento de NNA;
- telemetría de errores;
- transferencias internacionales;
- IA o apoyo a decisiones clínicas;
- analítica;
- nuevos subencargados;
- grandes cambios de arquitectura.

Nivel de detalle recomendado:

1. resumen ejecutivo;
2. descripción de tratamientos;
3. mapa de datos;
4. bases legales;
5. análisis de necesidad y proporcionalidad;
6. matriz de riesgos;
7. controles existentes;
8. controles pendientes;
9. riesgos residuales;
10. decisión de aceptación o mitigación;
11. anexo técnico con arquitectura, cifrado, RBAC, logs, backups, segregación, proveedores y pruebas.

No conviene publicar secretos de seguridad en la DPIA principal. Los detalles sensibles deberían quedar en anexos técnicos con acceso restringido.

La DPIA queda como documento interno disponible ante requerimiento. Solo debería consultarse o entregarse a la Agencia cuando la ley, un procedimiento fiscalizador o una instrucción lo exija, especialmente si persiste un alto riesgo residual.

> **Implementación en repo:** [`dpia-2026.md`](dpia-2026.md) cubre la estructura de 11 secciones. Pendiente: agregar referencia explícita a la metodología elegida (ISO 29134 + CNIL PIA híbrida).

---

# §3. Bloque importante — Olas 2-3

## 3.1 Procedimiento de derechos del titular

### Pregunta

- Confirmar plazo de 30 días + prórroga.
- Confirmar bloqueo temporal.
- ¿Qué verificación de identidad es suficiente?
- ¿Se pueden cobrar costos directos?
- ¿Qué causales de denegación son admisibles?
- ¿Cómo gestionar datos con retención sanitaria obligatoria?

### Respuesta sugerida

El plazo general de respuesta es **30 días corridos**, prorrogable una vez por otros **30 días corridos**. La respuesta debe ser escrita y conservar prueba de fecha, contenido y envío.

**Corrección importante respecto al borrador anterior:** para bloqueo temporal, el responsable debe responder dentro de **2 días hábiles** (no 3). Los 3 días hábiles se asocian a la resolución de la Agencia en ciertos escenarios, no al plazo ordinario del responsable.

Verificación de identidad recomendada:

| Canal | Verificación sugerida |
|---|---|
| Portal autenticado | Sesión fuerte + segundo factor. |
| Correo electrónico | Enlace seguro + validación de identidad + datos conocidos. |
| Solicitud sensible o ficha clínica | Cédula, autenticación fuerte, validación presencial o equivalente. |
| Tercero autorizado | Poder o mandato válido. |
| Representante de NNA | Identidad + vínculo + evidencia proporcional. |
| Heredero | Documentación sucesoria o respaldo suficiente. |

No recomiendo exigir copia de cédula + selfie por defecto en todas las solicitudes, porque puede aumentar innecesariamente el tratamiento de datos sensibles/biométricos. Debe usarse un criterio proporcional al riesgo.

Costos:

- rectificación, supresión y oposición: gratuitos;
- acceso: gratuito al menos una vez por trimestre;
- acceso adicional o portabilidad más de una vez por trimestre: podrían cobrarse costos directos, sujeto a parámetros de la Agencia;
- en la práctica inicial, conviene no cobrar salvo abuso evidente y política aprobada.

Causales admisibles de denegación:

- falta de verificación de identidad;
- falta de legitimación del solicitante;
- inexistencia de datos;
- conservación obligatoria por norma sanitaria;
- necesidad para defensa jurídica;
- obligación legal;
- interés público o salud pública;
- investigación bajo condiciones legales;
- afectación de derechos de terceros;
- imposibilidad técnica justificada, si aplica y se explica bien;
- solicitud manifiestamente infundada o excesiva, si la ley/reglamento lo permite y se documenta.

Si alguien solicita eliminar ficha clínica dentro del plazo obligatorio, la respuesta correcta no es eliminar. Debe indicarse que la supresión no procede por obligación sanitaria de conservación, pero sí se pueden:

- revocar consentimientos opcionales;
- bloquear usos no necesarios;
- restringir finalidades secundarias;
- corregir datos inexactos;
- entregar copia o acceso;
- informar plazo de conservación y base legal.

> **Implementación en repo:** [`operational-procedures-data-rights.md`](operational-procedures-data-rights.md) actualizado con el plazo correcto de **2 días hábiles** para bloqueo y la matriz de identidad por canal.

---

## 3.2 Retención por categoría

### Pregunta

- ¿Cuál es el plazo legal de conservación de ficha clínica?
- ¿Consentimientos clínicos tienen plazo distinto?
- ¿Logs de auditoría tienen plazo mínimo?
- ¿Backups tienen plazo mínimo?
- ¿Datos de fallecidos se rigen igual?

### Respuesta sugerida

La ficha clínica debe conservarse **al menos 15 años**. La Ley 20.584 fija ese mínimo y establece la responsabilidad del prestador sobre reserva, conservación y confidencialidad.

El valor actual `PATIENT_PURGE_MIN_AGE_DAYS = 5475` es correcto como mínimo técnico equivalente a 15 años, pero debería contarse desde la **última atención o último registro clínico relevante**, no necesariamente desde la creación del paciente.

> **Implementación en repo:** [`patients-regulatory-purge.service.ts`](../backend/src/patients/patients-regulatory-purge.service.ts) calcula la retención desde la fecha más reciente entre archivo y última atención relevante. Sigue pendiente validar la matriz de retención por categoría con asesor legal.

Recomendación de matriz:

| Categoría | Plazo sugerido | Observación |
|---|---:|---|
| Ficha clínica | Mínimo 15 años desde última atención | Validar especialidades o reglas sectoriales. |
| Consentimientos clínicos | Igual que ficha asociada | Son evidencia del acto clínico. |
| Consentimientos de privacidad | Mientras dure tratamiento + plazo de defensa/prescripción | Mantener evidencia de licitud. |
| Revocaciones | Igual que consentimiento relacionado | Evidencia de cumplimiento. |
| Logs de acceso a ficha | 4 a 5 años mínimo; idealmente 15 si integran evidencia clínica | Depende de rol probatorio. |
| Logs técnicos de seguridad | Según necesidad operativa y riesgo | Ej. 180 días, 1 año o más, según severidad. |
| Backups | TTL operativo definido | Cifrado, rotación y restauración controlada. |
| Tickets de soporte con PHI | Mínimo necesario | Preferir redacción sin PHI. |
| Telemetría de errores | Mínimo necesario | Scrubbing de PII/PHI. |

Para logs de auditoría, la Ley 21.719 no fija un plazo mínimo único. Como referencia operativa, conviene considerar la prescripción de infracciones y sanciones, además de la prescripción civil. Si el log acredita acceso a ficha o cumplimiento clínico, puede justificarse una retención mayor.

Backups no tienen un plazo mínimo general. Deben definirse por continuidad operacional, con:

- cifrado;
- TTL;
- segregación;
- pruebas de restauración;
- control de acceso;
- procedimiento para no revivir indebidamente datos eliminados o bloqueados.

Los datos de personas fallecidas siguen sujetos a reglas de reserva, conservación y acceso. Los derechos pueden ser ejercidos por herederos o personas legitimadas, con validación documental.

> **Implementación en repo:** [`data-privacy-and-compliance.md` §8](data-privacy-and-compliance.md) refleja esta matriz.

---

## 3.3 Procedimiento de brechas

### Pregunta

- ¿Cómo interpretar "sin dilaciones indebidas"?
- ¿Cuál es el canal formal mientras la Agencia no opera?
- ¿Qué es riesgo razonable en salud?
- ¿La notificación a titulares puede hacerse por email/SMS?
- ¿Qué debe contener la notificación?

### Respuesta sugerida

"Sin dilaciones indebidas" no equivale automáticamente a un plazo fijo de 72 horas, pero para operación interna conviene usar un estándar exigente:

| Hito | Objetivo interno |
|---|---:|
| Detección y registro inicial | Inmediato |
| Triage de severidad | < 24 h |
| Escalamiento a DPO/legal/seguridad | < 24 h |
| Evaluación de riesgo | < 48 h |
| Decisión de notificar | < 72 h |
| Notificación si procede | Sin demora, documentando razones |

Debe reportarse a la Agencia cuando una vulneración de seguridad cause destrucción, filtración, pérdida, alteración, comunicación o acceso no autorizado y exista riesgo razonable para derechos y libertades.

En salud, ante acceso no autorizado a datos identificables de pacientes, **la presunción práctica debería ser que existe riesgo razonable**, salvo que se documente lo contrario. Ejemplos de bajo riesgo podrían ser datos cifrados sin compromiso de llaves o eventos contenidos sin acceso real a PHI.

Mientras la Agencia no esté plenamente operativa, no debería inventarse un canal definitivo. Sí debe prepararse:

- registro interno de incidentes;
- matriz de severidad;
- plantilla de notificación a Agencia;
- plantilla de notificación a titulares;
- playbook interno;
- monitoreo de instrucciones oficiales.

La notificación a titulares puede hacerse por medios electrónicos si son adecuados, trazables y efectivos. Email o SMS pueden servir, pero para incidentes graves conviene combinar canales. Si la notificación individual no es posible, debería evaluarse comunicación masiva conforme a la ley.

Contenido mínimo de notificación a titulares:

1. identificación del responsable;
2. datos de contacto del DPO;
3. fecha o período estimado del incidente;
4. descripción clara del incidente;
5. categorías de datos afectadas;
6. posibles consecuencias;
7. medidas adoptadas por el responsable;
8. medidas recomendadas al titular;
9. canales de consulta;
10. referencia al derecho a reclamar ante la Agencia;
11. información de seguimiento, si aplica.

> **Implementación en repo:** [`incident-runbook-data-breach.md`](incident-runbook-data-breach.md) actualizado con la tabla SLA, presunción de riesgo razonable, y la plantilla de 11 elementos. [`MailService.sendBreachNotificationToSubject`](../backend/src/mail/mail.service.ts) cubre los 11 elementos con campos explícitos y fallbacks.

---

## 3.4 DPAs con subencargados

### Pregunta

- ¿Basta aceptar DPAs estándar de Cloudflare/Sentry?
- ¿Qué garantías usar para EE.UU.?
- ¿Cómo documentar cumplimiento del Art. 14 quinquies?

### Respuesta sugerida

Los DPA estándar de Cloudflare, Sentry o el proveedor SMTP pueden servir como base, pero deben revisarse contra los requisitos de la Ley 21.719.

El contrato con encargados/subencargados debería regular:

- objeto del tratamiento;
- duración;
- naturaleza y finalidad;
- tipo de datos;
- categorías de titulares;
- instrucciones documentadas;
- confidencialidad;
- medidas de seguridad;
- subencargados;
- transferencias internacionales;
- asistencia en derechos del titular;
- asistencia en brechas;
- auditoría o evidencia de cumplimiento;
- devolución o eliminación;
- prohibición de uso para finalidades propias;
- notificación de cambios relevantes.

Para transferencias internacionales a EE.UU., no conviene depender solo de consentimiento del titular para proveedores habituales. La estrategia preferida debería ser:

1. revisar si existe país adecuado o mecanismo reconocido;
2. usar cláusulas contractuales modelo aprobadas o aceptadas;
3. incorporar anexos técnicos de seguridad;
4. documentar evaluación de transferencia;
5. mantener lista de subprocesadores;
6. evaluar cifrado, minimización y región de datos.

**En diciembre de 2025 se aprobaron cláusulas contractuales modelo para transferencias internacionales** (Resolución RAEX202503748, publicada en Diario Oficial 19-12-2025). Mientras la Agencia no emita criterios adicionales, esas cláusulas son una referencia especialmente relevante para documentar transferencias.

Expediente mínimo por proveedor:

| Documento/evidencia | Aplicación |
|---|---|
| DPA vigente | Todos. |
| Lista de subprocessors | Cloudflare, Sentry, SMTP. |
| Países de tratamiento | Transferencias internacionales. |
| Certificaciones o reportes | SOC 2, ISO 27001, etc., si existen. |
| Medidas de seguridad | Cifrado, acceso, segregación, logging. |
| Retención | Logs, errores, emails, adjuntos. |
| Eliminación | Baja de cuenta, purge, backups. |
| Notificación de incidentes | SLA y canal. |
| Configuración técnica | Scrubbing de PII, regiones, minimización. |
| Evaluación de riesgo | Riesgo residual aceptado. |

> **Implementación en repo:** template DPA expandido a 16 cláusulas en [`data-privacy-and-compliance.md` §6](data-privacy-and-compliance.md).

---

## 3.5 Cifrado y minimización

### Pregunta

- ¿La ley exige cifrado/seudonimización específica?
- ¿Qué riesgo existe si no se cifra a nivel aplicación?

### Respuesta sugerida

La ley no exige literalmente "AES-256-GCM app-level" para todos los identificadores. Sí exige medidas de seguridad apropiadas al riesgo, considerando estado del arte, costos, naturaleza de los datos, riesgos, confidencialidad, integridad, disponibilidad y resiliencia.

Para datos de salud, NNA y ficha clínica, la recomendación fuerte es cifrar a nivel aplicación al menos:

- RUT;
- nombre;
- teléfono;
- email;
- domicilio;
- adjuntos;
- snapshots regulatorios;
- documentos sensibles;
- backups sensibles;
- tokens o identificadores de integración.

Si Anamneo decide no cifrar a nivel app, debería justificarlo en la DPIA y reforzar controles compensatorios:

- cifrado de disco;
- cifrado de base de datos;
- TLS;
- RBAC estricto;
- separación por tenant;
- logs de auditoría;
- rotación de secretos;
- hardening;
- monitoreo;
- minimización;
- scrubbing en logs;
- backups cifrados;
- pruebas periódicas.

Riesgo regulatorio: si ocurre una brecha, será más difícil demostrar que las medidas eran adecuadas al riesgo de datos sensibles de salud. No cifrar app-level puede ser defendible en ciertos contextos, pero debe estar muy bien justificado y compensado.

> **Estado en repo:** adjuntos, snapshots regulatorios e identificatorios principales del paciente ya tienen cifrado app-level. Quedan drops controlados de columnas plaintext transitorias para representante legal, firmante de consentimiento y solicitante DSAR, documentados en `backend/prisma/migrations-pending/`.

---

# §4. Bloque de madurez — Ola 4

## 4.1 Programa de prevención de infracciones

### Pregunta

- El Art. 48 lo declara obligatorio. ¿Qué contenido mínimo exige en la práctica?

### Respuesta sugerida

Anamneo debería implementar desde ya un programa mínimo, aunque no busque certificación inmediata.

Contenido mínimo recomendado:

1. política de protección de datos;
2. designación de DPO;
3. catálogo/RAT;
4. matriz de bases legales;
5. DPIA;
6. procedimiento de derechos;
7. procedimiento de brechas;
8. política de seguridad;
9. matriz de retención;
10. gestión de proveedores y DPAs;
11. evaluación de transferencias internacionales;
12. capacitación;
13. canal interno de reporte;
14. reglas disciplinarias o contractuales;
15. auditorías periódicas;
16. bitácora de decisiones;
17. evidencias de cumplimiento;
18. revisión anual del programa.

El programa debe demostrar responsabilidad proactiva, no solo existencia documental.

> **Implementación en repo:** [`programa-prevencion-infracciones.md`](programa-prevencion-infracciones.md) cubre los 18 elementos y [`bitacora-decisiones-cumplimiento.md`](bitacora-decisiones-cumplimiento.md) registra decisiones de cumplimiento. Quedan pendientes ejecución operativa, capacitación, sanciones internas y revisiones periódicas.

---

## 4.2 Modelo voluntario de cumplimiento y certificación

### Pregunta

- ¿Conviene perseguir certificación desde el inicio?
- ¿Existen entidades certificadoras?
- ¿La certificación opera como atenuante automática?

### Respuesta sugerida

No conviene perseguir certificación desde el día uno si todavía no existen evidencias operativas suficientes. Sí conviene construir el modelo desde el inicio para poder certificarlo después.

Hitos previos recomendados:

- documentos base aprobados;
- DPIA completada;
- proveedores evaluados;
- entrenamiento realizado;
- simulacro de brecha;
- solicitudes de derechos probadas;
- logs y evidencias funcionando;
- auditoría interna;
- corrección de brechas detectadas;
- revisión legal actualizada.

La certificación legal dependerá de la Agencia y de los mecanismos que estén operativos. Certificaciones privadas, como ISO 27001, SOC 2 u otras, pueden servir como evidencia, pero no deben presentarse como certificación legal del modelo de cumplimiento de la Ley 21.719 si no están reconocidas por la Agencia.

La certificación debería operar como atenuante, pero en la práctica habrá que acreditar caso a caso que:

- el modelo estaba vigente;
- era adecuado al riesgo;
- estaba implementado realmente;
- había supervisión;
- el hecho investigado estaba cubierto por controles;
- se actuó diligentemente antes y después del incidente.

---

## 4.3 Sanciones y prescripción

### Pregunta

- ¿Cómo se calcula la UTM aplicable?
- ¿Anamneo y clínica responden conjunta o separadamente?

### Respuesta sugerida

Las multas de la Ley 21.719 se estructuran, en términos generales, así:

| Tipo de infracción | Multa |
|---|---:|
| Leve | Hasta 5.000 UTM |
| Grave | Hasta 10.000 UTM |
| Gravísima | Hasta 20.000 UTM |
| Reincidencia | Puede triplicarse |
| Empresas no pequeñas, ciertos casos | Hasta 2% o 4% de ingresos anuales por ventas y servicios |

La ley indica que las multas se pagan ante Tesorería dentro del plazo legal desde que la resolución queda ejecutoriada. **No queda completamente claro, solo desde el texto general, si la UTM aplicable debe calcularse al día de la infracción, sanción, ejecutoria o pago.** Esto debe quedar como pregunta abierta para el abogado, idealmente revisando práctica administrativa de Tesorería, Contraloría y derecho sancionatorio chileno.

Anamneo y la clínica no responden necesariamente juntos en todos los casos.

Configuración base:

- clínica: responsable;
- Anamneo: encargado;
- Cloudflare/Sentry/SMTP: subencargados, según configuración.

Anamneo puede pasar a ser responsable o corresponsable si decide finalidades propias, reutiliza datos entre clientes, entrena modelos, realiza benchmarking, usa datos para analítica comercial no instruida por la clínica o define medios/finalidades esenciales más allá del servicio técnico.

Si Anamneo trata datos para una finalidad distinta a la instruida, puede responder como responsable de ese tratamiento.

---

# §5. Preguntas operativas transversales

## 5.1 Atribución de responsabilidades

### Pregunta

- ¿La clínica siempre es responsable y Anamneo encargado?
- ¿Cuándo Anamneo puede ser corresponsable?
- ¿Qué cláusulas contractuales deben dejar esto claro?

### Respuesta sugerida

La configuración base debería ser:

- **clínica usuaria:** responsable del tratamiento;
- **Anamneo:** encargado del tratamiento;
- **proveedores técnicos:** subencargados.

Esto calza especialmente cuando la clínica define:

- finalidad asistencial;
- pacientes atendidos;
- profesionales autorizados;
- contenido de ficha clínica;
- reglas de acceso;
- obligaciones sanitarias;
- conservación clínica.

Anamneo puede volverse responsable o corresponsable si:

- define finalidades propias;
- usa datos para mejorar su producto sin instrucción suficiente;
- entrena modelos;
- reutiliza datos entre clínicas;
- hace analítica comercial;
- crea benchmarks;
- decide reglas esenciales de tratamiento no instruidas;
- ofrece portal directo al paciente con finalidades propias.

Cláusulas mínimas contrato Anamneo ↔ clínica:

1. roles de las partes;
2. instrucciones documentadas;
3. objeto, duración y finalidad;
4. categorías de datos;
5. categorías de titulares;
6. confidencialidad;
7. medidas de seguridad;
8. subencargados;
9. transferencias internacionales;
10. soporte y acceso administrativo;
11. asistencia en derechos del titular;
12. asistencia en DPIA;
13. notificación de brechas;
14. auditoría o evidencias de cumplimiento;
15. devolución/eliminación al terminar;
16. retención y backups;
17. prohibición de uso para finalidades propias;
18. responsabilidad e indemnidades;
19. continuidad operacional;
20. orden de prevalencia con política de privacidad y DPA.

> **Implementación en repo:** template DPA con 16 cláusulas en [`data-privacy-and-compliance.md` §6](data-privacy-and-compliance.md). El listado de 20 cláusulas del contrato Anamneo↔clínica queda como referencia para cuando se redacte el contrato comercial (fuera del alcance del repo técnico).

---

## 5.2 Documentación para fiscalización

### Pregunta

- ¿Qué documentos debe poder entregar Anamneo en 24-48 horas?

### Respuesta sugerida

Anamneo debería mantener un paquete de fiscalización versionado y accesible. Contenido mínimo:

1. política de privacidad vigente;
2. historial de versiones de política;
3. catálogo/RAT;
4. DPIA y anexos técnicos;
5. designación del DPO;
6. funciones y plan de trabajo del DPO;
7. procedimiento de derechos;
8. registro de solicitudes de titulares;
9. procedimiento de brechas;
10. registro de incidentes;
11. política de seguridad;
12. matriz de controles;
13. matriz de retención;
14. evidencia de eliminación/bloqueo;
15. plantillas de consentimiento;
16. evidencias de consentimiento;
17. DPAs con clientes;
18. DPAs con proveedores;
19. lista de subencargados;
20. evaluación de transferencias internacionales;
21. diagrama de arquitectura;
22. mapa de flujos de datos;
23. registros de capacitación;
24. auditorías o pentests;
25. bitácora de decisiones legales;
26. programa de prevención de infracciones;
27. evidencia de revisiones periódicas.

Idealmente, este paquete debe existir en dos niveles:

- **repo:** documentos versionados, plantillas, matrices y decisiones;
- **drive seguro:** contratos, evidencias firmadas, reportes confidenciales, certificaciones, tickets y anexos sensibles.

> **Implementación en repo:** la mayoría de los items 1-13, 19-22, 25-27 están en el repo o en `AuditLog`. Items 17-18, 23-24 deben mantenerse en drive seguro (contratos firmados, registros de capacitación, pentests).

---

## 5.3 Capacitación obligatoria

### Pregunta

- ¿Qué frecuencia y formato de capacitación esperan las autoridades?
- ¿Existe currículo recomendado?

### Respuesta sugerida

La ley no fija una frecuencia exacta tipo "una vez al año", pero exige responsabilidad, prevención, seguridad y formación permanente dentro del modelo de cumplimiento.

Recomendación operativa:

| Público | Frecuencia | Contenido |
|---|---|---|
| Todo el equipo | Onboarding + anual | Principios, datos sensibles, derechos, brechas, confidencialidad. |
| Personal con acceso a PHI | Onboarding antes de acceso + anual | Ficha clínica, mínimo necesario, NNA, soporte seguro. |
| Ingeniería | Onboarding + semestral | Privacy by design, logs, cifrado, dumps, producción/staging, proveedores. |
| Soporte | Onboarding + semestral | Identidad, tickets, PHI, escalamiento, comunicaciones. |
| Dirección/DPO | Anual + cambios relevantes | Riesgo, sanciones, DPIA, proveedores, fiscalización. |
| Simulacro de brecha | Al menos anual | Detección, escalamiento, comunicación, evidencia. |

Currículo mínimo:

1. principios de Ley 21.719;
2. datos personales y datos sensibles;
3. datos de salud;
4. NNA y autonomía progresiva;
5. ficha clínica y Ley 20.584;
6. secreto y confidencialidad;
7. mínimo necesario;
8. derechos ARCOP;
9. retención y supresión;
10. brechas e incidentes;
11. phishing y seguridad básica;
12. uso seguro de sistemas internos;
13. soporte sin exposición de PHI;
14. sanciones internas y regulatorias;
15. casos prácticos.

Para ingeniería, agregar:

- privacy by design;
- seudonimización;
- cifrado;
- segregación por tenant;
- control de acceso;
- logs y scrubbing de PII/PHI;
- dumps y ambientes de prueba;
- backups;
- manejo de secretos;
- revisión de proveedores;
- threat modeling básico.

> **Implementación en repo:** plan de capacitación versionado en [`plan-capacitacion-ley21719.md`](plan-capacitacion-ley21719.md).

---

# Decisiones recomendadas para convertir en issues

## Ola 0

- [x] Emitir acta/resolución interna de DPO interino. → ver [`dpo-designation-act.md`](dpo-designation-act.md)
- [ ] Contratar asesor legal con paquete cerrado + retainer.
- [ ] Definir contacto operativo legal y SLA.

## Ola 1

- [ ] Redactar política general + anexos por finalidad.
- [x] Crear matriz de bases legales. → incorporada en `data-processing-register.md` §3-ext
- [x] Crear catálogo/RAT extendido. → `data-processing-register.md`
- [x] Hacer DPIA inicial. → `dpia-2026.md`
- [x] Diseñar modelo de consentimiento granular. → schema `PatientDataProcessingConsent` + servicio
- [x] Definir flujo NNA y representantes. → `assertNNAConsentValid` + schema + UI

## Olas 2-3

- [x] Implementar procedimiento de derechos. → módulo `patient-data-rights`
- [x] Implementar procedimiento de bloqueo temporal. → `PatientNotBlockedGuard` + campos `Patient.blockedAt`
- [x] Crear matriz de retención. → `data-privacy-and-compliance.md §8`
- [x] Implementar procedimiento de brechas. → módulo `data-breach` + runbook
- [ ] Armar expediente de proveedores. → drive seguro
- [ ] Revisar DPAs Cloudflare, Sentry y SMTP.
- [x] Definir estrategia de cifrado app-level. → adjuntos, snapshots e identificatorios principales cifrados; quedan drops controlados de plaintext transitorio

## Ola 4

- [x] Implementar programa mínimo de prevención. → `programa-prevencion-infracciones.md`
- [x] Crear plan anual de capacitación. → `plan-capacitacion-ley21719.md`
- [ ] Ejecutar simulacro de brecha. → drill stub creado, ejecución pendiente
- [ ] Preparar paquete de fiscalización. → mayoría en repo; drive seguro pendiente
- [ ] Evaluar certificación cuando la Agencia publique criterios.

---

## Pendientes derivados de estas respuestas (issues técnicos detectados)

1. **Plazo de bloqueo: corregir de 3 a 2 días hábiles** en `operational-procedures-data-rights.md` y en cualquier UI/documentación que mencione el plazo. ✅ Aplicado.
2. **Plazo de purga: contar desde "última atención" no desde `archivedAt`**. ✅ Aplicado: el servicio calcula la fecha relevante con la atención más reciente.
3. **Política como general + anexos**. ✅ Aplicado en `backend/prisma/seed.ts`; falta texto final validado.
4. **Schema de consentimiento extendido**. ✅ Aplicado en `PatientDataProcessingConsent`.
5. **Plantilla de notificación de brecha extendida**. ✅ Aplicado: `MailService.sendBreachNotificationToSubject` cubre los 11 elementos mínimos con fallbacks.
6. **Bitácora de decisiones**. ✅ Aplicado: `docs/bitacora-decisiones-cumplimiento.md`.
7. **Validar cifrado app-level de identificatorios del paciente**. ✅ Aplicado para identificatorios principales; quedan drops de plaintext transitorio D/E/F bajo ventana controlada.

---

## Bitácora de respuestas validadas

> Cuando el asesor legal externo emita opinión formal sobre cada sección, anotar aquí.

| Fecha | Sección | Decisión legal | Validado por | Deliverable |
|---|---|---|---|---|
| _pendiente primera validación legal_ | — | — | — | — |
