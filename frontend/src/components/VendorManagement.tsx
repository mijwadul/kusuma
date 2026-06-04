import React, { useState } from "react";
import { toast } from "sonner";
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { Building2, Plus, Edit, Trash2, CheckCircle, XCircle, Pencil, Truck, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, useVendorTopups, useCreateVendorTopup, useUpdateVendorTopup, useDeleteVendorTopup, useApproveVendorTopup, useEquipmentBalances, Vendor } from "../hooks/useVendors";
import { useEquipment } from "../hooks/useEquipment";
import { toLocalDateInput } from "../utils/formatters";

const formatIDR = (v: any) =>
  Number(v ?? 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });

interface Props {
  userRole: string;
}

export default function VendorManagement({ userRole }: Props) {
  const [expandedVendors, setExpandedVendors] = useState<Record<number, boolean>>({});

  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorData, setVendorData] = useState({ name: "", contact_person: "", phone: "", address: "" });

  const [showTopupForm, setShowTopupForm] = useState(false);
  const [selectedVendorForTopup, setSelectedVendorForTopup] = useState<Vendor | null>(null);
  const [vendorEquipments, setVendorEquipments] = useState<any[]>([]);
  const [topupData, setTopupData] = useState({ amount: "", notes: "", topup_date: "", equipment_id: "", project_id: "" });

  const [editingTopup, setEditingTopup] = useState<any>(null);
  const [editTopupData, setEditTopupData] = useState({ amount: "", notes: "", topup_date: "", equipment_id: "", project_id: "" });
  const [editVendorEquipments, setEditVendorEquipments] = useState<any[]>([]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const isGM = userRole === "gm" || userRole === "admin";
  const canManage = ["gm", "finance", "admin"].includes(userRole);

  const { data: vendors = [] as Vendor[], isLoading: loadingVendors } = useVendors({ enabled: canManage });
  const { data: topups = [] as any[] } = useVendorTopups({ enabled: canManage });
  const { data: allEquipment = [] as any[] } = useEquipment({ enabled: canManage });
  const { data: equipmentBalances = [] as any[] } = useEquipmentBalances({ enabled: canManage });
  
  const { data: projects = [] as any[] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await apiClient.get('/projects-data/projects');
      return data;
    },
    enabled: canManage
  });

  const createVendorMut = useCreateVendor();
  const updateVendorMut = useUpdateVendor();
  const deleteVendorMut = useDeleteVendor();
  const createTopupMut = useCreateVendorTopup();
  const updateTopupMut = useUpdateVendorTopup();
  const deleteTopupMut = useDeleteVendorTopup();
  const approveTopupMut = useApproveVendorTopup();

  const getVendorEquipments = (vendorId: number) =>
    allEquipment.filter((eq: any) => eq.vendor_id === vendorId);

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      updateVendorMut.mutate(
        { id: editingVendor.id, data: vendorData },
        {
          onSuccess: () => {
            toast.success("Vendor diperbarui!");
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
            toast.success("Vendor ditambahkan!");
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
      message: "Hapus vendor ini? Pastikan tidak ada alat yang terikat!",
      onConfirm: () => {
        deleteVendorMut.mutate(id, {
          onSuccess: () => toast.success("Vendor dihapus"),
          onError: () => toast.error("Gagal menghapus"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} })
        });
      }
    });
  };

  const openTopupForm = (vendor: Vendor) => {
    const eqs = getVendorEquipments(vendor.id);
    setSelectedVendorForTopup(vendor);
    setVendorEquipments(eqs);
    setTopupData({
      amount: "",
      notes: "",
      topup_date: toLocalDateInput(new Date()),
      equipment_id: eqs.length === 1 ? String(eqs[0].id) : "",
      project_id: ""
    });
    setShowTopupForm(true);
  };

  const handleTopupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupData.equipment_id) {
      toast.error("Pilih alat berat terlebih dahulu!");
      return;
    }
    createTopupMut.mutate(
      {
        vendor_id: selectedVendorForTopup?.id,
        equipment_id: parseInt(topupData.equipment_id),
        amount: parseFloat(topupData.amount),
        topup_date: topupData.topup_date ? toLocalDateInput(topupData.topup_date) : undefined,
        notes: topupData.notes,
        project_id: topupData.project_id ? parseInt(topupData.project_id) : null
      },
      {
        onSuccess: () => {
          toast.success(isGM ? "Top Up Berhasil!" : "Pengajuan Top Up dikirim (Pending)");
          setShowTopupForm(false);
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || "Gagal mengajukan top up")
      }
    );
  };

  const handleApproveTopup = (id: number, status: string) => {
    approveTopupMut.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Top Up ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`),
        onError: () => toast.error("Gagal merespon top up")
      }
    );
  };

  const openEditTopup = (t: any) => {
    const eqs = getVendorEquipments(t.vendor_id);
    setEditVendorEquipments(eqs);
    setEditingTopup(t);
    setEditTopupData({
      amount: t.amount,
      notes: t.notes || "",
      topup_date: t.topup_date ? toLocalDateInput(t.topup_date) : toLocalDateInput(new Date()),
      equipment_id: t.equipment_id ? String(t.equipment_id) : "",
      project_id: t.project_id ? String(t.project_id) : ""
    });
  };

  const handleEditTopupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTopupData.equipment_id) {
      toast.error("Pilih alat berat terlebih dahulu!");
      return;
    }
    updateTopupMut.mutate(
      {
        id: editingTopup.id,
        data: {
          vendor_id: editingTopup.vendor_id,
          equipment_id: parseInt(editTopupData.equipment_id),
          amount: parseFloat(editTopupData.amount),
          topup_date: editTopupData.topup_date ? toLocalDateInput(editTopupData.topup_date) : undefined,
          notes: editTopupData.notes,
          project_id: editTopupData.project_id ? parseInt(editTopupData.project_id) : null
        }
      },
      {
        onSuccess: () => {
          toast.success("Data deposit berhasil diperbarui");
          setEditingTopup(null);
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || "Gagal memperbarui deposit")
      }
    );
  };

  const handleDeleteTopup = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Deposit",
      message: "Hapus data Top-Up Deposit ini? Saldo alat berat akan otomatis diperbarui.",
      onConfirm: () => {
        deleteTopupMut.mutate(id, {
          onSuccess: () => toast.success("Data deposit dihapus"),
          onError: () => toast.error("Gagal menghapus deposit"),
          onSettled: () => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} })
        });
      }
    });
  };

  const toggleVendorExpand = (vendorId: number) => {
    setExpandedVendors(prev => ({ ...prev, [vendorId]: !prev[vendorId] }));
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo per Alat Berat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[...vendors].sort((a, b) => a.name.localeCompare(b.name)).map(v => {
              const vEquipBalances = equipmentBalances.filter((b: any) => b.vendor_id === v.id);
              const isExpanded = expandedVendors[v.id];
              const hasLowBalance = vEquipBalances.some((b: any) => b.balance <= 5000000);
              return (
                <React.Fragment key={v.id}>
                  <tr className="hover:bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{v.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.contact_person || "-"} <br/> {v.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vEquipBalances.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Belum ada alat berat rental</span>
                      ) : (
                        <button
                          onClick={() => toggleVendorExpand(v.id)}
                          className={`flex items-center gap-1.5 text-sm font-semibold px-2 py-1 rounded transition-colors ${
                            hasLowBalance
                              ? "text-red-700 bg-red-50 hover:bg-red-100"
                              : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          }`}
                        >
                          {hasLowBalance && <AlertTriangle size={14} className="text-red-500" />}
                          <Truck size={14} />
                          {vEquipBalances.length} Alat Berat
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => openTopupForm(v)}
                        className="text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded font-medium"
                      >
                        Top Up
                      </button>
                      <button onClick={() => { setEditingVendor(v); setVendorData({name: v.name, contact_person: v.contact_person||"", phone: v.phone||"", address: v.address||""}); setShowVendorForm(true); }} className="text-indigo-600 hover:text-indigo-900 px-2"><Edit size={16}/></button>
                      {isGM && <button onClick={() => handleDeleteVendor(v.id)} className="text-red-600 hover:text-red-900 px-2"><Trash2 size={16}/></button>}
                    </td>
                  </tr>
                  {/* Expanded: saldo per alat berat */}
                  {isExpanded && vEquipBalances.map((b: any) => (
                    <tr key={`eq-${b.equipment_id}`} className="bg-slate-50 border-t border-slate-100">
                      <td className="pl-12 pr-4 py-2" colSpan={2}>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Truck size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="font-medium">{b.equipment_name}</span>
                          <span className="text-xs text-gray-400">({b.equipment_type})</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        <div>Deposit masuk: <span className="font-medium text-emerald-700">{formatIDR(b.total_topup)}</span></div>
                        <div>Biaya rental: <span className="font-medium text-red-600">-{formatIDR(b.total_rental_cost)}</span></div>
                      </td>
                      <td className="px-4 py-2" colSpan={2}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-bold ${
                          b.balance < 0
                            ? "bg-red-100 text-red-800"
                            : b.balance <= 5000000
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {b.balance < 0 && <AlertTriangle size={12} />}
                          {b.balance < 0 ? "⚠️ Minus: " : b.balance <= 5000000 ? "⚡ Menipis: " : ""}
                          {formatIDR(b.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {vendors.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">Belum ada data vendor.</td></tr>}
          </tbody>
        </table>
      </div>

      {topups.length > 0 && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Riwayat Top-Up Deposit</h3>
          <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alat Berat</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nominal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catatan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {isGM && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi GM</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...topups].sort((a, b) => new Date(b.topup_date).getTime() - new Date(a.topup_date).getTime()).map(t => {
                  const v = vendors.find((x: any) => x.id === t.vendor_id);
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(t.topup_date).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{v?.name || `Vendor #${t.vendor_id}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.equipment_name ? (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                            <Truck size={13} className="text-gray-400" />
                            {t.equipment_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {t.project_id ? projects.find((p: any) => p.id === t.project_id)?.name || `Project #${t.project_id}` : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-emerald-600">{formatIDR(t.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{t.notes || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                          t.status === 'approved' ? 'bg-green-100 text-green-800'
                          : t.status === 'rejected' ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      {isGM && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="flex gap-2 items-center">
                            {t.status === 'pending' && (
                              <>
                                <button onClick={() => handleApproveTopup(t.id, 'approved')} className="text-green-600 hover:text-green-800" title="Setujui"><CheckCircle size={18}/></button>
                                <button onClick={() => handleApproveTopup(t.id, 'rejected')} className="text-red-600 hover:text-red-800" title="Tolak"><XCircle size={18}/></button>
                              </>
                            )}
                            <button
                              onClick={() => openEditTopup(t)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingTopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Edit Data Deposit</h3>
            <p className="text-sm text-gray-500 mb-4">
              Vendor: <strong>{vendors.find((v: any) => v.id === editingTopup.vendor_id)?.name}</strong> &nbsp;|&nbsp;
              Status: <span className={`font-semibold ${editingTopup.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{editingTopup.status.toUpperCase()}</span>
            </p>
            <form onSubmit={handleEditTopupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alat Berat <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editTopupData.equipment_id}
                  onChange={e => setEditTopupData({ ...editTopupData, equipment_id: e.target.value })}
                  className="mt-1 w-full border rounded p-2 text-sm focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">-- Pilih Alat Berat --</option>
                  {editVendorEquipments.map(eq => (
                    <option key={eq.id} value={String(eq.id)}>{eq.name} ({eq.type})</option>
                  ))}
                </select>
                {editVendorEquipments.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Vendor ini belum memiliki alat berat rental terdaftar.</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-700">Project (Opsional)</label>
                <select
                  value={editTopupData.project_id}
                  onChange={e => setEditTopupData({ ...editTopupData, project_id: e.target.value })}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="">-- Pilih Project --</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
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
                  type="date"
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
                <button type="submit" disabled={updateTopupMut.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <button type="submit" disabled={createVendorMut.isPending || updateVendorMut.isPending} className="px-4 py-2 bg-blue-600 text-white rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTopupForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-2">Top-Up Deposit: {selectedVendorForTopup?.name}</h3>
            {isGM ? (
              <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm font-medium">Anda login sebagai GM. Top-Up akan langsung lunas dan tercatat.</div>
            ) : (
              <div className="bg-yellow-50 text-yellow-700 p-3 rounded mb-4 text-sm font-medium">Pengajuan Top-Up memerlukan Approval dari GM.</div>
            )}
            <form onSubmit={handleTopupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alat Berat <span className="text-red-500">*</span>
                </label>
                {vendorEquipments.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700">
                    ⚠️ Vendor ini belum memiliki alat berat rental yang terdaftar di sistem. Daftarkan alat berat terlebih dahulu di menu Equipment.
                  </div>
                ) : (
                  <select
                    required
                    value={topupData.equipment_id}
                    onChange={e => setTopupData({ ...topupData, equipment_id: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="">-- Pilih Alat Berat --</option>
                    {vendorEquipments.map(eq => {
                      const bal = equipmentBalances.find((b: any) => b.equipment_id === eq.id);
                      return (
                        <option key={eq.id} value={String(eq.id)}>
                          {eq.name} ({eq.type}){bal ? ` — Saldo: ${formatIDR(bal.balance)}` : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-700">Project (Opsional)</label>
                <select
                  value={topupData.project_id}
                  onChange={e => setTopupData({ ...topupData, project_id: e.target.value })}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="">-- Pilih Project --</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div><label className="block text-sm text-gray-700">Nominal Rp</label><input type="number" required min="1" value={topupData.amount} onChange={e=>setTopupData({...topupData, amount: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">Tanggal Top-Up</label><input type="date" value={topupData.topup_date} onChange={e=>setTopupData({...topupData, topup_date: e.target.value})} className="mt-1 w-full border rounded p-2" /></div>
              <div><label className="block text-sm text-gray-700">Catatan/Keterangan</label><input value={topupData.notes} onChange={e=>setTopupData({...topupData, notes: e.target.value})} className="mt-1 w-full border rounded p-2" placeholder="Cth: Transfer BCA 20 Mei" /></div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowTopupForm(false)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                <button
                  type="submit"
                  disabled={vendorEquipments.length === 0 || createTopupMut.isPending}
                  className="px-4 py-2 bg-amber-500 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kirim {isGM ? "Top-Up" : "Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl text-center">
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
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
