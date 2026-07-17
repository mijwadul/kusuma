import React from 'react';
import { FolderOpen, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';

interface Props {
  stats: any;
  loadingStats: boolean;
}

const MaterialDashboard: React.FC<Props> = ({ stats, loadingStats }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatCard
          icon={FolderOpen}
          label="Total Proyek"
          value={stats.project_count}
          color="bg-purple-500"
          loading={loadingStats}
          onClick={() => navigate("/projects")}
        />
        <StatCard
          icon={Map}
          label="Penjualan Material"
          value="ON"
          sub="Menu Transaksi"
          color="bg-emerald-500"
          onClick={() => navigate("/material-sales")}
        />
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Divisi Material & Lahan</h3>
        <p className="text-gray-500 max-w-lg mx-auto">
          Fitur analitik penjualan material dan progres proyek akan ditampilkan di sini.
        </p>
      </div>
    </div>
  );
};

export default MaterialDashboard;
