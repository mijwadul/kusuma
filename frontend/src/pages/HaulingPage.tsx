import React, { useState } from 'react';
import { toast } from 'sonner';
import { Truck, Plus, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, useCreateVendorTopup, useVendorTopups, useUpdateVendorTopup, useDeleteVendorTopup, useVendorTruckBalances, Vendor } from '../hooks/useVendors';
import { useVendorTrucks, useCreateVendorTruck, useUpdateVendorTruck, useDeleteVendorTruck, useAllHaulingObligations, useVendorHaulingDetails } from '../hooks/useHauling';
import VendorReportModal from '../components/VendorReportModal';

// Imported Extracted Components
import HaulingVendorFormModal from '../components/hauling/HaulingVendorFormModal';
import HaulingTruckFormModal from '../components/hauling/HaulingTruckFormModal';
import HaulingTopupModal from '../components/hauling/HaulingTopupModal';
import HaulingVendorDetailModal from '../components/hauling/HaulingVendorDetailModal';
import VendorTrucksList from '../components/hauling/VendorTrucksList';

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
  
  // Truck State
  const [showTruckForm, setShowTruckForm] = useState<{vendorId: number} | null>(null);
  const [editingTruck, setEditingTruck] = useState<any | null>(null);
  const [truckData, setTruckData] = useState({
    nopol: '',
    supir_default: '',
    tipe_truk: 'tronton',
    panjang: null as number | null,
    lebar: null as number | null,
    tinggi: null as number | null
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
                        <tr className={`hover:bg-emerald-50/60 cursor-pointer transition-colors ${isExpanded ? 'bg-emerald-50/60' : ''}`} onClick={() => setShowVendorDetail(v)}>
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
                        {isExpanded && (
                          <tr className="bg-slate-50 border-t border-slate-100">
                            <VendorTrucksList 
                              vendorId={v.id} 
                              onAddTruck={(vendorId) => {
                                setEditingTruck(null);
                                setTruckData({ nopol: '', supir_default: '', tipe_truk: 'tronton', panjang: null, lebar: null, tinggi: null });
                                setShowTruckForm({ vendorId });
                              }}
                              onEditTruck={(vendorId, t) => {
                                setEditingTruck(t);
                                setTruckData({ 
                                  nopol: t.nopol, supir_default: t.supir_default || '', 
                                  tipe_truk: t.tipe_truk, panjang: t.panjang ?? null, lebar: t.lebar ?? null, tinggi: t.tinggi ?? null 
                                });
                                setShowTruckForm({ vendorId });
                              }}
                              onDeleteTruck={handleDeleteTruck}
                            />
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

      <HaulingVendorFormModal 
        isOpen={showVendorForm}
        onClose={() => setShowVendorForm(false)}
        onSubmit={handleVendorSubmit}
        vendorData={vendorData}
        setVendorData={setVendorData}
        isEditing={!!editingVendor}
        isPending={createVendorMut.isPending || updateVendorMut.isPending}
        setConfirmModal={setConfirmModal}
      />

      <HaulingTruckFormModal 
        isOpen={!!showTruckForm}
        onClose={() => setShowTruckForm(null)}
        onSubmit={handleTruckSubmit}
        truckData={truckData}
        setTruckData={setTruckData}
        isEditing={!!editingTruck}
        isPending={createTruckMut.isPending || updateTruckMut.isPending}
      />

      <HaulingTopupModal 
        isOpen={!!showTopupForm}
        onClose={() => { setShowTopupForm(null); setEditingTopup(null); }}
        onSubmit={handleTopupSubmit}
        topupData={topupData}
        setTopupData={setTopupData}
        isEditing={!!editingTopup}
        isPending={createTopupMut.isPending || updateTopupMut.isPending}
        trucksForTopup={trucksForTopup}
      />

      <HaulingVendorDetailModal 
        isOpen={!!showVendorDetail}
        onClose={() => setShowVendorDetail(null)}
        vendor={showVendorDetail}
        obligations={obligations}
        obligationDetails={obligationDetails}
        loadingObligationDetails={loadingObligationDetails}
        truckBalances={truckBalances}
        allTopups={allTopups}
        onTopup={(vendorId) => {
          setShowTopupForm(vendorId);
          setShowVendorDetail(null);
        }}
        onEditTopup={(t) => {
          setEditingTopup(t.id);
          setTopupData({ amount: t.amount.toString(), notes: t.notes || '', topup_date: new Date(t.topup_date).toISOString().split('T')[0], truck_id: '' });
          setShowTopupForm(showVendorDetail!.id);
          setShowVendorDetail(null);
        }}
        onDeleteTopup={handleDeleteTopup}
        onEditVendor={(vendorToEdit) => {
          setEditingVendor(vendorToEdit);
          setVendorData({
            name: vendorToEdit.name,
            contact_person: vendorToEdit.contact_person || "",
            phone: vendorToEdit.phone || "",
            address: vendorToEdit.address || "",
            vendor_type: "hauling",
            allow_deposit_cascade: vendorToEdit.allow_deposit_cascade || false
          });
          setShowVendorForm(true);
          setShowVendorDetail(null);
        }}
        onDeleteVendor={handleDeleteVendor}
        setReportVendor={setReportVendor}
      />

      {reportVendor && (
        <VendorReportModal isOpen={!!reportVendor} vendor={reportVendor} onClose={() => setReportVendor(null)} />
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

    </div>
  );
}
