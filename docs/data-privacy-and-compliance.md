# Privacidad de Datos y Compliance — Anamneo

Este documento describe como Anamneo trata datos personales y datos sensibles
de salud (PHI/datos clinicos) de pacientes, y los procedimientos minimos
exigibles antes de operar con datos reales en Chile.

> Esto es un marco operativo, no asesoria legal. Antes de procesar PHI real
> en produccion, la clinica usuaria debe:
> 1. Validar este documento con su asesor juridico.
> 2. Firmar un acuerdo de tratamiento de datos (DPA) con el operador
>    tecnico de la instancia (vease anexo §6).
> 3. Publicar su propia version de la **Politica de Privacidad** en
>    `/politica-de-privacidad` (formato versionable, ver `LegalDocument`).

---

## 1. Marco regulatorio aplicable

- **Ley 19.628 (1999) sobre Proteccion de la Vida Privada** — vigente; rige
  el tratamiento de datos personales y datos sensibles en Chile.
- **Ley 21.719 (2024) sobre Proteccion de Datos Personales** — entra en
  vigencia plena en **diciembre 2026**, introduce derechos ARCO+ (acceso,
  rectificacion, cancelacion, oposicion, portabilidad), figura del
  Encargado de Proteccion de Datos, registro de actividades de tratamiento
  y sanciones administrativas relevantes.
- Codigo Sanitario chileno (DFL 725) — secreto medico aplicable a la
  informacion clinica registrada.

Como buena practica complementaria se siguen, sin afirmar cumplimiento
formal, los principios de minimizacion, integridad/confidencialidad y
limitacion de finalidad de **GDPR Art. 5**.

---

## 2. Categorias de datos tratados

| Categoria | Sensibilidad | Ejemplos en Anamneo |
|---|---|---|
| Datos identificatorios | Alta | `Patient.rut`, `Patient.nombre`, `Patient.email`, `Patient.telefono`, `Patient.domicilio` |
| Datos demograficos | Media | `Patient.sexo`, `Patient.fechaNacimiento`, `Patient.edad`, `Patient.prevision`, `Patient.trabajo` |
| Datos de salud (PHI) | **Critica** | `PatientHistory`, `EncounterSection.data`, `EncounterDiagnosis`, `EncounterTreatment`, `PatientProblem`, `ClinicalAlert`, `InformedConsent`, `Attachment` |
| Datos de contacto de emergencia | Alta | `Patient.contactoEmergencia*` |
| Datos de personal sanitario | Media | `User.email`, `User.nombre`, `User.role`, sesiones, logs de auditoria |
| Telemetria | Baja | `AuditLog` (con `requestId`, `userId`, `entityId`), logs HTTP |

Anamneo **no** trata por defecto datos de pago, datos biometricos
(huellas/iris), datos geneticos brutos, ni datos de menores fuera del
contexto clinico delegado al medico responsable.

---

## 3. Finalidades y bases de tratamiento

| Finalidad | Base legitima |
|---|---|
| Registro y gestion de fichas clinicas | Consentimiento del paciente + ejercicio de la profesion sanitaria |
| Auditoria interna y trazabilidad | Obligacion legal del prestador (secreto profesional / Ley 21.719 reg. actividades) |
| Generacion de documentos clinicos (recetas, ordenes, derivaciones) | Consentimiento + finalidad del acto medico |
| Envio de correos transaccionales (invitaciones a personal) | Interes legitimo del operador |
| Monitoreo tecnico (Sentry, logs HTTP) | Interes legitimo + minimizacion (PHI scrubeada antes de enviar) |
| Estadistica/analitica clinica | Consentimiento + datos disociados/agregados |

No se realiza tratamiento con fines de marketing, perfilamiento publicitario
ni cesion comercial a terceros.

---

## 4. Tecnicas de proteccion implementadas

| Control | Implementacion |
|---|---|
| Autenticacion fuerte | bcrypt cost 12, JWT por cookie HttpOnly SameSite=strict, 2FA TOTP opcional con recovery codes, lockout persistente tras 5 intentos |
| Autorizacion | Guards NestJS (`JwtAuthGuard`, `RolesGuard`, `AdminGuard`) + scope por medico efectivo (`getEffectiveMedicoId`) |
| Cifrado en transito | HTTPS obligatorio en produccion via cloudflared |
| Cifrado en reposo | Disco con LUKS/dm-crypt (confirmado por `ENCRYPTION_AT_REST_CONFIRMED`) + cifrado app-level AES-256-GCM para secciones clinicas (`ENCRYPTION_KEY`, obligatoria en prod) + cifrado app-level para settings secretos (`SETTINGS_ENCRYPTION_KEY`) |
| Auditoria | `AuditLog` con cadena de hashes SHA-256 (`integrityHash`/`previousHash`), serializada para concurrencia. Eventos READ tambien registrados sobre PHI. |
| Minimizacion en logs/Sentry | Scrubbing de RUT, email, secuencias de 8+ digitos en `instrument.ts` antes de enviar a Sentry |
| Retencion | Backups SQLite con `SQLITE_BACKUP_RETENTION_DAYS=14` por defecto; logs de Docker rotables segun configuracion del host |
| Aislamiento | Modelo single-clinic (`ANAMNEO_DEPLOYMENT_SCOPE=single-clinic`). Una instancia = una clinica = una base de datos. |
| Adjuntos | Validacion magic-bytes (PDF/JPEG/PNG/GIF), tamano maximo configurable, soft-delete con retencion |

---

## 5. Derechos de los titulares

> A la fecha de redaccion, Anamneo **no** expone aun endpoints
> auto-servicio para titulares. Los siguientes procedimientos son
> **manuales y administrados** mediante un rol `ADMIN`.

### 5.1 Acceso (Art. 13 Ley 21.719)

El paciente puede solicitar copia de sus datos a la clinica. El admin
debe:
1. Verificar identidad del solicitante (presencial o RUT + medio de
   contacto registrado).
2. Generar exportacion via interfaz `Pacientes > [paciente] > Exportar`
   (proximamente) o ejecutando el comando documentado en §7.1.
3. Entregar el archivo de forma segura (correo cifrado o entrega
   presencial).
4. Registrar la accion en `AuditLog` (ya automatico para acciones
   admin).
5. Responder en un plazo no superior a **30 dias corridos**.

### 5.2 Rectificacion

Realizar la edicion en `Pacientes > [paciente] > Editar`. La edicion
queda registrada en `AuditLog` con diff completo.

### 5.3 Cancelacion / borrado

1. Soft delete inmediato via `Pacientes > [paciente] > Archivar`. El
   paciente deja de aparecer en listados activos pero la informacion
   se conserva por motivos de auditoria sanitaria (codigo sanitario).
2. **Borrado fisico**: solo procedente cuando ha vencido la obligacion
   legal de conservacion clinica (≥ 15 anos por defecto en Chile, salvo
   regulacion especifica). Ejecutarlo via script bajo confirmacion del
   `Encargado de Proteccion de Datos` y registrarlo en `AuditLog` con
   reason `PATIENT_RECORD_PURGED_REGULATORY` (pendiente de
   implementar).

### 5.4 Oposicion al tratamiento

El paciente puede oponerse al tratamiento estadistico no esencial.
Configurar el flag `Patient.statisticsOptOut` (pendiente de implementar
en schema; documentado para v2).

### 5.5 Portabilidad

Entregar el archivo CSV/JSON generado por el procedimiento §5.1.

---

## 6. Anexo: DPA minimo (Acuerdo de Tratamiento de Datos)

Este es un **template referencial**. Validar con asesor juridico antes de
firmarlo con una clinica o un proveedor de infraestructura.

```text
ENTRE:
  [Clinica usuaria] (Responsable del Tratamiento)
Y:
  [Operador tecnico de la instancia] (Encargado del Tratamiento)

OBJETO:
  Tratamiento de datos personales y de salud bajo Ley 19.628 y Ley
  21.719, en el contexto del uso del sistema Anamneo.

ALCANCE:
  - Single-clinic, base SQLite/PostgreSQL aislada, volumenes
    `runtime/data` y `runtime/uploads` exclusivos.
  - Sin cesion a terceros, salvo subencargados expresamente listados
    (cloudflare/cloudflared, sentry, smtp provider).

OBLIGACIONES DEL ENCARGADO:
  - Cumplir las medidas tecnicas descritas en §4 de
    `docs/data-privacy-and-compliance.md`.
  - Notificar incidentes de seguridad en un plazo no superior a 72h.
  - Permitir auditoria por el Responsable con preaviso de 15 dias.
  - Entregar o destruir los datos al finalizar el contrato.

DURACION: [vigencia]
SUBENCARGADOS AUTORIZADOS: [lista]
FECHA: [...]
```

---

## 7. Procedimientos operativos

### 7.1 Exportar datos de un paciente (manual, hasta tener endpoint)

> Pendiente implementacion de endpoint admin formal. Procedimiento
> intermedio:

```bash
# 1. Identificar el paciente
docker compose exec backend sqlite3 /app/data/anamneo.db \
  "SELECT id, nombre, rut FROM patients WHERE rut = '<rut>';"

# 2. Exportar tablas relevantes
PATIENT_ID="<uuid>"
docker compose exec backend sqlite3 /app/data/anamneo.db <<EOF
.mode json
.output /app/data/exports/${PATIENT_ID}.json
SELECT * FROM patients WHERE id = '${PATIENT_ID}';
SELECT * FROM patient_histories WHERE patient_id = '${PATIENT_ID}';
SELECT * FROM encounters WHERE patient_id = '${PATIENT_ID}';
SELECT * FROM encounter_sections WHERE encounter_id IN
  (SELECT id FROM encounters WHERE patient_id = '${PATIENT_ID}');
SELECT * FROM informed_consents WHERE patient_id = '${PATIENT_ID}';
SELECT * FROM clinical_alerts WHERE patient_id = '${PATIENT_ID}';
SELECT * FROM attachments
  WHERE encounter_id IN (SELECT id FROM encounters WHERE patient_id = '${PATIENT_ID}');
EOF

# 3. Las secciones cifradas (EncounterSection.data con prefijo enc:v1:)
#    requieren descifrado usando ENCRYPTION_KEY antes de entregar.
#    Implementar un script `npm run patient:export -- --id=<uuid>` (PENDIENTE).

# 4. Registrar la accion
docker compose exec backend node -e "console.log('TODO: log PATIENT_DATA_EXPORTED audit event')"
```

### 7.2 Borrado regulatorio (purge fisico)

Solo cuando vencio el plazo legal de conservacion clinica.

```bash
# 1. Backup pre-purge obligatorio
docker compose run --rm backend node /app/scripts/sqlite-backup.js

# 2. Soft-delete previo si no esta ya archivado
# (Usar UI admin)

# 3. Purge fisico (PENDIENTE script `db:purge-patient --id=<uuid> --confirm=YES`)
# Por ahora: requiere ticket interno aprobado por DPO y aplicar via
# script ad-hoc bajo `sqlite3` + INSERT en AuditLog manual.
```

### 7.3 Reporte de incidentes

| Severidad | Definicion | Plazo notificacion |
|---|---|---|
| **Critico** | Fuga confirmada de PHI o credenciales | 72h al Responsable + autoridad (Ley 21.719 Art. 29) |
| **Alto** | Acceso no autorizado sin fuga confirmada | 7 dias al Responsable |
| **Medio** | Indisponibilidad >4h o backup fallido consecutivo >24h | Comunicacion interna |
| **Bajo** | Incidente cubierto por runbook estandar | Registro en `AuditLog`/Sentry |

Flujo: ver `docs/incident-runbooks.md` §10 (Sentry no envia alertas) y
los runbooks 1-9 para incidentes operativos.

---

## 8. Retencion y disposicion

| Dato | Retencion por defecto | Justificacion |
|---|---|---|
| Ficha clinica (encounters, sections) | Min. 15 anos post ultima atencion | Codigo sanitario / lex specialis |
| Datos de contacto del paciente | Vida util de la relacion + 15 anos | Acceso a la ficha |
| `AuditLog` | Indefinido en single-clinic | Integridad de cadena de hashes |
| Backups SQLite | 14 dias rotando (`SQLITE_BACKUP_RETENTION_DAYS`) | Recuperacion operativa |
| Logs HTTP/stdout | Politica del host (recomendado >=90 dias) | Forensics |
| Sesiones (`UserSession`) | Hasta revocacion o expiracion del refresh | Continuidad |
| Invitaciones (`UserInvitation`) | TTL definido + 30 dias post-uso | Auditoria |

---

## 9. Roles y responsables

| Rol | Responsabilidad |
|---|---|
| Encargado de Proteccion de Datos (DPO) | Validar este documento, aprobar borrados regulatorios, recibir solicitudes de titulares, escalar incidentes. **Obligatorio bajo Ley 21.719 cuando aplique.** |
| Administrador tecnico | Operar la instancia, ejecutar backups/drills, aplicar parches, gestionar accesos |
| Medico/a tratante | Decidir sobre consentimientos, registro de fichas, retencion clinica |
| Asistente | Apoyo administrativo bajo permiso explicito por medico responsable |

---

## 10. Brechas conocidas y plan de cierre

| Brecha | Estado | Plan |
|---|---|---|
| Endpoint formal de export por titular | Pendiente | Implementar `GET /api/patients/:id/export` admin-only con audit `PATIENT_DATA_EXPORTED` |
| Script `db:purge-patient` con confirmacion | Pendiente | Implementar bajo `backend/scripts/` con audit `PATIENT_RECORD_PURGED_REGULATORY` |
| Politica publicada en `/politica-de-privacidad` | Marco creado | Redactar version 1.0 con DPO de la clinica y publicar como `LegalDocument` |
| Designacion formal de DPO | Pendiente | Acto interno de la clinica usuaria |
| Registro de actividades de tratamiento (Ley 21.719) | Pendiente | Plantilla en `docs/data-processing-register.md` (proximamente) |
| Anonimizacion para analitica | Parcial | Revisar `clinical-analytics` para evitar reidentificacion en cohortes pequenas |
