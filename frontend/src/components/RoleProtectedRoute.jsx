import React from 'react';
import { Navigate } from 'react-router-dom';

const RoleProtectedRoute = ({ children, allowedRoles }) => {
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

  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }
  
  // Superuser and Admin (is_admin=true) are implicitly allowed
  const hasRole = allowedRoles.includes(user.role) || user.is_superuser || user.is_admin;

  if (!hasRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RoleProtectedRoute;
