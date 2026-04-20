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
  active: boolean;
}) {
  return {
    id: medication.id,
    name: medication.name,
    activeIngredient: medication.activeIngredient,
    active: medication.active,
  };
}