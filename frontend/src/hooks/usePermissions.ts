import { useCurrentUser } from './useAuth';

export const usePermissions = () => {
  const { data: currentUser, isLoading, error } = useCurrentUser();

  const isGM = currentUser?.role === 'gm' || currentUser?.role === 'admin' || currentUser?.is_admin === true || currentUser?.is_superuser === true;
  const isFinance = currentUser?.role === 'finance' || currentUser?.role === 'checker' || isGM;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'gm' || isGM;
  const isField = currentUser?.role === 'field';

  return {
    currentUser,
    isLoading,
    error,
    isGM,
    isFinance,
    isAdmin,
    isField,
    canAccessFinancial: isFinance,
    canManageEmployees: isAdmin,
    canManageUsers: isAdmin,
    canApprove: isGM || currentUser?.role === 'checker',
  };
};
