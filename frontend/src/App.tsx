import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Toaster } from "sonner";

// Since pages might not be TS yet, we just import them normally. 
// TS will allow JS imports because we set allowJs: true.
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EquipmentPage from "./pages/EquipmentPage";
import EmployeesPage from "./pages/EmployeesPage";
import ProjectsPage from "./pages/ProjectsPage";
import FuelPage from "./pages/FuelPage";
import WorkLogsPage from "./pages/WorkLogsPage";
import UsersPage from "./pages/UsersPage";
import AttendancePage from "./pages/AttendancePage";
import MaterialSalesPage from "./pages/MaterialSalesPage";
import IncomePage from "./pages/IncomePage";
import FuelPricePage from "./pages/FuelPricePage";
import PayrollPage from "./pages/PayrollPage";
import ExpensePage from "./pages/ExpensePage";
import CashFlowPage from "./pages/CashFlowPage";
import ReportsPage from "./pages/ReportsPage";
import SuratJalanPage from "./pages/SuratJalanPage";
import ProjectSuratJalanPage from "./pages/ProjectSuratJalanPage";
import ProjectEmployeesPage from "./pages/ProjectEmployeesPage";
import HaulingPage from "./pages/HaulingPage";

import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { useLocation } from "react-router-dom";

const MainLayout: React.FC = () => {
  const location = useLocation();
  
  return (
    <Sidebar>
      <div key={location.pathname} className="page-transition-enter min-h-full">
        <Outlet />
      </div>
    </Sidebar>
  );
};

const GlobalShortcuts: React.FC = () => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. ESCAPE: Tutup modal aktif teratas
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('div.fixed.inset-0');
        if (modals.length > 0) {
          const topModal = modals[modals.length - 1];
          const buttons = Array.from(topModal.querySelectorAll('button'));
          const closeBtn = buttons.find(b => {
            const text = b.textContent?.toLowerCase() || '';
            const hasXIcon = b.querySelector('svg.lucide-x') !== null;
            return text.includes('batal') || text.includes('tutup') || text.includes('cancel') || hasXIcon;
          });
          if (closeBtn) {
            e.preventDefault();
            (closeBtn as HTMLElement).click();
          }
        }
      }
      
      // 2. ENTER: Accept/Submit modal aktif
      if (e.key === 'Enter') {
        // Jangan intercept jika user sedang mengetik di textarea atau fokus di select
        if (['TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
          return;
        }
        
        const modals = document.querySelectorAll('div.fixed.inset-0');
        if (modals.length > 0) {
          const topModal = modals[modals.length - 1];
          const buttons = Array.from(topModal.querySelectorAll('button'));
          
          const submitBtn = buttons.find(b => {
            const text = b.textContent?.toLowerCase() || '';
            return b.type === 'submit' || text.includes('simpan') || text.includes('tambah') || text.includes('approve') || text.includes('ya');
          });
          
          if (submitBtn) {
            // Jika input ada di dalam tag form, biarkan HTML native yang handle submit
            if ((e.target as HTMLElement).tagName === 'INPUT') {
              const form = (e.target as HTMLElement).closest('form');
              if (form) return;
            }
            
            e.preventDefault();
            (submitBtn as HTMLElement).click();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
      <Toaster />
      <GlobalShortcuts />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<RoleProtectedRoute allowedRoles={[]}><DashboardPage /></RoleProtectedRoute>} />
          <Route path="/equipment" element={<RoleProtectedRoute allowedRoles={[]}><EquipmentPage /></RoleProtectedRoute>} />
          <Route path="/projects" element={<RoleProtectedRoute allowedRoles={[]}><ProjectsPage /></RoleProtectedRoute>} />
          
          <Route path="/fuel" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]}><FuelPage /></RoleProtectedRoute>} />
          <Route path="/work-logs" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]}><WorkLogsPage /></RoleProtectedRoute>} />
          <Route path="/material-sales" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]}><MaterialSalesPage /></RoleProtectedRoute>} />
          
          <Route path="/income" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><IncomePage /></RoleProtectedRoute>} />
          <Route path="/finance/fuel-price" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><FuelPricePage /></RoleProtectedRoute>} />
          <Route path="/payroll" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><PayrollPage /></RoleProtectedRoute>} />
          <Route path="/expenses" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><ExpensePage /></RoleProtectedRoute>} />
          <Route path="/reports" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><ReportsPage /></RoleProtectedRoute>} />
          <Route path="/surat-jalan" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><SuratJalanPage /></RoleProtectedRoute>} />
          <Route path="/hauling" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><HaulingPage /></RoleProtectedRoute>} />
          <Route path="/employees" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><EmployeesPage /></RoleProtectedRoute>} />
          <Route path="/users" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><UsersPage /></RoleProtectedRoute>} />
          <Route path="/attendance" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><AttendancePage /></RoleProtectedRoute>} />
          <Route path="/cashflow" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><CashFlowPage /></RoleProtectedRoute>} />
          
          <Route path="/projects/surat-jalan" element={<RoleProtectedRoute allowedRoles={["field", "gm", "admin"]}><ProjectSuratJalanPage /></RoleProtectedRoute>} />
          <Route path="/projects/pekerja" element={<RoleProtectedRoute allowedRoles={["field", "gm", "admin"]}><ProjectEmployeesPage /></RoleProtectedRoute>} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
