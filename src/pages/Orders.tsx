import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter, User, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrderFormMinimal } from '@/components/orders/OrderFormMinimal';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderDetails } from '@/components/orders/OrderDetails';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
  status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'en_camino' | 'pendiente_aprobacion' | 'pendiente_entrega' | 'pendiente_actualizacion';
  assigned_technician?: string;
  assignment_reason?: string;
  evidence_photos?: string[];
  created_at: string;
  unread_messages_count?: number;
  estimated_delivery_date?: string | null;
  service_types?: {
    name: string;
    description?: string;
    service_category?: string;
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
  const [selectedDateSistemas, setSelectedDateSistemas] = useState<Date | undefined>();
  const [selectedDateSeguridad, setSelectedDateSeguridad] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('list');
  const [showMinimalForm, setShowMinimalForm] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select(`
          *,
          service_types:service_type(name, description, service_category),
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
            const { count, error } = await supabase
              .from('order_chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('order_id', order.id)
              .neq('sender_id', user.id)
              .is('read_at', null);
              
            if (error) {
              console.error('Error counting unread messages:', error);
              unreadCount = 0;
            } else {
              unreadCount = count || 0;
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
    
    // Real-time subscriptions
    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public', 
          table: 'orders'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || 
              (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status)) {
            loadOrders();
          }
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel('chat-messages-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_chat_messages'
        },
        (payload) => {
          setTimeout(() => {
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

  const updateUnreadCounts = async () => {
    if (!user?.id || orders.length === 0) return;
    
    try {
      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
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
          
          return {
            ...order,
            unread_messages_count: newCount
          };
        })
      );
      
      setOrders(updatedOrders);
    } catch (error) {
      console.error('Error updating unread counts:', error);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      const allowed = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
      if (allowed) setShowForm(true);
    }
  }, []);

  const filteredOrders = orders.filter(order => {
    const clientName = order.clients?.name || '';
    const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.failure_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const dateA = new Date(a.estimated_delivery_date || a.delivery_date);
    const dateB = new Date(b.estimated_delivery_date || b.delivery_date);
    return dateA.getTime() - dateB.getTime();
  });

  // Group orders by status
  const groupedOrders = {
    pendiente_aprobacion: filteredOrders.filter(order => order.status === 'pendiente_aprobacion'),
    pendiente_actualizacion: filteredOrders.filter(order => order.status === 'pendiente_actualizacion'),
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
      case 'pendiente_actualizacion': return 'bg-warning/10 text-warning border-warning/20';
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
      case 'pendiente_actualizacion': return 'Pendientes de Actualización';
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

  const getOrdersForDate = (date: Date | undefined, category: 'sistemas' | 'seguridad') => {
    if (!date) return [];
    
    return filteredOrders.filter(order => {
      const serviceCategory = order.service_types?.service_category || 'sistemas';
      const deliveryDate = order.estimated_delivery_date || order.delivery_date;
      
      return serviceCategory === category && 
             deliveryDate && 
             isSameDay(parseISO(deliveryDate), date);
    });
  };

  const getDatesWithOrders = (category: 'sistemas' | 'seguridad') => {
    const dates = new Set<string>();
    
    filteredOrders
      .filter(order => {
        const serviceCategory = order.service_types?.service_category || 'sistemas';
        return serviceCategory === category;
      })
      .forEach(order => {
        const deliveryDate = order.estimated_delivery_date || order.delivery_date;
        if (deliveryDate) {
          dates.add(deliveryDate.split('T')[0]);
        }
      });
    
    return Array.from(dates).map(date => parseISO(date));
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
        onUpdate={loadOrders}
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
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto pb-20">
          {/* Header móvil */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-foreground truncate">Órdenes</h1>
                <p className="text-sm text-muted-foreground">
                  {profile?.role === 'cliente' ? 'Mis órdenes' : 
                   profile?.role === 'tecnico' ? 'Asignadas' : 'Todas'}
                </p>
              </div>
              
              {canCreateOrder && (
                <div className="flex gap-2">
                  <Dialog open={showMinimalForm} onOpenChange={setShowMinimalForm}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-md">
                      <OrderFormMinimal
                        onSuccess={() => {
                          setShowMinimalForm(false);
                          loadOrders();
                        }}
                        onCancel={() => setShowMinimalForm(false)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <Button onClick={() => setShowForm(true)} variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Filtros móviles */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar órdenes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente_aprobacion">Pendientes</SelectItem>
                  <SelectItem value="pendiente_actualizacion">Actualización</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="en_camino">En Camino</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="pendiente_entrega">Para Entregar</SelectItem>
                  <SelectItem value="finalizada">Finalizadas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pestañas móviles */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 mx-4">
              <TabsTrigger value="list" className="text-xs">Lista</TabsTrigger>
              <TabsTrigger value="calendar-sistemas" className="text-xs">Cal. Sis.</TabsTrigger>
              <TabsTrigger value="calendar-seguridad" className="text-xs">Cal. Seg.</TabsTrigger>
            </TabsList>

            <div className="px-4">
              <TabsContent value="list" className="space-y-4 mt-0">
                {Object.entries(groupedOrders)
                  .filter(([_, orders]) => orders.length > 0)
                  .map(([status, orders]) => (
                    <div key={status} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-semibold text-foreground">
                          {getStatusTitle(status)}
                        </h2>
                        <Badge variant="secondary" className="text-xs">
                          {orders.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
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
                      </div>
                    </div>
                  ))}
                
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground mb-4">
                      <User className="h-12 w-12 mx-auto opacity-50" />
                    </div>
                    <h3 className="text-base font-medium text-foreground mb-2">No hay órdenes</h3>
                    <p className="text-sm text-muted-foreground mb-4 px-6">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'No se encontraron órdenes con los filtros aplicados.'
                        : 'Aún no tienes órdenes de servicio.'}
                    </p>
                    {canCreateOrder && (
                      <Button onClick={() => setShowForm(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Crear primera orden
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="calendar-sistemas" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <h3 className="text-base font-semibold px-1">Sistemas</h3>
                  <div className="border rounded-lg">
                    <Calendar
                      mode="single"
                      selected={selectedDateSistemas}
                      onSelect={setSelectedDateSistemas}
                      modifiers={{
                        hasOrders: getDatesWithOrders('sistemas')
                      }}
                      modifiersClassNames={{
                        hasOrders: 'bg-primary text-primary-foreground'
                      }}
                      className="rounded-md border-0 w-full"
                    />
                  </div>
                  
                  {selectedDateSistemas && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium px-1">
                        {formatDate(selectedDateSistemas.toISOString())}
                      </h4>
                      <div className="space-y-2">
                        {getOrdersForDate(selectedDateSistemas, 'sistemas').map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => setSelectedOrder(order)}
                            onDelete={canDeleteOrder ? setOrderToDelete : undefined}
                            canDelete={canDeleteOrder}
                            getStatusColor={getStatusColor}
                          />
                        ))}
                        {getOrdersForDate(selectedDateSistemas, 'sistemas').length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No hay órdenes para esta fecha.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="calendar-seguridad" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <h3 className="text-base font-semibold px-1">Seguridad</h3>
                  <div className="border rounded-lg">
                    <Calendar
                      mode="single"
                      selected={selectedDateSeguridad}
                      onSelect={setSelectedDateSeguridad}
                      modifiers={{
                        hasOrders: getDatesWithOrders('seguridad')
                      }}
                      modifiersClassNames={{
                        hasOrders: 'bg-primary text-primary-foreground'
                      }}
                      className="rounded-md border-0 w-full"
                    />
                  </div>
                  
                  {selectedDateSeguridad && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium px-1">
                        {formatDate(selectedDateSeguridad.toISOString())}
                      </h4>
                      <div className="space-y-2">
                        {getOrdersForDate(selectedDateSeguridad, 'seguridad').map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => setSelectedOrder(order)}
                            onDelete={canDeleteOrder ? setOrderToDelete : undefined}
                            canDelete={canDeleteOrder}
                            getStatusColor={getStatusColor}
                          />
                        ))}
                        {getOrdersForDate(selectedDateSeguridad, 'seguridad').length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No hay órdenes para esta fecha.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Dialog de confirmación para eliminar */}
          <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
            <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  Esta acción no se puede deshacer. Se eliminará permanentemente la orden
                  y todos los datos relacionados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteOrder} className="w-full sm:w-auto">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppLayout>
  );
}