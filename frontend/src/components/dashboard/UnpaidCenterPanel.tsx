import React from 'react';
import { AlertTriangle } from "lucide-react";
import { formatIDR, formatDate } from "../../utils/formatters";

interface UnpaidCenterPanelProps {
  role: string;
  isGM: boolean;
  financeSummary: any;
  handleMarkPaid: (type: string, id: number) => void;
}

const UnpaidCenterPanel: React.FC<UnpaidCenterPanelProps> = ({ role, isGM, financeSummary, handleMarkPaid }) => {
  if (!(role === 'finance' || isGM) || !financeSummary) return null;

  return (
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
            <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_invoices?.length || 0}</span>
          </h3>
          <div className="space-y-2">
            {!financeSummary.unpaid_invoices?.length ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_invoices.map(inv => (
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
            <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_payroll?.length || 0}</span>
          </h3>
          <div className="space-y-2">
            {!financeSummary.unpaid_payroll?.length ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_payroll.map(p => (
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
            <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_fuel?.length || 0}</span>
          </h3>
          <div className="space-y-2">
            {!financeSummary.unpaid_fuel?.length ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_fuel.map(f => (
              <div key={f.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                <div>
                  <p className="text-xs font-bold text-slate-700">Solar {f.liters} L</p>
                  <p className="text-[10px] font-medium text-amber-600 mt-0.5">BBM dari: {f.vendor_name || 'Tidak diketahui'}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(f.date)}</p>
                  <p className="text-xs font-semibold text-red-600 mt-0.5">{formatIDR(f.amount)}</p>
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
            <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{financeSummary.unpaid_expenses?.length || 0}</span>
          </h3>
          <div className="space-y-2">
            {!financeSummary.unpaid_expenses?.length ? <p className="text-xs text-slate-400">Tidak ada data.</p> : financeSummary.unpaid_expenses.map(e => (
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
  );
};

export default UnpaidCenterPanel;
