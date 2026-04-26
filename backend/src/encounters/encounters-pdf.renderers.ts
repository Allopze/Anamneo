import {
  SEXO_MAP,
  PREVISION_MAP,
  ESTADO_GENERAL_MAP,
  STATUS_MAP,
  REVIEW_STATUS_MAP,
  ANAMNESIS_REMOTA_FIELD_LABELS,
  formatEncounterDateOnly,
  formatEncounterDateTime,
  formatRutDisplay,
  formatSospechaDiagnosticaLabel,
  getEncounterIdentificationMissingFields,
  getIdentificationDifferenceLabels,
  getTreatmentPlanText,
  formatStructuredMedicationLine,
  formatHistoryFieldText,
  formatRevisionSystemEntries,
  getRutDisplayData,
} from './encounters-pdf.helpers';

export function renderEncounterClinicalPdf(doc: any, pageWidth: number, encounter: any, sectionsMap: Record<string, any>) {
  const sectionTitle = (num: number, title: string) => {
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

  const field = (label: string, value: string | number | undefined) => {
    if (!value && value !== 0) return;
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(String(value));
  };

  const textBlock = (text: string | undefined) => {
    if (!text) {
      doc.text('-');
      return;
    }
    doc.text(text);
  };

  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('FICHA CLÍNICA', { align: 'center' });
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`Fecha: ${formatEncounterDateTime(encounter.createdAt)}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y).lineWidth(2).stroke();
  doc.moveDown(1);

  const ident = sectionsMap['IDENTIFICACION'] || {};
  const identificationDifferences = getIdentificationDifferenceLabels(encounter, ident);
  const identificationMissingFields = getEncounterIdentificationMissingFields(ident);
  sectionTitle(1, 'IDENTIFICACIÓN DEL PACIENTE');
  field('Nombre', ident.nombre || encounter.patient.nombre);
  field('RUT', formatRutDisplay(getRutDisplayData(ident, encounter.patient)));
  field(
    'Fecha de nacimiento',
    ident.fechaNacimiento ? formatEncounterDateOnly(ident.fechaNacimiento) : undefined,
  );
  field('Edad', ident.edad != null ? `${ident.edad} años${ident.edadMeses ? ` ${ident.edadMeses} meses` : ''}` : undefined);
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

  const motivo = sectionsMap['MOTIVO_CONSULTA'] || {};
  sectionTitle(2, 'MOTIVO DE CONSULTA');
  textBlock(motivo.texto);
  if (motivo.afeccionSeleccionada?.name) {
    doc.moveDown(0.3);
    field('Afección probable', motivo.afeccionSeleccionada.name);
  }
  doc.moveDown(0.5);

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
  if (anProx.perfilDolorAbdominal) {
    field(
      'Perfil dolor abdominal',
      [
        anProx.perfilDolorAbdominal.presente ? 'Dolor abdominal' : null,
        anProx.perfilDolorAbdominal.vomitos ? 'Vómitos' : null,
        anProx.perfilDolorAbdominal.diarrea ? 'Diarrea' : null,
        anProx.perfilDolorAbdominal.nauseas ? 'Náuseas' : null,
        anProx.perfilDolorAbdominal.estrenimiento ? 'Estreñimiento' : null,
      ].filter(Boolean).join(' · '),
    );
    field(
      'Asociado a comida',
      anProx.perfilDolorAbdominal.asociadoComida === 'SI'
        ? 'Sí'
        : anProx.perfilDolorAbdominal.asociadoComida === 'NO'
          ? 'No'
          : anProx.perfilDolorAbdominal.asociadoComida === 'NO_CLARO'
            ? 'No claro'
            : undefined,
    );
    field('Notas estructuradas', anProx.perfilDolorAbdominal.notas);
  }
  doc.moveDown(0.5);

  const anRem = sectionsMap['ANAMNESIS_REMOTA'] || {};
  sectionTitle(4, 'ANAMNESIS REMOTA');
  for (const [label, key] of ANAMNESIS_REMOTA_FIELD_LABELS) {
    const text = formatHistoryFieldText(anRem[key]);
    if (text) field(label, text);
  }
  doc.moveDown(0.5);

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

  const exFis = sectionsMap['EXAMEN_FISICO'] || {};
  sectionTitle(6, 'EXAMEN FÍSICO');
  field(
    'Estado general',
    [ESTADO_GENERAL_MAP[exFis.estadoGeneral] || exFis.estadoGeneral, exFis.estadoGeneralNotas]
      .filter(Boolean)
      .join(' · '),
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

  const sosp = sectionsMap['SOSPECHA_DIAGNOSTICA'] || {};
  sectionTitle(7, 'SOSPECHA DIAGNÓSTICA');
  if (sosp.sospechas?.length > 0) {
    sosp.sospechas.forEach((s: any, index: number) => {
      doc.font('Helvetica-Bold').text(`${index + 1}. ${formatSospechaDiagnosticaLabel(s)}`, { continued: !!s.notas });
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
        .map((item: any) => formatStructuredMedicationLine(item))
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

  const resp = sectionsMap['RESPUESTA_TRATAMIENTO'] || {};
  sectionTitle(9, 'RESPUESTA AL TRATAMIENTO');
  field('Evolución', resp.evolucion);
  field('Resultados de exámenes', resp.resultadosExamenes);
  field('Ajustes al tratamiento', resp.ajustesTratamiento);
  field('Plan de seguimiento', resp.planSeguimiento);
  field(
    'Desenlace estructurado',
    resp.respuestaEstructurada?.estado === 'FAVORABLE'
      ? 'Favorable'
      : resp.respuestaEstructurada?.estado === 'PARCIAL'
        ? 'Parcial'
        : resp.respuestaEstructurada?.estado === 'SIN_RESPUESTA'
          ? 'Sin respuesta'
          : resp.respuestaEstructurada?.estado === 'EMPEORA'
            ? 'Empeora'
            : undefined,
  );
  field('Notas del desenlace', resp.respuestaEstructurada?.notas);
  if (!resp.evolucion && !resp.resultadosExamenes && !resp.ajustesTratamiento && !resp.planSeguimiento && !resp.respuestaEstructurada) {
    doc.text('-');
  }
  doc.moveDown(0.5);

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

  doc.moveDown(2);
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  field('Profesional', encounter.createdBy?.nombre || '-');
  field('Estado', STATUS_MAP[encounter.status] || encounter.status);
  field('Revision', REVIEW_STATUS_MAP[encounter.reviewStatus] || encounter.reviewStatus);

  doc.moveDown(3);
  const signX = doc.x + pageWidth - 200;
  doc.moveTo(signX, doc.y).lineTo(signX + 180, doc.y).lineWidth(1).stroke();
  doc.fontSize(9).text('Firma y Timbre', signX, doc.y + 3, {
    width: 180,
    align: 'center',
  });
}

