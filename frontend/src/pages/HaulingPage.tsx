import React, { useState } from 'react';
import { toast } from 'sonner';
import { Truck, Plus, Edit, Trash2, ChevronDown, ChevronRight, Building2, Save, X, FileText } from 'lucide-react';
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, useCreateVendorTopup, useVendorTopups, useUpdateVendorTopup, useDeleteVendorTopup, useVendorTruckBalances, Vendor } from '../hooks/useVendors';
import { useVendorTrucks, useCreateVendorTruck, useUpdateVendorTruck, useDeleteVendorTruck, useAllHaulingObligations, useVendorHaulingDetails } from '../hooks/useHauling';
import CustomSelect from '../components/CustomSelect';
import { formatNopol, formatTitleCase } from '../utils/formatters';
import VendorReportModal from '../components/VendorReportModal';

export default function HaulingPage() {
  const [expandedVendors, setExpandedVendors] = useState<Record<number, boolean>>({});

  // Vendor State
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorData, setVendorData] = useState({ name: "", contact_person: "", phone: "", address: "", vendor_type: "hauling", allow_deposit_cascade: false });
  const [showVendorDetail, setShowVendorDetail] = useState<Vendor | null>(null);
  const [reportVendor, setReportVendor] = useState<Vendor | null>(null);

  // Top Up State
  const [showTopupForm, setShowTopupForm] = useState<number | null>(null);
  const [editingTopup, setEditingTopup] = useState<number | null>(null);
  const [topupData, setTopupData] = useState({ amount: '', notes: '', topup_date: new Date().toISOString().split('T')[0], truck_id: '' as string | number });
  
  // Detail Modal State
  const [showObligationDetail, setShowObligationDetail] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [expandedNopols, setExpandedNopols] = useState<Record<string, boolean>>({});

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setTopupData({ ...topupData, amount: rawValue });
  };

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

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} });

  const { data: vendors = [], isLoading: loadingVendors } = useVendors('hauling');
  
  const createVendorMut = useCreateVendor();
  const updateVendorMut = useUpdateVendor();
  const deleteVendorMut = useDeleteVendor();
  const createTopupMut = useCreateVendorTopup();
  const updateTopupMut = useUpdateVendorTopup();
  const deleteTopupMut = useDeleteVendorTopup();
  
  const { data: allTopups = [] } = useVendorTopups();
  const { data: trucksForTopup = [] } = useVendorTrucks(showTopupForm || undefined);
  const { data: truckBalances = [] } = useVendorTruckBalances(showVendorDetail?.id);
  
  const createTruckMut = useCreateVendorTruck();
  const updateTruckMut = useUpdateVendorTruck();
  const deleteTruckMut = useDeleteVendorTruck();

  const { data: obligations = [] } = useAllHaulingObligations();
  const { data: obligationDetails = [], isLoading: loadingObligationDetails } = useVendorHaulingDetails(showVendorDetail?.id);

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
      confirmText: "Ya, Hapus",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        deleteVendorMut.mutate(id, {
          onSuccess: () => toast.success("Vendor dihapus"),
          onError: () => toast.error("Gagal menghapus vendor"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} })
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
      confirmText: "Ya, Hapus",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        deleteTruckMut.mutate(id, {
          onSuccess: () => toast.success("Armada dihapus"),
          onError: () => toast.error("Gagal menghapus armada"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} })
        });
      }
    });
  };

  const handleDeleteTopup = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Deposit",
      message: "Yakin ingin menghapus riwayat deposit ini?",
      confirmText: "Ya, Hapus",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        deleteTopupMut.mutate(id, {
          onSuccess: () => toast.success("Deposit dihapus"),
          onError: () => toast.error("Gagal menghapus deposit"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} })
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
  const handleTopupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTopupForm) return;

    if (editingTopup) {
      updateTopupMut.mutate({
        id: editingTopup,
        data: {
          vendor_id: showTopupForm,
          amount: parseFloat(topupData.amount || '0'),
          notes: topupData.notes,
          topup_date: topupData.topup_date
        }
      }, {
        onSuccess: () => {
          toast.success("Deposit berhasil diperbarui!");
          setShowTopupForm(null);
          setEditingTopup(null);
          setTopupData({ amount: '', notes: '', topup_date: new Date().toISOString().split('T')[0], truck_id: '' });
        },
        onError: () => toast.error("Gagal memperbarui deposit")
      });
    } else {
      createTopupMut.mutate({
        vendor_id: showTopupForm,
        amount: parseFloat(topupData.amount || '0'),
        notes: topupData.notes,
        topup_date: topupData.topup_date,
        truck_id: topupData.truck_id ? parseInt(topupData.truck_id as string) : undefined
      }, {
        onSuccess: () => {
          toast.success("Deposit berhasil ditambahkan!");
          setShowTopupForm(null);
          setTopupData({ amount: '', notes: '', topup_date: new Date().toISOString().split('T')[0], truck_id: '' });
        },
        onError: () => toast.error("Gagal menambahkan deposit")
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck className="text-blue-600" /> Vendor Hauling & Armada
        </h2>
        <button
          onClick={() => {
            setEditingVendor(null);
            setVendorData({ name: "", contact_person: "", phone: "", address: "", vendor_type: "hauling", allow_deposit_cascade: false });
            setShowVendorForm(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus size={16} /> <span>Tambah Vendor Hauling</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {loadingVendors ? (
          <div className="p-8 text-center text-gray-500">Memuat data vendor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Vendor</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontak Person</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Telepon</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Alamat</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-50">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Belum ada vendor hauling terdaftar.</td>
                </tr>
              ) : (
                vendors.map(v => {
                  const isExpanded = expandedVendors[v.id];
                  return (
                    <React.Fragment key={v.id}>
                      <tr className={`hover:bg-emerald-50/60 cursor-pointer transition-colors ${isExpanded ? 'bg-emerald-50/60' : ''}`} onClick={() => {
                        setShowVendorDetail(v);
                        setShowObligationDetail(false);
                        setExpandedProjects({});
                        setExpandedNopols({});
                      }}>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleVendorExpand(v.id); }} 
                            className="p-1 hover:bg-emerald-200/50 rounded-full transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                          </button>
                          <Building2 size={16} className="text-blue-500" />
                          {v.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{v.contact_person || "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{v.phone || "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500 truncate max-w-xs">{v.address || "-"}</td>
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
          </div>
        )}
      </div>

      {/* MODAL VENDOR */}
      {showVendorForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
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
              
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Potong Saldo Global?</label>
                  <span className="text-xs text-gray-500">Jika deposit unit habis, talangi dengan global.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newValue = !vendorData.allow_deposit_cascade;
                    setConfirmModal({
                      isOpen: true,
                      title: "Konfirmasi Pengaturan",
                      message: `Apakah Anda yakin ingin ${newValue ? 'MENGAKTIFKAN' : 'MEMATIKAN'} fitur potong saldo global otomatis?`,
                      confirmText: newValue ? "Ya, Aktifkan" : "Ya, Matikan",
                      confirmColor: newValue ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-700",
                      onConfirm: () => {
                        setVendorData({...vendorData, allow_deposit_cascade: newValue});
                        setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} });
                      }
                    });
                  }}
                  className={`w-12 h-6 rounded-full relative transition-colors ${vendorData.allow_deposit_cascade ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${vendorData.allow_deposit_cascade ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setShowVendorForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors">Batal</button>
                <button type="submit" disabled={createVendorMut.isPending || updateVendorMut.isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium flex items-center gap-2 shadow-sm transition-colors">
                  <Save size={16} /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRUK */}
      {showTruckForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingTruck ? "Edit Armada Truk" : "Tambah Armada Truk"}</h3>
              <button onClick={() => setShowTruckForm(null)} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
            </div>
            <form onSubmit={handleTruckSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nopol (Nomor Polisi) <span className="text-red-500">*</span></label>
                  <input required value={truckData.nopol} onChange={e=>setTruckData({...truckData, nopol: formatNopol(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none uppercase font-bold" placeholder="B 1234 CD" />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipe Truk</label>
                  <CustomSelect
                    value={truckData.tipe_truk}
                    onChange={(val) => setTruckData({...truckData, tipe_truk: val as string})}
                    options={[
                      { value: "tronton", label: "Tronton" },
                      { value: "colt_diesel", label: "Colt Diesel" }
                    ]}
                  />
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama Supir (Default)</label>
                <input value={truckData.supir_default} onChange={e=>setTruckData({...truckData, supir_default: formatTitleCase(e.target.value)})} className="w-full border rounded p-2 focus:ring-2 focus:ring-indigo-300 outline-none" placeholder="Contoh: Budi" />
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
              
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setShowTruckForm(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors">Batal</button>
                <button type="submit" disabled={createTruckMut.isPending || updateTruckMut.isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium flex items-center gap-2 shadow-sm transition-colors">
                  <Save size={16} /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-lg font-bold mb-2 text-gray-900">{confirmModal.title}</h3>
            <p className="text-sm text-gray-600 mb-6">{confirmModal.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} })}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2.5 text-white rounded-lg font-bold transition-colors ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TOPUP DEPOSIT */}
      {showTopupForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingTopup ? "Edit Deposit Vendor" : "Tambah Deposit Vendor"}</h3>
              <button onClick={() => { setShowTopupForm(null); setEditingTopup(null); }} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
            </div>
            <form onSubmit={handleTopupSubmit} className="space-y-4">
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
                <button type="button" onClick={() => { setShowTopupForm(null); setEditingTopup(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Batal</button>
                <button type="submit" disabled={createTopupMut.isPending || updateTopupMut.isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2">
                  <Save size={16} /> Simpan Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VENDOR DETAIL */}
      {showVendorDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="text-blue-600" /> Detail Vendor
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReportVendor(showVendorDetail)}
                  className="text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded font-medium flex items-center gap-1 inline-flex text-sm"
                >
                  <FileText size={16} /> Laporan
                </button>
                <button onClick={() => setShowVendorDetail(null)} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <span className="block text-xs text-gray-500 mb-1">Nama Vendor</span>
                <p className="font-semibold text-gray-900">{showVendorDetail.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Kontak Person</span>
                  <p className="font-medium text-gray-800">{showVendorDetail.contact_person || "-"}</p>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Telepon</span>
                  <p className="font-medium text-gray-800">{showVendorDetail.phone || "-"}</p>
                </div>
              </div>
              <div>
                <span className="block text-xs text-gray-500 mb-1">Alamat</span>
                <p className="text-sm text-gray-800">{showVendorDetail.address || "-"}</p>
              </div>
            </div>

            {obligations.find((o: any) => o.vendor_id === showVendorDetail.id) && (
              <div className="mb-6 bg-slate-50 border rounded-xl p-4 shadow-sm transition-all duration-300">
                <div className="flex justify-between items-center border-b pb-2 mb-3">
                  <h4 className="text-sm font-bold text-gray-800">Kewajiban Hauling</h4>
                  <button 
                    onClick={() => setShowObligationDetail(!showObligationDetail)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    {showObligationDetail ? "Tutup Detail" : "Lihat Detail"} {showObligationDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
                {(() => {
                  const obs = obligations.find((o: any) => o.vendor_id === showVendorDetail.id);
                  return (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 mt-1">
                          {obs.total_ritase} Ritase &bull; {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(obs.total_measurement)} Unit (Ton/m³)
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Deposit Tersisa: Rp {Number(obs.balance_deposit).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 block mb-1">Total Biaya Hauling</span>
                        <span className="font-bold text-lg text-rose-600">Rp {Number(obs.total_obligation).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* EXPANDABLE DETAIL SECTION */}
                {showObligationDetail && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h5 className="text-xs font-bold text-gray-700 mb-3">Rincian per Project:</h5>
                    {loadingObligationDetails ? (
                      <p className="text-xs text-gray-500 italic">Memuat rincian...</p>
                    ) : obligationDetails.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Tidak ada rincian data.</p>
                    ) : (
                      <div className="space-y-2">
                        {obligationDetails.map((proj: any) => (
                          <div key={proj.project_id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                            {/* Project Header */}
                            <div 
                              className="px-3 py-2 bg-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-200 transition-colors"
                              onClick={() => setExpandedProjects(prev => ({...prev, [proj.project_id]: !prev[proj.project_id]}))}
                            >
                              <div className="flex items-center gap-2">
                                {expandedProjects[proj.project_id] ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                                <span className="font-semibold text-sm text-slate-800">{proj.project_name}</span>
                              </div>
                              <div className="text-right text-xs">
                                <span className="font-bold text-rose-600">Rp {Number(proj.total_obligation).toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                            
                            {/* Nopol List inside Project */}
                            {expandedProjects[proj.project_id] && (
                              <div className="divide-y divide-slate-100 bg-white">
                                {proj.nopols.length === 0 && <div className="p-3 text-xs text-slate-500 italic">Tidak ada nopol</div>}
                                {proj.nopols.map((nopol: any) => (
                                  <div key={nopol.nopol} className="flex flex-col">
                                    {/* Nopol Header */}
                                    <div 
                                      className="px-4 py-2 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors pl-8"
                                      onClick={() => setExpandedNopols(prev => ({...prev, [`${proj.project_id}-${nopol.nopol}`]: !prev[`${proj.project_id}-${nopol.nopol}`]}))}
                                    >
                                      <div className="flex items-center gap-2">
                                        {expandedNopols[`${proj.project_id}-${nopol.nopol}`] ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                                        <span className="font-bold text-sm text-slate-700">{nopol.nopol}</span>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{nopol.total_ritase} Ritase</span>
                                      </div>
                                      <div className="text-right text-xs font-semibold text-slate-700">
                                        Rp {Number(nopol.total_obligation).toLocaleString('id-ID')}
                                      </div>
                                    </div>
                                    
                                    {/* Date List inside Nopol */}
                                    {expandedNopols[`${proj.project_id}-${nopol.nopol}`] && (
                                      <div className="bg-slate-50 pl-12 pr-4 py-2 space-y-1 border-t border-slate-100">
                                        {nopol.dates.map((d: any, idx: number) => (
                                          <div key={idx} className="flex justify-between items-center text-[11px]">
                                            <span className="text-slate-600">{new Date(d.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
                                            <div className="flex items-center gap-4">
                                              <span className="text-slate-500 w-12 text-right">{d.ritase} Rit</span>
                                              <span className="text-slate-500 w-16 text-right">{Number(d.measurement).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Unit</span>
                                              <span className="text-slate-700 font-medium w-24 text-right">Rp {Number(d.obligation).toLocaleString('id-ID')}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            
            {truckBalances.length > 0 && (
              <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-indigo-900 border-b border-indigo-200 pb-2 mb-3">Saldo Deposit per Unit (Nopol)</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {truckBalances.map((tb: any) => (
                    <div key={tb.truck_id} className="flex justify-between items-center bg-white p-2 rounded border border-indigo-100">
                      <div>
                        <span className="font-bold text-gray-800">{tb.nopol}</span>
                        <div className="text-[10px] text-gray-500">
                          Topup: {Number(tb.total_topup).toLocaleString('id-ID')} | Cost: {Number(tb.total_hauling_cost).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <span className={`font-bold text-sm ${tb.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {tb.balance < 0 ? '-' : ''}Rp {Math.abs(tb.balance).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Riwayat Deposit</h4>
              <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
                {allTopups.filter(t => t.vendor_id === showVendorDetail.id).length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Belum ada deposit.</p>
                ) : (
                  allTopups.filter(t => t.vendor_id === showVendorDetail.id).map(t => (
                    <div key={t.id} className="bg-gray-50 border rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500">{new Date(t.topup_date).toLocaleDateString('id-ID')}</p>
                        <p className="font-bold text-emerald-600 text-sm">Rp {Number(t.amount).toLocaleString('id-ID')}</p>
                        {t.notes && <p className="text-xs text-gray-600 mt-1">{t.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingTopup(t.id);
                            setTopupData({ amount: t.amount.toString(), notes: t.notes || '', topup_date: new Date(t.topup_date).toISOString().split('T')[0], truck_id: '' });
                            setShowTopupForm(showVendorDetail.id);
                            setShowVendorDetail(null);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTopup(t.id)}
                          className="text-red-600 hover:text-red-800 bg-red-50 p-1.5 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowTopupForm(showVendorDetail.id);
                  setShowVendorDetail(null);
                }}
                className="flex-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
              >
                + Deposit
              </button>
              <button
                onClick={() => {
                  setEditingVendor(showVendorDetail);
                  setVendorData({
                    name: showVendorDetail.name,
                    contact_person: showVendorDetail.contact_person || "",
                    phone: showVendorDetail.phone || "",
                    address: showVendorDetail.address || "",
                    vendor_type: "hauling",
                    allow_deposit_cascade: showVendorDetail.allow_deposit_cascade || false
                  });
                  setShowVendorForm(true);
                  setShowVendorDetail(null);
                }}
                className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
              >
                <Edit size={16} /> Edit
              </button>
              <button
                onClick={() => {
                  handleDeleteVendor(showVendorDetail.id);
                  setShowVendorDetail(null);
                }}
                className="flex-none bg-red-100 text-red-700 hover:bg-red-200 py-2 px-4 rounded-xl transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LAPORAN VENDOR */}
      <VendorReportModal 
        isOpen={!!reportVendor} 
        onClose={() => setReportVendor(null)} 
        vendor={reportVendor} 
      />
    </div>
  );
}
