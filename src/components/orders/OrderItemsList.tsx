import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Package, Clock, Share2, CheckCircle2, Play, Pause, Shield } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRewardSettings } from '@/hooks/useRewardSettings';
export interface OrderItem {
  id: string;
  service_type_id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number; // Add cost_price for proper calculation
  estimated_hours: number;
  subtotal: number;
  original_subtotal?: number; // Precio original antes de descuento de póliza
  policy_discount_percentage?: number; // Porcentaje de descuento por póliza
  policy_discount_amount?: number; // Monto del descuento por póliza
  policy_name?: string; // Nombre de la póliza aplicada
  vat_rate: number;
  vat_amount: number;
  total: number;
  item_type: string;
  shared_time: boolean; // Nueva propiedad para tiempo compartido
  status?: 'pendiente' | 'en_proceso' | 'completado'; // Estado individual del artículo
  profit_margin_tiers?: Array<{
    min_qty: number;
    max_qty: number;
    margin: number;
  }>; // Add profit margin tiers for proper calculation
}
interface OrderItemsListProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}
export function OrderItemsList({
  items,
  onItemsChange
}: OrderItemsListProps) {
  const { settings: rewardSettings } = useRewardSettings();

  // Calculate display price using same logic as ProductServiceSeparator
  const calculateItemDisplayPrice = (item: OrderItem): number => {
    const salesVatRate = item.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;

    if (item.item_type === 'servicio') {
      // Para servicios: precio base + IVA + cashback
      const basePrice = item.unit_price * item.quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
      // Para artículos: utilizar cost_price como costo base
      const purchaseVatRate = 16;
      const baseCost = (item.cost_price || item.unit_price) * item.quantity;
      
      const marginPercent = item.profit_margin_tiers && item.profit_margin_tiers.length > 0 
        ? item.profit_margin_tiers[0].margin 
        : 20;
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + marginPercent / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      
      return finalWithCashback;
    }
  };
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        // En lugar de dividir las horas actuales por la cantidad actual,
        // necesitamos obtener las horas base del servicio original.
        // Como no tenemos acceso directo al servicio, usaremos las horas divididas
        // por la cantidad como aproximación, pero esto debería idealmente
        // almacenarse como "horas_por_unidad" en el item.
        const baseTimePerUnit = item.estimated_hours / item.quantity;
        const subtotal = newQuantity * item.unit_price;
        const vatAmount = subtotal * 0.16; // Fixed 16% VAT
        const total = subtotal + vatAmount;
        const totalEstimatedHours = newQuantity * baseTimePerUnit;
        return {
          ...item,
          quantity: newQuantity,
          subtotal,
          vat_amount: vatAmount,
          total,
          estimated_hours: totalEstimatedHours
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };
  const toggleSharedTime = (itemId: string) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          shared_time: !item.shared_time
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };
  const updateItemStatus = (itemId: string, status: 'pendiente' | 'en_proceso' | 'completado') => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };
  const removeItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    onItemsChange(updatedItems);
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };
  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours} h`;
  };
  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + calculateItemDisplayPrice(item), 0);
  };
  const getTotalHours = () => {
    let totalHours = 0;

    // Agrupar items por shared_time
    const sharedItems = items.filter(item => item.shared_time);
    const individualItems = items.filter(item => !item.shared_time);

    // Para items individuales, sumar normalmente
    individualItems.forEach(item => {
      totalHours += item.estimated_hours || 0;
    });

    // Para items con tiempo compartido, aplicar lógica simple por servicio
    const sharedItemsByService = new Map<string, typeof items>();
    sharedItems.forEach(item => {
      const serviceKey = item.service_type_id || 'unknown';
      if (!sharedItemsByService.has(serviceKey)) {
        sharedItemsByService.set(serviceKey, []);
      }
      sharedItemsByService.get(serviceKey)!.push(item);
    });

    // Para cada tipo de servicio con tiempo compartido
    sharedItemsByService.forEach(serviceItems => {
      // Expandir los items por cantidad para aplicar correctamente los porcentajes
      const expandedItems: {
        baseTime: number;
        itemId: string;
      }[] = [];
      serviceItems.forEach(item => {
        const baseTimePerUnit = item.estimated_hours / item.quantity;
        for (let i = 0; i < item.quantity; i++) {
          expandedItems.push({
            baseTime: baseTimePerUnit,
            itemId: item.id
          });
        }
      });

      // Aplicar porcentajes a cada unidad expandida
      expandedItems.forEach((expandedItem, index) => {
        // Calcular porcentaje según posición: 1ro=100%, 2do=20%, 3ro=20%, 4to=100%, etc.
        let percentage = 1.0; // 100% por defecto
        const position = index % 3 + 1; // Ciclo de 3: posición 1, 2, 3, luego vuelve a 1

        if (position === 2 || position === 3) {
          percentage = 0.2; // 20%
        }
        totalHours += expandedItem.baseTime * percentage;
      });
    });
    return totalHours;
  };
  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };
  if (items.length === 0) {
    return <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay artículos agregados a la orden</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona servicios o productos para comenzar
            </p>
          </div>
        </CardContent>
      </Card>;
  }
  return <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Artículos de la Orden ({getTotalItems()})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => <div key={item.id}>
              {index > 0 && <Separator />}
              <div className="flex justify-between items-start py-2">
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{item.name}</h4>
                      <Badge variant={item.item_type === 'servicio' ? 'default' : 'secondary'}>
                        {item.item_type}
                      </Badge>
                      {/* Mostrar badge de póliza si aplica */}
                       {item.policy_name && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                           <Shield className="h-3 w-3 mr-1" />
                           {item.policy_name}
                         </Badge>}
                    </div>
                  
                  {item.description && <p className="text-sm text-muted-foreground mb-3">
                      {item.description}
                    </p>}
                  
                   <div className="grid grid-cols-3 gap-4 text-sm">
                     <div>
                       <Label className="text-xs">Cantidad</Label>
                       <Input type="number" min="1" value={item.quantity} onChange={e => updateItemQuantity(item.id, parseInt(e.target.value) || 1)} className="w-20 h-8 mt-1" />
                     </div>
                     
                     <div className="flex items-center gap-1">
                       <Clock className="h-4 w-4 text-blue-600" />
                       <div>
                         <Label className="text-xs">Tiempo Est.</Label>
                         <div className="text-blue-600 mt-1">
                           {formatHours(item.estimated_hours)}
                         </div>
                       </div>
                     </div>
                     
                     <div>
                       <Label className="text-xs">Total</Label>
                       <div className="font-bold text-primary mt-1">
                         {formatCurrency(calculateItemDisplayPrice(item))}
                       </div>
                     </div>
                   </div>
                 </div>
                 
                 <Button variant="outline" size="sm" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive ml-4">
                   <Trash2 className="h-4 w-4" />
                 </Button>
               </div>
             </div>)}
        </CardContent>
      </Card>

      {/* Resumen Total */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{getTotalItems()}</div>
              <div className="text-sm text-muted-foreground">Artículos</div>
            </div>
            
             <div className="text-center">
               <div className="flex items-center justify-center gap-1">
                 <Clock className="h-5 w-5 text-blue-600" />
                 <div className="text-2xl font-bold text-blue-600">{formatHours(getTotalHours())}</div>
               </div>
               <div className="text-sm text-muted-foreground">Tiempo Total Est.</div>
             </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(getTotalAmount())}</div>
              <div className="text-sm text-muted-foreground">Total General</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
}