import React from 'react';
import { Truck, Scale, Box, Users, Building2, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';
import { useHaulingDashboardStats, useAllHaulingObligations } from '../../hooks/useHauling';
import { formatIDR } from '../../utils/formatters';

const HaulingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading: loadingStats } = useHaulingDashboardStats();
  const { data: vendorObligations = [], isLoading: loadingVendors } = useAllHaulingObligations();

  if (loadingStats) {
    return <div className="text-center p-8 text-gray-500 animate-pulse">Memuat data dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatCard
          icon={Truck}
          label="Total Ritase"
          value={stats?.total_ritase?.toLocaleString('id-ID') || "0"}
          sub="Total Surat Jalan"
          color="bg-blue-600"
          onClick={() => navigate("/hauling")}
        />
        <StatCard
          icon={Scale}
          label="Total Tonase"
          value={`${stats?.total_tonase?.toLocaleString('id-ID', { maximumFractionDigits: 2 }) || "0"} T`}
          sub="Akumulasi Berat Netto"
          color="bg-emerald-600"
        />
        <StatCard
          icon={Box}
          label="Total Volume"
          value={`${stats?.total_volume?.toLocaleString('id-ID', { maximumFractionDigits: 2 }) || "0"} m³`}
          sub="Akumulasi Kubikasi"
          color="bg-amber-600"
        />
        <StatCard
          icon={Users}
          label="Vendor Aktif"
          value={stats?.active_vendors?.toLocaleString('id-ID') || "0"}
          sub="Vendor yang Terlibat"
          color="bg-purple-600"
        />
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
        <div className="p-5 md:p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600 w-5 h-5" /> Status Vendor Hauling
          </h3>
          <p className="text-sm text-gray-500 mt-1">Ringkasan ritase dan saldo deposit/kasbon per vendor.</p>
        </div>
        
        {loadingVendors ? (
           <div className="p-8 text-center text-gray-500">Memuat status vendor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b whitespace-nowrap">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-500 uppercase tracking-wider text-xs">Nama Vendor</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-500 uppercase tracking-wider text-xs">Total Ritase</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">Total Kewajiban (Rp)</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">Sisa Deposit (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendorObligations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Belum ada aktivitas vendor.</td>
                  </tr>
                ) : (
                  vendorObligations.sort((a: any, b: any) => b.total_ritase - a.total_ritase).map((v: any) => {
                     // Hitung perkiraan tagihan = total kewajiban dikurangi sisa deposit (jika tidak minus)
                     const nettoTagihan = v.total_obligation - v.balance_deposit;
                     const isKasbon = v.balance_deposit > v.total_obligation;
                     
                     return (
                        <tr key={v.vendor_id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{v.vendor_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center font-semibold text-blue-600">{v.total_ritase}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-600">{formatIDR(v.total_obligation)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                             <div className="flex items-center justify-end gap-2">
                               {isKasbon && <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">KASBON AMAN</span>}
                               <span className={`font-semibold ${isKasbon ? 'text-emerald-600' : 'text-red-600'}`}>
                                 {formatIDR(v.balance_deposit)}
                               </span>
                             </div>
                          </td>
                        </tr>
                     )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HaulingDashboard;
