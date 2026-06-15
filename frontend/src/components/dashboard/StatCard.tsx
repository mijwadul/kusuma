import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  onClick?: () => void;
  badge?: string | number;
  loading?: boolean;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sub, color, onClick, badge, loading, trend }) => (
  <div
    onClick={onClick}
    className={`glass-panel card-3d rounded-3xl p-6 flex items-start gap-4 fluid-metric-container
      ${onClick ? "cursor-pointer" : ""}`}
  >
    <div className={`p-3.5 rounded-2xl shadow-xs text-white bg-gradient-to-tr ${
      color.includes("bg-red-") ? "from-red-500 to-rose-600 shadow-red-200/50" :
      color.includes("bg-green-") ? "from-green-500 to-emerald-600 shadow-emerald-200/50" :
      color.includes("bg-emerald-") ? "from-emerald-500 to-teal-600 shadow-teal-200/50" :
      color.includes("bg-blue-") ? "from-blue-500 to-indigo-600 shadow-blue-200/50" :
      color.includes("bg-amber-") ? "from-amber-500 to-yellow-600 shadow-amber-200/50" :
      color.includes("bg-orange-") ? "from-orange-500 to-red-600 shadow-orange-200/50" :
      color.includes("bg-purple-") ? "from-purple-500 to-violet-600 shadow-purple-200/50" :
      "from-slate-500 to-slate-600"
    } flex-shrink-0`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider line-clamp-2 leading-snug" title={label}>{label}</p>
      <div className="space-y-1">
        {loading ? (
          <div className="h-8 w-24 skeleton-box"></div>
        ) : (
          <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5 tabular-nums fluid-metric-value">{value}</p>
        )}
        
        <div className="flex items-center space-x-2">
          {trend && <span className="text-xs font-medium text-emerald-600">{trend}</span>}
          {sub && <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight line-clamp-2" title={sub}>{sub}</p>}
        </div>
      </div>
    </div>
    {badge && (
      <span className="shrink-0 bg-red-500/10 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
        {badge}
      </span>
    )}
  </div>
);

export default StatCard;
