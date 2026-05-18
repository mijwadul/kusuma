import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Package, Plus, Pencil, Trash2, X, Loader2, Tag, Users,
  ChevronDown, BadgeCheck, Star, ShoppingCart, Settings, Truck
} from "lucide-react";
import { API_URL } from "../api/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split("T")[0];
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

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

// ── Components ─────────────────────────────────────────────────────────────────
const MaterialBadge = ({ type, meta }) => {
  // Simple color hashing based on name if meta colors not provided
  let bg = "bg-emerald-50"; let text = "text-emerald-700"; let dot = "bg-emerald-400";
  if (type === "Limestone (urugan)") { bg = "bg-amber-50"; text = "text-amber-700"; dot = "bg-amber-400"; }
  if (type === "Dolomite") { bg = "bg-blue-50"; text = "text-blue-700"; dot = "bg-blue-400"; }
  if (type === "Boulder") { bg = "bg-stone-50"; text = "text-stone-700"; dot = "bg-stone-400"; }
  if (type === "Clay") { bg = "bg-orange-50"; text = "text-orange-700"; dot = "bg-orange-400"; }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {type}
    </span>
  );
};

// ── Modals ─────────────────────────────────────────────────────────────────────
const SaleFormModal = ({ editData, onClose, onSaved, meta, customers, equipment }) => {
  const [form, setForm] = useState({
    income_date: editData?.income_date || todayStr(),
    customer_name: editData?.customer_name || "",
    license_plate: editData?.license_plate || "",
    vehicle_type: editData?.vehicle_type || "Colt Diesel",
    material_type: editData?.material_type || meta?.material_types?.[0] || "",
    unit: editData?.unit || (meta?.material_units?.[meta?.material_types?.[0]]?.[0]) || "ton",
    quantity: editData?.quantity || "",
    unit_price: editData?.unit_price || "",
    amount: editData?.amount || "",
    payment_method: editData?.payment_method || "transfer",
    notes: editData?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [priceHint, setPriceHint] = useState(null);

  // Auto calculate amount
  useEffect(() => {
    const q = parseFloat(form.quantity) || 0;
    const p = parseFloat(form.unit_price) || 0;
    if (q > 0 && p > 0) {
      setForm(prev => ({ ...prev, amount: (q * p).toString() }));
    }
  }, [form.quantity, form.unit_price]);

  // Auto lookup price
  useEffect(() => {
    const { material_type, unit, customer_name } = form;
    if (!material_type || !unit) return;
    
    let cancelled = false;
    const lookup = async () => {
      try {
        const params = new URLSearchParams({ material_type, unit });
        if (customer_name.trim()) params.set("customer_name", customer_name.trim());
        const data = await authFetch(`/api/v1/material-prices/lookup?${params}`);
        if (cancelled) return;
        
        if (data?.found) {
          setForm(prev => ({ ...prev, unit_price: String(data.price_per_unit) }));
          setPriceHint({ is_custom: data.is_custom });
        } else {
          setPriceHint(null);
        }
      } catch {
        if (!cancelled) setPriceHint(null);
      }
    };
    
    const timer = setTimeout(lookup, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.material_type, form.unit, form.customer_name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        income_date: form.income_date,
        income_type: "material_sale",
        description: `Penjualan ${form.material_type} - ${form.customer_name}`,
        amount: parseFloat(form.amount) || 0,
        customer_name: form.customer_name,
        license_plate: form.license_plate,
        vehicle_type: form.vehicle_type,
        material_type: form.material_type,
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        unit_price: parseFloat(form.unit_price) || 0,
        payment_method: form.payment_method,
        notes: form.notes
      };

      if (editData) {
        await authFetch(`/api/v1/income-records/${editData.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await authFetch(`/api/v1/income-records`, { method: "POST", body: JSON.stringify(payload) });
      }
      toast.success("Penjualan berhasil dicatat");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{editData ? "Edit Penjualan" : "Catat Penjualan"}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
              <input type="date" required value={form.income_date} onChange={e => setForm(p => ({...p, income_date: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pembeli / Customer</label>
              <input 
                type="text" 
                required 
                list="customers-list"
                value={form.customer_name} 
                onChange={e => setForm(p => ({...p, customer_name: e.target.value}))} 
                placeholder="Pilih atau ketik baru..."
                className={inputCls} 
              />
              <datalist id="customers-list">
                {customers.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plat Nomor</label>
              <input 
                type="text" 
                list="equipment-list"
                value={form.license_plate} 
                onChange={e => setForm(p => ({...p, license_plate: e.target.value}))} 
                placeholder="Nopol Truk..."
                className={inputCls} 
              />
              <datalist id="equipment-list">
                {equipment.map(e => <option key={e.id} value={e.license_plate || e.name}>{e.name}</option>)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kendaraan</label>
              <select value={form.vehicle_type} onChange={e => setForm(p => ({...p, vehicle_type: e.target.value}))} className={inputCls}>
                <option value="Colt Diesel">Colt Diesel</option>
                <option value="Tronton">Tronton</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Material</label>
            <select 
              value={form.material_type} 
              onChange={e => {
                const mat = e.target.value;
                setForm(p => ({
                  ...p, material_type: mat, 
                  unit: meta?.material_units?.[mat]?.[0] || "ton", 
                  unit_price: "" 
                }));
                setPriceHint(null);
              }} 
              className={inputCls}
            >
              {meta?.material_types?.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kuantitas</label>
              <input type="number" step="0.01" required value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Satuan</label>
              <select value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value, unit_price: ""}))} className={inputCls}>
                {(meta?.material_units?.[form.material_type] || meta?.all_units || []).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                Harga/Satuan
                {priceHint && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priceHint.is_custom ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {priceHint.is_custom ? "Harga Customer" : "Harga Default"}
                  </span>
                )}
              </label>
              <input type="number" required value={form.unit_price} onChange={e => setForm(p => ({...p, unit_price: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Harga</label>
              <input type="number" required value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} className={`${inputCls} bg-gray-50`} />
              {form.amount && <p className="text-xs text-gray-500 mt-1">{formatIDR(form.amount)}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Metode Pembayaran</label>
            <select value={form.payment_method} onChange={e => setForm(p => ({...p, payment_method: e.target.value}))} className={inputCls}>
              <option value="transfer">Transfer</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-medium">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
              {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Simpan Penjualan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const PriceFormModal = ({ editData, onClose, onSaved, meta }) => {
  const [form, setForm] = useState({
    material_type: editData?.material_type || meta?.material_types?.[0] || "",
    unit: editData?.unit || meta?.material_units?.[meta?.material_types?.[0]]?.[0] || "ton",
    price_per_unit: editData?.price_per_unit ?? "",
    is_active: editData?.is_active ?? true,
    notes: editData?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        customer_name: null, // Always Default
        price_per_unit: parseFloat(form.price_per_unit),
      };
      if (editData) {
        await authFetch(`/api/v1/material-prices/${editData.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await authFetch(`/api/v1/material-prices`, { method: "POST", body: JSON.stringify(body) });
      }
      toast.success("Harga berhasil disimpan");
      onSaved();
    } catch (err) {
      toast.error("Gagal menyimpan harga");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{editData ? "Edit Harga" : "Tambah Harga"}</h2>
          <button onClick={onClose} className="p-2"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm mb-1.5">Material</label>
            <select value={form.material_type} onChange={(e) => {
              const m = e.target.value;
              setForm(p => ({...p, material_type: m, unit: meta?.material_units?.[m]?.[0] || "ton"}));
            }} className={inputCls}>
              {meta?.material_types?.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1.5">Satuan</label>
              <select value={form.unit} onChange={(e) => setForm(p => ({ ...p, unit: e.target.value }))} className={inputCls}>
                {(meta?.material_units?.[form.material_type] || meta?.all_units || []).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1.5">Harga / Satuan</label>
              <input type="number" required min={0} value={form.price_per_unit} onChange={(e) => setForm(p => ({ ...p, price_per_unit: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded text-emerald-600" />
            <label htmlFor="is_active" className="text-sm">Aktif</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-xl text-sm">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold flex justify-center">{saving ? <Loader2 className="animate-spin" size={20}/> : "Simpan Harga"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ── Sale Detail Modal ──────────────────────────────────────────────────────────
const SaleDetailModal = ({ sale, isGM, currentUser, onClose, onEdit, onDelete }) => {
  const canEdit = isGM || sale.created_by === currentUser?.id;
  const rows = [
    { label: "Tanggal",         value: formatDate(sale.income_date) },
    { label: "Customer",        value: sale.customer_name || "-" },
    { label: "Plat Nomor",      value: sale.license_plate || "-" },
    { label: "Jenis Kendaraan", value: sale.vehicle_type || "-" },
    { label: "Material",        value: <MaterialBadge type={sale.material_type} /> },
    { label: "Volume",          value: `${Number(sale.quantity).toLocaleString("id-ID")} ${sale.unit}` },
    { label: "Harga / Satuan",  value: formatIDR(sale.unit_price) },
    { label: "Total",           value: <span className="text-emerald-700 font-bold text-base">{formatIDR(sale.amount)}</span> },
    { label: "Pembayaran",      value: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sale.payment_method === "cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{sale.payment_method === "cash" ? "Cash" : "Transfer"}</span> },
    ...(sale.notes ? [{ label: "Catatan", value: sale.notes }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-600" />
            <h2 className="text-base font-semibold text-gray-800">Detail Penjualan</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">{label}</span>
              <span className="text-sm text-gray-800 text-right">{value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-gray-50">
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors"
            >
              <Trash2 size={15} /> Hapus
            </button>
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Pencil size={15} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function MaterialSalesPage() {
  const [activeTab, setActiveTab] = useState("sales"); // sales | prices
  const [currentUser, setCurrentUser] = useState(null);
  
  const [sales, setSales] = useState([]);
  const [prices, setPrices] = useState([]);
  const [meta, setMeta] = useState(null);
  
  const [customers, setCustomers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [viewSale, setViewSale] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
    
    // Fetch lookups
    Promise.all([
      authFetch("/api/v1/projects-data/meta").catch(() => null),
      authFetch("/api/v1/projects-data/customers").catch(() => []),
      authFetch("/api/v1/dashboard/equipment").catch(() => [])
    ]).then(([m, c, e]) => {
      if (m) setMeta(m);
      if (c) setCustomers(c);
      if (e) setEquipment(e);
    });
  }, []);

  const isGM = currentUser?.is_admin || currentUser?.is_superuser || ["gm", "admin"].includes(currentUser?.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "sales") {
        const data = await authFetch(`/api/v1/income-records?income_type=material_sale`);
        setSales(Array.isArray(data) ? data : []);
      } else if (activeTab === "prices") {
        const data = await authFetch(`/api/v1/material-prices`);
        setPrices(Array.isArray(data) ? data : []);
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
      if (activeTab === "sales") {
        await authFetch(`/api/v1/income-records/${confirmDelete.id}`, { method: "DELETE" });
      } else {
        await authFetch(`/api/v1/material-prices/${confirmDelete.id}`, { method: "DELETE" });
      }
      toast.success("Berhasil dihapus");
      fetchData();
    } catch {
      toast.error("Gagal menghapus");
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Penjualan Material</h1>
          <p className="text-sm text-gray-500 mt-1">Catat transaksi material & kelola harga</p>
        </div>
        <div className="flex gap-2">
          {isGM && (
            <button
              onClick={() => setActiveTab(t => t === "sales" ? "prices" : "sales")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === "prices" ? "bg-indigo-100 text-indigo-700" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
            >
              <Settings size={16} /> Atur Harga (GM)
            </button>
          )}
          {activeTab === "sales" && (
            <button
              onClick={() => { setEditData(null); setShowSaleModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Catat Penjualan
            </button>
          )}
          {activeTab === "prices" && (
            <button
              onClick={() => { setEditData(null); setShowPriceModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Tambah Harga
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        ) : activeTab === "sales" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Material</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Volume</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total (Rp)</th>
                  <th className="px-4 py-3 text-center w-8 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setViewSale(s)}
                    className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.income_date)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.customer_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5"><Truck size={12}/> {s.license_plate || "-"}</div>
                      <div className="mt-0.5 text-gray-400">{s.vehicle_type || "-"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><MaterialBadge type={s.material_type} meta={meta} /></td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{s.quantity} {s.unit}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatIDR(s.amount)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-gray-300 text-xs">›</span>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">Belum ada catatan penjualan material.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipe Harga</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Satuan</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Harga</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                  {isGM && <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prices.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap"><MaterialBadge type={p.material_type} meta={meta} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded">Harga Default</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.unit}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">{formatIDR(p.price_per_unit)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {p.is_active ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Aktif</span> : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Nonaktif</span>}
                    </td>
                    {isGM && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button onClick={() => { setEditData(p); setShowPriceModal(true); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={15} /></button>
                        <button onClick={() => setConfirmDelete(p)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSaleModal && <SaleFormModal editData={editData} onClose={() => setShowSaleModal(false)} onSaved={() => { setShowSaleModal(false); fetchData(); }} meta={meta} customers={customers} equipment={equipment} />}
      {showPriceModal && <PriceFormModal editData={editData} onClose={() => setShowPriceModal(false)} onSaved={() => { setShowPriceModal(false); fetchData(); }} meta={meta} />}

      {/* Sale Detail Modal */}
      {viewSale && !showSaleModal && (
        <SaleDetailModal
          sale={viewSale}
          isGM={isGM}
          currentUser={currentUser}
          onClose={() => setViewSale(null)}
          onEdit={() => {
            setEditData(viewSale);
            setViewSale(null);
            setShowSaleModal(true);
          }}
          onDelete={() => {
            setConfirmDelete(viewSale);
            setViewSale(null);
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm">
            <Trash2 size={30} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Hapus Data?</h3>
            <p className="text-sm text-gray-500 mb-6">Tindakan ini tidak dapat dibatalkan.</p>
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
