import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Truck,
  Users,
  FolderOpen,
  Fuel,
  Gauge,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Loader2,
  TrendingUp,
  Wallet,
  TrendingDown,
  BarChart2,
  PlusCircle,
  ClipboardCheck,
  Trash2,
  XCircle,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import AlertModal from "../components/AlertModal";
import { API_URL } from "../api/auth";

import { toLocalDateInput, toLocalDateTimeString, formatIDR, formatDate } from "../utils/formatters";
import StatCard from "../components/dashboard/StatCard";
import PendingPayrollPanel from "../components/dashboard/PendingPayrollPanel";
import DailyReportPanel from "../components/dashboard/DailyReportPanel";
import AttendancePanel from "../components/dashboard/AttendancePanel";
import FuelStatsPanel from "../components/dashboard/FuelStatsPanel";
import EntityTablesPanel from "../components/dashboard/EntityTablesPanel";
import UnpaidCenterPanel from "../components/dashboard/UnpaidCenterPanel";
import YesterdayReportPanel from "../components/dashboard/YesterdayReportPanel";

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();

  // ── state ──
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    equipment_count: 0,
    employee_count: 0,
    project_count: 0,
  });
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [fuelStats, setFuelStats] = useState({
    total_fuel_consumed: 0,
    equipment_count: 0,
  });
  const [fuelEquipmentReport, setFuelEquipmentReport] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingPayroll, setLoadingPayroll] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyReportDate, setDailyReportDate] = useState(toLocalDateInput(new Date()));
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [selectedFieldEmployee, setSelectedFieldEmployee] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [deleteAttendanceModal, setDeleteAttendanceModal] = useState({ isOpen: false, employeeId: null, attendanceId: null });
  const [fuelActionModal, setFuelActionModal] = useState({ isOpen: false, id: null, action: null });
  const [payrollApproveModal, setPayrollApproveModal] = useState({ isOpen: false, id: null });
  const [financeSummary, setFinanceSummary] = useState(null);

  // Yesterday report states for GM
  const [yesterdayReport, setYesterdayReport] = useState(null);
  const [loadingYesterday, setLoadingYesterday] = useState(false);

  // Greeting and Role Helpers
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return "Selamat Pagi";
    if (hours >= 11 && hours < 15) return "Selamat Siang";
    if (hours >= 15 && hours < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  const getRoleLabelAndIcon = (roleName) => {
    switch (roleName?.toLowerCase()) {
      case "gm":
        return { label: "General Manager", badge: "bg-amber-100 text-amber-800 border-amber-200" };
      case "direktur":
        return { label: "Direktur Utama", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case "finance":
        return { label: "Finance & Accounting", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "field":
        return { label: "Operational Field Staff", badge: "bg-blue-100 text-blue-800 border-blue-200" };
      case "checker":
        return { label: "Checker Lapangan", badge: "bg-cyan-100 text-cyan-800 border-cyan-200" };
      case "admin":
        return { label: "System Administrator", badge: "bg-purple-100 text-purple-800 border-purple-200" };
      default:
        return { label: roleName ? roleName.toUpperCase() : "User", badge: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  const getToken = () => localStorage.getItem("token");

  const authFetch = useCallback(
    async (url) => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [navigate],
  );

  // ── fetch current user ──
  useEffect(() => {
    authFetch(`${API_URL}/auth/me`)
      .then((data) => setCurrentUser(data.user ?? data))
      .catch(() => {});
  }, [authFetch]);

  const fetchAll = useCallback(async () => {
    setLoadingPayroll(true);
    try {
      const promises = [
        authFetch(`${API_URL}/dashboard/stats`),
        authFetch(`${API_URL}/dashboard/payroll-summary`),
        authFetch(`${API_URL}/fuel/efficiency?days=30`),
        authFetch(`${API_URL}/fuel/equipment-report?days=30`),
        authFetch(`${API_URL}/dashboard/equipment`),
        authFetch(`${API_URL}/dashboard/employees`),
        authFetch(`${API_URL}/dashboard/projects`),
      ];
      
      if (currentUser?.role === 'finance' || currentUser?.role === 'gm' || currentUser?.is_admin || currentUser?.is_superuser) {
        promises.push(authFetch(`${API_URL}/dashboard/finance-summary`));
      }

      const results = await Promise.allSettled(promises);
      const [s, pe, fe, fr, eq, emp, proj, finSum] = results;
      
      if (s?.status === "fulfilled") setStats(s.value);
      if (pe?.status === "fulfilled") setPayrollSummary(pe.value);
      if (fe?.status === "fulfilled") setFuelStats(fe.value);
      if (fr?.status === "fulfilled") setFuelEquipmentReport(fr.value);
      if (eq?.status === "fulfilled") setEquipment(eq.value);
      if (emp?.status === "fulfilled") setEmployees(emp.value);
      if (proj?.status === "fulfilled") setProjects(proj.value);
      if (finSum?.status === "fulfilled") setFinanceSummary(finSum.value);
    } finally {
      setLoadingPayroll(false);
    }
  }, [authFetch, currentUser]);

  const fetchDailyReport = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const dr = await authFetch(`${API_URL}/dashboard/daily-report?report_date=${dailyReportDate}`);
      setDailyReport(dr);
    } catch (e) {
      console.error("Failed to fetch daily report:", e);
    } finally {
      setLoadingDaily(false);
    }
  }, [authFetch, dailyReportDate]);
  const fetchYesterdayReport = useCallback(async () => {
    const role = currentUser?.role ?? "";
    const isGM =
      role === "gm" ||
      role === "direktur" ||
      currentUser?.is_admin ||
      currentUser?.is_superuser;
    if (!isGM || !dailyReportDate) return;
    setLoadingYesterday(true);
    try {
      const getYesterdayDateString = (dateStr) => {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return "";
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed month
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        dateObj.setDate(dateObj.getDate() - 1);
        
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      const yesterdayStr = getYesterdayDateString(dailyReportDate);
      if (!yesterdayStr) throw new Error("Invalid date");
      
      const dr = await authFetch(`${API_URL}/dashboard/daily-report?report_date=${yesterdayStr}`);
      setYesterdayReport(dr);
    } catch (e) {
      console.error("Failed to fetch yesterday daily report:", e);
    } finally {
      setLoadingYesterday(false);
    }
  }, [authFetch, currentUser, dailyReportDate]);

  useEffect(() => {
    fetchYesterdayReport();
  }, [fetchYesterdayReport]);

  useEffect(() => {
    fetchDailyReport();
  }, [fetchDailyReport]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchTodayAttendance = useCallback(async () => {
    if (currentUser?.role !== "field") return;
    try {
      const today = toLocalDateInput(new Date());
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = toLocalDateInput(yesterdayDate);
      const res = await authFetch(`${API_URL}/employees/attendance?start_date=${yesterday}&end_date=${today}`);
      setTodayAttendance(res);
    } catch (e) {
      console.error("Failed to fetch attendance:", e);
    }
  }, [authFetch, currentUser]);

  useEffect(() => {
    if (currentUser?.role === "field") {
      fetchTodayAttendance();
    }
  }, [fetchTodayAttendance, currentUser]);

  // ── role ──
  const role = currentUser?.role ?? "";
  const isGM =
    role === "gm" ||
    role === "direktur" ||
    currentUser?.is_admin ||
    currentUser?.is_superuser;
  const canSeePayroll =
    ["gm", "finance", "admin", "checker", "direktur"].includes(role) ||
    currentUser?.is_admin ||
    currentUser?.is_superuser;

  // ── approve payroll ──
  const handleApprove = async (payrollId) => {
    setApprovingId(payrollId);
    try {
      const res = await fetch(`${API_URL}/employees/payroll/${payrollId}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Gagal approve payroll");
      toast.success("Slip gaji berhasil disetujui!");
      await fetchAll();
    } catch (e) {
      toast.error(e.message || "Gagal approve payroll");
    } finally {
      setApprovingId(null);
      setPayrollApproveModal({ isOpen: false, id: null });
    }
  };

  // ── approve/reject fuel ──
  const handleFuelAction = async () => {
    if (!fuelActionModal.id || !fuelActionModal.action) return;
    try {
      const res = await fetch(`${API_URL}/fuel/price/${fuelActionModal.id}/approve?status=${fuelActionModal.action}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`Gagal memproses pembelian BBM`);
      toast.success(`Pembelian BBM ${fuelActionModal.action === 'approved' ? 'disetujui' : 'ditolak'}`);
      setFuelActionModal({ isOpen: false, id: null, action: null });
      fetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── mark as paid ──
  const handleMarkPaid = async (type, id) => {
    try {
      let endpoint = "";
      if (type === "expense") endpoint = `/expenses/${id}/pay`;
      else if (type === "fuel") endpoint = `/fuel/price/${id}/pay`;
      else if (type === "payroll") endpoint = `/employees/payroll/${id}/pay`;
      else if (type === "invoice") endpoint = `/invoices/${id}/pay`;
      
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Gagal menandai lunas");
      toast.success("Berhasil ditandai sebagai lunas!");
      fetchAll();
      fetchDailyReport();
      fetchYesterdayReport();
    } catch (e) {
      toast.error(e.message || "Terjadi kesalahan");
    }
  };

  // ── attendance action ──
  const handleAttendanceAction = async (employeeId, action, attendanceId = null) => {
    setAttendanceLoading(true);
    try {
      const now = new Date();
      const todayStr = toLocalDateInput(now);
      const localTimeStr = toLocalDateTimeString();

      let url, method, body;
      if (action === 'check_in') {
        url = `${API_URL}/employees/attendance`;
        method = 'POST';
        body = JSON.stringify({
          employee_id: employeeId,
          date: todayStr,
          check_in: localTimeStr
        });
      } else if (action === 'check_out') {
        url = `${API_URL}/employees/attendance/${attendanceId}`;
        method = 'PUT';
        body = JSON.stringify({ check_out: localTimeStr });
      } else if (action === 'delete') {
        url = `${API_URL}/employees/attendance/${attendanceId}`;
        method = 'DELETE';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Gagal menyimpan absensi');
      }

      if (action === 'delete') {
         toast.success('Absensi berhasil dihapus!');
      } else {
         toast.success(action === 'check_in' ? 'Check In berhasil!' : 'Check Out berhasil!');
      }
      await fetchTodayAttendance();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const operationEmployees = useMemo(() => {
    return employees.filter(e => e.department && e.department.toLowerCase().startsWith("operation"));
  }, [employees]);

  // ── chart data ──
  const fuelChartData = useMemo(
    () =>
      fuelEquipmentReport
        .slice()
        .sort((a, b) => b.total_liters - a.total_liters)
        .slice(0, 14)
        .map((r) => ({
          name:
            r.equipment_name.length > 14
              ? `${r.equipment_name.slice(0, 13)}…`
              : r.equipment_name,
          liters: r.total_liters,
          fullName: r.equipment_name,
        })),
    [fuelEquipmentReport],
  );

  const projectData = useMemo(() => {
    const counts = { ongoing: 0, completed: 0, paused: 0 };
    projects.forEach((p) => {
      const s = (p.status || "ongoing").toLowerCase();
      if (s in counts) counts[s]++;
      else counts.ongoing++;
    });
    return [
      { name: "Ongoing", value: counts.ongoing, color: "#3b82f6" },
      { name: "Completed", value: counts.completed, color: "#10b981" },
      { name: "Paused", value: counts.paused, color: "#f59e0b" },
    ];
  }, [projects]);

  const ps = payrollSummary;

  return (
    <div className="space-y-6">
      {/* ── Page Header & Welcome Banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 shadow-lg border border-slate-800/50 text-white transition-all duration-300">
        {/* Background light blobs for premium glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-2xl shadow-lg border border-blue-400/30 text-white transform hover:rotate-6 transition-transform">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">BINA-ERP SYSTEM</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v1.2 Active
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                {getGreeting()}, <span className="bg-gradient-to-r from-blue-200 via-indigo-100 to-white bg-clip-text text-transparent">{currentUser?.full_name || "User"}</span>! 👋
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleLabelAndIcon(role).badge}`}>
                  {getRoleLabelAndIcon(role).label}
                </span>
                <span className="text-xs text-indigo-300/80 font-normal">({currentUser?.email || "-"})</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40 backdrop-blur-sm self-start md:self-center">
            <div className="text-right">
              <p className="text-xs text-indigo-300/80 uppercase tracking-widest font-semibold">Hari & Tanggal</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                • Live Connected
              </span>
              <button
                onClick={() => {
                  fetchAll();
                  fetchYesterdayReport();
                  toast.success("Data berhasil diperbarui!");
                }}
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-indigo-300 hover:text-white transition-all hover:scale-105 border border-slate-700/40"
                title="Refresh data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Field Staff Attendance ───────────────────────────────────────── */}
      <AttendancePanel
        role={role}
        operationEmployees={operationEmployees}
        selectedFieldEmployee={selectedFieldEmployee}
        setSelectedFieldEmployee={setSelectedFieldEmployee}
        todayAttendance={todayAttendance}
        attendanceLoading={attendanceLoading}
        handleAttendanceAction={handleAttendanceAction}
        setDeleteAttendanceModal={setDeleteAttendanceModal}
      />

      {/* ── Finance Summary (Finance & GM) ─────────────────────────────────── */}
      {(role === 'finance' || isGM) && financeSummary && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Finance Summary
            </h2>
          </div>
          
          {financeSummary.uninvoiced_material_sales_count > 0 && (
            <div 
              onClick={() => navigate('/material-sales')} 
              className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-800">Menunggu Diterbitkan Invoice</h3>
                <p className="text-xs text-amber-700 mt-1">
                  Terdapat {financeSummary.uninvoiced_material_sales_count} penjualan material yang belum dibuatkan invoice. Segera periksa menu Material Sales / Invoices.
                </p>
                <p className="text-xs font-semibold text-amber-800 mt-2 underline">Klik untuk membuat invoice →</p>
              </div>
            </div>
          )}

          {financeSummary.unprocessed_attendances_count > 0 && (
            <div 
              onClick={() => navigate('/payroll')} 
              className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm cursor-pointer hover:bg-blue-100 transition-colors"
            >
              <AlertTriangle className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-blue-800">Absensi Belum Dibuatkan Slip Gaji</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Terdapat {financeSummary.unprocessed_attendances_count} karyawan yang absensinya belum diproses menjadi slip gaji.
                </p>
                <p className="text-xs font-semibold text-blue-800 mt-2 underline">Klik untuk membuat slip gaji →</p>
              </div>
            </div>
          )}

          {(financeSummary.equipment_balances ?? financeSummary.vendor_deposits ?? []).filter(b => (b.balance ?? b.balance_deposit ?? 0) <= 5000000).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-800">Deposit Alat Berat Menipis / Minus</h3>
                <p className="text-xs text-red-600 mt-1 mb-2">Alat berat berikut membutuhkan top-up deposit segera:</p>
                <div className="space-y-1">
                  {(financeSummary.equipment_balances ?? financeSummary.vendor_deposits ?? [])
                    .filter(b => (b.balance ?? b.balance_deposit ?? 0) <= 5000000)
                    .sort((a, b) => (a.balance ?? a.balance_deposit ?? 0) - (b.balance ?? b.balance_deposit ?? 0))
                    .map((b, idx) => {
                      const balance = b.balance ?? b.balance_deposit ?? 0;
                      const eqName = b.equipment_name ?? b.name ?? "-";
                      const vendorName = b.vendor_name;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-1.5 border border-red-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">{eqName}</span>
                            {vendorName && <span className="text-xs text-gray-400">({vendorName})</span>}
                          </div>
                          <span className={`text-xs font-bold tabular-nums ${balance < 0 ? "text-red-700" : "text-amber-700"}`}>
                            {balance < 0 ? "⚠️ " : "⚡ "}{formatIDR(balance)}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <button onClick={() => navigate('/equipment')} className="mt-3 text-xs font-bold text-red-700 underline hover:text-red-900">
                  → Top-Up Sekarang di Menu Equipment
                </button>
              </div>
            </div>
          )}


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Wallet}
              label="Tagihan Pengeluaran"
              value={formatIDR(financeSummary.unpaid_bills_amount)}
              sub={`${financeSummary.unpaid_bills_count} bills menunggu bayar`}
              color="bg-red-500"
              badge={financeSummary.unpaid_bills_count > 0 ? financeSummary.unpaid_bills_count : undefined}
              onClick={() => document.getElementById('unpaid-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
            <StatCard
              icon={Receipt}
              label="Invoice Belum Lunas"
              value={formatIDR(financeSummary.unpaid_invoices_amount)}
              sub={`${financeSummary.unpaid_invoices_count} invoice dari customer`}
              color="bg-orange-500"
              badge={financeSummary.unpaid_invoices_count > 0 ? financeSummary.unpaid_invoices_count : undefined}
              onClick={() => document.getElementById('unpaid-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
            <StatCard
              icon={Fuel}
              label="BBM Pending Approval"
              value={financeSummary.pending_fuel_purchases}
              sub="Pembelian belum disetujui GM"
              color="bg-amber-500"
              badge={financeSummary.pending_fuel_purchases > 0 ? financeSummary.pending_fuel_purchases : undefined}
              onClick={() => navigate("/fuel")}
            />
            <StatCard
              icon={AlertTriangle}
              label="Pengeluaran Pending"
              value={financeSummary.pending_expenses}
              sub="Menunggu approval GM"
              color="bg-purple-500"
              badge={financeSummary.pending_expenses > 0 ? financeSummary.pending_expenses : undefined}
              onClick={() => navigate("/expenses")}
            />
          </div>

          {/* GM & Finance Yesterday's Operational & Sales Overview */}
          <YesterdayReportPanel
            role={role}
            isGM={isGM}
            loadingYesterday={loadingYesterday}
            yesterdayReport={yesterdayReport}
          />

          {/* Pending Fuel Purchases List */}
          {(isGM || role === 'finance') && (
            <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden mt-6 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">
                  {financeSummary.pending_fuel_purchases} Pembelian BBM Menunggu Approval GM
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {financeSummary.recent_pending_fuel?.length > 0 ? (
                  financeSummary.recent_pending_fuel.map((rec) => (
                    <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {rec.liters.toLocaleString('id-ID')} Liter Solar
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Total: {formatIDR(rec.total_price)} | Harga/L: {formatIDR(rec.total_price / rec.liters)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Tgl: {formatDate(rec.effective_date)} {rec.notes ? `• ${rec.notes}` : ''}
                        </p>
                      </div>
                      {isGM && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFuelActionModal({ isOpen: true, id: rec.id, action: 'approved' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => setFuelActionModal({ isOpen: true, id: rec.id, action: 'rejected' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Tolak
                        </button>
                      </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-6 text-center text-gray-500 text-sm">
                    Tidak ada pembelian BBM yang menunggu persetujuan.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Core Stats ────────────────────────────────────────────────────── */}
      {role !== 'finance' && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Truck}
          label="Total Equipment"
          value={stats.equipment_count}
          color="bg-blue-500"
          onClick={() => navigate("/equipment")}
        />
        <StatCard
          icon={Users}
          label="Karyawan Aktif"
          value={stats.employee_count}
          color="bg-emerald-500"
          onClick={() => navigate("/employees")}
        />
        <StatCard
          icon={FolderOpen}
          label="Total Proyek"
          value={stats.project_count}
          color="bg-purple-500"
        />
        <StatCard
          icon={Gauge}
          label="BBM 30 Hari"
          value={`${fuelStats.total_fuel_consumed.toFixed(1)} L`}
          sub={`${fuelStats.equipment_count} unit`}
          color="bg-amber-500"
          onClick={() => navigate("/fuel")}
        />
      </div>
      )}

      {/* ── Payroll Overview (role-gated) ─────────────────────────────────── */}
      {canSeePayroll && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0D9488]" />
              Payroll Overview
            </h2>
            <button
              onClick={() => navigate("/payroll")}
              className="text-sm text-[#0D9488] hover:text-[#0F766E] flex items-center gap-1 font-medium"
            >
              Lihat Semua <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loadingPayroll ? (
            <div className="flex items-center gap-2 text-gray-400 py-4">
              <Loader2 className="w-5 h-5 animate-spin" /> Memuat data payroll…
            </div>
          ) : (
            <>
              {/* Payroll stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={Clock}
                  label="Menunggu Approval"
                  value={ps?.pending_count ?? 0}
                  sub={`Nilai: ${formatIDR(ps?.pending_total ?? 0)}`}
                  color="bg-amber-500"
                  badge={ps?.pending_count > 0 ? ps.pending_count : undefined}
                  onClick={() => navigate("/payroll")}
                />
                <StatCard
                  icon={CheckCircle}
                  label={`Approved (${ps?.month_label ?? "Bulan Ini"})`}
                  value={ps?.approved_count ?? 0}
                  sub={`Total: ${formatIDR(ps?.approved_total ?? 0)}`}
                  color="bg-green-500"
                  onClick={() => navigate("/payroll")}
                />
                <StatCard
                  icon={Wallet}
                  label={`Dibayar (${ps?.month_label ?? "Bulan Ini"})`}
                  value={ps?.paid_count ?? 0}
                  sub={`Total: ${formatIDR(ps?.paid_total ?? 0)}`}
                  color="bg-blue-600"
                  onClick={() => navigate("/payroll")}
                />
              </div>

              {/* Pending approval quick-action list (GM only) */}
              <PendingPayrollPanel
                isGM={isGM}
                payrollSummary={ps}
                approvingId={approvingId}
                setPayrollApproveModal={setPayrollApproveModal}
              />
            </>
          )}
        </div>
      )}

      {/* ── Laporan Keuangan Hari Ini (GM & Finance) ──────────────────────────── */}
      <DailyReportPanel
        isGM={isGM}
        role={role}
        dailyReport={dailyReport}
        dailyReportDate={dailyReportDate}
        setDailyReportDate={setDailyReportDate}
        loadingDaily={loadingDaily}
      />

      {/* ── Charts & BBM Table ────────────────────────────────────────────────────────── */}
      <FuelStatsPanel
        fuelChartData={fuelChartData}
        projectData={projectData}
        fuelEquipmentReport={fuelEquipmentReport}
      />

      {/* ── Equipment + Employee tables ────────────────────────────────────── */}
      <EntityTablesPanel equipment={equipment} employees={employees} />

      {/* ── Unpaid Center (Finance & GM) ─────────────────────────────────── */}
      <UnpaidCenterPanel
        role={role}
        isGM={isGM}
        financeSummary={financeSummary}
        handleMarkPaid={handleMarkPaid}
      />

      
      <AlertModal
        isOpen={deleteAttendanceModal.isOpen}
        onClose={() => setDeleteAttendanceModal({ isOpen: false, employeeId: null, attendanceId: null })}
        onConfirm={() => {
          handleAttendanceAction(deleteAttendanceModal.employeeId, 'delete', deleteAttendanceModal.attendanceId);
          setDeleteAttendanceModal({ isOpen: false, employeeId: null, attendanceId: null });
        }}
        title="Hapus Absensi Hari Ini"
        message="Apakah Anda yakin ingin membatalkan/menghapus absensi pekerja lapangan ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
      />

      <AlertModal
        isOpen={fuelActionModal.isOpen}
        onClose={() => setFuelActionModal({ isOpen: false, id: null, action: null })}
        onConfirm={handleFuelAction}
        title={fuelActionModal.action === 'approved' ? "Approve Pembelian BBM" : "Tolak Pembelian BBM"}
        message={fuelActionModal.action === 'approved' ? "Anda yakin ingin menyetujui pembelian BBM ini? Data pembelian akan dimasukkan ke stok BBM." : "Anda yakin ingin menolak pembelian BBM ini? Data akan masuk ke riwayat sebagai ditolak."}
        confirmText={fuelActionModal.action === 'approved' ? "Approve" : "Tolak"}
        cancelText="Batal"
        confirmColor={fuelActionModal.action === 'approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
      />

      <AlertModal
        isOpen={payrollApproveModal.isOpen}
        onClose={() => setPayrollApproveModal({ isOpen: false, id: null })}
        onConfirm={() => handleApprove(payrollApproveModal.id)}
        title="Approve Slip Gaji"
        message="Apakah Anda yakin ingin menyetujui slip gaji karyawan ini?"
        confirmText="Approve"
        cancelText="Batal"
        confirmColor="bg-green-600 hover:bg-green-700"
      />
    </div>
  );
};
