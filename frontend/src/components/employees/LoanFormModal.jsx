import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

const LoanFormModal = ({ isOpen, onClose, employee, editingLoan, onSuccess }) => {
  const [loanForm, setLoanForm] = useState({
    nominal: '',
    loan_date: '',
    deduction_per_period: '',
    notes: ''
  });

  useEffect(() => {
    if (editingLoan) {
      setLoanForm({
        nominal: editingLoan.nominal.toString(),
        loan_date: editingLoan.loan_date,
        deduction_per_period: editingLoan.deduction_per_period?.toString() || '',
        notes: editingLoan.notes || ''
      });
    } else {
      setLoanForm({
        nominal: '',
        loan_date: '',
        deduction_per_period: '',
        notes: ''
      });
    }
  }, [editingLoan]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employee || !loanForm.nominal || !loanForm.loan_date) {
      toast.error('Nominal dan tanggal pinjam harus diisi');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingLoan 
        ? `/api/v1/employees/loans/${editingLoan.id}`
        : `/api/v1/employees/loans?employee_id=${employee.id}`;
      
      const method = editingLoan ? 'PUT' : 'POST';
      
      const formData = {
        nominal: parseFloat(loanForm.nominal),
        loan_date: loanForm.loan_date,
        deduction_per_period: loanForm.deduction_per_period ? parseFloat(loanForm.deduction_per_period) : 0,
        notes: loanForm.notes || null
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(editingLoan ? 'Pinjaman berhasil diupdate' : 'Pinjaman berhasil ditambahkan');
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Gagal menyimpan pinjaman');
      }
    } catch (error) {
      console.error('Error saving loan:', error);
      toast.error('Terjadi kesalahan saat menyimpan');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">
            {editingLoan ? 'Edit Pinjaman' : 'Tambah Pinjaman'}
          </h2>
          <p className="text-sm text-gray-500">{employee?.name} - {employee?.position}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Pinjaman (Rp) *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={loanForm.nominal}
                onChange={(e) => setLoanForm({...loanForm, nominal: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Masukkan nominal pinjaman"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pinjam *</label>
              <input
                type="date"
                required
                value={loanForm.loan_date}
                onChange={(e) => setLoanForm({...loanForm, loan_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Potongan per Periode (Rp)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loanForm.deduction_per_period}
                onChange={(e) => setLoanForm({...loanForm, deduction_per_period: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Optional - Masukkan jumlah potongan per periode"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <textarea
                value={loanForm.notes}
                onChange={(e) => setLoanForm({...loanForm, notes: e.target.value})}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Catatan atau alasan pinjaman"
              />
            </div>
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
              {editingLoan ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoanFormModal;
