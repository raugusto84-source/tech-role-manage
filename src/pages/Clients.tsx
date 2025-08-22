import { AppLayout } from '@/components/layout/AppLayout';
import { UnifiedClientDashboard } from '@/components/clients/UnifiedClientDashboard';
import { useAuth } from '@/hooks/useAuth';

/**
 * Página unificada de clientes
 * Dashboard personalizado para que los clientes vean sus cotizaciones, servicios y recompensas
 */
export default function Clients() {
  const { profile } = useAuth();

  return (
    <AppLayout>
      {profile?.role === 'cliente' ? (
        <UnifiedClientDashboard />
      ) : (
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Acceso Restringido</h1>
            <p className="text-muted-foreground">
              Esta página está disponible solo para clientes.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}