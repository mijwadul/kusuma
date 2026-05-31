import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, FileText, Download, Loader2 } from "lucide-react";
import { API_URL } from "../api/auth";

const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const InvoiceGenerator = ({ isOpen, onClose, customers = [], existingInvoice = null }) => {
  const [step, setStep] = useState(1); // 1 = Form, 2 = Preview
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  
  // Preview State
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (existingInvoice) {
        setCustomerName(existingInvoice.customer_name);
        setInvoiceDate(existingInvoice.invoice_date || new Date().toISOString().slice(0, 10));
        setStartDate(existingInvoice.start_date);
        setEndDate(existingInvoice.end_date);
        setNotes(existingInvoice.notes || "");
        setStep(2);
        fetchPreviewForExisting(existingInvoice);
      } else {
        setStep(1);
        setPreviewData(null);
        setCustomerName("");
        setInvoiceDate(new Date().toISOString().slice(0, 10));
        setStartDate("");
        setEndDate("");
        setNotes("");
        setDiscountType("");
        setDiscountValue("");
      }
    }
  }, [isOpen, existingInvoice]);

  const fetchPreviewForExisting = async (invoice) => {
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
    } catch (err) {
      toast.error("Gagal memuat detail invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const authFetch = async (url, options = {}) => {
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
      const err = await res.text();
      throw new Error(err);
    }
    return res.json();
  };

  const handlePreview = async (e) => {
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
      const data = await authFetch(
        `${API_URL}/invoices/preview?customer_name=${encodeURIComponent(
          customerName
        )}&start_date=${startDate}&end_date=${endDate}`
      );
      if (data.items.length === 0) {
        toast.error("Tidak ada data penjualan untuk kriteria tersebut.");
      } else {
        setPreviewData(data);
        setStep(2);
      }
    } catch (err) {
      toast.error("Gagal membuat preview: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePrintHTML = (invoiceNumber) => {
    const { items, total_amount, start_date, end_date, customer_name } = previewData;
    
    let itemsHTML = items.map((item, idx) => `
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd;">${formatDate(item.income_date)}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd;">${item.material_type}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd;">${item.license_plate || '-'}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd;">${item.driver_name || '-'}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${item.quantity} ${item.unit}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${formatIDR(item.unit_price)}</td>
        <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">${formatIDR(item.amount)}</td>
      </tr>
    `).join('');

    let discountHTML = '';
    let discountAmount = 0;
    let finalAmount = total_amount;
    
    if (discountType === 'percentage' && discountValue) {
      discountAmount = total_amount * (parseFloat(discountValue) / 100);
      finalAmount = total_amount - discountAmount;
      discountHTML = `
        <tr>
          <td colspan="8" style="text-align: right; padding: 10px;" class="total-row">Diskon (${discountValue}%)</td>
          <td style="text-align: right; padding: 10px; color: #ef4444; border: 1px solid #ddd;" class="total-row">- ${formatIDR(discountAmount)}</td>
        </tr>
      `;
    } else if (discountType === 'nominal' && discountValue) {
      discountAmount = parseFloat(discountValue);
      finalAmount = total_amount - discountAmount;
      discountHTML = `
        <tr>
          <td colspan="8" style="text-align: right; padding: 10px;" class="total-row">Diskon (Nominal)</td>
          <td style="text-align: right; padding: 10px; color: #ef4444; border: 1px solid #ddd;" class="total-row">- ${formatIDR(discountAmount)}</td>
        </tr>
      `;
    }

    return `
      <html>
        <head>
          <title>Invoice - ${invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 40px; }
            .info-grid { display: flex; justify-content: space-between; margin-top: 20px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            th { background-color: #f3f4f6; color: #374151; font-weight: bold; text-align: center; padding: 8px 10px; border: 1px solid #ddd; }
            .total-row { font-weight: bold; font-size: 15px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .signature { margin-top: 50px; display: flex; justify-content: flex-end; }
            .signature-box { text-align: center; width: 200px; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
              table, th, td { border: 1px solid #333 !important; }
              th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 0;">
            <tbody>
              <tr style="border: none;">
                <td style="width: 85px; padding: 0; border: none; vertical-align: middle;">
                  <img src="/logo.png" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; display: block;" />
                </td>
                <td style="padding-left: 16px; border: none; vertical-align: middle; text-align: left;">
                  <div style="font-size: 16pt; font-weight: bold; color: #1a3c6e; letter-spacing: 0.5px; line-height: 1.2;">
                    PT. Kusuma Samudera Berkah
                  </div>
                  <div style="font-size: 9pt; color: #4a6fa5; margin-top: 2px; font-style: italic;">
                    Pertambangan & Konstruksi
                  </div>
                  <div style="font-size: 8pt; color: #555; margin-top: 6px; line-height: 1.4;">
                    Jl. [Alamat Perusahaan], [Kota], [Provinsi]<br />
                    Telp: [Nomor Telepon] | Email: info@kusumasamuderaberkah.co.id
                  </div>
                </td>
                <td style="width: 220px; border: none; vertical-align: middle; text-align: right;">
                  <div style="font-size: 14pt; font-weight: bold; color: #1a3c6e; text-transform: uppercase; letter-spacing: 1px;">
                    INVOICE
                  </div>
                  <div style="font-size: 10pt; font-weight: bold; color: #333; margin-top: 4px;">
                    ${invoiceNumber}
                  </div>
                  <div style="font-size: 8pt; color: #777; margin-top: 4px;">
                    Tanggal Invoice: ${formatDate(invoiceDate)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div style="border-bottom: 3px solid #1a3c6e; margin-top: 10px; margin-bottom: 20px;"></div>
          
          <div class="info-grid">
            <div>
              <strong>Kepada Yth:</strong><br/>
              <span style="font-size: 18px; font-weight: bold;">${customer_name}</span>
            </div>
            <div style="text-align: right;">
              <strong>Periode Penjualan:</strong><br/>
              ${formatDate(start_date)} - ${formatDate(end_date)}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Material</th>
                <th>Nopol</th>
                <th>Supir</th>
                <th>Keterangan</th>
                <th>Qty</th>
                <th>Harga Satuan</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8" style="text-align: right; padding: 10px;" class="total-row">Subtotal</td>
                <td style="text-align: right; padding: 10px; border: 1px solid #ddd;" class="total-row">${formatIDR(total_amount)}</td>
              </tr>
              ${discountHTML}
              <tr>
                <td colspan="8" style="text-align: right; padding: 10px;" class="total-row">Total Tagihan</td>
                <td style="text-align: right; padding: 10px; color: #10b981; border: 1px solid #ddd;" class="total-row">${formatIDR(finalAmount)}</td>
              </tr>
            </tfoot>
          </table>

          ${notes ? `<div style="margin-bottom: 30px;"><strong>Catatan:</strong><br/>${notes}</div>` : ''}

          <div class="signature">
            <div class="signature-box">
              <p>Hormat Kami,</p>
              <br/><br/><br/><br/>
              <p><strong>Finance Dept.</strong></p>
            </div>
          </div>

          <div class="footer">
            Invoice generated automatically by System Kusuma
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
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
      if (window.onInvoiceSaved) window.onInvoiceSaved();
    } catch (err) {
      toast.error("Gagal menyimpan invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndDownload = async () => {
    setLoading(true);
    // Buka window terlebih dahulu untuk menghindari blokir popup browser karena asynchronous request
    const printWindow = window.open("", "_blank");
    
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
      
      // Generate Print HTML
      if (printWindow) {
        printWindow.document.write(generatePrintHTML(res.invoice_number));
        printWindow.document.close();
      } else {
        toast.error("Pop-up diblokir oleh browser. Izinkan pop-up untuk mencetak PDF.");
      }
      
      onClose();
      if (window.onInvoiceSaved) window.onInvoiceSaved(); // Optional callback
    } catch (err) {
      if (printWindow) printWindow.close();
      toast.error("Gagal menyimpan invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintOnly = () => {
    if (!existingInvoice) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(generatePrintHTML(existingInvoice.invoice_number));
      printWindow.document.close();
    } else {
      toast.error("Pop-up diblokir oleh browser. Izinkan pop-up untuk mencetak PDF.");
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
                  {customers.map((c, i) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Hanya menampilkan customer yang terdaftar.
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

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
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
                        {previewData.items.map((item, i) => (
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
                          <td colSpan="7" className="px-4 py-3 text-right text-gray-700">Subtotal</td>
                          <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap">{formatIDR(previewData.total_amount)}</td>
                        </tr>
                        {discountType && discountValue && (
                          <tr className="bg-red-50 font-medium text-red-600">
                            <td colSpan="7" className="px-4 py-3 text-right">
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
                          <td colSpan="7" className="px-4 py-3 text-right">Total Akhir</td>
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
