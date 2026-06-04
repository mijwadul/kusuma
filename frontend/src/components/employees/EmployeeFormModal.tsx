import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useCreateEmployee, useUpdateEmployee, Employee, useEmployee } from '../../hooks/useEmployees';

const POSITION_OPTIONS = [
  'Operator', 'Mechanic', 'Driver', 'Supervisor', 'Manager',
  'Admin', 'Finance Staff', 'Helper', 'Security', 'Office Boy', 'Other'
];

const DEPARTMENT_OPTIONS = [
  'Operations', 'Maintenance', 'Finance', 'HR',
  'Administration', 'Management', 'Security', 'Logistics', 'Other'
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee: Employee | null;
  canAccessFinancial: boolean;
  onSuccess: () => void;
}

const EmployeeFormModal: React.FC<Props> = ({ isOpen, onClose, editingEmployee, canAccessFinancial, onSuccess }) => {
  const [employeeForm, setEmployeeForm] = useState({
    name: '', email: '', phone: '', nik: '', address: '', date_of_birth: '',
    place_of_birth: '', gender: '', marital_status: '', position: '',
    department: '', employment_type: 'permanent', join_date: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    daily_salary: '', hourly_overtime_rate: '', loan_balance: '',
    loan_deduction_per_period: '', debt_to_company: '', bank_name: '',
    bank_account_number: '', bank_account_name: ''
  });

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  
  const { data: fullEmployee } = useEmployee(editingEmployee?.id);

  useEffect(() => {
    const data = fullEmployee || editingEmployee;
    if (data) {
      setEmployeeForm({
        name: data.name || '',
        email: (data as any).email || '',
        phone: (data as any).phone || '',
        nik: (data as any).nik || '',
        address: (data as any).address || '',
        date_of_birth: (data as any).date_of_birth || '',
        place_of_birth: (data as any).place_of_birth || '',
        gender: (data as any).gender || '',
        marital_status: (data as any).marital_status || '',
        position: data.position || '',
        department: data.department || '',
        employment_type: (data as any).employment_type || 'permanent',
        join_date: (data as any).join_date || '',
        emergency_contact_name: (data as any).emergency_contact_name || '',
        emergency_contact_phone: (data as any).emergency_contact_phone || '',
        emergency_contact_relation: (data as any).emergency_contact_relation || '',
        daily_salary: data.daily_salary?.toString() || '',
        hourly_overtime_rate: (data as any).hourly_overtime_rate?.toString() || '',
        loan_balance: data.loan_balance?.toString() || '',
        loan_deduction_per_period: data.loan_deduction_per_period?.toString() || '',
        debt_to_company: (data as any).debt_to_company?.toString() || '',
        bank_name: (data as any).bank_name || '',
        bank_account_number: (data as any).bank_account_number || '',
        bank_account_name: (data as any).bank_account_name || ''
      });
    } else {
      setEmployeeForm({
        name: '', email: '', phone: '', nik: '', address: '', date_of_birth: '',
        place_of_birth: '', gender: '', marital_status: '', position: '',
        department: '', employment_type: 'permanent', join_date: '',
        emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
        daily_salary: '', hourly_overtime_rate: '', loan_balance: '',
        loan_deduction_per_period: '', debt_to_company: '', bank_name: '',
        bank_account_number: '', bank_account_name: ''
      });
    }
  }, [fullEmployee, editingEmployee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.email) {
      toast.error('Nama dan email harus diisi');
      return;
    }
    
    const readonlyFields = ['loan_balance', 'loan_deduction_per_period', 'debt_to_company'];
    const formData = Object.entries(employeeForm).reduce((acc: any, [key, value]) => {
      if (value === '' || value === null || value === undefined) return acc;
      if (readonlyFields.includes(key)) return acc;
      if (['daily_salary', 'hourly_overtime_rate'].includes(key)) {
        acc[key] = parseFloat(value as string);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    if (editingEmployee) {
      updateMutation.mutate(
        { id: editingEmployee.id, data: formData },
        {
          onSuccess: () => {
            toast.success('Karyawan berhasil diupdate');
            onSuccess();
            onClose();
          },
          onError: (error: any) => {
            const err = error.response?.data;
            const errorMessage = typeof err?.detail === 'string'
              ? err.detail
              : Array.isArray(err?.detail)
                ? err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
                : JSON.stringify(err?.detail);
            toast.error(errorMessage || 'Gagal menyimpan data karyawan');
          }
        }
      );
    } else {
      createMutation.mutate(
        formData,
        {
          onSuccess: () => {
            toast.success('Karyawan berhasil ditambahkan');
            onSuccess();
            onClose();
          },
          onError: (error: any) => {
            const err = error.response?.data;
            const errorMessage = typeof err?.detail === 'string'
              ? err.detail
              : Array.isArray(err?.detail)
                ? err.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ')
                : JSON.stringify(err?.detail);
            toast.error(errorMessage || 'Gagal menyimpan data karyawan');
          }
        }
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">
            {editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Data Pribadi</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({...employeeForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                <input
                  type="text"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                <input
                  type="text"
                  value={employeeForm.nik}
                  onChange={(e) => setEmployeeForm({...employeeForm, nik: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Employment Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Data Pekerjaan</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jabatan</label>
                <select
                  value={employeeForm.position}
                  onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Pilih Jabatan</option>
                  {POSITION_OPTIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                <select
                  value={employeeForm.department}
                  onChange={(e) => setEmployeeForm({...employeeForm, department: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Pilih Departemen</option>
                  {DEPARTMENT_OPTIONS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Pekerjaan</label>
                <select
                  value={employeeForm.employment_type}
                  onChange={(e) => setEmployeeForm({...employeeForm, employment_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="permanent">Tetap</option>
                  <option value="contract">Kontrak</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk</label>
                <input
                  type="date"
                  value={employeeForm.join_date}
                  onChange={(e) => setEmployeeForm({...employeeForm, join_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Kontak Darurat</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                  <input
                    type="text"
                    value={employeeForm.emergency_contact_name}
                    onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                  <input
                    type="text"
                    value={employeeForm.emergency_contact_phone}
                    onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact_phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hubungan</label>
                  <input
                    type="text"
                    value={employeeForm.emergency_contact_relation}
                    onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact_relation: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Financial Data */}
            {(canAccessFinancial || editingEmployee) && (
              <>
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Data Gaji</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gaji per Hari (Rp)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={employeeForm.daily_salary}
                      onChange={(e) => setEmployeeForm({...employeeForm, daily_salary: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                      disabled={!canAccessFinancial}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate Lembur per Jam (Rp)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={employeeForm.hourly_overtime_rate}
                      onChange={(e) => setEmployeeForm({...employeeForm, hourly_overtime_rate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                      disabled={!canAccessFinancial}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Pinjaman & Hutang</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sisa Pinjaman (Rp)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={employeeForm.loan_balance}
                      onChange={(e) => setEmployeeForm({...employeeForm, loan_balance: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      placeholder="0"
                      disabled={true}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Potongan per Periode (Rp)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={employeeForm.loan_deduction_per_period}
                      onChange={(e) => setEmployeeForm({...employeeForm, loan_deduction_per_period: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      placeholder="0"
                      disabled={true}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hutang ke Perusahaan (Rp)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={employeeForm.debt_to_company}
                      onChange={(e) => setEmployeeForm({...employeeForm, debt_to_company: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      placeholder="0"
                      disabled={true}
                    />
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Informasi Bank</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                      <input
                        type="text"
                        value={employeeForm.bank_name}
                        onChange={(e) => setEmployeeForm({...employeeForm, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Contoh: BCA, Mandiri, BRI"
                        disabled={!canAccessFinancial}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
                      <input
                        type="text"
                        value={employeeForm.bank_account_number}
                        onChange={(e) => setEmployeeForm({...employeeForm, bank_account_number: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Nomor rekening"
                        disabled={!canAccessFinancial}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Atas Nama</label>
                      <input
                        type="text"
                        value={employeeForm.bank_account_name}
                        onChange={(e) => setEmployeeForm({...employeeForm, bank_account_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Nama pemilik rekening"
                        disabled={!canAccessFinancial}
                      />
                    </div>
                  </div>
                </div>
              </>
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
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {editingEmployee ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;
