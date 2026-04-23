import { formatEncounterDateTime, formatRutDisplay, getRutDisplayData, getTreatmentPlanText, formatStructuredMedicationLine } from './encounters-pdf.helpers';

export function renderFocusedEncounterPdf(
  doc: any,
  pageWidth: number,
  encounter: any,
  sectionsMap: Record<string, any>,
  kind: 'receta' | 'ordenes' | 'derivacion',
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

  doc.fontSize(18).font('Helvetica-Bold').text(titleMap[kind], { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(`Fecha: ${formatEncounterDateTime(encounter.createdAt)}`, {
    align: 'center',
  });
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
        doc.text(`• ${formatStructuredMedicationLine(item)}`);
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
}
