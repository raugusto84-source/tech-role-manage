import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Minus, ShoppingCart, Search, Shield, Monitor, Package, X, CheckCircle } from 'lucide-react';
import { ceilToTen, formatCOPCeilToTen } from '@/utils/currency';

interface AddQuoteItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
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

export function AddQuoteItemsDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  onItemsAdded
}: AddQuoteItemsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      loadServiceTypes();
      setNewItems([]);
      setSelectedMainCategory(null);
      setSearchTerm('');
    }
  }, [open]);

  const loadServiceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('category, name');
      
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

  const calculateDisplayPrice = (service: ServiceType, quantity: number = 1): number => {
    const salesVatRate = service.vat_rate || 16;

    if (service.item_type === 'servicio') {
      const basePrice = (service.base_price || 0) * quantity;
      const withVat = basePrice * (1 + salesVatRate / 100);
      return ceilToTen(withVat);
    } else {
      const purchaseVatRate = 16;
      const baseCost = (service.cost_price || 0) * quantity;
      const marginPercent = service.profit_margin_tiers?.[0]?.margin || 30;
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + marginPercent / 100);
      const withSalesVat = afterMargin * (1 + salesVatRate / 100);
      return ceilToTen(withSalesVat);
    }
  };

  const calculateItemCorrectPrice = (item: NewItem): number => {
    const quantity = item.quantity || 1;
    const unitPrice = item.unit_base_price || 0;
    const vatRate = item.vat_rate || 16;
    const subtotal = unitPrice * quantity;
    const withVat = subtotal * (1 + vatRate / 100);
    return ceilToTen(withVat);
  };

  const securityCategories = ['Alarmas', 'Cámaras', 'Cercas Eléctricas', 'Control de Acceso'];
  const systemsCategories = ['Computadoras', 'Fraccionamientos'];
  
  const getMainCategoryIcon = (mainCategory: string) => {
    switch (mainCategory) {
      case 'Seguridad':
        return Shield;
      case 'Sistemas':
        return Monitor;
      default:
        return Package;
    }
  };

  const getFilteredServices = (mainCategory: string, itemType: string) => {
    const categoryNames = mainCategory === 'Seguridad' ? securityCategories : systemsCategories;
    return serviceTypes.filter(service => 
      categoryNames.includes(service.category || '') && 
      service.item_type === itemType && 
      (searchTerm === '' || 
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  };

  const addServiceToItems = (service: ServiceType) => {
    const existingItemIndex = newItems.findIndex(item => item.service_type_id === service.id);
    
    if (existingItemIndex !== -1) {
      const updatedItems = [...newItems];
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + 1;
      
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

    const calculatedPrice = calculateDisplayPrice(service);
    const vatRate = service.vat_rate || 16;

    let unitBaseSale = 0;
    let profitMarginUsed = 0;
    if (service.item_type === 'servicio') {
      unitBaseSale = service.base_price || 0;
    } else {
      const marginPercent = service.profit_margin_tiers && service.profit_margin_tiers.length > 0 
        ? service.profit_margin_tiers[0].margin || 30 
        : 30;
      profitMarginUsed = marginPercent;
      const cost = service.cost_price || 0;
      const costWithPurchaseVat = cost * 1.16;
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
    const correctPrice = calculateItemCorrectPrice(updated[index]);
    updated[index].total_amount = correctPrice;
    const item = updated[index];
    item.subtotal = item.unit_base_price * item.quantity;
    item.vat_amount = item.subtotal * item.vat_rate / 100;
    setNewItems(updated);
  };

  const renderCategoryButton = (mainCategory: string, itemType: string) => {
    const IconComponent = getMainCategoryIcon(mainCategory);
    const count = getFilteredServices(mainCategory, itemType).length;
    return (
      <Button 
        variant="outline" 
        className="h-20 flex flex-col gap-2 hover:bg-primary/10" 
        onClick={() => setSelectedMainCategory(`${mainCategory}-${itemType}`)} 
        disabled={count === 0}
      >
        <IconComponent className="h-6 w-6" />
        <span className="text-xs font-medium">{mainCategory}</span>
        <span className="text-xs text-muted-foreground">
          {count} {itemType === 'servicio' ? 'servicios' : 'productos'}
        </span>
      </Button>
    );
  };

  const renderMainCategoryView = () => {
    if (!selectedMainCategory) {
      return (
        <div className="space-y-6">
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
        </div>
      );
    }

    const [mainCategory, itemType] = selectedMainCategory.split('-');
    const services = getFilteredServices(mainCategory, itemType);
    
    return (
      <div className="space-y-4">
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
          <Input 
            placeholder="Buscar..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
          {services.map(service => (
            <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm">{service.name}</h4>
                    <Badge variant="default" className="text-xs">
                      {itemType === 'servicio' ? 'Servicio' : 'Producto'}
                    </Badge>
                  </div>
                  {service.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {formatCOPCeilToTen(calculateDisplayPrice(service))}
                    </span>
                    <Button size="sm" onClick={() => addServiceToItems(service)} className="h-7 px-2">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron {itemType === 'servicio' ? 'servicios' : 'productos'} en esta categoría
          </div>
        )}
      </div>
    );
  };

  const calculateTotal = () => {
    return newItems.reduce((sum, item) => sum + calculateItemCorrectPrice(item), 0);
  };

  const handleSubmit = async () => {
    if (newItems.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un servicio o producto",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const totalAmount = calculateTotal();

      // Insert quote items
      const itemsToInsert = newItems.map(item => ({
        quote_id: quoteId,
        service_type_id: item.service_type_id,
        name: item.service_name,
        description: '',
        quantity: item.quantity,
        unit_price: item.unit_base_price,
        subtotal: item.subtotal,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        withholding_rate: 0,
        withholding_amount: 0,
        withholding_type: 'none',
        total: item.total_amount,
        is_custom: false
      }));

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update quote estimated_amount
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ estimated_amount: totalAmount })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      toast({
        title: "Items agregados",
        description: `Se agregaron ${newItems.length} items a la cotización`
      });

      onItemsAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding items to quote:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron agregar los items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Agregar Items - {quoteNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Seleccionar Servicios/Productos</h3>
            {renderMainCategoryView()}
          </div>

          {/* Selected Items */}
          {newItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Items Seleccionados ({newItems.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {newItems.map((item, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCOPCeilToTen(calculateItemCorrectPrice(item))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateItemQuantity(index, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateItemQuantity(index, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 w-7 p-0"
                          onClick={() => removeItem(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total:</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCOPCeilToTen(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || newItems.length === 0}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {loading ? "Guardando..." : "Agregar y Aprobar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
