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

import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

const MainLayout: React.FC = () => {
  return (
    <Sidebar>
      <Outlet />
    </Sidebar>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Toaster />
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
          
          <Route path="/employees" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><EmployeesPage /></RoleProtectedRoute>} />
          <Route path="/users" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><UsersPage /></RoleProtectedRoute>} />
          <Route path="/attendance" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><AttendancePage /></RoleProtectedRoute>} />
          <Route path="/cashflow" element={<RoleProtectedRoute allowedRoles={["gm", "admin"]}><CashFlowPage /></RoleProtectedRoute>} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
