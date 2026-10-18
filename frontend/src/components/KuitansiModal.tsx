import React, { useState, useEffect } from "react";
import { X, Download, Receipt, FileText, CheckCircle2, Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "../api/apiClient";
import { toLocalDateInput } from "../utils/formatters";
import { Invoice } from "../hooks/useInvoices";

interface KuitansiModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess?: () => void;
}

const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d?: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const KuitansiModal: React.FC<KuitansiModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const [loading, setLoading] = useState(false);
  const [downloadMode, setDownloadMode] = useState<"kuitansi" | "bundle">("kuitansi");

  // Form Fields
  const [kuitansiNo, setKuitansiNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(toLocalDateInput(new Date()));
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Transfer Bank");
  const [signatoryName, setSignatoryName] = useState("Bagian Keuangan");
  const [includeMaterai, setIncludeMaterai] = useState(true);

  useEffect(() => {
    if (invoice && isOpen) {
      const invNum = invoice.invoice_number || "";
      setKuitansiNo(`KWT-${invNum}`);
      setPaymentDate(invoice.invoice_date || toLocalDateInput(new Date()));
      setCustomerName(invoice.customer_name || "");
      const finalVal = invoice.final_amount ?? invoice.total_amount ?? 0;
      setAmount(finalVal);
      setIncludeMaterai(finalVal >= 5000000);

      const isPaid = invoice.status === "paid";
      const desc = isPaid
        ? `Pelunasan Invoice No. ${invNum} atas penjualan material & jasa operasional`
        : `Pembayaran tagihan Invoice No. ${invNum} atas penjualan material & jasa operasional`;
      setDescription(desc);
      setSignatoryName("Bagian Keuangan");
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const downloadBlob = async (url: string, filename: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Gagal mengunduh berkas PDF dari server");
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleDownloadSingleKuitansi = async () => {
    setLoading(true);
    const loadingToast = toast.loading("Membuat Kuitansi PDF resmi...");
    try {
      const params = new URLSearchParams({
        kuitansi_no: kuitansiNo,
        signatory_name: signatoryName,
        description: description,
        include_materai: String(includeMaterai),
      });

      const url = `${API_URL}/invoices/${invoice.id}/kuitansi/pdf?${params.toString()}`;
      await downloadBlob(url, `Kuitansi_${kuitansiNo.replace(/\//g, "_")}.pdf`);
      toast.success("Kuitansi PDF berhasil diunduh!", { id: loadingToast });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal membuat kuitansi PDF", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBundle = async () => {
    setLoading(true);
    const loadingToast = toast.loading("Membuat Paket Tagihan Lengkap (Invoice + Kuitansi)...");
    try {
      const url = `${API_URL}/invoices/${invoice.id}/export/pdf?bundle=true`;
      await downloadBlob(url, `Paket_Tagihan_${invoice.invoice_number.replace(/\//g, "_")}.pdf`);
      toast.success("Paket Tagihan Lengkap (Invoice + Kuitansi) berhasil diunduh!", { id: loadingToast });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal membuat paket tagihan PDF", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Cetak Kuitansi Resmi</h2>
              <p className="text-xs text-gray-500">
                Penerbitan bukti tanda terima pembayaran untuk penagihan / pelunasan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Info Status Banner */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 space-y-0.5 leading-relaxed">
              <p className="font-semibold">Siap Diserahkan Bersama Invoice (Invoicing Bundle)</p>
              <p className="text-blue-600">
                Kuitansi ini dapat dicetak terpisah atau digabung dalam 1 file PDF lengkap bersama
                dokumen Invoice &amp; Lampiran Surat Jalan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Nomor Kuitansi
              </label>
              <input
                type="text"
                value={kuitansiNo}
                onChange={(e) => setKuitansiNo(e.target.value)}
                className={inputCls}
                placeholder="KWT-INV-..."
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Tanggal Kuitansi
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Telah Diterima Dari
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={inputCls}
                placeholder="Nama Customer / Perusahaan"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Jumlah Nominal (Rp)
              </label>
              <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-emerald-800 text-sm">
                {formatIDR(amount)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Untuk Pembayaran (Keperluan)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="Uraian pembayaran..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Metode Pembayaran
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputCls}
                placeholder="Transfer Bank BCA / Mandiri / Tunai"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Nama Penandatangan
              </label>
              <input
                type="text"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className={inputCls}
                placeholder="Bagian Keuangan / Nama Kasir"
              />
            </div>
          </div>

          {/* Opsi Bea Meterai */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Stamp className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-gray-800">Sertakan Kotak Meterai Rp 10.000</p>
                <p className="text-[11px] text-gray-500">
                  {amount >= 5000000
                    ? "Wajib untuk transaksi Rp 5.000.000 ke atas sesuai UU Bea Meterai"
                    : "Opsional untuk transaksi di bawah Rp 5.000.000"}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeMaterai}
              onChange={(e) => setIncludeMaterai(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Mini Preview Box */}
          <div className="border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white rounded-xl p-4 text-xs space-y-1.5 text-gray-700">
            <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Ringkasan Dokumen Kuitansi:
            </p>
            <p>• Diterbitkan atas nama: <b>PT. Kusuma Samudera Berkah</b></p>
            <p>• Kepada: <b>{customerName || "-"}</b></p>
            <p>• Nilai: <b className="text-emerald-700">{formatIDR(amount)}</b></p>
            <p>• Tanggal: {formatDate(paymentDate)}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl text-gray-700 hover:bg-white transition-colors"
          >
            Tutup
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadBundle}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              title="Download 1 file PDF gabungan: Invoice + Kuitansi + Lampiran"
            >
              {loading && downloadMode === "bundle" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Download Paket Lengkap (1 File)
            </button>

            <button
              type="button"
              onClick={handleDownloadSingleKuitansi}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && downloadMode === "kuitansi" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download Kuitansi Saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KuitansiModal;
