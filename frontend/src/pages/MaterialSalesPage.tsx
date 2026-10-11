import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  X,
  Loader2,
  Settings,
  Truck,
  FileText,
  Download,
  Scale,
  Package,
} from "lucide-react";
import { generatePremiumPDF } from "../utils/pdfGenerator";
import { useCurrentUser } from "../hooks/useAuth";
import {
  useIncomeRecords,
  useMaterialPrices,
  useDeleteIncomeRecord,
  useDeleteMaterialPrice,
  IncomeRecord,
  MaterialPrice,
} from "../hooks/useMaterialSales";
import { useCustomersList, useProjectsList } from "../hooks/useProjects";
import { toLocalDateInput } from "../utils/formatters";

import MaterialBadge from "../components/material_sales/MaterialBadge";
import SaleFormModal from "../components/material_sales/SaleFormModal";
import PriceFormModal from "../components/material_sales/PriceFormModal";
import SaleDetailModal from "../components/material_sales/SaleDetailModal";
import PriceDetailModal from "../components/material_sales/PriceDetailModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

const formatDate = (d?: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const todayStr = () => toLocalDateInput(new Date());

const inputCls =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

// ── PDF Export Modal ──────────────────────────────────────────────────────────
const DownloadPdfModal = ({
  sales,
  onClose,
}: {
  sales: IncomeRecord[];
  onClose: () => void;
}) => {
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());

  const handleDownload = async () => {
    const filtered = sales.filter((s) => {
      if (!s.income_date) return false;
      const d = s.income_date.split("T")[0];
      return d >= startDate && d <= endDate;
    });

    if (filtered.length === 0) {
      toast.error("Tidak ada data penjualan pada periode ini");
      return;
    }

    const tableHead = [
      ["No.", "Tanggal", "Nopol", "Supir", "Jenis Kendaraan", "Material", "Volume"],
    ];
    const tableBody = filtered.map((s, index) => [
      index + 1,
      formatDate(s.income_date),
      s.license_plate || "-",
      s.driver_name || "-",
      s.vehicle_type || "-",
      s.material_type || "-",
      `${s.quantity} ${s.unit}`,
    ]);

    // Ringkasan Material & Kendaraan
    const summary: Record<string, Record<string, number>> = {};
    filtered.forEach((s) => {
      const mat = s.material_type || "Unknown";
      const veh = s.vehicle_type || "Unknown";
      const qty = Number(s.quantity) || 1;

      if (!summary[mat]) summary[mat] = {};
      summary[mat][veh] = (summary[mat][veh] || 0) + qty;
    });

    const summaryItems: string[] = [];
    Object.entries(summary).forEach(([mat, vehs]) => {
      summaryItems.push(`- ${mat}:`);
      Object.entries(vehs).forEach(([veh, total]) => {
        summaryItems.push(`  • ${veh}: ${total.toLocaleString("id-ID")} ritase/kubikasi`);
      });
    });

    try {
      await generatePremiumPDF({
        title: "Laporan Penjualan Material",
        dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
        filename: `Laporan_Material_${startDate}_${endDate}.pdf`,
        tableHead,
        tableBody,
        summaryItems,
      });
      toast.success("PDF berhasil didownload");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Gagal mendownload PDF");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Download Report PDF</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Download size={16} /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function MaterialSalesPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "prices">("sales");
  const { data: currentUser } = useCurrentUser();

  const { data: sales = [], isLoading: loadingSales } = useIncomeRecords(
    { income_type: "material_sale" },
    { enabled: activeTab === "sales" }
  );
  const { data: prices = [], isLoading: loadingPrices } = useMaterialPrices(undefined, {
    enabled: activeTab === "prices",
  });

  const { data: customers = [] } = useCustomersList();
  const { data: projects = [] } = useProjectsList();

  const deleteIncomeMutation = useDeleteIncomeRecord();
  const deletePriceMutation = useDeleteMaterialPrice();

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [editDataSale, setEditDataSale] = useState<IncomeRecord | null>(null);
  const [editDataPrice, setEditDataPrice] = useState<MaterialPrice | null>(null);
  const [viewSale, setViewSale] = useState<IncomeRecord | null>(null);
  const [viewPrice, setViewPrice] = useState<MaterialPrice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const isGM =
    currentUser?.is_admin ||
    currentUser?.is_superuser ||
    ["gm", "admin", "manager"].includes(currentUser?.role || "");
  const isLoading = activeTab === "sales" ? loadingSales : loadingPrices;

  const handleDelete = async () => {
    try {
      if (activeTab === "sales") {
        await deleteIncomeMutation.mutateAsync(confirmDelete.id);
      } else {
        await deletePriceMutation.mutateAsync(confirmDelete.id);
      }
      toast.success("Berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Penjualan Material</h1>
          <p className="text-sm text-gray-500 mt-1">Catat transaksi material &amp; kelola harga</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isGM && (
            <button
              onClick={() => setActiveTab((t) => (t === "sales" ? "prices" : "sales"))}
              className={`flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                activeTab === "prices"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Settings size={16} /> Atur Harga (GM)
            </button>
          )}
          {activeTab === "sales" && (
            <>
              <button
                onClick={() => setShowPdfModal(true)}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <FileText size={16} /> Download PDF
              </button>
              <button
                onClick={() => {
                  setEditDataSale(null);
                  setShowSaleModal(true);
                }}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <Plus size={16} /> Catat Penjualan
              </button>
            </>
          )}
          {activeTab === "prices" && (
            <button
              onClick={() => {
                setEditDataPrice(null);
                setShowPriceModal(true);
              }}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} /> Tambah Harga
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : activeTab === "sales" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Material</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Volume</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total (Rp)</th>
                  <th className="px-4 py-3 text-center w-8 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setViewSale(s)}
                    className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.income_date)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.customer_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Truck size={12} /> {s.license_plate || "-"}
                      </div>
                      <div className="mt-0.5 text-gray-400">
                        {s.vehicle_type || "-"} • {s.driver_name || "Tanpa Supir"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <MaterialBadge type={s.material_type} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {s.quantity} {s.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {formatIDR(s.amount)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-gray-300 text-xs">›</span>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      Belum ada catatan penjualan material.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Material</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Kendaraan</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Tipe Harga</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Satuan</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Harga</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center w-8 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prices.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setViewPrice(p)}
                    className="hover:bg-indigo-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <MaterialBadge type={p.material_type} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {p.vehicle_type ? (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                          {p.vehicle_type}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Semua</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded">
                        Harga Default
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.unit === "m3"
                            ? "bg-blue-50 text-blue-700"
                            : p.unit === "ton"
                            ? "bg-orange-50 text-orange-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {p.unit === "m3" ? (
                          <>
                            <Package size={14} /> Kubikasi (m³)
                          </>
                        ) : p.unit === "ton" ? (
                          <>
                            <Scale size={14} /> Tonase (ton)
                          </>
                        ) : (
                          <>
                            <Truck size={14} /> Ritase
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                      {formatIDR(p.price_per_unit)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {p.is_active ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-gray-300 text-xs">›</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSaleModal && (
        <SaleFormModal
          editData={editDataSale}
          onClose={() => setShowSaleModal(false)}
          customers={customers}
          projects={projects}
        />
      )}
      {showPriceModal && (
        <PriceFormModal
          editData={editDataPrice}
          onClose={() => setShowPriceModal(false)}
        />
      )}
      {showPdfModal && (
        <DownloadPdfModal sales={sales} onClose={() => setShowPdfModal(false)} />
      )}

      {/* Price Detail Modal */}
      {viewPrice && !showPriceModal && (
        <PriceDetailModal
          price={viewPrice}
          isGM={isGM}
          onClose={() => setViewPrice(null)}
          onEdit={() => {
            setEditDataPrice(viewPrice);
            setViewPrice(null);
            setShowPriceModal(true);
          }}
          onDelete={() => {
            setConfirmDelete(viewPrice);
            setViewPrice(null);
          }}
        />
      )}

      {/* Sale Detail Modal */}
      {viewSale && !showSaleModal && (
        <SaleDetailModal
          sale={viewSale}
          isGM={isGM}
          currentUser={currentUser}
          onClose={() => setViewSale(null)}
          onEdit={() => {
            setEditDataSale(viewSale);
            setViewSale(null);
            setShowSaleModal(true);
          }}
          onDelete={() => {
            setConfirmDelete(viewSale);
            setViewSale(null);
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <Trash2 size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Hapus Data?</h3>
            <p className="text-sm text-gray-500 mb-6">Data yang dihapus tidak dapat dikembalikan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 border rounded-xl text-sm font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                {(deleteIncomeMutation.isPending || deletePriceMutation.isPending) && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
