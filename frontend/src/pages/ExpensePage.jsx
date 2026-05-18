import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Edit2, Trash2, Filter, RefreshCw,
  ChevronUp, ChevronDown, ChevronsUpDown,
  Receipt, BarChart2, Calendar, AlertCircle, Search, CheckCircle,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '../api/auth';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatIDR = (v) =>
  Number(v).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  });

const toLocalDate = (d) =>
  new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// ─── Config ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'koordinasi',   label: 'Koordinasi',    cls: 'bg-blue-100 text-blue-700' },
  { value: 'administrasi', label: 'Administrasi',  cls: 'bg-purple-100 text-purple-700' },
  { value: 'transport',    label: 'Transport',     cls: 'bg-amber-100 text-amber-700' },
  { value: 'makan',        label: 'Makan',         cls: 'bg-green-100 text-green-700' },
  { value: 'operasional',  label: 'Operasional',   cls: 'bg-orange-100 text-orange-700' },
  { value: 'lain-lain',    label: 'Lain-lain',     cls: 'bg-gray-100 text-gray-700' },
];

const categoryMap = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  expense_date: todayISO(),
  category: 'koordinasi',
  description: '',
  amount: '',
  project_id: '',
  notes: '',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const CategoryBadge = ({ value }) => {
  const cfg = categoryMap[value] ?? { label: value, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={14} className="text-gray-400 ml-1" />;
  return sortDir === 'asc'
    ? <ChevronUp size={14} className="text-accent ml-1" />
    : <ChevronDown size={14} className="text-accent ml-1" />;
};

// ─── Modal ───────────────────────────────────────────────────────────────────

const ExpenseModal = ({ expense, projects, onClose, onSaved }) => {
  const [form, setForm] = useState(expense ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(expense?.id);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return toast.error('Deskripsi wajib diisi.');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Jumlah harus lebih dari 0.');

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        expense_date: form.expense_date,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
        project_id: form.project_id ? Number(form.project_id) : null,
        notes: form.notes.trim() || null,
      };

      const url = isEdit
        ? `${API_URL}/expenses/${expense.id}`
        : `${API_URL}/expenses`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Gagal menyimpan data');
      }

      toast.success(isEdit ? 'Pengeluaran diperbarui!' : 'Pengeluaran ditambahkan!');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="expense_date"
              value={form.expense_date}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={2}
              placeholder="Keterangan pengeluaran..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah (IDR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              required
              min={1}
              step="any"
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              onWheel={(e) => e.target.blur()}
            />
            {form.amount && Number(form.amount) > 0 && (
              <p className="text-xs text-gray-500 mt-1">{formatIDR(form.amount)}</p>
            )}
          </div>

          {/* Project (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <select
              name="project_id"
              value={form.project_id}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">-- Tanpa Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Catatan tambahan..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent-focus"
            >
              {saving && <RefreshCw size={14} className="animate-spin" />}
              {isEdit ? 'Simpan Perubahan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

const DeleteConfirmModal = ({ expense, onCancel, onConfirm, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-100 rounded-full">
          <Trash2 size={20} className="text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Hapus Pengeluaran?</h3>
      </div>
      <p className="text-sm text-gray-600 mb-1">
        <span className="font-medium">{expense?.description}</span>
      </p>
      <p className="text-sm text-red-600 font-semibold mb-5">
        {formatIDR(expense?.amount)}
      </p>
      <p className="text-xs text-gray-500 mb-6">Data yang dihapus tidak dapat dikembalikan.</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
        >
          {deleting && <RefreshCw size={14} className="animate-spin" />}
          Hapus
        </button>
      </div>
    </div>
  </div>
);

// ─── Pay Confirm Modal ───────────────────────────────────────────────────────

const PayConfirmModal = ({ expense, onCancel, onConfirm, paying }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-100 rounded-full">
          <CheckCircle size={20} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Tandai Dibayar?</h3>
      </div>
      <p className="text-sm text-gray-600 mb-1">
        Tandai pengeluaran <span className="font-medium">{expense?.description}</span> sebagai telah dibayar?
      </p>
      <p className="text-sm text-emerald-600 font-semibold mb-5">
        {formatIDR(expense?.amount)}
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          disabled={paying}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          disabled={paying}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
        >
          {paying && <RefreshCw size={14} className="animate-spin" />}
          Ya, Bayar
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

const ExpensePage = () => {
  // User
  const [currentUser, setCurrentUser] = useState(null);

  // Data
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(daysAgoISO(30));
  const [endDate, setEndDate] = useState(todayISO());
  const [filterCategory, setFilterCategory] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('expense_date');
  const [sortDir, setSortDir] = useState('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Pay
  const [payTarget, setPayTarget] = useState(null);
  const [paying, setPaying] = useState(false);

  // ── fetch current user ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setCurrentUser(await res.json());
      } catch {
        /* ignore */
      }
    };
    fetchUser();
  }, []);

  // ── fetch projects (for dropdown) ────────────────────────────────────────
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/dashboard/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setProjects(await res.json());
      } catch {
        /* ignore */
      }
    };
    fetchProjects();
  }, []);

  // ── fetch expenses ────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (filterCategory) params.set('category', filterCategory);

      const res = await fetch(`${API_URL}/expenses?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal memuat data pengeluaran');
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterCategory]);

  useEffect(() => {
    fetchExpenses();
    setCurrentPage(1);
  }, [fetchExpenses]);

  // ── computed / derived ───────────────────────────────────────────────────
  const canDelete =
    currentUser?.role === 'gm' || currentUser?.is_admin === true;

  const sorted = [...expenses].sort((a, b) => {
    let va = a[sortField];
    let vb = b[sortField];
    if (sortField === 'amount') { va = Number(va); vb = Number(vb); }
    if (sortField === 'expense_date') { va = new Date(va); vb = new Date(vb); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const txCount = expenses.length;
  const days = Math.max(
    1,
    Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1,
  );
  const avgPerDay = totalAmount / days;

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleReset = () => {
    setStartDate(daysAgoISO(30));
    setEndDate(todayISO());
    setFilterCategory('');
  };

  const openAdd = () => { setEditingExpense(null); setShowModal(true); };
  const openEdit = (exp) => { setEditingExpense(exp); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingExpense(null); };
  const handleSaved = () => { closeModal(); fetchExpenses(); };

  const requestDelete = (exp) => setDeleteTarget(exp);
  const cancelDelete = () => setDeleteTarget(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/expenses/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal menghapus pengeluaran');
      toast.success('Pengeluaran dihapus.');
      setDeleteTarget(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (exp) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/expenses/${exp.id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal approve pengeluaran');
      toast.success('Pengeluaran disetujui.');
      fetchExpenses();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePay = (exp) => {
    setPayTarget(exp);
  };

  const confirmPay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/expenses/${payTarget.id}/pay`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal memproses pembayaran');
      toast.success('Pengeluaran ditandai sebagai LUNAS.');
      setPayTarget(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Pengeluaran Harian</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Catat &amp; pantau pengeluaran operasional harian
          </p>
        </div>
        <button
          onClick={openAdd}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-focus"
        >
          <Plus size={16} />
          Tambah Pengeluaran
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Sampai</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Semua Kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={14} />
              Reset
            </button>
            <button
              onClick={fetchExpenses}
              className="flex-1 flex items-center justify-center gap-1.5 border border-accent text-accent px-3 py-2 rounded-lg text-sm hover:bg-teal-50/50 transition-colors"
            >
              <Search size={14} />
              Cari
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total */}
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 fluid-metric-container">
          <div className="p-3 bg-red-100 rounded-xl flex-shrink-0">
            <Receipt size={22} className="text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Total Periode</p>
            <p className="text-base sm:text-lg md:text-xl font-bold text-gray-800 fluid-metric-value">{formatIDR(totalAmount)}</p>
            <p className="text-xs text-gray-400 truncate">
              {toLocalDate(startDate)} – {toLocalDate(endDate)}
            </p>
          </div>
        </div>

        {/* Transaksi */}
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 fluid-metric-container">
          <div className="p-3 bg-teal-100 rounded-xl flex-shrink-0">
            <BarChart2 size={22} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Jumlah Transaksi</p>
            <p className="text-base sm:text-lg md:text-xl font-bold text-gray-800 fluid-metric-value">{txCount}</p>
            <p className="text-xs text-gray-400">transaksi tercatat</p>
          </div>
        </div>

        {/* Rata-rata/hari */}
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 fluid-metric-container">
          <div className="p-3 bg-amber-100 rounded-xl flex-shrink-0">
            <Calendar size={22} className="text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Rata-rata / Hari</p>
            <p className="text-base sm:text-lg md:text-xl font-bold text-gray-800 fluid-metric-value">{formatIDR(avgPerDay)}</p>
            <p className="text-xs text-gray-400">dalam {days} hari</p>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Daftar Pengeluaran
            {!loading && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({expenses.length} data)
              </span>
            )}
          </h2>
          {filterCategory && (
            <CategoryBadge value={filterCategory} />
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase whitespace-nowrap">
              <tr>
                <th className="px-4 py-3 text-left w-10 whitespace-nowrap">#</th>
                <th
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                  onClick={() => handleSort('expense_date')}
                >
                  <span className="flex items-center">
                    Tanggal
                    <SortIcon field="expense_date" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                  onClick={() => handleSort('category')}
                >
                  <span className="flex items-center">
                    Kategori
                    <SortIcon field="category" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Pembayaran</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Deskripsi</th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                  onClick={() => handleSort('amount')}
                >
                  <span className="flex items-center justify-end">
                    Jumlah
                    <SortIcon field="amount" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                /* Skeleton rows */
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3 whitespace-nowrap">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <AlertCircle size={40} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">Tidak ada pengeluaran ditemukan</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Coba ubah filter atau tambah pengeluaran baru
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((exp, idx) => (
                  <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {toLocalDate(exp.expense_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CategoryBadge value={exp.category} />
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {exp.approval_status === "approved" ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-success-bg text-status-success-text border border-status-success-border">
                          Approved
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-pending-bg text-status-pending-text border border-status-pending-border">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {exp.payment_status === "paid" ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-info-bg text-status-info-text border border-status-info-border">
                          Lunas
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-danger-bg text-status-danger-text border border-status-danger-border">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      <p className="max-w-xs truncate" title={exp.description}>
                        {exp.description}
                      </p>
                      {exp.notes && (
                        <p className="text-xs text-gray-400 truncate max-w-xs" title={exp.notes}>
                          {exp.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                      {formatIDR(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {canDelete && exp.approval_status !== "approved" && (
                          <button
                            onClick={() => handleApprove(exp)}
                            title="Approve"
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {(currentUser?.role === 'finance' || canDelete) && exp.approval_status === "approved" && exp.payment_status === "unpaid" && (
                          <button
                            onClick={() => handlePay(exp)}
                            title="Tandai Dibayar"
                            className="p-1.5 text-gray-400 hover:text-accent hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <DollarSign size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(exp)}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-accent hover:bg-teal-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => requestDelete(exp)}
                            title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Footer total */}
            {!loading && paginated.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Total halaman ini
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                    {formatIDR(paginated.reduce((s, e) => s + Number(e.amount), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t flex items-center justify-between text-sm text-gray-600">
            <span>
              Halaman {currentPage} dari {totalPages} &nbsp;·&nbsp; {expenses.length} data
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-8 rounded-lg border text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-accent text-white border-accent'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <ExpenseModal
          expense={editingExpense}
          projects={projects}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          expense={deleteTarget}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
      {payTarget && (
        <PayConfirmModal
          expense={payTarget}
          onCancel={() => setPayTarget(null)}
          onConfirm={confirmPay}
          paying={paying}
        />
      )}
    </div>
  );
};

export default ExpensePage;
