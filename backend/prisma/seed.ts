import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '../src/prisma/resolve-database-url';

const prisma = new PrismaClient({
  ...(process.env.DATABASE_URL
    ? { datasources: { db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) } } }
    : {}),
});

function normalizeConditionName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Marker present on the dev-only seeded legal documents below. The runtime
 * guard `assertLegalDocumentsAreProductionReady` refuses to seed these in
 * production. Replace the entire `legalDocuments` array with the v1.0
 * documents redacted by legal counsel (see Ola 1 of the Ley 21.719 roadmap
 * at /home/allopze/.claude/plans/crea-un-plan-para-logical-hearth.md) and
 * remove the `footerNote` containing this marker.
 */
const DEV_ONLY_LEGAL_MARKER = 'Documento base para entornos de desarrollo y pruebas';

/**
 * @deprecated Dev/test only. These legal documents do NOT satisfy the 12
 * elements of Art 14 ter of Chile's Ley 21.719. They must be replaced with
 * the v1.0 policy redacted by legal counsel before any production deploy.
 * The runtime guard in `main()` throws when `NODE_ENV=production` while
 * any document still contains `DEV_ONLY_LEGAL_MARKER`.
 *
 * See:
 *   - docs/architecture-decisions/002-ley-21719-compliance.md
 *   - docs/audits/ley-21719-chile-audit-2026-05-23.md
 */
const legalDocuments = [
  {
    id: 'legal-terms-2026-05-02',
    type: 'TERMS',
    version: '2026-05-02',
    title: 'Términos y Condiciones de Servicio',
    description: 'Condiciones de uso para el personal de salud y administradores que operan Anamneo.',
    contentJson: {
      summary: [
        'Anamneo es una herramienta de apoyo para registrar y organizar información clínica.',
        'El acceso es personal, se administra por roles y exige resguardar credenciales, dispositivos y sesiones.',
      ],
      sections: [
        {
          id: 'uso',
          title: 'Uso del servicio',
          body: [
            'Anamneo permite gestionar pacientes, atenciones, consentimientos, adjuntos, alertas y reportes operativos dentro de un espacio clínico.',
            'Las decisiones clínicas siguen siendo responsabilidad del equipo tratante y del prestador que usa la plataforma.',
          ],
        },
      ],
      contactEmail: 'soporte@anamneo.cl',
      footerNote: `${DEV_ONLY_LEGAL_MARKER}; requiere revisión legal antes de producción.`,
    },
  },
  {
    id: 'legal-privacy-2026-05-02',
    type: 'PRIVACY',
    version: '2026-05-02',
    title: 'Política de Privacidad',
    description: 'Cómo Anamneo trata datos del personal de salud y datos sensibles de pacientes.',
    contentJson: {
      summary: [
        'El personal de salud usa cuentas personales con trazabilidad de sesiones y actividad.',
        'Los datos de pacientes se tratan como información sensible vinculada a la atención clínica.',
      ],
      sections: [
        {
          id: 'datos',
          title: 'Datos tratados',
          body: [
            'Anamneo puede tratar identificación, contacto, antecedentes, atenciones, diagnósticos, consentimientos, alertas, tareas y adjuntos.',
            'La retención, eliminación y respuesta a solicitudes debe definirse por el prestador responsable.',
          ],
        },
      ],
      dataCategories: [
        {
          label: 'Pacientes',
          examples: 'Identificación, contacto, previsión, antecedentes, atenciones, alertas, consentimientos y adjuntos.',
          purpose: 'Registro asistencial, continuidad de atención, documentación, auditoría y administración clínica.',
        },
      ],
      contactEmail: 'soporte@anamneo.cl',
      footerNote: `${DEV_ONLY_LEGAL_MARKER}; requiere revisión legal antes de producción.`,
    },
  },
  // Politica de Privacidad v1.0 — estructura "general + anexos por
  // finalidad" recomendada por el asesor legal (ver
  // docs/respuestas-borrador-ley21719.md §2.1). Cada documento es un
  // LegalDocument independiente con `type='PRIVACY'` y un `version`
  // distinto. Esto permite que cada anexo evolucione por separado sin
  // reescribir la politica general cada vez que cambia un encargado o un
  // proceso interno.
  //
  // **Resolución de "documento vigente para PolicyComplianceService":** el
  // selector actual usa `findFirst({ type: 'PRIVACY', status: 'PUBLISHED' },
  // orderBy publishedAt desc)`. Mientras todo este en DRAFT no aplica; al
  // promover a PUBLISHED, el general debe marcarse PUBLISHED **primero** o
  // (mejor) introducir un campo `kind` ('GENERAL' | 'ANNEX') en
  // LegalDocument y filtrar por kind='GENERAL'. Esta decisión esta
  // pendiente en docs/respuestas-borrador-ley21719.md §"Pendientes
  // derivados".
  //
  // El runtime guard del seed sigue bloqueando produccion porque cada
  // documento lleva el marcador `${DEV_ONLY_LEGAL_MARKER}`. El frontend
  // `LegalDocumentPage.tsx` es agnostico al contenido y renderiza todos
  // los anexos con el mismo layout.
  {
    id: 'legal-privacy-general-v1-draft',
    type: 'PRIVACY',
    version: '1.0-DRAFT',
    status: 'DRAFT',
    title: 'Política de Privacidad — General (v1.0 borrador)',
    description: 'Política de Privacidad general de Anamneo bajo la Ley 21.719 — borrador estructural para revisión legal. Las finalidades específicas se detallan en anexos separados.',
    contentJson: {
      summary: [
        'Esta es la **política general** que aplica a todo tratamiento de datos personales en Anamneo: responsable, DPO, derechos, seguridad, contacto, Agencia y reglas comunes.',
        'Las finalidades específicas (atención clínica, ficha clínica, administración de cuentas, soporte, auditoría y seguridad, telemetría, comunicaciones transaccionales y transferencias internacionales) están desarrolladas en **anexos por finalidad** que evolucionan independientemente.',
        `${DEV_ONLY_LEGAL_MARKER} [PENDIENTE_ABOGADO]: cada sección debe ser redactada o validada por el asesor legal externo antes de publicar.`,
      ],
      sections: [
        {
          id: 'art-14-ter-1-politica',
          title: '1. Política de tratamiento de datos (Art 14 ter, lit 1)',
          body: [
            '[PENDIENTE_ABOGADO] Declaración formal de la política adoptada por el Responsable, fecha de emisión y versión. Incluir referencia a esta estructura modular: una política general + anexos por finalidad.',
          ],
        },
        {
          id: 'art-14-ter-2-responsable',
          title: '2. Responsable del tratamiento (Art 14 ter, lit 2)',
          body: [
            '[PENDIENTE_ABOGADO] Identificación legal del Responsable (clínica usuaria): nombre, RUT, domicilio postal, representante legal.',
          ],
        },
        {
          id: 'art-14-ter-3-dpo',
          title: '3. Delegado de Protección de Datos (Art 14 ter, lit 3 + Art 50)',
          body: [
            'DPO interino al 2026-05-23: Alejandro López Zelaya — allopze@gmail.com.',
            '[PENDIENTE_ABOGADO] Confirmar si la designación interina requiere formalización adicional ante la Agencia.',
          ],
        },
        {
          id: 'art-14-ter-4-contacto',
          title: '4. Datos de contacto (Art 14 ter, lit 4)',
          body: [
            '[PENDIENTE_ABOGADO] Domicilio postal del Responsable + correo electrónico + formulario de contacto + URL pública para ejercer derechos (`/derechos`).',
          ],
        },
        {
          id: 'art-14-ter-5-categorias',
          title: '5. Categorías de datos y finalidades — vista general (Art 14 ter, lit 5)',
          body: [
            'Categorías generales: identificatorios, demográficos, salud (sensibles Art 2 letra g), contacto, representante legal de NNA, personal sanitario, telemetría.',
            'Finalidades activas: atención clínica · ficha clínica · administración de cuentas · soporte · auditoría y seguridad · telemetría de errores · comunicaciones transaccionales.',
            'Cada finalidad tiene un **anexo dedicado** con detalle de datos tratados, base legal específica, destinatarios, plazos y particularidades.',
            'Anamneo NO realiza investigación, analítica externa ni entrenamiento de modelos hoy. Si se incorporan, se añadirá un anexo nuevo y se solicitará base legal específica.',
          ],
        },
        {
          id: 'art-14-ter-6-seguridad',
          title: '6. Política y medidas de seguridad (Art 14 ter, lit 6 + Art 14 quinquies)',
          body: [
            'Anamneo aplica: autenticación con 2FA TOTP, cookies HttpOnly+SameSite=strict, CSRF, lockout, control por roles + médico efectivo.',
            'Cifrado en tránsito (HTTPS) y en reposo (filesystem LUKS + AES-256-GCM app-level para secciones clínicas, snapshots regulatorios, adjuntos y enlaces temporales DSAR).',
            'Auditoría con cadena de integridad SHA-256 verificable.',
            'Backups Postgres rotables con restore drill periódico, scrubbing de PHI en logs.',
            '[PENDIENTE_ABOGADO] Validar nivel de detalle exigible al titular y al fiscalizador. El detalle técnico exhaustivo está reservado al anexo de auditoría y seguridad.',
          ],
        },
        {
          id: 'art-14-ter-7-derechos',
          title: '7. Derechos del titular (Art 14 ter, lit 7 + Arts 4-11)',
          body: [
            'El titular tiene derecho a: acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal de sus datos personales.',
            'Plazo de respuesta: 30 días corridos desde la solicitud, prorrogables por 30 días corridos adicionales por una sola vez (Art 11).',
            'Para ejercer cualquier derecho: usar el formulario público en `/derechos` o escribir al correo de contacto.',
            '[PENDIENTE_ABOGADO] Confirmar texto definitivo y criterios de verificación de identidad aceptables.',
          ],
        },
        {
          id: 'art-14-ter-8-agencia',
          title: '8. Derecho a recurrir ante la Agencia (Art 14 ter, lit 8)',
          body: [
            'El titular puede reclamar ante la Agencia de Protección de Datos Personales cuando estime que sus derechos no han sido respetados.',
            '[PENDIENTE_ABOGADO] URL/contacto formal de la Agencia una vez constituida.',
          ],
        },
        {
          id: 'art-14-ter-9-transferencias',
          title: '9. Transferencias internacionales — política general (Art 14 ter, lit 9 + Arts 27-28)',
          body: [
            'Anamneo utiliza encargados que pueden tratar datos fuera de Chile (Cloudflare, Sentry, proveedor SMTP).',
            'El detalle de cada encargado (categorías de datos transferidas, finalidad, base legal, garantías aplicables, jurisdicción) está en el **Anexo: Transferencias internacionales**.',
            '[PENDIENTE_ABOGADO] Confirmar garantías aplicables: cláusulas contractuales modelo, BCR o consentimiento explícito por encargado.',
          ],
        },
        {
          id: 'art-14-ter-10-conservacion',
          title: '10. Período de conservación — regla general (Art 14 ter, lit 10)',
          body: [
            'Cada categoría tiene un plazo específico documentado en el anexo correspondiente.',
            'Reglas comunes: el plazo se cuenta desde la última atención o desde el evento que activó el tratamiento; al vencer, los datos se anonimizan, archivan o destruyen según el anexo.',
            '[PENDIENTE_ABOGADO] Confirmar plazos por categoría y norma específica aplicable (Ley 20.584, normativa MINSAL, prescripción de infracciones Art 40).',
          ],
        },
        {
          id: 'art-14-ter-11-fuente',
          title: '11. Fuente de los datos personales (Art 14 ter, lit 11)',
          body: [
            'Los datos provienen del propio titular (entrega presencial durante atención clínica) o de su representante legal en el caso de NNA.',
            'Anamneo no obtiene datos de fuentes de acceso público ni de cesionarios.',
          ],
        },
        {
          id: 'art-14-ter-12-automatizadas',
          title: '12. Decisiones automatizadas (Art 14 ter, lit 12 + Art 8 bis)',
          body: [
            'Anamneo NO realiza decisiones automatizadas con efectos jurídicos ni elabora perfiles del titular.',
            'Las decisiones clínicas son siempre humanas y responsabilidad del equipo tratante.',
            'Si en el futuro se incorpora IA clínica o triage automatizado, esta política será actualizada y se solicitará nuevo consentimiento del titular informando sobre la lógica aplicada, el derecho a intervención humana y el derecho a impugnar la decisión.',
          ],
        },
        {
          id: 'consentimiento-retiro',
          title: 'Retiro del consentimiento (Art 12 inciso 4)',
          body: [
            'Cuando el tratamiento se base en consentimiento, el titular puede retirarlo en cualquier momento sin afectar la licitud del tratamiento previo a la revocación. El retiro se gestiona desde el mismo formulario que se usó para otorgarlo o vía el correo de contacto.',
          ],
        },
        {
          id: 'anexos-listado',
          title: 'Anexos por finalidad (parte integrante de esta política)',
          body: [
            '1. Anexo: Atención clínica',
            '2. Anexo: Ficha clínica (conservación + acceso)',
            '3. Anexo: Administración de cuentas',
            '4. Anexo: Soporte',
            '5. Anexo: Auditoría y seguridad',
            '6. Anexo: Telemetría de errores',
            '7. Anexo: Comunicaciones transaccionales',
            '8. Anexo: Transferencias internacionales',
          ],
        },
      ],
      contactEmail: 'allopze@gmail.com',
      footerNote: `${DEV_ONLY_LEGAL_MARKER}: documento general v1.0 borrador. NO publicar antes de revisión legal. Cada anexo se publica como LegalDocument independiente con su propio version (\`1.0-DRAFT-ANEXO-{slug}\`).`,
    },
  },
  // ── Anexos por finalidad ─────────────────────────────────────────────
  ...buildPrivacyAnnexes(),
];

/**
 * Construye los 8 anexos por finalidad recomendados por asesor legal
 * (docs/respuestas-borrador-ley21719.md §2.1). Cada uno es un
 * LegalDocument independiente con `type='PRIVACY'` y `version` con el
 * sufijo `-ANEXO-{SLUG}` para distinguirlo del general.
 *
 * Estructura unificada por anexo: summary breve + sections {finalidad,
 * datos, base legal, destinatarios, plazos, particularidades} +
 * dataCategories opcional. Texto marcado [PENDIENTE_ABOGADO] donde
 * espera redacción/validación del asesor.
 */
function buildPrivacyAnnexes() {
  const baseFooter = `${DEV_ONLY_LEGAL_MARKER}: anexo v1.0 borrador. Forma parte integrante de la Política de Privacidad general (legal-privacy-general-v1-draft).`;
  return [
    {
      id: 'legal-privacy-anexo-atencion-clinica',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-ATENCION-CLINICA',
      status: 'DRAFT',
      title: 'Anexo: Atención clínica',
      description: 'Tratamiento de datos personales del titular durante la atención clínica directa.',
      contentJson: {
        summary: [
          'Este anexo desarrolla la finalidad **atención clínica directa** mencionada en la política general (sección 5).',
          'Aplica a todo dato recolectado durante consultas, procedimientos, exámenes y seguimientos asistenciales.',
        ],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: ['Prestar asistencia sanitaria al titular, registrar atenciones, generar documentos clínicos y coordinar continuidad de cuidados.'],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Identificatorios, demográficos, contacto, antecedentes, síntomas, signos vitales, diagnósticos, tratamientos, indicaciones, observaciones del equipo tratante.'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Asistencia sanitaria (Ley 21.719 Art 16 lit e: tratamiento necesario por profesional de la salud).',
              'Consentimiento del titular para la relación clínica general (Ley 21.719 Art 12).',
              '[PENDIENTE_ABOGADO] Confirmar si requiere base adicional bajo Ley 20.584.',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['Equipo tratante autorizado (médicos y asistentes con rol asignado). No se ceden datos a terceros para esta finalidad.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: ['Mientras dure la relación asistencial. La ficha clínica con el registro de las atenciones se conserva según el anexo de Ficha clínica.'],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: [
              'NNA (<14 años o <16 años con dato sensible): consentimiento del padre, madre, tutor o representante legal (Art 16 quáter).',
              'Bloqueo temporal del tratamiento (Art 8 ter) suspende toda nueva atención hasta que el titular o el responsable lo levante.',
            ],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-ficha-clinica',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-FICHA-CLINICA',
      status: 'DRAFT',
      title: 'Anexo: Ficha clínica (conservación + acceso)',
      description: 'Conservación, acceso y portabilidad del registro acumulado de atenciones del titular.',
      contentJson: {
        summary: [
          'Este anexo cubre el registro acumulado del titular (ficha clínica longitudinal) y su ciclo de vida.',
        ],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: ['Mantener la trazabilidad clínica histórica para continuidad asistencial, derechos del titular (acceso/portabilidad) y cumplimiento normativo sanitario.'],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Todos los datos del anexo de atención clínica + adjuntos clínicos + consentimientos clínicos otorgados + decisiones de revisión y firma.'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Obligación legal sanitaria (Ley 20.584 y normativa MINSAL de archivo de ficha clínica).',
              'Asistencia sanitaria (Ley 21.719 Art 16 lit e) para usos posteriores en continuidad asistencial.',
              '[PENDIENTE_ABOGADO] Confirmar plazo exacto y normativa específica MINSAL aplicable.',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['Titular o representante legal (vía portal o solicitud DSAR), equipo tratante autorizado, autoridad sanitaria fiscalizadora cuando lo requiera.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: [
              'Operativa actual: 15 años desde la última atención (referencia conservadora).',
              '[PENDIENTE_ABOGADO] Confirmar plazo legal definitivo y criterio de inicio de cómputo.',
              'Al vencer: purga regulatoria con auditoría (ver servicio `patients-regulatory-purge.service.ts`).',
            ],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: [
              'El derecho de supresión (Art 4 lit c) puede ser denegado por la obligación legal de conservar la ficha — la denegación se documenta y notifica al titular.',
              'Snapshots pre-purga se cifran AES-256-GCM a nivel app antes de almacenarse.',
            ],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-administracion-cuentas',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-ADMINISTRACION-CUENTAS',
      status: 'DRAFT',
      title: 'Anexo: Administración de cuentas',
      description: 'Gestión de cuentas del personal de salud (médicos, asistentes, administradores).',
      contentJson: {
        summary: ['Este anexo cubre el tratamiento de datos del personal de salud que usa Anamneo (no aplica a pacientes).'],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: ['Autenticar, autorizar y administrar usuarios del sistema. Mantener trazabilidad de quién realiza qué acción.'],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Email, nombre, rol, hash de contraseña, secret TOTP (cifrado), códigos de recuperación 2FA (hash), sesiones activas, último login.'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Interés legítimo del Responsable (Ley 21.719 Art 13) para operar la herramienta de gestión clínica de forma segura.',
              'Ejecución del contrato laboral o de servicios entre el Responsable y el personal.',
              '[PENDIENTE_ABOGADO] Validar prevalencia del interés legítimo frente al titular usuario.',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['Administradores del sistema en la clínica usuaria. No se comparten con terceros.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: ['Mientras dure la relación contractual + 4 años para prescripción de infracciones (Ley 21.719 Art 40).'],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: ['Las cuentas desactivadas mantienen el historial de auditoría pero pierden acceso.'],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-soporte',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-SOPORTE',
      status: 'DRAFT',
      title: 'Anexo: Soporte',
      description: 'Tratamiento de datos durante interacciones de soporte con el equipo técnico de Anamneo.',
      contentJson: {
        summary: ['Cubre los datos compartidos por usuarios al pedir soporte técnico o reportar incidencias.'],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: ['Resolver consultas, incidencias y bugs reportados por el personal de salud. Mejorar la calidad y estabilidad del producto.'],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Email de contacto, descripción del problema, datos de sesión necesarios para reproducir el bug, capturas de pantalla (con PHI removido cuando sea posible).'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Ejecución del contrato de servicio entre Anamneo y la clínica usuaria.',
              'Interés legítimo del Responsable en operar el sistema correctamente.',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['Equipo técnico autorizado de Anamneo. NO se comparte PHI con terceros sin autorización expresa.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: ['Tickets cerrados: 2 años para mejora de producto y referencia. Tickets que involucran PHI: minimización inmediata tras resolución.'],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: ['Cuando un ticket requiere acceso al ambiente del cliente, se documenta autorización explícita por escrito del Responsable.'],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-auditoria-seguridad',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-AUDITORIA-SEGURIDAD',
      status: 'DRAFT',
      title: 'Anexo: Auditoría y seguridad',
      description: 'Trazabilidad de todas las acciones realizadas sobre datos personales (Art 14 quinquies).',
      contentJson: {
        summary: ['Detalla cómo Anamneo cumple la obligación del Art 14 quinquies de mantener registro de tratamientos y trazabilidad.'],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: ['Demostrar el cumplimiento de la Ley 21.719, detectar accesos no autorizados, soportar respuestas a brechas y derechos del titular.'],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Entidad afectada, tipo de acción, ID de usuario que la ejecuta, timestamp, IP, user agent, hash encadenado (SHA-256) para integridad.'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Obligación legal (Ley 21.719 Art 14 quinquies).',
              'Interés legítimo del Responsable en proteger la información.',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['DPO, administradores de la clínica usuaria, autoridad fiscalizadora cuando lo requiera, equipo técnico de Anamneo en investigación de incidentes.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: ['Mínimo 4 años (prescripción de infracciones Art 40). Puede ser mayor por integridad de la cadena.'],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: [
              'La integridad se verifica mediante el endpoint `/api/audit/integrity/verify`.',
              '[PENDIENTE_ABOGADO] Validar nivel de detalle técnico exigible al titular en este anexo (algunos datos de seguridad son sensibles para divulgar).',
            ],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-telemetria',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-TELEMETRIA',
      status: 'DRAFT',
      title: 'Anexo: Telemetría de errores',
      description: 'Captura de errores técnicos para mejora de estabilidad del producto.',
      contentJson: {
        summary: ['Anamneo usa Sentry para capturar errores técnicos en producción. Esta telemetría aplica scrubbing automático de PHI.'],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: ['Detectar bugs y crashes en producción para corregirlos y mejorar la estabilidad.'],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Stack trace, ID anonimizado de sesión, navegador y versión, endpoint afectado. Los datos identificables (RUT, nombre, email) son removidos por scrubbing antes del envío.'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Interés legítimo del Responsable en operar el sistema correctamente.',
              '[PENDIENTE_ABOGADO] Validar que el scrubbing automático efectivamente elimina datos personales antes del envío al encargado.',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['Sentry (encargado del tratamiento) y equipo técnico de Anamneo. El detalle de la transferencia internacional está en el Anexo: Transferencias internacionales.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: ['Retención en Sentry: 90 días (rolling).'],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: ['Si el titular se opone (Art 8) a esta telemetría, su sesión no se envía a Sentry. La oposición se registra en `Patient.processingObjections`.'],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-comunicaciones',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-COMUNICACIONES',
      status: 'DRAFT',
      title: 'Anexo: Comunicaciones transaccionales',
      description: 'Envío de correos transaccionales relacionados con la atención y los derechos del titular.',
      contentJson: {
        summary: ['Cubre los correos enviados al titular relacionados con sus solicitudes DSAR, brechas y notificaciones esenciales.'],
        sections: [
          {
            id: 'finalidad',
            title: 'Finalidad',
            body: [
              'Acuse de recibo y resolución de solicitudes de derechos (Art 4-11).',
              'Notificación de brechas que lo afecten (Art 14 sexies).',
              'Comunicaciones esenciales para la continuidad asistencial cuando el titular las autorice.',
            ],
          },
          {
            id: 'datos',
            title: 'Datos tratados',
            body: ['Email del titular, nombre, contenido del mensaje (sin PHI clínica salvo lo mínimo necesario).'],
          },
          {
            id: 'base-legal',
            title: 'Base legal',
            body: [
              'Obligación legal (Ley 21.719 Art 11 para DSAR y Art 14 sexies para brechas).',
              'Consentimiento para comunicaciones opcionales (Art 12).',
            ],
          },
          {
            id: 'destinatarios',
            title: 'Destinatarios',
            body: ['Proveedor SMTP (encargado del tratamiento). El detalle del proveedor y su jurisdicción está en el Anexo: Transferencias internacionales.'],
          },
          {
            id: 'plazos',
            title: 'Plazos de conservación',
            body: ['Logs de envío: 90 días. Contenido del mensaje: no se almacena en Anamneo más allá del envío.'],
          },
          {
            id: 'particularidades',
            title: 'Particularidades',
            body: ['El titular puede oponerse a comunicaciones no esenciales (campo `processingObjections.COMUNICACIONES`).'],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
    {
      id: 'legal-privacy-anexo-transferencias-internacionales',
      type: 'PRIVACY',
      version: '1.0-DRAFT-ANEXO-TRANSFERENCIAS-INTERNACIONALES',
      status: 'DRAFT',
      title: 'Anexo: Transferencias internacionales',
      description: 'Encargados del tratamiento que pueden procesar datos fuera de Chile (Ley 21.719 Arts 27-28).',
      contentJson: {
        summary: ['Detalla cada encargado externo: jurisdicción, categorías de datos transferidos, finalidad, base legal y garantías aplicables.'],
        sections: [
          {
            id: 'cloudflare',
            title: 'Cloudflare (CDN + túnel)',
            body: [
              'Jurisdicción: Estados Unidos / red global.',
              'Datos transferidos: tráfico HTTP en tránsito (incluyendo PHI dentro de payloads cifrados HTTPS), metadatos de la conexión (IP del cliente, headers).',
              'Finalidad: distribución de contenido, mitigación DDoS, túnel de acceso.',
              'Base legal: interés legítimo del Responsable + cláusulas contractuales modelo en el DPA.',
              '[PENDIENTE_ABOGADO] Confirmar versión de cláusulas contractuales modelo aplicable.',
            ],
          },
          {
            id: 'sentry',
            title: 'Sentry (telemetría de errores)',
            body: [
              'Jurisdicción: Estados Unidos.',
              'Datos transferidos: stack traces con scrubbing automático de PHI; identificadores anónimos de sesión.',
              'Finalidad: detección de errores en producción (ver Anexo: Telemetría de errores).',
              'Base legal: interés legítimo + cláusulas contractuales modelo.',
              '[PENDIENTE_ABOGADO] Confirmar DPA firmado y vigencia de SCC.',
            ],
          },
          {
            id: 'smtp',
            title: 'Proveedor SMTP (correos transaccionales)',
            body: [
              'Jurisdicción: por confirmar (depende del proveedor activo en la clínica usuaria).',
              'Datos transferidos: email del titular, contenido del correo.',
              'Finalidad: envío de comunicaciones (ver Anexo: Comunicaciones transaccionales).',
              'Base legal: obligación legal (DSAR, brechas) + interés legítimo (comunicaciones esenciales).',
              '[PENDIENTE_ABOGADO] Confirmar proveedor definitivo, jurisdicción y DPA firmado.',
            ],
          },
          {
            id: 'derechos-titular',
            title: 'Derechos del titular sobre transferencias',
            body: [
              'El titular puede solicitar copia del DPA aplicable a cada encargado y de las garantías ofrecidas.',
              'Para oposición específica a una transferencia, contactar al DPO.',
            ],
          },
        ],
        contactEmail: 'allopze@gmail.com',
        footerNote: baseFooter,
      },
    },
  ];
}

function assertLegalDocumentsAreProductionReady(documents: typeof legalDocuments) {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const offending = documents.filter((doc) =>
    JSON.stringify(doc.contentJson).includes(DEV_ONLY_LEGAL_MARKER),
  );
  if (offending.length === 0) {
    return;
  }
  const offendingList = offending.map((doc) => `${doc.type} ${doc.version}`).join(', ');
  throw new Error(
    `Refusing to seed dev-only legal documents in production (${offendingList}). ` +
    'These documents do NOT satisfy the 12 elements of Art 14 ter of Chile Ley 21.719. ' +
    'Replace `legalDocuments` in backend/prisma/seed.ts with the v1.0 policy redacted ' +
    'by legal counsel before deploying. ' +
    'See docs/architecture-decisions/002-ley-21719-compliance.md.',
  );
}

// 30+ medical conditions in Spanish with synonyms
const conditions = [
  { name: 'Dolor de cabeza', synonyms: ['cefalea', 'jaqueca', 'dolor cabeza', 'migraña'], tags: ['neurológico', 'dolor'] },
  { name: 'Cefalea tensional', synonyms: ['dolor tensión', 'cefalea tension'], tags: ['neurológico', 'dolor'] },
  { name: 'Migraña', synonyms: ['jaqueca', 'hemicránea', 'dolor migrañoso'], tags: ['neurológico', 'dolor'] },
  { name: 'Hipertensión arterial', synonyms: ['presión alta', 'HTA', 'tension alta'], tags: ['cardiovascular'] },
  { name: 'Diabetes mellitus', synonyms: ['diabetes', 'azúcar alta', 'glucosa alta', 'DM'], tags: ['endocrino', 'metabólico'] },
  { name: 'Diabetes mellitus tipo 2', synonyms: ['diabetes 2', 'DM2', 'diabetes adulto'], tags: ['endocrino', 'metabólico'] },
  { name: 'Hipotiroidismo', synonyms: ['tiroides baja', 'hipotiroideo'], tags: ['endocrino'] },
  { name: 'Hipertiroidismo', synonyms: ['tiroides alta', 'hipertiroideo'], tags: ['endocrino'] },
  { name: 'Lumbalgia', synonyms: ['dolor lumbar', 'dolor espalda baja', 'lumbago'], tags: ['musculoesquelético', 'dolor'] },
  { name: 'Cervicalgia', synonyms: ['dolor cervical', 'dolor cuello'], tags: ['musculoesquelético', 'dolor'] },
  { name: 'Artritis', synonyms: ['inflamación articular', 'dolor articulaciones'], tags: ['musculoesquelético', 'reumatológico'] },
  { name: 'Artrosis', synonyms: ['desgaste articular', 'osteoartritis'], tags: ['musculoesquelético', 'degenerativo'] },
  { name: 'Gripe', synonyms: ['influenza', 'flu', 'resfrío fuerte'], tags: ['infeccioso', 'respiratorio'] },
  { name: 'Resfriado común', synonyms: ['resfrío', 'catarro', 'tos'], tags: ['infeccioso', 'respiratorio'] },
  { name: 'Bronquitis', synonyms: ['inflamación bronquios', 'tos bronquial'], tags: ['respiratorio'] },
  { name: 'Neumonía', synonyms: ['pulmonía', 'infección pulmonar'], tags: ['respiratorio', 'infeccioso'] },
  { name: 'Asma bronquial', synonyms: ['asma', 'broncoespasmo', 'dificultad respirar'], tags: ['respiratorio', 'alérgico'] },
  { name: 'Gastritis', synonyms: ['inflamación estómago', 'dolor estómago', 'ardor estomacal'], tags: ['gastrointestinal'] },
  { name: 'Reflujo gastroesofágico', synonyms: ['ERGE', 'acidez', 'reflujo'], tags: ['gastrointestinal'] },
  { name: 'Síndrome intestino irritable', synonyms: ['SII', 'colon irritable', 'colitis nerviosa'], tags: ['gastrointestinal'] },
  { name: 'Estreñimiento', synonyms: ['constipación', 'dificultad evacuación'], tags: ['gastrointestinal'] },
  { name: 'Diarrea', synonyms: ['deposiciones líquidas', 'soltura estómago'], tags: ['gastrointestinal'] },
  { name: 'Infección urinaria', synonyms: ['ITU', 'cistitis', 'infección orina'], tags: ['urológico', 'infeccioso'] },
  { name: 'Insuficiencia renal', synonyms: ['falla renal', 'riñón enfermo', 'IRC'], tags: ['nefrológico'] },
  { name: 'Anemia', synonyms: ['hemoglobina baja', 'glóbulos rojos bajos'], tags: ['hematológico'] },
  { name: 'Depresión', synonyms: ['tristeza', 'trastorno depresivo', 'depresión mayor'], tags: ['psiquiátrico', 'salud mental'] },
  { name: 'Ansiedad', synonyms: ['angustia', 'nervios', 'trastorno ansiedad'], tags: ['psiquiátrico', 'salud mental'] },
  { name: 'Insomnio', synonyms: ['dificultad dormir', 'falta sueño', 'no dormir'], tags: ['neurológico', 'salud mental'] },
  { name: 'Dermatitis', synonyms: ['eccema', 'inflamación piel', 'piel irritada'], tags: ['dermatológico'] },
  { name: 'Psoriasis', synonyms: ['piel escamosa', 'placas piel'], tags: ['dermatológico', 'autoinmune'] },
  { name: 'Conjuntivitis', synonyms: ['ojo rojo', 'inflamación ojo', 'infección ojo'], tags: ['oftalmológico'] },
  { name: 'Otitis', synonyms: ['infección oído', 'dolor oído'], tags: ['otorrinolaringológico', 'infeccioso'] },
  { name: 'Faringitis', synonyms: ['dolor garganta', 'inflamación faringe', 'anginas'], tags: ['otorrinolaringológico'] },
  { name: 'Rinitis alérgica', synonyms: ['alergia nasal', 'rinitis', 'congestión nasal'], tags: ['alérgico', 'otorrinolaringológico'] },
  { name: 'Obesidad', synonyms: ['sobrepeso', 'exceso peso'], tags: ['metabólico', 'nutricional'] },
  { name: 'Dislipidemia', synonyms: ['colesterol alto', 'triglicéridos altos', 'grasa sangre'], tags: ['metabólico', 'cardiovascular'] },
  { name: 'Fibromialgia', synonyms: ['dolor generalizado', 'dolor crónico muscular'], tags: ['reumatológico', 'dolor'] },
  { name: 'Epicondilitis', synonyms: ['codo tenista', 'dolor codo'], tags: ['musculoesquelético'] },
  { name: 'Síndrome túnel carpiano', synonyms: ['túnel carpiano', 'dolor muñeca', 'hormigueo manos'], tags: ['neurológico', 'musculoesquelético'] },
];

async function main() {
  console.log('🌱 Starting database seed...');

  assertLegalDocumentsAreProductionReady(legalDocuments);

  console.log('Creating published legal documents...');
  for (const document of legalDocuments) {
    // Respect doc.status when explicitly set (e.g. v1.0 draft of the Ley
    // 21.719 privacy policy must stay DRAFT until legal validates).
    // Default behavior (status === undefined) keeps backward compatibility:
    // publish immediately.
    const explicitStatus = (document as { status?: string }).status;
    const status = explicitStatus ?? 'PUBLISHED';
    const publishedAt = status === 'PUBLISHED' ? new Date('2026-05-02T00:00:00.000Z') : null;
    await prisma.legalDocument.upsert({
      where: { type_version: { type: document.type, version: document.version } },
      update: {
        status,
        title: document.title,
        description: document.description,
        contentJson: JSON.stringify(document.contentJson),
        effectiveAt: new Date('2026-05-02T00:00:00.000Z'),
        publishedAt,
      },
      create: {
        id: document.id,
        type: document.type,
        version: document.version,
        status,
        title: document.title,
        description: document.description,
        contentJson: JSON.stringify(document.contentJson),
        effectiveAt: new Date('2026-05-02T00:00:00.000Z'),
        publishedAt,
      },
    });
  }
  console.log(`  ✓ Created ${legalDocuments.length} legal documents`);

  // Create conditions catalog only (no demo users)
  console.log('Creating condition catalog...');
  for (const condition of conditions) {
    const normalizedName = normalizeConditionName(condition.name);
    const existing = await prisma.conditionCatalog.findFirst({
      where: { normalizedName },
      select: { id: true },
    });

    if (existing) {
      await prisma.conditionCatalog.update({
        where: { id: existing.id },
        data: {
          name: condition.name,
          normalizedName,
          synonyms: JSON.stringify(condition.synonyms),
          tags: JSON.stringify(condition.tags),
          active: true,
        },
      });
      continue;
    }

    await prisma.conditionCatalog.create({
      data: {
        name: condition.name,
        normalizedName,
        synonyms: JSON.stringify(condition.synonyms),
        tags: JSON.stringify(condition.tags),
      },
    });
  }
  console.log(`  ✓ Created ${conditions.length} conditions`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📝 Register a new user at /auth/register to get started.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
