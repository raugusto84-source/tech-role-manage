import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderDetails } from '@/components/orders/OrderDetails';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Order {
  id: string;
  order_number: string;
  client_id: string;
  service_type: string;
  failure_description: string;
  requested_date?: string;
  delivery_date: string;
  estimated_cost?: number;
  average_service_time?: number;
  status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'en_camino' | 'pendiente_aprobacion' | 'pendiente_entrega';
  assigned_technician?: string;
  assignment_reason?: string;
  evidence_photos?: string[];
  created_at: string;
  unread_messages_count?: number; // Nuevo campo para mensajes no leídos
  service_types?: {
    name: string;
    description?: string;
  } | null;
  clients?: {
    name: string;
    client_number: string;
    email: string;
    phone?: string;
    address: string;
  } | null;
  technician_profile?: {
    full_name: string;
  } | null;
  support_technicians?: Array<{
    technician_id: string;
    reduction_percentage: number;
    profiles: {
      full_name: string;
    } | null;
  }>;
}

export default function Orders() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select(`
          *,
          service_types:service_type(name, description),
          clients:client_id(name, client_number, email, phone, address)
        `)
        .order('created_at', { ascending: false });

      // Filtros según el rol del usuario
      if (profile?.role === 'cliente') {
        // Filter by client through the clients table relation
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', profile.email)
          .single();
        
        if (clientData) {
          query = query.eq('client_id', clientData.id);
        }
      } else if (profile?.role === 'tecnico') {
        query = query.eq('assigned_technician', user?.id);
      }

      const { data: ordersData, error } = await query;

      if (error) throw error;

      // Get technician profiles, support technicians and unread messages count for each order
      const ordersWithExtendedInfo = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          let techProfile = null;
          let supportTechnicians = [];
          let unreadCount = 0;

          // Get technician profile if assigned
          if (order.assigned_technician) {
            const { data: techProfileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', order.assigned_technician)
              .maybeSingle();
            techProfile = techProfileData;
          }

          // Get support technicians for this order
          const { data: supportTechData } = await supabase
            .from('order_support_technicians')
            .select(`
              technician_id,
              reduction_percentage,
              profiles!order_support_technicians_technician_id_fkey(full_name)
            `)
            .eq('order_id', order.id);
          
          if (supportTechData) {
            supportTechnicians = supportTechData;
          }

          // Count unread messages for current user
          if (user?.id) {
            console.log(`Counting unread messages for order ${order.order_number} and user ${user.id}`);
            
            const { count, error } = await supabase
              .from('order_chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('order_id', order.id)
              .neq('sender_id', user.id) // Messages not sent by current user
              .is('read_at', null); // Messages not yet read
              
            if (error) {
              console.error('Error counting unread messages:', error);
              unreadCount = 0;
            } else {
              unreadCount = count || 0;
              console.log(`Order ${order.order_number}: ${unreadCount} unread messages`);
            }
          }
          
          return {
            ...order,
            technician_profile: techProfile,
            support_technicians: supportTechnicians,
            unread_messages_count: unreadCount
          } as Order;
        })
      );

      setOrders(ordersWithExtendedInfo);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    // Suscribirse a cambios en tiempo real en todas las órdenes
    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { 
          event: '*', // Escuchar INSERT, UPDATE, DELETE
          schema: 'public', 
          table: 'orders'
        },
        (payload) => {
          console.log('Orders table changed:', payload);
          // Solo recargar órdenes cuando haya cambios importantes
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || 
              (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status)) {
            loadOrders();
          }
        }
      )
      .subscribe();

    // Suscripción más específica para mensajes de chat - solo actualizar contadores
    const chatChannel = supabase
      .channel('chat-messages-changes')
      .on('postgres_changes',
        {
          event: '*', // Escuchar INSERT, UPDATE
          schema: 'public',
          table: 'order_chat_messages'
        },
        (payload) => {
          console.log('Chat messages changed:', payload);
          // Esperar un momento para que la base de datos se actualice completamente
          setTimeout(() => {
            console.log('Triggering unread count update after chat change');
            updateUnreadCounts();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [profile?.role, profile?.email, user?.id]);

  // Función para actualizar solo los contadores de mensajes no leídos
  const updateUnreadCounts = async () => {
    if (!user?.id || orders.length === 0) return;
    
    console.log('Updating unread counts for', orders.length, 'orders');
    
    try {
      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
          console.log(`Updating unread count for order ${order.order_number}`);
          
          const { count, error } = await supabase
            .from('order_chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id)
            .neq('sender_id', user.id)
            .is('read_at', null);
            
          if (error) {
            console.error('Error counting unread messages for order', order.id, error);
            return order;
          }
          
          const newCount = count || 0;
          console.log(`Order ${order.order_number}: unread count ${order.unread_messages_count} -> ${newCount}`);
          
          return {
            ...order,
            unread_messages_count: newCount
          };
        })
      );
      
      setOrders(updatedOrders);
      console.log('Unread counts updated successfully');
    } catch (error) {
      console.error('Error updating unread counts:', error);
    }
  };

  // Abrir formulario automáticamente si viene con ?new=1 (flujo rápido desde Panel Cliente)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      const allowed = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
      if (allowed) setShowForm(true);
    }
    // Solo en montaje
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrders = orders.filter(order => {
    const clientName = order.clients?.name || '';
    const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.failure_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime()); // Ordenar por fecha de entrega

  // Función para calcular tiempo restante
  const getTimeRemaining = (deliveryDate: string) => {
    const now = new Date();
    const delivery = new Date(deliveryDate);
    const diffMs = delivery.getTime() - now.getTime();
    
    if (diffMs < 0) return 'Vencido';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else {
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${diffMinutes}m`;
    }
  };

  // Group orders by status
  const groupedOrders = {
    pendiente_aprobacion: filteredOrders.filter(order => order.status === 'pendiente_aprobacion'),
    pendiente: filteredOrders.filter(order => order.status === 'pendiente'),
    en_camino: filteredOrders.filter(order => order.status === 'en_camino'),
    en_proceso: filteredOrders.filter(order => order.status === 'en_proceso'),
    pendiente_entrega: filteredOrders.filter(order => order.status === 'pendiente_entrega'),
    finalizada: filteredOrders.filter(order => order.status === 'finalizada'),
    cancelada: filteredOrders.filter(order => order.status === 'cancelada'),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'bg-warning/10 text-warning border-warning/20';
      case 'pendiente': return 'bg-info/10 text-info border-info/20';
      case 'en_camino': return 'bg-info/10 text-info border-info/20';
      case 'en_proceso': return 'bg-info/10 text-info border-info/20';
      case 'pendiente_entrega': return 'bg-orange/10 text-orange border-orange/20';
      case 'finalizada': return 'bg-success/10 text-success border-success/20';
      case 'cancelada': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-border';
    }
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'Pendientes de Aprobación';
      case 'pendiente': return 'Pendientes';
      case 'en_camino': return 'En Camino';
      case 'en_proceso': return 'En Proceso';
      case 'pendiente_entrega': return 'Pendientes de Entrega';
      case 'finalizada': return 'Finalizadas';
      case 'cancelada': return 'Canceladas';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const canCreateOrder = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
  const canDeleteOrder = profile?.role === 'administrador';

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete);

      if (error) throw error;

      toast({
        title: "Orden eliminada",
        description: "La orden se ha eliminado correctamente",
      });

      setOrderToDelete(null);
      loadOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la orden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <OrderDetails
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        onUpdate={updateUnreadCounts}
      />
    );
  }

  if (showForm) {
    return (
      <OrderForm
        onSuccess={() => {
          setShowForm(false);
          loadOrders();
        }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Órdenes de Servicio</h1>
            <p className="text-muted-foreground mt-1">
              {profile?.role === 'cliente' ? 'Mis órdenes' : 
               profile?.role === 'tecnico' ? 'Órdenes asignadas' : 'Todas las órdenes'}
            </p>
          </div>
          
          {canCreateOrder && (
            <Button onClick={() => setShowForm(true)} className="mt-4 md:mt-0">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Orden
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, número de orden o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pendiente_aprobacion">Pendiente de Aprobación</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_camino">En Camino</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="pendiente_entrega">Pendiente de Entrega</SelectItem>
                    <SelectItem value="finalizada">Finalizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Grouped by Status */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No se encontraron órdenes con los filtros aplicados'
                  : 'No hay órdenes registradas'}
              </p>
              {canCreateOrder && !searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setShowForm(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Orden
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([status, orders]) => 
              orders.length > 0 && (
                <Card key={status}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Badge variant="outline" className={getStatusColor(status)}>
                        {getStatusTitle(status)} ({orders.length})
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onClick={() => setSelectedOrder(order)}
                        onDelete={canDeleteOrder ? setOrderToDelete : undefined}
                        canDelete={canDeleteOrder}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La orden será eliminada permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}