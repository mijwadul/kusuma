import React, { useState, useEffect } from 'react';
import { Edit, Trash2, DollarSign, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../AlertModal';
import EmployeeFormModal from './EmployeeFormModal';
import FinanceFormModal from './FinanceFormModal';
import EmployeeDetailModal from './EmployeeDetailModal';

const EmployeeListTab = ({ currentUser, canAccessFinancial, canManageEmployees, isGM }) => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [selectedEmployeeForFinance, setSelectedEmployeeForFinance] = useState(null);
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    let filtered = employees;
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (departmentFilter) {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
    }
    setFilteredEmployees(filtered);
  }, [employees, searchTerm, departmentFilter]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/employees/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        toast.error('Gagal memuat data karyawan');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${deleteEmployeeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Karyawan berhasil dihapus');
        setShowDeleteModal(false);
        fetchEmployees();
      } else {
        toast.error('Gagal menghapus karyawan');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Terjadi kesalahan saat menghapus');
    }
  };

  const openEditForm = async (employee) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${employee.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const fullEmployeeData = await response.json();
        setEditingEmployee(fullEmployeeData);
        setShowEmployeeForm(true);
      } else {
        toast.error('Gagal memuat data karyawan');
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      toast.error('Terjadi kesalahan saat memuat data karyawan');
    }
  };

  const openFinanceModal = (employee) => {
    setSelectedEmployeeForFinance(employee);
    setShowFinanceModal(true);
  };

  const openEmployeeDetail = async (employee) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/employees/${employee.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedEmployeeDetail(data);
        setShowDetailModal(true);
      } else {
        toast.error('Gagal memuat detail karyawan');
      }
    } catch (error) {
      console.error('Error fetching employee detail:', error);
      toast.error('Terjadi kesalahan saat memuat detail karyawan');
    }
  };

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  return (
    <div>
      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Departemen</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          {canManageEmployees && (
            <button
              onClick={() => {
                setEditingEmployee(null);
                setShowEmployeeForm(true);
              }}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Tambah Karyawan
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap">
              <tr>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Jabatan</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Departemen</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {canAccessFinancial && (
                  <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Gaji/Hari</th>
                )}
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Pinjaman</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={canAccessFinancial ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={canAccessFinancial ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada karyawan yang ditemukan
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold mr-3">
                          {employee.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => openEmployeeDetail(employee)}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {employee.name}
                          </button>
                          <p className="text-xs text-gray-500">{employee.employee_code || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.position || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.department || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {canAccessFinancial && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.daily_salary 
                          ? `Rp ${parseFloat(employee.daily_salary).toLocaleString('id-ID')}` 
                          : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.has_loan ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Ada Pinjaman
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        {canManageEmployees && (
                          <button
                            onClick={() => openEditForm(employee)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Data Karyawan"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        )}
                        {canAccessFinancial && (
                          <button
                            onClick={() => openFinanceModal(employee)}
                            className="text-green-600 hover:text-green-800"
                            title="Data Finansial"
                          >
                            <DollarSign className="w-5 h-5" />
                          </button>
                        )}
                        {isGM && (
                          <button
                            onClick={() => {
                              setDeleteEmployeeId(employee.id);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEmployeeForm && (
        <EmployeeFormModal
          isOpen={showEmployeeForm}
          onClose={() => setShowEmployeeForm(false)}
          editingEmployee={editingEmployee}
          canAccessFinancial={canAccessFinancial}
          onSuccess={fetchEmployees}
        />
      )}

      {showFinanceModal && (
        <FinanceFormModal
          isOpen={showFinanceModal}
          onClose={() => setShowFinanceModal(false)}
          employee={selectedEmployeeForFinance}
          onSuccess={fetchEmployees}
        />
      )}

      {showDetailModal && (
        <EmployeeDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          employee={selectedEmployeeDetail}
          canAccessFinancial={canAccessFinancial}
        />
      )}

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteEmployee}
        title="Hapus Karyawan"
        message="Apakah Anda yakin ingin menghapus karyawan ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        type="danger"
      />
    </div>
  );
};

export default EmployeeListTab;
