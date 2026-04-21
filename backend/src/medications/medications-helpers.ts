export function normalizeMedicationName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeMedicationSearchValue(value: string) {
  return normalizeMedicationName(value);
}

export function toMedicationResponse(medication: {
  id: string;
  name: string;
  activeIngredient: string;
  defaultDose?: string | null;
  defaultRoute?: string | null;
  defaultFrequency?: string | null;
  active: boolean;
}) {
  return {
    id: medication.id,
    name: medication.name,
    activeIngredient: medication.activeIngredient,
    ...(medication.defaultDose ? { defaultDose: medication.defaultDose } : {}),
    ...(medication.defaultRoute ? { defaultRoute: medication.defaultRoute } : {}),
    ...(medication.defaultFrequency ? { defaultFrequency: medication.defaultFrequency } : {}),
    active: medication.active,
  };
}