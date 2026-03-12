import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '../src/prisma/resolve-database-url';

const prisma = new PrismaClient({
  ...(process.env.DATABASE_URL ? { datasourceUrl: resolveDatabaseUrl(process.env.DATABASE_URL) } : {}),
});

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

  // Create conditions catalog only (no demo users)
  console.log('Creating condition catalog...');
  for (const condition of conditions) {
    const existing = await prisma.conditionCatalog.findFirst({
      where: { name: condition.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.conditionCatalog.update({
        where: { id: existing.id },
        data: {
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
