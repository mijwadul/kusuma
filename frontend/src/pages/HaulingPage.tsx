import React, { useState } from 'react';
import { toast } from 'sonner';
import { Truck, Plus, Edit, Trash2, ChevronDown, ChevronRight, Building2, Save, X } from 'lucide-react';
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, Vendor } from '../hooks/useVendors';
import { useVendorTrucks, useCreateVendorTruck, useUpdateVendorTruck, useDeleteVendorTruck } from '../hooks/useHauling';

export default function HaulingPage() {
  const [expandedVendors, setExpandedVendors] = useState<Record<number, boolean>>({});

  // Vendor State
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorData, setVendorData] = useState({ name: "", contact_person: "", phone: "", address: "", vendor_type: "hauling" });

  // Truck State
  const [showTruckForm, setShowTruckForm] = useState<{vendorId: number} | null>(null);
  const [editingTruck, setEditingTruck] = useState<any | null>(null);
  const [truckData, setTruckData] = useState<{
    nopol: string;
    supir_default: string;
    tipe_truk: string;
    panjang: number | null;
    lebar: number | null;
    tinggi: number | null;
  }>({
    nopol: '',
    supir_default: '',
    tipe_truk: 'tronton',
    panjang: null,
    lebar: null,
    tinggi: null
  });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const { data: vendors = [], isLoading: loadingVendors } = useVendors('hauling');
  
  const createVendorMut = useCreateVendor();
  const updateVendorMut = useUpdateVendor();
  const deleteVendorMut = useDeleteVendor();
  
  const createTruckMut = useCreateVendorTruck();
  const updateTruckMut = useUpdateVendorTruck();
  const deleteTruckMut = useDeleteVendorTruck();

  const toggleVendorExpand = (vendorId: number) => {
    setExpandedVendors(prev => ({ ...prev, [vendorId]: !prev[vendorId] }));
  };

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      updateVendorMut.mutate(
        { id: editingVendor.id, data: vendorData },
        {
          onSuccess: () => {
            toast.success("Vendor Hauling diperbarui!");
            setShowVendorForm(false);
          },
          onError: () => toast.error("Gagal memperbarui vendor hauling")
        }
      );
    } else {
      createVendorMut.mutate(
        vendorData,
        {
          onSuccess: () => {
            toast.success("Vendor Hauling ditambahkan!");
            setShowVendorForm(false);
          },
          onError: () => toast.error("Gagal menambahkan vendor hauling")
        }
      );
    }
  };

  const handleDeleteVendor = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Vendor Hauling",
      message: "Hapus vendor ini? Pastikan tidak ada armada yang terikat dan tidak ada surat jalan yang menggunakannya!",
      onConfirm: () => {
        deleteVendorMut.mutate(id, {
          onSuccess: () => toast.success("Vendor dihapus"),
          onError: () => toast.error("Gagal menghapus vendor"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} })
        });
      }
    });
  };

  const handleTruckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTruck) {
      updateTruckMut.mutate(
        { truckId: editingTruck.id, data: truckData },
        {
          onSuccess: () => {
            toast.success("Data Armada diperbarui!");
            setEditingTruck(null);
            setShowTruckForm(null);
          },
          onError: () => toast.error("Gagal memperbarui armada")
        }
      );
    } else if (showTruckForm) {
      createTruckMut.mutate(
        { vendorId: showTruckForm.vendorId, data: { ...truckData, vendor_id: showTruckForm.vendorId } },
        {
          onSuccess: () => {
            toast.success("Armada ditambahkan!");
            setShowTruckForm(null);
          },
          onError: () => toast.error("Gagal menambahkan armada")
        }
      );
    }
  };

  const handleDeleteTruck = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Armada",
      message: "Hapus armada truk ini? Data surat jalan yang terkait dengan truk ini tidak akan bisa diedit.",
      onConfirm: () => {
        deleteTruckMut.mutate(id, {
          onSuccess: () => toast.success("Armada dihapus"),
          onError: () => toast.error("Gagal menghapus armada"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} })
        });
      }
    });
  };

  // Komponen Helper untuk merender Truk per Vendor
  const VendorTrucksList = ({ vendorId }: { vendorId: number }) => {
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
              onClick={() => {
                setEditingTruck(null);
                setTruckData({ nopol: '', supir_default: '', tipe_truk: 'tronton', panjang: null, lebar: null, tinggi: null });
                setShowTruckForm({ vendorId });
              }}
              className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded flex items-center gap-1 font-bold"
            >
              <Plus size={14} /> Tambah Armada
            </button>
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
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
                          onClick={() => {
                            setEditingTruck(t);
                            setTruckData({ 
                              nopol: t.nopol, supir_default: t.supir_default || '', 
                              tipe_truk: t.tipe_truk, panjang: t.panjang ?? null, lebar: t.lebar ?? null, tinggi: t.tinggi ?? null 
                            });
                            setShowTruckForm({ vendorId });
                          }} 
                          className="text-indigo-600 hover:text-indigo-900 px-2"
                        >
                          <Edit size={14}/>
                        </button>
                        <button onClick={() => handleDeleteTruck(t.id)} className="text-red-600 hover:text-red-900 px-2">
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
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck className="text-blue-600" /> Vendor Hauling & Armada
        </h2>
        <button
          onClick={() => {
            setEditingVendor(null);
            setVendorData({ name: "", contact_person: "", phone: "", address: "", vendor_type: "hauling" });
            setShowVendorForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm"
        >
          <Plus size={16} /> <span>Tambah Vendor Hauling</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
        {loadingVendors ? (
          <div className="p-8 text-center text-gray-500">Memuat data vendor...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontak Person</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telepon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alamat</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada vendor hauling terdaftar.</td>
                </tr>
              ) : (
                vendors.map(v => {
                  const isExpanded = expandedVendors[v.id];
                  return (
                    <React.Fragment key={v.id}>
                      <tr className={`hover:bg-blue-50 cursor-pointer ${isExpanded ? 'bg-blue-50/50' : ''}`} onClick={() => toggleVendorExpand(v.id)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                          <Building2 size={16} className="text-blue-500" />
                          {v.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.contact_person || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.phone || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">{v.address || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => { 
                              setEditingVendor(v); 
                              setVendorData({name: v.name, contact_person: v.contact_person||"", phone: v.phone||"", address: v.address||"", vendor_type: "hauling"}); 
                              setShowVendorForm(true); 
                            }} 
                            className="text-indigo-600 hover:text-indigo-900 px-2"
                          >
                            <Edit size={16}/>
                          </button>
                          <button onClick={() => handleDeleteVendor(v.id)} className="text-red-600 hover:text-red-900 px-2">
                            <Trash2 size={16}/>
                          </button>
                        </td>
                      </tr>
                      {/* Expanded: Daftar Truk */}
                      {isExpanded && (
                        <tr className="bg-slate-50 border-t border-slate-100">
                          <VendorTrucksList vendorId={v.id} />
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL VENDOR */}
      {showVendorForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingVendor ? "Edit Vendor Hauling" : "Tambah Vendor Hauling"}</h3>
              <button onClick={() => setShowVendorForm(false)} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
            </div>
            <form onSubmit={handleVendorSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Vendor <span className="text-red-500">*</span></label>
                <input required value={vendorData.name} onChange={e=>setVendorData({...vendorData, name: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Kontak Person</label>
                <input value={vendorData.contact_person} onChange={e=>setVendorData({...vendorData, contact_person: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon / WA</label>
                <input value={vendorData.phone} onChange={e=>setVendorData({...vendorData, phone: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <textarea value={vendorData.address} onChange={e=>setVendorData({...vendorData, address: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none" rows={3} />
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowVendorForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Batal</button>
                <button type="submit" disabled={createVendorMut.isPending || updateVendorMut.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
                  <Save size={16} /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRUK */}
      {showTruckForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingTruck ? "Edit Armada Truk" : "Tambah Armada Truk"}</h3>
              <button onClick={() => setShowTruckForm(null)} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
            </div>
            <form onSubmit={handleTruckSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nopol (Nomor Polisi) <span className="text-red-500">*</span></label>
                  <input required value={truckData.nopol} onChange={e=>setTruckData({...truckData, nopol: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none uppercase font-bold" placeholder="B 1234 CD" />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipe Truk</label>
                  <select value={truckData.tipe_truk} onChange={e=>setTruckData({...truckData, tipe_truk: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none bg-white">
                    <option value="tronton">Tronton</option>
                    <option value="colt_diesel">Colt Diesel</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Supir (Default)</label>
                <input value={truckData.supir_default} onChange={e=>setTruckData({...truckData, supir_default: e.target.value})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none" placeholder="Nama Supir" />
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
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowTruckForm(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Batal</button>
                <button type="submit" disabled={createTruckMut.isPending || updateTruckMut.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2">
                  <Save size={16} /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-xl text-center">
            <h3 className="text-lg font-bold mb-2 text-gray-900">{confirmModal.title}</h3>
            <p className="text-sm text-gray-600 mb-6">{confirmModal.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors"
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
