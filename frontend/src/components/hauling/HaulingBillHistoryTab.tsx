import { Loader2, Download, Trash2 } from 'lucide-react';

interface HaulingBillHistoryTabProps {
  savedBills: any[];
  loadingSavedBills: boolean;
  isGeneratingPDF: boolean;
  onDownloadBill: (bill: any) => Promise<void>;
  onDeleteBill: (billId: number, billNumberStr: string) => Promise<void>;
  deletePending: boolean;
  onClose: () => void;
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

export default function HaulingBillHistoryTab({
  savedBills,
  loadingSavedBills,
  isGeneratingPDF,
  onDownloadBill,
  onDeleteBill,
  deletePending,
  onClose,
}: HaulingBillHistoryTabProps) {
  return (
    <>
      <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
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
                          onClick={() => onDownloadBill(b)}
                          disabled={isGeneratingPDF}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Download PDF"
                        >
                          <Download size={13} /> Download PDF
                        </button>
                        <button
                          onClick={() => onDeleteBill(b.id, b.bill_number)}
                          disabled={deletePending}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
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

      <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-xs transition-colors"
        >
          Tutup
        </button>
      </div>
    </>
  );
}
