import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  AlertCircle,
  User,
  Calendar,
  RefreshCw,
  Trash2,
  Pencil,
} from "lucide-react";
import AlertModal from "../components/AlertModal";

// ─── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: "/api/v1" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatIDR = (value) =>
  Number(value ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  paid: {
    label: "Paid",
    color: "bg-blue-100  text-blue-700  border-blue-200",
    icon: DollarSign,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100   text-red-700   border-red-200",
    icon: XCircle,
  },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

// ─── Empty form state ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  employee_id: "",
  period_start: "",
  period_end: "",
  overtime_hours: 0,
  bonus: 0,
  allowance: 0,
  loan_deduction: "", // kosong = auto-calculate
  other_deduction: 0,
  deduction_note: "",
  notes: "",
  project_id: "",
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const PayrollPage = () => {
  // ── auth / user ──
  const [currentUser, setCurrentUser] = useState(null);

  // ── data ──
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ── filters ──
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterPeriodStart, setFilterPeriodStart] = useState("");
  const [filterPeriodEnd, setFilterPeriodEnd] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // ── pagination ──
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── modal ──
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  // ── detail modal ──
  const [showDetail, setShowDetail] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // ── download ──
  const [downloadingId, setDownloadingId] = useState(null);

  // ── approve ──
  const [approvingId, setApprovingId] = useState(null);

  // ── delete ──
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, payrollId: null, employeeName: "", periodStart: "" });
  const [approveModal, setApproveModal] = useState({ isOpen: false, payrollId: null });

  // ────────────────────────────────────────────────────────────────────────────
  // Fetch current user
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCurrentUser(data.user ?? data);
      } catch {
        // silent – role checks will gracefully degrade
      }
    };
    fetchUser();
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Fetch employees list (for dropdown)
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get("/employees/employees");
        setEmployees(res.data ?? []);
      } catch {
        // silent
      }
    };
    const fetchProjects = async () => {
      try {
        const res = await api.get("/projects-data/projects");
        setProjects(res.data ?? []);
      } catch {
        // silent
      }
    };
    fetchEmployees();
    fetchProjects();
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Fetch payroll records
  // ────────────────────────────────────────────────────────────────────────────
  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterEmployee) params.employee_id = filterEmployee;
      if (filterPeriodStart) params.period_start = filterPeriodStart;
      if (filterPeriodEnd) params.period_end = filterPeriodEnd;
      if (filterStatus) params.payment_status = filterStatus;

      const res = await api.get("/employees/payroll", { params });
      setPayrolls(res.data.payrolls ?? res.data ?? []);
      setCurrentPage(1);
    } catch (err) {
      toast.error("Gagal memuat data payroll");
    } finally {
      setLoading(false);
    }
  }, [filterEmployee, filterPeriodStart, filterPeriodEnd, filterStatus]);

  useEffect(() => {
    fetchPayrolls();
  }, [fetchPayrolls]);

  // ────────────────────────────────────────────────────────────────────────────
  // Role flags
  // ────────────────────────────────────────────────────────────────────────────
  const role = currentUser?.role ?? "";
  const isGM = role === "gm" || role === "direktur";
  const isFinance = role === "finance" || isGM;

  // ────────────────────────────────────────────────────────────────────────────
  // Pagination
  // ────────────────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(payrolls.length / PAGE_SIZE));
  const paginated = payrolls.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Form handlers
  // ────────────────────────────────────────────────────────────────────────────
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openModal = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (rec) => {
    setEditId(rec.id);
    setForm({
      employee_id: rec.employee_id || "",
      period_start: rec.period_start || "",
      period_end: rec.period_end || "",
      overtime_hours: rec.overtime_hours || 0,
      bonus: rec.bonus || 0,
      allowance: rec.allowance || 0,
      loan_deduction: rec.loan_deduction ?? "",
      other_deduction: rec.other_deduction || 0,
      deduction_note: rec.deduction_note || "",
      notes: rec.notes || "",
      project_id: rec.project_id || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Submit – create payroll
  // ────────────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Pilih karyawan terlebih dahulu");
    if (!form.period_start)
      return toast.error("Masukkan tanggal mulai periode");
    if (!form.period_end) return toast.error("Masukkan tanggal akhir periode");

    const payload = {
      employee_id: Number(form.employee_id),
      period_start: form.period_start,
      period_end: form.period_end,
      overtime_hours: parseFloat(form.overtime_hours) || 0,
      bonus: parseFloat(form.bonus) || 0,
      allowance: parseFloat(form.allowance) || 0,
      other_deduction: parseFloat(form.other_deduction) || 0,
      deduction_note: form.deduction_note || undefined,
      notes: form.notes || undefined,
      project_id: form.project_id ? Number(form.project_id) : null,
    };

    // loan_deduction hanya dikirim jika diisi (kosong = auto-calculate)
    if (form.loan_deduction !== "" && form.loan_deduction !== null) {
      payload.loan_deduction = parseFloat(form.loan_deduction) || 0;
    }

    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/employees/payroll/${editId}`, payload);
        toast.success("Payroll berhasil diupdate");
      } else {
        await api.post("/employees/payroll", payload);
        toast.success("Payroll berhasil dibuat");
      }
      closeModal();
      fetchPayrolls();
    } catch (err) {
      const msg =
        err.response?.data?.error ??
        err.response?.data?.message ??
        "Gagal membuat payroll";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Approve payroll
  // ────────────────────────────────────────────────────────────────────────────
  const handleApproveClick = (payrollId) => {
    setApproveModal({ isOpen: true, payrollId });
  };

  const confirmApprove = async () => {
    if (!approveModal.payrollId) return;
    setApprovingId(approveModal.payrollId);
    try {
      await api.put(`/employees/payroll/${approveModal.payrollId}/approve`);
      toast.success("Payroll berhasil di-approve! Slip gaji siap didownload.");
      fetchPayrolls();
    } catch (err) {
      const msg =
        err.response?.data?.detail ??
        err.response?.data?.error ??
        err.response?.data?.message ??
        "Gagal approve payroll";
      toast.error(msg);
    } finally {
      setApprovingId(null);
      setApproveModal({ isOpen: false, payrollId: null });
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Delete payroll
  // ────────────────────────────────────────────────────────────────────────────
  const handleDeleteClick = (payrollId, employeeName, periodStart) => {
    setDeleteModal({ isOpen: true, payrollId, employeeName, periodStart });
  };

  const confirmDelete = async () => {
    if (!deleteModal.payrollId) return;
    setDeletingId(deleteModal.payrollId);
    try {
      await api.delete(`/employees/payroll/${deleteModal.payrollId}`);
      toast.success("Slip gaji berhasil dihapus.");
      fetchPayrolls();
    } catch (err) {
      const msg =
        err.response?.data?.detail ??
        err.response?.data?.error ??
        "Gagal menghapus slip gaji";
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setDeleteModal({ isOpen: false, payrollId: null, employeeName: "", periodStart: "" });
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Download PDF
  // ────────────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = async (
    payrollId,
    employeeName,
    periodStart,
    periodEnd,
  ) => {
    try {
      setDownloadingId(payrollId);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/v1/employees/payroll/${payrollId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Gagal mengunduh PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slip_gaji_${employeeName}_${periodStart}_${periodEnd}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Slip gaji berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh slip gaji");
    } finally {
      setDownloadingId(null);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Detail modal
  // ────────────────────────────────────────────────────────────────────────────
  const openDetail = (record) => {
    setDetailData(record);
    setShowDetail(true);
  };
  const closeDetail = () => {
    setShowDetail(false);
    setDetailData(null);
  };

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 flex-shrink-0" />
            Payroll &amp; Slip Gaji
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola penggajian, download slip gaji, dan approval
          </p>
        </div>
        {isFinance && (
          <button
            onClick={openModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Buat Payroll
          </button>
        )}
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filter karyawan */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <select
              value={filterEmployee}
              onChange={(e) => {
                setFilterEmployee(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Semua Karyawan</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter periode mulai */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="date"
              value={filterPeriodStart}
              onChange={(e) => setFilterPeriodStart(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Periode mulai"
            />
          </div>

          {/* Filter periode akhir */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <input
              type="date"
              value={filterPeriodEnd}
              onChange={(e) => setFilterPeriodEnd(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Periode akhir"
            />
          </div>

          {/* Filter status */}
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={fetchPayrolls}
              title="Refresh"
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="ml-3 text-gray-500">Memuat data payroll…</span>
          </div>
        ) : payrolls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <FileText className="w-14 h-14 mb-3 opacity-40" />
            <p className="font-medium text-gray-500">Belum ada data payroll</p>
            <p className="text-sm mt-1">
              Buat payroll baru dengan tombol &ldquo;Buat Payroll&rdquo;
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Karyawan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Periode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Proyek
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Gaji Pokok
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Tambahan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Potongan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Take-Home Pay
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((rec) => {
                    const totalAdditions =
                      (rec.overtime_pay ?? 0) +
                      (rec.bonus ?? 0) +
                      (rec.allowance ?? 0);
                    const totalDeductions =
                      (rec.loan_deduction ?? 0) + (rec.other_deduction ?? 0);
                    const isDownloading = downloadingId === rec.id;
                    const isApproving = approvingId === rec.id;

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Karyawan */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-800 text-sm">
                            {rec.employee_name ?? rec.employee?.name ?? "-"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {rec.employee_nik ?? rec.employee?.nik ?? ""}
                          </div>
                        </td>

                        {/* Periode */}
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          <div>{formatDate(rec.period_start)}</div>
                          <div className="text-xs text-gray-400">
                            s.d. {formatDate(rec.period_end)}
                          </div>
                        </td>

                        {/* Proyek */}
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {rec.project_name ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              {rec.project_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Pusat/General</span>
                          )}
                        </td>

                        {/* Gaji Pokok */}
                        <td className="px-4 py-3 text-sm text-right text-gray-700 font-mono whitespace-nowrap">
                          {formatIDR(rec.basic_salary ?? rec.base_salary)}
                        </td>

                        {/* Tambahan */}
                        <td className="px-4 py-3 text-sm text-right text-green-700 font-mono whitespace-nowrap">
                          {totalAdditions > 0
                            ? `+${formatIDR(totalAdditions)}`
                            : "-"}
                        </td>

                        {/* Potongan */}
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-mono whitespace-nowrap">
                          {totalDeductions > 0
                            ? `-${formatIDR(totalDeductions)}`
                            : "-"}
                        </td>

                        {/* Take-Home Pay */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900 font-mono">
                            {formatIDR(rec.net_salary ?? rec.take_home_pay)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <StatusBadge status={rec.payment_status} />
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Detail */}
                            <button
                              onClick={() => openDetail(rec)}
                              title="Lihat Detail"
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit (GM/Finance only) */}
                            {isFinance && (
                              <button
                                onClick={() => openEditModal(rec)}
                                title="Edit Payroll"
                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}

                            {/* Download PDF – hanya bisa saat approved/paid */}
                            <button
                              onClick={() =>
                                handleDownloadPDF(
                                  rec.id,
                                  rec.employee_name ??
                                    rec.employee?.name ??
                                    "karyawan",
                                  rec.period_start,
                                  rec.period_end,
                                )
                              }
                              disabled={
                                isDownloading ||
                                (rec.payment_status !== "approved" &&
                                  rec.payment_status !== "paid")
                              }
                              title={
                                rec.payment_status === "pending"
                                  ? "Slip gaji harus di-approve GM sebelum bisa didownload"
                                  : "Download Slip Gaji PDF"
                              }
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                rec.payment_status === "pending"
                                  ? "text-gray-400"
                                  : "text-blue-600 hover:bg-blue-50"
                              }`}
                            >
                              {isDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>

                            {/* Approve (GM only, only when pending) */}
                            {isGM && rec.payment_status === "pending" && (
                              <button
                                onClick={() => handleApproveClick(rec.id)}
                                disabled={isApproving}
                                title="Approve Payroll (ubah status menjadi Approved)"
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                              >
                                {isApproving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            {/* Delete (GM only, not for 'paid') */}
                            {isGM && rec.payment_status !== "paid" && (
                              <button
                                onClick={() =>
                                  handleDeleteClick(
                                    rec.id,
                                    rec.employee_name ?? rec.employee?.name ?? "karyawan",
                                    rec.period_start,
                                  )
                                }
                                disabled={deletingId === rec.id}
                                title="Hapus Slip Gaji"
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {deletingId === rec.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, payrolls.length)} dari{" "}
                  {payrolls.length} data
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (n) =>
                        n === 1 ||
                        n === totalPages ||
                        Math.abs(n - currentPage) <= 1,
                    )
                    .reduce((acc, n, idx, arr) => {
                      if (idx > 0 && n - arr[idx - 1] > 1) acc.push("…");
                      acc.push(n);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "…" ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 text-gray-400 text-sm"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                              ${
                                currentPage === item
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-600 hover:bg-gray-200"
                              }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          Modal: Buat Payroll
      ───────────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-4 px-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                {editId ? "Edit Payroll" : "Buat Payroll Baru"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Karyawan (disabled kalau edit) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Karyawan <span className="text-red-500">*</span>
                </label>
                <select
                  name="employee_id"
                  value={form.employee_id}
                  onChange={handleFormChange}
                  required
                  disabled={!!editId}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project (Opsional)
                </label>
                <select
                  name="project_id"
                  value={form.project_id}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Pilih Project (Kosongkan jika General)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Periode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periode Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="period_start"
                    value={form.period_start}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periode Akhir <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="period_end"
                    value={form.period_end}
                    onChange={handleFormChange}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-dashed border-gray-200 pt-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Tambahan Penghasilan
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jam Lembur
                    </label>
                    <input
                      type="number"
                      name="overtime_hours"
                      value={form.overtime_hours}
                      onChange={handleFormChange}
                      min="0"
                      step="0.5"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">jam</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bonus
                    </label>
                    <input
                      type="number"
                      name="bonus"
                      value={form.bonus}
                      onChange={handleFormChange}
                      min="0"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Rp</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tunjangan
                    </label>
                    <input
                      type="number"
                      name="allowance"
                      value={form.allowance}
                      onChange={handleFormChange}
                      min="0"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Rp</p>
                  </div>
                </div>
              </div>

              {/* Potongan */}
              <div className="border-t border-dashed border-gray-200 pt-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Potongan
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Potongan Pinjaman
                    </label>
                    <input
                      type="number"
                      name="loan_deduction"
                      value={form.loan_deduction}
                      onChange={handleFormChange}
                      min="0"
                      placeholder="Kosongkan untuk auto"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">
                      Kosongkan = hitung otomatis
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Potongan Lainnya
                    </label>
                    <input
                      type="number"
                      name="other_deduction"
                      value={form.other_deduction}
                      onChange={handleFormChange}
                      min="0"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Rp</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keterangan Potongan
                  </label>
                  <input
                    type="text"
                    name="deduction_note"
                    value={form.deduction_note}
                    onChange={handleFormChange}
                    placeholder="Opsional"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="Catatan tambahan (opsional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Buat Payroll
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          Modal: Detail Payroll
      ───────────────────────────────────────────────────────────────────── */}
      {showDetail && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">
                Detail Slip Gaji
              </h2>
              <button
                onClick={closeDetail}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Info karyawan */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <p className="font-semibold text-gray-800">
                  {detailData.employee_name ?? detailData.employee?.name ?? "-"}
                </p>
                <p className="text-sm text-gray-500">
                  Periode: {formatDate(detailData.period_start)} –{" "}
                  {formatDate(detailData.period_end)}
                </p>
                <div className="mt-2">
                  <StatusBadge status={detailData.payment_status} />
                </div>
              </div>

              {/* Rincian */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Gaji Pokok</span>
                  <span className="font-medium text-gray-800">
                    {formatIDR(detailData.basic_salary ?? detailData.base_salary)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">
                    Lembur ({detailData.overtime_hours ?? 0} jam)
                  </span>
                  <span className="font-medium text-green-700">
                    +{formatIDR(detailData.overtime_pay)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Bonus</span>
                  <span className="font-medium text-green-700">
                    +{formatIDR(detailData.bonus)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Tunjangan</span>
                  <span className="font-medium text-green-700">
                    +{formatIDR(detailData.allowance)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Potongan Pinjaman</span>
                  <span className="font-medium text-red-600">
                    -{formatIDR(detailData.loan_deduction)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Potongan Lainnya</span>
                  <span className="font-medium text-red-600">
                    -{formatIDR(detailData.other_deduction)}
                  </span>
                </div>
                {detailData.deduction_note && (
                  <div className="py-1.5 border-b border-gray-100">
                    <span className="text-gray-400 text-xs">
                      Ket. Potongan: {detailData.deduction_note}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 bg-blue-50 rounded-lg px-3 mt-2">
                  <span className="font-semibold text-gray-700">
                    Take-Home Pay
                  </span>
                  <span className="font-bold text-blue-700 text-base">
                    {formatIDR(
                      detailData.net_salary ?? detailData.take_home_pay,
                    )}
                  </span>
                </div>
              </div>

              {detailData.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <span className="font-medium">Catatan:</span>{" "}
                  {detailData.notes}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              {/* Approve button – hanya GM, hanya saat pending */}
              {isGM && detailData.payment_status === "pending" && (
                <button
                  onClick={() => {
                    closeDetail();
                    handleApprove(detailData.id);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
              )}

              {/* Info jika masih pending */}
              {detailData.payment_status === "pending" && !isGM && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Menunggu approval GM
                </span>
              )}

              {/* Download PDF – hanya saat approved/paid */}
              <button
                onClick={() =>
                  handleDownloadPDF(
                    detailData.id,
                    detailData.employee_name ??
                      detailData.employee?.name ??
                      "karyawan",
                    detailData.period_start,
                    detailData.period_end,
                  )
                }
                disabled={
                  downloadingId === detailData.id ||
                  (detailData.payment_status !== "approved" &&
                    detailData.payment_status !== "paid")
                }
                title={
                  detailData.payment_status === "pending"
                    ? "Slip gaji harus di-approve GM terlebih dahulu"
                    : "Download Slip Gaji PDF"
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingId === detailData.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {detailData.payment_status === "pending" ? "PDF (Belum Approved)" : "Download PDF"}
              </button>

              {/* Delete (GM only, not for 'paid') */}
              {isGM && detailData.payment_status !== "paid" && (
                <button
                  onClick={() => {
                    closeDetail();
                    handleDeleteClick(
                      detailData.id,
                      detailData.employee_name ?? detailData.employee?.name ?? "karyawan",
                      detailData.period_start,
                    );
                  }}
                  disabled={deletingId === detailData.id}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus
                </button>
              )}

              <button
                onClick={closeDetail}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          AlertModal: Hapus Payroll
      ───────────────────────────────────────────────────────────────────── */}
      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, payrollId: null, employeeName: "", periodStart: "" })}
        onConfirm={confirmDelete}
        title="Hapus Slip Gaji"
        message={`Hapus slip gaji "${deleteModal.employeeName}" periode ${deleteModal.periodStart}? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
      />
      {/* ─────────────────────────────────────────────────────────────────────
          AlertModal: Approve Payroll
      ───────────────────────────────────────────────────────────────────── */}
      <AlertModal
        isOpen={approveModal.isOpen}
        onClose={() => setApproveModal({ isOpen: false, payrollId: null })}
        onConfirm={confirmApprove}
        title="Approve Slip Gaji"
        message="Approve slip gaji ini? Status akan berubah menjadi Approved dan slip gaji dapat didownload."
        confirmText="Approve"
      />
    </div>
  );
};

export default PayrollPage;
