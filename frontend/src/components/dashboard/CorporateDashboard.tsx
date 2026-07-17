import React from 'react';
import { DollarSign, Wallet, Receipt, AlertTriangle, FileText, Clock, CheckCircle, Zap, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';
import YesterdayReportPanel from './YesterdayReportPanel';
import SmartActionsPanel from './SmartActionsPanel';
import { formatIDR, formatDate } from '../../utils/formatters';

interface Props {
  role: string;
  isGM: boolean;
  financeSummary: any;
  payrollSummary: any;
  loadingYesterday: boolean;
  yesterdayReport: any;
  setFuelActionModal: any;
  setPayrollApproveModal: any;
  handleMarkPaid: any;
  approvePayrollPending: boolean;
  payrollApproveModalId: number | null;
}

const CorporateDashboard: React.FC<Props> = ({
  role, isGM, financeSummary, payrollSummary, loadingYesterday, yesterdayReport,
  setFuelActionModal, setPayrollApproveModal, handleMarkPaid, approvePayrollPending, payrollApproveModalId
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
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
              icon={AlertTriangle}
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

      {(role === 'finance' || isGM || role === 'admin') && payrollSummary && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0D9488]" />
              Payroll Overview
            </h2>
          </div>

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

      <SmartActionsPanel
        isGM={isGM}
        role={role}
        payrollSummary={payrollSummary}
        financeSummary={financeSummary}
        approvingId={approvePayrollPending ? payrollApproveModalId : null}
        setPayrollApproveModal={setPayrollApproveModal}
        handleMarkPaid={handleMarkPaid}
      />
    </div>
  );
};

export default CorporateDashboard;
