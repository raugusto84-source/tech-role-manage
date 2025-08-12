import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Wrench, DollarSign, Clock, Trash2, MessageCircle, Users } from 'lucide-react';
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
      className={`hover:shadow-md transition-all cursor-pointer border-l-4 compact-card ${
        order.status === 'pendiente_aprobacion' 
          ? 'border-l-warning bg-warning/5' 
          : 'border-l-primary'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-foreground truncate">
              {order.order_number}
            </CardTitle>
            {order.unread_messages_count != null && order.unread_messages_count > 0 && (
              <div className="relative">
                <MessageCircle className="h-4 w-4 text-blue-600" />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-xs flex items-center justify-center bg-red-500 text-white"
                >
                  {order.unread_messages_count}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Badge className={`${getStatusColor(order.status)} text-xs`}>
              {order.status === 'pendiente_aprobacion' 
                ? 'PENDIENTE APROBACIÓN' 
                : order.status.replace('_', ' ').toUpperCase()}
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
        <p className="text-xs text-muted-foreground font-medium truncate mt-1">
          {order.clients?.name || 'Cliente no especificado'}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-2 px-3 pb-3">
        <div className="flex items-center text-xs text-muted-foreground">
          <Wrench className="h-3 w-3 mr-2 text-primary flex-shrink-0" />
          <span className="truncate">
            {order.service_types?.name || 'Servicio no especificado'}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
            <span className="truncate">{formatDate(order.delivery_date)}</span>
          </div>
          
          {order.clients?.client_number && (
            <div className="flex items-center">
              <User className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
              <span className="truncate">{order.clients.client_number}</span>
            </div>
          )}
        </div>

        {/* Técnicos - versión compacta */}
        {(order.technician_profile || (order.support_technicians && order.support_technicians.length > 0)) && (
          <div className="flex items-center text-xs text-muted-foreground">
            <User className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
            <span className="truncate">
              {order.technician_profile?.full_name}
              {order.support_technicians && order.support_technicians.length > 0 && 
                ` +${order.support_technicians.length} apoyo`
              }
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs">
          {order.estimated_cost && (
            <div className="flex items-center text-muted-foreground">
              <DollarSign className="h-3 w-3 mr-1 text-primary" />
              <span>${order.estimated_cost.toLocaleString()}</span>
            </div>
          )}
          
          {order.average_service_time && (
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-3 w-3 mr-1 text-primary" />
              <span>{formatTime(order.average_service_time)}</span>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {order.failure_description}
        </p>
      </CardContent>
    </Card>
  );
}