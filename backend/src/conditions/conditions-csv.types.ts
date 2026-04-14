export interface ParsedConditionCsvRow {
  rowNumber: number;
  name: string;
  synonyms: string[];
  tags: string[];
  normalizedName: string;
}

export interface ParsedConditionCsvResult {
  detectedFormat: 'HEADER' | 'LEGACY_SINGLE_COLUMN';
  headers: string[];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: ConditionCsvInvalidRow[];
  rows: ParsedConditionCsvRow[];
}

export interface ConditionCsvInvalidRow {
  rowNumber: number;
  message: string;
}

export interface ConditionCsvPreviewItem {
  rowNumber: number;
  name: string;
  synonyms: string[];
  tags: string[];
  action: 'CREATE' | 'UPDATE' | 'REACTIVATE';
}

export interface ConditionCsvPreviewResult {
  detectedFormat: 'HEADER' | 'LEGACY_SINGLE_COLUMN';
  headers: string[];
  totalRows: number;
  validRows: number;
  importableRows: number;
  duplicateRows: number;
  createCount: number;
  updateCount: number;
  reactivateCount: number;
  invalidRows: ConditionCsvInvalidRow[];
  preview: ConditionCsvPreviewItem[];
}

export interface ConditionCsvImportResult {
  created: number;
  updated: number;
  reactivated: number;
  total: number;
  duplicateRows: number;
}