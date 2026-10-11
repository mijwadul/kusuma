import { X, ShoppingCart, Pencil, Trash2 } from 'lucide-react';
import MaterialBadge from './MaterialBadge';

interface SaleDetailModalProps {
  sale: any;
  isGM: boolean;
  currentUser: any;
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

const formatDate = (d?: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function SaleDetailModal({
  sale,
  isGM,
  currentUser,
  onClose,
  onEdit,
  onDelete,
}: SaleDetailModalProps) {
  if (!sale) return null;
  const canEdit = isGM || sale.created_by === currentUser?.id;
  const rows = [
    { label: 'Tanggal', value: formatDate(sale.income_date) },
    { label: 'Customer', value: sale.customer_name || '-' },
    { label: 'Plat Nomor', value: sale.license_plate || '-' },
    { label: 'Nama Supir', value: sale.driver_name || '-' },
    { label: 'Jenis Kendaraan', value: sale.vehicle_type || '-' },
    { label: 'Material', value: <MaterialBadge type={sale.material_type} /> },
    { label: 'Volume', value: `${Number(sale.quantity).toLocaleString('id-ID')} ${sale.unit}` },
    { label: 'Harga / Satuan', value: formatIDR(sale.unit_price) },
    {
      label: 'Total',
      value: <span className="text-emerald-700 font-bold text-base">{formatIDR(sale.amount)}</span>,
    },
    {
      label: 'Pembayaran',
      value: (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            sale.payment_method === 'cash'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {sale.payment_method === 'cash' ? 'Cash' : 'Transfer'}
        </span>
      ),
    },
    ...(sale.notes ? [{ label: 'Catatan', value: sale.notes }] : []),
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-600" />
            <h2 className="text-base font-semibold text-gray-800">Detail Penjualan Material</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-400 font-medium">{label}</span>
              <span className="text-gray-800 font-medium text-right">{value}</span>
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100 flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
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
