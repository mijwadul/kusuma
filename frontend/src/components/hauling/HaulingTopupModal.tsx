import React from 'react';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/apiClient';
import CustomSelect from '../CustomSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  topupData: {
    amount: string;
    notes: string;
    topup_date: string;
    truck_id: string | number;
  };
  setTopupData: (data: any) => void;
  isEditing: boolean;
  isPending: boolean;
  trucksForTopup: any[];
}

export default function HaulingTopupModal({
  isOpen,
  onClose,
  onSubmit,
  topupData,
  setTopupData,
  isEditing,
  isPending,
  trucksForTopup
}: Props) {
  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setTopupData({ ...topupData, amount: rawValue });
  };

  const handleAIExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading("Mengekstrak data struk dengan AI...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await apiClient.post("/vision/extract-receipt", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setTopupData((prev: any) => ({
        ...prev,
        amount: data.amount ? String(data.amount) : prev.amount,
        notes: data.notes || prev.notes
      }));
      toast.success("Data berhasil diekstrak!", { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Gagal mengekstrak data dari gambar", { id: toastId });
    }
    e.target.value = ''; // Reset input
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">{isEditing ? "Edit Deposit Vendor" : "Tambah Deposit Vendor"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
        </div>
        
        <div className="mb-4 p-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg text-center">
          <p className="text-sm text-blue-800 font-medium mb-2">Auto-fill dengan AI (Upload Struk Transfer)</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleAIExtract}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Armada (Opsional)</label>
            <CustomSelect
              value={String(topupData.truck_id || '')}
              onChange={(val) => setTopupData({...topupData, truck_id: val as string})}
              options={[
                { value: "", label: "-- Deposit Global (Semua Armada) --" },
                ...trucksForTopup.map((t: any) => ({
                  value: String(t.id),
                  label: t.nopol
                }))
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Deposit (Rp) <span className="text-red-500">*</span></label>
            <input required type="text" value={topupData.amount ? Number(topupData.amount).toLocaleString('id-ID') : ''} onChange={handleAmountChange} className="w-full border rounded p-2 focus:ring-2 focus:ring-emerald-300 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Deposit</label>
            <input required type="date" value={topupData.topup_date} onChange={e=>setTopupData({...topupData, topup_date: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-emerald-300 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea value={topupData.notes} onChange={e=>setTopupData({...topupData, notes: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-emerald-300 outline-none" rows={3} placeholder="Contoh: DP Hauling Proyek X" />
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Batal</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2">
              <Save size={16} /> Simpan Deposit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
