/**
 * Response DTOs for Patient endpoints.
 * These document the explicit allowlist fields returned by the service layer.
 * They are NOT used for validation — only for contract documentation and typing.
 */

export class UserRefDto {
  id: string;
  nombre: string;
}

export class PatientRefDto {
  id: string;
  nombre: string;
  rut: string | null;
}

export class ProblemEncounterRefDto {
  id: string;
  createdAt: Date;
  status: string;
}

export class PatientProblemResponseDto {
  id: string;
  patientId: string;
  encounterId: string | null;
  createdById: string | null;
  label: string;
  status: string;
  notes: string | null;
  severity: string | null;
  onsetDate: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  encounter?: ProblemEncounterRefDto | null;
  createdBy?: UserRefDto | null;
}

export class PatientTaskResponseDto {
  id: string;
  patientId: string;
  encounterId: string | null;
  title: string;
  details: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isOverdue?: boolean;
  createdBy?: UserRefDto;
  patient?: PatientRefDto;
}

export class PatientResponseDto {
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
  demographicsVerifiedById: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  centroMedico: string | null;
  createdAt: Date;
  updatedAt: Date;
  demographicsMissingFields: string[];

  // Conditionally included based on query includes
  history?: any;
  problems?: PatientProblemResponseDto[];
  tasks?: PatientTaskResponseDto[];
  encounters?: any[];
  _count?: { encounters: number };
}

export class PatientListSummaryDto {
  totalPatients: number;
  incomplete: number;
  pendingVerification: number;
  verified: number;
  nonVerified: number;
}

export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  clinicalSearchCapped?: boolean;
}

export class PatientListResponseDto {
  data: PatientResponseDto[];
  summary: PatientListSummaryDto;
  pagination: PaginationDto;
}
