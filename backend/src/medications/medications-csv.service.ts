import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseMedicationCsvBuffer } from './medications-csv-parser';
import type {
  MedicationCsvImportResult,
  MedicationCsvInvalidRow,
  MedicationCsvPreviewItem,
  MedicationCsvPreviewResult,
  ParsedMedicationCsvRow,
} from './medications-csv.types';
import { normalizeMedicationName } from './medications-helpers';

const CSV_PREVIEW_LIMIT = 6;

@Injectable()
export class MedicationsCsvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async previewGlobalCsv(buffer: Buffer): Promise<MedicationCsvPreviewResult> {
    const parsed = parseMedicationCsvBuffer(buffer);
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

  async importGlobalCsv(buffer: Buffer, userId?: string): Promise<MedicationCsvImportResult> {
    const parsed = parseMedicationCsvBuffer(buffer);
    if (parsed.invalidRows.length > 0) {
      throw new BadRequestException(this.buildInvalidRowsMessage(parsed.invalidRows));
    }

    const existing = await this.prisma.medicationCatalog.findMany();
    const existingByName = new Map(
      existing.map((medication) => [
        medication.normalizedName || normalizeMedicationName(medication.name),
        medication,
      ]),
    );

    let created = 0;
    let updated = 0;
    let reactivated = 0;

    const operations = parsed.rows.map((row) => {
      const existingMedication = existingByName.get(row.normalizedName);
      if (existingMedication) {
        if (existingMedication.active) {
          updated += 1;
        } else {
          reactivated += 1;
        }

        return this.prisma.medicationCatalog.update({
          where: { id: existingMedication.id },
          data: {
            name: row.name,
            normalizedName: row.normalizedName,
            activeIngredient: row.activeIngredient,
            active: true,
          },
        });
      }

      created += 1;
      return this.prisma.medicationCatalog.create({
        data: {
          name: row.name,
          normalizedName: row.normalizedName,
          activeIngredient: row.activeIngredient,
        },
      });
    });

    await this.prisma.$transaction(operations);

    if (userId) {
      await this.auditService.log({
        entityType: 'MedicationCatalog',
        entityId: 'global-csv',
        userId,
        action: 'UPDATE',
        reason: 'MEDICATION_CSV_IMPORTED',
        diff: {
          scope: 'CSV_IMPORT',
          format: parsed.detectedFormat,
          totalRows: parsed.totalRows,
          validRows: parsed.validRows,
          importableRows: parsed.rows.length,
          duplicateRows: parsed.duplicateRows,
          created,
          updated,
          reactivated,
        },
      });
    }

    return {
      created,
      updated,
      reactivated,
      total: parsed.rows.length,
      duplicateRows: parsed.duplicateRows,
    };
  }

  private async getExistingByNormalizedName() {
    const existing = await this.prisma.medicationCatalog.findMany();
    return new Map(
      existing.map((medication) => [
        medication.normalizedName || normalizeMedicationName(medication.name),
        medication,
      ]),
    );
  }

  private buildPreview(
    rows: ParsedMedicationCsvRow[],
    existingByName: Map<string, { active: boolean }>,
  ) {
    let createCount = 0;
    let updateCount = 0;
    let reactivateCount = 0;

    const previewRows = rows.map((row) => {
      const existingMedication = existingByName.get(row.normalizedName);
      let action: MedicationCsvPreviewItem['action'] = 'CREATE';

      if (existingMedication) {
        if (existingMedication.active) {
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
        activeIngredient: row.activeIngredient,
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

  private buildInvalidRowsMessage(invalidRows: MedicationCsvInvalidRow[]) {
    const details = invalidRows
      .slice(0, 3)
      .map((row) => `fila ${row.rowNumber}: ${row.message}`)
      .join('; ');
    const extra = invalidRows.length > 3 ? ` (+${invalidRows.length - 3} filas)` : '';
    return `El CSV tiene ${invalidRows.length} fila(s) invalida(s): ${details}${extra}`;
  }
}