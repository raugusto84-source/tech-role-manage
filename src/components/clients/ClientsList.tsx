import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Mail, Phone, MapPin, Users, Gift, Star, Users as UsersIcon, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface Client {
  user_id: string;
  client_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  type: 'profile' | 'client';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', email: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // Cargar usuarios registrados con rol de cliente
      const { data: profileClients, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, created_at')
        .eq('role', 'cliente');

      if (profileError) throw profileError;

      // Cargar clientes de la tabla clients que tienen user_id (vinculados)
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, user_id, name, email, phone, address, created_at')
        .not('user_id', 'is', null);

      if (clientsError) throw clientsError;

      // Combinar ambos tipos de clientes y evitar duplicados
      const allClients = [];
      
      // Agregar usuarios con rol cliente
      for (const profile of profileClients || []) {
        const client = {
          user_id: profile.user_id,
          client_id: null,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          created_at: profile.created_at,
          type: 'profile'
        };
        allClients.push(client);
      }
      
      // Agregar clientes de tabla clients (solo si no están ya en profiles)
      for (const client of clientsData || []) {
        const existingProfile = profileClients?.find(p => p.user_id === client.user_id);
        if (!existingProfile) {
          allClients.push({
            user_id: client.user_id,
            client_id: client.id,
            full_name: client.name,
            email: client.email,
            phone: client.phone,
            created_at: client.created_at,
            type: 'client'
          });
        } else {
          // Actualizar con client_id si existe
          const existingClient = allClients.find(c => c.user_id === client.user_id);
          if (existingClient) {
            existingClient.client_id = client.id;
          }
        }
      }

          // Calculate statistics for each client
          const clientsWithStats = await Promise.all(
            allClients.map(async (client) => {
              let orders_count = 0;
              let totalSpent = 0;
              let quotes_count = 0;

              // Count orders by client_id if exists
              if (client.client_id) {
                const { data: ordersData } = await supabase
                  .from('orders')
                  .select('estimated_cost')
                  .eq('client_id', client.client_id);

                orders_count = ordersData?.length || 0;
                totalSpent = ordersData?.reduce((sum, order) => sum + (order.estimated_cost || 0), 0) || 0;
              }

              // Count quotes by user_id
              if (client.user_id) {
                const { data: quotesData } = await supabase
                  .from('quotes')
                  .select('id')
                  .eq('user_id', client.user_id);

                quotes_count = quotesData?.length || 0;
              }

              // Also search quotes by email if no user_id
              if (!quotes_count && client.email) {
                const { data: quotesDataByEmail } = await supabase
                  .from('quotes')
                  .select('id')
                  .eq('client_email', client.email);

                quotes_count = quotesDataByEmail?.length || 0;
              }

              return {
                ...client,
                orders_count,
                quotes_count,
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

  const handleEditClick = (client: Client) => {
    setSelectedClient(client);
    setEditForm({
      full_name: client.full_name,
      phone: client.phone || '',
      email: client.email
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedClient) return;
    
    try {
      // If email changed, call edge function to update auth
      if (editForm.email !== selectedClient.email) {
        const { data, error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: { userId: selectedClient.user_id, newEmail: editForm.email }
        });

        if (emailError) throw emailError;
        if (!data.success) throw new Error(data.error || 'Error al actualizar correo');
      }

      // Actualizar profile (email ya se actualizó en la edge function)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone
        })
        .eq('user_id', selectedClient.user_id);

      if (profileError) throw profileError;

      // Si hay client_id, actualizar también la tabla clients
      if (selectedClient.client_id) {
        const { error: clientError } = await supabase
          .from('clients')
          .update({
            name: editForm.full_name,
            phone: editForm.phone
          })
          .eq('id', selectedClient.client_id);

        if (clientError) throw clientError;
      }

      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente se actualizaron correctamente"
      });

      setEditDialogOpen(false);
      loadClients();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  const handleDeleteClick = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedClient) return;
    
    try {
      // Llamar a la edge function para eliminar el usuario
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedClient.user_id }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Error al eliminar usuario');
      }

      toast({
        title: "Cliente eliminado",
        description: "El cliente se eliminó correctamente del sistema"
      });

      setDeleteDialogOpen(false);
      loadClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };


  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
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
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lista de Clientes ({clients.length})
        </CardTitle>
        
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
            <Card key={client.user_id} className="p-4">
                <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{client.full_name}</h3>
                    <Badge variant="outline">
                      Cliente desde {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'Fecha no disponible'}
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
                  </div>

                </div>
                
                <div className="text-right space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-center mb-3">
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
                  
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(client)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(client)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
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

      {/* Diálogo de edición */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditSubmit}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el cliente "{selectedClient?.full_name}" del sistema.
              Todas sus órdenes y cotizaciones seguirán disponibles pero el usuario no podrá acceder al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}