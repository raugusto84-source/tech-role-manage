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
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';

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
  const [itemsLoading, setItemsLoading] = useState(true);
  const { getDisplayPrice } = useSalesPricingCalculation();

  useEffect(() => {
    const loadOrderItems = async () => {
      setItemsLoading(true);
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
            pricing_locked,
            total_amount
          `)
          .eq('order_id', order.id);

        if (error) throw error;
        setOrderItems(data || []);
      } catch (error) {
        console.error('Error loading order items for card:', error);
        setOrderItems([]);
      } finally {
        setItemsLoading(false);
      }
    };

    loadOrderItems();
  }, [order.id]);

  // Calcula el precio correcto por item usando la lógica unificada de Ventas
  const calculateItemDisplayPrice = (item: any): number => {
    // Fallback para órdenes antiguas: usar total guardado si está bloqueado o faltan datos
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    const isLocked = Boolean(item.pricing_locked);
    const missingKeyData = (item.item_type === 'servicio')
      ? (!item.unit_base_price || item.unit_base_price <= 0)
      : (!item.unit_cost_price || item.unit_cost_price <= 0);

    if (hasStoredTotal && (isLocked || missingKeyData)) {
      return Number(item.total_amount);
    }

    const quantity = item.quantity || 1;

    const serviceForPricing = {
      id: item.service_type_id || item.id,
      name: item.service_name || '',
      base_price: item.unit_base_price,
      cost_price: item.unit_cost_price,
      vat_rate: item.vat_rate,
      item_type: item.item_type,
      profit_margin_tiers: item.profit_margin_tiers || (item as any).profit_margin_rate ? [{ min_qty: 1, max_qty: 999, margin: (item as any).profit_margin_rate }] : null
    } as any;

    return getDisplayPrice(serviceForPricing, quantity);
  };

  // Total de la tarjeta - usar totales guardados cuando existan
  const calculateCorrectTotal = () => {
    if (itemsLoading) {
      return 0; // No mostrar nada mientras carga
    }
    
    if (orderItems && orderItems.length > 0) {
      // Sumar cada tarjeta como se muestra: redondear cada ítem a 10 y luego sumar
      return orderItems.reduce((sum, item) => sum + ceilToTen(calculateItemDisplayPrice(item)), 0);
    }
    
    // Solo usar estimated_cost como último recurso si no hay items
    const defaultVatRate = 16;
    const base = order.estimated_cost || 0;
    return base * (1 + defaultVatRate / 100);
  };

  // Guarda el total de la UI en la tabla order_final_totals
  const saveUITotalToDatabase = async (uiTotal: number) => {
    try {
      const { error } = await supabase
        .from('order_final_totals')
        .upsert({
          order_id: order.id,
          final_total_amount: uiTotal,
          display_subtotal: uiTotal / 1.16, // Aproximación del subtotal
          display_vat_amount: uiTotal - (uiTotal / 1.16), // Aproximación del IVA
          calculation_source: 'ui_calculation',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'order_id'
        });

      if (error) {
        console.error('Error saving UI total to database:', error);
      }
    } catch (error) {
      console.error('Error saving UI total:', error);
    }
  };

  // Efecto para guardar el total cuando cambie
  useEffect(() => {
    if (!itemsLoading && orderItems.length > 0) {
      const uiTotal = calculateCorrectTotal();
      if (uiTotal > 0) {
        saveUITotalToDatabase(uiTotal);
      }
    }
  }, [orderItems, itemsLoading]);
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
      className={`hover:shadow-sm transition-all cursor-pointer border-l-2 compact-card ${
        order.status === 'pendiente_aprobacion' 
          ? 'border-l-warning bg-warning/5' 
          : 'border-l-primary'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-0 pt-0.5 px-2">{/* Reducir aún más la altura vertical */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-1">
            <CardTitle className="text-sm font-semibold text-foreground truncate">
              {order.order_number}
            </CardTitle>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-medium truncate flex-1">
              {order.clients?.name || "Cliente no especificado"}
            </span>
            {order.unread_messages_count != null && order.unread_messages_count > 0 && (
              <div className="relative">
                <MessageCircle className="h-3 w-3 text-blue-600" />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-3 w-3 rounded-full p-0 text-xs flex items-center justify-center bg-red-500 text-white"
                >
                  {order.unread_messages_count}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Badge className={`${getStatusColor(order.status)} text-xs px-1 py-0`}>
              {order.status === "pendiente_aprobacion" 
                ? "PEND. APROB." 
                : order.status.replace("_", " ").toUpperCase()}
            </Badge>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 p-0.5 h-auto"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-0 px-2 pb-0.5">{/* Eliminar casi todo el espacio vertical */}
        {/* Primera fila: Servicio y ubicación */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center flex-1 min-w-0">
            <Wrench className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
            <span className="truncate">
              {order.service_types?.name || "Servicio no especificado"}
            </span>
          </div>
          {order.is_home_service && (
            <div className="flex items-center gap-1 text-blue-600 ml-2">
              <Home className="h-3 w-3" />
              <span className="text-xs font-medium">Dom</span>
            </div>
          )}
        </div>
        
        {/* Segunda fila: Fecha, cliente, técnico y precio */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-xs">
              {order.estimated_delivery_date 
                ? formatDate(order.estimated_delivery_date) 
                : formatDate(order.delivery_date)}
            </span>
            {order.clients?.client_number && (
              <>
                <span>•</span>
                <User className="h-3 w-3 text-primary flex-shrink-0" />
                <span>{order.clients.client_number}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-primary" />
            {itemsLoading ? (
              <Skeleton className="h-3 w-14 rounded" />
            ) : (
              <span className="font-medium">{formatCOPCeilToTen(calculateCorrectTotal())}</span>
            )}
            {order.average_service_time && (
              <>
                <Clock className="h-3 w-3 text-primary ml-1" />
                <span>{formatTime(order.average_service_time)}</span>
              </>
            )}
          </div>
        </div>

        {/* Tercera fila: Técnicos y descripción */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          {(order.technician_profile || (order.support_technicians && order.support_technicians.length > 0)) && (
            <div className="flex items-center min-w-0 flex-shrink-0">
              <User className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
              <span className="truncate max-w-[120px]">
                {order.technician_profile?.full_name}
                {order.support_technicians && order.support_technicians.length > 0 && 
                  ` +${order.support_technicians.length}`
                }
              </span>
            </div>
          )}
          
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate break-words">
              {order.failure_description}
            </p>
          </div>
        </div>

        {/* Total con IVA prominente */}
        <div className="border-t pt-1 mt-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground">Total con IVA:</span>
            <div className="flex items-center gap-1">
              {itemsLoading ? (
                <Skeleton className="h-4 w-20 rounded" />
              ) : (
                <span className="text-sm font-bold text-primary">
                  {formatCOPCeilToTen(ceilToTen(calculateCorrectTotal()))}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}