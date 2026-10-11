import { X, Trash2, Pencil } from 'lucide-react';

interface SuratJalanDetailModalProps {
  sj: any;
  measurementType: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SuratJalanDetailModal({
  sj,
  measurementType,
  onClose,
  onEdit,
  onDelete,
}: SuratJalanDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Detail Surat Jalan</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Tanggal</p>
              <p className="text-sm font-medium">{new Date(sj.created_at).toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Asal Tambang</p>
              <p className="text-sm font-medium">{sj.asal_tambang}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Supir</p>
              <p className="text-sm font-medium">{sj.nama_supir}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">No Polisi</p>
              <p className="text-sm font-medium">{sj.nopol}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4">
            {measurementType === 'ritase' ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-sm font-medium text-emerald-800">Total Ritase</span>
                <span className="text-lg font-bold text-emerald-600">1 Rit / Trip</span>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold mb-3">
                  Data Ukuran ({measurementType === 'tonase' ? 'Tonase' : 'Kubikasi'})
                </h3>
                {measurementType === 'tonase' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Bruto (Kg)</p>
                      <p className="text-sm font-medium">
                        {sj.bruto ? Math.round(sj.bruto).toLocaleString('id-ID') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tarra (Kg)</p>
                      <p className="text-sm font-medium">
                        {sj.tarra ? Math.round(sj.tarra).toLocaleString('id-ID') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Potongan (Kg)</p>
                      <p className="text-sm font-medium text-red-500">
                        {sj.minus_berat ? Math.round(sj.minus_berat).toLocaleString('id-ID') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Netto Akhir</p>
                      <p className="text-sm font-bold text-emerald-600">{sj.netto?.toFixed(2)} Ton</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">P x L x T</p>
                      <p className="text-sm font-medium">
                        {sj.panjang} x {sj.lebar} x {sj.tinggi}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Minus Tinggi</p>
                      <p className="text-sm font-medium text-red-500">{sj.minus_tinggi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Volume Akhir</p>
                      <p className="text-sm font-bold text-emerald-600">{sj.volume?.toFixed(2)} m³</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors"
          >
            <Trash2 size={16} /> Hapus
          </button>
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold transition-colors"
          >
            <Pencil size={16} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
