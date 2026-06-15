import React, { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  UserCog,
  Crown,
  DollarSign,
  Users as UsersIcon,
  HardHat,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import AlertModal from "../components/AlertModal";

import { useUsersList, useCreateUser, useUpdateUser, useDeleteUser, User } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { useEmployees } from "../hooks/useEmployees";
import apiClient from "../api/apiClient";

const ROLE_CONFIG: Record<string, any> = {
  gm: {
    label: "General Manager",
    color: "bg-purple-100 text-purple-800",
    icon: Crown,
    description: "Full access + Final approval",
  },
  finance: {
    label: "Finance Staff",
    color: "bg-green-100 text-green-800",
    icon: DollarSign,
    description: "Keuangan, Vendor, Payroll",
  },
  admin: {
    label: "Admin/HR",
    color: "bg-blue-100 text-blue-800",
    icon: UsersIcon,
    description: "Equipment, Karyawan, Absensi",
  },
  field: {
    label: "Field Staff",
    color: "bg-amber-100 text-amber-800",
    icon: HardHat,
    description: "Input lapangan: Absen, BBM, Work Logs",
  },
  // Legacy roles
  helper: {
    label: "Helper (Legacy)",
    color: "bg-gray-100 text-gray-800",
    icon: HardHat,
    description: "Legacy - maps to Field Staff",
  },
  checker: {
    label: "Checker (Legacy)",
    color: "bg-gray-100 text-gray-800",
    icon: DollarSign,
    description: "Legacy - maps to Finance Staff",
  },
};

export default function UsersPage() {
  const { currentUser, isLoading: loadingCurrentUser, isGM } = usePermissions();
  
  // Verify access before fetching users if possible
  const { data: users = [], isLoading: loadingUsers } = useUsersList({
    enabled: !!isGM,
  });

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "field",
    is_active: true,
  });

  const handleEmployeeSelect = async (employeeId: string) => {
    if (!employeeId) {
      setSelectedEmployee(null);
      setFormData((prev) => ({ ...prev, full_name: "", email: "", phone: "" }));
      return;
    }
    try {
      const { data: emp } = await apiClient.get(`/employees/employees/${employeeId}`);
      setSelectedEmployee(emp);
      setFormData((prev) => ({
        ...prev,
        full_name: emp.name || "",
        email: emp.email || "",
        phone: emp.phone || "",
      }));
    } catch (error) {
      console.error("Error fetching employee detail:", error);
      toast.error("Gagal memuat data karyawan");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      if (editingUser) {
        await updateMutation.mutateAsync({ id: editingUser.id, data: payload });
        toast.success("User berhasil diupdate!");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("User berhasil dibuat!");
      }

      setShowForm(false);
      setEditingUser(null);
      resetForm();
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error("Anda tidak memiliki izin untuk mengelola user");
      } else {
        toast.error(error.response?.data?.detail || "Gagal menyimpan user");
      }
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setSelectedEmployee(null);
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name || "",
      phone: (user as any).phone || "",
      role: user.role || "field",
      is_active: user.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteUserId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteUserId) return;
    try {
      await deleteMutation.mutateAsync(deleteUserId);
      toast.success("User berhasil dihapus!");
      setShowDeleteModal(false);
      setDeleteUserId(null);
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error("Anda tidak memiliki izin untuk menghapus user");
      } else {
        toast.error(error.response?.data?.detail || "Gagal menghapus user");
      }
    }
  };

  const resetForm = () => {
    setSelectedEmployee(null);
    setFormData({
      email: "",
      password: "",
      full_name: "",
      phone: "",
      role: "field",
      is_active: true,
    });
  };

  const openAddForm = () => {
    setEditingUser(null);
    resetForm();
    setShowForm(true);
  };

  const getRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.field;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={14} className="mr-1" />
        {config.label}
      </span>
    );
  };

  const loading = loadingCurrentUser || loadingUsers;
  const submitting = createMutation.isPending || updateMutation.isPending;

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-500 mx-auto" />
      </div>
    );
  }

  if (!isGM) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Crown size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">
          Halaman ini hanya dapat diakses oleh Administrator.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manajemen User</h1>
          <p className="text-gray-600 mt-1 text-sm">Kelola user dan hak akses sistem</p>
        </div>
        <button
          onClick={openAddForm}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
        >
          <Plus size={20} />
          <span>Tambah User</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Tingkat Akses System Kusuma:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(ROLE_CONFIG)
            .filter(([key]) => !["helper", "checker"].includes(key))
            .map(([key, config]) => (
              <div key={key} className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <config.icon size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{config.label}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap">
              <tr>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={user.id === currentUser?.id ? "bg-blue-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm mr-3 uppercase">
                        {(user.full_name || user.email).charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.full_name || "-"}</p>
                        {(user as any).phone && (
                          <p className="text-xs text-gray-500">{(user as any).phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(user.role || "field")}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                        <Edit size={18} />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800 p-1" title="Hapus">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Belum ada user terdaftar
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-gray-900">
                {editingUser ? "Edit User" : "Tambah User Baru"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-500 text-2xl font-semibold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    <UserCog size={14} className="inline mr-1" />
                    Pilih dari Data Karyawan
                    <span className="ml-1 text-blue-500 font-normal">(opsional)</span>
                  </label>
                  <select
                    value={selectedEmployee?.id || ""}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={loadingEmployees}
                  >
                    <option value="">
                      {loadingEmployees
                        ? "Memuat data karyawan..."
                        : "-- Pilih Karyawan (data otomatis terisi) --"}
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.position ? `— ${emp.position}` : ""} {emp.department ? `(${emp.department})` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedEmployee && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-700">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                      Data otomatis terisi dari karyawan <strong>{selectedEmployee.name}</strong>.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${selectedEmployee ? "border-blue-300 bg-blue-50" : "border-gray-300"}`}
                  placeholder="Nama lengkap pengguna"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${selectedEmployee ? "border-blue-300 bg-blue-50" : "border-gray-300"}`}
                  placeholder="Email untuk login"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${selectedEmployee ? "border-blue-300 bg-blue-50" : "border-gray-300"}`}
                  placeholder="Nomor telepon"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser && "(kosongkan jika tidak diubah)"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimal 8 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gm">General Manager - Full access + Final approval</option>
                  <option value="finance">Finance Staff - Keuangan, Vendor, Payroll</option>
                  <option value="admin">Admin/HR - Equipment, Karyawan, Absensi</option>
                  <option value="field">Field Staff - Input lapangan: Absen, BBM, Work Logs</option>
                  
                  {(editingUser?.role === "helper" || formData.role === "helper") && (
                    <option value="helper">Helper (Legacy) - maps to Field Staff</option>
                  )}
                  {(editingUser?.role === "checker" || formData.role === "checker") && (
                    <option value="checker">Checker (Legacy) - maps to Finance Staff</option>
                  )}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  User Aktif
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingUser ? "Update" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Konfirmasi Hapus User"
        message="Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  );
}
