import React from 'react';

const EmployeeDetailModal = ({ isOpen, onClose, employee, canAccessFinancial }) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Detail Karyawan</h2>
              <p className="text-sm text-gray-500">{employee.position || '-'} - {employee.department || '-'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
            >
              Tutup
            </button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Nama</h3>
                <p className="text-gray-900">{employee.name || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Email</h3>
                <p className="text-gray-900">{employee.email || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Telepon</h3>
                <p className="text-gray-900">{employee.phone || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">NIK</h3>
                <p className="text-gray-900">{employee.nik || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Alamat</h3>
                <p className="text-gray-900">{employee.address || '-'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Status</h3>
                <p className="text-gray-900">{employee.status === 'active' ? 'Aktif' : 'Nonaktif'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Tipe Pekerjaan</h3>
                <p className="text-gray-900">{employee.employment_type || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Tanggal Masuk</h3>
                <p className="text-gray-900">{employee.join_date || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Jenis Kelamin</h3>
                <p className="text-gray-900">{employee.gender || '-'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600">Status Pernikahan</h3>
                <p className="text-gray-900">{employee.marital_status || '-'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600">Kontak Darurat</h3>
              <p className="text-gray-900">{employee.emergency_contact_name || '-'} ({employee.emergency_contact_relation || '-'})</p>
              <p className="text-gray-900">{employee.emergency_contact_phone || '-'}</p>
            </div>
            {canAccessFinancial && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-600">Data Finansial</h3>
                <p className="text-gray-900">Gaji/Hari: {employee.daily_salary ? `Rp ${parseFloat(employee.daily_salary).toLocaleString('id-ID')}` : '-'}</p>
                <p className="text-gray-900">Saldo Pinjaman: {employee.loan_balance ? `Rp ${parseFloat(employee.loan_balance).toLocaleString('id-ID')}` : '-'}</p>
                <p className="text-gray-900">Bank: {employee.bank_name || '-'}</p>
                <p className="text-gray-900">No. Rekening: {employee.bank_account_number || '-'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailModal;
