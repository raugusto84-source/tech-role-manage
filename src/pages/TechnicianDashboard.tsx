/**
 * PANEL DE TÉCNICO - DASHBOARD REFACTORIZADO
 * 
 * Características principales:
 * - Panel lateral con acceso al dashboard
 * - Órdenes organizadas por estado: Pendientes, En proceso, Terminadas
 * - Botón "Aceptar Orden" para cambiar de pendiente a en proceso
 * - Oculta órdenes terminadas cuando cliente da conformidad
 * - Permite crear nuevas órdenes para clientes
 * - Interfaz móvil-first optimizada
 * 
 * Componentes reutilizables:
 * - AppLayout: Layout con sidebar
 * - TechnicianOrderCard: Tarjeta con botón aceptar
 * - OrderForm: Formulario para crear órdenes
 * - OrderStatusUpdate: Componente de cambio de estado
 * - OrderNoteForm: Formulario para agregar comentarios
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { TechnicianOrderCard } from '@/components/orders/TechnicianOrderCard';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrderStatusUpdate } from '@/components/orders/OrderStatusUpdate';
import { OrderNoteForm } from '@/components/orders/OrderNoteForm';
import { Plus, RefreshCw, CheckCircle, ArrowLeft } from 'lucide-react';

// Interfaz para órdenes del técnico con nuevos campos
interface TechnicianOrder {
  id: string;
  order_number: string;
  client_id: string;
  service_type: string;
  failure_description: string;
  delivery_date: string;
  status: 'pendiente' | 'en_camino' | 'en_proceso' | 'finalizada' | 'cancelada';
  assigned_technician?: string;
  evidence_photos?: string[];
  client_approval?: boolean | null;
  client_approval_notes?: string | null;
  client_approved_at?: string | null;
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
}

export default function TechnicianDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<TechnicianOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<TechnicianOrder | null>(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [activeTab, setActiveTab] = useState('pendientes');

  /**
   * Carga órdenes asignadas al técnico logueado
   * Incluye órdenes terminadas que no han sido aprobadas por el cliente
   */
  const loadTechnicianOrders = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          service_types:service_type(name, description),
          clients:client_id(name, client_number, email, phone, address)
        `)
        .eq('assigned_technician', user.id)
        .or('client_approval.is.null,client_approval.eq.false') // Incluir órdenes sin conformidad o rechazadas
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (error) {
      console.error('Error loading technician orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes asignadas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Acepta una orden pendiente y la cambia a "en_proceso"
   */
  const handleAcceptOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'en_proceso',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Orden Aceptada",
        description: "La orden ha sido aceptada y está en proceso",
      });

      loadTechnicianOrders();
    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: "No se pudo aceptar la orden",
        variant: "destructive"
      });
    }
  };

  /**
   * Maneja selección de orden para ver detalles
   */
  const handleOrderSelect = (order: TechnicianOrder) => {
    setSelectedOrder(order);
  };

  /**
   * Regresa a la lista de órdenes
   */
  const handleBackToList = () => {
    setSelectedOrder(null);
    setShowStatusUpdate(false);
    setShowNoteForm(false);
  };

  /**
   * Actualiza la lista después de cambios
   */
  const handleOrderUpdate = () => {
    loadTechnicianOrders();
    setShowStatusUpdate(false);
    setShowNoteForm(false);
    setShowOrderForm(false);
  };

  /**
   * Filtra órdenes por estado
   */
  const getFilteredOrders = (status: string) => {
    switch (status) {
      case 'pendientes':
        return orders.filter(order => order.status === 'pendiente');
      case 'proceso':
        return orders.filter(order => order.status === 'en_proceso');
      case 'terminadas':
        return orders.filter(order => order.status === 'finalizada' && !order.client_approval);
      default:
        return orders;
    }
  };

  // Efectos
  useEffect(() => {
    if (profile?.role === 'tecnico') {
      loadTechnicianOrders();
    }
  }, [user?.id, profile?.role]);

  // Verificación de rol de técnico
  if (profile?.role !== 'tecnico') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md mx-auto text-center">
            <CardHeader>
              <CardTitle className="text-xl text-destructive">Acceso Restringido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Este panel es exclusivo para técnicos.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Vista de orden seleccionada
  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header de orden seleccionada */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-lg">{selectedOrder.order_number}</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.clients?.name}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(selectedOrder.status)}>
              {getStatusLabel(selectedOrder.status)}
            </Badge>
          </div>
        </div>

        {/* Contenido de la orden */}
        <div className="p-4 space-y-4">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Servicio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Servicio:</label>
                <p className="text-sm">{selectedOrder.service_types?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descripción:</label>
                <p className="text-sm">{selectedOrder.failure_description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dirección:</label>
                <p className="text-sm">{selectedOrder.clients?.address}</p>
              </div>
              {selectedOrder.clients?.phone && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Teléfono:</label>
                  <p className="text-sm">{selectedOrder.clients.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Acciones principales */}
          <div className="grid grid-cols-1 gap-3">
            <Button 
              onClick={() => setShowStatusUpdate(true)}
              className="w-full h-12"
              size="lg"
            >
              Cambiar Estado
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowNoteForm(true)}
              className="w-full h-12"
              size="lg"
            >
              Agregar Comentario
            </Button>
          </div>

          {/* Modales */}
          {showStatusUpdate && (
            <OrderStatusUpdate
              order={selectedOrder}
              onClose={() => setShowStatusUpdate(false)}
              onUpdate={handleOrderUpdate}
            />
          )}

          {showNoteForm && (
            <OrderNoteForm
              order={selectedOrder}
              onClose={() => setShowNoteForm(false)}
              onUpdate={handleOrderUpdate}
            />
          )}
        </div>
      </div>
    );
  }

  // Vista principal del dashboard con AppLayout
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel Técnico</h1>
            <p className="text-muted-foreground">
              {profile?.full_name || 'Técnico'} - Gestión de Órdenes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowOrderForm(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Orden
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTechnicianOrders}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {getFilteredOrders('pendientes').length}
                </div>
                <div className="ml-auto text-yellow-600">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Pendientes
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="text-2xl font-bold text-blue-600">
                  {getFilteredOrders('proceso').length}
                </div>
                <div className="ml-auto text-blue-600">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    En Proceso
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="text-2xl font-bold text-green-600">
                  {getFilteredOrders('terminadas').length}
                </div>
                <div className="ml-auto text-green-600">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Terminadas
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="text-2xl font-bold text-primary">
                  {orders.length}
                </div>
                <div className="ml-auto text-primary">
                  <Badge variant="outline">
                    Total
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de órdenes */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="proceso">En Proceso</TabsTrigger>
            <TabsTrigger value="terminadas">Terminadas</TabsTrigger>
          </TabsList>

          <TabsContent value="pendientes" className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : getFilteredOrders('pendientes').length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">
                    No hay órdenes pendientes en este momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {getFilteredOrders('pendientes').map((order) => (
                  <TechnicianOrderCard
                    key={order.id}
                    order={order}
                    onClick={() => handleOrderSelect(order)}
                    onAccept={() => handleAcceptOrder(order.id)}
                    showAcceptButton={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="proceso" className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : getFilteredOrders('proceso').length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">
                    No hay órdenes en proceso en este momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {getFilteredOrders('proceso').map((order) => (
                  <TechnicianOrderCard
                    key={order.id}
                    order={order}
                    onClick={() => handleOrderSelect(order)}
                    onAccept={undefined}
                    showAcceptButton={false}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="terminadas" className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : getFilteredOrders('terminadas').length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">
                    No hay órdenes terminadas pendientes de conformidad.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {getFilteredOrders('terminadas').map((order) => (
                  <TechnicianOrderCard
                    key={order.id}
                    order={order}
                    onClick={() => handleOrderSelect(order)}
                    onAccept={undefined}
                    showAcceptButton={false}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modales */}
        {showOrderForm && (
          <OrderForm
            onSuccess={handleOrderUpdate}
            onCancel={() => setShowOrderForm(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}

/**
 * Utilidades para estados - REUTILIZABLE
 */
function getStatusColor(status: string) {
  switch (status) {
    case 'pendiente': return 'bg-yellow-100 text-yellow-800';
    case 'en_camino': return 'bg-blue-100 text-blue-800';
    case 'en_proceso': return 'bg-orange-100 text-orange-800';
    case 'finalizada': return 'bg-green-100 text-green-800';
    case 'cancelada': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pendiente': return 'Pendiente';
    case 'en_camino': return 'En Camino';
    case 'en_proceso': return 'En Proceso';
    case 'finalizada': return 'Terminado';
    case 'cancelada': return 'Cancelada';
    default: return status;
  }
}