import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { calculateOrderPriority, orderPriorityNumberToString, OrderPriority } from '@/utils/priorityCalculator';

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
  en_espera: { label: 'ESP', className: 'bg-muted text-muted-foreground' },
  pendiente_aprobacion: { label: 'APR', className: 'bg-warning text-warning-foreground' },
  en_proceso: { label: 'PRO', className: 'bg-primary text-primary-foreground' },
  pendiente_actualizacion: { label: 'ACT', className: 'bg-orange-500 text-white' },
  pendiente_entrega: { label: 'ENT', className: 'bg-purple-500 text-white' },
  finalizada: { label: 'FIN', className: 'bg-success text-success-foreground' },
  cancelada: { label: 'CAN', className: 'bg-destructive text-destructive-foreground' },
  rechazada: { label: 'REC', className: 'bg-destructive text-destructive-foreground' },
};

const PRIORITY_INDICATOR: Record<OrderPriority, string> = {
  baja: 'bg-priority-baja',
  media: 'bg-priority-media',
  alta: 'bg-priority-alta',
  critica: 'bg-priority-critica animate-pulse',
};

export function WeeklyOrderCard({ order, onClick, category }: WeeklyOrderCardProps) {
  const calculatedPriority: OrderPriority = order.is_policy_order && order.order_priority != null
    ? orderPriorityNumberToString(order.order_priority)
    : calculateOrderPriority(order.created_at, order.estimated_delivery_date, order.delivery_date);

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.en_espera;
  const priorityClass = PRIORITY_INDICATOR[calculatedPriority];

  const categoryBorderColor = {
    sistemas: 'border-l-blue-500',
    seguridad: 'border-l-red-500',
    fraccionamientos: 'border-l-amber-500',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 bg-card rounded border-l-2 px-2 py-1.5 cursor-pointer",
        "transition-all duration-150 hover:bg-accent/50 hover:shadow-sm",
        categoryBorderColor[category]
      )}
    >
      {/* Priority indicator dot */}
      <div className={cn("w-2 h-2 rounded-full shrink-0", priorityClass)} />
      
      {/* Order number */}
      <span className="font-mono text-xs font-semibold text-primary shrink-0">
        #{order.order_number}
      </span>

      {/* Type icons (compact) */}
      {order.is_policy_order && <span className="text-xs shrink-0">📋</span>}
      {order.is_development_order && <span className="text-xs shrink-0">🏘️</span>}

      {/* Client name */}
      <span className="text-xs font-medium truncate min-w-0 flex-1">
        {order.clients?.name || '—'}
      </span>

      {/* Description (truncated) */}
      <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:block">
        {order.failure_description || ''}
      </span>

      {/* Status badge */}
      <Badge className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", statusConfig.className)}>
        {statusConfig.label}
      </Badge>
    </div>
  );
}
