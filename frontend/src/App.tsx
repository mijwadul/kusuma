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

// Code Splitting with React.lazy
const LoginPage = lazy(() => import('./pages/LoginPage'));
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

import { motion } from 'framer-motion';

const MainLayout: React.FC = () => {
  const location = useLocation();

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
      <Router>
        <Toaster />
        <Suspense fallback={<FallbackLoader />}>
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
              <Route path="/projects" element={<RoleProtectedRoute allowedRoles={["gm", "admin", "finance", "checker"]}><ProjectsPage /></RoleProtectedRoute>} />

              <Route path="/fuel" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]}><FuelPage /></RoleProtectedRoute>} />
              <Route path="/work-logs" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]}><WorkLogsPage /></RoleProtectedRoute>} />
              <Route path="/material-sales" element={<RoleProtectedRoute allowedRoles={["field", "helper", "finance", "checker", "gm", "admin"]}><MaterialSalesPage /></RoleProtectedRoute>} />

              <Route path="/income" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><IncomePage /></RoleProtectedRoute>} />
              <Route path="/finance/fuel-price" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><FuelPricePage /></RoleProtectedRoute>} />
              <Route path="/payroll" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><PayrollPage /></RoleProtectedRoute>} />
              <Route path="/expenses" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><ExpensePage /></RoleProtectedRoute>} />
              <Route path="/reports" element={<RoleProtectedRoute allowedRoles={["finance", "checker", "gm", "admin"]}><ReportsPage /></RoleProtectedRoute>} />

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
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
