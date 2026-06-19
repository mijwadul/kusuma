import React, { useState, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import AlertModal from '../AlertModal';
import EmployeeFormModal from './EmployeeFormModal';
import FinanceFormModal from './FinanceFormModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import { useEmployees, useDeleteEmployee, Employee } from '../../hooks/useEmployees';

interface Props {
  currentUser: any;
  canAccessFinancial: boolean;
  canManageEmployees: boolean;
  isGM: boolean;
}

const EmployeeListTab: React.FC<Props> = ({ canAccessFinancial, canManageEmployees, isGM }) => {
  const { data: employees = [], isLoading: loading } = useEmployees();
  const deleteMutation = useDeleteEmployee();

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Modals state
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [selectedEmployeeForFinance, setSelectedEmployeeForFinance] = useState<Employee | null>(null);
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<Employee | null>(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<number | null>(null);

  const filteredEmployees = useMemo(() => {
    let filtered = employees;
    if (searchTerm) {
      filtered = filtered.filter((emp: any) => 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (departmentFilter) {
      filtered = filtered.filter((emp: any) => emp.department === departmentFilter);
    }
    return filtered;
  }, [employees, searchTerm, departmentFilter]);

  const handleDeleteEmployee = () => {
    if (deleteEmployeeId) {
      deleteMutation.mutate(deleteEmployeeId, {
        onSuccess: () => setShowDeleteModal(false)
      });
    }
  };

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const openFinanceModal = (employee: Employee) => {
    setSelectedEmployeeForFinance(employee);
    setShowFinanceModal(true);
  };

  const openEmployeeDetail = (employee: Employee) => {
    setSelectedEmployeeDetail(employee);
    setShowDetailModal(true);
  };

  const departments = [...new Set(employees.map((e: any) => e.department).filter(Boolean))];

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
              {departments.map((dept: any) => (
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
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Tambah Karyawan
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Jabatan</th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Departemen</th>
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                {canAccessFinancial && (
                  <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Gaji/Hari</th>
                )}
                <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Pinjaman</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={canAccessFinancial ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={canAccessFinancial ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada karyawan yang ditemukan
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee: any) => (
                  <tr key={employee.id} className="hover:bg-emerald-50/60 cursor-pointer transition-colors" onClick={() => openEmployeeDetail(employee)}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold mr-3">
                          {employee.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </span>
                          <p className="text-xs text-gray-500">{employee.employee_code || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{employee.position || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{employee.department || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {canAccessFinancial && (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {employee.daily_salary 
                          ? `Rp ${parseFloat(employee.daily_salary).toLocaleString('id-ID')}` 
                          : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {employee.has_loan ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Ada Pinjaman
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
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
          editingEmployee={editingEmployee as any}
          canAccessFinancial={canAccessFinancial}
          onSuccess={() => setShowEmployeeForm(false)}
        />
      )}

      {showFinanceModal && (
        <FinanceFormModal
          isOpen={showFinanceModal}
          onClose={() => setShowFinanceModal(false)}
          employee={selectedEmployeeForFinance as any}
          onSuccess={() => setShowFinanceModal(false)}
        />
      )}

      {showDetailModal && (
        <EmployeeDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          employee={selectedEmployeeDetail as any}
          canAccessFinancial={canAccessFinancial}
          canManageEmployees={canManageEmployees}
          isGM={isGM}
          onEdit={(emp: any) => {
            setShowDetailModal(false);
            openEditForm(emp);
          }}
          onFinance={(emp: any) => {
            setShowDetailModal(false);
            openFinanceModal(emp);
          }}
          onDelete={(empId: number) => {
            setShowDetailModal(false);
            setDeleteEmployeeId(empId);
            setShowDeleteModal(true);
          }}
        />
      )}

      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteEmployee}
        title="Hapus Karyawan"
        message="Apakah Anda yakin ingin menghapus karyawan ini? Data yang dihapus tidak dapat dikembalikan."
        confirmText="Hapus"
        cancelText="Batal"
      />
    </div>
  );
};

export default EmployeeListTab;
