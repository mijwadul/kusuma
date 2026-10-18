import React from "react";
import { FolderOpen, ShoppingCart, X, Pencil, Trash2 } from "lucide-react";
import { IncomeRecord } from "../../hooks/useMaterialSales";

interface IncomeDetailModalProps {
  record: IncomeRecord | null;
  onClose: () => void;
  onEdit: (record: IncomeRecord) => void;
  onDelete: (record: IncomeRecord) => void;
  formatIDR: (v?: number | string | null) => string;
  formatDate: (d?: string | null) => string;
}

export const IncomeDetailModal: React.FC<IncomeDetailModalProps> = ({
  record,
  onClose,
  onEdit,
  onDelete,
  formatIDR,
  formatDate,
}) => {
  if (!record) return null;
  const isProj = record.income_type === "project_payment";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {isProj ? (
              <FolderOpen className="w-5 h-5 text-blue-500" />
            ) : (
              <ShoppingCart className="w-5 h-5 text-emerald-500" />
            )}
            Detail Pemasukan
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
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
              <div className="mt-0.5">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    isProj ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isProj ? "Proyek" : "Material"}
                </span>
              </div>
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
                  <p className="text-gray-800 text-sm capitalize">
                    {record.payment_term?.replace(/_/g, " ") || "-"}
                  </p>
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
                  <p className="text-gray-800 text-sm">
                    {record.quantity} {record.unit}
                  </p>
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
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl text-gray-700 hover:bg-white transition-colors mr-auto"
          >
            Tutup
          </button>

          <button
            onClick={() => {
              onClose();
              onEdit(record);
            }}
            className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors font-medium flex items-center text-sm"
          >
            <Pencil size={16} className="mr-1" /> Edit
          </button>

          <button
            onClick={() => {
              onClose();
              onDelete(record);
            }}
            className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-medium flex items-center text-sm"
          >
            <Trash2 size={16} className="mr-1" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomeDetailModal;
