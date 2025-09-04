import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Wrench, DollarSign, Clock, Trash2, MessageCircle, Users, MapPin, Home } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateAdvancedDeliveryDate } from '@/utils/workScheduleCalculator';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRewardSettings } from '@/hooks/useRewardSettings';

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
    estimated_delivery_date?: string | null;
    is_home_service?: boolean;
    service_location?: any;
    travel_time_hours?: number;
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
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const { settings: rewardSettings } = useRewardSettings();

  // Cargar los items de la orden con todos los datos necesarios para el recálculo
  useEffect(() => {
    const loadOrderItems = async () => {
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            quantity,
            unit_cost_price,
            unit_base_price, 
            vat_rate,
            item_type,
            profit_margin_rate,
            total_amount
          `)
          .eq('order_id', order.id);

        if (error) throw error;
        setOrderItems(data || []);
      } catch (error) {
        console.error('Error loading order items for card:', error);
        setOrderItems([]);
      }
    };

    loadOrderItems();
  }, [order.id]);

  // Calcular el precio correcto usando la lógica completa
  const calculateCorrectTotal = () => {
    if (!orderItems || orderItems.length === 0) {
      return order.estimated_cost || 0;
    }

    return orderItems.reduce((sum, item) => {
      const quantity = item.quantity || 1;
      const salesVatRate = item.vat_rate || 16;
      const cashbackPercent = rewardSettings?.apply_cashback_to_items
        ? (rewardSettings.general_cashback_percent || 0)
        : 0;

      if (item.item_type === 'servicio') {
        // Para servicios: precio base + IVA + cashback
        const basePrice = (item.unit_base_price || 0) * quantity;
        const afterSalesVat = basePrice * (1 + salesVatRate / 100);
        const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
        return sum + finalWithCashback;
      } else {
        // Para artículos: costo base + IVA compra + margen + IVA venta + cashback
        const purchaseVatRate = 16;
        const baseCost = (item.unit_cost_price || 0) * quantity;
        const profitMargin = item.profit_margin_rate || 20;
        
        const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
        const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
        const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
        const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
        
        return sum + finalWithCashback;
      }
    }, 0);
  };
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center">
            <Wrench className="h-3 w-3 mr-2 text-primary flex-shrink-0" />
            <span className="truncate">
              {order.service_types?.name || 'Servicio no especificado'}
            </span>
          </div>
          {order.is_home_service && (
            <div className="flex items-center gap-1 text-blue-600">
              <Home className="h-3 w-3" />
              <span className="text-xs font-medium">Domicilio</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
            <span className="truncate">
              {order.estimated_delivery_date 
                ? formatDate(order.estimated_delivery_date) 
                : formatDate(order.delivery_date)}
            </span>
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
          <div className="flex items-center text-muted-foreground">
            <DollarSign className="h-3 w-3 mr-1 text-primary" />
            <span>${calculateCorrectTotal().toLocaleString()}</span>
          </div>
          
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