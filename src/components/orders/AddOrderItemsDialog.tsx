import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
// Removed useRewardSettings import - cashback system eliminated
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, ShoppingCart, CheckCircle2, Search, Shield, Monitor, Package, X, PenLine } from 'lucide-react';
import { ceilToTen } from '@/utils/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
interface AddOrderItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onItemsAdded: () => void;
}
interface ServiceType {
  id: string;
  name: string;
  description?: string;
  cost_price?: number;
  base_price?: number;
  vat_rate?: number;
  item_type: string;
  category?: string;
  service_category?: string;
  profit_margin_rate?: number;
  profit_margin_tiers?: Array<{
    margin: number;
    min_qty?: number;
    max_qty?: number;
  }>;
}
interface NewItem {
  service_type_id: string;
  service_name: string;
  quantity: number;
  unit_cost_price: number;
  unit_base_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  item_type: string;
  profit_margin_rate: number;
}
export function AddOrderItemsDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onItemsAdded
}: AddOrderItemsDialogProps) {
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [reason, setReason] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFreeItemForm, setShowFreeItemForm] = useState(false);
  const [freeItemName, setFreeItemName] = useState('');
  const [freeItemDescription, setFreeItemDescription] = useState('');
  const [freeItemType, setFreeItemType] = useState<'servicio' | 'articulo'>('servicio');
  const [freeItemPrice, setFreeItemPrice] = useState('');
  const [freeItemQuantity, setFreeItemQuantity] = useState(1);
  useEffect(() => {
    if (open) {
      loadServiceTypes();
      setNewItems([]);
      setReason('');
      setSelectedMainCategory(null);
      setSearchTerm('');
      setShowFreeItemForm(false);
      setFreeItemName('');
      setFreeItemDescription('');
      setFreeItemType('servicio');
      setFreeItemPrice('');
      setFreeItemQuantity(1);
    }
  }, [open]);
  const loadServiceTypes = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('service_types').select('*').eq('is_active', true).order('category, name');
      if (error) throw error;
      const transformed = (data || []).map((service: any) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        cost_price: service.cost_price,
        base_price: service.base_price,
        vat_rate: service.vat_rate,
        item_type: service.item_type,
        category: service.category,
        service_category: service.service_category,
        profit_margin_rate: service.profit_margin_rate,
        profit_margin_tiers: Array.isArray(service.profit_margin_tiers) ? service.profit_margin_tiers : []
      }));
      setServiceTypes(transformed);
    } catch (error) {
      console.error('Error loading service types:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios disponibles",
        variant: "destructive"
      });
    }
  };

  // Usar la misma lógica de cálculo de precios que en ventas
  // Simplified price calculation without cashback
  const calculateDisplayPrice = (service: ServiceType, quantity: number = 1): number => {
    const salesVatRate = service.vat_rate || 16;

    if (service.item_type === 'servicio') {
      const basePrice = (service.base_price || 0) * quantity;
      const withVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(withVat); // Aplicar redondeo
    } else {
      const purchaseVatRate = 16;
      const baseCost = (service.cost_price || 0) * quantity;
      const marginPercent = service.profit_margin_tiers?.[0]?.margin || 30;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + marginPercent / 100);
      const withSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(withSalesVat); // Aplicar redondeo
    }
  };

  // Calcular precio correcto para items ya agregados
  const calculateItemCorrectPrice = (item: NewItem): number => {
    const quantity = item.quantity || 1;
    const unitPrice = item.unit_base_price || 0;
    const vatRate = item.vat_rate || 16;
    const subtotal = unitPrice * quantity;
    const withVat = subtotal * (1 + vatRate / 100);
    return ceilToTen(withVat); // Usar ceilToTen consistentemente
  };

  // Group by service_category field instead of hardcoded category lists
  const getMainCategoryIcon = (mainCategory: string) => {
    switch (mainCategory) {
      case 'Seguridad':
        return Shield;
      case 'Sistemas':
        return Monitor;
      case 'Todos':
        return Package;
      default:
        return Package;
    }
  };
  const getFilteredServices = (mainCategory: string, itemType: string) => {
    if (mainCategory === 'Todos') {
      return serviceTypes.filter(service => service.item_type === itemType && (searchTerm === '' || service.name.toLowerCase().includes(searchTerm.toLowerCase()) || (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))));
    }
    const serviceCategoryValue = mainCategory.toLowerCase(); // 'seguridad' or 'sistemas'
    return serviceTypes.filter(service => {
      const serviceCategory = (service as any).service_category?.toLowerCase() || '';
      return serviceCategory === serviceCategoryValue && service.item_type === itemType && (searchTerm === '' || service.name.toLowerCase().includes(searchTerm.toLowerCase()) || (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase())));
    });
  };
  const addServiceToItems = (service: ServiceType) => {
    // Verificar si el servicio ya existe en la lista
    const existingItemIndex = newItems.findIndex(item => item.service_type_id === service.id);
    
    if (existingItemIndex !== -1) {
      // Si existe, aumentar la cantidad en 1
      const updatedItems = [...newItems];
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + 1;
      
      // Recalcular totales con la nueva cantidad
      const unitBaseSale = existingItem.unit_base_price;
      const subtotal = unitBaseSale * newQuantity;
      const vatAmount = subtotal * existingItem.vat_rate / 100;
      const totalAmount = calculateDisplayPrice(service, newQuantity);
      
      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount
      };
      
      setNewItems(updatedItems);
      return;
    }

    // Si no existe, crear nuevo item
    const calculatedPrice = calculateDisplayPrice(service);
    const vatRate = service.vat_rate || 16;

    // Calcular precio base de venta (sin IVA ni cashback)
    let unitBaseSale = 0;
    let profitMarginUsed = 0;
    if (service.item_type === 'servicio') {
      unitBaseSale = service.base_price || 0;
    } else {
      const marginPercent = service.profit_margin_tiers && service.profit_margin_tiers.length > 0 ? service.profit_margin_tiers[0].margin || 30 : 30;
      profitMarginUsed = marginPercent;
      const cost = service.cost_price || 0;
      const costWithPurchaseVat = cost * 1.16; // IVA de compra 16%
      unitBaseSale = costWithPurchaseVat * (1 + marginPercent / 100);
    }
    const newItem: NewItem = {
      service_type_id: service.id,
      service_name: service.name,
      quantity: 1,
      unit_cost_price: service.cost_price || 0,
      unit_base_price: unitBaseSale,
      subtotal: unitBaseSale,
      vat_rate: vatRate,
      vat_amount: unitBaseSale * vatRate / 100,
      total_amount: calculatedPrice,
      // Coincide con ventas (incluye IVA, cashback y redondeo)
      item_type: service.item_type,
      profit_margin_rate: profitMarginUsed || service.profit_margin_rate || 0
    };
    setNewItems(prev => [...prev, newItem]);
  };
  const removeItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };
  const updateItemQuantity = (index: number, quantity: number) => {
    const updated = [...newItems];
    updated[index] = {
      ...updated[index],
      quantity: Math.max(1, quantity)
    };
    // For free items (no service_type_id), calculate directly
    if (!updated[index].service_type_id) {
      const item = updated[index];
      item.subtotal = item.unit_base_price * item.quantity;
      item.vat_amount = item.subtotal * item.vat_rate / 100;
      item.total_amount = ceilToTen(item.subtotal + item.vat_amount);
      setNewItems(updated);
      return;
    }
    const correctPrice = calculateItemCorrectPrice(updated[index]);
    updated[index].total_amount = correctPrice;
    const item = updated[index];
    item.subtotal = item.unit_base_price * item.quantity;
    item.vat_amount = item.subtotal * item.vat_rate / 100;
    setNewItems(updated);
  };

  const addFreeItem = () => {
    if (!freeItemName.trim()) {
      toast({
        title: "Error",
        description: "Debe proporcionar un nombre para el ítem",
        variant: "destructive"
      });
      return;
    }
    
    const price = parseFloat(freeItemPrice) || 0;
    if (price <= 0) {
      toast({
        title: "Error",
        description: "El precio debe ser mayor a 0",
        variant: "destructive"
      });
      return;
    }

    const vatRate = 16;
    const subtotal = price * freeItemQuantity;
    const vatAmount = subtotal * vatRate / 100;
    const totalAmount = ceilToTen(subtotal + vatAmount);

    const newItem: NewItem = {
      service_type_id: '', // Empty for free items
      service_name: freeItemName.trim(),
      quantity: freeItemQuantity,
      unit_cost_price: price * 0.7, // Estimate cost at 70%
      unit_base_price: price,
      subtotal: subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      item_type: freeItemType,
      profit_margin_rate: 30
    };

    setNewItems(prev => [...prev, newItem]);
    setFreeItemName('');
    setFreeItemDescription('');
    setFreeItemPrice('');
    setFreeItemQuantity(1);
    setShowFreeItemForm(false);

    toast({
      title: "Ítem agregado",
      description: `${freeItemName} agregado a la orden`
    });
  };
  const renderCategoryButton = (mainCategory: string, itemType: string) => {
    const IconComponent = getMainCategoryIcon(mainCategory);
    const count = getFilteredServices(mainCategory, itemType).length;
    return <Button variant="outline" className="h-20 flex flex-col gap-2 hover:bg-primary/10" onClick={() => setSelectedMainCategory(`${mainCategory}-${itemType}`)} disabled={count === 0}>
        <IconComponent className="h-6 w-6" />
        <span className="text-xs font-medium">{mainCategory}</span>
        <span className="text-xs text-muted-foreground">
          {count} {itemType === 'servicio' ? 'servicios' : 'productos'}
        </span>
      </Button>;
  };
  const renderMainCategoryView = () => {
    if (!selectedMainCategory) {
      return <div className="space-y-6">
          {/* Free Item Button */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowFreeItemForm(true)}
              className="gap-2 border-dashed border-2"
            >
              <PenLine className="h-4 w-4" />
              Agregar Ítem Libre
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Servicios</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderCategoryButton('Seguridad', 'servicio')}
              {renderCategoryButton('Sistemas', 'servicio')}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Productos</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderCategoryButton('Seguridad', 'articulo')}
              {renderCategoryButton('Sistemas', 'articulo')}
            </div>
          </div>
        </div>;
    }
    const [mainCategory, itemType] = selectedMainCategory.split('-');
    const services = getFilteredServices(mainCategory, itemType);
    return <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMainCategory(null)}>
            ← Volver
          </Button>
          <h3 className="text-lg font-medium">
            {mainCategory} - {itemType === 'servicio' ? 'Servicios' : 'Productos'}
          </h3>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
          {services.map(service => <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm">{service.name}</h4>
                    <Badge variant="default" className="text-xs">
                      {itemType === 'servicio' ? 'Servicio' : 'Producto'}
                    </Badge>
                  </div>
                  {service.description && <p className="text-xs text-muted-foreground line-clamp-2">
                      {service.description}
                    </p>}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      ${Math.round(calculateDisplayPrice(service)).toLocaleString('es-MX')}
                    </span>
                    <Button size="sm" onClick={() => addServiceToItems(service)} className="h-7 px-2">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>)}
        </div>

        {services.length === 0 && <div className="text-center py-8 text-muted-foreground">
            No se encontraron {itemType === 'servicio' ? 'servicios' : 'productos'} en esta categoría
          </div>}
      </div>;
  };
  const calculateTotalChange = () => {
    return newItems.reduce((sum, item) => sum + calculateItemCorrectPrice(item), 0);
  };
  const handleSubmit = async (sendForApproval: boolean = false) => {
    if (newItems.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un servicio o producto",
        variant: "destructive"
      });
      return;
    }
    if (!reason || !reason.trim()) {
      toast({
        title: "Error",
        description: "Debe proporcionar una razón para la modificación",
        variant: "destructive"
      });
      return;
    }
    if (!orderId) {
      toast({
        title: "Error",
        description: "ID de orden no válido",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data: currentOrder,
        error: orderError
      } = await supabase.from('orders').select('estimated_cost').eq('id', orderId).single();
      if (orderError) {
        console.error('Error fetching order:', orderError);
        throw orderError;
      }
      const previousTotal = currentOrder?.estimated_cost || 0;
      const newTotal = previousTotal + calculateTotalChange();
      const {
        data: userResult
      } = await supabase.auth.getUser();
      const {
        data: profile,
        error: profileError
      } = await supabase.from('profiles').select('full_name').eq('user_id', userResult.user?.id).maybeSingle();
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      const createdByName = profile?.full_name || 'Usuario desconocido';
      const modificationData = {
        order_id: orderId,
        previous_total: previousTotal,
        new_total: newTotal,
        items_added: JSON.stringify(newItems),
        modification_type: 'item_added' as const,
        modification_reason: reason.trim(),
        created_by: userResult.user?.id,
        created_by_name: createdByName,
        notes: `Servicios/productos agregados: ${newItems.map(item => `${item.service_name} (x${item.quantity})`).join(', ')}`,
        skip_status_change: !sendForApproval // Skip if NOT sending for approval
      };
      const {
        error: modificationError
      } = await supabase.from('order_modifications').insert(modificationData);
      if (modificationError) {
        console.error('Error inserting modification:', modificationError);
        throw modificationError;
      }
      for (const item of newItems) {
        // Free items (no service_type_id) always get inserted as new
        if (!item.service_type_id) {
          const freeItemTotal = ceilToTen(item.subtotal + item.vat_amount);
          const { error: itemError } = await supabase.from('order_items').insert({
            order_id: orderId,
            service_type_id: null, // Free item, no service type
            service_name: item.service_name,
            quantity: item.quantity,
            unit_cost_price: item.unit_cost_price,
            unit_base_price: item.unit_base_price,
            subtotal: item.subtotal,
            vat_rate: item.vat_rate,
            vat_amount: item.vat_amount,
            total_amount: freeItemTotal,
            item_type: item.item_type,
            profit_margin_rate: item.profit_margin_rate,
            status: 'pendiente' as const,
            pricing_locked: true
          });
          if (itemError) throw itemError;
          continue;
        }

        // Verificar si el item ya existe en la orden (only for items with service_type_id)
        const { data: existingItem, error: checkError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId)
          .eq('service_type_id', item.service_type_id)
          .maybeSingle();
          
        if (checkError) throw checkError;
        
        if (existingItem) {
          // Si existe, actualizar la cantidad y totales
          const newQuantity = existingItem.quantity + item.quantity;
          const newSubtotal = item.unit_base_price * newQuantity;
          const newVatAmount = newSubtotal * item.vat_rate / 100;
          const newTotalAmount = calculateItemCorrectPrice({...item, quantity: newQuantity});
          
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              quantity: newQuantity,
              subtotal: newSubtotal,
              vat_amount: newVatAmount,
              total_amount: newTotalAmount,
              pricing_locked: true
            })
            .eq('id', existingItem.id);
            
          if (updateError) throw updateError;
        } else {
          // Si no existe, insertar nuevo item
          const { error: itemError } = await supabase.from('order_items').insert({
            order_id: orderId,
            service_type_id: item.service_type_id,
            service_name: item.service_name,
            quantity: item.quantity,
            unit_cost_price: item.unit_cost_price,
            unit_base_price: item.unit_base_price,
            subtotal: item.subtotal,
            vat_rate: item.vat_rate,
            vat_amount: item.vat_amount,
            total_amount: calculateItemCorrectPrice(item),
            item_type: item.item_type,
            profit_margin_rate: item.profit_margin_rate,
            status: 'pendiente' as const,
            pricing_locked: true
          });
          if (itemError) throw itemError;
        }
      }

      // No actualizar estimated_cost aquí - solo se actualiza al aprobar

      onItemsAdded();
      onOpenChange(false);
      setNewItems([]);
      setReason('');
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: "Error",
        description: "No se pudieron agregar los servicios. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Agregar Servicios/Productos - Orden {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Razón de la modificación */}
          <Card>
            <CardHeader>
              <CardTitle>Razón de la Modificación</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Explique por qué se están agregando estos servicios/productos..." value={reason} onChange={e => setReason(e.target.value)} className="min-h-20" />
            </CardContent>
          </Card>

          {/* Free Item Form */}
          {showFreeItemForm && (
            <Card className="border-2 border-dashed border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PenLine className="h-5 w-5" />
                    Agregar Ítem Libre
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setShowFreeItemForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del ítem *</Label>
                    <Input 
                      placeholder="Ej: Instalación especial, Producto personalizado..." 
                      value={freeItemName} 
                      onChange={e => setFreeItemName(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={freeItemType} onValueChange={(v: 'servicio' | 'articulo') => setFreeItemType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="servicio">Servicio</SelectItem>
                        <SelectItem value="articulo">Producto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio unitario (sin IVA) *</Label>
                    <Input 
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00" 
                      value={freeItemPrice} 
                      onChange={e => setFreeItemPrice(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input 
                      type="number"
                      min="1"
                      value={freeItemQuantity} 
                      onChange={e => setFreeItemQuantity(parseInt(e.target.value) || 1)} 
                    />
                  </div>
                </div>
                {freeItemPrice && parseFloat(freeItemPrice) > 0 && (
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>${(parseFloat(freeItemPrice) * freeItemQuantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>IVA (16%):</span>
                      <span>${(parseFloat(freeItemPrice) * freeItemQuantity * 0.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-1 border-t mt-1">
                      <span>Total:</span>
                      <span>${ceilToTen(parseFloat(freeItemPrice) * freeItemQuantity * 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                <Button onClick={addFreeItem} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Ítem Libre
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Selección de servicios/productos por categoría */}
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Servicios/Productos</CardTitle>
            </CardHeader>
            <CardContent>
              {renderMainCategoryView()}
            </CardContent>
          </Card>

          {/* Lista de items seleccionados */}
          {newItems.length > 0 && <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Servicios/Productos Seleccionados
                  <Badge variant="outline">{newItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {newItems.map((item, index) => <Card key={index} className={`p-4 ${!item.service_type_id ? 'border-dashed border-2 border-primary/50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{item.service_name}</h4>
                          <Badge variant="outline">
                            {item.item_type === 'servicio' ? 'Servicio' : 'Producto'}
                          </Badge>
                          {!item.service_type_id && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              <PenLine className="h-3 w-3 mr-1" />
                              Ítem Libre
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <Label>Cantidad:</Label>
                          <Input type="number" min="1" value={item.quantity} onChange={e => updateItemQuantity(index, parseInt(e.target.value) || 1)} className="w-20" />
                          
                          <div className="font-medium">
                            Total: ${(!item.service_type_id ? ceilToTen(item.unit_base_price * item.quantity * 1.16) : calculateItemCorrectPrice(item)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </div>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => removeItem(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>)}
              </CardContent>
            </Card>}

          {/* Resumen del cambio total */}
          {newItems.length > 0 && <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Incremento Total:</span>
                  <span className="text-green-600">
                    +${calculateTotalChange().toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </span>
                </div>
              </CardContent>
            </Card>}

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleSubmit(false)} 
              disabled={loading || newItems.length === 0 || !reason.trim()}
            >
              {loading ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Procesando...
                </> : <>
                  <Plus className="h-4 w-4 mr-2" />
                  Solo Agregar
                </>}
            </Button>
            <Button onClick={() => handleSubmit(true)} disabled={loading || newItems.length === 0 || !reason.trim()}>
              {loading ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Procesando...
                </> : <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Agregar y Enviar
                </>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}