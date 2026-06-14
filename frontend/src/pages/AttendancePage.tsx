import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, UserCheck, Users, Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../components/AlertModal';
import { usePermissions } from '../hooks/usePermissions';
import { useEmployees } from '../hooks/useEmployees';
import {
  useAttendance,
  useCreateAttendance,
  useUpdateAttendance,
  useDeleteAttendance,
  Attendance
} from '../hooks/useAttendance';

const toLocalDateInput = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalDateTimeInput = (value?: string | Date | null) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.slice(0, 16);
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateTimeDisplay = (value?: string | null) => {
  if (!value) return '-';
  const isoStr = String(value);
  const parts = isoStr.split('T');
  if (parts.length < 2) return isoStr;
  const datePart = parts[0];
  const timePart = parts[1].slice(0, 5);
  const dateSubparts = datePart.split('-');
  if (dateSubparts.length < 3) return isoStr;
  const [y, m, d] = dateSubparts;
  return `${d}/${m}/${y} ${timePart}`;
};

export default function AttendancePage() {
  const { currentUser, isLoading: loadingUser, isGM } = usePermissions();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();

  const [filters, setFilters] = useState({
    employee_id: '',
    start_date: toLocalDateInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    end_date: toLocalDateInput(new Date())
  });

  // Query params
  const queryParams: any = {
    start_date: filters.start_date,
    end_date: filters.end_date,
  };
  if (filters.employee_id) queryParams.employee_id = filters.employee_id;

  const { data: attendance = [], isLoading: loadingAttendance } = useAttendance(queryParams);

  const createMutation = useCreateAttendance();
  const updateMutation = useUpdateAttendance();
  const deleteMutation = useDeleteAttendance();

  const isGMOrSuperuser = isGM;
  const isHelper = currentUser?.role === 'helper' && !currentUser?.is_superuser;

  const [formData, setFormData] = useState({
    employee_id: '',
    date: toLocalDateInput(new Date()),
    status: 'present',
    check_in: '',
    check_out: '',
    notes: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; attendanceId: number | null }>({ isOpen: false, attendanceId: null });

  const loading = loadingUser || loadingEmployees || loadingAttendance;
  const submitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!formData.employee_id && employees.length > 0) {
      setFormData((prev) => ({ ...prev, employee_id: String(employees[0].id) }));
    }
  }, [employees]);

  useEffect(() => {
    if (isHelper) {
      setFormData((prev) => ({ ...prev, date: toLocalDateInput(new Date()) }));
    }
  }, [isHelper]);

  const employeeMap = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => map.set(emp.id, emp));
    return map;
  }, [employees]);

  const stats = useMemo(() => {
    const today = toLocalDateInput(new Date());
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const hadirHariIni = attendance.filter(
      (item) => item.date.startsWith(today) && ['present', 'late'].includes(item.status)
    ).length;
    
    const terlambat = attendance.filter((item) => item.status === 'late').length;
    
    const izinSakitBulanIni = attendance.filter((item) => {
      if (!item.date) return false;
      const d = new Date(item.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && ['sick', 'leave'].includes(item.status);
    }).length;

    return {
      hadirHariIni,
      terlambat,
      totalKaryawan: employees.length,
      izinSakitBulanIni
    };
  }, [attendance, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      toast.error('Pilih karyawan terlebih dahulu');
      return;
    }

    const finalDate = isHelper ? toLocalDateInput(new Date()) : formData.date;

    const payload: Partial<Attendance> = {
      employee_id: Number(formData.employee_id),
      date: finalDate,
      status: formData.status,
      check_in: formData.check_in ? (formData.check_in.length === 16 ? `${formData.check_in}:00` : formData.check_in) : null,
      check_out: formData.check_out ? (formData.check_out.length === 16 ? `${formData.check_out}:00` : formData.check_out) : null,
      notes: formData.notes || undefined
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast.success('Absensi berhasil diperbarui');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Absensi berhasil disimpan');
      }
      handleCancelEdit();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || 'Terjadi kesalahan saat menyimpan absensi');
    }
  };

  const handleEditClick = (row: Attendance) => {
    setEditingId(row.id);
    const checkInVal = toLocalDateTimeInput(row.check_in);
    const checkOutVal = toLocalDateTimeInput(row.check_out);

    setFormData({
      employee_id: String(row.employee_id),
      date: row.date ? row.date.split('T')[0] : toLocalDateInput(new Date()),
      status: row.status || 'present',
      check_in: checkInVal,
      check_out: checkOutVal,
      notes: row.notes || ''
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData({
      employee_id: employees.length > 0 ? String(employees[0].id) : '',
      date: isHelper ? toLocalDateInput(new Date()) : toLocalDateInput(new Date()),
      status: 'present',
      check_in: '',
      check_out: '',
      notes: ''
    });
  };

  const handleDelete = (id: number) => {
    setDeleteModal({ isOpen: true, attendanceId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.attendanceId) return;
    try {
      await deleteMutation.mutateAsync(deleteModal.attendanceId);
      toast.success('Absensi berhasil dihapus');
      setDeleteModal({ isOpen: false, attendanceId: null });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || 'Gagal menghapus absensi');
    }
  };

  if (loading && attendance.length === 0) {
    return (
      <div className="text-center py-8">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-500 mx-auto" />
        <p className="mt-4 text-gray-600">Memuat data absensi...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Absensi Karyawan</h1>
          <p className="text-gray-600 mt-1 text-sm">Pencatatan dan pemantauan kehadiran karyawan</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-3 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Input Absensi
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats.hadirHariIni}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Hadir Hari Ini</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats.terlambat}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Status Terlambat</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats.totalKaryawan}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Karyawan</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{stats.izinSakitBulanIni}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Izin/Sakit Bulan Ini</p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                {editingId ? 'Edit Absensi' : 'Input Absensi'}
              </h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Karyawan</label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    required
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employee_code || '-'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                  <input
                    type="date"
                    value={isHelper ? toLocalDateInput(new Date()) : formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    disabled={isHelper}
                    readOnly={isHelper}
                    required
                  />
                  {isGMOrSuperuser && (
                    <p className="text-xs text-gray-500 mt-1">Role Anda dapat memilih tanggal absensi.</p>
                  )}
                  {isHelper && (
                    <p className="text-xs text-amber-600 mt-1">Tanggal helper otomatis mengikuti tanggal akses aplikasi.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                  >
                    <option value="present">Hadir</option>
                    <option value="late">Terlambat</option>
                    <option value="sick">Sakit</option>
                    <option value="leave">Izin/Cuti</option>
                    <option value="absent">Alpha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Waktu Check-in</label>
                  {isGMOrSuperuser ? (
                    <input
                      type="datetime-local"
                      value={formData.check_in}
                      onChange={(e) => setFormData((prev) => ({ ...prev, check_in: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    />
                  ) : (
                    <div className="flex items-center space-x-3 p-2.5 border border-gray-200 rounded-xl bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.check_in !== ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, check_in: e.target.checked ? toLocalDateTimeInput(new Date()) : '' }))}
                        className="h-5 w-5 text-blue-600 rounded cursor-pointer"
                      />
                      <input
                        type="datetime-local"
                        value={formData.check_in || toLocalDateTimeInput(new Date())}
                        disabled
                        className="w-full bg-transparent text-gray-600 outline-none"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Waktu Check-out</label>
                  {isGMOrSuperuser ? (
                    <input
                      type="datetime-local"
                      value={formData.check_out}
                      onChange={(e) => setFormData((prev) => ({ ...prev, check_out: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    />
                  ) : (
                    <div className="flex items-center space-x-3 p-2.5 border border-gray-200 rounded-xl bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.check_out !== ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, check_out: e.target.checked ? toLocalDateTimeInput(new Date()) : '' }))}
                        className="h-5 w-5 text-blue-600 rounded cursor-pointer"
                      />
                      <input
                        type="datetime-local"
                        value={formData.check_out || toLocalDateTimeInput(new Date())}
                        disabled
                        className="w-full bg-transparent text-gray-600 outline-none"
                      />
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="Opsional"
                  />
                </div>
              </div>
              
              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm shadow-blue-200 transition-colors min-w-[140px]"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update Absensi' : 'Simpan Absensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Filter & Riwayat Absensi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <select
            value={filters.employee_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, employee_id: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Semua karyawan</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Karyawan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Check-in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Check-out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Jam Kerja</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Catatan</th>
                {isGMOrSuperuser && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Belum ada data absensi
                  </td>
                </tr>
              ) : (
                attendance.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{row.date ? row.date.split('T')[0] : '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                      {employeeMap.get(row.employee_id)?.name || `ID ${row.employee_id}`}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{row.status || '-'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {row.check_in ? formatDateTimeDisplay(row.check_in) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {row.check_out ? formatDateTimeDisplay(row.check_out) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{row.work_hours != null ? Number(row.work_hours).toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.notes || '-'}</td>
                    {isGMOrSuperuser && (
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleEditClick(row)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Edit">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Hapus">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, attendanceId: null })}
        onConfirm={confirmDelete}
        title="Hapus Absensi"
        message="Apakah Anda yakin ingin menghapus data absensi ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
      />
    </div>
  );
}
