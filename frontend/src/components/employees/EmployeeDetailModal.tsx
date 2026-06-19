import React from 'react';
import { Employee, useEmployee } from '../../hooks/useEmployees';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  canAccessFinancial: boolean;
  canManageEmployees?: boolean;
  isGM?: boolean;
  onEdit?: (employee: Employee) => void;
  onFinance?: (employee: Employee) => void;
  onDelete?: (employeeId: number) => void;
}

const EmployeeDetailModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  employee, 
  canAccessFinancial,
  canManageEmployees,
  isGM,
  onEdit,
  onFinance,
  onDelete
}) => {
  const { data: fullEmployee } = useEmployee(employee?.id);
  const displayEmployee = fullEmployee || employee;

  if (!isOpen || !displayEmployee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Detail Karyawan</h2>
            <p className="text-sm text-gray-500 mt-0.5">{displayEmployee.position || '-'} - {displayEmployee.department || '-'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            Tutup
          </button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Nama</h3>
                <p className="text-gray-900">{displayEmployee.name || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Email</h3>
                <p className="text-gray-900">{(displayEmployee as any).email || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Telepon</h3>
                <p className="text-gray-900">{(displayEmployee as any).phone || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">NIK</h3>
                <p className="text-gray-900">{(displayEmployee as any).nik || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Alamat</h3>
                <p className="text-gray-900">{(displayEmployee as any).address || '-'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Status</h3>
                <p className="text-gray-900">{displayEmployee.status === 'active' ? 'Aktif' : 'Nonaktif'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Tipe Pekerjaan</h3>
                <p className="text-gray-900">{(displayEmployee as any).employment_type || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Tanggal Masuk</h3>
                <p className="text-gray-900">{(displayEmployee as any).join_date || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Jenis Kelamin</h3>
                <p className="text-gray-900">{(displayEmployee as any).gender || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Status Pernikahan</h3>
                <p className="text-gray-900">{(displayEmployee as any).marital_status || '-'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600">Kontak Darurat</h3>
              <p className="text-gray-900">{(displayEmployee as any).emergency_contact_name || '-'} ({(displayEmployee as any).emergency_contact_relation || '-'})</p>
              <p className="text-gray-900">{(displayEmployee as any).emergency_contact_phone || '-'}</p>
            </div>
            {canAccessFinancial && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-600">Data Finansial</h3>
                <p className="text-gray-900">Gaji/Hari: {displayEmployee.daily_salary ? `Rp ${parseFloat(displayEmployee.daily_salary.toString()).toLocaleString('id-ID')}` : '-'}</p>
                <p className="text-gray-900">Saldo Pinjaman: {displayEmployee.loan_balance ? `Rp ${parseFloat(displayEmployee.loan_balance.toString()).toLocaleString('id-ID')}` : '-'}</p>
                <p className="text-gray-900">Bank: {(displayEmployee as any).bank_name || '-'}</p>
                <p className="text-gray-900">No. Rekening: {(displayEmployee as any).bank_account_number || '-'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:px-6 sm:py-4 border-t border-gray-100 gap-4 bg-gray-50 mt-auto">
          <div className="flex flex-wrap gap-2">
            {canAccessFinancial && onFinance && (
              <button
                onClick={() => { onClose(); onFinance(displayEmployee as any); }}
                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              >
                Data Finansial
              </button>
            )}
            {canManageEmployees && onEdit && (
              <button
                onClick={() => { onClose(); onEdit(displayEmployee as any); }}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              >
                Edit Karyawan
              </button>
            )}
            {isGM && onDelete && (
              <button
                onClick={() => { onClose(); onDelete(displayEmployee.id); }}
                className="flex items-center gap-1 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-2 rounded-xl transition-colors text-sm font-medium"
              >
                Hapus Karyawan
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors w-full sm:w-auto font-medium"
          >
            Tutup
          </button>
        </div>
      </div>

    </div>
  );
};

export default EmployeeDetailModal;
