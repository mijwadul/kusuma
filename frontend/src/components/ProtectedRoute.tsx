import React, { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getToken } from "../api/auth";
import { API_URL } from "../api/apiClient";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // null = sedang cek, true = valid, false = tidak valid
  const [authState, setAuthState] = useState<boolean | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      const token = getToken();

      if (!token) {
        setAuthState(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          setAuthState(true);
        } else {
          // Token tidak valid atau sudah expired
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setAuthState(false);
        }
      } catch {
        // Network error — tetap anggap tidak valid
        setAuthState(false);
      }
    };

    validateToken();
  }, []);

  if (authState === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memverifikasi sesi...</p>
        </div>
      </div>
    );
  }

  if (!authState) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
