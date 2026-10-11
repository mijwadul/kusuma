import React, { useState } from 'react';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import CustomSelect from '../CustomSelect';
import {
  MaterialPrice,
  useCreateMaterialPrice,
  useUpdateMaterialPrice,
} from '../../hooks/useMaterialSales';
import { MATERIAL_TYPES, VEHICLE_TYPES } from './MaterialBadge';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300';

interface PriceFormModalProps {
  editData: MaterialPrice | null;
  onClose: () => void;
}

export default function PriceFormModal({ editData, onClose }: PriceFormModalProps) {
  const [form, setForm] = useState({
    material_type: editData?.material_type || 'Limestone (urugan)',
    unit: editData?.unit || 'ritase',
    vehicle_type: editData?.vehicle_type || '',
    price_per_unit: editData?.price_per_unit?.toString() || '',
    is_active: editData?.is_active ?? true,
    notes: editData?.notes || '',
  });

  const createMutation = useCreateMaterialPrice();
  const updateMutation = useUpdateMaterialPrice();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: Partial<MaterialPrice> = {
        ...form,
        vehicle_type: form.vehicle_type === '' ? undefined : form.vehicle_type,
        price_per_unit: parseFloat(form.price_per_unit),
      };
      if (editData) {
        await updateMutation.mutateAsync({ id: editData.id, data: body });
      } else {
        await createMutation.mutateAsync(body);
      }
      toast.success('Harga berhasil disimpan');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan harga');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{editData ? 'Edit Harga' : 'Tambah Harga'}</h2>
          <button onClick={onClose} className="p-2">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
              <CustomSelect
                value={form.material_type}
                onChange={(val) =>
                  setForm((p) => ({ ...p, material_type: val as string, unit: 'ritase' }))
                }
                options={MATERIAL_TYPES.map((m) => ({ value: m, label: m }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kendaraan</label>
              <CustomSelect
                value={form.vehicle_type}
                onChange={(val) => setForm((p) => ({ ...p, vehicle_type: val as string }))}
                options={[
                  { value: '', label: 'Semua Kendaraan' },
                  ...VEHICLE_TYPES.map((v) => ({ value: v, label: v })),
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Satuan</label>
              <CustomSelect
                value={form.unit}
                onChange={(val) => setForm((p) => ({ ...p, unit: val as string }))}
                options={[
                  { value: 'ritase', label: 'Ritase' },
                  { value: 'm3', label: 'Kubikasi (m³)' },
                  { value: 'ton', label: 'Tonase (ton)' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Harga / Satuan (Rp)
              </label>
              <input
                type="number"
                required
                min={0}
                placeholder="Contoh: 150000"
                value={form.price_per_unit}
                onChange={(e) => setForm((p) => ({ ...p, price_per_unit: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded text-emerald-600"
            />
            <label htmlFor="is_active" className="text-sm">
              Aktif
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-xl text-sm">
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-60"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />} Simpan Harga
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
