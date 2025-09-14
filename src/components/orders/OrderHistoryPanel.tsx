import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Plus, 
  Shield, 
  CheckCircle, 
  PenTool, 
  Trash2, 
  RotateCcw,
  AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OrderHistoryEvent {
  id: string;
  order_id: string;
  order_number: string;
  event_type: string;
  event_description: string;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
  metadata: any;
}

interface OrderHistoryPanelProps {
  orderId?: string;
  onRestoreOrder?: (orderId: string) => void;
}

export function OrderHistoryPanel({ orderId, onRestoreOrder }: OrderHistoryPanelProps) {
  const [events, setEvents] = useState<OrderHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [orderId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('order_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading order history:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de órdenes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isOrderRestored = (orderIdToCheck: string) => {
    // Buscar el último evento de eliminación y el último evento de restauración
    const deleteEvents = events.filter(event => 
      event.order_id === orderIdToCheck && event.event_type === 'deleted'
    );
    const restoreEvents = events.filter(event => 
      event.order_id === orderIdToCheck && event.event_type === 'restored'
    );
    
    if (deleteEvents.length === 0) return false;
    if (restoreEvents.length === 0) return false;
    
    // Obtener el evento más reciente de cada tipo
    const lastDeleteEvent = deleteEvents.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const lastRestoreEvent = restoreEvents.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    // La orden está restaurada si el último evento de restauración es más reciente que el último de eliminación
    return new Date(lastRestoreEvent.created_at) > new Date(lastDeleteEvent.created_at);
  };

  const isLatestDeleteEvent = (event: OrderHistoryEvent) => {
    if (event.event_type !== 'deleted') return false;
    
    // Buscar todos los eventos de eliminación para esta orden
    const deleteEvents = events.filter(e => 
      e.order_id === event.order_id && e.event_type === 'deleted'
    );
    
    // Verificar si este es el evento de eliminación más reciente
    const latestDeleteEvent = deleteEvents.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    return event.id === latestDeleteEvent.id;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'authorized':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'signed':
        return <PenTool className="h-4 w-4 text-purple-600" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'restored':
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'authorized':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'signed':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'restored':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return 'Creada';
      case 'authorized':
        return 'Autorizada';
      case 'completed':
        return 'Completada';
      case 'signed':
        return 'Firmada';
      case 'deleted':
        return 'Eliminada';
      case 'restored':
        return 'Restaurada';
      case 'status_changed':
        return 'Estado Cambiado';
      default:
        return eventType;
    }
  };

  const handleRestoreOrder = async (orderNumber: string, orderIdToRestore: string) => {
    if (!onRestoreOrder) return;

    try {
      // Actualizar la orden para remover el soft delete
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          deleted_at: null,
          deleted_by: null 
        })
        .eq('id', orderIdToRestore);

      if (updateError) throw updateError;

      // Crear evento de restauración en el historial
      const { error: historyError } = await supabase
        .from('order_history')
        .insert({
          order_id: orderIdToRestore,
          order_number: orderNumber,
          event_type: 'restored',
          event_description: `Orden ${orderNumber} restaurada exitosamente`,
          performed_by: (await supabase.auth.getUser()).data.user?.id,
          performed_by_name: (await supabase.from('profiles').select('full_name').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single()).data?.full_name
        });

      if (historyError) {
        console.error('Error creating history event:', historyError);
        // No lanzar error, la restauración ya fue exitosa
      }

      toast({
        title: "Orden restaurada",
        description: `La orden ${orderNumber} ha sido restaurada exitosamente`,
      });

      onRestoreOrder(orderIdToRestore);
      loadHistory(); // Recargar historial
    } catch (error) {
      console.error('Error restoring order:', error);
      toast({
        title: "Error",
        description: "No se pudo restaurar la orden",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Órdenes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando historial...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Órdenes
          <Badge variant="secondary">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No hay eventos registrados
          </p>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={getEventColor(event.event_type)}
                        >
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                        <span className="text-sm font-medium text-primary">
                          {event.order_number}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {event.event_description}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          por {event.performed_by_name || 'Sistema'}
                        </p>
                        {event.event_type === 'deleted' && 
                         isLatestDeleteEvent(event) &&
                         !isOrderRestored(event.order_id) && 
                         onRestoreOrder && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreOrder(event.order_number, event.order_id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {index < events.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}