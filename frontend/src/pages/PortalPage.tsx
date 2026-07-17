import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDivision, Division } from '../context/DivisionContext';
import { Truck, Factory, Map, Building2, LogOut } from 'lucide-react';
import { logout as apiLogout } from '../api/auth';
import { useQueryClient } from '@tanstack/react-query';

const PortalPage: React.FC = () => {
  const navigate = useNavigate();
  const { setActiveDivision } = useDivision();
  const queryClient = useQueryClient();

  const handleSelectDivision = (division: Division) => {
    setActiveDivision(division);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    await apiLogout();
    queryClient.clear();
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setActiveDivision(null);
    navigate('/login');
  };

  const allDivisions = [
    {
      id: 'alat-berat' as Division,
      title: 'Divisi Alat Berat',
      description: 'Pusat kontrol dan administrasi seluruh operasional alat berat, timesheet, dan BBM.',
      icon: <Factory size={48} className="mb-4 text-amber-400" />,
      color: 'from-amber-500 to-amber-700',
      hoverColor: 'hover:shadow-amber-500/50',
    },
    {
      id: 'hauling' as Division,
      title: 'Divisi Trucking & Hauling',
      description: 'Pusat kontrol logistik, mobilitas armada, surat jalan dan pengiriman material.',
      icon: <Truck size={48} className="mb-4 text-blue-400" />,
      color: 'from-blue-500 to-blue-700',
      hoverColor: 'hover:shadow-blue-500/50',
    },
    {
      id: 'material' as Division,
      title: 'Divisi Material & Lahan',
      description: 'Pusat pengelolaan aset tanah, perijinan, dan komersialisasi penjualan material.',
      icon: <Map size={48} className="mb-4 text-emerald-400" />,
      color: 'from-emerald-500 to-emerald-700',
      hoverColor: 'hover:shadow-emerald-500/50',
    },
    {
      id: 'corporate' as Division,
      title: 'Corporate & Finance',
      description: 'Pusat administrasi global lintas divisi, keuangan, cashflow, dan HRD.',
      icon: <Building2 size={48} className="mb-4 text-purple-400" />,
      color: 'from-purple-500 to-purple-700',
      hoverColor: 'hover:shadow-purple-500/50',
    }
  ];

  const userStr = localStorage.getItem('user');
  let currentUser = null;
  if (userStr) {
    try {
      currentUser = JSON.parse(userStr);
    } catch (e) {}
  }
  const isGM = currentUser?.role === 'gm' || currentUser?.role === 'direktur' || currentUser?.is_admin || currentUser?.is_superuser;

  const divisions = allDivisions.filter(div => {
    if (isGM) return true;
    if (currentUser?.division) return div.id === currentUser.division;
    return true; // Allow if user has no specific division yet, though backend will require it eventually
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300 } }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-6xl z-10">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">PT. Kusuma Samudera</h1>
            <p className="text-slate-400 text-lg">Silakan pilih divisi ruang lingkup kerja Anda</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-red-600/80 px-4 py-2 rounded-lg transition-all duration-300 backdrop-blur-md"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {divisions.map((div) => (
            <motion.div
              key={div.id}
              variants={itemVariants}
              onClick={() => handleSelectDivision(div.id)}
              className={`relative bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${div.hoverColor} overflow-hidden`}
            >
              {/* Card Accent Gradient */}
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${div.color}`}></div>
              <div className={`absolute -bottom-16 -right-16 w-32 h-32 bg-gradient-to-br ${div.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity duration-300`}></div>

              <div className="flex flex-col h-full relative z-10">
                {div.icon}
                <h2 className="text-xl font-semibold text-white mb-3">{div.title}</h2>
                <p className="text-slate-400 text-sm leading-relaxed flex-grow">{div.description}</p>
                
                <div className="mt-6 flex items-center text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  <span>Masuk Portal</span>
                  <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default PortalPage;
