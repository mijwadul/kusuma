import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Toaster } from "sonner";
import { useLocation } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { DivisionProvider } from "./context/DivisionContext";

// Code Splitting with React.lazy
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PortalPage = lazy(() => import('./pages/PortalPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const FuelPage = lazy(() => import('./pages/FuelPage'));
const WorkLogsPage = lazy(() => import('./pages/WorkLogsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const MaterialSalesPage = lazy(() => import('./pages/MaterialSalesPage'));
const IncomePage = lazy(() => import('./pages/IncomePage'));
const FuelPricePage = lazy(() => import('./pages/FuelPricePage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const ExpensePage = lazy(() => import('./pages/ExpensePage'));
const CashFlowPage = lazy(() => import('./pages/CashFlowPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

const ProjectSuratJalanPage = lazy(() => import('./pages/ProjectSuratJalanPage'));
const ProjectEmployeesPage = lazy(() => import('./pages/ProjectEmployeesPage'));
const HaulingPage = lazy(() => import('./pages/HaulingPage'));
const LoadingVendorPage = lazy(() => import('./pages/LoadingVendorPage'));
const LoadingPricesPage = lazy(() => import('./pages/LoadingPricesPage'));

import { motion } from 'framer-motion';

import { useDivision } from './context/DivisionContext';

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { activeDivision } = useDivision();

  if (!activeDivision && location.pathname !== '/portal') {
    return <Navigate to="/portal" replace />;
  }

  return (
    <Sidebar>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-full"
      >
        <Outlet />
      </motion.div>
    </Sidebar>
  );
};

const FallbackLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DivisionProvider>
        <Router>
          <Toaster />
          <Suspense fallback={<FallbackLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/portal" element={<ProtectedRoute><PortalPage /></ProtectedRoute>} />
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<RoleProtectedRoute allowedRoles={[]}><DashboardPage /></RoleProtectedRoute>} />
                <Route path="/equipment" element={<RoleProtectedRoute allowedRoles={[]} allowedDivision="alat-berat"><EquipmentPage /></RoleProtectedRoute>} />
                <Route path="/projects" element={<RoleProtectedRoute allowedRoles={["gm", "admin", "finance", "checker"]} allowedDivision="material"><ProjectsPage /></RoleProtectedRoute>} />

                <Route path="/fuel" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]} allowedDivision="alat-berat"><FuelPage /></RoleProtectedRoute>} />
                <Route path="/work-logs" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]} allowedDivision="alat-berat"><WorkLogsPage /></RoleProtectedRoute>} />
                <Route path="/material-sales" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]} allowedDivision="material"><MaterialSalesPage /></RoleProtectedRoute>} />

                <Route path="/income" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="corporate"><IncomePage /></RoleProtectedRoute>} />
                <Route path="/finance/fuel-price" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="corporate"><FuelPricePage /></RoleProtectedRoute>} />
                <Route path="/payroll" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="corporate"><PayrollPage /></RoleProtectedRoute>} />
                <Route path="/expenses" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="corporate"><ExpensePage /></RoleProtectedRoute>} />
                <Route path="/reports" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="corporate"><ReportsPage /></RoleProtectedRoute>} />

                <Route path="/hauling" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="hauling"><HaulingPage /></RoleProtectedRoute>} />
                <Route path="/loading-vendors" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]} allowedDivision="alat-berat"><LoadingVendorPage /></RoleProtectedRoute>} />
                <Route path="/loading-prices" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]} allowedDivision="alat-berat"><LoadingPricesPage /></RoleProtectedRoute>} />
                <Route path="/employees" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]} allowedDivision="corporate"><EmployeesPage /></RoleProtectedRoute>} />
                <Route path="/users" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]} allowedDivision="corporate"><UsersPage /></RoleProtectedRoute>} />
                <Route path="/attendance" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]} allowedDivision="corporate"><AttendancePage /></RoleProtectedRoute>} />
                <Route path="/cashflow" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]} allowedDivision="corporate"><CashFlowPage /></RoleProtectedRoute>} />

                <Route path="/projects/surat-jalan" element={<RoleProtectedRoute allowedRoles={["field", "gm", "admin"]} allowedDivision="material"><ProjectSuratJalanPage /></RoleProtectedRoute>} />
                <Route path="/projects/pekerja" element={<RoleProtectedRoute allowedRoles={["field", "gm", "admin"]} allowedDivision="material"><ProjectEmployeesPage /></RoleProtectedRoute>} />
              </Route>
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </DivisionProvider>
    </ErrorBoundary>
  );
}

export default App;
