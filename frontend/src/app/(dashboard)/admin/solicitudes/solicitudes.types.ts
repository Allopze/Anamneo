export interface DataRequest {
  id: string;
  patientId: string | null;
  requestType: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
  dueDate: string;
  prorrogaDueDate: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterRut: string | null;
  identityVerificationMethod: string | null;
  identityVerificationEvidence: unknown | null;
  payloadRequest: string;
  payloadResponse: unknown | null;
  resolutionNote: string | null;
}

export const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'RECIBIDA', label: 'Recibidas' },
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'RESUELTA_ACEPTADA', label: 'Resueltas (aceptadas)' },
  { value: 'RESUELTA_RECHAZADA', label: 'Resueltas (rechazadas)' },
  { value: 'VENCIDA', label: 'Vencidas' },
];

export interface ExportDelivery {
  downloadId?: string;
  expiresAt?: string;
  maxDownloads?: number;
  fileSha256?: string;
}

export type DecisionKind = 'resolve-accept' | 'resolve-reject' | 'extend' | 'revoke';

export interface PendingDecision {
  kind: DecisionKind;
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  confirmLabel: string;
  minLength: number;
  downloadId?: string;
}

export function getExportDelivery(payload: unknown): ExportDelivery | null {
  if (!payload || typeof payload !== 'object' || !('exportDelivery' in payload)) return null;
  const delivery = (payload as { exportDelivery?: unknown }).exportDelivery;
  if (!delivery || typeof delivery !== 'object') return null;
  return delivery as ExportDelivery;
}
