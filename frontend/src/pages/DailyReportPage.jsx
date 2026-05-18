import React, { useState, useEffect, useCallback } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Fuel,
  FileText,
  Users,
  Package,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "../api/auth";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatIDR = (v) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatIDRShort = (v) => {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const offsetDate = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const formatDateID = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = {
  payroll: "#3b82f6", // blue-500
  fuel: "#f59e0b", // amber-500
  others: "#9ca3af", // gray-400
  income: "#22c55e", // green-500
};

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#9ca3af"];

const PAYMENT_TERM_MAP = {
  termin_1: "Termin 1",
  termin_2: "Termin 2",
  termin_3: "Termin 3",
  lunas: "Lunas",
  dp: "DP",
  pelunasan: "Pelunasan",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const SkeletonBlock = ({ className = "" }) => (
  <div className={`bg-gray-100 animate-pulse rounded-lg ${className}`} />
);

const SummaryCardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
    <SkeletonBlock className="h-4 w-24" />
    <SkeletonBlock className="h-8 w-40" />
    <SkeletonBlock className="h-3 w-32" />
  </div>
);

// ─── Summary Cards ────────────────────────────────────────────────────────────

const SummaryCard = ({ title, amount, sub, icon: Icon, color, loading }) => {
  if (loading) return <SummaryCardSkeleton />;
  return (
    <div className={`rounded-xl shadow-sm p-6 text-white ${color}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium opacity-90">{title}</span>
        <Icon size={22} className="opacity-80" />
      </div>
      <p className="text-2xl font-bold">{formatIDR(amount)}</p>
      {sub && <p className="text-xs mt-1.5 opacity-80">{sub}</p>}
    </div>
  );
};

// ─── Net Balance Card ─────────────────────────────────────────────────────────

const NetCard = ({ net, loading }) => {
  if (loading) return <SummaryCardSkeleton />;
  const positive = net >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div
      className={`rounded-xl shadow-sm p-6 ${positive ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-sm font-medium ${positive ? "text-emerald-700" : "text-red-700"}`}
        >
          Net Balance
        </span>
        <Icon
          size={22}
          className={positive ? "text-emerald-500" : "text-red-500"}
        />
      </div>
      <p
        className={`text-2xl font-bold ${positive ? "text-emerald-700" : "text-red-700"}`}
      >
        {positive ? "+" : ""}
        {formatIDR(net)}
      </p>
      <p
        className={`text-xs mt-1.5 font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}
      >
        {positive ? "✅ SURPLUS" : "🔴 DEFISIT"}
      </p>
    </div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, total, iconColor }) => (
  <div className={`flex items-center justify-between mb-3 pb-2 border-b`}>
    <div className="flex items-center gap-2">
      <Icon size={18} className={iconColor} />
      <h3 className="font-semibold text-gray-800">{title}</h3>
    </div>
    <span className="text-sm font-bold text-gray-700">{formatIDR(total)}</span>
  </div>
);

// ─── Simple Table ─────────────────────────────────────────────────────────────

const SimpleTable = ({ headers, rows, emptyMsg = "Tidak ada data" }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-100">
    <table className="w-full text-xs">
      <thead className="bg-gray-50">
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className={`px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide ${h.right ? "text-right" : "text-left"}`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={headers.length}
              className="px-3 py-4 text-center text-gray-400"
            >
              {emptyMsg}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 text-gray-700 ${headers[j]?.right ? "text-right font-semibold" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// ─── Tooltip Formatter ────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium">{formatIDRShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const DailyReportPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [reportDate, setReportDate] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // ── fetch user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user);
          const allowed =
            user.role === "gm" ||
            user.role === "finance" ||
            user.is_admin === true;
          if (!allowed) setAccessDenied(true);
        }
      } catch {
        /* ignore */
      }
    };
    fetchUser();
  }, []);

  // ── fetch daily report ──────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/dashboard/daily-report?report_date=${reportDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Gagal memuat laporan harian");
      setReport(await res.json());
    } catch (err) {
      toast.error(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [reportDate]);

  // ── fetch history 7 days ────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/dashboard/daily-report/history?days=7`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Gagal memuat history");
      setHistory(await res.json());
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Access denied guard ─────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">
          Halaman ini hanya tersedia untuk GM dan Finance Staff.
        </p>
      </div>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const summary = report?.summary ?? {
    total_income: 0,
    total_expense: 0,
    net: 0,
  };
  const expenses = report?.expenses ?? {};
  const income = report?.income ?? {};

  const payroll = expenses.payroll ?? { total: 0, count: 0, items: [] };
  const fuel = expenses.fuel ?? {
    total: 0,
    total_liters: 0,
    price_per_liter: 0,
    count: 0,
    items: [],
  };
  const others = expenses.others ?? {
    total: 0,
    by_category: {},
    count: 0,
    items: [],
  };

  const projectPayments = income.project_payments ?? {
    total: 0,
    count: 0,
    items: [],
  };
  const materialSales = income.material_sales ?? {
    total: 0,
    count: 0,
    items: [],
  };

  // PieChart data
  const pieData = [
    { name: "Gaji", value: payroll.total },
    { name: "BBM", value: fuel.total },
    { name: "Lainnya", value: others.total },
  ].filter((d) => d.value > 0);

  const hasExpenseData = summary.total_expense > 0;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Laporan Keuangan Harian
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Ringkasan pemasukan, pengeluaran, dan saldo bersih harian
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors self-start"
          >
            <Printer size={16} />
            Print
          </button>
        </div>

        {/* ── Date Navigator ── */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
          <button
            onClick={() => setReportDate((d) => offsetDate(d, -1))}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
            Kemarin
          </button>

          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-blue-500" />
            <div className="text-center">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formatDateID(reportDate)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setReportDate((d) => offsetDate(d, 1))}
            disabled={reportDate >= todayISO()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Besok
            <ChevronRight size={16} />
          </button>

          <button
            onClick={fetchReport}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title="Total Pemasukan"
            amount={summary.total_income}
            sub={`${projectPayments.count + materialSales.count} sumber pemasukan`}
            icon={TrendingUp}
            color="bg-emerald-500"
            loading={loading}
          />
          <SummaryCard
            title="Total Pengeluaran"
            amount={summary.total_expense}
            sub={`Gaji · BBM · Lain-lain`}
            icon={TrendingDown}
            color="bg-red-500"
            loading={loading}
          />
          <NetCard net={summary.net} loading={loading} />
        </div>

        {/* ── History Chart + Pie Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stacked Bar Chart 7 hari */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">
              Tren 7 Hari Terakhir
            </h2>
            {histLoading ? (
              <div className="h-56 flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-gray-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                <Minus size={32} className="mb-2" />
                <p className="text-sm">Belum ada data historis</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={history}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date_label"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatIDRShort}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) =>
                      v === "payroll"
                        ? "Gaji"
                        : v === "fuel"
                          ? "BBM"
                          : v === "others"
                            ? "Lainnya"
                            : "Pemasukan"
                    }
                  />
                  <Bar
                    dataKey="payroll"
                    name="payroll"
                    stackId="exp"
                    fill={CHART_COLORS.payroll}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="fuel"
                    name="fuel"
                    stackId="exp"
                    fill={CHART_COLORS.fuel}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="others"
                    name="others"
                    stackId="exp"
                    fill={CHART_COLORS.others}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_income"
                    name="income"
                    stroke={CHART_COLORS.income}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_COLORS.income }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart komposisi pengeluaran */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">
              Komposisi Pengeluaran
            </h2>
            {loading ? (
              <div className="h-56 flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-gray-400" />
              </div>
            ) : !hasExpenseData ? (
              <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                <Minus size={32} className="mb-2" />
                <p className="text-sm">Tidak ada pengeluaran</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatIDR(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {pieData.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <span className="font-semibold text-gray-700">
                        {formatIDR(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Detail Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Pengeluaran Detail */}
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">
              Detail Pengeluaran
            </h2>

            {/* Gaji Karyawan */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              {loading ? (
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-40" />
                  <SkeletonBlock className="h-24" />
                </div>
              ) : (
                <>
                  <SectionHeader
                    icon={Users}
                    title={`Gaji Karyawan (${payroll.count})`}
                    total={payroll.total}
                    iconColor="text-blue-500"
                  />
                  <SimpleTable
                    headers={[
                      { label: "Nama Karyawan" },
                      { label: "Jabatan" },
                      { label: "Metode" },
                      { label: "Gaji Bersih", right: true },
                    ]}
                    rows={payroll.items.map((it) => [
                      it.employee_name ?? "-",
                      it.position ?? "-",
                      it.payment_method ?? "-",
                      formatIDR(it.net_salary),
                    ])}
                    emptyMsg="Belum ada pembayaran gaji hari ini"
                  />
                </>
              )}
            </div>

            {/* BBM */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              {loading ? (
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-32" />
                  <SkeletonBlock className="h-20" />
                </div>
              ) : (
                <>
                  <SectionHeader
                    icon={Fuel}
                    title={`BBM (${fuel.count})`}
                    total={fuel.total}
                    iconColor="text-amber-500"
                  />
                  {fuel.total > 0 && (
                    <p className="text-xs text-gray-500 mb-3">
                      {fuel.total_liters}L × {formatIDR(fuel.price_per_liter)}/L
                    </p>
                  )}
                  <SimpleTable
                    headers={[
                      { label: "Alat / Kendaraan" },
                      { label: "Liter", right: true },
                      { label: "Lokasi" },
                      { label: "Biaya", right: true },
                    ]}
                    rows={fuel.items.map((it) => [
                      it.equipment_name ?? "-",
                      `${it.liters ?? 0}L`,
                      it.location ?? "-",
                      formatIDR(it.cost),
                    ])}
                    emptyMsg="Belum ada pengisian BBM hari ini"
                  />
                </>
              )}
            </div>

            {/* Pengeluaran Lain */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              {loading ? (
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-36" />
                  <SkeletonBlock className="h-20" />
                </div>
              ) : (
                <>
                  <SectionHeader
                    icon={FileText}
                    title={`Pengeluaran Lain (${others.count})`}
                    total={others.total}
                    iconColor="text-gray-500"
                  />
                  {/* by_category breakdown */}
                  {others.total > 0 &&
                    Object.keys(others.by_category ?? {}).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Object.entries(others.by_category).map(
                          ([cat, val]) => (
                            <span
                              key={cat}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                            >
                              {cat}: {formatIDR(val)}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  <SimpleTable
                    headers={[
                      { label: "Kategori" },
                      { label: "Keterangan" },
                      { label: "Jumlah", right: true },
                    ]}
                    rows={others.items.map((it) => [
                      it.category ?? "-",
                      it.description ?? "-",
                      formatIDR(it.amount),
                    ])}
                    emptyMsg="Belum ada pengeluaran lain hari ini"
                  />
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Pemasukan Detail */}
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">
              Detail Pemasukan
            </h2>

            {/* Pembayaran Project */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              {loading ? (
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-40" />
                  <SkeletonBlock className="h-24" />
                </div>
              ) : (
                <>
                  <SectionHeader
                    icon={Wallet}
                    title={`Pembayaran Proyek (${projectPayments.count})`}
                    total={projectPayments.total}
                    iconColor="text-emerald-500"
                  />
                  <SimpleTable
                    headers={[
                      { label: "Deskripsi" },
                      { label: "Termin" },
                      { label: "Metode" },
                      { label: "Jumlah", right: true },
                    ]}
                    rows={projectPayments.items.map((it) => [
                      it.description ?? "-",
                      PAYMENT_TERM_MAP[it.payment_term] ??
                        it.payment_term ??
                        "-",
                      it.payment_method ?? "-",
                      formatIDR(it.amount),
                    ])}
                    emptyMsg="Belum ada pembayaran proyek hari ini"
                  />
                </>
              )}
            </div>

            {/* Penjualan Material */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              {loading ? (
                <div className="space-y-2">
                  <SkeletonBlock className="h-5 w-36" />
                  <SkeletonBlock className="h-24" />
                </div>
              ) : (
                <>
                  <SectionHeader
                    icon={Package}
                    title={`Penjualan Material (${materialSales.count})`}
                    total={materialSales.total}
                    iconColor="text-teal-500"
                  />
                  <SimpleTable
                    headers={[
                      { label: "Customer" },
                      { label: "Material" },
                      { label: "Qty" },
                      { label: "Harga/Unit", right: true },
                      { label: "Total", right: true },
                    ]}
                    rows={materialSales.items.map((it) => [
                      it.customer_name ?? "-",
                      it.material_type ?? "-",
                      `${it.quantity ?? 0} ${it.unit ?? ""}`,
                      formatIDR(it.unit_price),
                      formatIDR(it.amount),
                    ])}
                    emptyMsg="Belum ada penjualan material hari ini"
                  />
                </>
              )}
            </div>

            {/* Ringkasan Hari Ini */}
            {!loading && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-sm p-5 text-white">
                <h3 className="font-semibold mb-4">Ringkasan Hari Ini</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-80">Total Pemasukan</span>
                    <span className="font-bold">
                      {formatIDR(summary.total_income)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">Total Pengeluaran</span>
                    <span className="font-bold">
                      {formatIDR(summary.total_expense)}
                    </span>
                  </div>
                  <div className="border-t border-white/20 pt-2.5 flex justify-between">
                    <span className="font-semibold">Net Balance</span>
                    <span
                      className={`font-bold text-base ${
                        summary.net >= 0 ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {summary.net >= 0 ? "+" : ""}
                      {formatIDR(summary.net)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Empty state jika tidak ada data sama sekali ── */}
        {!loading && !report && (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 font-medium text-lg">
              Tidak ada data laporan
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Belum ada transaksi yang tercatat pada {formatDateID(reportDate)}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default DailyReportPage;
