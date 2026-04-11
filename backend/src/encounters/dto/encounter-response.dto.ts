/**
 * Response DTOs for Encounter endpoints.
 * These document the explicit allowlist fields returned by the service layer.
 * They are NOT used for validation — only for contract documentation and typing.
 */
import { PatientTaskResponseDto, UserRefDto } from '../patients/dto/patient-response.dto';

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
  updatedAt: Date;
  data: any;
  schemaVersion?: number;
  label: string;
  order: number;
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
  clinicalOutputBlock: string | null;
  identificationSnapshotStatus: string | null;
  createdBy?: UserRefDto;
  medico?: UserRefDto;
  reviewRequestedBy?: UserRefDto;
  reviewedBy?: UserRefDto;
  completedBy?: UserRefDto;
  signatures?: any[];
  attachments?: any[];
  consents?: any[];
  patient?: EncounterDetailPatientDto;
  tasks: PatientTaskResponseDto[];
  sections: EncounterSectionResponseDto[];
}

export class EncounterSectionUpdateResponseDto {
  id: string;
  encounterId: string;
  sectionKey: string;
  completed: boolean;
  updatedAt: Date;
  data: any;
  schemaVersion: number;
}
