import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Zap, TrendingUp, Monitor, Shield, DollarSign, Building2, AlertTriangle } from "lucide-react";
import { calculateOrderPriority, orderPriorityNumberToString, OrderPriority } from "@/utils/priorityCalculator";
import { isBefore, startOfDay } from "date-fns";

interface Order {
  id: string;
  created_at: string;
  delivery_date: string;
  estimated_delivery_date?: string | null;
  status: 'en_espera' | 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  priority?: 'baja' | 'media' | 'alta' | 'critica';
  order_priority?: number | null;
  is_policy_order?: boolean;
  order_category?: string; // Campo directo de la orden
  service_types?: {
    service_category?: string;
  } | null;
  // Campo para identificar si es orden de fraccionamiento
  is_development_order?: boolean;
}

interface OrdersSummaryProps {
  orders: Order[];
  finalizedWithPendingPayment?: number;
}

export function OrdersSummary({
  orders,
  finalizedWithPendingPayment = 0
}: OrdersSummaryProps) {
  // Filter active orders (not finalized or cancelled)
  const activeOrders = orders.filter(order => !['finalizada', 'cancelada', 'rechazada'].includes(order.status));

  // Count by priority - usar order_priority para pólizas, cálculo dinámico para el resto
  const getOrderPriority = (o: Order): OrderPriority => {
    if (o.is_policy_order && o.order_priority != null) {
      return orderPriorityNumberToString(o.order_priority);
    }
    return calculateOrderPriority(o.created_at, o.estimated_delivery_date ?? null, o.delivery_date);
  };
  
  const calculatedPriorities = activeOrders.map(getOrderPriority);
  const priorityCounts = {
    critica: calculatedPriorities.filter(p => p === 'critica').length,
    alta: calculatedPriorities.filter(p => p === 'alta').length,
    media: calculatedPriorities.filter(p => p === 'media').length,
    baja: calculatedPriorities.filter(p => p === 'baja').length
  };

  // Count by category - Fraccionamientos tienen prioridad, luego order_category, luego service_types
  const getOrderCategory = (order: Order): 'sistemas' | 'seguridad' | 'fraccionamientos' => {
    if (order.is_development_order) return 'fraccionamientos';
    // Usar order_category si existe, sino service_types.service_category, sino default a sistemas
    return (order.order_category || order.service_types?.service_category || 'sistemas') as 'sistemas' | 'seguridad' | 'fraccionamientos';
  };

  const categoryCounts = {
    sistemas: activeOrders.filter(o => getOrderCategory(o) === 'sistemas').length,
    seguridad: activeOrders.filter(o => getOrderCategory(o) === 'seguridad').length,
    fraccionamientos: activeOrders.filter(o => getOrderCategory(o) === 'fraccionamientos').length
  };

  // Count overdue orders (delivery date before today and not completed)
  const today = startOfDay(new Date());
  const overdueCount = activeOrders.filter(o => {
    const deliveryDateStr = o.estimated_delivery_date || o.delivery_date;
    if (!deliveryDateStr) return false;
    const deliveryDate = new Date(deliveryDateStr + 'T12:00:00Z');
    return isBefore(deliveryDate, today);
  }).length;

  // Count by status
  const statusCounts = {
    en_espera: activeOrders.filter(o => o.status === 'en_espera').length,
    en_proceso: activeOrders.filter(o => o.status === 'en_proceso').length,
    pendiente_entrega: activeOrders.filter(o => o.status === 'pendiente_entrega').length
  };

  return (
    <div className="bg-muted/30 rounded-lg border p-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Total */}
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
          <Clock className="h-4 w-4" />
          <span className="font-bold text-sm">{activeOrders.length}</span>
        </Badge>
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Priorities */}
        <Badge className={`gap-1.5 text-sm px-3 py-1 bg-priority-critica text-priority-critica-foreground hover:bg-priority-critica/90 ${priorityCounts.critica > 0 ? 'animate-pulse' : ''}`} title="Crítica">
          <AlertCircle className="h-4 w-4" />
          {priorityCounts.critica}
        </Badge>
        <Badge className={`gap-1.5 text-sm px-3 py-1 bg-priority-alta text-priority-alta-foreground hover:bg-priority-alta/90 ${priorityCounts.alta > 0 ? 'animate-pulse' : ''}`} title="Alta">
          <Zap className="h-4 w-4" />
          {priorityCounts.alta}
        </Badge>
        <Badge className={`gap-1.5 text-sm px-3 py-1 bg-priority-media text-priority-media-foreground hover:bg-priority-media/90 ${priorityCounts.media > 0 ? 'animate-pulse' : ''}`} title="Media">
          <Clock className="h-4 w-4" />
          {priorityCounts.media}
        </Badge>
        <Badge className={`gap-1.5 text-sm px-3 py-1 bg-priority-baja text-priority-baja-foreground hover:bg-priority-baja/90 ${priorityCounts.baja > 0 ? 'animate-pulse' : ''}`} title="Baja">
          <TrendingUp className="h-4 w-4" />
          {priorityCounts.baja}
        </Badge>
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Categories - Sistemas, Seguridad, Fraccionamientos */}
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-info text-info-foreground hover:bg-info/90" title="Sistemas">
          <Monitor className="h-4 w-4" />
          {categoryCounts.sistemas}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90" title="Seguridad">
          <Shield className="h-4 w-4" />
          {categoryCounts.seguridad}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-amber-500 text-white hover:bg-amber-600" title="Fraccionamientos">
          <Building2 className="h-4 w-4" />
          {categoryCounts.fraccionamientos}
        </Badge>
        
        {overdueCount > 0 && (
          <>
            <span className="text-muted-foreground text-sm">|</span>
            <Badge className="gap-1.5 text-sm px-3 py-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse" title="Órdenes Atrasadas">
              <AlertTriangle className="h-4 w-4" />
              {overdueCount} Atrasadas
            </Badge>
          </>
        )}
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Status */}
        {statusCounts.en_espera > 0 && (
          <Badge variant="outline" title="Agendadas" className="text-sm px-3 py-1 text-slate-700 border-slate-300 bg-slate-100">
            {statusCounts.en_espera} AG
          </Badge>
        )}
        {statusCounts.en_proceso > 0 && (
          <Badge variant="outline" title="En Proceso" className="text-sm px-3 py-1 text-info-foreground border-info-border bg-[#b0f7f4]">
            {statusCounts.en_proceso} EP
          </Badge>
        )}
        {statusCounts.pendiente_entrega > 0 && (
          <Badge variant="outline" title="Terminadas" className="text-sm px-3 py-1 text-success-foreground border-success-border bg-[#a2f6d0]">
            {statusCounts.pendiente_entrega} TER
          </Badge>
        )}
        
        {finalizedWithPendingPayment > 0 && (
          <>
            <span className="text-muted-foreground text-sm">|</span>
            <Badge variant="outline" title="Finalizadas con Cobro Pendiente" className="text-sm px-3 py-1 bg-warning text-warning-foreground border-warning-border animate-pulse">
              <DollarSign className="h-4 w-4" />
              {finalizedWithPendingPayment}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}