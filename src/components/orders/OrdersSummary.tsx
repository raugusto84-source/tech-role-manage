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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critica':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'alta':
        return <Zap className="h-5 w-5 text-orange-600" />;
      case 'media':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'baja':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'alta':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'media':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'baja':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Resumen: {activeOrders.length} Activas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Priority Grid */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">PRIORIDAD</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`p-2 rounded-lg border text-center ${getPriorityColor('critica')}`}>
              {getPriorityIcon('critica')}
              <div className="text-lg font-bold mt-1">{priorityCounts.critica}</div>
              <div className="text-xs font-medium">Crítica</div>
            </div>
            <div className={`p-2 rounded-lg border text-center ${getPriorityColor('alta')}`}>
              {getPriorityIcon('alta')}
              <div className="text-lg font-bold mt-1">{priorityCounts.alta}</div>
              <div className="text-xs font-medium">Alta</div>
            </div>
            <div className={`p-2 rounded-lg border text-center ${getPriorityColor('media')}`}>
              {getPriorityIcon('media')}
              <div className="text-lg font-bold mt-1">{priorityCounts.media}</div>
              <div className="text-xs font-medium">Media</div>
            </div>
            <div className={`p-2 rounded-lg border text-center ${getPriorityColor('baja')}`}>
              {getPriorityIcon('baja')}
              <div className="text-lg font-bold mt-1">{priorityCounts.baja}</div>
              <div className="text-xs font-medium">Baja</div>
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">CATEGORÍA</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg border bg-blue-50 border-blue-200 text-center">
              <Monitor className="h-4 w-4 text-blue-600 mx-auto" />
              <div className="text-lg font-bold text-blue-900 mt-1">{categoryCounts.sistemas}</div>
              <div className="text-xs font-medium text-blue-700">Sistemas</div>
            </div>
            <div className="p-2 rounded-lg border bg-purple-50 border-purple-200 text-center">
              <Shield className="h-4 w-4 text-purple-600 mx-auto" />
              <div className="text-lg font-bold text-purple-900 mt-1">{categoryCounts.seguridad}</div>
              <div className="text-xs font-medium text-purple-700">Seguridad</div>
            </div>
          </div>
        </div>

        {/* Status Grid */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">ESTADO</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-lg border bg-yellow-50 border-yellow-200 text-center">
              <div className="text-lg font-bold text-yellow-900">{statusCounts.pendiente_aprobacion}</div>
              <div className="text-xs text-yellow-700">P. Aprobación</div>
            </div>
            <div className="p-2 rounded-lg border bg-blue-50 border-blue-200 text-center">
              <div className="text-lg font-bold text-blue-900">{statusCounts.en_proceso}</div>
              <div className="text-xs text-blue-700">En Proceso</div>
            </div>
            <div className="p-2 rounded-lg border bg-orange-50 border-orange-200 text-center">
              <div className="text-lg font-bold text-orange-900">{statusCounts.pendiente_actualizacion}</div>
              <div className="text-xs text-orange-700">P. Actualización</div>
            </div>
            <div className="p-2 rounded-lg border bg-green-50 border-green-200 text-center">
              <div className="text-lg font-bold text-green-900">{statusCounts.pendiente_entrega}</div>
              <div className="text-xs text-green-700">P. Entrega</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
