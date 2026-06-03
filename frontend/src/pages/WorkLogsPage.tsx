import React, { useState } from "react";
import {
  Clock,
  Plus,
  Calendar,
  Truck,
  MapPin,
  Gauge,
  User,
  FileText,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Edit,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import AlertModal from "../components/AlertModal";

// Custom hooks
import { useWorkLogs, useWorkLogStats, useCreateWorkLog, useUpdateWorkLog, useDeleteWorkLog, WorkLog } from "../hooks/useWorkLogs";
import { useEquipment } from "../hooks/useEquipment";
import { useProjectsList } from "../hooks/useProjects";
import { useEmployees } from "../hooks/useEmployees";

export default function WorkLogsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLogId, setDeleteLogId] = useState<number | null>(null);

  // Queries
  const { data: equipment = [], isLoading: loadingEquipment } = useEquipment();
  const { data: projects = [], isLoading: loadingProjects } = useProjectsList();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const { data: workLogs = [], isLoading: loadingLogs } = useWorkLogs();
  const { data: stats, isLoading: loadingStats } = useWorkLogStats();

  // Mutations
  const createLogMutation = useCreateWorkLog();
  const updateLogMutation = useUpdateWorkLog();
  const deleteLogMutation = useDeleteWorkLog();

  // Filter only active operators
  const operators = employees.filter(
    (emp) => emp.position === "Operator" && emp.is_active !== false
  );

  // Form state
  const [formData, setFormData] = useState({
    equipment_id: "",
    input_method: "HM" as "HM" | "MANUAL",
    hm_start: "",
    hm_end: "",
    total_hours: "",
    rental_discount_hours: "0",
    project_id: "",
    operator_name: "",
    work_description: "",
    work_date: new Date().toISOString().slice(0, 10),
  });

  const isLoading = loadingEquipment || loadingProjects || loadingEmployees || loadingLogs || loadingStats;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMethodToggle = () => {
    const newMethod = formData.input_method === "HM" ? "MANUAL" : "HM";
    setFormData((prev) => ({
      ...prev,
      input_method: newMethod,
      hm_start: "",
      hm_end: "",
      total_hours: "",
    }));
  };

  const handleHMChange = (field: "hm_start" | "hm_end", value: string) => {
    const newFormData = { ...formData, [field]: value };

    if (newFormData.input_method === "HM" && newFormData.hm_start && newFormData.hm_end) {
      const hmStart = parseFloat(newFormData.hm_start);
      const hmEnd = parseFloat(newFormData.hm_end);
      if (!isNaN(hmStart) && !isNaN(hmEnd) && hmEnd > hmStart) {
        newFormData.total_hours = (hmEnd - hmStart).toString();
      }
    }
    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.equipment_id) {
      toast.error("Pilih unit terlebih dahulu");
      return;
    }

    if (formData.input_method === "HM") {
      if (!formData.hm_start || !formData.hm_end) {
        toast.error("HM awal dan HM akhir harus diisi");
        return;
      }
      const hmStart = parseFloat(formData.hm_start);
      const hmEnd = parseFloat(formData.hm_end);
      if (hmEnd <= hmStart) {
        toast.error("HM akhir harus lebih besar dari HM awal");
        return;
      }
    } else {
      if (!formData.total_hours || parseFloat(formData.total_hours) <= 0) {
        toast.error("Total jam kerja harus lebih dari 0");
        return;
      }
    }

    const discountHours = parseFloat(formData.rental_discount_hours || "0");
    if (discountHours < 0) {
      toast.error("Potongan jam tidak boleh negatif");
      return;
    }

    if (discountHours > parseFloat(formData.total_hours || "0")) {
      toast.error("Potongan jam tidak boleh melebihi total jam kerja");
      return;
    }

    const payload = {
      ...formData,
      equipment_id: parseInt(formData.equipment_id),
      work_date: `${formData.work_date}T00:00:00`,
      total_hours: parseFloat(formData.total_hours),
      rental_discount_hours: parseFloat(formData.rental_discount_hours || "0"),
      hm_start: formData.input_method === "HM" ? parseFloat(formData.hm_start) : null,
      hm_end: formData.input_method === "HM" ? parseFloat(formData.hm_end) : null,
      project_id: formData.project_id ? parseInt(formData.project_id) : null,
    };

    try {
      if (editingLog) {
        await updateLogMutation.mutateAsync({ id: editingLog.id, data: payload as any });
        toast.success("Log kerja berhasil diupdate!");
      } else {
        await createLogMutation.mutateAsync(payload as any);
        toast.success("Log kerja berhasil ditambahkan!");
      }
      setShowForm(false);
      setEditingLog(null);
      resetForm();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + (error.response?.data?.detail || error.message || "Unknown error"));
    }
  };

  const handleEdit = (log: WorkLog) => {
    setEditingLog(log);
    setFormData({
      equipment_id: log.equipment_id.toString(),
      input_method: log.input_method,
      hm_start: log.hm_start?.toString() || "",
      hm_end: log.hm_end?.toString() || "",
      total_hours: log.total_hours.toString(),
      rental_discount_hours: log.rental_discount_hours?.toString() || "0",
      project_id: log.project_id?.toString() || "",
      operator_name: log.operator_name || "",
      work_description: log.work_description || "",
      work_date: log.work_date
        ? new Date(log.work_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (logId: number) => {
    setDeleteLogId(logId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteLogId) return;
    try {
      await deleteLogMutation.mutateAsync(deleteLogId);
      toast.success("Log kerja berhasil dihapus!");
      setShowDeleteModal(false);
      setDeleteLogId(null);
    } catch (error: any) {
      toast.error("Gagal menghapus: " + (error.response?.data?.detail || error.message || "Unknown error"));
    }
  };

  const resetForm = () => {
    setFormData({
      equipment_id: "",
      input_method: "HM",
      hm_start: "",
      hm_end: "",
      total_hours: "",
      rental_discount_hours: "0",
      project_id: "",
      operator_name: "",
      work_description: "",
      work_date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setShowForm(false);
    resetForm();
  };

  if (isLoading && !workLogs.length) {
    return (
      <div className="text-center py-8 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-gray-600">Memuat data...</p>
      </div>
    );
  }

  const selectedEquipment = equipment.find(
    (eq) => String(eq.id) === String(formData.equipment_id)
  );
  
  const selectedRentalRate = parseFloat(String(selectedEquipment?.rental_rate_per_hour || 0));
  const isRentalEquipment = (selectedEquipment?.ownership_status || "internal") === "rental";
  
  const formHours = parseFloat(formData.total_hours || "0");
  const formDiscountHours = Math.max(0, parseFloat(formData.rental_discount_hours || "0"));
  
  const effectiveDiscountHours = Math.min(formHours, formDiscountHours);
  const estimatedBillableHours = Math.max(0, formHours - effectiveDiscountHours);
  
  const estimatedRentalGross = isRentalEquipment ? formHours * selectedRentalRate : 0;
  const estimatedRentalDiscount = isRentalEquipment ? effectiveDiscountHours * selectedRentalRate : 0;
  const estimatedRentalTotal = estimatedRentalGross - estimatedRentalDiscount;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 sm:mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 sm:p-3 bg-blue-100 rounded-lg flex-shrink-0">
            <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Log Jam Kerja Alat
            </h1>
            <p className="text-gray-600 text-sm">
              Pencatatan jam operasional dan utilitas equipment
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          <span>{showForm ? "Batal" : "Catat Kerja"}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500 min-w-0">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Jam Kerja</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mt-1">
            {stats?.total_hours_worked?.toFixed(1) || 0} H
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500 min-w-0">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Hari Kerja</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mt-1">
            {stats?.total_work_days || 0} Hari
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500 min-w-0">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Rata-rata/Hari</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mt-1">
            {stats?.avg_hours_per_day?.toFixed(1) || 0} H
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500 min-w-0">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Alat Aktif</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mt-1">
            {stats?.equipment_count || 0} Unit
          </p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="mb-6 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-blue-600 text-white px-6 py-4">
            <h2 className="text-lg font-semibold flex items-center space-x-2">
              <Clock size={20} />
              <span>{editingLog ? "Edit Log Jam Kerja" : "Catat Jam Kerja Alat"}</span>
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Input Method Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Metode Input:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    formData.input_method === "HM"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {formData.input_method === "HM" ? "HM Aktif" : "Manual"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleMethodToggle}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
              >
                {formData.input_method === "HM" ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                <span className="text-sm font-medium">
                  {formData.input_method === "HM" ? "Ganti ke Manual" : "Ganti ke HM"}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pilih Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Truck className="inline h-4 w-4 mr-1" /> Pilih Unit
                </label>
                <select
                  name="equipment_id"
                  value={formData.equipment_id}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Pilih Alat --</option>
                  {equipment.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} {eq.brand ? ` · ${eq.brand}` : ""} · {eq.type} {eq.capacity ? ` · ${eq.capacity} Ton` : ""}
                    </option>
                  ))}
                </select>
                {selectedEquipment && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="font-semibold text-gray-800">{selectedEquipment.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                      {selectedEquipment.brand && (
                        <span className="inline-flex items-center gap-1 text-gray-600 text-xs">
                          <span className="font-medium text-gray-500">Merk:</span> {selectedEquipment.brand}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-gray-600 text-xs">
                        <span className="font-medium text-gray-500">Jenis:</span> {selectedEquipment.type}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tanggal Kerja */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" /> Tanggal Kerja
                </label>
                <input
                  type="date"
                  name="work_date"
                  value={formData.work_date}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* HM Inputs */}
              {formData.input_method === "HM" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Gauge className="inline h-4 w-4 mr-1" /> HM Awal
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="hm_start"
                      value={formData.hm_start}
                      onChange={(e) => handleHMChange("hm_start", e.target.value)}
                      placeholder="Contoh: 1000.5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Gauge className="inline h-4 w-4 mr-1" /> HM Akhir
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="hm_end"
                      value={formData.hm_end}
                      onChange={(e) => handleHMChange("hm_end", e.target.value)}
                      placeholder="Contoh: 1008.5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <AlertTriangle className="inline h-4 w-4 mr-1 text-amber-500" /> Total Jam Kerja (Manual)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="total_hours"
                    value={formData.total_hours}
                    onChange={handleInputChange}
                    placeholder="Contoh: 8.5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-amber-600 mt-1">Digunakan jika HM rusak atau tidak tersedia</p>
                </div>
              )}

              {/* Total Hours Autocalculated for HM */}
              {formData.input_method === "HM" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="inline h-4 w-4 mr-1" /> Total Jam (Otomatis)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="total_hours"
                    value={formData.total_hours}
                    onChange={handleInputChange}
                    placeholder="Akan dihitung otomatis"
                    className="w-full border border-green-300 bg-green-50 rounded-lg px-3 py-2"
                    readOnly
                  />
                </div>
              )}

              {/* Rental Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <AlertTriangle className="inline h-4 w-4 mr-1 text-amber-500" /> Potongan Jam Sewa (Jam)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="rental_discount_hours"
                  value={formData.rental_discount_hours}
                  onChange={handleInputChange}
                  placeholder="Contoh: 1.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Project */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" /> Proyek
                </label>
                <select
                  name="project_id"
                  value={formData.project_id}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Pilih Proyek --</option>
                  {projects.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline h-4 w-4 mr-1" /> Nama Operator
                </label>
                <select
                  name="operator_name"
                  value={formData.operator_name}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Pilih Operator --</option>
                  {operators.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((op) => (
                    <option key={op.id} value={op.name}>{op.name}</option>
                  ))}
                  {formData.operator_name && !operators.some((op) => op.name === formData.operator_name) && (
                    <option value={formData.operator_name}>{formData.operator_name} (tidak aktif)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Rental Cost Preview */}
            {isRentalEquipment && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">Estimasi Biaya Sewa</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <p className="text-gray-700">Tarif/Jam: <span className="font-semibold">Rp {selectedRentalRate.toLocaleString("id-ID")}</span></p>
                  <p className="text-gray-700">Jam Ditagih: <span className="font-semibold">{estimatedBillableHours.toLocaleString("id-ID")} Jam</span></p>
                  <p className="text-gray-700">Total Setelah Diskon: <span className="font-semibold text-amber-700">Rp {estimatedRentalTotal.toLocaleString("id-ID")}</span></p>
                </div>
              </div>
            )}

            {/* Work Description */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="inline h-4 w-4 mr-1" /> Keterangan Kerja
              </label>
              <textarea
                name="work_description"
                value={formData.work_description}
                onChange={handleInputChange}
                placeholder="Deskripsi pekerjaan yang dilakukan (opsional)"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                type="submit"
                disabled={createLogMutation.isPending || updateLogMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-70"
              >
                {(createLogMutation.isPending || updateLogMutation.isPending) ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Save size={20} />
                )}
                <span>{editingLog ? "Update Log" : "Simpan Log"}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
        <div className="px-6 py-4 whitespace-nowrap border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <span>Riwayat Jam Kerja</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Jam</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diskon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Biaya Sewa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proyek</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500 italic">Belum ada data jam kerja</td>
                </tr>
              ) : (
                workLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {log.work_date
                        ? new Date(log.work_date).toLocaleDateString("id-ID", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                      {log.equipment_name}
                      <span className="text-xs text-gray-500 block font-normal">{log.equipment_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        log.input_method === "HM" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {log.input_method === "HM" ? "HM" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono whitespace-nowrap">
                      {log.input_method === "HM" && log.hm_start !== null && log.hm_end !== null
                        ? `${log.hm_start} - ${log.hm_end}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600 whitespace-nowrap">
                      {log.total_hours} H
                    </td>
                    <td className="px-4 py-3 text-sm text-amber-700 font-medium whitespace-nowrap">
                      {Number(log.rental_discount_hours || 0).toLocaleString("id-ID")} Jam
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-amber-700 whitespace-nowrap">
                      Rp {Number(log.rental_cost_total || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{log.operator_name || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{log.project_name || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button onClick={() => handleEdit(log)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Hapus">
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
        message="Yakin ingin menghapus log jam kerja ini?"
        confirmText={deleteLogMutation.isPending ? "Menghapus..." : "Hapus"}
        cancelText="Batal"
      />
    </div>
  );
}
