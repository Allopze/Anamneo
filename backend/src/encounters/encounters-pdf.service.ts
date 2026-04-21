import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import * as PDFDocument from 'pdfkit';
import {
  assertEncounterClinicalOutputAllowed,
} from '../common/utils/patient-completeness';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import {
  buildEncounterDocumentFilename,
} from './encounters-pdf.helpers';
import { renderEncounterClinicalPdf, renderFocusedEncounterPdf } from './encounters-pdf.renderers';

@Injectable()
export class EncountersPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async loadEncounterForPdf(encounterId: string, user: RequestUser, requireCompletedStatus = true) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id: encounterId,
        medicoId: effectiveMedicoId,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { nombre: true, email: true } },
      },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    assertEncounterClinicalOutputAllowed(encounter.patient, 'EXPORT_OFFICIAL_DOCUMENTS');

    if (requireCompletedStatus) {
      if (encounter.status !== 'COMPLETADO' && encounter.status !== 'FIRMADO') {
        throw new BadRequestException(
          'Solo se pueden emitir documentos clínicos oficiales desde atenciones completadas o firmadas',
        );
      }
    }

    return encounter;
  }

  private buildSectionsMap(sections: Array<{ sectionKey: string; data: any; schemaVersion?: number | null }>) {
    const sectionsMap: Record<string, any> = {};
    for (const section of sections) {
      const normalizedSection = formatEncounterSectionForRead(section);
      sectionsMap[section.sectionKey] = normalizedSection.data || {};
    }

    return sectionsMap;
  }

  async getPdfFilename(encounterId: string, user: RequestUser) {
    const encounter = await this.loadEncounterForPdf(encounterId, user);
    return buildEncounterDocumentFilename(encounter, 'ficha_clinica');
  }

  async getFocusedPdfFilename(
    encounterId: string,
    kind: 'receta' | 'ordenes' | 'derivacion',
    user: RequestUser,
  ) {
    const encounter = await this.loadEncounterForPdf(encounterId, user, false);
    return buildEncounterDocumentFilename(encounter, kind);
  }

  private async buildDocumentBuffer(
    title: string,
    author: string,
    render: (doc: PDFKit.PDFDocument, pageWidth: number) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        bufferPages: true,
        info: {
          Title: title,
          Author: author,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      render(doc, pageWidth);

      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .font('Helvetica')
          .text(
            `Página ${i + 1} de ${totalPages}`,
            doc.page.margins.left,
            doc.page.height - 35,
            {
              width: pageWidth,
              align: 'center',
              lineBreak: false,
            },
          );
      }

      doc.end();
    });
  }

  async generatePdf(encounterId: string, user: RequestUser): Promise<Buffer> {
    const encounter = await this.loadEncounterForPdf(encounterId, user);
    const sectionsMap = this.buildSectionsMap(encounter.sections);
    const pdfBuffer = await this.buildDocumentBuffer(
      `Ficha Clínica - ${encounter.patient.nombre}`,
      encounter.createdBy?.nombre || 'Sistema',
      (doc, pageWidth) => {
        renderEncounterClinicalPdf(doc, pageWidth, encounter, sectionsMap);
      },
    );

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: encounter.id,
      userId: user.id,
      action: 'EXPORT',
      diff: {
        export: {
          document: 'ficha_clinica_pdf',
          encounterId: encounter.id,
          patientId: encounter.patientId,
          reviewStatus: encounter.reviewStatus,
        },
      },
    });

    return pdfBuffer;
  }

  async generateFocusedPdf(
    encounterId: string,
    kind: 'receta' | 'ordenes' | 'derivacion',
    user: RequestUser,
  ): Promise<Buffer> {
    const encounter = await this.loadEncounterForPdf(encounterId, user, false);
    const sectionsMap = this.buildSectionsMap(encounter.sections);
    const titleMap = {
      receta: 'RECETA / INDICACIONES',
      ordenes: 'ORDEN DE EXAMENES',
      derivacion: 'INTERCONSULTA / DERIVACION',
    } as const;

    const pdfBuffer = await this.buildDocumentBuffer(
      `${titleMap[kind]} - ${encounter.patient.nombre}`,
      encounter.createdBy?.nombre || 'Sistema',
      (doc, pageWidth) => {
        renderFocusedEncounterPdf(doc, pageWidth, encounter, sectionsMap, kind);
      },
    );

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: encounter.id,
      userId: user.id,
      action: 'EXPORT',
      diff: {
        export: {
          document: kind,
          encounterId: encounter.id,
          patientId: encounter.patientId,
          reviewStatus: encounter.reviewStatus,
        },
      },
    });

    return pdfBuffer;
  }
}
