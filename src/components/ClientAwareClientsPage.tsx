import { useAuth } from '@/hooks/useAuth';
import ClientDashboard from '@/pages/ClientDashboard';
import Clients from '@/pages/Clients';

/**
 * Component that shows different content based on user role
 * Clients see their unified dashboard, admins see the full client management page
 */
export function ClientAwareClientsPage() {
  const { profile } = useAuth();
  
  if (profile?.role === 'cliente') {
    return <ClientDashboard />;
  }
  
  return <Clients />;
}