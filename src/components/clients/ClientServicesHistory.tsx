import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
import { Search, ShoppingCart, Calendar, DollarSign, User, Wrench, Eye } from 'lucide-react';

interface OrderItem {
  service_name: string;
  quantity: number;
  unit_cost_price?: number;
  unit_base_price?: number;
  vat_rate?: number;
  item_type?: string;
  profit_margin_rate?: number;
  pricing_locked?: boolean;
  subtotal?: number;
  vat_amount?: number;
  total_amount?: number;
}

interface OrderWithDetails {
  id: string;
  order_number: string;
  status: string;
  estimated_amount: number;
  created_at: string;
  client: {
    name: string;
    email: string;
  } | null;
  technician_name?: string;
  items: OrderItem[];
}

/**
 * Componente para mostrar el historial completo de servicios/órdenes de todos los clientes
 * Incluye filtros por estado, cliente y técnico asignado
 */
export function ClientServicesHistory() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const { settings: rewardSettings } = useRewardSettings();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Cargar órdenes con información de cliente desde la tabla clients
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Cargar información completa para cada orden
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          // Cargar información del cliente desde la tabla clients
          let clientInfo = null;
          if (order.client_id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('name, email')
              .eq('id', order.client_id)
              .single();
            clientInfo = clientData;
          }

          // Cargar ítems de la orden - usar solo columnas que existen
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('service_name, quantity, unit_cost_price, unit_base_price, vat_rate, item_type, profit_margin_rate, pricing_locked, total_amount')
            .eq('order_id', order.id);

          // Cargar información del técnico si existe
          let technicianName = undefined;
          if (order.assigned_technician) {
            const { data: techData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', order.assigned_technician)
              .single();
            technicianName = techData?.full_name;
          }

          return {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            estimated_amount: order.estimated_cost || 0,
            created_at: order.created_at,
            client: clientInfo ? { 
              name: clientInfo.name, 
              email: clientInfo.email 
            } : null,
            technician_name: technicianName,
            items: itemsData || []
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes de servicio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendiente_aprobacion':
        return 'bg-yellow-100 text-yellow-800';
      case 'en_proceso':
        return 'bg-orange-100 text-orange-800';
      case 'pendiente_actualizacion':
        return 'bg-blue-100 text-blue-800';
      case 'pendiente_entrega':
        return 'bg-green-100 text-green-800';
      case 'cancelada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pendiente_aprobacion': 'Pendiente Aprobación',
      'en_proceso': 'En Proceso',
      'pendiente_actualizacion': 'Pendiente Actualización',
      'pendiente_entrega': 'Pendiente Entrega',
      'cancelada': 'Cancelada'
    };
    return labels[status] || status;
  };

  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  // Calcular total por ítem con la MISMA lógica que OrderCard/OrderDetails
  const calculateItemDisplayPrice = (item: OrderItem): number => {
    const hasStoredTotal = typeof item.total_amount === 'number' && (item.total_amount || 0) > 0;
    const isLocked = Boolean(item.pricing_locked);
    const missingKeyData = (item.item_type === 'servicio')
      ? (!item.unit_base_price || item.unit_base_price <= 0)
      : (!item.unit_cost_price || item.unit_cost_price <= 0);

    if (hasStoredTotal && (isLocked || missingKeyData)) {
      return Number(item.total_amount);
    }

    const quantity = item.quantity || 1;
    const salesVatRate = (item.vat_rate ?? 16);
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

  const calculateOrderTotal = (items: OrderItem[]): number => {
    return items.reduce((sum, item) => sum + ceilToTen(calculateItemDisplayPrice(item)), 0);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.technician_name && order.technician_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.items.some(item => item.service_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Cargando historial de servicios...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Historial de Servicios ({orders.length})
        </CardTitle>
        
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por orden, cliente, técnico o servicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {['all', 'pendiente', 'en_proceso', 'finalizada', 'cancelada', 'en_camino'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'Todas' : getStatusLabel(status)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">#{order.order_number}</h3>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{order.client?.name}</span>
                      <span className="text-sm text-muted-foreground">({order.client?.email})</span>
                    </div>
                    
                    {order.technician_name && (
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Técnico: {order.technician_name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Servicios:</p>
                    {order.items.map((item, index) => (
                      <div key={index} className="text-sm text-muted-foreground ml-4">
                        • {item.service_name} (x{item.quantity}) - {formatCurrency(calculateItemDisplayPrice(item))}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Creada: {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(calculateOrderTotal(order.items))}
                  </div>
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4 mr-1" />
                    Ver detalles
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          
          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron órdenes con ese criterio' 
                : 'No hay órdenes registradas'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}