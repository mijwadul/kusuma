import React from 'react';
import { Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from './StatCard';

const HaulingDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <StatCard
          icon={Truck}
          label="Modul Hauling Aktif"
          value="ON"
          sub="Menu Surat Jalan & Pengiriman"
          color="bg-blue-600"
          onClick={() => navigate("/hauling")}
        />
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Divisi Trucking & Hauling</h3>
        <p className="text-gray-500 max-w-lg mx-auto">
          Fitur analitik pengiriman dan ritase spesifik untuk armada hauling akan ditampilkan di sini.
        </p>
      </div>
    </div>
  );
};

export default HaulingDashboard;
