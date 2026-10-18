import React from "react";
import { Pencil, Trash2, Receipt, FileText } from "lucide-react";
import { Invoice } from "../../hooks/useInvoices";
import CustomSelect from "../CustomSelect";

interface InvoiceTableProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onDeleteInvoice: (id: number) => void;
  onGenerateKuitansi?: (invoice: Invoice) => void;
  formatIDR: (v?: number | string | null) => string;
  formatDate: (d?: string | null) => string;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  onSelectInvoice,
  onUpdateStatus,
  onDeleteInvoice,
  onGenerateKuitansi,
  formatIDR,
  formatDate,
}) => {
  const statusBadge = (status?: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      unpaid: { bg: "bg-amber-100", text: "text-amber-800", label: "Unpaid" },
      paid: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Paid" },
      cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled" },
    };
    const s = map[status || "unpaid"] || map.unpaid;
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-gray-100">
        <thead className="bg-gray-50 whitespace-nowrap">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Tanggal Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              No. Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Customer
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Tagihan
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ubah Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Aksi & Dokumen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="hover:bg-slate-50/80 transition-colors cursor-pointer"
              onClick={(e) => {
                if (
                  (e.target as HTMLElement).tagName !== "SELECT" &&
                  !(e.target as HTMLElement).closest("button")
                ) {
                  onSelectInvoice(inv);
                }
              }}
            >
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {inv.invoice_date ? formatDate(inv.invoice_date) : "-"}
              </td>
              <td className="px-4 py-3 text-gray-800 font-semibold whitespace-nowrap flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                {inv.invoice_number}
              </td>
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                {inv.customer_name}
              </td>
              <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                {formatIDR(inv.final_amount ?? inv.total_amount)}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                {statusBadge(inv.status)}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <CustomSelect
                  value={inv.status}
                  onChange={(val) => onUpdateStatus(inv.id, val as string)}
                  options={[
                    { value: "unpaid", label: "Unpaid" },
                    { value: "paid", label: "Paid" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap flex items-center justify-center gap-1">
                {onGenerateKuitansi && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateKuitansi(inv);
                    }}
                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium border border-emerald-200"
                    title="Cetak Kuitansi Resmi"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Kuitansi</span>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectInvoice(inv);
                  }}
                  className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Lihat / Edit Invoice"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteInvoice(inv.id);
                  }}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus Invoice"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InvoiceTable;
