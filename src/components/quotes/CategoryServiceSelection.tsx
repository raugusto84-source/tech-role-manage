import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Search, Settings, Trash2 } from 'lucide-react';
import { TaxConfiguration } from './TaxConfiguration';

interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  cost_price: number | null;
  base_price: number | null;
  vat_rate: number;
  item_type: string;
  category_id?: string;
  category_name?: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface Tax {
  id: string;
  tax_type: 'iva' | 'retencion';
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
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
  taxes?: Tax[];
}

interface TaxDefinition {
  id: string;
  tax_name: string;
  tax_type: string;
  tax_rate: number;
  is_active: boolean;
}

interface CategoryServiceSelectionProps {
  selectedItems: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
}

export function CategoryServiceSelection({ selectedItems, onItemsChange }: CategoryServiceSelectionProps) {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [globalTaxes, setGlobalTaxes] = useState<TaxDefinition[]>([]);
  const [selectedTaxes, setSelectedTaxes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom item form
  const [customItem, setCustomItem] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load services directly from service_types (same as sales module)
      const { data: servicesData } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('category, name');

      // Extract unique categories from services
      const uniqueCategories = [...new Set(servicesData?.map(s => s.category).filter(Boolean) || [])];
      const categoriesFormatted = uniqueCategories.map(categoryName => ({
        id: categoryName,
        name: categoryName,
        description: `Servicios de ${categoryName}`,
        icon: getCategoryIcon(categoryName)
      }));

      // Load global taxes
      const { data: taxesData } = await supabase
        .from('tax_definitions')
        .select('*')
        .eq('is_active', true)
        .order('tax_type, tax_rate');

      if (servicesData) {
        setServices(servicesData.map(service => ({
          ...service,
          category_name: service.category || 'Sin categoría'
        })));
      }
      
      setCategories(categoriesFormatted);
      if (taxesData) setGlobalTaxes(taxesData as TaxDefinition[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaxDefinition = async (taxId: string, field: string, value: string | number) => {
    const { error } = await supabase
      .from('tax_definitions')
      .update({ [field]: value })
      .eq('id', taxId);
    
    if (!error) {
      setGlobalTaxes(taxes => taxes.map(tax => 
        tax.id === taxId ? { ...tax, [field]: value } : tax
      ));
    }
  };

  const deleteTaxDefinition = async (taxId: string) => {
    const { error } = await supabase
      .from('tax_definitions')
      .delete()
      .eq('id', taxId);
    
    if (!error) {
      setGlobalTaxes(taxes => taxes.filter(tax => tax.id !== taxId));
      setSelectedTaxes(selected => selected.filter(id => id !== taxId));
    }
  };

  const getCategoryIcon = (categoryName: string): string => {
    const iconMap: Record<string, string> = {
      'general': '🔧',
      'mantenimiento': '🛠️',
      'reparacion': '🔨',
      'instalacion': '📦',
      'consultoria': '💡',
      'soporte': '🆘',
      'desarrollo': '💻',
      'formacion': '📚',
      'otros': '📋'
    };
    return iconMap[categoryName.toLowerCase()] || '🔧';
  };

  const calculateItemTotals = (baseItem: Omit<QuoteItem, 'total' | 'subtotal' | 'vat_amount' | 'withholding_amount' | 'taxes'>) => {
    const subtotal = baseItem.quantity * baseItem.unit_price;
    
    // Calculate taxes based on selected global taxes
    const appliedTaxes: Tax[] = selectedTaxes.map(taxId => {
      const taxDef = globalTaxes.find(t => t.id === taxId);
      if (!taxDef) return null;
      
      return {
        id: `${taxDef.tax_type}-${Date.now()}-${Math.random()}`,
        tax_type: taxDef.tax_type,
        tax_name: taxDef.tax_name,
        tax_rate: taxDef.tax_rate,
        tax_amount: subtotal * (taxDef.tax_rate / 100)
      };
    }).filter(Boolean) as Tax[];

    const totalIva = appliedTaxes
      .filter(tax => tax.tax_type === 'iva')
      .reduce((sum, tax) => sum + tax.tax_amount, 0);
    
    const totalRetenciones = appliedTaxes
      .filter(tax => tax.tax_type === 'retencion')
      .reduce((sum, tax) => sum + tax.tax_amount, 0);

    const total = subtotal + totalIva - totalRetenciones;

    return {
      ...baseItem,
      subtotal,
      vat_amount: totalIva,
      withholding_amount: totalRetenciones,
      withholding_type: appliedTaxes.find(t => t.tax_type === 'retencion')?.tax_name || '',
      total,
      taxes: appliedTaxes
    };
  };

  const addService = (service: ServiceType) => {
    const baseItem = {
      id: `service-${Date.now()}-${Math.random()}`,
      service_type_id: service.id,
      name: service.name,
      description: service.description || '',
      quantity: 1,
      unit_price: service.base_price || 0,
      vat_rate: service.vat_rate,
      withholding_rate: 0,
      withholding_type: '',
      is_custom: false
    };

    const newItem = calculateItemTotals(baseItem);
    onItemsChange([...selectedItems, newItem]);
  };

  const addCustomItem = () => {
    if (!customItem.name || customItem.unit_price <= 0) return;

    const baseItem = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: customItem.name,
      description: customItem.description,
      quantity: customItem.quantity,
      unit_price: customItem.unit_price,
      vat_rate: 16, // Default VAT rate
      withholding_rate: 0,
      withholding_type: '',
      is_custom: true
    };

    const newItem = calculateItemTotals(baseItem);
    onItemsChange([...selectedItems, newItem]);
    
    // Reset form
    setCustomItem({
      name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
    });
  };

  const removeItem = (itemId: string) => {
    onItemsChange(selectedItems.filter(item => item.id !== itemId));
  };

  const updateItem = (updatedItem: QuoteItem) => {
    onItemsChange(selectedItems.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const servicesByCategory = categories.map(category => ({
    ...category,
    services: filteredServices.filter(service => service.category_name === category.name)
  }));

  const uncategorizedServices = filteredServices.filter(service => 
    !service.category_name || service.category_name === 'Sin categoría'
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="taxes">Impuestos Globales</TabsTrigger>
          <TabsTrigger value="custom">Artículo Personalizado</TabsTrigger>
        </TabsList>

        {/* Global Tax Configuration */}
        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración Global de Impuestos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona los impuestos que se aplicarán automáticamente a todos los artículos añadidos.
              </p>
              
              {/* Gestión de impuestos editables */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Impuestos Disponibles</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('tax_definitions')
                        .insert({
                          tax_name: 'Nuevo Impuesto',
                          tax_type: 'iva',
                          tax_rate: 0,
                          is_active: true
                        });
                      if (!error) loadData();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Impuesto
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-green-700 mb-3">IVAs Disponibles</h4>
                    <div className="space-y-2">
                      {globalTaxes.filter(tax => tax.tax_type === 'iva').map(tax => (
                        <div key={tax.id} className="flex items-center space-x-2 p-2 border rounded">
                          <Checkbox
                            id={`tax-${tax.id}`}
                            checked={selectedTaxes.includes(tax.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTaxes([...selectedTaxes, tax.id]);
                              } else {
                                setSelectedTaxes(selectedTaxes.filter(id => id !== tax.id));
                              }
                            }}
                          />
                          <Input
                            value={tax.tax_name}
                            onChange={(e) => updateTaxDefinition(tax.id, 'tax_name', e.target.value)}
                            className="flex-1 h-8"
                          />
                          <Input
                            type="number"
                            value={tax.tax_rate}
                            onChange={(e) => updateTaxDefinition(tax.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                            className="w-20 h-8"
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          <span className="text-xs text-green-600">%</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTaxDefinition(tax.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-red-700 mb-3">Retenciones Disponibles</h4>
                    <div className="space-y-2">
                      {globalTaxes.filter(tax => tax.tax_type === 'retencion').map(tax => (
                        <div key={tax.id} className="flex items-center space-x-2 p-2 border rounded">
                          <Checkbox
                            id={`tax-${tax.id}`}
                            checked={selectedTaxes.includes(tax.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTaxes([...selectedTaxes, tax.id]);
                              } else {
                                setSelectedTaxes(selectedTaxes.filter(id => id !== tax.id));
                              }
                            }}
                          />
                          <Input
                            value={tax.tax_name}
                            onChange={(e) => updateTaxDefinition(tax.id, 'tax_name', e.target.value)}
                            className="flex-1 h-8"
                          />
                          <Input
                            type="number"
                            value={tax.tax_rate}
                            onChange={(e) => updateTaxDefinition(tax.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                            className="w-20 h-8"
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          <span className="text-xs text-red-600">%</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTaxDefinition(tax.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('tax_definitions')
                        .insert({
                          tax_name: 'IVA ' + (globalTaxes.filter(t => t.tax_type === 'iva').length + 1),
                          tax_type: 'iva',
                          tax_rate: 19,
                          is_active: true
                        });
                      if (!error) loadData();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar IVA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('tax_definitions')
                        .insert({
                          tax_name: 'Retención ' + (globalTaxes.filter(t => t.tax_type === 'retencion').length + 1),
                          tax_type: 'retencion',
                          tax_rate: 1,
                          is_active: true
                        });
                      if (!error) loadData();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Retención
                  </Button>
                </div>
              </div>

              {selectedTaxes.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Impuestos seleccionados: {selectedTaxes.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Estos impuestos se aplicarán automáticamente a todos los nuevos artículos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar servicios</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                window.open('/ventas?tab=form', '_blank');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Servicio
            </Button>
          </div>

          <div className="space-y-6">
            {servicesByCategory.map(category => (
              category.services.filter(s => s.item_type === 'servicio').length > 0 && (
                <Card key={`${category.id}-servicios`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {category.icon && <span className="text-xl">{category.icon}</span>}
                      {category.name} - Servicios
                    </CardTitle>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {category.services.filter(service => service.item_type === 'servicio').map(service => (
                        <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm">{service.name}</h4>
                                <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                                  Servicio
                                </Badge>
                              </div>
                              {service.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {service.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                  {formatCurrency(service.base_price || 0)}
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => addService(service)}
                                  className="h-7 px-2"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}

            {uncategorizedServices.filter(s => s.item_type === 'servicio').length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    📋 Sin Categoría - Servicios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {uncategorizedServices.filter(service => service.item_type === 'servicio').map(service => (
                      <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-sm">{service.name}</h4>
                              <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                                Servicio
                              </Badge>
                            </div>
                            {service.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">
                                {formatCurrency(service.base_price || 0)}
                              </span>
                              <Button
                                size="sm"
                                onClick={() => addService(service)}
                                className="h-7 px-2"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search-products">Buscar productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-products"
                  placeholder="Buscar por nombre o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                window.open('/ventas?tab=form', '_blank');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Producto
            </Button>
          </div>

          <div className="space-y-6">
            {servicesByCategory.map(category => (
              category.services.filter(s => s.item_type === 'articulo').length > 0 && (
                <Card key={`${category.id}-productos`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {category.icon && <span className="text-xl">{category.icon}</span>}
                      {category.name} - Productos
                    </CardTitle>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {category.services.filter(service => service.item_type === 'articulo').map(service => (
                        <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm">{service.name}</h4>
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  Producto
                                </Badge>
                              </div>
                              {service.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {service.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                  {formatCurrency(service.cost_price || 0)}
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => addService(service)}
                                  className="h-7 px-2"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}

            {uncategorizedServices.filter(s => s.item_type === 'articulo').length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    📋 Sin Categoría - Productos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {uncategorizedServices.filter(service => service.item_type === 'articulo').map(service => (
                      <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-sm">{service.name}</h4>
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                Producto
                              </Badge>
                            </div>
                            {service.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">
                                {formatCurrency(service.cost_price || 0)}
                              </span>
                              <Button
                                size="sm"
                                onClick={() => addService(service)}
                                className="h-7 px-2"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Custom Item */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Crear Artículo Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="custom-name">Nombre del Artículo</Label>
                <Input
                  id="custom-name"
                  value={customItem.name}
                  onChange={(e) => setCustomItem({...customItem, name: e.target.value})}
                  placeholder="Nombre del artículo..."
                />
              </div>

              <div>
                <Label htmlFor="custom-description">Descripción</Label>
                <Textarea
                  id="custom-description"
                  value={customItem.description}
                  onChange={(e) => setCustomItem({...customItem, description: e.target.value})}
                  placeholder="Descripción del artículo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custom-quantity">Cantidad</Label>
                  <Input
                    id="custom-quantity"
                    type="number"
                    min="1"
                    value={customItem.quantity}
                    onChange={(e) => setCustomItem({...customItem, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>

                <div>
                  <Label htmlFor="custom-price">Precio Unitario</Label>
                  <Input
                    id="custom-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={customItem.unit_price}
                    onChange={(e) => setCustomItem({...customItem, unit_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <Button 
                onClick={addCustomItem}
                disabled={!customItem.name || customItem.unit_price <= 0}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Artículo Personalizado
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Artículos Seleccionados ({selectedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{item.name}</h4>
                      {item.is_custom && (
                        <Badge variant="secondary" className="text-xs">Personalizado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total)}
                    </p>
                    {item.taxes && item.taxes.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.taxes.map((tax, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tax.tax_type === 'iva' ? 'IVA' : 'RET'} {tax.tax_rate}%
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <TaxConfiguration 
                      item={item}
                      onItemChange={updateItem}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <span className="sr-only">Eliminar</span>
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />
            
            <div className="flex justify-between items-center font-medium">
              <span>Total:</span>
              <span className="text-lg">
                {formatCurrency(selectedItems.reduce((sum, item) => sum + item.total, 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}