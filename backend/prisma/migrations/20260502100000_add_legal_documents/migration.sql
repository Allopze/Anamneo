CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "effective_at" DATETIME NOT NULL,
    "published_at" DATETIME,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "legal_documents_type_version_key" ON "legal_documents"("type", "version");
CREATE INDEX "legal_documents_type_status_idx" ON "legal_documents"("type", "status");
CREATE INDEX "legal_documents_status_published_at_idx" ON "legal_documents"("status", "published_at");

INSERT INTO "legal_documents" (
    "id",
    "type",
    "version",
    "status",
    "title",
    "description",
    "content_json",
    "effective_at",
    "published_at"
) VALUES (
    'legal-terms-2026-05-02',
    'TERMS',
    '2026-05-02',
    'PUBLISHED',
    'Términos y Condiciones de Servicio',
    'Condiciones de uso para el personal de salud y administradores que operan Anamneo.',
    '{"summary":["Anamneo es una herramienta de apoyo para registrar y organizar información clínica; no reemplaza el criterio profesional ni la responsabilidad del prestador.","El acceso es personal, se administra por roles y exige resguardar credenciales, dispositivos y sesiones.","La información clínica debe usarse solo para fines asistenciales, administrativos o de continuidad de atención autorizados."],"sections":[{"id":"servicio","title":"Uso del servicio","body":["Anamneo permite gestionar pacientes, atenciones, consentimientos, adjuntos, alertas, seguimiento clínico, catálogos y reportes operativos dentro de un espacio clínico.","El sistema entrega organización, trazabilidad y controles de acceso, pero las decisiones clínicas, diagnósticas, terapéuticas y administrativas siguen siendo responsabilidad del equipo tratante y del prestador que usa la plataforma."]},{"id":"cuentas","title":"Cuentas del personal de salud","body":["Cada usuario debe usar una cuenta propia. Las invitaciones, roles y permisos se asignan por administradores del espacio clínico.","El usuario debe mantener su contraseña en reserva, cerrar sesión en equipos compartidos y activar las medidas de seguridad disponibles cuando corresponda."],"bullets":["Administrador: configura usuarios, centro, correo y políticas operativas.","Médico: registra y firma atenciones, pacientes, consentimientos y salidas clínicas según permisos.","Asistente: apoya flujos clínicos y administrativos dentro del acceso asignado."]},{"id":"pacientes","title":"Datos de pacientes","body":["La información de pacientes se considera sensible y debe tratarse con reserva. El usuario se compromete a registrar solo datos necesarios para la atención, continuidad clínica, gestión administrativa o cumplimiento de obligaciones aplicables.","El equipo clínico debe contar con las bases, autorizaciones o deberes profesionales que correspondan para ingresar y consultar información de pacientes en Anamneo."]},{"id":"seguridad","title":"Seguridad y disponibilidad","body":["Anamneo aplica controles como sesiones con cookies HttpOnly, roles, permisos, registro de auditoría, revocación de sesiones, modo de equipo compartido, backups y controles de arranque para evitar configuraciones inseguras.","La seguridad final también depende del entorno donde se despliega: dominio HTTPS, host, backups, cifrado del volumen de datos, administración de secretos y acceso físico a los equipos."]},{"id":"limites","title":"Límites de responsabilidad","body":["El usuario no debe usar la plataforma para fines ajenos a la atención o gestión clínica autorizada, ni intentar acceder a pacientes, atenciones, adjuntos o registros que no le correspondan.","Los errores de registro, uso indebido de credenciales, exposición de pantallas en equipos compartidos o tratamiento de datos sin autorización suficiente son responsabilidad del operador o institución que administra el espacio clínico."]},{"id":"cambios","title":"Cambios de versión","body":["Estos términos pueden actualizarse para reflejar cambios funcionales, operativos, legales o de seguridad. Cuando corresponda, Anamneo podrá solicitar una nueva aceptación versionada al personal de salud."]}],"contactEmail":"soporte@anamneo.cl","references":[{"label":"Ley 19.628","href":"https://www.bcn.cl/leychile/navegar?idLey=19628"},{"label":"Ley 20.584","href":"https://www.bcn.cl/leychile/navegar?idNorma=1039348"},{"label":"Ley 21.719","href":"https://www.bcn.cl/leychile/navegar?idNorma=1209272"}],"footerNote":"Este documento es una base operativa y debe revisarse con asesoría legal antes de usarlo como texto contractual definitivo."}',
    '2026-05-02T00:00:00.000Z',
    CURRENT_TIMESTAMP
);

INSERT INTO "legal_documents" (
    "id",
    "type",
    "version",
    "status",
    "title",
    "description",
    "content_json",
    "effective_at",
    "published_at"
) VALUES (
    'legal-privacy-2026-05-02',
    'PRIVACY',
    '2026-05-02',
    'PUBLISHED',
    'Política de Privacidad',
    'Cómo Anamneo trata datos del personal de salud y datos sensibles de pacientes.',
    '{"summary":["El personal de salud usa cuentas personales; Anamneo registra identidad, rol, sesiones y actividad necesaria para seguridad y operación.","Los datos de pacientes se tratan como información sensible vinculada a la ficha clínica y se usan para atención, continuidad, auditoría y administración clínica.","Los pacientes no tienen portal propio en esta versión; sus derechos y solicitudes se canalizan a través del prestador o equipo responsable."],"dataCategories":[{"label":"Personal de salud","examples":"Nombre, correo, rol, invitaciones, sesiones, 2FA, cambios de perfil y actividad de auditoría.","purpose":"Autenticación, control de acceso, soporte, trazabilidad, seguridad y administración del espacio clínico."},{"label":"Pacientes","examples":"Identificación, RUT o exención, contacto, previsión, antecedentes, atenciones, diagnósticos, tratamientos, alertas, consentimientos, tareas y adjuntos.","purpose":"Registro asistencial, continuidad de atención, respaldo de decisiones clínicas, documentos clínicos y gestión administrativa."},{"label":"Datos técnicos","examples":"Cookies de sesión, IP, user-agent, logs de error, request id, estado de backups y eventos de seguridad.","purpose":"Mantener sesión segura, detectar fallas, investigar incidentes, proteger integridad y verificar operación."}],"sections":[{"id":"responsables","title":"Roles en el tratamiento","body":["El prestador o institución que opera Anamneo decide qué pacientes registra, quién accede y con qué finalidad clínica o administrativa. Anamneo entrega la herramienta, controles y trazabilidad para apoyar ese tratamiento.","Las solicitudes de pacientes sobre su ficha, copia, rectificación o uso de datos deben ser gestionadas por el prestador responsable, salvo que exista un canal contractual específico distinto."]},{"id":"personal","title":"Datos del personal de salud","body":["Para crear y mantener cuentas se tratan datos de identificación profesional u operativa como nombre, correo, rol, relación médico-asistente, invitaciones y estado de cuenta.","También se registran sesiones, cambios relevantes, intentos de acceso, revocaciones y acciones auditables para proteger el sistema y mantener trazabilidad."]},{"id":"pacientes","title":"Datos de pacientes","body":["Los datos de pacientes pueden incluir identificación, contacto, antecedentes, información clínica, secciones de atención, signos vitales, sospechas diagnósticas, tratamiento, evolución, consentimientos, alertas, tareas, adjuntos y documentos.","Esta información debe considerarse sensible. Se usa para atención, continuidad clínica, documentación, auditoría, generación de documentos, seguimiento y administración del centro."]},{"id":"seguridad","title":"Medidas de protección","body":["Anamneo usa cookies HttpOnly para sesión, access token de vida corta, refresh token, sesiones persistidas, revocación, bloqueo de intentos, roles, permisos, auditoría, 2FA, modo equipo compartido y controles de configuración insegura.","Los settings sensibles, como credenciales SMTP, se cifran a nivel de aplicación. La base clínica, adjuntos y backups requieren cifrado de filesystem o volumen en el host donde se despliega la aplicación."]},{"id":"retencion","title":"Retención y eliminación","body":["La retención de fichas, atenciones, adjuntos, auditoría y respaldos debe definirse según obligaciones clínicas, regulatorias y operativas del prestador.","La eliminación o anonimización debe evaluarse con cuidado para no afectar continuidad de atención, trazabilidad clínica, auditoría, respaldos o deberes legales de conservación."]},{"id":"marco","title":"Marco normativo de referencia","body":["El texto se preparó para el contexto chileno y debe ser revisado legalmente antes de producción. Considera como referencia la Ley 19.628 sobre datos personales, la Ley 20.584 sobre derechos y deberes de pacientes, y la modernización introducida por la Ley 21.719."]}],"contactEmail":"soporte@anamneo.cl","references":[{"label":"Ley 19.628","href":"https://www.bcn.cl/leychile/navegar?idLey=19628"},{"label":"Ley 20.584","href":"https://www.bcn.cl/leychile/navegar?idNorma=1039348"},{"label":"Ley 21.719","href":"https://www.bcn.cl/leychile/navegar?idNorma=1209272"}],"footerNote":"Este documento es una base operativa y debe revisarse con asesoría legal antes de usarlo como texto contractual definitivo."}',
    '2026-05-02T00:00:00.000Z',
    CURRENT_TIMESTAMP
);
