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
import { Plus, Package, Search, Shield, Monitor, X } from 'lucide-react';
import { QuoteTotalsSummary } from './QuoteTotalsSummary';
import { formatCOPCeilToTen, ceilToTen } from '@/utils/currency';
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
  clientId?: string;
  clientEmail?: string;
}
export function CategoryServiceSelection({
  selectedItems,
  onItemsChange,
  simplifiedView = false,
  clientId,
  clientEmail
}: CategoryServiceSelectionProps) {
  const {
    profile
  } = useAuth();
  const {
    settings: rewardSettings
  } = useRewardSettings();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);

  // Custom item form
  const [customItem, setCustomItem] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0
  });
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      setLoading(true);

      // Load services directly from service_types (same as sales module)
      const {
        data: servicesData
      } = await supabase.from('service_types').select('*').eq('is_active', true).order('category, name');

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
          profit_margin_tiers: Array.isArray(service.profit_margin_tiers) ? service.profit_margin_tiers : []
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
    return service.item_type === 'articulo' || service.profit_margin_tiers && service.profit_margin_tiers.length > 0;
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
      // For services: use base_price first, then cost_price as fallback
      const basePrice = service.base_price || service.cost_price || 0;
      if (basePrice === 0) {
        console.warn('Service has no price set:', service.name);
        return 0; // Return 0 instead of default price to identify the issue
      }
      const vat = basePrice * ((service.vat_rate || 0) / 100);
      const baseTotal = basePrice + vat;

      // Apply cashback if settings are available and cashback is enabled for items
      let cashback = 0;
      if (rewardSettings?.apply_cashback_to_items && rewardSettings.general_cashback_percent > 0) {
        cashback = baseTotal * (rewardSettings.general_cashback_percent / 100);
      }
      const finalPrice = baseTotal + cashback;
      console.log('Service price calculation result:', {
        basePrice,
        vat,
        baseTotal,
        cashback,
        finalPrice
      });
      return finalPrice;
    }
  };
  const addService = (service: ServiceType) => {
    const calculatedPrice = calculateServicePrice(service);
    const finalUnitPrice = ceilToTen(calculatedPrice);
    const vatRate = service.vat_rate || 16;

    // Calculate VAT breakdown from the rounded unit price
    const subtotalBeforeVat = finalUnitPrice / (1 + vatRate / 100);
    const vatAmount = finalUnitPrice - subtotalBeforeVat;
    const newItem: QuoteItem = {
      id: `service-${Date.now()}-${Math.random()}`,
      service_type_id: service.id,
      name: service.name,
      description: service.description || '',
      quantity: 1,
      unit_price: finalUnitPrice,
      subtotal: subtotalBeforeVat,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      withholding_rate: 0,
      withholding_amount: 0,
      withholding_type: '',
      total: finalUnitPrice,
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
    const subtotal = customItem.unit_price * customItem.quantity;
    const vatAmount = subtotal * 0.16; // 16% VAT
    const total = subtotal + vatAmount;
    const newItem: QuoteItem = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: customItem.name,
      description: customItem.description,
      quantity: customItem.quantity,
      unit_price: customItem.unit_price,
      subtotal: subtotal,
      vat_rate: 16,
      // Fixed 16% VAT for all items
      vat_amount: vatAmount,
      withholding_rate: 0,
      withholding_amount: 0,
      withholding_type: '',
      total: total,
      is_custom: true
    };
    onItemsChange([...selectedItems, newItem]);

    // Reset form
    setCustomItem({
      name: '',
      description: '',
      quantity: 1,
      unit_price: 0
    });
  };
  const removeItem = (itemId: string) => {
    onItemsChange(selectedItems.filter(item => item.id !== itemId));
  };
  const filteredServices = services.filter(service => service.name.toLowerCase().includes(searchTerm.toLowerCase()) || service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));
  const formatCurrency = (amount: number) => formatCOPCeilToTen(amount);
  const servicesByCategory = categories.map(category => ({
    ...category,
    services: filteredServices.filter(service => service.category_name === category.name)
  }));
  const uncategorizedServices = filteredServices.filter(service => !service.category_name || service.category_name === 'Sin categoría');

  // Group categories into main categories
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
    return filteredServices.filter(service => categoryNames.includes(service.category_name || '') && service.item_type === itemType);
  };
  const renderCategoryButton = (mainCategory: string, itemType: string) => {
    const IconComponent = getMainCategoryIcon(mainCategory);
    const count = getFilteredServices(mainCategory, itemType).length;
    return <Button variant="outline" className="h-20 flex flex-col gap-2 hover:bg-primary/10" onClick={() => setSelectedMainCategory(`${mainCategory}-${itemType}`)}>
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
          {/* Services Categories */}
          <div>
            <h3 className="text-lg font-medium mb-4">Servicios</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderCategoryButton('Seguridad', 'servicio')}
              {renderCategoryButton('Sistemas', 'servicio')}
            </div>
          </div>
          
          {/* Products Categories */}
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {/* Services/Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map(service => <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {service.image_url && <div className="w-full h-24 mb-2">
                      <img src={service.image_url} alt={service.name} className="w-full h-full object-cover rounded-md border" onError={e => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }} />
                    </div>}
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
                      {formatCurrency(calculateServicePrice(service))}
                    </span>
                    <Button size="sm" onClick={() => addService(service)} className="h-7 px-2">
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
  return <div className="space-y-6">
      <Tabs defaultValue="selection" className="w-full">
        <TabsList className="grid w-full grid-cols-1 gap-1 p-1">
          <TabsTrigger value="selection" className="text-xs md:text-sm">
            <span className="md:hidden">Selección</span>
            <span className="hidden md:inline">Seleccionar Servicios y Productos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="selection" className="space-y-4">
          {renderMainCategoryView()}
        </TabsContent>

        {/* Selected Items Display */}
        {selectedItems.length > 0 && <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Servicios y Productos Seleccionados</span>
                  <Badge variant="outline">{selectedItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedItems.map(item => <div key={item.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Cantidad: {item.quantity} | {formatCurrency(item.total)}
                        </div>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => removeItem(item.id)} className="h-7 w-7 p-0">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>)}
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-2">
                  
                  <div className="flex justify-between text-sm">
                    <span>IVA:</span>
                    <span>{formatCurrency(selectedItems.reduce((sum, item) => sum + item.vat_amount, 0))}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedItems.reduce((sum, item) => sum + item.total, 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>}

        {/* Totals Summary - Solo mostrar si no es vista simplificada y hay items */}
        {!simplifiedView && selectedItems.length > 0 && clientId && <div className="mt-6">
            <Card>
              <CardContent className="p-4">
                <QuoteTotalsSummary selectedItems={selectedItems} clientId={clientId} clientEmail={clientEmail} onCashbackChange={() => {}} />
              </CardContent>
            </Card>
          </div>}
      </Tabs>
    </div>;
}