import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, Filter, User, Calendar as CalendarIcon, Eye, Trash2, AlertCircle, Clock, CheckCircle, X, ClipboardList, Zap, LogOut, Home, Shield, History, Grid3X3, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrderFormMinimal } from '@/components/orders/OrderFormMinimal';
import { OrderCard } from '@/components/orders/OrderCard';
import { SimpleOrderCard } from '@/components/orders/SimpleOrderCard';
import { OrderDetails } from '@/components/orders/OrderDetails';
import { OrderListItem } from '@/components/orders/OrderListItem';
import { getServiceCategoryInfo } from '@/utils/serviceCategoryUtils';
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
import { OrderHistoryPanel } from "@/components/orders/OrderHistoryPanel";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSoftDelete } from "@/hooks/useSoftDelete";

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
  status: 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
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
  order_items?: Array<{
    id: string;
    service_type_id: string;
    service_name: string;
    service_description?: string;
    quantity: number;
    unit_cost_price: number;
    unit_base_price: number;
    profit_margin_rate: number;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    item_type: string;
    status: string;
    service_types?: {
      name: string;
      description?: string;
      service_category?: string;
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
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const { canDeleteOrders } = useSoftDelete();

  const loadOrders = async () => {
    try {
      setLoading(true);
      console.log('Loading orders for user:', user?.id, 'profile role:', profile?.role, 'email:', profile?.email);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          service_types:service_type(name, description, service_category),
          clients:client_id(name, client_number, email, phone, address),
          order_items(
            *,
            service_types:service_type_id(name, description, service_category)
          )
        `)
        .is('deleted_at', null) // Exclude soft-deleted orders
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
      }
      // Técnicos pueden ver TODAS las órdenes, no solo las asignadas a ellos

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
    en_proceso: filteredOrders.filter(order => order.status === 'en_proceso'),
    pendiente_actualizacion: filteredOrders.filter(order => order.status === 'pendiente_actualizacion'),
    pendiente_entrega: filteredOrders.filter(order => order.status === 'pendiente_entrega'),
    finalizada: filteredOrders.filter(order => order.status === 'finalizada'),
    cancelada: filteredOrders.filter(order => order.status === 'cancelada'),
    rechazada: filteredOrders.filter(order => order.status === 'rechazada'),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'pendiente_actualizacion': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'pendiente': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'en_camino': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'en_proceso': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pendiente_entrega': return 'bg-green-100 text-green-800 border-green-300';
      case 'finalizada': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelada': return 'bg-red-100 text-red-800 border-red-300';
      case 'rechazada': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'Pendientes de Aprobación';
      case 'en_proceso': return 'En Proceso';
      case 'pendiente_actualizacion': return 'Pendientes de Actualización';
      case 'pendiente_entrega': return 'Pendientes de Entrega';
      case 'finalizada': return 'Finalizadas';
      case 'cancelada': return 'Canceladas';
      case 'rechazada': return 'Rechazadas';
      default: return status;
    }
  };

  const getOrdersForDate = (date: Date | undefined, category: 'sistemas' | 'seguridad') => {
    if (!date) return [];
    
    return filteredOrders.filter(order => {
      // Usar SOLO la categoría original del service_type principal
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
        // Usar SOLO la categoría original del service_type principal
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
      
      // Usar soft delete en lugar de eliminación permanente
      const { error } = await supabase
        .from('orders')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: profile?.user_id 
        })
        .eq('id', orderToDelete);

      if (error) throw error;

      toast({
        title: "Orden eliminada",
        description: "La orden ha sido marcada como eliminada y se puede restaurar desde el historial",
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

  const handleRestoreOrder = (orderId: string) => {
    loadOrders(); // Recargar órdenes después de la restauración
  };
  
  const handleOrderDeleted = () => {
    loadOrders(); // Recargar órdenes después de la eliminación
  };

  const canCreateOrder = profile?.role === 'administrador' || profile?.role === 'vendedor' || profile?.role === 'tecnico' || profile?.role === 'supervisor';
  const canCollectPayment = profile?.role === 'administrador' || profile?.role === 'vendedor';
  
  // Debug logging
  console.log('Orders page debug:', {
    profile: profile,
    userRole: profile?.role,
    canCollectPayment: canCollectPayment,
    finalizedOrders: filteredOrders.filter(o => o.status === 'finalizada').length
  });
  
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
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Dashboard</span>
                <span className="xs:hidden">{profile?.role === 'cliente' ? 'Atrás' : 'Panel'}</span>
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
            
            {/* View Toggle for Admin */}
            {profile?.role === 'administrador' && (
              <div className="flex rounded-lg border p-1 bg-muted/50">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="h-8 px-3"
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Tarjetas</span>
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Content Section */}
      <div className="space-y-4 sm:space-y-6">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8 sm:py-12 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/25 mx-2 sm:mx-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-medium mb-2">No hay órdenes</h3>
            <p className="text-sm sm:text-base text-muted-foreground px-4">
              Aún no hay órdenes registradas
            </p>
          </div>
        ) : (
          // Check if admin or tecnico wants list view
          (profile?.role === 'administrador' || profile?.role === 'tecnico') && viewMode === 'list' ? (
            // List view for administrators
            <div className="bg-background rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead># Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Fecha Entrega</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <OrderListItem
                      key={order.id}
                      order={order}
                      onClick={() => setSelectedOrder(order)}
                       onDelete={canDeleteOrders ? handleOrderDeleted : undefined}
                       canDelete={canDeleteOrders}
                      getStatusColor={getStatusColor}
                      showCollectButton={canCollectPayment}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Vista original por categorías para otros roles o vista de tarjetas
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Sistemas Column */}
            <div className="space-y-2">
              {(() => {
                const sistemasInfo = getServiceCategoryInfo('sistemas');
                return (
                  <Card className={sistemasInfo.colors.fullCard}>
                    <CardHeader>
                      <CardTitle className={`${sistemasInfo.colors.titleText} flex items-center gap-2`}>
                        {sistemasInfo.icon} {sistemasInfo.label}
                     <Badge variant="secondary" className="ml-auto">
                      {filteredOrders.filter(order => {
                        // Usar SOLO la categoría original del service_type principal
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
                        // Usar SOLO la categoría original del service_type principal
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
                                   onDelete={canDeleteOrders ? handleOrderDeleted : undefined}
                                   canDelete={canDeleteOrders}
                                  getStatusColor={getStatusColor}
                                  showCollectButton={canCollectPayment}
                                />
                             ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* Seguridad Column */}
            <div className="space-y-2">
              {(() => {
                const seguridadInfo = getServiceCategoryInfo('seguridad');
                return (
                  <Card className={seguridadInfo.colors.fullCard}>
                    <CardHeader>
                      <CardTitle className={`${seguridadInfo.colors.titleText} flex items-center gap-2`}>
                        {seguridadInfo.icon} {seguridadInfo.label}
                     <Badge variant="secondary" className="ml-auto">
                      {filteredOrders.filter(order => {
                        // Usar SOLO la categoría original del service_type principal
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
                        // Usar SOLO la categoría original del service_type principal
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
                                   onDelete={canDeleteOrders ? handleOrderDeleted : undefined}
                                   canDelete={canDeleteOrders}
                                   getStatusColor={getStatusColor}
                                   showCollectButton={canCollectPayment}
                                 />
                             ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
            </div>
          )
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden?</AlertDialogTitle>
            <AlertDialogDescription>
              La orden será marcada como eliminada y se podrá restaurar desde el historial de órdenes.
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