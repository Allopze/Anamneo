import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { normalizeMedicationName } from './medications-helpers';
import type {
  MedicationCsvInvalidRow,
  ParsedMedicationCsvResult,
  ParsedMedicationCsvRow,
} from './medications-csv.types';

const HEADER_ALIASES = new Map<string, 'name' | 'activeIngredient'>([
  ['name', 'name'],
  ['nombre', 'name'],
  ['activeingredient', 'activeIngredient'],
  ['principioactivo', 'activeIngredient'],
]);
const REQUIRED_HEADERS = ['name', 'activeIngredient'] as const;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 300;

type CanonicalHeader = (typeof REQUIRED_HEADERS)[number];

export function parseMedicationCsvBuffer(buffer: Buffer): ParsedMedicationCsvResult {
  const content = buffer.toString('utf-8');
  if (!content.trim()) {
    throw new BadRequestException('El CSV esta vacio');
  }

  let records: string[][];
  try {
    records = parse(content, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Formato CSV invalido';
    throw new BadRequestException(`No se pudo leer el CSV: ${message}`);
  }

  if (records.length === 0) {
    throw new BadRequestException('El CSV esta vacio');
  }

  const headers = normalizeHeaders(records[0]);
  if (headers.length === 0) {
    throw new BadRequestException('El CSV debe incluir encabezados');
  }

  assertSupportedHeaders(headers);
  const headerIndexes = buildHeaderIndexes(headers);
  const invalidRows: MedicationCsvInvalidRow[] = [];
  const parsedRows: ParsedMedicationCsvRow[] = [];

  records.slice(1).forEach((record, index) => {
    const parsedRow = parseRecord(record, headerIndexes, index + 2, invalidRows);
    if (parsedRow) {
      parsedRows.push(parsedRow);
    }
  });

  if (parsedRows.length === 0 && invalidRows.length === 0) {
    throw new BadRequestException('No se encontraron medicamentos en el CSV');
  }

  const deduplicated = mergeDuplicateRows(parsedRows);

  return {
    detectedFormat: 'HEADER',
    headers,
    totalRows: records.length - 1,
    validRows: parsedRows.length,
    duplicateRows: deduplicated.duplicateRows,
    invalidRows,
    rows: deduplicated.rows,
  };
}

function normalizeHeaders(row: string[]) {
  return row.map((header) => {
    const normalizedHeader = header.trim().toLowerCase();
    return HEADER_ALIASES.get(normalizedHeader) ?? normalizedHeader;
  });
}

function assertSupportedHeaders(headers: string[]) {
  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      throw new BadRequestException(`El CSV debe incluir la columna ${requiredHeader}`);
    }
  }

  const unknownHeaders = headers.filter((header) => header && !REQUIRED_HEADERS.includes(header as CanonicalHeader));
  if (unknownHeaders.length > 0) {
    throw new BadRequestException(`El CSV contiene columnas no soportadas: ${unknownHeaders.join(', ')}`);
  }

  const duplicatedHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicatedHeaders.length > 0) {
    throw new BadRequestException(
      `El CSV repite columnas: ${Array.from(new Set(duplicatedHeaders)).join(', ')}`,
    );
  }
}

function buildHeaderIndexes(headers: string[]) {
  const indexes = new Map<CanonicalHeader, number>();
  for (const header of REQUIRED_HEADERS) {
    const index = headers.indexOf(header);
    if (index >= 0) {
      indexes.set(header, index);
    }
  }
  return indexes;
}

function parseRecord(
  record: string[],
  headerIndexes: Map<CanonicalHeader, number>,
  rowNumber: number,
  invalidRows: MedicationCsvInvalidRow[],
) {
  const name = parseRequiredText(
    getRecordValue(record, headerIndexes, 'name'),
    rowNumber,
    invalidRows,
    'name',
  );
  const activeIngredient = parseRequiredText(
    getRecordValue(record, headerIndexes, 'activeIngredient'),
    rowNumber,
    invalidRows,
    'activeIngredient',
  );

  if (!name || !activeIngredient) {
    return null;
  }

  return {
    rowNumber,
    name,
    activeIngredient,
    normalizedName: normalizeMedicationName(name),
  };
}

function getRecordValue(
  record: string[],
  headerIndexes: Map<CanonicalHeader, number>,
  header: CanonicalHeader,
) {
  const index = headerIndexes.get(header);
  return index === undefined ? '' : (record[index] ?? '').trim();
}

function parseRequiredText(
  rawValue: string | undefined,
  rowNumber: number,
  invalidRows: MedicationCsvInvalidRow[],
  field: 'name' | 'activeIngredient',
) {
  const value = rawValue?.trim() ?? '';
  if (!value) {
    invalidRows.push({ rowNumber, message: `La columna ${field} es obligatoria` });
    return null;
  }
  if (value.length < MIN_NAME_LENGTH) {
    invalidRows.push({
      rowNumber,
      message: `La columna ${field} debe tener al menos ${MIN_NAME_LENGTH} caracteres`,
    });
    return null;
  }
  if (value.length > MAX_NAME_LENGTH) {
    invalidRows.push({
      rowNumber,
      message: `La columna ${field} no puede exceder ${MAX_NAME_LENGTH} caracteres`,
    });
    return null;
  }

  return value;
}

function mergeDuplicateRows(rows: ParsedMedicationCsvRow[]) {
  const rowsByName = new Map<string, ParsedMedicationCsvRow>();
  let duplicateRows = 0;

  for (const row of rows) {
    const existing = rowsByName.get(row.normalizedName);
    if (!existing) {
      rowsByName.set(row.normalizedName, row);
      continue;
    }

    duplicateRows += 1;
    rowsByName.set(row.normalizedName, row);
  }

  return {
    duplicateRows,
    rows: Array.from(rowsByName.values()),
  };
}