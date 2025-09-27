import { useAuth } from '@/hooks/useAuth';

interface SoftDeletePermissions {
  canDeleteOrders: boolean;
  canDeletePayments: boolean;
  canDeletePurchases: boolean;
  canDeleteIncomes: boolean;
  canDeleteExpenses: boolean;
}

export function useSoftDelete(): SoftDeletePermissions {
  const { profile } = useAuth();

  const canDelete = profile?.role === 'administrador' || profile?.role === 'supervisor';

  return {
    canDeleteOrders: canDelete,
    canDeletePayments: canDelete,
    canDeletePurchases: canDelete,
    canDeleteIncomes: canDelete,
    canDeleteExpenses: canDelete,
  };
}