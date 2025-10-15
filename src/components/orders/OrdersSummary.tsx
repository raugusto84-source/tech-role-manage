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
    <div className="space-y-4">
      {/* Total Active Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Resumen de Trabajo Pendiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {activeOrders.length}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            órdenes activas
          </p>
        </CardContent>
      </Card>

      {/* Priority Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Por Prioridad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Critical Priority */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${getPriorityColor('critica')}`}>
            <div className="flex items-center gap-3">
              {getPriorityIcon('critica')}
              <div>
                <div className="font-semibold text-sm">Crítica</div>
                <div className="text-xs opacity-75">Requiere atención inmediata</div>
              </div>
            </div>
            <Badge variant="destructive" className="text-base px-3 py-1">
              {priorityCounts.critica}
            </Badge>
          </div>

          {/* High Priority */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${getPriorityColor('alta')}`}>
            <div className="flex items-center gap-3">
              {getPriorityIcon('alta')}
              <div>
                <div className="font-semibold text-sm">Alta</div>
                <div className="text-xs opacity-75">Atender pronto</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1 bg-orange-600 text-white">
              {priorityCounts.alta}
            </Badge>
          </div>

          {/* Medium Priority */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${getPriorityColor('media')}`}>
            <div className="flex items-center gap-3">
              {getPriorityIcon('media')}
              <div>
                <div className="font-semibold text-sm">Media</div>
                <div className="text-xs opacity-75">Seguimiento normal</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1 bg-yellow-600 text-white">
              {priorityCounts.media}
            </Badge>
          </div>

          {/* Low Priority */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${getPriorityColor('baja')}`}>
            <div className="flex items-center gap-3">
              {getPriorityIcon('baja')}
              <div>
                <div className="font-semibold text-sm">Baja</div>
                <div className="text-xs opacity-75">Sin urgencia</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1 bg-green-600 text-white">
              {priorityCounts.baja}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Category Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Por Categoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sistemas */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-semibold text-sm text-blue-900">Sistemas</div>
                <div className="text-xs text-blue-700">Equipos de cómputo</div>
              </div>
            </div>
            <Badge className="text-base px-3 py-1 bg-blue-600 text-white">
              {categoryCounts.sistemas}
            </Badge>
          </div>

          {/* Seguridad */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-purple-50 border-purple-200">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-purple-600" />
              <div>
                <div className="font-semibold text-sm text-purple-900">Seguridad</div>
                <div className="text-xs text-purple-700">Cámaras y vigilancia</div>
              </div>
            </div>
            <Badge className="text-base px-3 py-1 bg-purple-600 text-white">
              {categoryCounts.seguridad}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Por Estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {statusCounts.pendiente_aprobacion > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pendientes de Aprobación</span>
              <Badge variant="outline">{statusCounts.pendiente_aprobacion}</Badge>
            </div>
          )}
          {statusCounts.en_proceso > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">En Proceso</span>
              <Badge variant="outline" className="bg-blue-50">{statusCounts.en_proceso}</Badge>
            </div>
          )}
          {statusCounts.pendiente_actualizacion > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pendientes de Actualización</span>
              <Badge variant="outline">{statusCounts.pendiente_actualizacion}</Badge>
            </div>
          )}
          {statusCounts.pendiente_entrega > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pendientes de Entrega</span>
              <Badge variant="outline" className="bg-green-50">{statusCounts.pendiente_entrega}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
