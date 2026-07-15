import React from 'react';
import { X, Save } from 'lucide-react';
import CustomSelect from '../CustomSelect';
import { formatNopol, formatTitleCase } from '../../utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  truckData: {
    nopol: string;
    supir_default: string;
    tipe_truk: string;
    panjang: number | null;
    lebar: number | null;
    tinggi: number | null;
  };
  setTruckData: (data: any) => void;
  isEditing: boolean;
  isPending: boolean;
}

export default function HaulingTruckFormModal({
  isOpen,
  onClose,
  onSubmit,
  truckData,
  setTruckData,
  isEditing,
  isPending
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{isEditing ? "Edit Armada Truk" : "Tambah Armada Truk"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nopol (Nomor Polisi) <span className="text-red-500">*</span></label>
              <input required value={truckData.nopol} onChange={e=>setTruckData({...truckData, nopol: formatNopol(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none uppercase font-bold" placeholder="B 1234 CD" />
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipe Truk</label>
              <CustomSelect
                value={truckData.tipe_truk}
                onChange={(val) => setTruckData({...truckData, tipe_truk: val as string})}
                options={[
                  { value: "tronton", label: "Tronton" },
                  { value: "colt_diesel", label: "Colt Diesel" }
                ]}
              />
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Supir (Default)</label>
            <input value={truckData.supir_default} onChange={e=>setTruckData({...truckData, supir_default: formatTitleCase(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none" placeholder="Contoh: Budi" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ukuran Bak (Meter) - Opsional</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500">Panjang</label>
                <input type="number" step="0.01" value={truckData.panjang === null ? '' : truckData.panjang} onChange={e=>setTruckData({...truckData, panjang: e.target.value === '' ? null : parseFloat(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Lebar</label>
                <input type="number" step="0.01" value={truckData.lebar === null ? '' : truckData.lebar} onChange={e=>setTruckData({...truckData, lebar: e.target.value === '' ? null : parseFloat(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Tinggi</label>
                <input type="number" step="0.01" value={truckData.tinggi === null ? '' : truckData.tinggi} onChange={e=>setTruckData({...truckData, tinggi: e.target.value === '' ? null : parseFloat(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none" />
              </div>
            </div>
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
