import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Wrench, DollarSign, Clock, Trash2, MessageCircle, Users, MapPin, Home, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateAdvancedDeliveryDate } from '@/utils/workScheduleCalculator';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';
import { PaymentCollectionDialog } from './PaymentCollectionDialog';
import { useOrderPayments } from '@/hooks/useOrderPayments';
import { OrderModificationsBadge } from './OrderModificationsBadge';
import { OrderProgressBar } from './OrderProgressBar';
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
  showCollectButton?: boolean;
}
export function OrderCard({
  order,
  onClick,
  onDelete,
  canDelete,
  getStatusColor,
  showCollectButton = false
}: OrderCardProps) {
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { settings: rewardSettings } = useRewardSettings();
  const loadOrderItems = async () => {
    setItemsLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('order_items').select(`
            quantity,
            unit_cost_price,
            unit_base_price, 
            vat_rate,
            item_type,
            profit_margin_rate,
            pricing_locked,
            total_amount
          `).eq('order_id', order.id);
      if (error) throw error;
      setOrderItems(data || []);
    } catch (error) {
      console.error('Error loading order items for card:', error);
      setOrderItems([]);
    } finally {
      setItemsLoading(false);
    }
  };
  useEffect(() => {
    loadOrderItems();
  }, [order.id]);

  // Calcula el precio correcto por item - MISMA LÓGICA QUE OrderDetails y SimpleOrderCard
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
    const salesVatRate = item.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items ? (rewardSettings.general_cashback_percent || 0) : 0;

    if (item.item_type === 'servicio') {
      const basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    }
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
    // Si la orden está pendiente de aprobación/actualización, NO volver a aplicar IVA
    if (order.status === 'pendiente_aprobacion' || order.status === 'pendiente_actualizacion') {
      return ceilToTen(order.estimated_cost || 0);
    }
    // En otros casos, aplicar IVA por defecto
    const defaultVatRate = 16;
    const base = order.estimated_cost || 0;
    return ceilToTen(base * (1 + defaultVatRate / 100));
  };

  // Calculate payments after total calculation
  const totalAmount = calculateCorrectTotal();
  const {
    paymentSummary,
    loading: paymentsLoading
  } = useOrderPayments(order.id, totalAmount);
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', {
        locale: es
      });
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
  return <Card className={`hover:shadow-sm transition-all cursor-pointer border-l-2 compact-card ${order.status === 'pendiente_aprobacion' ? 'border-l-warning bg-warning/5' : 'border-l-primary'}`} onClick={e => {
    if (showPaymentDialog) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  }}>
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
            {order.unread_messages_count != null && order.unread_messages_count > 0 && <div className="relative">
                <MessageCircle className="h-3 w-3 text-blue-600" />
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-3 w-3 rounded-full p-0 text-xs flex items-center justify-center bg-red-500 text-white">
                  {order.unread_messages_count}
                </Badge>
              </div>}
          </div>
          <Badge className={`${getStatusColor(order.status)} text-xs px-1 py-0`}>
            {order.status === "pendiente_aprobacion" ? "PEND. APROB." : order.status.replace("_", " ").toUpperCase()}
          </Badge>
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
          {order.is_home_service && <div className="flex items-center gap-1 text-blue-600 ml-2">
              <Home className="h-3 w-3" />
              <span className="text-xs font-medium">Dom</span>
            </div>}
        </div>
        
        {/* Segunda fila: Fecha, cliente, técnico y precio */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-xs">
              {order.estimated_delivery_date ? formatDate(order.estimated_delivery_date) : formatDate(order.delivery_date)}
            </span>
            {order.clients?.client_number && <>
                <span>•</span>
                
                
              </>}
          </div>
          
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-primary" />
            {itemsLoading ? <Skeleton className="h-3 w-14 rounded" /> : <span className="font-medium">{formatCOPCeilToTen(calculateCorrectTotal())}</span>}
            {order.average_service_time && <>
                <Clock className="h-3 w-3 text-primary ml-1" />
                <span>{formatTime(order.average_service_time)}</span>
              </>}
          </div>
        </div>

        {/* Tercera fila: Técnicos y descripción */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          {(order.technician_profile || order.support_technicians && order.support_technicians.length > 0) && <div className="flex items-center min-w-0 flex-shrink-0">
              <User className="h-3 w-3 mr-1 text-primary flex-shrink-0" />
              <span className="truncate max-w-[120px]">
                {order.technician_profile?.full_name}
                {order.support_technicians && order.support_technicians.length > 0 && ` +${order.support_technicians.length}`}
              </span>
            </div>}
          
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate break-words">
              {order.failure_description}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-1">
          <OrderProgressBar orderId={order.id} status={order.status} />
        </div>

        {/* Total con IVA y estado de pagos */}
        <div className="border-t pt-1 mt-1">
          {/* Total con IVA */}
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-muted-foreground">Total con IVA:</span>
            <div className="flex items-center gap-1">
              {itemsLoading ? <Skeleton className="h-4 w-20 rounded" /> : <span className="text-sm font-bold text-primary">
                  {formatCOPCeilToTen(ceilToTen(totalAmount))}
                </span>}
            </div>
          </div>
          
          {/* Estado de pagos */}
          {totalAmount >= 0 && <div className="space-y-0.5 text-xs">
              {paymentSummary.paymentCount > 0 && <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cobrado ({paymentSummary.paymentCount} pago{paymentSummary.paymentCount > 1 ? 's' : ''}):</span>
                    <span className={`font-medium ${paymentSummary.isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatCOPCeilToTen(paymentSummary.totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Restante:</span>
                    <span className={`font-medium ${paymentSummary.isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCOPCeilToTen(paymentSummary.remainingBalance)}
                    </span>
                  </div>
                </>}
              {paymentSummary.paymentCount === 0 && <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sin pagos registrados</span>
                  <span className="text-xs text-amber-600 font-medium">
                    {paymentSummary.isFullyPaid ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>}
            </div>}
          
          {/* Botón de cobrar para órdenes finalizadas */}
          {(() => {
          const shouldShowButton = showCollectButton && paymentSummary.remainingBalance > 0;
          console.log('OrderCard collect button debug:', {
            showCollectButton,
            remainingBalance: paymentSummary.remainingBalance,
            orderStatus: order.status,
            orderNumber: order.order_number,
            shouldShow: shouldShowButton
          });
          return shouldShowButton ? <div className="flex justify-between items-center mt-2">
                  <OrderModificationsBadge orderId={order.id} onChanged={loadOrderItems} />
                  <Button variant="default" size="sm" onClick={e => {
              console.log('Cobrar button clicked for order:', order.order_number);
              e.stopPropagation();
              setShowPaymentDialog(true);
              console.log('Payment dialog state set to true');
            }}>
                  <CreditCard className="h-3 w-3 mr-1" />
                  Cobrar
                </Button>
              </div> : null;
        })()}
        </div>
      </CardContent>
      
      <PaymentCollectionDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog} order={order} totalAmount={ceilToTen(calculateCorrectTotal())} />
    </Card>;
}