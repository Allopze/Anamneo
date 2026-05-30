import { SectionKey } from '../common/types';
import { withPatientIdentifiers } from '../patients/patients-identifiers';
import { buildAnamnesisRemotaSnapshotFromHistory } from './encounters-sanitize';

export function buildInitialEncounterSectionData(
  key: SectionKey,
  patient: {
    nombreEnc?: string | null;
    edad: number | null;
    edadMeses: number | null;
    sexo: string | null;
    trabajo: string | null;
    prevision: string | null;
    domicilioEnc?: string | null;
    rutEnc?: string | null;
    rutExempt: boolean;
    rutExemptReason: string | null;
    history?: Record<string, unknown> | null;
  },
) {
  if (key === 'IDENTIFICACION') {
    const identifiers = withPatientIdentifiers(patient);
    return {
      nombre: identifiers.nombre,
      edad: patient.edad,
      edadMeses: patient.edadMeses ?? undefined,
      sexo: patient.sexo,
      trabajo: patient.trabajo || '',
      prevision: patient.prevision,
      domicilio: identifiers.domicilio || '',
      rut: identifiers.rut || '',
      rutExempt: patient.rutExempt,
      rutExemptReason: patient.rutExemptReason || '',
    };
  }
  if (key === 'ANAMNESIS_REMOTA' && patient.history) {
    return buildAnamnesisRemotaSnapshotFromHistory(patient.history);
  }
  return {};
}
