import {
  formatEncounterDateOnly,
  formatEncounterDateTime,
  formatRutDisplay,
  getRutDisplayData,
  getTreatmentPlanText,
} from './encounters-pdf.helpers';
import {
  buildMedicationDetail,
  buildOrderDetail,
  type PdfClinicSettings,
  renderPdfDetailList,
  renderPdfHeader,
  renderPdfSectionHeading,
  renderPdfSignature,
} from '../common/utils/pdf-document-layout';

export function renderFocusedEncounterPdf(
  doc: any,
  pageWidth: number,
  encounter: any,
  sectionsMap: Record<string, any>,
  kind: 'receta' | 'ordenes' | 'derivacion',
  clinic?: PdfClinicSettings,
) {
  const ident = sectionsMap['IDENTIFICACION'] || {};
  const trat = sectionsMap['TRATAMIENTO'] || {};
  const titleMap = {
    receta: 'RECETA / INDICACIONES',
    ordenes: 'ORDEN DE EXAMENES',
    derivacion: 'INTERCONSULTA / DERIVACION',
  } as const;
  const treatmentPlan = getTreatmentPlanText(trat);

  const field = (label: string, value: string | undefined) => {
    if (!value) return;
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value);
  };

  renderPdfHeader(doc, pageWidth, {
    title: titleMap[kind],
    subtitle: `Fecha: ${formatEncounterDateTime(encounter.createdAt)}`,
    professionalName: encounter.createdBy?.nombre || null,
    clinic,
  });

  field('Paciente', ident.nombre || encounter.patient.nombre);
  field('RUT', formatRutDisplay(getRutDisplayData(ident, encounter.patient)));
  field('Fecha de nacimiento', ident.fechaNacimiento ? formatEncounterDateOnly(ident.fechaNacimiento) : undefined);
  field('Edad', ident.edad != null ? `${ident.edad} años` : undefined);
  field('Profesional', encounter.createdBy?.nombre || '-');
  doc.moveDown(1);
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y).lineWidth(1).stroke();
  doc.moveDown(1);

  if (kind === 'receta') {
    renderPdfSectionHeading(doc, pageWidth, 'Indicaciones generales');
    doc.font('Helvetica').text(treatmentPlan || '-');
    renderPdfSectionHeading(doc, pageWidth, 'Medicación');
    if (Array.isArray(trat.medicamentosEstructurados) && trat.medicamentosEstructurados.length > 0) {
      renderPdfDetailList(
        doc,
        pageWidth,
        trat.medicamentosEstructurados.map((item: any) => buildMedicationDetail(item)),
      );
    } else {
      doc.text(trat.receta || '-');
    }
  }

  if (kind === 'ordenes') {
    renderPdfSectionHeading(doc, pageWidth, 'Exámenes solicitados');
    if (Array.isArray(trat.examenesEstructurados) && trat.examenesEstructurados.length > 0) {
      renderPdfDetailList(
        doc,
        pageWidth,
        trat.examenesEstructurados.map((item: any) => buildOrderDetail(item)),
      );
    } else {
      doc.font('Helvetica').text(trat.examenes || '-');
    }
  }

  if (kind === 'derivacion') {
    renderPdfSectionHeading(doc, pageWidth, 'Motivo de derivación');
    if (Array.isArray(trat.derivacionesEstructuradas) && trat.derivacionesEstructuradas.length > 0) {
      renderPdfDetailList(
        doc,
        pageWidth,
        trat.derivacionesEstructuradas.map((item: any) => buildOrderDetail(item)),
      );
    } else {
      doc.font('Helvetica').text(trat.derivaciones || '-');
    }
    renderPdfSectionHeading(doc, pageWidth, 'Contexto clínico');
    doc.font('Helvetica').text((sectionsMap['MOTIVO_CONSULTA'] || {}).texto || '-');
  }

  renderPdfSignature(doc, pageWidth);
}
