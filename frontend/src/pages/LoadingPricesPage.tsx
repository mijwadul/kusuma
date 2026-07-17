import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useLoadingPrices, LoadingPriceFormData, LoadingPrice } from '../hooks/useLoadingPrices';
import { useProjectsList, Project } from '../hooks/useProjects';
import { useVendors } from '../hooks/useVendors';

export default function LoadingPricesPage() {
  const { prices, isLoading, createPrice, updatePrice, deletePrice } = useLoadingPrices();
  const { data: projects = [] } = useProjectsList();
  const { data: vendors = [] } = useVendors('jasa_loading');

  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<LoadingPrice | null>(null);
  const [viewPriceId, setViewPriceId] = useState<number | null>(null);
  const viewPrice = prices.find(p => p.id === viewPriceId);
  
  const [formData, setFormData] = useState<LoadingPriceFormData>({
    project_id: null,
    vendor_id: null,
    unit_type: 'tonase',
    price: 0,
    effective_date: new Date().toISOString().split('T')[0]
  });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: 0 });

  const resetForm = () => {
    setFormData({
      project_id: null,
      vendor_id: null,
      unit_type: 'tonase',
      price: 0,
      effective_date: new Date().toISOString().split('T')[0]
    });
    setEditingPrice(null);
    setShowForm(false);
  };

  const handleEdit = (price: LoadingPrice) => {
    setEditingPrice(price);
    setFormData({
      project_id: price.project_id,
      vendor_id: price.vendor_id,
      unit_type: price.unit_type,
      price: price.price,
      effective_date: price.effective_date.split('T')[0]
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPrice) {
      updatePrice({ id: editingPrice.id, data: formData }, {
        onSuccess: () => {
          toast.success('Harga Loading diperbarui!');
          resetForm();
        },
        onError: () => toast.error('Gagal memperbarui harga')
      });
    } else {
      createPrice(formData, {
        onSuccess: () => {
          toast.success('Harga Loading ditambahkan!');
          resetForm();
        },
        onError: () => toast.error('Gagal menambahkan harga')
      });
    }
  };

  const handleDelete = (id: number) => {
    deletePrice(id, {
      onSuccess: () => {
        toast.success('Harga dihapus');
        setConfirmModal({ isOpen: false, id: 0 });
      },
      onError: () => toast.error('Gagal menghapus harga')
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  };

  const getUnitName = (unit: string) => {
    switch (unit) {
      case 'rit_tronton': return 'Ritase Tronton';
      case 'rit_colt_diesel': return 'Ritase Colt Diesel';
      case 'kubikasi': return 'Kubikasi (m3)';
      case 'tonase': return 'Tonase (Ton)';
      default: return unit;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Memuat data...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Master Harga Loading</h1>
          <p className="text-gray-500">Atur hierarki harga jasa loading untuk Global, Project, dan Vendor.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={20} /> Tambah Harga
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b whitespace-nowrap">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs">Prioritas / Tipe</th>
                <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs">Project</th>
                <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs">Vendor</th>
                <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs">Satuan</th>
                <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs">Harga</th>
                <th className="px-6 py-4 font-semibold text-gray-500 uppercase tracking-wider text-xs">Tanggal Efektif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {prices.map((p: LoadingPrice) => {
                const isVendorProject = p.project_id && p.vendor_id;
                const isProject = p.project_id && !p.vendor_id;
                const isVendor = !p.project_id && p.vendor_id;

                let priorityLabel = "";
                let priorityColor = "";

                if (isVendorProject) { priorityLabel = "Prioritas 1 (Spesifik)"; priorityColor = "bg-red-50 text-red-600 border-red-200"; }
                else if (isProject) { priorityLabel = "Prioritas 2 (Project)"; priorityColor = "bg-orange-50 text-orange-600 border-orange-200"; }
                else if (isVendor) { priorityLabel = "Prioritas 3 (Vendor)"; priorityColor = "bg-blue-50 text-blue-600 border-blue-200"; }
                else { priorityLabel = "Prioritas 4 (Global Default)"; priorityColor = "bg-emerald-50 text-emerald-600 border-emerald-200"; }

                return (
                  <tr key={p.id} onClick={() => setViewPriceId(p.id)} className="hover:bg-blue-50/60 cursor-pointer transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${priorityColor}`}>
                        {priorityLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">
                      {p.project_id ? projects.find((prj: Project) => prj.id === p.project_id)?.name || 'Project Terhapus' : <span className="text-gray-400 italic font-normal">Global (Semua Project)</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium whitespace-nowrap">
                      {p.vendor_id ? vendors.find((v: any) => v.id === p.vendor_id)?.name || 'Vendor Terhapus' : <span className="text-gray-400 italic font-normal">Semua Vendor/Alat Internal</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{getUnitName(p.unit_type)}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(p.price)}</td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{new Date(p.effective_date).toLocaleDateString('id-ID')}</td>
                  </tr>
                );
              })}
              {prices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Belum ada pengaturan harga loading.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {viewPrice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Detail Harga Loading</h3>
              <button onClick={() => setViewPriceId(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Prioritas / Tipe</p>
                  <p className="font-semibold text-gray-900">
                    {viewPrice.project_id && viewPrice.vendor_id ? "Prioritas 1 (Spesifik)" :
                     viewPrice.project_id ? "Prioritas 2 (Project)" :
                     viewPrice.vendor_id ? "Prioritas 3 (Vendor)" :
                     "Prioritas 4 (Global Default)"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tanggal Efektif</p>
                  <p className="font-semibold text-gray-900">{new Date(viewPrice.effective_date).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Project</p>
                  <p className="font-semibold text-gray-900">
                    {viewPrice.project_id ? projects.find((prj: Project) => prj.id === viewPrice.project_id)?.name || 'Project Terhapus' : 'Global (Semua Project)'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-semibold text-gray-900">
                    {viewPrice.vendor_id ? vendors.find((v: any) => v.id === viewPrice.vendor_id)?.name || 'Vendor Terhapus' : 'Alat Internal & Semua Vendor'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Satuan Pengukuran</p>
                  <p className="font-semibold text-gray-900">{getUnitName(viewPrice.unit_type)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Harga (Rp)</p>
                  <p className="font-bold text-emerald-600 text-lg">{formatCurrency(viewPrice.price)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    handleEdit(viewPrice);
                    setViewPriceId(null);
                  }}
                  className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Edit size={16} /> Edit
                </button>
                <button
                  onClick={() => {
                    setViewPriceId(null);
                    setConfirmModal({ isOpen: true, id: viewPrice.id });
                  }}
                  className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> Hapus
                </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {editingPrice ? 'Edit Harga Loading' : 'Tambah Harga Loading'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Berlaku di Project</label>
                <select
                  value={formData.project_id || ''}
                  onChange={e => setFormData({ ...formData, project_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
                >
                  <option value="">-- Semua Project (Global) --</option>
                  {projects.map((p: Project) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Kosongkan jika ingin berlaku secara Global.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Berlaku untuk Vendor</label>
                <select
                  value={formData.vendor_id || ''}
                  onChange={e => setFormData({ ...formData, vendor_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
                >
                  <option value="">-- Alat Internal & Semua Vendor --</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Kosongkan jika berlaku untuk alat berat internal / semua vendor.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Satuan Pengukuran</label>
                <select
                  value={formData.unit_type}
                  onChange={e => setFormData({ ...formData, unit_type: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
                  required
                >
                  <option value="rit_tronton">Ritase (Tronton)</option>
                  <option value="rit_colt_diesel">Ritase (Colt Diesel)</option>
                  <option value="tonase">Tonase (Per Ton)</option>
                  <option value="kubikasi">Kubikasi (Per m3)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Efektif</label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 border bg-white text-gray-900"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi Hapus Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Hapus Harga</h3>
            <p className="text-gray-500 mb-6 text-sm">Apakah Anda yakin ingin menghapus pengaturan harga ini?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, id: 0 })}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmModal.id)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
