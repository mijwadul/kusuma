import { Truck, Plus, Edit, Trash2 } from 'lucide-react';
import { useVendorTrucks } from '../../hooks/useHauling';

interface VendorTrucksListProps {
  vendorId: number;
  onAddTruck: (vendorId: number) => void;
  onEditTruck: (vendorId: number, truck: any) => void;
  onDeleteTruck: (truckId: number) => void;
}

export default function VendorTrucksList({ 
  vendorId, 
  onAddTruck, 
  onEditTruck, 
  onDeleteTruck 
}: VendorTrucksListProps) {
  const { data: trucks = [], isLoading } = useVendorTrucks(vendorId);

  if (isLoading) return <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading armada...</td>;

  return (
    <td colSpan={5} className="bg-slate-50 border-t border-slate-100 p-0">
      <div className="px-10 py-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            <Truck size={16} /> Daftar Armada
          </h4>
          <button
            onClick={() => onAddTruck(vendorId)}
            className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded flex items-center gap-1 font-bold"
          >
            <Plus size={14} /> Tambah Armada
          </button>
        </div>
        
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Nopol</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Supir (Default)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Tipe Truk</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Ukuran (P x L x T)</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trucks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-center text-gray-400 italic">Belum ada armada untuk vendor ini</td>
                </tr>
              ) : (
                trucks.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-bold text-gray-900">{t.nopol}</td>
                    <td className="px-4 py-2 text-gray-600">{t.supir_default || '-'}</td>
                    <td className="px-4 py-2 text-gray-600 capitalize">{t.tipe_truk.replace('_', ' ')}</td>
                    <td className="px-4 py-2 text-gray-600">{t.panjang} x {t.lebar} x {t.tinggi} m</td>
                    <td className="px-4 py-2 text-right">
                      <button 
                        onClick={() => onEditTruck(vendorId, t)} 
                        className="text-indigo-600 hover:text-indigo-900 px-2"
                      >
                        <Edit size={14}/>
                      </button>
                      <button onClick={() => onDeleteTruck(t.id)} className="text-red-600 hover:text-red-900 px-2">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </td>
  );
}
