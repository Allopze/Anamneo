export interface ParsedMedicationCsvRow {
  rowNumber: number;
  name: string;
  activeIngredient: string;
  defaultDose?: string;
  defaultRoute?: string;
  defaultFrequency?: string;
  normalizedName: string;
}

export interface MedicationCsvInvalidRow {
  rowNumber: number;
  message: string;
}

export interface ParsedMedicationCsvResult {
  detectedFormat: 'HEADER';
  headers: string[];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: MedicationCsvInvalidRow[];
  rows: ParsedMedicationCsvRow[];
}

export interface MedicationCsvPreviewItem {
  rowNumber: number;
  name: string;
  activeIngredient: string;
  defaultDose?: string;
  defaultRoute?: string;
  defaultFrequency?: string;
  action: 'CREATE' | 'UPDATE' | 'REACTIVATE';
}

export interface MedicationCsvPreviewResult {
  detectedFormat: 'HEADER';
  headers: string[];
  totalRows: number;
  validRows: number;
  importableRows: number;
  duplicateRows: number;
  createCount: number;
  updateCount: number;
  reactivateCount: number;
  invalidRows: MedicationCsvInvalidRow[];
  preview: MedicationCsvPreviewItem[];
}

export interface MedicationCsvImportResult {
  created: number;
  updated: number;
  reactivated: number;
  total: number;
  duplicateRows: number;
}