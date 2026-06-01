import React from 'react';
import { useNavigate } from "react-router-dom";
import { BarChart2, PlusCircle, TrendingUp, TrendingDown, ChevronRight, Loader2 } from "lucide-react";
import StatCard from "./StatCard";
import { formatIDR } from "../../utils/formatters";

const DailyReportPanel = ({ isGM, role, dailyReport, dailyReportDate, setDailyReportDate, loadingDaily }) => {
  const navigate = useNavigate();

  if (!(isGM || role === 'finance')) return null;

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6">
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
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 text-center mt-4">
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
        <div className="mt-4">
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
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
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
        </div>
      )}
    </div>
  );
};

export default DailyReportPanel;
