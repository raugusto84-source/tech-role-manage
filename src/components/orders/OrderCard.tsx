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
      className={`hover:shadow-md transition-all cursor-pointer border-l-2 active:scale-[0.98] ${
        order.status === 'pendiente_aprobacion' 
          ? 'border-l-warning bg-warning/5' 
          : 'border-l-primary'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-sm font-semibold text-foreground truncate">
                {order.order_number}
              </CardTitle>
              {order.unread_messages_count != null && order.unread_messages_count > 0 && (
                <div className="relative flex-shrink-0">
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
            <p className="text-xs text-muted-foreground font-medium truncate">
              {order.clients?.name || "Cliente no especificado"}
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={`${getStatusColor(order.status)} text-xs px-2 py-1`} variant="outline">
              {order.status === "pendiente_aprobacion" 
                ? "PENDIENTE" 
                : order.status === "pendiente_entrega"
                ? "LISTO"
                : order.status.replace("_", " ").toUpperCase()}
            </Badge>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-auto w-auto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-3 pb-3 pt-0 space-y-3">
        {/* Servicio y ubicación */}
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0 gap-2">
            <Wrench className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              {order.service_types?.name || "Servicio no especificado"}
            </span>
          </div>
          {order.is_home_service && (
            <div className="flex items-center gap-1 text-blue-600 ml-2 flex-shrink-0">
              <Home className="h-4 w-4" />
              <span className="text-xs font-medium">Domicilio</span>
            </div>
          )}
        </div>
        
        {/* Fecha y cliente */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              {order.estimated_delivery_date 
                ? formatDate(order.estimated_delivery_date) 
                : formatDate(order.delivery_date)}
            </span>
            {order.clients?.client_number && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground truncate">
                  {order.clients.client_number}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Precio y tiempo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-success flex-shrink-0" />
            <span className="font-semibold text-success">
              ${calculateCorrectTotal().toLocaleString('es-CO', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </span>
          </div>
          
          {order.average_service_time && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{formatTime(order.average_service_time)}</span>
            </div>
          )}
        </div>

        {/* Técnico asignado */}
        {(order.technician_profile || (order.support_technicians && order.support_technicians.length > 0)) && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-muted-foreground truncate">
              {order.technician_profile?.full_name}
              {order.support_technicians && order.support_technicians.length > 0 && 
                ` +${order.support_technicians.length}`
              }
            </span>
          </div>
        )}
        
        {/* Descripción del problema */}
        <div className="bg-muted/30 rounded-md p-2">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {order.failure_description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}