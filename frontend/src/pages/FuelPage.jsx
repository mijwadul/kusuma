import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Fuel,
  Plus,
  Calendar,
  Truck,
  MapPin,
  Droplets,
  X,
  Save,
  Edit,
  Trash2,
  AlertTriangle,
  PackageX,
} from "lucide-react";
import { API_URL } from "../api/auth";
import { toast } from "sonner";
import AlertModal from "../components/AlertModal";

const FuelPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEquipmentId = searchParams.get("equipment");

  const [equipment, setEquipment] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [fuelStock, setFuelStock] = useState(null); // { current_stock, total_purchased, total_consumed }
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!preselectedEquipmentId);
  const [editingLog, setEditingLog] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState(null);
  const [stats, setStats] = useState({
    total_fuel_consumed: 0,
    equipment_count: 0,
  });

  const [formData, setFormData] = useState({
    equipment_id: preselectedEquipmentId || "",
    liters_filled: "",
    refuel_date: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
    location: "",
    photo_url: "",
    notes: "",
  });

  useEffect(() => {
    fetchEquipment();
    fetchFuelLogs();
    fetchFuelStats();
    fetchFuelStock();
  }, []);

  const getToken = () => localStorage.getItem("token");

  const fetchEquipment = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/equipment`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEquipment(data);
        // Auto-fill location if equipment selected
        if (preselectedEquipmentId) {
          const selected = data.find(
            (e) => e.id === parseInt(preselectedEquipmentId),
          );
          if (selected) {
            setFormData((prev) => ({
              ...prev,
              location: selected.location || "",
            }));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching equipment:", error);
    }
  };

  const fetchFuelLogs = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/fuel/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFuelLogs(data);
      }
    } catch (error) {
      console.error("Error fetching fuel logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFuelStats = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/fuel/efficiency`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching fuel stats:", error);
    }
  };

  const fetchFuelStock = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/fuel/stock`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setFuelStock(await response.json());
      }
    } catch (error) {
      console.error("Error fetching fuel stock:", error);
    }
  };

  const handleSubmit = async (e) => {
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

    try {
      const token = getToken();
      const isEditing = editingLog !== null;
      const url = isEditing
        ? `${API_URL}/fuel/logs/${editingLog.id}`
        : `${API_URL}/fuel/refuel`;
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowForm(false);
        setEditingLog(null);
        setFormData({
          equipment_id: "",
          liters_filled: "",
          refuel_date: new Date().toISOString().slice(0, 16),
          location: "",
          photo_url: "",
          notes: "",
        });
        fetchFuelLogs();
        fetchFuelStats();
        fetchFuelStock();
        toast.success(
          isEditing
            ? "Catatan BBM berhasil diupdate!"
            : "Pengisian BBM berhasil dicatat!",
        );
      } else {
        const error = await response.json();
        toast.error("Gagal: " + (error.detail || "Unknown error"));
      }
    } catch (error) {
      console.error("Error submitting fuel log:", error);
      toast.error("Gagal menyimpan catatan BBM");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const preventWheelNumberChange = (e) => {
    // Hindari perubahan nilai tidak sengaja saat scroll di input number.
    e.currentTarget.blur();
  };

  const handleEquipmentChange = (e) => {
    const equipmentId = e.target.value;
    const selected = equipment.find((eq) => eq.id === parseInt(equipmentId));
    setFormData((prev) => ({
      ...prev,
      equipment_id: equipmentId,
      location: selected?.location || prev.location,
    }));
  };

  const handleEdit = (log) => {
    setEditingLog(log);
    setFormData({
      equipment_id: log.equipment_id,
      liters_filled: log.liters_filled,
      refuel_date: log.refuel_date
        ? new Date(log.refuel_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      location: log.location || "",
      photo_url: log.photo_url || "",
      notes: log.notes || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (logId) => {
    setDeleteLogId(logId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteLogId) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/fuel/logs/${deleteLogId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchFuelLogs();
        fetchFuelStats();
        fetchFuelStock();
        toast.success("Catatan berhasil dihapus!");
        setShowDeleteModal(false);
        setDeleteLogId(null);
      } else {
        const error = await response.json();
        toast.error("Gagal menghapus: " + (error.detail || "Unknown error"));
      }
    } catch (error) {
      console.error("Error deleting fuel log:", error);
      toast.error("Gagal menghapus catatan");
    }
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setShowForm(false);
    setFormData({
      equipment_id: "",
      liters_filled: "",
      refuel_date: new Date().toISOString().slice(0, 16),
      location: "",
      photo_url: "",
      notes: "",
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Memuat data...</p>
      </div>
    );
  }

  // Hitung apakah stok cukup
  const currentStock = fuelStock?.current_stock ?? null;
  const stockOk = currentStock === null || currentStock > 0;
  const inputLiters = parseFloat(formData.liters_filled) || 0;
  const litersExceedStock = currentStock !== null && inputLiters > currentStock;

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
            setShowForm(!showForm);
          }}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md text-white ${
            stockOk
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          <span>{showForm ? "Batal" : "Isi Solar"}</span>
        </button>
      </div>

      {/* Stok BBM Banner */}
      {fuelStock !== null && (
        <div className={`mb-5 rounded-xl border px-5 py-4 flex items-center gap-4 ${
          currentStock <= 0
            ? 'bg-red-50 border-red-200'
            : currentStock < 500
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          {currentStock <= 0 ? (
            <PackageX className="h-6 w-6 text-red-500 shrink-0" />
          ) : (
            <Fuel className={`h-6 w-6 shrink-0 ${
              currentStock < 500 ? 'text-amber-500' : 'text-green-600'
            }`} />
          )}
          <div className="flex-1">
            <p className={`font-bold text-sm ${
              currentStock <= 0 ? 'text-red-700' : currentStock < 500 ? 'text-amber-700' : 'text-green-700'
            }`}>
              {currentStock <= 0
                ? 'Stok BBM Habis — Pengisian tidak dapat dilakukan'
                : currentStock < 500
                ? `Stok BBM Menipis — Sisa ${currentStock.toLocaleString('id-ID')} Liter`
                : `Stok BBM Tersedia — ${currentStock.toLocaleString('id-ID')} Liter`
              }
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Total Dibeli: {fuelStock.total_purchased.toLocaleString('id-ID')} L
              &nbsp;·&nbsp;
              Total Terpakai: {fuelStock.total_consumed.toLocaleString('id-ID')} L
            </p>
          </div>
          {currentStock <= 0 && (
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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total BBM (30 hari)</p>
          <p className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 fluid-metric-value mt-0.5">
            {stats.total_fuel_consumed.toFixed(1)} L
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total BBM Terpakai</p>
          <p className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 fluid-metric-value mt-0.5">
            {stats.total_fuel_consumed.toFixed(1)} L
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Alat Terisi</p>
          <p className="text-base sm:text-lg md:text-2xl font-bold text-gray-800 fluid-metric-value mt-0.5">
            {stats.equipment_count} Unit
          </p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="mb-6 bg-white rounded-lg shadow-lg overflow-hidden">
          <div
            className={`${editingLog ? "bg-blue-500" : "bg-amber-500"} text-white px-6 py-4`}
          >
            <h2 className="text-lg font-semibold flex items-center space-x-2">
              <Droplets size={20} />
              <span>
                {editingLog
                  ? "Edit Catatan Pengisian Solar"
                  : "Catat Pengisian Solar"}
              </span>
            </h2>
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
                  {equipment.map((eq) => (
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
                    const selected = equipment.find(
                      (eq) => eq.id === parseInt(formData.equipment_id),
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
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Sisa Stok Warning */}
            {currentStock !== null && (
              <div className={`mb-2 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
                currentStock <= 0
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : litersExceedStock
                  ? 'bg-orange-50 border border-orange-200 text-orange-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {currentStock <= 0
                    ? 'Stok BBM habis. Tidak dapat melakukan pengisian.'
                    : litersExceedStock
                    ? `Input melebihi sisa stok! Sisa stok: ${currentStock.toLocaleString('id-ID')} L`
                    : `Sisa stok BBM: ${currentStock.toLocaleString('id-ID')} L`
                  }
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={currentStock !== null && (currentStock <= 0 || litersExceedStock)}
                className={`flex-1 ${
                  editingLog ? "bg-blue-500 hover:bg-blue-600" : "bg-amber-500 hover:bg-amber-600"
                } text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save size={20} />
                <span>{editingLog ? "Update Catatan" : "Simpan Catatan"}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-3 whitespace-nowrap border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 whitespace-nowrap border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <span>Riwayat Pengisian (30 hari terakhir)</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Liter
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Lokasi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Catatan
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fuelLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada data pengisian BBM
                  </td>
                </tr>
              ) : (
                fuelLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
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
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(log)}
                          className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
