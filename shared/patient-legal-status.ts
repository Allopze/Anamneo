export type PatientLegalRequiredActionCode =
  | 'LIFT_DATA_PROCESSING_BLOCK'
  | 'REGISTER_DATA_PROCESSING_CONSENT'
  | 'REVIEW_ACTIVE_DATA_REQUESTS'
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
  hasActiveDataProcessingConsent: boolean | null;
  dataProcessingConsent: {
    id: string;
    legalDocumentVersion: string | null;
    grantedAt: string | Date | null;
    evidenceHash: string | null;
  } | null;
  activeDataRequestCount: number;
  activeDataRequests: Array<{
    id: string;
    requestType: string;
    status: string;
    dueDate: string | Date | null;
  }>;
  legalBlockReason: string | null;
  requiredActions: PatientLegalRequiredAction[];
};

export type PatientLegalStatusInput = {
  blockedAt?: Date | string | null;
  blockedReason?: string | null;
  processingObjections?: unknown;
  hasActiveDataProcessingConsent?: boolean | null;
  dataProcessingConsent?: PatientLegalStatus['dataProcessingConsent'];
  activeDataRequestCount?: number | null;
  activeDataRequests?: PatientLegalStatus['activeDataRequests'] | null;
};

function hasProcessingObjections(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some((entry) => entry === true);
}

export function buildPatientLegalStatus(input: PatientLegalStatusInput): PatientLegalStatus {
  const isBlocked = Boolean(input.blockedAt);
  const requiredActions: PatientLegalRequiredAction[] = [];
  const activeDataRequests = input.activeDataRequests ?? [];

  if (isBlocked) {
    requiredActions.push({
      code: 'LIFT_DATA_PROCESSING_BLOCK',
      label: 'Levantar el bloqueo temporal de tratamiento de datos antes de mutar información clínica.',
      severity: 'blocking',
    });
  }

  if (input.hasActiveDataProcessingConsent === false) {
    requiredActions.push({
      code: 'REGISTER_DATA_PROCESSING_CONSENT',
      label: 'Registrar consentimiento vigente de tratamiento de datos para atención clínica.',
      severity: 'warning',
    });
  }

  const activeDataRequestCount = Math.max(0, input.activeDataRequestCount ?? activeDataRequests.length);
  if (activeDataRequestCount > 0) {
    requiredActions.push({
      code: 'REVIEW_ACTIVE_DATA_REQUESTS',
      label: activeDataRequestCount === 1
        ? 'Revisar 1 solicitud activa de derechos del titular.'
        : `Revisar ${activeDataRequestCount} solicitudes activas de derechos del titular.`,
      severity: 'warning',
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
    hasActiveDataProcessingConsent: input.hasActiveDataProcessingConsent ?? null,
    dataProcessingConsent: input.dataProcessingConsent ?? null,
    activeDataRequestCount,
    activeDataRequests,
    legalBlockReason: isBlocked
      ? input.blockedReason || 'Bloqueo temporal de tratamiento de datos vigente.'
      : null,
    requiredActions,
  };
}
