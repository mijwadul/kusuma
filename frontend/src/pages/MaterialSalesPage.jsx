import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Tag,
  Users,
  ChevronDown,
  BadgeCheck,
  Star,
} from "lucide-react";
import { API_URL } from "../api/auth";

// ── Constants ─────────────────────────────────────────────────────────────────
const MATERIAL_TYPES = ["Limestone (urugan)", "Dolomite", "Boulder", "Clay"];

const MATERIAL_UNITS = {
  "Limestone (urugan)": ["m3", "ritase"],
  Dolomite: ["ton", "ritase"],
  Boulder: ["ton"],
  Clay: ["ton", "ritase"],
};

const MATERIAL_COLORS = {
  "Limestone (urugan)": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  Dolomite: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  Boulder: { bg: "bg-stone-50", text: "text-stone-700", dot: "bg-stone-400" },
  Clay: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

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

// ── Material Badge ─────────────────────────────────────────────────────────────
const MaterialBadge = ({ type }) => {
  const c = MATERIAL_COLORS[type] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {type}
    </span>
  );
};

// ── Empty ──────────────────────────────────────────────────────────────────────
const EmptyState = ({ onAdd }) => (
  <div className="py-16 flex flex-col items-center text-gray-400">
    <Tag size={40} className="mb-3 opacity-30" />
    <p className="text-sm font-medium">Belum ada harga material</p>
    <p className="text-xs mt-1 mb-4">Tambahkan harga untuk mulai mencatat penjualan</p>
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
    >
      <Plus size={15} /> Tambah Harga
    </button>
  </div>
);

// ── Form Modal ─────────────────────────────────────────────────────────────────
const PriceFormModal = ({ editData, onClose, onSaved, currentUser }) => {
  const isGM =
    currentUser?.is_admin ||
    currentUser?.is_superuser ||
    ["gm", "admin"].includes(currentUser?.role);

  const [form, setForm] = useState({
    material_type: editData?.material_type || MATERIAL_TYPES[0],
    customer_name: editData?.customer_name || "",
    unit: editData?.unit || MATERIAL_UNITS[editData?.material_type || MATERIAL_TYPES[0]][0],
    price_per_unit: editData?.price_per_unit ?? "",
    is_active: editData?.is_active ?? true,
    notes: editData?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const availableUnits = MATERIAL_UNITS[form.material_type] || [];

  const handleMaterialChange = (mat) => {
    const units = MATERIAL_UNITS[mat] || [];
    setForm((p) => ({
      ...p,
      material_type: mat,
      unit: units[0] || "ton",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isGM) return toast.error("Hanya GM yang bisa mengatur harga");
    setSaving(true);
    try {
      const body = {
        ...form,
        customer_name: form.customer_name.trim() || null,
        price_per_unit: parseFloat(form.price_per_unit),
      };
      if (editData) {
        await authFetch(`${API_URL}/material-prices/${editData.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Harga berhasil diupdate");
      } else {
        await authFetch(`${API_URL}/material-prices`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Harga berhasil ditambahkan");
      }
      onSaved();
    } catch (err) {
      let msg = err.message;
      try { msg = JSON.parse(msg)?.detail || msg; } catch {}
      toast.error(`Gagal: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {editData ? "Edit Harga Material" : "Tambah Harga Material"}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Material */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Jenis Material <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={form.material_type}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className={input + " appearance-none pr-8"}
              >
                {MATERIAL_TYPES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Customer
              <span className="text-xs text-gray-400 font-normal ml-2">(kosongkan = harga default semua customer)</span>
            </label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
              placeholder="Contoh: PT ABC, UD Maju Jaya — atau kosongkan"
              className={input}
            />
          </div>

          {/* Unit + Harga */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Satuan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className={input + " appearance-none pr-8"}
                >
                  {availableUnits.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Harga / Satuan <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={1000}
                value={form.price_per_unit}
                onChange={(e) => setForm((p) => ({ ...p, price_per_unit: e.target.value }))}
                placeholder="0"
                className={input}
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded text-emerald-600"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Aktif</label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Opsional…"
              className={input + " resize-none"}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || !isGM}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {editData ? "Simpan Perubahan" : "Tambah Harga"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function MaterialSalesPage() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMaterial, setFilterMaterial] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
  }, []);

  const isGM =
    currentUser?.is_admin ||
    currentUser?.is_superuser ||
    ["gm", "admin"].includes(currentUser?.role);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch(`${API_URL}/material-prices`);
      setPrices(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat daftar harga material");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  const handleDelete = async (id) => {
    try {
      await authFetch(`${API_URL}/material-prices/${id}`, { method: "DELETE" });
      toast.success("Harga berhasil dihapus");
      fetchPrices();
    } catch {
      toast.error("Gagal menghapus harga");
    }
    setConfirmDelete(null);
  };

  const openAdd = () => { setEditData(null); setShowModal(true); };
  const openEdit = (p) => { setEditData(p); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditData(null); };
  const onSaved = () => { closeModal(); fetchPrices(); };

  const filtered = filterMaterial === "all"
    ? prices
    : prices.filter((p) => p.material_type === filterMaterial);

  // Group by material for summary cards
  const summary = MATERIAL_TYPES.map((mat) => {
    const entries = prices.filter((p) => p.material_type === mat && p.is_active);
    const customCount = entries.filter((e) => e.customer_name).length;
    const hasDefault = entries.some((e) => !e.customer_name);
    return { mat, total: entries.length, customCount, hasDefault };
  });

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Penjualan Material Tambang</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola harga per material per customer — GM only
          </p>
        </div>
        {isGM && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={16} /> Tambah Harga
          </button>
        )}
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map(({ mat, total, customCount, hasDefault }) => {
          const c = MATERIAL_COLORS[mat];
          return (
            <div
              key={mat}
              onClick={() => setFilterMaterial(filterMaterial === mat ? "all" : mat)}
              className={`cursor-pointer rounded-2xl p-4 border-2 transition-all ${
                filterMaterial === mat
                  ? "border-emerald-400 shadow-md " + c.bg
                  : "border-transparent bg-white shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{mat}</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{total}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {hasDefault ? "✓ ada default" : "– belum ada default"} · {customCount} customer khusus
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {["all", ...MATERIAL_TYPES].map((m) => (
          <button
            key={m}
            onClick={() => setFilterMaterial(m)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterMaterial === m
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "all" ? "Semua" : m}
          </button>
        ))}
      </div>

      {/* ── Price Table ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin" /> Memuat…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Material</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Satuan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Harga / Satuan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Catatan</th>
                  {isGM && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <MaterialBadge type={p.material_type} />
                    </td>
                    <td className="px-4 py-3">
                      {p.customer_name ? (
                        <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <Users size={13} className="text-blue-400" />
                          {p.customer_name}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                          <Star size={12} className="fill-emerald-400 text-emerald-400" />
                          Harga Default
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">
                      {formatIDR(p.price_per_unit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                          <BadgeCheck size={11} /> Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Nonaktif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                      {p.notes || "-"}
                    </td>
                    {isGM && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(p)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Info box ─────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">ℹ️ Cara kerja harga:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600">
          <li><strong>Harga Default</strong> — berlaku untuk semua customer yang tidak punya harga khusus</li>
          <li><strong>Harga Customer</strong> — dipakai otomatis saat nama customer dipilih di form penjualan</li>
          <li>Satu material bisa punya beberapa satuan (m3, ton, ritase) masing-masing dengan harga berbeda</li>
        </ul>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showModal && (
        <PriceFormModal
          editData={editData}
          onClose={closeModal}
          onSaved={onSaved}
          currentUser={currentUser}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Hapus Harga?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <strong>{confirmDelete.material_type}</strong> / {confirmDelete.unit}
            </p>
            <p className="text-xs text-gray-400 mb-5">
              {confirmDelete.customer_name || "Harga Default"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
