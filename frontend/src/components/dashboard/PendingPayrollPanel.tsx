import React from 'react';
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { formatIDR, formatDate } from "../../utils/formatters";

interface PendingPayrollPanelProps {
  isGM: boolean;
  payrollSummary: any;
  approvingId: number | null;
  setPayrollApproveModal: (state: any) => void;
}

const PendingPayrollPanel: React.FC<PendingPayrollPanelProps> = ({ isGM, payrollSummary: ps, approvingId, setPayrollApproveModal }) => {
  const navigate = useNavigate();

  if (!isGM) return null;

  return (
    <>
      {/* Pending approval quick-action list (GM only) */}
      {ps?.recent_pending?.length > 0 && (
        <div className="w-full rounded-2xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {ps.pending_count} Slip Gaji Menunggu Approval GM
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {ps.recent_pending.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {rec.employee_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(rec.period_start)} –{" "}
                    {formatDate(rec.period_end)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    {formatIDR(rec.net_salary)}
                  </span>
                  <button
                    onClick={() => setPayrollApproveModal({ isOpen: true, id: rec.id })}
                    disabled={approvingId === rec.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {approvingId === rec.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
          {ps.pending_count > 5 && (
            <div className="px-5 py-2 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => navigate("/payroll")}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + {ps.pending_count - 5} lainnya → Lihat semua di
                Payroll
              </button>
            </div>
          )}
        </div>
      )}

      {/* No pending – show success banner */}
      {ps?.pending_count === 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 w-full">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            Semua slip gaji sudah diapprove. Tidak ada yang menunggu.
          </p>
        </div>
      )}
    </>
  );
};

export default PendingPayrollPanel;
