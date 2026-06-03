import React from 'react';
import { BarChart2, TrendingDown, TrendingUp, Wallet, Loader2 } from "lucide-react";
import { formatIDR, formatDate } from "../../utils/formatters";

interface YesterdayReportPanelProps {
  role: string;
  isGM: boolean;
  loadingYesterday: boolean;
  yesterdayReport: any;
}

const YesterdayReportPanel: React.FC<YesterdayReportPanelProps> = ({ role, isGM, loadingYesterday, yesterdayReport }) => {
  if (!(isGM || role === 'finance')) return null;

  return (
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
  );
};

export default YesterdayReportPanel;
