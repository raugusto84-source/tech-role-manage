import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Mail, Phone, MapPin, Users } from 'lucide-react';
import { ClientForm } from '@/components/ClientForm';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  whatsapp?: string;
  created_at: string;
  orders_count?: number;
  quotes_count?: number;
  total_spent?: number;
}

/**
 * Componente para listar y gestionar clientes
 * Incluye búsqueda, filtros y creación de nuevos clientes
 */
export function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // Cargar clientes con estadísticas
      const { data: clientsData, error } = await supabase
        .from('clients')
        .select(`
          *,
          orders:orders(count),
          quotes:quotes(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

        // Calcular total gastado por cliente
        const clientsWithStats = await Promise.all(
          (clientsData || []).map(async (client) => {
          const { data: ordersData } = await supabase
            .from('orders')
            .select('estimated_cost')
            .eq('client_id', client.id)
            .eq('status', 'finalizada');

          const totalSpent = ordersData?.reduce((sum, order) => sum + (order.estimated_cost || 0), 0) || 0;

          return {
            ...client,
            orders_count: client.orders?.length || 0,
            quotes_count: client.quotes?.length || 0,
            total_spent: totalSpent
          };
        })
      );

      setClients(clientsWithStats);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClientCreated = (newClient: Client) => {
    setClients(prev => [newClient, ...prev]);
    setShowCreateDialog(false);
    toast({
      title: "Cliente creado",
      description: "El cliente se ha creado exitosamente",
    });
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Clientes ({clients.length})
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Cliente</DialogTitle>
              </DialogHeader>
              <ClientForm
                onSuccess={handleClientCreated}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    <Badge variant="outline">
                      Cliente desde {new Date(client.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {client.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {client.address}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{client.quotes_count}</div>
                      <div className="text-xs text-muted-foreground">Cotizaciones</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{client.orders_count}</div>
                      <div className="text-xs text-muted-foreground">Órdenes</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(client.total_spent || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total gastado</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          
          {filteredClients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}