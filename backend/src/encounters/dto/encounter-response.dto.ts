/**
 * Response DTOs for Encounter endpoints.
 * These document the explicit allowlist fields returned by the service layer.
 * They are NOT used for validation — only for contract documentation and typing.
 */
import { PatientTaskResponseDto, UserRefDto } from '../../patients/dto/patient-response.dto';

export class EncounterProgressDto {
  completed: number;
  total: number;
}

export class EncounterListPatientDto {
  id: string;
  rut: string | null;
  nombre: string;
  fechaNacimiento: string | null;
  edad: number | null;
  sexo: string | null;
  prevision: string | null;
  registrationMode: string;
  completenessStatus: string;
  demographicsMissingFields: string[];
}

export class EncounterListItemDto {
  id: string;
  patientId: string;
  status: string;
  reviewStatus: string | null;
  reviewRequestedAt: Date | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  completedAt: Date | null;
  closureNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  patient?: EncounterListPatientDto;
  createdBy?: UserRefDto;
  reviewRequestedBy?: UserRefDto;
  reviewedBy?: UserRefDto;
  completedBy?: UserRefDto;
  progress: EncounterProgressDto;
}

export class EncounterListResponseDto {
  data: EncounterListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class EncounterSectionResponseDto {
  id: string;
  encounterId: string;
  sectionKey: string;
  completed: boolean;
  notApplicable: boolean;
  notApplicableReason: string | null;
  updatedAt: Date;
  data: any;
  schemaVersion?: number;
  label: string;
  order: number;
}

export class EncounterClinicalOutputBlockDto {
  completenessStatus: string;
  missingFields: string[];
  blockedActions: string[];
  reason: string;
}

export class EncounterIdentificationSnapshotStatusDto {
  isSnapshot: boolean;
  hasDifferences: boolean;
  differingFields: string[];
  differingFieldLabels: string[];
  snapshotCreatedAt: Date;
  sourcePatientUpdatedAt?: Date | null;
}

export class EncounterSignatureResponseDto {
  id: string;
  encounterId: string;
  userId: string;
  signatureType: string;
  contentHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}

export class EncounterAttachmentResponseDto {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  category: string | null;
  description: string | null;
  linkedOrderType: string | null;
  linkedOrderId: string | null;
  linkedOrderLabel: string | null;
  uploadedAt: Date;
}

export class EncounterConsentGrantedByDto {
  nombre: string;
}

export class EncounterConsentResponseDto {
  id: string;
  patientId: string;
  encounterId: string | null;
  type: string;
  description: string;
  status: string;
  grantedAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  grantedBy: EncounterConsentGrantedByDto | null;
}

export class EncounterSignatureBaselineResponseDto {
  id: string;
  status: string;
  createdAt: Date;
  closureNote: string | null;
  attachments: EncounterAttachmentResponseDto[];
  sections: EncounterSectionResponseDto[];
}

export class EncounterDetailPatientDto {
  id: string;
  rut: string | null;
  rutExempt: boolean;
  rutExemptReason: string | null;
  nombre: string;
  fechaNacimiento: string | null;
  edad: number | null;
  edadMeses: number | null;
  sexo: string | null;
  trabajo: string | null;
  prevision: string | null;
  registrationMode: string;
  completenessStatus: string;
  demographicsVerifiedAt: Date | null;
  domicilio: string | null;
  centroMedico: string | null;
  createdAt: Date;
  updatedAt: Date;
  demographicsMissingFields: string[];
  history?: any;
  problems?: any[];
  tasks?: PatientTaskResponseDto[];
}

export class EncounterDetailResponseDto {
  id: string;
  patientId: string;
  status: string;
  reviewStatus: string | null;
  reviewRequestedAt: Date | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  completedAt: Date | null;
  closureNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  clinicalOutputBlock: EncounterClinicalOutputBlockDto | null;
  identificationSnapshotStatus: EncounterIdentificationSnapshotStatusDto | null;
  createdBy?: UserRefDto;
  medico?: UserRefDto;
  reviewRequestedBy?: UserRefDto;
  reviewedBy?: UserRefDto;
  completedBy?: UserRefDto;
  signatures?: EncounterSignatureResponseDto[];
  attachments?: EncounterAttachmentResponseDto[];
  consents?: EncounterConsentResponseDto[];
  signatureBaseline?: EncounterSignatureBaselineResponseDto | null;
  patient?: EncounterDetailPatientDto;
  tasks: PatientTaskResponseDto[];
  sections: EncounterSectionResponseDto[];
}

export class EncounterSectionUpdateResponseDto {
  id: string;
  encounterId: string;
  sectionKey: string;
  completed: boolean;
  notApplicable: boolean;
  notApplicableReason: string | null;
  updatedAt: Date;
  data: any;
  schemaVersion: number;
  warnings?: string[];
}
