import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Clock, Calendar } from 'lucide-react';

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

interface ServiceCardProps {
  service: ServiceType;
  selectedServiceIds: string[];
  quantities: Record<string, number>;
  updateQuantity: (serviceId: string, quantity: number) => void;
  handleServiceAdd: (service: ServiceType) => void;
  getDisplayPrice: (service: ServiceType, quantity: number) => number;
  formatCurrency: (amount: number) => string;
  formatEstimatedTime: (hours: number | null) => string;
  calculateDeliveryDate: (estimatedHours: number | null) => string;
}

export function ServiceCard({
  service,
  selectedServiceIds,
  quantities,
  updateQuantity,
  handleServiceAdd,
  getDisplayPrice,
  formatCurrency,
  formatEstimatedTime,
  calculateDeliveryDate
}: ServiceCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
        selectedServiceIds.includes(service.id)
          ? 'ring-1 ring-primary/50 border-primary/50' 
          : 'hover:border-primary/50'
      } ${
        service.item_type === 'servicio' 
          ? 'border-l-blue-500 bg-blue-50/30' 
          : 'border-l-green-500 bg-green-50/30'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium">{service.name}</h4>
              <Badge 
                variant={service.item_type === 'servicio' ? 'default' : 'secondary'}
                className={`${
                  service.item_type === 'servicio' 
                    ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200' 
                    : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                }`}
              >
                {service.item_type === 'servicio' ? '🔧 Servicio' : '📦 Producto'}
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
                 {formatCurrency(getDisplayPrice(service, quantities[service.id] || 1))}
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
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 mt-3 sm:mt-0 sm:ml-4">
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
              className="w-full sm:w-auto"
            >
              Agregar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}