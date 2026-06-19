import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownIcon, ArrowUpIcon, Download, RefreshCcw, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

import CustomSelect from '../components/CustomSelect';
import { useProjectsList } from '../hooks/useProjects';
import { useCashFlowReport } from '../hooks/useReports';
import { toLocalDateInput } from '../utils/formatters';

const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  });

const toLocalDate = (d?: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const todayISO = () => toLocalDateInput(new Date());

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(
    toLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [endDate, setEndDate] = useState(todayISO());
  const [selectedProject, setSelectedProject] = useState('all');

  const { data: projects = [] } = useProjectsList();

  const queryParams: any = { start_date: startDate, end_date: endDate };
  if (selectedProject !== 'all') {
    queryParams.project_id = selectedProject;
  }

  const { data: report, isLoading, refetch, isFetching } = useCashFlowReport(queryParams, {
    enabled: !!startDate && !!endDate,
  });

  const exportToExcel = () => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    // Incomes
    const incomeData = report.incomes.map((item) => ({
      Tanggal: item.date,
      Tipe: item.source_type,
      Deskripsi: item.description,
      Project: item.project_name || 'General',
      Nominal: item.amount,
    }));
    const wsIncome = XLSX.utils.json_to_sheet(incomeData);
    XLSX.utils.book_append_sheet(wb, wsIncome, 'Pemasukan');

    // Expenses
    const expenseData = report.expenses.map((item) => ({
      Tanggal: item.date,
      Tipe: item.expense_type,
      Deskripsi: item.description,
      Project: item.project_name || 'General',
      Nominal: item.amount,
    }));
    const wsExpense = XLSX.utils.json_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, wsExpense, 'Pengeluaran');

    // Summary
    const summaryData = [
      { Item: 'Total Pemasukan', Nilai: report.total_income },
      { Item: 'Total Pengeluaran', Nilai: report.total_expense },
      { Item: 'Net Balance', Nilai: report.net_balance },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    XLSX.writeFile(wb, `CashFlow_${startDate}_to_${endDate}.xlsx`);
  };

  const handleRefresh = () => {
    if (!startDate || !endDate) {
      toast.error('Pilih tanggal awal dan akhir');
      return;
    }
    refetch();
  };

  const loading = isLoading || isFetching;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Cash Flow</h2>
          <p className="text-gray-500 mt-1 text-sm">Laporan Arus Kas (Pemasukan & Pengeluaran Lunas)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToExcel}
            disabled={!report || loading}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Filter Kategori</label>
            <CustomSelect
              value={selectedProject}
              onChange={(val) => setSelectedProject(val as string)}
              options={[
                { value: "all", label: "🌐 Semua (General + Project)" },
                { value: "general", label: "🏢 General (Tanpa Project)" },
                ...(projects.length > 0 ? [{ value: "divider", label: "─── Per Project ───", disabled: true }] : []),
                ...projects.map((p: any) => ({
                  value: String(p.id),
                  label: `📁 ${p.name}`
                }))
              ]}
            />
          </div>
        </div>
      </div>

      {loading && !report ? (
        <div className="text-center py-10">
          <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Memuat data cash flow...</p>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between border-t-4 border-emerald-500">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">Total Pemasukan</span>
                <div className="bg-emerald-100 p-1.5 rounded-full">
                  <ArrowUpIcon className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatIDR(report.total_income)}</div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between border-t-4 border-rose-500">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">Total Pengeluaran</span>
                <div className="bg-rose-100 p-1.5 rounded-full">
                  <ArrowDownIcon className="h-4 w-4 text-rose-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatIDR(report.total_expense)}</div>
            </div>

            <div
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between border-t-4 ${
                report.net_balance >= 0 ? 'border-blue-500' : 'border-orange-500'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">Net Balance</span>
                <div className={`p-1.5 rounded-full ${report.net_balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                  <CheckCircle className={`h-4 w-4 ${report.net_balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
              </div>
              <div className={`text-2xl font-bold ${report.net_balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatIDR(report.net_balance)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INCOMES TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <ArrowUpIcon className="h-5 w-5 text-emerald-500" />
                <h3 className="font-semibold text-gray-800">Rincian Pemasukan</h3>
              </div>
              <div className="overflow-y-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">Tipe</th>
                      <th className="px-4 py-3 text-left">Deskripsi</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.incomes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          Tidak ada data pemasukan
                        </td>
                      </tr>
                    ) : (
                      report.incomes.map((item: any) => (
                        <tr key={item.id || item.description} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">{toLocalDate(item.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-700">{item.source_type}</div>
                            {item.project_name && (
                              <div className="text-xs mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full inline-block">
                                {item.project_name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={item.description}>
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatIDR(item.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EXPENSES TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <ArrowDownIcon className="h-5 w-5 text-rose-500" />
                <h3 className="font-semibold text-gray-800">Rincian Pengeluaran</h3>
              </div>
              <div className="overflow-y-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">Tipe</th>
                      <th className="px-4 py-3 text-left">Deskripsi</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.expenses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          Tidak ada data pengeluaran
                        </td>
                      </tr>
                    ) : (
                      report.expenses.map((item: any) => (
                        <tr key={item.id || item.description} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">{toLocalDate(item.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-700">{item.expense_type}</div>
                            {item.project_name && (
                              <div className="text-xs mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full inline-block">
                                {item.project_name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={item.description}>
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-rose-600">{formatIDR(item.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
