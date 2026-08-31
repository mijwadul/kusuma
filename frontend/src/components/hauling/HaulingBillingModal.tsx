import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  X,
  ReceiptText,
  Download,
  Calendar,
  Truck,
  Building2,
  Loader2,
  History,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  Filter,
} from 'lucide-react';

import { Vendor } from '../../hooks/useVendors';
import {
  useVendorTrucks,
  useVendorHaulingDetails,
  useVendorHaulingBilling,
  useCreateHaulingBill,
  useHaulingBills,
  useDeleteHaulingBill,
} from '../../hooks/useHauling';
import { generatePremiumPDF } from '../../utils/pdfGenerator';
import { toLocalDateInput } from '../../utils/formatters';
import CustomSelect from '../CustomSelect';

interface HaulingBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

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

export default function HaulingBillingModal({ isOpen, onClose, vendor }: HaulingBillingModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Filter parameters for new bill
  const [startDate, setStartDate] = useState(
    toLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [endDate, setEndDate] = useState(toLocalDateInput(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedNopol, setSelectedNopol] = useState<string>('');
  const [onlyUnbilled, setOnlyUnbilled] = useState<boolean>(true);
  const [billNumber, setBillNumber] = useState<string>('');
  const [billNotes, setBillNotes] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Trucks of this vendor
  const { data: trucks = [] } = useVendorTrucks(isOpen && vendor ? vendor.id : undefined);

  // Projects list for vendor
  const { data: vendorDetails = [] } = useVendorHaulingDetails(isOpen && vendor ? vendor.id : null);

  const uniqueProjects = useMemo(() => {
    const map = new Map<number, string>();
    vendorDetails.forEach((d: any) => {
      if (d.project_id && !map.has(d.project_id)) {
        map.set(d.project_id, d.project_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [vendorDetails]);

  // Billing Preview Data Query
  const {
    data: billingData,
    isLoading: loadingBilling,
    isFetching,
    refetch: refetchBilling,
  } = useVendorHaulingBilling({
    vendorId: vendor?.id,
    startDate,
    endDate,
    projectId: selectedProjectId ? Number(selectedProjectId) : null,
    nopol: selectedNopol || null,
    onlyUnbilled,
    enabled: isOpen && !!vendor && activeTab === 'create',
  });

  // Saved Bills Query
  const { data: savedBills = [], isLoading: loadingSavedBills } = useHaulingBills({
    vendorId: isOpen && vendor ? vendor.id : undefined,
  });

  const createBillMutation = useCreateHaulingBill();
  const deleteBillMutation = useDeleteHaulingBill();

  if (!isOpen || !vendor) return null;

  const toggleDateExpand = (d: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [d]: prev[d] === undefined ? false : !prev[d],
    }));
  };

  const generatePDFDocument = async (dataToExport: any, billNo?: string) => {
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
        g.measurement, // Raw measurement tanpa pembulatan
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
      { content: `${dataToExport.total_measurement} ${unit}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
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
          r.measurement, // Raw measurement tanpa pembulatan
          formatIDR(r.hauling_price),
          formatIDR(r.hauling_cost),
          r.material_deduction > 0 ? `(${formatIDR(r.material_deduction)})` : '-',
          formatIDR(r.net_cost),
        ]);
      });

      // Subtotal Row per Date
      detailBody.push([
        { content: `Subtotal ${formatDate(g.date)}:`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${g.measurement} ${unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: '' },
        { content: formatIDR(g.hauling_cost), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: g.material_deduction > 0 ? `(${formatIDR(g.material_deduction)})` : '-', styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9] } },
        { content: formatIDR(g.net_cost), styles: { fontStyle: 'bold', halign: 'right', textColor: [13, 148, 136] } },
      ]);
    });

    // Grand Total Row at bottom of Detail Annex
    detailBody.push([
      { content: 'GRAND TOTAL DETAIL:', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
      { content: `${dataToExport.total_measurement} ${unit}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
      { content: '', styles: { fillColor: [241, 245, 249] } },
      { content: formatIDR(dataToExport.total_hauling_cost), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
      { content: `(${formatIDR(dataToExport.total_material_deduction)})`, styles: { fontStyle: 'bold', halign: 'right', textColor: [180, 83, 9], fillColor: [241, 245, 249] } },
      { content: formatIDR(dataToExport.total_net), styles: { fontStyle: 'bold', halign: 'right', textColor: [16, 185, 129], fillColor: [209, 250, 229] } },
    ]);

    await generatePremiumPDF({
      title: 'REKAPITULASI PEMBAYARAN HAULING',
      subtitle: dataToExport.project_name ? `Proyek: ${dataToExport.project_name}` : 'Semua Proyek',
      invoiceNumber: billNo || dataToExport.bill_number,
      dateRange: `${formatDate(dataToExport.period_start || dataToExport.start_date)} s/d ${formatDate(dataToExport.period_end || dataToExport.end_date)}`,
      filename: `Rekap_Hauling_${vendor.name.replace(/\s+/g, '_')}_${dataToExport.period_start || dataToExport.start_date}_${dataToExport.period_end || dataToExport.end_date}.pdf`,
      orientation: 'landscape',
      recipient: {
        name: vendor.name,
        contact: vendor.contact_person ? `CP: ${vendor.contact_person} (${vendor.phone || '-'})` : undefined,
        address: vendor.address || undefined,
      },
      notes: billNotes || dataToExport.notes || undefined,
      rekapTitle: 'REKAPITULASI OPERASIONAL & BIAYA HAULING',
      rekapHead,
      rekapBody,
      detailTitle: 'LAMPIRAN RINCIAN DETAIL SURAT JALAN HAULING',
      tableHead: detailHead,
      tableBody: detailBody,
    });
  };

  const handleSaveAndExport = async () => {
    if (!billingData || billingData.rows.length === 0) {
      toast.error('Tidak ada data surat jalan untuk disimpan pada filter ini.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // 1. Save to Database
      const savedBill = await createBillMutation.mutateAsync({
        vendor_id: vendor.id,
        project_id: selectedProjectId ? Number(selectedProjectId) : null,
        nopol: selectedNopol || null,
        start_date: startDate,
        end_date: endDate,
        bill_number: billNumber || null,
        notes: billNotes || null,
        sj_ids: billingData.rows.map((r: any) => r.sj_id),
      });

      // 2. Generate PDF
      await generatePDFDocument(billingData, savedBill.bill_number);

      toast.success(`Laporan ${savedBill.bill_number} berhasil disimpan dan dicetak!`);
      refetchBilling();
      setActiveTab('history');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Gagal menyimpan dan membuat dokumen PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDraftPDF = async () => {
    if (!billingData || billingData.rows.length === 0) {
      toast.error('Tidak ada data surat jalan untuk dicetak.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      await generatePDFDocument(billingData, 'DRAFT-PREVIEW');
      toast.success('Draft Laporan PDF berhasil didownload!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat dokumen PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadSavedBill = async (bill: any) => {
    setIsGeneratingPDF(true);
    try {
      const response = await fetch(`/api/v1/hauling/bills/${bill.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Gagal mengambil data laporan tersimpan');
      const billDetail = await response.json();

      await generatePDFDocument(billDetail, billDetail.bill_number);
      toast.success(`Laporan ${billDetail.bill_number} berhasil didownload!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mendownload laporan tersimpan');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDeleteSavedBill = async (billId: number, billNumberStr: string) => {
    if (!confirm(`Batalkan / Hapus laporan ${billNumberStr}? Semua surat jalan di dalamnya akan dapat ditagihkan kembali.`)) {
      return;
    }
    try {
      await deleteBillMutation.mutateAsync(billId);
      toast.success(`Laporan ${billNumberStr} berhasil dihapus.`);
    } catch (err) {
      toast.error('Gagal menghapus laporan');
    }
  };

  const unitLabel = billingData?.measurement_type === 'kubikasi' ? 'm³' : 'ton';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <ReceiptText size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Rekapitulasi Pembayaran Hauling
              </h2>
              <p className="text-xs text-slate-400">
                Vendor: <span className="text-blue-400 font-semibold">{vendor.name}</span>
                {vendor.contact_person && ` • CP: ${vendor.contact_person}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-slate-100 px-6 pt-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-2 ${activeTab === 'create'
                ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            <Filter size={14} /> Buat Rekap Baru
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-2 ${activeTab === 'history'
                ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            <History size={14} /> Riwayat Laporan Tersimpan ({savedBills.length})
          </button>
        </div>

        {activeTab === 'create' ? (
          <>
            {/* Filter Controls Bar */}
            <div className="p-5 bg-slate-50 border-b border-slate-200/80 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-blue-500" /> Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-blue-500" /> Tanggal Akhir
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Truck size={13} className="text-blue-500" /> No. Polisi Truk
                  </label>
                  <CustomSelect
                    value={selectedNopol}
                    onChange={(val) => setSelectedNopol(val as string)}
                    options={[
                      { value: '', label: '-- Semua Truk / Nopol --' },
                      ...trucks.map((t: any) => ({
                        value: t.nopol,
                        label: `${t.nopol} ${t.supir_default ? `(${t.supir_default})` : ''}`,
                      })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Building2 size={13} className="text-blue-500" /> Filter Proyek
                  </label>
                  <CustomSelect
                    value={selectedProjectId}
                    onChange={(val) => setSelectedProjectId(val as string)}
                    options={[
                      { value: '', label: '-- Semua Proyek --' },
                      ...uniqueProjects.map((p) => ({
                        value: String(p.id),
                        label: p.name,
                      })),
                    ]}
                  />
                </div>
              </div>

              {/* Status Filter Toggle & Notes */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyUnbilled}
                    onChange={(e) => setOnlyUnbilled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-700">
                    Hanya tampilkan surat jalan yang belum pernah ditagihkan (Mencegah Double Billing)
                  </span>
                </label>

                {billingData && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-semibold">
                      {billingData.unbilled_count} Belum Ditagih
                    </span>
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg">
                      {billingData.billed_count} Sudah Ditagih
                    </span>
                  </div>
                )}
              </div>

              {/* Optional Custom Bill Number & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    No. Laporan / Rekap (Opsional - otomatis dibuat jika kosong)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: RTH-20260831-001"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Catatan Tambahan pada Laporan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pembayaran periode akhir bulan Agustus..."
                    value={billNotes}
                    onChange={(e) => setBillNotes(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>


            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Summary Stat Cards */}
              {billingData && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 shadow-sm">
                    <span className="text-xs text-gray-500 block">Total Ritase</span>
                    <span className="text-xl font-bold text-gray-900 mt-1 block">
                      {billingData.total_ritase}{' '}
                      <span className="text-xs font-normal text-gray-500">Rit</span>
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 shadow-sm">
                    <span className="text-xs text-gray-500 block">
                      Total {billingData.measurement_type === 'kubikasi' ? 'Kubikasi' : 'Tonase'}
                    </span>
                    <span className="text-xl font-bold text-gray-900 mt-1 block">
                      {billingData.total_measurement}{' '}
                      <span className="text-xs font-normal text-gray-500">{unitLabel}</span>
                    </span>
                  </div>
                  <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 shadow-sm">
                    <span className="text-xs text-blue-700 block">Biaya Hauling Kotor</span>
                    <span className="text-lg font-bold text-blue-900 mt-1 block">
                      {formatIDR(billingData.total_hauling_cost)}
                    </span>
                  </div>
                  <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5 shadow-sm">
                    <span className="text-xs text-amber-700 block">Potongan Material</span>
                    <span className="text-lg font-bold text-amber-800 mt-1 block">
                      - {formatIDR(billingData.total_material_deduction)}
                    </span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 shadow-sm col-span-2 lg:col-span-1">
                    <span className="text-xs text-emerald-700 font-semibold block">Total Tagihan (Net)</span>
                    <span className="text-xl font-extrabold text-emerald-800 mt-1 block">
                      {formatIDR(billingData.total_net)}
                    </span>
                  </div>
                </div>
              )}

              {/* Grouped Dates Accordion Table (Sama persis seperti Surat Jalan Proyek) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Calendar size={15} className="text-blue-600" /> Rincian Perjalanan per Tanggal Operasional
                  </h3>
                  {(loadingBilling || isFetching) && (
                    <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                      <Loader2 size={13} className="animate-spin" /> Memuat data...
                    </span>
                  )}
                </div>

                {loadingBilling ? (
                  <div className="py-12 text-center text-gray-400 border border-gray-200 rounded-xl">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Mengambil data surat jalan...
                  </div>
                ) : !billingData || billingData.grouped_dates.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 border border-gray-200 rounded-xl bg-gray-50">
                    Tidak ada aktivitas surat jalan untuk vendor ini pada filter yang dipilih.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200 shadow-sm">
                    {billingData.grouped_dates.map((g: any) => {
                      const dateKey = String(g.date);
                      const isExpanded = expandedDates[dateKey] !== false; // default expanded

                      return (
                        <div key={dateKey} className="bg-white">
                          {/* Date Header Accordion Button */}
                          <button
                            onClick={() => toggleDateExpand(dateKey)}
                            className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              {isExpanded ? (
                                <ChevronDown size={17} className="text-blue-600" />
                              ) : (
                                <ChevronRight size={17} className="text-gray-400" />
                              )}
                              <span className="font-bold text-sm text-gray-900">
                                {formatDate(g.date)}
                              </span>
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                                {g.ritase} Rit
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="font-semibold text-gray-700">
                                Vol/Ton: <strong>{g.measurement}</strong> {unitLabel}
                              </span>
                              <span className="font-bold text-emerald-700">
                                Net: {formatIDR(g.net_cost)}
                              </span>
                            </div>
                          </button>

                          {/* Date Table of Trips */}
                          {isExpanded && (
                            <div className="overflow-x-auto border-t border-gray-100">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b whitespace-nowrap">
                                  <tr>
                                    <th className="px-3 py-2 text-left">No</th>
                                    <th className="px-3 py-2 text-left">No. Polisi</th>
                                    <th className="px-3 py-2 text-left">Supir</th>
                                    <th className="px-3 py-2 text-right">Vol / Netto ({unitLabel})</th>
                                    <th className="px-3 py-2 text-right">Tarif</th>
                                    <th className="px-3 py-2 text-right">Biaya Kotor</th>
                                    <th className="px-3 py-2 text-right">Pot. Material</th>
                                    <th className="px-3 py-2 text-right">Net Tagihan</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {g.rows.map((r: any, idx: number) => (
                                    <tr key={r.sj_id} className="hover:bg-blue-50/40 transition-colors">
                                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                                        {r.nopol}
                                      </td>
                                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.supir || '-'}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                        {r.measurement}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600">{formatIDR(r.hauling_price)}</td>
                                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                                        {formatIDR(r.hauling_cost)}
                                      </td>
                                      <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {r.material_deduction > 0 ? (
                                          <span className="text-amber-700 font-medium">
                                            ({formatIDR(r.material_deduction)})
                                          </span>
                                        ) : (
                                          <span className="text-gray-300">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold text-emerald-700">
                                        {formatIDR(r.net_cost)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-slate-100 font-bold text-gray-800 border-t">
                                  <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right">
                                      Subtotal {formatDate(g.date)}:
                                    </td>
                                    <td className="px-3 py-2 text-right text-blue-900">
                                      {g.measurement} {unitLabel}
                                    </td>
                                    <td className="px-3 py-2"></td>
                                    <td className="px-3 py-2 text-right text-gray-900">
                                      {formatIDR(g.hauling_cost)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-amber-700">
                                      {g.material_deduction > 0 ? `(${formatIDR(g.material_deduction)})` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-emerald-800">
                                      {formatIDR(g.net_cost)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-xs text-gray-500">
                {billingData ? (
                  <span>
                    Total: <strong>{billingData.total_ritase}</strong> ritase • Grand Total Net:{' '}
                    <strong className="text-emerald-700">{formatIDR(billingData.total_net)}</strong>
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2.5 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-xs transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={handleDraftPDF}
                  disabled={isGeneratingPDF || !billingData || billingData.rows.length === 0}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Cetak preview tanpa menyimpan ke database"
                >
                  <Download size={15} /> Cetak Draft PDF
                </button>
                <button
                  onClick={handleSaveAndExport}
                  disabled={
                    isGeneratingPDF ||
                    createBillMutation.isPending ||
                    !billingData ||
                    billingData.rows.length === 0
                  }
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isGeneratingPDF || createBillMutation.isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Simpan &amp; Cetak Laporan
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* TAB 2: RIWAYAT LAPORAN TERSIMPAN */
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">
                Riwayat Rekapitulasi Tagihan Tersimpan ({savedBills.length})
              </h3>
              <span className="text-xs text-gray-500">
                Laporan yang tersimpan tidak akan tertagih ganda dan dapat didownload ulang kapan saja.
              </span>
            </div>

            {loadingSavedBills ? (
              <div className="py-12 text-center text-gray-400 border border-gray-200 rounded-xl">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                Memuat riwayat laporan...
              </div>
            ) : savedBills.length === 0 ? (
              <div className="py-12 text-center text-gray-400 border border-gray-200 rounded-xl bg-gray-50">
                Belum ada riwayat laporan tagihan yang disimpan untuk vendor ini.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b whitespace-nowrap">
                    <tr>
                      <th className="px-4 py-3 text-left">No. Laporan</th>
                      <th className="px-4 py-3 text-left">Tanggal Buat</th>
                      <th className="px-4 py-3 text-left">Periode</th>
                      <th className="px-4 py-3 text-left">Proyek / Nopol</th>
                      <th className="px-4 py-3 text-right">Ritase</th>
                      <th className="px-4 py-3 text-right">Vol / Netto</th>
                      <th className="px-4 py-3 text-right">Total Net</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {savedBills.map((b: any) => (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-blue-700 whitespace-nowrap">
                          {b.bill_number}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(b.bill_date)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(b.start_date)} - {formatDate(b.end_date)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {b.project_name || 'Semua Proyek'}
                          {b.nopol && ` (${b.nopol})`}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{b.total_ritase} Rit</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {b.total_measurement} {b.measurement_type === 'kubikasi' ? 'm³' : 'ton'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          {formatIDR(b.total_net)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleDownloadSavedBill(b)}
                              disabled={isGeneratingPDF}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Download PDF"
                            >
                              <Download size={13} /> Download PDF
                            </button>
                            <button
                              onClick={() => handleDeleteSavedBill(b.id, b.bill_number)}
                              disabled={deleteBillMutation.isPending}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                              title="Hapus / Batalkan Laporan (Kembalikan Surat Jalan ke status Belum Ditagih)"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
