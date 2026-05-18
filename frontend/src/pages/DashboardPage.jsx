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
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

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

// ─── Mini stat card ───────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, onClick, badge }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4
      ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" : ""}`}
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    {badge && (
      <span className="shrink-0 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
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
  const [financeSummary, setFinanceSummary] = useState(null);

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
      const res = await authFetch(`${API_URL}/employees/attendance?start_date=${today}&end_date=${today}`);
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
    if (!window.confirm("Approve slip gaji ini?")) return;
    setApprovingId(payrollId);
    try {
      await fetch(`${API_URL}/employees/payroll/${payrollId}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchAll();
    } catch {
      alert("Gagal approve payroll");
    } finally {
      setApprovingId(null);
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

  // ── attendance action ──
  const handleAttendanceAction = async (employeeId, action, attendanceId = null) => {
    setAttendanceLoading(true);
    try {
      const now = new Date();
      const todayStr = toLocalDateInput(now);
      const isoTime = now.toISOString();

      let url, method, body;
      if (action === 'check_in') {
        url = `${API_URL}/employees/attendance`;
        method = 'POST';
        body = JSON.stringify({
          employee_id: employeeId,
          date: todayStr,
          check_in: isoTime
        });
      } else if (action === 'check_out') {
        url = `${API_URL}/employees/attendance/${attendanceId}`;
        method = 'PUT';
        body = JSON.stringify({ check_out: isoTime });
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
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            PT. Kusuma Samudera Berkah – Ringkasan Operasional
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Refresh data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Field Staff Attendance ───────────────────────────────────────── */}
      {role === "field" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Absensi Pekerja Lapangan (Operation)
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Karyawan</label>
              <select 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                 
                 const currentRecord = todayAttendance.find(a => a.employee_id === selectedId);
                 
                 if (!currentRecord) {
                    return (
                      <button 
                        onClick={() => handleAttendanceAction(selectedId, 'check_in')}
                        disabled={attendanceLoading}
                        className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Wallet}
              label="Tagihan Unpaid"
              value={formatIDR(financeSummary.unpaid_bills_amount)}
              sub={`${financeSummary.unpaid_bills_count} tagihan menunggu`}
              color="bg-red-500"
              badge={financeSummary.unpaid_bills_count > 0 ? financeSummary.unpaid_bills_count : undefined}
              onClick={() => navigate("/expenses")}
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
              icon={Receipt}
              label="Pengeluaran Pending"
              value={financeSummary.pending_expenses}
              sub="Menunggu approval GM"
              color="bg-orange-500"
              badge={financeSummary.pending_expenses > 0 ? financeSummary.pending_expenses : undefined}
              onClick={() => navigate("/expenses")}
            />
          </div>

          {/* Pending Fuel Purchases List */}
          {(isGM || role === 'finance') && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mt-4">
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
              <FileText className="w-5 h-5 text-blue-600" />
              Payroll Overview
            </h2>
            <button
              onClick={() => navigate("/payroll")}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
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
                            onClick={() => handleApprove(rec.id)}
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
                          "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
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
    </div>
  );
};
