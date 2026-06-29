import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type {
  MedicationCsvInvalidRow,
  ParsedMedicationCsvResult,
  ParsedMedicationCsvRow,
} from './medications-csv.types';
import {
  assertSupportedHeaders,
  buildHeaderIndexes,
  mergeDuplicateRows,
  normalizeHeaders,
  parseRecord,
} from './medications-csv-parser.helpers';

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
