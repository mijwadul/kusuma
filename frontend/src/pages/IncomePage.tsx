import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  Plus,
  Download,
  FileText,
  Pencil,
  X,
  DollarSign,
  FolderOpen,
  ShoppingCart,
  Calendar,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toLocalDateInput } from "../utils/formatters";

import AlertModal from "../components/AlertModal";
import InvoiceGenerator from "../components/InvoiceGenerator";
import CustomSelect from "../components/CustomSelect";
import CustomCombobox from "../components/CustomCombobox";
import {
  useIncomeRecords,
  useCreateIncomeRecord,
  useUpdateIncomeRecord,
  useDeleteIncomeRecord,
  IncomeRecord
} from "../hooks/useMaterialSales";
import {
  useInvoices,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  Invoice
} from "../hooks/useInvoices";
import { useProjectsList, useCustomersList } from "../hooks/useProjects";
import apiClient, { API_URL } from "../api/apiClient";

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

const PAYMENT_TERMS = ["dp", "termin_1", "termin_2", "pelunasan", "lain-lain"];
const MATERIAL_TYPES = [
  "Limestone (urugan)",
  "Dolomite",
  "Boulder",
  "Clay",
];

const TABS = [
  { key: "all", label: "📂 Semua" },
  { key: "project_payment", label: "📁 Pembayaran Proyek" },
  { key: "material_sale", label: "🪨 Penjualan Material" },
  { key: "invoices", label: "📄 Daftar Invoice" },
];

// ── Sub-components ───────────────────────────────────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
      <p className="text-base sm:text-lg md:text-xl font-bold text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

// ── Detail Modal ─────────────────────────────────────────────────────────────
const DetailModal = ({ record, onClose, onEdit, onDelete }: any) => {
  if (!record) return null;
  const isProj = record.income_type === "project_payment";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {isProj ? <FolderOpen className="w-5 h-5 text-blue-500" /> : <ShoppingCart className="w-5 h-5 text-emerald-500" />}
            Detail Pemasukan
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Tanggal</p>
              <p className="font-semibold text-gray-800">{formatDate(record.income_date)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Tipe</p>
              <div className="mt-0.5"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isProj ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{isProj ? "Proyek" : "Material"}</span></div>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-xs text-emerald-600 font-medium mb-1">Jumlah Pemasukan</p>
            <p className="text-2xl font-bold text-emerald-700">{formatIDR(record.amount)}</p>
          </div>

          {isProj ? (
            <>
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Proyek / Deskripsi</p>
                <p className="text-gray-800 text-sm font-medium">{record.description || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Termin</p>
                  <p className="text-gray-800 text-sm capitalize">{record.payment_term?.replace(/_/g, " ") || "-"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Metode</p>
                  <p className="text-gray-800 text-sm capitalize">{record.payment_method || "-"}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Pelanggan</p>
                <p className="text-gray-800 text-sm font-medium">{record.customer_name || "-"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Material</p>
                  <p className="text-gray-800 text-sm">{record.material_type || "-"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Volume</p>
                  <p className="text-gray-800 text-sm">{record.quantity} {record.unit}</p>
                </div>
              </div>
            </>
          )}

          {record.notes && (
            <div className="bg-gray-50 p-3 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Catatan</p>
              <p className="text-gray-800 text-sm">{record.notes}</p>
            </div>
          )}
        </div>
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-gray-100 flex-wrap">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl text-gray-700 hover:bg-white transition-colors mr-auto">Tutup</button>
          
          <button onClick={() => { onClose(); onEdit(record); }} className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors font-medium flex items-center text-sm">
            <Pencil size={16} className="mr-1" /> Edit
          </button>
          
          <button onClick={() => { onClose(); onDelete(record); }} className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-medium flex items-center text-sm">
            <Trash2 size={16} className="mr-1" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
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

  const { data: invoicesData = [], isLoading: loadingInvoices } = useInvoices({ enabled: activeTab === "invoices" });

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
  const [modalTab, setModalTab] = useState<"project_payment" | "material_sale">("project_payment");
  const [editId, setEditId] = useState<number | null>(null);
  const [detailTarget, setDetailTarget] = useState<IncomeRecord | null>(null);
  
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  // Forms
  const [projectForm, setProjectForm] = useState({
    income_date: todayStr(),
    project_id: "",
    payment_term: "dp",
    amount: "",
    payment_method: "transfer",
    description: "",
    notes: "",
  });

  const [materialForm, setMaterialForm] = useState({
    income_date: todayStr(),
    customer_name: "",
    material_type: MATERIAL_TYPES[0],
    quantity: "1",
    unit: "ritase",
    unit_price: "",
    amount: "",
    payment_method: "transfer",
    description: "",
    notes: "",
    project_id: "",
    sj_length: "",
    sj_width: "",
    sj_height: "",
    sj_volume_minus: "",
    sj_gross_weight: "",
    sj_tare_weight: "",
    sj_weight_minus: "",
  });

  // Auto-fill description when project + termin berubah
  useEffect(() => {
    if (!projectForm.project_id || !projectForm.payment_term) return;
    const proj = projects.find((p: any) => String(p.id) === String(projectForm.project_id));
    if (!proj) return;
    const termMap: Record<string, string> = {
      dp: "DP", termin_1: "Termin 1", termin_2: "Termin 2", pelunasan: "Pelunasan", "lain-lain": "Lain-lain",
    };
    const termLabel = termMap[projectForm.payment_term] ?? projectForm.payment_term;
    setProjectForm((prev) => ({
      ...prev,
      description: `${termLabel} - ${proj.name ?? ""}`,
    }));
  }, [projectForm.project_id, projectForm.payment_term, projects]);

  // Auto calculate quantity
  useEffect(() => {
    if (materialForm.unit === "m3") {
      const p = parseFloat(materialForm.sj_length) || 0;
      const l = parseFloat(materialForm.sj_width) || 0;
      const t = parseFloat(materialForm.sj_height) || 0;
      const m = parseFloat(materialForm.sj_volume_minus) || 0;
      if (p > 0 && l > 0 && t > 0) {
        setMaterialForm(prev => ({ ...prev, quantity: (p * l * (t - m)).toString() }));
      }
    } else if (materialForm.unit === "ton") {
      const gross = parseFloat(materialForm.sj_gross_weight) || 0;
      const tare = parseFloat(materialForm.sj_tare_weight) || 0;
      const m = parseFloat(materialForm.sj_weight_minus) || 0;
      if (gross > 0) {
        setMaterialForm(prev => ({ ...prev, quantity: (gross - tare - m).toString() }));
      }
    } else {
      setMaterialForm(prev => ({ ...prev, quantity: "1" }));
    }
  }, [materialForm.unit, materialForm.sj_length, materialForm.sj_width, materialForm.sj_height, materialForm.sj_volume_minus, materialForm.sj_gross_weight, materialForm.sj_tare_weight, materialForm.sj_weight_minus]);

  // Auto-calculate amount = qty × unit_price
  useEffect(() => {
    const qty = parseFloat(materialForm.quantity);
    const price = parseFloat(materialForm.unit_price);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      setMaterialForm((prev) => ({ ...prev, amount: String(qty * price) }));
    }
  }, [materialForm.quantity, materialForm.unit_price]);

  // Auto-fill unit_price from lookup
  useEffect(() => {
    const { material_type, unit, customer_name } = materialForm;
    if (!material_type || !unit) return;
    let cancelled = false;
    const lookup = async () => {
      try {
        const params = new URLSearchParams({ material_type, unit });
        if (customer_name.trim()) params.set("customer_name", customer_name.trim());
        const res = await apiClient.get(`/material-prices/lookup?${params}`);
        if (cancelled) return;
        if (res.data?.found) {
          setMaterialForm((prev) => ({ ...prev, unit_price: String(res.data.price_per_unit) }));
        }
      } catch {
        // silently ignore
      }
    };
    const timer = setTimeout(lookup, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [materialForm.material_type, materialForm.unit, materialForm.customer_name]);

  // ── Summary ──
  const summary = useMemo(() => {
    if (activeTab === "invoices") return { total: 0, project: 0, material: 0, count: 0 };
    const inc = records as IncomeRecord[];
    return {
      total: inc.reduce((s, r) => s + (r.amount || 0), 0),
      project: inc.filter((r) => r.income_type === "project_payment").reduce((s, r) => s + (r.amount || 0), 0),
      material: inc.filter((r) => r.income_type === "material_sale").reduce((s, r) => s + (r.amount || 0), 0),
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
          Authorization: `Bearer ${token}`
        }
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
    setProjectForm({
      income_date: todayStr(), project_id: "", payment_term: "dp",
      amount: "", payment_method: "transfer", description: "", notes: "",
    });
    setMaterialForm({
      income_date: todayStr(), customer_name: "", material_type: MATERIAL_TYPES[0],
      quantity: "1", unit: "ritase", unit_price: "", amount: "", payment_method: "transfer",
      description: "", notes: "", project_id: "", sj_length: "", sj_width: "", sj_height: "",
      sj_volume_minus: "", sj_gross_weight: "", sj_tare_weight: "", sj_weight_minus: "",
    });
    setModalTab(activeTab === "material_sale" ? "material_sale" : "project_payment");
    setShowModal(true);
  };

  const openEditModal = (r: IncomeRecord) => {
    setEditId(r.id);
    if (r.income_type === "project_payment") {
      setModalTab("project_payment");
      setProjectForm({
        income_date: r.income_date ? toLocalDateInput(r.income_date) : todayStr(),
        project_id: String(r.project_id ?? ""),
        payment_term: r.payment_term ?? "dp",
        amount: String(r.amount ?? ""),
        payment_method: r.payment_method ?? "transfer",
        description: r.description ?? "",
        notes: r.notes ?? "",
      });
    } else {
      setModalTab("material_sale");
      setMaterialForm({
        income_date: r.income_date ? toLocalDateInput(r.income_date) : todayStr(),
        customer_name: r.customer_name ?? "",
        material_type: r.material_type ?? "",
        quantity: String(r.quantity ?? "1"),
        unit: r.unit ?? "ritase",
        unit_price: String(r.unit_price ?? ""),
        amount: String(r.amount ?? ""),
        payment_method: r.payment_method ?? "transfer",
        description: r.description ?? "",
        notes: r.notes ?? "",
        project_id: r.project_id ? String(r.project_id) : "",
        sj_length: String(r.sj_length ?? ""),
        sj_width: String(r.sj_width ?? ""),
        sj_height: String(r.sj_height ?? ""),
        sj_volume_minus: String(r.sj_volume_minus ?? ""),
        sj_gross_weight: String(r.sj_gross_weight ?? ""),
        sj_tare_weight: String(r.sj_tare_weight ?? ""),
        sj_weight_minus: String(r.sj_weight_minus ?? ""),
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let payload: Partial<IncomeRecord>;
      if (modalTab === "project_payment") {
        payload = {
          income_type: "project_payment",
          income_date: projectForm.income_date,
          project_id: parseInt(projectForm.project_id),
          payment_term: projectForm.payment_term as any,
          amount: parseFloat(projectForm.amount),
          payment_method: projectForm.payment_method,
          description: projectForm.description,
          notes: projectForm.notes || undefined,
        };
      } else {
        let finalCustomerName = materialForm.customer_name;
        if (!isNewCustomer) {
          const exactCust = customers.find(c => c.name.toLowerCase() === materialForm.customer_name.toLowerCase().trim());
          if (!exactCust) {
            toast.error("Nama pelanggan tidak cocok. Pastikan tidak salah ketik, atau pilih 'Pelanggan Baru'.");
            return;
          }
          finalCustomerName = exactCust.name;
        }

        payload = {
          income_type: "material_sale",
          income_date: materialForm.income_date,
          customer_name: finalCustomerName,
          material_type: materialForm.material_type || undefined,
          quantity: parseFloat(materialForm.quantity) || undefined,
          unit: materialForm.unit || undefined,
          unit_price: parseFloat(materialForm.unit_price) || undefined,
          amount: parseFloat(materialForm.amount),
          payment_method: materialForm.payment_method,
          description: materialForm.description,
          project_id: materialForm.project_id ? parseInt(materialForm.project_id) : undefined,
          notes: materialForm.notes || undefined,
          sj_length: materialForm.sj_length ? parseFloat(materialForm.sj_length) : undefined,
          sj_width: materialForm.sj_width ? parseFloat(materialForm.sj_width) : undefined,
          sj_height: materialForm.sj_height ? parseFloat(materialForm.sj_height) : undefined,
          sj_volume_minus: materialForm.sj_volume_minus ? parseFloat(materialForm.sj_volume_minus) : undefined,
          sj_gross_weight: materialForm.sj_gross_weight ? parseFloat(materialForm.sj_gross_weight) : undefined,
          sj_tare_weight: materialForm.sj_tare_weight ? parseFloat(materialForm.sj_tare_weight) : undefined,
          sj_weight_minus: materialForm.sj_weight_minus ? parseFloat(materialForm.sj_weight_minus) : undefined,
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

  const paymentBadge = (method?: string) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${method === "transfer" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
      {method === "transfer" ? "Transfer" : "Cash"}
    </span>
  );

  const typeBadge = (type?: string) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${type === "project_payment" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
      {type === "project_payment" ? "Proyek" : "Material"}
    </span>
  );

  const termBadge = (term?: string) => (
    <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium capitalize">
      {term?.replace(/_/g, " ") ?? "-"}
    </span>
  );

  const statusBadge = (status?: string) => {
    const map: any = {
      unpaid: { bg: "bg-red-100", text: "text-red-700", label: "Unpaid" },
      paid: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Paid" },
      cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled" },
    };
    const s = map[status || "unpaid"] || map.unpaid;
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const inputCls = (ring = "blue") => `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-${ring}-300`;
  const isSaving = createIncome.isPending || updateIncome.isPending;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pemasukan &amp; Pendapatan</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola pemasukan dari proyek dan penjualan material</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          <button onClick={handleExportPDF} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={() => setShowInvoiceModal(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> Buat Invoice
          </button>
          <button onClick={openAddModal} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Tambah Pemasukan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Total Periode Ini" value={formatIDR(summary.total)} color="bg-emerald-500" />
        <SummaryCard icon={FolderOpen} label="Dari Proyek" value={formatIDR(summary.project)} color="bg-blue-500" />
        <SummaryCard icon={ShoppingCart} label="Penjualan Material" value={formatIDR(summary.material)} color="bg-amber-500" />
        <SummaryCard icon={TrendingUp} label="Jumlah Transaksi" value={summary.count} color="bg-purple-500" />
      </div>

      <div className="tabs-scrollable bg-gray-100 p-1 rounded-xl flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== "invoices" && (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Dari:</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sampai:</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
          <button
            onClick={() => { setStartDate(daysAgo(30)); setEndDate(todayStr()); }}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      )}

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
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "all" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Deskripsi</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(records as IncomeRecord[]).map((r) => (
                    <tr key={r.id} className="hover:bg-emerald-50/60 cursor-pointer transition-colors" onClick={() => setDetailTarget(r)}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.income_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{typeBadge(r.income_type)}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate whitespace-nowrap">{r.description || "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{formatIDR(r.amount)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{paymentBadge(r.payment_method)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "project_payment" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyek</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Termin</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(records as IncomeRecord[]).map((r) => (
                    <tr key={r.id} className="hover:bg-emerald-50/60 cursor-pointer transition-colors" onClick={() => setDetailTarget(r)}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.income_date)}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{r.description ?? "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{termBadge((r as any).payment_term)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{formatIDR(r.amount)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{paymentBadge(r.payment_method)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "material_sale" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Material</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(records as IncomeRecord[]).map((r) => (
                    <tr key={r.id} className="hover:bg-emerald-50/60 cursor-pointer transition-colors" onClick={() => setDetailTarget(r)}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.income_date)}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{r.customer_name ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.material_type ?? "-"}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums whitespace-nowrap">{r.quantity} {r.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{formatIDR(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "invoices" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Opsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(records as Invoice[]).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={(e) => {
                      if ((e.target as any).tagName !== "SELECT" && !(e.target as any).closest('button')) {
                        setSelectedInvoice(r);
                        setShowInvoiceModal(true);
                      }
                    }}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.invoice_date ? formatDate(r.invoice_date) : "-"}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{r.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.customer_name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">{formatIDR(r.total_amount)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <CustomSelect
                          value={r.status}
                          onChange={(val) => handleUpdateInvoiceStatus(r.id, val as string)}
                          options={[
                            { value: "unpaid", label: "Unpaid" },
                            { value: "paid", label: "Paid" },
                            { value: "cancelled", label: "Cancelled" }
                          ]}
                        />
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedInvoice(r); setShowInvoiceModal(true); }}
                          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Invoice"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, id: r.id }); }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {detailTarget && (
        <DetailModal 
          record={detailTarget} 
          onClose={() => setDetailTarget(null)} 
          onEdit={(r: any) => { openEditModal(r); }} 
          onDelete={(r: any) => { setDeleteModal({ isOpen: true, id: r.id }); }} 
        />
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-gray-800">{editId ? "Edit Pemasukan" : "Tambah Pemasukan"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {!editId && (
              <div className="flex gap-2 px-6 pt-4">
                <button
                  type="button"
                  onClick={() => setModalTab("project_payment")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    modalTab === "project_payment" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📁 Pembayaran Proyek
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("material_sale")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    modalTab === "material_sale" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🪨 Penjualan Material
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-6 py-4 whitespace-nowrap space-y-4">
              {modalTab === "project_payment" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                    <input type="date" required value={projectForm.income_date} onChange={(e) => setProjectForm(p => ({ ...p, income_date: e.target.value }))} className={inputCls("blue")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proyek <span className="text-red-500">*</span></label>
                    <CustomSelect
                      required
                      value={projectForm.project_id}
                      onChange={(val) => setProjectForm(p => ({ ...p, project_id: val as string }))}
                      options={[
                        { value: "", label: "-- Pilih Proyek --" },
                        ...projects.map((p: any) => ({ value: String(p.id), label: p.name }))
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Termin Pembayaran</label>
                    <CustomSelect
                      value={projectForm.payment_term}
                      onChange={(val) => setProjectForm(p => ({ ...p, payment_term: val as string }))}
                      options={PAYMENT_TERMS.map((t) => ({ value: t, label: t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp) <span className="text-red-500">*</span></label>
                    <input type="number" required min="0" step="1" value={projectForm.amount} onChange={(e) => setProjectForm(p => ({ ...p, amount: e.target.value }))} placeholder="5000000" className={inputCls("blue")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                    <CustomSelect
                      value={projectForm.payment_method}
                      onChange={(val) => setProjectForm(p => ({ ...p, payment_method: val as string }))}
                      options={[
                        { value: "transfer", label: "Transfer" },
                        { value: "cash", label: "Cash" }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi <span className="text-red-500">*</span></label>
                    <input type="text" required value={projectForm.description} onChange={(e) => setProjectForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi pembayaran" className={inputCls("blue")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catatan <span className="text-xs text-gray-400">(opsional)</span></label>
                    <textarea rows={3} value={projectForm.notes} onChange={(e) => setProjectForm(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan tambahan" className={`${inputCls("blue")} resize-none`} />
                  </div>
                </>
              )}

              {modalTab === "material_sale" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                    <input type="date" required value={materialForm.income_date} onChange={(e) => setMaterialForm(p => ({ ...p, income_date: e.target.value }))} className={inputCls("emerald")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Customer <span className="text-red-500">*</span></label>
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" checked={!isNewCustomer} onChange={() => setIsNewCustomer(false)} className="w-4 h-4 text-emerald-600" />
                        Pelanggan Terdaftar
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" checked={isNewCustomer} onChange={() => {
                          setIsNewCustomer(true);
                          setMaterialForm(p => ({...p, customer_name: ""}));
                        }} className="w-4 h-4 text-emerald-600" />
                        Pelanggan Baru
                      </label>
                    </div>
                    {!isNewCustomer ? (
                        <CustomCombobox
                          required
                          value={materialForm.customer_name}
                          onChange={(val) => setMaterialForm(p => ({ ...p, customer_name: val }))}
                          placeholder="Pilih Pelanggan..."
                          options={customers.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((c: any) => ({
                            value: c.name,
                            label: c.name
                          }))}
                        />
                    ) : (
                      <input 
                        type="text" 
                        required 
                        value={materialForm.customer_name} 
                        onChange={(e) => setMaterialForm(p => ({ ...p, customer_name: e.target.value }))} 
                        placeholder="Ketik nama pelanggan baru..." 
                        className={inputCls("emerald")} 
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Material <span className="text-red-500">*</span></label>
                    <CustomSelect
                      required
                      value={materialForm.material_type}
                      onChange={(val) => setMaterialForm(p => ({ ...p, material_type: val as string, unit: p.unit || "ritase", quantity: "1", unit_price: "" }))}
                      options={MATERIAL_TYPES.map((m) => ({ value: m, label: m }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Satuan <span className="text-red-500">*</span></label>
                    <CustomSelect
                      required
                      value={materialForm.unit}
                      onChange={(val) => setMaterialForm(p => ({ ...p, unit: val as string, quantity: val === "ritase" ? "1" : p.quantity, unit_price: "" }))}
                      options={[
                        { value: "ritase", label: "Ritase" },
                        { value: "m3", label: "Kubikasi (m³)" },
                        { value: "ton", label: "Tonase (ton)" }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total (Rp) <span className="text-red-500">*</span></label>
                    <input type="number" required min="0" readOnly value={materialForm.amount} onChange={(e) => setMaterialForm(p => ({ ...p, amount: e.target.value }))} placeholder="5000000" className={inputCls("emerald")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                    <CustomSelect
                      value={materialForm.payment_method}
                      onChange={(val) => setMaterialForm(p => ({ ...p, payment_method: val as string }))}
                      options={[
                        { value: "transfer", label: "Transfer" },
                        { value: "cash", label: "Cash" }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi <span className="text-red-500">*</span></label>
                    <input type="text" required value={materialForm.description} onChange={(e) => setMaterialForm(p => ({ ...p, description: e.target.value }))} placeholder="Penjualan pasir sungai ke CV. ABC" className={inputCls("emerald")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Project <span className="text-xs text-gray-400 font-normal">(opsional)</span></label>
                    <CustomSelect
                      value={materialForm.project_id}
                      onChange={(val) => setMaterialForm(p => ({ ...p, project_id: val as string }))}
                      options={[
                        { value: "", label: "-- Tanpa Project (General) --" },
                        ...projects.map((p: any) => ({ value: String(p.id), label: p.name }))
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catatan <span className="text-xs text-gray-400">(opsional)</span></label>
                    <textarea rows={3} value={materialForm.notes} onChange={(e) => setMaterialForm(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan tambahan" className={`${inputCls("emerald")} resize-none`} />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700 shadow-sm`}>
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editId ? "Simpan Perubahan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}
