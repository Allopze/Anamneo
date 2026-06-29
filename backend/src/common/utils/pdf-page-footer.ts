export function addPageNumbers(doc: PDFKit.PDFDocument, pageWidth: number) {
  const totalPages = doc.bufferedPageRange().count;

  for (let index = 0; index < totalPages; index += 1) {
    doc.switchToPage(index);

    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#4b5563')
      .text(
        `Página ${index + 1} de ${totalPages}`,
        doc.page.margins.left,
        doc.page.height - 35,
        {
          width: pageWidth,
          align: 'center',
          lineBreak: false,
        },
      )
      .fillColor('#000000');

    doc.page.margins.bottom = originalBottomMargin;
  }
}
