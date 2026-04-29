import { api } from '@/lib/api';
import { STATUS_LABELS } from '@/types';

export type SearchResult = {
  id: string;
  type: 'patient' | 'encounter';
  title: string;
  subtitle: string;
  href: string;
};

export async function fetchClinicalSearchResults(
  query: string,
  options?: { signal?: AbortSignal; limit?: number },
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const limit = options?.limit ?? 5;
  const encodedQuery = encodeURIComponent(trimmedQuery);
  const [patientsRes, encountersRes] = await Promise.allSettled([
    api.get(`/patients?search=${encodedQuery}&limit=${limit}`, { signal: options?.signal }),
    api.get(`/encounters?search=${encodedQuery}&limit=${limit}`, { signal: options?.signal }),
  ]);

  const items: SearchResult[] = [];

  if (patientsRes.status === 'fulfilled' && patientsRes.value.data?.data) {
    for (const patient of patientsRes.value.data.data) {
      items.push({
        id: patient.id,
        type: 'patient',
        title: patient.nombre,
        subtitle: patient.rut || 'Sin RUT',
        href: `/pacientes/${patient.id}`,
      });
    }
  }

  if (encountersRes.status === 'fulfilled' && encountersRes.value.data?.data) {
    for (const encounter of encountersRes.value.data.data) {
      items.push({
        id: encounter.id,
        type: 'encounter',
        title: encounter.patient?.nombre || 'Atención',
        subtitle: `${STATUS_LABELS[encounter.status] || encounter.status} — ${new Date(
          encounter.createdAt,
        ).toLocaleDateString('es-CL')}`,
        href: `/atenciones/${encounter.id}`,
      });
    }
  }

  return items;
}
