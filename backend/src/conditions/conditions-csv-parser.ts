import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { mergeUniqueStrings, normalizeConditionName } from './conditions-helpers';
import type {
  ConditionCsvInvalidRow,
  ParsedConditionCsvResult,
  ParsedConditionCsvRow,
} from './conditions-csv.types';

const CSV_HEADERS = ['name', 'synonyms', 'tags'] as const;
const CSV_HEADER_SET = new Set<string>(CSV_HEADERS);
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 300;

type CsvHeader = (typeof CSV_HEADERS)[number];

export function parseConditionCsvBuffer(buffer: Buffer): ParsedConditionCsvResult {
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

  const normalizedHeaders = normalizeHeaders(records[0]);
  const hasHeader = isHeaderRow(normalizedHeaders);
  const invalidRows: ConditionCsvInvalidRow[] = [];
  const parsedRows: ParsedConditionCsvRow[] = [];

  if (hasHeader) {
    assertSupportedHeaders(normalizedHeaders);
    const headerIndexes = buildHeaderIndexes(normalizedHeaders);

    records.slice(1).forEach((record, index) => {
      const parsedRow = parseHeaderRecord(record, headerIndexes, index + 2, invalidRows);
      if (parsedRow) {
        parsedRows.push(parsedRow);
      }
    });
  } else {
    records.forEach((record, index) => {
      const parsedRow = parseLegacyRecord(record, index + 1, invalidRows);
      if (parsedRow) {
        parsedRows.push(parsedRow);
      }
    });
  }

  if (parsedRows.length === 0 && invalidRows.length === 0) {
    throw new BadRequestException('No se encontraron nombres en el CSV');
  }

  const deduplicated = mergeDuplicateRows(parsedRows);

  return {
    detectedFormat: hasHeader ? 'HEADER' : 'LEGACY_SINGLE_COLUMN',
    headers: hasHeader ? normalizedHeaders : ['name'],
    totalRows: hasHeader ? records.length - 1 : records.length,
    validRows: parsedRows.length,
    duplicateRows: deduplicated.duplicateRows,
    invalidRows,
    rows: deduplicated.rows,
  };
}

function normalizeHeaders(row: string[]) {
  return row.map((header) => header.trim().toLowerCase());
}

function isHeaderRow(headers: string[]) {
  return headers.some((header) => CSV_HEADER_SET.has(header));
}

function assertSupportedHeaders(headers: string[]) {
  if (!headers.includes('name')) {
    throw new BadRequestException('El CSV con encabezados debe incluir la columna name');
  }

  const unknownHeaders = headers.filter((header) => header && !CSV_HEADER_SET.has(header));
  if (unknownHeaders.length > 0) {
    throw new BadRequestException(
      `El CSV contiene columnas no soportadas: ${unknownHeaders.join(', ')}`,
    );
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
  const indexes = new Map<CsvHeader, number>();
  for (const header of CSV_HEADERS) {
    const index = headers.indexOf(header);
    if (index >= 0) {
      indexes.set(header, index);
    }
  }
  return indexes;
}

function parseHeaderRecord(
  record: string[],
  headerIndexes: Map<CsvHeader, number>,
  rowNumber: number,
  invalidRows: ConditionCsvInvalidRow[],
) {
  const name = parseName(getRecordValue(record, headerIndexes, 'name'), rowNumber, invalidRows);
  if (!name) {
    return null;
  }

  return {
    rowNumber,
    name,
    synonyms: parseList(getRecordValue(record, headerIndexes, 'synonyms')),
    tags: parseList(getRecordValue(record, headerIndexes, 'tags')),
    normalizedName: normalizeConditionName(name),
  };
}

function parseLegacyRecord(
  record: string[],
  rowNumber: number,
  invalidRows: ConditionCsvInvalidRow[],
) {
  if (record.length !== 1) {
    invalidRows.push({
      rowNumber,
      message: 'El formato sin encabezados admite una sola columna por fila',
    });
    return null;
  }

  const name = parseName(record[0], rowNumber, invalidRows);
  if (!name) {
    return null;
  }

  return {
    rowNumber,
    name,
    synonyms: [],
    tags: [],
    normalizedName: normalizeConditionName(name),
  };
}

function getRecordValue(
  record: string[],
  headerIndexes: Map<CsvHeader, number>,
  header: CsvHeader,
) {
  const index = headerIndexes.get(header);
  return index === undefined ? '' : (record[index] ?? '').trim();
}

function parseName(
  rawValue: string | undefined,
  rowNumber: number,
  invalidRows: ConditionCsvInvalidRow[],
) {
  const name = rawValue?.trim() ?? '';
  if (!name) {
    invalidRows.push({ rowNumber, message: 'La columna name es obligatoria' });
    return null;
  }
  if (name.length < MIN_NAME_LENGTH) {
    invalidRows.push({
      rowNumber,
      message: `El nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres`,
    });
    return null;
  }
  if (name.length > MAX_NAME_LENGTH) {
    invalidRows.push({
      rowNumber,
      message: `El nombre no puede exceder ${MAX_NAME_LENGTH} caracteres`,
    });
    return null;
  }
  return name;
}

function parseList(value: string) {
  if (!value) {
    return [];
  }

  return mergeUniqueStrings([], value.split('|'));
}

function mergeDuplicateRows(rows: ParsedConditionCsvRow[]) {
  const mergedRows = new Map<string, ParsedConditionCsvRow>();
  let duplicateRows = 0;

  for (const row of rows) {
    const existing = mergedRows.get(row.normalizedName);
    if (!existing) {
      mergedRows.set(row.normalizedName, {
        ...row,
        synonyms: [...row.synonyms],
        tags: [...row.tags],
      });
      continue;
    }

    duplicateRows += 1;
    existing.name = row.name;
    existing.synonyms = mergeUniqueStrings(existing.synonyms, row.synonyms);
    existing.tags = mergeUniqueStrings(existing.tags, row.tags);
  }

  return {
    duplicateRows,
    rows: Array.from(mergedRows.values()),
  };
}