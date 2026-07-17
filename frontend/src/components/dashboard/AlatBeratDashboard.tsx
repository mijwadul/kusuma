import React from 'react';
import { Truck, Gauge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';
import EntityTablesPanel from './EntityTablesPanel';

interface Props {
  stats: any;
  loadingStats: boolean;
  fuelStats: any;
  loadingFuelStats: boolean;
  equipment: any[];
}

const AlatBeratDashboard: React.FC<Props> = ({ stats, loadingStats, fuelStats, loadingFuelStats, equipment }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
        <StatCard
          icon={Truck}
          label="Total Equipment"
          value={stats.equipment_count}
          color="bg-blue-500"
          loading={loadingStats}
          onClick={() => navigate("/equipment")}
        />
        <StatCard
          icon={Gauge}
          label="BBM 30 Hari"
          value={`${fuelStats?.total_fuel_consumed?.toFixed(1) || 0} L`}
          sub={`${fuelStats?.equipment_count || 0} unit`}
          color="bg-amber-500"
          loading={loadingFuelStats}
          onClick={() => navigate("/fuel")}
        />
      </div>

      <EntityTablesPanel equipment={equipment} employees={[]} />
    </div>
  );
};

export default AlatBeratDashboard;
