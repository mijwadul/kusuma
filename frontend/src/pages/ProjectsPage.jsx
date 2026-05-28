import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Calendar,
  Building,
  MapPin,
  FileText,
  BadgeCheck,
  ChevronDown
} from "lucide-react";
import { API_URL } from "../api/auth";

const API_BASE = "/api/v1";

const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("projects");
  const [currentUser, setCurrentUser] = useState(null);
  const [meta, setMeta] = useState(null);

  // Data state
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showProjModal, setShowProjModal] = useState(false);
  const [showCustModal, setShowCustModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [viewCust, setViewCust] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form states
  const [projForm, setProjForm] = useState({
    name: "", client_name: "", description: "", location: "",
    start_date: "", end_date: "", budget: "", status: "ongoing", notes: "",
    material_items: []
  });
  const [custForm, setCustForm] = useState({
    name: "", company: "", contact_person: "", phone: "", email: "", address: "",
    notes: "", is_active: true, material_preferences: [], trucks: []
  });

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
    
    authFetch(`${API_BASE}/projects-data/meta`).then(setMeta).catch(console.error);
  }, []);

  const isGM = currentUser?.is_admin || currentUser?.is_superuser || ["gm", "admin"].includes(currentUser?.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "projects") {
        const data = await authFetch(`${API_BASE}/projects-data/projects`);
        setProjects(data);
      } else {
        const data = await authFetch(`${API_BASE}/projects-data/customers`);
        setCustomers(data);
      }
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    try {
      if (activeTab === "projects") {
        await authFetch(`${API_BASE}/projects-data/projects/${confirmDelete.id}`, { method: "DELETE" });
      } else {
        await authFetch(`${API_BASE}/projects-data/customers/${confirmDelete.id}`, { method: "DELETE" });
      }
      toast.success("Berhasil dihapus");
      fetchData();
    } catch {
      toast.error("Gagal menghapus");
    }
    setConfirmDelete(null);
  };

  // --- Project Form Helpers ---
  const openProjModal = (p = null) => {
    setEditData(p);
    if (p) {
      setProjForm({
        ...p,
        name: p.name || "",
        client_name: p.client_name || "",
        description: p.description || "",
        location: p.location || "",
        start_date: p.start_date || "",
        end_date: p.end_date || "",
        budget: p.budget || "",
        notes: p.notes || "",
        material_items: p.material_items.map(m => {
          const validUnits = meta?.material_units?.[m.material_type] || meta?.all_units || [];
          const unit = validUnits.includes(m.unit) ? m.unit : validUnits[0] || "ton";
          return { ...m, unit };
        })
      });
    } else {
      setProjForm({
        name: "", client_name: "", description: "", location: "",
        start_date: "", end_date: "", budget: "", status: "ongoing", notes: "",
        material_items: []
      });
    }
    setShowProjModal(true);
  };

  const saveProject = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...projForm,
        budget: parseFloat(projForm.budget) || 0,
        material_items: projForm.material_items.map(m => ({
          ...m,
          target_quantity: parseFloat(m.target_quantity) || 0,
          unit_price: m.unit_price ? parseFloat(m.unit_price) : null
        }))
      };
      if (editData) {
        await authFetch(`${API_BASE}/projects-data/projects/${editData.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await authFetch(`${API_BASE}/projects-data/projects`, { method: "POST", body: JSON.stringify(payload) });
      }
      toast.success("Proyek disimpan");
      setShowProjModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addProjMaterial = () => {
    setProjForm(prev => {
      const defaultMat = meta?.material_types[0] || "";
      const defaultUnit = (meta?.material_units?.[defaultMat] || ["ton"])[0];
      return {
        ...prev,
        material_items: [...prev.material_items, { material_type: defaultMat, unit: defaultUnit, target_quantity: "", unit_price: "" }]
      };
    });
  };
  const updateProjMaterial = (idx, field, val) => {
    const arr = [...projForm.material_items];
    arr[idx][field] = val;
    // Auto update unit options when material changes
    if (field === "material_type" && meta?.material_units) {
      arr[idx].unit = meta.material_units[val]?.[0] || "ton";
    }
    setProjForm(prev => ({ ...prev, material_items: arr }));
  };
  const removeProjMaterial = (idx) => {
    setProjForm(prev => ({ ...prev, material_items: prev.material_items.filter((_, i) => i !== idx) }));
  };

  // --- Customer Form Helpers ---
  const openCustModal = (c = null) => {
    setEditData(c);
    if (c) {
      setCustForm({
        ...c,
        name: c.name || "",
        company: c.company || "",
        contact_person: c.contact_person || "",
        phone: c.phone || "",
        email: c.email || "",
        address: c.address || "",
        notes: c.notes || "",
        material_preferences: c.material_preferences.map(m => {
          const validUnits = meta?.material_units?.[m.material_type] || meta?.all_units || [];
          const unit = validUnits.includes(m.unit) ? m.unit : validUnits[0] || "ton";
          return { ...m, unit };
        }),
        trucks: c.trucks ? c.trucks.map(t => ({ ...t })) : []
      });
    } else {
      setCustForm({
        name: "", company: "", contact_person: "", phone: "", email: "", address: "",
        notes: "", is_active: true, material_preferences: [], trucks: []
      });
    }
    setShowCustModal(true);
  };

  const saveCustomer = async (e) => {
    e.preventDefault();
    try {
      if (editData) {
        await authFetch(`${API_BASE}/projects-data/customers/${editData.id}`, { method: "PUT", body: JSON.stringify(custForm) });
      } else {
        await authFetch(`${API_BASE}/projects-data/customers`, { method: "POST", body: JSON.stringify(custForm) });
      }
      toast.success("Pelanggan disimpan");
      setShowCustModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addCustMaterial = () => {
    setCustForm(prev => {
      const defaultMat = meta?.material_types[0] || "";
      const defaultUnit = (meta?.material_units?.[defaultMat] || ["ton"])[0];
      return {
        ...prev,
        material_preferences: [...prev.material_preferences, { material_type: defaultMat, unit: defaultUnit, vehicle_type: "Tronton" }]
      };
    });
  };
  const updateCustMaterial = (idx, field, val) => {
    const arr = [...custForm.material_preferences];
    arr[idx][field] = val;
    if (field === "material_type" && meta?.material_units) {
      arr[idx].unit = meta.material_units[val]?.[0] || "ton";
    }
    setCustForm(prev => ({ ...prev, material_preferences: arr }));
  };
  const addCustTruck = () => {
    setCustForm(prev => ({
      ...prev,
      trucks: [...prev.trucks, { license_plate: "", driver_name: "", vehicle_type: "Colt Diesel" }]
    }));
  };
  const updateCustTruck = (idx, field, val) => {
    const arr = [...custForm.trucks];
    arr[idx][field] = val;
    setCustForm(prev => ({ ...prev, trucks: arr }));
  };
  const removeCustTruck = (idx) => {
    setCustForm(prev => ({ ...prev, trucks: prev.trucks.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Proyek & Pelanggan</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola data proyek, target material, dan pelanggan tetap</p>
        </div>
        {isGM && (
          <button
            onClick={() => activeTab === "projects" ? openProjModal() : openCustModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={16} /> Tambah {activeTab === "projects" ? "Proyek" : "Pelanggan"}
          </button>
        )}
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "projects" ? "bg-white shadow text-emerald-700" : "text-gray-600 hover:text-gray-800"}`}
        >
          <Briefcase size={16} /> Project
        </button>
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "customers" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"}`}
        >
          <Users size={16} /> Customer
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : activeTab === "projects" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nama Proyek & Klien</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Lokasi</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Target Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Status</th>
                  {isGM && <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projects.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.client_name || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.location || "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {p.material_items.length === 0 ? "-" : (
                        <ul className="list-disc pl-4">
                          {p.material_items.map(m => (
                            <li key={m.id}>{m.target_quantity} {m.unit} {m.material_type}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    {isGM && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => openProjModal(p)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={15} /></button>
                        <button onClick={() => setConfirmDelete(p)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">Belum ada proyek</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Nama / Perusahaan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kontak</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Armada Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Preferensi Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Total Pembelian</th>
                  {isGM && <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map(c => (
                  <tr key={c.id} onClick={() => setViewCust(c)} className="hover:bg-emerald-50/60 cursor-pointer transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.company || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <p>{c.phone || "-"}</p>
                      <p>{c.contact_person || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {!c.trucks || c.trucks.length === 0 ? "-" : (
                        <span className="text-gray-500 font-medium">{c.trucks.length} Kendaraan terdaftar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {c.material_preferences.length === 0 ? "-" : (
                        <div className="flex flex-col gap-1">
                          {c.material_preferences.map((m, i) => (
                            <span key={i} className="bg-gray-100 px-2 py-0.5 rounded w-fit">
                              {m.material_type} ({m.unit})
                              {m.vehicle_type ? ` - ${m.vehicle_type}` : ""}
                              {m.unit_price ? ` - ${formatIDR(m.unit_price)}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald-700 whitespace-nowrap">
                      {formatIDR(c.total_purchases)} <span className="text-gray-400 font-normal text-xs">({c.purchase_count}x)</span>
                    </td>
                    {isGM && (
                      <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openCustModal(c)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={15} /></button>
                        <button onClick={() => setConfirmDelete(c)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">Belum ada pelanggan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 whitespace-nowrap border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editData ? "Edit Proyek" : "Tambah Proyek"}</h2>
              <button onClick={() => setShowProjModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={saveProject} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Nama Proyek *</label>
                  <input required value={projForm.name} onChange={e => setProjForm(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Klien / Pemesan</label>
                  <input value={projForm.client_name} onChange={e => setProjForm(p => ({...p, client_name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Lokasi</label>
                  <input value={projForm.location} onChange={e => setProjForm(p => ({...p, location: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select value={projForm.status} onChange={e => setProjForm(p => ({...p, status: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Target Material</h3>
                  <button type="button" onClick={addProjMaterial} className="text-xs flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                    <Plus size={14}/> Tambah Material
                  </button>
                </div>
                {projForm.material_items.map((m, idx) => (
                  <div key={idx} className="flex items-end gap-2 mb-2 p-2 bg-gray-50 rounded border">
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Material</label>
                      <select value={m.material_type} onChange={e => updateProjMaterial(idx, "material_type", e.target.value)} className="w-full border rounded text-sm p-1.5">
                        {meta?.material_types.map(mt => <option key={mt} value={mt}>{mt}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs mb-1">Target Qty</label>
                      <input type="number" required value={m.target_quantity} onChange={e => updateProjMaterial(idx, "target_quantity", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs mb-1">Satuan</label>
                      <select value={m.unit} onChange={e => updateProjMaterial(idx, "unit", e.target.value)} className="w-full border rounded text-sm p-1.5">
                        {(meta?.material_units[m.material_type] || meta?.all_units || []).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Harga/Satuan (opsional)</label>
                      <input type="number" placeholder="Rp..." value={m.unit_price} onChange={e => updateProjMaterial(idx, "unit_price", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                    </div>
                    <button type="button" onClick={() => removeProjMaterial(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded mb-0.5"><Trash2 size={14}/></button>
                  </div>
                ))}
                {projForm.material_items.length === 0 && <p className="text-xs text-gray-400 italic">Belum ada target material.</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowProjModal(false)} className="px-4 py-2 border rounded-xl text-sm">Batal</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Simpan Proyek</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 whitespace-nowrap border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editData ? "Edit Pelanggan" : "Tambah Pelanggan"}</h2>
              <button onClick={() => setShowCustModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={saveCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Nama Customer *</label>
                  <input required value={custForm.name} onChange={e => setCustForm(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Contoh: UD Maju" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Perusahaan</label>
                  <input value={custForm.company} onChange={e => setCustForm(p => ({...p, company: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Kontak Person</label>
                  <input value={custForm.contact_person} onChange={e => setCustForm(p => ({...p, contact_person: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm mb-1">No. HP / Telepon</label>
                  <input value={custForm.phone} onChange={e => setCustForm(p => ({...p, phone: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm mb-1">Alamat</label>
                  <input value={custForm.address} onChange={e => setCustForm(p => ({...p, address: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Preferensi Material (Kontinu)</h3>
                  <button type="button" onClick={addCustMaterial} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    <Plus size={14}/> Tambah Preferensi
                  </button>
                </div>
                {custForm.material_preferences.map((m, idx) => (
                  <div key={idx} className="flex items-end gap-2 mb-2 p-2 bg-gray-50 rounded border">
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Material</label>
                      <select value={m.material_type} onChange={e => updateCustMaterial(idx, "material_type", e.target.value)} className="w-full border rounded text-sm p-1.5">
                        {meta?.material_types.map(mt => <option key={mt} value={mt}>{mt}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs mb-1">Satuan</label>
                      <select value={m.unit} onChange={e => updateCustMaterial(idx, "unit", e.target.value)} className="w-full border rounded text-sm p-1.5">
                        {(meta?.material_units[m.material_type] || meta?.all_units || []).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Jenis Kendaraan *</label>
                      <select value={m.vehicle_type || "Tronton"} onChange={e => updateCustMaterial(idx, "vehicle_type", e.target.value)} className="w-full border rounded text-sm p-1.5" required>
                        <option value="Tronton">Tronton</option>
                        <option value="Colt Diesel">Colt Diesel</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs mb-1">Harga/Satuan (opsional)</label>
                      <input type="number" placeholder="Rp..." value={m.unit_price || ""} onChange={e => updateCustMaterial(idx, "unit_price", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                    </div>
                    <button type="button" onClick={() => removeCustMaterial(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded mb-0.5"><Trash2 size={14}/></button>
                  </div>
                ))}
                {custForm.material_preferences.length === 0 && <p className="text-xs text-gray-400 italic">Tambahkan preferensi harga material jika ada.</p>}
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Armada Kendaraan (Opsional)</h3>
                  <button type="button" onClick={addCustTruck} className="text-xs flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded">
                    <Plus size={14}/> Tambah Kendaraan
                  </button>
                </div>
                {custForm.trucks.map((t, idx) => (
                  <div key={idx} className="flex items-end gap-2 mb-2 p-2 bg-gray-50 rounded border flex-wrap">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs mb-1">Plat Nomor *</label>
                      <input type="text" required placeholder="Contoh: B 1234 CD" value={t.license_plate} onChange={e => updateCustTruck(idx, "license_plate", e.target.value)} className="w-full border rounded text-sm p-1.5 uppercase" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs mb-1">Nama Supir</label>
                      <input type="text" placeholder="Contoh: Budi" value={t.driver_name || ""} onChange={e => updateCustTruck(idx, "driver_name", e.target.value)} className="w-full border rounded text-sm p-1.5" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs mb-1">Jenis Kendaraan *</label>
                      <select value={t.vehicle_type} onChange={e => updateCustTruck(idx, "vehicle_type", e.target.value)} className="w-full border rounded text-sm p-1.5" required>
                        <option value="Colt Diesel">Colt Diesel</option>
                        <option value="Tronton">Tronton</option>
                      </select>
                    </div>
                    <button type="button" onClick={() => removeCustTruck(idx)} className="p-2 text-red-500 hover:bg-red-100 rounded mb-0.5"><Trash2 size={14}/></button>
                  </div>
                ))}
                {custForm.trucks.length === 0 && <p className="text-xs text-gray-400 italic">Tambahkan data armada jika penjualan dikaitkan dengan nopol.</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowCustModal(false)} className="px-4 py-2 border rounded-xl text-sm">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold">Simpan Pelanggan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {viewCust && !showCustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewCust(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-800">Detail Pelanggan</h2>
              </div>
              <button onClick={() => setViewCust(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800">{viewCust.name}</h3>
                {viewCust.company && <p className="text-gray-500 text-sm">{viewCust.company}</p>}
                
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400 block text-xs">Kontak Person</span>
                    <span className="font-medium text-gray-800">{viewCust.contact_person || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-xs">Telepon</span>
                    <span className="font-medium text-gray-800">{viewCust.phone || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-xs">Email</span>
                    <span className="font-medium text-gray-800">{viewCust.email || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-xs">Alamat</span>
                    <span className="font-medium text-gray-800">{viewCust.address || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Armada Kendaraan */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Armada Kendaraan ({viewCust.trucks?.length || 0})</h4>
                {!viewCust.trucks || viewCust.trucks.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Belum ada armada yang didaftarkan.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {viewCust.trucks.map((t, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-bold text-gray-800 block">{t.license_plate}</span>
                          <span className="text-xs text-gray-500">Supir: {t.driver_name || "Tanpa Nama"}</span>
                        </div>
                        <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                          {t.vehicle_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preferensi Material */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Preferensi Material</h4>
                {viewCust.material_preferences.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Belum ada preferensi material.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {viewCust.material_preferences.map((m, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-bold text-gray-800 block">{m.material_type} ({m.unit})</span>
                          {m.vehicle_type && <span className="text-xs text-gray-500">Kendaraan: {m.vehicle_type}</span>}
                        </div>
                        {m.unit_price && (
                          <span className="text-sm font-bold text-emerald-600">
                            {formatIDR(m.unit_price)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isGM && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl bg-gray-50 mt-auto">
                <button
                  onClick={() => {
                    openCustModal(viewCust);
                    setViewCust(null);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Pencil size={15} /> Edit Data
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm">
            <Trash2 size={30} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Hapus {activeTab === "projects" ? "Proyek" : "Pelanggan"}?</h3>
            <p className="text-sm text-gray-500 mb-6">{confirmDelete.name}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 border rounded-xl">Batal</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}