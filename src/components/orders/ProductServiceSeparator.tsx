import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { OrderServiceSelection } from './OrderServiceSelection';
import { Package, Wrench, ShoppingCart } from 'lucide-react';
import { useSalesPricingCalculation } from '@/hooks/useSalesPricingCalculation';

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

interface ProductServiceSeparatorProps {
  onServiceAdd: (service: ServiceType, quantity?: number) => void;
  selectedServiceIds: string[];
  selectedServices: Array<{ service: ServiceType; quantity: number }>;
  onRemoveService: (serviceId: string) => void;
}

export function ProductServiceSeparator({ 
  onServiceAdd, 
  selectedServiceIds, 
  selectedServices,
  onRemoveService 
}: ProductServiceSeparatorProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
  const { getDisplayPrice, formatCurrency } = useSalesPricingCalculation();

  const services = selectedServices.filter(item => item.service.item_type === 'servicio');
  const products = selectedServices.filter(item => item.service.item_type === 'articulo');

  const servicesTotal = services.reduce((total, item) => {
    return total + getDisplayPrice(item.service, item.quantity);
  }, 0);

  const productsTotal = products.reduce((total, item) => {
    return total + getDisplayPrice(item.service, item.quantity);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Selection Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Servicios y Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'services' | 'products')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Servicios
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="mt-6">
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <Wrench className="h-5 w-5" />
                  <span className="font-medium">Servicios Técnicos</span>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  Servicios profesionales con precios fijos establecidos
                </p>
              </div>
              <OrderServiceSelection 
                onServiceAdd={onServiceAdd}
                selectedServiceIds={selectedServiceIds}
                filterByType="servicio"
              />
            </TabsContent>

            <TabsContent value="products" className="mt-6">
              <div className="mb-4 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <Package className="h-5 w-5" />
                  <span className="font-medium">Productos y Artículos</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Productos físicos con costo base + margen + IVA
                </p>
              </div>
              <OrderServiceSelection 
                onServiceAdd={onServiceAdd}
                selectedServiceIds={selectedServiceIds}
                filterByType="articulo"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

    </div>
  );
}