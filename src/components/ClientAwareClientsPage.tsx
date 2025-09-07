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
    // SEO: asegurar ruta canónica y título cuando se muestra el dashboard de cliente
    document.title = 'Mi Panel de Cliente | Syslag';
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    const canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    canonical.setAttribute('href', `${window.location.origin}/dashboard`);
    if (existingCanonical) existingCanonical.replaceWith(canonical); else document.head.appendChild(canonical);
    return <ClientDashboard />;
  }
  
  return <Clients />;
}