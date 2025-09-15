import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, DollarSign, Clock, Trash2, Eye, MapPin, Home } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { Skeleton } from '@/components/ui/skeleton';

interface SimpleOrderCardProps {
  order: {
    id: string;
    order_number: string;
    client_id: string;
    service_type: string;
    failure_description: string;
    requested_date?: string;
    delivery_date: string;
    estimated_cost?: number;
    average_service_time?: number;
    status: string;
    assigned_technician?: string;
    created_at: string;
    estimated_delivery_date?: string | null;
    is_home_service?: boolean;
    service_location?: any;
    travel_time_hours?: number;
    service_types?: {
      name: string;
      description?: string;
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
  };
  onView: () => void;
  onDelete?: (orderId: string) => void;
  canDelete?: boolean;
  getStatusColor: (status: string) => string;
}

export function SimpleOrderCard({ 
  order, 
  onView, 
  onDelete, 
  canDelete, 
  getStatusColor 
}: SimpleOrderCardProps) {
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const { settings: rewardSettings } = useRewardSettings();

  useEffect(() => {
    const loadOrderItems = async () => {
      setItemsLoading(true);
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            quantity,
            unit_cost_price,
            unit_base_price, 
            vat_rate,
            item_type,
            profit_margin_rate,
            pricing_locked,
            total_amount
          `)
          .eq('order_id', order.id);

        if (error) throw error;
        setOrderItems(data || []);
      } catch (error) {
        console.error('Error loading order items for simple card:', error);
        setOrderItems([]);
      } finally {
        setItemsLoading(false);
      }
    };

    loadOrderItems();
  }, [order.id]);

  // Calcula el precio correcto por item - MISMA LÓGICA QUE OrderCard
  const calculateItemDisplayPrice = (item: any): number => {
    // Fallback para órdenes antiguas: usar total guardado si está bloqueado o faltan datos
    const hasStoredTotal = typeof item.total_amount === 'number' && item.total_amount > 0;
    const isLocked = Boolean(item.pricing_locked);
    const missingKeyData = (item.item_type === 'servicio')
      ? (!item.unit_base_price || item.unit_base_price <= 0)
      : (!item.unit_cost_price || item.unit_cost_price <= 0);

    if (hasStoredTotal && (isLocked || missingKeyData)) {
      return Number(item.total_amount);
    }

    const quantity = item.quantity || 1;
    const salesVatRate = item.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items ? (rewardSettings.general_cashback_percent || 0) : 0;

    if (item.item_type === 'servicio') {
      const basePrice = (item.unit_base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
      const purchaseVatRate = 16;
      const baseCost = (item.unit_cost_price || 0) * quantity;
      const profitMargin = item.profit_margin_rate || 20;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + profitMargin / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    }
  };

  // Total con IVA - usar totales guardados cuando existan
  const calculateCorrectTotal = () => {
    if (itemsLoading) {
      return 0;
    }
    
    if (orderItems && orderItems.length > 0) {
      // Sumar cada tarjeta como se muestra: redondear cada ítem a 10 y luego sumar
      return orderItems.reduce((sum, item) => sum + ceilToTen(calculateItemDisplayPrice(item)), 0);
    }
    
    // Solo usar estimated_cost como último recurso si no hay items
    const defaultVatRate = 16;
    const base = order.estimated_cost || 0;
    return base * (1 + defaultVatRate / 100);
  };

  // Guarda el total de la UI en la tabla order_final_totals
  const saveUITotalToDatabase = async (uiTotal: number) => {
    try {
      const { error } = await supabase
        .from('order_final_totals')
        .upsert({
          order_id: order.id,
          final_total_amount: uiTotal,
          display_subtotal: uiTotal / 1.16, // Aproximación del subtotal
          display_vat_amount: uiTotal - (uiTotal / 1.16), // Aproximación del IVA
          calculation_source: 'ui_calculation',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'order_id'
        });

      if (error) {
        console.error('Error saving UI total to database:', error);
      }
    } catch (error) {
      console.error('Error saving UI total:', error);
    }
  };

  // Efecto para guardar el total cuando cambie
  useEffect(() => {
    if (!itemsLoading && orderItems.length > 0) {
      const uiTotal = calculateCorrectTotal();
      if (uiTotal > 0) {
        saveUITotalToDatabase(uiTotal);
      }
    }
  }, [orderItems, itemsLoading, rewardSettings]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion': return 'PEND. APROB.';
      case 'en_proceso': return 'EN PROCESO';
      case 'pendiente_actualizacion': return 'PEND. ACTUAL.';
      case 'pendiente_entrega': return 'PEND. ENTREGA';
      case 'finalizada': return 'FINALIZADA';
      case 'cancelada': return 'CANCELADA';
      default: return status.toUpperCase();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(order.id);
    }
  };

  return (
    <Card 
      className="hover:shadow-sm transition-all cursor-pointer border-l-4 border-l-primary"
      onClick={onView}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-primary">
              {order.order_number}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {order.clients?.name || "Cliente no especificado"}
              </span>
              {order.clients?.client_number && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {order.clients.client_number}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${getStatusColor(order.status)} text-xs`}>
              {getStatusText(order.status)}
            </Badge>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Servicio */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-muted-foreground">Servicio:</span>
            <span className="text-sm truncate">
              {order.service_types?.name || "No especificado"}
            </span>
          </div>
          {order.is_home_service && (
            <div className="flex items-center gap-1 text-blue-600">
              <Home className="h-4 w-4" />
              <span className="text-xs font-medium">Domicilio</span>
            </div>
          )}
        </div>

        {/* Fecha de entrega */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Fecha:</span>
          <span className="text-sm">
            {order.estimated_delivery_date 
              ? formatDate(order.estimated_delivery_date) 
              : formatDate(order.delivery_date)}
          </span>
        </div>

        {/* Técnico asignado */}
        {order.technician_profile && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Técnico:</span>
            <span className="text-sm">
              {order.technician_profile.full_name}
              {order.support_technicians && order.support_technicians.length > 0 && 
                ` +${order.support_technicians.length}`
              }
            </span>
          </div>
        )}

        {/* Descripción */}
        <div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {order.failure_description}
          </p>
        </div>

        {/* Total con IVA prominente */}
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-muted-foreground">Total con IVA:</span>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              {itemsLoading ? (
                <Skeleton className="h-6 w-24 rounded" />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {formatCOPCeilToTen(calculateCorrectTotal())}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botón de ver detalles */}
        <div className="flex justify-end pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}