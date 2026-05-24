export type PatientLegalRequiredActionCode =
  | 'LIFT_DATA_PROCESSING_BLOCK'
  | 'REVIEW_PROCESSING_OBJECTIONS';

export type PatientLegalRequiredAction = {
  code: PatientLegalRequiredActionCode;
  label: string;
  severity: 'warning' | 'blocking';
};

export type PatientLegalStatus = {
  canReceiveCare: boolean;
  canCreateEncounter: boolean;
  canEditEncounter: boolean;
  canUploadAttachment: boolean;
  canRegisterClinicalConsent: boolean;
  canRegisterDataProcessingConsent: boolean;
  legalBlockReason: string | null;
  requiredActions: PatientLegalRequiredAction[];
};

export type PatientLegalStatusInput = {
  blockedAt?: Date | string | null;
  blockedReason?: string | null;
  processingObjections?: unknown;
};

function hasProcessingObjections(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some((entry) => entry === true);
}

export function buildPatientLegalStatus(input: PatientLegalStatusInput): PatientLegalStatus {
  const isBlocked = Boolean(input.blockedAt);
  const requiredActions: PatientLegalRequiredAction[] = [];

  if (isBlocked) {
    requiredActions.push({
      code: 'LIFT_DATA_PROCESSING_BLOCK',
      label: 'Levantar el bloqueo temporal de tratamiento de datos antes de mutar información clínica.',
      severity: 'blocking',
    });
  }

  if (hasProcessingObjections(input.processingObjections)) {
    requiredActions.push({
      code: 'REVIEW_PROCESSING_OBJECTIONS',
      label: 'Revisar oposiciones vigentes del titular antes de usar datos para finalidades no asistenciales.',
      severity: 'warning',
    });
  }

  return {
    canReceiveCare: !isBlocked,
    canCreateEncounter: !isBlocked,
    canEditEncounter: !isBlocked,
    canUploadAttachment: !isBlocked,
    canRegisterClinicalConsent: !isBlocked,
    canRegisterDataProcessingConsent: !isBlocked,
    legalBlockReason: isBlocked
      ? input.blockedReason || 'Bloqueo temporal de tratamiento de datos vigente.'
      : null,
    requiredActions,
  };
}
