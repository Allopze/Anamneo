# Privacidad de Datos y Compliance — Anamneo

Este documento describe dos modos de uso posibles de Anamneo:

1. **Modo personal/estudio**, que es el alcance actual: app privada para
   practicar anamnesis y razonamiento clínico con casos ficticios o
   anonimizados, sin explotación comercial ni operación clínica.
2. **Modo clínico/productivo**, que es una posibilidad futura: operación con
   datos reales identificables de pacientes en Chile bajo la **Ley 21.719**
   (vigencia plena el 01-DIC-2026) y normativa sanitaria aplicable.

> Este es un marco operativo, no asesoría legal. Antes de procesar PHI real
> en producción, se debe completar el roadmap de cumplimiento documentado
> en [ADR-002](architecture-decisions/002-ley-21719-compliance.md) y pasar
> el Gate Go/No-Go documentado en `/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`.

> Para el modo personal/estudio, la regla principal es no ingresar datos
> reales identificables de pacientes. Usar datos ficticios o anonimización
> robusta es más importante que simular una estructura formal de DPO,
> contratos, DPIA y fiscalización.

**Estado al 2026-05-24:** este documento se actualizó tras la auditoría
integral contra el texto oficial de la Ley 21.719 y las iteraciones técnicas
posteriores (ver
[`audits/ley-21719-chile-audit-2026-05-23.md`](audits/ley-21719-chile-audit-2026-05-23.md)).
Cita correctamente los artículos vigentes y refleja la implementación real
del repo (no la planificada).

---

## 1. Marco regulatorio aplicable

### 1.0 Lectura práctica según alcance

- En **modo personal/estudio**, Anamneo no debe contener datos que permitan
  identificar a pacientes reales. El foco es minimización, acceso privado,
  borrado periódico y no enviar información clínica a terceros.
- En **modo clínico/productivo**, todo lo restante de este documento aplica
  como checklist de preparación antes de operar con PHI real.
- Si un caso clínico fue tomado de una práctica, hospital, universidad o
  ficha real, debe transformarse antes de ingresarlo: cambiar identificadores,
  fechas, lugares, eventos únicos y cualquier combinación que permita
  reidentificación.

- **Ley 21.719 (2024) sobre Protección y Tratamiento de los Datos Personales
  y crea la Agencia de Protección de Datos Personales** — vigencia plena el
  **1 de diciembre de 2026**. Sustituye y refunde la Ley 19.628. Introduce:
  - Derechos del titular del Art 4 (acceso, rectificación, supresión,
    oposición, portabilidad, bloqueo). Esta ley NO usa el término "ARCO+";
    referirse al catálogo del Art 4 por su nombre legal.
  - Figura del Delegado de Protección de Datos (DPO, Art 50).
  - Registro de Actividades de Tratamiento (acreditación Art 3 e).
  - Evaluación de Impacto en Protección de Datos / DPIA (Art 15 ter,
    obligatoria para datos sensibles bajo excepción del consentimiento).
  - Régimen sancionatorio (Art 34-38) con multas hasta 20.000 UTM por
    infracción gravísima.
- **Ley 20.584 (2012) sobre Derechos y Deberes de las Personas en su
  Atención de Salud** — regula la ficha clínica como categoría sanitaria
  con reglas propias de conservación, acceso y entrega.
- **Código Sanitario (DFL 725)** — secreto médico aplicable a la
  información clínica registrada.
- **Normas técnicas MINSAL y FONASA** — fijan plazos específicos de
  retención de fichas clínicas (sujeto a revisión legal específica).

Como buena práctica complementaria se siguen, sin afirmar cumplimiento
formal, los principios de minimización, integridad/confidencialidad y
limitación de finalidad de **GDPR Art. 5**.

---

## 2. Categorías de datos tratados

| Categoría | Sensibilidad | Ejemplos en Anamneo |
|---|---|---|
| Datos identificatorios | Alta | `Patient.rutEnc`, `Patient.nombreEnc`, `Patient.emailEnc`, `Patient.telefonoEnc`, `Patient.domicilioEnc` + `rutLookupHash` |
| Datos demográficos | Media | `Patient.sexo`, `Patient.fechaNacimiento`, `Patient.edad`, `Patient.prevision`, `Patient.trabajo` |
| Datos de salud (PHI) | **Crítica** | `PatientHistory`, `EncounterSection.data`, `EncounterDiagnosis`, `EncounterTreatment`, `PatientProblem`, `ClinicalAlert`, `ClinicalConsent`, `Attachment` |
| Datos de contacto de emergencia | Alta | `Patient.contactoEmergenciaNombreEnc`, `Patient.contactoEmergenciaTelefonoEnc` |
| Datos de representante legal (NNA) | Alta | `Patient.legalRepresentative*Enc` + `legalRepresentativeRutLookupHash` |
| Datos de personal sanitario | Media | `User.email`, `User.nombre`, `User.role`, sesiones, logs de auditoría |
| Telemetría | Baja | `AuditLog` (con `requestId`, `userId`, `entityId`), logs HTTP |

Anamneo **no** trata por defecto datos de pago, datos biométricos
(huellas/iris), datos genéticos brutos, ni datos de geolocalización.

Anamneo trata datos de menores de edad en contexto clínico. La Ley 21.719
Art 16 quáter exige consentimiento de padres o representante legal para
menores de 14 años, y para datos sensibles de menores de 16 años.
El backend aplica un criterio conservador en `PatientConsentsService`: para
menores de 16 años, el consentimiento de datos sensibles no puede quedar
firmado como `TITULAR`. La UI de creación/edición de pacientes ya captura
representante legal cuando corresponde; queda pendiente validar formalmente
con asesor legal el criterio exacto de vínculo y autonomía progresiva.

---

## 3. Finalidades y bases de tratamiento

| Finalidad | Base legítima (Ley 21.719) |
|---|---|
| Registro y gestión de fichas clínicas | Art 16 lit e (medicina preventiva/laboral, diagnóstico, asistencia sanitaria) + ley sanitaria especial (pendiente: anclar a Ley 20.584 + norma MINSAL específica) |
| Auditoría interna y trazabilidad | Art 13 lit b (cumplimiento de obligación legal) + obligación del Art 14 quinquies (medidas de seguridad) |
| Generación de documentos clínicos (recetas, órdenes, derivaciones) | Art 16 lit e + Ley 20.584 |
| Envío de correos transaccionales (invitaciones a personal) | Art 13 lit d (interés legítimo) |
| Monitoreo técnico (Sentry, logs HTTP) | Art 13 lit d (interés legítimo) + minimización (PHI scrubeada antes de enviar) |
| Estadística/analítica clínica | Art 16 quinquies (fines estadísticos/científicos de interés público) + anonimización previa |

No se realiza tratamiento con fines de marketing, perfilamiento publicitario
ni cesión comercial a terceros.

**Pendiente para producción:** anclar formalmente cada base legal a la ley
sanitaria especial chilena que la ampara. Ver
[`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §2.

---

## 4. Técnicas de protección implementadas

| Control | Implementación |
|---|---|
| Autenticación fuerte | bcrypt cost 12, JWT por cookie HttpOnly SameSite=strict, 2FA TOTP opcional con recovery codes, lockout persistente tras 5 intentos |
| Autorización | Guards NestJS (`JwtAuthGuard`, `RolesGuard`, `AdminGuard`) + scope por médico efectivo (`getEffectiveMedicoId`) |
| Cifrado en tránsito | HTTPS obligatorio en producción vía cloudflared |
| Cifrado en reposo | Disco con LUKS/dm-crypt (confirmado por `ENCRYPTION_AT_REST_CONFIRMED`) + cifrado app-level AES-256-GCM para secciones clínicas, identificatorios del paciente, adjuntos, snapshots regulatorios y entregas DSAR (`ENCRYPTION_KEY`, obligatoria en prod) + cifrado app-level para settings secretos (`SETTINGS_ENCRYPTION_KEY`) |
| Cifrado app-level pendiente | No hay columnas plaintext transitorias activas en `Patient`, firmantes de consentimiento ni solicitantes DSAR. Queda como mejora futura evaluar cifrado de metadatos forenses adicionales si la DPIA lo pide. |
| Auditoría | `AuditLog` con cadena de hashes SHA-256 (`integrityHash`/`previousHash`), serializada para concurrencia. Eventos READ también registrados sobre PHI. |
| Minimización en logs/Sentry | Scrubbing de RUT, email, secuencias de 8+ dígitos en `instrument.ts` antes de enviar a Sentry |
| Retención | Backups Postgres rotables; logs de Docker rotables según configuración del host |
| Aislamiento | Modelo single-clinic (`ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`). Una instancia = una clínica = una base de datos. |
| Adjuntos | Validación magic-bytes (PDF/JPEG/PNG/GIF), tamaño máximo configurable, cifrado app-level at-upload con `Attachment.encryptionEnvelope`, descarga descifrada en memoria, soft-delete con retención. AV scan opcional vía ClamAV (queda `SKIPPED` si no hay host/puerto). |

---

## 5. Derechos del titular (Art 4-11 Ley 21.719)

> **Estado actual:** existe UI pública `/derechos`, entidad
> `PatientDataRequest`, bandeja admin `/admin/solicitudes` y entrega segura
> por enlace temporal `/descargar-ficha?token=...`. Los endpoints regulatorios
> (`GET /api/patients/:id/export/regulatory` y `DELETE /api/patients/:id/purge`)
> siguen siendo admin-only.

### 5.1 Acceso (Art 5)

El titular puede solicitar copia de sus datos a la clínica. El admin
debe:
1. Verificar identidad del solicitante (presencial o RUT + medio de
   contacto registrado).
2. Vincular la solicitud pública a un `Patient` y registrar método/evidencia
   de verificación en `/admin/solicitudes`.
3. Generar enlace temporal vía `POST /api/admin/data-requests/:id/export-link`.
   El ZIP queda cifrado en `runtime/data/data-requests/` cuando
   `ENCRYPTION_KEY` está configurada.
4. La descarga exige RUT, vence en 72 horas, permite máximo 3 descargas y queda
   registrada con razones `PATIENT_DATA_REQUEST_EXPORT_*`.
5. Responder en un plazo no superior a **30 días corridos** (Art 11),
   prorrogable por otros 30 días corridos por una sola vez.

### 5.2 Rectificación (Art 6)

Realizar la edición en `Pacientes > [paciente] > Editar`. La edición
queda registrada en `AuditLog` con diff completo. Cuando los datos
hayan sido comunicados a terceros, el responsable debe notificar la
rectificación a esos destinatarios salvo que sea imposible o exija
esfuerzo desproporcionado.

### 5.3 Supresión (Art 7)

1. **Soft delete** inmediato vía `Pacientes > [paciente] > Archivar`.
   El paciente deja de aparecer en listados activos pero la información
   se conserva por motivos de auditoría sanitaria.
2. **Purga regulatoria** (borrado físico): disponible vía
   `DELETE /api/patients/:id/purge` con confirmación
   `PURGE-REGULATORY`, justificación ≥16 caracteres y respeto a la
   retención mínima configurable
   (`PATIENT_PURGE_MIN_AGE_DAYS`, default 5475 días = 15 años desde la
   fecha más reciente entre archivo y última atención relevante).
   Implementado en
   [`backend/src/patients/patients-regulatory-purge.service.ts`](../backend/src/patients/patients-regulatory-purge.service.ts).
   Antes de la eliminación física se genera un snapshot del bundle
   regulatorio para retención sanitaria.

   **Excepciones del Art 7** (la supresión NO procede): ejercicio de
   libertades de informar, obligación legal, función pública,
   **interés público en salud pública**, fines históricos/estadísticos
   /científicos, formulación o defensa de reclamación.

### 5.4 Oposición (Art 8)

El titular puede oponerse a tratamientos basados en interés legítimo,
marketing (no aplica a Anamneo) o cuando los datos provengan de
fuentes públicas. El campo `Patient.processingObjections` existe; queda
pendiente validar legalmente qué finalidades opcionales deben bloquearse
siempre frente a oposición. Las finalidades clínicas necesarias no deberían
depender exclusivamente de consentimiento ni oposición.

### 5.5 Bloqueo temporal (Art 8 ter)

El titular puede solicitar suspensión temporal del tratamiento mientras
se resuelve una solicitud de rectificación, supresión u oposición.
Plazo de resolución del bloqueo por el responsable: **2 días hábiles**. (Los 3 días hábiles del Art 41 inciso final aplican a la resolución de la Agencia en ciertos escenarios, no al plazo ordinario del responsable.)
El campo `Patient.blockedAt` y `PatientNotBlockedGuard` existen; el guard
está aplicado en las superficies clínicas principales (`encounters` y
`attachments`) y existen endpoints admin dedicados para bloqueo/desbloqueo
con razón obligatoria. Nuevas mutaciones clínicas deben incorporar el guard
antes de salir a producción.

### 5.6 Portabilidad (Art 9)

Entregar el archivo JSON+adjuntos generado por el procedimiento §5.1.
Aplica cuando el tratamiento es automatizado y basado en
consentimiento.

### 5.7 Decisiones automatizadas (Art 8 bis)

Anamneo **no** realiza decisiones automatizadas con efectos jurídicos
ni perfilamiento. Si en el futuro se incorpora IA clínica o triage
automatizado, deberá implementarse derecho a explicación,
intervención humana, expresión del punto de vista y revisión.

---

## 6. Anexo: DPA mínimo (Acuerdo de Tratamiento de Datos)

Este es un **template referencial**. Validar con asesor jurídico antes de
firmarlo con una clínica o un proveedor de infraestructura.
**La Ola 3 del roadmap incluye la firma definitiva con cada subencargado
real (Cloudflare, Sentry, SMTP).**

```text
ENTRE:
  [Clínica usuaria] (Responsable del Tratamiento)
Y:
  [Operador técnico de la instancia] (Encargado del Tratamiento)

OBJETO:
  Tratamiento de datos personales y de salud bajo Ley 21.719,
  en el contexto del uso del sistema Anamneo.

ALCANCE:
  - Single-clinic, base PostgreSQL aislada, volúmenes
    `runtime/data` y `runtime/uploads` exclusivos.
  - Sin cesión a terceros, salvo subencargados expresamente listados
    (cloudflare/cloudflared, sentry, smtp provider).

CLAUSULAS MINIMAS (Art 15 bis Ley 21.719 + recomendaciones legales
recogidas en docs/respuestas-borrador-ley21719.md §3.4 / §5.1):

  1. Objeto del tratamiento.
  2. Duración del contrato y del tratamiento.
  3. Naturaleza y finalidad del tratamiento.
  4. Tipo de datos personales tratados.
  5. Categorías de titulares.
  6. Instrucciones documentadas del responsable al encargado.
  7. Confidencialidad del personal del encargado (subsiste tras
     terminación; obligación equivalente al Art 14 bis del responsable).
  8. Medidas de seguridad técnicas y organizativas conforme al
     Art 14 quinquies (cifrado, seudonimización, resiliencia,
     verificación regular).
  9. Régimen de subencargados: autorización previa por escrito,
     contrato espejo, responsabilidad solidaria del encargado por las
     infracciones del subencargado autorizado.
  10. Transferencias internacionales: identificación del país,
      mecanismo de garantía (cláusulas modelo, país adecuado, normas
      corporativas vinculantes o excepción), evaluación de transferencia.
  11. Asistencia al responsable en el ejercicio de los derechos del
      titular (Arts 4-11): proporcionar la información y mecanismos
      necesarios para acceso, rectificación, supresión, oposición,
      portabilidad y bloqueo dentro de los plazos legales.
  12. Asistencia al responsable en DPIA (Art 15 ter) y consultas previas
      a la Agencia cuando aplique.
  13. Notificación de brechas: el encargado avisa al responsable sin
      dilaciones indebidas (Art 14 sexies) con la información mínima
      para que el responsable decida reporte a la Agencia y notificación
      a titulares; tope orientativo: dentro de las 24 horas siguientes
      a la detección.
  14. Auditoría y evidencias: el encargado pone a disposición la
      información necesaria para demostrar cumplimiento (certificaciones
      SOC 2 / ISO 27001 cuando existan, reportes, configuración
      técnica) y permite auditorías por el responsable o un tercero
      designado, con preaviso razonable.
  15. Devolución o supresión segura de los datos al término del
      contrato; certificación escrita de destrucción.
  16. Prohibición expresa de uso de los datos para finalidades propias
      del encargado distintas a las instruidas por el responsable
      (no entrenamiento de modelos, no analítica comercial, no
      benchmarking entre clientes, no cesión a terceros).

CLAUSULAS RECOMENDADAS ADICIONALES (no estrictamente exigidas por la
ley pero recomendadas):

  17. Notificación previa de cambios relevantes (rotación de
      subencargados, cambio de país de tratamiento, cambio
      significativo de medidas de seguridad).
  18. SLA de cumplimiento operativo (tiempos de respuesta para
      solicitudes del responsable, soporte, escalamiento).
  19. Régimen de responsabilidad e indemnidades por incumplimiento.
  20. Continuidad operacional (backups, restore, exit plan).

DURACION: [vigencia]
SUBENCARGADOS AUTORIZADOS: [lista — Cloudflare, Sentry, SMTP, hosting]
FECHA: [...]
```

---

## 7. Procedimientos operativos

### 7.1 Exportar datos regulatorios de un paciente

**Endpoint disponible:**
`GET /api/patients/:id/export/regulatory` (admin-only,
`JwtAuthGuard + AdminGuard`).

Implementación:
[`backend/src/patients/patients-regulatory.controller.ts`](../backend/src/patients/patients-regulatory.controller.ts)
y
[`backend/src/patients/patients-regulatory-export.service.ts`](../backend/src/patients/patients-regulatory-export.service.ts).

El endpoint devuelve un ZIP con:
- `data.json` con paciente, historial, encuentros, secciones clínicas
  descifradas, diagnósticos, tratamientos, consentimientos, alertas y
  AuditLog asociado.
- Adjuntos en sus rutas relativas.

Auditoría automática con razón `PATIENT_DATA_EXPORTED_REGULATORY`.

### 7.2 Borrado regulatorio (purga física)

**Endpoint disponible:**
`DELETE /api/patients/:id/purge` (admin-only).

Body requerido:
```json
{
  "confirmation": "PURGE-REGULATORY",
  "justification": "texto >= 16 caracteres",
  "bypassRetention": "false"
}
```

Implementación:
[`backend/src/patients/patients-regulatory-purge.service.ts`](../backend/src/patients/patients-regulatory-purge.service.ts).

Flujo:
1. Valida que el paciente esté archivado (soft-deleted) previamente.
2. Valida retención (default 15 años desde la fecha más reciente entre
   archivo y última atención relevante, vía `PATIENT_PURGE_MIN_AGE_DAYS`).
3. Genera snapshot regulatorio defensivo en `runtime/data/purges/`.
   Cuando `ENCRYPTION_KEY` está configurada, el ZIP se persiste cifrado
   como `.enc` junto a su `envelope.json`; en dev/test sin clave puede
   persistirse en claro con warning.
4. Registra evento `PATIENT_RECORD_PURGED_REGULATORY` en `AuditLog`
   con cadena de integridad.
5. Cascade delete sobre `Patient` y todas sus relaciones.

> El plazo de retención de 15 años se basa en práctica habitual del
> sector salud chileno, pero NO está respaldado por una norma
> específica única. Revisión legal pendiente — ver
> [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §3.

### 7.3 Reporte de incidentes y brechas (Art 14 sexies)

El Art 14 sexies de la Ley 21.719 obliga a reportar a la Agencia
**sin dilaciones indebidas** cuando exista **riesgo razonable** para
los derechos y libertades de los titulares. Cuando la vulneración
involucre **datos sensibles** (caso aplicable siempre a Anamneo),
**datos de menores de 14 años**, o **datos financieros**, también
debe comunicarse a los titulares afectados en lenguaje claro y
sencillo.

> **El plazo legal NO es 72 horas** (eso es estándar GDPR). La Ley
> 21.719 usa el criterio cualitativo "sin dilaciones indebidas". Una
> política interna puede fijarse un objetivo de 72h como buena
> práctica.

| Severidad interna | Definición | Acción interna |
|---|---|---|
| **Crítico** | Fuga confirmada de PHI o credenciales | Reporte a la Agencia + notificación a titulares afectados |
| **Alto** | Acceso no autorizado sin fuga confirmada | Evaluación de "riesgo razonable" + decisión documentada |
| **Medio** | Indisponibilidad >4h o backup fallido consecutivo >24h | Registro interno + análisis post-mortem |
| **Bajo** | Incidente cubierto por runbook estándar | Registro en `AuditLog`/Sentry |

Flujo operativo específico: ver
[`incident-runbook-data-breach.md`](incident-runbook-data-breach.md).
La entidad `DataBreachIncident`, los endpoints admin y la plantilla de
notificación a titulares ya existen. Queda pendiente ejecutar un drill
cronometrado en staging/producción y completar el canal formal de reporte
a la Agencia cuando esté operativo.

---

## 8. Retención y disposición

| Dato | Retención por defecto | Justificación |
|---|---|---|
| Ficha clínica (encounters, sections) | 15 años post última atención (pendiente validación legal sanitaria específica) | Práctica del sector salud chileno; norma específica por revisar |
| Datos de contacto del paciente | Vida útil de la relación + retención clínica | Acceso a la ficha |
| `AuditLog` | Indefinido en single-clinic | Integridad de cadena de hashes; prescripción de infracciones Art 40 (4 años) |
| Backups Postgres | Política de host (ej. 14 días rotando) | Recuperación operativa |
| Logs HTTP/stdout | Política del host (recomendado ≥90 días) | Forensics |
| Sesiones (`UserSession`) | Hasta revocación o expiración del refresh (7 días default) | Continuidad |
| Invitaciones (`UserInvitation`) | TTL definido + 30 días post-uso | Auditoría |
| `PasswordResetToken` | TTL definido + retención de auditoría | Forensics y prevención de abuso |
| Snapshots regulatorios pre-purge | Mismo plazo que la ficha clínica original | Evidencia ante revisión |

**Pendiente:** matriz de retención validada por asesor legal por cada
categoría. Ver [`preguntas-abogado-ley21719.md`](preguntas-abogado-ley21719.md) §3.

---

## 9. Roles y responsables

| Rol | Responsabilidad |
|---|---|
| **Delegado de Protección de Datos (DPO)** — *Alejandro López Zelaya `<allopze@gmail.com>`* (interino al 2026-05-23 durante el roadmap de cumplimiento; ver [ADR-002](architecture-decisions/002-ley-21719-compliance.md)) | Validar este documento, aprobar borrados regulatorios, recibir solicitudes de titulares, escalar incidentes, supervisar el cumplimiento de la Ley 21.719 Art 50. |
| Administrador técnico | Operar la instancia, ejecutar backups/drills, aplicar parches, gestionar accesos |
| Médico/a tratante | Decidir sobre consentimientos clínicos, registro de fichas, retención clínica |
| Asistente | Apoyo administrativo bajo permiso explícito por médico responsable |
| Responsable del tratamiento | La clínica usuaria que decide finalidades y medios |
| Encargado del tratamiento | El operador técnico de la instancia (Art 15 bis) |

---

## 10. Brechas conocidas y plan de cierre

Esta tabla resume el estado. El detalle, secuencia y dependencias está
en el roadmap aprobado:
[`/home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md`](../../.claude/plans/crea-un-plan-para-logical-hearth.md).

| Brecha | Estado | Ola del roadmap |
|---|---|---|
| Política de privacidad seeded marcada "no apta para producción" | Bloqueada en `NODE_ENV=production`; estructura modular general + anexos lista, texto final legal pendiente | Ola 1 |
| Política v1.0 con 12 elementos Art 14 ter | Borrador estructural listo; pendiente texto/firma/publicación legal | Ola 1 |
| Modelo de consentimiento del titular separado del clínico (Art 12) | Implementado vía `PatientDataProcessingConsent`; activar enforcement hard depende de política final y backfill operativo | Ola 1 |
| Registro de Actividades de Tratamiento (Art 14 ter, Art 3 e) | Borrador estructural creado; pendiente validación/firma | Ola 1 |
| DPIA formal (Art 15 ter) | Borrador estructural creado; pendiente validación/firma | Ola 1 → Ola 4 |
| Designación formal de DPO (Art 50) | Acta borrador creada; firma de máxima autoridad pendiente | Ola 0 / Ola 1 |
| Entidad `PatientDataRequest` para Arts 4-11 | Implementado | Ola 2 |
| Derecho de bloqueo temporal (Art 8 ter) | Implementado en backend/UI admin para superficies principales; ampliar en nuevas mutaciones | Ola 2 |
| Derecho de oposición / opt-out a analítica (Art 8) | Schema implementado y analítica interna excluye pacientes con `ANALITICA_INTERNA=true`; falta matriz legal final de finalidades opcionales | Ola 2 |
| Tratamiento diferenciado de NNA (Art 16 quáter) | Schema/UI/backend implementados con criterio conservador; validación legal pendiente | Ola 1 + Ola 3 |
| Cifrado app-level adicional (RUT, email, adjuntos, snapshots) | Implementado para identificatorios Patient, adjuntos, snapshots, entregas DSAR, firmantes y solicitantes DSAR; fases de drop plaintext C-F ya movidas a migraciones activas | Ola 3 |
| Procedimiento de brechas alineado al Art 14 sexies + entidad `DataBreachIncident` | Implementado; falta validación legal, canal Agencia y drill | Ola 3 |
| DPAs firmados con subencargados (Cloudflare, Sentry, SMTP) | Pendiente | Ola 3 |
| Inventario de transferencias internacionales (Arts 27-28) | Borrador RAT creado; falta confirmar proveedor/país/DPA real | Ola 3 |
| Programa de prevención de infracciones (Art 48) | Borrador creado; falta ejecutar capacitación, sanciones internas y revisiones | Ola 3 |
| Modelo voluntario de cumplimiento + certificación (Art 49, Art 51) | Borrador creado; certificación futura dependiente de Agencia/reglamentos | Ola 4 |
| UI pública de derechos del titular | Implementado | Ola 2 |
| Plantillas de comunicación (acuse, rechazo, brecha) | Implementadas; revisar texto final con abogado | Olas 2-3 |
| Drills (acceso end-to-end, brecha cronometrada, restore) | Pendiente | Ola 4 |
