import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { useProjectHaulingPrices, useSetProjectHaulingPrice, useUpdateProjectHaulingPrice, useDeleteProjectHaulingPrice } from '../hooks/useHauling';
import { X, Loader2, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from './CustomSelect';

interface HaulingPricesModalProps {
  projectId: number;
  projectName: string;
  onClose: () => void;
}

export default function HaulingPricesModal({ projectId, projectName, onClose }: HaulingPricesModalProps) {
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
  const [pricePerUnit, setPricePerUnit] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleSave = () => {
    if (!selectedVendor) {
      toast.error('Pilih vendor atau opsi Global terlebih dahulu');
      return;
    }
    if (pricePerUnit === '') {
      toast.error('Masukkan harga per unit');
      return;
    }
    
    const payload = {
      project_id: projectId,
      vendor_id: selectedVendor === 'global' ? null : Number(selectedVendor),
      price_per_unit: parseFloat(pricePerUnit),
      effective_date: effectiveDate
    };

    if (editingPriceId) {
      updatePriceMutation.mutate({
        projectId,
        priceId: editingPriceId,
        data: payload
      }, {
        onSuccess: () => {
          toast.success('Harga berhasil diperbarui');
          setSelectedVendor('');
          setPricePerUnit('');
          setEditingPriceId(null);
        },
        onError: () => toast.error('Gagal memperbarui harga')
      });
    } else {
      setPriceMutation.mutate({
        projectId,
        data: payload
      }, {
        onSuccess: () => {
          toast.success('Harga berhasil disetel');
          setSelectedVendor('');
          setPricePerUnit('');
        },
        onError: () => toast.error('Gagal menyetel harga')
      });
    }
  };

  const handleEdit = (p: any) => {
    setEditingPriceId(p.id);
    setSelectedVendor(p.vendor_id === null ? 'global' : p.vendor_id);
    setPricePerUnit(p.price_per_unit.toString());
    setEffectiveDate(p.effective_date ? new Date(p.effective_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  };

  const handleDelete = (id: number) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = () => {
    if (confirmDelete) {
      deletePriceMutation.mutate({ projectId, priceId: confirmDelete }, {
        onSuccess: () => {
          toast.success('Harga berhasil dihapus');
          setConfirmDelete(null);
        },
        onError: () => {
          toast.error('Gagal menghapus harga');
          setConfirmDelete(null);
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Harga Hauling - {projectName}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Armada</label>
              <CustomSelect 
                value={selectedVendor}
                onChange={val => setSelectedVendor(val === 'global' ? 'global' : Number(val) || '')}
                options={[
                  { value: "", label: "-- Pilih Vendor --" },
                  { value: "global", label: <span className="font-bold text-blue-600">Global (Semua Vendor)</span> },
                  ...(vendors?.map((v: any) => ({ value: v.id, label: v.name })) || [])
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
              <input 
                type="text" className="w-full border p-2 rounded"
                value={pricePerUnit ? Number(pricePerUnit).toLocaleString('id-ID') : ''}
                onChange={e => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setPricePerUnit(rawValue);
                }}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mulai Berlaku</label>
              <input 
                type="date" className="w-full border p-2 rounded"
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
              />
            </div>
              <button 
                className="col-span-2 bg-blue-600 text-white p-2 rounded flex items-center justify-center gap-2"
                onClick={handleSave}
                disabled={setPriceMutation.isPending || updatePriceMutation.isPending}
              >
                {(setPriceMutation.isPending || updatePriceMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                {editingPriceId ? 'Simpan Perubahan' : 'Set Harga'}
              </button>
              {editingPriceId && (
                <button 
                  className="col-span-2 bg-gray-100 text-gray-700 p-2 rounded flex items-center justify-center gap-2"
                  onClick={() => {
                    setEditingPriceId(null);
                    setSelectedVendor('');
                    setPricePerUnit('');
                  }}
                >
                  Batal Edit
                </button>
              )}
          </div>

          <h3 className="font-semibold text-lg mb-2">Harga yang Tersimpan</h3>
          {isLoading ? <p>Loading...</p> : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mulai Berlaku</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prices?.map((p: any) => {
                  const vendor = vendors?.find((v: any) => v.id === p.vendor_id);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2">
                        {p.vendor_id === null ? <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-bold">Global</span> : (vendor?.name || 'Unknown')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {p.effective_date ? new Date(p.effective_date).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-green-600 font-bold">
                        Rp {Number(p.price_per_unit).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2 text-right flex justify-end gap-2">
                        <button onClick={() => handleEdit(p)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 bg-red-50 p-1.5 rounded">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {prices?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-2 text-center text-gray-500">Belum ada harga diset.</td></tr>
                )}
              </tbody>
            </table>
          )}
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
            <p className="text-gray-500 mb-6">Apakah Anda yakin ingin menghapus harga ini? Semua surat jalan yang terikat akan dikalkulasi ulang.</p>
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
                {deletePriceMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
