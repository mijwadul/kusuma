import React from 'react';
import { X, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  vendorData: any;
  setVendorData: (data: any) => void;
  isEditing: boolean;
  isPending: boolean;
  setConfirmModal: (config: any) => void;
}

export default function HaulingVendorFormModal({
  isOpen,
  onClose,
  onSubmit,
  vendorData,
  setVendorData,
  isEditing,
  isPending,
  setConfirmModal
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{isEditing ? "Edit Vendor Hauling" : "Tambah Vendor Hauling"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Vendor <span className="text-red-500">*</span></label>
            <input required value={vendorData.name} onChange={e=>setVendorData({...vendorData, name: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Kontak Person</label>
            <input value={vendorData.contact_person} onChange={e=>setVendorData({...vendorData, contact_person: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon / WA</label>
            <input value={vendorData.phone} onChange={e=>setVendorData({...vendorData, phone: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <textarea value={vendorData.address} onChange={e=>setVendorData({...vendorData, address: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" rows={3} />
          </div>
          
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Potong Saldo Global?</label>
              <span className="text-xs text-gray-500">Jika deposit unit habis, talangi dengan global.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const newValue = !vendorData.allow_deposit_cascade;
                setConfirmModal({
                  isOpen: true,
                  title: "Konfirmasi Pengaturan",
                  message: `Apakah Anda yakin ingin ${newValue ? 'MENGAKTIFKAN' : 'MEMATIKAN'} fitur potong saldo global otomatis?`,
                  confirmText: newValue ? "Ya, Aktifkan" : "Ya, Matikan",
                  confirmColor: newValue ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-700",
                  onConfirm: () => {
                    setVendorData({...vendorData, allow_deposit_cascade: newValue});
                    setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "", confirmColor: "", onConfirm: () => {} });
                  }
                });
              }}
              className={`w-12 h-6 rounded-full relative transition-colors ${vendorData.allow_deposit_cascade ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${vendorData.allow_deposit_cascade ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors">Batal</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium flex items-center gap-2 shadow-sm transition-colors">
              <Save size={16} /> Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
