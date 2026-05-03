import * as fs from 'fs';
import * as path from 'path';

export type PdfClinicSettings = {
  clinicName?: string;
  clinicIdentifier?: string;
  clinicLogoUrl?: string;
  clinicLogoBuffer?: Buffer;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
};

const TEXT_COLOR = '#111827';
const MUTED_COLOR = '#4b5563';
const LINE_COLOR = '#d7d4cb';
const BRAND_COLOR = '#393939';
const ACCENT_COLOR = '#c9d427';
const SOFT_COLOR = '#f6f5ef';

export function buildPdfClinicSettings(settings: Record<string, string> | null | undefined): PdfClinicSettings {
  return {
    clinicName: settings?.['clinic.name']?.trim() || undefined,
    clinicIdentifier: settings?.['clinic.identifier']?.trim() || undefined,
    clinicLogoUrl: settings?.['clinic.logoUrl']?.trim() || undefined,
    clinicAddress: settings?.['clinic.address']?.trim() || undefined,
    clinicPhone: settings?.['clinic.phone']?.trim() || undefined,
    clinicEmail: settings?.['clinic.email']?.trim() || undefined,
  };
}

export async function loadPdfClinicLogo(clinic: PdfClinicSettings): Promise<PdfClinicSettings> {
  const remoteLogo = clinic.clinicLogoUrl ? await fetchPdfLogo(clinic.clinicLogoUrl) : null;
  return { ...clinic, clinicLogoBuffer: remoteLogo ?? readDefaultPdfLogo() };
}

async function fetchPdfLogo(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch { return null; }
}

function readDefaultPdfLogo(): Buffer | undefined {
  const candidates = [
    path.resolve(process.cwd(), 'src/common/assets/anamneo-logo.png'),
    path.resolve(process.cwd(), 'dist/backend/src/common/assets/anamneo-logo.png'),
    path.resolve(process.cwd(), '../anamneo-logo.png'),
    path.resolve(process.cwd(), 'anamneo-logo.png'),
  ];
  const logoPath = candidates.find((candidate) => fs.existsSync(candidate));
  return logoPath ? fs.readFileSync(logoPath) : undefined;
}

export function ensurePdfSpace(doc: PDFKit.PDFDocument, minHeight: number) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - minHeight) {
    doc.addPage();
  }
}

export function hasPdfContent(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasPdfContent(item));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => hasPdfContent(item));
  }
  return value !== null && value !== undefined && value !== false;
}

export function renderPdfHeader(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  params: {
    title: string;
    subtitle?: string;
    professionalName?: string | null;
    clinic?: PdfClinicSettings;
  },
) {
  const clinicName = params.clinic?.clinicName || 'Anamneo';
  const contact = [
    params.clinic?.clinicIdentifier ? `ID: ${params.clinic.clinicIdentifier}` : '',
    params.clinic?.clinicAddress,
    params.clinic?.clinicPhone,
    params.clinic?.clinicEmail,
  ].filter(Boolean).join(' · ');

  const headerTop = doc.page.margins.top - 8;
  const left = doc.page.margins.left;
  const logoBuffer = params.clinic?.clinicLogoBuffer;
  doc.roundedRect(left, headerTop, pageWidth, 74, 6).fill(SOFT_COLOR);
  doc.rect(left, headerTop, 4, 74).fill(ACCENT_COLOR);

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, left + 14, headerTop + 15, { fit: [38, 38] });
    } catch { renderFallbackLogo(doc, left + 14, headerTop + 15); }
  } else {
    renderFallbackLogo(doc, left + 14, headerTop + 15);
  }

  doc
    .fontSize(15)
    .font('Helvetica-Bold')
    .fillColor(BRAND_COLOR)
    .text('Anamneo', left + 62, headerTop + 18, { width: pageWidth * 0.36, lineBreak: false });

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(MUTED_COLOR)
    .text(clinicName === 'Anamneo' ? 'Ficha clínica digital' : clinicName, left + 62, headerTop + 36, {
      width: pageWidth * 0.4,
      lineBreak: false,
    });

  if (contact) doc.fontSize(7.5).text(contact, left + 62, headerTop + 50, { width: pageWidth * 0.54 });

  doc
    .fontSize(15)
    .font('Helvetica-Bold')
    .fillColor(TEXT_COLOR)
    .text(params.title, left + pageWidth * 0.46, headerTop + 18, {
      width: pageWidth * 0.49,
      align: 'right',
    });

  if (params.subtitle) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(MUTED_COLOR)
      .text(params.subtitle, left + pageWidth * 0.46, doc.y + 2, {
        width: pageWidth * 0.49,
        align: 'right',
      });
  }

  if (params.professionalName) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(MUTED_COLOR)
      .text(`Profesional: ${params.professionalName}`, left + pageWidth * 0.46, doc.y + 1, {
        width: pageWidth * 0.49,
        align: 'right',
      });
  }

  doc.y = headerTop + 88;
  doc
    .moveTo(left, doc.y)
    .lineTo(left + pageWidth, doc.y)
    .lineWidth(0.75)
    .strokeColor(ACCENT_COLOR)
    .stroke();
  doc.moveDown(0.9);
  doc.fontSize(10).font('Helvetica').fillColor(TEXT_COLOR);
}

function renderFallbackLogo(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.circle(x + 19, y + 19, 19).fillAndStroke(BRAND_COLOR, BRAND_COLOR);
  doc.fontSize(15).font('Helvetica-Bold').fillColor(ACCENT_COLOR).text('A', x, y + 11, {
    width: 38,
    align: 'center',
    lineBreak: false,
  });
}

export function renderPdfSectionHeading(doc: PDFKit.PDFDocument, pageWidth: number, title: string) {
  ensurePdfSpace(doc, 55);
  const y = doc.y + 2;
  doc.roundedRect(doc.page.margins.left, y, pageWidth, 22, 4).fillAndStroke(SOFT_COLOR, LINE_COLOR);
  doc.rect(doc.page.margins.left, y, 3, 22).fill(ACCENT_COLOR);
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(title, doc.page.margins.left + 10, y + 6, {
    width: pageWidth - 20,
    lineBreak: false,
  });
  doc.y = y + 28;
  doc.fontSize(10).font('Helvetica').fillColor(TEXT_COLOR);
}

export function renderPdfDetailList(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  items: Array<{ title: string; details: string[] }>,
) {
  if (items.length === 0) {
    doc.font('Helvetica').fillColor(TEXT_COLOR).text('-');
    return;
  }

  items.forEach((item, index) => {
    ensurePdfSpace(doc, 70);
    const top = doc.y + 2;
    doc.roundedRect(doc.page.margins.left, top, pageWidth, 48, 5).fillAndStroke('#ffffff', LINE_COLOR);
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(TEXT_COLOR)
      .text(`${index + 1}. ${item.title || 'Sin descripcion'}`, doc.page.margins.left + 12, top + 9, {
        width: pageWidth - 24,
      });

    item.details.forEach((detail) => {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(MUTED_COLOR)
        .text(detail, doc.page.margins.left + 22, doc.y + 1, { width: pageWidth - 34 });
    });

    doc.y = Math.max(doc.y + 8, top + 56);
  });

  doc.fontSize(10).font('Helvetica').fillColor(TEXT_COLOR);
}

export function renderPdfSignature(doc: PDFKit.PDFDocument, pageWidth: number) {
  ensurePdfSpace(doc, 95);
  doc.moveDown(1.4);
  const signX = doc.page.margins.left + pageWidth - 220;
  doc.roundedRect(signX - 12, doc.y - 10, 220, 62, 6).fillAndStroke(SOFT_COLOR, LINE_COLOR);
  doc.moveTo(signX, doc.y + 24).lineTo(signX + 180, doc.y + 24).lineWidth(1).strokeColor(TEXT_COLOR).stroke();
  doc.fontSize(9).fillColor(MUTED_COLOR).text('Firma y Timbre', signX, doc.y + 30, {
    width: 180,
    align: 'center',
  });
  doc.fillColor(TEXT_COLOR);
}

export function buildMedicationDetail(item: Record<string, unknown>) {
  const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
  const activeIngredient = typeof item.activeIngredient === 'string' ? item.activeIngredient.trim() : '';
  const dosis = typeof item.dosis === 'string' ? item.dosis.trim() : '';
  const via = typeof item.via === 'string' ? item.via.trim() : '';
  const frecuencia = typeof item.frecuencia === 'string' ? item.frecuencia.trim() : '';
  const duracion = typeof item.duracion === 'string' ? item.duracion.trim() : '';
  const indicacion = typeof item.indicacion === 'string' ? item.indicacion.trim() : '';

  return {
    title: nombre || activeIngredient || 'Medicamento sin nombre',
    details: [
      activeIngredient && activeIngredient.toLowerCase() !== nombre.toLowerCase() ? `Principio activo: ${activeIngredient}` : '',
      dosis ? `Dosis: ${dosis}` : '',
      via ? `Via: ${via}` : '',
      frecuencia ? `Frecuencia: ${frecuencia}` : '',
      duracion ? `Duracion: ${duracion}` : '',
      indicacion ? `Indicacion: ${indicacion}` : '',
    ].filter(Boolean),
  };
}

export function buildOrderDetail(item: Record<string, unknown>) {
  const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
  const indicacion = typeof item.indicacion === 'string' ? item.indicacion.trim() : '';
  const estado = typeof item.estado === 'string' ? item.estado.trim() : '';

  return {
    title: nombre || 'Orden sin descripcion',
    details: [
      indicacion ? `Indicacion: ${indicacion}` : '',
      estado ? `Estado: ${estado}` : '',
    ].filter(Boolean),
  };
}
