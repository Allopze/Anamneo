import { format } from 'date-fns';
import type { Encounter } from '@/types';

export const ESTADO_GENERAL_LABELS: Record<string, string> = {
  BUEN_ESTADO: 'Buen estado general',
  REGULAR_ESTADO: 'Regular estado general',
  MAL_ESTADO: 'Mal estado general',
};

export function fallbackPdfFilename(encounter: Encounter | undefined, kind: 'pdf' | 'receta' | 'ordenes' | 'derivacion') {
  const patientName = (encounter?.patient?.nombre || 'Paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim();
  const encounterDate = encounter?.createdAt
    ? format(new Date(encounter.createdAt), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  if (kind === 'pdf') {
    return `${patientName} - ${encounterDate}.pdf`;
  }
  return `${patientName} - ${kind} - ${encounterDate}.pdf`;
}

export function getFilenameFromDisposition(value?: string) {
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
