import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FileText, ShoppingCart } from 'lucide-react';
import { ClientsList } from '@/components/clients/ClientsList';
import { ClientQuotesHistory } from '@/components/clients/ClientQuotesHistory';
import { ClientServicesHistory } from '@/components/clients/ClientServicesHistory';

/**
 * Página de gestión integral de clientes
 * Incluye lista de clientes, historial de cotizaciones, servicios y sistema de recompensas
 */
export default function Clients() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestión de Clientes
          </h1>
          <p className="text-muted-foreground mt-2">
            Panel completo para gestionar clientes, historial y sistema de recompensas
          </p>
        </div>

        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Cotizaciones
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Servicios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-6">
            <ClientsList />
          </TabsContent>

          <TabsContent value="quotes" className="space-y-6">
            <ClientQuotesHistory />
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <ClientServicesHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}