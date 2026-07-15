import React, { useState } from 'react';
import { toast } from 'sonner';
import { Truck, Plus, Building2, Wallet, Trash2, Edit } from 'lucide-react';
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, useCreateVendorTopup, useVendorTopups, useUpdateVendorTopup, useDeleteVendorTopup, Vendor } from '../hooks/useVendors';

export default function LoadingVendorPage() {
  // Vendor State
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorData, setVendorData] = useState({ name: "", contact_person: "", phone: "", address: "", vendor_type: "jasa_loading", allow_deposit_cascade: false });

  // Top Up State
  const [showTopupForm, setShowTopupForm] = useState<number | null>(null);
  const [editingTopup, setEditingTopup] = useState<number | null>(null);
  const [topupData, setTopupData] = useState({ amount: '', notes: '', topup_date: new Date().toISOString().split('T')[0] });
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} });

  const { data: vendors = [], isLoading: loadingVendors } = useVendors('jasa_loading');
  
  const createVendorMut = useCreateVendor();
  const updateVendorMut = useUpdateVendor();
  const deleteVendorMut = useDeleteVendor();
  const createTopupMut = useCreateVendorTopup();
  const updateTopupMut = useUpdateVendorTopup();
  const deleteTopupMut = useDeleteVendorTopup();
  
  const { data: allTopups = [] } = useVendorTopups();

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      updateVendorMut.mutate(
        { id: editingVendor.id, data: vendorData },
        {
          onSuccess: () => {
            toast.success("Vendor Jasa Loading diperbarui!");
            setShowVendorForm(false);
          },
          onError: () => toast.error("Gagal memperbarui vendor")
        }
      );
    } else {
      createVendorMut.mutate(
        vendorData,
        {
          onSuccess: () => {
            toast.success("Vendor Jasa Loading ditambahkan!");
            setShowVendorForm(false);
          },
          onError: () => toast.error("Gagal menambahkan vendor")
        }
      );
    }
  };

  const handleDeleteVendor = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Vendor",
      message: "Hapus vendor ini? Pastikan tidak ada transaksi yang terikat!",
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
          toast.success("Kasbon berhasil diperbarui!");
          setShowTopupForm(null);
          setEditingTopup(null);
          setTopupData({ amount: '', notes: '', topup_date: new Date().toISOString().split('T')[0] });
        },
        onError: () => toast.error("Gagal memperbarui kasbon")
      });
    } else {
      createTopupMut.mutate({
        vendor_id: showTopupForm,
        amount: parseFloat(topupData.amount || '0'),
        notes: topupData.notes,
        topup_date: topupData.topup_date,
      }, {
        onSuccess: () => {
          toast.success("Kasbon berhasil ditambahkan!");
          setShowTopupForm(null);
          setTopupData({ amount: '', notes: '', topup_date: new Date().toISOString().split('T')[0] });
        },
        onError: () => toast.error("Gagal menambahkan kasbon")
      });
    }
  };

  const handleDeleteTopup = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Kasbon",
      message: "Yakin ingin menghapus riwayat kasbon ini?",
      confirmText: "Ya, Hapus",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        deleteTopupMut.mutate(id, {
          onSuccess: () => toast.success("Kasbon dihapus"),
          onError: () => toast.error("Gagal menghapus kasbon"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", confirmText: "Ya, Hapus", confirmColor: "bg-red-600 hover:bg-red-700", onConfirm: () => {} })
        });
      }
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck className="text-blue-600" /> Vendor Jasa Loading
        </h2>
        <button
          onClick={() => {
            setEditingVendor(null);
            setVendorData({ name: "", contact_person: "", phone: "", address: "", vendor_type: "jasa_loading", allow_deposit_cascade: false });
            setShowVendorForm(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus size={16} /> <span>Tambah Vendor Jasa Loading</span>
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
                  <th className="px-4 py-3 text-right whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Belum ada vendor jasa loading terdaftar.</td>
                  </tr>
                ) : (
                  vendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" />
                        {v.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{v.contact_person || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{v.phone || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 truncate max-w-xs">{v.address || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => setShowTopupForm(v.id)}
                          className="text-emerald-600 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded"
                        >
                          Topup / Kasbon
                        </button>
                        <button
                          onClick={() => {
                            setEditingVendor(v);
                            setVendorData({
                              name: v.name,
                              contact_person: v.contact_person || "",
                              phone: v.phone || "",
                              address: v.address || "",
                              vendor_type: "jasa_loading",
                              allow_deposit_cascade: v.allow_deposit_cascade || false
                            });
                            setShowVendorForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(v.id)}
                          className="text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VENDOR FORM MODAL */}
      {showVendorForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingVendor ? "Edit Vendor Jasa Loading" : "Tambah Vendor Jasa Loading"}
              </h3>
              <button onClick={() => setShowVendorForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleVendorSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Vendor <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={vendorData.name}
                  onChange={(e) => setVendorData({ ...vendorData, name: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                  placeholder="Contoh: PT. Bintang Loading"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kontak Person</label>
                <input
                  type="text"
                  value={vendorData.contact_person}
                  onChange={(e) => setVendorData({ ...vendorData, contact_person: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                <input
                  type="text"
                  value={vendorData.phone}
                  onChange={(e) => setVendorData({ ...vendorData, phone: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <textarea
                  value={vendorData.address}
                  onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border"
                  rows={3}
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowVendorForm(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createVendorMut.isPending || updateVendorMut.isPending}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {createVendorMut.isPending || updateVendorMut.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOPUP FORM MODAL */}
      {showTopupForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="text-emerald-600" size={20} />
                {editingTopup ? "Edit Kasbon" : "Tambah Kasbon"}
              </h3>
              <button onClick={() => { setShowTopupForm(null); setEditingTopup(null); }} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            {/* Show Existing Topups for this vendor if adding new */}
            {!editingTopup && (
              <div className="mb-6 max-h-40 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-1">Tanggal</th>
                      <th className="px-2 py-1">Nominal</th>
                      <th className="px-2 py-1 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTopups.filter(t => t.vendor_id === showTopupForm).map(t => (
                      <tr key={t.id} className="border-t border-gray-100">
                        <td className="px-2 py-1">{new Date(t.topup_date).toLocaleDateString('id-ID')}</td>
                        <td className="px-2 py-1">{Number(t.amount).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</td>
                        <td className="px-2 py-1 text-right space-x-1">
                          <button onClick={(e) => { e.preventDefault(); setEditingTopup(t.id); setTopupData({ amount: t.amount.toString(), notes: t.notes || '', topup_date: new Date(t.topup_date).toISOString().split('T')[0] }); }} className="text-blue-600 hover:text-blue-800"><Edit size={14} /></button>
                          <button onClick={(e) => { e.preventDefault(); handleDeleteTopup(t.id); }} className="text-red-600 hover:text-red-800"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={handleTopupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={topupData.topup_date}
                  onChange={(e) => setTopupData({ ...topupData, topup_date: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  value={topupData.amount}
                  onChange={(e) => setTopupData({ ...topupData, amount: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border"
                  placeholder="Contoh: 1000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea
                  value={topupData.notes}
                  onChange={(e) => setTopupData({ ...topupData, notes: e.target.value })}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border"
                  rows={3}
                  placeholder="Catatan tambahan (opsional)"
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowTopupForm(null); setEditingTopup(null); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={createTopupMut.isPending || updateTopupMut.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  <Wallet size={16} />
                  {createTopupMut.isPending || updateTopupMut.isPending ? "Menyimpan..." : "Simpan Kasbon"}
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

    </div>
  );
}
