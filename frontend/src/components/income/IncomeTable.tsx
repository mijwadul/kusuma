import React from "react";
import { IncomeRecord } from "../../hooks/useMaterialSales";

interface IncomeTableProps {
  activeTab: string;
  records: IncomeRecord[];
  onSelectRecord: (record: IncomeRecord) => void;
  formatIDR: (v?: number | string | null) => string;
  formatDate: (d?: string | null) => string;
}

export const IncomeTable: React.FC<IncomeTableProps> = ({
  activeTab,
  records,
  onSelectRecord,
  formatIDR,
  formatDate,
}) => {
  const paymentBadge = (method?: string) => (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        method === "transfer" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {method === "transfer" ? "Transfer" : "Cash"}
    </span>
  );

  const typeBadge = (type?: string) => (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        type === "project_payment" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {type === "project_payment" ? "Proyek" : "Material"}
    </span>
  );

  const termBadge = (term?: string) => (
    <span className="inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold capitalize">
      {term?.replace(/_/g, " ") ?? "-"}
    </span>
  );

  return (
    <div className="overflow-x-auto">
      {activeTab === "all" && (
        <table className="min-w-full text-sm divide-y divide-gray-100">
          <thead className="bg-gray-50 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipe</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Deskripsi</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Metode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                onClick={() => onSelectRecord(r)}
              >
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.income_date)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{typeBadge(r.income_type)}</td>
                <td className="px-4 py-3 text-gray-700 max-w-xs truncate whitespace-nowrap">{r.description || "-"}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums whitespace-nowrap">
                  {formatIDR(r.amount)}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">{paymentBadge(r.payment_method)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === "project_payment" && (
        <table className="min-w-full text-sm divide-y divide-gray-100">
          <thead className="bg-gray-50 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyek</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Termin</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Metode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                onClick={() => onSelectRecord(r)}
              >
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.income_date)}</td>
                <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{r.description ?? "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{termBadge((r as any).payment_term)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums whitespace-nowrap">
                  {formatIDR(r.amount)}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">{paymentBadge(r.payment_method)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === "material_sale" && (
        <table className="min-w-full text-sm divide-y divide-gray-100">
          <thead className="bg-gray-50 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Material</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                onClick={() => onSelectRecord(r)}
              >
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.income_date)}</td>
                <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{r.customer_name ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.material_type ?? "-"}</td>
                <td className="px-4 py-3 text-right text-gray-600 tabular-nums whitespace-nowrap">
                  {r.quantity} {r.unit}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums whitespace-nowrap">
                  {formatIDR(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default IncomeTable;
