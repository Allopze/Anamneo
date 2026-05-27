export interface ParsedConditionCsvRow {
  rowNumber: number;
  name: string;
  cieCode?: string | null;
  synonyms: string[];
  tags: string[];
  active?: boolean;
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
  cieCode?: string | null;
  synonyms: string[];
  tags: string[];
  active?: boolean;
  action: 'CREATE' | 'UPDATE' | 'REACTIVATE' | 'DEACTIVATE';
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
  deactivateCount: number;
  invalidRows: ConditionCsvInvalidRow[];
  preview: ConditionCsvPreviewItem[];
}

export interface ConditionCsvImportResult {
  created: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  total: number;
  duplicateRows: number;
}
