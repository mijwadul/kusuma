import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/apiClient';
import { X, Loader2, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '../CustomSelect';

interface LoadingPricesModalProps {
  projectId: number;
  projectName: string;
  onClose: () => void;
}

export default function LoadingPricesModal({ projectId, projectName, onClose }: LoadingPricesModalProps) {
  const queryClient = useQueryClient();
  
  const { data: prices, isLoading } = useQuery({
    queryKey: ['projectLoadingPrices', projectId],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${projectId}/loading-prices`);
      return res.data;
    }
  });

  const setPriceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/projects/${projectId}/loading-prices`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projectLoadingPrices', projectId] })
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ priceId, data }: { priceId: number, data: any }) => {
      const res = await apiClient.put(`/projects/${projectId}/loading-prices/${priceId}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projectLoadingPrices', projectId] })
  });

  const deletePriceMutation = useMutation({
    mutationFn: async (priceId: number) => {
      const res = await apiClient.delete(`/projects/${projectId}/loading-prices/${priceId}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projectLoadingPrices', projectId] })
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'jasa_loading'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors?type=jasa_loading');
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
      toast.error('Masukkan harga per ritase');
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
      setPriceMutation.mutate(payload, {
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
      deletePriceMutation.mutate(confirmDelete, {
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

  const vendorOptions = [
    { value: 'global', label: 'Global (Semua Vendor Default)' },
    ...(vendors?.map((v: any) => ({
      value: v.id,
      label: v.name
    })) || [])
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Konfigurasi Harga Jasa Loading</h3>
            <p className="text-sm text-gray-500 mt-1">Proyek: <span className="font-semibold text-gray-700">{projectName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Form */}
          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 mb-8">
            <h4 className="font-semibold text-blue-900 mb-4">{editingPriceId ? 'Edit Harga' : 'Set Harga Baru'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor Jasa Loading</label>
                <CustomSelect
                  options={vendorOptions}
                  value={selectedVendor}
                  onChange={(val: any) => setSelectedVendor(val as number | 'global')}
                  placeholder="Pilih vendor..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Berlaku Sejak (Tgl Surat Jalan)</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-[38px] px-3 border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Harga per Ritase (Rp)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className="w-full pl-10 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-[38px] border"
                    placeholder="Contoh: 15000"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              {editingPriceId && (
                <button
                  onClick={() => {
                    setEditingPriceId(null);
                    setSelectedVendor('');
                    setPricePerUnit('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal Edit
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={setPriceMutation.isPending || updatePriceMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(setPriceMutation.isPending || updatePriceMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                {editingPriceId ? 'Update Harga' : 'Simpan Harga'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Riwayat Konfigurasi Harga</h4>
            
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : !prices || prices.length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-xl border-gray-300 bg-gray-50 text-gray-500 text-sm">
                Belum ada konfigurasi harga jasa loading untuk proyek ini.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-600">Vendor</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Berlaku Mulai</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Harga / Rit</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {prices.map((p: any) => {
                      const vName = p.vendor_id ? vendors?.find((v:any) => v.id === p.vendor_id)?.name || 'Vendor Terhapus' : 'Global (Semua Vendor)';
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {p.vendor_id ? vName : <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">Global</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{new Date(p.effective_date).toLocaleDateString('id-ID')}</td>
                          <td className="px-4 py-3 font-medium text-emerald-600">
                            Rp {Number(p.price_per_unit).toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleEdit(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                                <Trash2 size={16} />
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

      {/* Confirm Delete Modal */}
      {confirmDelete && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-[70] flex items-center justify-center p-4">
           <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
             <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
               <AlertTriangle className="h-6 w-6 text-red-600" />
             </div>
             <h3 className="text-lg font-bold mb-2 text-gray-900">Hapus Harga Jasa Loading</h3>
             <p className="text-sm text-gray-600 mb-6">Yakin ingin menghapus konfigurasi harga ini? Data yang terlanjur terhitung tidak akan berubah secara otomatis kecuali diedit ulang.</p>
             <div className="flex justify-center gap-3">
               <button onClick={() => setConfirmDelete(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors">Batal</button>
               <button onClick={confirmDeleteAction} disabled={deletePriceMutation.isPending} className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                 {deletePriceMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                 Ya, Hapus
               </button>
             </div>
           </div>
         </div>
      )}
    </div>
  );
}
