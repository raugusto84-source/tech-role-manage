import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Zap, TrendingUp, Monitor, Shield } from "lucide-react";

interface Order {
  id: string;
  status: 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  priority: 'baja' | 'media' | 'alta' | 'critica';
  service_types?: {
    service_category?: string;
  } | null;
}

interface OrdersSummaryProps {
  orders: Order[];
}

export function OrdersSummary({ orders }: OrdersSummaryProps) {
  // Filter active orders (not finalized or cancelled)
  const activeOrders = orders.filter(
    order => !['finalizada', 'cancelada', 'rechazada'].includes(order.status)
  );

  // Count by priority
  const priorityCounts = {
    critica: activeOrders.filter(o => o.priority === 'critica').length,
    alta: activeOrders.filter(o => o.priority === 'alta').length,
    media: activeOrders.filter(o => o.priority === 'media').length,
    baja: activeOrders.filter(o => o.priority === 'baja').length,
  };

  // Count by category
  const categoryCounts = {
    sistemas: activeOrders.filter(o => 
      (o.service_types?.service_category || 'sistemas') === 'sistemas'
    ).length,
    seguridad: activeOrders.filter(o => 
      (o.service_types?.service_category || 'sistemas') === 'seguridad'
    ).length,
  };

  // Count by status
  const statusCounts = {
    pendiente_aprobacion: activeOrders.filter(o => o.status === 'pendiente_aprobacion').length,
    en_proceso: activeOrders.filter(o => o.status === 'en_proceso').length,
    pendiente_actualizacion: activeOrders.filter(o => o.status === 'pendiente_actualizacion').length,
    pendiente_entrega: activeOrders.filter(o => o.status === 'pendiente_entrega').length,
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
        <Badge variant="destructive" className="gap-1.5 text-sm px-3 py-1" title="Crítica">
          <AlertCircle className="h-4 w-4" />
          {priorityCounts.critica}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-orange-600 hover:bg-orange-700" title="Alta">
          <Zap className="h-4 w-4" />
          {priorityCounts.alta}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-yellow-600 hover:bg-yellow-700" title="Media">
          <Clock className="h-4 w-4" />
          {priorityCounts.media}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-green-600 hover:bg-green-700" title="Baja">
          <TrendingUp className="h-4 w-4" />
          {priorityCounts.baja}
        </Badge>
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Categories */}
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700" title="Sistemas">
          <Monitor className="h-4 w-4" />
          {categoryCounts.sistemas}
        </Badge>
        <Badge className="gap-1.5 text-sm px-3 py-1 bg-purple-600 hover:bg-purple-700" title="Seguridad">
          <Shield className="h-4 w-4" />
          {categoryCounts.seguridad}
        </Badge>
        
        <span className="text-muted-foreground text-sm">|</span>
        
        {/* Status */}
        {statusCounts.pendiente_aprobacion > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1 bg-yellow-50" title="Pendientes de Aprobación">
            {statusCounts.pendiente_aprobacion} PA
          </Badge>
        )}
        {statusCounts.en_proceso > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1 bg-blue-50" title="En Proceso">
            {statusCounts.en_proceso} EP
          </Badge>
        )}
        {statusCounts.pendiente_actualizacion > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1 bg-orange-50" title="Pendientes de Actualización">
            {statusCounts.pendiente_actualizacion} PAc
          </Badge>
        )}
        {statusCounts.pendiente_entrega > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1 bg-green-50" title="Pendientes de Entrega">
            {statusCounts.pendiente_entrega} PE
          </Badge>
        )}
      </div>
    </div>
  );
}
