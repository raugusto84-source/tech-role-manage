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
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';
import { ServiceCard } from './ServiceCard';

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
  serviceCategory?: 'sistemas' | 'seguridad';
}

export function OrderServiceSelection({ onServiceAdd, selectedServiceIds, filterByType, serviceCategory }: OrderServiceSelectionProps) {
  const { getDisplayPrice, formatCurrency } = useSalesPricingCalculation();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItemType, setSelectedItemType] = useState<string>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [serviceCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load services from service_types filtered by category
      let query = supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true);
      
      if (serviceCategory) {
        query = query.eq('service_category', serviceCategory);
      }
      
      const { data: servicesData } = await query.order('category, name');

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
    const matchesType = selectedItemType === 'all' || service.item_type === selectedItemType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const formatEstimatedTime = (hours: number | null) => {
    if (!hours) return 'No especificado';
    
    if (hours < 24) {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.ceil(hours / 8);
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
    const businessDays = Math.ceil(estimatedHours / 8);
    
    let deliveryDate = new Date(now);
    let addedDays = 0;
    
    while (addedDays < businessDays) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      
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
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar servicios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Item type filter buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={selectedItemType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedItemType('all')}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant={selectedItemType === 'servicio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedItemType('servicio')}
          >
            Servicios
          </Button>
          <Button
            type="button"
            variant={selectedItemType === 'articulo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedItemType('articulo')}
          >
            Productos
          </Button>
        </div>
        
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              Todas las categorías
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={selectedCategory === category.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.name)}
                className="flex items-center gap-1"
              >
                <span>{category.icon}</span>
                {category.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Services by category */}
      <div className="space-y-6">
        {servicesByCategory.map((category) => {
          if (category.services.length === 0) return null;
          
          // Separate services and products for this category
          const categoryServices = category.services.filter(service => service.item_type === 'servicio');
          const categoryProducts = category.services.filter(service => service.item_type === 'articulo');
          
          return (
            <div key={category.id}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{category.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {categoryServices.length} servicios • {categoryProducts.length} productos
                  </p>
                </div>
              </div>
              
              {/* Show services if any and if filter allows */}
              {categoryServices.length > 0 && (selectedItemType === 'all' || selectedItemType === 'servicio') && (
                <div className="mb-6">
                  <h4 className="text-md font-medium mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Servicios de {category.name}
                  </h4>
                  <div className="grid gap-3">
                    {categoryServices.map((service) => (
                      <ServiceCard 
                        key={service.id} 
                        service={service} 
                        selectedServiceIds={selectedServiceIds}
                        quantities={quantities}
                        updateQuantity={updateQuantity}
                        handleServiceAdd={handleServiceAdd}
                        getDisplayPrice={getDisplayPrice}
                        formatCurrency={formatCurrency}
                        formatEstimatedTime={formatEstimatedTime}
                        calculateDeliveryDate={calculateDeliveryDate}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Show products if any and if filter allows */}
              {categoryProducts.length > 0 && (selectedItemType === 'all' || selectedItemType === 'articulo') && (
                <div>
                  <h4 className="text-md font-medium mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Productos de {category.name}
                  </h4>
                  <div className="grid gap-3">
                    {categoryProducts.map((service) => (
                      <ServiceCard 
                        key={service.id} 
                        service={service} 
                        selectedServiceIds={selectedServiceIds}
                        quantities={quantities}
                        updateQuantity={updateQuantity}
                        handleServiceAdd={handleServiceAdd}
                        getDisplayPrice={getDisplayPrice}
                        formatCurrency={formatCurrency}
                        formatEstimatedTime={formatEstimatedTime}
                        calculateDeliveryDate={calculateDeliveryDate}
                      />
                    ))}
                  </div>
                </div>
              )}
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
                <ServiceCard 
                  key={service.id} 
                  service={service} 
                  selectedServiceIds={selectedServiceIds}
                  quantities={quantities}
                  updateQuantity={updateQuantity}
                  handleServiceAdd={handleServiceAdd}
                  getDisplayPrice={getDisplayPrice}
                  formatCurrency={formatCurrency}
                  formatEstimatedTime={formatEstimatedTime}
                  calculateDeliveryDate={calculateDeliveryDate}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {filteredServices.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No se encontraron servicios que coincidan con los filtros aplicados.
          </p>
        </div>
      )}
    </div>
  );
}