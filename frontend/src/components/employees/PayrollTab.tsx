import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import PayrollFormModal from './PayrollFormModal';
import { usePayrollRecords } from '../../hooks/usePayroll';
import { useEmployees } from '../../hooks/useEmployees';

interface Props {
  canAccessFinancial: boolean;
}

const PayrollTab: React.FC<Props> = ({ canAccessFinancial }) => {
  const [showPayrollForm, setShowPayrollForm] = useState(false);

  // Gunakan enabled flag agar query tidak dijalankan jika user tidak punya akses
  const { data: payrollResponse, isLoading: loadingPayroll } = usePayrollRecords(undefined, {
    enabled: canAccessFinancial
  } as any);
  
  const payrollRecords = Array.isArray(payrollResponse) 
    ? payrollResponse 
    : (payrollResponse as any)?.payrolls ?? [];

  const { data: employees = [], refetch: refetchEmployees } = useEmployees(undefined, {
    enabled: canAccessFinancial
  } as any);

  if (!canAccessFinancial) return null;

  return (
    <div>
      {/* Payroll Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Payroll Bulan Ini</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 fluid-metric-value mt-1">-</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Pending Approval</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600 fluid-metric-value mt-1">-</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Pinjaman</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 fluid-metric-value mt-1">-</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 min-w-0 fluid-metric-container">
          <p className="text-xs sm:text-sm text-gray-600 truncate">Total Hutang</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600 fluid-metric-value mt-1">-</p>
        </div>
      </div>

      {/* Create Payroll Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowPayrollForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Buat Payroll
        </button>
      </div>

      {/* Payroll Records Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 whitespace-nowrap">
              <tr>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Hari Kerja</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Gaji Pokok</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Potongan</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Gaji Bersih</th>
                <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingPayroll ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : payrollRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Belum ada record payroll
                  </td>
                </tr>
              ) : (
                payrollRecords.map((record: any) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.period_start} - {record.period_end}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.employee_name ?? record.employee?.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.present_days ?? 0}/{record.work_days ?? 0} hari
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Rp {parseFloat(record.basic_salary ?? record.base_salary ?? 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      Rp {parseFloat(record.total_deduction ?? (record.loan_deduction + record.other_deduction) ?? 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      Rp {parseFloat(record.net_salary ?? record.take_home_pay ?? 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        record.payment_status === 'approved' 
                          ? 'bg-green-100 text-green-800'
                          : record.payment_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {record.payment_status === 'approved' ? 'Approved' : 
                         record.payment_status === 'pending' ? 'Pending' : record.payment_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPayrollForm && (
        <PayrollFormModal
          isOpen={showPayrollForm}
          onClose={() => setShowPayrollForm(false)}
          employees={employees as any}
          onSuccess={() => setShowPayrollForm(false)}
        />
      )}
    </div>
  );
};

export default PayrollTab;
