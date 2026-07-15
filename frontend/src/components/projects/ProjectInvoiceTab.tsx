import React, { useState } from "react";
import { toast } from "sonner";
import { FileText, Download, Loader2, RefreshCw, Plus, Pencil, Trash2, X } from "lucide-react";
import { useProjectsList } from "../../hooks/useProjects";
import { useInvoices, useUpdateInvoiceStatus, useDeleteInvoice, useUpdateInvoice, Invoice } from "../../hooks/useInvoices";
import CustomSelect from "../CustomSelect";
import apiClient, { API_URL } from "../../api/apiClient";
import { toLocalDateInput } from "../../utils/formatters";

const formatIDR = (v: any) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d: any) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

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

export default function ProjectInvoiceTab() {
  const { data: projects = [], isLoading: loadingProjects } = useProjectsList();
  const { data: allInvoices = [], isLoading: loadingInvoices } = useInvoices();
  const updateInvoiceStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const updateInvoice = useUpdateInvoice();
  
  const projectInvoices = allInvoices.filter((i) => i.invoice_type === "project");
  
  const [view, setView] = useState<"list" | "form">("list");
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toLocalDateInput(new Date()));
  const [startDate, setStartDate] = useState(toLocalDateInput(new Date()));
  const [endDate, setEndDate] = useState(toLocalDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("");

  const [previewData, setPreviewData] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  const resetForm = () => {
    setEditId(null);
    setStep(1);
    setPreviewData(null);
    setProjectId("");
    setStartDate(toLocalDateInput(new Date()));
    setEndDate(toLocalDateInput(new Date()));
    setInvoiceDate(toLocalDateInput(new Date()));
    setNotes("");
    setDiscountType("");
    setDiscountValue("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setView("form");
  };

  const handleOpenEdit = (inv: Invoice) => {
    resetForm();
    setEditId(inv.id);
    setProjectId(String(inv.project_id || ""));
    setInvoiceDate(inv.invoice_date ? toLocalDateInput(inv.invoice_date) : toLocalDateInput(new Date()));
    setStartDate(inv.start_date ? toLocalDateInput(inv.start_date) : toLocalDateInput(new Date()));
    setEndDate(inv.end_date ? toLocalDateInput(inv.end_date) : toLocalDateInput(new Date()));
    setNotes(inv.notes || "");
    setDiscountType(inv.discount_type || "");
    setDiscountValue(inv.discount_value ? String(inv.discount_value) : "");
    setView("form");
    
    // Auto preview logic for editing could be triggered here or manually by user
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    try {
      await deleteInvoice.mutateAsync(deleteModal.id);
      toast.success("Invoice berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus invoice");
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateInvoiceStatus.mutateAsync({ id, status });
      toast.success("Status berhasil diupdate");
    } catch (err: any) {
      toast.error("Gagal update status: " + (err.response?.data?.detail || err.message));
    }
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !startDate || !endDate) {
      toast.error("Harap lengkapi form");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Tanggal awal tidak boleh melebihi tanggal akhir");
      return;
    }

    setLoading(true);
    try {
      let url = `/invoices/preview?invoice_type=project&project_id=${projectId}&start_date=${startDate}&end_date=${endDate}`;
      if (editId) {
        url += `&invoice_id=${editId}`;
      }
      const res = await apiClient.get(url);
      const data = res.data;
      
      if (data.items.length === 0) {
        toast.error("Tidak ada data surat jalan proyek untuk kriteria tersebut.");
      } else {
        setPreviewData(data);
        setStep(2);
      }
    } catch (err: any) {
      toast.error("Gagal membuat preview: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOnly = async () => {
    setLoading(true);
    try {
      const project = projects.find((p: any) => String(p.id) === projectId);
      const payload = {
        invoice_type: "project",
        project_id: parseInt(projectId),
        customer_name: project?.client_name || project?.name || "Unknown",
        invoice_date: invoiceDate,
        start_date: previewData.start_date,
        end_date: previewData.end_date,
        total_amount: previewData.total_amount,
        notes: notes || undefined,
        discount_type: discountType || null,
        discount_value: discountValue ? parseFloat(discountValue) : null,
      };

      if (editId) {
        await updateInvoice.mutateAsync({ id: editId, data: payload });
        toast.success("Invoice proyek berhasil diperbarui");
      } else {
        await apiClient.post("/invoices", payload);
        toast.success("Invoice proyek berhasil disimpan");
      }
      
      setView("list");
      resetForm();
    } catch (err: any) {
      toast.error("Gagal menyimpan invoice: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndDownload = async () => {
    setLoading(true);
    try {
      const project = projects.find((p: any) => String(p.id) === projectId);
      const payload = {
        invoice_type: "project",
        project_id: parseInt(projectId),
        customer_name: project?.client_name || project?.name || "Unknown",
        invoice_date: invoiceDate,
        start_date: previewData.start_date,
        end_date: previewData.end_date,
        total_amount: previewData.total_amount,
        notes: notes || undefined,
        discount_type: discountType || null,
        discount_value: discountValue ? parseFloat(discountValue) : null,
      };

      let invoiceId = editId;
      let invoiceNumber = "";

      if (editId) {
        const res = await updateInvoice.mutateAsync({ id: editId, data: payload });
        invoiceNumber = res.invoice_number;
        toast.success("Invoice proyek berhasil diperbarui");
      } else {
        const res = await apiClient.post("/invoices", payload);
        invoiceId = res.data.id;
        invoiceNumber = res.data.invoice_number;
        toast.success("Invoice proyek berhasil disimpan");
      }
      
      if (!invoiceId) throw new Error("Invoice ID tidak ditemukan");

      // Download PDF
      const token = localStorage.getItem("token");
      const pdfRes = await fetch(`${API_URL}/invoices/${invoiceId}/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!pdfRes.ok) {
        throw new Error(await pdfRes.text());
      }
      
      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_Project_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setView("list");
      resetForm();
    } catch (err: any) {
      toast.error("Gagal mendownload invoice: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const loadingToast = toast.loading("Membuat PDF...");
    try {
      const token = localStorage.getItem("token");
      const pdfRes = await fetch(`${API_URL}/invoices/${inv.id}/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!pdfRes.ok) throw new Error("Gagal export");
      
      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_Project_${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF berhasil didownload", { id: loadingToast });
    } catch (err) {
      toast.error("Gagal mendownload PDF", { id: loadingToast });
    }
  };

  const handleDownloadLoadingPDF = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const loadingToast = toast.loading("Membuat PDF Jasa Loading...");
    try {
      const token = localStorage.getItem("token");
      const pdfRes = await fetch(`${API_URL}/invoices/${inv.id}/export-loading/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!pdfRes.ok) {
        let msg = "Gagal export";
        try { const errData = await pdfRes.json(); msg = errData.detail || msg; } catch {}
        throw new Error(msg);
      }
      
      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Jasa_Loading_${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF Jasa Loading berhasil didownload", { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || "Gagal mendownload PDF Jasa Loading", { id: loadingToast });
    }
  };

  if (loadingProjects || loadingInvoices) {
    return <div className="p-10 flex justify-center text-gray-400"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          {view === "list" ? "History Invoice Proyek" : editId ? "Edit Invoice Proyek" : "Buat Invoice Baru"}
        </h2>
        {view === "list" ? (
          <button onClick={handleOpenCreate} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Invoice Baru
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Kriteria Ulang
              </button>
            )}
            <button onClick={() => setView("list")} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-6 flex-1">
        {view === "list" && (
          <div className="overflow-x-auto w-full">
            {projectInvoices.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada invoice proyek yang dibuat</p>
              </div>
            ) : (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">No Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proyek/Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projectInvoices.map((inv) => (
                    <tr key={inv.id} onClick={() => setViewInvoice(inv)} className="hover:bg-blue-50/60 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inv.customer_name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 whitespace-nowrap">{formatIDR(inv.final_amount ?? inv.total_amount)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{statusBadge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "form" && step === 1 && (
          <form id="project-invoice-form" onSubmit={handlePreview} className="space-y-4 max-w-xl mx-auto py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pilih Proyek <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                required
                value={projectId}
                onChange={(val) => setProjectId(val as string)}
                options={[
                  { value: "", label: "-- Pilih Proyek --" },
                  ...projects
                    .filter((p: any) => p.uninvoiced_count > 0 || (editId && String(p.id) === projectId))
                    .map((p: any) => ({
                      value: String(p.id),
                      label: `${p.name} ${p.client_name ? `(${p.client_name})` : ''} ${p.uninvoiced_count > 0 ? `(${p.uninvoiced_count} belum tagih)` : ''}`,
                    })),
                ]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Invoice Diterbitkan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Periode Awal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Periode Akhir <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan untuk ditampilkan di invoice..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Preview Invoice
              </button>
            </div>
          </form>
        )}

        {view === "form" && step === 2 && previewData && (
          <div className="space-y-6 max-w-4xl mx-auto overflow-x-hidden">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-blue-800 text-lg">{previewData.customer_name}</h3>
                <p className="text-blue-600 text-sm">
                  Periode: {formatDate(previewData.start_date)} - {formatDate(previewData.end_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600 font-medium">Total Tagihan</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatIDR(previewData.total_amount - (
                    discountType === 'percentage' && discountValue 
                      ? previewData.total_amount * (parseFloat(discountValue) / 100) 
                      : discountType === 'nominal' && discountValue 
                        ? parseFloat(discountValue) 
                        : 0
                  ))}
                </p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-x-auto w-full">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nopol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supir</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Keterangan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Harga</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {previewData.items.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(item.income_date)}</td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.material_type}</td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.license_plate || '-'}</td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{item.driver_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{formatIDR(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{formatIDR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-medium">
                    <td colSpan={7} className="px-4 py-3 text-right text-gray-700">Subtotal</td>
                    <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap">{formatIDR(previewData.total_amount)}</td>
                  </tr>
                  {discountType && discountValue && (
                    <tr className="bg-red-50 font-medium text-red-600">
                      <td colSpan={7} className="px-4 py-3 text-right">
                        Diskon {discountType === 'percentage' ? `(${discountValue}%)` : '(Nominal)'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        - {formatIDR(
                          discountType === 'percentage' 
                            ? previewData.total_amount * (parseFloat(discountValue) / 100)
                            : parseFloat(discountValue)
                        )}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-blue-50 font-bold text-blue-700">
                    <td colSpan={7} className="px-4 py-3 text-right">Total Akhir</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatIDR(previewData.total_amount - (
                        discountType === 'percentage' && discountValue 
                          ? previewData.total_amount * (parseFloat(discountValue) / 100) 
                          : discountType === 'nominal' && discountValue 
                            ? parseFloat(discountValue) 
                            : 0
                      ))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jenis Diskon
                </label>
                <CustomSelect
                  value={discountType}
                  onChange={(val) => {
                    const strVal = val as string;
                    setDiscountType(strVal);
                    if (!strVal) setDiscountValue("");
                  }}
                  options={[
                    { value: "", label: "Tidak Ada" },
                    { value: "percentage", label: "Persentase (%)" },
                    { value: "nominal", label: "Nominal (Rp)" }
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nilai Diskon {discountType === "percentage" ? "(%)" : discountType === "nominal" ? "(Rp)" : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!discountType}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Contoh: 10 atau 50000"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan Invoice (Dapat diedit di sini)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tambahkan catatan untuk ditampilkan di invoice..."
                className={`${inputCls} resize-none`}
              />
            </div>
            
            <div className="flex flex-wrap justify-end gap-3 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={loading || !previewData}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "Simpan Perubahan Saja" : "Simpan Data Saja"}
              </button>
              <button
                onClick={handleSaveAndDownload}
                disabled={loading || !previewData}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Simpan & Download PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Hapus Invoice?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Apakah Anda yakin ingin menghapus invoice ini? Data surat jalan akan kembali berstatus belum ditagihkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, id: null })}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {viewInvoice && view === "list" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-gray-800">Detail Invoice Proyek</h2>
              </div>
              <button onClick={() => setViewInvoice(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{viewInvoice.invoice_number}</h3>
                  <p className="text-gray-500 text-sm">Proyek/Klien: {viewInvoice.customer_name}</p>
                </div>
                {statusBadge(viewInvoice.status)}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <span className="text-gray-400 block text-xs">Tanggal Diterbitkan</span>
                  <span className="font-medium text-gray-800">{formatDate(viewInvoice.invoice_date)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Periode Tagihan</span>
                  <span className="font-medium text-gray-800">{formatDate(viewInvoice.start_date)} - {formatDate(viewInvoice.end_date)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Subtotal</span>
                  <span className="font-medium text-gray-800">{formatIDR(viewInvoice.total_amount)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Diskon</span>
                  <span className="font-medium text-red-600">
                    {viewInvoice.discount_type 
                      ? `${viewInvoice.discount_type === 'percentage' ? `${viewInvoice.discount_value}%` : ''} (-${formatIDR(viewInvoice.discount_amount)})`
                      : "-"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block text-xs">Total Akhir</span>
                  <span className="font-medium text-2xl text-blue-700">{formatIDR(viewInvoice.final_amount ?? viewInvoice.total_amount)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 block text-xs">Catatan</span>
                  <span className="font-medium text-gray-800 whitespace-pre-wrap">{viewInvoice.notes || "-"}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">Ubah Status</label>
                <div className="w-1/2">
                  <CustomSelect
                    value={viewInvoice.status}
                    onChange={(val) => {
                      handleStatusChange(viewInvoice.id, val as string);
                      setViewInvoice(prev => prev ? {...prev, status: val as string} : prev);
                    }}
                    options={[
                      { value: "unpaid", label: "Unpaid" },
                      { value: "paid", label: "Paid" },
                      { value: "cancelled", label: "Cancelled" }
                    ]}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={(e) => handleDownloadPDF(viewInvoice, e)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-medium transition-colors border border-blue-200"
                >
                  <Download size={16} /> Download Invoice Material
                </button>
                
                <button
                  onClick={(e) => handleDownloadLoadingPDF(viewInvoice, e)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-medium transition-colors border border-emerald-200"
                >
                  <Download size={16} /> Download Rekap Tagihan Loading
                </button>
              </div>
            </div>

            <div className="p-4 sm:px-6 sm:py-4 border-t border-gray-100 flex items-center justify-between gap-3 rounded-b-2xl bg-gray-50 mt-auto">
              <button
                onClick={() => {
                  setDeleteModal({ isOpen: true, id: viewInvoice.id });
                  setViewInvoice(null);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-semibold transition-colors"
                title="Hapus Invoice"
              >
                <Trash2 size={16} /> Hapus
              </button>
              <button
                onClick={() => {
                  handleOpenEdit(viewInvoice);
                  setViewInvoice(null);
                }}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Pencil size={15} /> Kriteria Ulang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
