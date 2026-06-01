import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

const POSITION_OPTIONS = [
  'Operator', 'Mechanic', 'Driver', 'Supervisor', 'Manager',
  'Admin', 'Finance Staff', 'Helper', 'Security', 'Office Boy', 'Other'
];

const DEPARTMENT_OPTIONS = [
  'Operations', 'Maintenance', 'Finance', 'HR',
  'Administration', 'Management', 'Security', 'Logistics', 'Other'
];

const EmployeeFormModal = ({ isOpen, onClose, editingEmployee, canAccessFinancial, onSuccess }) => {
  const [employeeForm, setEmployeeForm] = useState({
    name: '', email: '', phone: '', nik: '', address: '', date_of_birth: '',
    place_of_birth: '', gender: '', marital_status: '', position: '',
    department: '', employment_type: 'permanent', join_date: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    daily_salary: '', hourly_overtime_rate: '', loan_balance: '',
    loan_deduction_per_period: '', debt_to_company: '', bank_name: '',
    bank_account_number: '', bank_account_name: ''
  });

  useEffect(() => {
    if (editingEmployee) {
      setEmployeeForm({
        name: editingEmployee.name || '',
        email: editingEmployee.email || '',
        phone: editingEmployee.phone || '',
        nik: editingEmployee.nik || '',
        address: editingEmployee.address || '',
        date_of_birth: editingEmployee.date_of_birth || '',
        place_of_birth: editingEmployee.place_of_birth || '',
        gender: editingEmployee.gender || '',
        marital_status: editingEmployee.marital_status || '',
        position: editingEmployee.position || '',
        department: editingEmployee.department || '',
        employment_type: editingEmployee.employment_type || 'permanent',
        join_date: editingEmployee.join_date || '',
        emergency_contact_name: editingEmployee.emergency_contact_name || '',
        emergency_contact_phone: editingEmployee.emergency_contact_phone || '',
        emergency_contact_relation: editingEmployee.emergency_contact_relation || '',
        daily_salary: editingEmployee.daily_salary || '',
        hourly_overtime_rate: editingEmployee.hourly_overtime_rate || '',
        loan_balance: editingEmployee.loan_balance || '',
        loan_deduction_per_period: editingEmployee.loan_deduction_per_period || '',
        debt_to_company: editingEmployee.debt_to_company || '',
        bank_name: editingEmployee.bank_name || '',
        bank_account_number: editingEmployee.bank_account_number || '',
        bank_account_name: editingEmployee.bank_account_name || ''
      });
    }
  }, [editingEmployee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.email) {
      toast.error('Nama dan email harus diisi');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = editingEmployee 
        ? `/api/v1/employees/employees/${editingEmployee.id}`
        : '/api/v1/employees/employees';
      
      const method = editingEmployee ? 'PUT' : 'POST';
      
      const readonlyFields = ['loan_balance', 'loan_deduction_per_period', 'debt_to_company'];
      const formData = Object.entries(employeeForm).reduce((acc, [key, value]) => {
        if (value === '' || value === null || value === undefined) return acc;
        if (readonlyFields.includes(key)) return acc;
        acc[key] = value;
        return acc;
      }, {});
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(editingEmployee ? 'Karyawan berhasil diupdate' : 'Karyawan berhasil ditambahkan');
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        const errorMessage = typeof error.detail === 'string'
          ? error.detail
          : Array.isArray(error.detail)
            ? error.detail.map(err => err.msg || JSON.stringify(err)).join(', ')
            : JSON.stringify(error.detail);
        toast.error(errorMessage || 'Gagal menyimpan data karyawan');
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
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

          {/* Actions */}
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
