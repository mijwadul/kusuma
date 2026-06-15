import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { logout as apiLogout } from "../api/auth";
import {
  Home,
  LogOut,
  Truck,
  Users,
  FolderOpen,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Clock,
  ChevronDown,
  ChevronRightIcon,
  Factory,
  UserCog,
  Calendar,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Briefcase,
  FileText,
  Receipt,
  BarChart3,
  FileBarChart2,
} from "lucide-react";

interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
        setMobileMenuOpen(false);
      } else {
        setIsOpen(true);
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch current user for role-based menu
  useEffect(() => {
    // First try to get from localStorage
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error("Error parsing user from localStorage:", e);
      }
    }

    // Then fetch fresh data from API
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await fetch("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await apiLogout();
    setCurrentUser(null);
    queryClient.clear();
    navigate("/login");
  };

  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

interface SubMenuItem {
  path: string;
  icon: any;
  label: string;
  show?: boolean;
}

interface MenuItem {
  id?: string;
  path?: string;
  icon: any;
  label: string;
  show?: boolean;
  submenu?: SubMenuItem[];
}

  // Role-based menu filtering - System Kusuma Roles: gm, finance, admin, field
  // Legacy roles: helper → field, checker → finance
  const getMenuItems = (): MenuItem[] => {
    const role = currentUser?.role || "field";
    // GM level: gm, admin (legacy), is_admin flag
    const isGM = role === "gm" || role === "admin" || currentUser?.is_admin;
    // Finance level: finance, checker (legacy), GM level
    const isFinance = role === "finance" || role === "checker" || isGM;
    // Admin/HR level: admin, gm, GM level
    const isAdmin = role === "admin" || role === "gm" || isGM;
    // Field level: field, helper (legacy), and above
    const isField =
      role === "field" || role === "helper" || isAdmin || isFinance;
      
    const isAssignedField = role === "field" && currentUser?.is_project_assigned;

    const items: MenuItem[] = [
      { path: "/dashboard", icon: Home, label: "Dashboard", show: true },
    ];

    if (isAssignedField) {
      items.push({
        id: "projects",
        icon: FolderOpen,
        label: "Project",
        submenu: [
          {
            path: "/projects/surat-jalan",
            icon: Truck,
            label: "Surat Jalan",
            show: true
          },
          {
            path: "/projects/pekerja",
            icon: Users,
            label: "Pekerja",
            show: true
          }
        ]
      });
      return items;
    }

    // 1. Equipment & Operasional submenu (All roles see equipment, Field sees operational logs)
    const equipmentSubmenu = [
      {
        path: "/equipment",
        icon: Factory,
        label: "Manajemen Equipment",
        show: true,
      },
      {
        path: "/hauling",
        icon: Truck,
        label: "Vendor Hauling",
        show: isFinance || isAdmin,
      },
      {
        path: "/work-logs",
        icon: Clock,
        label: "Log Jam Kerja Alat",
        show: isField,
      },
      { path: "/fuel", icon: Fuel, label: "Logistik BBM", show: isField },
      {
        path: "/material-sales",
        icon: ShoppingCart,
        label: "Penjualan Material",
        show: isField,
      },
    ].filter((sub) => sub.show);

    if (equipmentSubmenu.length > 0) {
      items.push({
        id: "equipment",
        icon: Factory,
        label: "Operasional & Penjualan",
        submenu: equipmentSubmenu,
      });
    }

    // 2. Karyawan dengan submenu (Admin & Field)
    if (isAdmin || isField) {
      const employeeSubmenu = [
        {
          path: "/employees",
          icon: Users,
          label: "Manajemen Karyawan",
          show: isAdmin,
        },
        {
          path: "/attendance",
          icon: Calendar,
          label: "Absensi Karyawan",
          show: isAdmin,
        },
        {
          path: "/payroll",
          icon: FileText,
          label: "Payroll & Slip Gaji",
          show: isFinance,
        },
      ].filter((sub) => sub.show);

      if (employeeSubmenu.length > 0) {
        items.push({
          id: "employees",
          icon: UserCog,
          label: "Karyawan",
          submenu: employeeSubmenu,
        });
      }
    }

    // 3. Finance Menu (GM & Finance only)
    if (isFinance) {
      const financeSubmenu = [
        {
          path: "/finance/fuel-price",
          icon: Fuel,
          label: "Pembelian BBM",
          show: true,
        },
        {
          path: "/income",
          icon: Wallet,
          label: "Pemasukan & Pendapatan",
          show: true,
        },
        {
          path: "/surat-jalan",
          icon: Receipt,
          label: "Surat Jalan",
          show: isFinance, // Since it's in finance menu, isFinance is true for these users
        },
        {
          path: "/expenses",
          icon: Receipt,
          label: "Pengeluaran Harian",
          show: true,
        },
        {
          path: "/cashflow",
          icon: BarChart3,
          label: "Cash Flow",
          show: isGM,
        },
        {
          path: "/reports",
          icon: FileBarChart2,
          label: "Laporan Operasional",
          show: isFinance,
        },
      ];
      items.push({
        id: "finance",
        icon: Briefcase,
        label: "Finance",
        submenu: financeSubmenu,
      });
    }

    // 4. Project (All roles except pure field may see differently)
    const projectSubmenu = [
      {
        path: "/projects",
        icon: FolderOpen,
        label: "Project Management",
        show: true,
      },
    ];
    
    if (isGM) {
      projectSubmenu.push(
        {
          path: "/projects/surat-jalan",
          icon: Truck,
          label: "Surat Jalan",
          show: true,
        },
        {
          path: "/projects/pekerja",
          icon: Users,
          label: "Pekerja Proyek",
          show: true,
        }
      );
    }
    if (projectSubmenu.length > 0) {
      items.push({
        id: "projects",
        icon: TrendingUp,
        label: "Project",
        submenu: projectSubmenu,
      });
    }

    // User Management - GM only
    if (isGM) {
      items.push({
        path: "/users",
        icon: Users,
        label: "Manajemen User",
        show: true,
      });
    }

    return items.filter((item) => item.show !== false);
  };

  const mainMenuItems = getMenuItems();

  const isActive = (path: string) => location.pathname === path;

  // Mobile hamburger menu
  if (isMobile) {
    return (
      <div className="min-h-screen bg-transparent">
        {/* Mobile Header */}
        <div className="bg-brand-dark text-white p-4 flex items-center justify-between shadow-md fixed top-0 left-0 right-0 z-50">
          <h1 className="text-base font-bold truncate mr-2">PT. Kusuma Samudera</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="absolute top-16 left-0 right-0 glass-sidebar text-white shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-700/50"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="p-4 space-y-1">
                {mainMenuItems.map((item) => {
                  // Skip items that shouldn't be shown
                  if (item.show === false) return null;
                  if (item.submenu) {
                    const isExpanded = expandedMenu === item.id;
                    const hasActiveChild = item.submenu.some((sub) =>
                      isActive(sub.path),
                    );
                    return (
                      <div key={item.id}>
                        <button
                          onClick={() =>
                            setExpandedMenu(isExpanded ? null : (item.id || null))
                          }
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                            hasActiveChild
                              ? "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                              : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <item.icon size={20} />
                            <span>{item.label}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRightIcon size={16} />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.submenu.map((sub) => {
                              const isSubActive = isActive(sub.path);
                              const isFuelSub = sub.path === "/fuel";
                              return (
                                <Link
                                  key={sub.path}
                                  to={sub.path}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={`flex items-center space-x-3 p-2 rounded-xl text-sm transition-all duration-200 ${
                                    isSubActive
                                      ? isFuelSub
                                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20"
                                        : "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                                      : isFuelSub
                                        ? "hover:bg-amber-700/50 hover:text-amber-100 text-amber-200/70"
                                        : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                                  }`}
                                >
                                  <sub.icon
                                    size={18}
                                    className={
                                      isFuelSub && !isSubActive
                                        ? "text-amber-300"
                                        : ""
                                    }
                                  />
                                  <span>{sub.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  const isItemActive = isActive(item.path || "");
                  return (
                    <Link
                      key={item.path}
                      to={item.path || ""}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 ${
                        isItemActive
                          ? "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                          : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                      }`}
                    >
                      <item.icon size={20} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-red-600 text-red-100 transition-colors w-full"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Mobile Content */}
        <div className="pt-24 px-4 py-6 min-w-0 overflow-x-auto">{children}</div>
      </div>
    );
  }

  // Desktop Sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      {/* Sidebar */}
      <div
        className={`h-screen glass-sidebar text-white transition-all duration-300 ease-in-out flex flex-col shadow-2xl shadow-slate-900/50 ${
          isOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          {isOpen ? (
            <h1 className="text-lg font-bold">PT. Kusuma Samudera</h1>
          ) : (
            <span className="text-xl font-bold">KS</span>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {mainMenuItems.map((item) => {
            // Skip items that shouldn't be shown
            if (item.show === false) return null;
            if (item.submenu) {
              const isExpanded =
                expandedMenu === item.id ||
                (!isOpen && item.submenu.some((sub) => isActive(sub.path)));
              const hasActiveChild = item.submenu.some((sub) =>
                isActive(sub.path),
              );
              return (
                <div key={item.id}>
                  {isOpen ? (
                    <>
                      <button
                        onClick={() =>
                          setExpandedMenu(isExpanded ? null : (item.id || null))
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                          hasActiveChild
                            ? "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                            : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon size={20} />
                          <span>{item.label}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRightIcon size={16} />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.submenu.map((sub) => {
                            const isSubActive = isActive(sub.path);
                            const isFuelSub = sub.path === "/fuel";
                            return (
                              <Link
                                key={sub.path}
                                to={sub.path}
                                className={`flex items-center space-x-3 p-2 rounded-xl text-sm transition-all duration-200 ${
                                  isSubActive
                                    ? isFuelSub
                                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20"
                                      : "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                                    : isFuelSub
                                      ? "hover:bg-amber-700/50 hover:text-amber-100 text-amber-200/70"
                                      : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                                }`}
                                title={sub.label}
                              >
                                <sub.icon
                                  size={18}
                                  className={
                                    isFuelSub && !isSubActive
                                      ? "text-amber-300"
                                      : ""
                                  }
                                />
                                <span>{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    // Collapsed state - show icon only with tooltip-like behavior
                    <div className="relative group">
                      <button
                        onClick={() =>
                          setExpandedMenu(
                            expandedMenu === item.id ? null : (item.id || null),
                          )
                        }
                        className={`w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                          hasActiveChild
                            ? "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                            : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                        }`}
                        title={item.label}
                      >
                        <item.icon size={20} />
                      </button>
                      {/* Tooltip */}
                      <div className="absolute left-full top-0 ml-2 bg-brand-darker text-white px-2 py-1 rounded text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                        {item.label}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            const isItemActive = isActive(item.path || "");
            return (
              <Link
                key={item.path}
                to={item.path || ""}
                className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 ${
                  isItemActive
                    ? "bg-gradient-to-r from-accent to-accent-hover text-white shadow-md shadow-accent/20"
                    : "hover:bg-slate-800/60 hover:text-white text-slate-300"
                } ${!isOpen && "justify-center"}`}
                title={!isOpen ? item.label : ""}
              >
                <item.icon size={20} />
                {isOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer - Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-red-600 text-red-100 transition-colors w-full ${
              !isOpen && "justify-center"
            }`}
            title={!isOpen ? "Logout" : ""}
          >
            <LogOut size={20} />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-y-auto p-6 min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
};

export default Sidebar;
