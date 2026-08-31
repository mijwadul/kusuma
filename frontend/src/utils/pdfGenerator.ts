import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFRecipientInfo {
  name: string;
  subName?: string;
  address?: string;
  phone?: string;
  contact?: string;
}

export interface PDFBankInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface PDFOptions {
  title: string;
  subtitle?: string;
  invoiceNumber?: string;
  dateRange?: string;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  recipient?: PDFRecipientInfo;
  bankInfo?: PDFBankInfo;
  notes?: string;

  // Page 1: Tabel Rekapitulasi (Invoice format)
  rekapTitle?: string;
  rekapHead?: string[][];
  rekapBody?: (string | number | any)[][];
  rekapSummary?: { label: string; value: string; isHighlight?: boolean }[];

  // Fallback summary (if no rekap table)
  summary?: { label: string; value: string }[];
  summaryItems?: string[];

  // Page 2+: Tabel Lampiran Detail
  detailTitle?: string;
  tableHead?: string[][];
  tableBody?: (string | number | any)[][];
}

export const generatePremiumPDF = async ({
  title,
  subtitle,
  invoiceNumber,
  dateRange,
  filename,
  orientation = 'landscape',
  recipient,
  bankInfo,
  notes,
  rekapTitle = 'REKAPITULASI TAGIHAN / AKTIVITAS',
  rekapHead,
  rekapBody,
  rekapSummary,
  summary,
  summaryItems,
  detailTitle = 'LAMPIRAN RINCIAN DETAIL SURAT JALAN',
  tableHead,
  tableBody,
}: PDFOptions) => {

  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Load Logo
  let logoImg: HTMLImageElement | null = null;
  try {
    const img = new Image();
    img.src = '/logo.png';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    logoImg = img;
  } catch (e) {
    console.warn('Logo not found or failed to load', e);
  }

  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const drawHeaderAndFooter = (isLampiran = false) => {
    // --- Header ---
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 8, 22, 22);
    }

    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PT. KUSUMA SAMUDERA BERKAH', 38, 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text('Pertambangan & Jasa Konstruksi', 38, 19);
    doc.text('Jl. Pendidikan Tlogosadang, Kec. Paciran, Kab. Lamongan 62264', 38, 23);

    // Title on Right
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const mainTitle = isLampiran ? detailTitle : title;
    const titleWidth = doc.getTextWidth(mainTitle);
    doc.text(mainTitle, pageWidth - 14 - titleWidth, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    let rightY = 19;
    if (invoiceNumber) {
      const invText = `No: ${invoiceNumber}`;
      doc.text(invText, pageWidth - 14 - doc.getTextWidth(invText), rightY);
      rightY += 4.5;
    }
    if (dateRange) {
      const dateText = `Periode: ${dateRange}`;
      doc.text(dateText, pageWidth - 14 - doc.getTextWidth(dateText), rightY);
      rightY += 4.5;
    }
    if (subtitle && !isLampiran) {
      doc.text(subtitle, pageWidth - 14 - doc.getTextWidth(subtitle), rightY);
    }

    // Divider Line
    doc.setDrawColor(37, 99, 235); // Blue 600
    doc.setLineWidth(0.8);
    doc.line(14, 32, pageWidth - 14, 32);

    // --- Footer ---
    const footerY = pageHeight - 10;
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.4);
    doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Dicetak otomatis oleh System Kusuma pada ${printDateStr} · Dokumen ini sah dan mengikat.`,
      14,
      footerY
    );

    const pageStr = `Halaman ${(doc.internal as any).getNumberOfPages()}`;
    const pageNumWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - 14 - pageNumWidth, footerY);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE 1: LEMBAR REKAPITULASI / INVOICE
  // ───────────────────────────────────────────────────────────────────────────
  drawHeaderAndFooter(false);

  let currentY = 37;

  // Metadata / Info Box (Kepada Yth & Info Dokumen)
  if (recipient || subtitle || dateRange) {
    const boxWidth = (pageWidth - 28 - 6) / 2;

    // Left Box: Kepada Yth
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, boxWidth, 22, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('KEPADA YTH / PIHAK TERKAIT:', 18, currentY + 5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(recipient?.name || subtitle || 'Vendor / Pelanggan', 18, currentY + 11);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const sub = recipient?.address || recipient?.contact || (recipient?.subName ? recipient.subName : '');
    if (sub) {
      doc.text(sub, 18, currentY + 16);
    }

    // Right Box: Info Dokumen
    const rightBoxX = 14 + boxWidth + 6;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(rightBoxX, currentY, boxWidth, 22, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('INFORMASI DOKUMEN:', rightBoxX + 4, currentY + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Tanggal Cetak : ${printDateStr}`, rightBoxX + 4, currentY + 11);
    doc.text(`Periode          : ${dateRange || '-'}`, rightBoxX + 4, currentY + 16);

    currentY += 26;
  }

  // Draw Page 1 Table (Rekap Table or Summary Table)
  const hasRekapTable = rekapHead && rekapHead.length > 0 && rekapBody && rekapBody.length > 0;

  if (hasRekapTable) {
    if (rekapTitle) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text(rekapTitle, 14, currentY - 1.5);
    }

    autoTable(doc, {
      startY: currentY,
      head: rekapHead,
      body: rekapBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138], // Blue 900
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: {
        textColor: [15, 23, 42],
        fontSize: 8,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  } else if ((summary && summary.length > 0) || (summaryItems && summaryItems.length > 0)) {
    // Render summary as a neat invoice table
    const summaryRows = summary && summary.length > 0
      ? summary.map((s, idx) => [idx + 1, s.label, s.value])
      : (summaryItems || []).map((itemStr, idx) => [idx + 1, itemStr, '']);

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Keterangan / Uraian', 'Nilai / Total']],
      body: summaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { halign: 'left', fontStyle: 'bold' },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 60 },
      },
      bodyStyles: {
        textColor: [15, 23, 42],
        fontSize: 8.5,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }


  // Summary Highlight Cards / Rows at bottom of Page 1 if any
  if (rekapSummary && rekapSummary.length > 0) {
    const sumBody = rekapSummary.map((item) => [
      item.label,
      item.value,
    ]);

    autoTable(doc, {
      startY: currentY,
      body: sumBody,
      theme: 'plain',
      columnStyles: {
        0: { halign: 'right', fontStyle: 'bold', fontSize: 8.5 },
        1: { halign: 'right', fontStyle: 'bold', fontSize: 9, cellWidth: 50 },
      },
      bodyStyles: {
        textColor: [15, 23, 42],
        cellPadding: 1.5,
      },
      margin: { left: pageWidth - 14 - 120, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Signature and Notes info at bottom of Page 1
  const sigY = Math.max(currentY, pageHeight - 45);

  // Left: Notes or Payment info if provided
  if (bankInfo) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('INFORMASI PEMBAYARAN:', 14, sigY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${bankInfo.bankName} - No. Rekening: ${bankInfo.accountNumber}`, 14, sigY + 4.5);
    doc.text(`Atas Nama: ${bankInfo.accountName}`, 14, sigY + 8.5);
  } else if (notes) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CATATAN / KETERANGAN:', 14, sigY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(notes, 14, sigY + 4.5);
  }


  // Right: Signature Box
  const sigBoxX = pageWidth - 14 - 60;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`Lamongan, ${printDateStr}`, sigBoxX, sigY, { align: 'center' });
  doc.text('Hormat Kami,', sigBoxX, sigY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('PT. Kusuma Samudera Berkah', sigBoxX, sigY + 8.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('( Finance Dept. )', sigBoxX, sigY + 26, { align: 'center' });

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE 2+: LAMPIRAN DETAIL RINCIAN TRANSAKSI / SURAT JALAN
  // ───────────────────────────────────────────────────────────────────────────
  if (tableHead && tableHead.length > 0 && tableBody && tableBody.length > 0) {
    doc.addPage();

    autoTable(doc, {
      startY: 38,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 118, 110], // Teal 700
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 2.5,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { top: 38, left: 14, right: 14, bottom: 18 },
      didDrawPage: () => {
        drawHeaderAndFooter(true);
      },
    });
  }

  doc.save(filename);
};
