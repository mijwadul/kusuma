import React, { useState } from "react";
import { toast } from "sonner";
import { FileText, Download, Loader2, RefreshCw } from "lucide-react";
import { useProjectsList } from "../../hooks/useProjects";
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

export default function ProjectInvoiceTab() {
  const { data: projects = [], isLoading: loadingProjects } = useProjectsList();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toLocalDateInput(new Date()));
  const [startDate, setStartDate] = useState(toLocalDateInput(new Date()));
  const [endDate, setEndDate] = useState(toLocalDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("");

  const [previewData, setPreviewData] = useState<any>(null);

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
      const url = `/invoices/preview?invoice_type=project&project_id=${projectId}&start_date=${startDate}&end_date=${endDate}`;
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

      await apiClient.post("/invoices", payload);
      toast.success("Invoice proyek berhasil disimpan");
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

      const res = await apiClient.post("/invoices", payload);
      toast.success("Invoice proyek berhasil disimpan");
      
      const invoiceId = res.data.id;
      const invoiceNumber = res.data.invoice_number;
      
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
      
      resetForm();
    } catch (err: any) {
      toast.error("Gagal mendownload invoice: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setPreviewData(null);
    setProjectId("");
    setStartDate(toLocalDateInput(new Date()));
    setEndDate(toLocalDateInput(new Date()));
    setNotes("");
    setDiscountType("");
    setDiscountValue("");
  };

  if (loadingProjects) {
    return <div className="p-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Buat Invoice Proyek
        </h2>
        {step === 2 && (
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Kriteria Ulang
          </button>
        )}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {step === 1 ? (
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
                  ...projects.map((p: any) => ({
                    value: String(p.id),
                    label: `${p.name} ${p.client_name ? `(${p.client_name})` : ''}`,
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
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {!previewData ? (
              <div className="py-12 flex justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <>
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

                <div className="border border-gray-200 rounded-xl overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-50">
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
                          <td className="px-4 py-3 text-gray-800">{item.material_type}</td>
                          <td className="px-4 py-3 text-gray-800">{item.license_plate || '-'}</td>
                          <td className="px-4 py-3 text-gray-800">{item.driver_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{item.description}</td>
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
                
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleSaveOnly}
                    disabled={loading || !previewData}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Data Saja
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
