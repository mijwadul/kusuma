import React, { useState, useRef } from "react";
import {
  Calendar,
  FileText,
  Fuel,
  Clock,
  Users,
  ShoppingCart,
  Printer,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const API_BASE = "/api/v1";

const formatRupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatNum = (n, decimals = 2) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: decimals }).format(n || 0);

const formatDate = (d) => {
  if (!d) return "-";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const StatusBadge = ({ status }) => {
  const map = {
    approved: { bg: "bg-green-100", text: "text-green-800", label: "Approved" },
    paid: { bg: "bg-blue-100", text: "text-blue-800", label: "Dibayar" },
    pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Pending" },
    cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Batal" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

const SummaryCard = ({ icon: Icon, label, value, sub, color, iconBg }) => (
  <div className="report-card bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
    <div className={`p-3 rounded-xl ${iconBg}`}>
      <Icon size={22} className={color} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const TableWrapper = ({ children }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-100">
    <table className="w-full text-sm">{children}</table>
  </div>
);

const Th = ({ children, right }) => (
  <th
    className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100 ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);

const Td = ({ children, right, bold, muted }) => (
  <td
    className={`px-4 py-3 text-gray-700 border-b border-gray-50 ${right ? "text-right" : ""} ${bold ? "font-semibold" : ""} ${muted ? "text-gray-400" : ""}`}
  >
    {children}
  </td>
);

const TotalRow = ({ cols, label, value }) => (
  <tr className="bg-gray-50">
    <td
      colSpan={cols - 1}
      className="px-4 py-3 text-right font-bold text-gray-700 border-t border-gray-200"
    >
      {label}
    </td>
    <td className="px-4 py-3 text-right font-bold text-gray-900 border-t border-gray-200">
      {value}
    </td>
  </tr>
);

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6 report-section">
      <button
        onClick={() => setOpen((o) => !o)}
        className="no-print w-full flex items-center justify-between py-3 px-1 text-left"
      >
        <h3 className="text-base font-bold text-gray-800">{title}</h3>
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>
      <div className="print-section-title hidden">{title}</div>
      {open && <div>{children}</div>}
    </div>
  );
};

export default function ReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reportRef = useRef(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/reports/range?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Gagal memuat laporan");
      }
      setReport(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <>
      {/* ── Print-only styles ─────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-printable, #report-printable * { visibility: visible; }
          #report-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-section-title { display: block !important; font-weight: 700; font-size: 14px;
            margin-bottom: 8px; margin-top: 16px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          .report-card { break-inside: avoid; }
          .report-section { break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 4px 8px; }
          th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
        }
        @media screen {
          .print-section-title { display: none; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="mb-8 no-print">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <FileText size={22} className="text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laporan Operasional</h1>
              <p className="text-sm text-gray-500">Generate laporan berdasarkan rentang tanggal</p>
            </div>
          </div>
        </div>

        {/* ── Filter ───────────────────────────────────────────────── */}
        <div className="no-print bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BarChart2 size={16} />
              )}
              {loading ? "Memuat..." : "Generate Laporan"}
            </button>
            {report && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm ml-auto"
              >
                <Printer size={16} />
                Cetak
              </button>
            )}
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <div className="no-print flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-red-700">
            <AlertCircle size={18} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────── */}
        {loading && (
          <div className="no-print space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Report Output ─────────────────────────────────────────── */}
        {report && !loading && (
          <div id="report-printable" ref={reportRef}>
            {/* Print header */}
            <div className="hidden print:block mb-6 text-center border-b pb-4">
              <h1 className="text-xl font-bold">PT. Kusuma Samudera Berkah</h1>
              <h2 className="text-base font-semibold mt-1">Laporan Operasional</h2>
              <p className="text-sm text-gray-500">
                Periode: {formatDate(report.period_start)} s/d {formatDate(report.period_end)}
              </p>
            </div>

            {/* Period badge */}
            <div className="no-print mb-5 flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={15} />
              <span>
                Periode:{" "}
                <span className="font-semibold text-gray-800">
                  {formatDate(report.period_start)} — {formatDate(report.period_end)}
                </span>
              </span>
            </div>

            {/* ── Summary Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              <SummaryCard
                icon={Fuel}
                label="Pembelian BBM"
                value={formatRupiah(report.summary.total_fuel_expense)}
                sub={`${formatNum(report.summary.total_fuel_liters)} Liter`}
                color="text-amber-600"
                iconBg="bg-amber-50"
              />
              <SummaryCard
                icon={Clock}
                label="Jam Kerja Alat"
                value={`${formatNum(report.summary.total_work_hours)} jam`}
                sub={`${report.work_logs_by_equipment.length} alat aktif`}
                color="text-blue-600"
                iconBg="bg-blue-50"
              />
              <SummaryCard
                icon={Users}
                label="Estimasi Gaji"
                value={formatRupiah(report.summary.total_payroll_expense)}
                sub={`${report.summary.total_employees} karyawan · ${report.summary.total_present_days} hari hadir`}
                color="text-purple-600"
                iconBg="bg-purple-50"
              />
              <SummaryCard
                icon={ShoppingCart}
                label="Penjualan Material"
                value={formatRupiah(report.summary.total_material_sales)}
                sub={`${report.material_sales.length} transaksi`}
                color="text-emerald-600"
                iconBg="bg-emerald-50"
              />
              <SummaryCard
                icon={report.summary.net_balance >= 0 ? TrendingUp : TrendingDown}
                label="Selisih (Penjualan − Biaya)"
                value={formatRupiah(Math.abs(report.summary.net_balance))}
                sub={report.summary.net_balance >= 0 ? "Surplus" : "Defisit"}
                color={report.summary.net_balance >= 0 ? "text-emerald-600" : "text-red-500"}
                iconBg={report.summary.net_balance >= 0 ? "bg-emerald-50" : "bg-red-50"}
              />
            </div>

            {/* ── 1. Pembelian BBM ──────────────────────────────────── */}
            <Section title="1. Pembelian BBM (Approved)">
              {report.fuel_purchases.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-3">Tidak ada data pembelian BBM pada periode ini.</p>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr>
                      <Th>No</Th>
                      <Th>Tanggal</Th>
                      <Th>Jenis BBM</Th>
                      <Th right>Liter</Th>
                      <Th right>Harga/Liter</Th>
                      <Th right>Total</Th>
                      <Th>Catatan</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.fuel_purchases.map((fp, idx) => (
                      <tr key={fp.id} className="hover:bg-gray-50">
                        <Td muted>{idx + 1}</Td>
                        <Td>{formatDate(fp.tanggal)}</Td>
                        <Td bold>{fp.jenis_bbm}</Td>
                        <Td right>{fp.liter != null ? formatNum(fp.liter) : "-"}</Td>
                        <Td right>{formatRupiah(fp.harga_per_liter)}</Td>
                        <Td right bold>{fp.total_harga != null ? formatRupiah(fp.total_harga) : "-"}</Td>
                        <Td muted>{fp.catatan || "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <TotalRow
                      cols={7}
                      label={`Total (${formatNum(report.summary.total_fuel_liters)} Liter)`}
                      value={formatRupiah(report.summary.total_fuel_expense)}
                    />
                  </tfoot>
                </TableWrapper>
              )}
            </Section>

            {/* ── 2. BBM per Alat ──────────────────────────────────── */}
            <Section title="2. Penggunaan BBM per Alat">
              {report.fuel_by_equipment.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-3">Tidak ada data pengisian BBM pada periode ini.</p>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr>
                      <Th>No</Th>
                      <Th>Nama Alat</Th>
                      <Th>Tipe</Th>
                      <Th right>Total Liter</Th>
                      <Th right>Jml Pengisian</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.fuel_by_equipment.map((fb, idx) => (
                      <tr key={fb.equipment_id} className="hover:bg-gray-50">
                        <Td muted>{idx + 1}</Td>
                        <Td bold>{fb.equipment_name}</Td>
                        <Td>{fb.equipment_type}</Td>
                        <Td right bold>{formatNum(fb.total_liters)} L</Td>
                        <Td right>{fb.refuel_count}×</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <TotalRow
                      cols={5}
                      label="Total Liter"
                      value={`${formatNum(report.fuel_by_equipment.reduce((s, r) => s + r.total_liters, 0))} L`}
                    />
                  </tfoot>
                </TableWrapper>
              )}
            </Section>

            {/* ── 3. Jam Kerja Alat ────────────────────────────────── */}
            <Section title="3. Jam Kerja Alat">
              {report.work_logs_by_equipment.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-3">Tidak ada data jam kerja pada periode ini.</p>
              ) : (
                <>
                  {/* Ringkasan per alat */}
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ringkasan per Alat</p>
                  <TableWrapper>
                    <thead>
                      <tr>
                        <Th>No</Th>
                        <Th>Nama Alat</Th>
                        <Th>Tipe</Th>
                        <Th right>Total Jam</Th>
                        <Th right>Jml Log</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.work_logs_by_equipment.map((wb, idx) => (
                        <tr key={wb.equipment_id} className="hover:bg-gray-50">
                          <Td muted>{idx + 1}</Td>
                          <Td bold>{wb.equipment_name}</Td>
                          <Td>{wb.equipment_type}</Td>
                          <Td right bold>{formatNum(wb.total_hours)} jam</Td>
                          <Td right>{wb.log_count}×</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <TotalRow
                        cols={5}
                        label="Total Jam Kerja"
                        value={`${formatNum(report.summary.total_work_hours)} jam`}
                      />
                    </tfoot>
                  </TableWrapper>

                  {/* Detail harian */}
                  {report.work_logs_detail.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-5 mb-2">Detail Harian</p>
                      <TableWrapper>
                        <thead>
                          <tr>
                            <Th>No</Th>
                            <Th>Tanggal</Th>
                            <Th>Alat</Th>
                            <Th>Operator</Th>
                            <Th right>Jam</Th>
                            <Th>Deskripsi</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.work_logs_detail.map((wd, idx) => (
                            <tr key={wd.id} className="hover:bg-gray-50">
                              <Td muted>{idx + 1}</Td>
                              <Td>{formatDate(wd.work_date)}</Td>
                              <Td bold>{wd.equipment_name}</Td>
                              <Td>{wd.operator_name || "-"}</Td>
                              <Td right>{formatNum(wd.total_hours)} jam</Td>
                              <Td muted>{wd.work_description || "-"}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </TableWrapper>
                    </>
                  )}
                </>
              )}
            </Section>

            {/* ── 4. Estimasi Gaji Karyawan (berbasis Absensi) ─────── */}
            <Section title="4. Estimasi Gaji Karyawan (Berdasarkan Absensi)">
              {report.attendance_summary.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-3">Tidak ada data absensi pada periode ini.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 italic mb-3">
                    * Estimasi dihitung dari: Hari Hadir × Gaji Harian masing-masing karyawan
                  </p>
                  <TableWrapper>
                    <thead>
                      <tr>
                        <Th>No</Th>
                        <Th>Nama Karyawan</Th>
                        <Th>Jabatan</Th>
                        <Th right>Hadir</Th>
                        <Th right>Terlambat</Th>
                        <Th right>Tidak Hadir</Th>
                        <Th right>Total Jam</Th>
                        <Th right>Lembur</Th>
                        <Th right>Gaji Harian</Th>
                        <Th right>Est. Gaji</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.attendance_summary.map((att, idx) => (
                        <tr key={att.employee_id} className="hover:bg-gray-50">
                          <Td muted>{idx + 1}</Td>
                          <Td bold>{att.employee_name}</Td>
                          <Td muted>{att.position || "-"}</Td>
                          <Td right>
                            <span className="text-green-700 font-semibold">{att.present_days}h</span>
                          </Td>
                          <Td right>
                            <span className={att.late_days > 0 ? "text-amber-600" : "text-gray-400"}>
                              {att.late_days}h
                            </span>
                          </Td>
                          <Td right>
                            <span className={att.absent_days > 0 ? "text-red-500" : "text-gray-400"}>
                              {att.absent_days}h
                            </span>
                          </Td>
                          <Td right>{formatNum(att.total_work_hours)} jam</Td>
                          <Td right>
                            <span className={att.total_overtime_hours > 0 ? "text-purple-600 font-medium" : "text-gray-400"}>
                              {formatNum(att.total_overtime_hours)} jam
                            </span>
                          </Td>
                          <Td right>{formatRupiah(att.daily_salary)}</Td>
                          <Td right bold>{formatRupiah(att.estimated_salary)}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <TotalRow
                        cols={10}
                        label={`Total Estimasi (${report.attendance_summary.length} karyawan · ${report.summary.total_present_days} hari hadir)`}
                        value={formatRupiah(report.summary.total_payroll_expense)}
                      />
                    </tfoot>
                  </TableWrapper>
                </>
              )}
            </Section>

            {/* ── 5. Penjualan Material ─────────────────────────────── */}
            <Section title="5. Penjualan Material">
              {report.material_sales.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-3">Tidak ada data penjualan material pada periode ini.</p>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr>
                      <Th>No</Th>
                      <Th>Tanggal</Th>
                      <Th>Material</Th>
                      <Th>Pelanggan</Th>
                      <Th right>Qty</Th>
                      <Th>Satuan</Th>
                      <Th right>Harga/Unit</Th>
                      <Th right>Total</Th>
                      <Th>Bayar</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.material_sales.map((ms, idx) => (
                      <tr key={ms.id} className="hover:bg-gray-50">
                        <Td muted>{idx + 1}</Td>
                        <Td>{formatDate(ms.tanggal)}</Td>
                        <Td bold>{ms.material_type || ms.description}</Td>
                        <Td>{ms.customer_name || "-"}</Td>
                        <Td right>{ms.quantity != null ? formatNum(ms.quantity) : "-"}</Td>
                        <Td>{ms.unit || "-"}</Td>
                        <Td right>{ms.unit_price != null ? formatRupiah(ms.unit_price) : "-"}</Td>
                        <Td right bold>{formatRupiah(ms.amount)}</Td>
                        <Td muted>{ms.payment_method || "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <TotalRow
                      cols={9}
                      label={`Total (${report.material_sales.length} transaksi)`}
                      value={formatRupiah(report.summary.total_material_sales)}
                    />
                  </tfoot>
                </TableWrapper>
              )}
            </Section>

            {/* ── Net Balance Summary ───────────────────────────────── */}
            <div className="mt-6 bg-gray-50 rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">Ringkasan Keuangan</h3>
              <div className="space-y-2.5 max-w-sm ml-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Penjualan Material</span>
                  <span className="font-semibold text-emerald-700">{formatRupiah(report.summary.total_material_sales)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">  − Pembelian BBM</span>
                    <span className="font-semibold text-red-600">{formatRupiah(report.summary.total_fuel_expense)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">  − Gaji Karyawan</span>
                    <span className="font-semibold text-red-600">{formatRupiah(report.summary.total_payroll_expense)}</span>
                  </div>
                </div>
                <div className="border-t-2 border-gray-300 pt-3 flex justify-between">
                  <span className="font-bold text-gray-800">Selisih Bersih</span>
                  <span className={`font-bold text-lg ${report.summary.net_balance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatRupiah(report.summary.net_balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Print footer */}
            <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-400 text-center">
              Dicetak pada: {new Date().toLocaleString("id-ID")} · PT. Kusuma Samudera Berkah
            </div>
          </div>
        )}
      </div>
    </>
  );
}
