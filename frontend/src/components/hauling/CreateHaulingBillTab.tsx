import React from 'react';
import {
  Calendar,
  Truck,
  Building2,
  Filter,
  ChevronDown,
  ChevronRight,
  Loader2,
  Download,
  Save,
} from 'lucide-react';
import CustomSelect from '../CustomSelect';
import MultiSelect from '../MultiSelect';

interface CreateHaulingBillTabProps {
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (val: string) => void;
  selectedNopols: string[];
  setSelectedNopols: (val: string[]) => void;
  onlyUnbilled: boolean;
  setOnlyUnbilled: (val: boolean) => void;
  billNumber: string;
  setBillNumber: (val: string) => void;
  billNotes: string;
  setBillNotes: (val: string) => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
  uniqueProjects: any[];
  truckOptions: any[];
  billingData: any;
  loadingBilling: boolean;
  expandedDates: Record<string, boolean>;
  toggleDateExpand: (date: string) => void;
  setExpandedDates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isGeneratingPDF: boolean;
  isSaving: boolean;
  onDraftPDF: () => Promise<void>;
  onSaveAndExport: () => Promise<void>;
  onClose: () => void;
}

const formatIDR = (v: any) =>
  Number(v ?? 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  });

const formatDate = (d: any) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function CreateHaulingBillTab({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedProjectId,
  setSelectedProjectId,
  selectedNopols,
  setSelectedNopols,
  onlyUnbilled,
  setOnlyUnbilled,
  billNumber,
  setBillNumber,
  billNotes,
  setBillNotes,
  showFilters,
  setShowFilters,
  uniqueProjects,
  truckOptions,
  billingData,
  loadingBilling,
  expandedDates,
  toggleDateExpand,
  setExpandedDates,
  isGeneratingPDF,
  isSaving,
  onDraftPDF,
  onSaveAndExport,
  onClose,
}: CreateHaulingBillTabProps) {
  const unitLabel = billingData?.measurement_type === 'kubikasi' ? 'm³' : 'ton';

  return (
    <>
      {/* Scrollable Container covering Filters and Content */}
      <div className="overflow-y-auto flex-1 divide-y divide-slate-200/80">
        {/* Filter Controls Bar */}
        <div className="p-3.5 sm:p-5 bg-slate-50 space-y-3">
          {/* Mobile Filter Toggle Header */}
          <div className="flex items-center justify-between sm:hidden pb-0.5">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100/70 hover:bg-blue-200/70 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Filter size={13} />
              {showFilters ? 'Sembunyikan Filter' : 'Buka Pengaturan Filter'}
              {showFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {billingData && (
              <span className="text-[11px] text-gray-500 font-medium">
                {billingData.total_ritase} Rit • {formatIDR(billingData.total_net)}
              </span>
            )}
          </div>

          <div className={`space-y-3 ${showFilters ? 'block' : 'hidden sm:block'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-blue-500" /> Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-blue-500" /> Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Truck size={13} className="text-blue-500" /> No. Polisi Truk
                  </span>
                  {selectedNopols.length > 0 && (
                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded">
                      {selectedNopols.length} dipilih
                    </span>
                  )}
                </label>
                <MultiSelect
                  values={selectedNopols}
                  onChange={setSelectedNopols}
                  options={truckOptions}
                  placeholder="-- Semua Truk / Nopol --"
                  searchPlaceholder="Cari nopol truk..."
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Building2 size={13} className="text-blue-500" /> Filter Proyek
                </label>
                <CustomSelect
                  value={selectedProjectId}
                  onChange={(val) => setSelectedProjectId(val as string)}
                  options={[
                    { value: '', label: '-- Semua Proyek --' },
                    ...uniqueProjects.map((p) => ({
                      value: String(p.id),
                      label: p.name,
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Status Filter Toggle & Notes */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-slate-200/60">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyUnbilled}
                  onChange={(e) => setOnlyUnbilled(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-medium text-gray-700">
                  Hanya tampilkan Surat Jalan yang <strong>Belum Ditagih</strong>
                </span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="No. Laporan (Opsional, cth: TAG/2026/09/001)"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Catatan laporan..."
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content Preview & Data Section */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          {loadingBilling ? (
            <div className="py-16 text-center text-gray-400">
              <Loader2 size={28} className="animate-spin mx-auto mb-2.5 text-blue-500" />
              Menghitung rincian tagihan hauling...
            </div>
          ) : !billingData || billingData.rows.length === 0 ? (
            <div className="py-16 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              <Truck size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-600 text-sm">Tidak ada data surat jalan</p>
              <p className="text-xs text-gray-400 mt-1">
                Sesuaikan rentang tanggal atau nonaktifkan filter 'Belum Ditagih' di atas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                    Total Ritase
                  </span>
                  <span className="text-lg sm:text-2xl font-black text-blue-900 mt-0.5 block">
                    {billingData.total_ritase}{' '}
                    <span className="text-xs font-semibold text-blue-600">Rit</span>
                  </span>
                </div>
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                    Volume / Netto
                  </span>
                  <span className="text-lg sm:text-2xl font-black text-indigo-900 mt-0.5 block">
                    {billingData.total_measurement}{' '}
                    <span className="text-xs font-semibold text-indigo-600">{unitLabel}</span>
                  </span>
                </div>
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                    Potongan Material
                  </span>
                  <span className="text-lg sm:text-2xl font-black text-amber-900 mt-0.5 block">
                    {formatIDR(billingData.total_material_deduction)}
                  </span>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 sm:p-3.5 col-span-2 lg:col-span-1">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                    Total Net Tagihan
                  </span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-700 mt-0.5 block">
                    {formatIDR(billingData.total_net)}
                  </span>
                </div>
              </div>

              {/* Rekapitulasi Per Tanggal Accordion */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-100/90 px-3.5 sm:px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-700">
                    Rincian Harian ({billingData.grouped_dates.length} Tanggal Operasional)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allExp = billingData.grouped_dates.reduce(
                          (acc: any, g: any) => ({ ...acc, [g.date]: true }),
                          {}
                        );
                        setExpandedDates(allExp);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Buka Semua
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setExpandedDates({})}
                      className="text-[11px] text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Tutup Semua
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {billingData.grouped_dates.map((g: any) => {
                    const isExpanded = expandedDates[g.date] !== false;
                    return (
                      <div key={g.date} className="bg-white">
                        <div
                          onClick={() => toggleDateExpand(g.date)}
                          className="px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-50 cursor-pointer flex flex-wrap items-center justify-between gap-2 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <ChevronDown size={16} className="text-gray-500 shrink-0" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-500 shrink-0" />
                            )}
                            <span className="font-bold text-xs sm:text-sm text-gray-900">
                              {formatDate(g.date)}
                            </span>
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                              {g.ritase} Rit
                            </span>
                            <span className="text-[11px] text-gray-500 hidden sm:inline">
                              Tarif: {g.rates.map((r: number) => formatIDR(r)).join(', ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 ml-auto text-xs">
                            <span className="text-gray-600 hidden md:inline">
                              Total: <strong>{g.measurement}</strong> {unitLabel}
                            </span>
                            {g.material_deduction > 0 && (
                              <span className="text-amber-700 font-medium hidden sm:inline">
                                Pot: -{formatIDR(g.material_deduction)}
                              </span>
                            )}
                            <span className="font-bold text-emerald-700 text-xs sm:text-sm">
                              {formatIDR(g.net_cost)}
                            </span>
                          </div>
                        </div>

                        {/* Date Table of Trips */}
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-gray-100">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-600 font-semibold border-b whitespace-nowrap">
                                <tr>
                                  <th className="px-3 py-2 text-left">No</th>
                                  <th className="px-3 py-2 text-left">No. Polisi</th>
                                  <th className="px-3 py-2 text-left">Supir</th>
                                  <th className="px-3 py-2 text-right">Vol / Netto ({unitLabel})</th>
                                  <th className="px-3 py-2 text-right">Tarif</th>
                                  <th className="px-3 py-2 text-right">Biaya Kotor</th>
                                  <th className="px-3 py-2 text-right">Pot. Material</th>
                                  <th className="px-3 py-2 text-right">Net Tagihan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {g.rows.map((r: any, idx: number) => (
                                  <tr key={r.sj_id} className="hover:bg-blue-50/40 transition-colors">
                                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                                      <div>{r.nopol}</div>
                                      {r.project_name && (
                                        <div className="text-[10px] text-gray-500 font-normal truncate max-w-[160px]" title={r.project_name}>
                                          {r.project_name}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.supir || '-'}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                      {r.measurement}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-600">{formatIDR(r.hauling_price)}</td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                                      {formatIDR(r.hauling_cost)}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                      {r.material_deduction > 0 ? (
                                        <span className="text-amber-700 font-medium">
                                          ({formatIDR(r.material_deduction)})
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">
                                      {formatIDR(r.net_cost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-slate-100 font-bold text-gray-800 border-t">
                                <tr>
                                  <td colSpan={3} className="px-3 py-2 text-right">
                                    Subtotal {formatDate(g.date)}:
                                  </td>
                                  <td className="px-3 py-2 text-right text-blue-900">
                                    {g.measurement} {unitLabel}
                                  </td>
                                  <td className="px-3 py-2"></td>
                                  <td className="px-3 py-2 text-right text-gray-900">
                                    {formatIDR(g.hauling_cost)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-amber-700">
                                    {g.material_deduction > 0 ? `(${formatIDR(g.material_deduction)})` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-emerald-800">
                                    {formatIDR(g.net_cost)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
        <div className="text-xs text-gray-600">
          {billingData ? (
            <span>
              Total: <strong>{billingData.total_ritase}</strong> rit • Net:{' '}
              <strong className="text-emerald-700">{formatIDR(billingData.total_net)}</strong>
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-xs transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={onDraftPDF}
            disabled={isGeneratingPDF || !billingData || billingData.rows.length === 0}
            className="px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            title="Cetak preview tanpa menyimpan ke database"
          >
            <Download size={14} /> Draft PDF
          </button>
          <button
            onClick={onSaveAndExport}
            disabled={
              isGeneratingPDF ||
              isSaving ||
              !billingData ||
              billingData.rows.length === 0
            }
            className="col-span-2 sm:col-span-1 px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isGeneratingPDF || isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save size={14} /> Simpan &amp; Cetak
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
