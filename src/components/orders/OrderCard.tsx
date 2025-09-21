import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User, Wrench, FileText, ChevronDown, ChevronUp, DollarSign, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// Removed cashback-related imports - cashback system eliminated
import { formatCOPCeilToTen, formatMXNInt, ceilToTen } from '@/utils/currency';
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
    failure_description?: string;
    estimated_cost?: number;
    delivery_date?: string;
    created_at: string;
    status: string;
    client_approval?: boolean;
    assigned_technician?: string;
    client?: {
      name: string;
      email: string;
      phone?: string;
      address: string;
    };
    technician_profile?: {
      full_name: string;
    };
    estimated_delivery_date?: string;
    delivery_address?: string;
    priority?: string;
    average_service_time?: number;
  };
  onClick?: () => void;
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
  // Removed rewardSettings - no longer needed without cashback

  const loadOrderItems = async () => {
    setItemsLoading(true);
    console.log('Loading order items for order:', order.id, order.order_number);
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
      console.log('Order items loaded:', {
        orderId: order.id,
        data,
        error
      });
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
    let basePrice = 0;
    if (item.item_type === 'servicio') {
      basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat); // Aplicar redondeo a cada item
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(afterSalesVat); // Aplicar redondeo a cada item
    }
  };

  // Total de la tarjeta - usar totales guardados cuando existan
  const calculateCorrectTotal = () => {
    console.log('OrderCard calculateCorrectTotal debug:', {
      orderId: order.id,
      orderNumber: order.order_number,
      itemsLoading,
      estimatedCost: order.estimated_cost,
      orderItemsLength: orderItems?.length || 0,
      orderItems: orderItems,
      orderStatus: order.status
    });
    if (itemsLoading) {
      return 0; // No mostrar nada mientras carga
    }

    // Si hay modificaciones pendientes, calcular desde items (no usar estimated_cost)
    if (order.status === 'pendiente_aprobacion' || order.status === 'pendiente_actualizacion') {
      if (orderItems && orderItems.length > 0) {
        console.log('Calculating from order items (pending modifications):', orderItems);
        const total = orderItems.reduce((sum, item) => {
          const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
          console.log('Item calculation:', {
            item,
            hasStoredTotal,
            itemTotal: item.total_amount
          });
          if (hasStoredTotal) return sum + Number(item.total_amount);
          const calculatedPrice = calculateItemDisplayPrice(item);
          console.log('Calculated item price:', calculatedPrice);
          return sum + calculatedPrice;
        }, 0);
        console.log('Total calculated (pending modifications):', total);
        return total;
      }
    }

    // Priorizar cálculo de items cuando estén disponibles
    if (orderItems && orderItems.length > 0) {
      console.log('Calculating from order items:', orderItems);

      // Sumar items individuales ya redondeados
      const total = orderItems.reduce((sum, item) => {
        const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
        console.log('Item calculation:', {
          item,
          hasStoredTotal,
          itemTotal: item.total_amount
        });
        if (hasStoredTotal) return sum + Number(item.total_amount);
        // Cada item ya viene redondeado de calculateItemDisplayPrice
        const calculatedPrice = calculateItemDisplayPrice(item);
        console.log('Calculated item price:', calculatedPrice);
        return sum + calculatedPrice;
      }, 0);
      console.log('Total calculated from items:', total);
      return total;
    }

    // Usar el total estimado solo cuando no hay items
    if (order.estimated_cost && order.estimated_cost > 0) {
      console.log('Using order.estimated_cost (fallback):', order.estimated_cost);
      return order.estimated_cost;
    }

    console.log('No items found, returning 0');
    return 0;
  };
  const totalAmount = calculateCorrectTotal();
  const hasStoredTotals = orderItems?.some((i: any) => typeof i.total_amount === 'number' && i.total_amount > 0) ?? false;
  const usingEstimated = Boolean(order.estimated_cost && order.estimated_cost > 0);
  const {
    paymentSummary,
    loading: paymentsLoading
  } = useOrderPayments(order.id, totalAmount);
  // Removed orderCashback - cashback system eliminated

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', {
        locale: es
      });
    } catch {
      return dateString;
    }
  };
  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', {
        locale: es
      });
    } catch {
      return dateString;
    }
  };
  const getServiceLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      formateo: '💻 Formateo',
      reparacion: '🔧 Reparación',
      mantenimiento: '🛠️ Mantenimiento',
      instalacion: '⚙️ Instalación'
    };
    return labels[serviceType] || `🔧 ${serviceType}`;
  };
  return <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-2" onClick={onClick}>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              {order.order_number}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <OrderModificationsBadge orderId={order.id} />
            </div>
          </div>
          <div className="text-right">
            {itemsLoading || paymentsLoading ? <Skeleton className="h-6 w-20" /> : <div className="text-lg font-bold text-primary">
                {(() => {
              console.log('OrderCard display total debug:', {
                orderId: order.id,
                usingEstimated,
                estimatedCost: order.estimated_cost,
                totalAmount,
                formattedEstimated: usingEstimated ? formatCOPCeilToTen(order.estimated_cost!) : 'N/A',
                formattedTotal: formatMXNInt(totalAmount)
              });
              return formatCOPCeilToTen(totalAmount);
            })()}
              </div>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3" onClick={onClick}>
        <OrderProgressBar status={order.status} orderId={order.id} />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.client?.name || 'Cliente'}</span>
            </div>
            
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(order.created_at)}</span>
            </div>
            {order.estimated_delivery_date && <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Entrega: {formatDate(order.estimated_delivery_date)}</span>
              </div>}
          </div>
        </div>

        {order.failure_description && <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
            <FileText className="h-4 w-4 inline mr-1" />
            {order.failure_description}
          </div>}

        {!paymentsLoading && paymentSummary && paymentSummary.totalPaid > 0 && <div className="bg-green-50 p-2 rounded text-sm">
            <div className="flex justify-between">
              <span>Cobrado:</span>
              <span className="font-medium text-green-700">
                {formatMXNInt(paymentSummary.totalPaid)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Restante:</span>
              <span className="font-medium text-orange-700">
                {formatMXNInt(paymentSummary.remainingBalance)}
              </span>
            </div>
          </div>}

        {/* Removed cashback display - cashback system eliminated */}

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
        return shouldShowButton ? <Button variant="outline" size="sm" className="w-full" onClick={e => {
          e.stopPropagation();
          setShowPaymentDialog(true);
        }}>
              <DollarSign className="h-4 w-4 mr-1" />
              Cobrar {formatMXNInt(paymentSummary.remainingBalance)}
            </Button> : null;
      })()}
      </CardContent>

      <PaymentCollectionDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog} order={order} totalAmount={calculateCorrectTotal()} />
    </Card>;
}