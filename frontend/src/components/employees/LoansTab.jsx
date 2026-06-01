import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../AlertModal';
import LoanFormModal from './LoanFormModal';

const LoansTab = ({ canAccessFinancial }) => {
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState(null);
  
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  
  const [showDeleteLoanModal, setShowDeleteLoanModal] = useState(false);
  const [deleteLoanId, setDeleteLoanId] = useState(null);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (canAccessFinancial) {
      fetchEmployees();
      fetchLoans();
    }
  }, [canAccessFinancial]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/employees/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchLoans = async (employeeId = null) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = employeeId 
        ? `/api/v1/employees/loans/employee/${employeeId}`
        : `/api/v1/employees/loans`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLoans(data);
      } else {
        toast.error('Gagal memuat data pinjaman');
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Terjadi kesalahan saat memuat data pinjaman');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLoan = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/employees/loans/${deleteLoanId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Pinjaman berhasil dihapus');
        setShowDeleteLoanModal(false);
        await fetchLoans(selectedEmployeeForLoan?.id || null);
      } else {
        toast.error('Gagal menghapus pinjaman');
      }
    } catch (error) {
      console.error('Error deleting loan:', error);
      toast.error('Terjadi kesalahan saat menghapus');
    }
  };

  const openLoanForm = (loan = null) => {
    if (loan) {
      setEditingLoan(loan);
    } else {
      setEditingLoan(null);
    }
    setShowLoanForm(true);
  };

  if (!canAccessFinancial) return null;

  return (
    <div>
      {/* Add Loan Button & Filter */}
      <div className="mb-4 flex gap-4">
        <select
          value={selectedEmployeeForLoan?.id || ''}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              setSelectedEmployeeForLoan(null);
              fetchLoans();
            } else {
              const emp = employees.find(e => e.id === parseInt(value));
              if (emp) {
                setSelectedEmployeeForLoan(emp);
                fetchLoans(emp.id);
              }
            }
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Karyawan</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
          ))}
        </select>
        <button
          onClick={() => openLoanForm()}
          disabled={!selectedEmployeeForLoan}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Pinjaman
        </button>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap">
              <tr>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Tanggal Pinjam</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Nominal</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Sisa Saldo</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Potongan/Periode</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Memuat data...</td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    {selectedEmployeeForLoan 
                      ? 'Tidak ada data pinjaman untuk karyawan ini' 
                      : 'Tidak ada data pinjaman'}
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employees.find(e => e.id === loan.employee_id)?.name || `ID ${loan.employee_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{loan.loan_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp {parseFloat(loan.nominal).toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp {parseFloat(loan.remaining_balance).toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{loan.deduction_per_period ? `Rp ${parseFloat(loan.deduction_per_period).toLocaleString('id-ID')}` : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        loan.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {loan.is_active ? 'Aktif' : 'Selesai'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openLoanForm(loan)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Pinjaman"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteLoanId(loan.id);
                            setShowDeleteLoanModal(true);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Hapus Pinjaman"
                        >
                          <Trash2 className="w-5 h-5" />
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

      {showLoanForm && (
        <LoanFormModal
          isOpen={showLoanForm}
          onClose={() => setShowLoanForm(false)}
          employee={selectedEmployeeForLoan}
          editingLoan={editingLoan}
          onSuccess={() => fetchLoans(selectedEmployeeForLoan?.id || null)}
        />
      )}

      <AlertModal
        isOpen={showDeleteLoanModal}
        onClose={() => setShowDeleteLoanModal(false)}
        onConfirm={handleDeleteLoan}
        title="Hapus Pinjaman"
        message="Apakah Anda yakin ingin menghapus data pinjaman ini?"
        confirmText="Hapus"
        cancelText="Batal"
        type="danger"
      />
    </div>
  );
};

export default LoansTab;
