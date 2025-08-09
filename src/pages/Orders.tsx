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
  status: 'pendiente' | 'en_proceso' | 'finalizada' | 'cancelada' | 'en_camino';
  assigned_technician?: string;
  assignment_reason?: string;
  evidence_photos?: string[];
  created_at: string;
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

      // Get technician profiles separately for assigned orders
      const ordersWithTechnicianNames = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          if (order.assigned_technician) {
            const { data: techProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', order.assigned_technician)
              .maybeSingle();
            
            return {
              ...order,
              technician_profile: techProfile
            } as Order;
          }
          return {
            ...order,
            technician_profile: null
          } as Order;
        })
      );

      setOrders(ordersWithTechnicianNames);
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
  }, [profile?.role, profile?.email, user?.id]);

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
  });

  // Group orders by status
  const groupedOrders = {
    pendiente: filteredOrders.filter(order => order.status === 'pendiente'),
    en_camino: filteredOrders.filter(order => order.status === 'en_camino'),
    en_proceso: filteredOrders.filter(order => order.status === 'en_proceso'),
    finalizada: filteredOrders.filter(order => order.status === 'finalizada'),
    cancelada: filteredOrders.filter(order => order.status === 'cancelada'),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente': return 'bg-warning/10 text-warning border-warning/20';
      case 'en_camino': return 'bg-info/10 text-info border-info/20';
      case 'en_proceso': return 'bg-info/10 text-info border-info/20';
      case 'finalizada': return 'bg-success/10 text-success border-success/20';
      case 'cancelada': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-border';
    }
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case 'pendiente': return 'Pendientes';
      case 'en_camino': return 'En Camino';
      case 'en_proceso': return 'En Proceso';
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
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_camino">En Camino</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
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
                      <div 
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{order.order_number}</span>
                              <span className="text-muted-foreground text-xs">•</span>
                              <span className="text-sm text-muted-foreground">{order.clients?.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {order.service_types?.name} - {formatDate(order.delivery_date)}
                            </div>
                            {order.technician_profile && (
                              <div className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-2 py-1 rounded-md w-fit">
                                <User className="h-3 w-3" />
                                <span className="font-medium">
                                  Técnico: {order.technician_profile.full_name}
                                </span>
                              </div>
                            )}
                            {order.assignment_reason && (
                              <div className="text-xs text-muted-foreground italic bg-muted/50 px-2 py-1 rounded">
                                {order.assignment_reason}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {order.failure_description}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {order.estimated_cost && (
                              <span className="text-sm font-medium">
                                ${order.estimated_cost.toLocaleString()}
                              </span>
                            )}
                            {canDeleteOrder && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOrderToDelete(order.id);
                                }}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
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