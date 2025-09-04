import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRewardSettings } from '@/hooks/useRewardSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Search } from 'lucide-react';
import { QuoteTotalsSummary } from './QuoteTotalsSummary';

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
  image_url?: string | null;
  profit_margin_tiers?: Array<{
    margin: number;
    min_qty: number;
    max_qty: number;
  }>;
}

interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
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
  image_url?: string | null;
  cost_price?: number;
  base_price?: number;
  profit_margin_rate?: number;
  item_type?: string;
}

interface CategoryServiceSelectionProps {
  selectedItems: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
  simplifiedView?: boolean;
}

export function CategoryServiceSelection({ selectedItems, onItemsChange, simplifiedView = false }: CategoryServiceSelectionProps) {
  const { profile } = useAuth();
  const { settings: rewardSettings } = useRewardSettings();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
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

      if (servicesData) {
        setServices(servicesData.map((service: any) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          cost_price: service.cost_price,
          base_price: service.base_price,
          vat_rate: service.vat_rate || 0,
          item_type: service.item_type || 'servicio',
          category_name: service.category || 'Sin categoría',
          image_url: service.image_url,
          profit_margin_tiers: Array.isArray(service.profit_margin_tiers) 
            ? service.profit_margin_tiers 
            : []
        })));
      }
      
      setCategories(categoriesFormatted);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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

  // Function to determine if an item is a product
  const isProduct = (service: ServiceType): boolean => {
    return service.item_type === 'articulo' || (service.profit_margin_tiers && service.profit_margin_tiers.length > 0);
  };

  // Función para calcular el precio correcto según el tipo de servicio
  const calculateServicePrice = (service: ServiceType): number => {
    console.log('Calculating price for service:', service.name, {
      item_type: service.item_type,
      base_price: service.base_price,
      cost_price: service.cost_price,
      vat_rate: service.vat_rate
    });

    if (isProduct(service)) {
      // For products: cost price + purchase VAT + profit margin + sales VAT + cashback
      const costPrice = service.cost_price || 0;
      if (costPrice === 0) return 0;
      
      const purchaseVAT = costPrice * 0.16; // 16% purchase VAT (matching other components)
      const costWithPurchaseVAT = costPrice + purchaseVAT;
      
      // Get profit margin from first tier or default
      const profitMarginTiers = service.profit_margin_tiers;
      let margin = 30; // default margin
      
      if (Array.isArray(profitMarginTiers) && profitMarginTiers.length > 0) {
        margin = profitMarginTiers[0].margin || 30;
      }
      
      const priceWithMargin = costWithPurchaseVAT * (1 + margin / 100);
      const salesVAT = priceWithMargin * (service.vat_rate / 100);
      const baseTotal = priceWithMargin + salesVAT;
      
      // Apply cashback if settings are available and cashback is enabled for items
      let cashback = 0;
      if (rewardSettings?.apply_cashback_to_items) {
        cashback = baseTotal * (rewardSettings.general_cashback_percent / 100);
      }
      
      return baseTotal + cashback;
    } else {
      // For services: use base_price, or fallback to cost_price if base_price is 0/null
      const basePrice = service.base_price || service.cost_price || 0;
      
      if (basePrice === 0) {
        console.warn('Service has no price set:', service.name);
        return 50000; // Default price for services with no price set (50,000 COP)
      }
      
      const vat = basePrice * ((service.vat_rate || 0) / 100);
      const baseTotal = basePrice + vat;
      
      // Apply cashback if settings are available
      let cashback = 0;
      if (rewardSettings?.apply_cashback_to_items) {
        cashback = baseTotal * ((rewardSettings.general_cashback_percent || 0) / 100);
      }
      
      const finalPrice = baseTotal + cashback;
      console.log('Service price calculation result:', finalPrice);
      return finalPrice;
    }
  };

  const addService = (service: ServiceType) => {
    const calculatedPrice = calculateServicePrice(service);
    
    const newItem: QuoteItem = {
      id: `service-${Date.now()}-${Math.random()}`,
      service_type_id: service.id,
      name: service.name,
      description: service.description || '',
      quantity: 1,
      unit_price: calculatedPrice,
      subtotal: calculatedPrice,
      vat_rate: service.vat_rate,
      vat_amount: 0, // VAT is included in calculatedPrice
      withholding_rate: 0,
      withholding_amount: 0,
      withholding_type: '',
      total: calculatedPrice,
      is_custom: false,
      image_url: service.image_url,
      cost_price: service.cost_price,
      base_price: service.base_price,
      profit_margin_rate: service.profit_margin_tiers?.[0]?.margin || 30,
      item_type: service.item_type
    };

    onItemsChange([...selectedItems, newItem]);
  };

  const addCustomItem = () => {
    if (!customItem.name || customItem.unit_price <= 0) return;

    const newItem: QuoteItem = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: customItem.name,
      description: customItem.description,
      quantity: customItem.quantity,
      unit_price: customItem.unit_price,
      subtotal: customItem.unit_price * customItem.quantity,
      vat_rate: 16, // Fixed 16% VAT for all items
      vat_amount: (customItem.unit_price * customItem.quantity) * 0.16,
      withholding_rate: 0,
      withholding_amount: 0,
      withholding_type: '',
      total: (customItem.unit_price * customItem.quantity) * 1.16,
      is_custom: true
    };

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
        <TabsList className="grid w-full grid-cols-2 gap-1 p-1">
          <TabsTrigger value="services" className="text-xs md:text-sm">
            <span className="md:hidden">Serv.</span>
            <span className="hidden md:inline">Servicios</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs md:text-sm">
            <span className="md:hidden">Prod.</span>
            <span className="hidden md:inline">Productos</span>
          </TabsTrigger>
        </TabsList>

        {/* Custom Item Section */}
        {!simplifiedView && (
          <TabsContent value="custom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Agregar Artículo Personalizado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="custom-name">Nombre</Label>
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
        )}

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
            {!simplifiedView && (
              <Button
                variant="outline"
                onClick={() => {
                  window.open('/ventas?tab=form', '_blank');
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Servicio
              </Button>
            )}
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
                               {/* Imagen del servicio si existe */}
                               {(service as any).image_url && (
                                 <div className="w-full h-24 mb-2">
                                   <img 
                                     src={(service as any).image_url} 
                                     alt={service.name}
                                     className="w-full h-full object-cover rounded-md border"
                                     onError={(e) => {
                                       const target = e.target as HTMLImageElement;
                                       target.style.display = 'none';
                                     }}
                                   />
                                 </div>
                               )}
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
                                    {formatCurrency(calculateServicePrice(service))}
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
                             {/* Imagen del servicio si existe */}
                             {(service as any).image_url && (
                               <div className="w-full h-24 mb-2">
                                 <img 
                                   src={(service as any).image_url} 
                                   alt={service.name}
                                   className="w-full h-full object-cover rounded-md border"
                                   onError={(e) => {
                                     const target = e.target as HTMLImageElement;
                                     target.style.display = 'none';
                                   }}
                                 />
                               </div>
                             )}
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
                                  {formatCurrency(calculateServicePrice(service))}
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
            {!simplifiedView && (
              <Button
                variant="outline"
                onClick={() => {
                  window.open('/ventas?tab=form', '_blank');
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Producto
              </Button>
            )}
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
                               {/* Imagen del producto si existe */}
                               {(service as any).image_url && (
                                 <div className="w-full h-24 mb-2">
                                   <img 
                                     src={(service as any).image_url} 
                                     alt={service.name}
                                     className="w-full h-full object-cover rounded-md border"
                                     onError={(e) => {
                                       const target = e.target as HTMLImageElement;
                                       target.style.display = 'none';
                                     }}
                                   />
                                 </div>
                               )}
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
                                    {formatCurrency(calculateServicePrice(service))}
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
                             {/* Imagen del producto si existe */}
                             {(service as any).image_url && (
                               <div className="w-full h-24 mb-2">
                                 <img 
                                   src={(service as any).image_url} 
                                   alt={service.name}
                                   className="w-full h-full object-cover rounded-md border"
                                   onError={(e) => {
                                     const target = e.target as HTMLImageElement;
                                     target.style.display = 'none';
                                   }}
                                 />
                               </div>
                             )}
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
                                  {formatCurrency(calculateServicePrice(service))}
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
                  <div className="flex items-center gap-3 flex-1">
                    {/* Mostrar imagen del artículo si existe */}
                    {item.image_url && (
                      <div className="w-16 h-16 flex-shrink-0">
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover rounded-md border"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
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
                    </div>
                  </div>
                   <div className="flex items-center gap-2">
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
            
            {/* Resumen de totales */}
            <QuoteTotalsSummary selectedItems={selectedItems} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}