import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, Filter, User, Calendar as CalendarIcon, Eye, Trash2, AlertCircle, Clock, CheckCircle, X, ClipboardList, Zap, LogOut, Home, Shield } from 'lucide-react';
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

/**
 * Página principal del módulo de órdenes
 * Permite crear, visualizar, editar y gestionar órdenes de servicio
 * Interfaz completa para todos los usuarios incluyendo clientes
 */

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
  const { user, profile, signOut } = useAuth();
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
      console.log('Loading orders for user:', user?.id, 'profile role:', profile?.role, 'email:', profile?.email);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          service_types:service_type(name, description, service_category),
          clients:client_id(name, client_number, email, phone, address)
        `)
        .order('created_at', { ascending: false });

      // Filter by role
      if (profile?.role === 'cliente') {
        // First try to find client by user_id
        let { data: client, error } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user?.id)
          .single();
        
        console.log('Client found by user_id:', client, 'error:', error);
        
        // If not found by user_id, try by email
        if (!client && profile?.email) {
          const { data: clientByEmail, error: emailError } = await supabase
            .from('clients')
            .select('id')
            .eq('email', profile.email)
            .single();
          
          console.log('Client found by email:', clientByEmail, 'error:', emailError);
          client = clientByEmail;
        }
        
        if (client) {
          console.log('Loading orders for client_id:', client.id);
          query = query.eq('client_id', client.id);
        } else {
          console.log('No client found for user:', user?.id, 'email:', profile?.email);
          setOrders([]);
          setLoading(false);
          return;
        }
      } else if (profile?.role === 'tecnico') {
        query = query.eq('assigned_technician', user?.id);
      }

      const { data, error } = await query;
      
      console.log('Orders query result:', { data, error, count: data?.length });
      console.log('Raw orders data:', data);

      if (error) {
        console.error('Error loading orders:', error);
        toast({
          title: "Error",
          description: `Error al cargar órdenes: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      const ordersWithTechnician = await Promise.all(
        (data || []).map(async (order: any) => {
          let technicianProfile = null;
          if (order.assigned_technician) {
            const { data: techProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', order.assigned_technician)
              .single();
            technicianProfile = techProfile;
          }

          const { data: supportTechnicians } = await supabase
            .from('order_support_technicians')
            .select(`
              technician_id,
              reduction_percentage,
              profiles:technician_id(full_name)
            `)
            .eq('order_id', order.id);

          return {
            ...order,
            technician_profile: technicianProfile,
            support_technicians: supportTechnicians || []
          };
        })
      );
      
      console.log('Orders after processing:', ordersWithTechnician);
      console.log('Orders filtered:', ordersWithTechnician.filter(o => o.order_number === '0001' || o.order_number === '0002'));
      setOrders(ordersWithTechnician);
    } catch (error) {
      console.error('Unexpected error loading orders:', error);
      toast({
        title: "Error inesperado",
        description: "No se pudieron cargar las órdenes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      loadOrders();
    }
  }, [profile]);

  // Suscripción en tiempo real para actualizar órdenes automáticamente
  useEffect(() => {
    if (!profile) return;

    const ordersChannel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        console.log('Order realtime update:', payload);
        // Recargar órdenes cuando hay cambios
        loadOrders();
      })
      .subscribe();

    // También escuchar cambios en order_items por si cambian estados
    const orderItemsChannel = supabase
      .channel('order-items-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items'
      }, (payload) => {
        console.log('Order items realtime update:', payload);
        // Recargar órdenes cuando hay cambios en items
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderItemsChannel);
    };
  }, [profile]);

  // Auto-open form if coming from client dashboard (skip nueva solicitud)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      const allowed = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
      if (allowed) setShowMinimalForm(true); // Use minimal form for direct creation
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
          dates.add(parseISO(deliveryDate).toDateString());
        }
      });
    
    return Array.from(dates).map(dateStr => new Date(dateStr));
  };

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

  const canCreateOrder = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'cliente';
  const canDeleteOrder = profile?.role === 'administrador';
  
  // Función para obtener la ruta del dashboard según el rol
  const getDashboardRoute = () => {
    if (!profile) return '/dashboard';
    
    const roleDashboards = {
      'cliente': '/client',
      'tecnico': '/technician',
      'vendedor': '/dashboard',
      'supervisor': '/dashboard',
      'administrador': '/dashboard',
      'visor_tecnico': '/technician-viewer'
    };
    
    return roleDashboards[profile.role] || '/dashboard';
  };

  // Función para manejar el logout
  const handleLogout = async () => {
    await signOut();
    window.location.href = '/auth';
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

  // Order details view
  if (selectedOrder) {
    return (
      <AppLayout>
        <OrderDetails
          order={selectedOrder}
          onBack={() => setSelectedOrder(null)}
          onUpdate={loadOrders}
        />
      </AppLayout>
    );
  }

  // Full order form
  if (showForm) {
    return (
      <AppLayout>
        <OrderForm
          onSuccess={() => {
            setShowForm(false);
            loadOrders();
          }}
          onCancel={() => setShowForm(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile First */}
        <div className="mb-4 sm:mb-6">
          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Órdenes de Servicio</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {profile?.role === 'cliente' ? 'Mis órdenes' : 
               profile?.role === 'tecnico' ? 'Órdenes asignadas' : 'Todas las órdenes'}
            </p>
          </div>
          
          {/* Mobile-first action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex gap-2 flex-1">
              {/* Botón volver al dashboard */}
              <Button 
                variant="outline" 
                onClick={() => window.location.href = getDashboardRoute()}
                className="gap-1 sm:gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                size="sm"
              >
                <Home className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Dashboard</span>
                <span className="xs:hidden">Panel</span>
              </Button>
              
              {/* Botón cerrar sesión */}
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="gap-1 sm:gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground text-xs sm:text-sm"
                size="sm"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Cerrar Sesión</span>
                <span className="xs:hidden">Salir</span>
              </Button>
            </div>
            
            {canCreateOrder && (
              <Button 
                variant="default" 
                onClick={() => setShowForm(true)}
                className="text-xs sm:text-sm"
                size="sm"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Nueva Orden
              </Button>
            )}
          </div>
        </div>

        {/* Mobile-first Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="list" className="text-xs sm:text-sm">
              <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs sm:text-sm">
              <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Calendario
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="space-y-6">
            {/* Mobile-first Filters */}
            <Card className="mb-4">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por cliente, número..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 sm:pl-10 text-sm h-8 sm:h-10"
                      />
                    </div>
                  </div>
                  
                  <div className="w-full sm:w-48">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 sm:h-10 text-sm">
                        <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pendiente_aprobacion">Pendiente Aprobación</SelectItem>
                        <SelectItem value="pendiente_actualizacion">Actualización</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="en_camino">En Camino</SelectItem>
                        <SelectItem value="en_proceso">En Proceso</SelectItem>
                        <SelectItem value="pendiente_entrega">Pendiente Entrega</SelectItem>
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
                            <div key={status} className="bg-white/60 dark:bg-slate-900/60 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium">{getStatusTitle(status)}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {sistemasOrders.length}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {sistemasOrders.map((order) => (
                                  <OrderCard
                                    key={order.id}
                                    order={order}
                                    onClick={() => setSelectedOrder(order)}
                                    onDelete={canDeleteOrder ? () => setOrderToDelete(order.id) : undefined}
                                    getStatusColor={getStatusColor}
                                  />
                                ))}
                              </div>
                            </div>
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
                            <div key={status} className="bg-white/60 dark:bg-slate-900/60 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium">{getStatusTitle(status)}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {seguridadOrders.length}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {seguridadOrders.map((order) => (
                                  <OrderCard
                                    key={order.id}
                                    order={order}
                                    onClick={() => setSelectedOrder(order)}
                                    onDelete={canDeleteOrder ? () => setOrderToDelete(order.id) : undefined}
                                    getStatusColor={getStatusColor}
                                  />
                                ))}
                              </div>
                            </div>
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
            <div className="grid lg:grid-cols-2 gap-6">
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
                            onDelete={canDeleteOrder ? () => setOrderToDelete(order.id) : undefined}
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
                            onDelete={canDeleteOrder ? () => setOrderToDelete(order.id) : undefined}
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