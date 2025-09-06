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
  unread_messages_count?: number; // Nuevo campo para mensajes no leídos
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
            // Counting unread messages
            
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
              // Unread count updated
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
          // Realtime change recibido: recargar si aplica
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
    
    // Updating unread counts silently
    
    try {
      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
          // Processing order unread count
          
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
          // Unread count updated
          
          return {
            ...order,
            unread_messages_count: newCount
          };
        })
      );
      
      setOrders(updatedOrders);
      // Unread counts updated successfully
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
  }).sort((a, b) => {
    // Usar estimated_delivery_date si está disponible, sino delivery_date
    const dateA = new Date(a.estimated_delivery_date || a.delivery_date);
    const dateB = new Date(b.estimated_delivery_date || b.delivery_date);
    return dateA.getTime() - dateB.getTime();
  }); // Ordenar por fecha de entrega estimada

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

  // Función para obtener órdenes por fecha y categoría
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

  // Función para obtener fechas con órdenes para mostrar en el calendario
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
          dates.add(deliveryDate.split('T')[0]); // Solo la fecha, sin hora
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
      <div className="max-w-7xl mx-auto">{/* Volver al ancho original */}
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

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Vista Lista</TabsTrigger>
            <TabsTrigger value="calendar">Vista Calendario</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="space-y-6">
            {/* Filters */}
            <Card>
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
                        <SelectItem value="pendiente_actualizacion">Pendiente de Actualización</SelectItem>
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

            {/* Orders Split by Category */}
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" 
                      ? "No se encontraron órdenes con los filtros aplicados"
                      : "No hay órdenes registradas"}
                  </p>
                  {canCreateOrder && !searchTerm && statusFilter === "all" && (
                    <Button onClick={() => setShowForm(true)} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Primera Orden
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Sistemas Column */}
                <div className="space-y-2">
                  <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                      <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                        💻 SISTEMAS
                        <Badge variant="secondary" className="ml-auto">
                          {filteredOrders.filter(order => {
                            const serviceCategory = order.service_types?.service_category || "sistemas";
                            return serviceCategory === "sistemas";
                          }).length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(groupedOrders).map(([status, orders]) => {
                          const sistemasOrders = orders.filter(order => {
                            const serviceCategory = order.service_types?.service_category || "sistemas";
                            return serviceCategory === "sistemas";
                          });
                          
                          if (sistemasOrders.length === 0) return null;
                          
                          return (
                            <Card key={status}>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <Badge variant="outline" className={getStatusColor(status)}>
                                    {getStatusTitle(status)} ({sistemasOrders.length})
                                  </Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {sistemasOrders.map((order) => (
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
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Seguridad Column */}
                <div className="space-y-2">
                  <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CardHeader>
                      <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
                        🛡️ SEGURIDAD
                        <Badge variant="secondary" className="ml-auto">
                          {filteredOrders.filter(order => {
                            const serviceCategory = order.service_types?.service_category || "sistemas";
                            return serviceCategory === "seguridad";
                          }).length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(groupedOrders).map(([status, orders]) => {
                          const seguridadOrders = orders.filter(order => {
                            const serviceCategory = order.service_types?.service_category || "sistemas";
                            return serviceCategory === "seguridad";
                          });
                          
                          if (seguridadOrders.length === 0) return null;
                          
                          return (
                            <Card key={status}>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <Badge variant="outline" className={getStatusColor(status)}>
                                    {getStatusTitle(status)} ({seguridadOrders.length})
                                  </Badge>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {seguridadOrders.map((order) => (
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
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendario Sistemas */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    💻 Calendario Sistemas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDateSistemas}
                    onSelect={setSelectedDateSistemas}
                    locale={es}
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      hasOrders: getDatesWithOrders("sistemas")
                    }}
                    modifiersStyles={{
                      hasOrders: {
                        backgroundColor: "hsl(217, 91%, 85%)",
                        color: "hsl(217, 91%, 30%)",
                        fontWeight: "bold"
                      }
                    }}
                  />
                  
                  {selectedDateSistemas && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">
                        Órdenes para {format(selectedDateSistemas, "dd/MM/yyyy", { locale: es })}
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {getOrdersForDate(selectedDateSistemas, "sistemas").map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => setSelectedOrder(order)}
                            onDelete={canDeleteOrder ? setOrderToDelete : undefined}
                            canDelete={canDeleteOrder}
                            getStatusColor={getStatusColor}
                          />
                        ))}
                        {getOrdersForDate(selectedDateSistemas, "sistemas").length === 0 && (
                          <p className="text-xs text-muted-foreground">No hay órdenes de sistemas para este día</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Calendario Seguridad */}
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    🛡️ Calendario Seguridad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDateSeguridad}
                    onSelect={setSelectedDateSeguridad}
                    locale={es}
                    className="rounded-md border pointer-events-auto"
                    modifiers={{
                      hasOrders: getDatesWithOrders("seguridad")
                    }}
                    modifiersStyles={{
                      hasOrders: {
                        backgroundColor: "hsl(142, 76%, 85%)",
                        color: "hsl(142, 76%, 30%)",
                        fontWeight: "bold"
                      }
                    }}
                  />
                  
                  {selectedDateSeguridad && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">
                        Órdenes para {format(selectedDateSeguridad, "dd/MM/yyyy", { locale: es })}
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {getOrdersForDate(selectedDateSeguridad, "seguridad").map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => setSelectedOrder(order)}
                            onDelete={canDeleteOrder ? setOrderToDelete : undefined}
                            canDelete={canDeleteOrder}
                            getStatusColor={getStatusColor}
                          />
                        ))}
                        {getOrdersForDate(selectedDateSeguridad, "seguridad").length === 0 && (
                          <p className="text-xs text-muted-foreground">No hay órdenes de seguridad para este día</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
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