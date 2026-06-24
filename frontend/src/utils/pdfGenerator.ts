import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFOptions {
  title: string;
  subtitle?: string;
  dateRange?: string;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  tableHead: string[][];
  tableBody: (string | number)[][];
  summary?: { label: string; value: string }[];
  summaryItems?: string[]; // For nested summary items like the vehicle breakdown
}

export const generatePremiumPDF = async ({
  title,
  subtitle,
  dateRange,
  filename,
  orientation = 'portrait',
  tableHead,
  tableBody,
  summary,
  summaryItems,
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
    console.warn("Logo not found or failed to load", e);
  }

  const drawHeaderAndFooter = () => {
    // --- Header ---
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 10, 24, 24);
    }

    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('PT. Kusuma Samudera Berkah', 42, 16);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text('Pertambangan & Konstruksi', 42, 22);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Jl. Pendidikan Tlogosadang, Kec. Paciran,', 42, 27);
    doc.text('Kab. Lamongan Jawa Timur 62264', 42, 31);

    doc.setTextColor(30, 58, 138); // Blue 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, pageWidth - 14 - titleWidth, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    let rightY = 26;
    if (dateRange) {
      const dateText = `Periode: ${dateRange}`;
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, pageWidth - 14 - dateWidth, rightY);
      rightY += 6;
    }
    if (subtitle) {
      const subWidth = doc.getTextWidth(subtitle);
      doc.text(subtitle, pageWidth - 14 - subWidth, rightY);
    }

    doc.setDrawColor(30, 64, 175); // Blue 800
    doc.setLineWidth(0.8);
    doc.line(14, 38, pageWidth - 14, 38);

    // --- Footer ---
    const footerY = pageHeight - 15;
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.5);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // Slate 500
    
    const printDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Dicetak pada: ${printDate} oleh System Kusuma`, 14, footerY);
    
    const pageStr = `Halaman ${(doc.internal as any).getNumberOfPages()}`;
    const pageNumWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - 14 - pageNumWidth, footerY);
  };

  // 1. Draw Summary Section (Page 1) if provided
  if (summary || summaryItems) {
    drawHeaderAndFooter(); // Draw for page 1
    
    let currentY = 48;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text("Ringkasan Dokumen:", 14, currentY);
    currentY += 8;
    
    doc.setFontSize(9);
    
    if (summary) {
      summary.forEach(item => {
        doc.setFont("helvetica", "bold");
        doc.text(item.label, 14, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(item.value, 60, currentY); // align values
        currentY += 6;
      });
    }

    if (summaryItems) {
      currentY += 4;
      doc.setFont("helvetica", "normal");
      summaryItems.forEach(item => {
        const indent = item.startsWith(' ') || item.startsWith('•') || item.startsWith('-') ? 20 : 14;
        if (!item.startsWith(' ') && !item.startsWith('•') && !item.startsWith('-')) {
          doc.setFont("helvetica", "bold");
        } else {
          doc.setFont("helvetica", "normal");
        }
        doc.text(item, indent, currentY);
        currentY += 6;
      });
    }

    // Force a new page for the details table
    doc.addPage();
  }

  // 2. Main Data Table
  // If there was no summary, we are still on Page 1. If there was a summary, we are on Page 2.
  autoTable(doc, {
    startY: 48,
    head: tableHead,
    body: tableBody,
    theme: 'plain',
    headStyles: { 
      fillColor: [13, 148, 136], // Teal 600
      textColor: 255, 
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      textColor: [30, 41, 59], // Slate 800
      fontSize: 9,
      lineColor: [226, 232, 240], // Slate 200
      lineWidth: { bottom: 0.5 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    margin: { top: 48, left: 14, right: 14, bottom: 30 },
    didDrawPage: () => {
      // Draw Header and Footer on every page the table is printed on
      drawHeaderAndFooter();
    }
  });

  doc.save(filename);
};
