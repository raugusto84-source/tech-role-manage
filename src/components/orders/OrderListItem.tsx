import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Trash2, CreditCard, Clock, Play } from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { OrderPDFButton } from "./OrderPDFButton";
import { es } from "date-fns/locale";
import { useOrderElapsedTime } from "@/hooks/useOrderElapsedTime";
import { calculateOrderPriority, getPriorityBadgeClass, getPriorityLabel, orderPriorityNumberToString } from "@/utils/priorityCalculator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  status: 'en_espera' | 'pendiente_aprobacion' | 'en_proceso' | 'pendiente_actualizacion' | 'pendiente_entrega' | 'finalizada' | 'cancelada' | 'rechazada';
  assigned_technician?: string;
  assignment_reason?: string;
  evidence_photos?: string[];
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  unread_messages_count?: number;
  estimated_delivery_date?: string | null;
  is_policy_order?: boolean;
  is_development_order?: boolean;
  order_priority?: number | null;
  priority: 'baja' | 'media' | 'alta' | 'critica';
  special_price_enabled?: boolean;
  special_price?: number | null;
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
    fleet_name?: string;
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
  onCollect?: () => void;
  onStatusChange?: () => void;
}

export function OrderListItem({
  order,
  onClick,
  onDelete,
  canDelete,
  getStatusColor,
  showCollectButton,
  onCollect,
  onStatusChange
}: OrderListItemProps) {
  const [showActivateDialog, setShowActivateDialog] = useState(false);

  const handleActivateOrder = async () => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'en_proceso' })
        .eq('id', order.id);

      if (error) throw error;

      // Log status change
      await supabase.from('order_status_logs').insert({
        order_id: order.id,
        previous_status: 'en_espera' as const,
        new_status: 'en_proceso' as const,
        notes: 'Orden activada desde lista de órdenes',
        changed_by: (await supabase.auth.getUser()).data.user?.id || ''
      });

      toast.success('Orden activada correctamente');
      setShowActivateDialog(false);
      onStatusChange?.();
    } catch (error) {
      console.error('Error activating order:', error);
      toast.error('Error al activar la orden');
    }
  };
  const { elapsedTime, totalTime, loading: timeLoading } = useOrderElapsedTime(order.id, order.status, order.created_at);
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'en_espera': return 'En Espera';
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
    // First calculate from items
    let calculatedTotal = 0;
    if (order.order_items && order.order_items.length > 0) {
      calculatedTotal = order.order_items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    } else {
      calculatedTotal = order.estimated_cost || 0;
    }
    
    // Use special price if enabled
    if (order.special_price_enabled && typeof order.special_price === 'number') {
      return { total: order.special_price, originalTotal: calculatedTotal, isSpecial: true };
    }
    
    return { total: calculatedTotal, originalTotal: calculatedTotal, isSpecial: false };
  };

  const priceInfo = calculateTotal();

  // Para órdenes de póliza usar la prioridad asignada, para otras calcular dinámicamente
  const calculatedPriority = order.is_policy_order && order.order_priority != null
    ? orderPriorityNumberToString(order.order_priority)
    : calculateOrderPriority(
        order.created_at,
        order.estimated_delivery_date,
        order.delivery_date
      );

  // Determinar el color de fondo según la fecha de entrega
  const deliveryDateStr = order.estimated_delivery_date || order.delivery_date;
  const deliveryDate = deliveryDateStr ? new Date(deliveryDateStr + 'T12:00:00Z') : null;
  const isDeliveryToday = deliveryDate ? isToday(deliveryDate) : false;
  const isDeliveryPast = deliveryDate ? isBefore(deliveryDate, startOfDay(new Date())) : false;
  const isDeliveryFuture = deliveryDate ? !isDeliveryToday && !isDeliveryPast : false;
  
  // Helper para formatear fechas de forma segura
  const safeFormatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr + 'T12:00:00Z'), 'dd/MM/yyyy', { locale: es });
    } catch {
      return '-';
    }
  };

  // Clases CSS condicionales para el fondo
  const rowClassName = isDeliveryPast
    ? "hover:bg-muted/50 cursor-pointer bg-red-50 dark:bg-red-950/20"
    : isDeliveryToday 
    ? "hover:bg-muted/50 cursor-pointer bg-blue-50 dark:bg-blue-950/20" 
    : isDeliveryFuture 
    ? "hover:bg-muted/50 cursor-pointer bg-green-50 dark:bg-green-950/20"
    : "hover:bg-muted/50 cursor-pointer";

  return (
    <TableRow className={rowClassName}>
      <TableCell onClick={onClick} className="font-medium">
        {order.order_number}
      </TableCell>
      <TableCell onClick={onClick}>
        <div>
          <div className="font-medium">{order.clients?.name}</div>
          <div className="text-sm text-muted-foreground">{order.clients?.client_number}</div>
          {order.created_by_name && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Creó: {order.created_by_name}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell onClick={onClick}>
        <Badge className={getPriorityBadgeClass(calculatedPriority)} variant="outline">
          {getPriorityLabel(calculatedPriority)}
        </Badge>
      </TableCell>
      <TableCell onClick={onClick}>
        <div className="max-w-[200px] truncate" title={order.failure_description}>
          {order.failure_description}
        </div>
      </TableCell>
      <TableCell onClick={onClick}>
        <div className="space-y-1">
          <Badge className={getStatusColor(order.status)} variant="outline">
            {getStatusLabel(order.status)}
          </Badge>
          {!timeLoading && (
            <div className="space-y-0.5">
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
      </TableCell>
      <TableCell onClick={onClick}>
        {order.technician_profile?.full_name ? (
          <div className="space-y-0.5">
            <div className="font-medium">{order.technician_profile.full_name}</div>
            {order.technician_profile.fleet_name && (
              <div className="text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {order.technician_profile.fleet_name}
                </Badge>
              </div>
            )}
          </div>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell onClick={onClick}>
        {/* Para órdenes de fraccionamiento: delivery_date es agendado, estimated_delivery_date es entrega */}
        {order.is_development_order && order.delivery_date ? (
          <div className="text-sm">
            <div className="font-medium">
              {safeFormatDate(order.delivery_date)}
            </div>
            <div className="text-xs text-muted-foreground">Agendado</div>
          </div>
        ) : (
          safeFormatDate(order.estimated_delivery_date || order.delivery_date)
        )}
      </TableCell>
      <TableCell onClick={onClick}>
        {safeFormatDate(order.estimated_delivery_date || order.delivery_date)}
      </TableCell>
      <TableCell onClick={onClick} className="text-right font-mono">
        <div className="flex flex-col items-end">
          <span className={priceInfo.isSpecial ? 'text-amber-600 font-semibold' : ''}>
            ${priceInfo.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </span>
          {priceInfo.isSpecial && (
            <span className="text-xs text-muted-foreground line-through">
              ${priceInfo.originalTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <OrderPDFButton order={order} />
          
          {order.status === 'en_espera' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowActivateDialog(true);
              }}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
              title="Activar orden"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}

          {order.is_development_order ? (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
              🏘️ Fracc.
            </Badge>
          ) : order.is_policy_order ? (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
              📋 Póliza
            </Badge>
          ) : (
            showCollectButton && onCollect && (
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
                  onCollect();
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

        {/* Activate Order Confirmation Dialog */}
        <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Activar orden?</AlertDialogTitle>
              <AlertDialogDescription>
                Al activar esta orden, el tiempo de servicio comenzará a correr. ¿Estás seguro de que deseas continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleActivateOrder} className="bg-green-600 hover:bg-green-700">
                Activar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}