import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { useProjectHaulingPrices, useSetProjectHaulingPrice, useUpdateProjectHaulingPrice, useDeleteProjectHaulingPrice } from '../hooks/useHauling';
import { X, Loader2, Edit2, Trash2, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from './CustomSelect';

interface HaulingPricesModalProps {
  projectId: number;
  projectName: string;
  measurementType?: string; // 'tonase' | 'kubikasi'
  onClose: () => void;
}

const formatIDR = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

const unitLabel = (mt?: string) => mt === 'kubikasi' ? 'm³' : mt === 'ritase' ? 'rit' : 'ton';

export default function HaulingPricesModal({ projectId, projectName, measurementType, onClose }: HaulingPricesModalProps) {
  const { data: prices, isLoading } = useProjectHaulingPrices(projectId);
  const setPriceMutation = useSetProjectHaulingPrice();
  const updatePriceMutation = useUpdateProjectHaulingPrice();
  const deletePriceMutation = useDeleteProjectHaulingPrice();

  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'hauling'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors?type=hauling');
      return res.data;
    }
  });

  const [selectedVendor, setSelectedVendor] = useState<number | 'global' | ''>('');
  const [vehicleType, setVehicleType] = useState<string>('');
  const [pricePerUnit, setPricePerUnit] = useState<string>('');
  const [materialDeduction, setMaterialDeduction] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const unit = unitLabel(measurementType);

  const resetForm = () => {
    setSelectedVendor('');
    setVehicleType('');
    setPricePerUnit('');
    setMaterialDeduction('');
    setEditingPriceId(null);
  };

  const handleSave = () => {
    if (!selectedVendor) {
      toast.error('Pilih vendor atau opsi Global terlebih dahulu');
      return;
    }
    if (pricePerUnit === '') {
      toast.error('Masukkan harga hauling per unit');
      return;
    }

    const payload = {
      project_id: projectId,
      vendor_id: selectedVendor === 'global' ? null : Number(selectedVendor),
      vehicle_type: vehicleType || null,
      price_per_unit: parseFloat(pricePerUnit),
      material_deduction_per_rit: parseFloat(materialDeduction || '0'),
      effective_date: effectiveDate
    };

    if (editingPriceId) {
      updatePriceMutation.mutate(
        { projectId, priceId: editingPriceId, data: payload },
        {
          onSuccess: () => { toast.success('Harga berhasil diperbarui'); resetForm(); },
          onError: () => toast.error('Gagal memperbarui harga')
        }
      );
    } else {
      setPriceMutation.mutate(
        { projectId, data: payload },
        {
          onSuccess: () => { toast.success('Harga berhasil disimpan'); resetForm(); },
          onError: () => toast.error('Gagal menyimpan harga')
        }
      );
    }
  };

  const handleEdit = (p: any) => {
    setEditingPriceId(p.id);
    setSelectedVendor(p.vendor_id === null ? 'global' : p.vendor_id);
    setVehicleType(p.vehicle_type || '');
    setPricePerUnit(p.price_per_unit.toString());
    setMaterialDeduction((p.material_deduction_per_rit ?? 0).toString());
    setEffectiveDate(p.effective_date ? new Date(p.effective_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  };

  const confirmDeleteAction = () => {
    if (!confirmDelete) return;
    deletePriceMutation.mutate(
      { projectId, priceId: confirmDelete },
      {
        onSuccess: () => { toast.success('Harga berhasil dihapus'); setConfirmDelete(null); },
        onError: () => { toast.error('Gagal menghapus harga'); setConfirmDelete(null); }
      }
    );
  };

  const netPreview = parseFloat(pricePerUnit || '0');
  const deductionPreview = parseFloat(materialDeduction || '0');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Harga Hauling &amp; Potongan Material</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {projectName}
              {measurementType && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold uppercase">
                  {measurementType}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Form input */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">
              {editingPriceId ? '✏️ Edit Harga' : '+ Tambah / Set Harga'}
            </h3>

            {/* Vendor selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Armada</label>
              <CustomSelect
                value={selectedVendor}
                onChange={val => setSelectedVendor(val === 'global' ? 'global' : Number(val) || '')}
                options={[
                  { value: '', label: '-- Pilih Vendor --' },
                  { value: 'global', label: <span className="font-bold text-blue-600">Global (Semua Vendor)</span> },
                  ...(vendors?.map((v: any) => ({ value: v.id, label: v.name })) || [])
                ]}
              />
            </div>

            {/* Tipe Kendaraan (hanya untuk Ritase) */}
            {measurementType === 'ritase' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Kendaraan</label>
                <CustomSelect
                  value={vehicleType}
                  onChange={val => setVehicleType(val as string)}
                  options={[
                    { value: '', label: '-- Semua Tipe Kendaraan (Global) --' },
                    { value: 'colt_diesel', label: 'Colt Diesel' },
                    { value: 'tronton', label: 'Tronton' }
                  ]}
                />
              </div>
            )}

            {/* Harga + Potongan side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga Hauling (Rp/{unit})
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 85.000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  value={pricePerUnit ? Number(pricePerUnit).toLocaleString('id-ID') : ''}
                  onChange={e => setPricePerUnit(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-gray-400 mt-1">Dihitung {unit === 'rit' ? 'flat per ritase' : `× ${unit === 'm³' ? 'kubikasi (m³)' : 'tonase (ton)'}`}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Potongan Material (Rp/ritase)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 150.000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  value={materialDeduction ? Number(materialDeduction).toLocaleString('id-ID') : ''}
                  onChange={e => setMaterialDeduction(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-gray-400 mt-1">Dipotong flat per perjalanan (rit)</p>
              </div>
            </div>

            {/* Preview formula */}
            {(pricePerUnit || materialDeduction) && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-sm">
                <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                <span className="text-blue-700">
                  Tagihan per SJ = {unit === 'rit' ? (
                    <><strong>{formatIDR(netPreview)}</strong>/rit</>
                  ) : (
                    <>(<strong>{formatIDR(netPreview)}</strong> × {unit === 'm³' ? 'kubikasi' : 'tonase'})</>
                  )} − <strong>{formatIDR(deductionPreview)}</strong>/rit
                </span>
              </div>
            )}

            {/* Berlaku mulai */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Berlaku Mulai</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {editingPriceId && (
                <button
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
                  onClick={resetForm}
                >
                  Batal Edit
                </button>
              )}
              <button
                className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                onClick={handleSave}
                disabled={setPriceMutation.isPending || updatePriceMutation.isPending}
              >
                {(setPriceMutation.isPending || updatePriceMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                {editingPriceId ? 'Simpan Perubahan' : 'Set Harga'}
              </button>
            </div>
          </div>

          {/* Tabel harga tersimpan */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Harga yang Tersimpan</h3>
            {isLoading ? (
              <div className="text-center py-6 text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Berlaku</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                        Hauling/{unit}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                        Pot.Material/rit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-50">
                    {(!prices || prices.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada harga diset.</td>
                      </tr>
                    )}
                    {prices?.map((p: any) => {
                      const vendor = vendors?.find((v: any) => v.id === p.vendor_id);
                      const deduction = Number(p.material_deduction_per_rit ?? 0);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.vendor_id === null
                                ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">Global</span>
                                : (vendor?.name || 'Unknown')}
                              {p.vehicle_type && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                                  {p.vehicle_type === 'colt_diesel' ? 'Colt Diesel' : p.vehicle_type === 'tronton' ? 'Tronton' : p.vehicle_type}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {p.effective_date ? new Date(p.effective_date).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                            {formatIDR(p.price_per_unit)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {deduction > 0
                              ? <span className="font-semibold text-amber-600">{formatIDR(deduction)}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleEdit(p)}
                                className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(p.id)}
                                className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center shadow-xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Hapus Harga Hauling</h3>
            <p className="text-gray-500 mb-6">
              Hapus harga ini? Semua surat jalan yang terikat akan dikalkulasi ulang.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                onClick={() => setConfirmDelete(null)}
              >
                Batal
              </button>
              <button
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
                onClick={confirmDeleteAction}
                disabled={deletePriceMutation.isPending}
              >
                {deletePriceMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

