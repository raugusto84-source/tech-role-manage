import { Badge } from '@/components/ui/badge';
import { Clock, User, DollarSign, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateOrderPriority, getPriorityLabel, orderPriorityNumberToString, OrderPriority } from '@/utils/priorityCalculator';

interface Order {
  id: string;
  order_number: string;
  failure_description: string;
  estimated_cost?: number;
  status: 'en_espera' | 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  created_at: string;
  delivery_date: string;
  estimated_delivery_date?: string | null;
  priority: 'baja' | 'media' | 'alta' | 'critica';
  order_priority?: number | null;
  is_policy_order?: boolean;
  is_development_order?: boolean;
  special_price_enabled?: boolean;
  special_price?: number | null;
  clients?: {
    name: string;
    client_number: string;
  } | null;
  technician_profile?: {
    full_name: string;
  } | null;
  order_items?: Array<{
    id: string;
    service_type_id: string;
    service_name: string;
    service_description?: string;
    quantity: number;
    unit_cost_price: number;
    unit_base_price: number;
    profit_margin_rate: number;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    item_type: string;
    status: string;
    service_types?: {
      name: string;
      description?: string;
      service_category?: string;
    } | null;
  }>;
}

interface WeeklyOrderCardProps {
  order: Order;
  onClick: () => void;
  category: 'sistemas' | 'seguridad' | 'fraccionamientos';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  en_espera: { 
    label: 'En Espera', 
    className: 'bg-slate-500 text-white border-slate-600' 
  },
  pendiente_aprobacion: { 
    label: 'Pend. Aprob.', 
    className: 'bg-yellow-500 text-white border-yellow-600' 
  },
  en_proceso: { 
    label: 'En Proceso', 
    className: 'bg-blue-500 text-white border-blue-600' 
  },
  pendiente_actualizacion: { 
    label: 'Pend. Actualiz.', 
    className: 'bg-orange-500 text-white border-orange-600' 
  },
  pendiente_entrega: { 
    label: 'Pend. Entrega', 
    className: 'bg-purple-500 text-white border-purple-600' 
  },
  finalizada: { 
    label: 'Finalizada', 
    className: 'bg-green-500 text-white border-green-600' 
  },
  cancelada: { 
    label: 'Cancelada', 
    className: 'bg-red-500 text-white border-red-600' 
  },
  rechazada: { 
    label: 'Rechazada', 
    className: 'bg-red-700 text-white border-red-800' 
  },
};

const PRIORITY_CONFIG: Record<OrderPriority, { className: string }> = {
  baja: { className: 'bg-priority-baja text-priority-baja-foreground' },
  media: { className: 'bg-priority-media text-priority-media-foreground' },
  alta: { className: 'bg-priority-alta text-priority-alta-foreground' },
  critica: { className: 'bg-priority-critica text-priority-critica-foreground animate-pulse' },
};

export function WeeklyOrderCard({ order, onClick, category }: WeeklyOrderCardProps) {
  // Calculate priority
  const calculatedPriority: OrderPriority = order.is_policy_order && order.order_priority != null
    ? orderPriorityNumberToString(order.order_priority)
    : calculateOrderPriority(order.created_at, order.estimated_delivery_date, order.delivery_date);

  // Calculate total
  const calculateTotal = (): number => {
    if (order.special_price_enabled && typeof order.special_price === 'number') {
      return order.special_price;
    }
    if (order.order_items && order.order_items.length > 0) {
      return order.order_items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    }
    return order.estimated_cost || 0;
  };

  const total = calculateTotal();
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.en_espera;
  const priorityConfig = PRIORITY_CONFIG[calculatedPriority];

  // Border left color based on category
  const categoryBorderColor = {
    sistemas: 'border-l-blue-500',
    seguridad: 'border-l-red-500',
    fraccionamientos: 'border-l-amber-500',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-lg border-2 border-l-4 p-3 cursor-pointer",
        "transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
        "hover:border-primary/50",
        categoryBorderColor[category]
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-primary text-sm">
            #{order.order_number}
          </span>
          {order.is_policy_order && (
            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
              📋
            </Badge>
          )}
          {order.is_development_order && (
            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
              🏘️
            </Badge>
          )}
        </div>
        <Badge className={cn("text-xs font-semibold shrink-0", statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Client */}
      <div className="flex items-center gap-1.5 text-sm mb-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">
          {order.clients?.name || 'Sin cliente'}
        </span>
      </div>

      {/* Description */}
      <div className="flex items-start gap-1.5 text-sm text-muted-foreground mb-2">
        <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span className="line-clamp-2 text-xs">
          {order.failure_description || 'Sin descripción'}
        </span>
      </div>

      {/* Footer Row */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        {/* Priority */}
        <Badge className={cn("text-xs font-bold", priorityConfig.className)}>
          {getPriorityLabel(calculatedPriority)}
        </Badge>

        {/* Total */}
        <div className="flex items-center gap-1 text-sm font-mono font-semibold text-foreground">
          <DollarSign className="h-3.5 w-3.5 text-success" />
          {total.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  );
}
