import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Wrench, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderCardProps {
  order: {
    id: string;
    order_number: string;
    client_name: string;
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
    };
    profiles?: {
      full_name: string;
    };
  };
  onClick: () => void;
  getStatusColor: (status: string) => string;
}

export function OrderCard({ order, onClick, getStatusColor }: OrderCardProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'No estimado';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-primary"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-foreground">
            {order.order_number}
          </CardTitle>
          <Badge className={getStatusColor(order.status)}>
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {order.client_name}
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
          <span>Entrega: {formatDate(order.delivery_date)}</span>
        </div>
        
        {order.assigned_technician && order.profiles && (
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="h-4 w-4 mr-2 text-primary" />
            <span className="truncate">{order.profiles.full_name}</span>
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