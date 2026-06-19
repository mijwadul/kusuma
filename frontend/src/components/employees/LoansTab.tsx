import React, { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AlertModal from '../AlertModal';
import LoanFormModal from './LoanFormModal';
import { useLoans, useDeleteLoan, Loan } from '../../hooks/useLoans';
import { useEmployees, Employee } from '../../hooks/useEmployees';
import CustomSelect from '../CustomSelect';

interface Props {
  canAccessFinancial: boolean;
}

const LoansTab: React.FC<Props> = ({ canAccessFinancial }) => {
  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState<Employee | null>(null);
  
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  
  const [showDeleteLoanModal, setShowDeleteLoanModal] = useState(false);
  const [deleteLoanId, setDeleteLoanId] = useState<number | null>(null);

  const { data: employees = [] } = useEmployees(undefined, { enabled: canAccessFinancial } as any);
  const { data: loans = [], isLoading: loading } = useLoans(
    selectedEmployeeForLoan?.id,
    { enabled: canAccessFinancial } as any
  );
  
  const deleteMutation = useDeleteLoan();

  const handleDeleteLoan = () => {
    if (deleteLoanId) {
      deleteMutation.mutate(deleteLoanId, {
        onSuccess: () => {
          toast.success('Pinjaman berhasil dihapus');
          setShowDeleteLoanModal(false);
        },
        onError: () => {
          toast.error('Gagal menghapus pinjaman');
        }
      });
    }
  };

  const openLoanForm = (loan: Loan | null = null) => {
    setEditingLoan(loan);
    setShowLoanForm(true);
  };

  if (!canAccessFinancial) return null;

  return (
    <div>
      {/* Add Loan Button & Filter */}
      <div className="mb-4 flex gap-4">
        <CustomSelect
          value={selectedEmployeeForLoan?.id || ''}
          onChange={(val) => {
            const value = val as string;
            if (!value) {
              setSelectedEmployeeForLoan(null);
            } else {
              const emp = employees.find((e: any) => e.id === parseInt(value));
              if (emp) {
                setSelectedEmployeeForLoan(emp as any);
              }
            }
          }}
          options={[
            { value: "", label: "Semua Karyawan" },
            ...employees.map((emp: any) => ({ value: String(emp.id), label: `${emp.name} - ${emp.position}` }))
          ]}
        />
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Memuat data...</td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {selectedEmployeeForLoan 
                      ? 'Tidak ada data pinjaman untuk karyawan ini' 
                      : 'Tidak ada data pinjaman'}
                  </td>
                </tr>
              ) : (
                loans.map((loan: any) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employees.find((e: any) => e.id === loan.employee_id)?.name || `ID ${loan.employee_id}`}
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
          onSuccess={() => setShowLoanForm(false)}
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
