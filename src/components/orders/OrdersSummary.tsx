import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Zap, TrendingUp, Monitor, Shield, DollarSign } from "lucide-react";
import { calculateOrderPriority } from "@/utils/priorityCalculator";
interface Order {
  id: string;
  created_at: string;
  delivery_date: string;
  estimated_delivery_date?: string | null;
  status: 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  // Campo opcional: si existe lo ignoramos para el resumen y calculamos dinámicamente
  priority?: 'baja' | 'media' | 'alta' | 'critica';
  service_types?: {
    service_category?: string;
  } | null;
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

  // Count by priority (calculated from dates to stay in sync with row badges)
  const calculatedPriorities = activeOrders.map(o => calculateOrderPriority(o.created_at, o.estimated_delivery_date ?? null, o.delivery_date));
  const priorityCounts = {
    critica: calculatedPriorities.filter(p => p === 'critica').length,
    alta: calculatedPriorities.filter(p => p === 'alta').length,
    media: calculatedPriorities.filter(p => p === 'media').length,
    baja: calculatedPriorities.filter(p => p === 'baja').length
  };

  // Count by category
  const categoryCounts = {
    sistemas: activeOrders.filter(o => (o.service_types?.service_category || 'sistemas') === 'sistemas').length,
    seguridad: activeOrders.filter(o => (o.service_types?.service_category || 'sistemas') === 'seguridad').length
  };

  // Count by status
  const statusCounts = {
    pendiente_aprobacion: activeOrders.filter(o => o.status === 'pendiente_aprobacion').length,
    en_proceso: activeOrders.filter(o => o.status === 'en_proceso').length,
    pendiente_actualizacion: activeOrders.filter(o => o.status === 'pendiente_actualizacion').length,
    pendiente_entrega: activeOrders.filter(o => o.status === 'pendiente_entrega').length
  };
  return <div className="bg-muted/30 rounded-lg border p-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Total */}
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
          <Clock className="h-4 w-4" />
          <span className="font-bold text-sm">{activeOrders.length}</span>
        </Badge>
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Priorities */}
        {priorityCounts.critica > 0 && <Badge className="gap-1.5 text-sm px-3 py-1 bg-priority-critica text-priority-critica-foreground hover:bg-priority-critica/90 animate-pulse" title="Crítica">
          <AlertCircle className="h-4 w-4" />
          {priorityCounts.critica}
        </Badge>}
        {priorityCounts.alta > 0 && <Badge className="gap-1.5 text-sm px-3 py-1 bg-priority-alta text-priority-alta-foreground hover:bg-priority-alta/90 animate-pulse" title="Alta">
          <Zap className="h-4 w-4" />
          {priorityCounts.alta}
        </Badge>}
        {priorityCounts.media > 0 && <Badge className="gap-1.5 text-sm px-3 py-1 bg-priority-media text-priority-media-foreground hover:bg-priority-media/90 animate-pulse" title="Media">
          <Clock className="h-4 w-4" />
          {priorityCounts.media}
        </Badge>}
        {priorityCounts.baja > 0 && <Badge className="gap-1.5 text-sm px-3 py-1 bg-priority-baja text-priority-baja-foreground hover:bg-priority-baja/90 animate-pulse" title="Baja">
          <TrendingUp className="h-4 w-4" />
          {priorityCounts.baja}
        </Badge>}
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Categories */}
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-info text-info-foreground hover:bg-info/90" title="Sistemas">
          <Monitor className="h-4 w-4" />
          {categoryCounts.sistemas}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90" title="Seguridad">
          <Shield className="h-4 w-4" />
          {categoryCounts.seguridad}
        </Badge>
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Status */}
        {statusCounts.pendiente_aprobacion > 0 && <Badge variant="outline" title="Pendientes de Aprobación" className="text-sm px-3 py-1 text-warning-foreground border-warning-border bg-[#f2e326]">
            {statusCounts.pendiente_aprobacion} PA
          </Badge>}
        {statusCounts.en_proceso > 0 && <Badge variant="outline" title="En Proceso" className="text-sm px-3 py-1 text-info-foreground border-info-border bg-[#b0f7f4]">
            {statusCounts.en_proceso} EP
          </Badge>}
        {statusCounts.pendiente_actualizacion > 0 && <Badge variant="outline" className="text-sm px-3 py-1 bg-warning-light text-warning-foreground border-warning-border" title="Pendientes de Actualización">
            {statusCounts.pendiente_actualizacion} PAc
          </Badge>}
        {statusCounts.pendiente_entrega > 0 && <Badge variant="outline" title="Pendientes de Entrega" className="text-sm px-3 py-1 text-success-foreground border-success-border bg-[#a2f6d0]">
            {statusCounts.pendiente_entrega} PE
          </Badge>}
        
        {finalizedWithPendingPayment > 0 && <>
          <span className="text-muted-foreground text-sm">|</span>
          <Badge variant="outline" title="Finalizadas con Cobro Pendiente" className="text-sm px-3 py-1 bg-warning text-warning-foreground border-warning-border animate-pulse">
            <DollarSign className="h-4 w-4" />
            {finalizedWithPendingPayment}
          </Badge>
        </>}
      </div>
    </div>;
}