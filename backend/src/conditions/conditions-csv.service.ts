import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConditionsSimilarityService } from './conditions-similarity.service';
import { mergeUniqueStrings, normalizeConditionName, parseStringArray } from './conditions-helpers';
import { parseConditionCsvBuffer } from './conditions-csv-parser';
import type {
  ConditionCsvImportResult,
  ConditionCsvInvalidRow,
  ConditionCsvPreviewItem,
  ConditionCsvPreviewResult,
  ParsedConditionCsvRow,
} from './conditions-csv.types';

const CSV_PREVIEW_LIMIT = 6;

@Injectable()
export class ConditionsCsvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly similarityService: ConditionsSimilarityService,
  ) {}

  async previewGlobalCsv(buffer: Buffer): Promise<ConditionCsvPreviewResult> {
    const parsed = parseConditionCsvBuffer(buffer);
    const existingByName = await this.getExistingByNormalizedName();
    const preview = this.buildPreview(parsed.rows, existingByName);

    return {
      detectedFormat: parsed.detectedFormat,
      headers: parsed.headers,
      totalRows: parsed.totalRows,
      validRows: parsed.validRows,
      importableRows: parsed.rows.length,
      duplicateRows: parsed.duplicateRows,
      createCount: preview.createCount,
      updateCount: preview.updateCount,
      reactivateCount: preview.reactivateCount,
      invalidRows: parsed.invalidRows,
      preview: preview.rows.slice(0, CSV_PREVIEW_LIMIT),
    };
  }

  async importGlobalCsv(buffer: Buffer): Promise<ConditionCsvImportResult> {
    const parsed = parseConditionCsvBuffer(buffer);
    if (parsed.invalidRows.length > 0) {
      throw new BadRequestException(this.buildInvalidRowsMessage(parsed.invalidRows));
    }

    const existing = await this.prisma.conditionCatalog.findMany();
    const existingByName = new Map(existing.map((condition) => [
      normalizeConditionName(condition.name),
      condition,
    ]));

    let created = 0;
    let updated = 0;
    let reactivated = 0;

    const operations = parsed.rows.map((row) => {
      const existingCondition = existingByName.get(row.normalizedName);
      if (existingCondition) {
        const nextSynonyms = mergeUniqueStrings(
          parseStringArray(existingCondition.synonyms),
          row.synonyms,
        );
        const nextTags = mergeUniqueStrings(parseStringArray(existingCondition.tags), row.tags);

        if (existingCondition.active) {
          updated += 1;
        } else {
          reactivated += 1;
        }

        return this.prisma.conditionCatalog.update({
          where: { id: existingCondition.id },
          data: {
            name: row.name,
            synonyms: JSON.stringify(nextSynonyms),
            tags: JSON.stringify(nextTags),
            active: true,
          },
        });
      }

      created += 1;
      return this.prisma.conditionCatalog.create({
        data: {
          name: row.name,
          synonyms: JSON.stringify(row.synonyms),
          tags: JSON.stringify(row.tags),
        },
      });
    });

    await this.prisma.$transaction(operations);
    await this.similarityService.buildIndex();

    return {
      created,
      updated,
      reactivated,
      total: parsed.rows.length,
      duplicateRows: parsed.duplicateRows,
    };
  }

  private async getExistingByNormalizedName() {
    const existing = await this.prisma.conditionCatalog.findMany();
    return new Map(existing.map((condition) => [normalizeConditionName(condition.name), condition]));
  }

  private buildPreview(
    rows: ParsedConditionCsvRow[],
    existingByName: Map<string, { active: boolean }>,
  ) {
    let createCount = 0;
    let updateCount = 0;
    let reactivateCount = 0;

    const previewRows = rows.map((row) => {
      const existingCondition = existingByName.get(row.normalizedName);
      let action: ConditionCsvPreviewItem['action'] = 'CREATE';

      if (existingCondition) {
        if (existingCondition.active) {
          action = 'UPDATE';
          updateCount += 1;
        } else {
          action = 'REACTIVATE';
          reactivateCount += 1;
        }
      } else {
        createCount += 1;
      }

      return {
        rowNumber: row.rowNumber,
        name: row.name,
        synonyms: row.synonyms,
        tags: row.tags,
        action,
      };
    });

    return {
      createCount,
      updateCount,
      reactivateCount,
      rows: previewRows,
    };
  }

  private buildInvalidRowsMessage(invalidRows: ConditionCsvInvalidRow[]) {
    const details = invalidRows
      .slice(0, 3)
      .map((row) => `fila ${row.rowNumber}: ${row.message}`)
      .join('; ');
    const extra = invalidRows.length > 3 ? ` (+${invalidRows.length - 3} filas)` : '';
    return `El CSV tiene ${invalidRows.length} fila(s) invalida(s): ${details}${extra}`;
  }
}