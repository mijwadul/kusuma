import React, { useState } from 'react';
import { Briefcase, Wallet, CreditCard, AlertCircle } from 'lucide-react';
import EmployeeListTab from '../components/employees/EmployeeListTab';
import LoansTab from '../components/employees/LoansTab';
import { usePermissions } from '../hooks/usePermissions';

const TABS = {
  EMPLOYEES: 'employees',
  LOANS: 'loans'
};

const EmployeesPage: React.FC = () => {
  const { currentUser, isLoading: loading, isGM, canAccessFinancial, canManageEmployees, isAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState(TABS.EMPLOYEES);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  // Field staff cannot access employee menu
  if (currentUser?.role === 'field' && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-600">Anda tidak memiliki akses ke menu Karyawan.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manajemen Karyawan</h1>
        <p className="text-gray-600 mt-1 text-sm">Kelola data karyawan, payroll, dan kehadiran</p>
      </div>

      {/* Tabs */}
      <div className="tabs-scrollable bg-gray-100 p-1 rounded-lg mb-4 sm:mb-6 flex overflow-x-auto">
        <button
          onClick={() => setActiveTab(TABS.EMPLOYEES)}
          className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === TABS.EMPLOYEES
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Briefcase className="inline-block w-4 h-4 mr-1 sm:mr-2" />
          Data Karyawan
        </button>
        {canAccessFinancial && (
          <button
            onClick={() => setActiveTab(TABS.LOANS)}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === TABS.LOANS
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CreditCard className="inline-block w-4 h-4 mr-1 sm:mr-2" />
            Pinjaman &amp; Hutang
          </button>
        )}
      </div>

      {/* Tab Contents */}
      {activeTab === TABS.EMPLOYEES && (
        <EmployeeListTab 
          currentUser={currentUser}
          canAccessFinancial={canAccessFinancial}
          canManageEmployees={canManageEmployees}
          isGM={isGM}
        />
      )}

      {activeTab === TABS.LOANS && canAccessFinancial && (
        <LoansTab canAccessFinancial={canAccessFinancial} />
      )}
    </div>
  );
};

export default EmployeesPage;
