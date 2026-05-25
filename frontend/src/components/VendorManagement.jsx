import React, { useState, useEffect } from "react";
import { API_URL } from "../api/auth";
import { toast } from "sonner";
import { Building2, Plus, Edit, Trash2, CheckCircle, XCircle, Pencil } from "lucide-react";

export default function VendorManagement({ userRole }) {
  const [vendors, setVendors] = useState([]);
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [vendorData, setVendorData] = useState({ name: "", contact_person: "", phone: "", address: "" });

  const [showTopupForm, setShowTopupForm] = useState(false);
  const [selectedVendorForTopup, setSelectedVendorForTopup] = useState(null);
  const [topupData, setTopupData] = useState({ amount: "", notes: "" });

  // Edit topup state
  const [editingTopup, setEditingTopup] = useState(null);
  const [editTopupData, setEditTopupData] = useState({ amount: "", notes: "" });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });

  const isGM = userRole === "gm" || userRole === "admin";
  const canManage = ["gm", "finance", "admin"].includes(userRole);

  useEffect(() => {
    if (canManage) {
      fetchVendors();
      fetchTopups();
    }
  }, [userRole, canManage]);

  const getToken = () => localStorage.getItem("token");

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API_URL}/vendors`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setVendors(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopups = async () => {
    try {
      const res = await fetch(`${API_URL}/vendors/topups/all`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setTopups(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    const method = editingVendor ? "PUT" : "POST";
    const url = editingVendor ? `${API_URL}/vendors/${editingVendor.id}` : `${API_URL}/vendors`;
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(vendorData)
      });
      if (res.ok) {
        toast.success(editingVendor ? "Vendor diperbarui!" : "Vendor ditambahkan!");
        setShowVendorForm(false);
        fetchVendors();
      } else {
        toast.error("Gagal menyimpan vendor");
      }
    } catch (err) {
      toast.error("Error jaringan");
    }
  };

  const handleDeleteVendor = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Vendor",
      message: "Hapus vendor ini? Pastikan tidak ada alat yang terikat!",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/vendors/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` }
          });
          if (res.ok) {
            toast.success("Vendor dihapus");
            fetchVendors();
          } else {
            toast.error("Gagal menghapus");
          }
        } catch (err) {
          toast.error("Error jaringan");
        } finally {
          setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
        }
      }
    });
  };

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/vendors/topups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          vendor_id: selectedVendorForTopup.id,
          amount: parseFloat(topupData.amount),
          topup_date: topupData.topup_date ? new Date(topupData.topup_date).toISOString() : undefined,
          notes: topupData.notes
        })
      });
      if (res.ok) {
        toast.success(isGM ? "Top Up Berhasil!" : "Pengajuan Top Up dikirim (Pending)");
        setShowTopupForm(false);
        fetchVendors();
        fetchTopups();
      } else {
        toast.error("Gagal mengajukan top up");
      }
    } catch (err) {
      toast.error("Error jaringan");
    }
  };

  const handleApproveTopup = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/vendors/topups/${id}/approve?status=${status}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        toast.success(`Top Up ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`);
        fetchVendors();
        fetchTopups();
      } else {
        toast.error("Gagal merespon top up");
      }
    } catch (err) {
      toast.error("Error jaringan");
    }
  };

  const handleEditTopupSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/vendors/topups/${editingTopup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          vendor_id: editingTopup.vendor_id,
          amount: parseFloat(editTopupData.amount),
          topup_date: editTopupData.topup_date ? new Date(editTopupData.topup_date).toISOString() : undefined,
          notes: editTopupData.notes
        })
      });
      if (res.ok) {
        toast.success("Data deposit berhasil diperbarui");
        setEditingTopup(null);
        fetchVendors();
        fetchTopups();
      } else {
        toast.error("Gagal memperbarui deposit");
      }
    } catch (err) {
      toast.error("Error jaringan");
    }
  };

  const handleDeleteTopup = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Deposit",
      message: "Hapus data Top-Up Deposit ini? Saldo vendor akan otomatis diperbarui.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/vendors/topups/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` }
          });
          if (res.ok) {
            toast.success("Data deposit dihapus");
            fetchVendors();
            fetchTopups();
          } else {
            toast.error("Gagal menghapus deposit");
          }
        } catch (err) {
          toast.error("Error jaringan");
        } finally {
          setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
        }
      }
    });
  };

  if (!canManage) return null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden p-6 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="text-blue-600" /> Daftar Perusahaan Sewa (Vendor)
        </h2>
        <button
          onClick={() => {
            setEditingVendor(null);
            setVendorData({ name: "", contact_person: "", phone: "", address: "" });
            setShowVendorForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm"
        >
          <Plus size={16} /> <span>Tambah Vendor</span>
        </button>
      </div>

      <div className="overflow-x-auto mb-8 border border-gray-100 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Perusahaan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontak</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Deposit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vendors.map(v => (
              <tr key={v.id} className="hover:bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{v.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.contact_person || "-"} <br/> {v.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-sm font-bold ${v.balance_deposit < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {v.balance_deposit < 0 ? '⚠️ Hutang: ' : ''}Rp {Number(v.balance_deposit).toLocaleString("id-ID")}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button 
                    onClick={() => { setSelectedVendorForTopup(v); setTopupData({ amount: "", notes: "", topup_date: new Date().toISOString().slice(0, 16) }); setShowTopupForm(true); }}
                    className="text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded font-medium"
                  >
                    Top Up
                  </button>
                  <button onClick={() => { setEditingVendor(v); setVendorData(v); setShowVendorForm(true); }} className="text-indigo-600 hover:text-indigo-900 px-2"><Edit size={16}/></button>
                  {isGM && <button onClick={() => handleDeleteVendor(v.id)} className="text-red-600 hover:text-red-900 px-2"><Trash2 size={16}/></button>}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && <tr><td colSpan="5" className="text-center py-4 text-gray-500">Belum ada data vendor.</td></tr>}
          </tbody>
        </table>
      </div>

      {topups.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Riwayat Top-Up Deposit</h3>
          <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catatan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {isGM && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi GM</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topups.map(t => {
                  const v = vendors.find(x => x.id === t.vendor_id);
                  return (
                    <tr key={t.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.topup_date).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{v?.name || `Vendor #${t.vendor_id}`}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">Rp {Number(t.amount).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.notes || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full font-semibold ${t.status === 'approved' ? 'bg-green-100 text-green-800' : t.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      {isGM && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2 items-center">
                            {t.status === 'pending' && (
                              <>
                                <button onClick={() => handleApproveTopup(t.id, 'approved')} className="text-green-600 hover:text-green-800" title="Setujui"><CheckCircle size={18}/></button>
                                <button onClick={() => handleApproveTopup(t.id, 'rejected')} className="text-red-600 hover:text-red-800" title="Tolak"><XCircle size={18}/></button>
                              </>
                            )}
                            {/* Edit & Delete selalu muncul untuk GM */}
                            <button
                              onClick={() => { setEditingTopup(t); setEditTopupData({ amount: t.amount, notes: t.notes || "", topup_date: t.topup_date ? new Date(t.topup_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16) }); }}
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Edit Deposit"
                            >
                              <Pencil size={16}/>
                            </button>
                            <button
                              onClick={() => handleDeleteTopup(t.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Hapus Deposit"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit Topup Modal */}
      {editingTopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Edit Data Deposit</h3>
            <p className="text-sm text-gray-500 mb-4">
              Vendor: <strong>{vendors.find(v => v.id === editingTopup.vendor_id)?.name}</strong> &nbsp;|&nbsp;
              Status: <span className={`font-semibold ${editingTopup.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{editingTopup.status.toUpperCase()}</span>
            </p>
            <form onSubmit={handleEditTopupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700">Nominal Rp</label>
                <input
                  type="number" required min="1"
                  value={editTopupData.amount}
                  onChange={e => setEditTopupData({ ...editTopupData, amount: e.target.value })}
                  className="mt-1 w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Tanggal Top-Up</label>
                <input
                  type="datetime-local"
                  value={editTopupData.topup_date}
                  onChange={e => setEditTopupData({ ...editTopupData, topup_date: e.target.value })}
                  className="mt-1 w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Catatan/Keterangan</label>
                <input
                  value={editTopupData.notes}
                  onChange={e => setEditTopupData({ ...editTopupData, notes: e.target.value })}
                  className="mt-1 w-full border rounded p-2"
                  placeholder="Cth: Transfer BCA 20 Mei"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setEditingTopup(null)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forms */}
      {showVendorForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editingVendor ? "Edit Vendor" : "Tambah Vendor Baru"}</h3>
            <form onSubmit={handleVendorSubmit} className="space-y-4">
              <div><label className="block text-sm text-gray-700">Nama Perusahaan</label><input required value={vendorData.name} onChange={e=>setVendorData({...vendorData, name: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">Nama Kontak Person</label><input value={vendorData.contact_person} onChange={e=>setVendorData({...vendorData, contact_person: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">No. Telepon / WA</label><input value={vendorData.phone} onChange={e=>setVendorData({...vendorData, phone: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">Alamat</label><textarea value={vendorData.address} onChange={e=>setVendorData({...vendorData, address: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowVendorForm(false)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTopupForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Top-Up Deposit: {selectedVendorForTopup?.name}</h3>
            {isGM ? (
              <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm font-medium">Anda login sebagai GM. Top-Up akan langsung lunas dan tercatat.</div>
            ) : (
              <div className="bg-yellow-50 text-yellow-700 p-3 rounded mb-4 text-sm font-medium">Pengajuan Top-Up memerlukan Approval dari GM.</div>
            )}
            <form onSubmit={handleTopupSubmit} className="space-y-4">
              <div><label className="block text-sm text-gray-700">Nominal Rp</label><input type="number" required min="1" value={topupData.amount} onChange={e=>setTopupData({...topupData, amount: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">Tanggal Top-Up</label><input type="datetime-local" value={topupData.topup_date} onChange={e=>setTopupData({...topupData, topup_date: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">Catatan/Keterangan</label><input value={topupData.notes} onChange={e=>setTopupData({...topupData, notes: e.target.value})} className="mt-1 w-full border rounded p-2" placeholder="Cth: Transfer BCA 20 Mei" /></div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowTopupForm(false)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-white font-bold rounded">Kirim {isGM ? "Top-Up" : "Pengajuan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl text-center">
            <h3 className="text-lg font-bold mb-2 text-gray-900">{confirmModal.title}</h3>
            <p className="text-sm text-gray-600 mb-6">{confirmModal.message}</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })} 
                className="px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
