import { useCurrentUser } from './useAuth';

export const usePermissions = () => {
  const { data: currentUser, isLoading, error } = useCurrentUser();

  const isDirector = currentUser?.role === 'direktur';
  const isManager = currentUser?.role === 'manager';
  const isGM = currentUser?.role === 'gm' || isDirector || currentUser?.role === 'admin' || currentUser?.is_admin === true || currentUser?.is_superuser === true;
  const isFinance = currentUser?.role === 'finance' || currentUser?.role === 'checker' || isGM;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'gm' || isGM;
  const isField = currentUser?.role === 'field';

  return {
    currentUser,
    isLoading,
    error,
    isDirector,
    isManager,
    isGM,
    isFinance,
    isAdmin,
    isField,
    canAccessFinancial: isFinance,
    canManageEmployees: (isAdmin || isManager) && !isDirector,
    canManageUsers: isAdmin && !isDirector,
    // Direktur has read-only, cannot approve. Manager can approve for their division. GM can approve.
    canApprove: (isGM && !isDirector) || isManager || currentUser?.role === 'checker',
  };
};
