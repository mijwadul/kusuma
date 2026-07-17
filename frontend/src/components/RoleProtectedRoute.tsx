import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  allowedDivision?: string;
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ children, allowedRoles, allowedDivision }) => {
  const userStr = localStorage.getItem('user');
  let user = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
    }
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Superuser and Admin (is_admin=true) are implicitly allowed
  const hasRole = !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(user.role) || user.is_superuser || user.is_admin;
  const isBypassDivision = user.role === 'gm' || user.role === 'direktur' || user.is_admin || user.is_superuser;

  if (!hasRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check division access
  if (allowedDivision && !isBypassDivision) {
    if (user.division !== allowedDivision) {
      return <Navigate to="/portal" replace />;
    }
  }

  return children;
};

export default RoleProtectedRoute;
