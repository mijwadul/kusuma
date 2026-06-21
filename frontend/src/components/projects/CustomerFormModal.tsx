import React from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Customer } from '../../hooks/useProjects';
import CustomSelect from '../CustomSelect';
import { formatNopol, formatTitleCase } from '../../utils/formatters';

interface CustomerFormModalProps {
  show: boolean;
  onClose: () => void;
  editDataCust: Customer | null;
  custForm: Partial<Customer>;
  setCustForm: React.Dispatch<React.SetStateAction<Partial<Customer>>>;
  meta: any;
  saveCustomer: (e: React.FormEvent) => void;
  isPending: boolean;
  addCustMaterial: () => void;
  updateCustMaterial: (idx: number, field: string, value: string) => void;
  removeCustMaterial: (idx: number) => void;
  addCustTruck: () => void;
  updateCustTruck: (idx: number, field: string, value: any) => void;
  removeCustTruck: (idx: number) => void;
}

export default function CustomerFormModal({
  show,
  onClose,
  editDataCust,
  custForm,
  setCustForm,
  meta,
  saveCustomer,
  isPending,
  addCustMaterial,
  updateCustMaterial,
  removeCustMaterial,
  addCustTruck,
  updateCustTruck,
  removeCustTruck
}: CustomerFormModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 whitespace-nowrap border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{editDataCust ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <form onSubmit={saveCustomer} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Nama Customer *</label>
              <input required value={custForm.name || ""} onChange={e => setCustForm(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Contoh: UD Maju" />
            </div>
            <div>
              <label className="block text-sm mb-1">Perusahaan</label>
              <input value={custForm.company || ""} onChange={e => setCustForm(p => ({...p, company: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm mb-1">Kontak Person</label>
              <input value={custForm.contact_person || ""} onChange={e => setCustForm(p => ({...p, contact_person: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm mb-1">No. HP / Telepon</label>
              <input value={custForm.phone || ""} onChange={e => setCustForm(p => ({...p, phone: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm mb-1">Alamat</label>
              <input value={custForm.address || ""} onChange={e => setCustForm(p => ({...p, address: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Preferensi Material (Kontinu)</h3>
              <button type="button" onClick={addCustMaterial} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                <Plus size={14}/> Tambah Preferensi
              </button>
            </div>
            {custForm.material_preferences?.map((m, idx) => (
              <div key={idx} className="flex items-end gap-2 mb-2 p-2 bg-gray-50 rounded border">
                <div className="flex-1">
                  <CustomSelect
                    value={m.material_type}
                    onChange={val => updateCustMaterial(idx, "material_type", val as string)}
                    options={(meta?.material_types || []).map((mt: string) => ({ value: mt, label: mt }))}
                  />
                </div>
                <div className="w-24">
                  <CustomSelect
                    value={m.unit}
                    onChange={val => updateCustMaterial(idx, "unit", val as string)}
                    options={(meta?.material_units?.[m.material_type] || meta?.all_units || []).map((u: string) => ({ value: u, label: u }))}
                  />
                </div>
                <div className="flex-1">
                  <CustomSelect
                    required
                    value={m.vehicle_type || "Tronton"}
                    onChange={val => updateCustMaterial(idx, "vehicle_type", val as string)}
                    options={[
                      { value: "Tronton", label: "Tronton" },
                      { value: "Colt Diesel", label: "Colt Diesel" }
                    ]}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1">Harga/Satuan (opsional)</label>
                  <input type="number" placeholder="Rp..." value={m.unit_price || ""} onChange={e => updateCustMaterial(idx, "unit_price", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                </div>
                <button type="button" onClick={() => removeCustMaterial(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded mb-0.5"><Trash2 size={14}/></button>
              </div>
            ))}
            {(!custForm.material_preferences || custForm.material_preferences.length === 0) && <p className="text-xs text-gray-400 italic">Tambahkan preferensi harga material jika ada.</p>}
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Armada Kendaraan (Opsional)</h3>
              <button type="button" onClick={addCustTruck} className="text-xs flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded">
                <Plus size={14}/> Tambah Kendaraan
              </button>
            </div>
            {custForm.trucks?.map((t, idx) => (
              <div key={idx} className="flex items-end gap-2 mb-2 p-2 bg-gray-50 rounded border flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs mb-1">Plat Nomor *</label>
                  <input type="text" required placeholder="Contoh: B 1234 CD" value={t.license_plate} onChange={e => updateCustTruck(idx, "license_plate", formatNopol(e.target.value))} className="w-full border rounded text-sm p-1.5 uppercase" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs mb-1">Nama Supir</label>
                  <input type="text" placeholder="Contoh: Budi" value={t.driver_name || ""} onChange={e => updateCustTruck(idx, "driver_name", formatTitleCase(e.target.value))} className="w-full border rounded text-sm p-1.5" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <CustomSelect
                    required
                    value={t.vehicle_type}
                    onChange={val => updateCustTruck(idx, "vehicle_type", val as string)}
                    options={[
                      { value: "Colt Diesel", label: "Colt Diesel" },
                      { value: "Tronton", label: "Tronton" }
                    ]}
                  />
                </div>
                <button type="button" onClick={() => removeCustTruck(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded mb-0.5"><Trash2 size={14}/></button>
              </div>
            ))}
            {(!custForm.trucks || custForm.trucks.length === 0) && <p className="text-xs text-gray-400 italic">Tambahkan data armada jika penjualan dikaitkan dengan nopol.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm">Batal</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2">
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Simpan Pelanggan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
