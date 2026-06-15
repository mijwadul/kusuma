import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, FileText, Download, Loader2 } from "lucide-react";
import { API_URL } from "../api/apiClient";
import { toLocalDateInput } from "../utils/formatters";

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

interface InvoiceGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  customers?: any[];
  existingInvoice?: any;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ isOpen, onClose, customers = [], existingInvoice = null }) => {
  const [step, setStep] = useState(1); // 1 = Form, 2 = Preview
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toLocalDateInput(new Date()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  
  // Preview State
  const [previewData, setPreviewData] = useState<any>(null);

  const [uninvoicedCustomers, setUninvoicedCustomers] = useState<string[]>([]);

  const fetchUninvoicedCustomers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/invoices/uninvoiced-customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUninvoicedCustomers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUninvoicedCustomers();
      if (existingInvoice) {
        setCustomerName(existingInvoice.customer_name);
        setInvoiceDate(existingInvoice.invoice_date || toLocalDateInput(new Date()));
        setStartDate(existingInvoice.start_date);
        setEndDate(existingInvoice.end_date);
        setNotes(existingInvoice.notes || "");
        setStep(2);
        fetchPreviewForExisting(existingInvoice);
      } else {
        setStep(1);
        setPreviewData(null);
        setCustomerName("");
        setInvoiceDate(toLocalDateInput(new Date()));
        setStartDate("");
        setEndDate("");
        setNotes("");
        setDiscountType("");
        setDiscountValue("");
      }
    }
  }, [isOpen, existingInvoice]);

  const fetchPreviewForExisting = async (invoice: any) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/invoices/preview?customer_name=${encodeURIComponent(invoice.customer_name)}&start_date=${invoice.start_date}&end_date=${invoice.end_date}&invoice_id=${invoice.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPreviewData(data);
      if (invoice.discount_type) {
        setDiscountType(invoice.discount_type);
        setDiscountValue(invoice.discount_value);
      }
    } catch (err: any) {
      toast.error("Gagal memuat detail invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const authFetch = async (url: string, options: any = {}) => {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let errText = await res.text();
      try {
        const errJson = JSON.parse(errText);
        if (errJson.detail) errText = errJson.detail;
        else if (errJson.error) errText = errJson.error;
        else if (errJson.message) errText = errJson.message;
      } catch (e) {}
      throw new Error(errText);
    }
    return res.json();
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !startDate || !endDate) {
      toast.error("Harap lengkapi form");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Tanggal awal tidak boleh melebihi tanggal akhir");
      return;
    }

    setLoading(true);
    try {
      const url = `${API_URL}/invoices/preview?customer_name=${encodeURIComponent(
        customerName
      )}&start_date=${startDate}&end_date=${endDate}${existingInvoice ? `&invoice_id=${existingInvoice.id}` : ''}`;
      
      const data = await authFetch(url);
      if (data.items.length === 0) {
        toast.error("Tidak ada data penjualan untuk kriteria tersebut.");
      } else {
        setPreviewData(data);
        setStep(2);
      }
    } catch (err: any) {
      toast.error("Gagal membuat preview: " + err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleSaveOnly = async () => {
    setLoading(true);
    try {
      const payload = {
        customer_name: previewData.customer_name,
        invoice_date: invoiceDate,
        start_date: previewData.start_date,
        end_date: previewData.end_date,
        total_amount: previewData.total_amount,
        notes: notes || undefined,
        discount_type: discountType || null,
        discount_value: discountValue ? parseFloat(discountValue) : null
      };
      
      if (existingInvoice) {
        await authFetch(`${API_URL}/invoices/${existingInvoice.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        toast.success("Invoice berhasil diupdate");
      } else {
        await authFetch(`${API_URL}/invoices`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success("Invoice berhasil disimpan");
      }
      
      onClose();
      if ((window as any).onInvoiceSaved) (window as any).onInvoiceSaved();
    } catch (err: any) {
      toast.error("Gagal menyimpan invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndDownload = async () => {
    setLoading(true);
    
    try {
      const payload = {
        customer_name: previewData.customer_name,
        invoice_date: invoiceDate,
        start_date: previewData.start_date,
        end_date: previewData.end_date,
        total_amount: previewData.total_amount,
        notes: notes || undefined,
        discount_type: discountType || null,
        discount_value: discountValue ? parseFloat(discountValue) : null
      };
      
      let res;
      if (existingInvoice) {
        // Update existing
        res = await authFetch(`${API_URL}/invoices/${existingInvoice.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        toast.success("Invoice berhasil diupdate");
      } else {
        // Create new
        res = await authFetch(`${API_URL}/invoices`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success("Invoice berhasil disimpan");
      }
      
      const invoiceId = res.id;
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
      a.download = `Invoice_${res.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      onClose();
      if ((window as any).onInvoiceSaved) (window as any).onInvoiceSaved(); // Optional callback
    } catch (err: any) {
      toast.error("Gagal mendownload invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };



  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white rounded-t-2xl z-10 sticky top-0">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Buat Invoice Penjualan Material
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {step === 1 ? (
            <form id="invoice-form" onSubmit={handlePreview} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Pilih Customer --</option>
                  {uninvoicedCustomers.map((cName, i) => (
                    <option key={i} value={cName}>{cName}</option>
                  ))}
                  {existingInvoice && !uninvoicedCustomers.includes(existingInvoice.customer_name) && (
                    <option value={existingInvoice.customer_name}>{existingInvoice.customer_name}</option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hanya menampilkan customer yang memiliki tagihan belum dibuat invoice.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Invoice diterbitkan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
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
                <div>
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
            </form>
          ) : (
            <div className="space-y-6">
              {!previewData ? (
                <div className="py-12 flex justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-emerald-800 text-lg">{previewData.customer_name}</h3>
                      <p className="text-emerald-600 text-sm">
                        Periode: {formatDate(previewData.start_date)} - {formatDate(previewData.end_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-emerald-600 font-medium">Total Tagihan</p>
                      <p className="text-2xl font-bold text-emerald-700">
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
                        <tr className="bg-emerald-50 font-bold text-emerald-700">
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
                      <select
                        value={discountType}
                        onChange={(e) => {
                          setDiscountType(e.target.value);
                          if (!e.target.value) setDiscountValue("");
                        }}
                        className={inputCls}
                      >
                        <option value="">Tidak Ada</option>
                        <option value="percentage">Persentase (%)</option>
                        <option value="nominal">Nominal (Rp)</option>
                      </select>
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
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="invoice-form"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Preview Invoice
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 border border-emerald-600 text-emerald-600 rounded-xl text-sm font-medium hover:bg-emerald-50 transition-colors mr-auto"
              >
                {existingInvoice ? "Edit Kriteria" : "Kembali ke Form"}
              </button>
              
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={loading || !previewData}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {existingInvoice ? "Update Data" : "Simpan Data"}
              </button>
              
              <button
                onClick={handleSaveAndDownload}
                disabled={loading || !previewData}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;
