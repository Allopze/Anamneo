import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import * as PDFDocument from 'pdfkit';

const SEXO_MAP: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIR: 'Prefiere no decir',
};

const PREVISION_MAP: Record<string, string> = {
  FONASA: 'FONASA',
  ISAPRE: 'ISAPRE',
  OTRA: 'Otra',
  DESCONOCIDA: 'Desconocida',
};

const STATUS_MAP: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

const SECTION_ORDER = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'ANAMNESIS_PROXIMA',
  'ANAMNESIS_REMOTA',
  'REVISION_SISTEMAS',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
  'RESPUESTA_TRATAMIENTO',
  'OBSERVACIONES',
];

@Injectable()
export class EncountersPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(encounterId: string, user: RequestUser): Promise<Buffer> {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id: encounterId,
        patient: { medicoId: effectiveMedicoId },
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

    // Build sections map
    const sectionsMap: Record<string, any> = {};
    for (const section of encounter.sections) {
      const data =
        typeof section.data === 'string'
          ? JSON.parse(section.data)
          : section.data;
      sectionsMap[section.sectionKey] = data || {};
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        bufferPages: true,
        info: {
          Title: `Ficha Clínica - ${encounter.patient.nombre}`,
          Author: encounter.createdBy?.nombre || 'Sistema',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ── Header ──
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('FICHA CLÍNICA', { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Fecha: ${new Date(encounter.createdAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
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
      sectionTitle(1, 'IDENTIFICACIÓN DEL PACIENTE');
      field('Nombre', ident.nombre || encounter.patient.nombre);
      field('RUT', ident.rut || encounter.patient.rut || 'Sin RUT');
      field('Edad', ident.edad ? `${ident.edad} años` : undefined);
      field('Sexo', SEXO_MAP[ident.sexo] || ident.sexo);
      field('Previsión', PREVISION_MAP[ident.prevision] || ident.prevision);
      field('Trabajo', ident.trabajo);
      field('Domicilio', ident.domicilio);
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
      const remoteFields: [string, string][] = [
        ['Antecedentes médicos', 'antecedentesMedicos'],
        ['Antecedentes quirúrgicos', 'antecedentesQuirurgicos'],
        ['Antecedentes ginecoobstétricos', 'antecedentesGinecoobstetricos'],
        ['Antecedentes familiares', 'antecedentesFamiliares'],
        ['Hábitos', 'habitos'],
        ['Medicamentos', 'medicamentos'],
        ['Alergias', 'alergias'],
        ['Inmunizaciones', 'inmunizaciones'],
      ];
      for (const [label, key] of remoteFields) {
        const val = anRem[key];
        const text = typeof val === 'object' ? val?.texto : val;
        if (text) field(label, text);
      }
      doc.moveDown(0.5);

      // ── 5. Revisión por sistemas ──
      const revSis = sectionsMap['REVISION_SISTEMAS'] || {};
      sectionTitle(5, 'REVISIÓN POR SISTEMAS');
      const revEntries = Object.entries(revSis);
      if (revEntries.length > 0) {
        for (const [key, value] of revEntries) {
          const text =
            typeof value === 'object' && value !== null
              ? (value as any).texto || (value as any).observaciones
              : value;
          if (text) {
            const label = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (s) => s.toUpperCase());
            field(label, String(text));
          }
        }
      } else {
        doc.text('-');
      }
      doc.moveDown(0.5);

      // ── 6. Examen Físico ──
      const exFis = sectionsMap['EXAMEN_FISICO'] || {};
      sectionTitle(6, 'EXAMEN FÍSICO');
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
            .text(`${i + 1}. ${s.diagnostico}`, { continued: !!s.notas });
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
      sectionTitle(8, 'TRATAMIENTO');
      field('Plan', trat.plan);
      field('Indicaciones', trat.indicaciones);
      field('Receta', trat.receta);
      field('Exámenes', trat.examenes);
      field('Derivaciones', trat.derivaciones);
      if (!trat.plan && !trat.indicaciones && !trat.receta) doc.text('-');
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
      if (obs.observaciones) {
        sectionTitle(10, 'OBSERVACIONES');
        textBlock(obs.observaciones);
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

      // Page numbers
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
            },
          );
      }

      doc.end();
    });
  }
}
