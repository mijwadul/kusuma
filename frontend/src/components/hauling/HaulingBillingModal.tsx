import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  X,
  ReceiptText,
  History,
  Filter,
} from 'lucide-react';

import { Vendor } from '../../hooks/useVendors';
import {
  useVendorTrucks,
  useVendorHaulingBilling,
  useCreateHaulingBill,
  useHaulingBills,
  useDeleteHaulingBill,
  useVendorHaulingDetails,
} from '../../hooks/useHauling';
import { useProjectsList } from '../../hooks/useProjects';
import { toLocalDateInput } from '../../utils/formatters';
import { generateHaulingBillingPDF } from '../../utils/pdf/haulingBillingPdf';
import CreateHaulingBillTab from './CreateHaulingBillTab';
import HaulingBillHistoryTab from './HaulingBillHistoryTab';

interface HaulingBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

export default function HaulingBillingModal({ isOpen, onClose, vendor }: HaulingBillingModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Filter parameters for new bill
  const [startDate, setStartDate] = useState(
    toLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [endDate, setEndDate] = useState(toLocalDateInput(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedNopols, setSelectedNopols] = useState<string[]>([]);
  const [onlyUnbilled, setOnlyUnbilled] = useState<boolean>(true);
  const [billNumber, setBillNumber] = useState<string>('');
  const [billNotes, setBillNotes] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState<boolean>(true);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Queries
  const { data: trucks = [] } = useVendorTrucks(vendor?.id);
  const { data: vendorDetails = [] } = useVendorHaulingDetails(isOpen ? vendor?.id : null);
  const { data: allProjects = [] } = useProjectsList();

  const {
    data: billingData,
    isLoading: loadingBilling,
    refetch: refetchBilling,
  } = useVendorHaulingBilling({
    vendorId: vendor?.id,
    startDate,
    endDate,
    projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
    nopol: selectedNopols.length > 0 ? selectedNopols.join(',') : undefined,
    onlyUnbilled,
  });

  const { data: savedBills = [], isLoading: loadingSavedBills } = useHaulingBills(
    vendor?.id ? { vendorId: vendor.id } : undefined
  );

  // Projects list for dropdown filter
  const uniqueProjects = useMemo(() => {
    const map = new Map<number, string>();

    // 1. Prioritaskan proyek di mana vendor memiliki riwayat/kewajiban hauling
    vendorDetails.forEach((d: any) => {
      if (d.project_id && d.project_name) {
        map.set(d.project_id, d.project_name);
      }
    });

    // 2. Tambahkan proyek yang muncul di baris billing saat ini (jika ada)
    if (billingData?.rows) {
      billingData.rows.forEach((r: any) => {
        if (r.project_id && r.project_name) {
          map.set(r.project_id, r.project_name);
        }
      });
    }

    // 3. Jika belum ada proyek spesifik vendor, fallback ke seluruh daftar proyek
    if (map.size === 0 && allProjects.length > 0) {
      allProjects.forEach((p: any) => {
        if (p.id && p.name) {
          map.set(p.id, p.name);
        }
      });
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [vendorDetails, billingData, allProjects]);

  // Mutations
  const createBillMutation = useCreateHaulingBill();
  const deleteBillMutation = useDeleteHaulingBill();

  const truckOptions = useMemo(() => {
    return trucks.map((t: any) => ({
      value: t.nopol,
      label: t.nopol,
      subLabel: t.supir_default ? `Supir: ${t.supir_default}` : undefined,
    }));
  }, [trucks]);

  if (!isOpen || !vendor) return null;

  const toggleDateExpand = (d: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [d]: prev[d] === undefined ? false : !prev[d],
    }));
  };

  const downloadPDFBlob = async (url: string, filename: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Gagal mengunduh dokumen PDF dari server');
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
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
        nopol: selectedNopols.length > 0 ? selectedNopols.join(', ') : null,
        start_date: startDate,
        end_date: endDate,
        bill_number: billNumber || null,
        notes: billNotes || null,
        sj_ids: billingData.rows.map((r: any) => r.sj_id),
      });

      // 2. Generate PDF via Backend ReportLab, fallback to client jsPDF
      try {
        await downloadPDFBlob(
          `/api/v1/hauling/bills/${savedBill.id}/export/pdf`,
          `Rekap_Hauling_${savedBill.bill_number.replace(/\//g, '_')}.pdf`
        );
      } catch (pdfErr) {
        console.warn('Backend PDF generation fallback to client-side:', pdfErr);
        await generateHaulingBillingPDF(vendor, billingData, {
          billNo: savedBill.bill_number,
          selectedNopols,
          notes: billNotes,
        });
      }

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
      // Try backend PDF first
      try {
        const params = new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
          only_unbilled: String(onlyUnbilled),
        });
        if (selectedProjectId) params.append('project_id', String(selectedProjectId));
        if (selectedNopols.length > 0) params.append('nopol', selectedNopols.join(','));
        if (billNumber) params.append('bill_number', billNumber);
        if (billNotes) params.append('notes', billNotes);

        await downloadPDFBlob(
          `/api/v1/hauling/vendors/${vendor.id}/billing/export/pdf?${params.toString()}`,
          `Draft_Rekap_Hauling_${vendor.name.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`
        );
      } catch (pdfErr) {
        console.warn('Backend draft PDF generation fallback to client-side:', pdfErr);
        await generateHaulingBillingPDF(vendor, billingData, {
          billNo: billNumber || 'DRAFT-PREVIEW',
          selectedNopols,
          notes: billNotes,
        });
      }
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
      try {
        await downloadPDFBlob(
          `/api/v1/hauling/bills/${bill.id}/export/pdf`,
          `Rekap_Hauling_${bill.bill_number.replace(/\//g, '_')}.pdf`
        );
      } catch (pdfErr) {
        console.warn('Backend PDF fallback to client-side:', pdfErr);
        const response = await fetch(`/api/v1/hauling/bills/${bill.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Gagal mengambil data laporan tersimpan');
        const billDetail = await response.json();

        await generateHaulingBillingPDF(vendor, billDetail, {
          billNo: billDetail.bill_number,
          selectedNopols,
          notes: billDetail.notes,
        });
      }
      toast.success(`Laporan ${bill.bill_number} berhasil didownload!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mendownload laporan tersimpan');
    } finally {
      setIsGeneratingPDF(false);
    }
  };


  const handleDeleteSavedBill = async (billId: number, billNumberStr: string) => {
    if (
      !confirm(
        `Batalkan / Hapus laporan ${billNumberStr}? Semua surat jalan di dalamnya akan dapat ditagihkan kembali.`
      )
    ) {
      return;
    }
    try {
      await deleteBillMutation.mutateAsync(billId);
      toast.success(`Laporan ${billNumberStr} berhasil dihapus.`);
    } catch (err) {
      toast.error('Gagal menghapus laporan');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-white sm:rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <ReceiptText size={20} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                Rekapitulasi Pembayaran Hauling
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Vendor: <span className="text-blue-400 font-semibold">{vendor.name}</span>
                {vendor.contact_person && ` • CP: ${vendor.contact_person}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors shrink-0 ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-slate-100 px-4 sm:px-6 pt-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              activeTab === 'create'
                ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Filter size={14} /> Buat Rekap Baru
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <History size={14} /> Riwayat Laporan Tersimpan ({savedBills.length})
          </button>
        </div>

        {activeTab === 'create' ? (
          <CreateHaulingBillTab
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            selectedNopols={selectedNopols}
            setSelectedNopols={setSelectedNopols}
            onlyUnbilled={onlyUnbilled}
            setOnlyUnbilled={setOnlyUnbilled}
            billNumber={billNumber}
            setBillNumber={setBillNumber}
            billNotes={billNotes}
            setBillNotes={setBillNotes}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            uniqueProjects={uniqueProjects}
            truckOptions={truckOptions}
            billingData={billingData}
            loadingBilling={loadingBilling}
            expandedDates={expandedDates}
            toggleDateExpand={toggleDateExpand}
            setExpandedDates={setExpandedDates}
            isGeneratingPDF={isGeneratingPDF}
            isSaving={createBillMutation.isPending}
            onDraftPDF={handleDraftPDF}
            onSaveAndExport={handleSaveAndExport}
            onClose={onClose}
          />
        ) : (
          <HaulingBillHistoryTab
            savedBills={savedBills}
            loadingSavedBills={loadingSavedBills}
            isGeneratingPDF={isGeneratingPDF}
            onDownloadBill={handleDownloadSavedBill}
            onDeleteBill={handleDeleteSavedBill}
            deletePending={deleteBillMutation.isPending}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
