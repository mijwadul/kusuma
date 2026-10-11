import { X, Settings, Pencil, Trash2 } from 'lucide-react';

interface PriceDetailModalProps {
  price: any;
  isGM: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  });

export default function PriceDetailModal({
  price,
  isGM,
  onClose,
  onEdit,
  onDelete,
}: PriceDetailModalProps) {
  if (!price) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-800">Detail Harga</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Material
            </p>
            <div className="font-medium text-gray-800">{price.material_type}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Kendaraan
            </p>
            <div className="text-sm text-gray-700">{price.vehicle_type || 'Semua Kendaraan'}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Satuan</p>
            <div className="text-sm text-gray-700 capitalize">{price.unit}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Harga Satuan
            </p>
            <div className="text-xl font-bold text-indigo-700">
              {formatIDR(price.price_per_unit)}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</p>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                price.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {price.is_active ? 'Aktif' : 'Non-aktif'}
            </span>
          </div>
        </div>
        {isGM && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100 flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={onDelete}
              className="py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} /> Hapus
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
