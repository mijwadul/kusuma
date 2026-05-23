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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toLocalDateInput = (value) => {
  const date = value ? new Date(value) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format datetime lokal sebagai string YYYY-MM-DDTHH:mm:ss (tanpa konversi UTC)
const toLocalDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d) => {
  if (!d) return "-";
  const str = String(d);
  const parts = str.split('T')[0].split('-');
  if (parts.length < 3) return str;
  const [y, m, dayVal] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const mIndex = parseInt(m, 10) - 1;
  return `${dayVal} ${months[mIndex] || m} ${y}`;
};

// ─── Mini stat card ───────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, onClick, badge }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-start gap-4 fluid-metric-container
      transition-all duration-300 ease-out hover:shadow-md hover:border-slate-200/80
      ${onClick ? "cursor-pointer hover:-translate-y-1" : ""}`}
  >
    <div className={`p-3.5 rounded-2xl shadow-xs text-white bg-gradient-to-tr ${
      color.includes("bg-red-") ? "from-red-500 to-rose-600 shadow-red-200/50" :
      color.includes("bg-green-") ? "from-green-500 to-emerald-600 shadow-emerald-200/50" :
      color.includes("bg-emerald-") ? "from-emerald-500 to-teal-600 shadow-teal-200/50" :
      color.includes("bg-blue-") ? "from-blue-500 to-indigo-600 shadow-blue-200/50" :
      color.includes("bg-amber-") ? "from-amber-500 to-yellow-600 shadow-amber-200/50" :
      color.includes("bg-orange-") ? "from-orange-500 to-red-600 shadow-orange-200/50" :
      color.includes("bg-purple-") ? "from-purple-500 to-violet-600 shadow-purple-200/50" :
      "from-slate-500 to-slate-600"
    } flex-shrink-0`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider line-clamp-2 leading-snug" title={label}>{label}</p>
      <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5 tabular-nums fluid-metric-value">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight line-clamp-2" title={sub}>{sub}</p>}
    </div>
    {badge && (
      <span className="shrink-0 bg-red-500/10 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
        {badge}
      </span>
    )}
  </div>
);

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
      {role === "field" && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Absensi Pekerja Lapangan (Operation)
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Karyawan</label>
              <select 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D9488]"
                value={selectedFieldEmployee}
                onChange={(e) => setSelectedFieldEmployee(e.target.value)}
              >
                <option value="">-- Pilih Pekerja --</option>
                {operationEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full sm:w-auto">
              {(() => {
                 const selectedId = Number(selectedFieldEmployee);
                 if (!selectedId) return <button disabled className="w-full sm:w-auto px-6 py-2 bg-gray-300 text-white font-medium rounded-lg transition-colors">Pilih Pekerja</button>;
                 
                 const records = todayAttendance.filter(a => a.employee_id === selectedId);
                 const todayStr = toLocalDateInput(new Date());
                 let currentRecord = records.find(a => a.date === todayStr);
                 if (!currentRecord) {
                    currentRecord = records.find(a => !a.check_out);
                 }
                 
                 if (!currentRecord) {
                    return (
                      <button 
                        onClick={() => handleAttendanceAction(selectedId, 'check_in')}
                        disabled={attendanceLoading}
                        className="w-full sm:w-auto px-6 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                      >
                        {attendanceLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Check In
                      </button>
                    );
                 } else {
                    return (
                      <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                        {!currentRecord.check_out ? (
                          <button 
                            onClick={() => handleAttendanceAction(selectedId, 'check_out', currentRecord.id)}
                            disabled={attendanceLoading}
                            className="w-full sm:w-auto px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                          >
                            {attendanceLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Check Out
                          </button>
                        ) : (
                          <button disabled className="w-full sm:w-auto px-6 py-2 bg-green-100 text-green-700 border border-green-200 font-medium rounded-lg flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Selesai Shift
                          </button>
                        )}
                        <button 
                          onClick={() => setDeleteAttendanceModal({ isOpen: true, employeeId: selectedId, attendanceId: currentRecord.id })}
                          disabled={attendanceLoading}
                          className="w-full sm:w-auto p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg flex items-center justify-center transition-colors disabled:opacity-70"
                          title="Hapus Absensi Hari Ini"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    );
                 }
              })()}
            </div>
          </div>
        </div>
      )}

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
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-800">Menunggu Diterbitkan Invoice</h3>
                <p className="text-xs text-amber-700 mt-1">
                  Terdapat {financeSummary.uninvoiced_material_sales_count} penjualan material yang belum dibuatkan invoice. Segera periksa menu Material Sales / Invoices.
                </p>
              </div>
            </div>
          )}

          {financeSummary.vendor_deposits && financeSummary.vendor_deposits.filter(v => v.balance_deposit <= 5000000).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-red-800">Deposit Vendor Menipis / Minus</h3>
                <p className="text-xs text-red-700 mt-1">
                  {financeSummary.vendor_deposits.filter(v => v.balance_deposit <= 5000000).map(v => (
                    <span key={v.id} className="block mt-1">
                      • {v.name}: <span className="font-bold">Rp {Number(v.balance_deposit).toLocaleString('id-ID')}</span>
                    </span>
                  ))}
                </p>
                <button onClick={() => navigate('/equipment')} className="mt-2 text-xs font-bold text-red-700 underline hover:text-red-900">
                  Top-Up Sekarang di Menu Equipment
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

          {/* GM Yesterday's Operational & Sales Overview */}
          {isGM && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-6 transition-all duration-300 hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 bg-gradient-to-r from-indigo-50/50 via-slate-50 to-indigo-50/20 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-100">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Ringkasan Operasional & Penjualan Hari Kemarin
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kinerja keuangan dan aktivitas logistik tanggal {formatDate(yesterdayReport?.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                    Aktivitas Kemarin
                  </span>
                </div>
              </div>

              {loadingYesterday ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm text-slate-400 animate-pulse">Memuat laporan kemarin...</p>
                </div>
              ) : !yesterdayReport ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Gagal memuat data laporan hari kemarin atau data belum tersedia.
                </div>
              ) : (
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 1. Detail Operasional (Expenses) */}
                    <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100/50 flex flex-col justify-between space-y-4">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                          <TrendingDown className="w-4 h-4 text-red-500" />
                          Operasional & Pengeluaran
                        </h4>
                        
                        <div className="space-y-3">
                          {/* BBM */}
                          <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl shadow-2xs border border-slate-100/80 hover:border-slate-200 transition-colors">
                            <div>
                              <p className="text-xs text-slate-500 font-bold">BBM Solar Lapangan</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {(yesterdayReport.expenses?.fuel?.total_liters ?? 0).toLocaleString('id-ID')} Liter Solar
                              </p>
                            </div>
                            <span className="text-sm font-bold text-red-600 tabular-nums">
                              {formatIDR(yesterdayReport.expenses?.fuel?.total ?? 0)}
                            </span>
                          </div>

                          {/* Gaji */}
                          <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl shadow-2xs border border-slate-100/80 hover:border-slate-200 transition-colors">
                            <div>
                              <p className="text-xs text-slate-500 font-bold">Gaji Karyawan (Paid)</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {yesterdayReport.expenses?.payroll?.count ?? 0} slip terbayar
                              </p>
                            </div>
                            <span className="text-sm font-bold text-red-600 tabular-nums">
                              {formatIDR(yesterdayReport.expenses?.payroll?.total ?? 0)}
                            </span>
                          </div>

                          {/* Operasional Lainnya */}
                          <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl shadow-2xs border border-slate-100/80 hover:border-slate-200 transition-colors">
                            <div>
                              <p className="text-xs text-slate-500 font-bold">Biaya Lain-lain (Approved)</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Koordinasi & administrasi
                              </p>
                            </div>
                            <span className="text-sm font-bold text-red-600 tabular-nums">
                              {formatIDR(yesterdayReport.expenses?.others?.total ?? 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center text-xs font-bold text-slate-600 mt-2">
                        <span>Total Pengeluaran</span>
                        <span className="text-sm font-extrabold text-red-600 tabular-nums">
                          {formatIDR(yesterdayReport.summary?.total_expense ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* 2. Detail Penjualan & Proyek (Income) */}
                    <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100/50 flex flex-col justify-between space-y-4">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          Penjualan & Pemasukan
                        </h4>

                        <div className="space-y-3">
                          {/* Penjualan Material */}
                          <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl shadow-2xs border border-slate-100/80 hover:border-slate-200 transition-colors">
                            <div>
                              <p className="text-xs text-slate-500 font-bold">Penjualan Material</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {yesterdayReport.income?.material_sales?.count ?? 0} transaksi penjualan
                              </p>
                            </div>
                            <span className="text-sm font-bold text-emerald-600 tabular-nums">
                              {formatIDR(yesterdayReport.income?.material_sales?.total ?? 0)}
                            </span>
                          </div>

                          {/* Pembayaran Proyek */}
                          <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl shadow-2xs border border-slate-100/80 hover:border-slate-200 transition-colors">
                            <div>
                              <p className="text-xs text-slate-500 font-bold">Pemasukan Proyek</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Termin pembayaran proyek
                              </p>
                            </div>
                            <span className="text-sm font-bold text-emerald-600 tabular-nums">
                              {formatIDR(yesterdayReport.income?.project_payments?.total ?? 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center text-xs font-bold text-slate-600 mt-2">
                        <span>Total Pemasukan</span>
                        <span className="text-sm font-extrabold text-emerald-600 tabular-nums">
                          {formatIDR(yesterdayReport.summary?.total_income ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* 3. Ringkasan & Net Profitability */}
                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white flex flex-col justify-between shadow-lg shadow-slate-950/20 fluid-metric-container">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
                          <Wallet className="w-4 h-4 text-indigo-400" />
                          Net Profitability
                        </h4>
                        
                        <div className="pt-2">
                          <p className="text-xs text-slate-400 font-medium">Selisih Bersih Kemarin</p>
                          <p className={`text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight mt-1.5 tabular-nums fluid-metric-value ${
                            (yesterdayReport.summary?.net ?? 0) >= 0 ? "text-emerald-400" : "text-amber-400"
                          }`}>
                            {formatIDR(yesterdayReport.summary?.net ?? 0)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6">
                        {(yesterdayReport.summary?.net ?? 0) >= 0 ? (
                          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl w-full justify-center text-xs font-bold shadow-xs animate-pulse">
                            <TrendingUp className="w-4 h-4 shrink-0" />
                            Surplus Keuangan Kemarin
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3.5 py-2.5 rounded-xl w-full justify-center text-xs font-bold shadow-xs animate-pulse">
                            <TrendingDown className="w-4 h-4 shrink-0" />
                            Defisit Operasional Kemarin
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
              {isGM && ps?.recent_pending?.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">
                      {ps.pending_count} Slip Gaji Menunggu Approval GM
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {ps.recent_pending.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {rec.employee_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(rec.period_start)} –{" "}
                            {formatDate(rec.period_end)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-700">
                            {formatIDR(rec.net_salary)}
                          </span>
                          <button
                            onClick={() => setPayrollApproveModal({ isOpen: true, id: rec.id })}
                            disabled={approvingId === rec.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60"
                          >
                            {approvingId === rec.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {ps.pending_count > 5 && (
                    <div className="px-5 py-2 bg-gray-50 border-t border-gray-100">
                      <button
                        onClick={() => navigate("/payroll")}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + {ps.pending_count - 5} lainnya → Lihat semua di
                        Payroll
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* No pending – show success banner */}
              {isGM && ps?.pending_count === 0 && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800 font-medium">
                    Semua slip gaji sudah diapprove. Tidak ada yang menunggu.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Laporan Keuangan Hari Ini (GM Only) ──────────────────────────── */}
      {isGM &&
        (() => {
          const totalIncome = dailyReport?.summary?.total_income ?? 0;
          const totalExpense = dailyReport?.summary?.total_expense ?? 0;
          const net = dailyReport?.summary?.net ?? totalIncome - totalExpense;
          const payrollTotal = dailyReport?.expenses?.payroll?.total ?? 0;
          const fuelTotal = dailyReport?.expenses?.fuel?.total ?? 0;
          const othersTotal = dailyReport?.expenses?.others?.total ?? 0;
          const hasData = totalIncome > 0 || totalExpense > 0;

          const pct = (val) =>
            totalExpense > 0
              ? Math.min(100, (val / totalExpense) * 100).toFixed(1)
              : 0;

          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-emerald-600" />
                    Laporan Keuangan
                  </h2>
                  <input
                    type="date"
                    value={dailyReportDate}
                    onChange={(e) => setDailyReportDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => navigate("/daily-report")}
                  className="text-sm text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
                >
                  Laporan Lengkap <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loadingDaily ? (
                <div className="flex items-center gap-2 text-gray-400 py-4">
                  <Loader2 className="w-5 h-5 animate-spin" /> Memuat laporan
                  harian…
                </div>
              ) : !hasData ? (
                <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                  <BarChart2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500 font-medium mb-4">
                    Belum ada transaksi hari ini
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => navigate("/expenses")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Input Pengeluaran
                    </button>
                    <button
                      onClick={() => navigate("/income")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Input Pemasukan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 3 Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                      icon={TrendingUp}
                      label="Pemasukan Hari Ini"
                      value={formatIDR(totalIncome)}
                      color="bg-emerald-500"
                      onClick={() => navigate("/income")}
                    />
                    <StatCard
                      icon={TrendingDown}
                      label="Pengeluaran Hari Ini"
                      value={formatIDR(totalExpense)}
                      color="bg-red-500"
                      onClick={() => navigate("/expenses")}
                    />
                    <StatCard
                      icon={net >= 0 ? TrendingUp : TrendingDown}
                      label="Net Balance"
                      value={formatIDR(Math.abs(net))}
                      sub={net >= 0 ? "Surplus" : "Defisit"}
                      color={net >= 0 ? "bg-blue-600" : "bg-orange-500"}
                    />
                  </div>

                  {/* Breakdown pengeluaran */}
                  {totalExpense > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">
                        Rincian Pengeluaran Hari Ini
                      </h3>
                      <div className="space-y-3">
                        {/* Payroll */}
                        {payrollTotal > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span className="font-medium">Gaji Karyawan</span>
                              <span className="tabular-nums">
                                {formatIDR(payrollTotal)} ({pct(payrollTotal)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${pct(payrollTotal)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {/* BBM */}
                        {fuelTotal > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span className="font-medium">BBM</span>
                              <span className="tabular-nums">
                                {formatIDR(fuelTotal)} ({pct(fuelTotal)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-amber-400 h-2 rounded-full transition-all"
                                style={{ width: `${pct(fuelTotal)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {/* Lain-lain */}
                        {othersTotal > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span className="font-medium">
                                Koordinasi & Lain-lain
                              </span>
                              <span className="tabular-nums">
                                {formatIDR(othersTotal)} ({pct(othersTotal)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-gray-400 h-2 rounded-full transition-all"
                                style={{ width: `${pct(othersTotal)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick action links */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "+ Pengeluaran",
                        path: "/expenses",
                        color:
                          "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
                      },
                      {
                        label: "+ Pemasukan",
                        path: "/income",
                        color:
                          "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
                      },
                      {
                        label: "Payroll",
                        path: "/payroll",
                        color:
                          "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200",
                      },
                      {
                        label: "Laporan Lengkap",
                        path: "/daily-report",
                        color:
                          "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
                      },
                    ].map((btn) => (
                      <button
                        key={btn.path}
                        onClick={() => navigate(btn.path)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${btn.color}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuel chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Penggunaan BBM per Alat (30 hari)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Total liter BBM yang diisi per unit
            </p>
          </div>
          {fuelChartData.length === 0 ? (
            <p className="text-gray-400 text-sm py-10 text-center">
              Belum ada data BBM dalam 30 hari terakhir.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={fuelChartData}
                margin={{ top: 8, right: 8, bottom: 40, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  angle={-28}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)} L`, "Total BBM"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName || ""
                  }
                />
                <Bar
                  dataKey="liters"
                  name="Liter"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Project status pie */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              Status Proyek
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Distribusi status proyek aktif
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={projectData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {projectData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── BBM Table ─────────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <Fuel className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Ringkasan BBM (30 hari)
            </h2>
            <p className="text-xs text-gray-400">
              Per unit yang punya pengisian BBM
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase whitespace-nowrap">
                  Alat
                </th>
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase whitespace-nowrap">
                  Tipe
                </th>
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase text-right whitespace-nowrap">
                  Total BBM (L)
                </th>
                <th className="px-4 py-2 font-medium text-gray-600 text-xs uppercase text-right whitespace-nowrap">
                  Kali Isi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fuelEquipmentReport.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    Belum ada aktivitas BBM dalam periode ini.
                  </td>
                </tr>
              ) : (
                fuelEquipmentReport.map((row) => (
                  <tr
                    key={row.equipment_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                      {row.equipment_name}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {row.equipment_type}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-amber-700 tabular-nums whitespace-nowrap">
                      {row.total_liters.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600 tabular-nums whitespace-nowrap">
                      {row.refuel_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Equipment + Employee tables ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-500" /> Equipment
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Nama
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Tipe
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {equipment.slice(0, 8).map((eq) => (
                  <tr key={eq.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {eq.name}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{eq.type}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          eq.status === "active"
                            ? "bg-green-100 text-green-700"
                            : eq.status === "maintenance"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {eq.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {equipment.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-6 text-center text-gray-400"
                    >
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {equipment.length > 8 && (
            <p className="text-xs text-gray-400 mt-2 text-right">
              + {equipment.length - 8} lainnya
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" /> Karyawan
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Nama
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Jabatan
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.slice(0, 8).map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {emp.name}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {emp.position}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          emp.status === "active"
                            ? "bg-green-100 text-green-700"
                            : emp.status === "on_leave"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {emp.status ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-6 text-center text-gray-400"
                    >
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {employees.length > 8 && (
            <p className="text-xs text-gray-400 mt-2 text-right">
              + {employees.length - 8} lainnya
            </p>
          )}
        </div>
      </div>

      {/* ── Unpaid Center (Finance & GM) ─────────────────────────────────── */}
      {(role === 'finance' || isGM) && financeSummary && (
        <div id="unpaid-center" className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden p-6 mt-8">
          <h2 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5" />
            Unpaid Center - Menunggu Pelunasan
          </h2>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Invoices */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex justify-between items-center">
                <span>Invoice Customer Unpaid</span>
                <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_invoices.length}</span>
              </h3>
              <div className="space-y-2">
                {financeSummary.unpaid_invoices.length === 0 ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_invoices.map(inv => (
                  <div key={inv.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{inv.invoice_number}</p>
                      <p className="text-[10px] text-slate-500">{inv.customer_name} • {formatDate(inv.date)}</p>
                      <p className="text-xs font-semibold text-orange-600">{formatIDR(inv.amount)}</p>
                    </div>
                    <button onClick={() => handleMarkPaid('invoice', inv.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                      Tandai Lunas
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Payroll */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex justify-between items-center">
                <span>Gaji Karyawan Unpaid</span>
                <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_payroll.length}</span>
              </h3>
              <div className="space-y-2">
                {financeSummary.unpaid_payroll.length === 0 ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_payroll.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{p.employee_name}</p>
                      <p className="text-[10px] text-slate-500">Periode: {formatDate(p.period_start)} - {formatDate(p.period_end)}</p>
                      <p className="text-xs font-semibold text-red-600">{formatIDR(p.amount)}</p>
                    </div>
                    <button onClick={() => handleMarkPaid('payroll', p.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                      Tandai Lunas
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Fuel */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex justify-between items-center">
                <span>Pembelian BBM Unpaid</span>
                <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_fuel.length}</span>
              </h3>
              <div className="space-y-2">
                {financeSummary.unpaid_fuel.length === 0 ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_fuel.map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Solar {f.liters} L</p>
                      <p className="text-[10px] text-slate-500">{formatDate(f.date)}</p>
                      <p className="text-xs font-semibold text-red-600">{formatIDR(f.amount)}</p>
                    </div>
                    <button onClick={() => handleMarkPaid('fuel', f.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                      Tandai Lunas
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex justify-between items-center">
                <span>Pengeluaran Lainnya Unpaid</span>
                <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_expenses.length}</span>
              </h3>
              <div className="space-y-2">
                {financeSummary.unpaid_expenses.length === 0 ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_expenses.map(e => (
                  <div key={e.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase">{e.category}</p>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{e.description}</p>
                      <p className="text-xs font-semibold text-red-600">{formatIDR(e.amount)}</p>
                    </div>
                    <button onClick={() => handleMarkPaid('expense', e.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                      Tandai Lunas
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      
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
