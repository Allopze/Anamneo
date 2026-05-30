import { PrismaService } from '../prisma/prisma.service';

function parseDecimal(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toString() : null;
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBloodPressure(value: string | undefined): { systolic: number | null; diastolic: number | null } {
  if (!value) return { systolic: null, diastolic: null };
  const match = value.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!match) return { systolic: null, diastolic: null };
  return {
    systolic: parseInteger(match[1]),
    diastolic: parseInteger(match[2]),
  };
}

export async function syncEncounterVitalSigns(
  prisma: PrismaService,
  params: {
    encounterId: string;
    patientId: string;
    vitalSigns?: Record<string, string>;
  },
) {
  const { encounterId, patientId, vitalSigns } = params;
  if (!(prisma as any).encounterVitalSigns) return;
  if (!vitalSigns || Object.keys(vitalSigns).length === 0) {
    await prisma.encounterVitalSigns.deleteMany({ where: { encounterId } });
    return;
  }
  const pressure = parseBloodPressure(vitalSigns.presionArterial);
  const data = {
    patientId,
    measuredAt: new Date(),
    bloodPressureSystolic: pressure.systolic,
    bloodPressureDiastolic: pressure.diastolic,
    heartRate: parseInteger(vitalSigns.frecuenciaCardiaca),
    respiratoryRate: parseInteger(vitalSigns.frecuenciaRespiratoria),
    temperatureCelsius: parseDecimal(vitalSigns.temperatura),
    oxygenSaturation: parseInteger(vitalSigns.saturacionOxigeno),
    weightKg: parseDecimal(vitalSigns.peso),
    heightCm: parseDecimal(vitalSigns.talla),
    bmi: parseDecimal(vitalSigns.imc),
  };
  await prisma.encounterVitalSigns.upsert({
    where: { encounterId },
    create: {
      encounterId,
      ...data,
    },
    update: data,
  });
}
