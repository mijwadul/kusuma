import React, { useState } from "react";
import {
  X,
  DollarSign,
  Info,
  Building2,
  Fuel,
  AlertTriangle,
  Gauge,
  History,
  BookOpen,
  Edit,
  Trash2,
} from "lucide-react";
import { Equipment } from "../hooks/useEquipment";
import { useEquipmentBalances } from "../hooks/useVendors";

interface Props {
  equipment: Equipment | null;
  fuelData: any;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipmentId: number) => void;
  onFuel: (equipmentId: number) => void;
  onRateHistory: (equipment: Equipment) => void;
  onLedger: (equipment: Equipment) => void;
}

const EquipmentDetailModal: React.FC<Props> = ({
  equipment,
  fuelData,
  isOpen,
  onClose,
  userRole = "user",
  onEdit,
  onDelete,
  onFuel,
  onRateHistory,
  onLedger,
}) => {
  const [activeTab, setActiveTab] = useState("general");

  const canViewFinancial = userRole === "admin" || userRole === "manager" || userRole === "gm" || userRole === "finance";
  const { data: equipmentBalances = [] } = useEquipmentBalances({ enabled: canViewFinancial && !!equipment });
  const currentBalance = (equipmentBalances as any[]).find((b: any) => b.equipment_id === equipment?.id)?.balance || 0;

  if (!isOpen || !equipment) return null;

  const lph = fuelData?.liter_per_hour;
  const isAnomaly = fuelData?.status_anomali;
  const hasLph = typeof lph === "number";
  const progressValue = hasLph ? Math.min((lph / 35) * 100, 100) : 0;
  const statusLabel = isAnomaly ? "Anomali" : hasLph ? "Normal" : "Perlu Data";

  const tabBase =
    "py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors";
  const tabInactive =
    "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[90vh] shadow-2xl rounded-2xl bg-white flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-start px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {equipment.name}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {equipment.brand && `${equipment.brand} - `}{equipment.type}{equipment.capacity && ` (${equipment.capacity} Ton)`} &bull; ID #{equipment.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-100 bg-white px-6 sticky top-[76px] z-10">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("general")}
              className={`${tabBase} ${activeTab === "general" ? "border-blue-500 text-blue-600" : tabInactive}`}
            >
              <Info size={16} />
              <span>Informasi Umum</span>
            </button>

            <button
              onClick={() => setActiveTab("fuel")}
              className={`${tabBase} ${activeTab === "fuel" ? "border-amber-500 text-amber-600" : tabInactive}`}
            >
              <Fuel size={16} />
              <span>Konsumsi BBM</span>
              {isAnomaly && (
                <span className="ml-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>

            {canViewFinancial && (
              <button
                onClick={() => setActiveTab("financial")}
                className={`${tabBase} ${activeTab === "financial" ? "border-green-500 text-green-600" : tabInactive}`}
              >
                <DollarSign size={16} />
                <span>Informasi Finansial</span>
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto">
          {/* === TAB: INFORMASI UMUM === */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b">
                  Data Operasional
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Nama Equipment
                    </label>
                    <p className="text-sm text-gray-900 font-medium mt-0.5">
                      {equipment.name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Merk
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {equipment.brand || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Tipe
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {equipment.type}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Kapasitas
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {equipment.capacity ? `${equipment.capacity} Ton` : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Lokasi
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {equipment.location || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status Operasional
                    </label>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        equipment.status === "active"
                          ? "bg-green-100 text-green-800"
                          : equipment.status === "maintenance"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {equipment.status === "active"
                        ? "Aktif"
                        : equipment.status === "maintenance"
                          ? "Maintenance"
                          : "Tidak Aktif"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b">
                  Informasi Tambahan
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status Kepemilikan
                    </label>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        (equipment.ownership_status || "internal") ===
                        "internal"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {(equipment.ownership_status || "internal") === "internal"
                        ? "Milik Sendiri"
                        : "Sewa / Rental"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      ID Equipment
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5 font-mono">
                      #{equipment.id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Tanggal Dibuat
                    </label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {new Date((equipment as any).created_at || new Date()).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  {(equipment as any).updated_at && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Terakhir Diupdate
                      </label>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {new Date((equipment as any).updated_at).toLocaleDateString(
                          "id-ID",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === TAB: KONSUMSI BBM === */}
          {activeTab === "fuel" && (
            <div className="space-y-6">
              {/* Alert Anomali */}
              {isAnomaly && fuelData?.pesan_alert && (
                <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle
                    size={18}
                    className="text-red-600 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Peringatan Anomali BBM
                    </p>
                    <p className="text-sm text-red-600 mt-0.5">
                      {fuelData.pesan_alert}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Konsumsi */}
                <div>
                  <h4 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b flex items-center space-x-2">
                    <Gauge size={18} className="text-amber-600" />
                    <span>Konsumsi Rata-rata</span>
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Liter / Jam
                      </label>
                      <p
                        className={`text-3xl font-bold ${isAnomaly ? "text-red-600" : hasLph ? "text-emerald-600" : "text-gray-400"}`}
                      >
                        {hasLph ? `${lph.toFixed(2)}` : "-"}
                        {hasLph && (
                          <span className="text-lg font-normal text-gray-500 ml-1">
                            L/jam
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>0 L/jam</span>
                        <span>Batas normal: 35 L/jam</span>
                      </div>
                      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAnomaly ? "bg-red-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {progressValue.toFixed(0)}% dari batas maksimum
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Status BBM
                      </label>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full ${
                          isAnomaly
                            ? "bg-red-100 text-red-800"
                            : hasLph
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {isAnomaly && <AlertTriangle size={14} />}
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ringkasan Statistik */}
                <div>
                  <h4 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b">
                    Ringkasan 30 Hari Terakhir
                  </h4>
                  {fuelData ? (
                    <div className="space-y-3">
                      <div className="bg-amber-50 rounded-lg p-3">
                        <label className="block text-xs font-medium text-amber-700 uppercase tracking-wide">
                          Total BBM Terisi
                        </label>
                        <p className="text-lg font-bold text-amber-800 mt-0.5">
                          {fuelData.total_liters?.toFixed(2) ?? "0.00"}{" "}
                          <span className="text-sm font-normal">Liter</span>
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <label className="block text-xs font-medium text-blue-700 uppercase tracking-wide">
                          Total Jam Operasi
                        </label>
                        <p className="text-lg font-bold text-blue-800 mt-0.5">
                          {fuelData.total_work_hours?.toFixed(2) ?? "0.00"}{" "}
                          <span className="text-sm font-normal">Jam</span>
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Jumlah Pengisian
                        </label>
                        <p className="text-lg font-bold text-gray-800 mt-0.5">
                          {fuelData.refuel_count ?? 0}{" "}
                          <span className="text-sm font-normal">kali</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <Fuel size={32} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        Belum ada data konsumsi BBM untuk equipment ini.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Mulai catat pengisian BBM untuk melihat statistik.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === TAB: INFORMASI FINANSIAL === */}
          {activeTab === "financial" && canViewFinancial && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b flex items-center space-x-2">
                  <DollarSign size={18} className="text-green-600" />
                  <span>Informasi Rental</span>
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status Kepemilikan
                    </label>
                    <p className="text-sm text-gray-900 font-medium mt-0.5">
                      {(equipment.ownership_status || "internal") === "internal"
                        ? "Milik Sendiri"
                        : "Sewa / Rental"}
                    </p>
                  </div>
                  {(equipment.ownership_status || "internal") === "rental" ? (
                    <>
                      <div className="bg-green-50 rounded-lg p-3">
                        <label className="block text-xs font-medium text-green-700 uppercase tracking-wide">
                          Tarif Rental Aktif (per Jam)
                        </label>
                        <p className="text-lg font-bold text-green-800 mt-0.5">
                          Rp{" "}
                          {parseFloat(
                            equipment.rental_rate_per_hour?.toString() || "0",
                          ).toLocaleString("id-ID")}
                        </p>
                      </div>
                      
                      {equipment.pending_rental_rate_per_hour != null && (
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <label className="block text-xs font-medium text-yellow-700 uppercase tracking-wide flex items-center gap-1">
                            <AlertTriangle size={14} />
                            Harga Dalam Antrian
                          </label>
                          <p className="text-lg font-bold text-yellow-800 mt-0.5">
                            Rp{" "}
                            {parseFloat(
                              equipment.pending_rental_rate_per_hour.toString(),
                            ).toLocaleString("id-ID")}
                            <span className="text-sm font-normal text-yellow-700 ml-2">
                              / jam
                            </span>
                          </p>
                          <p className="text-xs text-yellow-600 mt-2 italic">
                            Akan aktif setelah Saldo Terkunci (Rp {parseFloat(equipment.locked_balance_for_pending_rate?.toString() || "0").toLocaleString("id-ID")}) habis digunakan.
                          </p>
                        </div>
                      )}
                      
                      <div className="bg-blue-50 rounded-lg p-3">
                        <label className="block text-xs font-medium text-blue-700 uppercase tracking-wide">
                          Nilai Deposit
                        </label>
                        <p className={`text-lg font-bold mt-0.5 ${currentBalance < 0 ? 'text-red-600' : 'text-blue-800'}`}>
                          Rp{" "}
                          {parseFloat(
                            currentBalance.toString(),
                          ).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Vendor ID
                        </label>
                        <p className="text-sm text-gray-900 font-mono mt-0.5">
                          {equipment.vendor_id
                            ? `#${equipment.vendor_id}`
                            : "Belum diatur"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">
                        Equipment ini milik perusahaan. Tidak ada tarif rental.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b flex items-center space-x-2">
                  <Building2 size={18} className="text-gray-600" />
                  <span>Informasi Vendor</span>
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {(equipment.ownership_status || "internal") === "rental" ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Vendor ID:</span>{" "}
                        <span className="font-mono">
                          {equipment.vendor_id || "Belum diatur"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2 italic">
                        Fitur manajemen vendor tersedia pada daftar vendor di halaman equipment.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Equipment ini milik perusahaan, tidak ada informasi vendor
                      yang tersedia.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:px-6 sm:py-4 border-t border-gray-100 gap-4 bg-gray-50 mt-auto">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { onClose(); onFuel(equipment.id); }}
              className="flex items-center gap-1 text-amber-600 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              title="Isi BBM"
            >
              <Fuel size={16} /> BBM
            </button>
            <button
              onClick={() => { onClose(); onRateHistory(equipment); }}
              className="flex items-center gap-1 text-purple-600 hover:text-purple-800 bg-purple-100 hover:bg-purple-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              title="Riwayat Harga"
            >
              <History size={16} /> Harga
            </button>
            <button
              onClick={() => { onClose(); onLedger(equipment); }}
              className="flex items-center gap-1 text-teal-600 hover:text-teal-800 bg-teal-100 hover:bg-teal-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              title="Buku Besar / Ledger"
            >
              <BookOpen size={16} /> Ledger
            </button>
            <button
              onClick={() => { onClose(); onEdit(equipment); }}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              title="Edit Equipment"
            >
              <Edit size={16} /> Edit
            </button>
            <button
              onClick={() => { onClose(); onDelete(equipment.id); }}
              className="flex items-center gap-1 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              title="Hapus Equipment"
            >
              <Trash2 size={16} /> Hapus
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors w-full sm:w-auto font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentDetailModal;
