import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Fuel,
  Plus,
  Calendar,
  Truck,
  MapPin,
  Droplets,
  Save,
  Edit,
  Trash2,
  AlertTriangle,
  PackageX,
} from "lucide-react";
import { toast } from "sonner";
import AlertModal from "../components/AlertModal";
import { toLocalDateTimeInputString } from "../utils/formatters";
import { useEquipment } from "../hooks/useEquipment";
import { 
  useFuelLogs, 
  useFuelEfficiency, 
  useFuelStock, 
  useCreateFuelLog, 
  useUpdateFuelLog, 
  useDeleteFuelLog,
  FuelLog,
  FuelStats
} from "../hooks/useFuel";

const FuelPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedEquipmentId = searchParams.get("equipment");

  const [showForm, setShowForm] = useState(!!preselectedEquipmentId);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<number | null>(null);

  const { data: equipmentList = [] as any[], isLoading: equipmentLoading } = useEquipment();
  const { data: rawFuelLogs, isLoading: fuelLogsLoading } = useFuelLogs();
  const fuelLogs = (rawFuelLogs as FuelLog[]) || [];
  const { data: fuelStock, isLoading: fuelStockLoading } = useFuelStock();
  const { data: rawStats, isLoading: statsLoading } = useFuelEfficiency();
  const stats = (rawStats as FuelStats) || { total_fuel_consumed: 0, equipment_count: 0 };

  const createMutation = useCreateFuelLog();
  const updateMutation = useUpdateFuelLog();
  const deleteMutation = useDeleteFuelLog();

  const loading = equipmentLoading || fuelLogsLoading || fuelStockLoading || statsLoading;

  const [formData, setFormData] = useState({
    equipment_id: preselectedEquipmentId || "",
    liters_filled: "",
    refuel_date: toLocalDateTimeInputString(new Date()),
    location: "",
    photo_url: "",
    notes: "",
  });

  useEffect(() => {
    if (preselectedEquipmentId && equipmentList.length > 0 && !formData.location) {
      const selected = equipmentList.find(
        (e: any) => e.id === parseInt(preselectedEquipmentId),
      );
      if (selected && selected.location) {
        setFormData((prev) => ({
          ...prev,
          location: selected.location || "",
        }));
      }
    }
  }, [preselectedEquipmentId, equipmentList, formData.location]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const eqIdNum = Number.parseInt(String(formData.equipment_id), 10);
    if (!formData.equipment_id || Number.isNaN(eqIdNum)) {
      toast.error("Pilih unit alat terlebih dahulu");
      return;
    }

    const parsedLitersFilled = Number.parseFloat(
      String(formData.liters_filled).replace(",", "."),
    );

    if (Number.isNaN(parsedLitersFilled)) {
      toast.error("Jumlah liter harus berupa angka valid");
      return;
    }

    const payload = {
      equipment_id: eqIdNum,
      liters_filled: parsedLitersFilled,
      refuel_date: formData.refuel_date,
      location: formData.location || undefined,
      photo_url: formData.photo_url || undefined,
      notes: formData.notes || undefined,
    };

    if (editingLog) {
      updateMutation.mutate(
        { id: editingLog.id, data: payload },
        {
          onSuccess: () => {
            setShowForm(false);
            setEditingLog(null);
            resetForm();
            toast.success("Catatan BBM berhasil diupdate!");
          },
          onError: (error: any) => {
            toast.error("Gagal: " + (error.response?.data?.detail || "Unknown error"));
          }
        }
      );
    } else {
      createMutation.mutate(
        payload,
        {
          onSuccess: () => {
            setShowForm(false);
            setEditingLog(null);
            resetForm();
            toast.success("Pengisian BBM berhasil dicatat!");
          },
          onError: (error: any) => {
            toast.error("Gagal: " + (error.response?.data?.detail || "Unknown error"));
          }
        }
      );
    }
  };

  const resetForm = () => {
    setFormData({
      equipment_id: "",
      liters_filled: "",
      refuel_date: toLocalDateTimeInputString(new Date()),
      location: "",
      photo_url: "",
      notes: "",
    });
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const preventWheelNumberChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const equipmentId = e.target.value;
    const selected = equipmentList.find((eq: any) => eq.id === parseInt(equipmentId));
    setFormData((prev) => ({
      ...prev,
      equipment_id: equipmentId,
      location: selected?.location || prev.location,
    }));
  };

  const handleEdit = (log: FuelLog) => {
    setEditingLog(log);
    setFormData({
      equipment_id: log.equipment_id.toString(),
      liters_filled: log.liters_filled.toString(),
      refuel_date: log.refuel_date
        ? toLocalDateTimeInputString(log.refuel_date)
        : toLocalDateTimeInputString(new Date()),
      location: log.location || "",
      photo_url: log.photo_url || "",
      notes: log.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = (logId: number) => {
    setDeleteLogId(logId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!deleteLogId) return;

    deleteMutation.mutate(deleteLogId, {
      onSuccess: () => {
        toast.success("Catatan berhasil dihapus!");
        setShowDeleteModal(false);
        setDeleteLogId(null);
      },
      onError: (error: any) => {
        toast.error("Gagal menghapus: " + (error.response?.data?.detail || "Unknown error"));
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setShowForm(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Memuat data...</p>
      </div>
    );
  }

  const currentStock = fuelStock?.current_stock ?? null;
  const stockOk = currentStock === null || currentStock > 0;
  const inputLiters = parseFloat(formData.liters_filled) || 0;
  
  const availableStock = editingLog 
    ? (currentStock !== null ? currentStock + (parseFloat(editingLog.liters_filled.toString()) || 0) : null)
    : currentStock;

  const litersExceedStock = availableStock !== null && inputLiters > availableStock;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 sm:p-3 bg-amber-100 rounded-lg flex-shrink-0">
            <Fuel className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Logistik BBM</h1>
            <p className="text-gray-600 text-sm">
              Pengisian solar dicatat di sini; jam kerja di menu Jam Kerja.
              Efisiensi dihitung otomatis dari keduanya.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (!stockOk) {
              toast.error('Stok BBM habis! Catat pembelian BBM terlebih dahulu di menu Pembelian & Stok BBM.');
              return;
            }
            setShowForm(true);
          }}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-sm text-white text-sm font-semibold ${
            stockOk
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          <Plus size={18} />
          <span>Isi Solar</span>
        </button>
      </div>

      {/* Stok BBM Banner */}
      {fuelStock !== null && (
        <div className={`mb-5 rounded-xl border px-5 py-4 flex items-center gap-4 ${
          currentStock !== null && currentStock <= 0
            ? 'bg-red-50 border-red-200'
            : currentStock !== null && currentStock < 500
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          {currentStock !== null && currentStock <= 0 ? (
            <PackageX className="h-6 w-6 text-red-500 shrink-0" />
          ) : (
            <Fuel className={`h-6 w-6 shrink-0 ${
              currentStock !== null && currentStock < 500 ? 'text-amber-500' : 'text-green-600'
            }`} />
          )}
          <div className="flex-1">
            <p className={`font-bold text-sm ${
              currentStock !== null && currentStock <= 0 ? 'text-red-700' : currentStock !== null && currentStock < 500 ? 'text-amber-700' : 'text-green-700'
            }`}>
              {currentStock !== null && currentStock <= 0
                ? 'Stok BBM Habis — Pengisian tidak dapat dilakukan'
                : currentStock !== null && currentStock < 500
                ? `Stok BBM Menipis — Sisa ${currentStock.toLocaleString('id-ID')} Liter`
                : `Stok BBM Tersedia — ${currentStock?.toLocaleString('id-ID')} Liter`
              }
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Total Dibeli: {fuelStock?.total_purchased?.toLocaleString('id-ID')} L
              &nbsp;·&nbsp;
              Total Terpakai: {fuelStock?.total_consumed?.toLocaleString('id-ID')} L
            </p>
          </div>
          {currentStock !== null && currentStock <= 0 && (
            <a
              href="/fuel-prices"
              className="text-xs font-semibold text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 whitespace-nowrap"
            >
              + Catat Pembelian
            </a>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-500 font-medium truncate uppercase tracking-wide">Total BBM (30 hari)</p>
          <p className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 fluid-metric-value mt-1">
            {stats.total_fuel_consumed.toFixed(1)} L
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-500 font-medium truncate uppercase tracking-wide">Total BBM Terpakai</p>
          <p className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 fluid-metric-value mt-1">
            {stats.total_fuel_consumed.toFixed(1)} L
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-500 font-medium truncate uppercase tracking-wide">Alat Terisi</p>
          <p className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 fluid-metric-value mt-1">
            {stats.equipment_count} Unit
          </p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <div className={`p-2 rounded-lg mr-3 ${editingLog ? "bg-blue-100" : "bg-amber-100"}`}>
                  <Droplets className={`w-5 h-5 ${editingLog ? "text-blue-600" : "text-amber-600"}`} />
                </div>
                <span>
                  {editingLog
                    ? "Edit Catatan Pengisian Solar"
                    : "Catat Pengisian Solar"}
                </span>
              </h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pilih Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Truck className="inline h-4 w-4 mr-1" />
                  Pilih Unit
                </label>
                <select
                  name="equipment_id"
                  value={formData.equipment_id}
                  onChange={handleEquipmentChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Pilih Alat --</option>
                  {equipmentList.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                      {eq.brand ? ` · ${eq.brand}` : ""} · {eq.type}
                      {eq.capacity ? ` · ${eq.capacity} Ton` : ""}
                    </option>
                  ))}
                </select>
                {/* Info card unit yang dipilih */}
                {formData.equipment_id &&
                  (() => {
                    const selected = equipmentList.find(
                      (eq: any) => eq.id === parseInt(formData.equipment_id),
                    );
                    if (!selected) return null;
                    return (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="font-semibold text-gray-800">
                            {selected.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                          {selected.brand && (
                            <span className="inline-flex items-center gap-1 text-gray-600 text-xs">
                              <span className="font-medium text-gray-500">
                                Merk:
                              </span>{" "}
                              {selected.brand}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-gray-600 text-xs">
                            <span className="font-medium text-gray-500">
                              Jenis:
                            </span>{" "}
                            {selected.type}
                          </span>
                          {selected.capacity && (
                            <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium">
                              <span className="font-medium text-gray-500">
                                Kapasitas:
                              </span>{" "}
                              {selected.capacity} Ton
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Tanggal & Waktu Pengisian */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Tanggal & Waktu Pengisian
                </label>
                <input
                  type="datetime-local"
                  name="refuel_date"
                  value={formData.refuel_date}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Klik untuk memilih tanggal dan waktu dari kalender
                </p>
              </div>

              {/* Jumlah Liter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Droplets className="inline h-4 w-4 mr-1" />
                  Jumlah Liter
                </label>
                <input
                  type="number"
                  name="liters_filled"
                  value={formData.liters_filled}
                  onChange={handleInputChange}
                  onWheel={preventWheelNumberChange}
                  placeholder="Contoh: 150.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                  step="any"
                />
              </div>

              {/* Lokasi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Lokasi/Proyek
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Contoh: Site A, Tambang Alpha"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Catatan tambahan (opsional)"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Sisa Stok Warning */}
            {availableStock !== null && (
              <div className={`mb-2 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
                !editingLog && currentStock !== null && currentStock <= 0
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : litersExceedStock
                  ? 'bg-orange-50 border border-orange-200 text-orange-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {!editingLog && currentStock !== null && currentStock <= 0
                    ? 'Stok BBM habis. Tidak dapat melakukan pengisian.'
                    : litersExceedStock
                    ? `Input melebihi sisa stok! Sisa stok: ${availableStock.toLocaleString('id-ID')} L`
                    : `Sisa stok BBM: ${availableStock.toLocaleString('id-ID')} L`
                  }
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className={`flex ${editingLog ? 'justify-between' : 'justify-end'} space-x-3 pt-6 border-t border-gray-100 mt-6`}>
              {editingLog && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    handleDelete(editingLog.id);
                  }}
                  className="px-4 py-2.5 rounded-xl text-red-600 font-medium hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={18} /> Hapus
                </button>
              )}
              <div className="flex gap-3 w-full justify-end">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || (availableStock !== null && ((!editingLog && currentStock !== null && currentStock <= 0) || litersExceedStock))}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm transition-colors min-w-[140px]"
                >
                  <Save size={18} />
                  <span>{editingLog ? "Update Catatan" : "Simpan Catatan"}</span>
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        <div className="px-6 py-4 whitespace-nowrap border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span>Riwayat Pengisian (30 hari terakhir)</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Liter
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Lokasi
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fuelLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada data pengisian BBM
                  </td>
                </tr>
              ) : (
                fuelLogs.map((log: FuelLog) => (
                  <tr key={log.id} className="hover:bg-emerald-50/60 cursor-pointer transition-colors" onClick={() => handleEdit(log)}>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {log.refuel_date
                        ? new Date(log.refuel_date).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                      {log.equipment_name}
                      <span className="text-xs text-gray-500 block">
                        {log.equipment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-amber-600 whitespace-nowrap">
                      {log.liters_filled} L
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {log.location || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {log.notes || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Konfirmasi Hapus"
        message="Yakin ingin menghapus catatan pengisian BBM ini?"
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  );
};

export default FuelPage;
