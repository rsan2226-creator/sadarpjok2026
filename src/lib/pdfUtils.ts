import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PdfExportOptions {
  orientation?: 'portrait' | 'landscape';
  title?: string;
  marginMm?: number;
  scale?: number;
}

/**
 * Converts any DOM element into a crisp, multi-page downloadable PDF file.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: PdfExportOptions = {}
): Promise<boolean> {
  const {
    orientation = 'portrait',
    marginMm = 10,
    scale = 2
  } = options;

  try {
    const isLandscape = orientation === 'landscape';
    const pdfWidth = isLandscape ? 297 : 210;
    const pdfHeight = isLandscape ? 210 : 297;

    // Render DOM to canvas with proper options
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: isLandscape ? 1300 : 900,
      ignoreElements: (el) => {
        return (
          el.classList?.contains('no-print') || 
          el.classList?.contains('no-export') ||
          el.getAttribute('data-no-print') === 'true'
        );
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const contentWidth = pdfWidth - (marginMm * 2);
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    const pageContentHeight = pdfHeight - (marginMm * 2);

    let heightLeft = contentHeight;
    let position = marginMm;

    // Add first page
    pdf.addImage(imgData, 'JPEG', marginMm, position, contentWidth, contentHeight, undefined, 'FAST');
    heightLeft -= pageContentHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position -= pageContentHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', marginMm, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= pageContentHeight;
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Failed to generate PDF from element:', error);
    return false;
  }
}

/**
 * Converts a structured HTML document string into a high-quality, formatted downloadable PDF file.
 */
export async function downloadHtmlAsPdf(
  filename: string,
  htmlContent: string,
  options: PdfExportOptions = {}
): Promise<boolean> {
  const {
    orientation = 'portrait',
    title = 'Dokumen Pembelajaran',
    marginMm = 10,
    scale = 2
  } = options;

  const isLandscape = orientation === 'landscape';
  const targetWidthPx = isLandscape ? 1120 : 800;

  // Create temporary container in DOM with explicit A4 print styling
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.opacity = '0.01';
  container.style.pointerEvents = 'none';
  container.style.width = `${targetWidthPx}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.padding = '32px';
  container.style.fontFamily = "'Times New Roman', Times, Georgia, serif";
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.5';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';

  // Inject sanitized HTML and print styles
  container.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 14px !important; font-size: 11px !important; }
      th, td { border: 1px solid #1e293b !important; padding: 6px 8px !important; vertical-align: top !important; text-align: left; }
      th { background-color: #f1f5f9 !important; font-weight: bold !important; color: #0f172a !important; }
      h1, h2, h3, h4, h5, h6 { color: #0f172a !important; font-family: 'Times New Roman', serif; margin-top: 14px; margin-bottom: 8px; font-weight: bold; }
      h1 { font-size: 16px; text-align: center; text-transform: uppercase; }
      h2 { font-size: 14px; }
      h3 { font-size: 13px; }
      h4 { font-size: 12px; }
      ul, ol { margin-top: 4px; margin-bottom: 8px; padding-left: 20px; }
      li { margin-bottom: 3px; }
      p { margin-top: 0; margin-bottom: 6px; }
      .bg-slate-50, .bg-indigo-50 { background-color: #f8fafc !important; }
      .text-indigo-900, .text-indigo-950 { color: #1e1b4b !important; }
      .border { border-color: #0f172a !important; }
    </style>
    <div style="width: 100%;">
      ${htmlContent}
    </div>
  `;

  document.body.appendChild(container);

  try {
    const success = await downloadElementAsPdf(container, filename, {
      orientation,
      marginMm,
      scale
    });
    return success;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Opens a dedicated hidden printable iframe to reliably trigger the browser's native print preview dialog.
 * Works even when the main app is running in an iframe.
 */
export function printHtmlDocument(htmlContent: string, title: string = 'Dokumen'): boolean {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return false;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000000;
            background: #ffffff;
            line-height: 1.45;
            margin: 0;
            padding: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12pt;
          }
          th, td {
            border: 1px solid #000000;
            padding: 5pt 7pt;
            font-size: 10pt;
            vertical-align: top;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
          }
          h1, h2, h3, h4, h5 {
            color: #000000;
            margin-top: 14pt;
            margin-bottom: 6pt;
            page-break-after: avoid;
          }
          h1 { font-size: 14pt; text-align: center; font-weight: bold; text-transform: uppercase; }
          h2 { font-size: 12pt; font-weight: bold; }
          h3 { font-size: 11pt; font-weight: bold; }
          ul, ol { margin-top: 4pt; margin-bottom: 6pt; padding-left: 18pt; }
          li { margin-bottom: 2pt; }
          .page-break { page-break-before: always; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }
    }, 400);

    return true;
  } catch (err) {
    console.error('Error during print iframe execution:', err);
    try {
      window.print();
    } catch (_) {
      // Ignore
    }
    return false;
  }
}
