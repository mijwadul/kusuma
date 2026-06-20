import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Wallet,
  Receipt,
  XCircle,
  Smile,
  Zap,
  Bot
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import AlertModal from "../components/AlertModal";
import { toLocalDateInput, formatIDR, formatDate, toLocalDateTimeString } from "../utils/formatters";
import StatCard from "../components/dashboard/StatCard";
import SmartActionsPanel from "../components/dashboard/SmartActionsPanel";
import AttendancePanel from "../components/dashboard/AttendancePanel";
import EntityTablesPanel from "../components/dashboard/EntityTablesPanel";
import YesterdayReportPanel from "../components/dashboard/YesterdayReportPanel";
import TypewriterText from "../components/ui/TypewriterText";
import AILiveLogs from "../components/ui/AILiveLogs";

import { usePermissions } from "../hooks/usePermissions";
import {
  useDashboardStats,
  usePayrollSummary,
  useFuelEfficiency,
  useDashboardEquipment,
  useDashboardEmployees,
  useFinanceSummary,
  useDailyReport,
  useTodayAttendance,
  useApprovePayroll,
  useApproveFuel,
  useMarkPaid,
  useAttendanceAction
} from "../hooks/useDashboard";

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { currentUser, isGM } = usePermissions();

  // Derived role flags
  const role = currentUser?.role ?? "";
  const canSeePayroll = Boolean(
    ["gm", "finance", "admin", "checker", "direktur"].includes(role) ||
    currentUser?.is_admin ||
    currentUser?.is_superuser
  );

  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateInput(d);
  }, []);

  // React Query Fetching
  const { data: stats = { equipment_count: 0, employee_count: 0, project_count: 0 }, isLoading: loadingStats } = useDashboardStats();
  const { data: payrollSummary, isLoading: loadingPayroll } = usePayrollSummary();
  const { data: fuelStats = { total_fuel_consumed: 0, equipment_count: 0 }, isLoading: loadingFuelStats } = useFuelEfficiency(30);
  const { data: equipment = [] } = useDashboardEquipment();
  const { data: employees = [] } = useDashboardEmployees();

  const { data: financeSummary } = useFinanceSummary(canSeePayroll || isGM);

  const { data: yesterdayReport, isLoading: loadingYesterday } = useDailyReport(isGM ? yesterdayDate : "");

  const { data: todayAttendance = [], isLoading: attendanceLoading } = useTodayAttendance(
    yesterdayDate,
    toLocalDateInput(new Date()),
    role === "field"
  );

  // Mutations
  const approvePayroll = useApprovePayroll();
  const approveFuel = useApproveFuel();
  const markPaid = useMarkPaid();
  const attendanceAction = useAttendanceAction();

  // Local UI States
  const [selectedFieldEmployee, setSelectedFieldEmployee] = useState("");
  const [deleteAttendanceModal, setDeleteAttendanceModal] = useState<{ isOpen: boolean, employeeId: number | null, attendanceId: number | null }>({ isOpen: false, employeeId: null, attendanceId: null });
  const [fuelActionModal, setFuelActionModal] = useState<{ isOpen: boolean, id: number | null, action: 'approved' | 'rejected' | null }>({ isOpen: false, id: null, action: null });
  const [payrollApproveModal, setPayrollApproveModal] = useState<{ isOpen: boolean, id: number | null }>({ isOpen: false, id: null });

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return "Selamat Pagi";
    if (hours >= 11 && hours < 15) return "Selamat Siang";
    if (hours >= 15 && hours < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  const getRoleLabelAndIcon = (roleName: string) => {
    switch (roleName?.toLowerCase()) {
      case "gm": return { label: "General Manager", badge: "bg-amber-100 text-amber-800 border-amber-200" };
      case "direktur": return { label: "Direktur Utama", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case "finance": return { label: "Finance & Accounting", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "field": return { label: "Operational Field Staff", badge: "bg-blue-100 text-blue-800 border-blue-200" };
      case "checker": return { label: "Checker Lapangan", badge: "bg-cyan-100 text-cyan-800 border-cyan-200" };
      case "admin": return { label: "System Administrator", badge: "bg-purple-100 text-purple-800 border-purple-200" };
      default: return { label: roleName ? roleName.toUpperCase() : "User", badge: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    toast.success("Data berhasil diperbarui!");
  };

  const operationEmployees = useMemo(() => {
    return employees.filter((e: any) => e.department && e.department.toLowerCase().startsWith("operation"));
  }, [employees]);

  const aiMessage = useMemo(() => {
    let aiHints = [];

    if (financeSummary) {
      if (financeSummary.pending_fuel_purchases > 0) {
        aiHints.push(`Saya mendeteksi ${financeSummary.pending_fuel_purchases} pengajuan BBM yang perlu Anda setujui.`);
      }
      if (financeSummary.pending_expenses > 0) {
        aiHints.push(`Terdapat ${financeSummary.pending_expenses} pengeluaran pending yang menunggu otorisasi Anda.`);
      }
      if (financeSummary.unpaid_invoices_count > 0) {
        aiHints.push(`Sistem memantau ada ${financeSummary.unpaid_invoices_count} invoice pelanggan yang belum lunas. Mari kita tindak lanjuti.`);
      }
      if (financeSummary.unprocessed_attendances_count > 0) {
        aiHints.push(`Sistem mencatat ${financeSummary.unprocessed_attendances_count} karyawan yang absensinya belum diproses menjadi slip gaji.`);
      }
      if ((financeSummary.equipment_balances ?? financeSummary.vendor_deposits ?? []).some((b: any) => (b.balance ?? b.balance_deposit ?? 0) <= 5000000)) {
        aiHints.push(`Peringatan sistem: Beberapa deposit alat berat Anda menipis. Harap lakukan top-up.`);
      }
    }

    if (payrollSummary && payrollSummary.pending_count > 0) {
      aiHints.push(`Terdapat ${payrollSummary.pending_count} slip gaji yang siap untuk Anda validasi.`);
    }

    if (role === 'field' && todayAttendance && todayAttendance.length === 0) {
      aiHints.push("Pemantauan lapangan aktif. Anda belum mengisi absensi untuk tim hari ini.");
    } else if (role === 'field') {
      aiHints.push("Koneksi lapangan stabil. Silakan lanjutkan pelaporan harian Anda.");
    }

    const defaultMessages = [
      "Semua modul sistem beroperasi optimal. Tidak ada anomali yang terdeteksi.",
      "Koneksi terenkripsi penuh. Saya siap membantu mengelola operasi Anda hari ini.",
      "Aktivitas Anda telah saya sinkronisasi ke cloud. Apa yang ingin kita kerjakan sekarang?",
      "Database terhubung dengan latensi rendah. Sistem siap digunakan.",
      "Pemantauan keamanan berjalan di latar belakang. Semua parameter normal."
    ];

    if (aiHints.length > 0) {
      return aiHints[Math.floor(Math.random() * aiHints.length)];
    } else {
      return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
    }
  }, [financeSummary, payrollSummary, role, todayAttendance]);

  const dynamicHeaderStyles = useMemo(() => {
    const hasUrgentAction = (financeSummary?.pending_fuel_purchases > 0) || 
                            (financeSummary?.pending_expenses > 0) ||
                            (payrollSummary?.pending_count > 0);
                            
    if (hasUrgentAction) {
      return {
        bg: "bg-slate-900/95",
        orb1: "bg-orange-600/20",
        orb2: "bg-red-500/15 animate-pulse",
        border: "border-orange-500/40",
        glow: "shadow-[0_20px_40px_-15px_rgba(249,115,22,0.25)]"
      };
    }
    
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) { // Pagi
      return {
        bg: "bg-slate-900/85",
        orb1: "bg-amber-500/15",
        orb2: "bg-sky-400/15",
        border: "border-slate-700/50",
        glow: "shadow-[0_20px_40px_-15px_rgba(14,165,233,0.2)]"
      };
    }
    if (hours >= 11 && hours < 15) { // Siang
      return {
        bg: "bg-slate-900/85",
        orb1: "bg-sky-500/15",
        orb2: "bg-blue-500/15",
        border: "border-slate-700/50",
        glow: "shadow-[0_20px_40px_-15px_rgba(59,130,246,0.2)]"
      };
    }
    if (hours >= 15 && hours < 18) { // Sore
      return {
        bg: "bg-slate-900/85",
        orb1: "bg-orange-500/15",
        orb2: "bg-purple-500/15",
        border: "border-slate-700/50",
        glow: "shadow-[0_20px_40px_-15px_rgba(168,85,247,0.2)]"
      };
    }
    // Malam
    return {
      bg: "bg-slate-950/95",
      orb1: "bg-indigo-600/20",
      orb2: "bg-violet-600/15",
      border: "border-indigo-500/30",
      glow: "shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)]"
    };
  }, [financeSummary, payrollSummary]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`relative overflow-hidden rounded-3xl backdrop-blur-2xl p-6 md:p-8 text-white transition-all duration-1000 ${dynamicHeaderStyles.bg} ${dynamicHeaderStyles.border} ${dynamicHeaderStyles.glow} border`}>
        <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 transition-colors duration-1000 ${dynamicHeaderStyles.orb1}`}></div>
        <div className={`absolute bottom-0 left-1/3 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-colors duration-1000 ${dynamicHeaderStyles.orb2}`}></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-6">

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">SYSTEM KUSUMA</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v3.2 Active
                </span>
              </div>
              <h1 className="flex items-center text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                {getGreeting()}, <span className="bg-gradient-to-r from-blue-200 via-indigo-100 to-white bg-clip-text text-transparent mx-1.5">{currentUser?.full_name || "User"}</span>! <Smile className="w-6 h-6 md:w-8 md:h-8 text-yellow-300 ml-1.5" />
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleLabelAndIcon(role).badge}`}>
                  {getRoleLabelAndIcon(role).label}
                </span>
                <span className="text-xs text-indigo-300/80 font-normal">({currentUser?.email || "-"})</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm relative overflow-hidden group w-fit max-w-[90%] md:max-w-md">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                <Bot className="w-4 h-4 text-indigo-300 animate-pulse shrink-0" />
                <p className="text-xs text-indigo-100 font-medium tracking-wide">
                  <span className="text-indigo-300 font-bold mr-1">AI System:</span>
                  <TypewriterText text={aiMessage} />
                </p>
              </div>
              <AILiveLogs />
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
                onClick={handleRefresh}
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-indigo-300 hover:text-white transition-all hover:scale-105 border border-slate-700/40"
                title="Refresh data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AttendancePanel
        role={role}
        operationEmployees={operationEmployees}
        selectedFieldEmployee={selectedFieldEmployee}
        setSelectedFieldEmployee={setSelectedFieldEmployee}
        todayAttendance={todayAttendance}
        attendanceLoading={attendanceAction.isPending || attendanceLoading}
        handleAttendanceAction={(empId: number, action: any, attId?: number) => {
          const now = new Date();
          attendanceAction.mutate({
            employeeId: empId,
            action,
            attendanceId: attId,
            date: toLocalDateInput(now),
            timeStr: toLocalDateTimeString()
          });
        }}
        setDeleteAttendanceModal={setDeleteAttendanceModal}
      />

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

          {(financeSummary.equipment_balances ?? financeSummary.vendor_deposits ?? []).filter((b: any) => (b.balance ?? b.balance_deposit ?? 0) <= 5000000).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-800">Deposit Alat Berat Menipis / Minus</h3>
                <p className="text-xs text-red-600 mt-1 mb-2">Alat berat berikut membutuhkan top-up deposit segera:</p>
                <div className="space-y-1">
                  {(financeSummary.equipment_balances ?? financeSummary.vendor_deposits ?? [])
                    .filter((b: any) => (b.balance ?? b.balance_deposit ?? 0) <= 5000000)
                    .sort((a: any, b: any) => (a.balance ?? a.balance_deposit ?? 0) - (b.balance ?? b.balance_deposit ?? 0))
                    .map((b: any, idx: number) => {
                      const balance = b.balance ?? b.balance_deposit ?? 0;
                      const eqName = b.equipment_name ?? b.name ?? "-";
                      const vendorName = b.vendor_name;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-1.5 border border-red-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">{eqName}</span>
                            {vendorName && <span className="text-xs text-gray-400">({vendorName})</span>}
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-bold tabular-nums ${balance < 0 ? "text-red-700" : "text-amber-700"}`}>
                            {balance < 0 ? <AlertTriangle size={14} className="text-red-500" /> : <Zap size={14} className="text-amber-500" />} {formatIDR(balance)}
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

          <YesterdayReportPanel
            role={role}
            isGM={isGM}
            loadingYesterday={loadingYesterday}
            yesterdayReport={yesterdayReport}
          />

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
                  financeSummary.recent_pending_fuel.map((rec: any) => (
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

      {role !== 'finance' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <StatCard
            icon={Truck}
            label="Total Equipment"
            value={stats.equipment_count}
            color="bg-blue-500"
            loading={loadingStats}
            onClick={() => navigate("/equipment")}
          />
          <StatCard
            icon={Users}
            label="Karyawan Aktif"
            value={stats.employee_count}
            color="bg-emerald-500"
            loading={loadingStats}
            onClick={() => navigate("/employees")}
          />
          <StatCard
            icon={FolderOpen}
            label="Total Proyek"
            value={stats.project_count}
            color="bg-purple-500"
            loading={loadingStats}
          />
          <StatCard
            icon={Gauge}
            label="BBM 30 Hari"
            value={`${fuelStats.total_fuel_consumed.toFixed(1)} L`}
            sub={`${fuelStats.equipment_count} unit`}
            color="bg-amber-500"
            loading={loadingFuelStats}
            onClick={() => navigate("/fuel")}
          />
        </div>
      )}

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-4">
                  <div className="p-3.5 rounded-2xl w-12 h-12 skeleton-box flex-shrink-0"></div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="h-4 w-24 skeleton-box"></div>
                    <div className="h-8 w-1/2 skeleton-box mt-1.5"></div>
                    <div className="h-3 w-32 skeleton-box mt-1"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-fade-in space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={Clock}
                  label="Menunggu Approval"
                  value={payrollSummary?.pending_count ?? 0}
                  sub={`Nilai: ${formatIDR(payrollSummary?.pending_total ?? 0)}`}
                  color="bg-amber-500"
                  badge={payrollSummary?.pending_count > 0 ? payrollSummary.pending_count : undefined}
                  onClick={() => navigate("/payroll")}
                />
                <StatCard
                  icon={CheckCircle}
                  label={`Approved (${payrollSummary?.month_label ?? "Bulan Ini"})`}
                  value={payrollSummary?.approved_count ?? 0}
                  sub={`Total: ${formatIDR(payrollSummary?.approved_total ?? 0)}`}
                  color="bg-green-500"
                  onClick={() => navigate("/payroll")}
                />
                <StatCard
                  icon={Wallet}
                  label={`Dibayar (${payrollSummary?.month_label ?? "Bulan Ini"})`}
                  value={payrollSummary?.paid_count ?? 0}
                  sub={`Total: ${formatIDR(payrollSummary?.paid_total ?? 0)}`}
                  color="bg-blue-600"
                  onClick={() => navigate("/payroll")}
                />
              </div>


            </div>
          )}
        </div>
      )}

      <EntityTablesPanel equipment={equipment} employees={employees} />

      <SmartActionsPanel
        isGM={isGM}
        role={role}
        payrollSummary={payrollSummary}
        financeSummary={financeSummary}
        approvingId={approvePayroll.isPending ? payrollApproveModal.id : null}
        setPayrollApproveModal={setPayrollApproveModal}
        handleMarkPaid={(type: any, id: number) => markPaid.mutate({ type, id })}
      />

      <AlertModal
        isOpen={deleteAttendanceModal.isOpen}
        onClose={() => setDeleteAttendanceModal({ isOpen: false, employeeId: null, attendanceId: null })}
        onConfirm={() => {
          if (deleteAttendanceModal.employeeId && deleteAttendanceModal.attendanceId) {
            attendanceAction.mutate({
              employeeId: deleteAttendanceModal.employeeId,
              action: 'delete',
              attendanceId: deleteAttendanceModal.attendanceId
            });
          }
          setDeleteAttendanceModal({ isOpen: false, employeeId: null, attendanceId: null });
        }}
        title="Hapus Absensi Hari Ini"
        message="Apakah Anda yakin ingin membatalkan/menghapus absensi pekerja lapangan ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
      />

      <AlertModal
        isOpen={fuelActionModal.isOpen}
        onClose={() => setFuelActionModal({ isOpen: false, id: null, action: null })}
        onConfirm={() => {
          if (fuelActionModal.id && fuelActionModal.action) {
            approveFuel.mutate({ id: fuelActionModal.id, action: fuelActionModal.action }, {
              onSuccess: () => setFuelActionModal({ isOpen: false, id: null, action: null })
            });
          }
        }}
        title={fuelActionModal.action === 'approved' ? "Approve Pembelian BBM" : "Tolak Pembelian BBM"}
        message={fuelActionModal.action === 'approved' ? "Anda yakin ingin menyetujui pembelian BBM ini? Data pembelian akan dimasukkan ke stok BBM." : "Anda yakin ingin menolak pembelian BBM ini? Data akan masuk ke riwayat sebagai ditolak."}
        confirmText={fuelActionModal.action === 'approved' ? "Approve" : "Tolak"}
        cancelText="Batal"
        confirmColor={fuelActionModal.action === 'approved' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
      />

      <AlertModal
        isOpen={payrollApproveModal.isOpen}
        onClose={() => setPayrollApproveModal({ isOpen: false, id: null })}
        onConfirm={() => {
          if (payrollApproveModal.id) {
            approvePayroll.mutate(payrollApproveModal.id, {
              onSuccess: () => setPayrollApproveModal({ isOpen: false, id: null })
            });
          }
        }}
        title="Approve Slip Gaji"
        message="Apakah Anda yakin ingin menyetujui slip gaji karyawan ini?"
        confirmText="Approve"
        cancelText="Batal"
        confirmColor="bg-green-600 hover:bg-green-700"
      />
    </div>
  );
}
