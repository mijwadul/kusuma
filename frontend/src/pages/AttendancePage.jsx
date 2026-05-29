import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, UserCheck, Users, Plus } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../components/AlertModal';

const toLocalDateInput = (value) => {
  const date = value ? new Date(value) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalDateTimeInput = (value) => {
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

const formatDateTimeDisplay = (value) => {
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

const AttendancePage = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [filters, setFilters] = useState({
    employee_id: '',
    start_date: toLocalDateInput(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    end_date: toLocalDateInput(new Date())
  });
  const [formData, setFormData] = useState({
    employee_id: '',
    date: toLocalDateInput(new Date()),
    status: 'present',
    check_in: '',
    check_out: '',
    notes: ''
  });
  const [editingId, setEditingId] = useState(null);

  const [currentTimeStr, setCurrentTimeStr] = useState('');
  
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, attendanceId: null });
  useEffect(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setCurrentTimeStr(`${hours}:${minutes}`);
  }, []);

  const token = localStorage.getItem('token');
  const isGMOrSuperuser = currentUser?.is_superuser || currentUser?.role === 'gm';
  const isHelper = currentUser?.role === 'helper' && !currentUser?.is_superuser;

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
      (item) => item.date === today && ['present', 'late'].includes(item.status)
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

  const fetchCurrentUser = async () => {
    const response = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Gagal memuat user');
    const data = await response.json();
    setCurrentUser(data);
  };

  const fetchEmployees = async () => {
    const response = await fetch('/api/v1/employees/employees', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Gagal memuat karyawan');
    const data = await response.json();
    setEmployees(data);
    if (!formData.employee_id && data.length > 0) {
      setFormData((prev) => ({ ...prev, employee_id: String(data[0].id) }));
    }
  };

  const fetchAttendance = async (activeFilters = filters) => {
    const params = new URLSearchParams();
    if (activeFilters.employee_id) params.append('employee_id', activeFilters.employee_id);
    if (activeFilters.start_date) params.append('start_date', activeFilters.start_date);
    if (activeFilters.end_date) params.append('end_date', activeFilters.end_date);

    const queryString = params.toString();
    const response = await fetch(`/api/v1/employees/attendance${queryString ? `?${queryString}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Gagal memuat data absensi');
    const data = await response.json();
    setAttendance(data);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchCurrentUser();
        await fetchEmployees();
        await fetchAttendance();
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'Gagal memuat halaman absensi');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isHelper) {
      setFormData((prev) => ({ ...prev, date: toLocalDateInput(new Date()) }));
    }
  }, [isHelper]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id) {
      toast.error('Pilih karyawan terlebih dahulu');
      return;
    }

    setSubmitting(true);
    const finalDate = isHelper ? toLocalDateInput(new Date()) : formData.date;

    const payload = {
      employee_id: Number(formData.employee_id),
      date: finalDate,
      status: formData.status,
      check_in: null,
      check_out: null,
      notes: formData.notes || null
    };

    if (formData.check_in) {
      payload.check_in = formData.check_in.length === 16 ? `${formData.check_in}:00` : formData.check_in;
    }

    if (formData.check_out) {
      payload.check_out = formData.check_out.length === 16 ? `${formData.check_out}:00` : formData.check_out;
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/v1/employees/attendance/${editingId}` : '/api/v1/employees/attendance';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Gagal menyimpan absensi');
      }

      toast.success(editingId ? 'Absensi berhasil diperbarui' : 'Absensi berhasil disimpan');
      handleCancelEdit();
      await fetchAttendance();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Terjadi kesalahan saat menyimpan absensi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (row) => {
    setEditingId(row.id);
    const checkInVal = toLocalDateTimeInput(row.check_in);
    const checkOutVal = toLocalDateTimeInput(row.check_out);

    setFormData({
      employee_id: String(row.employee_id),
      date: row.date || toLocalDateInput(new Date()),
      status: row.status || 'present',
      check_in: checkInVal,
      check_out: checkOutVal,
      notes: row.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      employee_id: employees.length > 0 ? String(employees[0].id) : '',
      date: isHelper ? toLocalDateInput(new Date()) : toLocalDateInput(new Date()),
      status: 'present',
      check_in: '',
      check_out: '',
      notes: ''
    });
  };

  const handleDelete = (id) => {
    setDeleteModal({ isOpen: true, attendanceId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.attendanceId) return;
    try {
      const response = await fetch(`/api/v1/employees/attendance/${deleteModal.attendanceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Gagal menghapus absensi');
      }
      toast.success('Absensi berhasil dihapus');
      setDeleteModal({ isOpen: false, attendanceId: null });
      await fetchAttendance();
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  const handleApplyFilter = async () => {
    try {
      setLoading(true);
      await fetchAttendance(filters);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Gagal memfilter data absensi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Memuat data absensi...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Absensi Karyawan</h1>
        <p className="text-gray-600 mt-1 text-sm">Pencatatan dan pemantauan kehadiran karyawan</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value">{stats.hadirHariIni}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Hadir Hari Ini</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value">{stats.terlambat}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Status Terlambat</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value">{stats.totalKaryawan}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Karyawan</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 min-w-0 fluid-metric-container">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value">{stats.izinSakitBulanIni}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Izin/Sakit Bulan Ini</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <Plus className="w-5 h-5 mr-2 text-blue-600" />
            {editingId ? 'Edit Absensi' : 'Input Absensi'}
          </div>
          {editingId && (
            <button onClick={handleCancelEdit} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Batal Edit
            </button>
          )}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Karyawan</label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={isHelper ? toLocalDateInput(new Date()) : formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="present">Hadir</option>
                <option value="late">Terlambat</option>
                <option value="sick">Sakit</option>
                <option value="leave">Izin/Cuti</option>
                <option value="absent">Alpha</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Waktu Check-in</label>
              {isGMOrSuperuser ? (
                <input
                  type="datetime-local"
                  value={formData.check_in}
                  onChange={(e) => setFormData((prev) => ({ ...prev, check_in: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.check_in !== ''}
                    onChange={(e) => setFormData(prev => ({...prev, check_in: e.target.checked ? toLocalDateTimeInput(new Date()) : ''}))}
                    className="h-5 w-5 text-blue-600 rounded"
                  />
                  <input
                    type="datetime-local"
                    value={formData.check_in || toLocalDateTimeInput(new Date())}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Waktu Check-out</label>
              {isGMOrSuperuser ? (
                <input
                  type="datetime-local"
                  value={formData.check_out}
                  onChange={(e) => setFormData((prev) => ({ ...prev, check_out: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.check_out !== ''}
                    onChange={(e) => setFormData(prev => ({...prev, check_out: e.target.checked ? toLocalDateTimeInput(new Date()) : ''}))}
                    className="h-5 w-5 text-blue-600 rounded"
                  />
                  <input
                    type="datetime-local"
                    value={formData.check_out || toLocalDateTimeInput(new Date())}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  />
                </div>
              )}
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Opsional"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg"
          >
            {submitting ? 'Menyimpan...' : (editingId ? 'Update Absensi' : 'Simpan Absensi')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Filter & Riwayat Absensi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <select
            value={filters.employee_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, employee_id: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            onClick={handleApplyFilter}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg"
          >
            Terapkan Filter
          </button>
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
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    Belum ada data absensi
                  </td>
                </tr>
              ) : (
                attendance.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{row.date || '-'}</td>
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
                        <div className="flex items-center space-x-3">
                          <button onClick={() => handleEditClick(row)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                          <button onClick={() => handleDelete(row.id)} className="text-red-600 hover:text-red-800 font-medium">Hapus</button>
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
};

export default AttendancePage;
