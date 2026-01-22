import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, DollarSign, Clock, Trash2, Eye, MapPin, Home, CreditCard, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrderElapsedTime } from '@/hooks/useOrderElapsedTime';
// Removed useRewardSettings and useOrderCashback imports - cashback system eliminated
import { formatCOPCeilToTen, formatMXNExact, formatMXNInt, ceilToTen } from '@/utils/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentCollectionDialog } from './PaymentCollectionDialog';
import { useOrderPayments } from '@/hooks/useOrderPayments';
import { OrderModificationsBadge } from './OrderModificationsBadge';
import { OrderProgressBar } from './OrderProgressBar';
import { formatMXNCashback } from '@/utils/currency';

interface SimpleOrderCardProps {
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
    created_by?: string;
    created_by_name?: string;
    estimated_delivery_date?: string | null;
    is_home_service?: boolean;
    is_policy_order?: boolean;
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
  onView: () => void;
  onDelete?: (orderId: string) => void;
  canDelete?: boolean;
  getStatusColor: (status: string) => string;
  showCollectButton?: boolean;
}

export function SimpleOrderCard({ 
  order, 
  onView, 
  onDelete, 
  canDelete, 
  getStatusColor,
  showCollectButton = false
}: SimpleOrderCardProps) {
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { elapsedTime, totalTime, loading: timeLoading } = useOrderElapsedTime(order.id, order.status, order.created_at);
  // Removed useRewardSettings and useOrderCashback - cashback system eliminated

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
      console.error('Error loading order items for simple card:', error);
      setOrderItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    loadOrderItems();
  }, [order.id]);

  // SIEMPRE usar precio guardado de cotización - NO recalcular nunca
  const calculateItemDisplayPrice = (item: any): number => {
    // Si existe total_amount en BD, es la fuente de verdad SIEMPRE
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    if (hasStoredTotal) {
      return Number(item.total_amount);
    }

    // Solo recalcular cuando NO hay total guardado (datos muy antiguos)
    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate || 16;
    // Removed cashback calculation - cashback system eliminated

    if (item.item_type === 'servicio') {
      const basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      return afterSalesVat;
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      return afterSalesVat;
    }
  };

// Total con IVA - usar totales guardados cuando existan
const calculateCorrectTotal = () => {
  if (itemsLoading) return 0;

  // Preferir siempre el total estimado de la orden si existe (refleja descuentos globales)
  if (order.estimated_cost && order.estimated_cost > 0) {
    return order.estimated_cost;
  }
  
  if (orderItems && orderItems.length > 0) {
    // Para órdenes pendientes de aprobación, NO aplicar redondeo
    if (order.status === 'pendiente_aprobacion' || order.status === 'pendiente_actualizacion') {
      return orderItems.reduce((sum, item) => {
        const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
        if (hasStoredTotal) return sum + Number(item.total_amount);
        // SIN redondeo para órdenes pendientes
        return sum + calculateItemDisplayPrice(item);
      }, 0);
    }
    
    // Para otras órdenes, usar lógica normal con redondeo por item
    return orderItems.reduce((sum, item) => {
      const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
      if (hasStoredTotal) return sum + Number(item.total_amount);
      return sum + ceilToTen(calculateItemDisplayPrice(item));
    }, 0);
  }
  
  // Si no hay items, usar el estimado (por compatibilidad)
  return order.estimated_cost || 0;
};
const totalAmount = calculateCorrectTotal();
const hasStoredTotals = (orderItems?.some((i) => typeof i.total_amount === 'number' && i.total_amount > 0) ?? false);
const usingEstimated = Boolean(order.estimated_cost && order.estimated_cost > 0);
const { paymentSummary, loading: paymentsLoading, refreshPayments } = useOrderPayments(order.id, totalAmount);
// Removed useOrderCashback - cashback system eliminated

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'PEND. APROB.';
      case 'en_proceso': return 'EN PROCESO';
      case 'pendiente_actualizacion': return 'PEND. ACTUAL.';
      case 'pendiente_entrega': return 'PEND. ENTREGA';
      case 'finalizada': return 'FINALIZADA';
      case 'cancelada': return 'CANCELADA';
      default: return status.toUpperCase();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(order.id);
    }
  };

  return (
    <Card 
      className="hover:shadow-sm transition-all cursor-pointer border-l-4 border-l-primary"
      onClick={(e) => {
        if (showPaymentDialog) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onView();
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-primary">
              {order.order_number}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground break-words leading-tight">
                {order.clients?.name || "Cliente no especificado"}
              </span>
              {order.clients?.client_number && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {order.clients.client_number}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={`${getStatusColor(order.status)} text-xs`}>
              {getStatusText(order.status)}
            </Badge>
            {!timeLoading && (
              <div className="flex flex-col items-end gap-0.5">
                {elapsedTime && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">Estado:</span> {elapsedTime}
                  </div>
                )}
                {totalTime && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-medium">Total:</span> {totalTime}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Servicio */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-muted-foreground">Servicio:</span>
            <span className="text-sm truncate">
              {order.service_types?.name || "No especificado"}
            </span>
          </div>
          {order.is_home_service && (
            <div className="flex items-center gap-1 text-blue-600">
              <Home className="h-4 w-4" />
              <span className="text-xs font-medium">Domicilio</span>
            </div>
          )}
        </div>

        {/* Fecha de entrega */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Fecha:</span>
          <span className="text-sm">
            {order.estimated_delivery_date 
              ? formatDate(order.estimated_delivery_date) 
              : formatDate(order.delivery_date)}
          </span>
        </div>

        {/* Técnico asignado */}
        {order.technician_profile && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Técnico:</span>
            <span className="text-sm">
              {order.technician_profile.full_name}
              {order.support_technicians && order.support_technicians.length > 0 && 
                ` +${order.support_technicians.length}`
              }
            </span>
          </div>
        )}

        {/* Descripción */}
        <div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {order.failure_description}
          </p>
        </div>

        {/* Creado por */}
        {order.created_by_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserPlus className="h-3 w-3" />
            <span>Por: {order.created_by_name}</span>
          </div>
        )}

        {/* Barra de progreso */}
        <div className="pt-2">
          <OrderProgressBar orderId={order.id} status={order.status} showLabels={true} />
        </div>

        {/* Total con IVA y estado de pagos */}
        <div className="border-t pt-3 mt-3">
          {/* Total con IVA */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Total con IVA:</span>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              {itemsLoading ? (
                <Skeleton className="h-6 w-24 rounded" />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {formatCOPCeilToTen(totalAmount)}
                </span>
              )}
            </div>
          </div>
          
          {/* Estado de pagos */}
          {totalAmount >= 0 && (
            <div className="space-y-1 text-sm">
              {paymentSummary.paymentCount > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cobrado ({paymentSummary.paymentCount} pago{paymentSummary.paymentCount > 1 ? 's' : ''}):</span>
                    <span className={`font-semibold ${paymentSummary.isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatCOPCeilToTen(paymentSummary.totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Restante:</span>
                    <span className={`font-semibold ${paymentSummary.isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCOPCeilToTen(paymentSummary.remainingBalance)}
                    </span>
                  </div>
                </>
              )}
              {paymentSummary.paymentCount === 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sin pagos registrados</span>
                  <span className="text-sm text-amber-600 font-semibold">
                    {paymentSummary.isFullyPaid ? 'Pagado' : 'Pendiente'}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Botones de acción */}
        <div className="flex justify-between items-center gap-2 pt-2">
          <OrderModificationsBadge orderId={order.id} onChanged={loadOrderItems} />
          <div className="flex gap-2 flex-wrap">
            {order.is_policy_order ? (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                📋 Póliza
              </Badge>
            ) : (
              showCollectButton && paymentSummary.remainingBalance > 0 && (
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg font-semibold"
                  onClick={(e) => {
                    console.log('Cobrar button clicked for order:', order.order_number);
                    e.stopPropagation();
                    setShowPaymentDialog(true);
                    console.log('Payment dialog state set to true');
                  }}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Cobrar
                </Button>
              )
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver detalles
            </Button>
          </div>
        </div>
      </CardContent>
      
      <PaymentCollectionDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        order={order}
        totalAmount={totalAmount}
      />
    </Card>
  );
}