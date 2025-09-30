import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Package, ShoppingCart } from 'lucide-react';
import { TaxConfiguration } from './TaxConfiguration';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';

interface ServiceType {
  id: string;
  name: string;
  description: string;
  base_price: number;
  estimated_hours: number;
}

interface QuoteItem {
  id: string;
  service_type_id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  withholding_type: string;
  total: number;
  is_custom: boolean;
  taxes?: any[];
}

interface ServiceSelectionProps {
  selectedItems: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
}

/**
 * Componente para seleccionar servicios predefinidos o crear nuevos
 * Permite elegir de una lista de tipos de servicio o crear artículos personalizados
 * Componente reutilizable para cotizaciones y órdenes
 */
export function ServiceSelection({ selectedItems, onItemsChange }: ServiceSelectionProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('predefined');
  
  // Formulario para artículo personalizado
  const [customItem, setCustomItem] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
  });

  // Cargar tipos de servicio
  useEffect(() => {
    loadServiceTypes();
    
    // Set up real-time subscription for service_types
    const channel = supabase
      .channel('service-types-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_types'
        },
        () => {
          console.log('Service types changed, reloading...');
          loadServiceTypes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadServiceTypes = async () => {
    try {
      setLoading(true);
      console.log('Loading service types...');
      
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error loading service types:', error);
        toast({
          title: "Error",
          description: `No se pudieron cargar los tipos de servicio: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Service types loaded:', data?.length || 0, 'items');
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error loading service types:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar los tipos de servicio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Agregar servicio predefinido
  const addPredefinedService = (serviceType: ServiceType, quantity: number = 1) => {
    const existingItemIndex = selectedItems.findIndex(
      item => item.service_type_id === serviceType.id
    );

    if (existingItemIndex >= 0) {
      // Si ya existe, actualizar cantidad
      const updatedItems = [...selectedItems];
      const newQuantity = updatedItems[existingItemIndex].quantity + quantity;
      const subtotal = newQuantity * updatedItems[existingItemIndex].unit_price;
      const vatAmount = subtotal * (updatedItems[existingItemIndex].vat_rate / 100);
      const withholding_amount = subtotal * (updatedItems[existingItemIndex].withholding_rate / 100);
      const total = subtotal + vatAmount - withholding_amount;
      
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: newQuantity,
        subtotal,
        vat_amount: vatAmount,
        withholding_amount,
        total
      };
      onItemsChange(updatedItems);
    } else {
      // Agregar nuevo
      const basePrice = serviceType.base_price || 0;
      const finalUnitPrice = ceilToTen(basePrice * 1.16); // Apply VAT and rounding
      const quantity = 1;
      const subtotal = finalUnitPrice / 1.16 * quantity; // Extract subtotal without VAT
      const vatRate = 16;
      const vatAmount = finalUnitPrice - subtotal;
      const withholding_rate = 0;
      const withholding_amount = 0;
      const total = finalUnitPrice * quantity;
      
      // Default tax for new items
      const defaultTaxes = [{
        id: `default-iva-${Date.now()}`,
        tax_type: 'iva' as const,
        tax_name: 'IVA Estándar',
        tax_rate: vatRate,
        tax_amount: vatAmount
      }];
      
      const newItem: QuoteItem = {
        id: `predefined-${serviceType.id}-${Date.now()}`,
        service_type_id: serviceType.id,
        name: serviceType.name,
        description: serviceType.description || '',
        quantity,
        unit_price: finalUnitPrice,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        withholding_rate,
        withholding_amount,
        withholding_type: '',
        total,
        is_custom: false,
        taxes: defaultTaxes,
      };

      onItemsChange([...selectedItems, newItem]);
    }

    toast({
      title: "Servicio agregado",
      description: `${serviceType.name} ha sido agregado a la cotización`,
    });
  };

  // Agregar artículo personalizado
  const addCustomItem = () => {
    if (!customItem.name || customItem.quantity <= 0 || customItem.unit_price < 0) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos del artículo",
        variant: "destructive",
      });
      return;
    }

    const subtotal = customItem.quantity * customItem.unit_price;
    const vatRate = 16;
    const vatAmount = subtotal * (vatRate / 100);
    const withholding_rate = 0;
    const withholding_amount = 0;
    const total = subtotal + vatAmount - withholding_amount;

    // Default tax for custom items
    const defaultTaxes = [{
      id: `default-iva-${Date.now()}`,
      tax_type: 'iva' as const,
      tax_name: 'IVA Estándar',
      tax_rate: vatRate,
      tax_amount: vatAmount
    }];

    const newItem: QuoteItem = {
      id: `custom-${Date.now()}`,
      name: customItem.name,
      description: customItem.description,
      quantity: customItem.quantity,
      unit_price: customItem.unit_price,
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      withholding_rate,
      withholding_amount,
      withholding_type: '',
      total,
      is_custom: true,
      taxes: defaultTaxes,
    };

    onItemsChange([...selectedItems, newItem]);
    setCustomItem({ name: '', description: '', quantity: 1, unit_price: 0 });
    
    toast({
      title: "Artículo agregado",
      description: `${newItem.name} ha sido agregado a la cotización`,
    });
  };

  // Remover artículo
  const removeItem = (id: string) => {
    const updatedItems = selectedItems.filter(item => item.id !== id);
    onItemsChange(updatedItems);
  };

  // Update item with tax configuration
  const updateItemTaxes = (updatedItem: QuoteItem) => {
    const updatedItems = selectedItems.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    );
    onItemsChange(updatedItems);
  };

  // Actualizar cantidad de artículo
  const updateItemQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id);
      return;
    }

    const updatedItems = selectedItems.map(item => {
      if (item.id === id) {
        const subtotal = newQuantity * item.unit_price;
        const vatAmount = subtotal * (item.vat_rate / 100);
        const withholding_amount = subtotal * (item.withholding_rate / 100);
        const total = subtotal + vatAmount - withholding_amount;
        return { ...item, quantity: newQuantity, subtotal, vat_amount: vatAmount, withholding_amount, total };
      }
      return item;
    });
    onItemsChange(updatedItems);
  };

  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);

  const getTotalAmount = () => {
    return selectedItems.reduce((sum, item) => sum + item.total, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center">
          <TabsList className="grid w-full grid-cols-2 flex-1 mr-2">
            <TabsTrigger value="predefined" className="flex items-center gap-2 text-xs md:text-sm">
              <Package className="h-4 w-4" />
              <span className="md:hidden">Predef.</span>
              <span className="hidden md:inline">Servicios Predefinidos</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2 text-xs md:text-sm">
              <Plus className="h-4 w-4" />
              <span className="md:hidden">Pers.</span>
              <span className="hidden md:inline">Artículo Personalizado</span>
            </TabsTrigger>
          </TabsList>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadServiceTypes}
            disabled={loading}
            className="ml-2"
          >
            {loading ? '⟳' : '↻'}
          </Button>
        </div>

        {/* Servicios Predefinidos */}
        <TabsContent value="predefined" className="space-y-4">
          <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Servicios disponibles:</span> {serviceTypes.length}
              {serviceTypes.length === 0 && (
                <span className="text-destructive ml-2">
                  ⚠️ No se encontraron servicios. Verifique que haya servicios activos creados o haga clic en refrescar.
                </span>
              )}
            </p>
          </div>
          <div className="grid gap-4">
            {serviceTypes.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay servicios predefinidos disponibles</p>
                <Button 
                  variant="outline" 
                  onClick={loadServiceTypes} 
                  className="mt-4"
                  disabled={loading}
                >
                  {loading ? 'Cargando...' : 'Refrescar servicios'}
                </Button>
              </div>
            ) : (
              serviceTypes.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{service.name}</h4>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-green-600 font-medium">
                            {formatCurrency(service.base_price || 0)}
                          </span>
                          {service.estimated_hours && (
                            <span className="text-muted-foreground">
                              ~{service.estimated_hours}h estimadas
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => addPredefinedService(service)}
                        size="sm"
                        className="ml-4"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Artículo Personalizado */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Crear Artículo Personalizado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custom-name">Nombre del Artículo *</Label>
                  <Input
                    id="custom-name"
                    value={customItem.name}
                    onChange={(e) => setCustomItem({...customItem, name: e.target.value})}
                    placeholder="Ej: Instalación de software especializado"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-quantity">Cantidad *</Label>
                  <Input
                    id="custom-quantity"
                    type="number"
                    min="1"
                    value={customItem.quantity}
                    onChange={(e) => setCustomItem({...customItem, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="custom-description">Descripción</Label>
                <Textarea
                  id="custom-description"
                  value={customItem.description}
                  onChange={(e) => setCustomItem({...customItem, description: e.target.value})}
                  placeholder="Descripción detallada del artículo o servicio"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custom-price">Precio Unitario *</Label>
                  <Input
                    id="custom-price"
                    type="number"
                    min="0"
                    value={customItem.unit_price}
                    onChange={(e) => setCustomItem({...customItem, unit_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Total</Label>
                  <div className="bg-muted p-2 rounded-md text-right font-medium">
                    {formatCurrency(customItem.quantity * customItem.unit_price)}
                  </div>
                </div>
              </div>
              
              <Button onClick={addCustomItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Artículo Personalizado
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lista de artículos seleccionados */}
      {selectedItems.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Artículos Seleccionados ({selectedItems.length})
          </h4>
          
          <div className="space-y-2">
            {selectedItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{item.name}</h5>
                        {item.is_custom ? (
                          <Badge variant="secondary" className="text-xs">Personalizado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Predefinido</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Cantidad:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-20 h-8"
                          />
                        </div>
                        <span className="text-sm">Precio: {formatCurrency(item.unit_price)}</span>
                        <span className="text-sm font-medium">Total: {formatCurrency(item.total)}</span>
                      </div>
                      
                      {/* Tax configuration */}
                      <div className="mt-3 flex gap-2">
                        <TaxConfiguration 
                          item={item} 
                          onItemChange={updateItemTaxes} 
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive ml-4"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Total general */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total General:</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(getTotalAmount())}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}