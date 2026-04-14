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
  SEXO_MAP,
  PREVISION_MAP,
  ESTADO_GENERAL_MAP,
  STATUS_MAP,
  REVIEW_STATUS_MAP,
  ANAMNESIS_REMOTA_FIELD_LABELS,
  buildEncounterDocumentFilename,
  formatEncounterDateTime,
  formatRutDisplay,
  formatSospechaDiagnosticaLabel,
  getIdentificationDifferenceLabels,
  getTreatmentPlanText,
  formatHistoryFieldText,
  formatRevisionSystemEntries,
  getRutDisplayData,
  getPatientDemographicsMissingFields,
} from './encounters-pdf.helpers';

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

      // ── Header ──
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('FICHA CLÍNICA', { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Fecha: ${formatEncounterDateTime(encounter.createdAt)}`,
          { align: 'center' },
        );
      doc.moveDown(0.5);
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.x + pageWidth, doc.y)
        .lineWidth(2)
        .stroke();
      doc.moveDown(1);

      // Helper: section title
      const sectionTitle = (num: number, title: string) => {
        // Check if we need a new page (at least 60pt needed)
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }
        doc.fontSize(12).font('Helvetica-Bold').text(`${num}. ${title}`);
        doc
          .moveTo(doc.x, doc.y)
          .lineTo(doc.x + pageWidth, doc.y)
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
      };

      // Helper: field
      const field = (label: string, value: string | number | undefined) => {
        if (!value && value !== 0) return;
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
      };

      // Helper: text block
      const textBlock = (text: string | undefined) => {
        if (!text) {
          doc.text('-');
          return;
        }
        doc.text(text);
      };

      // ── 1. Identificación ──
      const ident = sectionsMap['IDENTIFICACION'] || {};
      const identificationDifferences = getIdentificationDifferenceLabels(encounter, ident);
      const identificationMissingFields = getPatientDemographicsMissingFields(ident);
      sectionTitle(1, 'IDENTIFICACIÓN DEL PACIENTE');
      field('Nombre', ident.nombre || encounter.patient.nombre);
      field('RUT', formatRutDisplay(getRutDisplayData(ident, encounter.patient)));
      field('Edad', ident.edad ? `${ident.edad} años${ident.edadMeses ? ` ${ident.edadMeses} meses` : ''}` : undefined);
      field('Sexo', SEXO_MAP[ident.sexo] || ident.sexo);
      field('Previsión', PREVISION_MAP[ident.prevision] || ident.prevision);
      field('Trabajo', ident.trabajo);
      field('Domicilio', ident.domicilio);
      if (identificationMissingFields.length > 0) {
        doc.moveDown(0.3);
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#92400e')
          .text(
            `Aviso: la identificación registrada en esta atención quedó incompleta. Faltan campos demográficos clave: ${identificationMissingFields.join(', ')}.`,
          )
          .fillColor('#000000');
        doc.fontSize(10).font('Helvetica');
      }
      if (identificationDifferences.length > 0) {
        doc.moveDown(0.3);
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#b45309')
          .text(
            `Aviso: esta identificación corresponde al snapshot de la atención y hoy difiere de la ficha maestra del paciente en: ${identificationDifferences.join(', ')}.`,
          )
          .fillColor('#000000');
        doc.fontSize(10).font('Helvetica');
      }
      doc.moveDown(0.5);

      // ── 2. Motivo de consulta ──
      const motivo = sectionsMap['MOTIVO_CONSULTA'] || {};
      sectionTitle(2, 'MOTIVO DE CONSULTA');
      textBlock(motivo.texto);
      if (motivo.afeccionSeleccionada?.name) {
        doc.moveDown(0.3);
        field('Afección probable', motivo.afeccionSeleccionada.name);
      }
      doc.moveDown(0.5);

      // ── 3. Anamnesis próxima ──
      const anProx = sectionsMap['ANAMNESIS_PROXIMA'] || {};
      sectionTitle(3, 'ANAMNESIS PRÓXIMA');
      if (anProx.relatoAmpliado) {
        field('Relato', anProx.relatoAmpliado);
      }
      field('Inicio', anProx.inicio);
      field('Evolución', anProx.evolucion);
      field('Factores agravantes', anProx.factoresAgravantes);
      field('Factores atenuantes', anProx.factoresAtenuantes);
      field('Síntomas asociados', anProx.sintomasAsociados);
      doc.moveDown(0.5);

      // ── 4. Anamnesis remota ──
      const anRem = sectionsMap['ANAMNESIS_REMOTA'] || {};
      sectionTitle(4, 'ANAMNESIS REMOTA');
      for (const [label, key] of ANAMNESIS_REMOTA_FIELD_LABELS) {
        const text = formatHistoryFieldText(anRem[key]);
        if (text) field(label, text);
      }
      doc.moveDown(0.5);

      // ── 5. Revisión por sistemas ──
      const revSis = sectionsMap['REVISION_SISTEMAS'] || {};
      sectionTitle(5, 'REVISIÓN POR SISTEMAS');
      const revEntries = formatRevisionSystemEntries(revSis);
      if (revEntries.length > 0) {
        for (const entry of revEntries) {
          field(entry.label, entry.text);
        }
      } else {
        doc.text('-');
      }
      doc.moveDown(0.5);

      // ── 6. Examen Físico ──
      const exFis = sectionsMap['EXAMEN_FISICO'] || {};
      sectionTitle(6, 'EXAMEN FÍSICO');
      field(
        'Estado general',
        [ESTADO_GENERAL_MAP[exFis.estadoGeneral] || exFis.estadoGeneral, exFis.estadoGeneralNotas].filter(Boolean).join(' · '),
      );
      if (exFis.signosVitales) {
        const sv = exFis.signosVitales;
        doc.font('Helvetica-Bold').text('Signos vitales:');
        doc.font('Helvetica');
        const vitalParts = [
          sv.presionArterial && `PA: ${sv.presionArterial}`,
          sv.frecuenciaCardiaca && `FC: ${sv.frecuenciaCardiaca} lpm`,
          sv.frecuenciaRespiratoria && `FR: ${sv.frecuenciaRespiratoria} rpm`,
          sv.temperatura && `T°: ${sv.temperatura}°C`,
          sv.saturacionOxigeno && `SatO2: ${sv.saturacionOxigeno}%`,
          sv.peso && `Peso: ${sv.peso} kg`,
          sv.talla && `Talla: ${sv.talla} cm`,
          sv.imc && `IMC: ${sv.imc}`,
        ]
          .filter(Boolean)
          .join(' | ');
        doc.text(vitalParts);
        doc.moveDown(0.3);
      }
      field('Cabeza', exFis.cabeza);
      field('Cuello', exFis.cuello);
      field('Tórax', exFis.torax);
      field('Abdomen', exFis.abdomen);
      field('Extremidades', exFis.extremidades);
      doc.moveDown(0.5);

      // ── 7. Sospecha diagnóstica ──
      const sosp = sectionsMap['SOSPECHA_DIAGNOSTICA'] || {};
      sectionTitle(7, 'SOSPECHA DIAGNÓSTICA');
      if (sosp.sospechas?.length > 0) {
        sosp.sospechas.forEach((s: any, i: number) => {
          doc
            .font('Helvetica-Bold')
            .text(`${i + 1}. ${formatSospechaDiagnosticaLabel(s)}`, { continued: !!s.notas });
          if (s.notas) {
            doc.font('Helvetica').text(` - ${s.notas}`);
          } else {
            doc.text('');
          }
        });
      } else {
        doc.text('-');
      }
      doc.moveDown(0.5);

      // ── 8. Tratamiento ──
      const trat = sectionsMap['TRATAMIENTO'] || {};
      const treatmentPlan = getTreatmentPlanText(trat);
      sectionTitle(8, 'TRATAMIENTO');
      field('Plan de tratamiento e indicaciones', treatmentPlan);
      field('Receta', trat.receta);
      field('Exámenes', trat.examenes);
      field('Derivaciones', trat.derivaciones);
      if (Array.isArray(trat.medicamentosEstructurados) && trat.medicamentosEstructurados.length > 0) {
        field(
          'Medicamentos estructurados',
          trat.medicamentosEstructurados
            .map((item: any) => [item.nombre, item.dosis, item.via, item.frecuencia, item.duracion].filter(Boolean).join(' · '))
            .join(' | '),
        );
      }
      if (Array.isArray(trat.examenesEstructurados) && trat.examenesEstructurados.length > 0) {
        field(
          'Exámenes estructurados',
          trat.examenesEstructurados
            .map((item: any) => [item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · '))
            .join(' | '),
        );
      }
      if (Array.isArray(trat.derivacionesEstructuradas) && trat.derivacionesEstructuradas.length > 0) {
        field(
          'Derivaciones estructuradas',
          trat.derivacionesEstructuradas
            .map((item: any) => [item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · '))
            .join(' | '),
        );
      }
      if (!treatmentPlan && !trat.receta && !trat.examenes && !trat.derivaciones) doc.text('-');
      doc.moveDown(0.5);

      // ── 9. Respuesta al tratamiento ──
      const resp = sectionsMap['RESPUESTA_TRATAMIENTO'] || {};
      sectionTitle(9, 'RESPUESTA AL TRATAMIENTO');
      field('Evolución', resp.evolucion);
      field('Resultados de exámenes', resp.resultadosExamenes);
      field('Ajustes al tratamiento', resp.ajustesTratamiento);
      field('Plan de seguimiento', resp.planSeguimiento);
      if (
        !resp.evolucion &&
        !resp.resultadosExamenes &&
        !resp.ajustesTratamiento &&
        !resp.planSeguimiento
      ) {
        doc.text('-');
      }
      doc.moveDown(0.5);

      // ── 10. Observaciones ──
      const obs = sectionsMap['OBSERVACIONES'] || {};
      if (obs.resumenClinico || obs.observaciones) {
        sectionTitle(10, 'OBSERVACIONES');
        if (obs.resumenClinico) {
          doc.font('Helvetica-Bold').text('Resumen longitudinal');
          doc.font('Helvetica');
          textBlock(obs.resumenClinico);
        }
        if (obs.observaciones) {
          textBlock(obs.observaciones);
        }
        doc.moveDown(0.5);
      }

      // ── Footer ──
      doc.moveDown(2);
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.x + pageWidth, doc.y)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.5);
      field('Profesional', encounter.createdBy?.nombre || '-');
      field('Estado', STATUS_MAP[encounter.status] || encounter.status);
      field('Revision', REVIEW_STATUS_MAP[encounter.reviewStatus] || encounter.reviewStatus);

      // Signature area
      doc.moveDown(3);
      const signX = doc.x + pageWidth - 200;
      doc
        .moveTo(signX, doc.y)
        .lineTo(signX + 180, doc.y)
        .lineWidth(1)
        .stroke();
      doc
        .fontSize(9)
        .text('Firma y Timbre', signX, doc.y + 3, {
          width: 180,
          align: 'center',
        });

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
    const ident = sectionsMap['IDENTIFICACION'] || {};
    const trat = sectionsMap['TRATAMIENTO'] || {};
    const titleMap = {
      receta: 'RECETA / INDICACIONES',
      ordenes: 'ORDEN DE EXAMENES',
      derivacion: 'INTERCONSULTA / DERIVACION',
    } as const;
    const treatmentPlan = getTreatmentPlanText(trat);

    const pdfBuffer = await this.buildDocumentBuffer(
      `${titleMap[kind]} - ${encounter.patient.nombre}`,
      encounter.createdBy?.nombre || 'Sistema',
      (doc, pageWidth) => {
        const field = (label: string, value: string | undefined) => {
          if (!value) return;
          doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
          doc.font('Helvetica').text(value);
        };

        doc.fontSize(18).font('Helvetica-Bold').text(titleMap[kind], { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(
          `Fecha: ${formatEncounterDateTime(encounter.createdAt)}`,
          { align: 'center' },
        );
        doc.moveDown(1);
        field('Paciente', ident.nombre || encounter.patient.nombre);
        field('RUT', formatRutDisplay(getRutDisplayData(ident, encounter.patient)));
        field('Edad', ident.edad ? `${ident.edad} años` : undefined);
        field('Profesional', encounter.createdBy?.nombre || '-');
        doc.moveDown(1);
        doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y).lineWidth(1).stroke();
        doc.moveDown(1);

        if (kind === 'receta') {
          doc.font('Helvetica-Bold').text('Indicaciones generales');
          doc.font('Helvetica').text(treatmentPlan || '-');
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').text('Medicacion');
          if (Array.isArray(trat.medicamentosEstructurados) && trat.medicamentosEstructurados.length > 0) {
            trat.medicamentosEstructurados.forEach((item: any) => {
              doc.text(`• ${[item.nombre, item.dosis, item.via, item.frecuencia, item.duracion].filter(Boolean).join(' · ')}`);
            });
          } else {
            doc.text(trat.receta || '-');
          }
        }

        if (kind === 'ordenes') {
          doc.font('Helvetica-Bold').text('Examenes solicitados');
          if (Array.isArray(trat.examenesEstructurados) && trat.examenesEstructurados.length > 0) {
            trat.examenesEstructurados.forEach((item: any) => {
              doc.text(`• ${[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}`);
            });
          } else {
            doc.font('Helvetica').text(trat.examenes || '-');
          }
        }

        if (kind === 'derivacion') {
          doc.font('Helvetica-Bold').text('Motivo de derivacion');
          if (Array.isArray(trat.derivacionesEstructuradas) && trat.derivacionesEstructuradas.length > 0) {
            trat.derivacionesEstructuradas.forEach((item: any) => {
              doc.text(`• ${[item.nombre, item.indicacion, item.estado].filter(Boolean).join(' · ')}`);
            });
          } else {
            doc.font('Helvetica').text(trat.derivaciones || '-');
          }
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').text('Contexto clinico');
          doc.font('Helvetica').text((sectionsMap['MOTIVO_CONSULTA'] || {}).texto || '-');
        }

        doc.moveDown(3);
        const signX = doc.x + pageWidth - 200;
        doc.moveTo(signX, doc.y).lineTo(signX + 180, doc.y).lineWidth(1).stroke();
        doc.fontSize(9).text('Firma y Timbre', signX, doc.y + 3, {
          width: 180,
          align: 'center',
        });
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
