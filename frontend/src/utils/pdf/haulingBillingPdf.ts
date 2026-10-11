import { generatePremiumPDF } from '../pdfGenerator';
import { Vendor } from '../../hooks/useVendors';

const formatIDR = (v: any) =>
  Number(v ?? 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  });

const formatDate = (d: any) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatQty = (n: number | string | null | undefined): string => {
  if (n == null || n === '') return '0';
  const num = typeof n === 'number' ? n : parseFloat(String(n));
  if (isNaN(num)) return '0';
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return rounded.toString();
};

export interface HaulingBillingPDFOptions {
  billNo?: string;
  selectedNopols?: string[];
  notes?: string;
}

export async function generateHaulingBillingPDF(
  vendor: Vendor,
  dataToExport: any,
  options: HaulingBillingPDFOptions = {}
) {
  const { billNo, selectedNopols = [], notes } = options;
  const unit = dataToExport.measurement_type === 'kubikasi' ? 'm³' : 'Ton';

  // ── Table Rekap Halaman 1 (Per Tanggal Operasional) ──────────────────────
  const rekapHead = [
    [
      'No',
      'Tanggal Operasional',
      'Ritase',
      `Total Vol / Netto (${unit})`,
      `Tarif (/ ${unit})`,
      'Total Biaya Kotor',
      'Pot. Material',
      'Net Tagihan',
    ],
  ];

  const rekapBody: any[] = dataToExport.grouped_dates.map((g: any, idx: number) => {
    const rateDisplay = g.rates.map((r: number) => formatIDR(r)).join(' / ');
    return [
      idx + 1,
      formatDate(g.date),
      `${g.ritase} Rit`,
      formatQty(g.measurement),
      rateDisplay || '-',
      formatIDR(g.hauling_cost),
      g.material_deduction > 0 ? `(${formatIDR(g.material_deduction)})` : '-',
      formatIDR(g.net_cost),
    ];
  });

  // Baris Total di Rekap Table
  rekapBody.push([
    { content: 'TOTAL KESELURUHAN:', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
    { content: `${dataToExport.total_ritase} Rit`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } },
    { content: `${formatQty(dataToExport.total_measurement)} ${unit}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
    { content: formatIDR(dataToExport.total_hauling_cost), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
    { content: `(${formatIDR(dataToExport.total_material_deduction)})`, styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9], fillColor: [241, 245, 249] } },
    { content: formatIDR(dataToExport.total_net), styles: { fontStyle: 'bold', halign: 'right', textColor: [16, 185, 129], fillColor: [209, 250, 229] } },
  ]);

  // ── Table Rincian Detail Halaman 2+ (Grouped per Date with Subtotals) ─────
  const detailHead = [
    [
      'No',
      'Tanggal',
      'No. Polisi',
      'Supir',
      `Vol / Netto (${unit})`,
      `Tarif (/ ${unit})`,
      'Biaya Kotor',
      'Pot. Material',
      'Net Tagihan',
    ],
  ];

  const detailBody: any[] = [];
  let globalNo = 1;

  dataToExport.grouped_dates.forEach((g: any) => {
    // Date Section Header Row
    detailBody.push([
      {
        content: `Tanggal Operasional: ${formatDate(g.date)} (${g.ritase} Ritase)`,
        colSpan: 9,
        styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'left' },
      },
    ]);

    g.rows.forEach((r: any) => {
      detailBody.push([
        globalNo++,
        formatDate(r.sj_date),
        r.nopol || '-',
        r.supir || '-',
        formatQty(r.measurement),
        formatIDR(r.hauling_price),
        formatIDR(r.hauling_cost),
        r.material_deduction > 0 ? `(${formatIDR(r.material_deduction)})` : '-',
        formatIDR(r.net_cost),
      ]);
    });

    // Subtotal Row per Date
    detailBody.push([
      { content: `Subtotal ${formatDate(g.date)}:`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: `${formatQty(g.measurement)} ${unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: '' },
      { content: formatIDR(g.hauling_cost), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: g.material_deduction > 0 ? `(${formatIDR(g.material_deduction)})` : '-', styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9] } },
      { content: formatIDR(g.net_cost), styles: { fontStyle: 'bold', halign: 'right', textColor: [13, 148, 136] } },
    ]);
  });

  // Grand Total Row at bottom of Detail Annex
  detailBody.push([
    { content: 'GRAND TOTAL DETAIL:', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
    { content: `${formatQty(dataToExport.total_measurement)} ${unit}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
    { content: formatIDR(dataToExport.total_hauling_cost), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
    { content: `(${formatIDR(dataToExport.total_material_deduction)})`, styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9], fillColor: [241, 245, 249] } },
    { content: formatIDR(dataToExport.total_net), styles: { fontStyle: 'bold', halign: 'right', textColor: [16, 185, 129], fillColor: [209, 250, 229] } },
  ]);

  await generatePremiumPDF({
    title: 'REKAPITULASI PEMBAYARAN HAULING',
    subtitle: [
      dataToExport.project_name ? `Proyek: ${dataToExport.project_name}` : 'Semua Proyek',
      dataToExport.nopol
        ? `Nopol: ${dataToExport.nopol}`
        : selectedNopols.length > 0
        ? `Nopol: ${selectedNopols.join(', ')}`
        : null,
    ].filter(Boolean).join(' | '),
    invoiceNumber: billNo || dataToExport.bill_number,
    dateRange: `${formatDate(dataToExport.period_start || dataToExport.start_date)} s/d ${formatDate(dataToExport.period_end || dataToExport.end_date)}`,
    filename: `Rekap_Hauling_${vendor.name.replace(/\s+/g, '_')}_${dataToExport.period_start || dataToExport.start_date}_${dataToExport.period_end || dataToExport.end_date}.pdf`,
    orientation: 'landscape',
    recipient: {
      name: vendor.name,
      contact: vendor.contact_person ? `CP: ${vendor.contact_person} (${vendor.phone || '-'})` : undefined,
      address: vendor.address || undefined,
    },
    notes: notes || dataToExport.notes || undefined,
    rekapTitle: 'REKAPITULASI OPERASIONAL & BIAYA HAULING',
    rekapHead,
    rekapBody,
    detailTitle: 'LAMPIRAN RINCIAN DETAIL SURAT JALAN HAULING',
    tableHead: detailHead,
    tableBody: detailBody,
  });
}
