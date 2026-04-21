import { api } from '@/lib/api';
import type { Patient } from '@/types';

export type TaskUpdatePayload = {
  title?: string;
  details?: string;
  type?: string;
  priority?: string;
  status?: string;
  recurrenceRule?: string;
  dueDate?: string | null;
};

export function normalizeTaskUpdatePayload(payload: TaskUpdatePayload): TaskUpdatePayload {
  if (!Object.prototype.hasOwnProperty.call(payload, 'dueDate')) {
    return payload;
  }

  return {
    ...payload,
    dueDate: payload.dueDate ? payload.dueDate : null,
  };
}

function getFilenameFromDisposition(value?: string) {
  if (!value) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const classicMatch = /filename="?([^"]+)"?/i.exec(value);
  return classicMatch?.[1] || null;
}

function buildSafePatientName(patient: Patient) {
  return (patient.nombre || 'Paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim();
}

export async function downloadPatientHistoryPdf(patientId: string, patient: Patient) {
  const response = await api.get(`/patients/${patientId}/export/pdf`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = buildSafePatientName(patient);
  link.download = `${safeName} - Historial.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadPatientExportBundle(patientId: string, patient: Patient) {
  const response = await api.get(`/patients/${patientId}/export/bundle`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/zip' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFilenameFromDisposition(response.headers['content-disposition'])
    || `${buildSafePatientName(patient)} - Paquete clinico.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
