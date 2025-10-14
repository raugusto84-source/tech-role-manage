import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Trash2, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Order {
  id: string;
  order_number: string;
  client_id: string;
  service_type: string;
  failure_description: string;
  requested_date?: string;
  delivery_date: string;
  estimated_cost?: number;
  average_service_time?: number;
  status: 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  assigned_technician?: string;
  assignment_reason?: string;
  evidence_photos?: string[];
  created_at: string;
  unread_messages_count?: number;
  estimated_delivery_date?: string | null;
  is_policy_order?: boolean;
  service_types?: {
    name: string;
    description?: string;
    service_category?: string;
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

interface OrderListItemProps {
  order: Order;
  onClick: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  getStatusColor: (status: string) => string;
  showCollectButton: boolean;
}

export function OrderListItem({
  order,
  onClick,
  onDelete,
  canDelete,
  getStatusColor,
  showCollectButton
}: OrderListItemProps) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'Pendiente Aprobación';
      case 'pendiente_actualizacion': return 'Pendiente Actualización';
      case 'en_proceso': return 'En Proceso';
      case 'pendiente_entrega': return 'Pendiente Entrega';
      case 'finalizada': return 'Finalizada';
      case 'cancelada': return 'Cancelada';
      case 'rechazada': return 'Rechazada';
      default: return status;
    }
  };

  const calculateTotal = () => {
    if (!order.order_items || order.order_items.length === 0) {
      return order.estimated_cost || 0;
    }
    return order.order_items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  };

  return (
    <TableRow className="hover:bg-muted/50 cursor-pointer">
      <TableCell onClick={onClick} className="font-medium">
        {order.order_number}
      </TableCell>
      <TableCell onClick={onClick}>
        <div>
          <div className="font-medium">{order.clients?.name}</div>
          <div className="text-sm text-muted-foreground">{order.clients?.client_number}</div>
        </div>
      </TableCell>
      <TableCell onClick={onClick}>
        <div>
          <div className="font-medium">{order.service_types?.name}</div>
          <div className="text-sm text-muted-foreground capitalize">
            {order.service_types?.service_category}
          </div>
        </div>
      </TableCell>
      <TableCell onClick={onClick}>
        <div className="max-w-[200px] truncate" title={order.failure_description}>
          {order.failure_description}
        </div>
      </TableCell>
      <TableCell onClick={onClick}>
        <Badge className={getStatusColor(order.status)} variant="outline">
          {getStatusLabel(order.status)}
        </Badge>
      </TableCell>
      <TableCell onClick={onClick}>
        {order.technician_profile?.full_name || '-'}
      </TableCell>
      <TableCell onClick={onClick}>
        {order.estimated_delivery_date 
          ? format(new Date(order.estimated_delivery_date), 'dd/MM/yyyy', { locale: es })
          : format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
        }
      </TableCell>
      <TableCell onClick={onClick} className="text-right font-mono">
        ${calculateTotal().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          {order.is_policy_order ? (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
              📋 Póliza
            </Badge>
          ) : (
            showCollectButton && (
              order.status === 'en_proceso' || 
              order.status === 'pendiente_actualizacion' || 
              order.status === 'pendiente_entrega' || 
              order.status === 'finalizada'
            ) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // Implement collect payment logic
                }}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                title="Cobrar orden"
              >
                <CreditCard className="h-4 w-4" />
              </Button>
            )
          )}
          
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}