import React, { useState } from 'react';
import { toast } from 'sonner';
import { useCreatePayroll, useCalculatePayroll } from '../../hooks/usePayroll';
import { Employee } from '../../hooks/useEmployees';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSuccess: () => void;
}

const PayrollFormModal: React.FC<Props> = ({ isOpen, onClose, employees, onSuccess }) => {
  const [payrollForm, setPayrollForm] = useState({
    employee_id: '',
    period_start: '',
    period_end: '',
    overtime_hours: '',
    bonus: '',
    allowance: '',
    loan_deduction: '',
    other_deduction: '',
    deduction_note: '',
    notes: ''
  });
  
  const [payrollCalculation, setPayrollCalculation] = useState<any>(null);

  const calculateMutation = useCalculatePayroll();
  const createMutation = useCreatePayroll();

  const preparePayrollPayload = () => {
    const payload: any = { ...payrollForm };
    const floatFields = ['overtime_hours', 'bonus', 'allowance', 'loan_deduction', 'other_deduction'];
    floatFields.forEach(field => {
      if (payload[field] === '') {
        delete payload[field];
      } else {
        payload[field] = parseFloat(payload[field]);
      }
    });
    if (payload.employee_id) {
      payload.employee_id = parseInt(payload.employee_id);
    }
    return payload;
  };

  const handleCalculatePayroll = () => {
    const payload = preparePayrollPayload();
    calculateMutation.mutate(payload, {
      onSuccess: (data) => {
        setPayrollCalculation(data);
      },
      onError: () => {
        toast.error('Gagal menghitung payroll');
      }
    });
  };

  const handleCreatePayroll = () => {
    const payload = preparePayrollPayload();
    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Payroll berhasil dibuat');
        onSuccess();
        onClose();
      },
      onError: () => {
        toast.error('Gagal membuat payroll');
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Buat Payroll</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Karyawan *</label>
              <select
                required
                value={payrollForm.employee_id}
                onChange={(e) => {
                  const empId = e.target.value;
                  const emp = employees.find(employee => employee.id === parseInt(empId));
                  let defaultDeduction = '';
                  if (emp && emp.loan_balance && emp.loan_balance > 0) {
                    const deduction = Math.min(emp.loan_deduction_per_period || 0, emp.loan_balance);
                    if (deduction > 0) {
                      defaultDeduction = deduction.toString();
                    }
                  }
                  setPayrollForm({
                    ...payrollForm, 
                    employee_id: empId,
                    loan_deduction: defaultDeduction
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Pilih Karyawan</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periode Mulai *</label>
                <input
                  type="date"
                  required
                  value={payrollForm.period_start}
                  onChange={(e) => setPayrollForm({...payrollForm, period_start: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periode Selesai *</label>
                <input
                  type="date"
                  required
                  value={payrollForm.period_end}
                  onChange={(e) => setPayrollForm({...payrollForm, period_end: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jam Lembur</label>
                <input
                  type="number"
                  step="0.5"
                  value={payrollForm.overtime_hours}
                  onChange={(e) => setPayrollForm({...payrollForm, overtime_hours: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bonus (Rp)</label>
                <input
                  type="number"
                  value={payrollForm.bonus}
                  onChange={(e) => setPayrollForm({...payrollForm, bonus: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tunjangan (Rp)</label>
                <input
                  type="number"
                  value={payrollForm.allowance}
                  onChange={(e) => setPayrollForm({...payrollForm, allowance: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Potongan Pinjaman (Rp)</label>
                <input
                  type="number"
                  value={payrollForm.loan_deduction}
                  onChange={(e) => setPayrollForm({...payrollForm, loan_deduction: e.target.value})}
                  placeholder="Otomatis jika kosong"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <textarea
                value={payrollForm.notes}
                onChange={(e) => setPayrollForm({...payrollForm, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={handleCalculatePayroll}
              disabled={!payrollForm.employee_id || !payrollForm.period_start || !payrollForm.period_end || calculateMutation.isPending}
              className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
            >
              {calculateMutation.isPending ? 'Menghitung...' : 'Hitung Payroll'}
            </button>

            {payrollCalculation && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-gray-700">Hasil Perhitungan:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Hadir:</span>
                    <span className="ml-2 font-medium">{payrollCalculation.present_days}/{payrollCalculation.work_days} hari</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gaji Pokok:</span>
                    <span className="ml-2 font-medium">Rp {(payrollCalculation.basic_salary ?? payrollCalculation.base_salary ?? 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Lembur:</span>
                    <span className="ml-2 font-medium">Rp {(payrollCalculation.overtime_amount ?? payrollCalculation.overtime_pay ?? 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Potongan:</span>
                    <span className="ml-2 font-medium text-red-600">Rp {(payrollCalculation.total_deduction ?? 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <span className="text-gray-700 font-semibold">Gaji Bersih:</span>
                    <span className="ml-2 font-bold text-green-600 text-lg">
                      Rp {(payrollCalculation.net_salary ?? payrollCalculation.take_home_pay ?? 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
              type="button"
              onClick={handleCreatePayroll}
              disabled={!payrollCalculation || createMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Simpan Payroll
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollFormModal;
