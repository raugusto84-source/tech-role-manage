import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Wrench, DollarSign, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateAdvancedDeliveryDate } from '@/utils/workScheduleCalculator';

interface OrderCardProps {
  order: {
    id: string;
    order_number: string;
    client_id: string;
    service_type: string;
    failure_description: string;
    requested_date?: string;
    delivery_date: string;
    estimated_cost?: number;
    average_service_time?: number;
    status: string;
    assigned_technician?: string;
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
  };
  onClick: () => void;
  onDelete?: (orderId: string) => void;
  canDelete?: boolean;
  getStatusColor: (status: string) => string;
}

export function OrderCard({ order, onClick, onDelete, canDelete, getStatusColor }: OrderCardProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatTime = (hours?: number) => {
    if (!hours) return 'No estimado';
    return hours % 1 === 0 ? `${hours}h` : `${hours}h`;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(order.id);
    }
  };

  return (
    <Card 
      className={`hover:shadow-lg transition-shadow cursor-pointer border-l-4 ${
        order.status === 'pendiente_aprobacion' 
          ? 'border-l-warning bg-warning/5' 
          : 'border-l-primary'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-foreground">
            {order.order_number}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-auto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {order.clients?.name || 'Cliente no especificado'}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <Wrench className="h-4 w-4 mr-2 text-primary" />
          <span className="truncate">
            {order.service_types?.name || 'Servicio no especificado'}
          </span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2 text-primary" />
          <div className="flex flex-col">
            <span>Entrega: {formatDate(order.delivery_date)}</span>
            {order.average_service_time && order.created_at && (
              <span className="text-xs text-blue-600 font-medium">
                Hora estimada: {(() => {
                  const primarySchedule = {
                    work_days: [1, 2, 3, 4, 5],
                    start_time: '08:00',
                    end_time: '17:00',
                    break_duration_minutes: 60
                  };
                  
                  // Simular items de orden para el cálculo
                  const mockOrderItems = [{
                    id: 'mock',
                    estimated_hours: order.average_service_time,
                    shared_time: false,
                    status: 'pendiente' as const
                  }];
                  
                  const { deliveryTime } = calculateAdvancedDeliveryDate({
                    orderItems: mockOrderItems,
                    primaryTechnicianSchedule: primarySchedule,
                    creationDate: new Date(order.created_at)
                  });
                  return deliveryTime;
                })()}
              </span>
            )}
          </div>
        </div>
        
        {order.clients?.client_number && (
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="h-4 w-4 mr-2 text-primary" />
            <span className="truncate">{order.clients.client_number}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm">
          {order.estimated_cost && (
            <div className="flex items-center text-muted-foreground">
              <DollarSign className="h-4 w-4 mr-1 text-primary" />
              <span>${order.estimated_cost.toLocaleString()}</span>
            </div>
          )}
          
          {order.average_service_time && (
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-4 w-4 mr-1 text-primary" />
              <span>{formatTime(order.average_service_time)}</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {order.failure_description}
        </p>
      </CardContent>
    </Card>
  );
}