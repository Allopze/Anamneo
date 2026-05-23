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
 *   - AUDITORIA_LEY_21719_CHILE.md
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
  // Politica de Privacidad v1.0 (placeholder de los 12 elementos del Art 14
  // ter de la Ley 21.719). Mantenido en DRAFT hasta que el texto de cada
  // seccion sea redactado y validado por el asesor legal externo (ver
  // docs/preguntas-abogado-ley21719.md §2.1). El runtime guard del seed
  // sigue bloqueando produccion porque cada seccion lleva el marcador
  // `${DEV_ONLY_LEGAL_MARKER}` integrado en el body como [PENDIENTE_ABOGADO].
  //
  // El frontend ya soporta este contentJson de forma agnostica via
  // frontend/src/components/legal/LegalDocumentPage.tsx — al publicar la
  // version validada por legal basta con mutar este objeto y subir el
  // `status` a 'PUBLISHED'.
  {
    id: 'legal-privacy-v1-draft',
    type: 'PRIVACY',
    version: '1.0-DRAFT',
    status: 'DRAFT',
    title: 'Política de Privacidad (v1.0 — borrador)',
    description: 'Política de Privacidad de Anamneo bajo la Ley 21.719 — borrador para revisión legal.',
    contentJson: {
      summary: [
        'Esta política describe cómo Anamneo y la clínica usuaria tratan los datos personales de pacientes y del personal de salud.',
        `${DEV_ONLY_LEGAL_MARKER} [PENDIENTE_ABOGADO]: cada sección debe ser redactada o validada por el asesor legal externo antes de publicar.`,
      ],
      sections: [
        {
          id: 'art-14-ter-1-politica',
          title: '1. Política de tratamiento de datos (Art 14 ter, lit 1)',
          body: [
            '[PENDIENTE_ABOGADO] Declaración formal de la política adoptada por el responsable, fecha de emisión y versión.',
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
            '[PENDIENTE_ABOGADO] Confirmar si la designación interina requiere formalización adicional.',
          ],
        },
        {
          id: 'art-14-ter-4-contacto',
          title: '4. Datos de contacto (Art 14 ter, lit 4)',
          body: [
            '[PENDIENTE_ABOGADO] Domicilio postal del Responsable + correo electrónico + formulario de contacto + URL pública para ejercer derechos.',
          ],
        },
        {
          id: 'art-14-ter-5-finalidades',
          title: '5. Categorías de datos, finalidades y bases legales (Art 14 ter, lit 5)',
          body: [
            'Categorías: identificatorios, demográficos, salud (sensibles Art 2 letra g), contacto, representante legal de NNA, personal sanitario, telemetría.',
            'Finalidades: atención clínica, auditoría, documentos clínicos, comunicaciones transaccionales, monitoreo técnico, estadística agregada.',
            '[PENDIENTE_ABOGADO] Anclar cada finalidad a la base legal específica de la Ley 21.719 (Arts 12, 13, 16 lit e, 16 quinquies) y a la ley sanitaria especial (Ley 20.584 + normas MINSAL).',
          ],
        },
        {
          id: 'art-14-ter-6-seguridad',
          title: '6. Política y medidas de seguridad (Art 14 ter, lit 6 + Art 14 quinquies)',
          body: [
            'Anamneo aplica: autenticación con 2FA TOTP, cookies HttpOnly+SameSite=strict, CSRF, lockout, control de roles + médico efectivo.',
            'Cifrado en tránsito (HTTPS) y en reposo (filesystem LUKS + AES-256-GCM app-level para secciones clínicas, snapshots regulatorios y adjuntos en Ola 3).',
            'Auditoría con cadena de integridad SHA-256 verificable.',
            'Backups Postgres rotables, restore drills, scrubbing de PHI en logs.',
            '[PENDIENTE_ABOGADO] Validar nivel de detalle exigible al titular y al fiscalizador.',
          ],
        },
        {
          id: 'art-14-ter-7-derechos',
          title: '7. Derechos del titular (Art 14 ter, lit 7 + Arts 4-11)',
          body: [
            'El titular tiene derecho a: acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal de sus datos personales.',
            'Plazo de respuesta: 30 días corridos desde la solicitud, prorrogables por 30 días corridos adicionales por una sola vez (Art 11).',
            'Para ejercer cualquier derecho: usar el formulario público en /derechos o escribir al correo de contacto.',
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
          title: '9. Transferencias internacionales de datos (Art 14 ter, lit 9 + Arts 27-28)',
          body: [
            'Anamneo utiliza los siguientes encargados que pueden tratar datos fuera de Chile:',
            'Cloudflare (CDN + túnel) — Estados Unidos / red global.',
            'Sentry (telemetría de errores, con PHI scrubbed) — Estados Unidos.',
            'Proveedor SMTP (correos transaccionales) — por confirmar.',
            '[PENDIENTE_ABOGADO] Garantías aplicables: cláusulas contractuales modelo, normas corporativas vinculantes, consentimiento explícito o adecuación.',
          ],
        },
        {
          id: 'art-14-ter-10-conservacion',
          title: '10. Período de conservación (Art 14 ter, lit 10)',
          body: [
            'Ficha clínica: 15 años desde la última atención (referencia operativa, sujeta a validación legal sanitaria específica).',
            'Auditoría y trazabilidad: retención prolongada por integridad de cadena y prescripción de infracciones (Art 40: 4 años).',
            'Backups: política del responsable, recomendado 14 días rotativos.',
            '[PENDIENTE_ABOGADO] Confirmar plazos por categoría y norma específica aplicable.',
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
      ],
      dataCategories: [
        {
          label: 'Identificatorios',
          examples: 'RUT, nombre completo, fecha de nacimiento, sexo.',
          purpose: 'Atención clínica, generación de documentos, comunicaciones esenciales.',
        },
        {
          label: 'Contacto',
          examples: 'Teléfono, email, domicilio, contacto de emergencia.',
          purpose: 'Comunicación clínica y de continuidad de atención.',
        },
        {
          label: 'Datos sensibles de salud',
          examples: 'Antecedentes, atenciones clínicas, diagnósticos, tratamientos, alertas, consentimientos clínicos, adjuntos.',
          purpose: 'Asistencia sanitaria (Ley 21.719 Art 16 lit e + ley sanitaria especial).',
        },
        {
          label: 'Representante legal (NNA)',
          examples: 'Nombre, RUT, parentesco y contacto del padre, madre o tutor.',
          purpose: 'Ejercicio del consentimiento parental para menores de edad (Ley 21.719 Art 16 quáter).',
        },
        {
          label: 'Trazabilidad operativa',
          examples: 'Logs de auditoría (entidad, acción, usuario, timestamp).',
          purpose: 'Cumplimiento del Art 14 quinquies y respaldo de operaciones.',
        },
      ],
      contactEmail: 'allopze@gmail.com',
      footerNote: `${DEV_ONLY_LEGAL_MARKER}: este documento es un borrador estructural con los 12 elementos del Art 14 ter marcados [PENDIENTE_ABOGADO]. NO publicar antes de revisión legal.`,
    },
  },
];

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
