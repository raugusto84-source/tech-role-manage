/**
 * PANEL DE TÉCNICO - DASHBOARD ESPECIALIZADO
 * 
 * Características principales:
 * - Solo visualiza órdenes asignadas al técnico logueado
 * - Interfaz móvil-first optimizada para uso en campo
 * - Cambios de estado simplificados (En camino, En proceso, Terminado)
 * - Sistema de notas y fotos con timestamps automáticos
 * - Sin menús complejos - interfaz directa y funcional
 * 
 * Componentes reutilizables:
 * - TechnicianOrderCard: Tarjeta optimizada para técnicos
 * - OrderStatusUpdate: Componente de cambio de estado
 * - OrderNoteForm: Formulario para agregar comentarios
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TechnicianOrderCard } from '@/components/orders/TechnicianOrderCard';
import { OrderStatusUpdate } from '@/components/orders/OrderStatusUpdate';
import { OrderNoteForm } from '@/components/orders/OrderNoteForm';
import { ArrowLeft, RefreshCw } from 'lucide-react';

// Interfaz para órdenes del técnico
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

  /**
   * Carga órdenes asignadas al técnico logueado
   * Filtro automático por assigned_technician = user.id
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
        .in('status', ['pendiente', 'en_camino', 'en_proceso']) // Solo órdenes activas
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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

  // Vista principal del dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header del dashboard */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel Técnico</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.full_name || 'Técnico'}
            </p>
          </div>
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

      {/* Estadísticas rápidas */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-primary">
                {orders.filter(o => o.status === 'pendiente').length}
              </div>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-blue-600">
                {orders.filter(o => o.status === 'en_camino').length}
              </div>
              <p className="text-xs text-muted-foreground">En Camino</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-orange-600">
                {orders.filter(o => o.status === 'en_proceso').length}
              </div>
              <p className="text-xs text-muted-foreground">En Proceso</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de órdenes */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">
                No tienes órdenes asignadas en este momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <TechnicianOrderCard
                key={order.id}
                order={order}
                onClick={() => handleOrderSelect(order)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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