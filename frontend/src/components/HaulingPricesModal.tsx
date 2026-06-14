import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { useProjectHaulingPrices, useSetProjectHaulingPrice } from '../hooks/useHauling';
import { X, Loader2 } from 'lucide-react';

interface HaulingPricesModalProps {
  projectId: number;
  projectName: string;
  onClose: () => void;
}

export default function HaulingPricesModal({ projectId, projectName, onClose }: HaulingPricesModalProps) {
  const { data: prices, isLoading } = useProjectHaulingPrices(projectId);
  const setPriceMutation = useSetProjectHaulingPrice();

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors');
      return res.data;
    }
  });

  const [selectedVendor, setSelectedVendor] = useState<number | ''>('');
  const [pricePerUnit, setPricePerUnit] = useState<number | ''>('');

  const handleSave = () => {
    if (!selectedVendor || pricePerUnit === '') return;
    setPriceMutation.mutate({
      projectId,
      data: {
        vendor_id: selectedVendor,
        price_per_unit: pricePerUnit
      }
    }, {
      onSuccess: () => {
        setSelectedVendor('');
        setPricePerUnit('');
      }
    });
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
              <select 
                className="w-full border p-2 rounded"
                value={selectedVendor}
                onChange={e => setSelectedVendor(Number(e.target.value) || '')}
              >
                <option value="">-- Pilih Vendor --</option>
                {vendors?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
              <input 
                type="number" className="w-full border p-2 rounded"
                value={pricePerUnit}
                onChange={e => setPricePerUnit(parseFloat(e.target.value))}
              />
            </div>
            <button 
              className="col-span-2 bg-blue-600 text-white p-2 rounded flex items-center justify-center gap-2"
              onClick={handleSave}
              disabled={setPriceMutation.isPending}
            >
              {setPriceMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Set Harga
            </button>
          </div>

          <h3 className="font-semibold text-lg mb-2">Harga yang Tersimpan</h3>
          {isLoading ? <p>Loading...</p> : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prices?.map((p: any) => {
                  const vendor = vendors?.find((v: any) => v.id === p.vendor_id);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2">{vendor?.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-bold">
                        Rp {Number(p.price_per_unit).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
                {prices?.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-2 text-center text-gray-500">Belum ada harga diset.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
