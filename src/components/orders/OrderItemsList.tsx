import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Package, Clock, Share2, CheckCircle2, Play, Pause, Shield, Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';
import { formatCOPCeilToTen, formatMXNInt } from '@/utils/currency';
import { useToast } from '@/hooks/use-toast';
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
  const { getDisplayPrice } = useSalesPricingCalculation();
  const { toast } = useToast();
  
  // Estados para edición de items manuales
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    quantity: ''
  });

  // Calculate display price using the same logic as Sales (includes cashback and rounding)
  const calculateItemDisplayPrice = (item: OrderItem): number => {
    // Usar el total almacenado en el item
    if (item.total && item.total > 0) {
      return item.total;
    }

    // Fallback: calcular basado en precio unitario
    return item.unit_price * item.quantity;
  };
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        // Para items manuales, recalcular directamente
        if (item.service_type_id === 'manual') {
          const unitPrice = item.unit_price;
          const vatRate = 16;
          const totalAmount = unitPrice * newQuantity;
          const subtotal = totalAmount / (1 + vatRate / 100);
          const vatAmount = totalAmount - subtotal;

          return {
            ...item,
            quantity: newQuantity,
            subtotal,
            vat_amount: vatAmount,
            total: totalAmount
          };
        }

        // Para items regulares, usar la lógica existente
        // Calcular las horas base por unidad
        const baseTimePerUnit = item.estimated_hours / item.quantity;
        const totalEstimatedHours = newQuantity * baseTimePerUnit;
        
        // Recalcular precios usando la misma lógica de Ventas

        // Recalcular precios con la misma lógica de Ventas (incluye cashback)
        const serviceForPricing = {
          id: item.service_type_id,
          name: item.name,
          base_price: item.unit_price,
          cost_price: item.cost_price,
          vat_rate: item.vat_rate,
          item_type: item.item_type,
          profit_margin_tiers: item.profit_margin_tiers || (item as any).profit_margin_rate ? [{ min_qty: 1, max_qty: 999, margin: (item as any).profit_margin_rate }] : null
        } as any;

        const totalPrice = getDisplayPrice(serviceForPricing, newQuantity);
        const salesVatRate = (item.vat_rate ?? 16);
        const subtotal = totalPrice / (1 + salesVatRate / 100);
        const vatAmount = totalPrice - subtotal;
        const total = totalPrice;

        return {
          ...item,
          quantity: newQuantity,
          subtotal,
          vat_amount: vatAmount,
          total: total,
          estimated_hours: totalEstimatedHours
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };

  const updateItemPrice = (itemId: string, newPrice: number) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        const vatRate = item.vat_rate ?? 16;
        const totalAmount = newPrice * item.quantity;
        const subtotal = totalAmount / (1 + vatRate / 100);
        const vatAmount = totalAmount - subtotal;

        return {
          ...item,
          unit_price: newPrice,
          subtotal,
          vat_amount: vatAmount,
          total: totalAmount
        };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };

  const updateItemEstimatedHours = (itemId: string, newHours: number) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          estimated_hours: Math.max(0, newHours)
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

  const handleEditManualItem = (item: OrderItem) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      description: item.description || '',
      price: item.unit_price.toString(),
      quantity: item.quantity.toString()
    });
  };

  const handleSaveManualItem = () => {
    if (!editingItem) return;

    const price = parseFloat(editForm.price);
    const quantity = parseInt(editForm.quantity);

    if (!editForm.name.trim() || isNaN(price) || price <= 0 || quantity <= 0) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos correctamente",
        variant: "destructive"
      });
      return;
    }

    // Calcular IVA (16%)
    const vatRate = 16;
    const totalAmount = price * quantity;
    const subtotal = totalAmount / (1 + vatRate / 100);
    const vatAmount = totalAmount - subtotal;

    const updatedItems = items.map(item => {
      if (item.id === editingItem.id) {
        return {
          ...item,
          name: editForm.name,
          description: editForm.description,
          quantity,
          unit_price: price,
          subtotal,
          vat_amount: vatAmount,
          total: totalAmount
        };
      }
      return item;
    });

    onItemsChange(updatedItems);
    setEditingItem(null);
    setEditForm({ name: '', description: '', price: '', quantity: '' });

    toast({
      title: "Item actualizado",
      description: "El artículo/servicio manual ha sido actualizado correctamente"
    });
  };
  const formatCurrency = (amount: number, isManual: boolean = false): string => {
    // Para items manuales, usar formato exacto sin redondeo
    return isManual ? formatMXNInt(amount) : formatCOPCeilToTen(amount);
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
              <div className={`flex justify-between items-start py-3 px-3 rounded-lg border-l-4 my-2 ${
                item.item_type === 'servicio' 
                  ? 'border-l-blue-500 bg-blue-50/50' 
                  : 'border-l-green-500 bg-green-50/50'
              }`}>
                  <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{item.name}</h4>
                      <Badge 
                        variant={item.item_type === 'servicio' ? 'default' : 'secondary'}
                        className={`${
                          item.item_type === 'servicio' 
                            ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200' 
                            : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                        }`}
                      >
                        {item.item_type === 'servicio' ? '🔧 Servicio' : '📦 Producto'}
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
                  
                   <div className="grid grid-cols-4 gap-4 text-sm">
                     <div>
                       <Label className="text-xs">Cantidad</Label>
                       <Input 
                         type="number" 
                         min="1" 
                         value={item.quantity} 
                         onChange={e => updateItemQuantity(item.id, parseInt(e.target.value) || 1)} 
                         className="w-20 h-8 mt-1" 
                       />
                     </div>
                     
                     <div>
                       <Label className="text-xs">Precio Unit.</Label>
                       {item.service_type_id === 'manual' ? (
                         <Input 
                           type="number" 
                           min="0" 
                           step="0.01"
                           value={item.unit_price} 
                           onChange={e => updateItemPrice(item.id, parseFloat(e.target.value) || 0)} 
                           className="w-24 h-8 mt-1" 
                         />
                       ) : (
                         <div className="text-muted-foreground mt-1">
                           {formatCurrency(item.unit_price, false)}
                         </div>
                       )}
                     </div>
                     
                     <div>
                       <Label className="text-xs">Tiempo Est.</Label>
                       {item.service_type_id === 'manual' ? (
                         <Input 
                           type="number" 
                           min="0" 
                           step="0.5"
                           value={item.estimated_hours} 
                           onChange={e => updateItemEstimatedHours(item.id, parseFloat(e.target.value) || 0)} 
                           className="w-20 h-8 mt-1" 
                         />
                       ) : (
                         <div className="text-blue-600 mt-1 flex items-center gap-1">
                           <Clock className="h-3 w-3" />
                           {formatHours(item.estimated_hours)}
                         </div>
                       )}
                     </div>
                     
                     <div>
                       <Label className="text-xs">Total</Label>
                       <div className="font-bold text-primary mt-1">
                         {formatCurrency(calculateItemDisplayPrice(item), item.service_type_id === 'manual')}
                       </div>
                     </div>
                   </div>
                 </div>
                 
                  <div className="flex gap-2 ml-4">
                    {/* Mostrar botón de editar solo para items manuales */}
                    {item.service_type_id === 'manual' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditManualItem(item)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => removeItem(item.id)} 
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              <div className="text-2xl font-bold text-green-600">
                {formatMXNInt(getTotalAmount())}
              </div>
              <div className="text-sm text-muted-foreground">Total General</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para editar item manual */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Artículo/Servicio Manual</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Precio Total (con IVA) *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Cantidad *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingItem(null);
                setEditForm({ name: '', description: '', price: '', quantity: '' });
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveManualItem}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}