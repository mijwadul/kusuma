import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  FolderOpen,
  ShoppingCart,
  Plus,
  Pencil,
  Trash2,
  X,
  Calendar,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { API_URL } from "../api/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const PAYMENT_TERMS = ["dp", "termin_1", "termin_2", "pelunasan", "lain-lain"];
const MATERIAL_TYPES = [
  "Limestone (urugan)",
  "Dolomite",
  "Boulder",
  "Clay",
];
const MATERIAL_UNITS = {
  "Limestone (urugan)": ["m3", "ritase"],
  Dolomite: ["ton", "ritase"],
  Boulder: ["ton"],
  Clay: ["ton", "ritase"],
};
const ALL_UNITS = ["m3", "ton", "ritase"];
const TABS = [
  { key: "all", label: "📂 Semua" },
  { key: "project_payment", label: "📁 Pembayaran Proyek" },
  { key: "material_sale", label: "🪨 Penjualan Material" },
];

// Shared fetch with auth
const authFetchHelper = async (url, options = {}) => {
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
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

// ── Sub-components ───────────────────────────────────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
      <p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p>
    </div>
  </div>
);

const defaultProjectForm = () => ({
  income_date: todayStr(),
  project_id: "",
  payment_term: "dp",
  amount: "",
  payment_method: "transfer",
  description: "",
  notes: "",
});

const defaultMaterialForm = () => ({
  income_date: todayStr(),
  customer_name: "",
  material_type: MATERIAL_TYPES[0],
  quantity: "",
  unit: MATERIAL_UNITS[MATERIAL_TYPES[0]][0],
  unit_price: "",
  amount: "",
  payment_method: "transfer",
  description: "",
  notes: "",
});

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
const IncomePage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  // Date filter — default 30 hari terakhir
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(todayStr());

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState("project_payment");
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [projectForm, setProjectForm] = useState(defaultProjectForm());
  const [materialForm, setMaterialForm] = useState(defaultMaterialForm());
  const [priceHint, setPriceHint] = useState(null); // {price, unit, is_custom}

  // ── Fetch records ──
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = activeTab !== "all" ? `&income_type=${activeTab}` : "";
      const data = await authFetchHelper(
        `${API_URL}/income-records?start_date=${startDate}&end_date=${endDate}${typeParam}`,
      );
      setRecords(
        Array.isArray(data) ? data : (data?.records ?? data?.items ?? []),
      );
    } catch {
      toast.error("Gagal memuat data pemasukan");
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate]);

  // ── Fetch projects for dropdown ──
  const fetchProjects = useCallback(async () => {
    try {
      const data = await authFetchHelper(`${API_URL}/dashboard/projects`);
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-fill description when project + termin berubah
  useEffect(() => {
    if (!projectForm.project_id || !projectForm.payment_term) return;
    const proj = projects.find(
      (p) => String(p.id) === String(projectForm.project_id),
    );
    if (!proj) return;
    const termLabel =
      {
        dp: "DP",
        termin_1: "Termin 1",
        termin_2: "Termin 2",
        pelunasan: "Pelunasan",
        "lain-lain": "Lain-lain",
      }[projectForm.payment_term] ?? projectForm.payment_term;
    setProjectForm((prev) => ({
      ...prev,
      description: `${termLabel} - ${proj.name ?? proj.project_name ?? ""}`,
    }));
  }, [projectForm.project_id, projectForm.payment_term, projects]);

  // Auto-calculate amount = qty × unit_price
  useEffect(() => {
    const qty = parseFloat(materialForm.quantity);
    const price = parseFloat(materialForm.unit_price);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      setMaterialForm((prev) => ({ ...prev, amount: String(qty * price) }));
    }
  }, [materialForm.quantity, materialForm.unit_price]);

  // Auto-fill unit_price from material price API
  useEffect(() => {
    const { material_type, unit, customer_name } = materialForm;
    if (!material_type || !unit) return;
    let cancelled = false;
    const lookup = async () => {
      try {
        const params = new URLSearchParams({ material_type, unit });
        if (customer_name.trim()) params.set("customer_name", customer_name.trim());
        const data = await authFetchHelper(`${API_URL}/material-prices/lookup?${params}`);
        if (cancelled) return;
        if (data?.found) {
          setMaterialForm((prev) => ({ ...prev, unit_price: String(data.price_per_unit) }));
          setPriceHint({ price: data.price_per_unit, unit, is_custom: data.is_custom });
        } else {
          setPriceHint(null);
        }
      } catch {
        if (!cancelled) setPriceHint(null);
      }
    };
    const timer = setTimeout(lookup, 400); // debounce 400ms
    return () => { cancelled = true; clearTimeout(timer); };
  }, [materialForm.material_type, materialForm.unit, materialForm.customer_name]);

  // ── Summary ──
  const summary = {
    total: records.reduce((s, r) => s + (r.amount || 0), 0),
    project: records
      .filter((r) => r.income_type === "project_payment")
      .reduce((s, r) => s + (r.amount || 0), 0),
    material: records
      .filter((r) => r.income_type === "material_sale")
      .reduce((s, r) => s + (r.amount || 0), 0),
    count: records.length,
  };

  // ── Modal helpers ──
  const openAddModal = () => {
    setEditId(null);
    setProjectForm(defaultProjectForm());
    setMaterialForm(defaultMaterialForm());
    setPriceHint(null);
    setModalTab(
      activeTab === "material_sale" ? "material_sale" : "project_payment",
    );
    setShowModal(true);
  };

  const openEditModal = (r) => {
    setEditId(r.id);
    if (r.income_type === "project_payment") {
      setModalTab("project_payment");
      setProjectForm({
        income_date: r.income_date ?? todayStr(),
        project_id: String(r.project_id ?? ""),
        payment_term: r.payment_term ?? "dp",
        amount: String(r.amount ?? ""),
        payment_method: r.payment_method ?? "transfer",
        description: r.description ?? "",
        notes: r.notes ?? "",
      });
    } else {
      setModalTab("material_sale");
      setMaterialForm({
        income_date: r.income_date ?? todayStr(),
        customer_name: r.customer_name ?? "",
        material_type: r.material_type ?? "",
        quantity: String(r.quantity ?? ""),
        unit: r.unit ?? "m3",
        unit_price: String(r.unit_price ?? ""),
        amount: String(r.amount ?? ""),
        payment_method: r.payment_method ?? "transfer",
        description: r.description ?? "",
        notes: r.notes ?? "",
      });
    }
    setPriceHint(null);
    setShowModal(true);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let body;
      if (modalTab === "project_payment") {
        body = {
          income_type: "project_payment",
          income_date: projectForm.income_date,
          project_id: parseInt(projectForm.project_id),
          payment_term: projectForm.payment_term,
          amount: parseFloat(projectForm.amount),
          payment_method: projectForm.payment_method,
          description: projectForm.description,
          ...(projectForm.notes ? { notes: projectForm.notes } : {}),
        };
      } else {
        body = {
          income_type: "material_sale",
          income_date: materialForm.income_date,
          customer_name: materialForm.customer_name,
          material_type: materialForm.material_type || undefined,
          quantity: parseFloat(materialForm.quantity) || undefined,
          unit: materialForm.unit || undefined,
          unit_price: parseFloat(materialForm.unit_price) || undefined,
          amount: parseFloat(materialForm.amount),
          payment_method: materialForm.payment_method,
          description: materialForm.description,
          ...(materialForm.notes ? { notes: materialForm.notes } : {}),
        };
      }

      if (editId) {
        await authFetchHelper(`${API_URL}/income-records/${editId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Pemasukan berhasil diupdate");
      } else {
        await authFetchHelper(`${API_URL}/income-records`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Pemasukan berhasil ditambahkan");
      }

      setShowModal(false);
      fetchRecords();
    } catch (err) {
      toast.error(`Gagal menyimpan: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Hapus data pemasukan ini? Tindakan tidak dapat dibatalkan.",
      )
    )
      return;
    try {
      await authFetchHelper(`${API_URL}/income-records/${id}`, {
        method: "DELETE",
      });
      toast.success("Data berhasil dihapus");
      fetchRecords();
    } catch {
      toast.error("Gagal menghapus data");
    }
  };

  // ── Badge helpers ──
  const paymentBadge = (method) => (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        method === "transfer"
          ? "bg-blue-100 text-blue-700"
          : "bg-green-100 text-green-700"
      }`}
    >
      {method === "transfer" ? "Transfer" : "Cash"}
    </span>
  );

  const typeBadge = (type) => (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        type === "project_payment"
          ? "bg-blue-100 text-blue-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {type === "project_payment" ? "Proyek" : "Material"}
    </span>
  );

  const termBadge = (term) => (
    <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium capitalize">
      {term?.replace(/_/g, " ") ?? "-"}
    </span>
  );

  const actionButtons = (r) => (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => openEditModal(r)}
        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
        title="Edit"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleDelete(r.id)}
        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Hapus"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  // ── Field components ──
  const inputCls = (ring = "blue") =>
    `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-${ring}-300`;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            Pemasukan &amp; Pendapatan
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola pemasukan dari proyek dan penjualan material
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Tambah Pemasukan
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={DollarSign}
          label="Total Periode Ini"
          value={formatIDR(summary.total)}
          color="bg-emerald-500"
        />
        <SummaryCard
          icon={FolderOpen}
          label="Dari Proyek"
          value={formatIDR(summary.project)}
          color="bg-blue-500"
        />
        <SummaryCard
          icon={ShoppingCart}
          label="Penjualan Material"
          value={formatIDR(summary.material)}
          color="bg-amber-500"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Jumlah Transaksi"
          value={summary.count}
          color="bg-purple-500"
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="tabs-scrollable bg-gray-100 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Filter ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Dari:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sampai:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <button
          onClick={() => {
            setStartDate(daysAgo(30));
            setEndDate(todayStr());
          }}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset ke 30 hari
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Memuat data…
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada data pemasukan pada periode ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Tab: Semua */}
            {activeTab === "all" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Tipe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Deskripsi
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Jumlah
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Metode
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.income_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{typeBadge(r.income_type)}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate whitespace-nowrap">
                        {r.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">
                        {formatIDR(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {paymentBadge(r.payment_method)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{actionButtons(r)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-xs font-semibold text-gray-500"
                    >
                      Total ({records.length} transaksi)
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatIDR(summary.total)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Tab: Pembayaran Proyek */}
            {activeTab === "project_payment" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Proyek
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Termin
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Jumlah
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Metode
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.income_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">
                        {r.project_name ?? r.description ?? "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{termBadge(r.payment_term)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">
                        {formatIDR(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {paymentBadge(r.payment_method)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{actionButtons(r)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-2 text-xs font-semibold text-gray-500"
                    >
                      Total ({records.length} pembayaran)
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-blue-700 tabular-nums whitespace-nowrap">
                      {formatIDR(summary.project)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Tab: Penjualan Material */}
            {activeTab === "material_sale" && (
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Material
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.income_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">
                        {r.customer_name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r.material_type ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums whitespace-nowrap">
                        {r.quantity
                          ? `${Number(r.quantity).toLocaleString("id-ID")} ${r.unit ?? ""}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">
                        {formatIDR(r.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{actionButtons(r)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-xs font-semibold text-gray-500"
                    >
                      Total ({records.length} penjualan)
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatIDR(summary.material)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-gray-800">
                {editId ? "Edit Pemasukan" : "Tambah Pemasukan"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tipe tabs (hanya saat tambah baru) */}
            {!editId && (
              <div className="flex gap-2 px-6 pt-4">
                <button
                  type="button"
                  onClick={() => setModalTab("project_payment")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    modalTab === "project_payment"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📁 Pembayaran Proyek
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("material_sale")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    modalTab === "material_sale"
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🪨 Penjualan Material
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-4 whitespace-nowrap space-y-4">
              {/* ── Form: Pembayaran Proyek ── */}
              {modalTab === "project_payment" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={projectForm.income_date}
                      onChange={(e) =>
                        setProjectForm((p) => ({
                          ...p,
                          income_date: e.target.value,
                        }))
                      }
                      className={inputCls("blue")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proyek <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={projectForm.project_id}
                      onChange={(e) =>
                        setProjectForm((p) => ({
                          ...p,
                          project_id: e.target.value,
                        }))
                      }
                      className={inputCls("blue")}
                    >
                      <option value="">-- Pilih Proyek --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name ?? p.project_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Termin Pembayaran
                    </label>
                    <select
                      value={projectForm.payment_term}
                      onChange={(e) =>
                        setProjectForm((p) => ({
                          ...p,
                          payment_term: e.target.value,
                        }))
                      }
                      className={inputCls("blue")}
                    >
                      {PAYMENT_TERMS.map((t) => (
                        <option key={t} value={t}>
                          {t
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jumlah (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={projectForm.amount}
                      onChange={(e) =>
                        setProjectForm((p) => ({
                          ...p,
                          amount: e.target.value,
                        }))
                      }
                      placeholder="5000000"
                      className={inputCls("blue")}
                    />
                    {projectForm.amount && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatIDR(projectForm.amount)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      value={projectForm.payment_method}
                      onChange={(e) =>
                        setProjectForm((p) => ({
                          ...p,
                          payment_method: e.target.value,
                        }))
                      }
                      className={inputCls("blue")}
                    >
                      <option value="transfer">Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={projectForm.description}
                      onChange={(e) =>
                        setProjectForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Deskripsi pembayaran"
                      className={inputCls("blue")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan{" "}
                      <span className="text-xs text-gray-400">(opsional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={projectForm.notes}
                      onChange={(e) =>
                        setProjectForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      placeholder="Catatan tambahan"
                      className={`${inputCls("blue")} resize-none`}
                    />
                  </div>
                </>
              )}

              {/* ── Form: Penjualan Material ── */}
              {modalTab === "material_sale" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={materialForm.income_date}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          income_date: e.target.value,
                        }))
                      }
                      className={inputCls("emerald")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Customer <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={materialForm.customer_name}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          customer_name: e.target.value,
                        }))
                      }
                      placeholder="CV. ABC / Pak Budi"
                      className={inputCls("emerald")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jenis Material <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={materialForm.material_type}
                      onChange={(e) => {
                        const mat = e.target.value;
                        const units = MATERIAL_UNITS[mat] || [];
                        setMaterialForm((p) => ({
                          ...p,
                          material_type: mat,
                          unit: units[0] || "ton",
                          unit_price: "",
                        }));
                        setPriceHint(null);
                      }}
                      className={inputCls("emerald")}
                    >
                      {MATERIAL_TYPES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kuantitas
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={materialForm.quantity}
                        onChange={(e) =>
                          setMaterialForm((p) => ({
                            ...p,
                            quantity: e.target.value,
                          }))
                        }
                        placeholder="100"
                        className={inputCls("emerald")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Satuan
                      </label>
                      <select
                        value={materialForm.unit}
                        onChange={(e) =>
                          setMaterialForm((p) => ({
                            ...p,
                            unit: e.target.value,
                            unit_price: "",
                          }))
                        }
                        className={inputCls("emerald")}
                      >
                        {(MATERIAL_UNITS[materialForm.material_type] || ALL_UNITS).map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      Harga Satuan (Rp)
                      {priceHint && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          priceHint.is_custom
                            ? "bg-blue-100 text-blue-600"
                            : "bg-emerald-100 text-emerald-600"
                        }`}>
                          {priceHint.is_custom ? "✓ harga customer" : "✓ harga default"}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={materialForm.unit_price}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          unit_price: e.target.value,
                        }))
                      }
                      placeholder="50000"
                      className={inputCls("emerald")}
                    />
                    {materialForm.unit_price && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatIDR(materialForm.unit_price)} / {materialForm.unit}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total (Rp) <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-400 ml-1 font-normal">
                        auto = qty × harga satuan
                      </span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={materialForm.amount}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          amount: e.target.value,
                        }))
                      }
                      placeholder="5000000"
                      className={inputCls("emerald")}
                    />
                    {materialForm.amount && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatIDR(materialForm.amount)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      value={materialForm.payment_method}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          payment_method: e.target.value,
                        }))
                      }
                      className={inputCls("emerald")}
                    >
                      <option value="transfer">Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={materialForm.description}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Penjualan pasir sungai ke CV. ABC"
                      className={inputCls("emerald")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan{" "}
                      <span className="text-xs text-gray-400">(opsional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={materialForm.notes}
                      onChange={(e) =>
                        setMaterialForm((p) => ({
                          ...p,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Catatan tambahan"
                      className={`${inputCls("emerald")} resize-none`}
                    />
                  </div>
                </>
              )}

              {/* Form actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                    modalTab === "project_payment"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editId ? "Simpan Perubahan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomePage;
