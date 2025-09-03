import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Clock, Calendar } from 'lucide-react';
import { useRewardSettings } from '@/hooks/useRewardSettings';

interface ServiceType {
  id: string;
  name: string;
  description?: string | null;
  cost_price: number | null;
  base_price: number | null;
  vat_rate: number;
  item_type: string;
  category: string;
  estimated_hours?: number | null;
  profit_margin_tiers?: Array<{
    min_qty: number;
    max_qty: number;
    margin: number;
  }>;
}

interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface OrderServiceSelectionProps {
  onServiceAdd: (service: ServiceType, quantity?: number) => void;
  selectedServiceIds: string[];
  filterByType?: string;
}

export function OrderServiceSelection({ onServiceAdd, selectedServiceIds, filterByType }: OrderServiceSelectionProps) {
  const { settings: rewardSettings } = useRewardSettings();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load services from service_types
      const { data: servicesData } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('category, name');

      // Transform data to match interface
      const transformedServices = (servicesData || []).map((service: any) => ({
        ...service,
        profit_margin_tiers: Array.isArray(service.profit_margin_tiers) ? service.profit_margin_tiers : []
      }));

      // Extract unique categories from services
      const uniqueCategories = [...new Set(servicesData?.map(s => s.category).filter(Boolean) || [])];
      const categoriesFormatted = uniqueCategories.map(categoryName => ({
        id: categoryName,
        name: categoryName,
        description: `Servicios de ${categoryName}`,
        icon: getCategoryIcon(categoryName)
      }));

      if (servicesData) {
        setServices(transformedServices);
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
      'formateo': '💾',
      'otros': '📋'
    };
    return iconMap[categoryName.toLowerCase()] || '🔧';
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    const matchesType = !filterByType || service.item_type === filterByType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDisplayPrice = (service: ServiceType, quantity: number = 1): number => {
    const salesVatRate = service.vat_rate || 16; // IVA de venta (configurable, por defecto 16%)
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;

    if (service.item_type === 'servicio') {
      // Para servicios: precio base + IVA + cashback
      const basePrice = (service.base_price || 0) * quantity;
      const afterSalesVat = basePrice * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      return finalWithCashback;
    } else {
      // Para artículos: costo base + IVA compra + margen + IVA venta + cashback
      const purchaseVatRate = 16; // IVA de compra fijo 16%
      const baseCost = (service.cost_price || 0) * quantity;
      
      // Obtener margen real del producto, no usar valor fijo
      const marginPercent = service.profit_margin_tiers && service.profit_margin_tiers.length > 0 
        ? service.profit_margin_tiers[0].margin 
        : 30; // 30% solo como fallback
      
      const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
      const afterMargin = afterPurchaseVat * (1 + marginPercent / 100);
      const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
      const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
      
      console.log(`Cálculo para ${service.name}:`, {
        baseCost,
        afterPurchaseVat,
        marginPercent,
        afterMargin,
        afterSalesVat,
        cashbackPercent,
        finalWithCashback
      });
      
      return finalWithCashback;
    }
  };

  // Estado para almacenar precios calculados
  const [calculatedPrices, setCalculatedPrices] = useState<Record<string, number>>({});

  // Función para obtener precio con cache
  const getDisplayPrice = (service: ServiceType, quantity: number = 1): number => {
    const key = `${service.id}-${quantity}`;
    return calculatedPrices[key] || calculateDisplayPrice(service, quantity);
  };

  // Calcular precios cuando cambian servicios o cantidades
  useEffect(() => {
    const calculateAllPrices = () => {
      const newPrices: Record<string, number> = {};
      
      services.forEach((service) => {
        const quantity = quantities[service.id] || 1;
        const key = `${service.id}-${quantity}`;
        newPrices[key] = calculateDisplayPrice(service, quantity);
      });

      setCalculatedPrices(newPrices);
    };

    if (services.length > 0) {
      calculateAllPrices();
    }
  }, [services, quantities, rewardSettings]);

  const formatEstimatedTime = (hours: number | null) => {
    if (!hours) return 'No especificado';
    
    if (hours < 24) {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.ceil(hours / 8); // Asumiendo 8 horas laborables por día
      return `${days} día${days !== 1 ? 's' : ''} laborables`;
    }
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    setQuantities(prev => ({
      ...prev,
      [serviceId]: Math.max(1, quantity)
    }));
  };

  const handleServiceAdd = (service: ServiceType) => {
    const quantity = quantities[service.id] || 1;
    onServiceAdd(service, quantity);
  };

  const calculateDeliveryDate = (estimatedHours: number | null): string => {
    if (!estimatedHours) return '';
    
    const now = new Date();
    const businessDays = Math.ceil(estimatedHours / 8); // 8 horas por día laboral
    
    // Agregar días laborables (excluyendo fines de semana)
    let deliveryDate = new Date(now);
    let addedDays = 0;
    
    while (addedDays < businessDays) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      
      // Si no es fin de semana (0 = domingo, 6 = sábado)
      if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) {
        addedDays++;
      }
    }
    
    return deliveryDate.toISOString().split('T')[0];
  };

  const servicesByCategory = categories.map(category => ({
    ...category,
    services: filteredServices.filter(service => service.category === category.name)
  }));

  const uncategorizedServices = filteredServices.filter(service => 
    !service.category || !categories.some(cat => cat.name === service.category)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4">
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
        
        <div className="w-full sm:w-64">
          <Label htmlFor="category">Filtrar por categoría</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  <span className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    {category.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Services by category */}
      <div className="space-y-6">
        {servicesByCategory.map((category) => {
          if (category.services.length === 0) return null;
          
          return (
            <div key={category.id}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{category.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
              
              <div className="grid gap-3">
                {category.services.map((service) => (
                  <Card 
                    key={service.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedServiceIds.includes(service.id)
                        ? 'ring-1 ring-primary/50 border-primary/50' 
                        : 'hover:border-primary/50'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{service.name}</h4>
                            <Badge variant={service.item_type === 'servicio' ? 'default' : 'secondary'}>
                              {service.item_type}
                            </Badge>
                            {selectedServiceIds.includes(service.id) && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Agregado
                              </Badge>
                            )}
                          </div>
                          
                          {service.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {service.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-4 text-sm">
                           <div className="flex items-center gap-1">
                             <Package className="h-4 w-4 text-green-600" />
                             <span className="font-medium text-green-600">
                               Total: {formatCurrency(getDisplayPrice(service, quantities[service.id] || 1))}
                               <span className="text-xs text-muted-foreground ml-1">
                                 (inc. IVA {service.vat_rate}%{rewardSettings?.apply_cashback_to_items ? ` + Cashback ${rewardSettings.general_cashback_percent}%` : ''})
                               </span>
                             </span>
                             {(quantities[service.id] || 1) > 1 && (
                               <span className="text-xs text-muted-foreground">
                                 ({formatCurrency(getDisplayPrice(service, 1))} c/u)
                               </span>
                             )}
                           </div>
                            
                            {service.estimated_hours && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-blue-600" />
                                <span className="text-blue-600">
                                  {formatEstimatedTime(service.estimated_hours)}
                                </span>
                              </div>
                            )}
                            
                            {service.estimated_hours && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-orange-600" />
                                <span className="text-orange-600">
                                  Entrega estimada: {new Date(calculateDeliveryDate(service.estimated_hours)).toLocaleDateString('es-CO')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`qty-${service.id}`} className="text-xs">Cant:</Label>
                            <Input
                              id={`qty-${service.id}`}
                              type="number"
                              min="1"
                              value={quantities[service.id] || 1}
                              onChange={(e) => updateQuantity(service.id, parseInt(e.target.value) || 1)}
                              className="w-16 h-8"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleServiceAdd(service)}
                          >
                            Agregar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {/* Uncategorized services */}
        {uncategorizedServices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="text-lg font-semibold">Sin categoría</h3>
                <p className="text-sm text-muted-foreground">Servicios sin categoría asignada</p>
              </div>
            </div>
            
            <div className="grid gap-3">
              {uncategorizedServices.map((service) => (
                <Card 
                  key={service.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedServiceIds.includes(service.id)
                      ? 'ring-1 ring-primary/50 border-primary/50' 
                      : 'hover:border-primary/50'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{service.name}</h4>
                          <Badge variant={service.item_type === 'servicio' ? 'default' : 'secondary'}>
                            {service.item_type}
                          </Badge>
                          {selectedServiceIds.includes(service.id) && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Agregado
                            </Badge>
                          )}
                        </div>
                        
                        {service.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {service.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-4 text-sm">
                           <div className="flex items-center gap-1">
                             <Package className="h-4 w-4 text-green-600" />
                             <span className="font-medium text-green-600">
                               Total: {formatCurrency(getDisplayPrice(service, quantities[service.id] || 1))}
                               <span className="text-xs text-muted-foreground ml-1">
                                 (inc. IVA {service.vat_rate}%{rewardSettings?.apply_cashback_to_items ? ` + Cashback ${rewardSettings.general_cashback_percent}%` : ''})
                               </span>
                             </span>
                             {(quantities[service.id] || 1) > 1 && (
                               <span className="text-xs text-muted-foreground">
                                 ({formatCurrency(getDisplayPrice(service, 1))} c/u)
                               </span>
                             )}
                           </div>
                          
                          {service.estimated_hours && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span className="text-blue-600">
                                {formatEstimatedTime(service.estimated_hours)}
                              </span>
                            </div>
                          )}
                          
                          {service.estimated_hours && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-orange-600" />
                              <span className="text-orange-600">
                                Entrega estimada: {new Date(calculateDeliveryDate(service.estimated_hours)).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex items-center gap-1">
                          <Label htmlFor={`qty-uncategorized-${service.id}`} className="text-xs">Cant:</Label>
                          <Input
                            id={`qty-uncategorized-${service.id}`}
                            type="number"
                            min="1"
                            value={quantities[service.id] || 1}
                            onChange={(e) => updateQuantity(service.id, parseInt(e.target.value) || 1)}
                            className="w-16 h-8"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleServiceAdd(service)}
                        >
                          Agregar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No se encontraron servicios</h3>
          <p className="text-muted-foreground">
            {searchTerm || selectedCategory 
              ? 'Intenta cambiar los filtros de búsqueda' 
              : 'No hay servicios disponibles en este momento'
            }
          </p>
        </div>
      )}
    </div>
  );
}