import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Download,
  FileText,
  DollarSign,
  FolderOpen,
  ShoppingCart,
  Calendar,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { toLocalDateInput } from "../utils/formatters";
import AlertModal from "../components/AlertModal";
import InvoiceGenerator from "../components/InvoiceGenerator";
import {
  useIncomeRecords,
  useCreateIncomeRecord,
  useUpdateIncomeRecord,
  useDeleteIncomeRecord,
  IncomeRecord,
} from "../hooks/useMaterialSales";
import {
  useInvoices,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  Invoice,
} from "../hooks/useInvoices";
import { useProjectsList, useCustomersList } from "../hooks/useProjects";
import { API_URL } from "../api/apiClient";

// Modular Sub-components
import IncomeSummaryCards from "../components/income/IncomeSummaryCards";
import IncomeDetailModal from "../components/income/IncomeDetailModal";
import IncomeTable from "../components/income/IncomeTable";
import InvoiceTable from "../components/income/InvoiceTable";
import IncomeFormModal from "../components/income/IncomeFormModal";
import KuitansiModal from "../components/KuitansiModal";

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d?: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const todayStr = () => toLocalDateInput(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateInput(d);
};

export default function IncomePage() {
  const [activeTab, setActiveTab] = useState("all");
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(todayStr());

  // Queries
  const { data: projects = [] } = useProjectsList();
  const { data: customers = [] } = useCustomersList();

  const incomeTypeParam = activeTab === "all" || activeTab === "invoices" ? undefined : activeTab;
  const { data: incomeData = [], isLoading: loadingIncome } = useIncomeRecords(
    { start_date: startDate, end_date: endDate, income_type: incomeTypeParam },
    { enabled: activeTab !== "invoices" }
  );

  const { data: invoicesData = [], isLoading: loadingInvoices } = useInvoices({
    enabled: activeTab === "invoices",
  });

  const records = activeTab === "invoices" ? invoicesData : incomeData;
  const loading = activeTab === "invoices" ? loadingInvoices : loadingIncome;

  // Mutations
  const createIncome = useCreateIncomeRecord();
  const updateIncome = useUpdateIncomeRecord();
  const deleteIncome = useDeleteIncomeRecord();

  const updateInvoiceStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editRecord, setEditRecord] = useState<IncomeRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<IncomeRecord | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [kuitansiModalInvoice, setKuitansiModalInvoice] = useState<Invoice | null>(null);

  // ── Summary Metrics ──
  const summary = useMemo(() => {
    if (activeTab === "invoices") return { total: 0, project: 0, material: 0, count: 0 };
    const inc = records as IncomeRecord[];
    return {
      total: inc.reduce((s, r) => s + (r.amount || 0), 0),
      project: inc
        .filter((r) => r.income_type === "project_payment")
        .reduce((s, r) => s + (r.amount || 0), 0),
      material: inc
        .filter((r) => r.income_type === "material_sale")
        .reduce((s, r) => s + (r.amount || 0), 0),
      count: inc.length,
    };
  }, [records, activeTab]);

  // ── Handlers ──
  const handleExportPDF = async () => {
    const loadingToast = toast.loading("Generating PDF...");
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const token = localStorage.getItem("token");
      const url = `${API_URL}/income-records/export/pdf?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Gagal mengunduh PDF");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `laporan_pemasukan_${new Date().getTime()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);

      toast.success("PDF berhasil didownload!", { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan saat mengunduh PDF", { id: loadingToast });
    }
  };

  const openAddModal = () => {
    setEditId(null);
    setEditRecord(null);
    setShowModal(true);
  };

  const openEditModal = (r: IncomeRecord) => {
    setEditId(r.id);
    setEditRecord(r);
    setShowModal(true);
  };

  const handleFormSubmit = async (formData: any, tab: "project_payment" | "material_sale") => {
    try {
      let payload: Partial<IncomeRecord>;
      if (tab === "project_payment") {
        payload = {
          income_type: "project_payment",
          income_date: formData.income_date,
          project_id: parseInt(formData.project_id),
          payment_term: formData.payment_term as any,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          description: formData.description,
          notes: formData.notes || undefined,
        };
      } else {
        payload = {
          income_type: "material_sale",
          income_date: formData.income_date,
          customer_name: formData.customer_name,
          material_type: formData.material_type || undefined,
          quantity: parseFloat(formData.quantity) || undefined,
          unit: formData.unit || undefined,
          unit_price: parseFloat(formData.unit_price) || undefined,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          description: formData.description,
          project_id: formData.project_id ? parseInt(formData.project_id) : undefined,
          notes: formData.notes || undefined,
          sj_length: formData.sj_length ? parseFloat(formData.sj_length) : undefined,
          sj_width: formData.sj_width ? parseFloat(formData.sj_width) : undefined,
          sj_height: formData.sj_height ? parseFloat(formData.sj_height) : undefined,
          sj_volume_minus: formData.sj_volume_minus ? parseFloat(formData.sj_volume_minus) : undefined,
          sj_gross_weight: formData.sj_gross_weight ? parseFloat(formData.sj_gross_weight) : undefined,
          sj_tare_weight: formData.sj_tare_weight ? parseFloat(formData.sj_tare_weight) : undefined,
          sj_weight_minus: formData.sj_weight_minus ? parseFloat(formData.sj_weight_minus) : undefined,
        };
      }

      if (editId) {
        await updateIncome.mutateAsync({ id: editId, data: payload });
        toast.success("Pemasukan berhasil diupdate");
      } else {
        await createIncome.mutateAsync(payload);
        toast.success("Pemasukan berhasil ditambahkan");
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || "Gagal menyimpan");
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: number, newStatus: string) => {
    try {
      await updateInvoiceStatus.mutateAsync({ id: invoiceId, status: newStatus });
      toast.success("Status invoice berhasil diupdate");
    } catch (err: any) {
      toast.error("Gagal update status: " + (err.response?.data?.detail || err.message));
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    try {
      if (activeTab === "invoices") {
        await deleteInvoice.mutateAsync(deleteModal.id);
      } else {
        await deleteIncome.mutateAsync(deleteModal.id);
      }
      toast.success("Data berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus data");
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const isSaving = createIncome.isPending || updateIncome.isPending;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pemasukan &amp; Pendapatan</h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola pemasukan dari proyek, penjualan material, dan faktur tagihan
          </p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Download Laporan PDF
          </button>
          <button
            onClick={() => {
              setSelectedInvoice(null);
              setShowInvoiceModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" /> Buat Invoice
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Pemasukan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <IncomeSummaryCards summary={summary} formatIDR={formatIDR} />

      {/* Tabs Filter */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "all" ? "bg-white shadow text-gray-800" : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <FolderOpen size={16} /> Semua
        </button>
        <button
          onClick={() => setActiveTab("project_payment")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "project_payment" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <DollarSign size={16} /> Pembayaran Proyek
        </button>
        <button
          onClick={() => setActiveTab("material_sale")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "material_sale" ? "bg-white shadow text-emerald-700" : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <ShoppingCart size={16} /> Penjualan Material
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "invoices" ? "bg-white shadow text-indigo-700" : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <FileText size={16} /> Daftar Invoice
        </button>
      </div>

      {/* Date Filter Bar */}
      {activeTab !== "invoices" && (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Dari:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sampai:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <button
            onClick={() => {
              setStartDate(daysAgo(30));
              setEndDate(todayStr());
            }}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset 30 Hari
          </button>
        </div>
      )}

      {/* Data Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Memuat data…
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada data pada periode ini</p>
          </div>
        ) : activeTab === "invoices" ? (
          <InvoiceTable
            invoices={records as Invoice[]}
            onSelectInvoice={(inv) => {
              setSelectedInvoice(inv);
              setShowInvoiceModal(true);
            }}
            onUpdateStatus={handleUpdateInvoiceStatus}
            onDeleteInvoice={(id) => setDeleteModal({ isOpen: true, id })}
            onGenerateKuitansi={(inv) => setKuitansiModalInvoice(inv)}
            formatIDR={formatIDR}
            formatDate={formatDate}
          />
        ) : (
          <IncomeTable
            activeTab={activeTab}
            records={records as IncomeRecord[]}
            onSelectRecord={(r) => setDetailTarget(r)}
            formatIDR={formatIDR}
            formatDate={formatDate}
          />
        )}
      </div>

      {/* Detail Modal */}
      {detailTarget && (
        <IncomeDetailModal
          record={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(r) => openEditModal(r)}
          onDelete={(r) => setDeleteModal({ isOpen: true, id: r.id })}
          formatIDR={formatIDR}
          formatDate={formatDate}
        />
      )}

      {/* Add / Edit Form Modal */}
      <IncomeFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        editId={editId}
        editRecord={editRecord}
        projects={projects}
        customers={customers}
        onSubmit={handleFormSubmit}
        isSaving={isSaving}
      />

      {/* Delete Confirmation Alert Modal */}
      {deleteModal.isOpen && (
        <AlertModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, id: null })}
          onConfirm={confirmDelete}
          title="Hapus Data?"
          message="Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."
          confirmText="Hapus"
          cancelText="Batal"
          confirmColor="bg-red-600 hover:bg-red-700"
        />
      )}

      {/* Invoice Generator Modal */}
      {showInvoiceModal && (
        <InvoiceGenerator
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
          }}
          customers={customers}
          existingInvoice={selectedInvoice}
        />
      )}

      {/* Kuitansi Modal */}
      {kuitansiModalInvoice && (
        <KuitansiModal
          isOpen={!!kuitansiModalInvoice}
          onClose={() => setKuitansiModalInvoice(null)}
          invoice={kuitansiModalInvoice}
        />
      )}
    </div>
  );
}

