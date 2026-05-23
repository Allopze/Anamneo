import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { buildPatientProblemScopeWhere, isPatientOwnedByMedico } from '../common/utils/patient-access';
import { assertEncounterClinicalOutputAllowed } from '../common/utils/patient-completeness';
import * as PDFDocument from 'pdfkit';
import {
  SEXO_MAP,
  PREVISION_MAP,
  formatRutDisplay,
  formatSospechaDiagnosticaLabel,
  buildSectionsMap,
  getTreatmentPlanText,
  formatHistoryFieldText,
  formatDateTime,
  formatDateOnlyForFilename,
  sanitizeFilenameSegment,
} from './patients-pdf-helpers';
import { addPageNumbers } from '../common/utils/pdf-page-footer';
import { SettingsService } from '../settings/settings.service';
import {
  buildMedicationDetail,
  buildOrderDetail,
  buildPdfClinicSettings,
  loadPdfClinicLogo,
  renderPdfDetailList,
  renderPdfHeader,
  renderPdfSectionHeading,
} from '../common/utils/pdf-document-layout';
import { withPatientIdentifiers } from './patients-identifiers';

@Injectable()
export class PatientsPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly settingsService: SettingsService,
  ) {}

  async getLongitudinalPdfFilename(patientId: string, user: RequestUser) {
    const patient = await this.loadPatientForLongitudinalPdf(patientId, user, { includeHistory: false });
    const safeName = sanitizeFilenameSegment(patient.nombre);
    const exportDate = formatDateOnlyForFilename(new Date());
    return `${safeName} - Historial clinico - ${exportDate}.pdf`;
  }

  private async loadPatientForLongitudinalPdf(
    patientId: string,
    user: RequestUser,
    options: { includeHistory: boolean },
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        history: options.includeHistory,
        problems: options.includeHistory ? {
          where: user.isAdmin ? undefined : buildPatientProblemScopeWhere(effectiveMedicoId),
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          include: { createdBy: { select: { id: true, nombre: true } } },
        } : false,
        createdBy: { select: { medicoId: true } },
      },
    });

    if (!patient || patient.archivedAt) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!user.isAdmin && !isPatientOwnedByMedico(patient, effectiveMedicoId)) {
      const hasEncounter = await this.prisma.encounter.findFirst({
        where: { patientId, medicoId: effectiveMedicoId },
        select: { id: true },
      });
      if (!hasEncounter) {
        throw new NotFoundException('Paciente no encontrado');
      }
    }

    const patientWithIdentifiers = withPatientIdentifiers(patient);
    assertEncounterClinicalOutputAllowed(patientWithIdentifiers, 'EXPORT_OFFICIAL_DOCUMENTS');
    return patientWithIdentifiers;
  }

  async generateLongitudinalPdf(patientId: string, user: RequestUser): Promise<Buffer> {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const patient = await this.loadPatientForLongitudinalPdf(patientId, user, { includeHistory: true });
    const encounters = await this.prisma.encounter.findMany({
      where: {
        patientId,
        status: { in: ['COMPLETADO', 'FIRMADO'] },
        ...(user.isAdmin ? {} : { medicoId: effectiveMedicoId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: true,
        createdBy: { select: { nombre: true } },
      },
    });
    const clinic = await loadPdfClinicLogo(buildPdfClinicSettings(await this.settingsService.getAll()));

    const pdfBuffer = await this.buildDocumentBuffer(
      `Historial Clínico Longitudinal - ${patient.nombre}`,
      user.nombre || user.email || 'Sistema',
      (doc, pageWidth) => {
        const sectionTitle = (title: string) => {
          if (doc.y > doc.page.height - 100) doc.addPage();
          doc.fontSize(12).font('Helvetica-Bold').text(title);
          doc
            .moveTo(doc.x, doc.y)
            .lineTo(doc.x + pageWidth, doc.y)
            .lineWidth(0.5)
            .stroke();
          doc.moveDown(0.3);
          doc.fontSize(10).font('Helvetica');
        };

        const field = (label: string, value: string | number | undefined | null) => {
          if (!value && value !== 0) return;
          doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
          doc.font('Helvetica').text(String(value));
        };

        renderPdfHeader(doc, pageWidth, {
          title: 'HISTORIAL CLÍNICO LONGITUDINAL',
          subtitle: `Generado: ${formatDateTime(new Date())}`,
          professionalName: user.nombre || null,
          clinic,
        });

        sectionTitle('IDENTIFICACIÓN DEL PACIENTE');
        field('Nombre', patient.nombre);
        field('RUT', formatRutDisplay(patient));
        field(
          'Edad',
          patient.edad ? `${patient.edad} años${patient.edadMeses ? ` ${patient.edadMeses} meses` : ''}` : undefined,
        );
        field('Sexo', SEXO_MAP[patient.sexo ?? ''] || patient.sexo);
        field('Previsión', PREVISION_MAP[patient.prevision ?? ''] || patient.prevision);
        field('Trabajo', patient.trabajo);
        field('Domicilio', patient.domicilio);
        field('Centro médico', patient.centroMedico);
        doc.moveDown(0.5);

        const history = patient.history as any;
        if (history) {
          sectionTitle('ANTECEDENTES');
          const historyFields: [string, string][] = [
            ['Antecedentes médicos', 'antecedentesMedicos'],
            ['Antecedentes quirúrgicos', 'antecedentesQuirurgicos'],
            ['Antecedentes ginecoobstétricos', 'antecedentesGinecoobstetricos'],
            ['Antecedentes familiares', 'antecedentesFamiliares'],
            ['Hábitos', 'habitos'],
            ['Medicamentos', 'medicamentos'],
            ['Alergias', 'alergias'],
            ['Inmunizaciones', 'inmunizaciones'],
            ['Antecedentes sociales', 'antecedentesSociales'],
            ['Antecedentes personales', 'antecedentesPersonales'],
          ];
          let hasAny = false;
          for (const [label, key] of historyFields) {
            const text = formatHistoryFieldText((history as any)[key]);
            if (text) {
              field(label, text);
              hasAny = true;
            }
          }
          if (!hasAny) doc.text('Sin antecedentes registrados.');
          doc.moveDown(0.5);
        }

        if (patient.problems.length > 0) {
          renderPdfSectionHeading(doc, pageWidth, 'PROBLEMAS CLÍNICOS');
          for (const problem of patient.problems) {
            const statusLabel = problem.status === 'ACTIVO' ? '●' : '○';
            doc.font('Helvetica-Bold').text(`${statusLabel} ${problem.label}`, { continued: true });
            const meta = [problem.status, problem.severity].filter(Boolean).join(' · ');
            doc.font('Helvetica').text(meta ? ` (${meta})` : '');
            if (problem.notes) {
              doc.fontSize(9).text(`   ${problem.notes}`).fontSize(10);
            }
          }
          doc.moveDown(0.5);
        }

        if (encounters.length === 0) {
          sectionTitle('ATENCIONES');
          doc.text('Sin atenciones completadas.');
        } else {
          for (let i = 0; i < encounters.length; i++) {
            const enc = encounters[i];
            const sectionsMap = buildSectionsMap(enc.sections);

            if (doc.y > doc.page.height - 150) doc.addPage();

            doc
              .fontSize(13)
              .font('Helvetica-Bold')
              .text(`ATENCIÓN ${i + 1} — ${formatDateTime(enc.createdAt)}`);
            doc
              .fontSize(9)
              .font('Helvetica')
              .text(`Profesional: ${enc.createdBy?.nombre || '-'} · Estado: ${enc.status}`);
            doc
              .moveTo(doc.x, doc.y + 2)
              .lineTo(doc.x + pageWidth, doc.y + 2)
              .lineWidth(1)
              .stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');

            const motivo = sectionsMap['MOTIVO_CONSULTA'] || {};
            if (motivo.texto) {
              field('Motivo de consulta', motivo.texto);
            }

            const sosp = sectionsMap['SOSPECHA_DIAGNOSTICA'] || {};
            if (sosp.sospechas?.length > 0) {
              doc.font('Helvetica-Bold').text('Sospecha diagnóstica: ', { continued: true });
              doc
                .font('Helvetica')
                .text(sosp.sospechas.map((s: any) => formatSospechaDiagnosticaLabel(s)).join(', '));
            }

            const trat = sectionsMap['TRATAMIENTO'] || {};
            const plan = getTreatmentPlanText(trat);
            if (plan) {
              field('Plan', plan);
            }
            if (Array.isArray(trat.medicamentosEstructurados) && trat.medicamentosEstructurados.length > 0) {
              renderPdfSectionHeading(doc, pageWidth, 'Medicamentos');
              const medications = trat.medicamentosEstructurados.map((m: any) => buildMedicationDetail(m));
              renderPdfDetailList(doc, pageWidth, medications);
            }
            if (Array.isArray(trat.examenesEstructurados) && trat.examenesEstructurados.length > 0) {
              renderPdfSectionHeading(doc, pageWidth, 'Exámenes');
              const exams = trat.examenesEstructurados.map((item: any) => buildOrderDetail(item));
              renderPdfDetailList(doc, pageWidth, exams);
            }

            const obs = sectionsMap['OBSERVACIONES'] || {};
            if (obs.resumenClinico) {
              field('Resumen clínico', obs.resumenClinico);
            }
            if (obs.observaciones) {
              field('Observaciones', obs.observaciones);
            }

            doc.moveDown(1);
          }
        }
      },
    );

    await this.auditService.log({
      entityType: 'Patient',
      entityId: patientId,
      userId: user.id,
      action: 'EXPORT',
      reason: 'PATIENT_LONGITUDINAL_EXPORTED',
      diff: {
        export: {
          type: 'longitudinal_pdf',
          patientId,
          encounterCount: encounters.length,
        },
      },
    });

    return pdfBuffer;
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
        info: { Title: title, Author: author },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      render(doc, pageWidth);

      addPageNumbers(doc, pageWidth);
      doc.end();
    });
  }
}
