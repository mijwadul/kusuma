import React from 'react';

const StatCard = ({ icon: Icon, label, value, sub, color, onClick, badge }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-start gap-4 fluid-metric-container
      transition-all duration-300 ease-out hover:shadow-md hover:border-slate-200/80
      ${onClick ? "cursor-pointer hover:-translate-y-1" : ""}`}
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
      <p className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5 tabular-nums fluid-metric-value">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight line-clamp-2" title={sub}>{sub}</p>}
    </div>
    {badge && (
      <span className="shrink-0 bg-red-500/10 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
        {badge}
      </span>
    )}
  </div>
);

export default StatCard;
