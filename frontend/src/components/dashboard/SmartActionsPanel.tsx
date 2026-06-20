import { Sparkles } from 'lucide-react';
import PendingPayrollPanel from "./PendingPayrollPanel";
import UnpaidCenterPanel from "./UnpaidCenterPanel";

interface SmartActionsPanelProps {
  isGM: boolean;
  role: string;
  payrollSummary: any;
  financeSummary: any;
  approvingId: number | null;
  setPayrollApproveModal: any;
  handleMarkPaid: any;
}

export default function SmartActionsPanel({
  isGM,
  role,
  payrollSummary,
  financeSummary,
  approvingId,
  setPayrollApproveModal,
  handleMarkPaid
}: SmartActionsPanelProps) {
  
  const hasPendingPayroll = payrollSummary?.pending_count > 0;
  const hasPendingFinance = financeSummary?.pending_fuel_purchases > 0 || 
                            financeSummary?.pending_expenses > 0 || 
                            financeSummary?.unpaid_bills_count > 0 || 
                            financeSummary?.unpaid_invoices_count > 0;

  if (!hasPendingPayroll && !hasPendingFinance) return null;

  return (
    <div className="relative rounded-3xl bg-slate-900 border border-indigo-500/30 overflow-hidden shadow-[0_0_40px_-10px_rgba(99,102,241,0.2)]">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-blue-500/10 pointer-events-none"></div>
      
      {/* Animated glowing border effect */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-20 blur-sm animate-[shimmer_3s_infinite]"></div>
      
      <div className="relative p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Rekomendasi Cerdas (AI-Generated)
            </h2>
            <p className="text-sm text-indigo-200/70 mt-0.5">Tindakan prioritas yang membutuhkan perhatian Anda</p>
          </div>
        </div>

        <div className="space-y-6">
          {hasPendingPayroll && (
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
              <PendingPayrollPanel
                isGM={isGM}
                payrollSummary={payrollSummary}
                approvingId={approvingId}
                setPayrollApproveModal={setPayrollApproveModal}
              />
            </div>
          )}

          {hasPendingFinance && (
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 relative">
               <UnpaidCenterPanel
                 role={role}
                 isGM={isGM}
                 financeSummary={financeSummary}
                 handleMarkPaid={handleMarkPaid}
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
