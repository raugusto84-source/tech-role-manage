import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { OrderServiceSelection } from './OrderServiceSelection';
import { Package, Wrench, ShoppingCart } from 'lucide-react';
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
  const { settings: rewardSettings } = useRewardSettings();
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateServicePrice = (service: ServiceType, quantity: number): number => {
    const salesVatRate = service.vat_rate || 16;
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;

    // Para servicios: precio base + IVA + cashback
    const basePrice = (service.base_price || 0) * quantity;
    const afterSalesVat = basePrice * (1 + salesVatRate / 100);
    const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
    return finalWithCashback;
  };

  const calculateProductPrice = (service: ServiceType, quantity: number): number => {
    const purchaseVatRate = 16; // IVA de compra fijo 16%
    const salesVatRate = service.vat_rate || 16;
    const margin = 30; // 30% margen por defecto
    const cashbackPercent = rewardSettings?.apply_cashback_to_items
      ? (rewardSettings.general_cashback_percent || 0)
      : 0;

    // Para artículos: costo base + IVA compra + margen + IVA venta + cashback
    const baseCost = (service.cost_price || 0) * quantity;
    const afterPurchaseVat = baseCost * (1 + purchaseVatRate / 100);
    const afterMargin = afterPurchaseVat * (1 + margin / 100);
    const afterSalesVat = afterMargin * (1 + salesVatRate / 100);
    const finalWithCashback = afterSalesVat * (1 + cashbackPercent / 100);
    return finalWithCashback;
  };

  const services = selectedServices.filter(item => item.service.item_type === 'servicio');
  const products = selectedServices.filter(item => item.service.item_type === 'articulo');

  const servicesTotal = services.reduce((total, item) => {
    return total + calculateServicePrice(item.service, item.quantity);
  }, 0);

  const productsTotal = products.reduce((total, item) => {
    return total + calculateProductPrice(item.service, item.quantity);
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

      {/* Selected Items Summary */}
      {selectedServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Resumen de Selección
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Services Section */}
            {services.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-600" />
                    Servicios ({services.length})
                  </h4>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {formatCurrency(servicesTotal)}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {services.map(({ service, quantity }) => {
                    const finalPrice = calculateServicePrice(service, quantity);
                    const unitPrice = calculateServicePrice(service, 1);
                    
                    return (
                      <div key={service.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Cantidad: {quantity} | Precio unitario: {formatCurrency(unitPrice)}
                            <span className="text-xs ml-1">
                              (inc. IVA {service.vat_rate}%{rewardSettings?.apply_cashback_to_items ? ` + Cashback ${rewardSettings.general_cashback_percent}%` : ''})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatCurrency(finalPrice)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRemoveService(service.id)}
                          >
                            Quitar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Separator */}
            {services.length > 0 && products.length > 0 && (
              <Separator />
            )}

            {/* Products Section */}
            {products.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-600" />
                    Productos ({products.length})
                  </h4>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {formatCurrency(productsTotal)}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {products.map(({ service, quantity }) => {
                    const finalPrice = calculateProductPrice(service, quantity);
                    const unitPrice = calculateProductPrice(service, 1);
                    
                    return (
                      <div key={service.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Cantidad: {quantity} | Precio unitario: {formatCurrency(unitPrice)}
                            <span className="text-xs ml-1">
                              (IVA compra 16% + Margen + IVA venta {service.vat_rate}%{rewardSettings?.apply_cashback_to_items ? ` + Cashback ${rewardSettings.general_cashback_percent}%` : ''})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatCurrency(finalPrice)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRemoveService(service.id)}
                          >
                            Quitar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total */}
            <Separator />
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total Estimado:</span>
              <span>{formatCurrency(servicesTotal + productsTotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}