import React from "react";
import { DollarSign, FolderOpen, ShoppingCart, TrendingUp } from "lucide-react";

interface SummaryCardProps {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4 transition-all hover:shadow-md">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
      <p className="text-base sm:text-lg md:text-xl font-bold text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

interface IncomeSummaryCardsProps {
  summary: {
    total: number;
    project: number;
    material: number;
    count: number;
  };
  formatIDR: (v?: number | string | null) => string;
}

export const IncomeSummaryCards: React.FC<IncomeSummaryCardsProps> = ({ summary, formatIDR }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        icon={DollarSign}
        label="Total Periode Ini"
        value={formatIDR(summary.total)}
        color="bg-emerald-500"
      />
      <SummaryCard
        icon={FolderOpen}
        label="Dari Proyek"
        value={formatIDR(summary.project)}
        color="bg-blue-500"
      />
      <SummaryCard
        icon={ShoppingCart}
        label="Penjualan Material"
        value={formatIDR(summary.material)}
        color="bg-amber-500"
      />
      <SummaryCard
        icon={TrendingUp}
        label="Jumlah Transaksi"
        value={summary.count}
        color="bg-purple-500"
      />
    </div>
  );
};

export default IncomeSummaryCards;
