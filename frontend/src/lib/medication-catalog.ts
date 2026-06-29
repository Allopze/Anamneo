type MedicationCatalogDefaults = {
  defaultDose?: string;
  defaultRoute?: string;
  defaultFrequency?: string;
};

export const MEDICATION_ROUTE_LABELS: Record<string, string> = {
  ORAL: 'Oral',
  IV: 'IV',
  IM: 'IM',
  SC: 'SC',
  TOPICA: 'Tópica',
  INHALATORIA: 'Inhalatoria',
  RECTAL: 'Rectal',
  SUBLINGUAL: 'Sublingual',
  OFTALMICA: 'Oftálmica',
  OTRA: 'Otra',
};

export const MEDICATION_ROUTE_OPTIONS = Object.entries(MEDICATION_ROUTE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function formatMedicationCatalogDefaults(item: MedicationCatalogDefaults) {
  const parts = [
    item.defaultDose?.trim(),
    item.defaultRoute ? MEDICATION_ROUTE_LABELS[item.defaultRoute] ?? item.defaultRoute : null,
    item.defaultFrequency?.trim(),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : null;
}