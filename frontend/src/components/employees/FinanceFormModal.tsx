import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUpdateEmployee, Employee } from '../../hooks/useEmployees';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSuccess: () => void;
}

const FinanceFormModal: React.FC<Props> = ({ isOpen, onClose, employee, onSuccess }) => {
  const [financeForm, setFinanceForm] = useState({
    daily_salary: '',
    hourly_overtime_rate: '',
    loan_balance: '',
    loan_deduction_per_period: '',
    debt_to_company: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: ''
  });

  const updateMutation = useUpdateEmployee();

  useEffect(() => {
    if (employee) {
      setFinanceForm({
        daily_salary: employee.daily_salary?.toString() || '',
        hourly_overtime_rate: (employee as any).hourly_overtime_rate?.toString() || '',
        loan_balance: employee.loan_balance?.toString() || '',
        loan_deduction_per_period: employee.loan_deduction_per_period?.toString() || '',
        debt_to_company: (employee as any).debt_to_company?.toString() || '',
        bank_name: (employee as any).bank_name || '',
        bank_account_number: (employee as any).bank_account_number || '',
        bank_account_name: (employee as any).bank_account_name || ''
      });
    }
  }, [employee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    
    updateMutation.mutate(
      {
        id: employee.id,
        data: {
          daily_salary: financeForm.daily_salary === '' ? undefined : parseFloat(financeForm.daily_salary),
          hourly_overtime_rate: financeForm.hourly_overtime_rate === '' ? undefined : parseFloat(financeForm.hourly_overtime_rate),
          bank_name: financeForm.bank_name || undefined,
          bank_account_number: financeForm.bank_account_number || undefined,
          bank_account_name: financeForm.bank_account_name || undefined
        } as any
      },
      {
        onSuccess: () => {
          toast.success('Data finansial berhasil diupdate');
          onSuccess();
          onClose();
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || 'Gagal menyimpan data finansial');
        }
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">
            Data Finansial - {employee?.name}
          </h2>
          <p className="text-sm text-gray-500">{employee?.position} - {employee?.department}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payroll Data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Data Gaji</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gaji per Hari (Rp)</label>
                <input
                  type="number"
                  value={financeForm.daily_salary}
                  onChange={(e) => setFinanceForm({...financeForm, daily_salary: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate Lembur per Jam (Rp)</label>
                <input
                  type="number"
                  value={financeForm.hourly_overtime_rate}
                  onChange={(e) => setFinanceForm({...financeForm, hourly_overtime_rate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Loan & Debt */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Pinjaman & Hutang</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sisa Pinjaman (Rp)</label>
                <input
                  type="number"
                  value={financeForm.loan_balance}
                  onChange={(e) => setFinanceForm({...financeForm, loan_balance: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="0"
                  disabled={true}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Potongan per Periode (Rp)</label>
                <input
                  type="number"
                  value={financeForm.loan_deduction_per_period}
                  onChange={(e) => setFinanceForm({...financeForm, loan_deduction_per_period: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="0"
                  disabled={true}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hutang ke Perusahaan (Rp)</label>
                <input
                  type="number"
                  value={financeForm.debt_to_company}
                  onChange={(e) => setFinanceForm({...financeForm, debt_to_company: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="0"
                  disabled={true}
                />
              </div>
            </div>

            {/* Bank Info */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Informasi Bank</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                  <input
                    type="text"
                    value={financeForm.bank_name}
                    onChange={(e) => setFinanceForm({...financeForm, bank_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Contoh: BCA, Mandiri, BRI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
                  <input
                    type="text"
                    value={financeForm.bank_account_number}
                    onChange={(e) => setFinanceForm({...financeForm, bank_account_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Nomor rekening"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Atas Nama</label>
                  <input
                    type="text"
                    value={financeForm.bank_account_name}
                    onChange={(e) => setFinanceForm({...financeForm, bank_account_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Nama pemilik rekening"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Simpan Data Finansial
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FinanceFormModal;
